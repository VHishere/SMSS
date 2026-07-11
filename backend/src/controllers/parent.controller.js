const parentModel = require("../models/parents");
const timetableModel = require("../models/timetable.model");
const behaviourModel = require("../models/behaviour.model");
const behaviourService = require("../services/behaviour.service");
const goalModel = require("../models/goal.model");
const commModel = require("../models/communication.model");
const { TIMETABLE_SLOTS, WEEK_DAYS } = require("../config/timetable.config");

async function getMyProfile(req, res) {
  try {
    const parent = await parentModel.findProfileByUserId(req.user.userId);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ phụ huynh",
      });
    }

    return res.json({
      success: true,
      data: parent,
    });
  } catch (error) {
    console.error("getMyProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy hồ sơ phụ huynh",
    });
  }
}

async function getMyStudents(req, res) {
  try {
    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);

    return res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error("getMyStudents error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách học sinh",
    });
  }
}

async function getStudentProfile(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const linked = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = linked.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem hồ sơ này",
      });
    }

    const student = await parentModel.findStudentDetailByStudentId(studentId);

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
    console.error("getStudentProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy hồ sơ học sinh",
    });
  }
}

async function getStudentTimetable(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = students.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem thời khóa biểu này",
      });
    }

    const context = await timetableModel.findCurrentStudentContextByStudentId(studentId);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp học hiện tại của học sinh",
      });
    }

    const lessons = await timetableModel.findLessonsByClassId(context.classId);

    return res.json({
      success: true,
      data: {
        context,
        weekDays: WEEK_DAYS,
        slots: TIMETABLE_SLOTS,
        lessons,
      },
    });
  } catch (error) {
    console.error("getStudentTimetable error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải thời khóa biểu của học sinh",
    });
  }
}

async function getStudentGrades(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const isLinked = students.some((s) => s.studentId === studentId);

    if (!isLinked) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem bảng điểm này",
      });
    }

    const result = await parentModel.findGradesByStudentId(studentId);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getStudentGrades error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tải bảng điểm của học sinh",
    });
  }
}

// ── Student behaviour (read-only for parents) ─────────────────────────────────

async function checkStudentLink(userId, studentId) {
  const linked = await parentModel.findLinkedStudentsByUserId(userId);
  return linked.some((s) => s.studentId === studentId);
}

async function getStudentBehaviourSemesters(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await checkStudentLink(req.user.userId, studentId)) {
      return res.status(403).json({ success: false, message: "Không có quyền xem thông tin học sinh này" });
    }
    const semesters = await behaviourModel.findSemesters();
    return res.json({ success: true, data: semesters });
  } catch (error) {
    console.error("getStudentBehaviourSemesters error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách học kỳ" });
  }
}

async function getStudentBehaviourRecords(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await checkStudentLink(req.user.userId, studentId)) {
      return res.status(403).json({ success: false, message: "Không có quyền xem thông tin học sinh này" });
    }
    const { behaviorType, startDate, endDate, page = "1", limit = "50" } = req.query;
    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const { total, rows } = await behaviourModel.findRecords({
      studentId, behaviorType, startDate, endDate, page: parsedPage, limit: parsedLimit,
    });
    return res.json({
      success: true,
      data: { items: rows, pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) } },
    });
  } catch (error) {
    console.error("getStudentBehaviourRecords error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách hành vi" });
  }
}

async function getStudentBehaviourConduct(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await checkStudentLink(req.user.userId, studentId)) {
      return res.status(403).json({ success: false, message: "Không có quyền xem thông tin học sinh này" });
    }
    const { semesterId } = req.query;
    if (!semesterId) return res.status(400).json({ success: false, message: "Thiếu học kỳ" });
    const data = await behaviourService.getConductPreview({ studentId, semesterId: parseInt(semesterId, 10) });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("getStudentBehaviourConduct error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy thông tin hạnh kiểm" });
  }
}

