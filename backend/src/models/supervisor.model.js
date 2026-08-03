// =============================================================================
// Model Giáo viên Quản nhiệm (GVQN / DORM_SUPERVISOR)
// -----------------------------------------------------------------------------
// MỌI hàm scope dữ liệu theo (các) khu được gán cho GVQN trong supervisor_area.
// Không bao giờ trả dữ liệu khu không thuộc GVQN đang đăng nhập.
// =============================================================================
const { pool } = require("../config/db");

const SHIFTS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"];

// "Hôm nay" theo GIỜ SERVER (khớp CURDATE() dùng trong seed + các query),
// tránh lệch ngày do JS toISOString() trả theo UTC.
async function dbToday() {
  const [[r]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
  return r.d;
}

// ── Danh tính + phạm vi khu ─────────────────────────────────────────────────
async function findByUserId(userId) {
  const [[row]] = await pool.query(
    `SELECT ds.supervisor_id AS supervisorId, ds.user_id AS userId, ds.phone,
            ua.full_name AS fullName, ua.avatar
     FROM dorm_supervisor ds
     JOIN user_account ua ON ua.user_id = ds.user_id
     WHERE ds.user_id = ?`,
    [userId],
  );
  return row || null;
}

async function findAreaIds(supervisorId) {
  const [rows] = await pool.query(
    `SELECT area_id FROM supervisor_area WHERE supervisor_id = ? AND status = 'ACTIVE'`,
    [supervisorId],
  );
  return rows.map((r) => r.area_id);
}

// Xác nhận 1 khu thuộc GVQN (chống truy cập khu người khác)
async function ownsArea(supervisorId, areaId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM supervisor_area WHERE supervisor_id = ? AND area_id = ?`,
    [supervisorId, areaId],
  );
  return Boolean(row);
}

// ── Dashboard ────────────────────────────────────────────────────────────────
async function findDashboardStats(areaIds) {
  if (!areaIds.length) {
    return { areaCount: 0, attendanceRate: null, absentCount: 0, newViolations: 0 };
  }
  const ph = areaIds.map(() => "?").join(",");
  const [[att]] = await pool.query(
    `SELECT COUNT(*) total,
            SUM(attendance_type_id = 1) present,
            SUM(attendance_type_id IN (3, 4)) absent
     FROM attendance
     WHERE area_id IN (${ph}) AND attendance_context = 'DORM' AND attendance_date = CURDATE()`,
    areaIds,
  );
  const [[vio]] = await pool.query(
    `SELECT COUNT(DISTINCT br.behavior_id) c
     FROM behavior_record br
     JOIN student_area sa ON sa.student_id = br.student_id AND sa.area_id IN (${ph})
     WHERE br.behavior_type = 'VIOLATION'
       AND br.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    areaIds,
  );
  return {
    areaCount: areaIds.length,
    attendanceRate: att.total ? Math.round((att.present / att.total) * 100) : null,
    absentCount: Number(att.absent || 0),
    newViolations: Number(vio.c || 0),
  };
}

async function findTasks(supervisorId, date) {
  const [rows] = await pool.query(
    `SELECT task_id AS taskId, title, note, shift,
            DATE_FORMAT(due_time, '%H:%i') AS dueTime, status,
            DATE_FORMAT(completed_at, '%H:%i') AS completedAt
     FROM supervision_task
     WHERE supervisor_id = ? AND task_date = ?
     ORDER BY (status = 'DONE'), due_time`,
    [supervisorId, date],
  );
  return rows;
}

async function createTask(supervisorId, userId, { title, note, shift, dueTime, areaId }) {
  const [r] = await pool.query(
    `INSERT INTO supervision_task (supervisor_id, area_id, shift, task_date, title, note, due_time, created_by)
     VALUES (?,?,?,CURDATE(),?,?,?,?)`,
    [supervisorId, areaId || null, shift || null, title, note || null, dueTime || null, userId],
  );
  return r.insertId;
}

