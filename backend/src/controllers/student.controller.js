const attendanceModel = require("../models/attendance.model");
const commModel = require("../models/communication.model");
const goalModel = require("../models/goal.model");
const goalService = require("../services/goal.service");
const { GOAL_TYPES } = require("../services/goal.service");
const studentModel = require("../models/students");
const homeworkModel = require("../models/homework.model");
const feedbackModel = require("../models/feedback.model");

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

async function resolveStudentContext(userId) {
  return studentModel.findStudentContextByUserId(userId);
}

async function getMyProfile(req, res) {
  try {
    const student = await studentModel.findProfileByUserId(
      req.user.userId,
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    return res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể lấy hồ sơ học sinh",
    );
  }
}

async function getMyDashboard(req, res) {
  try {
    const result = await studentModel.findDashboardByUserId(
      req.user.userId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp hiện tại của học sinh",
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải dashboard học sinh",
    );
  }
}

async function getMyHomeworks(req, res) {
  try {
    const result = await studentModel.findHomeworksByUserId(
      req.user.userId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp hiện tại của học sinh",
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải danh sách bài tập về nhà",
    );
  }
}

async function getMyHomeworkDetail(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const homeworkId = parseInt(req.params.homeworkId, 10);

    if (!Number.isInteger(homeworkId)) {
      return res.status(400).json({
        success: false,
        message: "Mã bài tập không hợp lệ",
      });
    }

    const homework = await homeworkModel.findDetailWithStudentSubmission(
      homeworkId,
      context.studentId,
    );

    if (!homework) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài tập hoặc bài tập không thuộc lớp của bạn",
      });
    }

    return res.json({
      success: true,
      data: {
        context,
        homework,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải chi tiết bài tập",
    );
  }
}

async function submitMyHomework(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const homeworkId = parseInt(req.params.homeworkId, 10);

    if (!Number.isInteger(homeworkId)) {
      return res.status(400).json({
        success: false,
        message: "Mã bài tập không hợp lệ",
      });
    }

    const content = String(req.body.content || "").trim();
    const fileUrl = req.file?.cloudinaryUrl || null;

    if (!content && !fileUrl) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập nội dung hoặc đính kèm tệp bài làm",
      });
    }

    const submission = await homeworkModel.submitStudentSubmission({
      homeworkId,
      studentId: context.studentId,
      actorUserId: req.user.userId,
      content,
      fileUrl,
    });

    const homework = await homeworkModel.findDetailWithStudentSubmission(
      homeworkId,
      context.studentId,
    );

    return res.status(submission.isResubmission ? 200 : 201).json({
      success: true,
      message: submission.isResubmission
        ? "Đã cập nhật bài nộp"
        : "Đã nộp bài thành công",
      data: {
        context,
        homework,
        submission,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể nộp bài tập",
    );
  }
}

async function getMyGrades(req, res) {
  try {
    const result = await studentModel.findGradesByUserId(
      req.user.userId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp hiện tại của học sinh",
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải bảng điểm",
    );
  }
}

