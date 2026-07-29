// =============================================================================
// Controller Giáo viên Quản nhiệm (GVQN / DORM_SUPERVISOR)
// Mọi endpoint: resolve GVQN từ req.user.userId → scope theo supervisor_area.
// =============================================================================
const model = require("../models/supervisor.model");
const supportCaseModel = require("../models/supportCase.model");

const VALID_SHIFTS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"];
const VALID_TYPE_IDS = [1, 2, 3, 4, 5]; // attendance_type: PRESENT/LATE/EXCUSED/UNEXCUSED/EARLY_LEAVE

function currentShift() {
  const h = new Date().getHours();
  if (h >= 6 && h < 13) return "MORNING";
  if (h >= 13 && h < 18) return "AFTERNOON";
  if (h >= 18 && h < 22) return "EVENING";
  return "NIGHT";
}

// Resolve GVQN; trả 403 nếu user không phải quản nhiệm có hồ sơ.
async function resolve(req, res) {
  const sup = await model.findByUserId(req.user.userId);
  if (!sup) {
    res.status(403).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên quản nhiệm" });
    return null;
  }
  const areaIds = await model.findAreaIds(sup.supervisorId);
  return { sup, areaIds };
}

// ── GET /supervisor/dashboard ────────────────────────────────────────────────
async function getDashboard(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const { sup, areaIds } = ctx;
    const date = await model.dbToday();
    const [stats, tasks, activity, leaveApprovals] = await Promise.all([
      model.findDashboardStats(areaIds),
      model.findTasks(sup.supervisorId, date),
      model.findRecentActivity(sup.supervisorId, areaIds),
      model.findLeaveApprovals(areaIds, { limit: 6 }),
    ]);
    return res.json({
      success: true,
      data: {
        supervisor: { fullName: sup.fullName, avatar: sup.avatar },
        shift: currentShift(),
        stats,
        tasks,
        activity,
        leaveApprovals,
      },
    });
  } catch (error) {
    console.error("supervisor.getDashboard error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải dashboard quản nhiệm" });
  }
}

// ── GET /supervisor/areas ────────────────────────────────────────────────────
async function getAreas(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const [summary, areas] = await Promise.all([
      model.findAreaSummary(ctx.areaIds),
      model.findAreas(ctx.sup.supervisorId),
    ]);
    return res.json({ success: true, data: { summary, areas } });
  } catch (error) {
    console.error("supervisor.getAreas error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải danh sách khu" });
  }
}

// ── GET /supervisor/attendance ───────────────────────────────────────────────
// query: areaId (bắt buộc), date?, roomId?, floor?, q?
async function getAttendance(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const areaId = Number(req.query.areaId) || ctx.areaIds[0];
    if (!areaId) return res.json({ success: true, data: { areaId: null, rooms: [], roster: [], summary: null } });
    if (!(await model.ownsArea(ctx.sup.supervisorId, areaId))) {
      return res.status(403).json({ success: false, message: "Khu không thuộc quyền quản lý của bạn" });
    }
    const date = req.query.date || (await model.dbToday());
    const [rooms, roster, summary] = await Promise.all([
      model.findRooms(areaId),
      model.findAttendanceRoster(areaId, {
        date,
        roomId: req.query.roomId ? Number(req.query.roomId) : null,
        floor: req.query.floor ? Number(req.query.floor) : null,
        q: req.query.q || null,
      }),
      model.findAttendanceSummary([areaId], date),
    ]);
    return res.json({ success: true, data: { areaId, date, rooms, roster, summary } });
  } catch (error) {
    console.error("supervisor.getAttendance error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải điểm danh nội trú" });
  }
}

// ── POST /supervisor/attendance/bulk ─────────────────────────────────────────
// body: { areaId, date?, records: [{ studentId, typeId }] }  → 1 API call
async function submitBulkAttendance(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const { areaId, records } = req.body || {};
    const date = req.body?.date || (await model.dbToday());
    if (!areaId || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "Thiếu areaId hoặc danh sách điểm danh" });
    }
    if (!(await model.ownsArea(ctx.sup.supervisorId, Number(areaId)))) {
      return res.status(403).json({ success: false, message: "Khu không thuộc quyền quản lý của bạn" });
    }
    const bad = records.find(
      (r) => !r.studentId || !VALID_TYPE_IDS.includes(Number(r.typeId)),
    );
    if (bad) {
      return res.status(400).json({ success: false, message: "Bản ghi điểm danh không hợp lệ" });
    }
    const clean = records.map((r) => ({ studentId: Number(r.studentId), typeId: Number(r.typeId) }));
    const n = await model.bulkUpsertAttendance(ctx.sup.userId, { areaId: Number(areaId), date, records: clean });
    const summary = await model.findAttendanceSummary([Number(areaId)], date);
    return res.json({ success: true, data: { updated: n, summary } });
  } catch (error) {
    console.error("supervisor.submitBulkAttendance error:", error);
    return res.status(500).json({ success: false, message: "Không thể lưu điểm danh" });
  }
}

