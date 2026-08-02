const attendanceModel = require("../models/attendance.model");
const commModel = require("../models/communication.model");
const goalModel = require("../models/goal.model");
const goalService = require("../services/goal.service");
const { GOAL_TYPES } = require("../services/goal.service");
const studentModel = require("../models/students");
const homeworkModel = require("../models/homework.model");
const feedbackModel = require("../models/feedback.model");
const leaveRequestModel = require("../models/leaveRequest.model");
const cloudinary = require("../config/cloudinary");

const ALLOWED_ATTENDANCE_CONTEXTS = new Set([
  "CLASS",
  "DORM",
  "EVENT",
  "SELF_STUDY",
]);

const ALLOWED_STUDENT_EVENT_STATUSES = new Set([
  "ACTIVE",
  "PUBLISHED",
  "SCHEDULED",
  "COMPLETED",
  "DONE",
  "CANCELLED",
]);

const ALLOWED_GOAL_STATUSES = new Set([
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
]);

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function cleanupUploadedFile(file) {
  if (!file?.cloudinaryPublicId) return;

  try {
    await cloudinary.uploader.destroy(file.cloudinaryPublicId, {
      resource_type: file.cloudinaryResourceType || "raw",
      invalidate: true,
    });
  } catch (cleanupError) {
    console.error("Không thể xóa tệp upload không được sử dụng:", cleanupError);
  }
}

