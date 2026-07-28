import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiArchive,
  FiArrowLeft,
  FiFile,
  FiImage,
  FiInbox,
  FiMessageSquare,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";

import { communicationApi } from "../../api/client";
import FilePreviewLink from "../../components/atoms/FilePreviewLink";
import EmptyState from "../../components/molecules/EmptyState";
import GroupConversationModal from "../../components/organisms/GroupConversationModal";
import NewConversationModal from "../../components/organisms/NewConversationModal";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";

import {
  emitSocketWithAck,
  getChatSocket,
} from "../../socket/chatSocket";

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
  const date = parseMessageDate(value);

  if (!date) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitials(name) {
  if (!name) return "?";

  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

// Avatar hội thoại — dùng ảnh thật nếu có, không thì chữ cái đầu theo tông màu.
function ConversationAvatar({
  name,
  src,
  isGroup = false,
  tone = "orange",
}) {
  if (src && !isGroup) {
    return (
      <img
        src={src}
        alt={name || "Ảnh đại diện"}
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    );
  }

  const toneClass = isGroup
    ? "bg-green-50 text-green-700"
    : tone === "blue"
      ? "bg-blue-50 text-[#08509F]"
      : "bg-[#FFE7D6] text-[#F27123]";

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toneClass}`}
    >
      {isGroup ? <FiUsers size={18} /> : getInitials(name)}
    </div>
  );
}

function MessageAttachment({ message, isMine }) {
  if (!message.fileUrl || message.isDeleted) return null;

  if (message.messageType === "IMAGE") {
    return (
      <a
        href={message.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block"
      >
        <img
          src={message.fileUrl}
          alt={message.content || "Ảnh đính kèm"}
          className="max-h-72 max-w-full rounded-2xl object-contain"
        />
      </a>
    );
  }

  return (
    <div className="mt-2">
      <FilePreviewLink
        compact
        fileName={message.content || "Tệp đính kèm"}
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

function appendUniqueMessage(
  messages = [],
  message,
) {
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

function MessagesPage() {
  const { user } = useAuth();

  const [
    contacts,
    setContacts,
  ] = useState({
    students: [],
    parents: [],
    classes: [],
  });

  const [stats, setStats] =
    useState({
      totalConversations: 0,
      unreadMessages: 0,
    });

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [search, setSearch] =
    useState("");

  const [
    activeId,
    setActiveId,
  ] = useState(null);

  const [thread, setThread] =
    useState(null);

  const [
    threadLoading,
    setThreadLoading,
  ] = useState(false);

  const [input, setInput] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  const [
    showArchived,
    setShowArchived,
  ] = useState(false);

  const [showNew, setShowNew] =
    useState(false);

  const [
    showGroup,
    setShowGroup,
  ] = useState(false);

  const [
    socketConnected,
    setSocketConnected,
  ] = useState(false);

  const [
    typingUserIds,
    setTypingUserIds,
  ] = useState([]);

  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef =
    useRef(null);

  const refresh = useCallback(
    () => {
      setRefreshKey(
        (current) =>
          current + 1,
      );
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      communicationApi.getContacts(),
      communicationApi.getDashboard(),
    ])
      .then(
        ([
          contactsResponse,
          dashboardResponse,
        ]) => {
          if (!isMounted) return;

          setContacts(
            contactsResponse.data,
          );

          setStats(
            dashboardResponse.data
              .stats,
          );
        },
      )
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let isMounted = true;

    communicationApi
      .listConversations({
        search,
        archived: showArchived,
        limit: 30,
      })
      .then((response) => {
        if (isMounted) {
          setConversations(
            response.data.items,
          );
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [
    search,
    showArchived,
    refreshKey,
  ]);

  useEffect(() => {
    if (!activeId) {
      setThread(null);
      return undefined;
    }

    let isMounted = true;

    setThreadLoading(true);

    communicationApi
      .getThread(activeId, {
        limit: 100,
      })
      .then((response) => {
        if (isMounted) {
          setThread(
            response.data,
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setThreadLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeId]);

  useEffect(() => {
    const socket =
      getChatSocket();

    const handleConnect = () => {
      setSocketConnected(true);

      if (activeId) {
        socket.emit(
          "conversation:join",
          {
            conversationId:
              activeId,
          },
        );
      }
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleConversationUpdated =
      () => {
        refresh();
      };

    const handleNewMessage = (
      message,
    ) => {
      if (
        Number(
          message.conversationId,
        ) !== Number(activeId)
      ) {
        return;
      }

      setThread((current) => {
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
        emitSocketWithAck(
          "conversation:read",
          {
            conversationId:
              activeId,
          },
        ).catch(() => {});
      }
    };

    const handleRead = ({
      conversationId,
      userId: readerId,
      readAt,
    }) => {
      if (
        Number(conversationId) !==
          Number(activeId) ||
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

      setThread((current) => {
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

                return sentTime &&
                  sentTime <= readTime
                  ? {
                      ...message,
                      receipt: "READ",
                    }
                  : message;
              },
            ),
        };
      });
    };

    const handleDeleted = ({
      conversationId,
      messageId,
    }) => {
      if (
        Number(conversationId) !==
        Number(activeId)
      ) {
        return;
      }

      setThread((current) => {
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
    };

    const handleTypingStart = ({
      conversationId,
      userId: typingUserId,
    }) => {
      if (
        Number(conversationId) !==
          Number(activeId) ||
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
      conversationId,
      userId: typingUserId,
    }) => {
      if (
        Number(conversationId) !==
        Number(activeId)
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
      handleDisconnect,
    );

    socket.on(
      "conversation:updated",
      handleConversationUpdated,
    );

    socket.on(
      "message:new",
      handleNewMessage,
    );

    socket.on(
      "message:read",
      handleRead,
    );

    socket.on(
      "message:deleted",
      handleDeleted,
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
        handleDisconnect,
      );

      socket.off(
        "conversation:updated",
        handleConversationUpdated,
      );

      socket.off(
        "message:new",
        handleNewMessage,
      );

      socket.off(
        "message:read",
        handleRead,
      );

      socket.off(
        "message:deleted",
        handleDeleted,
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
    activeId,
    refresh,
    user?.userId,
  ]);

  useEffect(() => {
    const socket =
      getChatSocket();

    if (!activeId) {
      return undefined;
    }

    socket.emit(
      "conversation:join",
      {
        conversationId:
          activeId,
      },
    );

    return () => {
      socket.emit(
        "typing:stop",
        {
          conversationId:
            activeId,
        },
      );

      socket.emit(
        "conversation:leave",
        {
          conversationId:
            activeId,
        },
      );
    };
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current
          .scrollHeight;
    }
  }, [
    thread?.messages?.length,
    activeId,
  ]);

  const headerUser = useMemo(
    () => {
      const roleEntry =
        user?.roles?.find(
          (role) =>
            [
              "HOMEROOM_TEACHER",
              "SUBJECT_TEACHER",
              "DORM_SUPERVISOR",
            ].includes(
              role.roleName,
            ),
        );

      return {
        name:
          user?.fullName ??
          user?.username ??
          "Giáo viên",

        role:
          roleEntry?.description ??
          "Giáo viên",

        avatar:
          user?.avatar ?? "",
      };
    },
    [user],
  );

  const typingNames = useMemo(
    () =>
      (
        thread?.participants ||
        []
      )
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
      thread?.participants,
      typingUserIds,
    ],
  );

  async function handleArchive(
    conversationId,
    archived,
  ) {
    try {
      await communicationApi.archiveConversation(
        conversationId,
        archived,
      );

      if (
        activeId === conversationId
      ) {
        setActiveId(null);
      }

      refresh();
    } catch (error) {
      window.alert(
        error.message,
      );
    }
  }

  async function handleSend() {
    if (
      !input.trim() ||
      !activeId ||
      !socketConnected
    ) {
      return;
    }

    setSending(true);

    try {
      const message =
        await emitSocketWithAck(
          "message:send",
          {
            conversationId:
              activeId,
            messageType: "TEXT",
            content: input.trim(),
          },
        );

      setThread((current) => {
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

      setInput("");

      getChatSocket().emit(
        "typing:stop",
        {
          conversationId:
            activeId,
        },
      );
    } catch (error) {
      window.alert(
        error.message,
      );
    } finally {
      setSending(false);
    }
  }

  async function handleFile(
    file,
  ) {
    if (
      !file ||
      !activeId ||
      !socketConnected
    ) {
      return;
    }

    setUploading(true);

    try {
      const uploadResponse =
        await communicationApi.uploadFile(
          file,
        );

      const uploaded =
        uploadResponse.data;

      const message =
        await emitSocketWithAck(
          "message:send",
          {
            conversationId:
              activeId,
            messageType:
              uploaded.messageType,
            fileUrl:
              uploaded.fileUrl,
            content:
              uploaded.fileName,
          },
        );

      setThread((current) => {
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
    } catch (error) {
      window.alert(
        error.message,
      );
    } finally {
      setUploading(false);

      if (fileRef.current) {
        fileRef.current.value =
          "";
      }
    }
  }

  async function handleRecall(
    messageId,
  ) {
    if (
      !window.confirm(
        "Thu hồi tin nhắn này?",
      )
    ) {
      return;
    }

    try {
      await emitSocketWithAck(
        "message:delete",
        {
          messageId,
        },
      );
    } catch (error) {
      window.alert(
        error.message,
      );
    }
  }

  function handleInputChange(
    event,
  ) {
    const value =
      event.target.value;

    setInput(value);

    if (!activeId) return;

    const socket =
      getChatSocket();

    if (value.trim()) {
      socket.emit(
        "typing:start",
        {
          conversationId:
            activeId,
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
              conversationId:
                activeId,
            },
          );
        }, 1200);
    } else {
      socket.emit(
        "typing:stop",
        {
          conversationId:
            activeId,
        },
      );
    }
  }

  function openConversation(id) {
    setActiveId(id);
    setTypingUserIds([]);
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Tin chưa đọc"
      sidebarFooterValue={String(stats.unreadMessages)}
    >
      {/* Thanh tiêu đề + hành động */}
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-orange-100 bg-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="mb-1 text-2xl font-black text-[#0F2747]">
            Liên lạc
          </h1>

          <p className="mb-0 text-sm text-slate-500">
            {stats.totalConversations} cuộc trò chuyện ·{" "}
            {stats.unreadMessages} chưa đọc ·{" "}
            <span
              className={
                socketConnected
                  ? "font-bold text-green-600"
                  : "font-bold text-amber-600"
              }
            >
              {socketConnected ? "Realtime" : "Đang kết nối lại"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowGroup(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#08509F] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:bg-[#063f7d]"
          >
            <FiUsers size={15} />
            Tạo nhóm
          </button>

          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#F27123] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:bg-[#d95f17]"
          >
            <FiPlus size={15} />
            Soạn tin
          </button>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        {/* ── Cột trái: danh sách hội thoại ── */}
        <aside
          className={`min-h-[650px] overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm ${
            activeId ? "hidden xl:block" : "block"
          }`}
        >
          <div className="border-b border-orange-100 px-5 py-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="mb-0 text-xl font-black text-[#0F2747]">
                Tin nhắn
              </h2>

              <button
                type="button"
                onClick={refresh}
                title="Tải lại"
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-50 hover:text-[#F27123]"
              >
                <FiRefreshCw size={17} />
              </button>
            </div>

            <div className="mb-3 flex rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setShowArchived(false);
                  setActiveId(null);
                }}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${
                  !showArchived
                    ? "bg-white text-[#F27123] shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <FiInbox className="mr-1 inline" />
                Đang mở
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowArchived(true);
                  setActiveId(null);
                }}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${
                  showArchived
                    ? "bg-white text-[#F27123] shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <FiArchive className="mr-1 inline" />
                Lưu trữ
              </button>
            </div>

            <div className="relative">
              <FiSearch
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm cuộc trò chuyện..."
                className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </div>
          </div>

          <div className="h-[560px] overflow-y-auto px-4 py-4">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
              Cuộc trò chuyện
            </p>

            {conversations.length === 0 ? (
              <EmptyState
                title={
                  showArchived
                    ? "Chưa có cuộc trò chuyện lưu trữ"
                    : "Chưa có cuộc trò chuyện"
                }
                description={
                  showArchived
                    ? undefined
                    : "Bấm “Soạn tin” để liên lạc với phụ huynh, học sinh."
                }
              />
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const isGroupItem =
                    conversation.conversationType === "GROUP";

                  const isActive =
                    activeId === conversation.conversationId;

                  return (
                    <button
                      key={conversation.conversationId}
                      type="button"
                      onClick={() =>
                        openConversation(conversation.conversationId)
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        isActive ? "bg-[#FFF7F2]" : "hover:bg-slate-50"
                      }`}
                    >
                      <ConversationAvatar
                        name={conversation.displayName}
                        src={conversation.displayAvatar}
                        isGroup={isGroupItem}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">
                            {conversation.displayName}
                          </p>

                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatMessageTime(conversation.lastSentAt)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <p className="mb-0 truncate text-xs text-slate-500">
                            {conversation.lastType === "IMAGE"
                              ? "Ảnh đính kèm"
                              : conversation.lastType === "FILE"
                                ? "Tệp đính kèm"
                                : conversation.lastContent ||
                                  "Chưa có tin nhắn"}
                          </p>

                          {conversation.unreadCount > 0 && (
                            <span className="shrink-0 rounded-full bg-[#F27123] px-2 py-0.5 text-[11px] font-bold text-white">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>

                        {conversation.studentName && !isGroupItem && (
                          <p className="mb-0 mt-0.5 truncate text-[11px] text-slate-400">
                            HS: {conversation.studentName}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── Cột phải: khung chat ── */}
        {!activeId ? (
          <div className="hidden h-[650px] items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center xl:flex">
            <div>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
                <FiMessageSquare size={28} />
              </div>

              <p className="mb-1 text-base font-bold text-[#0F2747]">
                Chọn cuộc trò chuyện
              </p>

              <p className="mb-0 text-sm text-slate-500">
                Tin nhắn với phụ huynh, học sinh và nhóm lớp sẽ hiển thị tại
                đây.
              </p>
            </div>
          </div>
        ) : (
          (() => {
            const meta = thread?.meta;
            const isGroup = meta?.conversationType === "GROUP";

            const other = thread?.participants?.find(
              (participant) =>
                Number(participant.userId) !== Number(user?.userId),
            );

            const chatName = isGroup
              ? meta?.title || "Nhóm"
              : other?.fullName || "Trò chuyện";

            const chatAvatar = isGroup
              ? null
              : other?.avatar || meta?.studentAvatar || null;

            const messages = thread?.messages ?? [];

            return (
              <div className="flex h-[650px] flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-orange-100 bg-white px-5 py-4 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveId(null)}
                      className="shrink-0 text-slate-500 xl:hidden"
                      aria-label="Quay lại danh sách"
                    >
                      <FiArrowLeft size={18} />
                    </button>

                    <ConversationAvatar
                      name={chatName}
                      src={chatAvatar}
                      isGroup={isGroup}
                    />

                    <div className="min-w-0">
                      <h3 className="mb-1 truncate text-lg font-bold text-[#0F2747] sm:text-xl">
                        {chatName}
                      </h3>

                      {typingNames.length > 0 ? (
                        <p className="mb-0 truncate text-xs font-semibold text-[#F27123]">
                          {typingNames.join(", ")} đang nhập...
                        </p>
                      ) : isGroup ? (
                        <p className="mb-0 text-xs text-slate-500">
                          {thread?.participants?.length ?? 0} thành viên
                        </p>
                      ) : meta?.studentName ? (
                        <p className="mb-0 truncate text-xs text-slate-500">
                          Về học sinh: {meta.studentName}
                        </p>
                      ) : (
                        <p className="mb-0 text-xs text-slate-500">
                          Tin nhắn trực tiếp
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleArchive(activeId, !showArchived)}
                    title={showArchived ? "Bỏ lưu trữ" : "Lưu trữ"}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                  >
                    <FiArchive size={15} />
                    <span className="hidden sm:inline">
                      {showArchived ? "Bỏ lưu trữ" : "Lưu trữ"}
                    </span>
                  </button>
                </div>

                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] px-5 py-5 sm:px-6"
                >
                  {threadLoading && !thread ? (
                    <p className="text-center text-sm text-slate-500">
                      Đang tải tin nhắn...
                    </p>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <EmptyState
                        title="Chưa có tin nhắn"
                        description="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện."
                      />
                    </div>
                  ) : (
                    messages.map((message) => {
                      const mine =
                        Number(message.senderId) === Number(user?.userId);

                      const hasText = Boolean(message.content);

                      return (
                        <div
                          key={message.messageId}
                          className={`flex w-full ${
                            mine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`group flex max-w-[80%] flex-col sm:max-w-[72%] ${
                              mine ? "items-end" : "items-start"
                            }`}
                          >
                            {isGroup && !mine && (
                              <p className="mb-1 text-xs font-bold text-slate-500">
                                {message.senderName}
                              </p>
                            )}

                            <div
                              className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                mine
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
                                    <p className="mb-0 whitespace-pre-wrap leading-6 wrap-break-word">
                                      {message.content}
                                    </p>
                                  )}

                                  {!hasText && message.fileUrl && (
                                    <p className="mb-0 flex items-center gap-2 font-semibold">
                                      {message.messageType === "IMAGE" ? (
                                        <FiImage />
                                      ) : (
                                        <FiFile />
                                      )}
                                      Tệp đính kèm
                                    </p>
                                  )}

                                  <MessageAttachment
                                    message={message}
                                    isMine={mine}
                                  />
                                </>
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span>{formatMessageTime(message.sentAt)}</span>

                              {mine && !message.isDeleted && (
                                <>
                                  <span
                                    className={
                                      message.receipt === "READ"
                                        ? "font-semibold text-green-600"
                                        : "text-slate-400"
                                    }
                                  >
                                    {message.receipt === "READ"
                                      ? "✓✓ Đã xem"
                                      : "✓ Đã gửi"}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRecall(message.messageId)
                                    }
                                    title="Thu hồi tin nhắn"
                                    className="hidden text-slate-300 transition hover:text-red-500 group-hover:inline"
                                  >
                                    <FiTrash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="shrink-0 border-t border-orange-100 bg-white px-5 py-4">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                  />

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading || !socketConnected}
                      title="Đính kèm tệp"
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-[#FFF7F2] text-[#F27123] transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiPaperclip size={18} />
                    </button>

                    <input
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={
                        uploading
                          ? "Đang tải tệp..."
                          : socketConnected
                            ? "Nhập tin nhắn..."
                            : "Đang kết nối lại..."
                      }
                      className="h-12 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />

                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={
                        sending || !socketConnected || !input.trim()
                      }
                      className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#F27123] px-5 text-sm font-bold text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      <FiSend size={16} />
                      <span className="hidden sm:inline">
                        {sending ? "Đang gửi..." : "Gửi"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </section>

      {showNew && (
        <NewConversationModal
          contacts={contacts}
          onClose={() => setShowNew(false)}
          onStarted={(id) => {
            setShowNew(false);
            openConversation(id);
            refresh();
          }}
        />
      )}

      {showGroup && (
        <GroupConversationModal
          classes={contacts.classes}
          onClose={() => setShowGroup(false)}
          onCreated={(id) => {
            setShowGroup(false);
            openConversation(id);
            refresh();
          }}
        />
      )}
    </DashboardShell>
  );
}

export default MessagesPage;
