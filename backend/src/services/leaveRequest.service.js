const leaveRequestModel = require("../models/leaveRequest.model");

const TEACHER_ROLES = ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"];

function pickTeacherRole(roleNames = []) {
  return TEACHER_ROLES.find((r) => roleNames.includes(r)) || "HOMEROOM_TEACHER";
}

function formatLeaveDate(value) {
  // value already 'YYYY-MM-DD HH:mm' from the model
  if (!value) return "";
  const [datePart] = value.split(" ");
  const [y, m, d] = datePart.split("-");
  return `${d}/${m}/${y}`;
}

function buildNotifications({ detail, decision, teacherUserId, comment, pendingSupervisor }) {
  const isApprove   = decision === "APPROVE";
  const actionLabel = pendingSupervisor
    ? "đã được giáo viên chủ nhiệm duyệt và đang chờ quản nhiệm xác nhận"
    : isApprove ? "đã được duyệt" : "đã bị từ chối";
  const range =
    detail.startDate === detail.endDate
      ? formatLeaveDate(detail.startDate)
      : `${formatLeaveDate(detail.startDate)} – ${formatLeaveDate(detail.endDate)}`;

  const title = pendingSupervisor
    ? "Đơn xin nghỉ đang chờ quản nhiệm"
    : isApprove ? "Đơn xin nghỉ đã được duyệt" : "Đơn xin nghỉ bị từ chối";
  const content =
    `Đơn xin nghỉ của ${detail.studentName} (${range}) ${actionLabel}.` +
    (comment ? ` Ghi chú: ${comment}` : "");

  const targets = [];

  if (detail.studentUserId) targets.push(detail.studentUserId);
  if (detail.parentUserId)  targets.push(detail.parentUserId);
  if (teacherUserId)        targets.push(teacherUserId);

  // De-duplicate receivers (student/parent/teacher could overlap edge cases)
  const unique = [...new Set(targets)];

  return unique.map((receiverId) => ({ receiverId, title, content }));
}

/**
 * Approve or reject a pending leave request.
 *
 * @throws {Error} with .statusCode set (400/403/404/409) on rule violations
 */
async function decideLeaveRequest({
  leaveRequestId,
  decision, // 'APPROVE' | 'REJECT'
  comment,
  actor, // { userId, teacherId, roleNames }
}) {
  if (decision !== "APPROVE" && decision !== "REJECT") {
    const err = new Error("Hành động không hợp lệ");
    err.statusCode = 400;
    throw err;
  }

  // BR: reason/comment mandatory for both approve and reject
  if (!comment || !comment.trim()) {
    const err = new Error(
      decision === "APPROVE"
        ? "Vui lòng nhập ghi chú duyệt đơn"
        : "Vui lòng nhập lý do từ chối",
    );
    err.statusCode = 400;
    throw err;
  }

  const detail = await leaveRequestModel.findDetailById(leaveRequestId);

  if (!detail) {
    const err = new Error("Không tìm thấy đơn xin nghỉ");
    err.statusCode = 404;
    throw err;
  }

  // Permission: the request must belong to this teacher's assignment
  if (detail.homeroomTeacherId !== actor.teacherId) {
    const err = new Error("Bạn không có quyền xử lý đơn xin nghỉ này");
    err.statusCode = 403;
    throw err;
  }

  // BR: only PENDING requests can be approved/rejected
  if (detail.status !== "PENDING") {
    const err = new Error(
      `Đơn này đã được xử lý (${detail.status}). Không thể thay đổi.`,
    );
    err.statusCode = 409;
    throw err;
  }

  if (detail.approvalHistory?.some((item) => item.role === "HOMEROOM_TEACHER")) {
    const err = new Error("Đơn đã được giáo viên chủ nhiệm xử lý và đang chờ quản nhiệm.");
    err.statusCode = 409;
    throw err;
  }

  const teacherUserId = await leaveRequestModel.findTeacherUserId(actor.teacherId);

  const waitsForSupervisor = decision === "APPROVE" && detail.requiresSupervisor;
  const notifications = buildNotifications({
    detail,
    decision,
    teacherUserId,
    comment: comment.trim(),
    pendingSupervisor: waitsForSupervisor,
  });

  const finalStatus = decision === "REJECT"
    ? "REJECTED"
    : waitsForSupervisor ? "PENDING" : "APPROVED";

  const { updated } = await leaveRequestModel.applyDecision({
    leaveRequestId,
    newStatus: finalStatus,
    approverUserId: actor.userId,
    role: pickTeacherRole(actor.roleNames),
    action: decision,
    comment: comment.trim(),
    notifications,
  });

  if (!updated) {
    // Lost a race — another actor already moved it out of PENDING
    const err = new Error("Đơn đã được xử lý bởi thao tác khác. Vui lòng tải lại.");
    err.statusCode = 409;
    throw err;
  }

  return {
    leaveRequestId,
    status: finalStatus,
    pendingSupervisor: waitsForSupervisor,
  };
}

module.exports = {
  decideLeaveRequest,
};