function validateAttendanceDateRange(startDate, endDate) {
  if (startDate && !isValidIsoDate(startDate)) {
    return "Ngày bắt đầu không hợp lệ";
  }

  if (endDate && !isValidIsoDate(endDate)) {
    return "Ngày kết thúc không hợp lệ";
  }

  if (startDate && endDate && startDate > endDate) {
    return "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc";
  }

  return null;
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

async function resolveStudentContext(userId) {
  return studentModel.findStudentContextByUserId(userId);
}

function formatDateInVietnam(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parsePositiveInteger(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
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

    if (!Number.isInteger(homeworkId) || homeworkId <= 0) {
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
  let submissionPersisted = false;

  try {
    const context = await resolveStudentContext(req.user.userId);

    if (!context) {
      await cleanupUploadedFile(req.file);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const homeworkId = parseInt(req.params.homeworkId, 10);

    if (!Number.isInteger(homeworkId) || homeworkId <= 0) {
      await cleanupUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Mã bài tập không hợp lệ",
      });
    }

    const content = String(req.body.content || "").trim();
    const fileUrl = req.file?.cloudinaryUrl || null;

    if (!content && !fileUrl) {
      await cleanupUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đường dẫn hoặc đính kèm tệp bài làm",
      });
    }

    if (content.length > 500) {
      await cleanupUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Đường dẫn bài làm không được vượt quá 500 ký tự",
      });
    }

    if (content && !isValidHttpUrl(content)) {
      await cleanupUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Đường dẫn bài làm phải bắt đầu bằng http:// hoặc https://",
      });
    }

    const submission = await homeworkModel.submitStudentSubmission({
      homeworkId,
      studentId: context.studentId,
      actorUserId: req.user.userId,
      content,
      fileUrl,
    });
    submissionPersisted = true;

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
    if (!submissionPersisted) {
      await cleanupUploadedFile(req.file);
    }

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

    const dateError = validateAttendanceDateRange(startDate, endDate);
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }

    const normalizedContext = attendanceContext
      ? String(attendanceContext).trim().toUpperCase()
      : null;

    if (
      normalizedContext &&
      !ALLOWED_ATTENDANCE_CONTEXTS.has(normalizedContext)
    ) {
      return res.status(400).json({
        success: false,
        message: "Ngữ cảnh điểm danh không hợp lệ",
      });
    }

    const parsedTypeId = typeId == null || typeId === ""
      ? null
      : parsePositiveInteger(typeId);

    if (typeId != null && typeId !== "" && !parsedTypeId) {
      return res.status(400).json({
        success: false,
        message: "Loại điểm danh không hợp lệ",
      });
    }

    const parsedPage = parsePositiveInteger(page, 1);
    const parsedLimit = Math.min(100, parsePositiveInteger(limit, 30));

    const { total, rows } = await attendanceModel.findHistoryByStudentId(
      context.studentId,
      {
        page: parsedPage,
        limit: parsedLimit,
        startDate: startDate || null,
        endDate: endDate || null,
        context: normalizedContext,
        typeId: parsedTypeId,
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
    const defaultEnd = formatDateInVietnam(now);
    const vietnamParts = defaultEnd.split("-").map(Number);
    const defaultStart = `${vietnamParts[0]}-${String(vietnamParts[1]).padStart(2, "0")}-01`;

    const startDate = req.query.startDate || defaultStart;
    const endDate = req.query.endDate || defaultEnd;
    const dateError = validateAttendanceDateRange(startDate, endDate);

    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }

    const attendanceContext = req.query.context
      ? String(req.query.context).trim().toUpperCase()
      : null;

    if (
      attendanceContext &&
      !ALLOWED_ATTENDANCE_CONTEXTS.has(attendanceContext)
    ) {
      return res.status(400).json({
        success: false,
        message: "Ngữ cảnh điểm danh không hợp lệ",
      });
    }

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


async function getMyLeaveRequests(req, res) {
  try {
    const context = await resolveStudentContext(req.user.userId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const { status, page = "1", limit = "20" } = req.query;
    const normalizedStatus = status ? String(status).toUpperCase() : null;
    const allowedStatuses = new Set([
      "PENDING",
      "APPROVED",
      "REJECTED",
      "CANCELLED",
    ]);

    if (normalizedStatus && !allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái đơn xin nghỉ không hợp lệ",
      });
    }

    const parsedPage = parsePositiveInteger(page, 1);
    const parsedLimit = Math.min(100, parsePositiveInteger(limit, 20));

    const { total, rows } = await leaveRequestModel.findByStudentId(
      context.studentId,
      {
        page: parsedPage,
        limit: parsedLimit,
        status: normalizedStatus,
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
      "Không thể lấy danh sách đơn xin nghỉ",
    );
  }
}

async function getMyBehaviour(req, res) {
  try {
    const rawSemesterId = req.query.semesterId;
    const semesterId = rawSemesterId == null || rawSemesterId === ""
      ? null
      : parsePositiveInteger(rawSemesterId);

    if (rawSemesterId != null && rawSemesterId !== "" && !semesterId) {
      return res.status(400).json({
        success: false,
        message: "Học kỳ không hợp lệ",
      });
    }

    const result = await studentModel.findBehaviourByUserId(
      req.user.userId,
      { semesterId },
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

    const status = String(req.query.status || "").trim().toUpperCase();
    const goalType = String(req.query.goalType || "").trim().toUpperCase();

    if (status && !ALLOWED_GOAL_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái mục tiêu không hợp lệ",
      });
    }

    if (goalType && !GOAL_TYPES.includes(goalType)) {
      return res.status(400).json({
        success: false,
        message: "Loại mục tiêu không hợp lệ",
      });
    }

    const goals = await goalModel.findByStudent(context.studentId, {
      status: status || null,
      goalType: goalType || null,
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
    const goalId = parsePositiveInteger(req.params.goalId);
    if (!goalId) {
      return res.status(400).json({ success: false, message: "Mã mục tiêu không hợp lệ" });
    }
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
    const goalId = parsePositiveInteger(req.params.goalId);
    if (!goalId) {
      return res.status(400).json({ success: false, message: "Mã mục tiêu không hợp lệ" });
    }
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
    const status = String(req.query.status || "").trim().toUpperCase();
    const search = String(req.query.search || "").trim();

    if (status && !ALLOWED_STUDENT_EVENT_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái sự kiện không hợp lệ",
      });
    }

    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Từ khóa tìm kiếm không được vượt quá 100 ký tự",
      });
    }

    const result = await studentModel.findEventsByUserId(
      req.user.userId,
      {
        status: status || null,
        search: search || null,
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

async function getMyEventDetail(req, res) {
  try {
    const eventId = parseInt(req.params.eventId, 10);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã sự kiện không hợp lệ",
      });
    }

    const result = await studentModel.findEventDetailByUserId(
      req.user.userId,
      eventId,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sự kiện hoặc bạn không có quyền xem",
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
      "Không thể tải chi tiết sự kiện",
    );
  }
}

