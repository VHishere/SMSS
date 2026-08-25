const { pool } = require("../../config/db");
const {
  createHttpError,
  optionalText,
  requireText,
  validateDate,
  validateEnum,
  validatePositiveInt,
} = require("./validation");

const AREA_STATUSES = ["ACTIVE", "INACTIVE"];
const ASSIGNMENT_STATUSES = ["ACTIVE", "INACTIVE"];

function normalizeAreaType(value) {
  const type = optionalText(value, "loại khu", 50);
  return type ? type.toUpperCase().replace(/\s+/g, "_") : null;
}

async function getBoardingManagement(filters = {}) {
  const areaId = filters.areaId
    ? validatePositiveInt(filters.areaId, "khu nội trú")
    : null;
  const search = String(filters.search || "").trim();

  const [areas, supervisors, rooms, assignments, students] = await Promise.all([
    pool.query(
      `SELECT sa.area_id AS areaId, sa.area_name AS areaName,
              sa.area_type AS areaType, sa.description, sa.status,
              ds.supervisor_id AS supervisorId, ua.full_name AS supervisorName,
              ds.phone AS supervisorPhone,
              COUNT(DISTINCT CASE WHEN sta.status = 'ACTIVE' THEN sta.student_id END) AS studentCount,
              COUNT(DISTINCT CASE WHEN r.status = 'ACTIVE' THEN r.room_id END) AS roomCount
       FROM supervisor_area sa
       INNER JOIN dorm_supervisor ds ON ds.supervisor_id = sa.supervisor_id
       INNER JOIN user_account ua ON ua.user_id = ds.user_id
       LEFT JOIN student_area sta ON sta.area_id = sa.area_id
       LEFT JOIN room r ON r.area_id = sa.area_id
       GROUP BY sa.area_id, sa.area_name, sa.area_type, sa.description, sa.status,
                ds.supervisor_id, ua.full_name, ds.phone
       ORDER BY sa.status = 'ACTIVE' DESC, sa.area_name`,
    ),
    pool.query(
      `SELECT ds.supervisor_id AS supervisorId, ua.full_name AS fullName,
              ua.email, COALESCE(ds.phone, ua.phone) AS phone,
              COUNT(DISTINCT CASE WHEN sa.status = 'ACTIVE' THEN sa.area_id END) AS activeAreaCount
       FROM dorm_supervisor ds
       INNER JOIN user_account ua ON ua.user_id = ds.user_id AND ua.status = 'ACTIVE'
       INNER JOIN user_role ur ON ur.user_id = ua.user_id
       INNER JOIN role ro ON ro.role_id = ur.role_id AND ro.role_name = 'DORM_SUPERVISOR'
       LEFT JOIN supervisor_area sa ON sa.supervisor_id = ds.supervisor_id
       GROUP BY ds.supervisor_id, ua.full_name, ua.email, ds.phone, ua.phone
       ORDER BY ua.full_name`,
    ),
    pool.query(
      `SELECT room_id AS roomId, area_id AS areaId, room_name AS roomName,
              floor, capacity, gender, status
       FROM room
       WHERE status = 'ACTIVE'
       ORDER BY area_id, floor, room_name`,
    ),
    areaId
      ? pool.query(
          `SELECT sta.student_area_id AS studentAreaId, sta.student_id AS studentId,
                  s.student_code AS studentCode, ua.full_name AS fullName,
                  sta.area_id AS areaId, sa.area_name AS areaName,
                  sta.room_id AS roomId, r.room_name AS roomName,
                  DATE_FORMAT(sta.start_date, '%d/%m/%Y') AS startDate
           FROM student_area sta
           INNER JOIN student s ON s.student_id = sta.student_id
           INNER JOIN user_account ua ON ua.user_id = s.user_id
           INNER JOIN supervisor_area sa ON sa.area_id = sta.area_id
           LEFT JOIN room r ON r.room_id = sta.room_id
           WHERE sta.status = 'ACTIVE' AND sta.area_id = ?
           ORDER BY ua.full_name, s.student_code`,
          [areaId],
        )
      : Promise.resolve([[]]),
    pool.query(
      `SELECT s.student_id AS studentId, s.student_code AS studentCode,
              ua.full_name AS fullName, s.gender,
              sta.student_area_id AS studentAreaId, sta.area_id AS areaId,
              sa.area_name AS areaName, sta.room_id AS roomId,
              COALESCE((
                SELECT sc.class_name
                FROM class_enrollment ce
                INNER JOIN school_class sc ON sc.class_id = ce.class_id
                WHERE ce.student_id = s.student_id AND ce.status = 'ACTIVE'
                ORDER BY sc.school_year_id DESC, ce.enrollment_id DESC
                LIMIT 1
              ), 'Chưa xếp lớp') AS className
       FROM student s
       INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
       LEFT JOIN student_area sta ON sta.student_id = s.student_id AND sta.status = 'ACTIVE'
       LEFT JOIN supervisor_area sa ON sa.area_id = sta.area_id
       WHERE s.status = 'ACTIVE'
         AND (? = '' OR ua.full_name LIKE CONCAT('%', ?, '%')
              OR s.student_code LIKE CONCAT('%', ?, '%'))
       ORDER BY sta.student_area_id IS NULL DESC, ua.full_name`,
      [search, search, search],
    ),
  ]);

  return {
    areas: areas[0],
    supervisors: supervisors[0],
    rooms: rooms[0],
    assignments: assignments[0],
    students: students[0],
  };
}