async function setTaskStatus(supervisorId, taskId, status) {
  const [r] = await pool.query(
    `UPDATE supervision_task
     SET status = ?, completed_at = ${status === "DONE" ? "NOW()" : "NULL"}
     WHERE task_id = ? AND supervisor_id = ?`,
    [status, taskId, supervisorId],
  );
  return r.affectedRows > 0;
}

// Feed hoạt động gần đây (gộp: duyệt nghỉ + vi phạm + bàn giao sổ trực)
async function findRecentActivity(supervisorId, areaIds) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const [approvals] = await pool.query(
    `SELECT 'LEAVE' AS kind, la.action, la.role, la.approval_time AS ts,
            ua.full_name AS actor, stu.full_name AS studentName
     FROM leave_approval la
     JOIN leave_request lr ON lr.leave_request_id = la.leave_request_id
     JOIN student_area sa ON sa.student_id = lr.student_id AND sa.area_id IN (${ph})
     JOIN user_account ua ON ua.user_id = la.approver_id
     JOIN student s ON s.student_id = lr.student_id
     JOIN user_account stu ON stu.user_id = s.user_id
     ORDER BY la.approval_time DESC LIMIT 5`,
    areaIds,
  );
  const [logs] = await pool.query(
    `SELECT 'LOG' AS kind, sl.event_type AS action, sl.title, sl.created_at AS ts, ua.full_name AS actor
     FROM supervision_log sl
     JOIN user_account ua ON ua.user_id = sl.created_by
     WHERE sl.supervisor_id = ?
     ORDER BY sl.created_at DESC LIMIT 5`,
    [supervisorId],
  );
  return [...approvals, ...logs]
    .filter((x) => x.ts)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 6);
}

// ── Duyệt nghỉ 2 cấp (GVCN → GVQN) ───────────────────────────────────────────
async function findLeaveApprovals(areaIds, { limit = 10 } = {}) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT lr.leave_request_id AS id, lr.leave_type AS leaveType, lr.status,
            lr.start_date AS startDate, lr.end_date AS endDate,
            stu.full_name AS studentName, sc.class_name AS className,
            MAX(CASE WHEN la.role = 'HOMEROOM_TEACHER' THEN la.action END) AS gvcnAction,
            MAX(CASE WHEN la.role = 'DORM_SUPERVISOR'  THEN la.action END) AS gvqnAction
     FROM leave_request lr
     JOIN student_area sa ON sa.student_id = lr.student_id AND sa.area_id IN (${ph})
     JOIN student s ON s.student_id = lr.student_id
     JOIN user_account stu ON stu.user_id = s.user_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id
     LEFT JOIN leave_approval la ON la.leave_request_id = lr.leave_request_id
     GROUP BY lr.leave_request_id, lr.leave_type, lr.status, lr.start_date, lr.end_date,
              lr.created_at, stu.full_name, sc.class_name
     ORDER BY lr.created_at DESC
     LIMIT ?`,
    [...areaIds, limit],
  );
  return rows;
}

// ── Duyệt nghỉ 2 cấp (màn Duyệt nghỉ) ────────────────────────────────────────
// Danh sách đơn của HS thuộc khu GVQN, kèm hành động của cả 2 cấp.
async function findLeaveRequests(areaIds) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT lr.leave_request_id AS id, lr.leave_type AS leaveType, lr.status,
            lr.start_date AS startDate, lr.end_date AS endDate, lr.reason,
            lr.attachment_id AS attachmentId, lr.created_at AS createdAt,
            stu.full_name AS studentName, s.student_code AS studentCode,
            sc.class_name AS className, r.room_name AS roomName,
            MAX(CASE WHEN la.role = 'HOMEROOM_TEACHER' THEN la.action END) AS gvcnAction,
            MAX(CASE WHEN la.role = 'DORM_SUPERVISOR'  THEN la.action END) AS gvqnAction,
            MAX(CASE WHEN la.role = 'DORM_SUPERVISOR'  THEN la.comment END) AS gvqnComment
     FROM leave_request lr
     JOIN student_area sa ON sa.student_id = lr.student_id AND sa.area_id IN (${ph})
     JOIN student s ON s.student_id = lr.student_id
     JOIN user_account stu ON stu.user_id = s.user_id
     LEFT JOIN room r ON r.room_id = sa.room_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id
     LEFT JOIN leave_approval la ON la.leave_request_id = lr.leave_request_id
     GROUP BY lr.leave_request_id, lr.leave_type, lr.status, lr.start_date, lr.end_date,
              lr.reason, lr.attachment_id, lr.created_at, stu.full_name, s.student_code,
              sc.class_name, r.room_name
     ORDER BY lr.created_at DESC`,
    areaIds,
  );
  return rows;
}

