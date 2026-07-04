const staffModel = require("../models/staff");

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Dữ liệu đã tồn tại (email, mã hoặc username trùng)",
    });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

async function getOverview(_req, res) {
  try {
    const data = await staffModel.getOverview();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải tổng quan");
  }
}

async function getLookups(_req, res) {
  try {
    const data = await staffModel.getLookups();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải dữ liệu tham chiếu");
  }
}

async function getStudents(req, res) {
  try {
    const data = await staffModel.listStudents(req.query.search || "");
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách học sinh");
  }
}

async function getStudentById(req, res) {
  try {
    const data = await staffModel.getStudentById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy học sinh",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết học sinh");
  }
}

async function createStudent(req, res) {
  try {
    const data = await staffModel.createStudent(req.body, req.user.userId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo học sinh");
  }
}

async function updateStudent(req, res) {
  try {
    const data = await staffModel.updateStudent(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật học sinh");
  }
}

async function getParents(req, res) {
  try {
    const data = await staffModel.listParents(req.query.search || "");
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách phụ huynh");
  }
}

async function getParentById(req, res) {
  try {
    const data = await staffModel.getParentById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phụ huynh",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết phụ huynh");
  }
}

async function createParent(req, res) {
  try {
    const data = await staffModel.createParent(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo phụ huynh");
  }
}

async function updateParent(req, res) {
  try {
    const data = await staffModel.updateParent(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật phụ huynh");
  }
}

async function getTeachers(req, res) {
  try {
    const data = await staffModel.listTeachers(req.query.search || "");
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách giáo viên");
  }
}

async function getTeacherById(req, res) {
  try {
    const data = await staffModel.getTeacherById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giáo viên",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết giáo viên");
  }
}

async function createTeacher(req, res) {
  try {
    const data = await staffModel.createTeacher(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo giáo viên");
  }
}

async function updateTeacher(req, res) {
  try {
    const data = await staffModel.updateTeacher(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật giáo viên");
  }
}

async function getSchoolYears(_req, res) {
  try {
    const data = await staffModel.listSchoolYears();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách năm học");
  }
}

async function createSchoolYear(req, res) {
  try {
    const data = await staffModel.createSchoolYear(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo năm học");
  }
}

async function activateSchoolYear(req, res) {
  try {
    const data = await staffModel.activateSchoolYear(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể kích hoạt năm học");
  }
}

async function updateSchoolYear(req, res) {
  try {
    const data = await staffModel.updateSchoolYear(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật năm học");
  }
}

async function getClasses(req, res) {
  try {
    const data = await staffModel.listClasses({
      schoolYearId: req.query.schoolYearId,
      gradeId: req.query.gradeId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách lớp học");
  }
}

async function getClassById(req, res) {
  try {
    const data = await staffModel.getClassById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lớp học",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết lớp học");
  }
}

async function createClass(req, res) {
  try {
    const data = await staffModel.createClass(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tạo lớp học");
  }
}

async function updateClass(req, res) {
  try {
    const data = await staffModel.updateClass(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật lớp học");
  }
}

async function enrollStudent(req, res) {
  try {
    const data = await staffModel.enrollStudent(
      req.params.id,
      req.body.studentId,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể thêm học sinh vào lớp");
  }
}

async function removeStudentFromClass(req, res) {
  try {
    const data = await staffModel.removeStudent(
      req.params.id,
      req.params.studentId,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể xóa học sinh khỏi lớp");
  }
}

async function assignTeacher(req, res) {
  try {
    const data = await staffModel.assignTeacher(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể phân công giáo viên");
  }
}

async function removeTeacher(req, res) {
  try {
    const data = await staffModel.removeTeacher(req.params.teacherClassId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể gỡ giáo viên khỏi lớp");
  }
}

async function getClassTimetable(req, res) {
  try {
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i thá»i khÃ³a biá»ƒu");
  }
}

async function createClassTimetableLesson(req, res) {
  try {
    await staffModel.createClassTimetableLesson(req.params.id, req.body);
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ thÃªm tiáº¿t há»c");
  }
}

async function updateClassTimetableLesson(req, res) {
  try {
    await staffModel.updateClassTimetableLesson(
      req.params.id,
      req.params.timetableId,
      req.body,
    );
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t tiáº¿t há»c");
  }
}

async function deleteClassTimetableLesson(req, res) {
  try {
    await staffModel.deleteClassTimetableLesson(
      req.params.id,
      req.params.timetableId,
    );
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ xÃ³a tiáº¿t há»c");
  }
}

async function getStaffActivities(req, res) {
  try {
    const data = await staffModel.listStaffActivities({
      schoolYearId: req.query.schoolYearId,
      gradeId: req.query.gradeId,
      classId: req.query.classId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải hoạt động ngoại khóa");
  }
}

async function createStaffActivity(req, res) {
  try {
    const data = await staffModel.createStaffActivity(
      req.body,
      req.user.userId,
    );
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể thêm hoạt động ngoại khóa");
  }
}

async function deleteStaffActivity(req, res) {
  try {
    await staffModel.deleteStaffActivity(req.params.eventId);
    return res.json({ success: true, message: "Đã xóa hoạt động ngoại khóa" });
  } catch (error) {
    return handleError(res, error, "Không thể xóa hoạt động ngoại khóa");
  }
}

async function getPromotionCandidates(req, res) {
  try {
    const data = await staffModel.getPromotionCandidates(
      req.query.fromSchoolYearId,
      req.query.fromGradeId,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách học sinh lên khối");
  }
}

async function getTargetClasses(req, res) {
  try {
    const data = await staffModel.getTargetClasses(
      req.query.toSchoolYearId,
      req.query.toGradeId,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải lớp đích");
  }
}

async function promoteStudents(req, res) {
  try {
    const data = await staffModel.promoteStudents(req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể chuyển học sinh lên khối");
  }
}

async function getCurriculum(req, res) {
  try {
    const data = await staffModel.listCurriculum({
      schoolYearId: req.query.schoolYearId,
      semesterId: req.query.semesterId,
      gradeId: req.query.gradeId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chương trình học");
  }
}

async function getCurriculumById(req, res) {
  try {
    const data = await staffModel.getCurriculumById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chương trình học",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết chương trình học");
  }
}

async function createCurriculumItem(req, res) {
  try {
    const data = await staffModel.addCurriculumItem(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể thêm môn vào chương trình");
  }
}

async function updateCurriculumItem(req, res) {
  try {
    const data = await staffModel.updateCurriculumItem(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật chương trình học");
  }
}

async function deleteCurriculumItem(req, res) {
  try {
    await staffModel.deleteCurriculumItem(req.params.id);
    return res.json({ success: true, message: "Đã xóa môn khỏi chương trình" });
  } catch (error) {
    return handleError(res, error, "Không thể xóa chương trình học");
  }
}

async function updateStudySession(req, res) {
  try {
    const data = await staffModel.updateStudySession(req.params.sessionId, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật buổi học");
  }
}

async function getYearSchedule(req, res) {
  try {
    const data = await staffModel.listYearSchedule({
      schoolYearId: req.query.schoolYearId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      month: req.query.month,
      entryType: req.query.entryType,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải lịch năm học");
  }
}

async function createYearScheduleEntry(req, res) {
  try {
    const data = await staffModel.createYearScheduleEntry(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể thêm lịch học");
  }
}

async function updateYearScheduleEntry(req, res) {
  try {
    const data = await staffModel.updateYearScheduleEntry(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật lịch học");
  }
}

async function deleteYearScheduleEntry(req, res) {
  try {
    await staffModel.deleteYearScheduleEntry(req.params.id);
    return res.json({ success: true, message: "Đã xóa lịch học" });
  } catch (error) {
    return handleError(res, error, "Không thể xóa lịch học");
  }
}

async function generateYearSchedule(req, res) {
  try {
    const data = await staffModel.generateYearScheduleFromCurriculum(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể sinh lịch từ chương trình");
  }
}

module.exports = {
  getOverview,
  getLookups,
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  getParents,
  getParentById,
  createParent,
  updateParent,
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  getSchoolYears,
  createSchoolYear,
  activateSchoolYear,
  updateSchoolYear,
  getClasses,
  getClassById,
  createClass,
  updateClass,
  enrollStudent,
  removeStudentFromClass,
  assignTeacher,
  removeTeacher,
  getClassTimetable,
  createClassTimetableLesson,
  updateClassTimetableLesson,
  deleteClassTimetableLesson,
  getStaffActivities,
  createStaffActivity,
  deleteStaffActivity,
  getPromotionCandidates,
  getTargetClasses,
  promoteStudents,
  getCurriculum,
  getCurriculumById,
  createCurriculumItem,
  updateCurriculumItem,
  deleteCurriculumItem,
  updateStudySession,
  getYearSchedule,
  createYearScheduleEntry,
  updateYearScheduleEntry,
  deleteYearScheduleEntry,
  generateYearSchedule,
};
