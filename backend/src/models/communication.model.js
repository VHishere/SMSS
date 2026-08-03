const { pool } = require("../config/db");

// ── Permission helpers ────────────────────────────────────────────────────────

async function isParticipant(conversationId, userId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM conversation_participant WHERE conversation_id = ? AND user_id = ? LIMIT 1`,
    [conversationId, userId],
  );
  return Boolean(row);
}

// A student is reachable if enrolled in a class the teacher teaches.
async function studentAccessibleByTeacher(teacherId, studentId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN class_enrollment ce ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
     WHERE tc.teacher_id = ? AND ce.student_id = ?
     LIMIT 1`,
    [teacherId, studentId],
  );
  return Boolean(row);
}

// A parent (by user_id) is reachable if linked to a student in the teacher's class.
async function parentAccessibleByTeacher(teacherId, parentUserId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN class_enrollment ce ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
     INNER JOIN student_parent sp ON sp.student_id = ce.student_id
     INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
     WHERE tc.teacher_id = ? AND pp.user_id = ?
     LIMIT 1`,
    [teacherId, parentUserId],
  );
  return Boolean(row);
}

// A teacher (by user_id) is reachable by a parent if linked via any of the parent's active students.
async function teacherAccessibleByParent(parentUserId, teacherUserId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM parent_profile pp
     INNER JOIN student_parent sp ON sp.parent_id = pp.parent_id
     INNER JOIN student s ON s.student_id = sp.student_id AND s.status = 'ACTIVE'
     INNER JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     INNER JOIN teacher_class tc ON tc.class_id = ce.class_id AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
     INNER JOIN teacher t ON t.teacher_id = tc.teacher_id
     WHERE pp.user_id = ? AND t.user_id = ?
     LIMIT 1`,
    [parentUserId, teacherUserId],
  );
  return Boolean(row);
}

async function isTeacherForClass(teacherId, classId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM teacher_class WHERE teacher_id = ? AND class_id = ? LIMIT 1`,
    [teacherId, classId],
  );
  return Boolean(row);
}

const TEACHER_ROLE_NAMES = ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"];

// Admin can message any active STAFF or TEACHER-role user — no class/student scoping.
async function isStaffOrTeacher(userId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM user_role ur
     INNER JOIN role r ON r.role_id = ur.role_id
     INNER JOIN user_account ua ON ua.user_id = ur.user_id AND ua.status = 'ACTIVE'
     WHERE ur.user_id = ? AND r.role_name IN ('STAFF', ?, ?, ?)
     LIMIT 1`,
    [userId, ...TEACHER_ROLE_NAMES],
  );
  return Boolean(row);
}

