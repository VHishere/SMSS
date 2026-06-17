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

module.exports = { getMyProfile, getDashboardSummary };