// Lấy 1 đơn CÓ scope theo khu (null nếu không thuộc khu GVQN) + trạng thái 2 cấp.
async function findLeaveRequestScoped(id, areaIds) {
  if (!areaIds.length) return null;
  const ph = areaIds.map(() => "?").join(",");
  const [[row]] = await pool.query(
    `SELECT lr.leave_request_id AS id, lr.status, lr.student_id AS studentId, lr.parent_id AS parentId,
            MAX(CASE WHEN la.role = 'HOMEROOM_TEACHER' THEN la.action END) AS gvcnAction,
            MAX(CASE WHEN la.role = 'DORM_SUPERVISOR'  THEN la.action END) AS gvqnAction
     FROM leave_request lr
     JOIN student_area sa ON sa.student_id = lr.student_id AND sa.area_id IN (${ph})
     LEFT JOIN leave_approval la ON la.leave_request_id = lr.leave_request_id
     WHERE lr.leave_request_id = ?
     GROUP BY lr.leave_request_id, lr.status, lr.student_id, lr.parent_id`,
    [...areaIds, id],
  );
  return row || null;
}

// GVQN xác nhận cấp 2 (sau khi GVCN đã duyệt). ADDITIVE — không đụng luồng GVCN.
async function decideLeaveByGvqn(approverUserId, id, action, comment) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO leave_approval (leave_request_id, approver_id, role, action, comment)
       VALUES (?, ?, 'DORM_SUPERVISOR', ?, ?)`,
      [id, approverUserId, action, comment || null],
    );
    // GVQN từ chối → chặn đơn (dorm không cho ra); GVQN duyệt → giữ APPROVED (đủ 2 cấp).
    if (action === "REJECT") {
      await conn.query(`UPDATE leave_request SET status = 'REJECTED' WHERE leave_request_id = ?`, [id]);
    }
    // Thông báo cho HS + phụ huynh
    const [[recv]] = await conn.query(
      `SELECT s.user_id AS studentUser, pp.user_id AS parentUser
       FROM leave_request lr
       JOIN student s ON s.student_id = lr.student_id
       LEFT JOIN parent_profile pp ON pp.parent_id = lr.parent_id
       WHERE lr.leave_request_id = ?`,
      [id],
    );
    const receivers = [recv?.studentUser, recv?.parentUser].filter(Boolean);
    if (receivers.length) {
      const title = action === "APPROVE" ? "Quản nhiệm đã duyệt đơn xin nghỉ" : "Quản nhiệm đã từ chối đơn xin nghỉ";
      const content = comment || (action === "APPROVE" ? "Đơn xin nghỉ đã được quản nhiệm xác nhận." : "Đơn xin nghỉ bị quản nhiệm từ chối.");
      await conn.query(
        `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
        [receivers.map((rid) => [rid, title, content, "LEAVE", "LEAVE_REQUEST", id, false])],
      );
    }
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ── Khu tôi phụ trách ────────────────────────────────────────────────────────
async function findAreas(supervisorId) {
  const [rows] = await pool.query(
    `SELECT sa.area_id AS areaId, sa.area_name AS areaName, sa.area_type AS areaType,
            sa.description, sa.status,
            (SELECT COUNT(*) FROM room r WHERE r.area_id = sa.area_id) AS roomCount,
            (SELECT COUNT(*) FROM student_area st WHERE st.area_id = sa.area_id) AS studentCount
     FROM supervisor_area sa
     WHERE sa.supervisor_id = ?
     ORDER BY sa.area_id`,
    [supervisorId],
  );
  for (const a of rows) {
    const [[p]] = await pool.query(
      `SELECT COUNT(*) total, SUM(attendance_type_id = 1) present
       FROM attendance
       WHERE area_id = ? AND attendance_context = 'DORM' AND attendance_date = CURDATE()`,
      [a.areaId],
    );
    a.presentRate = p.total ? Math.round((p.present / p.total) * 100) : null;
  }
  return rows;
}

