const teacherModel    = require("../models/teacher.model");
const attendanceModel = require("../models/attendance.model");
const feedbackModel   = require("../models/feedback.model");
const attendanceWarningService = require("../services/attendanceWarning.service");
const { toIsoDate, todayIso } = require("../utils/date");

const HOURS_48_MS = 48 * 60 * 60 * 1000;

function parsePeriodDateTime(date, time) {
  if (!date || !time) return null;
  const normalizedTime = String(time).slice(0, 5);
  const value = new Date(`${date}T${normalizedTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function getPeriodAttendanceWindow(period, date) {
  const opensAt = parsePeriodDateTime(date, period.startTime);
  const closesAt = opensAt ? new Date(opensAt.getTime() + HOURS_48_MS) : null;

  return { opensAt, closesAt };
}

function assertPeriodAttendanceWindow(period, date) {
  const { opensAt, closesAt } = getPeriodAttendanceWindow(period, date);
  if (!opensAt || !closesAt) {
    const error = new Error("Tiết học chưa có thời gian bắt đầu hợp lệ");
    error.statusCode = 409;
    throw error;
  }

  const now = new Date();
  if (now < opensAt) {
    const error = new Error("Chưa đến giờ tiết học nên chưa thể điểm danh");
    error.statusCode = 409;
    throw error;
  }

  if (now > closesAt) {
    const error = new Error(
      "Đã quá thời gian điểm danh. Giáo viên chỉ được điểm danh trong vòng 2 ngày kể từ khi tiết học bắt đầu (BR-ATT-01).",
    );
    error.statusCode = 409;
    throw error;
  }
}

async function assertAttendanceDateEditable(date) {
  const schoolYear = await attendanceModel.findSchoolYearByDate(date);
  if (schoolYear && ["LOCKED", "CLOSED"].includes(schoolYear.status)) {
    const error = new Error(
      `Năm học ${schoolYear.yearName} đã được chốt nên không thể thay đổi điểm danh.`,
    );
    error.statusCode = 409;
    throw error;
  }
}

async function resolveTeacher(userId, classId) {
  const profile = await teacherModel.findProfileByUserId(userId);
  if (!profile) return { profile: null, classInfo: null, hasAccess: false };

  const classInfo = profile.classes.find((c) => c.classId === classId) || null;
  return { profile, classInfo, hasAccess: Boolean(classInfo) };
}

// GET /teachers/classes/:classId/attendance?date=YYYY-MM-DD
async function getAttendanceSheet(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);
    const date    = req.query.date || todayIso();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Định dạng ngày không hợp lệ. Dùng YYYY-MM-DD.",
      });
    }

    const { profile, classInfo, hasAccess } = await resolveTeacher(req.user.userId, classId);

    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền điểm danh lớp này" });
    }

    const [students, existingRecords, attendanceTypes] = await Promise.all([
      attendanceModel.findEnrolledStudents(classId),
      attendanceModel.findAttendanceByClassAndDate(classId, date),
      attendanceModel.findAttendanceTypes(),
    ]);

    const recordMap = {};
    for (const r of existingRecords) {
      recordMap[r.studentId] = r;
    }

    const now = Date.now();
    const isFutureDate = date > todayIso();

    const sheet = students.map((s) => {
      const rec       = recordMap[s.studentId];
      const createdAt = rec?.createdAt ? new Date(rec.createdAt).getTime() : null;
      const isEditable = !isFutureDate && (!createdAt || now - createdAt <= HOURS_48_MS);

      return {
        studentId:    s.studentId,
        studentCode:  s.studentCode,
        fullName:     s.fullName,
        avatar:       s.avatar,
        attendanceId: rec?.attendanceId ?? null,
        typeId:       rec?.typeId       ?? null,
        typeName:     rec?.typeName     ?? null,
        note:         rec?.note         ?? "",
        isEditable,
        createdAt:    rec?.createdAt    ?? null,
      };
    });

    return res.json({
      success: true,
      data: {
        classId,
        className:      classInfo.className,
        gradeName:      classInfo.gradeName,
        date,
        attendanceTypes,
        students:       sheet,
        isSubmitted:    existingRecords.length > 0,
        submittedCount: existingRecords.length,
        totalStudents:  students.length,
      },
    });
  } catch (error) {
    console.error("getAttendanceSheet error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy bảng điểm danh" });
  }
}

// POST /teachers/classes/:classId/attendance
// Body: { date: "YYYY-MM-DD", records: [{ studentId, typeId, note? }] }
async function submitAttendance(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);
    const { date, records } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Ngày không hợp lệ (YYYY-MM-DD)" });
    }

    if (date > todayIso()) {
      return res.status(400).json({ success: false, message: "Không thể điểm danh cho ngày trong tương lai" });
    }

    await assertAttendanceDateEditable(date);

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách điểm danh không được rỗng" });
    }

    for (const r of records) {
      if (!r.studentId || !r.typeId) {
        return res.status(400).json({
          success: false,
          message: "Mỗi bản ghi cần có studentId và typeId",
        });
      }
    }

    const { profile, hasAccess } = await resolveTeacher(req.user.userId, classId);

    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền điểm danh lớp này" });
    }

    const toUpsert = records.map((r) => ({
      studentId: parseInt(r.studentId, 10),
      classId,
      date,
      typeId:    parseInt(r.typeId, 10),
      note:      r.note || null,
      createdBy: profile.userId,
    }));

    await attendanceModel.bulkUpsertAttendance(toUpsert);

    // Tự động kiểm tra ngưỡng nghỉ 36/45 sau mỗi lần lưu điểm danh.
    // Lỗi cảnh báo không làm hỏng thao tác điểm danh chính.
    try {
      await attendanceWarningService.evaluateStudents({
        studentIds: toUpsert.map((r) => r.studentId),
        attendanceDate: date,
        actorUserId: profile.userId,
      });
    } catch (warningErr) {
      console.error("automatic attendance threshold warning (non-critical):", warningErr);
    }

    // Notify parents of unexcused absent students (non-critical)
    try {
      const attendanceTypes = await attendanceModel.findAttendanceTypes();
      const unexcusedType   = attendanceTypes.find((t) => t.typeName === "ABSENT_UNEXCUSED");

      if (unexcusedType) {
        const absentStudentIds = toUpsert
          .filter((r) => r.typeId === unexcusedType.typeId)
          .map((r) => r.studentId);

        if (absentStudentIds.length > 0) {
          const [parents, students] = await Promise.all([
            attendanceModel.findStudentParentUserIds(absentStudentIds),
            attendanceModel.findEnrolledStudents(classId),
          ]);

          const studentMap = {};
          for (const s of students) studentMap[s.studentId] = s;

          const notifications = parents.map((p) => ({
            receiverId: p.parentUserId,
            relatedId:  p.studentId,
            title:      "Thông báo vắng không phép",
            content:    `${studentMap[p.studentId]?.fullName ?? "Học sinh"} vắng không phép ngày ${date}. Vui lòng liên hệ giáo viên chủ nhiệm.`,
          }));

          await attendanceModel.createAbsenceNotifications(notifications);
        }
      }
    } catch (notifErr) {
      console.error("createAbsenceNotifications (non-critical):", notifErr);
    }

    return res.json({ success: true, message: `Đã lưu điểm danh ${records.length} học sinh` });
  } catch (error) {
    console.error("submitAttendance error:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Không thể lưu điểm danh" });
  }
}

// PUT /teachers/attendance/:attendanceId
// Body: { typeId, note? }
async function updateAttendanceRecord(req, res) {
  try {
    const attendanceId = parseInt(req.params.attendanceId, 10);
    const { typeId, note } = req.body;

    if (!typeId) {
      return res.status(400).json({ success: false, message: "typeId là bắt buộc" });
    }

    const existing = await attendanceModel.findAttendanceRecordById(attendanceId);

    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bản ghi điểm danh" });
    }

    await assertAttendanceDateEditable(existing.attendanceDate);

    const { profile, hasAccess } = await resolveTeacher(req.user.userId, existing.classId);

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền chỉnh sửa điểm danh này" });
    }

    if (existing.timetableId) {
      const period = await attendanceModel.resolveEffectivePeriod(
        existing.timetableId,
        existing.attendanceDate,
      );
      if (!period) {
        return res.status(404).json({ success: false, message: "Không tìm thấy tiết học" });
      }
      if (period.cancelled) {
        return res.status(409).json({ success: false, message: "Tiết học này đã bị hủy" });
      }
      if (period.effectiveTeacherId !== profile.teacherId) {
        return res.status(403).json({ success: false, message: "Bạn không phụ trách tiết này" });
      }
      assertPeriodAttendanceWindow(period, existing.attendanceDate);
    }

    const affected = await attendanceModel.updateAttendanceRecord(
      attendanceId,
      parseInt(typeId, 10),
      note ?? null,
    );

    if (affected === 0) {
      return res.status(422).json({
        success: false,
        message: "Không thể cập nhật. Bản ghi đã vượt quá 48 giờ kể từ khi tạo (BR-ATT-01).",
      });
    }

    try {
      await attendanceWarningService.evaluateStudents({
        studentIds: [existing.studentId],
        attendanceDate: existing.attendanceDate,
        actorUserId: req.user.userId,
      });
    } catch (warningErr) {
      console.error("automatic attendance threshold warning after edit (non-critical):", warningErr);
    }

    return res.json({ success: true, message: "Cập nhật điểm danh thành công" });
  } catch (error) {
    console.error("updateAttendanceRecord error:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Không thể cập nhật điểm danh" });
  }
}

// ── PER-PERIOD attendance (điểm danh theo tiết) ───────────────────────────────

// GET /teachers/attendance/periods?date=YYYY-MM-DD — các tiết GV dạy trong ngày
async function getMyPeriods(req, res) {
  try {
    const date = req.query.date || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Định dạng ngày không hợp lệ (YYYY-MM-DD)" });
    }
    const profile = await teacherModel.findProfileByUserId(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const periods = await attendanceModel.findTeacherPeriods(profile.teacherId, date);
    return res.json({ success: true, data: { date, periods } });
  } catch (error) {
    console.error("getMyPeriods error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy danh sách tiết dạy" });
  }
}

// GET /teachers/attendance/periods/:timetableId?date=YYYY-MM-DD — sheet của 1 tiết
async function getPeriodSheet(req, res) {
  try {
    const timetableId = parseInt(req.params.timetableId, 10);
    const date = req.query.date || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Định dạng ngày không hợp lệ" });
    }
    const profile = await teacherModel.findProfileByUserId(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const period = await attendanceModel.resolveEffectivePeriod(timetableId, date);
    if (!period) return res.status(404).json({ success: false, message: "Không tìm thấy tiết học" });
    if (period.effectiveTeacherId !== profile.teacherId) {
      return res.status(403).json({ success: false, message: "Bạn không phụ trách tiết này" });
    }
    if (period.cancelled) return res.status(409).json({ success: false, message: "Tiết học này đã bị hủy" });

    const [students, existing, attendanceTypes, feedback] = await Promise.all([
      attendanceModel.findEnrolledStudents(period.classId),
      attendanceModel.findPeriodAttendance(timetableId, date),
      attendanceModel.findAttendanceTypes(),
      feedbackModel.findPeriodFeedback(timetableId, date),
    ]);

    const recMap = {};
    for (const r of existing) recMap[r.studentId] = r;
    const fbMap = {};
    for (const f of feedback) fbMap[f.studentId] = f;
    const now = Date.now();
    const isFutureDate = date > todayIso();
    const { opensAt, closesAt } = getPeriodAttendanceWindow(period, date);
    const isAttendanceOpen = Boolean(opensAt && closesAt && new Date() >= opensAt && new Date() <= closesAt);

    const sheet = students.map((s) => {
      const rec = recMap[s.studentId];
      const fb = fbMap[s.studentId];
      const createdAt = rec?.createdAt ? new Date(rec.createdAt).getTime() : null;
      return {
        studentId:    s.studentId,
        studentCode:  s.studentCode,
        fullName:     s.fullName,
        avatar:       s.avatar,
        attendanceId: rec?.attendanceId ?? null,
        typeId:       rec?.typeId ?? null,
        typeName:     rec?.typeName ?? null,
        note:         rec?.note ?? "",
        isEditable:   !isFutureDate && isAttendanceOpen && (!createdAt || now - createdAt <= HOURS_48_MS),
        createdAt:    rec?.createdAt ?? null,
        feedbackRating:  fb?.rating ?? null,
        feedbackContent: fb?.content ?? "",
      };
    });

    return res.json({
      success: true,
      data: {
        timetableId, date, period, attendanceTypes,
        attendanceWindow: {
          opensAt: opensAt ? opensAt.toISOString() : null,
          closesAt: closesAt ? closesAt.toISOString() : null,
          isOpen: isAttendanceOpen,
        },
        students: sheet,
        isSubmitted: existing.length > 0,
        submittedCount: existing.length,
        totalStudents: students.length,
      },
    });
  } catch (error) {
    console.error("getPeriodSheet error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy bảng điểm danh tiết" });
  }
}

// POST /teachers/attendance/periods/:timetableId  body: { date, records:[{studentId,typeId,note}] }
async function submitPeriodAttendance(req, res) {
  try {
    const timetableId = parseInt(req.params.timetableId, 10);
    const { date, records } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Ngày không hợp lệ (YYYY-MM-DD)" });
    }
    if (date > todayIso()) {
      return res.status(400).json({ success: false, message: "Không thể điểm danh cho ngày trong tương lai" });
    }

    await assertAttendanceDateEditable(date);
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách điểm danh không được rỗng" });
    }
    for (const r of records) {
      if (!r.studentId || !r.typeId) {
        return res.status(400).json({ success: false, message: "Mỗi bản ghi cần có studentId và typeId" });
      }
    }

    const profile = await teacherModel.findProfileByUserId(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const period = await attendanceModel.resolveEffectivePeriod(timetableId, date);
    if (!period) return res.status(404).json({ success: false, message: "Không tìm thấy tiết học" });
    if (period.effectiveTeacherId !== profile.teacherId) {
      return res.status(403).json({ success: false, message: "Bạn không phụ trách tiết này" });
    }
    if (period.cancelled) return res.status(409).json({ success: false, message: "Tiết học này đã bị hủy" });
    assertPeriodAttendanceWindow(period, date);

    const enrolledStudents = await attendanceModel.findEnrolledStudents(period.classId);
    const enrolledStudentIds = new Set(enrolledStudents.map((student) => Number(student.studentId)));
    const submittedStudentIds = new Set();

    const toUpsert = records.map((r) => ({
      studentId: parseInt(r.studentId, 10),
      typeId:    parseInt(r.typeId, 10),
      note:      r.note || null,
    }));

    for (const record of toUpsert) {
      if (!enrolledStudentIds.has(record.studentId)) {
        return res.status(403).json({
          success: false,
          message: "Danh sách điểm danh có học sinh không thuộc lớp của tiết học",
        });
      }

      if (submittedStudentIds.has(record.studentId)) {
        return res.status(400).json({
          success: false,
          message: "Danh sách điểm danh có học sinh bị trùng",
        });
      }
      submittedStudentIds.add(record.studentId);
    }

    await attendanceModel.bulkUpsertPeriodAttendance({
      timetableId, classId: period.classId, date, records: toUpsert, createdBy: profile.userId,
    });

    try {
      await attendanceWarningService.evaluateStudents({
        studentIds: toUpsert.map((r) => r.studentId),
        attendanceDate: date,
        actorUserId: profile.userId,
      });
    } catch (warningErr) {
      console.error("automatic period attendance threshold warning (non-critical):", warningErr);
    }

    // Notify parents of unexcused absentees (kèm môn + tiết)
    try {
      const attendanceTypes = await attendanceModel.findAttendanceTypes();
      const unexcusedType   = attendanceTypes.find((t) => t.typeName === "ABSENT_UNEXCUSED");
      if (unexcusedType) {
        const absentStudentIds = toUpsert.filter((r) => r.typeId === unexcusedType.typeId).map((r) => r.studentId);
        if (absentStudentIds.length > 0) {
          const [parents, students] = await Promise.all([
            attendanceModel.findStudentParentUserIds(absentStudentIds),
            attendanceModel.findEnrolledStudents(period.classId),
          ]);
          const studentMap = {};
          for (const s of students) studentMap[s.studentId] = s;
          const notifications = parents.map((p) => ({
            receiverId: p.parentUserId,
            relatedId:  p.studentId,
            title:      "Thông báo vắng không phép",
            content:    `${studentMap[p.studentId]?.fullName ?? "Học sinh"} vắng không phép tiết ${period.periodNo} môn ${period.subjectName} (lớp ${period.className}) ngày ${date}.`,
          }));
          await attendanceModel.createAbsenceNotifications(notifications);
        }
      }
    } catch (notifErr) {
      console.error("period absence notifications (non-critical):", notifErr);
    }

    return res.json({
      success: true,
      message: `Đã lưu điểm danh ${records.length} học sinh · ${period.subjectName} - ${period.className}`,
    });
  } catch (error) {
    console.error("submitPeriodAttendance error:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Không thể lưu điểm danh" });
  }
}

// POST /teachers/attendance/periods/:timetableId/feedback — GVBM nhận xét theo tiết
// body: { date, items: [{ studentId, rating, content }] }
const FEEDBACK_RATINGS = ["GOOD", "NORMAL", "NEEDS_IMPROVEMENT"];
async function submitPeriodFeedback(req, res) {
  try {
    const timetableId = Number.parseInt(req.params.timetableId, 10);
    const { date, items } = req.body;

    if (!Number.isInteger(timetableId) || timetableId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã tiết học không hợp lệ",
      });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Ngày không hợp lệ (YYYY-MM-DD)",
      });
    }

    const pad = (value) => String(value).padStart(2, "0");
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (date > today) {
      return res.status(400).json({
        success: false,
        message: "Không thể nhận xét cho ngày trong tương lai",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sách nhận xét không được rỗng",
      });
    }

    const profile = await teacherModel.findProfileByUserId(req.user.userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const period = await attendanceModel.resolveEffectivePeriod(timetableId, date);
    if (!period) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tiết học",
      });
    }

    if (period.effectiveTeacherId !== profile.teacherId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không phụ trách tiết này",
      });
    }

    if (period.cancelled) {
      return res.status(409).json({
        success: false,
        message: "Không thể nhận xét cho tiết học đã bị hủy",
      });
    }

    const enrolledStudents = await attendanceModel.findEnrolledStudents(
      period.classId,
    );
    const enrolledStudentIds = new Set(
      enrolledStudents.map((student) => Number(student.studentId)),
    );
    const submittedStudentIds = new Set();
    const clean = [];

    for (const item of items) {
      const studentId = Number.parseInt(item.studentId, 10);
      const rating = item.rating ? String(item.rating).trim() : null;
      const content = String(item.content || "").trim() || null;

      if (!Number.isInteger(studentId) || studentId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Mã học sinh trong danh sách nhận xét không hợp lệ",
        });
      }

      if (!enrolledStudentIds.has(studentId)) {
        return res.status(403).json({
          success: false,
          message: "Danh sách có học sinh không thuộc lớp của tiết học",
        });
      }

      if (submittedStudentIds.has(studentId)) {
        return res.status(400).json({
          success: false,
          message: "Danh sách nhận xét có học sinh bị trùng",
        });
      }
      submittedStudentIds.add(studentId);

      if (rating && !FEEDBACK_RATINGS.includes(rating)) {
        return res.status(400).json({
          success: false,
          message: "Mức nhận xét không hợp lệ",
        });
      }

      if (content && content.length > 2000) {
        return res.status(400).json({
          success: false,
          message: "Nội dung nhận xét không được vượt quá 2000 ký tự",
        });
      }

      if (rating || content) {
        clean.push({ studentId, rating, content });
      }
    }

    if (clean.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Chưa nhập nhận xét nào",
      });
    }

    await feedbackModel.bulkUpsertLessonFeedback({
      timetableId,
      teacherId: profile.teacherId,
      date,
      items: clean,
    });

    return res.json({
      success: true,
      message: `Đã lưu nhận xét ${clean.length} học sinh`,
    });
  } catch (error) {
    console.error("submitPeriodFeedback error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lưu nhận xét",
    });
  }
}

// ── GVCN: tổng hợp điểm danh lớp chủ nhiệm + ngưỡng nghỉ ──────────────────────

function buildAbsenceStudents(rows, policy) {
  const warnThreshold = policy.maxAbsentSessions * policy.warnRatio;
  const students = rows.map((r) => {
    const absentPeriods = r.absentUnexcused + (policy.countExcused ? r.absentExcused : 0);
    const absentSessions = Math.round((absentPeriods / policy.periodsPerSession) * 100) / 100;
    const level = absentSessions > policy.maxAbsentSessions ? "OVER"
      : absentSessions >= policy.maxAbsentSessions ? "LIMIT"
        : absentSessions >= warnThreshold ? "WARN" : "OK";
    return { ...r, absentPeriods, absentSessions, level };
  });
  return { students, warnThreshold };
}

// GET /teachers/attendance/overview?classId — GVCN xem tổng hợp toàn tiết/môn lớp CN
async function getClassOverview(req, res) {
  try {
    const classId = parseInt(req.query.classId, 10);
    if (!classId) return res.status(400).json({ success: false, message: "Thiếu lớp" });

    const { profile, classInfo, hasAccess } = await resolveTeacher(req.user.userId, classId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    if (!hasAccess || classInfo.roleInClass !== "HOMEROOM_TEACHER") {
      return res.status(403).json({ success: false, message: "Chỉ giáo viên chủ nhiệm mới xem tổng hợp điểm danh lớp này" });
    }

    const year = await attendanceModel.findActiveSchoolYear();
    if (!year) return res.status(404).json({ success: false, message: "Chưa có năm học đang hoạt động" });

    const policy = await attendanceModel.findAbsencePolicy(year.schoolYearId);
    const rows = await attendanceModel.findClassAttendanceOverview(classId, year.startDate, year.endDate);
    const { students, warnThreshold } = buildAbsenceStudents(rows, policy);

    return res.json({
      success: true,
      data: {
        class: { classId, className: classInfo.className, gradeName: classInfo.gradeName },
        schoolYear: year,
        policy,
        warnThreshold: Math.round(warnThreshold * 100) / 100,
        students,
        summary: {
          total: students.length,
          over:  students.filter((s) => s.level === "OVER").length,
          limit: students.filter((s) => s.level === "LIMIT").length,
          warn:  students.filter((s) => s.level === "WARN").length,
        },
      },
    });
  } catch (error) {
    console.error("getClassOverview error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy tổng hợp điểm danh" });
  }
}

// POST /teachers/attendance/warnings/generate  body: { classId } — GVCN quét cảnh báo nghỉ
async function generateAbsenceWarnings(req, res) {
  try {
    const classId = parseInt(req.body.classId, 10);
    if (!classId) return res.status(400).json({ success: false, message: "Thiếu lớp" });

    const { profile, classInfo, hasAccess } = await resolveTeacher(req.user.userId, classId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    if (!hasAccess || classInfo.roleInClass !== "HOMEROOM_TEACHER") {
      return res.status(403).json({ success: false, message: "Chỉ giáo viên chủ nhiệm mới tạo cảnh báo cho lớp này" });
    }

    const year = await attendanceModel.findActiveSchoolYear();
    if (!year) return res.status(404).json({ success: false, message: "Chưa có năm học đang hoạt động" });

    const students = await attendanceModel.findEnrolledStudents(classId);
    const results = await attendanceWarningService.evaluateStudents({
      studentIds: students.map((student) => student.studentId),
      attendanceDate: year.endDate,
      actorUserId: profile.userId,
    });
    const generated = results.filter((item) => item.level !== "OK").length;

    return res.json({
      success: true,
      message: `Đã kiểm tra ${students.length} học sinh; ${generated} học sinh đang ở mức cảnh báo trở lên.`,
      data: { generated },
    });
  } catch (error) {
    console.error("generateAbsenceWarnings error:", error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: "Không thể tạo cảnh báo nghỉ học" });
  }
}

// GET /teachers/classes/:classId/attendance/history
// Query: startDate, endDate, studentId, typeId, page, limit
async function getAttendanceHistory(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);

    const {
      startDate,
      endDate,
      studentId,
      typeId,
      page  = "1",
      limit = "20",
    } = req.query;

    const { profile, hasAccess } = await resolveTeacher(req.user.userId, classId);

    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xem lịch sử lớp này" });
    }

    const parsedPage  = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const { total, rows } = await attendanceModel.findClassAttendanceHistory(classId, {
      page:      parsedPage,
      limit:     parsedLimit,
      startDate,
      endDate,
      studentId,
      typeId,
    });

    return res.json({
      success: true,
      data: {
        items: rows,
        pagination: {
          total,
          page:       parsedPage,
          limit:      parsedLimit,
          totalPages: Math.ceil(total / parsedLimit),
        },
      },
    });
  } catch (error) {
    console.error("getAttendanceHistory error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy lịch sử điểm danh" });
  }
}

// GET /teachers/classes/:classId/attendance/analytics
// Query: startDate, endDate
async function getAttendanceAnalytics(req, res) {
  try {
    const classId = parseInt(req.params.classId, 10);

    const now          = new Date();
    const defaultEnd   = toIsoDate(now);
    const defaultStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));

    const startDate = req.query.startDate || defaultStart;
    const endDate   = req.query.endDate   || defaultEnd;

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return res.status(400).json({ success: false, message: "Định dạng ngày không hợp lệ" });
    }

    const { profile, classInfo, hasAccess } = await resolveTeacher(req.user.userId, classId);

    if (!profile) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xem thống kê lớp này" });
    }

    const { typeSummary, timeline, students } =
      await attendanceModel.findClassAttendanceAnalytics(classId, startDate, endDate);

    let totalRecords = 0;
    const rawByType  = {};

    for (const row of typeSummary) {
      const count       = Number(row.count);
      totalRecords     += count;
      rawByType[row.typeName] = count;
    }

    const ALL_TYPES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "EARLY_LEAVE"];
    const byType    = {};

    for (const t of ALL_TYPES) {
      const count = rawByType[t] || 0;
      byType[t]   = {
        count,
        rate: totalRecords > 0 ? Math.round((count / totalRecords) * 1000) / 10 : 0,
      };
    }

    const TYPE_KEY = {
      PRESENT:          "present",
      LATE:             "late",
      ABSENT_EXCUSED:   "absentExcused",
      ABSENT_UNEXCUSED: "absentUnexcused",
      EARLY_LEAVE:      "earlyLeave",
    };

    const timelineMap = {};
    for (const row of timeline) {
      if (!timelineMap[row.date]) {
        timelineMap[row.date] = {
          date: row.date, present: 0, late: 0,
          absentExcused: 0, absentUnexcused: 0, earlyLeave: 0, total: 0,
        };
      }
      const key   = TYPE_KEY[row.typeName];
      const count = Number(row.count);
      if (key) timelineMap[row.date][key] += count;
      timelineMap[row.date].total += count;
    }

    const studentSummary = students.map((s) => {
      const total   = Number(s.total);
      const present = Number(s.present);
      const late    = Number(s.late);
      return {
        studentId:       s.studentId,
        studentCode:     s.studentCode,
        fullName:        s.fullName,
        total,
        present,
        late,
        absentExcused:   Number(s.absentExcused),
        absentUnexcused: Number(s.absentUnexcused),
        earlyLeave:      Number(s.earlyLeave),
        attendanceRate:
          total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0,
      };
    });

    return res.json({
      success: true,
      data: {
        classId,
        className: classInfo.className,
        period:    { startDate, endDate },
        summary:   { totalRecords, byType },
        timeline:  Object.values(timelineMap),
        students:  studentSummary,
      },
    });
  } catch (error) {
    console.error("getAttendanceAnalytics error:", error);
    return res.status(500).json({ success: false, message: "Không thể lấy thống kê điểm danh" });
  }
}

module.exports = {
  getAttendanceSheet,
  submitAttendance,
  updateAttendanceRecord,
  getAttendanceHistory,
  getAttendanceAnalytics,
  getMyPeriods,
  getPeriodSheet,
  submitPeriodAttendance,
  submitPeriodFeedback,
  getClassOverview,
  generateAbsenceWarnings,
};