async function isAdminOrTeacher(userId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM user_role ur
     INNER JOIN role r ON r.role_id = ur.role_id
     INNER JOIN user_account ua ON ua.user_id = ur.user_id AND ua.status = 'ACTIVE'
     WHERE ur.user_id = ? AND r.role_name IN ('ADMIN', ?, ?, ?)
     LIMIT 1`,
    [userId, ...TEACHER_ROLE_NAMES],
  );
  return Boolean(row);
}

// ── Contacts for composing ────────────────────────────────────────────────────

// Admin's contacts picker — every active STAFF/TEACHER user school-wide.
async function findStaffTeacherContacts() {
  const [rows] = await pool.query(
    `SELECT
       ua.user_id AS userId,
       ua.full_name AS fullName,
       ua.email,
       ua.avatar,
       GROUP_CONCAT(DISTINCT r.role_name ORDER BY r.role_name) AS roleNames
     FROM user_account ua
     INNER JOIN user_role ur ON ur.user_id = ua.user_id
     INNER JOIN role r ON r.role_id = ur.role_id
     WHERE ua.status = 'ACTIVE' AND r.role_name IN ('STAFF', ?, ?, ?)
     GROUP BY ua.user_id, ua.full_name, ua.email, ua.avatar
     ORDER BY ua.full_name ASC`,
    TEACHER_ROLE_NAMES,
  );
  return rows.map((r) => ({ ...r, roleNames: r.roleNames ? r.roleNames.split(",") : [] }));
}

async function findAdminTeacherContacts(excludeUserId) {
  const [rows] = await pool.query(
    `SELECT
       ua.user_id AS userId,
       ua.full_name AS fullName,
       ua.email,
       ua.avatar,
       GROUP_CONCAT(DISTINCT r.role_name ORDER BY r.role_name) AS roleNames
     FROM user_account ua
     INNER JOIN user_role ur ON ur.user_id = ua.user_id
     INNER JOIN role r ON r.role_id = ur.role_id
     WHERE ua.status = 'ACTIVE'
       AND ua.user_id <> ?
       AND r.role_name IN ('ADMIN', ?, ?, ?)
     GROUP BY ua.user_id, ua.full_name, ua.email, ua.avatar
     ORDER BY ua.full_name ASC`,
    [excludeUserId, ...TEACHER_ROLE_NAMES],
  );
  return rows.map((r) => ({ ...r, roleNames: r.roleNames ? r.roleNames.split(",") : [] }));
}

async function findStudentContacts(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       s.student_id   AS studentId,
       s.user_id      AS studentUserId,
       s.student_code AS studentCode,
       ua.full_name   AS studentName,
       sc.class_id    AS classId,
       sc.class_name  AS className
     FROM teacher_class tc
     INNER JOIN class_enrollment ce ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     INNER JOIN school_class sc ON sc.class_id = tc.class_id
     WHERE tc.teacher_id = ?
     ORDER BY sc.class_name, ua.full_name`,
    [teacherId],
  );
  return rows;
}