// ── GET /supervisor/logbook ──────────────────────────────────────────────────
// query: date?, shift?
async function getLogbook(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const date = req.query.date || (await model.dbToday());
    const shift = VALID_SHIFTS.includes(req.query.shift) ? req.query.shift : currentShift();
    const [entries, previous, stats] = await Promise.all([
      model.findLogbook(ctx.sup.supervisorId, { date, shift }),
      model.findPreviousLogs(ctx.sup.supervisorId, { limit: 6 }),
      model.findLogbookStats(ctx.sup.supervisorId, ctx.areaIds, date, shift),
    ]);
    return res.json({ success: true, data: { date, shift, entries, previous, stats } });
  } catch (error) {
    console.error("supervisor.getLogbook error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải sổ trực" });
  }
}

// ── POST /supervisor/logbook ─────────────────────────────────────────────────
// body: { areaId, shift, eventType?, title, content }
async function createLogEntry(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const { areaId, shift, eventType, title, content } = req.body || {};
    if (!areaId || !VALID_SHIFTS.includes(shift) || !content) {
      return res.status(400).json({ success: false, message: "Thiếu khu, ca trực hoặc nội dung" });
    }
    if (!(await model.ownsArea(ctx.sup.supervisorId, Number(areaId)))) {
      return res.status(403).json({ success: false, message: "Khu không thuộc quyền quản lý của bạn" });
    }
    const logId = await model.createLog(ctx.sup.supervisorId, ctx.sup.userId, {
      areaId: Number(areaId), shift, eventType, title, content,
    });
    return res.status(201).json({ success: true, data: { logId } });
  } catch (error) {
    console.error("supervisor.createLogEntry error:", error);
    return res.status(500).json({ success: false, message: "Không thể ghi sổ trực" });
  }
}

// ── Duyệt nghỉ 2 cấp ─────────────────────────────────────────────────────────
async function getLeaveRequests(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const list = await model.findLeaveRequests(ctx.areaIds);
    return res.json({ success: true, data: { requests: list } });
  } catch (error) {
    console.error("supervisor.getLeaveRequests error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải danh sách đơn nghỉ" });
  }
}

async function decideLeaveRequest(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const id = Number(req.params.id);
    const action = req.body?.action;
    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ success: false, message: "Hành động không hợp lệ" });
    }
    const lr = await model.findLeaveRequestScoped(id, ctx.areaIds);
    if (!lr) {
      return res.status(403).json({ success: false, message: "Đơn không thuộc khu bạn phụ trách" });
    }
    if (lr.status === "CANCELLED") {
      return res.status(400).json({ success: false, message: "Đơn đã bị huỷ" });
    }
    if (lr.gvcnAction !== "APPROVE") {
      return res.status(400).json({ success: false, message: "Đơn chưa được GVCN duyệt — chưa thể xử lý cấp quản nhiệm" });
    }
    if (lr.gvqnAction) {
      return res.status(400).json({ success: false, message: "Đơn đã được quản nhiệm xử lý" });
    }
    await model.decideLeaveByGvqn(ctx.sup.userId, id, action, req.body?.comment);
    return res.json({ success: true });
  } catch (error) {
    console.error("supervisor.decideLeaveRequest error:", error);
    return res.status(500).json({ success: false, message: "Không thể xử lý đơn nghỉ" });
  }
}

// ── Đăng ký cuối tuần ────────────────────────────────────────────────────────
async function getWeekend(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const weekendDate = req.query.date || (await model.dbUpcomingSaturday());
    const list = await model.findWeekendRegistrations(ctx.areaIds, weekendDate);
    const summary = {
      goHome: list.filter((x) => x.regType === "GO_HOME").length,
      stay: list.filter((x) => x.regType === "STAY").length,
      confirmed: list.filter((x) => x.status === "CONFIRMED").length,
      pending: list.filter((x) => x.status === "PENDING").length,
      total: list.length,
    };
    return res.json({ success: true, data: { weekendDate, summary, registrations: list } });
  } catch (error) {
    console.error("supervisor.getWeekend error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải đăng ký cuối tuần" });
  }
}

