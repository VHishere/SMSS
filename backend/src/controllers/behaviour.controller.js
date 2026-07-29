const teacherModel   = require("../models/teacher.model");
const behaviourModel = require("../models/behaviour.model");
const behaviourService = require("../services/behaviour.service");
const studentProfileModel = require("../models/studentProfile.model");
const {
  CONDUCT_GRADES,
} = require("../config/behaviour.config");

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

function toPickerOption(c) {
  return { key: c.code, label: c.label, points: c.points, affectsConductDefault: c.affectsConductDefault };
}

// GET /teachers/behaviour/meta
async function getMeta(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const [classes, semesters, violationTypes, meritCategories, violationCategories] = await Promise.all([
      behaviourModel.findTeacherClasses(profile.teacherId),
      behaviourModel.findSemesters(),
      behaviourModel.findViolationTypes(),
      behaviourModel.findCategories({ behaviorType: "POSITIVE", status: "ACTIVE" }),
      behaviourModel.findCategories({ behaviorType: "VIOLATION", status: "ACTIVE" }),
    ]);

    return res.json({
      success: true,
      data: {
        classes,
        semesters,
        meritCategories: meritCategories.map(toPickerOption),
        violationCategories: violationCategories.map(toPickerOption),
        violationTypes,      // [{ code, name, affectsConduct }]
        conductGrades:       CONDUCT_GRADES, // 5 mức: Tốt/Khá/Trung bình/Yếu/Kém
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

// ── Admin (school-wide, no homeroom restriction) ────────────────────────────

// GET /admin/behaviour/meta — every class school-wide + semesters + config
async function getMetaAdmin(_req, res) {
  try {
    const [classes, semesters, violationTypes, meritCategories, violationCategories] = await Promise.all([
      studentProfileModel.findAllClasses(),
      behaviourModel.findSemesters(),
      behaviourModel.findViolationTypes(),
      behaviourModel.findCategories({ behaviorType: "POSITIVE", status: "ACTIVE" }),
      behaviourModel.findCategories({ behaviorType: "VIOLATION", status: "ACTIVE" }),
    ]);

    return res.json({
      success: true,
      data: {
        classes,
        semesters,
        meritCategories: meritCategories.map(toPickerOption),
        violationCategories: violationCategories.map(toPickerOption),
        violationTypes,
        conductGrades: CONDUCT_GRADES,
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

// ── Category management (mức độ cộng/trừ) — admin only ─────────────────────
// GET /admin/behaviour/categories?behaviorType&status
async function listCategories(req, res) {
  try {
    const { behaviorType, status } = req.query;
    const rows = await behaviourModel.findCategories({ behaviorType, status });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh mục");
  }
}

// POST /admin/behaviour/categories
async function createCategory(req, res) {
  try {
    const { code, behaviorType, label, points, affectsConductDefault } = req.body;
    if (!code || !code.trim()) return res.status(400).json({ success: false, message: "Mã danh mục là bắt buộc" });
    if (!["POSITIVE", "VIOLATION"].includes(behaviorType)) return res.status(400).json({ success: false, message: "Loại hành vi không hợp lệ" });
    if (!label || !label.trim()) return res.status(400).json({ success: false, message: "Tên danh mục là bắt buộc" });
    const pts = Number(points);
    if (!Number.isInteger(pts) || pts <= 0) return res.status(400).json({ success: false, message: "Mức điểm phải là số dương" });

    const categoryId = await behaviourModel.createCategory({
      code: code.trim().toUpperCase().replace(/\s+/g, "_"),
      behaviorType, label: label.trim(), points: pts,
      affectsConductDefault: Boolean(affectsConductDefault), createdBy: req.user.userId,
    });
    return res.status(201).json({ success: true, message: "Đã tạo danh mục", data: { categoryId } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, message: "Mã danh mục đã tồn tại" });
    return handleError(res, error, "Không thể tạo danh mục");
  }
}

// PUT /admin/behaviour/categories/:categoryId
async function updateCategory(req, res) {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    const { label, points, affectsConductDefault } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ success: false, message: "Tên danh mục là bắt buộc" });
    const pts = Number(points);
    if (!Number.isInteger(pts) || pts <= 0) return res.status(400).json({ success: false, message: "Mức điểm phải là số dương" });

    const affected = await behaviourModel.updateCategory(categoryId, { label: label.trim(), points: pts, affectsConductDefault: Boolean(affectsConductDefault) });
    if (affected === 0) return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    return res.json({ success: true, message: "Cập nhật thành công" });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật danh mục");
  }
}

// PUT /admin/behaviour/categories/:categoryId/status
async function setCategoryStatus(req, res) {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    const { status } = req.body;
    if (!["ACTIVE", "INACTIVE"].includes(status)) return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });

    const affected = await behaviourModel.setCategoryStatus(categoryId, status);
    if (affected === 0) return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    return res.json({ success: true, message: "Cập nhật trạng thái thành công" });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật trạng thái");
  }
}

// GET /admin/behaviour/records
async function listRecordsAdmin(req, res) {
  try {
    const { behaviorType, classId, studentId, startDate, endDate, page = "1", limit = "20" } = req.query;
    if (behaviorType && !["POSITIVE", "VIOLATION"].includes(behaviorType)) {
      return res.status(400).json({ success: false, message: "Loại hành vi không hợp lệ" });
    }

    const parsedPage = Math.max(1, parseInt(page, 10));
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

// GET /admin/behaviour/conduct?studentId&semesterId
async function getConductPreviewAdmin(req, res) {
  try {
    const { studentId, semesterId } = req.query;
    const data = await behaviourService.getConductPreview({
      studentId: parseInt(studentId, 10), semesterId: parseInt(semesterId, 10),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tính điểm hạnh kiểm");
  }
}

// GET /admin/behaviour/analytics?classId&semesterId
async function getAnalyticsAdmin(req, res) {
  try {
    const { classId, semesterId } = req.query;
    const data = await behaviourService.getClassAnalytics({ classId, semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy thống kê hành vi");
  }
}

// GET /admin/behaviour/warnings
async function getWarningsAdmin(req, res) {
  try {
    const { classId, semesterId, status, page = "1", limit = "20" } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10));
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

// POST /admin/behaviour/records — ghi nhận khen thưởng/vi phạm cho bất kỳ học sinh nào.
// Deliberately no admin equivalent of evaluateConduct (đánh giá hạnh kiểm) —
// that stays a homeroom-teacher-only action.
async function createRecordAdmin(req, res) {
  try {
    const result = await behaviourService.createRecordAdmin({ actorUserId: req.user.userId, payload: req.body });
    return res.status(201).json({ success: true, message: "Đã ghi nhận hành vi", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể ghi nhận hành vi");
  }
}

// PUT /admin/behaviour/records/:behaviorId
async function updateRecordAdmin(req, res) {
  try {
    const behaviorId = parseInt(req.params.behaviorId, 10);
    const result = await behaviourService.updateRecordAdmin({ actorUserId: req.user.userId, behaviorId, payload: req.body });
    return res.json({ success: true, message: "Cập nhật thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật");
  }
}

// POST /admin/behaviour/records/:behaviorId/archive
async function archiveRecordAdmin(req, res) {
  try {
    const behaviorId = parseInt(req.params.behaviorId, 10);
    const result = await behaviourService.archiveRecordAdmin({ actorUserId: req.user.userId, behaviorId, reason: req.body.reason });
    return res.json({ success: true, message: "Đã lưu trữ bản ghi", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể lưu trữ");
  }
}

// POST /admin/behaviour/warnings/generate — behaviourService.generateWarnings has no
// ownership check baked in (unlike createRecord), so admin can call it directly.
async function generateWarningsAdmin(req, res) {
  try {
    const { classId, semesterId } = req.body;
    const result = await behaviourService.generateWarnings({ actorUserId: req.user.userId, classId, semesterId });
    return res.json({ success: true, message: `Đã tạo/cập nhật ${result.generated} cảnh báo`, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể tạo cảnh báo");
  }
}

// PUT /admin/behaviour/warnings/:warningId
async function updateWarningAdmin(req, res) {
  try {
    const warningId = parseInt(req.params.warningId, 10);
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
  getMetaAdmin,
  listCategories,
  createCategory,
  updateCategory,
  setCategoryStatus,
  listRecordsAdmin,
  createRecordAdmin,
  updateRecordAdmin,
  archiveRecordAdmin,
  getConductPreviewAdmin,
  getAnalyticsAdmin,
  getWarningsAdmin,
  generateWarningsAdmin,
  updateWarningAdmin,
};
