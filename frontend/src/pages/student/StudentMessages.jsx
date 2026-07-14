import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Col,
  Row,
} from "react-bootstrap";

import {
  FiFile,
  FiImage,
  FiMessageSquare,
  FiPaperclip,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { studentApi } from "../../api/client";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilePreviewLink from "../../components/atoms/FilePreviewLink";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useAuth } from "../../context/useAuth";
import { useStudentThread } from "../../hooks/useStudentMessages";

import {
  emitSocketWithAck,
  getChatSocket,
} from "../../socket/chatSocket";

function getInitials(name) {
  if (!name) return "?";

  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`
    .toUpperCase();
}

function ConversationAvatar({
  name,
  tone = "orange",
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-[#08509F]"
      : tone === "green"
        ? "bg-green-50 text-green-700"
        : "bg-[#FFE7D6] text-[#F27123]";

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toneClass}`}
    >
      {getInitials(name)}
    </div>
  );
}

function getUniqueTeachers(
  teachers = [],
) {
  const map = new Map();

  teachers.forEach((teacher) => {
    const key =
      teacher.teacherUserId ||
      teacher.teacherId ||
      teacher.teacherName;

    if (!map.has(key)) {
      map.set(key, {
        ...teacher,
        subjects: [],
        isHomeroom:
          teacher.roleInClass ===
          "HOMEROOM_TEACHER",
      });
    }

    const current = map.get(key);

    if (
      teacher.roleInClass ===
      "HOMEROOM_TEACHER"
    ) {
      current.isHomeroom = true;
    }

    if (
      teacher.subjectName &&
      !current.subjects.includes(
        teacher.subjectName,
      )
    ) {
      current.subjects.push(
        teacher.subjectName,
      );
    }
  });

  return Array.from(map.values());
}

