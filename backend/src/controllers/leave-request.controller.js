const fs = require("fs/promises");

const parentModel = require("../models/parents");
const leaveRequestModel = require("../models/leaveRequest.model");
const attachmentModel = require("../models/attachment.model");

async function getLinkedStudentOrNull(userId, studentId) {
  const students = await parentModel.findLinkedStudentsByUserId(userId);
  return students.find((s) => s.studentId === studentId) || null;
}

async function deleteUploadedFile(file) {
  if (!file) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    console.error("deleteUploadedFile error:", error);
  }
}

async function createLeaveRequest(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const student = await getLinkedStudentOrNull(req.user.userId, studentId);
    if (!student) {
      await deleteUploadedFile(req.file);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền tạo đơn xin nghỉ cho học sinh này",
      });
    }

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
        fileUrl: `/uploads/leave-requests/${req.file.filename}`,
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

    const student = await getLinkedStudentOrNull(req.user.userId, studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem thông tin này",
      });
    }

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

async function getLeaveRequestDetail(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const leaveRequestId = parseInt(req.params.leaveRequestId, 10);

    const student = await getLinkedStudentOrNull(req.user.userId, studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền xem thông tin này",
      });
    }

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
    console.error("getLeaveRequestDetail error:", error);
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

    const student = await getLinkedStudentOrNull(req.user.userId, studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền thực hiện hành động này",
      });
    }

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

module.exports = {
  createLeaveRequest,
  getStudentLeaveRequests,
  getLeaveRequestDetail,
  cancelLeaveRequest,
};