async function setWeekendStatus(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const status = req.body?.status;
    if (!["CONFIRMED", "REJECTED", "PENDING"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }
    const ok = await model.setWeekendStatus(ctx.areaIds, Number(req.params.id), status);
    if (!ok) return res.status(403).json({ success: false, message: "Đăng ký không thuộc khu bạn phụ trách" });
    return res.json({ success: true });
  } catch (error) {
    console.error("supervisor.setWeekendStatus error:", error);
    return res.status(500).json({ success: false, message: "Không thể cập nhật đăng ký" });
  }
}

// ── Hỗ trợ học sinh (UC-42, scope theo khu) ──────────────────────────────────
const CASE_CATEGORIES = ["ACADEMIC", "BEHAVIOUR", "ATTENDANCE", "PSYCHOLOGICAL", "FAMILY", "OTHER"];
const CASE_SEVERITIES = ["LOW", "MEDIUM", "HIGH"];

async function getSupport(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const [cases, students] = await Promise.all([
      model.findSupportCases(ctx.areaIds, { status: req.query.status || null }),
      model.findAreaStudents(ctx.areaIds),
    ]);
    const stats = {
      open: cases.filter((c) => c.status === "OPEN").length,
      monitoring: cases.filter((c) => c.status === "MONITORING").length,
      resolved: cases.filter((c) => c.status === "RESOLVED").length,
      total: cases.length,
    };
    return res.json({ success: true, data: { cases, students, stats } });
  } catch (error) {
    console.error("supervisor.getSupport error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải danh sách hỗ trợ" });
  }
}

async function createSupport(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const { studentId, category, severity, title, description } = req.body || {};
    if (!studentId || !title || !CASE_CATEGORIES.includes(category) || !CASE_SEVERITIES.includes(severity)) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin ca hỗ trợ hoặc không hợp lệ" });
    }
    if (!(await model.studentInArea(ctx.areaIds, Number(studentId)))) {
      return res.status(403).json({ success: false, message: "Học sinh không thuộc khu bạn phụ trách" });
    }
    const caseId = await supportCaseModel.createCase({
      studentId: Number(studentId), category, severity, title,
      description: description || null, openedBy: ctx.sup.userId,
    });
    return res.status(201).json({ success: true, data: { caseId } });
  } catch (error) {
    console.error("supervisor.createSupport error:", error);
    return res.status(500).json({ success: false, message: "Không thể tạo ca hỗ trợ" });
  }
}

// ── Liên lạc: danh bạ phụ huynh HS trong khu (UC-57) ─────────────────────────
async function getContacts(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const contacts = await model.findAreaContacts(ctx.areaIds);
    return res.json({ success: true, data: { contacts } });
  } catch (error) {
    console.error("supervisor.getContacts error:", error);
    return res.status(500).json({ success: false, message: "Không thể tải danh bạ liên lạc" });
  }
}

// ── Tasks (việc cần làm trong ca) ────────────────────────────────────────────
async function createTask(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const { title, note, shift, dueTime, areaId } = req.body || {};
    if (!title) return res.status(400).json({ success: false, message: "Thiếu tiêu đề công việc" });
    if (areaId && !(await model.ownsArea(ctx.sup.supervisorId, Number(areaId)))) {
      return res.status(403).json({ success: false, message: "Khu không thuộc quyền quản lý của bạn" });
    }
    const taskId = await model.createTask(ctx.sup.supervisorId, ctx.sup.userId, { title, note, shift, dueTime, areaId });
    return res.status(201).json({ success: true, data: { taskId } });
  } catch (error) {
    console.error("supervisor.createTask error:", error);
    return res.status(500).json({ success: false, message: "Không thể tạo công việc" });
  }
}

async function updateTaskStatus(req, res) {
  try {
    const ctx = await resolve(req, res);
    if (!ctx) return;
    const status = req.body?.status;
    if (!["PENDING", "DONE"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }
    const ok = await model.setTaskStatus(ctx.sup.supervisorId, Number(req.params.taskId), status);
    if (!ok) return res.status(404).json({ success: false, message: "Không tìm thấy công việc" });
    return res.json({ success: true });
  } catch (error) {
    console.error("supervisor.updateTaskStatus error:", error);
    return res.status(500).json({ success: false, message: "Không thể cập nhật công việc" });
  }
}

module.exports = {
  getDashboard,
  getAreas,
  getAttendance,
  submitBulkAttendance,
  getLogbook,
  createLogEntry,
  getLeaveRequests,
  decideLeaveRequest,
  getWeekend,
  setWeekendStatus,
  getSupport,
  createSupport,
  getContacts,
  createTask,
  updateTaskStatus,
};