async function findAreaSummary(areaIds) {
  if (!areaIds.length) return { areaCount: 0, roomCount: 0, studentCount: 0, presentRate: null };
  const ph = areaIds.map(() => "?").join(",");
  const [[room]] = await pool.query(`SELECT COUNT(*) c FROM room WHERE area_id IN (${ph})`, areaIds);
  const [[stu]] = await pool.query(`SELECT COUNT(*) c FROM student_area WHERE area_id IN (${ph})`, areaIds);
  const [[att]] = await pool.query(
    `SELECT COUNT(*) total, SUM(attendance_type_id = 1) present
     FROM attendance WHERE area_id IN (${ph}) AND attendance_context = 'DORM' AND attendance_date = CURDATE()`,
    areaIds,
  );
  return {
    areaCount: areaIds.length,
    roomCount: Number(room.c || 0),
    studentCount: Number(stu.c || 0),
    presentRate: att.total ? Math.round((att.present / att.total) * 100) : null,
  };
}

// ── Điểm danh nội trú ────────────────────────────────────────────────────────
async function findRooms(areaId) {
  const [rows] = await pool.query(
    `SELECT room_id AS roomId, room_name AS roomName, floor FROM room WHERE area_id = ? ORDER BY room_name`,
    [areaId],
  );
  return rows;
}

async function findAttendanceRoster(areaId, { date, roomId, floor, q }) {
  const params = [date, areaId];
  let extra = "";
  if (roomId) { extra += " AND st.room_id = ?"; params.push(roomId); }
  if (floor) { extra += " AND r.floor = ?"; params.push(floor); }
  if (q) { extra += " AND (ua.full_name LIKE ? OR s.student_code LIKE ?)"; params.push(`%${q}%`, `%${q}%`); }
  const [rows] = await pool.query(
    `SELECT s.student_id AS studentId, s.student_code AS studentCode, ua.full_name AS studentName,
            ua.avatar, sc.class_name AS className, r.room_name AS roomName, r.floor,
            a.attendance_type_id AS typeId, at.type_name AS typeName, at.description AS typeLabel,
            DATE_FORMAT(a.check_in_time, '%H:%i') AS checkIn
     FROM student_area st
     JOIN student s ON s.student_id = st.student_id
     JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN room r ON r.room_id = st.room_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id
     LEFT JOIN attendance a ON a.student_id = s.student_id AND a.area_id = st.area_id
            AND a.attendance_context = 'DORM' AND a.attendance_date = ?
     LEFT JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
     WHERE st.area_id = ?${extra}
     ORDER BY r.room_name, ua.full_name`,
    params,
  );
  return rows;
}

