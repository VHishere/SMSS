const teacherModel        = require("../models/teacher.model");
const studentProfileModel = require("../models/studentProfile.model");
const reportModel         = require("../models/report.model");
const reportService       = require("../services/report.service");
const excelService        = require("../services/excel.service");

const { REPORT_TYPES, REPORT_TITLES, ADMIN_ONLY_REPORT_TYPES } = reportService;

async function resolveTeacher(userId) {
  return teacherModel.findProfileByUserId(userId);
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

// Enforce that the teacher may access the requested scope.
async function assertAccess(teacherId, reportType, filters = {}) {
  if (ADMIN_ONLY_REPORT_TYPES.includes(reportType)) {
    const e = new Error("Bạn không có quyền tạo báo cáo này"); e.statusCode = 403; throw e;
  }
  if (reportType === "PROGRESS") {
    if (!filters.studentId) { const e = new Error("Cần chọn học sinh"); e.statusCode = 400; throw e; }
    const ok = await studentProfileModel.isTeacherForStudent(teacherId, parseInt(filters.studentId, 10));
    if (!ok) { const e = new Error("Bạn không phụ trách học sinh này"); e.statusCode = 403; throw e; }
  } else {
    if (!filters.classId) { const e = new Error("Cần chọn lớp"); e.statusCode = 400; throw e; }
    const ok = await studentProfileModel.isTeacherForClass(teacherId, parseInt(filters.classId, 10));
    if (!ok) { const e = new Error("Bạn không phụ trách lớp này"); e.statusCode = 403; throw e; }
  }
}

// GET /teachers/reports/meta
async function getMeta(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const [classes, semesters] = await Promise.all([
      studentProfileModel.findTeacherClasses(profile.teacherId),
      studentProfileModel.findSemesters(),
    ]);

    return res.json({
      success: true,
      data: {
        classes,
        semesters,
        reportTypes: REPORT_TYPES.filter((key) => !ADMIN_ONLY_REPORT_TYPES.includes(key)).map((key) => ({ key, label: REPORT_TITLES[key] })),
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

// POST /teachers/reports/generate  — on-screen preview (no log)
async function generate(req, res) {
  try {
    const { reportType, filters } = req.body;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    await assertAccess(profile.teacherId, reportType, filters);

    const dataset = await reportService.generate({ reportType, filters });
    return res.json({ success: true, data: dataset });
  } catch (error) {
    return handleError(res, error, "Không thể tạo báo cáo");
  }
}

// POST /teachers/reports/export-excel  — stream .xlsx + log
async function exportExcel(req, res) {
  try {
    const { reportType, filters } = req.body;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    await assertAccess(profile.teacherId, reportType, filters);

    const dataset = await reportService.generate({ reportType, filters });
    const buffer = await excelService.buildWorkbook(dataset);

    await reportModel.logReport({
      reportType,
      title: `${dataset.title} (Excel)`,
      parameters: filters,
      createdBy: req.user.userId,
      fileUrl: null,
    });

    const safeName = dataset.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return handleError(res, error, "Không thể xuất Excel");
  }
}

// POST /teachers/reports/log-export — record a client-side (PDF/print) export
async function logExport(req, res) {
  try {
    const { reportType, filters, format } = req.body;
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    await assertAccess(profile.teacherId, reportType, filters);

    await reportModel.logReport({
      reportType,
      title: `${REPORT_TITLES[reportType] ?? "Báo cáo"} (${(format || "PDF").toUpperCase()})`,
      parameters: filters,
      createdBy: req.user.userId,
      fileUrl: null,
    });
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, "Không thể ghi nhật ký xuất báo cáo");
  }
}

// GET /teachers/reports/history
async function getHistory(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const page  = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const { total, rows } = await reportModel.findReportHistory(req.user.userId, { page, limit });

    return res.json({
      success: true,
      data: { items: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy lịch sử báo cáo");
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

async function listTemplates(req, res) {
  try {
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });
    const templates = await reportModel.findTemplates(req.user.userId);
    return res.json({ success: true, data: templates });
  } catch (error) {
    return handleError(res, error, "Không thể lấy mẫu báo cáo");
  }
}

async function createTemplate(req, res) {
  try {
    const { name, reportType, config, schedule } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Tên mẫu là bắt buộc" });
    if (!REPORT_TYPES.includes(reportType)) return res.status(400).json({ success: false, message: "Loại báo cáo không hợp lệ" });
    if (schedule && !["NONE", "DAILY", "WEEKLY", "MONTHLY"].includes(schedule)) {
      return res.status(400).json({ success: false, message: "Lịch không hợp lệ" });
    }

    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const templateId = await reportModel.createTemplate({
      name: name.trim(), reportType, config: config ?? {}, schedule: schedule ?? "NONE", createdBy: req.user.userId,
    });
    return res.status(201).json({ success: true, message: "Đã lưu mẫu báo cáo", data: { templateId } });
  } catch (error) {
    return handleError(res, error, "Không thể lưu mẫu báo cáo");
  }
}

async function deleteTemplate(req, res) {
  try {
    const templateId = parseInt(req.params.templateId, 10);
    const tpl = await reportModel.findTemplateById(templateId);
    if (!tpl) return res.status(404).json({ success: false, message: "Không tìm thấy mẫu" });
    if (tpl.createdBy !== req.user.userId) return res.status(403).json({ success: false, message: "Bạn không có quyền xóa mẫu này" });

    await reportModel.deleteTemplate(templateId);
    return res.json({ success: true, message: "Đã xóa mẫu báo cáo" });
  } catch (error) {
    return handleError(res, error, "Không thể xóa mẫu báo cáo");
  }
}

// POST /teachers/reports/templates/:templateId/run — generate from saved config
async function runTemplate(req, res) {
  try {
    const templateId = parseInt(req.params.templateId, 10);
    const profile = await resolveTeacher(req.user.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const tpl = await reportModel.findTemplateById(templateId);
    if (!tpl) return res.status(404).json({ success: false, message: "Không tìm thấy mẫu" });
    if (tpl.createdBy !== req.user.userId) return res.status(403).json({ success: false, message: "Bạn không có quyền dùng mẫu này" });

    await assertAccess(profile.teacherId, tpl.reportType, tpl.config);

    const dataset = await reportService.generate({ reportType: tpl.reportType, filters: tpl.config });
    await reportModel.touchTemplateRun(templateId);

    return res.json({ success: true, data: dataset });
  } catch (error) {
    return handleError(res, error, "Không thể chạy mẫu báo cáo");
  }
}

// ── Admin (school-wide, view + export only, no saved templates) ────────────

// GET /admin/reports/meta — every class school-wide + semesters + report types
async function getMetaAdmin(_req, res) {
  try {
    const [classes, semesters] = await Promise.all([
      studentProfileModel.findAllClasses(),
      studentProfileModel.findSemesters(),
    ]);

    return res.json({
      success: true,
      data: {
        classes,
        semesters,
        reportTypes: REPORT_TYPES.map((key) => ({ key, label: REPORT_TITLES[key] })),
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy dữ liệu khởi tạo");
  }
}

// POST /admin/reports/generate — on-screen preview (no log)
async function generateAdmin(req, res) {
  try {
    const { reportType, filters } = req.body;
    const dataset = await reportService.generate({ reportType, filters });
    return res.json({ success: true, data: dataset });
  } catch (error) {
    return handleError(res, error, "Không thể tạo báo cáo");
  }
}

// POST /admin/reports/export-excel — stream .xlsx + log
async function exportExcelAdmin(req, res) {
  try {
    const { reportType, filters } = req.body;
    const dataset = await reportService.generate({ reportType, filters });
    const buffer = await excelService.buildWorkbook(dataset);

    await reportModel.logReport({
      reportType,
      title: `${dataset.title} (Excel)`,
      parameters: filters,
      createdBy: req.user.userId,
      fileUrl: null,
    });

    const safeName = dataset.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return handleError(res, error, "Không thể xuất Excel");
  }
}

// POST /admin/reports/log-export — record a client-side (PDF/print) export
async function logExportAdmin(req, res) {
  try {
    const { reportType, filters, format } = req.body;

    await reportModel.logReport({
      reportType,
      title: `${REPORT_TITLES[reportType] ?? "Báo cáo"} (${(format || "PDF").toUpperCase()})`,
      parameters: filters,
      createdBy: req.user.userId,
      fileUrl: null,
    });
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, "Không thể ghi nhật ký xuất báo cáo");
  }
}

// GET /admin/reports/history — the requesting admin's own export history
async function getHistoryAdmin(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const { total, rows } = await reportModel.findReportHistory(req.user.userId, { page, limit });

    return res.json({
      success: true,
      data: { items: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return handleError(res, error, "Không thể lấy lịch sử báo cáo");
  }
}

module.exports = {
  getMeta,
  generate,
  exportExcel,
  logExport,
  getHistory,
  listTemplates,
  createTemplate,
  deleteTemplate,
  runTemplate,
  getMetaAdmin,
  generateAdmin,
  exportExcelAdmin,
  logExportAdmin,
  getHistoryAdmin,
};
