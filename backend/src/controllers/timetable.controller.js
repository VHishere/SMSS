const timetableModel = require(
  "../models/timetable.model",
);

const {
  TIMETABLE_SLOTS,
  WEEK_DAYS,
} = require("../config/timetable.config");

async function getMyTimetable(req, res) {
  try {
    const context =
      await timetableModel.findCurrentStudentContext(
        req.user.userId,
      );

    if (!context) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy lớp học hiện tại của học sinh",
      });
    }

    const lessons =
      await timetableModel.findLessonsByClassId(
        context.classId,
      );

    return res.json({
      success: true,

      data: {
        context,
        weekDays: WEEK_DAYS,
        slots: TIMETABLE_SLOTS,
        lessons,
      },
    });
  } catch (error) {
    console.error(
      "getMyTimetable error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể tải thời khóa biểu",
    });
  }
}

module.exports = {
  getMyTimetable,
};