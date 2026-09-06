const staffModel = require("../models/staff");
const feedbackModel = require("../models/feedback.model");
const notificationModel = require("../models/notification.model");
const timetableModel = require("../models/timetable.model");

// ── Thông báo của tài khoản STAFF ────────────────────────────────────────────
// Dùng bảng `notification` chung (receiver_id + is_read thật) như student/parent/
// admin — không phải feed dẫn xuất. Nguồn hiện có: tin nhắn (type MESSAGE) và bất
// kỳ thông báo nào được gửi tới user_id này.
// Lỗi xử lý cục bộ (không dùng handleError chung vì hàm đó trả nguyên error.message
// ra client — tránh rò rỉ chi tiết hệ thống).
async function getMyNotifications(req, res) {
  try {
    const data = await notificationModel.findByUserId(req.user.userId, {
      limit: req.query.limit,
      unreadOnly: req.query.unreadOnly,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("staff.getMyNotifications error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải thông báo" });
  }
}

async function markMyNotificationRead(req, res) {
  try {
    const notificationId = parseInt(req.params.notificationId, 10);
    if (Number.isNaN(notificationId)) {
      return res.status(400).json({ success: false, message: "Mã thông báo không hợp lệ" });
    }
    const affectedRows = await notificationModel.markRead(req.user.userId, notificationId);
    if (affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }
    return res.json({ success: true, message: "Đã đánh dấu thông báo là đã đọc" });
  } catch (error) {
    console.error("staff.markMyNotificationRead error:", error);
    return res.status(500).json({ success: false, message: "Không thể cập nhật thông báo" });
  }
}

async function markAllMyNotificationsRead(req, res) {
  try {
    await notificationModel.markAllRead(req.user.userId);
    return res.json({ success: true, message: "Đã đánh dấu tất cả thông báo là đã đọc" });
  } catch (error) {
    console.error("staff.markAllMyNotificationsRead error:", error);
    return res.status(500).json({ success: false, message: "Không thể cập nhật thông báo" });
  }
}

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Dữ liệu đã tồn tại (email, mã hoặc username trùng)",
    });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details,
    });
  }

  return res.status(500).json({ success: false, message: fallbackMessage });
}