async function getStudentGoals(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await checkStudentLink(req.user.userId, studentId)) {
      return res.status(403).json({ success: false, message: "Không có quyền xem thông tin học sinh này" });
    }
    const { status, goalType } = req.query;
    const goals = await goalModel.findByStudent(studentId, { status, goalType });
    return res.json({ success: true, data: goals });
  } catch (error) {
    console.error("getStudentGoals error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách mục tiêu" });
  }
}

async function getMyNotifications(req, res) {
  try {
    const result = await parentModel.findNotificationsByUserId(
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
    console.error("getMyNotifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải thông báo",
    });
  }
}

async function markMyNotificationRead(req, res) {
  try {
    const notificationId = parseInt(req.params.notificationId, 10);

    const affectedRows = await parentModel.markNotificationRead(
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
    console.error("markMyNotificationRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật thông báo",
    });
  }
}

async function markAllMyNotificationsRead(req, res) {
  try {
    await parentModel.markAllNotificationsRead(req.user.userId);

    return res.json({
      success: true,
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
    });
  } catch (error) {
    console.error("markAllMyNotificationsRead error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật thông báo",
    });
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

async function getStudentEvents(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const student = students.find((s) => s.studentId === studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem sự kiện này",
      });
    }

    const events = await parentModel.findEventsByStudentId(
      {
        studentUserId: student.studentUserId,
        studentId: student.studentId,
        classId: student.classId,
      },
      {
        status: req.query.status,
        search: req.query.search,
      },
    );

    return res.json({
      success: true,
      data: {
        context: {
          studentId: student.studentId,
          studentFullName: student.studentFullName,
          className: student.className,
          schoolYearName: student.schoolYearName,
        },
        events,
      },
    });
  } catch (error) {
    console.error("getStudentEvents error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách sự kiện",
    });
  }
}

async function registerStudentEvent(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const eventId = parseInt(req.params.eventId, 10);

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const student = students.find((s) => s.studentId === studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền đăng ký sự kiện này",
      });
    }

    const event = await parentModel.findEventForChild(eventId, student.classId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sự kiện hoặc sự kiện không dành cho lớp của học sinh",
      });
    }

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

    await parentModel.registerEventForChild({
      studentUserId: student.studentUserId,
      studentId: student.studentId,
      eventId,
      registeredBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Đã đăng ký sự kiện cho học sinh",
      data: {
        eventId,
      },
    });
  } catch (error) {
    console.error("registerStudentEvent error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể đăng ký sự kiện",
    });
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────

async function getMyMessageContacts(req, res) {
  try {
    const result = await parentModel.findTeacherContactsByUserId(req.user.userId);

    const groups = await commModel.ensureParentGroupConversations({
      userId: req.user.userId,
      students: result.students,
    });

    return res.json({
      success: true,
      data: {
        ...result,
        groups,
      },
    });
  } catch (error) {
    console.error("getMyMessageContacts error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh bạ giáo viên",
    });
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
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));

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
    console.error("searchMyMessages error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tìm kiếm lịch sử tin nhắn",
    });
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

    const ok = await commModel.teacherAccessibleByParent(req.user.userId, teacherUserId);

    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "Bạn không thể nhắn tin với giáo viên này",
      });
    }

    const existing = await commModel.findAnyDirectConversation(
      "PARENT_TEACHER",
      req.user.userId,
      teacherUserId,
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
      type: "PARENT_TEACHER",
      title: null,
      studentId: null,
      createdBy: req.user.userId,
      participants: [
        { userId: req.user.userId, role: "PARENT" },
        { userId: teacherUserId, role: "TEACHER" },
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
    console.error("startMyTeacherConversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể bắt đầu trò chuyện",
    });
  }
}

module.exports = {
  getMyProfile,
  getMyStudents,
  getStudentProfile,
  getStudentTimetable,
  getStudentGrades,
  getStudentBehaviourSemesters,
  getStudentBehaviourRecords,
  getStudentBehaviourConduct,
  getStudentGoals,
  getStudentEvents,
  registerStudentEvent,
  getMyNotifications,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  getMyMessageContacts,
  startMyTeacherConversation,
  searchMyMessages,
};
