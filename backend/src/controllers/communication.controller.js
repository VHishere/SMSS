const teacherModel = require(
  "../models/teacher.model",
);
const commModel = require(
  "../models/communication.model",
);
const commService = require(
  "../services/communication.service",
);
const { pool } = require("../config/db");

const {
  buildRealtimeMessage,
  emitDeletedMessage,
  emitNewMessage,
  emitReadReceipt,
} = require("../socket");

async function resolveTeacher(userId) {
  const profile =
    await teacherModel.findProfileByUserId(
      userId,
    );

  if (!profile) return null;

  return {
    teacherId: profile.teacherId,
    userId,
  };
}

function handleError(res, error, fallback) {
  if (error.statusCode) {
    return res
      .status(error.statusCode)
      .json({
        success: false,
        message: error.message,
      });
  }

  console.error(`${fallback}:`, error);

  return res.status(500).json({
    success: false,
    message: fallback,
  });
}

async function getDashboard(req, res) {
  try {
    const stats =
      await commModel.dashboardStats(
        req.user.userId,
      );

    const recent =
      await commModel.findConversations(
        req.user.userId,
        {
          page: 1,
          limit: 5,
        },
      );

    return res.json({
      success: true,
      data: {
        stats,
        recent,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể lấy bảng điều khiển",
    );
  }
}

async function getContacts(req, res) {
  try {
    const teacher = await resolveTeacher(
      req.user.userId,
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const [students, parents] =
      await Promise.all([
        commModel.findStudentContacts(
          teacher.teacherId,
        ),
        commModel.findParentContacts(
          teacher.teacherId,
        ),
      ]);

    const classMap = {};

    for (const student of students) {
      classMap[student.classId] =
        student.className;
    }

    const classes = Object.entries(
      classMap,
    ).map(([id, name]) => ({
      classId: Number(id),
      className: name,
    }));

    return res.json({
      success: true,
      data: {
        students,
        parents,
        classes,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể lấy danh bạ",
    );
  }
}

async function listConversations(req, res) {
  try {
    const {
      search,
      archived,
      page = "1",
      limit = "20",
    } = req.query;

    const parsedPage = Math.max(
      1,
      Number.parseInt(page, 10),
    );

    const parsedLimit = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(limit, 10),
      ),
    );

    const items =
      await commModel.findConversations(
        req.user.userId,
        {
          search,
          archived: archived === "true",
          page: parsedPage,
          limit: parsedLimit,
        },
      );

    return res.json({
      success: true,
      data: {
        items,
        page: parsedPage,
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể lấy danh sách trò chuyện",
    );
  }
}

async function startConversation(req, res) {
  try {
    const teacher = await resolveTeacher(
      req.user.userId,
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const {
      kind,
      userId,
      studentId,
    } = req.body;

    const result =
      await commService.startConversation({
        teacher,
        target: {
          kind,
          userId: Number(userId),
          studentId: studentId
            ? Number(studentId)
            : null,
        },
      });

    return res
      .status(result.created ? 201 : 200)
      .json({
        success: true,
        data: result,
      });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể bắt đầu trò chuyện",
    );
  }
}

async function createGroup(req, res) {
  try {
    const teacher = await resolveTeacher(
      req.user.userId,
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy hồ sơ giáo viên",
      });
    }

    const {
      title,
      classId,
      audience,
    } = req.body;

    const result =
      await commService.createGroup({
        teacher,
        title,
        classId: Number(classId),
        audience,
      });

    return res.status(201).json({
      success: true,
      message:
        `Đã tạo nhóm với ${result.memberCount} thành viên`,
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tạo nhóm",
    );
  }
}

async function getThread(req, res) {
  try {
    const conversationId =
      Number.parseInt(
        req.params.conversationId,
        10,
      );

    const {
      page = "1",
      limit = "50",
    } = req.query;

    const data =
      await commService.getThread({
        userId: req.user.userId,
        conversationId,
        page: Number.parseInt(page, 10),
        limit: Math.min(
          100,
          Number.parseInt(limit, 10),
        ),
      });

    emitReadReceipt({
      conversationId,
      userId: req.user.userId,
      readAt: new Date().toISOString(),
    }).catch((error) => {
      console.error(
        "Không thể phát sự kiện đã đọc:",
        error,
      );
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải tin nhắn",
    );
  }
}

async function sendMessage(req, res) {
  try {
    const conversationId =
      Number.parseInt(
        req.params.conversationId,
        10,
      );

    const {
      messageType,
      content,
      fileUrl,
    } = req.body;

    const type = [
      "TEXT",
      "FILE",
      "IMAGE",
    ].includes(messageType)
      ? messageType
      : "TEXT";

    const persisted =
      await commService.sendMessage({
        userId: req.user.userId,
        conversationId,
        messageType: type,
        content,
        fileUrl,
      });

    const message =
      await buildRealtimeMessage({
        conversationId,
        senderId: req.user.userId,
        messageType: type,
        content: content?.trim() || null,
        fileUrl: fileUrl || null,
        persisted,
      });

    emitNewMessage(message).catch(
      (error) => {
        console.error(
          "Không thể phát tin nhắn realtime:",
          error,
        );
      },
    );

    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể gửi tin nhắn",
    );
  }
}

async function deleteMessage(req, res) {
  try {
    const messageId =
      Number.parseInt(
        req.params.messageId,
        10,
      );

    const existing =
      await commModel.findMessageById(
        messageId,
      );

    const result =
      await commService.deleteMessage({
        userId: req.user.userId,
        messageId,
      });

    if (existing) {
      emitDeletedMessage({
        conversationId:
          existing.conversationId,
        messageId,
        deletedBy: req.user.userId,
      }).catch((error) => {
        console.error(
          "Không thể phát sự kiện thu hồi:",
          error,
        );
      });
    }

    return res.json({
      success: true,
      message: "Đã thu hồi tin nhắn",
      data: result,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể thu hồi tin nhắn",
    );
  }
}

async function archiveConversation(
  req,
  res,
) {
  try {
    const conversationId =
      Number.parseInt(
        req.params.conversationId,
        10,
      );

    const allowed =
      await commModel.isParticipant(
        conversationId,
        req.user.userId,
      );

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message:
          "Bạn không thuộc cuộc trò chuyện này",
      });
    }

    await commModel.setArchived(
      conversationId,
      req.user.userId,
      Boolean(req.body.archived),
    );

    return res.json({
      success: true,
      message: req.body.archived
        ? "Đã lưu trữ"
        : "Đã bỏ lưu trữ",
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể lưu trữ cuộc trò chuyện",
    );
  }
}

async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Không có tệp được tải lên",
      });
    }

    const fileUrl =
      req.file.cloudinaryUrl;

    const isImage =
      req.file.mimetype.startsWith(
        "image/",
      );

    await pool.query(
      `
        INSERT INTO attachment
          (
            related_type,
            related_id,
            file_name,
            file_url,
            file_type,
            uploaded_by
          )
        VALUES
          ('MESSAGE', 0, ?, ?, ?, ?)
      `,
      [
        req.file.originalname,
        fileUrl,
        req.file.mimetype,
        req.user.userId,
      ],
    );

    return res.status(201).json({
      success: true,
      data: {
        fileUrl,
        fileName:
          req.file.originalname,
        fileType:
          req.file.mimetype,
        size: req.file.size,
        publicId:
          req.file.cloudinaryPublicId,
        resourceType:
          req.file.cloudinaryResourceType,
        messageType: isImage
          ? "IMAGE"
          : "FILE",
      },
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Không thể tải tệp lên",
    );
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