async function findParentContacts(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       pp.user_id     AS parentUserId,
       pua.full_name  AS parentName,
       sp.relationship,
       s.student_id   AS studentId,
       sua.full_name  AS studentName,
       sc.class_name  AS className
     FROM teacher_class tc
     INNER JOIN class_enrollment ce ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account sua ON sua.user_id = s.user_id
     INNER JOIN school_class sc ON sc.class_id = tc.class_id
     INNER JOIN student_parent sp ON sp.student_id = s.student_id
     INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
     INNER JOIN user_account pua ON pua.user_id = pp.user_id AND pua.status = 'ACTIVE'
     WHERE tc.teacher_id = ?
     ORDER BY sc.class_name, sua.full_name`,
    [teacherId],
  );
  return rows;
}

async function findClassMemberUserIds(classId, audience) {
  // audience: 'STUDENTS' | 'PARENTS' | 'ALL'
  const ids = new Set();
  if (audience === "STUDENTS" || audience === "ALL") {
    const [students] = await pool.query(
      `SELECT s.user_id AS userId
       FROM class_enrollment ce
       INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
       INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
       WHERE ce.class_id = ? AND ce.status = 'ACTIVE'`,
      [classId],
    );
    students.forEach((r) => ids.add(r.userId));
  }
  if (audience === "PARENTS" || audience === "ALL") {
    const [parents] = await pool.query(
      `SELECT pp.user_id AS userId
       FROM class_enrollment ce
       INNER JOIN student_parent sp ON sp.student_id = ce.student_id
       INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
       INNER JOIN user_account ua ON ua.user_id = pp.user_id AND ua.status = 'ACTIVE'
       WHERE ce.class_id = ? AND ce.status = 'ACTIVE'`,
      [classId],
    );
    parents.forEach((r) => ids.add(r.userId));
  }
  return [...ids];
}

// Broader recipient resolution for admin announcements: one class, a whole
// grade (all its active classes), or the whole school (no filter at all).
async function findScopedMemberUserIds({ classId, gradeId, audience }) {
  const ids = new Set();
  const scopeWhere = classId ? "ce.class_id = ?" : gradeId ? "sc.grade_id = ?" : "1=1";
  const scopeParam = classId || gradeId || null;

  if (audience === "STUDENTS" || audience === "ALL") {
    const params = scopeParam ? [scopeParam] : [];
    const [students] = await pool.query(
      `SELECT s.user_id AS userId
       FROM class_enrollment ce
       INNER JOIN school_class sc ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
       INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
       INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
       WHERE ce.status = 'ACTIVE' AND ${scopeWhere}`,
      params,
    );
    students.forEach((r) => ids.add(r.userId));
  }
  if (audience === "PARENTS" || audience === "ALL") {
    const params = scopeParam ? [scopeParam] : [];
    const [parents] = await pool.query(
      `SELECT pp.user_id AS userId
       FROM class_enrollment ce
       INNER JOIN school_class sc ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
       INNER JOIN student_parent sp ON sp.student_id = ce.student_id
       INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
       INNER JOIN user_account ua ON ua.user_id = pp.user_id AND ua.status = 'ACTIVE'
       WHERE ce.status = 'ACTIVE' AND ${scopeWhere}`,
      params,
    );
    parents.forEach((r) => ids.add(r.userId));
  }
  return [...ids];
}

// ── Conversations ─────────────────────────────────────────────────────────────

async function findConversations(userId, filters = {}) {
  const { search, archived = false, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [userId, userId, userId, userId, archived ? 1 : 0];
  let having = "";
  if (search) {
    having = "HAVING (otherName LIKE ? OR c.title LIKE ? OR studentName LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [rows] = await pool.query(
    `SELECT
       c.conversation_id AS conversationId,
       c.conversation_type AS conversationType,
       c.title,
       c.student_id AS studentId,
       (SELECT ua.full_name FROM conversation_participant cp2
         INNER JOIN user_account ua ON ua.user_id = cp2.user_id
         WHERE cp2.conversation_id = c.conversation_id AND cp2.user_id <> ? LIMIT 1) AS otherName,
       (SELECT cp3.role_in_conversation FROM conversation_participant cp3
         WHERE cp3.conversation_id = c.conversation_id AND cp3.user_id <> ? LIMIT 1) AS otherRole,
       (SELECT ua.avatar FROM conversation_participant cp4
         INNER JOIN user_account ua ON ua.user_id = cp4.user_id
         WHERE cp4.conversation_id = c.conversation_id AND cp4.user_id <> cp.user_id LIMIT 1) AS otherAvatar,
       (SELECT sua.full_name FROM student s INNER JOIN user_account sua ON sua.user_id = s.user_id
         WHERE s.student_id = c.student_id) AS studentName,
       (SELECT sua.avatar FROM student s INNER JOIN user_account sua ON sua.user_id = s.user_id
         WHERE s.student_id = c.student_id) AS studentAvatar,
       (SELECT m.content FROM conversation_message m
         WHERE m.conversation_id = c.conversation_id
         ORDER BY m.sent_at DESC, m.message_id DESC LIMIT 1) AS lastContent,
       (SELECT m.message_type FROM conversation_message m
         WHERE m.conversation_id = c.conversation_id
         ORDER BY m.sent_at DESC, m.message_id DESC LIMIT 1) AS lastType,
       (SELECT DATE_FORMAT(m.sent_at, '%Y-%m-%d %H:%i') FROM conversation_message m
         WHERE m.conversation_id = c.conversation_id
         ORDER BY m.sent_at DESC, m.message_id DESC LIMIT 1) AS lastSentAt,
       (SELECT COUNT(*) FROM conversation_message m
         WHERE m.conversation_id = c.conversation_id
           AND m.is_deleted = FALSE
           AND m.sender_id <> ?
           AND m.sent_at > COALESCE(cp.last_read_at, '1970-01-01')) AS unreadCount
     FROM conversation_participant cp
     INNER JOIN conversation c ON c.conversation_id = cp.conversation_id
     WHERE cp.user_id = ? AND cp.is_archived = ?
     ${having}
     ORDER BY lastSentAt DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return rows.map((r) => ({
    conversationId: r.conversationId,
    conversationType: r.conversationType,
    title: r.title,
    studentId: r.studentId,
    otherName: r.otherName,
    otherRole: r.otherRole,
    otherAvatar: r.otherAvatar,
    studentName: r.studentName,
    studentAvatar: r.studentAvatar,
    lastContent: r.lastContent,
    lastType: r.lastType,
    lastSentAt: r.lastSentAt,
    unreadCount: Number(r.unreadCount),
    displayName: r.conversationType === "GROUP" ? (r.title || "Nhóm") : (r.otherName || "—"),
    displayAvatar: r.conversationType === "GROUP" ? null : (r.otherAvatar || null),
  }));
}