// Điểm danh HÀNG LOẠT trong 1 API call (xoá bản ghi DORM cũ cùng ngày rồi chèn mới)
async function bulkUpsertAttendance(userId, { areaId, date, records }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ids = records.map((r) => r.studentId);
    if (ids.length) {
      const ph = ids.map(() => "?").join(",");
      await conn.query(
        `DELETE FROM attendance
         WHERE area_id = ? AND attendance_context = 'DORM' AND attendance_date = ? AND student_id IN (${ph})`,
        [areaId, date, ...ids],
      );
      for (const rec of records) {
        await conn.query(
          `INSERT INTO attendance (student_id, area_id, attendance_type_id, attendance_date, attendance_context, check_in_time, created_by)
           VALUES (?,?,?,?, 'DORM', NOW(), ?)`,
          [rec.studentId, areaId, rec.typeId, date, userId],
        );
      }
    }
    await conn.commit();
    return ids.length;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function findAttendanceSummary(areaIds, date) {
  if (!areaIds.length) return { present: 0, absentUnexcused: 0, absentExcused: 0, notYet: 0, totalStudents: 0 };
  const ph = areaIds.map(() => "?").join(",");
  const [[tot]] = await pool.query(`SELECT COUNT(*) c FROM student_area WHERE area_id IN (${ph})`, areaIds);
  const [[a]] = await pool.query(
    `SELECT SUM(attendance_type_id = 1) present,
            SUM(attendance_type_id = 4) absentUnexcused,
            SUM(attendance_type_id = 3) absentExcused,
            COUNT(*) marked
     FROM attendance WHERE area_id IN (${ph}) AND attendance_context = 'DORM' AND attendance_date = ?`,
    [...areaIds, date],
  );
  const present = Number(a.present || 0);
  const absentUnexcused = Number(a.absentUnexcused || 0);
  const absentExcused = Number(a.absentExcused || 0);
  const totalStudents = Number(tot.c || 0);
  return {
    present,
    absentUnexcused,
    absentExcused,
    notYet: Math.max(0, totalStudents - Number(a.marked || 0)),
    totalStudents,
  };
}

// ── Sổ trực quản nhiệm ───────────────────────────────────────────────────────
async function findLogbook(supervisorId, { date, shift }) {
  const [rows] = await pool.query(
    `SELECT sl.log_id AS logId, sl.shift, sl.event_type AS eventType, sl.title, sl.content, sl.status,
            DATE_FORMAT(sl.created_at, '%H:%i') AS time, sl.created_at AS ts,
            ua.full_name AS author, sa.area_name AS areaName,
            (SELECT COUNT(*) FROM supervision_log_reply rp WHERE rp.log_id = sl.log_id) AS replyCount
     FROM supervision_log sl
     JOIN user_account ua ON ua.user_id = sl.created_by
     JOIN supervisor_area sa ON sa.area_id = sl.area_id
     WHERE sl.supervisor_id = ? AND sl.log_date = ? AND sl.shift = ?
     ORDER BY sl.created_at`,
    [supervisorId, date, shift],
  );
  return rows;
}

async function findPreviousLogs(supervisorId, { limit = 6 } = {}) {
  const [rows] = await pool.query(
    `SELECT sl.log_id AS logId, sl.shift, sl.log_date AS logDate, sl.title, sl.event_type AS eventType,
            DATE_FORMAT(sl.created_at, '%H:%i') AS time
     FROM supervision_log sl
     WHERE sl.supervisor_id = ?
     ORDER BY sl.log_date DESC, FIELD(sl.shift,'NIGHT','EVENING','AFTERNOON','MORNING')
     LIMIT ?`,
    [supervisorId, limit],
  );
  return rows;
}

async function findLogbookStats(supervisorId, areaIds, date, shift) {
  const events = await pool.query(
    `SELECT COUNT(*) c FROM supervision_log WHERE supervisor_id = ? AND log_date = ? AND shift = ?`,
    [supervisorId, date, shift],
  ).then((r) => Number(r[0][0].c || 0));
  const handovers = await pool.query(
    `SELECT COUNT(*) c FROM supervision_log WHERE supervisor_id = ? AND log_date = ? AND event_type = 'HANDOVER'`,
    [supervisorId, date],
  ).then((r) => Number(r[0][0].c || 0));
  let absent = 0;
  if (areaIds.length) {
    const ph = areaIds.map(() => "?").join(",");
    absent = await pool.query(
      `SELECT COUNT(*) c FROM attendance WHERE area_id IN (${ph})
       AND attendance_context = 'DORM' AND attendance_date = ? AND attendance_type_id IN (3, 4)`,
      [...areaIds, date],
    ).then((r) => Number(r[0][0].c || 0));
  }
  return { events, handovers, absent };
}

async function createLog(supervisorId, userId, { areaId, shift, eventType, title, content }) {
  const [r] = await pool.query(
    `INSERT INTO supervision_log (area_id, supervisor_id, shift, log_date, event_type, title, content, status, created_by)
     VALUES (?,?,?,CURDATE(),?,?,?, ?, ?)`,
    [areaId, supervisorId, shift, eventType || "EVENT", title || null, content || null,
     eventType === "HANDOVER" ? "HANDED_OVER" : "OPEN", userId],
  );
  return r.insertId;
}

async function findLogById(logId) {
  const [[row]] = await pool.query(
    `SELECT log_id AS logId, supervisor_id AS supervisorId, status FROM supervision_log WHERE log_id = ?`,
    [logId],
  );
  return row || null;
}

async function addLogAttachment(logId, attachmentId) {
  await pool.query(
    `INSERT INTO supervision_log_attachment (log_id, attachment_id) VALUES (?, ?)`,
    [logId, attachmentId],
  );
}

// ── Đăng ký cuối tuần (Nhóm E) ───────────────────────────────────────────────
async function dbUpcomingSaturday() {
  const [[w]] = await pool.query(
    "SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ((5 - WEEKDAY(CURDATE())) + 7) % 7 DAY), '%Y-%m-%d') AS d",
  );
  return w.d;
}

async function findWeekendRegistrations(areaIds, weekendDate) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT wr.registration_id AS id, wr.reg_type AS regType, wr.pickup_by AS pickupBy,
            wr.note, wr.status, wr.weekend_date AS weekendDate,
            ua.full_name AS studentName, s.student_code AS studentCode,
            sc.class_name AS className, r.room_name AS roomName
     FROM weekend_registration wr
     JOIN student s ON s.student_id = wr.student_id
     JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN student_area sa ON sa.student_id = wr.student_id AND sa.area_id = wr.area_id
     LEFT JOIN room r ON r.room_id = sa.room_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id
     WHERE wr.area_id IN (${ph}) AND wr.weekend_date = ?
     ORDER BY wr.reg_type, ua.full_name`,
    [...areaIds, weekendDate],
  );
  return rows;
}

async function setWeekendStatus(areaIds, regId, status) {
  if (!areaIds.length) return false;
  const ph = areaIds.map(() => "?").join(",");
  const [r] = await pool.query(
    `UPDATE weekend_registration SET status = ? WHERE registration_id = ? AND area_id IN (${ph})`,
    [status, regId, ...areaIds],
  );
  return r.affectedRows > 0;
}

// ── Hỗ trợ HS + Liên lạc (mở quyền dùng chung, scope theo khu) ────────────────
async function findSupportCases(areaIds, { status } = {}) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const params = [...areaIds];
  let extra = "";
  if (status) { extra = " AND sc.status = ?"; params.push(status); }
  const [rows] = await pool.query(
    `SELECT sc.case_id AS caseId, sc.category, sc.severity, sc.title, sc.description, sc.status,
            sc.created_at AS createdAt, ua.full_name AS studentName, s.student_code AS studentCode,
            r.room_name AS roomName, opener.full_name AS openedByName
     FROM support_case sc
     JOIN student s ON s.student_id = sc.student_id
     JOIN student_area saa ON saa.student_id = sc.student_id AND saa.area_id IN (${ph})
     JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN room r ON r.room_id = saa.room_id
     LEFT JOIN user_account opener ON opener.user_id = sc.opened_by
     WHERE 1=1${extra}
     ORDER BY FIELD(sc.status,'OPEN','MONITORING','RESOLVED'), FIELD(sc.severity,'HIGH','MEDIUM','LOW'), sc.created_at DESC`,
    params,
  );
  return rows;
}

async function findAreaStudents(areaIds) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT s.student_id AS studentId, ua.full_name AS studentName, s.student_code AS studentCode,
            r.room_name AS roomName
     FROM student_area saa
     JOIN student s ON s.student_id = saa.student_id
     JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN room r ON r.room_id = saa.room_id
     WHERE saa.area_id IN (${ph})
     ORDER BY ua.full_name`,
    areaIds,
  );
  return rows;
}