async function getOverview(req, res) {
  try {
    const data = await staffModel.getOverview({
      schoolYearId: req.query.schoolYearId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải tổng quan");
  }
}

async function getBoardingManagement(req, res) {
  try {
    const data = await staffModel.getBoardingManagement({
      areaId: req.query.areaId,
      search: req.query.search,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải dữ liệu nội trú");
  }
}

async function createBoardingArea(req, res) {
  try {
    const data = await staffModel.createBoardingArea(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo khu nội trú");
  }
}

async function updateBoardingArea(req, res) {
  try {
    const data = await staffModel.updateBoardingArea(req.params.areaId, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật khu nội trú");
  }
}

async function assignStudentToArea(req, res) {
  try {
    const data = await staffModel.assignStudentToArea(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể xếp học sinh vào khu");
  }
}

async function removeStudentFromArea(req, res) {
  try {
    const data = await staffModel.removeStudentFromArea(req.params.studentAreaId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể gỡ học sinh khỏi khu");
  }
}

async function getLookups(_req, res) {
  try {
    const data = await staffModel.getLookups();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải dữ liệu tham chiếu");
  }
}

async function getStudents(req, res) {
  try {
    const data = await staffModel.listStudents({
      search: req.query.search || "",
      schoolYearId: req.query.schoolYearId,
      gradeId: req.query.gradeId,
      classId: req.query.classId,
      status: req.query.status,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách học sinh");
  }
}

async function getStudentById(req, res) {
  try {
    const data = await staffModel.getStudentById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết học sinh");
  }
}

async function createStudent(req, res) {
  try {
    const data = await staffModel.createStudent(req.body, req.user.userId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo học sinh");
  }
}

async function updateStudent(req, res) {
  try {
    const data = await staffModel.updateStudent(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật học sinh");
  }
}

async function uploadStudentAvatar(req, res) {
  try {
    const avatarUrl = req.file?.cloudinaryUrl;

    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        message: "Chưa nhận được ảnh tải lên",
      });
    }

    const data = await staffModel.setStudentAvatar(req.params.id, avatarUrl);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật ảnh học sinh");
  }
}

async function getParents(req, res) {
  try {
    const data = await staffModel.listParents({
      search: req.query.search || "",
      schoolYearId: req.query.schoolYearId,
      gradeId: req.query.gradeId,
      classId: req.query.classId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách phụ huynh");
  }
}

async function getParentById(req, res) {
  try {
    const data = await staffModel.getParentById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phụ huynh",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết phụ huynh");
  }
}

async function createParent(req, res) {
  try {
    const data = await staffModel.createParent(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo phụ huynh");
  }
}

async function updateParent(req, res) {
  try {
    const data = await staffModel.updateParent(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật phụ huynh");
  }
}

async function getTeachers(req, res) {
  try {
    const data = await staffModel.listTeachers({
      search: req.query.search || "",
      schoolYearId: req.query.schoolYearId,
      gradeId: req.query.gradeId,
      classId: req.query.classId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách giáo viên");
  }
}

async function getTeacherById(req, res) {
  try {
    const data = await staffModel.getTeacherById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giáo viên",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết giáo viên");
  }
}

async function createTeacher(req, res) {
  try {
    const data = await staffModel.createTeacher(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo giáo viên");
  }
}

async function updateTeacher(req, res) {
  try {
    const data = await staffModel.updateTeacher(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật giáo viên");
  }
}

async function getSchoolYears(_req, res) {
  try {
    const data = await staffModel.listSchoolYears();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách năm học");
  }
}

async function createSchoolYear(req, res) {
  try {
    const data = await staffModel.createSchoolYear(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo năm học");
  }
}

async function updateSchoolYear(req, res) {
  try {
    const data = await staffModel.updateSchoolYear(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật năm học");
  }
}

async function initializeSchoolYearData(req, res) {
  try {
    const data = await staffModel.initializeSchoolYearData(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể khởi tạo dữ liệu năm học");
  }
}

async function getClasses(req, res) {
  try {
    const data = await staffModel.listClasses({
      schoolYearId: req.query.schoolYearId,
      gradeId: req.query.gradeId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách lớp học");
  }
}

async function getClassById(req, res) {
  try {
    const data = await staffModel.getClassById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp học",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết lớp học");
  }
}

async function createClass(req, res) {
  try {
    const data = await staffModel.createClass(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo lớp học");
  }
}

async function updateClass(req, res) {
  try {
    const data = await staffModel.updateClass(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật lớp học");
  }
}

async function deleteClass(req, res) {
  try {
    const data = await staffModel.deleteClass(req.params.id);
    return res.json({ success: true, data, message: "Đã xóa lớp học" });
  } catch (error) {
    return handleError(res, error, "Không thể xóa lớp học");
  }
}

async function enrollStudent(req, res) {
  try {
    const studentIds = Array.isArray(req.body.studentIds)
      ? req.body.studentIds
      : req.body.studentId != null
        ? [req.body.studentId]
        : [];
    const data = await staffModel.enrollStudents(req.params.id, studentIds);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể thêm học sinh vào lớp");
  }
}

async function removeStudentFromClass(req, res) {
  try {
    const data = await staffModel.removeStudent(
      req.params.id,
      req.params.studentId,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể xóa học sinh khỏi lớp");
  }
}

async function assignTeacher(req, res) {
  try {
    const data = await staffModel.assignTeacher(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể phân công giáo viên");
  }
}

async function removeTeacher(req, res) {
  try {
    const data = await staffModel.removeTeacher(req.params.teacherClassId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể gỡ giáo viên khỏi lớp");
  }
}

async function getClassTimetable(req, res) {
  try {
    const data = await staffModel.listClassTimetable(req.params.id, {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      lessonDate: req.query.lessonDate,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải thời khóa biểu");
  }
}

async function createClassTimetableLesson(req, res) {
  try {
    await staffModel.createClassTimetableLesson(req.params.id, req.body);
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể thêm tiết học");
  }
}

async function createTimetableLessons(req, res) {
  try {
    const data = await staffModel.createTimetableLessons(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể thêm lịch học");
  }
}

async function updateClassTimetableLesson(req, res) {
  try {
    await staffModel.updateClassTimetableLesson(
      req.params.id,
      req.params.timetableId,
      req.body,
    );
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật tiết học");
  }
}

async function deleteClassTimetableLesson(req, res) {
  try {
    await staffModel.deleteClassTimetableLesson(
      req.params.id,
      req.params.timetableId,
    );
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể xóa tiết học");
  }
}
async function listTimetableSubstitutions(req, res) {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const data = await timetableModel.findSubstitutionsForStaff({
      status,
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        items: data.rows,
        pagination: {
          total: data.total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(data.total / parsedLimit),
        },
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể tải yêu cầu đổi tiết");
  }
}

async function getTimetableSubstitutionById(req, res) {
  try {
    const substitutionId = parseInt(req.params.substitutionId, 10);
    if (Number.isNaN(substitutionId)) {
      return res.status(400).json({ success: false, message: "Mã yêu cầu không hợp lệ" });
    }

    const data = await timetableModel.findSubstitutionForStaffById(substitutionId);
    if (!data) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu đổi tiết" });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết yêu cầu đổi tiết");
  }
}

async function reviewTimetableSubstitution(req, res) {
  try {
    const substitutionId = parseInt(req.params.substitutionId, 10);
    if (Number.isNaN(substitutionId)) {
      return res.status(400).json({ success: false, message: "Mã yêu cầu không hợp lệ" });
    }

    const decision = String(req.body.decision || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({ success: false, message: "Quyết định duyệt không hợp lệ" });
    }

    const data = await timetableModel.reviewSubstitution(
      substitutionId,
      req.user.userId,
      decision,
      req.body.reviewNote ? String(req.body.reviewNote).trim() : null,
      req.body.substituteTeacherId ? parseInt(req.body.substituteTeacherId, 10) : null,
    );

    return res.json({
      success: true,
      message: decision === "APPROVE" ? "Đã duyệt yêu cầu đổi tiết" : "Đã từ chối yêu cầu đổi tiết",
      data,
    });
  } catch (error) {
    return handleError(res, error, "Không thể xử lý yêu cầu đổi tiết");
  }
}

async function getCurriculum(req, res) {
  try {
    const data = await staffModel.listCurriculum({
      schoolYearId: req.query.schoolYearId,
      semesterId: req.query.semesterId,
      gradeId: req.query.gradeId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chương trình học");
  }
}

async function getCurriculumById(req, res) {
  try {
    const data = await staffModel.getCurriculumById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chương trình học",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết chương trình học");
  }
}

async function createCurriculumItem(req, res) {
  try {
    const data = await staffModel.addCurriculumItem(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể thêm môn vào chương trình");
  }
}

async function updateCurriculumItem(req, res) {
  try {
    const data = await staffModel.updateCurriculumItem(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật chương trình học");
  }
}

async function deleteCurriculumItem(req, res) {
  try {
    await staffModel.deleteCurriculumItem(req.params.id);
    return res.json({ success: true, message: "Đã xóa môn khỏi chương trình" });
  } catch (error) {
    return handleError(res, error, "Không thể xóa chương trình học");
  }
}

async function updateStudySession(req, res) {
  try {
    const data = await staffModel.updateStudySession(req.params.sessionId, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật buổi học");
  }
}

async function getFeePlans(req, res) {
  try {
    const data = await staffModel.listFeePlans({
      schoolYearId: req.query.schoolYearId,
      status: req.query.status,
      search: req.query.search || "",
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách học phí");
  }
}

async function getFeePlanById(req, res) {
  try {
    await staffModel.refreshFeeAssignmentStatuses(req.params.id);
    const data = await staffModel.getFeePlanById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khoản học phí",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết học phí");
  }
}

async function createFeePlan(req, res) {
  try {
    const data = await staffModel.createFeePlan(req.body, req.user.userId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo khoản học phí");
  }
}

async function updateFeePlanStatus(req, res) {
  try {
    const data = await staffModel.updateFeePlanStatus(
      req.params.id,
      req.body.status,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật trạng thái học phí");
  }
}

async function recordFeePayment(req, res) {
  try {
    const data = await staffModel.recordFeePayment(
      req.params.id,
      req.params.assignmentId,
      req.body,
      req.user.userId,
    );
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể ghi nhận thanh toán");
  }
}

// ── Khảo sát đánh giá giáo viên (HS → GV, ẩn danh) ────────────────────────────

async function listTeacherSurveys(req, res) {
  try {
    const data = await feedbackModel.findSurveysForStaff();
    return res.json({ success: true, data });
  } catch (error) { return handleError(res, error, "Không thể lấy danh sách khảo sát"); }
}

async function createTeacherSurvey(req, res) {
  try {
    const { semesterId, teacherId, subjectId, classId, title } = req.body;
    if (!semesterId || !teacherId) {
      return res.status(400).json({ success: false, message: "Thiếu học kỳ hoặc giáo viên" });
    }
    const assigned = await feedbackModel.teacherClassAssignmentExists({
      teacherId, classId: classId || null, subjectId: subjectId || null,
    });
    if (!assigned) {
      return res.status(400).json({
        success: false,
        message: "Giáo viên không dạy lớp/môn đã chọn — khảo sát sẽ không hiển thị cho học sinh nào. Vui lòng kiểm tra lại phân công giảng dạy.",
      });
    }
    const surveyId = await feedbackModel.createSurvey({
      semesterId, teacherId, subjectId: subjectId || null, classId: classId || null,
      title: title || null, createdBy: req.user.userId,
    });
    return res.status(201).json({ success: true, message: "Đã tạo khảo sát", data: { surveyId } });
  } catch (error) { return handleError(res, error, "Không thể tạo khảo sát"); }
}

async function closeTeacherSurvey(req, res) {
  try {
    await feedbackModel.setSurveyStatus(parseInt(req.params.id, 10), "CLOSED");
    return res.json({ success: true, message: "Đã đóng khảo sát" });
  } catch (error) { return handleError(res, error, "Không thể đóng khảo sát"); }
}

async function getTeacherSurveyAggregate(req, res) {
  try {
    const data = await feedbackModel.findSurveyAggregate(parseInt(req.params.id, 10));
    return res.json({ success: true, data });
  } catch (error) { return handleError(res, error, "Không thể lấy tổng hợp khảo sát"); }
}

module.exports = {
  getMyNotifications,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  getOverview,
  getBoardingManagement,
  createBoardingArea,
  updateBoardingArea,
  assignStudentToArea,
  removeStudentFromArea,
  getLookups,
  listTeacherSurveys,
  createTeacherSurvey,
  closeTeacherSurvey,
  getTeacherSurveyAggregate,
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  uploadStudentAvatar,
  getParents,
  getParentById,
  createParent,
  updateParent,
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  getSchoolYears,
  createSchoolYear,
  updateSchoolYear,
  initializeSchoolYearData,
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  enrollStudent,
  removeStudentFromClass,
  assignTeacher,
  removeTeacher,
  getClassTimetable,
  createClassTimetableLesson,
  createTimetableLessons,
  updateClassTimetableLesson,
  deleteClassTimetableLesson,
  listTimetableSubstitutions,
  getTimetableSubstitutionById,
  reviewTimetableSubstitution,
  getCurriculum,
  getCurriculumById,
  createCurriculumItem,
  updateCurriculumItem,
  deleteCurriculumItem,
  updateStudySession,
  getFeePlans,
  getFeePlanById,
  createFeePlan,
  updateFeePlanStatus,
  recordFeePayment,
};