async function findConversationMeta(conversationId) {
  const [[row]] = await pool.query(
    `SELECT
       c.conversation_id AS conversationId,
       c.conversation_type AS conversationType,
       c.title,
       c.student_id AS studentId,
       (SELECT sua.full_name FROM student s INNER JOIN user_account sua ON sua.user_id = s.user_id
         WHERE s.student_id = c.student_id) AS studentName,
       (SELECT sua.avatar FROM student s INNER JOIN user_account sua ON sua.user_id = s.user_id
         WHERE s.student_id = c.student_id) AS studentAvatar
     FROM conversation c WHERE c.conversation_id = ?`,
    [conversationId],
  );
  return row || null;
}

async function findParticipants(conversationId) {
  const [rows] = await pool.query(
    `SELECT
       cp.user_id AS userId,
       ua.full_name AS fullName,
       ua.avatar,
       cp.role_in_conversation AS role,
       DATE_FORMAT(cp.last_read_at, '%Y-%m-%d %H:%i') AS lastReadAt,
       cp.last_read_at AS lastReadRaw
     FROM conversation_participant cp
     INNER JOIN user_account ua ON ua.user_id = cp.user_id
     WHERE cp.conversation_id = ?`,
    [conversationId],
  );
  return rows;
}

// Find an existing 1-1 conversation of a type between two users (+ optional student scope).
async function findDirectConversation(type, userA, userB, studentId) {
  const [[row]] = await pool.query(
    `SELECT c.conversation_id AS conversationId
     FROM conversation c
     INNER JOIN conversation_participant a ON a.conversation_id = c.conversation_id AND a.user_id = ?
     INNER JOIN conversation_participant b ON b.conversation_id = c.conversation_id AND b.user_id = ?
     WHERE c.conversation_type = ?
       AND (c.student_id <=> ?)
     LIMIT 1`,
    [userA, userB, type, studentId ?? null],
  );
  return row ? row.conversationId : null;
}

// Find any existing 1-1 conversation of a type between two users, regardless of student scope.
// Used when the counterpart (e.g. a parent) doesn't know/care which student the thread was originally scoped to.
async function findAnyDirectConversation(type, userA, userB) {
  const [[row]] = await pool.query(
    `SELECT c.conversation_id AS conversationId
     FROM conversation c
     INNER JOIN conversation_participant a ON a.conversation_id = c.conversation_id AND a.user_id = ?
     INNER JOIN conversation_participant b ON b.conversation_id = c.conversation_id AND b.user_id = ?
     WHERE c.conversation_type = ?
     ORDER BY c.conversation_id DESC
     LIMIT 1`,
    [userA, userB, type],
  );
  return row ? row.conversationId : null;
}

