const teacherModel = require("../models/teacher.model");
const eventModel   = require("../models/event.model");
const eventService = require("../services/event.service");
const studentProfileModel = require("../models/studentProfile.model");

const CATEGORIES = [
  { key: "ACADEMIC",    label: "Hoạt động học thuật" },
  { key: "PARENT",      label: "Hoạt động phụ huynh" },
  { key: "SCHOOL",      label: "Sự kiện trường" },
  { key: "CLASS",       label: "Hoạt động lớp" },
  { key: "SPORTS",      label: "Thể thao" },
  { key: "FIELD_TRIP",  label: "Dã ngoại" },
  { key: "COMPETITION", label: "Cuộc thi" },
  { key: "COMMUNITY",   label: "Cộng đồng" },
];

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

async function getMeta(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const classes = await eventModel.findTeacherClasses(teacher.teacherId);
    return res.json({ success: true, data: { classes, categories: CATEGORIES } });
  } catch (error) { return handleError(res, error, "Không thể lấy dữ liệu khởi tạo"); }
}

async function getClassContacts(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const ok = await eventModel.isTeacherForClass(teacher.teacherId, classId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });
    const contacts = await eventModel.findClassContacts(classId);
    return res.json({ success: true, data: contacts });
  } catch (error) { return handleError(res, error, "Không thể lấy danh sách"); }
}

async function getDashboard(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const classes = await eventModel.findTeacherClasses(teacher.teacherId);
    const classIds = classes.map((c) => c.classId);
    const [stats, upcoming] = await Promise.all([
      eventModel.dashboardStats(teacher.userId),
      eventModel.findEvents(teacher.userId, classIds, { status: "ACTIVE", page: 1, limit: 5 }),
    ]);
    return res.json({ success: true, data: { stats, upcoming: upcoming.rows } });
  } catch (error) { return handleError(res, error, "Không thể lấy bảng điều khiển"); }
}

async function getAnalytics(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const data = await eventModel.analytics(teacher.userId);

    const catLabels = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
    const distribution = data.byCategory.map((c) => ({ key: c.category, label: catLabels[c.category] ?? c.category, count: c.count }));
    return res.json({
      success: true,
      data: {
        distribution,
        byMonth: data.byMonth,
        totalParticipants: data.totalParticipants,
        totalAttended: data.totalAttended,
        attendanceRate: data.totalParticipants > 0 ? Math.round((data.totalAttended / data.totalParticipants) * 1000) / 10 : 0,
      },
    });
  } catch (error) { return handleError(res, error, "Không thể lấy thống kê"); }
}

async function listEvents(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const classes = await eventModel.findTeacherClasses(teacher.teacherId);
    const classIds = classes.map((c) => c.classId);

    const { status, category, classId, startDate, endDate, search, page = "1", limit = "100" } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await eventModel.findEvents(teacher.userId, classIds, {
      status, category, classId, startDate, endDate, search, page: parsedPage, limit: parsedLimit,
    });
    return res.json({ success: true, data: { items: rows, pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) } } });
  } catch (error) { return handleError(res, error, "Không thể lấy danh sách sự kiện"); }
}

async function createEvent(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.createEvent({ actor: teacher, payload: req.body });
    return res.status(201).json({ success: true, message: "Đã tạo sự kiện", data: result });
  } catch (error) { return handleError(res, error, "Không thể tạo sự kiện"); }
}

async function getDetail(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const data = await eventService.getDetail({ actor: teacher, eventId: parseInt(req.params.eventId, 10) });
    return res.json({ success: true, data });
  } catch (error) { return handleError(res, error, "Không thể lấy chi tiết sự kiện"); }
}

async function updateEvent(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.updateEvent({ actor: teacher, eventId: parseInt(req.params.eventId, 10), payload: req.body });
    return res.json({ success: true, message: "Cập nhật thành công", data: result });
  } catch (error) { return handleError(res, error, "Không thể cập nhật sự kiện"); }
}

async function changeStatus(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.changeStatus({ actor: teacher, eventId: parseInt(req.params.eventId, 10), status: req.body.status });
    return res.json({ success: true, message: "Cập nhật trạng thái thành công", data: result });
  } catch (error) { return handleError(res, error, "Không thể đổi trạng thái"); }
}

async function duplicateEvent(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.duplicateEvent({ actor: teacher, eventId: parseInt(req.params.eventId, 10) });
    return res.status(201).json({ success: true, message: "Đã nhân bản sự kiện", data: result });
  } catch (error) { return handleError(res, error, "Không thể nhân bản sự kiện"); }
}

async function sendReminder(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.sendReminder({ actor: teacher, eventId: parseInt(req.params.eventId, 10) });
    return res.json({ success: true, message: `Đã gửi nhắc nhở tới ${result.sent} người`, data: result });
  } catch (error) { return handleError(res, error, "Không thể gửi nhắc nhở"); }
}

async function addParticipants(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.addParticipants({ actor: teacher, eventId: parseInt(req.params.eventId, 10), participants: req.body.participants });
    return res.json({ success: true, message: `Đã thêm ${result.added} người`, data: result });
  } catch (error) { return handleError(res, error, "Không thể thêm người tham dự"); }
}

