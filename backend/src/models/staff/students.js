const { pool } = require("../../config/db");
const { hashPassword } = require("../../utils/password");

const STUDENT_ROLE_ID = 7;

const studentSelect = `
  SELECT
    s.student_id AS studentId,
    s.user_id AS userId,
    s.student_code AS studentCode,
    ua.username,
    ua.full_name AS fullName,
    ua.email,
    ua.phone,
    DATE_FORMAT(s.date_of_birth, '%Y-%m-%d') AS dateOfBirthRaw,
    DATE_FORMAT(s.date_of_birth, '%d/%m/%Y') AS dateOfBirth,
    s.gender,
    s.address,
    s.status,
    ce.class_id AS classId,
    sc.class_name AS className,
    g.grade_name AS gradeName,
    sy.year_name AS schoolYearName
  FROM student s
  INNER JOIN user_account ua ON ua.user_id = s.user_id
  LEFT JOIN class_enrollment ce
    ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
  LEFT JOIN school_class sc ON sc.class_id = ce.class_id
  LEFT JOIN grade g ON g.grade_id = sc.grade_id
  LEFT JOIN school_year sy ON sy.school_year_id = sc.school_year_id
`;

async function listStudents(search = "") {
  const keyword = `%${search.trim()}%`;

  const [rows] = await pool.query(
    `
      ${studentSelect}
      WHERE s.status = 'ACTIVE'
        AND (
          ? = ''
          OR ua.full_name LIKE ?
          OR s.student_code LIKE ?
          OR ua.email LIKE ?
          OR sc.class_name LIKE ?
        )
      ORDER BY s.student_id
    `,
    [search.trim(), keyword, keyword, keyword, keyword],
  );

  return rows;
}

async function getStudentById(studentId) {
  const [rows] = await pool.query(
    `${studentSelect} WHERE s.student_id = ? LIMIT 1`,
    [studentId],
  );

  const student = rows[0];
  if (!student) return null;

  const [parents] = await pool.query(
    `
      SELECT
        pp.parent_id AS parentId,
        ua.full_name AS fullName,
        ua.email,
        ua.phone,
        sp.relationship,
        sp.is_primary AS isPrimary
      FROM student_parent sp
      INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
      INNER JOIN user_account ua ON ua.user_id = pp.user_id
      WHERE sp.student_id = ?
      ORDER BY sp.is_primary DESC
    `,
    [studentId],
  );

  return { ...student, parents };
}

async function createStudent(data, actorUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const username = data.username || data.studentCode.toLowerCase();
    const passwordHash = hashPassword(data.password);

    const [userResult] = await connection.query(
      `
        INSERT INTO user_account (username, password_hash, email, full_name, phone, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [username, passwordHash, data.email, data.fullName, data.phone || null],
    );

    const userId = userResult.insertId;

    const [studentResult] = await connection.query(
      `
        INSERT INTO student (user_id, student_code, date_of_birth, gender, address, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        userId,
        data.studentCode,
        data.dateOfBirth || null,
        data.gender || "OTHER",
        data.address || null,
      ],
    );

    const studentId = studentResult.insertId;

    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?)",
      [userId, STUDENT_ROLE_ID],
    );

    if (data.classId) {
      await connection.query(
        `
          INSERT INTO class_enrollment (class_id, student_id, enrollment_date, status)
          VALUES (?, ?, CURDATE(), 'ACTIVE')
        `,
        [data.classId, studentId],
      );
    }

    await connection.commit();
    return getStudentById(studentId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateStudent(studentId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT user_id AS userId FROM student WHERE student_id = ?",
      [studentId],
    );

    if (!rows[0]) {
      const error = new Error("Không tìm thấy học sinh");
      error.statusCode = 404;
      throw error;
    }

    const userId = rows[0].userId;

    await connection.query(
      `
        UPDATE user_account
        SET full_name = ?, email = ?, phone = ?, updated_at = NOW()
        WHERE user_id = ?
      `,
      [data.fullName, data.email, data.phone || null, userId],
    );

    await connection.query(
      `
        UPDATE student
        SET student_code = ?, date_of_birth = ?, gender = ?, address = ?, status = ?
        WHERE student_id = ?
      `,
      [
        data.studentCode,
        data.dateOfBirth || null,
        data.gender || "OTHER",
        data.address || null,
        data.status || "ACTIVE",
        studentId,
      ],
    );

    if (data.classId !== undefined) {
      await connection.query(
        "UPDATE class_enrollment SET status = 'INACTIVE' WHERE student_id = ? AND status = 'ACTIVE'",
        [studentId],
      );

      if (data.classId) {
        await connection.query(
          `
            INSERT INTO class_enrollment (class_id, student_id, enrollment_date, status)
            VALUES (?, ?, CURDATE(), 'ACTIVE')
          `,
          [data.classId, studentId],
        );
      }
    }

    await connection.commit();
    return getStudentById(studentId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listStudents,
  getStudentById,
  createStudent,
  updateStudent,
};
