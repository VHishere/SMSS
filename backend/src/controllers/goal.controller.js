const teacherModel        = require("../models/teacher.model");
const studentProfileModel = require("../models/studentProfile.model");
const goalModel           = require("../models/goal.model");
const goalService         = require("../services/goal.service");
const { GOAL_TYPES }      = require("../services/goal.service");

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

// Ensure the teacher owns the goal's student
async function assertGoalAccess(teacherId, goalId) {
  const goal = await goalModel.findById(goalId);
  if (!goal) return { goal: null, ok: false };
  const ok = await studentProfileModel.isTeacherForStudent(teacherId, goal.studentId);
  return { goal, ok };
}

// GET /teachers/goals/types
async function getGoalTypes(_req, res) {
  const labels = {
    ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PERSONAL: "Phát triển cá nhân",
  };
  return res.json({ success: true, data: GOAL_TYPES.map((key) => ({ key, label: labels[key] })) });
}

// GET /teachers/students/:studentId/goals
async function listStudentGoals(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await studentProfileModel.isTeacherForStudent(profile.teacherId, studentId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền xem học sinh này" });

    const goals = await goalModel.findByStudent(studentId, { status: req.query.status, goalType: req.query.goalType });
    return res.json({ success: true, data: goals });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách mục tiêu");
  }
}

// GET /teachers/goals?classId&status&goalType — class-wide management list
async function listClassGoals(req, res) {
  try {
    const { classId, status, goalType, page = "1", limit = "20" } = req.query;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    if (!classId) return res.status(400).json({ success: false, message: "Thiếu lớp" });

    const ok = await studentProfileModel.isTeacherForClass(profile.teacherId, parseInt(classId, 10));
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });

    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await goalModel.findByClass(parseInt(classId, 10), {
      status, goalType, page: parsedPage, limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) },
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách mục tiêu");
  }
}

// POST /teachers/students/:studentId/goals
async function createGoal(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await studentProfileModel.isTeacherForStudent(profile.teacherId, studentId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách học sinh này" });

    const result = await goalService.createGoal({ actorUserId: req.user.userId, studentId, payload: req.body });
    return res.status(201).json({ success: true, message: "Đã tạo mục tiêu", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể tạo mục tiêu");
  }
}

// PUT /teachers/goals/:goalId
async function updateGoal(req, res) {
  try {
    const goalId = parseInt(req.params.goalId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { goal, ok } = await assertGoalAccess(profile.teacherId, goalId);
    if (!goal) return res.status(404).json({ success: false, message: "Không tìm thấy mục tiêu" });
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền chỉnh sửa mục tiêu này" });

    const result = await goalService.updateGoal({ actorUserId: req.user.userId, goalId, payload: req.body });
    return res.json({ success: true, message: "Cập nhật mục tiêu thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật mục tiêu");
  }
}

// PATCH /teachers/goals/:goalId/progress
async function updateProgress(req, res) {
  try {
    const goalId = parseInt(req.params.goalId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { goal, ok } = await assertGoalAccess(profile.teacherId, goalId);
    if (!goal) return res.status(404).json({ success: false, message: "Không tìm thấy mục tiêu" });
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền cập nhật mục tiêu này" });

    const result = await goalService.updateProgress({ actorUserId: req.user.userId, goalId, payload: req.body });
    return res.json({ success: true, message: "Đã cập nhật tiến độ", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật tiến độ");
  }
}

// POST /teachers/goals/:goalId/evaluate
async function evaluateGoal(req, res) {
  try {
    const goalId = parseInt(req.params.goalId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { goal, ok } = await assertGoalAccess(profile.teacherId, goalId);
    if (!goal) return res.status(404).json({ success: false, message: "Không tìm thấy mục tiêu" });
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền đánh giá mục tiêu này" });

    const result = await goalService.evaluateGoal({ actorUserId: req.user.userId, goalId, payload: req.body });
    return res.json({ success: true, message: "Đã đánh giá mục tiêu", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể đánh giá mục tiêu");
  }
}

// POST /teachers/goals/:goalId/archive
async function archiveGoal(req, res) {
  try {
    const goalId = parseInt(req.params.goalId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { goal, ok } = await assertGoalAccess(profile.teacherId, goalId);
    if (!goal) return res.status(404).json({ success: false, message: "Không tìm thấy mục tiêu" });
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền lưu trữ mục tiêu này" });

    const result = await goalService.archiveGoal({ actorUserId: req.user.userId, goalId, note: req.body.note });
    return res.json({ success: true, message: "Đã lưu trữ mục tiêu", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể lưu trữ mục tiêu");
  }
}

// GET /teachers/goals/:goalId/log
async function getGoalLog(req, res) {
  try {
    const goalId = parseInt(req.params.goalId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { goal, ok } = await assertGoalAccess(profile.teacherId, goalId);
    if (!goal) return res.status(404).json({ success: false, message: "Không tìm thấy mục tiêu" });
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền xem mục tiêu này" });

    const log = await goalModel.findGoalLog(goalId);
    return res.json({ success: true, data: log });
  } catch (error) {
    return handleError(res, error, "Không thể lấy nhật ký mục tiêu");
  }
}

module.exports = {
  getGoalTypes,
  listStudentGoals,
  listClassGoals,
  createGoal,
  updateGoal,
  updateProgress,
  evaluateGoal,
  archiveGoal,
  getGoalLog,
};
