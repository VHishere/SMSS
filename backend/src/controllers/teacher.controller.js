const teacherModel = require("../models/teacher.model");

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

    const [alerts, school, pendingLeaveRequests] = await Promise.all([
      teacherModel.findStudentAlertFeed(profile.teacherId),
      teacherModel.findHomeroomAnnouncements(profile.teacherId),
      teacherModel.findPendingLeaveRequestCount(profile.teacherId),
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

    return res.json({
      success: true,
      data: {
        isHomeroom: true,
        counts: {
          total: school.length + alerts.length + system.length,
          newAlerts,
          unread: newAlerts + system.length,
        },
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

module.exports = { getMyProfile, getDashboardSummary, getNotifications };
