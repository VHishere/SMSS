const eventModel = require("../models/event.model");
const { pool } = require("../config/db");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Trả null khi không parse được thay vì đẩy nguyên chuỗi rác xuống MySQL.
function toMysqlDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

async function notify(receivers, title, content, eventId) {
  if (!receivers.length) return;
  await pool.query(
    `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
    [receivers.map((rid) => [rid, title, content, "EVENT", "EVENT", eventId, false])],
  );
}

// actor.isAdmin bypasses ownership entirely — admin manages every event
// school-wide, not just ones it personally created.
async function ensureOwner(eventId, actor) {
  const event = await eventModel.findById(eventId);
  if (!event) throw httpError("Không tìm thấy sự kiện", 404);
  if (!actor.isAdmin && event.createdBy !== actor.userId) throw httpError("Bạn không có quyền với sự kiện này", 403);
  return event;
}

// Read-only visibility: same rule findEvents() uses (created by me OR my
// class OR school-wide), broader than ensureOwner's "created by me" check —
// a teacher can legitimately see (but not necessarily edit) events they
// didn't create. Admin always has full visibility.
async function ensureVisible(eventId, actor) {
  const event = await eventModel.findById(eventId);
  if (!event) throw httpError("Không tìm thấy sự kiện", 404);
  if (actor.isAdmin || event.createdBy === actor.userId || event.classId == null) return event;
  const classes = await eventModel.findTeacherClasses(actor.teacherId);
  if (classes.some((c) => c.classId === event.classId)) return event;
  throw httpError("Bạn không có quyền xem sự kiện này", 403);
}

async function validateClassScope(actor, classId) {
  if (!classId || actor.isAdmin) return; // school-wide allowed; admin may assign any class
  const ok = await eventModel.isTeacherForClass(actor.teacherId, classId);
  if (!ok) throw httpError("Bạn không phụ trách lớp này", 403);
}

const EVENT_TYPES = ["WORKSHOP", "CLUB", "COMPETITION", "FIELD_TRIP", "SPORT", "CULTURE", "SEMINAR", "MUSIC", "SUPPORT_CLASS", "OTHER"];
const EVENT_CATEGORIES = ["ACADEMIC", "PARENT", "SCHOOL", "CLASS", "SPORTS", "FIELD_TRIP", "COMPETITION", "COMMUNITY"];

function validateEventPayload(payload) {
  if (!payload.title || !payload.title.trim()) throw httpError("Tiêu đề sự kiện là bắt buộc", 400);
  if (!payload.eventType || !EVENT_TYPES.includes(payload.eventType)) throw httpError("Vui lòng chọn loại sự kiện hợp lệ", 400);
  if (!payload.category || !EVENT_CATEGORIES.includes(payload.category)) throw httpError("Vui lòng chọn danh mục hợp lệ", 400);
  if (!payload.startDate) throw httpError("Thời gian bắt đầu là bắt buộc", 400);
  if (!payload.organizer || !payload.organizer.trim()) throw httpError("Đơn vị/người tổ chức là bắt buộc", 400);

  const startedAt = new Date(payload.startDate).getTime();
  if (Number.isNaN(startedAt)) throw httpError("Thời gian bắt đầu không hợp lệ", 400);

  if (payload.endDate) {
    const endedAt = new Date(payload.endDate).getTime();
    if (Number.isNaN(endedAt)) throw httpError("Thời gian kết thúc không hợp lệ", 400);
    if (endedAt <= startedAt) {
      throw httpError("Thời gian kết thúc phải sau thời gian bắt đầu", 400);
    }
  }

  if (payload.capacity != null && payload.capacity !== "") {
    const capacity = Number(payload.capacity);
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw httpError("Sức chứa phải là số nguyên lớn hơn 0", 400);
    }
  }
}

// ── Event lifecycle ───────────────────────────────────────────────────────────

async function createEvent({ actor, payload }) {
  validateEventPayload(payload);

  await validateClassScope(actor, payload.classId ?? null);

  if (payload.capacity && Array.isArray(payload.participants) && payload.participants.length > Number(payload.capacity)) {
    throw httpError(`Số người tham dự ban đầu vượt sức chứa (${payload.capacity})`, 400);
  }

  const eventId = await eventModel.createEvent({
    title: payload.title.trim(),
    eventType: payload.eventType ?? null,
    category: payload.category ?? null,
    classId: payload.classId ?? null,
    description: payload.description ?? null,
    startDate: toMysqlDateTime(payload.startDate),
    endDate: toMysqlDateTime(payload.endDate),
    location: payload.location ?? null,
    organizer: payload.organizer.trim(),
    capacity: payload.capacity ? Number(payload.capacity) : null,
    createdBy: actor.userId,
  });

  // Optional initial participants
  if (Array.isArray(payload.participants) && payload.participants.length) {
    await eventModel.addParticipants(eventId, payload.participants, actor.userId);
    try {
      await notify(payload.participants.map((p) => p.userId), "Sự kiện mới",
        `Bạn được mời tham gia: "${payload.title.trim()}".`, eventId);
    } catch (e) { console.error("createEvent notify:", e); }
  }

  await eventModel.log(eventId, "CREATE", `Tạo sự kiện "${payload.title.trim()}"`, actor.userId);
  return { eventId };
}

async function updateEvent({ actor, eventId, payload }) {
  const event = await ensureOwner(eventId, actor);
  if (["CANCELLED", "ARCHIVED"].includes(event.status)) throw httpError("Sự kiện đã đóng, không thể sửa", 409);
  validateEventPayload(payload);

  await validateClassScope(actor, payload.classId ?? null);

  const affected = await eventModel.updateEvent(eventId, {
    title: payload.title.trim(),
    eventType: payload.eventType ?? null,
    category: payload.category ?? null,
    classId: payload.classId ?? null,
    description: payload.description ?? null,
    startDate: toMysqlDateTime(payload.startDate),
    endDate: toMysqlDateTime(payload.endDate),
    location: payload.location ?? null,
    organizer: payload.organizer.trim(),
    capacity: payload.capacity ? Number(payload.capacity) : null,
  });
  if (affected === 0) throw httpError("Không thể cập nhật sự kiện", 409);

  await eventModel.log(eventId, "UPDATE", "Cập nhật sự kiện", actor.userId);
  try {
    const receivers = await eventModel.findParticipantRecipients(eventId);
    await notify(receivers, "Sự kiện được cập nhật", `Sự kiện "${payload.title.trim()}" có thay đổi.`, eventId);
  } catch (e) { console.error("updateEvent notify:", e); }
  return { eventId };
}

async function changeStatus({ actor, eventId, status }) {
  const event = await ensureOwner(eventId, actor);
  if (!["ACTIVE", "COMPLETED", "CANCELLED", "ARCHIVED"].includes(status)) throw httpError("Trạng thái không hợp lệ", 400);

  await eventModel.setStatus(eventId, status);
  await eventModel.log(eventId, status, `Đổi trạng thái → ${status}`, actor.userId);

  if (status === "CANCELLED") {
    try {
      const receivers = await eventModel.findParticipantRecipients(eventId);
      await notify(receivers, "Sự kiện bị hủy", `Sự kiện "${event.title}" đã bị hủy.`, eventId);
    } catch (e) { console.error("cancel notify:", e); }
  }
  return { eventId, status };
}

async function duplicateEvent({ actor, eventId }) {
  const src = await ensureOwner(eventId, actor);
  const newId = await eventModel.createEvent({
    title: `${src.title} (bản sao)`,
    eventType: src.eventType, category: src.category, classId: src.classId,
    description: src.description, startDate: toMysqlDateTime(src.startDate), endDate: toMysqlDateTime(src.endDate),
    location: src.location, organizer: src.organizer, capacity: src.capacity, createdBy: actor.userId,
  });
  await eventModel.log(newId, "DUPLICATE", `Nhân bản từ sự kiện #${eventId}`, actor.userId);
  return { eventId: newId };
}

async function sendReminder({ actor, eventId }) {
  const event = await ensureOwner(eventId, actor);
  const receivers = await eventModel.findParticipantRecipients(eventId);
  await notify(receivers, "Nhắc nhở sự kiện", `Nhắc lịch sự kiện "${event.title}" lúc ${event.startDate}.`, eventId);
  await eventModel.log(eventId, "REMINDER", `Gửi nhắc nhở tới ${receivers.length} người`, actor.userId);
  return { sent: receivers.length };
}

// ── Participants & attendance ─────────────────────────────────────────────────

async function addParticipants({ actor, eventId, participants }) {
  const event = await ensureOwner(eventId, actor);
  if (!Array.isArray(participants) || participants.length === 0) throw httpError("Không có người để thêm", 400);

  if (event.capacity) {
    const current = await eventModel.findParticipants(eventId);
    if (current.length + participants.length > event.capacity) {
      throw httpError(`Vượt sức chứa sự kiện (${event.capacity}). Hiện đã có ${current.length} người.`, 400);
    }
  }

  await eventModel.addParticipants(eventId, participants, actor.userId);
  await eventModel.log(eventId, "ADD_PARTICIPANT", `Thêm ${participants.length} người tham dự`, actor.userId);
  try {
    await notify(participants.map((p) => p.userId), "Sự kiện mới", "Bạn được thêm vào một sự kiện.", eventId);
  } catch (e) { console.error("addParticipants notify:", e); }
  return { added: participants.length };
}

async function removeParticipant({ actor, eventId, registrationId }) {
  await ensureOwner(eventId, actor);
  const affected = await eventModel.removeParticipant(eventId, registrationId);
  if (affected === 0) throw httpError("Không tìm thấy người tham dự", 404);
  await eventModel.log(eventId, "REMOVE_PARTICIPANT", "Xóa người tham dự", actor.userId);
  return { registrationId };
}

async function markAttendance({ actor, eventId, registrationId, status }) {
  await ensureOwner(eventId, actor);
  if (!["REGISTERED", "PRESENT", "ABSENT", "EXCUSED", "LATE"].includes(status)) throw httpError("Trạng thái điểm danh không hợp lệ", 400);
  const affected = await eventModel.updateAttendance(eventId, registrationId, status);
  if (affected === 0) throw httpError("Không tìm thấy người tham dự", 404);
  await eventModel.log(eventId, "ATTENDANCE", `Điểm danh → ${status}`, actor.userId);
  return { registrationId, status };
}

// ── Outcome report (read-only after submit) ───────────────────────────────────

async function saveOutcome({ actor, eventId, payload }) {
  const event = await ensureOwner(eventId, actor);
  if (event.outcomeSubmitted) throw httpError("Báo cáo sự kiện đã chốt, không thể chỉnh sửa", 409);

  await eventModel.saveOutcome({ eventId, outcome: payload.outcome ?? null, submit: Boolean(payload.submit) });
  await eventModel.log(eventId, payload.submit ? "OUTCOME_SUBMIT" : "OUTCOME_SAVE",
    payload.submit ? "Chốt báo cáo sự kiện" : "Lưu nháp báo cáo", actor.userId);
  return { eventId, submitted: Boolean(payload.submit) };
}

// ── Detail aggregate ──────────────────────────────────────────────────────────

async function getDetail({ actor, eventId }) {
  const event = await ensureVisible(eventId, actor);
  const [participants, documents, logs] = await Promise.all([
    eventModel.findParticipants(eventId),
    eventModel.findDocuments(eventId),
    eventModel.findLog(eventId),
  ]);

  const total = participants.length;
  const attended = participants.filter((p) => ["PRESENT", "LATE"].includes(p.attendStatus)).length;
  const stats = {
    total,
    attended,
    attendanceRate: total > 0 ? Math.round((attended / total) * 1000) / 10 : null,
    participationRate: event.capacity ? Math.round((total / event.capacity) * 1000) / 10 : null,
  };

  return { event, participants, documents, logs, stats };
}

module.exports = {
  createEvent,
  updateEvent,
  changeStatus,
  duplicateEvent,
  sendReminder,
  addParticipants,
  removeParticipant,
  markAttendance,
  saveOutcome,
  getDetail,
};
