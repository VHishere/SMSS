const teacherModel        = require("../models/teacher.model");
const studentProfileModel = require("../models/studentProfile.model");
const supportCaseModel    = require("../models/supportCase.model");

const CATEGORIES = ["ACADEMIC", "BEHAVIOUR", "ATTENDANCE", "PSYCHOLOGICAL", "FAMILY", "OTHER"];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"];
const STATUSES   = ["OPEN", "MONITORING", "RESOLVED"];

async function resolveTeacher(userId) {
  const profile = await teacherModel.findProfileByUserId(userId);
  if (!profile) return null;
  return { teacherId: profile.teacherId, userId };
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

// GET /teachers/support-cases
async function listCases(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { status, classId, page = "1", limit = "20" } = req.query;
    if (classId) {
      const ok = await studentProfileModel.isHomeroomOfClass(teacher.teacherId, parseInt(classId, 10));
      if (!ok) return res.status(403).json({ success: false, message: "Chỉ giáo viên chủ nhiệm mới xem ca hỗ trợ của lớp này" });
    }
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    // Default scope: cases opened by this teacher (so each teacher sees their own caseload)
    const { total, rows } = await supportCaseModel.findCases({
      status, classId, openedBy: classId ? null : teacher.userId,
      page: parsedPage, limit: parsedLimit,
    });
    return res.json({
      success: true,
      data: { items: rows, pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) } },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách ca hỗ trợ");
  }
}

// POST /teachers/support-cases
async function createCase(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { studentId, category, severity, title, description } = req.body;
    if (!studentId || !title || !title.trim()) return res.status(400).json({ success: false, message: "Thiếu học sinh hoặc tiêu đề" });
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: "Danh mục không hợp lệ" });
    if (severity && !SEVERITIES.includes(severity)) return res.status(400).json({ success: false, message: "Mức độ không hợp lệ" });

    const ok = await studentProfileModel.isHomeroomOfStudent(teacher.teacherId, parseInt(studentId, 10));
    if (!ok) return res.status(403).json({ success: false, message: "Chỉ giáo viên chủ nhiệm mới mở ca hỗ trợ cho học sinh này" });

    const caseId = await supportCaseModel.createCase({
      studentId: parseInt(studentId, 10),
      category: category ?? "OTHER",
      severity: severity ?? "MEDIUM",
      title: title.trim(),
      description: description ?? null,
      openedBy: teacher.userId,
    });
    return res.status(201).json({ success: true, message: "Đã mở ca hỗ trợ", data: { caseId } });
  } catch (error) {
    return handleError(res, error, "Không thể mở ca hỗ trợ");
  }
}

// GET /teachers/support-cases/:caseId/updates
async function getUpdates(req, res) {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const sc = await supportCaseModel.findCaseById(caseId);
    if (!sc) return res.status(404).json({ success: false, message: "Không tìm thấy ca hỗ trợ" });
    const ok = await studentProfileModel.isHomeroomOfStudent(teacher.teacherId, sc.studentId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền xem ca này" });

    const updates = await supportCaseModel.findUpdates(caseId);
    return res.json({ success: true, data: updates });
  } catch (error) {
    return handleError(res, error, "Không thể lấy nhật ký ca hỗ trợ");
  }
}

// POST /teachers/support-cases/:caseId/updates  — add progress note / change status
async function addUpdate(req, res) {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const { note, newStatus } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ success: false, message: "Vui lòng nhập nội dung cập nhật" });
    if (newStatus && !STATUSES.includes(newStatus)) return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });

    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const sc = await supportCaseModel.findCaseById(caseId);
    if (!sc) return res.status(404).json({ success: false, message: "Không tìm thấy ca hỗ trợ" });
    const ok = await studentProfileModel.isHomeroomOfStudent(teacher.teacherId, sc.studentId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền cập nhật ca này" });

    await supportCaseModel.addUpdate({ caseId, note: note.trim(), newStatus: newStatus ?? null, authorId: teacher.userId });
    return res.json({ success: true, message: "Đã cập nhật ca hỗ trợ" });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật ca hỗ trợ");
  }
}

module.exports = { listCases, createCase, getUpdates, addUpdate };
