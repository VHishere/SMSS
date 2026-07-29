const staffModel = require("../models/staff");
const feedbackModel = require("../models/feedback.model");

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Dá»¯ liá»‡u Ä‘Ã£ tá»“n táº¡i (email, mÃ£ hoáº·c username trÃ¹ng)",
    });
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
    details: error.details,
  });
}

async function getOverview(_req, res) {
  try {
    const data = await staffModel.getOverview();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i tá»•ng quan");
  }
}

async function getLookups(_req, res) {
  try {
    const data = await staffModel.getLookups();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i dá»¯ liá»‡u tham chiáº¿u");
  }
}

async function getStudents(req, res) {
  try {
    const data = await staffModel.listStudents({
      search: req.query.search || "",
      gradeId: req.query.gradeId,
      classId: req.query.classId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch há»c sinh");
  }
}

async function getStudentById(req, res) {
  try {
    const data = await staffModel.getStudentById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "KhÃ´ng tÃ¬m tháº¥y há»c sinh",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i chi tiáº¿t há»c sinh");
  }
}

async function createStudent(req, res) {
  try {
    const data = await staffModel.createStudent(req.body, req.user.userId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº¡o há»c sinh");
  }
}

async function updateStudent(req, res) {
  try {
    const data = await staffModel.updateStudent(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t há»c sinh");
  }
}

async function uploadStudentAvatar(req, res) {
  try {
    const avatarUrl = req.file?.cloudinaryUrl;

    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        message: "Chưa nhận được ảnh tải lên",
      });
    }

    const data = await staffModel.setStudentAvatar(req.params.id, avatarUrl);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể cập nhật ảnh học sinh");
  }
}

async function getParents(req, res) {
  try {
    const data = await staffModel.listParents({
      search: req.query.search || "",
      gradeId: req.query.gradeId,
      classId: req.query.classId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch phá»¥ huynh");
  }
}

async function getParentById(req, res) {
  try {
    const data = await staffModel.getParentById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "KhÃ´ng tÃ¬m tháº¥y phá»¥ huynh",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i chi tiáº¿t phá»¥ huynh");
  }
}

async function createParent(req, res) {
  try {
    const data = await staffModel.createParent(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº¡o phá»¥ huynh");
  }
}

async function updateParent(req, res) {
  try {
    const data = await staffModel.updateParent(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t phá»¥ huynh");
  }
}

async function getTeachers(req, res) {
  try {
    const data = await staffModel.listTeachers({
      search: req.query.search || "",
      gradeId: req.query.gradeId,
      classId: req.query.classId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch giÃ¡o viÃªn");
  }
}

async function getTeacherById(req, res) {
  try {
    const data = await staffModel.getTeacherById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "KhÃ´ng tÃ¬m tháº¥y giÃ¡o viÃªn",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i chi tiáº¿t giÃ¡o viÃªn");
  }
}

async function createTeacher(req, res) {
  try {
    const data = await staffModel.createTeacher(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº¡o giÃ¡o viÃªn");
  }
}

async function updateTeacher(req, res) {
  try {
    const data = await staffModel.updateTeacher(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t giÃ¡o viÃªn");
  }
}

async function getSchoolYears(_req, res) {
  try {
    const data = await staffModel.listSchoolYears();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch nÄƒm há»c");
  }
}

async function createSchoolYear(req, res) {
  try {
    const data = await staffModel.createSchoolYear(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº¡o nÄƒm há»c");
  }
}

async function activateSchoolYear(req, res) {
  try {
    const data = await staffModel.activateSchoolYear(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ kÃ­ch hoáº¡t nÄƒm há»c");
  }
}

async function updateSchoolYear(req, res) {
  try {
    const data = await staffModel.updateSchoolYear(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t nÄƒm há»c");
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
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch lá»›p há»c");
  }
}

async function getClassById(req, res) {
  try {
    const data = await staffModel.getClassById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "KhÃ´ng tÃ¬m tháº¥y lá»›p há»c",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i chi tiáº¿t lá»›p há»c");
  }
}

async function createClass(req, res) {
  try {
    const data = await staffModel.createClass(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº¡o lá»›p há»c");
  }
}

async function updateClass(req, res) {
  try {
    const data = await staffModel.updateClass(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t lá»›p há»c");
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
    return handleError(res, error, "KhÃ´ng thá»ƒ thÃªm há»c sinh vÃ o lá»›p");
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
    return handleError(res, error, "KhÃ´ng thá»ƒ xÃ³a há»c sinh khá»i lá»›p");
  }
}

async function assignTeacher(req, res) {
  try {
    const data = await staffModel.assignTeacher(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ phÃ¢n cÃ´ng giÃ¡o viÃªn");
  }
}

async function removeTeacher(req, res) {
  try {
    const data = await staffModel.removeTeacher(req.params.teacherClassId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ gá»¡ giÃ¡o viÃªn khá»i lá»›p");
  }
}

async function getClassTimetable(req, res) {
  try {
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃƒÂ´ng thÃ¡Â»Æ’ tÃ¡ÂºÂ£i thÃ¡Â»Âi khÃƒÂ³a biÃ¡Â»Æ’u");
  }
}

async function createClassTimetableLesson(req, res) {
  try {
    await staffModel.createClassTimetableLesson(req.params.id, req.body);
    const data = await staffModel.listClassTimetable(req.params.id);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃƒÂ´ng thÃ¡Â»Æ’ thÃƒÂªm tiÃ¡ÂºÂ¿t hÃ¡Â»Âc");
  }
}

async function createTimetableLessons(req, res) {
  try {
    const data = await staffModel.createTimetableLessons(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ thÃªm lá»‹ch há»c");
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
    return handleError(res, error, "KhÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t tiÃ¡ÂºÂ¿t hÃ¡Â»Âc");
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
    return handleError(res, error, "KhÃƒÂ´ng thÃ¡Â»Æ’ xÃƒÂ³a tiÃ¡ÂºÂ¿t hÃ¡Â»Âc");
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
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i chÆ°Æ¡ng trÃ¬nh há»c");
  }
}

async function getCurriculumById(req, res) {
  try {
    const data = await staffModel.getCurriculumById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "KhÃ´ng tÃ¬m tháº¥y chÆ°Æ¡ng trÃ¬nh há»c",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i chi tiáº¿t chÆ°Æ¡ng trÃ¬nh há»c");
  }
}

async function createCurriculumItem(req, res) {
  try {
    const data = await staffModel.addCurriculumItem(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ thÃªm mÃ´n vÃ o chÆ°Æ¡ng trÃ¬nh");
  }
}

async function updateCurriculumItem(req, res) {
  try {
    const data = await staffModel.updateCurriculumItem(req.params.id, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t chÆ°Æ¡ng trÃ¬nh há»c");
  }
}

async function deleteCurriculumItem(req, res) {
  try {
    await staffModel.deleteCurriculumItem(req.params.id);
    return res.json({ success: true, message: "ÄÃ£ xÃ³a mÃ´n khá»i chÆ°Æ¡ng trÃ¬nh" });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ xÃ³a chÆ°Æ¡ng trÃ¬nh há»c");
  }
}

async function updateStudySession(req, res) {
  try {
    const data = await staffModel.updateStudySession(req.params.sessionId, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t buá»•i há»c");
  }
}

async function getFeePlans(req, res) {
  try {
    const data = await staffModel.listFeePlans({
      schoolYearId: req.query.schoolYearId,
      status: req.query.status,
      search: req.query.search || "",
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i danh sÃ¡ch há»c phÃ­");
  }
}

async function getFeePlanById(req, res) {
  try {
    await staffModel.refreshFeeAssignmentStatuses(req.params.id);
    const data = await staffModel.getFeePlanById(req.params.id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "KhÃ´ng tÃ¬m tháº¥y khoáº£n há»c phÃ­",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº£i chi tiáº¿t há»c phÃ­");
  }
}

async function createFeePlan(req, res) {
  try {
    const data = await staffModel.createFeePlan(req.body, req.user.userId);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ táº¡o khoáº£n há»c phÃ­");
  }
}

async function updateFeePlanStatus(req, res) {
  try {
    const data = await staffModel.updateFeePlanStatus(
      req.params.id,
      req.body.status,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ cáº­p nháº­t tráº¡ng thÃ¡i há»c phÃ­");
  }
}

async function recordFeePayment(req, res) {
  try {
    const data = await staffModel.recordFeePayment(
      req.params.id,
      req.params.assignmentId,
      req.body,
      req.user.userId,
    );
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "KhÃ´ng thá»ƒ ghi nháº­n thanh toÃ¡n");
  }
}

// ── Khảo sát đánh giá giáo viên (HS → GV, ẩn danh) ────────────────────────────

async function listTeacherSurveys(req, res) {
  try {
    const data = await feedbackModel.findSurveysForStaff();
    return res.json({ success: true, data });
  } catch (error) { return handleError(res, error, "Không thể lấy danh sách khảo sát"); }
}

async function createTeacherSurvey(req, res) {
  try {
    const { semesterId, teacherId, subjectId, classId, title } = req.body;
    if (!semesterId || !teacherId) {
      return res.status(400).json({ success: false, message: "Thiếu học kỳ hoặc giáo viên" });
    }
    const surveyId = await feedbackModel.createSurvey({
      semesterId, teacherId, subjectId: subjectId || null, classId: classId || null,
      title: title || null, createdBy: req.user.userId,
    });
    return res.status(201).json({ success: true, message: "Đã tạo khảo sát", data: { surveyId } });
  } catch (error) { return handleError(res, error, "Không thể tạo khảo sát"); }
}

async function closeTeacherSurvey(req, res) {
  try {
    await feedbackModel.setSurveyStatus(parseInt(req.params.id, 10), "CLOSED");
    return res.json({ success: true, message: "Đã đóng khảo sát" });
  } catch (error) { return handleError(res, error, "Không thể đóng khảo sát"); }
}

async function getTeacherSurveyAggregate(req, res) {
  try {
    const data = await feedbackModel.findSurveyAggregate(parseInt(req.params.id, 10));
    return res.json({ success: true, data });
  } catch (error) { return handleError(res, error, "Không thể lấy tổng hợp khảo sát"); }
}

module.exports = {
  getOverview,
  getLookups,
  listTeacherSurveys,
  createTeacherSurvey,
  closeTeacherSurvey,
  getTeacherSurveyAggregate,
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  uploadStudentAvatar,
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
  createTimetableLessons,
  updateClassTimetableLesson,
  deleteClassTimetableLesson,
  getCurriculum,
  getCurriculumById,
  createCurriculumItem,
  updateCurriculumItem,
  deleteCurriculumItem,
  updateStudySession,
  getFeePlans,
  getFeePlanById,
  createFeePlan,
  updateFeePlanStatus,
  recordFeePayment,
};
