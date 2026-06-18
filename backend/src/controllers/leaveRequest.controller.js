const teacherModel       = require("../models/teacher.model");
const leaveRequestModel  = require("../models/leaveRequest.model");
const leaveRequestService = require("../services/leaveRequest.service");

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

async function resolveTeacher(userId) {
  const profile = await teacherModel.findProfileByUserId(userId);
  return profile;
}

// GET /teachers/leave-requests
// Query: status, classId, startDate, endDate, search, page, limit
async function listLeaveRequests(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);

    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    }

    const {
      status,
      classId,
      startDate,
      endDate,
      search,
      page  = "1",
      limit = "20",
    } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [{ total, rows }, counts, classes] = await Promise.all([
      leaveRequestModel.findByTeacher(profile.teacherId, {
        status,
        classId,
        startDate,
        endDate,
        search,
        page:  parsedPage,
        limit: parsedLimit,
      }),
      leaveRequestModel.countByStatusForTeacher(profile.teacherId),
      leaveRequestModel.findTeacherClassesForFilter(profile.teacherId),
    ]);

    return res.json({
      success: true,
      data: {
        items: rows,
        counts,
        classes,
        pagination: {
          total,
          page:       parsedPage,
          limit:      parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (error) {
    console.error("listLeaveRequests error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách đơn xin nghỉ" });
  }
}

// GET /teachers/leave-requests/:leaveRequestId
async function getLeaveRequestDetail(req, res) {
  try {
    const leaveRequestId = parseInt(req.params.leaveRequestId, 10);

    const profile = await resolveTeacher(req.user.userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    }

    const detail = await leaveRequestModel.findDetailById(leaveRequestId);

    if (!detail) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn xin nghỉ" });
    }

    if (detail.homeroomTeacherId !== profile.teacherId) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xem đơn này" });
    }

    return res.json({ success: true, data: detail });
  } catch (error) {
    console.error("getLeaveRequestDetail error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy chi tiết đơn xin nghỉ" });
  }
}

// PUT /teachers/leave-requests/:leaveRequestId/decision
// Body: { decision: 'APPROVE' | 'REJECT', comment: string }
async function decideLeaveRequest(req, res) {
  try {
    const leaveRequestId = parseInt(req.params.leaveRequestId, 10);
    const { decision, comment } = req.body;

    const profile = await resolveTeacher(req.user.userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    }

    const result = await leaveRequestService.decideLeaveRequest({
      leaveRequestId,
      decision,
      comment,
      actor: {
        userId:    req.user.userId,
        teacherId: profile.teacherId,
        roleNames: req.user.roles || [],
      },
    });

    return res.json({
      success: true,
      message: result.status === "APPROVED" ? "Đã duyệt đơn xin nghỉ" : "Đã từ chối đơn xin nghỉ",
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error("decideLeaveRequest error:", error);
    return res.status(500).json({ success: false, message: "Không thể xử lý đơn xin nghỉ" });
  }
}

module.exports = {
  listLeaveRequests,
  getLeaveRequestDetail,
  decideLeaveRequest,
};