async function createConversation({ type, title, studentId, createdBy, participants }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO conversation (student_id, conversation_type, title, created_by) VALUES (?, ?, ?, ?)`,
      [studentId ?? null, type, title ?? null, createdBy],
    );
    const conversationId = result.insertId;

    const values = participants.map((p) => [conversationId, p.userId, p.role]);
    await conn.query(
      `INSERT INTO conversation_participant (conversation_id, user_id, role_in_conversation) VALUES ?`,
      [values],
    );

    await conn.commit();
    return conversationId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────

async function findMessages(conversationId, { page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM conversation_message WHERE conversation_id = ?`,
    [conversationId],
  );
  const [rows] = await pool.query(
    `SELECT
       m.message_id AS messageId,
       m.sender_id  AS senderId,
       ua.full_name AS senderName,
       m.message_type AS messageType,
       m.content,
       m.file_url AS fileUrl,
       m.is_deleted AS isDeleted,
       m.sent_at AS sentRaw,
       DATE_FORMAT(m.sent_at, '%Y-%m-%d %H:%i') AS sentAt
     FROM conversation_message m
     INNER JOIN user_account ua ON ua.user_id = m.sender_id
     WHERE m.conversation_id = ?
     ORDER BY m.sent_at ASC, m.message_id ASC
     LIMIT ? OFFSET ?`,
    [conversationId, limit, offset],
  );
  return {
    total: Number(total),
    rows: rows.map((r) => ({
      messageId: r.messageId,
      senderId: r.senderId,
      senderName: r.senderName,
      messageType: r.messageType,
      content: r.isDeleted ? null : r.content,
      fileUrl: r.isDeleted ? null : r.fileUrl,
      isDeleted: Boolean(r.isDeleted),
      sentAt: r.sentAt,
      sentRaw: r.sentRaw,
    })),
  };
}

async function insertMessage({ conversationId, senderId, messageType, content, fileUrl }) {
  const [result] = await pool.query(
    `INSERT INTO conversation_message (conversation_id, sender_id, message_type, content, file_url)
     VALUES (?, ?, ?, ?, ?)`,
    [conversationId, senderId, messageType, content ?? null, fileUrl ?? null],
  );
  const [[row]] = await pool.query(
    `SELECT DATE_FORMAT(sent_at, '%Y-%m-%d %H:%i') AS sentAt FROM conversation_message WHERE message_id = ?`,
    [result.insertId],
  );
  return { messageId: result.insertId, sentAt: row.sentAt };
}

async function markRead(conversationId, userId) {
  await pool.query(
    `UPDATE conversation_participant SET last_read_at = NOW() WHERE conversation_id = ? AND user_id = ?`,
    [conversationId, userId],
  );
}

async function setArchived(conversationId, userId, archived) {
  const [result] = await pool.query(
    `UPDATE conversation_participant SET is_archived = ? WHERE conversation_id = ? AND user_id = ?`,
    [archived ? 1 : 0, conversationId, userId],
  );
  return result.affectedRows;
}

async function softDeleteMessage(messageId, userId) {
  const [result] = await pool.query(
    `UPDATE conversation_message
     SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ?
     WHERE message_id = ? AND sender_id = ? AND is_deleted = FALSE`,
    [userId, messageId, userId],
  );
  return result.affectedRows;
}

async function findMessageById(messageId) {
  const [[row]] = await pool.query(
    `SELECT message_id AS messageId, conversation_id AS conversationId, sender_id AS senderId
     FROM conversation_message WHERE message_id = ?`,
    [messageId],
  );
  return row || null;
}

async function addMissingParticipants(conversationId, participants = []) {
  if (!participants.length) return;

  const values = participants.map((p) => [
    conversationId,
    p.userId,
    p.role,
  ]);

  await pool.query(
    `
      INSERT IGNORE INTO conversation_participant
        (conversation_id, user_id, role_in_conversation)
      VALUES ?
    `,
    [values],
  );
}

async function findGroupByTitle(title) {
  const [[row]] = await pool.query(
    `
      SELECT
        conversation_id AS conversationId,
        title
      FROM conversation
      WHERE conversation_type = 'GROUP'
        AND title = ?
      LIMIT 1
    `,
    [title],
  );

  return row || null;
}

