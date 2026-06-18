const staffModel = require("../models/staff");

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Dữ liệu đã tồn tại (email, mã HS hoặc username trùng)",
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
  getPromotionCandidates,
  getTargetClasses,
  promoteStudents,
};
