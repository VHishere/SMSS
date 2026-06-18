const teacherModel = require("../models/teacher.model");
const commModel    = require("../models/communication.model");
const commService  = require("../services/communication.service");
const { pool }     = require("../config/db");

async function resolveTeacher(userId) {
  const profile = await teacherModel.findProfileByUserId(userId);
  if (!profile) return null;
  return { teacherId: profile.teacherId, userId };
}

function handleError(res, error, fallback) {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
}

// GET /teachers/communication/dashboard
async function getDashboard(req, res) {
  try {
    const stats = await commModel.dashboardStats(req.user.userId);
    const recent = await commModel.findConversations(req.user.userId, { page: 1, limit: 5 });
    return res.json({ success: true, data: { stats, recent } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy bảng điều khiển");
  }
}

// GET /teachers/communication/contacts
async function getContacts(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const [students, parents] = await Promise.all([
      commModel.findStudentContacts(teacher.teacherId),
      commModel.findParentContacts(teacher.teacherId),
    ]);

    // distinct classes for group composer
    const classMap = {};
    for (const s of students) classMap[s.classId] = s.className;
    const classes = Object.entries(classMap).map(([id, name]) => ({ classId: Number(id), className: name }));

    return res.json({ success: true, data: { students, parents, classes } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh bạ");
  }
}

// GET /teachers/communication/conversations
async function listConversations(req, res) {
  try {
    const { search, archived, page = "1", limit = "20" } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const items = await commModel.findConversations(req.user.userId, {
      search, archived: archived === "true", page: parsedPage, limit: parsedLimit,
    });
    return res.json({ success: true, data: { items, page: parsedPage } });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách trò chuyện");
  }
}

// POST /teachers/communication/conversations  — start 1-1
async function startConversation(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { kind, userId, studentId } = req.body;
    const result = await commService.startConversation({
      teacher, target: { kind, userId: Number(userId), studentId: studentId ? Number(studentId) : null },
    });
    return res.status(result.created ? 201 : 200).json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể bắt đầu trò chuyện");
  }
}

// POST /teachers/communication/groups
async function createGroup(req, res) {
  try {
    const teacher = await resolveTeacher(req.user.userId);
    if (!teacher) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ giáo viên" });

    const { title, classId, audience } = req.body;
    const result = await commService.createGroup({ teacher, title, classId: Number(classId), audience });
    return res.status(201).json({ success: true, message: `Đã tạo nhóm với ${result.memberCount} thành viên`, data: result });
  } catch (error) {
    return handleError(res, error, "Không thể tạo nhóm");
  }
}

// GET /teachers/communication/conversations/:conversationId
async function getThread(req, res) {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const { page = "1", limit = "50" } = req.query;
    const data = await commService.getThread({
      userId: req.user.userId, conversationId,
      page: parseInt(page, 10), limit: Math.min(100, parseInt(limit, 10)),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải tin nhắn");
  }
}

// POST /teachers/communication/conversations/:conversationId/messages
async function sendMessage(req, res) {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const { messageType, content, fileUrl } = req.body;
    const msg = await commService.sendMessage({ userId: req.user.userId, conversationId, messageType, content, fileUrl });
    return res.status(201).json({ success: true, data: msg });
  } catch (error) {
    return handleError(res, error, "Không thể gửi tin nhắn");
  }
}

// DELETE /teachers/communication/messages/:messageId  — soft delete (recall)
async function deleteMessage(req, res) {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const result = await commService.deleteMessage({ userId: req.user.userId, messageId });
    return res.json({ success: true, message: "Đã thu hồi tin nhắn", data: result });
  } catch (error) {
    return handleError(res, error, "Không thể thu hồi tin nhắn");
  }
}

// PATCH /teachers/communication/conversations/:conversationId/archive
async function archiveConversation(req, res) {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const ok = await commModel.isParticipant(conversationId, req.user.userId);
    if (!ok) return res.status(403).json({ success: false, message: "Bạn không thuộc cuộc trò chuyện này" });
    await commModel.setArchived(conversationId, req.user.userId, Boolean(req.body.archived));
    return res.json({ success: true, message: req.body.archived ? "Đã lưu trữ" : "Đã bỏ lưu trữ" });
  } catch (error) {
    return handleError(res, error, "Không thể lưu trữ cuộc trò chuyện");
  }
}

// POST /teachers/communication/upload  (multipart field "file")
async function uploadFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Không có tệp được tải lên" });

    const fileUrl = `/uploads/messages/${req.file.filename}`;
    const isImage = req.file.mimetype.startsWith("image/");

    // Audit: persist attachment metadata
    await pool.query(
      `INSERT INTO attachment (related_type, related_id, file_name, file_url, file_type, uploaded_by)
       VALUES ('MESSAGE', 0, ?, ?, ?, ?)`,
      [req.file.originalname, fileUrl, req.file.mimetype, req.user.userId],
    );

    return res.status(201).json({
      success: true,
      data: { fileUrl, fileName: req.file.originalname, messageType: isImage ? "IMAGE" : "FILE" },
    });
  } catch (error) {
    return handleError(res, error, "Không thể tải tệp lên");
  }
}

module.exports = {
  getDashboard,
  getContacts,
  listConversations,
  startConversation,
  createGroup,
  getThread,
  sendMessage,
  deleteMessage,
  archiveConversation,
  uploadFile,
};