async function getMyAttendanceHistory(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const {
      startDate,
      endDate,
      context: attendanceContext,
      typeId,
      page = "1",
      limit = "30",
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await attendanceModel.findHistoryByStudentId(
      context.studentId,
      {
        page: parsedPage,
        limit: parsedLimit,
        startDate,
        endDate,
        context: attendanceContext,
        typeId,
      },
    );

    return res.json({
      success: true,
      data: {
        context,
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
    return handleError(
      res,
      error,
      "Không thể lấy lịch sử điểm danh",
    );
  }
}

async function getMyAttendanceAnalytics(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const now = new Date();
    const defaultEnd = now.toISOString().split("T")[0];
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const startDate = req.query.startDate || defaultStart;
    const endDate = req.query.endDate || defaultEnd;
    const attendanceContext = req.query.context || null;

    const { typeSummary, timeline } =
      await attendanceModel.findStudentAttendanceAnalytics(
        context.studentId,
        startDate,
        endDate,
        attendanceContext,
      );

    let totalRecords = 0;
    const rawByType = {};

    for (const row of typeSummary) {
      const count = Number(row.count);
      totalRecords += count;
      rawByType[row.typeName] = count;
    }

    const allTypes = [
      "PRESENT",
      "LATE",
      "ABSENT_EXCUSED",
      "ABSENT_UNEXCUSED",
      "EARLY_LEAVE",
    ];

    const byType = {};

    for (const type of allTypes) {
      const count = rawByType[type] || 0;

      byType[type] = {
        count,
        rate:
          totalRecords > 0
            ? Math.round((count / totalRecords) * 1000) / 10
            : 0,
      };
    }

    return res.json({
      success: true,
      data: {
        context,
        period: {
          startDate,
          endDate,
        },
        summary: {
          totalRecords,
          byType,
        },
        timeline,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể lấy thống kê điểm danh",
    );
  }
}

async function getMyBehaviour(req, res) {
  try {
    const result = await studentModel.findBehaviourByUserId(
      req.user.userId,
      {
        semesterId: req.query.semesterId,
      },
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải dữ liệu hạnh kiểm",
    );
  }
}

function getGoalTypes(_req, res) {
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

async function getMyGoals(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const goals = await goalModel.findByStudent(context.studentId, {
      status: req.query.status,
      goalType: req.query.goalType,
    });

    return res.json({
      success: true,
      data: {
        context,
        goals,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải danh sách mục tiêu",
    );
  }
}

async function createMyGoal(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const result = await goalService.createGoal({
      actorUserId: req.user.userId,
      studentId: context.studentId,
      payload: {
        ...req.body,
        teacherRemark: null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Đã tạo mục tiêu",
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tạo mục tiêu",
    );
  }
}

async function assertMyGoal(req, res, goalId) {
  const goal = await goalModel.findById(goalId);

  if (!goal) {
    res.status(404).json({
      success: false,
      message: "Không tìm thấy mục tiêu",
    });
    return null;
  }

  if (goal.studentUserId !== req.user.userId) {
    res.status(403).json({
      success: false,
      message: "Bạn không có quyền thao tác mục tiêu này",
    });
    return null;
  }

  return goal;
}

async function updateMyGoalProgress(req, res) {
  try {
    const goalId = parseInt(req.params.goalId, 10);
    const goal = await assertMyGoal(req, res, goalId);

    if (!goal) {
      return undefined;
    }

    const result = await goalService.updateProgress({
      actorUserId: req.user.userId,
      goalId,
      payload: req.body,
    });

    return res.json({
      success: true,
      message: "Đã cập nhật tiến độ",
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể cập nhật tiến độ mục tiêu",
    );
  }
}

async function getMyGoalLog(req, res) {
  try {
    const goalId = parseInt(req.params.goalId, 10);
    const goal = await assertMyGoal(req, res, goalId);

    if (!goal) {
      return undefined;
    }

    const log = await goalModel.findGoalLog(goalId);

    return res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể lấy nhật ký mục tiêu",
    );
  }
}

async function getMyEvents(req, res) {
  try {
    const result = await studentModel.findEventsByUserId(
      req.user.userId,
      {
        status: req.query.status,
        search: req.query.search,
      },
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải danh sách sự kiện",
    );
  }
}

async function registerMyEvent(req, res) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const resolved = await studentModel.findEventForStudent(
      req.user.userId,
      eventId,
    );

    if (!resolved) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sự kiện hoặc bạn không có quyền đăng ký",
      });
    }

    const { context, event } = resolved;

    if (!["ACTIVE", "PUBLISHED", "SCHEDULED"].includes(event.status)) {
      return res.status(409).json({
        success: false,
        message: "Sự kiện hiện không mở đăng ký",
      });
    }

    if (event.capacity && event.registeredCount >= event.capacity) {
      return res.status(409).json({
        success: false,
        message: "Sự kiện đã đủ số lượng đăng ký",
      });
    }

    await studentModel.registerEvent({
      userId: req.user.userId,
      studentId: context.studentId,
      eventId,
    });

    return res.status(201).json({
      success: true,
      message: "Đã đăng ký sự kiện",
      data: {
        eventId,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể đăng ký sự kiện",
    );
  }
}

async function getMyNotifications(req, res) {
  try {
    const result = await studentModel.findNotificationsByUserId(
      req.user.userId,
      {
        limit: req.query.limit,
        unreadOnly: req.query.unreadOnly,
      },
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải thông báo",
    );
  }
}

async function markMyNotificationRead(req, res) {
  try {
    const notificationId = parseInt(req.params.notificationId, 10);

    const affectedRows = await studentModel.markNotificationRead(
      req.user.userId,
      notificationId,
    );

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
    }

    return res.json({
      success: true,
      message: "Đã đánh dấu thông báo là đã đọc",
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể cập nhật thông báo",
    );
  }
}

async function markAllMyNotificationsRead(req, res) {
  try {
    await studentModel.markAllNotificationsRead(req.user.userId);

    return res.json({
      success: true,
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể cập nhật thông báo",
    );
  }
}

async function getMyMessageContacts(req, res) {
  try {
    const result = await studentModel.findTeacherContactsByUserId(
      req.user.userId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const groups = await commModel.ensureStudentGroupConversations({
      userId: req.user.userId,
      context: result.context,
    });

    return res.json({
      success: true,
      data: {
        ...result,
        groups,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải danh bạ tin nhắn",
    );
  }
}

async function startMyTeacherConversation(req, res) {
  try {
    const teacherUserId = Number(req.body.teacherUserId);

    if (!teacherUserId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu giáo viên nhận tin nhắn",
      });
    }

    const resolved = await studentModel.isTeacherContactForStudent(
      req.user.userId,
      teacherUserId,
    );

    if (!resolved) {
      return res.status(403).json({
        success: false,
        message: "Bạn không thể nhắn tin với giáo viên này",
      });
    }

    const { context } = resolved;

    const existing = await commModel.findDirectConversation(
      "TEACHER_STUDENT",
      req.user.userId,
      teacherUserId,
      context.studentId,
    );

    if (existing) {
      return res.json({
        success: true,
        data: {
          conversationId: existing,
          created: false,
        },
      });
    }

    const conversationId = await commModel.createConversation({
      type: "TEACHER_STUDENT",
      title: null,
      studentId: context.studentId,
      createdBy: req.user.userId,
      participants: [
        {
          userId: req.user.userId,
          role: "STUDENT",
        },
        {
          userId: teacherUserId,
          role: "TEACHER",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      data: {
        conversationId,
        created: true,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể bắt đầu trò chuyện",
    );
  }
}

async function updateMyProfile(req, res) {
  try {
    const currentProfile = await studentModel.findProfileByUserId(
      req.user.userId,
    );

    if (!currentProfile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const allowedGenders = ["MALE", "FEMALE", "OTHER"];

    const payload = {
      fullName: String(req.body.fullName || "").trim(),
      phone: String(req.body.phone || "").trim(),
      avatar: req.file?.cloudinaryUrl || currentProfile.avatar || null,
      dateOfBirth: req.body.dateOfBirth || null,
      gender: allowedGenders.includes(req.body.gender)
        ? req.body.gender
        : "OTHER",
      address: String(req.body.address || "").trim(),
    };

    if (!payload.fullName) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên không được để trống",
      });
    }

    const updatedProfile = await studentModel.updateProfileByUserId(
      req.user.userId,
      payload,
    );

    return res.json({
      success: true,
      message: "Đã cập nhật thông tin cá nhân",
      data: updatedProfile,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể cập nhật hồ sơ học sinh",
    );
  }
}

async function searchMyMessages(req, res) {
  try {
    const keyword = String(req.query.keyword || "").trim();

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập từ khóa tìm kiếm",
      });
    }

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit || "20", 10)),
    );

    const items = await commModel.searchMessages(req.user.userId, {
      keyword,
      archived: req.query.archived === "true",
      page,
      limit,
    });

    return res.json({
      success: true,
      data: {
        items,
        page,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tìm kiếm lịch sử tin nhắn",
    );
  }
}

// ── Nhận xét theo tiết (GVBM → HS) + khảo sát GV (ẩn danh) ────────────────────

async function getMyLessonFeedback(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ học sinh" });
    const data = await feedbackModel.findStudentFeedback(context.studentId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy nhận xét theo tiết");
  }
}

async function getMySurveys(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ học sinh" });
    const data = await feedbackModel.findOpenSurveysForStudent(context.studentId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách khảo sát");
  }
}

async function submitMySurvey(req, res) {
  try {
    const surveyId = parseInt(req.params.surveyId, 10);
    const { score, comment } = req.body;
    const numScore = score == null || score === "" ? null : Number(score);
    if (numScore !== null && (!Number.isInteger(numScore) || numScore < 1 || numScore > 5)) {
      return res.status(400).json({ success: false, message: "Điểm đánh giá phải từ 1 đến 5" });
    }
    const context = await resolveStudentContext(req.user.userId);
    if (!context) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ học sinh" });

    const survey = await feedbackModel.findSurveyById(surveyId);
    if (!survey || survey.status !== "OPEN") {
      return res.status(404).json({ success: false, message: "Khảo sát không tồn tại hoặc đã đóng" });
    }
    try {
      await feedbackModel.submitSurveyResponse({
        surveyId, studentId: context.studentId, score: numScore, comment: (comment || "").trim() || null,
      });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "Bạn đã gửi đánh giá cho khảo sát này rồi" });
      }
      throw e;
    }
    return res.json({ success: true, message: "Đã gửi đánh giá (ẩn danh). Cảm ơn bạn!" });
  } catch (error) {
    return handleError(res, error, "Không thể gửi đánh giá");
  }
}

module.exports = {
  getMyProfile,
  getMyDashboard,
  getMyLessonFeedback,
  getMySurveys,
  submitMySurvey,
  getMyHomeworks,
  getMyGrades,
  getMyAttendanceHistory,
  getMyAttendanceAnalytics,
  getMyBehaviour,
  getGoalTypes,
  getMyGoals,
  createMyGoal,
  updateMyGoalProgress,
  getMyGoalLog,
  getMyEvents,
  registerMyEvent,
  getMyNotifications,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  getMyMessageContacts,
  startMyTeacherConversation,
  getMyHomeworkDetail,
  submitMyHomework,
  updateMyProfile,
  searchMyMessages,
};