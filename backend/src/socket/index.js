const { Server } = require("socket.io");

const { verifyToken } = require("../utils/jwt");
const commModel = require("../models/communication.model");
const commService = require("../services/communication.service");

let io = null;

function conversationRoom(conversationId) {
  return `conversation:${conversationId}`;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function parsePositiveId(value) {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

function normalizeSocketError(
  error,
  fallback = "Có lỗi xảy ra",
) {
  return {
    success: false,
    message: error?.message || fallback,
    statusCode: error?.statusCode || 500,
  };
}

function safeAck(ack, payload) {
  if (typeof ack === "function") {
    ack(payload);
  }
}

async function buildRealtimeMessage({
  conversationId,
  senderId,
  messageType,
  content,
  fileUrl,
  persisted,
}) {
  const participants =
    await commModel.findParticipants(conversationId);

  const sender = participants.find(
    (participant) =>
      Number(participant.userId) === Number(senderId),
  );

  return {
    conversationId,
    messageId: persisted.messageId,
    senderId,
    senderName: sender?.fullName || "Người dùng",
    messageType,
    content: content || null,
    fileUrl: fileUrl || null,
    isDeleted: false,
    sentAt: persisted.sentAt,
    receipt: "SENT",
  };
}

async function emitConversationUpdated(
  conversationId,
  payload = {},
) {
  if (!io) return;

  const participants =
    await commModel.findParticipants(conversationId);

  participants.forEach((participant) => {
    io.to(userRoom(participant.userId)).emit(
      "conversation:updated",
      {
        conversationId,
        ...payload,
      },
    );
  });
}

async function emitNewMessage(message) {
  if (!io) return;

  io.to(conversationRoom(message.conversationId)).emit(
    "message:new",
    message,
  );

  await emitConversationUpdated(message.conversationId, {
    reason: "NEW_MESSAGE",
    message,
  });
}

async function emitReadReceipt({
  conversationId,
  userId,
  readAt,
}) {
  if (!io) return;

  const participants =
    await commModel.findParticipants(conversationId);

  const payload = {
    conversationId,
    userId,
    readAt,
  };

  participants.forEach((participant) => {
    io.to(userRoom(participant.userId)).emit(
      "message:read",
      payload,
    );
  });

  await emitConversationUpdated(conversationId, {
    reason: "READ",
    readerId: userId,
    readAt,
  });
}

async function emitDeletedMessage({
  conversationId,
  messageId,
  deletedBy,
}) {
  if (!io) return;

  const payload = {
    conversationId,
    messageId,
    deletedBy,
    deletedAt: new Date().toISOString(),
  };

  io.to(conversationRoom(conversationId)).emit(
    "message:deleted",
    payload,
  );

  await emitConversationUpdated(conversationId, {
    reason: "MESSAGE_DELETED",
    messageId,
  });
}

async function ensureParticipant(
  conversationId,
  userId,
) {
  const allowed = await commModel.isParticipant(
    conversationId,
    userId,
  );

  if (!allowed) {
    const error = new Error(
      "Bạn không thuộc cuộc trò chuyện này",
    );

    error.statusCode = 403;
    throw error;
  }
}

function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:
        process.env.FRONTEND_URL ||
        "http://localhost:5173",
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    try {
      const authToken =
        socket.handshake.auth?.token;

      const authorization =
        socket.handshake.headers?.authorization;

      const headerToken =
        authorization?.startsWith("Bearer ")
          ? authorization.slice(7)
          : null;

      const token = authToken || headerToken;

      if (!token) {
        return next(new Error("Chưa đăng nhập"));
      }

      const user = verifyToken(token);

      if (!user?.userId) {
        return next(
          new Error("Token không hợp lệ"),
        );
      }

      socket.user = user;

      return next();
    } catch {
      return next(
        new Error(
          "Token hết hạn hoặc không hợp lệ",
        ),
      );
    }
  });

  io.on("connection", (socket) => {
    const userId = Number(socket.user.userId);

    socket.join(userRoom(userId));

    socket.on(
      "conversation:join",
      async (payload = {}, ack) => {
        try {
          const conversationId =
            parsePositiveId(
              payload.conversationId,
            );

          if (!conversationId) {
            const error = new Error(
              "Cuộc trò chuyện không hợp lệ",
            );

            error.statusCode = 400;
            throw error;
          }

          await ensureParticipant(
            conversationId,
            userId,
          );

          await socket.join(
            conversationRoom(conversationId),
          );

          await commModel.markRead(
            conversationId,
            userId,
          );

          const readAt =
            new Date().toISOString();

          await emitReadReceipt({
            conversationId,
            userId,
            readAt,
          });

          safeAck(ack, {
            success: true,
            data: {
              conversationId,
              readAt,
            },
          });
        } catch (error) {
          safeAck(
            ack,
            normalizeSocketError(
              error,
              "Không thể mở cuộc trò chuyện",
            ),
          );
        }
      },
    );

    socket.on(
      "conversation:leave",
      (payload = {}) => {
        const conversationId =
          parsePositiveId(
            payload.conversationId,
          );

        if (conversationId) {
          socket.leave(
            conversationRoom(conversationId),
          );
        }
      },
    );

    socket.on(
      "message:send",
      async (payload = {}, ack) => {
        try {
          const conversationId =
            parsePositiveId(
              payload.conversationId,
            );

          if (!conversationId) {
            const error = new Error(
              "Cuộc trò chuyện không hợp lệ",
            );

            error.statusCode = 400;
            throw error;
          }

          const messageType = [
            "TEXT",
            "FILE",
            "IMAGE",
          ].includes(payload.messageType)
            ? payload.messageType
            : "TEXT";

          const persisted =
            await commService.sendMessage({
              userId,
              conversationId,
              messageType,
              content: payload.content,
              fileUrl: payload.fileUrl,
            });

          const message =
            await buildRealtimeMessage({
              conversationId,
              senderId: userId,
              messageType,
              content:
                payload.content?.trim() ||
                null,
              fileUrl:
                payload.fileUrl || null,
              persisted,
            });

          await emitNewMessage(message);

          safeAck(ack, {
            success: true,
            data: message,
          });
        } catch (error) {
          safeAck(
            ack,
            normalizeSocketError(
              error,
              "Không thể gửi tin nhắn",
            ),
          );
        }
      },
    );

    socket.on(
      "conversation:read",
      async (payload = {}, ack) => {
        try {
          const conversationId =
            parsePositiveId(
              payload.conversationId,
            );

          if (!conversationId) {
            const error = new Error(
              "Cuộc trò chuyện không hợp lệ",
            );

            error.statusCode = 400;
            throw error;
          }

          await ensureParticipant(
            conversationId,
            userId,
          );

          await commModel.markRead(
            conversationId,
            userId,
          );

          const readAt =
            new Date().toISOString();

          await emitReadReceipt({
            conversationId,
            userId,
            readAt,
          });

          safeAck(ack, {
            success: true,
            data: {
              conversationId,
              readAt,
            },
          });
        } catch (error) {
          safeAck(
            ack,
            normalizeSocketError(
              error,
              "Không thể đánh dấu đã đọc",
            ),
          );
        }
      },
    );

    socket.on(
      "typing:start",
      async (payload = {}) => {
        try {
          const conversationId =
            parsePositiveId(
              payload.conversationId,
            );

          if (!conversationId) return;

          await ensureParticipant(
            conversationId,
            userId,
          );

          socket
            .to(
              conversationRoom(
                conversationId,
              ),
            )
            .emit("typing:start", {
              conversationId,
              userId,
            });
        } catch {
          // Trạng thái đang nhập không quan trọng,
          // nên bỏ qua event không hợp lệ.
        }
      },
    );

    socket.on(
      "typing:stop",
      async (payload = {}) => {
        try {
          const conversationId =
            parsePositiveId(
              payload.conversationId,
            );

          if (!conversationId) return;

          await ensureParticipant(
            conversationId,
            userId,
          );

          socket
            .to(
              conversationRoom(
                conversationId,
              ),
            )
            .emit("typing:stop", {
              conversationId,
              userId,
            });
        } catch {
          // Trạng thái đang nhập không quan trọng,
          // nên bỏ qua event không hợp lệ.
        }
      },
    );

    socket.on(
      "message:delete",
      async (payload = {}, ack) => {
        try {
          const messageId =
            parsePositiveId(
              payload.messageId,
            );

          if (!messageId) {
            const error = new Error(
              "Tin nhắn không hợp lệ",
            );

            error.statusCode = 400;
            throw error;
          }

          const existing =
            await commModel.findMessageById(
              messageId,
            );

          if (!existing) {
            const error = new Error(
              "Không tìm thấy tin nhắn",
            );

            error.statusCode = 404;
            throw error;
          }

          await commService.deleteMessage({
            userId,
            messageId,
          });

          await emitDeletedMessage({
            conversationId:
              existing.conversationId,
            messageId,
            deletedBy: userId,
          });

          safeAck(ack, {
            success: true,
            data: {
              conversationId:
                existing.conversationId,
              messageId,
            },
          });
        } catch (error) {
          safeAck(
            ack,
            normalizeSocketError(
              error,
              "Không thể thu hồi tin nhắn",
            ),
          );
        }
      },
    );
  });

  return io;
}

function getSocketServer() {
  return io;
}

module.exports = {
  initializeSocket,
  getSocketServer,
  buildRealtimeMessage,
  emitNewMessage,
  emitReadReceipt,
  emitDeletedMessage,
};