const teacherModel   = require("../models/teacher.model");
const behaviourModel = require("../models/behaviour.model");
const behaviourService = require("../services/behaviour.service");
const {
  MERIT_CATEGORIES,
  VIOLATION_CATEGORIES,
  CATEGORY_LABELS,
} = require("../config/behaviour.config");

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

// GET /teachers/behaviour/meta
async function getMeta(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const [classes, semesters] = await Promise.all([
      behaviourModel.findTeacherClasses(profile.teacherId),
      behaviourModel.findSemesters(),
    ]);

    return res.json({
      success: true,
      data: {
        classes,
        semesters,
        meritCategories:     MERIT_CATEGORIES.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
        violationCategories: VIOLATION_CATEGORIES.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

// GET /teachers/behaviour/records
async function listRecords(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { behaviorType, classId, studentId, startDate, endDate, page = "1", limit = "20" } = req.query;
    if (behaviorType && !["POSITIVE", "VIOLATION"].includes(behaviorType)) {
      return res.status(400).json({ success: false, message: "Loại hành vi không hợp lệ" });
    }
    // If filtering by a class, verify ownership
    if (classId) {
      const ok = await behaviourModel.isTeacherForClass(profile.teacherId, parseInt(classId, 10));
      if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });
    }

    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await behaviourModel.findRecords({
      behaviorType, classId, studentId, startDate, endDate, page: parsedPage, limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) },
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách hành vi");
  }
}

// POST /teachers/behaviour/records
async function createRecord(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await behaviourService.createRecord({
      teacherId: profile.teacherId, actorUserId: req.user.userId, payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Đã ghi nhận hành vi", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể ghi nhận hành vi");
  }
}

// PUT /teachers/behaviour/records/:behaviorId
async function updateRecord(req, res) {
  try {
    const behaviorId = parseInt(req.params.behaviorId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await behaviourService.updateRecord({
      teacherId: profile.teacherId, actorUserId: req.user.userId, behaviorId, payload: req.body,
    });
    return res.json({ success: true, message: "Cập nhật thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật");
  }
}

// POST /teachers/behaviour/records/:behaviorId/archive
async function archiveRecord(req, res) {
  try {
    const behaviorId = parseInt(req.params.behaviorId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await behaviourService.archiveRecord({
      teacherId: profile.teacherId, actorUserId: req.user.userId, behaviorId, reason: req.body.reason,
    });
    return res.json({ success: true, message: "Đã lưu trữ bản ghi", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể lưu trữ");
  }
}

// GET /teachers/behaviour/records/:behaviorId/log
async function getRecordLog(req, res) {
  try {
    const behaviorId = parseInt(req.params.behaviorId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const existing = await behaviourModel.findRecordById(behaviorId);
    if (!existing) return res.status(404).json({ success: false, message: "Không tìm thấy bản ghi" });
    const ok = await behaviourModel.isTeacherForStudent(profile.teacherId, existing.studentId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền xem lịch sử này" });

    const log = await behaviourModel.findRecordLog(behaviorId);
    return res.json({ success: true, data: log });
  } catch (error) {
    return handleError(res, error, "Không thể lấy lịch sử thay đổi");
  }
}

// GET /teachers/behaviour/conduct?studentId&semesterId — preview computed conduct
async function getConductPreview(req, res) {
  try {
    const { studentId, semesterId } = req.query;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await behaviourModel.isTeacherForStudent(profile.teacherId, parseInt(studentId, 10));
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách học sinh này" });

    const data = await behaviourService.getConductPreview({
      studentId: parseInt(studentId, 10), semesterId: parseInt(semesterId, 10),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tính điểm hạnh kiểm");
  }
}

// POST /teachers/behaviour/conduct
async function evaluateConduct(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await behaviourService.evaluateConduct({
      teacherId: profile.teacherId, actorUserId: req.user.userId, payload: req.body,
    });
    return res.json({ success: true, message: "Đã lưu đánh giá hạnh kiểm", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể đánh giá hạnh kiểm");
  }
}

// GET /teachers/behaviour/students/:studentId
async function getStudentBehaviour(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await behaviourModel.isTeacherForStudent(profile.teacherId, studentId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách học sinh này" });

    const data = await behaviourService.getStudentBehaviour({ studentId, semesterId: req.query.semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy hồ sơ hành vi");
  }
}

// GET /teachers/behaviour/analytics?classId&semesterId
async function getAnalytics(req, res) {
  try {
    const { classId, semesterId } = req.query;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await behaviourModel.isTeacherForClass(profile.teacherId, parseInt(classId, 10));
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });

    const data = await behaviourService.getClassAnalytics({ classId, semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy thống kê hành vi");
  }
}

// GET /teachers/behaviour/warnings
async function getWarnings(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { classId, semesterId, status, page = "1", limit = "20" } = req.query;
    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await behaviourModel.findWarnings({
      classId, semesterId, status, page: parsedPage, limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) },
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách cảnh báo");
  }
}

// POST /teachers/behaviour/warnings/generate
async function generateWarnings(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { classId, semesterId } = req.body;
    const ok = await behaviourModel.isTeacherForClass(profile.teacherId, parseInt(classId, 10));
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });

    const result = await behaviourService.generateWarnings({
      teacherId: profile.teacherId, actorUserId: req.user.userId, classId, semesterId,
    });
    return res.json({ success: true, message: `Đã tạo/cập nhật ${result.generated} cảnh báo`, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể tạo cảnh báo");
  }
}

// PUT /teachers/behaviour/warnings/:warningId
async function updateWarning(req, res) {
  try {
    const warningId = parseInt(req.params.warningId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await behaviourService.updateWarning({ warningId, payload: req.body });
    return res.json({ success: true, message: "Cập nhật cảnh báo thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật cảnh báo");
  }
}

module.exports = {
  getMeta,
  listRecords,
  createRecord,
  updateRecord,
  archiveRecord,
  getRecordLog,
  getConductPreview,
  evaluateConduct,
  getStudentBehaviour,
  getAnalytics,
  getWarnings,
  generateWarnings,
  updateWarning,
};