async function getGroupSummary(conversationId, groupType) {
  const [[row]] = await pool.query(
    `
      SELECT
        c.conversation_id AS conversationId,
        c.title,
        c.conversation_type AS conversationType,
        COUNT(cp.participant_id) AS memberCount
      FROM conversation c
      LEFT JOIN conversation_participant cp
        ON cp.conversation_id = c.conversation_id
      WHERE c.conversation_id = ?
      GROUP BY c.conversation_id, c.title, c.conversation_type
    `,
    [conversationId],
  );

  if (!row) return null;

  return {
    conversationId: row.conversationId,
    title: row.title,
    conversationType: row.conversationType,
    groupType,
    memberCount: Number(row.memberCount || 0),
  };
}

async function findClassGroupParticipants(classId) {
  const [rows] = await pool.query(
    `
      SELECT
        s.user_id AS userId,
        'STUDENT' AS role
      FROM class_enrollment ce
      INNER JOIN student s
        ON s.student_id = ce.student_id
        AND s.status = 'ACTIVE'
      INNER JOIN user_account ua
        ON ua.user_id = s.user_id
        AND ua.status = 'ACTIVE'
      WHERE ce.class_id = ?
        AND ce.status = 'ACTIVE'

      UNION

      SELECT
        t.user_id AS userId,
        'TEACHER' AS role
      FROM teacher_class tc
      INNER JOIN teacher t
        ON t.teacher_id = tc.teacher_id
      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'
      WHERE tc.class_id = ?
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
    `,
    [classId, classId],
  );

  return rows;
}

async function ensureClassGroupConversation({
  userId,
  classId,
  className,
}) {
  const title = `Nhóm lớp ${className}`;
  const participants = await findClassGroupParticipants(classId);

  if (!participants.some((p) => Number(p.userId) === Number(userId))) {
    participants.push({
      userId,
      role: "STUDENT",
    });
  }

  let group = await findGroupByTitle(title);

  if (!group) {
    const conversationId = await createConversation({
      type: "GROUP",
      title,
      studentId: null,
      createdBy: userId,
      participants,
    });

    return getGroupSummary(conversationId, "CLASS");
  }

  await addMissingParticipants(group.conversationId, participants);

  return getGroupSummary(group.conversationId, "CLASS");
}

async function findBoardingAreaByStudentId(studentId) {
  const [[row]] = await pool.query(
    `
      SELECT
        sa.area_id AS areaId,
        a.area_name AS areaName,
        a.area_type AS areaType
      FROM student_area sa
      INNER JOIN supervisor_area a
        ON a.area_id = sa.area_id
        AND a.status = 'ACTIVE'
      WHERE sa.student_id = ?
        AND sa.status = 'ACTIVE'
        AND (sa.end_date IS NULL OR sa.end_date >= CURDATE())
      ORDER BY sa.start_date DESC, sa.student_area_id DESC
      LIMIT 1
    `,
    [studentId],
  );

  return row || null;
}

async function findBoardingGroupParticipants(areaId) {
  const [rows] = await pool.query(
    `
      SELECT
        s.user_id AS userId,
        'STUDENT' AS role
      FROM student_area sa
      INNER JOIN student s
        ON s.student_id = sa.student_id
        AND s.status = 'ACTIVE'
      INNER JOIN user_account ua
        ON ua.user_id = s.user_id
        AND ua.status = 'ACTIVE'
      WHERE sa.area_id = ?
        AND sa.status = 'ACTIVE'
        AND (sa.end_date IS NULL OR sa.end_date >= CURDATE())

      UNION

      SELECT
        ds.user_id AS userId,
        'SUPERVISOR' AS role
      FROM supervisor_area a
      INNER JOIN dorm_supervisor ds
        ON ds.supervisor_id = a.supervisor_id
      INNER JOIN user_account ua
        ON ua.user_id = ds.user_id
        AND ua.status = 'ACTIVE'
      WHERE a.area_id = ?
        AND a.status = 'ACTIVE'
    `,
    [areaId, areaId],
  );

  return rows;
}

