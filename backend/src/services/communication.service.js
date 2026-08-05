const commModel = require("../models/communication.model");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const MAX_MESSAGE_LENGTH = 5000;
const MAX_FILE_URL_LENGTH = 500;

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const { pool } = require("../config/db");
async function notify(receivers, title, content, conversationId) {
  if (!receivers.length) return;
  await pool.query(
    `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
    [receivers.map((rid) => [rid, title, content, "MESSAGE", "CONVERSATION", conversationId, false])],
  );
}

// ── Start (or reuse) a 1-1 conversation ───────────────────────────────────────

async function startConversation({ teacher, target }) {
  // target: { kind: 'PARENT' | 'STUDENT', userId, studentId }
  const { kind, userId: otherUserId, studentId } = target;
  if (!otherUserId) throw httpError("Thiếu người nhận", 400);

  if (kind === "PARENT") {
    const ok = await commModel.parentAccessibleByTeacher(teacher.teacherId, otherUserId);
    if (!ok) throw httpError("Bạn không thể nhắn tin với phụ huynh này", 403);
  } else if (kind === "STUDENT") {
    if (!studentId) throw httpError("Thiếu học sinh", 400);
    const ok = await commModel.studentAccessibleByTeacher(teacher.teacherId, studentId);
    if (!ok) throw httpError("Bạn không thể nhắn tin với học sinh này", 403);
  } else {
    throw httpError("Loại liên hệ không hợp lệ", 400);
  }

  const type = kind === "PARENT" ? "PARENT_TEACHER" : "TEACHER_STUDENT";

  const existing = await commModel.findDirectConversation(type, teacher.userId, otherUserId, studentId ?? null);
  if (existing) return { conversationId: existing, created: false };

  const conversationId = await commModel.createConversation({
    type,
    title: null,
    studentId: studentId ?? null,
    createdBy: teacher.userId,
    participants: [
      { userId: teacher.userId, role: "TEACHER" },
      { userId: otherUserId, role: kind === "PARENT" ? "PARENT" : "STUDENT" },
    ],
  });
  return { conversationId, created: true };
}

// ── Group conversation ────────────────────────────────────────────────────────

async function createGroup({ teacher, title, classId, audience }) {
  if (!title || !title.trim()) throw httpError("Tên nhóm là bắt buộc", 400);
  if (!classId) throw httpError("Cần chọn lớp", 400);

  const ok = await commModel.isTeacherForClass(teacher.teacherId, classId);
  if (!ok) throw httpError("Bạn không phụ trách lớp này", 403);

  const aud = ["STUDENTS", "PARENTS", "ALL"].includes(audience) ? audience : "ALL";
  const memberIds = await commModel.findClassMemberUserIds(classId, aud);
  const participantIds = [...new Set([teacher.userId, ...memberIds])];

  if (participantIds.length < 2) throw httpError("Nhóm cần ít nhất 1 thành viên khác", 400);

  const conversationId = await commModel.createConversation({
    type: "GROUP",
    title: title.trim(),
    studentId: null,
    createdBy: teacher.userId,
    participants: participantIds.map((uid) => ({
      userId: uid,
      role: uid === teacher.userId ? "TEACHER" : "MEMBER",
    })),
  });

  return { conversationId, memberCount: participantIds.length - 1 };
}

// ── Send message ──────────────────────────────────────────────────────────────

async function sendMessage({ userId, conversationId, messageType, content, fileUrl }) {
  const parsedConversationId = Number.parseInt(conversationId, 10);
  if (!Number.isInteger(parsedConversationId) || parsedConversationId <= 0) {
    throw httpError("Cuộc trò chuyện không hợp lệ", 400);
  }

  const ok = await commModel.isParticipant(parsedConversationId, userId);
  if (!ok) throw httpError("Bạn không thuộc cuộc trò chuyện này", 403);

  const type = ["TEXT", "FILE", "IMAGE"].includes(messageType)
    ? messageType
    : "TEXT";
  const normalizedContent = String(content || "").trim();
  const normalizedFileUrl = String(fileUrl || "").trim();

  if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
    throw httpError(`Tin nhắn không được vượt quá ${MAX_MESSAGE_LENGTH} ký tự`, 400);
  }

  if (type === "TEXT" && !normalizedContent) {
    throw httpError("Nội dung tin nhắn trống", 400);
  }

  if (type === "FILE" || type === "IMAGE") {
    if (!normalizedFileUrl) {
      throw httpError("Thiếu tệp đính kèm", 400);
    }

    if (
      normalizedFileUrl.length > MAX_FILE_URL_LENGTH ||
      !isValidHttpUrl(normalizedFileUrl)
    ) {
      throw httpError("Đường dẫn tệp đính kèm không hợp lệ", 400);
    }
  }

  const msg = await commModel.insertMessage({
    conversationId: parsedConversationId,
    senderId: userId,
    messageType: type,
    content: normalizedContent || null,
    fileUrl: normalizedFileUrl || null,
  });

  await commModel.markRead(parsedConversationId, userId);

  try {
    const participants = await commModel.findParticipants(parsedConversationId);
    const meta = await commModel.findConversationMeta(parsedConversationId);
    const sender = participants.find((p) => p.userId === userId);
    const receivers = participants
      .filter((p) => p.userId !== userId)
      .map((p) => p.userId);
    const preview = type === "TEXT"
      ? normalizedContent.slice(0, 80)
      : "[Tệp đính kèm]";
    const title = meta?.conversationType === "GROUP"
      ? `Tin nhắn nhóm: ${meta.title}`
      : `Tin nhắn từ ${sender?.fullName ?? "giáo viên"}`;

    await notify(receivers, title, preview, parsedConversationId);
  } catch (error) {
    console.error("sendMessage notification (non-critical):", error);
  }

  return msg;
}

// ── Thread (messages + read-receipt info) ─────────────────────────────────────

async function getThread({ userId, conversationId, page, limit }) {
  const ok = await commModel.isParticipant(conversationId, userId);
  if (!ok) throw httpError("Bạn không thuộc cuộc trò chuyện này", 403);

  const meta = await commModel.findConversationMeta(conversationId);
  const participants = await commModel.findParticipants(conversationId);
  const { total, rows } = await commModel.findMessages(conversationId, { page, limit });

  // Read receipt: a message I sent is "read" if every OTHER participant's
  // last_read_at >= the message sent time.
  const others = participants.filter((p) => p.userId !== userId);
  const minOtherRead = others.reduce((min, p) => {
    const t = p.lastReadRaw ? new Date(p.lastReadRaw).getTime() : 0;
    return Math.min(min, t);
  }, Number.POSITIVE_INFINITY);

  const messages = rows.map((m) => {
    let receipt = null;
    if (m.senderId === userId) {
      const sentTime = new Date(m.sentRaw).getTime();
      receipt = others.length > 0 && minOtherRead >= sentTime ? "READ" : "SENT";
    }
    const { sentRaw, ...rest } = m;
    return { ...rest, receipt };
  });

  // Update my read pointer
  await commModel.markRead(conversationId, userId);

  return {
    meta,
    participants: participants.map(({ lastReadRaw, ...p }) => p),
    messages,
    pagination: { total, page: Number(page) || 1, limit: Number(limit) || 50 },
  };
}

async function deleteMessage({ userId, messageId }) {
  const msg = await commModel.findMessageById(messageId);
  if (!msg) throw httpError("Không tìm thấy tin nhắn", 404);
  if (msg.senderId !== userId) throw httpError("Chỉ người gửi mới thu hồi được tin nhắn", 403);

  const affected = await commModel.softDeleteMessage(messageId, userId);
  if (affected === 0) throw httpError("Tin nhắn đã được thu hồi", 409);
  return { messageId };
}

module.exports = {
  startConversation,
  createGroup,
  sendMessage,
  getThread,
  deleteMessage,
};
