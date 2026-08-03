import { useEffect, useMemo, useRef, useState } from "react";

import {
  FiArchive,
  FiFile,
  FiImage,
  FiInbox,
  FiMessageSquare,
  FiPaperclip,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
} from "react-icons/fi";

import { adminApi } from "../../api/client";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilePreviewLink from "../../components/atoms/FilePreviewLink";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import { useAuth } from "../../context/useAuth";
import { useAdminThread } from "../../hooks/useAdminMessages";
import {
  emitSocketWithAck,
  getChatSocket,
} from "../../socket/chatSocket";

function getInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function ConversationAvatar({ name, tone = "orange" }) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-[#08509F]"
      : "bg-[#FFE7D6] text-[#F27123]";

  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toneClass}`}>
      {getInitials(name)}
    </div>
  );
}

function parseMessageDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMessageTime(value) {
  const date = parseMessageDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function MessageAttachment({ message, isMine }) {
  if (!message.fileUrl || message.isDeleted) return null;

  if (message.messageType === "IMAGE") {
    return (
      <a href={message.fileUrl} target="_blank" rel="noreferrer" className="mt-2 block">
        <img src={message.fileUrl} alt={message.content || "Ảnh đính kèm"} className="max-h-72 max-w-full rounded-2xl object-contain" />
      </a>
    );
  }

  return (
    <div className="mt-2">
      <FilePreviewLink
        compact
        fileName={message.content || "Tệp đính kèm"}
        fileUrl={message.fileUrl}
        className={isMine ? "border-white/40 bg-white/10 text-white hover:bg-white/20" : ""}
      />
    </div>
  );
}

function MessageBubble({ message, isMine }) {
  const hasText = Boolean(message.content);

  return (
    <div className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[72%] flex-col ${isMine ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${isMine ? "rounded-br-md bg-[#F27123] text-white" : "rounded-bl-md bg-white text-[#0F2747]"}`}>
          {message.isDeleted ? (
            <p className="mb-0 italic opacity-80">Tin nhắn đã được thu hồi</p>
          ) : (
            <>
              {hasText && <p className="mb-0 whitespace-pre-wrap leading-6">{message.content}</p>}
              {!hasText && message.fileUrl && (
                <p className="mb-0 flex items-center gap-2 font-semibold">
                  {message.messageType === "IMAGE" ? <FiImage /> : <FiFile />}
                  Tệp đính kèm
                </p>
              )}
              <MessageAttachment message={message} isMine={isMine} />
            </>
          )}
        </div>
        <p className="mt-1 mb-0 text-[11px] text-slate-400">{formatMessageTime(message.sentAt)}</p>
      </div>
    </div>
  );
}

function appendUniqueMessage(messages = [], message) {
  if (!message?.messageId) return messages;
  const exists = messages.some(
    (item) => Number(item.messageId) === Number(message.messageId),
  );
  return exists ? messages : [...messages, message];
}

function SelectedFilePreview({ file, onClear }) {
  if (!file) return null;

  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-[#FFF7F2] px-4 py-3 text-sm text-[#0F2747]">
      <div className="flex min-w-0 items-center gap-2">
        {file.type?.startsWith("image/") ? <FiImage className="shrink-0 text-[#F27123]" /> : <FiFile className="shrink-0 text-[#F27123]" />}
        <span className="min-w-0 truncate font-semibold">{file.name}</span>
      </div>
      <button type="button" onClick={onClear} className="shrink-0 text-slate-400 transition hover:text-red-600" aria-label="Bỏ file">
        <FiTrash2 size={16} />
      </button>
    </div>
  );
}

