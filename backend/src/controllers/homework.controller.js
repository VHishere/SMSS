const teacherModel  = require("../models/teacher.model");
const homeworkModel = require("../models/homework.model");
const homeworkService = require("../services/homework.service");

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

async function ensureOwner(homeworkId, teacherId) {
  const detail = await homeworkModel.findDetailById(homeworkId);
  if (!detail) return { detail: null, owned: false };
  return { detail, owned: detail.teacherId === teacherId };
}

// GET /teachers/homework/assignments  — class+subject the teacher may assign to
async function getTeachingAssignments(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const assignments = await homeworkModel.findTeachingAssignments(profile.teacherId);
    return res.json({ success: true, data: assignments });
  } catch (error) {
    console.error("getTeachingAssignments error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách phân công giảng dạy" });
  }
}

// GET /teachers/homework  — list with filters + summary
async function listHomework(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const {
      classId, subjectId, status, search, sort, due,
      page = "1", limit = "12",
    } = req.query;

    if (status && !["OPEN", "CLOSED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [{ total, rows }, summary, assignments] = await Promise.all([
      homeworkModel.findByTeacher(profile.teacherId, {
        classId, subjectId, status, search, sort, due,
        page: parsedPage, limit: parsedLimit,
      }),
      homeworkModel.findTeacherSummary(profile.teacherId),
      homeworkModel.findTeachingAssignments(profile.teacherId),
    ]);

    return res.json({
      success: true,
      data: {
        items: rows,
        summary,
        assignments,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (error) {
    console.error("listHomework error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách bài tập" });
  }
}

// GET /teachers/homework/:homeworkId
async function getHomeworkDetail(req, res) {
  try {
    const homeworkId = parseInt(req.params.homeworkId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { detail, owned } = await ensureOwner(homeworkId, profile.teacherId);
    if (!detail) return res.status(404).json({ success: false, message: "Không tìm thấy bài tập" });
    if (!owned)  return res.status(403).json({ success: false, message: "Bạn không có quyền xem bài tập này" });

    return res.json({ success: true, data: detail });
  } catch (error) {
    console.error("getHomeworkDetail error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy chi tiết bài tập" });
  }
}

// POST /teachers/homework
async function createHomework(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await homeworkService.createHomework({
      teacherId: profile.teacherId,
      payload:   req.body,
    });

    return res.status(201).json({
      success: true,
      message: `Đã tạo bài tập cho ${result.created.length} lớp`,
      data: result,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("createHomework error:", error);
    return res.status(500).json({ success: false, message: "Không thể tạo bài tập" });
  }
}

// PUT /teachers/homework/:homeworkId
async function updateHomework(req, res) {
  try {
    const homeworkId = parseInt(req.params.homeworkId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await homeworkService.updateHomework({
      teacherId: profile.teacherId,
      homeworkId,
      payload:   req.body,
    });

    return res.json({ success: true, message: "Cập nhật bài tập thành công", data: result });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("updateHomework error:", error);
    return res.status(500).json({ success: false, message: "Không thể cập nhật bài tập" });
  }
}

// PATCH /teachers/homework/:homeworkId/status  — close/reopen
async function changeStatus(req, res) {
  try {
    const homeworkId = parseInt(req.params.homeworkId, 10);
    const { status } = req.body;

    if (!["OPEN", "CLOSED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { detail, owned } = await ensureOwner(homeworkId, profile.teacherId);
    if (!detail) return res.status(404).json({ success: false, message: "Không tìm thấy bài tập" });
    if (!owned)  return res.status(403).json({ success: false, message: "Bạn không có quyền thay đổi bài tập này" });

    await homeworkModel.setStatus(homeworkId, status);
    return res.json({ success: true, message: status === "CLOSED" ? "Đã đóng bài tập" : "Đã mở lại bài tập" });
  } catch (error) {
    console.error("changeStatus error:", error);
    return res.status(500).json({ success: false, message: "Không thể thay đổi trạng thái bài tập" });
  }
}

// GET /teachers/homework/:homeworkId/submissions
async function getSubmissions(req, res) {
  try {
    const homeworkId = parseInt(req.params.homeworkId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { detail, owned } = await ensureOwner(homeworkId, profile.teacherId);
    if (!detail) return res.status(404).json({ success: false, message: "Không tìm thấy bài tập" });
    if (!owned)  return res.status(403).json({ success: false, message: "Bạn không có quyền xem bài nộp này" });

    const submissions = await homeworkModel.findSubmissionsByHomework(homeworkId, detail.classId);
    return res.json({ success: true, data: { homework: detail, submissions } });
  } catch (error) {
    console.error("getSubmissions error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách bài nộp" });
  }
}

// PUT /teachers/homework/submissions/:submissionId/grade
async function gradeSubmission(req, res) {
  try {
    const submissionId = parseInt(req.params.submissionId, 10);
    const { score, feedback } = req.body;

    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await homeworkService.gradeSubmission({
      graderUserId: req.user.userId,
      teacherId:    profile.teacherId,
      submissionId,
      score,
      feedback,
    });

    return res.json({
      success: true,
      message: result.regraded ? "Đã cập nhật điểm" : "Đã chấm điểm bài nộp",
      data: result,
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("gradeSubmission error:", error);
    return res.status(500).json({ success: false, message: "Không thể chấm điểm" });
  }
}

// GET /teachers/homework/submissions/:submissionId/grade-log
async function getGradeLog(req, res) {
  try {
    const submissionId = parseInt(req.params.submissionId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const submission = await homeworkModel.findSubmissionById(submissionId);
    if (!submission) return res.status(404).json({ success: false, message: "Không tìm thấy bài nộp" });
    if (submission.teacherId !== profile.teacherId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xem lịch sử chấm điểm" });
    }

    const log = await homeworkModel.findGradeLog(submissionId);
    return res.json({ success: true, data: log });
  } catch (error) {
    console.error("getGradeLog error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy lịch sử chấm điểm" });
  }
}

// GET /teachers/homework/:homeworkId/analytics
async function getAnalytics(req, res) {
  try {
    const homeworkId = parseInt(req.params.homeworkId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { detail, owned } = await ensureOwner(homeworkId, profile.teacherId);
    if (!detail) return res.status(404).json({ success: false, message: "Không tìm thấy bài tập" });
    if (!owned)  return res.status(403).json({ success: false, message: "Bạn không có quyền xem thống kê này" });

    const analytics = await homeworkModel.findAnalytics(homeworkId, detail.classId);
    return res.json({ success: true, data: { homework: detail, analytics } });
  } catch (error) {
    console.error("getAnalytics error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy thống kê bài tập" });
  }
}

async function uploadAttachment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có tệp được tải lên",
      });
    }

    const fileUrl = req.file.cloudinaryUrl;

    const attachmentId = await homeworkModel.insertAttachment({
      relatedType: "HOMEWORK_DRAFT",
      relatedId: 0,
      fileName: req.file.originalname,
      fileUrl,
      fileType: req.file.mimetype,
      uploadedBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      data: {
        attachmentId,
        fileName: req.file.originalname,
        fileUrl,
        fileType: req.file.mimetype,
        publicId: req.file.cloudinaryPublicId,
        resourceType: req.file.cloudinaryResourceType,
      },
    });
  } catch (error) {
    console.error("uploadAttachment error:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lưu tệp đính kèm",
    });
  }
}

// DELETE /teachers/homework/:homeworkId/attachments/:attachmentId
async function deleteAttachment(req, res) {
  try {
    const homeworkId   = parseInt(req.params.homeworkId, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);

    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { detail, owned } = await ensureOwner(homeworkId, profile.teacherId);
    if (!detail) return res.status(404).json({ success: false, message: "Không tìm thấy bài tập" });
    if (!owned)  return res.status(403).json({ success: false, message: "Bạn không có quyền xóa tệp này" });
    if (detail.status === "CLOSED") {
      return res.status(409).json({ success: false, message: "Bài tập đã đóng, không thể thay đổi tệp đính kèm" });
    }

    const removed = await homeworkModel.deleteAttachment(attachmentId, homeworkId);
    if (removed === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tệp đính kèm" });
    }

    return res.json({ success: true, message: "Đã xóa tệp đính kèm" });
  } catch (error) {
    console.error("deleteAttachment error:", error);
    return res.status(500).json({ success: false, message: "Không thể xóa tệp đính kèm" });
  }
}

// ── Parent read-only homework endpoints ───────────────────────────────────────

// GET /parents/me/students/:studentId/homework
async function getParentStudentHomework(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const { subjectId, status, submissionStatus, search, sort, page = "1", limit = "12" } = req.query;
    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const { total, summary, rows } = await homeworkModel.findByStudentId(studentId, {
      subjectId, status, submissionStatus, search, sort, page: parsedPage, limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        summary,
        pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) },
      },
    });
  } catch (error) {
    console.error("getParentStudentHomework error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách bài tập" });
  }
}

// GET /parents/me/students/:studentId/homework/:homeworkId
async function getParentStudentHomeworkDetail(req, res) {
  try {
    const studentId  = parseInt(req.params.studentId, 10);
    const homeworkId = parseInt(req.params.homeworkId, 10);

    const detail = await homeworkModel.findDetailWithStudentSubmission(homeworkId, studentId);
    if (!detail) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài tập hoặc bài tập không thuộc lớp của học sinh" });
    }

    return res.json({ success: true, data: detail });
  } catch (error) {
    console.error("getParentStudentHomeworkDetail error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy chi tiết bài tập" });
  }
}

module.exports = {
  getTeachingAssignments,
  listHomework,
  getHomeworkDetail,
  createHomework,
  updateHomework,
  changeStatus,
  getSubmissions,
  gradeSubmission,
  getGradeLog,
  getAnalytics,
  uploadAttachment,
  deleteAttachment,
  getParentStudentHomework,
  getParentStudentHomeworkDetail,
};
