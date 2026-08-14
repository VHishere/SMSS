const goalModel = require("../models/goal.model");

const GOAL_TYPES = ["ACADEMIC", "BEHAVIOUR", "ATTENDANCE", "PERSONAL"];

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function todayStr() {
  const pad = (value) => String(value).padStart(2, "0");
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function validateBase(payload, options = {}) {
  const { allowExistingPastDate = "" } = options;
  const title = String(payload?.title ?? "").trim();
  const goalType = String(payload?.goalType ?? "").trim().toUpperCase();
  const targetDate = normalizeDate(payload?.targetDate);

  if (!title) {
    throw httpError("Tiêu đề mục tiêu là bắt buộc", 400);
  }

  if (title.length > 255) {
    throw httpError("Tiêu đề mục tiêu không được vượt quá 255 ký tự", 400);
  }

  if (!GOAL_TYPES.includes(goalType)) {
    throw httpError("Loại mục tiêu không hợp lệ", 400);
  }

  if (!targetDate) {
    throw httpError("Hạn hoàn thành là bắt buộc", 400);
  }

  const isUnchangedLegacyDate =
    allowExistingPastDate && targetDate === normalizeDate(allowExistingPastDate);

  if (targetDate < todayStr() && !isUnchangedLegacyDate) {
    throw httpError("Hạn hoàn thành phải từ hôm nay trở đi", 400);
  }

  const description = String(payload?.description ?? "").trim();

  return {
    title,
    goalType,
    targetDate,
    description: description || null,
  };
}

function makeNotifications(receiverIds, title, content) {
  return receiverIds.map((receiverId) => ({
    receiverId,
    title,
    content,
  }));
}

async function createGoal({ actorUserId, studentId, payload }) {
  const fields = validateBase(payload);
  const homeroomTeacherIds = await goalModel.findHomeroomTeacherRecipients(studentId);

  const goalId = await goalModel.createGoal({
    studentId,
    goalType: fields.goalType,
    title: fields.title,
    description: fields.description,
    targetDate: fields.targetDate,
    createdBy: actorUserId,
    note: "Học sinh tự tạo mục tiêu",
    notifications: makeNotifications(
      homeroomTeacherIds,
      "Học sinh tạo mục tiêu mới",
      `Học sinh đã tạo mục tiêu: "${fields.title}".`,
    ),
  });

  return { goalId };
}

async function updateGoal({ actorUserId, goalId, payload }) {
  const goal = await goalModel.findById(goalId);

  if (!goal) {
    throw httpError("Không tìm thấy mục tiêu", 404);
  }

  const fields = validateBase(payload, {
    allowExistingPastDate: goal.targetDate,
  });

  const homeroomTeacherIds = await goalModel.findHomeroomTeacherRecipients(goal.studentId);

  await goalModel.updateGoal({
    goalId,
    changedBy: actorUserId,
    fields: {
      ...fields,
      note: "Học sinh cập nhật mục tiêu",
    },
    notifications: makeNotifications(
      homeroomTeacherIds,
      "Học sinh cập nhật mục tiêu",
      `Mục tiêu "${fields.title}" vừa được học sinh cập nhật.`,
    ),
  });

  return { goalId };
}

async function updateTeacherRemark({ goalId, payload }) {
  const goal = await goalModel.findById(goalId);

  if (!goal) {
    throw httpError("Không tìm thấy mục tiêu", 404);
  }

  const teacherRemark = String(payload?.comment ?? payload?.teacherRemark ?? "").trim();

  if (!teacherRemark) {
    throw httpError("Vui lòng nhập nhận xét cho mục tiêu", 400);
  }

  if (teacherRemark.length > 2000) {
    throw httpError("Nhận xét không được vượt quá 2000 ký tự", 400);
  }

  const studentUserIds = await goalModel.findStudentUserRecipients(goal.studentId);

  await goalModel.updateTeacherRemark({
    goalId,
    teacherRemark,
    notifications: makeNotifications(
      studentUserIds,
      "GVCN nhận xét mục tiêu",
      `GVCN đã nhận xét mục tiêu "${goal.title}".`,
    ),
  });

  return {
    goalId,
    teacherRemark,
  };
}

module.exports = {
  GOAL_TYPES,
  createGoal,
  updateGoal,
  updateTeacherRemark,
};
