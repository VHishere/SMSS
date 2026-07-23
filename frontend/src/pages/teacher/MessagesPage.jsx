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
  FiInbox,
  FiPaperclip,
  FiPlus,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";

import { communicationApi } from "../../api/client";
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
      menuItems={
        dashboardNavigation.TEACHER
      }
      sidebarFooterLabel="Tin chưa đọc"
      sidebarFooterValue={String(
        stats.unreadMessages,
      )}
    >
      <section
        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 shadow-sm"
        style={{
          border:
            "1px solid #FFE7D6",
          backgroundColor: "#fff",
        }}
      >
        <div>
          <h1
            className="text-2xl font-bold"
            style={{
              color: "#0F2747",
            }}
          >
            Tin nhắn
          </h1>

          <p className="text-sm text-slate-500">
            {
              stats.totalConversations
            }{" "}
            cuộc trò chuyện ·{" "}
            {
              stats.unreadMessages
            }{" "}
            chưa đọc ·{" "}
            {socketConnected
              ? "Realtime"
              : "Đang kết nối lại"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              setShowGroup(true)
            }
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
            style={{
              backgroundColor:
                "#08509F",
            }}
          >
            <FiUsers size={15} />
            Tạo nhóm
          </button>

          <button
            type="button"
            onClick={() =>
              setShowNew(true)
            }
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
            style={{
              backgroundColor:
                "#F27123",
            }}
          >
            <FiPlus size={15} />
            Soạn tin
          </button>
        </div>
      </section>

      <div
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        style={{
          minHeight: "60vh",
        }}
      >
        <div
          className={`rounded-2xl bg-white shadow-sm lg:col-span-1 ${
            activeId
              ? "hidden lg:block"
              : "block"
          }`}
          style={{
            border:
              "1px solid #FFE7D6",
          }}
        >
          <div
            className="border-b p-3"
            style={{
              borderColor:
                "#FFE7D6",
            }}
          >
            <div className="mb-2 flex items-center rounded-lg border border-[#FFE7D6] px-2.5">
              <FiSearch
                size={15}
                className="text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Tìm trò chuyện..."
                className="w-full px-2 py-2 text-sm outline-none"
              />
            </div>

            <div className="flex gap-1 rounded-lg border border-[#FFE7D6] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowArchived(
                    false,
                  );
                  setActiveId(null);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 font-medium"
                style={
                  !showArchived
                    ? {
                        backgroundColor:
                          "#F27123",
                        color: "#fff",
                      }
                    : {
                        color:
                          "#64748B",
                      }
                }
              >
                <FiInbox size={12} />
                Đang hoạt động
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowArchived(
                    true,
                  );
                  setActiveId(null);
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 font-medium"
                style={
                  showArchived
                    ? {
                        backgroundColor:
                          "#F27123",
                        color: "#fff",
                      }
                    : {
                        color:
                          "#64748B",
                      }
                }
              >
                <FiArchive
                  size={12}
                />
                Lưu trữ
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {conversations.length ===
            0 ? (
              <p className="p-6 text-center text-sm text-slate-400">
                Chưa có cuộc trò chuyện.
              </p>
            ) : (
              conversations.map(
                (conversation) => (
                  <button
                    key={
                      conversation.conversationId
                    }
                    type="button"
                    onClick={() =>
                      openConversation(
                        conversation.conversationId,
                      )
                    }
                    className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition hover:bg-[#FFF7F2]"
                    style={{
                      borderColor:
                        "#FFF7F2",

                      backgroundColor:
                        activeId ===
                        conversation.conversationId
                          ? "#FFF7F2"
                          : "#fff",
                    }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{
                        backgroundColor:
                          conversation.conversationType ===
                          "GROUP"
                            ? "#F27123"
                            : "#08509F",
                      }}
                    >
                      {conversation.conversationType ===
                      "GROUP" ? (
                        <FiUsers
                          size={16}
                        />
                      ) : (
                        conversation
                          .displayName?.[0]
                          ?.toUpperCase() ??
                        "?"
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-[#0F2747]">
                          {
                            conversation.displayName
                          }
                        </span>

                        <span className="shrink-0 text-xs text-slate-400">
                          {conversation.lastSentAt?.slice(
                            5,
                          ) ?? ""}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-500">
                          {conversation.lastType ===
                          "TEXT"
                            ? conversation.lastContent ??
                              ""
                            : conversation.lastType
                              ? "📎 Tệp đính kèm"
                              : "Chưa có tin nhắn"}
                        </span>

                        {conversation.unreadCount >
                          0 && (
                          <span
                            className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
                            style={{
                              backgroundColor:
                                "#F27123",
                            }}
                          >
                            {
                              conversation.unreadCount
                            }
                          </span>
                        )}
                      </div>

                      {conversation.studentName &&
                        conversation.conversationType !==
                          "GROUP" && (
                          <p className="text-xs text-slate-400">
                            HS:{" "}
                            {
                              conversation.studentName
                            }
                          </p>
                        )}
                    </div>
                  </button>
                ),
              )
            )}
          </div>
        </div>

        <div
          className={`flex flex-col rounded-2xl bg-white shadow-sm lg:col-span-2 ${
            activeId
              ? "flex"
              : "hidden lg:flex"
          }`}
          style={{
            border:
              "1px solid #FFE7D6",
          }}
        >
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-slate-400">
              Chọn một cuộc trò chuyện
              để bắt đầu.
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-3 border-b px-4 py-3"
                style={{
                  borderColor:
                    "#FFE7D6",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveId(null)
                  }
                  className="text-slate-500 lg:hidden"
                >
                  <FiArrowLeft
                    size={18}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#0F2747]">
                    {thread?.meta
                      ?.conversationType ===
                    "GROUP"
                      ? thread?.meta
                          ?.title ||
                        "Nhóm"
                      : thread?.participants?.find(
                          (
                            participant,
                          ) =>
                            Number(
                              participant.userId,
                            ) !==
                            Number(
                              user?.userId,
                            ),
                        )?.fullName ||
                        "Trò chuyện"}
                  </p>

                  {typingNames.length >
                  0 ? (
                    <p className="text-xs text-[#F27123]">
                      {typingNames.join(
                        ", ",
                      )}{" "}
                      đang nhập...
                    </p>
                  ) : thread?.meta
                      ?.studentName ? (
                    <p className="text-xs text-slate-400">
                      Về học sinh:{" "}
                      {
                        thread.meta
                          .studentName
                      }
                    </p>
                  ) : null}

                  {thread?.meta
                    ?.conversationType ===
                    "GROUP" && (
                    <p className="text-xs text-slate-400">
                      {thread
                        ?.participants
                        ?.length ?? 0}{" "}
                      thành viên
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleArchive(
                      activeId,
                      !showArchived,
                    )
                  }
                  title={
                    showArchived
                      ? "Bỏ lưu trữ"
                      : "Lưu trữ"
                  }
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor:
                      "#FFF7F2",
                    color: "#F27123",
                  }}
                >
                  <FiArchive
                    size={14}
                    className="inline"
                  />{" "}
                  {showArchived
                    ? "Bỏ lưu trữ"
                    : "Lưu trữ"}
                </button>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 space-y-2 overflow-y-auto p-4"
                style={{
                  backgroundColor:
                    "#FFF7F2",
                  maxHeight: "48vh",
                }}
              >
                {threadLoading &&
                !thread ? (
                  <p className="text-center text-sm text-slate-400">
                    Đang tải...
                  </p>
                ) : (
                  (
                    thread?.messages ??
                    []
                  ).map((message) => {
                    const mine =
                      Number(
                        message.senderId,
                      ) ===
                      Number(
                        user?.userId,
                      );

                    return (
                      <div
                        key={
                          message.messageId
                        }
                        className={`flex ${
                          mine
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div className="group max-w-[75%]">
                          {!mine &&
                            thread.meta
                              .conversationType ===
                              "GROUP" && (
                              <p className="mb-0.5 px-1 text-xs font-medium text-slate-500">
                                {
                                  message.senderName
                                }
                              </p>
                            )}

                          <div
                            className="rounded-2xl px-3.5 py-2 text-sm"
                            style={
                              mine
                                ? {
                                    backgroundColor:
                                      "#F27123",
                                    color:
                                      "#fff",
                                  }
                                : {
                                    backgroundColor:
                                      "#fff",
                                    color:
                                      "#0F2747",
                                    border:
                                      "1px solid #FFE7D6",
                                  }
                            }
                          >
                            {message.isDeleted ? (
                              <span className="italic opacity-70">
                                Tin nhắn đã thu
                                hồi
                              </span>
                            ) : message.messageType ===
                              "IMAGE" ? (
                              <a
                                href={
                                  message.fileUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={
                                    message.fileUrl
                                  }
                                  alt={
                                    message.content
                                  }
                                  className="max-h-48 rounded-lg"
                                />
                              </a>
                            ) : message.messageType ===
                              "FILE" ? (
                              <a
                                href={
                                  message.fileUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 underline"
                                style={{
                                  color:
                                    mine
                                      ? "#fff"
                                      : "#08509F",
                                }}
                              >
                                <FiPaperclip
                                  size={14}
                                />

                                {message.content ||
                                  "Tệp đính kèm"}
                              </a>
                            ) : (
                              <span className="whitespace-pre-wrap wrap-break-word">
                                {
                                  message.content
                                }
                              </span>
                            )}
                          </div>

                          <div
                            className={`mt-0.5 flex items-center gap-1 px-1 text-xs text-slate-400 ${
                              mine
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <span>
                              {message.sentAt?.slice(
                                11,
                                16,
                              )}
                            </span>

                            {mine &&
                              !message.isDeleted && (
                                <>
                                  <span
                                    style={{
                                      color:
                                        message.receipt ===
                                        "READ"
                                          ? "#16A34A"
                                          : "#94A3B8",
                                    }}
                                  >
                                    {message.receipt ===
                                    "READ"
                                      ? "✓✓ Đã xem"
                                      : "✓ Đã gửi"}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRecall(
                                        message.messageId,
                                      )
                                    }
                                    className="ml-1 hidden text-slate-300 hover:text-red-500 group-hover:inline"
                                  >
                                    <FiTrash2
                                      size={12}
                                    />
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

              <div
                className="flex items-center gap-2 border-t p-3"
                style={{
                  borderColor:
                    "#FFE7D6",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    fileRef.current?.click()
                  }
                  disabled={
                    uploading ||
                    !socketConnected
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                  title="Đính kèm tệp"
                >
                  <FiPaperclip
                    size={18}
                  />
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(event) =>
                    handleFile(
                      event.target
                        .files?.[0],
                    )
                  }
                />

                <input
                  value={input}
                  onChange={
                    handleInputChange
                  }
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    uploading
                      ? "Đang tải tệp..."
                      : "Nhập tin nhắn..."
                  }
                  className="flex-1 rounded-xl border border-[#FFE7D6] px-3 py-2.5 text-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={
                    sending ||
                    !socketConnected ||
                    !input.trim()
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-50"
                  style={{
                    backgroundColor:
                      "#F27123",
                  }}
                >
                  <FiSend size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showNew && (
        <NewConversationModal
          contacts={contacts}
          onClose={() =>
            setShowNew(false)
          }
          onStarted={(id) => {
            setShowNew(false);
            openConversation(id);
            refresh();
          }}
        />
      )}

      {showGroup && (
        <GroupConversationModal
          classes={
            contacts.classes
          }
          onClose={() =>
            setShowGroup(false)
          }
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