async function studentInArea(areaIds, studentId) {
  if (!areaIds.length) return false;
  const ph = areaIds.map(() => "?").join(",");
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM student_area WHERE student_id = ? AND area_id IN (${ph}) LIMIT 1`,
    [studentId, ...areaIds],
  );
  return Boolean(row);
}

async function findAreaContacts(areaIds) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT pu.full_name AS parentName, pu.phone, pu.email, spr.relationship, spr.is_primary AS isPrimary,
            stu.full_name AS studentName, s.student_code AS studentCode, r.room_name AS roomName, sc.class_name AS className
     FROM student_area saa
     JOIN student s ON s.student_id = saa.student_id
     JOIN user_account stu ON stu.user_id = s.user_id
     LEFT JOIN room r ON r.room_id = saa.room_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id
     JOIN student_parent spr ON spr.student_id = s.student_id
     JOIN parent_profile pp ON pp.parent_id = spr.parent_id
     JOIN user_account pu ON pu.user_id = pp.user_id
     WHERE saa.area_id IN (${ph})
     ORDER BY stu.full_name, spr.is_primary DESC`,
    areaIds,
  );
  return rows;
}

// ── Danh bạ cho CHAT (kèm user_id để bắt đầu hội thoại) — scope theo khu ───────
async function findAreaMessageStudents(areaIds) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT DISTINCT s.user_id AS studentUserId, s.student_id AS studentId,
            ua.full_name AS studentName, s.student_code AS studentCode, sc.class_name AS className
     FROM student_area saa
     JOIN student s ON s.student_id = saa.student_id
     JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id
     WHERE saa.area_id IN (${ph})
     ORDER BY ua.full_name`,
    areaIds,
  );
  return rows;
}

async function findAreaMessageParents(areaIds) {
  if (!areaIds.length) return [];
  const ph = areaIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT DISTINCT ppu.user_id AS parentUserId, ppu.full_name AS parentName,
            s.student_id AS studentId, stu.full_name AS studentName,
            sc.class_name AS className, spr.relationship, spr.is_primary AS isPrimary
     FROM student_area saa
     JOIN student s ON s.student_id = saa.student_id
     JOIN user_account stu ON stu.user_id = s.user_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id
     JOIN student_parent spr ON spr.student_id = s.student_id
     JOIN parent_profile pp ON pp.parent_id = spr.parent_id
     JOIN user_account ppu ON ppu.user_id = pp.user_id AND ppu.status = 'ACTIVE'
     WHERE saa.area_id IN (${ph})
     ORDER BY stu.full_name, spr.is_primary DESC`,
    areaIds,
  );
  return rows;
}

