const goalModel = require("../models/goal.model");

const GOAL_TYPES = ["ACADEMIC", "BEHAVIOUR", "ATTENDANCE", "PERSONAL"];

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function todayStr() {
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function validateBase({ title, goalType, targetDate }) {
  if (!title || !title.trim()) throw httpError("Tiêu đề mục tiêu là bắt buộc", 400);
  if (!goalType || !GOAL_TYPES.includes(goalType)) throw httpError("Loại mục tiêu không hợp lệ", 400);
  if (!targetDate) throw httpError("Hạn hoàn thành là bắt buộc", 400);
  if (String(targetDate).slice(0, 10) < todayStr()) throw httpError("Hạn hoàn thành phải từ hôm nay trở đi", 400);
}

function notif(recipients, title, content) {
  return recipients.map((receiverId) => ({ receiverId, title, content }));
}

async function createGoal({ actorUserId, studentId, payload }) {
  validateBase(payload);

  const recipients = await goalModel.findStudentRecipients(studentId);
  const goalId = await goalModel.createGoal({
    studentId,
    goalType: payload.goalType,
    title: payload.title.trim(),
    description: payload.description ?? null,
    targetDate: payload.targetDate || null,
    teacherRemark: payload.teacherRemark ?? null,
    createdBy: actorUserId,
    note: payload.note ?? null,
    notifications: notif(recipients, "Mục tiêu mới được giao", `Bạn được giao mục tiêu: "${payload.title.trim()}".`),
  });

  return { goalId };
}

async function updateGoal({ actorUserId, goalId, payload }) {
  const goal = await goalModel.findById(goalId);
  if (!goal) throw httpError("Không tìm thấy mục tiêu", 404);
  if (!["OPEN", "IN_PROGRESS"].includes(goal.status)) {
    throw httpError("Mục tiêu đã kết thúc hoặc lưu trữ, không thể chỉnh sửa", 409);
  }

  validateBase(payload);

  await goalModel.updateGoal({
    goalId,
    changedBy: actorUserId,
    fields: {
      goalType: payload.goalType,
      title: payload.title.trim(),
      description: payload.description ?? null,
      targetDate: payload.targetDate || null,
      teacherRemark: payload.teacherRemark ?? null,
      note: payload.note ?? null,
    },
  });

  // Notify of update (non-critical)
  try {
    const recipients = await goalModel.findStudentRecipients(goal.studentId);
    await notifyUpdate(recipients, payload.title.trim(), goalId);
  } catch (e) {
    console.error("updateGoal notifications (non-critical):", e);
  }

  return { goalId };
}

const { pool } = require("../config/db");
async function notifyUpdate(recipients, title, goalId) {
  if (!recipients.length) return;
  await pool.query(
    `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
    [recipients.map((rid) => [rid, "Mục tiêu được cập nhật", `Mục tiêu "${title}" đã được cập nhật.`, "GOAL", "STUDENT_GOAL", goalId, false])],
  );
}

async function updateProgress({ actorUserId, goalId, payload }) {
  const goal = await goalModel.findById(goalId);
  if (!goal) throw httpError("Không tìm thấy mục tiêu", 404);
  if (goal.status === "ARCHIVED") throw httpError("Mục tiêu đã lưu trữ, không thể cập nhật", 409);

  const newProgress = Number(payload.progress);
  if (!Number.isInteger(newProgress) || newProgress < 0 || newProgress > 100) {
    throw httpError("Tiến độ phải từ 0 đến 100", 400);
  }

  // Auto-complete when reaching 100% (still allows explicit evaluation later)
  const autoStatus = newProgress >= 100 && goal.status === "IN_PROGRESS" ? "COMPLETED" : null;

  await goalModel.updateProgress({
    goalId,
    oldProgress: goal.progress,
    newProgress,
    note: payload.note ?? null,
    milestoneTitle: payload.milestoneTitle ?? null,
    changedBy: actorUserId,
    autoStatus,
  });

  return { goalId, progress: newProgress, status: autoStatus ?? goal.status };
}

async function evaluateGoal({ actorUserId, goalId, payload }) {
  const goal = await goalModel.findById(goalId);
  if (!goal) throw httpError("Không tìm thấy mục tiêu", 404);
  if (!["OPEN", "IN_PROGRESS"].includes(goal.status)) {
    throw httpError("Mục tiêu đã được đánh giá hoặc lưu trữ", 409);
  }

  if (!["COMPLETED", "FAILED"].includes(payload.status)) {
    throw httpError("Kết quả đánh giá không hợp lệ", 400);
  }
  if (!payload.finalComment || !payload.finalComment.trim()) {
    throw httpError("Đánh giá mục tiêu phải có nhận xét", 400);
  }

  const progress = payload.status === "COMPLETED" ? 100 : goal.progress;

  const recipients = await goalModel.findStudentRecipients(goal.studentId);
  const statusLabel = payload.status === "COMPLETED" ? "hoàn thành" : "chưa đạt";

  await goalModel.evaluateGoal({
    goalId,
    status: payload.status,
    finalComment: payload.finalComment.trim(),
    progress,
    changedBy: actorUserId,
    notifications: notif(recipients, "Đánh giá mục tiêu", `Mục tiêu "${goal.title}" được đánh giá: ${statusLabel}.`),
  });

  return { goalId, status: payload.status };
}

async function archiveGoal({ actorUserId, goalId, note }) {
  const goal = await goalModel.findById(goalId);
  if (!goal) throw httpError("Không tìm thấy mục tiêu", 404);
  if (goal.status === "ARCHIVED") throw httpError("Mục tiêu đã được lưu trữ", 409);

  await goalModel.archiveGoal({ goalId, note: note ?? null, changedBy: actorUserId });
  return { goalId };
}

module.exports = {
  GOAL_TYPES,
  createGoal,
  updateGoal,
  updateProgress,
  evaluateGoal,
  archiveGoal,
};
