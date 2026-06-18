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

async function isTeacherForClass(teacherId, classId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM teacher_class WHERE teacher_id = ? AND class_id = ? LIMIT 1`,
    [teacherId, classId],
  );
  return Boolean(row);
}

// ── Contacts for composing ────────────────────────────────────────────────────

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

// ── Conversations ─────────────────────────────────────────────────────────────

async function findConversations(userId, filters = {}) {
  const { search, archived = false, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [userId, userId, userId, archived ? 1 : 0];
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
       (SELECT sua.full_name FROM student s INNER JOIN user_account sua ON sua.user_id = s.user_id
         WHERE s.student_id = c.student_id) AS studentName,
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
    studentName: r.studentName,
    lastContent: r.lastContent,
    lastType: r.lastType,
    lastSentAt: r.lastSentAt,
    unreadCount: Number(r.unreadCount),
    displayName: r.conversationType === "GROUP" ? (r.title || "Nhóm") : (r.otherName || "—"),
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
         WHERE s.student_id = c.student_id) AS studentName
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

// ── Dashboard stats ───────────────────────────────────────────────────────────

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
  isTeacherForClass,
  findStudentContacts,
  findParentContacts,
  findClassMemberUserIds,
  findConversations,
  findConversationMeta,
  findParticipants,
  findDirectConversation,
  createConversation,
  findMessages,
  insertMessage,
  markRead,
  softDeleteMessage,
  findMessageById,
  setArchived,
  dashboardStats,
};
