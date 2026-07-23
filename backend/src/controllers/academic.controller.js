const teacherModel  = require("../models/teacher.model");
const academicModel = require("../models/academic.model");
const academicService = require("../services/academic.service");
const {
  SCORE_TYPES,
  SCORE_TYPE_LABELS,
  SCORE_TYPE_WEIGHTS,
  SCORE_GROUP,
  SCORE_TYPE_KIND,
} = require("../config/academic.config");

// Score types enriched with label + weight (hệ số) + group (TX/GK/CK) + kind —
// single source of truth the frontend gradebook/average uses so teacher matches
// parent/student exactly. TX là 1 NHÓM (hệ số 1, lấy trung bình), GK×2, CK×3.
const SCORE_TYPE_LIST = SCORE_TYPES.map((key) => ({
  key,
  label:  SCORE_TYPE_LABELS[key],
  weight: SCORE_TYPE_WEIGHTS[key],
  group:  SCORE_GROUP[key],
  kind:   SCORE_TYPE_KIND[key],
}));

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

// GET /teachers/academic/meta — assignments + semesters + score types
async function getMeta(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const [assignments, semesters] = await Promise.all([
      academicModel.findTeachingAssignments(profile.teacherId),
      academicModel.findSemesters(),
    ]);

    return res.json({
      success: true,
      data: {
        assignments,
        semesters,
        scoreTypes: SCORE_TYPE_LIST,
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

// GET /teachers/academic/scoresheet
async function getScoreSheet(req, res) {
  try {
    const { classId, subjectId, semesterId, scoreType } = req.query;
    if (!classId || !subjectId || !semesterId || !scoreType) {
      return res.status(400).json({ success: false, message: "Thiếu tham số lớp/môn/học kỳ/loại điểm" });
    }
    if (!SCORE_TYPES.includes(scoreType)) {
      return res.status(400).json({ success: false, message: "Loại điểm không hợp lệ" });
    }

    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await academicModel.isTeacherAssigned(profile.teacherId, parseInt(classId, 10), parseInt(subjectId, 10));
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không được phân công dạy lớp/môn này" });

    const students = await academicModel.findScoreSheet(
      parseInt(classId, 10), parseInt(subjectId, 10), parseInt(semesterId, 10), scoreType,
    );

    return res.json({ success: true, data: { students } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy bảng điểm");
  }
}

// GET /teachers/academic/gradebook  — all score types per student (matrix)
async function getGradebook(req, res) {
  try {
    const { classId, subjectId, semesterId } = req.query;
    if (!classId || !subjectId || !semesterId) {
      return res.status(400).json({ success: false, message: "Thiếu tham số lớp/môn/học kỳ" });
    }
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await academicModel.isTeacherAssigned(profile.teacherId, parseInt(classId, 10), parseInt(subjectId, 10));
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không được phân công dạy lớp/môn này" });

    const students = await academicModel.findGradebook(
      parseInt(classId, 10), parseInt(subjectId, 10), parseInt(semesterId, 10),
    );
    return res.json({
      success: true,
      data: { students, scoreTypes: SCORE_TYPE_LIST },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy bảng điểm");
  }
}

// POST /teachers/academic/scores
async function submitScores(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await academicService.submitScores({
      teacherId:   profile.teacherId,
      actorUserId: req.user.userId,
      payload:     req.body,
    });

    return res.json({ success: true, message: `Đã lưu ${result.saved} điểm`, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể lưu điểm");
  }
}

// PUT /teachers/academic/scores/:resultId
async function updateScore(req, res) {
  try {
    const resultId = parseInt(req.params.resultId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await academicService.updateScore({
      teacherId:   profile.teacherId,
      actorUserId: req.user.userId,
      resultId,
      payload:     req.body,
    });

    return res.json({ success: true, message: "Cập nhật điểm thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật điểm");
  }
}

// DELETE /teachers/academic/scores/:resultId
async function deleteScore(req, res) {
  try {
    const resultId = parseInt(req.params.resultId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await academicService.deleteScore({
      teacherId:   profile.teacherId,
      actorUserId: req.user.userId,
      resultId,
      reason:      req.body.reason,
    });

    return res.json({ success: true, message: "Đã xóa điểm", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể xóa điểm");
  }
}

// GET /teachers/academic/scores/log
async function getScoreLog(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { studentId, subjectId, semesterId, page = "1", limit = "20" } = req.query;
    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await academicModel.findScoreLog({
      studentId, subjectId, semesterId, page: parsedPage, limit: parsedLimit,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) },
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy lịch sử điểm");
  }
}

// GET /teachers/academic/students/:studentId
async function getStudentAcademic(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const allowed = await academicModel.isTeacherForStudent(profile.teacherId, studentId);
    if (!allowed) return res.status(403).json({ success: false, message: "Bạn không có quyền xem học sinh này" });

    const data = await academicService.getStudentAcademic({ studentId, semesterId: req.query.semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy kết quả học tập");
  }
}

// GET /teachers/academic/analytics
async function getAnalytics(req, res) {
  try {
    const { classId, semesterId } = req.query;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    // teacher must teach this class (any subject)
    const assignments = await academicModel.findTeachingAssignments(profile.teacherId);
    const teachesClass = assignments.some((a) => a.classId === parseInt(classId, 10));
    if (!teachesClass) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });

    const data = await academicService.getClassAnalytics({
      teacherId: profile.teacherId, classId, semesterId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy thống kê học tập");
  }
}

// GET /teachers/academic/analytics/trend
async function getTrend(req, res) {
  try {
    const { classId } = req.query;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const data = await academicService.getClassTrend({ classId: parseInt(classId, 10) });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy phân tích xu hướng");
  }
}

// GET /teachers/academic/warnings
async function getWarnings(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { classId, semesterId, status, page = "1", limit = "20" } = req.query;
    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await academicModel.findWarnings({
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

// POST /teachers/academic/warnings/generate
async function generateWarnings(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { classId, semesterId } = req.body;

    const assignments = await academicModel.findTeachingAssignments(profile.teacherId);
    const teachesClass = assignments.some((a) => a.classId === parseInt(classId, 10));
    if (!teachesClass) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });

    const result = await academicService.generateWarnings({
      teacherId: profile.teacherId, actorUserId: req.user.userId, classId, semesterId,
    });

    return res.json({ success: true, message: `Đã tạo/cập nhật ${result.generated} cảnh báo`, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể tạo cảnh báo");
  }
}

// PUT /teachers/academic/warnings/:warningId
async function updateWarning(req, res) {
  try {
    const warningId = parseInt(req.params.warningId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const result = await academicService.updateWarning({ warningId, payload: req.body });
    return res.json({ success: true, message: "Cập nhật cảnh báo thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật cảnh báo");
  }
}

module.exports = {
  getMeta,
  getScoreSheet,
  getGradebook,
  submitScores,
  updateScore,
  deleteScore,
  getScoreLog,
  getStudentAcademic,
  getAnalytics,
  getTrend,
  getWarnings,
  generateWarnings,
  updateWarning,
};
