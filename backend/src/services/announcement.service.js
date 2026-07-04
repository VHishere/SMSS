const announcementModel = require("../models/announcement.model");
const commModel         = require("../models/communication.model");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const AUDIENCES = ["CLASS_PARENTS", "CLASS_STUDENTS", "CLASS_ALL"];
const AUDIENCE_TO_MEMBER = { CLASS_PARENTS: "PARENTS", CLASS_STUDENTS: "STUDENTS", CLASS_ALL: "ALL" };

function validate({ title, audience, classId }) {
  if (!title || !title.trim()) throw httpError("Tiêu đề thông báo là bắt buộc", 400);
  if (!AUDIENCES.includes(audience)) throw httpError("Đối tượng nhận không hợp lệ", 400);
  if (!classId) throw httpError("Cần chọn lớp", 400);
}

async function fanOut(announcement) {
  const memberAudience = AUDIENCE_TO_MEMBER[announcement.audience] ?? "ALL";
  const receivers = await commModel.findClassMemberUserIds(announcement.classId, memberAudience);
  await announcementModel.insertNotifications(
    receivers,
    `Thông báo: ${announcement.title}`,
    (announcement.content || "").slice(0, 200),
    announcement.announcementId,
  );
  return receivers.length;
}

async function createAnnouncement({ teacher, actorUserId, payload }) {
  validate(payload);
  if (payload.publishNow && (!payload.content || !payload.content.trim())) {
    throw httpError("Không thể phát hành thông báo trống nội dung", 400);
  }
  if (!payload.publishNow && payload.scheduledAt && new Date(payload.scheduledAt).getTime() <= Date.now()) {
    throw httpError("Thời gian lên lịch phải ở tương lai", 400);
  }
  const ok = await commModel.isTeacherForClass(teacher.teacherId, payload.classId);
  if (!ok) throw httpError("Bạn không phụ trách lớp này", 403);

  // status: DRAFT (save), SCHEDULED (with scheduledAt), PUBLISHED (publish now)
  let status = "DRAFT";
  if (payload.publishNow) status = "PUBLISHED";
  else if (payload.scheduledAt) status = "SCHEDULED";

  const announcementId = await announcementModel.create({
    title: payload.title.trim(),
    content: payload.content ?? null,
    audience: payload.audience,
    classId: payload.classId,
    status,
    scheduledAt: payload.scheduledAt || null,
    createdBy: actorUserId,
  });

  if (status === "PUBLISHED") {
    try { await fanOut({ announcementId, ...payload, title: payload.title.trim() }); }
    catch (e) { console.error("announcement fan-out (non-critical):", e); }
  }

  return { announcementId, status };
}

async function updateAnnouncement({ teacher, announcementId, payload }) {
  const existing = await announcementModel.findById(announcementId);
  if (!existing) throw httpError("Không tìm thấy thông báo", 404);
  if (existing.createdBy !== teacher.userId) throw httpError("Bạn không có quyền sửa thông báo này", 403);
  if (existing.status === "ARCHIVED") throw httpError("Thông báo đã lưu trữ, không thể sửa", 409);
  if (existing.status === "PUBLISHED") throw httpError("Thông báo đã phát hành, không thể sửa", 409);

  validate(payload);
  if (payload.scheduledAt && new Date(payload.scheduledAt).getTime() <= Date.now()) {
    throw httpError("Thời gian lên lịch phải ở tương lai", 400);
  }
  const ok = await commModel.isTeacherForClass(teacher.teacherId, payload.classId);
  if (!ok) throw httpError("Bạn không phụ trách lớp này", 403);

  const status = payload.scheduledAt ? "SCHEDULED" : "DRAFT";
  const affected = await announcementModel.update(announcementId, {
    title: payload.title.trim(), content: payload.content ?? null, audience: payload.audience,
    classId: payload.classId, scheduledAt: payload.scheduledAt || null, status,
  });
  if (affected === 0) throw httpError("Không thể cập nhật thông báo", 409);
  return { announcementId, status };
}

async function publishAnnouncement({ teacher, announcementId }) {
  const existing = await announcementModel.findById(announcementId);
  if (!existing) throw httpError("Không tìm thấy thông báo", 404);
  if (existing.createdBy !== teacher.userId) throw httpError("Bạn không có quyền phát hành", 403);
  if (existing.status === "PUBLISHED") throw httpError("Thông báo đã được phát hành", 409);
  if (existing.status === "ARCHIVED") throw httpError("Thông báo đã lưu trữ", 409);
  if (!existing.content || !existing.content.trim()) throw httpError("Không thể phát hành thông báo trống nội dung", 400);

  await announcementModel.setStatus(announcementId, "PUBLISHED");
  const sent = await fanOut(existing);
  return { announcementId, sent };
}

async function setPinned({ teacher, announcementId, isPinned }) {
  const existing = await announcementModel.findById(announcementId);
  if (!existing) throw httpError("Không tìm thấy thông báo", 404);
  if (existing.createdBy !== teacher.userId) throw httpError("Bạn không có quyền", 403);
  await announcementModel.setPinned(announcementId, isPinned);
  return { announcementId, isPinned };
}

async function archiveAnnouncement({ teacher, announcementId }) {
  const existing = await announcementModel.findById(announcementId);
  if (!existing) throw httpError("Không tìm thấy thông báo", 404);
  if (existing.createdBy !== teacher.userId) throw httpError("Bạn không có quyền", 403);
  await announcementModel.setStatus(announcementId, "ARCHIVED");
  return { announcementId };
}

// Used by an external/cron runner to publish scheduled announcements.
async function publishDue() {
  const due = await announcementModel.findDue();
  let published = 0;
  for (const a of due) {
    await announcementModel.setStatus(a.announcementId, "PUBLISHED");
    try { await fanOut(a); published++; } catch (e) { console.error("publishDue fan-out:", e); }
  }
  return { published };
}

module.exports = {
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  setPinned,
  archiveAnnouncement,
  publishDue,
};