async function ensureBoardingGroupConversation({
  userId,
  areaId,
  areaName,
}) {
  const title = `Nhóm nội trú ${areaName}`;
  const participants = await findBoardingGroupParticipants(areaId);

  if (!participants.some((p) => Number(p.userId) === Number(userId))) {
    participants.push({
      userId,
      role: "STUDENT",
    });
  }

  let group = await findGroupByTitle(title);

  if (!group) {
    const conversationId = await createConversation({
      type: "GROUP",
      title,
      studentId: null,
      createdBy: userId,
      participants,
    });

    return getGroupSummary(conversationId, "BOARDING");
  }

  await addMissingParticipants(group.conversationId, participants);

  return getGroupSummary(group.conversationId, "BOARDING");
}

async function findParentClassGroupParticipants(classId) {
  const [rows] = await pool.query(
    `
      SELECT DISTINCT
        pp.user_id AS userId,
        'PARENT' AS role
      FROM class_enrollment ce
      INNER JOIN student s
        ON s.student_id = ce.student_id
        AND s.status = 'ACTIVE'
      INNER JOIN student_parent sp
        ON sp.student_id = s.student_id
      INNER JOIN parent_profile pp
        ON pp.parent_id = sp.parent_id
      INNER JOIN user_account ua
        ON ua.user_id = pp.user_id
        AND ua.status = 'ACTIVE'
      WHERE ce.class_id = ?
        AND ce.status = 'ACTIVE'

      UNION

      SELECT
        t.user_id AS userId,
        'TEACHER' AS role
      FROM teacher_class tc
      INNER JOIN teacher t
        ON t.teacher_id = tc.teacher_id
      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'
      WHERE tc.class_id = ?
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
    `,
    [classId, classId],
  );

  return rows;
}

async function ensureParentClassGroupConversation({
  userId,
  classId,
  className,
}) {
  const title = `Nhóm phụ huynh lớp ${className}`;
  const participants = await findParentClassGroupParticipants(classId);

  if (!participants.some((p) => Number(p.userId) === Number(userId))) {
    participants.push({
      userId,
      role: "PARENT",
    });
  }

  let group = await findGroupByTitle(title);

  if (!group) {
    const conversationId = await createConversation({
      type: "GROUP",
      title,
      studentId: null,
      createdBy: userId,
      participants,
    });

    return getGroupSummary(conversationId, "CLASS_PARENTS");
  }

  await addMissingParticipants(group.conversationId, participants);

  return getGroupSummary(group.conversationId, "CLASS_PARENTS");
}

async function ensureParentGroupConversations({
  userId,
  students = [],
}) {
  const groups = [];
  const seenClassIds = new Set();

  for (const student of students) {
    if (!student.classId || seenClassIds.has(student.classId)) continue;

    seenClassIds.add(student.classId);

    const group = await ensureParentClassGroupConversation({
      userId,
      classId: student.classId,
      className: student.className,
    });

    if (group) groups.push(group);
  }

  return groups;
}

async function ensureStudentGroupConversations({
  userId,
  context,
}) {
  const groups = [];

  if (context?.classId) {
    const classGroup = await ensureClassGroupConversation({
      userId,
      classId: context.classId,
      className: context.className,
    });

    if (classGroup) groups.push(classGroup);
  }

  const area = await findBoardingAreaByStudentId(context.studentId);

  if (area) {
    const boardingGroup = await ensureBoardingGroupConversation({
      userId,
      areaId: area.areaId,
      areaName: area.areaName,
    });

    if (boardingGroup) {
      groups.push({
        ...boardingGroup,
        areaId: area.areaId,
        areaName: area.areaName,
      });
    }
  }

  return groups;
}

