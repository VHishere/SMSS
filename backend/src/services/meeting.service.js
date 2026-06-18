const meetingModel = require("../models/meeting.model");
const { pool } = require("../config/db");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function toMysqlDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

async function notify(receivers, title, content, meetingId) {
  if (!receivers.length) return;
  await pool.query(
    `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
    [receivers.map((rid) => [rid, title, content, "MEETING", "PARENT_MEETING", meetingId, false])],
  );
}

async function ensureOwner(meetingId, teacher) {
  const meeting = await meetingModel.findMeetingById(meetingId);
  if (!meeting) throw httpError("Không tìm thấy cuộc họp", 404);
  if (meeting.teacherId !== teacher.teacherId) throw httpError("Bạn không có quyền với cuộc họp này", 403);
  return meeting;
}

// ── Scheduling ────────────────────────────────────────────────────────────────

async function createMeeting({ teacher, payload }) {
  if (!payload.title || !payload.title.trim()) throw httpError("Tiêu đề cuộc họp là bắt buộc", 400);
  if (!payload.meetingDate) throw httpError("Thời gian họp là bắt buộc", 400);
  if (!payload.classId) throw httpError("Cần chọn lớp", 400);

  const ok = await meetingModel.isTeacherForClass(teacher.teacherId, payload.classId);
  if (!ok) throw httpError("Bạn không phụ trách lớp này", 403);

  const invitees = Array.isArray(payload.invitees) ? payload.invitees : [];
  if (invitees.length === 0) throw httpError("Cần chọn ít nhất một người tham dự", 400);

  const meetingId = await meetingModel.createMeeting({
    classId: payload.classId,
    studentId: payload.studentId ?? null,
    teacherId: teacher.teacherId,
    meetingType: payload.meetingType ?? "CLASS",
    title: payload.title.trim(),
    meetingDate: toMysqlDateTime(payload.meetingDate),
    endTime: toMysqlDateTime(payload.endTime),
    location: payload.location ?? null,
    content: payload.content ?? null,
    createdBy: teacher.userId,
  });

  await meetingModel.addInvitations(meetingId, invitees.map((i) => ({ userId: i.userId, studentId: i.studentId ?? null })));
  await meetingModel.log(meetingId, "CREATE", `Tạo cuộc họp "${payload.title.trim()}"`, teacher.userId);

  try {
    const receivers = invitees.map((i) => i.userId);
    await notify(receivers, "Lời mời họp phụ huynh", `Bạn được mời họp: "${payload.title.trim()}" lúc ${payload.meetingDate}.`, meetingId);
  } catch (e) { console.error("createMeeting notify:", e); }

  return { meetingId };
}

async function updateMeeting({ teacher, meetingId, payload }) {
  const meeting = await ensureOwner(meetingId, teacher);
  if (["ARCHIVED", "CANCELLED"].includes(meeting.status)) throw httpError("Cuộc họp đã đóng, không thể sửa", 409);
  if (!payload.title || !payload.title.trim()) throw httpError("Tiêu đề là bắt buộc", 400);
  if (!payload.meetingDate) throw httpError("Thời gian họp là bắt buộc", 400);

  const affected = await meetingModel.updateMeeting(meetingId, {
    title: payload.title.trim(),
    meetingType: payload.meetingType ?? meeting.meetingType,
    meetingDate: toMysqlDateTime(payload.meetingDate),
    endTime: toMysqlDateTime(payload.endTime),
    location: payload.location ?? null,
    content: payload.content ?? null,
    studentId: payload.studentId ?? meeting.studentId,
  });
  if (affected === 0) throw httpError("Không thể cập nhật cuộc họp", 409);

  await meetingModel.log(meetingId, "UPDATE", "Cập nhật thông tin cuộc họp", teacher.userId);
  try {
    const receivers = await meetingModel.findInvitationRecipients(meetingId);
    await notify(receivers, "Cuộc họp được cập nhật", `Cuộc họp "${payload.title.trim()}" có thay đổi. Vui lòng kiểm tra.`, meetingId);
  } catch (e) { console.error("updateMeeting notify:", e); }

  return { meetingId };
}

async function changeStatus({ teacher, meetingId, status }) {
  const meeting = await ensureOwner(meetingId, teacher);
  if (!["SCHEDULED", "COMPLETED", "CANCELLED", "ARCHIVED"].includes(status)) throw httpError("Trạng thái không hợp lệ", 400);

  await meetingModel.setMeetingStatus(meetingId, status);
  await meetingModel.log(meetingId, status, `Đổi trạng thái sang ${status}`, teacher.userId);

  if (status === "CANCELLED") {
    try {
      const receivers = await meetingModel.findInvitationRecipients(meetingId);
      await notify(receivers, "Cuộc họp bị hủy", `Cuộc họp "${meeting.title}" đã bị hủy.`, meetingId);
    } catch (e) { console.error("cancel notify:", e); }
  }
  return { meetingId, status };
}

// ── Invitations ───────────────────────────────────────────────────────────────

async function addInvitees({ teacher, meetingId, invitees }) {
  await ensureOwner(meetingId, teacher);
  if (!Array.isArray(invitees) || invitees.length === 0) throw httpError("Không có người để mời", 400);

  await meetingModel.addInvitations(meetingId, invitees.map((i) => ({ userId: i.userId, studentId: i.studentId ?? null })));
  await meetingModel.log(meetingId, "INVITE", `Mời thêm ${invitees.length} người`, teacher.userId);
  try {
    await notify(invitees.map((i) => i.userId), "Lời mời họp phụ huynh", "Bạn được mời tham dự một cuộc họp.", meetingId);
  } catch (e) { console.error("invite notify:", e); }
  return { added: invitees.length };
}

async function resendInvitation({ teacher, meetingId, invitationId, recipientUserId }) {
  await ensureOwner(meetingId, teacher);
  const affected = await meetingModel.resendInvitation(invitationId, meetingId);
  if (affected === 0) throw httpError("Không tìm thấy lời mời", 404);
  await meetingModel.log(meetingId, "RESEND", "Gửi lại lời mời", teacher.userId);
  if (recipientUserId) {
    try { await notify([recipientUserId], "Nhắc lại lời mời họp", "Vui lòng phản hồi lời mời họp phụ huynh.", meetingId); }
    catch (e) { console.error("resend notify:", e); }
  }
  return { invitationId };
}

// ── Minutes ───────────────────────────────────────────────────────────────────

async function saveMinutes({ teacher, meetingId, payload }) {
  await ensureOwner(meetingId, teacher);

  const existing = await meetingModel.findMinutes(meetingId);
  if (existing && existing.isSubmitted) throw httpError("Biên bản đã chốt, không thể chỉnh sửa", 409);

  await meetingModel.upsertMinutes({
    meetingId,
    discussion: payload.discussion ?? null,
    agreements: payload.agreements ?? null,
    decisions: payload.decisions ?? null,
    submit: Boolean(payload.submit),
    createdBy: teacher.userId,
  });

  await meetingModel.log(meetingId, payload.submit ? "MINUTES_SUBMIT" : "MINUTES_SAVE",
    payload.submit ? "Chốt biên bản họp" : "Lưu nháp biên bản", teacher.userId);

  return { meetingId, submitted: Boolean(payload.submit) };
}

// ── Follow-up actions ─────────────────────────────────────────────────────────

async function createAction({ teacher, meetingId, payload }) {
  await ensureOwner(meetingId, teacher);
  if (!payload.title || !payload.title.trim()) throw httpError("Tiêu đề công việc là bắt buộc", 400);
  if (!payload.deadline) throw httpError("Hạn hoàn thành là bắt buộc", 400);

  const actionId = await meetingModel.createAction({
    meetingId,
    title: payload.title.trim(),
    description: payload.description ?? null,
    assigneeUserId: payload.assigneeUserId ?? null,
    deadline: payload.deadline,
    createdBy: teacher.userId,
  });

  await meetingModel.log(meetingId, "ACTION_CREATE", `Giao việc: ${payload.title.trim()}`, teacher.userId);
  if (payload.assigneeUserId) {
    try { await notify([payload.assigneeUserId], "Bạn được giao công việc theo dõi", `${payload.title.trim()} · hạn ${payload.deadline}`, meetingId); }
    catch (e) { console.error("action notify:", e); }
  }
  return { actionId };
}

async function updateActionStatus({ teacher, meetingId, actionId, status }) {
  await ensureOwner(meetingId, teacher);
  if (!["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status)) throw httpError("Trạng thái không hợp lệ", 400);

  const affected = await meetingModel.updateActionStatus(actionId, meetingId, status);
  if (affected === 0) throw httpError("Không tìm thấy công việc", 404);
  await meetingModel.log(meetingId, "ACTION_UPDATE", `Cập nhật công việc → ${status}`, teacher.userId);
  return { actionId, status };
}

// ── Detail aggregate ──────────────────────────────────────────────────────────

async function getMeetingDetail({ teacher, meetingId }) {
  const meeting = await ensureOwner(meetingId, teacher);
  const [invitations, minutes, actions, logs] = await Promise.all([
    meetingModel.findInvitations(meetingId),
    meetingModel.findMinutes(meetingId),
    meetingModel.findActions(meetingId),
    meetingModel.findLog(meetingId),
  ]);
  return { meeting, invitations, minutes, actions, logs };
}

module.exports = {
  createMeeting,
  updateMeeting,
  changeStatus,
  addInvitees,
  resendInvitation,
  saveMinutes,
  createAction,
  updateActionStatus,
  getMeetingDetail,
};
