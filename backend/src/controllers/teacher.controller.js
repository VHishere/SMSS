const teacherModel = require("../models/teacher.model");
const notificationModel = require("../models/notification.model");

async function getMyProfile(req, res) {
  try {
    const profile = await teacherModel.findProfileByUserId(req.user.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ giáo viên",
      });
    }

    return res.json({ success: true, data: profile });
  } catch (error) {
    console.error("getMyProfile teacher error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy hồ sơ giáo viên",
    });
  }
}

async function getDashboardSummary(req, res) {
  try {
    const profile = await teacherModel.findProfileByUserId(req.user.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const primaryClass =
      profile.classes.find((c) => c.roleInClass === "HOMEROOM_TEACHER") ||
      profile.classes[0] ||
      null;

    if (!primaryClass) {
      return res.json({
        success: true,
        data: {
          teacher: {
            teacherId: profile.teacherId,
            teacherCode: profile.teacherCode,
            subjectSpecialize: profile.subjectSpecialize,
            fullName: profile.fullName,
            email: profile.email,
            phone: profile.phone,
            avatar: profile.avatar,
            classes: profile.classes,
          },
          primaryClass: null,
          todayAttendance: null,
          weeklyAttendance: [],
          pendingLeaveRequests: 0,
          atRiskStudents: [],
          parentEngagement: { total: 0, totalRead: 0, readRate: null },
        },
      });
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    const mondayStr = monday.toISOString().split("T")[0];

    const [
      todayAttendance,
      weeklyAttendance,
      pendingLeaveRequests,
      atRiskStudents,
      parentEngagement,
    ] = await Promise.all([
      teacherModel.findTodayAttendanceSummary(primaryClass.classId, todayStr),
      teacherModel.findWeeklyAttendance(primaryClass.classId, mondayStr, todayStr),
      teacherModel.findPendingLeaveRequestCount(profile.teacherId),
      teacherModel.findAtRiskStudents(primaryClass.classId),
      teacherModel.findParentEngagementRate(primaryClass.classId),
    ]);

    return res.json({
      success: true,
      data: {
        teacher: {
          teacherId: profile.teacherId,
          teacherCode: profile.teacherCode,
          subjectSpecialize: profile.subjectSpecialize,
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone,
          avatar: profile.avatar,
          classes: profile.classes,
        },
        primaryClass,
        todayAttendance: {
          ...todayAttendance,
          classId: primaryClass.classId,
          className: primaryClass.className,
        },
        weeklyAttendance,
        pendingLeaveRequests,
        atRiskStudents,
        parentEngagement,
      },
    });
  } catch (error) {
    console.error("getDashboardSummary teacher error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu dashboard",
    });
  }
}

// Trung tâm thông báo của GVCN — gộp dữ liệu THẬT từ 3 nguồn:
//  • school : thông báo đã phát hành tới lớp chủ nhiệm
//  • alerts : cảnh báo học lực / hạnh kiểm / chuyên cần của HS lớp chủ nhiệm
//  • system : việc cần xử lý (đơn xin nghỉ đang chờ duyệt)
async function getNotifications(req, res) {
  try {
    const profile = await teacherModel.findProfileByUserId(req.user.userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const isHomeroom = profile.classes.some(
      (c) => c.roleInClass === "HOMEROOM_TEACHER",
    );

    if (!isHomeroom) {
      return res.json({
        success: true,
        data: {
          isHomeroom: false,
          counts: { total: 0, newAlerts: 0, unread: 0 },
          school: [],
          alerts: [],
          system: [],
        },
      });
    }

    const [alerts, school, pendingLeaveRequests, readKeys] = await Promise.all([
      teacherModel.findStudentAlertFeed(profile.teacherId),
      teacherModel.findHomeroomAnnouncements(profile.teacherId),
      teacherModel.findPendingLeaveRequestCount(profile.teacherId),
      notificationModel.findReadFeedKeys(req.user.userId),
    ]);

    const system = [];
    if (pendingLeaveRequests > 0) {
      system.push({
        key: "LEAVE_PENDING",
        title: "Đơn xin nghỉ chờ duyệt",
        content: `Bạn có ${pendingLeaveRequests} đơn xin nghỉ phép của học sinh đang chờ phê duyệt.`,
        count: pendingLeaveRequests,
        actionType: "LEAVE_REQUESTS",
      });
    }

    const newAlerts = alerts.filter((a) => a.status === "OPEN").length;

    // Chưa đọc = mục còn phải xử lý VÀ chưa được đánh dấu đã đọc
    // (notification_read_state — bền theo tài khoản, không phụ thuộc trình duyệt).
    const readSet = new Set(readKeys);
    const unread =
      system.filter((t) => !readSet.has(`sys-${t.key}`)).length +
      alerts.filter((a) => a.status === "OPEN" && !readSet.has(`alert-${a.warningId}`)).length;

    return res.json({
      success: true,
      data: {
        isHomeroom: true,
        counts: {
          total: school.length + alerts.length + system.length,
          newAlerts,
          unread,
        },
        readKeys,
        school,
        alerts,
        system,
      },
    });
  } catch (error) {
    console.error("getNotifications teacher error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy dữ liệu thông báo",
    });
  }
}

// ── POST /teachers/notifications/read  body: { key } ─────────────────────────
// Đánh dấu 1 mục trong feed GVCN là đã đọc (ghi notification_read_state).
async function markNotificationRead(req, res) {
  try {
    const key = String(req.body?.key || "").trim();
    if (!key || key.length > 100) {
      return res.status(400).json({ success: false, message: "Khoá thông báo không hợp lệ" });
    }
    await notificationModel.markFeedKeyRead(req.user.userId, key);
    return res.json({ success: true });
  } catch (error) {
    console.error("teacher.markNotificationRead error:", error);
    return res.status(500).json({ success: false, message: "Không thể đánh dấu đã đọc" });
  }
}

module.exports = { getMyProfile, getDashboardSummary, getNotifications, markNotificationRead };
