const { pool } = require("../config/db");

// ── Class attendance aggregate over a date range (per student + totals) ───────

async function getClassAttendanceReport(classId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS studentName,
       SUM(CASE WHEN at.type_name = 'PRESENT'          THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN at.type_name = 'LATE'             THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN at.type_name = 'ABSENT_EXCUSED'   THEN 1 ELSE 0 END) AS absentExcused,
       SUM(CASE WHEN at.type_name = 'ABSENT_UNEXCUSED' THEN 1 ELSE 0 END) AS absentUnexcused,
       SUM(CASE WHEN at.type_name = 'EARLY_LEAVE'      THEN 1 ELSE 0 END) AS earlyLeave,
       COUNT(a.attendance_id) AS total
     FROM class_enrollment ce
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     LEFT JOIN attendance a
       ON a.student_id = s.student_id
       AND a.class_id = ?
       AND a.attendance_context = 'CLASS'
       AND a.attendance_date BETWEEN ? AND ?
     LEFT JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     GROUP BY s.student_id, s.student_code, ua.full_name
     ORDER BY ua.full_name ASC`,
    [classId, startDate, endDate, classId],
  );

  const students = rows.map((r) => {
    const present = Number(r.present);
    const late = Number(r.late);
    const absentExcused = Number(r.absentExcused);
    const absentUnexcused = Number(r.absentUnexcused);
    const earlyLeave = Number(r.earlyLeave);
    const total = Number(r.total);
    const attended = present + late;
    return {
      studentId: r.studentId,
      studentCode: r.studentCode,
      studentName: r.studentName,
      present, late, absentExcused, absentUnexcused, earlyLeave, total,
      attendanceRate: total > 0 ? Math.round((attended / total) * 1000) / 10 : null,
    };
  });

  const totals = students.reduce(
    (acc, s) => ({
      present: acc.present + s.present,
      late: acc.late + s.late,
      absentExcused: acc.absentExcused + s.absentExcused,
      absentUnexcused: acc.absentUnexcused + s.absentUnexcused,
      earlyLeave: acc.earlyLeave + s.earlyLeave,
      total: acc.total + s.total,
    }),
    { present: 0, late: 0, absentExcused: 0, absentUnexcused: 0, earlyLeave: 0, total: 0 },
  );
  const attendedTotal = totals.present + totals.late;
  totals.attendanceRate = totals.total > 0 ? Math.round((attendedTotal / totals.total) * 1000) / 10 : null;

  return { students, totals };
}

// ── Export audit log (reuses the existing `report` table) ─────────────────────

async function logReport({ reportType, title, parameters, createdBy, fileUrl }) {
  const [result] = await pool.query(
    `INSERT INTO report (report_type, title, parameters, created_by, file_url)
     VALUES (?, ?, ?, ?, ?)`,
    [reportType, title, parameters ? JSON.stringify(parameters) : null, createdBy, fileUrl ?? null],
  );
  return result.insertId;
}

async function findReportHistory(createdBy, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM report WHERE created_by = ?`,
    [createdBy],
  );
  const [rows] = await pool.query(
    `SELECT
       report_id   AS reportId,
       report_type AS reportType,
       title,
       file_url    AS fileUrl,
       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt
     FROM report
     WHERE created_by = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [createdBy, limit, offset],
  );
  return { total: Number(total), rows };
}

// ── Report templates ──────────────────────────────────────────────────────────

async function createTemplate({ name, reportType, config, schedule, createdBy }) {
  const [result] = await pool.query(
    `INSERT INTO report_template (name, report_type, config, schedule, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [name, reportType, config ? JSON.stringify(config) : null, schedule || "NONE", createdBy],
  );
  return result.insertId;
}

async function findTemplates(createdBy) {
  const [rows] = await pool.query(
    `SELECT
       template_id AS templateId, name, report_type AS reportType, config, schedule,
       DATE_FORMAT(last_run_at, '%Y-%m-%d %H:%i') AS lastRunAt,
       DATE_FORMAT(created_at, '%Y-%m-%d') AS createdAt
     FROM report_template
     WHERE created_by = ?
     ORDER BY created_at DESC`,
    [createdBy],
  );
  return rows.map((r) => ({
    ...r,
    config: typeof r.config === "string" ? JSON.parse(r.config) : (r.config ?? {}),
  }));
}

async function findTemplateById(templateId) {
  const [[row]] = await pool.query(
    `SELECT template_id AS templateId, name, report_type AS reportType, config, schedule, created_by AS createdBy
     FROM report_template WHERE template_id = ?`,
    [templateId],
  );
  if (!row) return null;
  return { ...row, config: typeof row.config === "string" ? JSON.parse(row.config) : (row.config ?? {}) };
}

async function deleteTemplate(templateId) {
  const [result] = await pool.query(`DELETE FROM report_template WHERE template_id = ?`, [templateId]);
  return result.affectedRows;
}

async function touchTemplateRun(templateId) {
  await pool.query(`UPDATE report_template SET last_run_at = NOW() WHERE template_id = ?`, [templateId]);
}

// Scheduled templates due to run (used by an external/cron runner).
async function findDueTemplates() {
  const [rows] = await pool.query(
    `SELECT template_id AS templateId, name, report_type AS reportType, config, schedule, created_by AS createdBy
     FROM report_template
     WHERE schedule <> 'NONE'
       AND (
         last_run_at IS NULL
         OR (schedule = 'DAILY'   AND last_run_at < DATE_SUB(NOW(), INTERVAL 1 DAY))
         OR (schedule = 'WEEKLY'  AND last_run_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
         OR (schedule = 'MONTHLY' AND last_run_at < DATE_SUB(NOW(), INTERVAL 1 MONTH))
       )`,
  );
  return rows.map((r) => ({ ...r, config: typeof r.config === "string" ? JSON.parse(r.config) : (r.config ?? {}) }));
}

module.exports = {
  getClassAttendanceReport,
  logReport,
  findReportHistory,
  createTemplate,
  findTemplates,
  findTemplateById,
  deleteTemplate,
  touchTemplateRun,
  findDueTemplates,
};