async function searchMessages(userId, filters = {}) {
  const {
    keyword,
    archived = false,
    page = 1,
    limit = 20,
  } = filters;

  const offset = (page - 1) * limit;
  const searchText = `%${keyword}%`;

  const [rows] = await pool.query(
    `
      SELECT
        m.message_id AS messageId,
        m.conversation_id AS conversationId,
        m.sender_id AS senderId,
        ua.full_name AS senderName,
        m.message_type AS messageType,
        m.content,
        m.file_url AS fileUrl,
        DATE_FORMAT(m.sent_at, '%Y-%m-%d %H:%i') AS sentAt,
        c.conversation_type AS conversationType,
        c.title AS conversationTitle,

        (
          SELECT other_ua.full_name
          FROM conversation_participant other_cp
          INNER JOIN user_account other_ua
            ON other_ua.user_id = other_cp.user_id
          WHERE other_cp.conversation_id = c.conversation_id
            AND other_cp.user_id <> ?
          LIMIT 1
        ) AS otherName

      FROM conversation_participant cp
      INNER JOIN conversation c
        ON c.conversation_id = cp.conversation_id
      INNER JOIN conversation_message m
        ON m.conversation_id = c.conversation_id
      INNER JOIN user_account ua
        ON ua.user_id = m.sender_id
      WHERE cp.user_id = ?
        AND cp.is_archived = ?
        AND m.is_deleted = FALSE
        AND (
          m.content LIKE ?
          OR m.file_url LIKE ?
          OR c.title LIKE ?
          OR ua.full_name LIKE ?
        )
      ORDER BY m.sent_at DESC, m.message_id DESC
      LIMIT ? OFFSET ?
    `,
    [
      userId,
      userId,
      archived ? 1 : 0,
      searchText,
      searchText,
      searchText,
      searchText,
      limit,
      offset,
    ],
  );

  return rows.map((row) => ({
    messageId: row.messageId,
    conversationId: row.conversationId,
    senderId: row.senderId,
    senderName: row.senderName,
    messageType: row.messageType,
    content: row.content,
    fileUrl: row.fileUrl,
    sentAt: row.sentAt,
    conversationType: row.conversationType,
    conversationTitle: row.conversationTitle,
    otherName: row.otherName,
    displayName:
      row.conversationType === "GROUP"
        ? row.conversationTitle || "Nhóm"
        : row.otherName || "Cuộc trò chuyện",
  }));
}

async function dashboardStats(userId) {
  const [[row]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM conversation_participant WHERE user_id = ?) AS totalConversations,
       (SELECT COUNT(*)
        FROM conversation_participant cp
        INNER JOIN conversation_message m ON m.conversation_id = cp.conversation_id
        WHERE cp.user_id = ?
          AND m.is_deleted = FALSE
          AND m.sender_id <> ?
          AND m.sent_at > COALESCE(cp.last_read_at, '1970-01-01')) AS unreadMessages`,
    [userId, userId, userId],
  );
  return {
    totalConversations: Number(row.totalConversations),
    unreadMessages: Number(row.unreadMessages),
  };
}

module.exports = {
  isParticipant,
  studentAccessibleByTeacher,
  parentAccessibleByTeacher,
  teacherAccessibleByParent,
  isTeacherForClass,
  findStudentContacts,
  findParentContacts,
  findClassMemberUserIds,
  findScopedMemberUserIds,
  isStaffOrTeacher,
  isAdminOrTeacher,
  findStaffTeacherContacts,
  findAdminTeacherContacts,
  findConversations,
  findConversationMeta,
  findParticipants,
  findDirectConversation,
  findAnyDirectConversation,
  createConversation,
  findMessages,
  insertMessage,
  markRead,
  softDeleteMessage,
  findMessageById,
  setArchived,
  dashboardStats,
  ensureStudentGroupConversations,
  ensureParentGroupConversations,
  searchMessages,
};