async function removeParticipant(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.removeParticipant({ actor: teacher, eventId: parseInt(req.params.eventId, 10), registrationId: parseInt(req.params.registrationId, 10) });
    return res.json({ success: true, message: "Đã xóa người tham dự", data: result });
  } catch (error) { return handleError(res, error, "Không thể xóa người tham dự"); }
}

async function markAttendance(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.markAttendance({ actor: teacher, eventId: parseInt(req.params.eventId, 10), registrationId: parseInt(req.params.registrationId, 10), status: req.body.status });
    return res.json({ success: true, message: "Đã cập nhật điểm danh", data: result });
  } catch (error) { return handleError(res, error, "Không thể điểm danh"); }
}

async function saveOutcome(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await eventService.saveOutcome({ actor: teacher, eventId: parseInt(req.params.eventId, 10), payload: req.body });
    return res.json({ success: true, message: result.submitted ? "Đã chốt báo cáo" : "Đã lưu báo cáo", data: result });
  } catch (error) { return handleError(res, error, "Không thể lưu báo cáo"); }
}

async function uploadDocument(req, res) {
  try {
    const eventId = parseInt(req.params.eventId, 10);

    const teacher = await resolveTeacher(req.user.userId);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const event = await eventModel.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sự kiện",
      });
    }

    if (event.createdBy !== teacher.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có tệp",
      });
    }

    const fileUrl = req.file.cloudinaryUrl;

    const attachmentId = await eventModel.insertDocument({
      eventId,
      fileName: req.file.originalname,
      fileUrl,
      fileType: req.file.mimetype,
      uploadedBy: teacher.userId,
    });

    await eventModel.log(
      eventId,
      "DOCUMENT",
      `Tải lên tài liệu: ${req.file.originalname}`,
      teacher.userId,
    );

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
    return handleError(
      res,
      error,
      "Không thể tải tài liệu",
    );
  }
}

async function deleteDocument(req, res) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const event = await eventModel.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });
    if (event.createdBy !== teacher.userId) return res.status(403).json({ success: false, message: "Bạn không có quyền" });

    const removed = await eventModel.deleteDocument(attachmentId, eventId);
    if (removed === 0) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu" });
    return res.json({ success: true, message: "Đã xóa tài liệu" });
  } catch (error) { return handleError(res, error, "Không thể xóa tài liệu"); }
}

// ── Admin (school-wide, every event, no ownership restriction) ─────────────

function actorOfAdmin(req) {
  return { userId: req.user.userId, isAdmin: true };
}

// GET /admin/events/meta — every class school-wide + categories
async function getMetaAdmin(_req, res) {
  try {
    const classes = await studentProfileModel.findAllClasses();
    return res.json({ success: true, data: { classes, categories: CATEGORIES } });
  } catch (error) { return handleError(res, error, "Không thể lấy dữ liệu khởi tạo"); }
}

// GET /admin/events/classes/:classId/contacts — no ownership check, any class
async function getClassContactsAdmin(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);
    const contacts = await eventModel.findClassContacts(classId);
    return res.json({ success: true, data: contacts });
  } catch (error) { return handleError(res, error, "Không thể lấy danh sách"); }
}

// GET /admin/events/dashboard
async function getDashboardAdmin(_req, res) {
  try {
    const [stats, upcoming] = await Promise.all([
      eventModel.dashboardStatsAll(),
      eventModel.findAllEvents({ status: "ACTIVE", page: 1, limit: 5 }),
    ]);
    return res.json({ success: true, data: { stats, upcoming: upcoming.rows } });
  } catch (error) { return handleError(res, error, "Không thể lấy bảng điều khiển"); }
}

// GET /admin/events/analytics
async function getAnalyticsAdmin(_req, res) {
  try {
    const data = await eventModel.analyticsAll();
    const catLabels = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
    const distribution = data.byCategory.map((c) => ({ key: c.category, label: catLabels[c.category] ?? c.category, count: c.count }));
    return res.json({
      success: true,
      data: {
        distribution,
        byMonth: data.byMonth,
        totalParticipants: data.totalParticipants,
        totalAttended: data.totalAttended,
        attendanceRate: data.totalParticipants > 0 ? Math.round((data.totalAttended / data.totalParticipants) * 1000) / 10 : 0,
      },
    });
  } catch (error) { return handleError(res, error, "Không thể lấy thống kê"); }
}

// GET /admin/events — every event school-wide
async function listEventsAdmin(req, res) {
  try {
    const { status, category, classId, startDate, endDate, search, page = "1", limit = "100" } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await eventModel.findAllEvents({
      status, category, classId, startDate, endDate, search, page: parsedPage, limit: parsedLimit,
    });
    return res.json({ success: true, data: { items: rows, pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) } } });
  } catch (error) { return handleError(res, error, "Không thể lấy danh sách sự kiện"); }
}