// Phụ huynh (theo user_id) có con thuộc khu GVQN — chống nhắn ngoài khu.
async function parentInArea(areaIds, parentUserId) {
  if (!areaIds.length) return false;
  const ph = areaIds.map(() => "?").join(",");
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM student_area saa
     JOIN student_parent spr ON spr.student_id = saa.student_id
     JOIN parent_profile pp ON pp.parent_id = spr.parent_id
     WHERE pp.user_id = ? AND saa.area_id IN (${ph}) LIMIT 1`,
    [parentUserId, ...areaIds],
  );
  return Boolean(row);
}

module.exports = {
  SHIFTS,
  dbToday,
  findAreaMessageStudents,
  findAreaMessageParents,
  parentInArea,
  dbUpcomingSaturday,
  findWeekendRegistrations,
  setWeekendStatus,
  findSupportCases,
  findAreaStudents,
  studentInArea,
  findAreaContacts,
  findByUserId,
  findAreaIds,
  ownsArea,
  findDashboardStats,
  findTasks,
  createTask,
  setTaskStatus,
  findRecentActivity,
  findLeaveApprovals,
  findLeaveRequests,
  findLeaveRequestScoped,
  decideLeaveByGvqn,
  findAreas,
  findAreaSummary,
  findRooms,
  findAttendanceRoster,
  bulkUpsertAttendance,
  findAttendanceSummary,
  findLogbook,
  findPreviousLogs,
  findLogbookStats,
  createLog,
  findLogById,
  addLogAttachment,
};