function ThreadPanel({
  api,
  conversationId,
  selectedConversation,
  archived,
  onSent,
  onArchiveChanged,
}) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState("");

  const { data, loading, error } = useAdminThread(conversationId, refreshKey, api);
  const [liveMessages, setLiveMessages] = useState([]);

  const messages = liveMessages.length ? liveMessages : data?.messages || [];
  const participants = data?.participants || [];
  const meta = data?.meta;

  const otherParticipant = participants.find((p) => Number(p.userId) !== Number(user?.userId));

  const chatName =
    selectedConversation?.title ||
    selectedConversation?.displayName ||
    meta?.title ||
    otherParticipant?.fullName ||
    "Cuộc trò chuyện";

  useEffect(() => {
    setLiveMessages(data?.messages || []);
  }, [data?.messages]);

  useEffect(() => {
    if (!conversationId) return undefined;

    const socket = getChatSocket();

    const joinConversation = () => {
      socket.emit("conversation:join", { conversationId });
    };

    const handleNewMessage = (message) => {
      if (Number(message.conversationId) !== Number(conversationId)) return;

      setLiveMessages((current) => appendUniqueMessage(current, message));

      if (Number(message.senderId) !== Number(user?.userId)) {
        emitSocketWithAck("conversation:read", { conversationId }).catch(() => {});
      }
    };

    const handleDeleted = ({ conversationId: deletedConversationId, messageId }) => {
      if (Number(deletedConversationId) !== Number(conversationId)) return;

      setLiveMessages((current) =>
        current.map((message) =>
          Number(message.messageId) === Number(messageId)
            ? {
                ...message,
                isDeleted: true,
                content: null,
                fileUrl: null,
              }
            : message,
        ),
      );
    };

    socket.on("connect", joinConversation);
    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleDeleted);

    joinConversation();

    return () => {
      socket.emit("conversation:leave", { conversationId });
      socket.off("connect", joinConversation);
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleDeleted);
    };
  }, [conversationId, user?.userId]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!conversationId || (!content.trim() && !selectedFile)) return;

    setSubmitting(true);
    setSendError("");

    try {
      if (selectedFile) {
        const uploadResponse = await api.uploadMessageFile(selectedFile);
        const uploaded = uploadResponse.data;
        await api.sendMessage(conversationId, {
          messageType: uploaded.messageType,
          content: content.trim() || uploaded.fileName,
          fileUrl: uploaded.fileUrl,
        });
      } else {
        await api.sendMessage(conversationId, { messageType: "TEXT", content: content.trim() });
      }

      setContent("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setRefreshKey((key) => key + 1);
      onSent();
    } catch (requestError) {
      setSendError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    await api.archiveConversation(conversationId, !archived);
    onArchiveChanged();
  }

  if (!conversationId) {
    return (
      <div className="flex min-h-162.5 items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
            <FiMessageSquare size={28} />
          </div>
          <p className="mb-1 text-base font-bold text-[#0F2747]">Chọn cuộc trò chuyện</p>
          <p className="mb-0 text-sm text-slate-500">Tin nhắn với nhân viên và giáo viên sẽ hiển thị tại đây.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-162.5 flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-orange-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <ConversationAvatar name={chatName} />
          <div>
            <h3 className="mb-1 text-xl font-bold text-[#0F2747]">{chatName}</h3>
            <p className="mb-0 text-xs text-slate-500">Tin nhắn trực tiếp</p>
          </div>
        </div>

        <button type="button" onClick={handleArchive} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-50">
          <FiArchive size={15} />
          {archived ? "Bỏ lưu trữ" : "Lưu trữ"}
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] px-6 py-5">
        {loading && <LoadingState label="Đang tải tin nhắn..." />}
        {!loading && error && <ErrorAlert error={error} />}

        {!loading && !error && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <EmptyState title="Chưa có tin nhắn" description="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện." />
          </div>
        )}

        {!loading && !error && messages.map((message) => (
          <MessageBubble key={message.messageId} message={message} isMine={Number(message.senderId) === Number(user?.userId)} />
        ))}
      </div>

      <form onSubmit={sendMessage} className="border-t border-orange-100 bg-white px-5 py-4">
        {sendError && <p className="mb-3 text-sm text-red-600">{sendError}</p>}

        <SelectedFilePreview
          file={selectedFile}
          onClear={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
        />

        <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-[#FFF7F2] text-[#F27123] transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Đính kèm tệp">
            <FiPaperclip size={18} />
          </button>

          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={selectedFile ? "Ghi chú cho file đính kèm..." : "Nhập tin nhắn..."}
            className="h-12 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
          />

          <button type="submit" disabled={submitting || (!content.trim() && !selectedFile)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#F27123] px-5 text-sm font-bold text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-60">
            <FiSend size={16} />
            {submitting ? "Đang gửi..." : "Gửi"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ContactRow({ contact, onClick }) {
  const roles = contact.roleNames || [];
  const isStaffOnly = roles.length === 1 && roles[0] === "STAFF";
  const roleLabel = roles.includes("ADMIN")
    ? "Quản trị viên"
    : isStaffOnly
    ? "Nhân viên"
    : roles.includes("HOMEROOM_TEACHER")
      ? "Giáo viên chủ nhiệm"
      : "Giáo viên bộ môn";

  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50">
      <ConversationAvatar name={contact.fullName} tone="blue" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">{contact.fullName}</p>
        <p className="mb-0 truncate text-xs text-slate-500">{roleLabel}{contact.email ? ` · ${contact.email}` : ""}</p>
      </div>
    </button>
  );
}

function AdminMessages({
  api = adminApi,
  staffSectionLabel = "Nhân viên",
  teacherSectionLabel = "Giáo viên",
  contactSearchPlaceholder = "Tìm nhân viên, giáo viên...",
}) {
  const [contacts, setContacts] = useState(null);
  const [conversations, setConversations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);

  const [contactSearch, setContactSearch] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [messageSearch, setMessageSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [messageSearchError, setMessageSearchError] = useState("");
  const updateRefreshTimerRef = useRef(null);

  async function loadData() {
    if (!contacts && conversations.length === 0) {
      setLoading(true);
    }
    setError("");

    try {
      const [contactsResponse, conversationsResponse] = await Promise.all([
        api.getMessageContacts(),
        api.listConversations({ archived: showArchived, search: conversationSearch }),
      ]);

      setContacts(contactsResponse.data);
      setConversations(conversationsResponse.data.items || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, refreshKey, showArchived, conversationSearch]);

  const filteredStaff = useMemo(() => {
    const keyword = contactSearch.trim().toLowerCase();
    const staff = contacts?.staff || contacts?.admins || [];
    if (!keyword) return staff;
    return staff.filter((c) => `${c.fullName} ${c.email || ""}`.toLowerCase().includes(keyword));
  }, [contacts, contactSearch]);

  const filteredTeachers = useMemo(() => {
    const keyword = contactSearch.trim().toLowerCase();
    const teachers = contacts?.teachers || [];
    if (!keyword) return teachers;
    return teachers.filter((c) => `${c.fullName} ${c.email || ""}`.toLowerCase().includes(keyword));
  }, [contacts, contactSearch]);

  async function startContactConversation(contact) {
    try {
      const response = await api.startConversation(contact.userId);
      const conversation = {
        conversationId: response.data.conversationId,
        conversationType: "ADMIN_DIRECT",
        displayName: contact.fullName,
        title: contact.fullName,
      };
      setActiveConversationId(response.data.conversationId);
      setSelectedConversation(conversation);
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function openConversation(conversation) {
    setActiveConversationId(conversation.conversationId);
    setSelectedConversation(conversation);
  }

  async function handleMessageSearch(event) {
    event.preventDefault();
    const keyword = messageSearch.trim();
    if (!keyword) { setSearchResults([]); return; }

    setSearchingMessages(true);
    setMessageSearchError("");

    try {
      const response = await api.searchMessageHistory({ keyword, archived: showArchived });
      setSearchResults(response.data.items || []);
    } catch (requestError) {
      setMessageSearchError(requestError.message);
    } finally {
      setSearchingMessages(false);
    }
  }

  function refresh() { setRefreshKey((key) => key + 1); }

  function handleArchiveChanged() {
    setActiveConversationId(null);
    setSelectedConversation(null);
    refresh();
  }

  useEffect(() => {
    const socket = getChatSocket();

    const handleConversationUpdated = (payload = {}) => {
      if (payload.reason === "READ") return;

      if (updateRefreshTimerRef.current) {
        clearTimeout(updateRefreshTimerRef.current);
      }

      updateRefreshTimerRef.current = setTimeout(() => {
        refresh();
      }, 300);
    };

    socket.on("conversation:updated", handleConversationUpdated);

    return () => {
      if (updateRefreshTimerRef.current) {
        clearTimeout(updateRefreshTimerRef.current);
      }
      socket.off("conversation:updated", handleConversationUpdated);
    };
  }, []);

  const hasLoadedData = Boolean(contacts) || conversations.length > 0;

  return (
    <>
      {loading && <LoadingState label="Đang tải tin nhắn..." />}
      {!loading && error && <ErrorAlert error={`Không tải được tin nhắn: ${error}`} />}

      {(!loading || hasLoadedData) && (
        <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <aside className="min-h-162.5 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
            <div className="border-b border-orange-100 px-5 py-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="mb-0 text-xl font-black text-[#0F2747]">Tin nhắn</h2>

                <button type="button" onClick={refresh} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-50 hover:text-[#F27123]">
                  <FiRefreshCw size={17} />
                </button>
              </div>

              <div className="mb-3 flex rounded-full bg-slate-100 p-1">
                <button type="button" onClick={() => setShowArchived(false)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${!showArchived ? "bg-white text-[#F27123] shadow-sm" : "text-slate-500"}`}>
                  <FiInbox className="mr-1 inline" />
                  Đang mở
                </button>
                <button type="button" onClick={() => setShowArchived(true)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-bold transition ${showArchived ? "bg-white text-[#F27123] shadow-sm" : "text-slate-500"}`}>
                  <FiArchive className="mr-1 inline" />
                  Lưu trữ
                </button>
              </div>

              <div className="relative">
                <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  placeholder="Tìm cuộc trò chuyện..."
                  className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </div>

            <div className="h-140 overflow-y-auto px-4 py-4">
              <form onSubmit={handleMessageSearch} className="mb-4">
                <div className="relative">
                  <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={messageSearch}
                    onChange={(event) => setMessageSearch(event.target.value)}
                    placeholder="Tìm trong lịch sử tin nhắn..."
                    className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              </form>

              {messageSearchError && <p className="mb-3 text-sm text-red-600">{messageSearchError}</p>}
              {searchingMessages && <p className="mb-3 text-sm text-slate-500">Đang tìm kiếm...</p>}

              {searchResults.length > 0 && (
                <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#08509F]">Kết quả tìm kiếm</p>
                  <div className="space-y-2">
                    {searchResults.map((item) => (
                      <button key={item.messageId} type="button"
                        onClick={() => openConversation({
                          conversationId: item.conversationId,
                          conversationType: item.conversationType,
                          title: item.displayName,
                          displayName: item.displayName,
                        })}
                        className="w-full rounded-xl bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-50">
                        <p className="mb-1 font-bold text-[#0F2747]">{item.displayName}</p>
                        <p className="mb-0 line-clamp-2 text-xs text-slate-500">{item.senderName}: {item.content || item.fileUrl}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Cuộc trò chuyện</p>

                {conversations.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.map((conversation) => (
                      <button key={conversation.conversationId} type="button" onClick={() => openConversation(conversation)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${activeConversationId === conversation.conversationId ? "bg-[#FFF7F2]" : "hover:bg-slate-50"}`}>
                        <ConversationAvatar name={conversation.displayName} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">{conversation.displayName}</p>
                            {conversation.unreadCount > 0 && (
                              <span className="rounded-full bg-[#F27123] px-2 py-0.5 text-[11px] font-bold text-white">{conversation.unreadCount}</span>
                            )}
                          </div>
                          <p className="mb-0 truncate text-xs text-slate-500">
                            {conversation.lastType === "IMAGE" ? "Ảnh đính kèm" : conversation.lastType === "FILE" ? "Tệp đính kèm" : conversation.lastContent || "Chưa có tin nhắn"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState title={showArchived ? "Chưa có cuộc trò chuyện lưu trữ" : "Chưa có cuộc trò chuyện"} />
                )}
              </div>

              {!showArchived && (
                <div>
                  <div className="relative mb-3">
                    <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={contactSearch}
                      onChange={(event) => setContactSearch(event.target.value)}
                      placeholder={contactSearchPlaceholder}
                      className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
                    />
                  </div>

                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">{staffSectionLabel}</p>
                  <div className="mb-5 space-y-2">
                    {filteredStaff.length > 0 ? filteredStaff.map((contact) => (
                      <ContactRow key={contact.userId} contact={contact} onClick={() => startContactConversation(contact)} />
                    )) : <p className="mb-0 text-sm text-slate-500">Không tìm thấy {staffSectionLabel.toLowerCase()}.</p>}
                  </div>

                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">{teacherSectionLabel}</p>
                  <div className="space-y-2">
                    {filteredTeachers.length > 0 ? filteredTeachers.map((contact) => (
                      <ContactRow key={contact.userId} contact={contact} onClick={() => startContactConversation(contact)} />
                    )) : <p className="mb-0 text-sm text-slate-500">Không tìm thấy {teacherSectionLabel.toLowerCase()}.</p>}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <ThreadPanel
            api={api}
            conversationId={activeConversationId}
            selectedConversation={selectedConversation}
            archived={showArchived}
            onSent={refresh}
            onArchiveChanged={handleArchiveChanged}
          />
        </section>
      )}
    </>
  );
}

export default AdminMessages;
