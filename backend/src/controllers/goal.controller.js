const teacherModel = require("../models/teacher.model");
const studentProfileModel = require("../models/studentProfile.model");
const goalModel = require("../models/goal.model");
const goalService = require("../services/goal.service");
const { GOAL_TYPES } = require("../services/goal.service");

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

function handleError(res, error, fallback) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  console.error(`${fallback}:`, error);
  return res.status(500).json({
    success: false,
    message: fallback,
  });
}

function parsePositiveInteger(value) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function assertGoalAccess(teacherId, goalId) {
  const goal = await goalModel.findById(goalId);

  if (!goal) {
    return { goal: null, ok: false };
  }

  const ok = await studentProfileModel.isHomeroomOfStudent(
    teacherId,
    goal.studentId,
  );

  return { goal, ok };
}

// GET /teachers/goals/types
async function getGoalTypes(_req, res) {
  const labels = {
    ACADEMIC: "Học tập",
    BEHAVIOUR: "Hạnh kiểm",
    ATTENDANCE: "Chuyên cần",
    PERSONAL: "Phát triển cá nhân",
  };

  return res.json({
    success: true,
    data: GOAL_TYPES.map((key) => ({
      key,
      label: labels[key],
    })),
  });
}

// GET /teachers/students/:studentId/goals
async function listStudentGoals(req, res) {
  try {
    const studentId = parsePositiveInteger(req.params.studentId);

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Mã học sinh không hợp lệ",
      });
    }

    const profile = await resolveTeacher(req.user.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const ok = await studentProfileModel.isHomeroomOfStudent(
      profile.teacherId,
      studentId,
    );

    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "Chỉ giáo viên chủ nhiệm mới được xem mục tiêu của học sinh này",
      });
    }

    const goals = await goalModel.findByStudent(studentId, {
      goalType: req.query.goalType || null,
    });

    return res.json({
      success: true,
      data: goals,
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách mục tiêu");
  }
}

// GET /teachers/goals?classId&goalType&page&limit
async function listClassGoals(req, res) {
  try {
    const { classId, goalType, page = "1", limit = "20" } = req.query;
    const parsedClassId = parsePositiveInteger(classId);

    if (!parsedClassId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu hoặc sai mã lớp",
      });
    }

    if (goalType && !GOAL_TYPES.includes(String(goalType).toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Loại mục tiêu không hợp lệ",
      });
    }

    const profile = await resolveTeacher(req.user.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const ok = await studentProfileModel.isHomeroomOfClass(
      profile.teacherId,
      parsedClassId,
    );

    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "Chỉ giáo viên chủ nhiệm mới được theo dõi mục tiêu của lớp này",
      });
    }

    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 20),
    );

    const { total, rows } = await goalModel.findByClass(parsedClassId, {
      goalType: goalType ? String(goalType).toUpperCase() : null,
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách mục tiêu");
  }
}

// PATCH /teachers/goals/:goalId/comment
async function updateComment(req, res) {
  try {
    const goalId = parsePositiveInteger(req.params.goalId);

    if (!goalId) {
      return res.status(400).json({
        success: false,
        message: "Mã mục tiêu không hợp lệ",
      });
    }

    const profile = await resolveTeacher(req.user.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const { goal, ok } = await assertGoalAccess(profile.teacherId, goalId);

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mục tiêu",
      });
    }

    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "Chỉ giáo viên chủ nhiệm mới được nhận xét mục tiêu này",
      });
    }

    const result = await goalService.updateTeacherRemark({
      goalId,
      payload: req.body,
    });

    return res.json({
      success: true,
      message: "Đã lưu nhận xét của giáo viên chủ nhiệm",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật nhận xét mục tiêu");
  }
}

module.exports = {
  getGoalTypes,
  listStudentGoals,
  listClassGoals,
  updateComment,
};
