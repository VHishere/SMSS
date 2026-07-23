const fs = require("fs/promises");

const parentModel = require("../models/parents");
const teacherModel = require("../models/teacher.model");
const leaveRequestModel = require("../models/leaveRequest.model");
const attachmentModel = require("../models/attachment.model");
const leaveRequestService = require("../services/leaveRequest.service");
const cloudinary = require("../config/cloudinary");

// ── Shared helpers ────────────────────────────────────────────────────────────

async function deleteUploadedFile(file) {
  if (file?.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(
        file.cloudinaryPublicId,
        {
          resource_type: file.cloudinaryResourceType || "raw",
        },
      );
    } catch (error) {
      console.error("deleteCloudinaryFile error:", error);
    }

    return;
  }

  if (!file?.path) return;

  try {
    await fs.unlink(file.path);
  } catch (error) {
    console.error("deleteUploadedFile error:", error);
  }
}

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

// ── Parent side ───────────────────────────────────────────────────────────────

async function createLeaveRequest(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const student = req.linkedStudent;

    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !leaveRequestModel.LEAVE_TYPES.includes(leaveType)) {
      await deleteUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: `Loại đơn không hợp lệ. Giá trị hợp lệ: ${leaveRequestModel.LEAVE_TYPES.join(", ")}`,
      });
    }

    if (!startDate || !endDate || Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate))) {
      await deleteUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp thời gian nghỉ hợp lệ",
      });
    }

    if (new Date(startDate) > new Date(endDate)) {
      await deleteUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Ngày bắt đầu không thể sau ngày kết thúc",
      });
    }

    if (!reason || !reason.trim()) {
      await deleteUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập lý do xin nghỉ",
      });
    }

    // Nghỉ vì lý do sức khỏe BẮT BUỘC đính kèm minh chứng (giấy viện, lịch khám).
    if (leaveType === "SICK_LEAVE" && !req.file) {
      return res.status(400).json({
        success: false,
        message: "Đơn nghỉ vì lý do sức khỏe bắt buộc đính kèm minh chứng (giấy khám bệnh, lịch khám...).",
      });
    }

    const parent = await parentModel.findProfileByUserId(req.user.userId);
    if (!parent) {
      await deleteUploadedFile(req.file);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ phụ huynh",
      });
    }

    const homeroomTeacher = student.classId
      ? await leaveRequestModel.findHomeroomTeacherUserIdByClassId(student.classId)
      : null;

    const leaveRequestId = await leaveRequestModel.create({
      studentId,
      parentId: parent.parentId,
      homeroomTeacherId: homeroomTeacher?.teacherId || null,
      leaveType,
      startDate,
      endDate,
      reason: reason.trim(),
    });

    if (req.file) {
      const attachmentId = await attachmentModel.create({
        relatedType: "LEAVE_REQUEST",
        relatedId: leaveRequestId,
        fileName: req.file.originalname,
        fileUrl: req.file.cloudinaryUrl,
        fileType: req.file.mimetype,
        uploadedBy: req.user.userId,
      });

      await leaveRequestModel.attachFile(leaveRequestId, attachmentId);
    }

    await leaveRequestModel.notifyHomeroomTeacher(homeroomTeacher?.userId, {
      leaveRequestId,
      studentName: student.studentFullName,
      startDate,
      endDate,
    });

    const leaveRequest = await leaveRequestModel.findById(leaveRequestId);

    return res.status(201).json({
      success: true,
      data: leaveRequest,
    });
  } catch (error) {
    console.error("createLeaveRequest error:", error);
    await deleteUploadedFile(req.file);
    return res.status(500).json({
      success: false,
      message: "Không thể tạo đơn xin nghỉ",
    });
  }
}

async function getStudentLeaveRequests(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const { status, page = "1", limit = "20" } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await leaveRequestModel.findByStudentId(studentId, {
      page: parsedPage,
      limit: parsedLimit,
      status,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (error) {
    console.error("getStudentLeaveRequests error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách đơn xin nghỉ",
    });
  }
}

async function getParentLeaveRequestDetail(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const leaveRequestId = parseInt(req.params.leaveRequestId, 10);

    const leaveRequest = await leaveRequestModel.findById(leaveRequestId);
    if (!leaveRequest || leaveRequest.studentId !== studentId) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn xin nghỉ",
      });
    }

    return res.json({
      success: true,
      data: leaveRequest,
    });
  } catch (error) {
    console.error("getParentLeaveRequestDetail error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin đơn xin nghỉ",
    });
  }
}

async function cancelLeaveRequest(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const leaveRequestId = parseInt(req.params.leaveRequestId, 10);

    const leaveRequest = await leaveRequestModel.findById(leaveRequestId);
    if (!leaveRequest || leaveRequest.studentId !== studentId) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn xin nghỉ",
      });
    }

    if (leaveRequest.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể hủy đơn đang ở trạng thái chờ duyệt",
      });
    }

    await leaveRequestModel.cancelPending(leaveRequestId);

    return res.json({
      success: true,
      message: "Đã hủy đơn xin nghỉ",
    });
  } catch (error) {
    console.error("cancelLeaveRequest error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể hủy đơn xin nghỉ",
    });
  }
}

// ── Teacher side ──────────────────────────────────────────────────────────────

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

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
      page = "1",
      limit = "20",
    } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const [{ total, rows }, counts, classes] = await Promise.all([
      leaveRequestModel.findByTeacher(profile.teacherId, {
        status,
        classId,
        startDate,
        endDate,
        search,
        page: parsedPage,
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
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (error) {
    console.error("listLeaveRequests error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách đơn xin nghỉ" });
  }
}

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
        userId: req.user.userId,
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
  // Parent
  createLeaveRequest,
  getStudentLeaveRequests,
  getParentLeaveRequestDetail,
  cancelLeaveRequest,
  // Teacher
  listLeaveRequests,
  getLeaveRequestDetail,
  decideLeaveRequest,
};
