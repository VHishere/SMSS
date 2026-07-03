import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiArchive, FiInbox, FiMessageSquare, FiPaperclip, FiPlus, FiSearch, FiSend, FiTrash2,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import NewParentConversationModal from "../../components/organisms/NewParentConversationModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentApi } from "../../api/client";

import EmptyState from "../../components/molecules/EmptyState";
import LoadingState from "../../components/atoms/LoadingState";

const POLL_MS = 10000;

function getInitials(name) {
  if (!name) return "?";

  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function ConversationAvatar({ name, tone = "orange" }) {
  const toneClass = tone === "blue" ? "bg-blue-50 text-[#08509F]" : "bg-[#FFE7D6] text-[#F27123]";

  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toneClass}`}>
      {getInitials(name)}
    </div>
  );
}

function parseMessageDate(value) {
  if (!value) return null;

  const date = new Date(String(value).replace(" ", "T"));

  return Number.isNaN(date.getTime()) ? null : date;
}

function getMessageDateKey(value) {
  const date = parseMessageDate(value);

  if (!date) return "unknown";

  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function formatMessageDate(value) {
  const date = parseMessageDate(value);

  if (!date) return "";

  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function MessageDateDivider({ date }) {
  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">
        {formatMessageDate(date)}
      </span>
    </div>
  );
}

function ConversationList({ conversations, activeId, search, onSearchChange, showArchived, onToggleArchived, onSelect }) {
  return (
    <aside className="min-h-162.5 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
      <div className="px-5 pt-5 pb-3">
        <div className="relative mb-3">
          <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm cuộc trò chuyện..."
            className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </div>

        <div className="flex gap-1 rounded-full border border-slate-200 p-1 text-xs">
          <button
            type="button"
            onClick={() => onToggleArchived(false)}
            className="flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 font-medium transition"
            style={!showArchived ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}
          >
            <FiInbox size={12} /> Đang hoạt động
          </button>
          <button
            type="button"
            onClick={() => onToggleArchived(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 font-medium transition"
            style={showArchived ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}
          >
            <FiArchive size={12} /> Lưu trữ
          </button>
        </div>
      </div>

      <div className="h-130 overflow-y-auto px-3 py-3">
        {conversations.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState title="Chưa có cuộc trò chuyện" description="Bấm “Soạn tin” để bắt đầu nhắn tin với giáo viên." />
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => {
              const active = activeId === c.conversationId;
              const preview = c.lastType === "TEXT" ? (c.lastContent ?? "") : c.lastType ? "📎 Tệp đính kèm" : "Chưa có tin nhắn";

              return (
                <button
                  key={c.conversationId}
                  type="button"
                  onClick={() => onSelect(c.conversationId)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? "bg-[#FFF7F2]" : "hover:bg-slate-50"}`}
                >
                  <ConversationAvatar name={c.displayName} tone="blue" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="mb-1 truncate text-sm font-bold text-[#0F2747]">{c.displayName}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{c.lastSentAt?.slice(5) ?? ""}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="mb-0 truncate text-xs text-slate-500">{preview}</p>
                      {c.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: "#F27123" }}>
                          {c.unreadCount}
                        </span>
                      )}
                    </div>

                    {c.studentName && <p className="mb-0 truncate text-[11px] text-slate-400">HS: {c.studentName}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function MessageBubble({ message, isMine, onRecall }) {
  return (
    <div className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={`group flex max-w-[72%] flex-col ${isMine ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${isMine ? "rounded-br-md bg-[#F27123] text-white" : "rounded-bl-md bg-white text-[#0F2747]"}`}
        >
          {message.isDeleted ? (
            <p className="mb-0 italic opacity-70">Tin nhắn đã được thu hồi</p>
          ) : message.messageType === "IMAGE" ? (
            <a href={message.fileUrl} target="_blank" rel="noreferrer">
              <img src={message.fileUrl} alt={message.content || "Hình ảnh"} className="max-h-56 rounded-lg" />
            </a>
          ) : message.messageType === "FILE" ? (
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 underline"
              style={{ color: isMine ? "#fff" : "#08509F" }}
            >
              <FiPaperclip size={14} /> {message.content || "Tệp đính kèm"}
            </a>
          ) : (
            <p className="mb-0 whitespace-pre-wrap leading-6">{message.content}</p>
          )}
        </div>

        <div className={`mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 ${isMine ? "flex-row-reverse" : ""}`}>
          <span>{message.sentAt?.slice(11)}</span>

          {isMine && !message.isDeleted && (
            <>
              <span style={{ color: message.receipt === "READ" ? "#16A34A" : "#94A3B8" }}>
                {message.receipt === "READ" ? "Đã xem" : "Đã gửi"}
              </span>
              <button type="button" onClick={() => onRecall(message.messageId)} className="hidden text-slate-300 hover:text-red-500 group-hover:inline">
                <FiTrash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadPanel({
  activeId, thread, threadLoading, currentUserId, scrollRef,
  input, setInput, onSend, sending,
  onFile, uploading, fileRef,
  onRecall, onArchive, showArchived,
}) {
  if (!activeId) {
    return (
      <div className="flex min-h-162.5 items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF7F2] text-[#F27123]">
            <FiMessageSquare size={28} />
          </div>
          <p className="mb-1 text-base font-bold text-[#0F2747]">Chọn cuộc trò chuyện để nhắn tin</p>
          <p className="mb-0 text-sm text-slate-500">Nội dung trò chuyện sẽ hiển thị tại đây.</p>
        </div>
      </div>
    );
  }

  const otherName = thread?.participants?.find((p) => p.userId !== currentUserId)?.fullName || "Cuộc trò chuyện";
  const messages = thread?.messages || [];

  return (
    <div className="flex min-h-162.5 flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-orange-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <ConversationAvatar name={otherName} />

          <div>
            <h3 className="mb-1 text-xl font-bold text-[#0F2747]">{otherName}</h3>
            {thread?.meta?.studentName && <p className="mb-0 text-xs text-slate-500">Về học sinh: {thread.meta.studentName}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onArchive(activeId, !showArchived)}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: "#FFF7F2", color: "#F27123" }}
        >
          <FiArchive size={14} className="mr-1 inline" /> {showArchived ? "Bỏ lưu trữ" : "Lưu trữ"}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] px-6 py-5">
        {threadLoading && !thread && <LoadingState label="Đang tải tin nhắn..." />}

        {(!threadLoading || thread) && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <EmptyState title="Chưa có tin nhắn" description="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện." />
          </div>
        )}

        {messages.map((message, index) => {
          const isMine = message.receipt !== null;
          const currentDateKey = getMessageDateKey(message.sentAt);
          const previousDateKey = index > 0 ? getMessageDateKey(messages[index - 1].sentAt) : null;
          const shouldShowDate = index === 0 || currentDateKey !== previousDateKey;

          return (
            <div key={message.messageId} className="space-y-3">
              {shouldShowDate && <MessageDateDivider date={message.sentAt} />}
              <MessageBubble message={message} isMine={isMine} onRecall={onRecall} />
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="border-t border-orange-100 bg-white px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Đính kèm tệp"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <FiPaperclip size={18} />
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={uploading ? "Đang tải tệp..." : "Nhập tin nhắn..."}
            className="h-12 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-[#0F2747] outline-none transition focus:border-[#F27123] focus:bg-white focus:ring-4 focus:ring-orange-100"
          />

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#F27123] px-5 text-sm font-bold text-white shadow-lg shadow-orange-200/70 transition hover:-translate-y-0.5 hover:bg-[#d95f17] hover:shadow-xl hover:shadow-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSend size={16} />
            Gửi
          </button>
        </div>
      </form>
    </div>
  );
}

function ParentMessages() {
  const { user } = useAuth();

  const [contacts, setContacts] = useState({ students: [], teachers: [] });
  const [stats, setStats] = useState({ totalConversations: 0, unreadMessages: 0 });
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tick, setTick] = useState(0);

  const [showArchived, setShowArchived] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  // initial contacts + unread stats
  useEffect(() => {
    let m = true;
    parentApi.getMessageContacts().then((res) => { if (m) setContacts(res.data); }).catch(() => {});
    parentApi.listConversations({ archived: false, limit: 50 })
      .then((res) => {
        if (!m) return;
        const items = res.data.items ?? [];
        setStats({
          totalConversations: items.length,
          unreadMessages: items.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
        });
      })
      .catch(() => {});
    return () => { m = false; };
  }, [tick]);

  // poll timer
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), POLL_MS);
    return () => clearInterval(id);
  }, []);

  // conversation list
  useEffect(() => {
    let m = true;
    parentApi.listConversations({ search, archived: showArchived, limit: 30 })
      .then((res) => { if (m) setConversations(res.data.items); })
      .catch(() => {});
    return () => { m = false; };
  }, [search, showArchived, tick]);

  async function handleArchive(conversationId, archived) {
    try {
      await parentApi.archiveConversation(conversationId, archived);
      if (activeId === conversationId) setActiveId(null);
      setTick((t) => t + 1);
    } catch (err) { alert(err.message); }
  }

  // active thread
  useEffect(() => {
    if (!activeId) { setThread(null); return; }
    let m = true;
    setThreadLoading((prev) => (thread ? prev : true));
    parentApi.getThread(activeId, { limit: 100 })
      .then((res) => { if (m) setThread(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setThreadLoading(false); });
    return () => { m = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, tick]);

  // auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.messages?.length, activeId]);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Phụ huynh",
    role: "Phụ huynh",
    avatar: user?.avatar ?? "",
  }), [user]);

  async function handleSend() {
    if (!input.trim() || !activeId) return;
    setSending(true);
    try {
      await parentApi.sendMessage(activeId, { messageType: "TEXT", content: input.trim() });
      setInput("");
      setTick((t) => t + 1);
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleFile(file) {
    if (!file || !activeId) return;
    setUploading(true);
    try {
      const up = await parentApi.uploadMessageFile(file);
      await parentApi.sendMessage(activeId, { messageType: up.data.messageType, fileUrl: up.data.fileUrl, content: up.data.fileName });
      setTick((t) => t + 1);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRecall(messageId) {
    if (!window.confirm("Thu hồi tin nhắn này?")) return;
    try { await parentApi.deleteMessage(messageId); setTick((t) => t + 1); }
    catch (err) { alert(err.message); }
  }

  function openConversation(id) { setActiveId(id); setTick((t) => t + 1); }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.PARENT} sidebarFooterLabel="Tin chưa đọc" sidebarFooterValue={String(stats.unreadMessages)}>
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F2747" }}>Tin nhắn</h1>
          <p className="text-sm text-slate-500">{stats.totalConversations} cuộc trò chuyện · {stats.unreadMessages} chưa đọc</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowNew(true)} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#F27123" }}>
            <FiPlus size={15} /> Soạn tin
          </button>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          search={search}
          onSearchChange={setSearch}
          showArchived={showArchived}
          onToggleArchived={(archived) => { setShowArchived(archived); setActiveId(null); }}
          onSelect={openConversation}
        />

        <ThreadPanel
          activeId={activeId}
          thread={thread}
          threadLoading={threadLoading}
          currentUserId={user?.userId}
          scrollRef={scrollRef}
          input={input}
          setInput={setInput}
          onSend={handleSend}
          sending={sending}
          onFile={handleFile}
          uploading={uploading}
          fileRef={fileRef}
          onRecall={handleRecall}
          onArchive={handleArchive}
          showArchived={showArchived}
        />
      </section>

      {showNew && (
        <NewParentConversationModal contacts={contacts} onClose={() => setShowNew(false)} onStarted={(id) => { setShowNew(false); openConversation(id); }} />
      )}
    </DashboardShell>
  );
}

export default ParentMessages;