function parseMessageDate(value) {
  if (!value) return null;

  const date = new Date(
    String(value).replace(
      " ",
      "T",
    ),
  );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function formatMessageTime(value) {
  const date =
    parseMessageDate(value);

  if (!date) return "";

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function getMessageDateKey(value) {
  const date =
    parseMessageDate(value);

  if (!date) return "";

  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatMessageDate(value) {
  const date =
    parseMessageDate(value);

  if (!date) return "";

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function hasConversationHistory(
  conversation,
) {
  return Boolean(
    conversation.lastContent ||
    conversation.lastType ||
    conversation.lastSentAt ||
    conversation.lastMessageAt ||
    conversation.lastMessageId ||
    conversation.unreadCount > 0,
  );
}

function appendUniqueMessage(
  messages = [],
  message,
) {
  if (!message?.messageId) {
    return messages;
  }

  const exists = messages.some(
    (item) =>
      Number(item.messageId) ===
      Number(message.messageId),
  );

  if (exists) {
    return messages.map((item) =>
      Number(item.messageId) ===
        Number(message.messageId)
        ? {
          ...item,
          ...message,
        }
        : item,
    );
  }

  return [
    ...messages,
    message,
  ];
}

function MessageAttachment({
  message,
  isMine,
}) {
  if (
    !message.fileUrl ||
    message.isDeleted
  ) {
    return null;
  }

  if (
    message.messageType ===
    "IMAGE"
  ) {
    return (
      <a
        href={message.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block"
      >
        <img
          src={message.fileUrl}
          alt={
            message.content ||
            "Ảnh đính kèm"
          }
          className="max-h-72 max-w-full rounded-2xl object-contain"
        />
      </a>
    );
  }

  return (
    <div className="mt-2">
      <FilePreviewLink
        compact
        fileName={
          message.content ||
          "Tệp đính kèm"
        }
        fileUrl={message.fileUrl}
        className={
          isMine
            ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
            : ""
        }
      />
    </div>
  );
}

function MessageDateSeparator({
  sentAt,
}) {
  const dateLabel =
    formatMessageDate(sentAt);

  if (!dateLabel) return null;

  return (
    <div
      className="flex items-center gap-3 py-1"
      aria-label={`Ngày ${dateLabel}`}
    >
      <span className="h-px flex-1 bg-slate-200" />

      <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
        {dateLabel}
      </span>

      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  isGroup,
  onRecall,
}) {
  const hasText =
    Boolean(message.content);

  return (
    <div
      className={`flex w-full ${isMine
        ? "justify-end"
        : "justify-start"
        }`}
    >
      <div
        className={`group flex max-w-[72%] flex-col ${isMine
          ? "items-end"
          : "items-start"
          }`}
      >
        {isGroup && !isMine && (
          <p className="mb-1 text-xs font-bold text-slate-500">
            {message.senderName}
          </p>
        )}

        <div
          className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${isMine
            ? "rounded-br-md bg-[#F27123] text-white"
            : "rounded-bl-md bg-white text-[#0F2747]"
            }`}
        >
          {message.isDeleted ? (
            <p className="mb-0 italic opacity-80">
              Tin nhắn đã được thu hồi
            </p>
          ) : (
            <>
              {hasText && (
                <p className="mb-0 whitespace-pre-wrap leading-6">
                  {message.content}
                </p>
              )}

              {!hasText &&
                message.fileUrl && (
                  <p className="mb-0 flex items-center gap-2 font-semibold">
                    {message.messageType ===
                      "IMAGE" ? (
                      <FiImage />
                    ) : (
                      <FiFile />
                    )}

                    Tệp đính kèm
                  </p>
                )}

              <MessageAttachment
                message={message}
                isMine={isMine}
              />
            </>
          )}
        </div>

        <div
          className={`mt-1 flex items-center gap-2 text-[11px] text-slate-400 ${isMine
            ? "justify-end"
            : "justify-start"
            }`}
        >
          <span>
            {formatMessageTime(
              message.sentAt,
            )}
          </span>

          {isMine &&
            !message.isDeleted && (
              <span
                className={
                  message.receipt ===
                    "READ"
                    ? "font-semibold text-[#F27123]"
                    : "text-slate-400"
                }
              >
                {message.receipt ===
                  "READ"
                  ? "Đã đọc"
                  : "Đã gửi"}
              </span>
            )}

          {isMine &&
            !message.isDeleted && (
              <button
                type="button"
                onClick={() =>
                  onRecall(
                    message.messageId,
                  )
                }
                className="hidden text-slate-300 transition hover:text-red-500 group-hover:inline-flex"
                title="Thu hồi tin nhắn"
                aria-label="Thu hồi tin nhắn"
              >
                <FiTrash2 size={12} />
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

function SelectedFilePreview({
  file,
  onClear,
}) {
  if (!file) return null;

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-[#FFF7F2] px-4 py-3 text-sm text-[#0F2747]">
      <div className="flex min-w-0 items-center gap-2">
        {file.type?.startsWith(
          "image/",
        ) ? (
          <FiImage className="shrink-0 text-[#F27123]" />
        ) : (
          <FiFile className="shrink-0 text-[#F27123]" />
        )}

        <span className="min-w-0 truncate font-semibold">
          {file.name}
        </span>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-slate-400 transition hover:text-red-600"
        aria-label="Bỏ file"
      >
        <FiTrash2 size={16} />
      </button>
    </div>
  );
}

function ThreadPanel({
  conversationId,
  selectedConversation,
  onConversationChanged,
}) {
  const { user } = useAuth();

  const fileInputRef =
    useRef(null);

  const scrollContainerRef =
    useRef(null);

  const typingTimeoutRef =
    useRef(null);

  const [content, setContent] =
    useState("");

  const [
    selectedFile,
    setSelectedFile,
  ] = useState(null);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    sendError,
    setSendError,
  ] = useState("");

  const [
    socketConnected,
    setSocketConnected,
  ] = useState(false);

  const [
    typingUserIds,
    setTypingUserIds,
  ] = useState([]);

  const {
    data,
    setData,
    loading,
    error,
    reload,
  } = useStudentThread(
    conversationId,
  );

  const messages =
    data?.messages || [];

  const participants = useMemo(
    () => data?.participants || [],
    [data?.participants],
  );

  const meta = data?.meta;

  const isGroup =
    meta?.conversationType ===
    "GROUP" ||
    selectedConversation
      ?.conversationType ===
    "GROUP";

  const otherParticipant =
    participants.find(
      (participant) =>
        Number(
          participant.userId,
        ) !==
        Number(user?.userId),
    );

  const chatName =
    selectedConversation?.title ||
    selectedConversation?.displayName ||
    meta?.title ||
    otherParticipant?.fullName ||
    "Cuộc trò chuyện";

  const chatSubtitle = isGroup
    ? "Nhóm trò chuyện"
    : "Tin nhắn trực tiếp";

  const typingNames = useMemo(
    () =>
      participants
        .filter((participant) =>
          typingUserIds.includes(
            Number(
              participant.userId,
            ),
          ),
        )
        .map(
          (participant) =>
            participant.fullName,
        )
        .filter(Boolean),
    [
      participants,
      typingUserIds,
    ],
  );

  const markConversationRead =
    useCallback(() => {
      if (!conversationId) return;

      emitSocketWithAck(
        "conversation:read",
        {
          conversationId,
        },
      ).catch(() => { });
    }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      return undefined;
    }

    const socket =
      getChatSocket();

    const handleConnect = () => {
      setSocketConnected(true);

      socket.emit(
        "conversation:join",
        {
          conversationId,
        },
        () => { },
      );
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleConnectError = () => {
      setSocketConnected(false);
    };

    const handleNewMessage = (
      message,
    ) => {
      if (
        Number(
          message.conversationId,
        ) !==
        Number(conversationId)
      ) {
        return;
      }

      setData((current) => {
        if (!current) return current;

        return {
          ...current,
          messages:
            appendUniqueMessage(
              current.messages,
              message,
            ),
        };
      });

      if (
        Number(message.senderId) !==
        Number(user?.userId)
      ) {
        markConversationRead();
      }

      onConversationChanged();
    };

    const handleReadReceipt = ({
      conversationId:
      receiptConversationId,
      userId: readerId,
      readAt,
    }) => {
      if (
        Number(
          receiptConversationId,
        ) !==
        Number(conversationId) ||
        Number(readerId) ===
        Number(user?.userId)
      ) {
        return;
      }

      const readTime =
        parseMessageDate(
          readAt,
        )?.getTime();

      if (!readTime) return;

      setData((current) => {
        if (!current) return current;

        return {
          ...current,

          messages:
            current.messages.map(
              (message) => {
                if (
                  Number(
                    message.senderId,
                  ) !==
                  Number(
                    user?.userId,
                  )
                ) {
                  return message;
                }

                const sentTime =
                  parseMessageDate(
                    message.sentAt,
                  )?.getTime();

                if (
                  !sentTime ||
                  sentTime > readTime
                ) {
                  return message;
                }

                return {
                  ...message,
                  receipt: "READ",
                };
              },
            ),
        };
      });
    };

    const handleDeletedMessage = ({
      conversationId:
      deletedConversationId,
      messageId,
    }) => {
      if (
        Number(
          deletedConversationId,
        ) !==
        Number(conversationId)
      ) {
        return;
      }

      setData((current) => {
        if (!current) return current;

        return {
          ...current,

          messages:
            current.messages.map(
              (message) =>
                Number(
                  message.messageId,
                ) ===
                  Number(messageId)
                  ? {
                    ...message,
                    isDeleted: true,
                    content: null,
                    fileUrl: null,
                  }
                  : message,
            ),
        };
      });

      onConversationChanged();
    };

    const handleTypingStart = ({
      conversationId:
      typingConversationId,
      userId: typingUserId,
    }) => {
      if (
        Number(
          typingConversationId,
        ) !==
        Number(conversationId) ||
        Number(typingUserId) ===
        Number(user?.userId)
      ) {
        return;
      }

      setTypingUserIds(
        (current) =>
          current.includes(
            Number(typingUserId),
          )
            ? current
            : [
              ...current,
              Number(
                typingUserId,
              ),
            ],
      );
    };

    const handleTypingStop = ({
      conversationId:
      typingConversationId,
      userId: typingUserId,
    }) => {
      if (
        Number(
          typingConversationId,
        ) !==
        Number(conversationId)
      ) {
        return;
      }

      setTypingUserIds(
        (current) =>
          current.filter(
            (currentId) =>
              currentId !==
              Number(
                typingUserId,
              ),
          ),
      );
    };

    socket.on(
      "connect",
      handleConnect,
    );

    socket.on(
      "disconnect",
      handleDisconnect,
    );

    socket.on(
      "connect_error",
      handleConnectError,
    );

    socket.on(
      "message:new",
      handleNewMessage,
    );

    socket.on(
      "message:read",
      handleReadReceipt,
    );

    socket.on(
      "message:deleted",
      handleDeletedMessage,
    );

    socket.on(
      "typing:start",
      handleTypingStart,
    );

    socket.on(
      "typing:stop",
      handleTypingStop,
    );

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      if (
        typingTimeoutRef.current
      ) {
        window.clearTimeout(
          typingTimeoutRef.current,
        );
      }

      socket.emit(
        "typing:stop",
        {
          conversationId,
        },
      );

      socket.emit(
        "conversation:leave",
        {
          conversationId,
        },
      );

      socket.off(
        "connect",
        handleConnect,
      );

      socket.off(
        "disconnect",
        handleDisconnect,
      );

      socket.off(
        "connect_error",
        handleConnectError,
      );

      socket.off(
        "message:new",
        handleNewMessage,
      );

      socket.off(
        "message:read",
        handleReadReceipt,
      );

      socket.off(
        "message:deleted",
        handleDeletedMessage,
      );

      socket.off(
        "typing:start",
        handleTypingStart,
      );

      socket.off(
        "typing:stop",
        handleTypingStop,
      );
    };
  }, [
    conversationId,
    markConversationRead,
    onConversationChanged,
    setData,
    user?.userId,
  ]);

  useEffect(() => {
    if (
      !scrollContainerRef.current
    ) {
      return;
    }

    scrollContainerRef.current.scrollTop =
      scrollContainerRef.current
        .scrollHeight;
  }, [
    messages.length,
    conversationId,
  ]);

  function handleContentChange(
    event,
  ) {
    const nextContent =
      event.target.value;

    setContent(nextContent);

    if (!conversationId) return;

    const socket =
      getChatSocket();

    if (nextContent.trim()) {
      socket.emit(
        "typing:start",
        {
          conversationId,
        },
      );

      if (
        typingTimeoutRef.current
      ) {
        window.clearTimeout(
          typingTimeoutRef.current,
        );
      }

      typingTimeoutRef.current =
        window.setTimeout(() => {
          socket.emit(
            "typing:stop",
            {
              conversationId,
            },
          );
        }, 1200);
    } else {
      socket.emit(
        "typing:stop",
        {
          conversationId,
        },
      );
    }
  }

  async function sendMessage(
    event,
  ) {
    event.preventDefault();

    if (
      !conversationId ||
      (!content.trim() &&
        !selectedFile)
    ) {
      return;
    }

    setSubmitting(true);
    setSendError("");

    try {
      let payload = {
        conversationId,
        messageType: "TEXT",
        content: content.trim(),
        fileUrl: null,
      };

      if (selectedFile) {
        const uploadResponse =
          await studentApi.uploadMessageFile(
            selectedFile,
          );

        const uploaded =
          uploadResponse.data;

        payload = {
          conversationId,
          messageType:
            uploaded.messageType,
          content:
            content.trim() ||
            uploaded.fileName,
          fileUrl:
            uploaded.fileUrl,
        };
      }

      const sentMessage =
        await emitSocketWithAck(
          "message:send",
          payload,
        );

      setData((current) => {
        if (!current) return current;

        return {
          ...current,

          messages:
            appendUniqueMessage(
              current.messages,
              sentMessage,
            ),
        };
      });

      setContent("");
      setSelectedFile(null);

      const socket =
        getChatSocket();

      socket.emit(
        "typing:stop",
        {
          conversationId,
        },
      );

      if (
        typingTimeoutRef.current
      ) {
        window.clearTimeout(
          typingTimeoutRef.current,
        );
      }

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }

      onConversationChanged();
    } catch (requestError) {
      setSendError(
        requestError.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function recallMessage(
    messageId,
  ) {
    const confirmed =
      window.confirm(
        "Bạn có chắc muốn thu hồi tin nhắn này?",
      );

    if (!confirmed) return;

    try {
      await emitSocketWithAck(
        "message:delete",
        {
          messageId,
        },
      );
    } catch (requestError) {
      setSendError(
        requestError.message,
      );

      reload();
    }
  }

  if (!conversationId) {
    return (
      <div className="flex h-[calc(100vh-180px)] min-h-[680px] max-h-[820px] w-full items-center justify-center rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm">
        <div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
            <FiMessageSquare
              size={28}
            />
          </div>

          <p className="mb-0 text-sm text-slate-500">
            Chọn một cuộc trò chuyện
            để bắt đầu nhắn tin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[680px] max-h-[820px] w-full flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-orange-100 bg-white px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <ConversationAvatar
            name={chatName}
            tone={
              isGroup
                ? "green"
                : "orange"
            }
          />

          <div className="min-w-0">
            <h3 className="mb-1 truncate text-xl font-bold text-[#0F2747]">
              {chatName}
            </h3>

            <p className="mb-0 text-xs text-slate-500">
              {typingNames.length >
                0
                ? `${typingNames.join(", ")} đang nhập...`
                : `${chatSubtitle} · ${socketConnected
                  ? "Đang kết nối realtime"
                  : "Đang kết nối lại"
                }`}
            </p>
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] px-6 py-5"
      >
        {loading && (
          <LoadingState label="Đang tải tin nhắn..." />
        )}

        {!loading && error && (
          <ErrorAlert error={error} />
        )}

        {!loading &&
          !error &&
          messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                title="Chưa có tin nhắn"
                description="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện."
              />
            </div>
          )}

        {!loading &&
          !error &&
          messages.map(
            (
              message,
              index,
            ) => {
              const isMine =
                Number(
                  message.senderId,
                ) ===
                Number(
                  user?.userId,
                );

              const previousMessage =
                messages[
                index - 1
                ];

              const currentDateKey =
                getMessageDateKey(
                  message.sentAt,
                );

              const previousDateKey =
                getMessageDateKey(
                  previousMessage
                    ?.sentAt,
                );

              const showDateSeparator =
                Boolean(
                  currentDateKey,
                ) &&
                currentDateKey !==
                previousDateKey;

              return (
                <div
                  key={
                    message.messageId
                  }
                  className="space-y-4"
                >
                  {showDateSeparator && (
                    <MessageDateSeparator
                      sentAt={
                        message.sentAt
                      }
                    />
                  )}

                  <MessageBubble
                    message={message}
                    isMine={isMine}
                    isGroup={isGroup}
                    onRecall={
                      recallMessage
                    }
                  />
                </div>
              );
            },
          )}
      </div>

      <form
        onSubmit={sendMessage}
        className="border-t border-orange-100 bg-white px-5 py-4"
      >
        {sendError && (
          <p className="mb-3 text-sm text-red-600">
            {sendError}
          </p>
        )}

        <SelectedFilePreview
          file={selectedFile}
          onClear={() => {
            setSelectedFile(null);

            if (
              fileInputRef.current
            ) {
              fileInputRef.current.value =
                "";
            }
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) =>
            setSelectedFile(
              event.target.files?.[0] ||
              null,
            )
          }
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={submitting}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center !rounded-full border border-orange-100 bg-[#FFF7F2] text-[#F27123] transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Đính kèm tệp"
          >
            <FiPaperclip
              size={18}
            />
          </button>

          <input
            value={content}
            onChange={
              handleContentChange
            }
            placeholder={
              selectedFile
                ? "Ghi chú cho file đính kèm..."
                : "Nhập tin nhắn..."
            }
            className="h-12 min-w-0 flex-1 !rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
          />

          <button
            type="submit"
            disabled={
              submitting ||
              !socketConnected ||
              (!content.trim() &&
                !selectedFile)
            }
            className="inline-flex h-12 items-center justify-center gap-2 !rounded-full bg-[#F27123] px-5 text-sm font-bold text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSend size={16} />

            {submitting
              ? "Đang gửi..."
              : "Gửi"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NewConversationModal({
  open,
  onClose,
  groups,
  teachers,
  searchValue,
  setSearchValue,
  onOpenGroup,
  onStartTeacher,
}) {
  if (!open) return null;

  const hasSearchKeyword = Boolean(
    searchValue.trim(),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-6">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden !rounded-3xl bg-white shadow-2xl">
        {/* Thanh tìm kiếm chung và nút đóng */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="relative min-w-0 flex-1">
            <FiSearch
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={searchValue}
              onChange={(event) =>
                setSearchValue(event.target.value)
              }
              placeholder="Tìm nhóm hoặc giáo viên..."
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-10 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
            />

            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-[#F27123]"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <FiX size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchValue("");
              onClose();
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
            aria-label="Đóng"
          >
            <FiX size={21} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
          {/* Danh sách nhóm */}
          <div className="mb-7">
            <p className="mb-4 text-xs font-black uppercase tracking-wide text-slate-400">
              Nhóm
            </p>

            {groups.length > 0 ? (
              <Row className="g-3">
                {groups.map((group) => (
                  <Col
                    key={group.conversationId}
                    xs={12}
                    md={6}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenGroup(group)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-orange-200 hover:bg-[#FFF7F2]"
                    >
                      <ConversationAvatar
                        name={group.title}
                        tone="green"
                      />

                      <div className="min-w-0">
                        <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                          {group.title}
                        </p>

                        <p className="mb-0 truncate text-xs text-slate-500">
                          <FiUsers className="mr-1 inline" />
                          {group.memberCount || 0} thành viên
                        </p>
                      </div>
                    </button>
                  </Col>
                ))}
              </Row>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                {hasSearchKeyword
                  ? "Không tìm thấy nhóm phù hợp."
                  : "Chưa có nhóm lớp hoặc nhóm nội trú."}
              </div>
            )}
          </div>

          {/* Danh sách giáo viên */}
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-wide text-slate-400">
              Giáo viên
            </p>

            {teachers.length > 0 ? (
              <Row className="g-3">
                {teachers.map((teacher) => {
                  const roleLabel = teacher.isHomeroom
                    ? "Giáo viên chủ nhiệm"
                    : "Giáo viên bộ môn";

                  const subjectLabel =
                    teacher.subjects?.length > 0
                      ? ` · ${teacher.subjects.join(", ")}`
                      : "";

                  return (
                    <Col
                      key={
                        teacher.teacherUserId ||
                        teacher.teacherId ||
                        teacher.teacherName
                      }
                      xs={12}
                      md={6}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onStartTeacher(teacher)
                        }
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-orange-200 hover:bg-[#FFF7F2]"
                      >
                        <ConversationAvatar
                          name={teacher.teacherName}
                          tone="blue"
                        />

                        <div className="min-w-0">
                          <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                            {teacher.teacherName}
                          </p>

                          <p className="mb-0 truncate text-xs text-slate-500">
                            {roleLabel}
                            {subjectLabel}
                          </p>
                        </div>
                      </button>
                    </Col>
                  );
                })}
              </Row>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                {hasSearchKeyword
                  ? "Không tìm thấy giáo viên phù hợp."
                  : "Chưa có giáo viên để trò chuyện."}
              </div>
            )}
          </div>

          {hasSearchKeyword &&
            groups.length === 0 &&
            teachers.length === 0 && (
              <div className="mt-5 rounded-2xl bg-[#FFF7F2] px-4 py-3 text-center text-sm text-[#F27123]">
                Không có nhóm hoặc giáo viên nào khớp với “
                {searchValue}”.
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function StudentMessages() {
  const [
    contacts,
    setContacts,
  ] = useState(null);

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [context, setContext] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState(null);

  const [
    selectedConversation,
    setSelectedConversation,
  ] = useState(null);

  const [
    contactSearch,
    setContactSearch,
  ] = useState("");

  const [
    conversationSearch,
    setConversationSearch,
  ] = useState("");

  const [
    showNewConversation,
    setShowNewConversation,
  ] = useState(false);

  const refreshConversations =
    useCallback(() => {
      setRefreshKey(
        (key) => key + 1,
      );
    }, []);

  useEffect(() => {
    const socket =
      getChatSocket();

    const handleConversationUpdated =
      () => {
        refreshConversations();
      };

    socket.on(
      "conversation:updated",
      handleConversationUpdated,
    );

    return () => {
      socket.off(
        "conversation:updated",
        handleConversationUpdated,
      );
    };
  }, [refreshConversations]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      studentApi.getMessageContacts(),

      studentApi.listConversations({
        archived: false,
        search:
          conversationSearch,
      }),
    ])
      .then(
        ([
          contactsResponse,
          conversationsResponse,
        ]) => {
          if (!isMounted) return;

          setError("");

          setContacts(
            contactsResponse.data,
          );

          setContext(
            contactsResponse.data
              .context,
          );

          setConversations(
            conversationsResponse
              .data.items || [],
          );
        },
      )
      .catch((requestError) => {
        if (isMounted) {
          setError(
            requestError.message,
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    refreshKey,
    conversationSearch,
  ]);

  const teachers = useMemo(
    () =>
      getUniqueTeachers(
        contacts?.teachers || [],
      ),
    [contacts],
  );

  const groups = useMemo(
    () => contacts?.groups || [],
    [contacts],
  );

  const filteredGroups = useMemo(() => {
    const keyword = contactSearch
      .trim()
      .toLowerCase();

    if (!keyword) {
      return groups;
    }

    return groups.filter((group) => {
      const searchableText = [
        group.title,
        group.groupName,
        group.className,
        group.areaName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [groups, contactSearch]);

  const filteredTeachers = useMemo(() => {
    const keyword = contactSearch
      .trim()
      .toLowerCase();

    if (!keyword) {
      return teachers;
    }

    return teachers.filter((teacher) => {
      const roleLabel = teacher.isHomeroom
        ? "giáo viên chủ nhiệm"
        : "giáo viên bộ môn";

      const searchableText = [
        teacher.teacherName,
        teacher.teacherCode,
        roleLabel,
        ...(teacher.subjects || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [teachers, contactSearch]);

  const visibleConversations =
    useMemo(
      () =>
        conversations.filter(
          hasConversationHistory,
        ),
      [conversations],
    );

  async function startTeacherConversation(
    teacher,
  ) {
    try {
      const response =
        await studentApi.startConversation(
          teacher.teacherUserId,
        );

      const conversation = {
        conversationId:
          response.data
            .conversationId,
        conversationType:
          "TEACHER_STUDENT",
        displayName:
          teacher.teacherName,
        title:
          teacher.teacherName,
      };

      setActiveConversationId(
        response.data.conversationId,
      );

      setSelectedConversation(
        conversation,
      );

      setShowNewConversation(
        false,
      );

      refreshConversations();
    } catch (requestError) {
      setError(
        requestError.message,
      );
    }
  }

  function openConversation(
    conversation,
  ) {
    setActiveConversationId(
      conversation.conversationId,
    );

    setSelectedConversation(
      conversation,
    );
  }

  function openGroupConversation(
    group,
  ) {
    openConversation({
      ...group,
      conversationType: "GROUP",
      displayName: group.title,
      title: group.title,
    });

    setShowNewConversation(false);
  }

  return (
    <StudentDashboardShell
      context={context}
    >
      {loading && (
        <LoadingState label="Đang tải tin nhắn..." />
      )}

      {!loading && error && (
        <ErrorAlert
          error={`Không tải được tin nhắn: ${error}`}
        />
      )}

      {!loading && !error && (
        <>
          <Row className="g-3 items-stretch">
            <Col
              xs={12}
              xl={5}
              xxl={4}
              className="flex"
            >
              <aside className="flex h-[calc(100vh-180px)] min-h-[680px] max-h-[820px] w-full flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
                <div className="px-5 py-5">
                  <div className="flex items-center gap-3">
                    <div className="relative min-w-0 flex-1">
                      <FiSearch
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        value={
                          conversationSearch
                        }
                        onChange={(
                          event,
                        ) =>
                          setConversationSearch(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Tìm cuộc trò chuyện..."
                        className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowNewConversation(
                          true,
                        )
                      }
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center !rounded-full bg-[#F27123] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#d95f17]"
                      title="Tạo cuộc trò chuyện mới"
                      aria-label="Tạo cuộc trò chuyện mới"
                    >
                      <FiUserPlus
                        size={19}
                      />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  {visibleConversations.length >
                    0 ? (
                    <div className="space-y-2">
                      {visibleConversations.map(
                        (
                          conversation,
                        ) => (
                          <button
                            key={
                              conversation.conversationId
                            }
                            type="button"
                            onClick={() =>
                              openConversation(
                                conversation,
                              )
                            }
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${activeConversationId ===
                              conversation.conversationId
                              ? "bg-[#FFF7F2]"
                              : "hover:bg-slate-50"
                              }`}
                          >
                            <ConversationAvatar
                              name={
                                conversation.displayName
                              }
                              tone={
                                conversation.conversationType ===
                                  "GROUP"
                                  ? "green"
                                  : "orange"
                              }
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                                  {
                                    conversation.displayName
                                  }
                                </p>

                                {conversation.unreadCount >
                                  0 && (
                                    <span className="rounded-full bg-[#F27123] px-2 py-0.5 text-[11px] font-bold text-white">
                                      {
                                        conversation.unreadCount
                                      }
                                    </span>
                                  )}
                              </div>

                              <p className="mb-0 truncate text-xs text-slate-500">
                                {conversation.lastType ===
                                  "IMAGE"
                                  ? "Ảnh đính kèm"
                                  : conversation.lastType ===
                                    "FILE"
                                    ? "Tệp đính kèm"
                                    : conversation.lastContent ||
                                    "Chưa có tin nhắn"}
                              </p>
                            </div>
                          </button>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center">
                      <div>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
                          <FiMessageSquare
                            size={24}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setShowNewConversation(
                              true,
                            )
                          }
                          className="inline-flex items-center gap-2 !rounded-full bg-[#F27123] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#d95f17]"
                        >
                          <FiUserPlus
                            size={16}
                          />

                          Tạo cuộc trò
                          chuyện
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </Col>

            <Col
              xs={12}
              xl={7}
              xxl={8}
              className="flex"
            >
              <ThreadPanel
                conversationId={
                  activeConversationId
                }
                selectedConversation={
                  selectedConversation
                }
                onConversationChanged={
                  refreshConversations
                }
              />
            </Col>
          </Row>

          <NewConversationModal
            open={showNewConversation}
            onClose={() =>
              setShowNewConversation(false)
            }
            groups={filteredGroups}
            teachers={filteredTeachers}
            searchValue={contactSearch}
            setSearchValue={setContactSearch}
            onOpenGroup={openGroupConversation}
            onStartTeacher={startTeacherConversation}
          />
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentMessages;