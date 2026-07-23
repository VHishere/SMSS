const teacherModel      = require("../models/teacher.model");
const announcementModel = require("../models/announcement.model");
const announcementService = require("../services/announcement.service");

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

// GET /teachers/announcements
async function list(req, res) {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const { total, rows } = await announcementModel.findByCreator(req.user.userId, { status, page: parsedPage, limit: parsedLimit });
    return res.json({
      success: true,
      data: { items: rows, pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) } },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách thông báo");
  }
}

async function create(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await announcementService.createAnnouncement({ teacher, actorUserId: req.user.userId, payload: req.body });
    return res.status(201).json({ success: true, message: "Đã lưu thông báo", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể tạo thông báo");
  }
}

async function update(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const announcementId = parseInt(req.params.announcementId, 10);
    const result = await announcementService.updateAnnouncement({ teacher, announcementId, payload: req.body });
    return res.json({ success: true, message: "Cập nhật thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật thông báo");
  }
}

async function publish(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const announcementId = parseInt(req.params.announcementId, 10);
    const result = await announcementService.publishAnnouncement({ teacher, announcementId });
    return res.json({ success: true, message: `Đã phát hành tới ${result.sent} người`, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể phát hành thông báo");
  }
}

async function pin(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const announcementId = parseInt(req.params.announcementId, 10);
    const result = await announcementService.setPinned({ teacher, announcementId, isPinned: Boolean(req.body.isPinned) });
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể ghim thông báo");
  }
}

async function archive(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const announcementId = parseInt(req.params.announcementId, 10);
    const result = await announcementService.archiveAnnouncement({ teacher, announcementId });
    return res.json({ success: true, message: "Đã lưu trữ thông báo", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể lưu trữ thông báo");
  }
}

// GET /teachers/announcements/:announcementId/receipts  (UC-71)
async function getReceipts(req, res) {
  try {
    const announcementId = parseInt(req.params.announcementId, 10);
    const existing = await announcementModel.findById(announcementId);
    if (!existing) return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    if (existing.createdBy !== req.user.userId) return res.status(403).json({ success: false, message: "Bạn không có quyền xem" });

    const data = await announcementModel.findReadReceipts(announcementId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy tình trạng đã đọc");
  }
}

module.exports = { list, create, update, publish, pin, archive, getReceipts };