async function createBoardingArea(data) {
  const areaName = requireText(data.areaName, "tên khu", 100);
  const supervisorId = validatePositiveInt(data.supervisorId, "quản nhiệm");
  const areaType = normalizeAreaType(data.areaType);
  const description = optionalText(data.description, "ghi chú", 1000);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [supervisors] = await connection.query(
      `SELECT ds.supervisor_id
       FROM dorm_supervisor ds
       INNER JOIN user_account ua ON ua.user_id = ds.user_id AND ua.status = 'ACTIVE'
       WHERE ds.supervisor_id = ? LIMIT 1`,
      [supervisorId],
    );
    if (!supervisors[0]) throw createHttpError("Không tìm thấy quản nhiệm đang hoạt động", 404);

    const [duplicates] = await connection.query(
      `SELECT area_id FROM supervisor_area
       WHERE status = 'ACTIVE' AND LOWER(TRIM(area_name)) = LOWER(TRIM(?)) LIMIT 1`,
      [areaName],
    );
    if (duplicates[0]) throw createHttpError("Tên khu nội trú đã tồn tại", 409);

    const [result] = await connection.query(
      `INSERT INTO supervisor_area
         (supervisor_id, area_name, area_type, description, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [supervisorId, areaName, areaType, description],
    );
    await connection.commit();
    return { areaId: result.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateBoardingArea(areaIdValue, data) {
  const areaId = validatePositiveInt(areaIdValue, "khu nội trú");
  const areaName = requireText(data.areaName, "tên khu", 100);
  const supervisorId = validatePositiveInt(data.supervisorId, "quản nhiệm");
  const areaType = normalizeAreaType(data.areaType);
  const description = optionalText(data.description, "ghi chú", 1000);
  const status = validateEnum(data.status, AREA_STATUSES, "trạng thái khu", "ACTIVE");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [areas] = await connection.query(
      "SELECT area_id FROM supervisor_area WHERE area_id = ? FOR UPDATE",
      [areaId],
    );
    if (!areas[0]) throw createHttpError("Không tìm thấy khu nội trú", 404);

    const [supervisors] = await connection.query(
      "SELECT supervisor_id FROM dorm_supervisor WHERE supervisor_id = ? LIMIT 1",
      [supervisorId],
    );
    if (!supervisors[0]) throw createHttpError("Không tìm thấy quản nhiệm", 404);

    const [duplicates] = await connection.query(
      `SELECT area_id FROM supervisor_area
       WHERE area_id <> ? AND status = 'ACTIVE'
         AND LOWER(TRIM(area_name)) = LOWER(TRIM(?)) LIMIT 1`,
      [areaId, areaName],
    );
    if (duplicates[0]) throw createHttpError("Tên khu nội trú đã tồn tại", 409);

    if (status === "INACTIVE") {
      const [activeStudents] = await connection.query(
        "SELECT student_area_id FROM student_area WHERE area_id = ? AND status = 'ACTIVE' LIMIT 1",
        [areaId],
      );
      if (activeStudents[0]) {
        throw createHttpError("Cần chuyển hoặc gỡ hết học sinh trước khi ngừng khu", 409);
      }
    }

    await connection.query(
      `UPDATE supervisor_area
       SET supervisor_id = ?, area_name = ?, area_type = ?, description = ?, status = ?
       WHERE area_id = ?`,
      [supervisorId, areaName, areaType, description, status, areaId],
    );
    await connection.commit();
    return { areaId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assignStudentToArea(data) {
  const studentId = validatePositiveInt(data.studentId, "học sinh");
  const areaId = validatePositiveInt(data.areaId, "khu nội trú");
  const roomId = data.roomId ? validatePositiveInt(data.roomId, "phòng") : null;
  const startDate = validateDate(data.startDate, "ngày bắt đầu", { required: true, minYear: 2000 });
  const allowTransfer = data.transfer === true;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [students] = await connection.query(
      "SELECT student_id FROM student WHERE student_id = ? AND status = 'ACTIVE' FOR UPDATE",
      [studentId],
    );
    if (!students[0]) throw createHttpError("Không tìm thấy học sinh đang hoạt động", 404);

    const [areas] = await connection.query(
      "SELECT area_id FROM supervisor_area WHERE area_id = ? AND status = 'ACTIVE' LIMIT 1",
      [areaId],
    );
    if (!areas[0]) throw createHttpError("Khu nội trú không hoạt động", 409);

    if (roomId) {
      const [rooms] = await connection.query(
        "SELECT room_id, capacity FROM room WHERE room_id = ? AND area_id = ? AND status = 'ACTIVE' LIMIT 1",
        [roomId, areaId],
      );
      if (!rooms[0]) throw createHttpError("Phòng không thuộc khu đã chọn", 409);
      const [occupancy] = await connection.query(
        "SELECT COUNT(*) AS total FROM student_area WHERE room_id = ? AND status = 'ACTIVE'",
        [roomId],
      );
      if (Number(occupancy[0].total) >= Number(rooms[0].capacity)) {
        throw createHttpError("Phòng đã đủ sức chứa", 409);
      }
    }

    const [current] = await connection.query(
      `SELECT sta.student_area_id AS studentAreaId, sta.area_id AS areaId, sa.area_name AS areaName
       FROM student_area sta
       INNER JOIN supervisor_area sa ON sa.area_id = sta.area_id
       WHERE sta.student_id = ? AND sta.status = 'ACTIVE' FOR UPDATE`,
      [studentId],
    );
    if (current.length && !allowTransfer) {
      throw createHttpError(`Học sinh đang thuộc ${current[0].areaName}. Hãy xác nhận chuyển khu.`, 409);
    }

    if (current.length) {
      await connection.query(
        `UPDATE student_area
         SET status = 'INACTIVE', end_date = ?
         WHERE student_id = ? AND status = 'ACTIVE'`,
        [startDate, studentId],
      );
    }

    const [result] = await connection.query(
      `INSERT INTO student_area
         (student_id, area_id, room_id, start_date, end_date, status)
       VALUES (?, ?, ?, ?, NULL, 'ACTIVE')`,
      [studentId, areaId, roomId, startDate],
    );
    await connection.commit();
    return { studentAreaId: result.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function removeStudentFromArea(studentAreaIdValue) {
  const studentAreaId = validatePositiveInt(studentAreaIdValue, "phân công nội trú");
  const [result] = await pool.query(
    `UPDATE student_area
     SET status = ?, end_date = CURDATE()
     WHERE student_area_id = ? AND status = 'ACTIVE'`,
    [ASSIGNMENT_STATUSES[1], studentAreaId],
  );
  if (!result.affectedRows) throw createHttpError("Không tìm thấy phân công đang hoạt động", 404);
  return { studentAreaId };
}

module.exports = {
  assignStudentToArea,
  createBoardingArea,
  getBoardingManagement,
  removeStudentFromArea,
  updateBoardingArea,
};