async function createEventAdmin(req, res) {
  try {
    const result = await eventService.createEvent({ actor: actorOfAdmin(req), payload: req.body });
    return res.status(201).json({ success: true, message: "Đã tạo sự kiện", data: result });
  } catch (error) { return handleError(res, error, "Không thể tạo sự kiện"); }
}

async function getDetailAdmin(req, res) {
  try {
    const data = await eventService.getDetail({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10) });
    return res.json({ success: true, data });
  } catch (error) { return handleError(res, error, "Không thể lấy chi tiết sự kiện"); }
}

async function updateEventAdmin(req, res) {
  try {
    const result = await eventService.updateEvent({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10), payload: req.body });
    return res.json({ success: true, message: "Cập nhật thành công", data: result });
  } catch (error) { return handleError(res, error, "Không thể cập nhật sự kiện"); }
}

async function changeStatusAdmin(req, res) {
  try {
    const result = await eventService.changeStatus({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10), status: req.body.status });
    return res.json({ success: true, message: "Cập nhật trạng thái thành công", data: result });
  } catch (error) { return handleError(res, error, "Không thể đổi trạng thái"); }
}

async function duplicateEventAdmin(req, res) {
  try {
    const result = await eventService.duplicateEvent({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10) });
    return res.status(201).json({ success: true, message: "Đã nhân bản sự kiện", data: result });
  } catch (error) { return handleError(res, error, "Không thể nhân bản sự kiện"); }
}

async function sendReminderAdmin(req, res) {
  try {
    const result = await eventService.sendReminder({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10) });
    return res.json({ success: true, message: `Đã gửi nhắc nhở tới ${result.sent} người`, data: result });
  } catch (error) { return handleError(res, error, "Không thể gửi nhắc nhở"); }
}

async function addParticipantsAdmin(req, res) {
  try {
    const result = await eventService.addParticipants({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10), participants: req.body.participants });
    return res.json({ success: true, message: `Đã thêm ${result.added} người`, data: result });
  } catch (error) { return handleError(res, error, "Không thể thêm người tham dự"); }
}

async function removeParticipantAdmin(req, res) {
  try {
    const result = await eventService.removeParticipant({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10), registrationId: parseInt(req.params.registrationId, 10) });
    return res.json({ success: true, message: "Đã xóa người tham dự", data: result });
  } catch (error) { return handleError(res, error, "Không thể xóa người tham dự"); }
}

async function markAttendanceAdmin(req, res) {
  try {
    const result = await eventService.markAttendance({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10), registrationId: parseInt(req.params.registrationId, 10), status: req.body.status });
    return res.json({ success: true, message: "Đã cập nhật điểm danh", data: result });
  } catch (error) { return handleError(res, error, "Không thể điểm danh"); }
}

async function saveOutcomeAdmin(req, res) {
  try {
    const result = await eventService.saveOutcome({ actor: actorOfAdmin(req), eventId: parseInt(req.params.eventId, 10), payload: req.body });
    return res.json({ success: true, message: result.submitted ? "Đã chốt báo cáo" : "Đã lưu báo cáo", data: result });
  } catch (error) { return handleError(res, error, "Không thể lưu báo cáo"); }
}

async function uploadDocumentAdmin(req, res) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const event = await eventModel.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });
    if (!req.file) return res.status(400).json({ success: false, message: "Không có tệp" });

    const fileUrl = req.file.cloudinaryUrl;
    const attachmentId = await eventModel.insertDocument({
      eventId, fileName: req.file.originalname, fileUrl, fileType: req.file.mimetype, uploadedBy: req.user.userId,
    });
    await eventModel.log(eventId, "DOCUMENT", `Tải lên tài liệu: ${req.file.originalname}`, req.user.userId);

    return res.status(201).json({
      success: true,
      data: {
        attachmentId, fileName: req.file.originalname, fileUrl, fileType: req.file.mimetype,
        publicId: req.file.cloudinaryPublicId, resourceType: req.file.cloudinaryResourceType,
      },
    });
  } catch (error) { return handleError(res, error, "Không thể tải tài liệu"); }
}

async function deleteDocumentAdmin(req, res) {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);
    const event = await eventModel.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });

    const removed = await eventModel.deleteDocument(attachmentId, eventId);
    if (removed === 0) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu" });
    return res.json({ success: true, message: "Đã xóa tài liệu" });
  } catch (error) { return handleError(res, error, "Không thể xóa tài liệu"); }
}

module.exports = {
  getMeta, getClassContacts, getDashboard, getAnalytics, listEvents, createEvent, getDetail,
  updateEvent, changeStatus, duplicateEvent, sendReminder, addParticipants, removeParticipant,
  markAttendance, saveOutcome, uploadDocument, deleteDocument,
  getMetaAdmin, getClassContactsAdmin, getDashboardAdmin, getAnalyticsAdmin, listEventsAdmin,
  createEventAdmin, getDetailAdmin, updateEventAdmin, changeStatusAdmin, duplicateEventAdmin,
  sendReminderAdmin, addParticipantsAdmin, removeParticipantAdmin, markAttendanceAdmin,
  saveOutcomeAdmin, uploadDocumentAdmin, deleteDocumentAdmin,
};
