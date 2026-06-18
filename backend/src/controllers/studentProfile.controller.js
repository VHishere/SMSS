const teacherModel        = require("../models/teacher.model");
const studentProfileModel = require("../models/studentProfile.model");
const studentProfileService = require("../services/studentProfile.service");

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

// GET /teachers/students/meta — classes + semesters
async function getMeta(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const [classes, semesters] = await Promise.all([
      studentProfileModel.findTeacherClasses(profile.teacherId),
      studentProfileModel.findSemesters(),
    ]);
    return res.json({ success: true, data: { classes, semesters } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

// GET /teachers/students/overview?classId&semesterId — class risk dashboard
async function getClassOverview(req, res) {
  try {
    const { classId, semesterId } = req.query;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    if (!classId) return res.status(400).json({ success: false, message: "Thiếu lớp" });

    const ok = await studentProfileModel.isTeacherForClass(profile.teacherId, parseInt(classId, 10));
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không phụ trách lớp này" });

    const data = await studentProfileService.getClassOverview({ classId: parseInt(classId, 10), semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách học sinh");
  }
}

// GET /teachers/students/:studentId/profile
async function getProfile(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await studentProfileModel.isTeacherForStudent(profile.teacherId, studentId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền xem học sinh này" });

    const data = await studentProfileService.getProfile({ studentId, semesterId: req.query.semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy hồ sơ học sinh");
  }
}

// GET /teachers/students/:studentId/attendance
async function getAttendanceHistory(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const ok = await studentProfileModel.isTeacherForStudent(profile.teacherId, studentId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không có quyền xem học sinh này" });

    const data = await studentProfileService.getAttendanceHistory({ studentId, semesterId: req.query.semesterId });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy lịch sử điểm danh");
  }
}

module.exports = {
  getMeta,
  getClassOverview,
  getProfile,
  getAttendanceHistory,
};
