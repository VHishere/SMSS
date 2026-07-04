const teacherModel  = require("../models/teacher.model");
const meetingModel  = require("../models/meeting.model");
const meetingService = require("../services/meeting.service");

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

// GET /teachers/meetings/meta
async function getMeta(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const classes = await meetingModel.findTeacherClasses(teacher.teacherId);
    return res.json({ success: true, data: { classes } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

// GET /teachers/meetings/classes/:classId/parents
async function getClassParents(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await meetingModel.isTeacherForClass(teacher.teacherId, classId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });

    const parents = await meetingModel.findClassParents(classId);
    return res.json({ success: true, data: parents });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách phụ huynh");
  }
}

// GET /teachers/meetings/dashboard
async function getDashboard(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const [stats, upcoming] = await Promise.all([
      meetingModel.dashboardStats(teacher.teacherId, teacher.userId),
      meetingModel.findMeetingsByTeacher(teacher.teacherId, { status: "SCHEDULED", page: 1, limit: 5 }),
    ]);
    return res.json({ success: true, data: { stats, upcoming: upcoming.rows } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy bảng điều khiển");
  }
}

// GET /teachers/meetings
async function listMeetings(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { status, classId, studentId, startDate, endDate, search, page = "1", limit = "20" } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await meetingModel.findMeetingsByTeacher(teacher.teacherId, {
      status, classId, studentId, startDate, endDate, search, page: parsedPage, limit: parsedLimit,
    });
    return res.json({
      success: true,
      data: { items: rows, pagination: { total, page: parsedPage, limit: parsedLimit, totalPages: Math.ceil(total / parsedLimit) } },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách cuộc họp");
  }
}

// POST /teachers/meetings
async function createMeeting(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await meetingService.createMeeting({ teacher, payload: req.body });
    return res.status(201).json({ success: true, message: "Đã tạo cuộc họp", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể tạo cuộc họp");
  }
}

// GET /teachers/meetings/:meetingId
async function getDetail(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const data = await meetingService.getMeetingDetail({ teacher, meetingId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy chi tiết cuộc họp");
  }
}

// PUT /teachers/meetings/:meetingId
async function updateMeeting(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await meetingService.updateMeeting({ teacher, meetingId, payload: req.body });
    return res.json({ success: true, message: "Cập nhật cuộc họp thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật cuộc họp");
  }
}

// PATCH /teachers/meetings/:meetingId/status
async function changeStatus(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await meetingService.changeStatus({ teacher, meetingId, status: req.body.status });
    return res.json({ success: true, message: "Cập nhật trạng thái thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể đổi trạng thái");
  }
}

// POST /teachers/meetings/:meetingId/invitations
async function addInvitees(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await meetingService.addInvitees({ teacher, meetingId, invitees: req.body.invitees });
    return res.json({ success: true, message: `Đã mời ${result.added} người`, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể mời thêm");
  }
}

// POST /teachers/meetings/:meetingId/invitations/:invitationId/resend
async function resendInvitation(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const invitationId = parseInt(req.params.invitationId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await meetingService.resendInvitation({ teacher, meetingId, invitationId, recipientUserId: req.body.userId });
    return res.json({ success: true, message: "Đã gửi lại lời mời", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể gửi lại lời mời");
  }
}

// PUT /teachers/meetings/:meetingId/minutes
async function saveMinutes(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await meetingService.saveMinutes({ teacher, meetingId, payload: req.body });
    return res.json({ success: true, message: result.submitted ? "Đã chốt biên bản" : "Đã lưu biên bản", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể lưu biên bản");
  }
}

// POST /teachers/meetings/:meetingId/actions
async function createAction(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await meetingService.createAction({ teacher, meetingId, payload: req.body });
    return res.status(201).json({ success: true, message: "Đã tạo công việc", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể tạo công việc");
  }
}

// PATCH /teachers/meetings/:meetingId/actions/:actionId
async function updateActionStatus(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const actionId = parseInt(req.params.actionId, 10);
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const result = await meetingService.updateActionStatus({ teacher, meetingId, actionId, status: req.body.status });
    return res.json({ success: true, message: "Cập nhật công việc thành công", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật công việc");
  }
}

// PATCH /parents/me/meetings/:meetingId/invitation
async function respondToInvitation(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const { action } = req.body;
    if (!["ACCEPT", "DECLINE"].includes(action)) {
      return res.status(400).json({ success: false, message: "action phải là ACCEPT hoặc DECLINE" });
    }
    const newStatus = action === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    const affected = await meetingModel.respondToInvitation(meetingId, req.user.userId, newStatus);
    if (affected === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lời mời hoặc đã phản hồi trước đó" });
    }
    return res.json({ success: true, message: action === "ACCEPT" ? "Đã xác nhận tham dự" : "Đã từ chối lời mời" });
  } catch (error) {
    return handleError(res, error, "Không thể phản hồi lời mời");
  }
}

// GET /parents/me/meetings/dashboard
async function getParentDashboard(req, res) {
  try {
    const stats = await meetingModel.parentDashboardStats(req.user.userId);
    return res.json({ success: true, data: { stats } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu cuộc họp");
  }
}

// GET /parents/me/meetings
async function listParentMeetings(req, res) {
  try {
    const { status, search, page, limit } = req.query;
    const result = await meetingModel.findMeetingsByParent(req.user.userId, {
      status, search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    return res.json({ success: true, data: { items: result.rows, total: result.total } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách cuộc họp");
  }
}

// GET /parents/me/meetings/:meetingId
async function getParentMeetingDetail(req, res) {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);
    const meeting = await meetingModel.findMeetingByIdForParent(meetingId, req.user.userId);
    if (!meeting) return res.status(404).json({ success: false, message: "Không tìm thấy cuộc họp hoặc bạn không được mời" });

    const [invitations, minutes, actions, logs] = await Promise.all([
      meetingModel.findInvitations(meetingId),
      meetingModel.findMinutes(meetingId),
      meetingModel.findActions(meetingId),
      meetingModel.findLog(meetingId),
    ]);

    return res.json({ success: true, data: { meeting, invitations, minutes, actions, logs } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy thông tin cuộc họp");
  }
}

module.exports = {
  getMeta,
  getClassParents,
  getDashboard,
  listMeetings,
  createMeeting,
  getDetail,
  updateMeeting,
  changeStatus,
  addInvitees,
  resendInvitation,
  saveMinutes,
  createAction,
  updateActionStatus,
  respondToInvitation,
  getParentDashboard,
  listParentMeetings,
  getParentMeetingDetail,
};