async function registerMyEvent(req, res) {
  try {
    const eventId = parseInt(req.params.eventId, 10);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã sự kiện không hợp lệ",
      });
    }

    const context = await resolveStudentContext(req.user.userId);
    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ học sinh",
      });
    }

    const registration = await studentModel.registerEvent({
      userId: req.user.userId,
      studentId: context.studentId,
      eventId,
    });

    return res.status(registration.alreadyRegistered ? 200 : 201).json({
      success: true,
      message: registration.alreadyRegistered
        ? "Bạn đã đăng ký sự kiện này"
        : "Đã đăng ký sự kiện",
      data: {
        eventId,
        registrationId: registration.registrationId,
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
    const notificationId = parsePositiveInteger(req.params.notificationId);
    if (!notificationId) {
      return res.status(400).json({ success: false, message: "Mã thông báo không hợp lệ" });
    }

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

    const phone = String(req.body.phone || "").trim();
    const dateOfBirth = String(req.body.dateOfBirth || "").trim();
    const gender = String(req.body.gender || "").toUpperCase();
    const address = String(req.body.address || "").trim();
    const allowedGenders = new Set(["MALE", "FEMALE", "OTHER"]);

    if (phone && !/^0\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0",
      });
    }

    if (!allowedGenders.has(gender)) {
      return res.status(400).json({
        success: false,
        message: "Giới tính không hợp lệ",
      });
    }

    if (address.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Địa chỉ không được vượt quá 500 ký tự",
      });
    }

    if (dateOfBirth) {
      const today = formatDateInVietnam(new Date());
      if (!isValidIsoDate(dateOfBirth) || dateOfBirth > today) {
        return res.status(400).json({
          success: false,
          message: "Ngày sinh không hợp lệ hoặc nằm trong tương lai",
        });
      }
    }

    const updatedProfile = await studentModel.updateProfileByUserId(
      req.user.userId,
      {
        phone,
        dateOfBirth: dateOfBirth || null,
        gender,
        address,
      },
    );

    return res.json({
      success: true,
      message: "Đã cập nhật thông tin cá nhân",
      data: updatedProfile,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      error.statusCode = 409;
      error.message = "Số điện thoại đã được tài khoản khác sử dụng";
    }
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

    if (keyword.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Từ khóa tìm kiếm không được vượt quá 100 ký tự",
      });
    }

    const page = parsePositiveInteger(req.query.page, 1);
    const limit = Math.min(50, parsePositiveInteger(req.query.limit, 20));

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
    const normalizedComment = String(comment || "").trim();
    const numScore = Number(score);

    if (!Number.isInteger(surveyId) || surveyId <= 0) {
      return res.status(400).json({ success: false, message: "Mã khảo sát không hợp lệ" });
    }

    if (!Number.isInteger(numScore) || numScore < 1 || numScore > 5) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn điểm đánh giá từ 1 đến 5",
      });
    }

    if (normalizedComment.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Nhận xét không được vượt quá 2000 ký tự",
      });
    }

    const context = await resolveStudentContext(req.user.userId);
    if (!context) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ học sinh" });
    }

    const eligible = await feedbackModel.canStudentSubmitSurvey(
      surveyId,
      context.studentId,
    );
    if (!eligible) {
      return res.status(404).json({
        success: false,
        message: "Khảo sát không tồn tại, đã đóng hoặc không dành cho lớp của bạn",
      });
    }

    try {
      await feedbackModel.submitSurveyResponse({
        surveyId,
        studentId: context.studentId,
        score: numScore,
        comment: normalizedComment || null,
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "Bạn đã gửi đánh giá cho khảo sát này rồi" });
      }
      throw error;
    }

    return res.json({ success: true, message: "Đã gửi đánh giá ẩn danh. Cảm ơn bạn!" });
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
  getMyLeaveRequests,
  getMyBehaviour,
  getGoalTypes,
  getMyGoals,
  createMyGoal,
  updateMyGoalProgress,
  getMyGoalLog,
  getMyEvents,
  getMyEventDetail,
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