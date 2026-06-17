const teacherModel    = require("../models/teacher.model");
const attendanceModel = require("../models/attendance.model");

const HOURS_48_MS = 48 * 60 * 60 * 1000;

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
    const date    = req.query.date || new Date().toISOString().split("T")[0];

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

    const sheet = students.map((s) => {
      const rec       = recordMap[s.studentId];
      const createdAt = rec?.createdAt ? new Date(rec.createdAt).getTime() : null;
      const isEditable = !createdAt || now - createdAt <= HOURS_48_MS;

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

    const { hasAccess } = await resolveTeacher(req.user.userId, existing.classId);

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền chỉnh sửa điểm danh này" });
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

    return res.json({ success: true, message: "Cập nhật điểm danh thành công" });
  } catch (error) {
    console.error("updateAttendanceRecord error:", error);
    return res.status(500).json({ success: false, message: "Không thể cập nhật điểm danh" });
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
    const defaultEnd   = now.toISOString().split("T")[0];
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

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
};
