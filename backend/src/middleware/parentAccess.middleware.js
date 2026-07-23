const parentModel = require("../models/parents");

// Requires `authenticate` (req.user) to have run first. Expects a `:studentId`
// route param. On success attaches the linked-student row to `req.linkedStudent`
// so handlers don't have to re-fetch it.
async function ensureParentOwnsStudent(req, res, next) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    if (Number.isNaN(studentId)) {
      return res.status(400).json({ success: false, message: "Mã học sinh không hợp lệ" });
    }

    const students = await parentModel.findLinkedStudentsByUserId(req.user.userId);
    const student = students.find((s) => s.studentId === studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh hoặc bạn không có quyền truy cập thông tin này",
      });
    }

    req.linkedStudent = student;
    next();
  } catch (error) {
    console.error("ensureParentOwnsStudent error:", error);
    return res.status(500).json({ success: false, message: "Không thể xác thực quyền truy cập học sinh" });
  }
}

module.exports = { ensureParentOwnsStudent };
