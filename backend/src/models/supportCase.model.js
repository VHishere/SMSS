const { pool } = require("../config/db");
const notificationModel = require("./notification.model");

const SEVERITY_LABEL = { HIGH: "Nghiêm trọng", MEDIUM: "Trung bình", LOW: "Nhẹ" };

async function createCase(c) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Khóa theo học sinh để hai lần bấm nhanh không thể cùng tạo một ca mở.
    await conn.query(
      "SELECT student_id FROM student WHERE student_id = ? FOR UPDATE",
      [c.studentId],
    );
    const [[existing]] = await conn.query(
      `SELECT case_id AS caseId
       FROM support_case
       WHERE student_id = ? AND category = ?
         AND LOWER(TRIM(title)) = LOWER(TRIM(?))
         AND status IN ('OPEN', 'MONITORING')
       LIMIT 1`,
      [c.studentId, c.category, c.title],
    );
    if (existing) {
      const error = new Error("Ca hỗ trợ này đang được xử lý hoặc theo dõi");
      error.statusCode = 409;
      throw error;
    }
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

    // Báo hộp thư giáo vụ: ca hỗ trợ mới cần phối hợp xử lý (chạy trong cùng
    // transaction → rollback thì không để lại thông báo "ma").
    const [[student]] = await conn.query(
      `SELECT ua.full_name AS studentName,
              (SELECT sc.class_name
               FROM class_enrollment ce
               INNER JOIN school_class sc ON sc.class_id = ce.class_id
               INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
               WHERE ce.student_id = s.student_id AND ce.status = 'ACTIVE'
               ORDER BY sy.is_active DESC, sy.start_date DESC
               LIMIT 1) AS className
       FROM student s
       INNER JOIN user_account ua ON ua.user_id = s.user_id
       WHERE s.student_id = ?`,
      [c.studentId],
    );
    const who = student
      ? `${student.studentName}${student.className ? ` (${student.className})` : ""}`
      : `Học sinh #${c.studentId}`;
    await notificationModel.notifyAllStaff(conn, {
      title: `Ca hỗ trợ mới: ${c.title}`,
      content: `${who} — mức độ ${SEVERITY_LABEL[c.severity] ?? c.severity}. Vui lòng phối hợp theo dõi.`,
      type: "SUPPORT",
      relatedType: "SUPPORT_CASE",
      relatedId: caseId,
    });

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
  if (classId) {
    where += ` AND EXISTS (
      SELECT 1 FROM class_enrollment scoped_ce
      WHERE scoped_ce.student_id = sc.student_id
        AND scoped_ce.class_id = ? AND scoped_ce.status = 'ACTIVE'
    )`;
    params.push(parseInt(classId, 10));
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM support_case sc
     INNER JOIN student s ON s.student_id = sc.student_id
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
       (SELECT cls.class_name
        FROM class_enrollment current_ce
        INNER JOIN school_class cls ON cls.class_id = current_ce.class_id
        INNER JOIN school_year sy ON sy.school_year_id = cls.school_year_id
        WHERE current_ce.student_id = s.student_id
          AND current_ce.status = 'ACTIVE' AND cls.status = 'ACTIVE'
        ORDER BY sy.is_active DESC, sy.start_date DESC
        LIMIT 1) AS className,
       opener.full_name AS openedByName
     FROM support_case sc
     INNER JOIN student s ON s.student_id = sc.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
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
