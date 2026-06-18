const { pool } = require("../config/db");

async function createCase(c) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO support_case (student_id, category, severity, title, description, status, opened_by)
       VALUES (?, ?, ?, ?, ?, 'OPEN', ?)`,
      [c.studentId, c.category, c.severity, c.title, c.description ?? null, c.openedBy],
    );
    const caseId = result.insertId;
    await conn.query(
      `INSERT INTO support_case_update (case_id, note, new_status, author_id) VALUES (?, ?, 'OPEN', ?)`,
      [caseId, c.description ? c.description : "Mở ca hỗ trợ", c.openedBy],
    );
    await conn.commit();
    return caseId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findCases(filters = {}) {
  const { status, classId, studentId, openedBy, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [];
  let where = "1=1";
  if (status)    { where += " AND sc.status = ?";   params.push(status); }
  if (studentId) { where += " AND sc.student_id = ?"; params.push(parseInt(studentId, 10)); }
  if (openedBy)  { where += " AND sc.opened_by = ?"; params.push(parseInt(openedBy, 10)); }
  if (classId)   { where += " AND ce.class_id = ?";  params.push(parseInt(classId, 10)); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM support_case sc
     INNER JOIN student s ON s.student_id = sc.student_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       sc.case_id AS caseId, sc.category, sc.severity, sc.title, sc.description, sc.status,
       DATE_FORMAT(sc.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       DATE_FORMAT(sc.resolved_at, '%Y-%m-%d %H:%i') AS resolvedAt,
       s.student_id AS studentId, s.student_code AS studentCode,
       ua.full_name AS studentName, ua.avatar AS studentAvatar,
       cls.class_name AS className,
       opener.full_name AS openedByName
     FROM support_case sc
     INNER JOIN student s ON s.student_id = sc.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class cls ON cls.class_id = ce.class_id AND cls.status = 'ACTIVE'
     LEFT JOIN user_account opener ON opener.user_id = sc.opened_by
     WHERE ${where}
     ORDER BY
       CASE sc.status WHEN 'OPEN' THEN 0 WHEN 'MONITORING' THEN 1 ELSE 2 END,
       FIELD(sc.severity,'HIGH','MEDIUM','LOW'),
       sc.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { total: Number(total), rows };
}

async function findCaseById(caseId) {
  const [[row]] = await pool.query(
    `SELECT sc.case_id AS caseId, sc.student_id AS studentId, sc.status, sc.opened_by AS openedBy,
            ua.full_name AS studentName, s.user_id AS studentUserId
     FROM support_case sc
     INNER JOIN student s ON s.student_id = sc.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     WHERE sc.case_id = ?`,
    [caseId],
  );
  return row || null;
}

async function findUpdates(caseId) {
  const [rows] = await pool.query(
    `SELECT scu.update_id AS updateId, scu.note, scu.new_status AS newStatus,
       DATE_FORMAT(scu.created_at, '%Y-%m-%d %H:%i') AS createdAt, ua.full_name AS authorName
     FROM support_case_update scu
     INNER JOIN user_account ua ON ua.user_id = scu.author_id
     WHERE scu.case_id = ?
     ORDER BY scu.created_at ASC`,
    [caseId],
  );
  return rows;
}

async function addUpdate({ caseId, note, newStatus, authorId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO support_case_update (case_id, note, new_status, author_id) VALUES (?, ?, ?, ?)`,
      [caseId, note, newStatus ?? null, authorId],
    );
    if (newStatus) {
      await conn.query(
        `UPDATE support_case SET status = ?, resolved_at = CASE WHEN ? = 'RESOLVED' THEN NOW() ELSE NULL END WHERE case_id = ?`,
        [newStatus, newStatus, caseId],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createCase, findCases, findCaseById, findUpdates, addUpdate };
