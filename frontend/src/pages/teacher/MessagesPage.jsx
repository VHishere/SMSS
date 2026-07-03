import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiArchive, FiArrowLeft, FiInbox, FiPaperclip, FiPlus, FiSearch, FiSend, FiTrash2, FiUsers,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import NewConversationModal from "../../components/organisms/NewConversationModal";
import GroupConversationModal from "../../components/organisms/GroupConversationModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { communicationApi } from "../../api/client";

const POLL_MS = 10000;

function MessagesPage() {
  const { user } = useAuth();

  const [contacts, setContacts] = useState({ students: [], parents: [], classes: [] });
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
  const [showGroup, setShowGroup] = useState(false);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  // initial contacts + dashboard
  useEffect(() => {
    let m = true;
    communicationApi.getContacts().then((res) => { if (m) setContacts(res.data); }).catch(() => {});
    communicationApi.getDashboard().then((res) => { if (m) setStats(res.data.stats); }).catch(() => {});
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
    communicationApi.listConversations({ search, archived: showArchived, limit: 30 })
      .then((res) => { if (m) setConversations(res.data.items); })
      .catch(() => {});
    return () => { m = false; };
  }, [search, showArchived, tick]);

  async function handleArchive(conversationId, archived) {
    try {
      await communicationApi.archiveConversation(conversationId, archived);
      if (activeId === conversationId) setActiveId(null);
      setTick((t) => t + 1);
    } catch (err) { alert(err.message); }
  }

  // active thread
  useEffect(() => {
    if (!activeId) { setThread(null); return; }
    let m = true;
    setThreadLoading((prev) => (thread ? prev : true));
    communicationApi.getThread(activeId, { limit: 100 })
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

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  async function handleSend() {
    if (!input.trim() || !activeId) return;
    setSending(true);
    try {
      await communicationApi.sendMessage(activeId, { messageType: "TEXT", content: input.trim() });
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
      const up = await communicationApi.uploadFile(file);
      await communicationApi.sendMessage(activeId, { messageType: up.data.messageType, fileUrl: up.data.fileUrl, content: up.data.fileName });
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
    try { await communicationApi.deleteMessage(messageId); setTick((t) => t + 1); }
    catch (err) { alert(err.message); }
  }

  function openConversation(id) { setActiveId(id); setTick((t) => t + 1); }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Tin chưa đọc" sidebarFooterValue={String(stats.unreadMessages)}>
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F2747" }}>Tin nhắn</h1>
          <p className="text-sm text-slate-500">{stats.totalConversations} cuộc trò chuyện · {stats.unreadMessages} chưa đọc</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowGroup(true)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#08509F" }}>
            <FiUsers size={15} /> Tạo nhóm
          </button>
          <button type="button" onClick={() => setShowNew(true)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#F27123" }}>
            <FiPlus size={15} /> Soạn tin
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" style={{ minHeight: "60vh" }}>
        {/* Conversation list */}
        <div className={`rounded-2xl bg-white shadow-sm lg:col-span-1 ${activeId ? "hidden lg:block" : "block"}`} style={{ border: "1px solid #FFE7D6" }}>
          <div className="border-b p-3" style={{ borderColor: "#FFE7D6" }}>
            <div className="mb-2 flex items-center rounded-lg border border-slate-200 px-2.5">
              <FiSearch size={15} className="text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm trò chuyện..." className="w-full px-2 py-2 text-sm outline-none" />
            </div>
            <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 text-xs">
              <button type="button" onClick={() => { setShowArchived(false); setActiveId(null); }} className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 font-medium" style={!showArchived ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
                <FiInbox size={12} /> Đang hoạt động
              </button>
              <button type="button" onClick={() => { setShowArchived(true); setActiveId(null); }} className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 font-medium" style={showArchived ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
                <FiArchive size={12} /> Lưu trữ
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">Chưa có cuộc trò chuyện.</p>
            ) : conversations.map((c) => (
              <button key={c.conversationId} type="button" onClick={() => openConversation(c.conversationId)}
                className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition hover:bg-[#FFF7F2]"
                style={{ borderColor: "#FFF7F2", backgroundColor: activeId === c.conversationId ? "#FFF7F2" : "#fff" }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: c.conversationType === "GROUP" ? "#F27123" : "#08509F" }}>
                  {c.conversationType === "GROUP" ? <FiUsers size={16} /> : (c.displayName?.[0]?.toUpperCase() ?? "?")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[#0F2747]">{c.displayName}</span>
                    <span className="shrink-0 text-xs text-slate-400">{c.lastSentAt?.slice(5) ?? ""}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-500">
                      {c.lastType === "TEXT" ? (c.lastContent ?? "") : c.lastType ? "📎 Tệp đính kèm" : "Chưa có tin nhắn"}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: "#F27123" }}>{c.unreadCount}</span>
                    )}
                  </div>
                  {c.studentName && c.conversationType !== "GROUP" && <p className="text-xs text-slate-400">HS: {c.studentName}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat thread */}
        <div className={`flex flex-col rounded-2xl bg-white shadow-sm lg:col-span-2 ${activeId ? "flex" : "hidden lg:flex"}`} style={{ border: "1px solid #FFE7D6" }}>
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-slate-400">
              Chọn một cuộc trò chuyện để bắt đầu.
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "#FFE7D6" }}>
                <button type="button" onClick={() => setActiveId(null)} className="lg:hidden text-slate-500"><FiArrowLeft size={18} /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#0F2747]">
                    {thread?.meta?.conversationType === "GROUP" ? (thread?.meta?.title || "Nhóm") : (thread?.participants?.find((p) => p.role !== "TEACHER")?.fullName || "Trò chuyện")}
                  </p>
                  {thread?.meta?.studentName && <p className="text-xs text-slate-400">Về học sinh: {thread.meta.studentName}</p>}
                  {thread?.meta?.conversationType === "GROUP" && <p className="text-xs text-slate-400">{thread?.participants?.length ?? 0} thành viên</p>}
                </div>
                <button type="button" onClick={() => handleArchive(activeId, !showArchived)} title={showArchived ? "Bỏ lưu trữ" : "Lưu trữ"} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium" style={{ backgroundColor: "#FFF7F2", color: "#F27123" }}>
                  <FiArchive size={14} className="inline" /> {showArchived ? "Bỏ lưu trữ" : "Lưu trữ"}
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4" style={{ backgroundColor: "#FFF7F2", maxHeight: "48vh" }}>
                {threadLoading && !thread ? (
                  <p className="text-center text-sm text-slate-400">Đang tải...</p>
                ) : (thread?.messages ?? []).map((m) => {
                  const mine = m.receipt !== null;
                  return (
                    <div key={m.messageId} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="group max-w-[75%]">
                        {!mine && thread.meta.conversationType === "GROUP" && <p className="mb-0.5 px-1 text-xs font-medium text-slate-500">{m.senderName}</p>}
                        <div className="rounded-2xl px-3.5 py-2 text-sm" style={mine ? { backgroundColor: "#F27123", color: "#fff" } : { backgroundColor: "#fff", color: "#0F2747", border: "1px solid #FFE7D6" }}>
                          {m.isDeleted ? (
                            <span className="italic opacity-70">Tin nhắn đã thu hồi</span>
                          ) : m.messageType === "IMAGE" ? (
                            <a href={m.fileUrl} target="_blank" rel="noreferrer"><img src={m.fileUrl} alt={m.content} className="max-h-48 rounded-lg" /></a>
                          ) : m.messageType === "FILE" ? (
                            <a href={m.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline" style={{ color: mine ? "#fff" : "#08509F" }}>
                              <FiPaperclip size={14} /> {m.content || "Tệp đính kèm"}
                            </a>
                          ) : (
                            <span className="whitespace-pre-wrap wrap-break-word">{m.content}</span>
                          )}
                        </div>
                        <div className={`mt-0.5 flex items-center gap-1 px-1 text-xs text-slate-400 ${mine ? "justify-end" : "justify-start"}`}>
                          <span>{m.sentAt?.slice(11)}</span>
                          {mine && !m.isDeleted && (
                            <>
                              <span style={{ color: m.receipt === "READ" ? "#16A34A" : "#94A3B8" }}>
                                {m.receipt === "READ" ? "✓✓ Đã xem" : "✓ Đã gửi"}
                              </span>
                              <button type="button" onClick={() => handleRecall(m.messageId)} className="ml-1 hidden text-slate-300 hover:text-red-500 group-hover:inline">
                                <FiTrash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              <div className="flex items-center gap-2 border-t p-3" style={{ borderColor: "#FFE7D6" }}>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50" title="Đính kèm tệp">
                  <FiPaperclip size={18} />
                </button>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={uploading ? "Đang tải tệp..." : "Nhập tin nhắn..."}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
                />
                <button type="button" onClick={handleSend} disabled={sending || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
                  <FiSend size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showNew && (
        <NewConversationModal contacts={contacts} onClose={() => setShowNew(false)} onStarted={(id) => { setShowNew(false); openConversation(id); }} />
      )}
      {showGroup && (
        <GroupConversationModal classes={contacts.classes} onClose={() => setShowGroup(false)} onCreated={(id) => { setShowGroup(false); openConversation(id); }} />
      )}
    </DashboardShell>
  );
}

export default MessagesPage;
