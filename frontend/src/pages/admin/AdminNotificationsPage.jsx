import { useMemo, useState } from "react";

import AdminAnnouncementFormModal from "../../components/organisms/AdminAnnouncementFormModal";
import { adminApi } from "../../api/client";
import { useAdminNotifications } from "../../hooks/useAdminNotifications";
import { useAdminAnnouncementsMeta } from "../../hooks/useAdminAnnouncementsMeta";
import { useAdminAnnouncements } from "../../hooks/useAdminAnnouncements";
import { formatDateTimeVN } from "../../utils/datetime";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123",
  secondary: "#225DAD", deepBlue: "#00458E", danger: "#DC2626", success: "#15803D",
  surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};

function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

const NOTIF_TYPE = {
  HOMEWORK: { label: "Bài tập", icon: "assignment" },
  ATTENDANCE: { label: "Điểm danh", icon: "how_to_reg" },
  GRADE: { label: "Bảng điểm", icon: "grade" },
  BEHAVIOUR: { label: "Hạnh kiểm", icon: "workspace_premium" },
  EVENT: { label: "Sự kiện", icon: "event" },
  MESSAGE: { label: "Tin nhắn", icon: "mail" },
  ANNOUNCEMENT: { label: "Thông báo", icon: "campaign" },
  SYSTEM: { label: "Hệ thống", icon: "settings_suggest" },
};
function notifMeta(type) {
  return NOTIF_TYPE[type] ?? { label: type || "Thông báo", icon: "notifications" };
}

const FEED_FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
];

const AUDIENCE_LABEL = { CLASS_ALL: "Tất cả", CLASS_PARENTS: "Phụ huynh", CLASS_STUDENTS: "Học sinh" };
const MANAGE_STATUS = {
  DRAFT: { label: "Nháp", bg: "#E8E8E8", text: "#584238" },
  SCHEDULED: { label: "Đã lên lịch", bg: "#FEF3C7", text: "#B45309" },
  PUBLISHED: { label: "Đã phát hành", bg: "#DCFCE7", text: "#15803D" },
  ARCHIVED: { label: "Lưu trữ", bg: "#FFDAD6", text: "#93000A" },
};
const MANAGE_FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "DRAFT", label: "Nháp" },
  { key: "SCHEDULED", label: "Đã lên lịch" },
  { key: "PUBLISHED", label: "Đã phát hành" },
  { key: "ARCHIVED", label: "Lưu trữ" },
];

function scopeLabel(a) {
  if (a.className) return a.className;
  if (a.gradeName) return `Khối ${a.gradeName}`;
  return "Toàn trường";
}

// ─── Bảng tin (feed) ───────────────────────────────────────────────────────
function FeedItem({ item, onRead }) {
  const meta = notifMeta(item.type);
  return (
    <button
      type="button"
      onClick={() => { if (!item.isRead) onRead(item.notificationId); }}
      className="flex w-full items-start gap-3 rounded-3xl bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      style={{ border: `1px solid ${C.border}`, borderLeftWidth: item.isRead ? 1 : 4, borderLeftColor: item.isRead ? C.border : C.orange }}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(242,113,35,0.12)", color: C.orange }}>
        <Ms name={meta.icon} className="text-[22px]!" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: C.orange }} />}
          <h4 className="min-w-0 text-sm font-bold leading-snug" style={{ color: C.onSurface }}>{item.title}</h4>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: C.surfaceLow, color: C.muted }}>{meta.label}</span>
        </div>
        {item.content && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.content}</p>}
        <p className="mt-1.5 text-xs text-slate-400">{item.createdAt}</p>
      </div>
    </button>
  );
}

function FeedMode() {
  const [feedFilter, setFeedFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useAdminNotifications({ limit: 50 }, refreshKey);

  const allItems = data?.items || [];
  const unreadCount = Number(data?.summary?.unreadNotifications || 0);
  const totalCount = Number(data?.summary?.totalNotifications || 0);
  const displayItems = useMemo(
    () => (feedFilter === "unread" ? allItems.filter((n) => !n.isRead) : allItems),
    [allItems, feedFilter],
  );

  function refresh() { setRefreshKey((k) => k + 1); }

  async function markRead(notificationId) {
    try { await adminApi.markNotificationRead(notificationId); refresh(); } catch { /* silent */ }
  }
  async function markAllRead() {
    try { await adminApi.markAllNotificationsRead(); refresh(); } catch (err) { alert(err.message); }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
          {FEED_FILTERS.map((f) => {
            const count = f.key === "unread" ? unreadCount : totalCount;
            return (
              <button key={f.key} type="button" onClick={() => setFeedFilter(f.key)}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all"
                style={feedFilter === f.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                {f.label}
                <span className="rounded-full px-1.5 text-[11px] font-bold" style={feedFilter === f.key ? { backgroundColor: "rgba(255,255,255,0.25)" } : { backgroundColor: C.surfaceHigh }}>{count}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={markAllRead} disabled={unreadCount === 0}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40" style={{ backgroundColor: C.orange }}>
          <Ms name="done_all" className="text-[18px]!" /> Đánh dấu đã đọc tất cả
        </button>
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="space-y-3">{[0, 1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}

      {!loading && !error && displayItems.length === 0 && (
        <div className="rounded-3xl border border-dashed px-4 py-10 text-center text-sm text-slate-400" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
          {feedFilter === "unread" ? "Không có thông báo chưa đọc." : "Chưa có thông báo nào."}
        </div>
      )}

      {!loading && !error && displayItems.length > 0 && (
        <div className="space-y-3">
          {displayItems.map((item) => <FeedItem key={item.notificationId} item={item} onRead={markRead} />)}
        </div>
      )}
    </>
  );
}

// ─── Quản lý (soạn thảo / phát hành) ───────────────────────────────────────
function ManageMode({ onOpenModal }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [receipts, setReceipts] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useAdminAnnouncements(statusFilter, true, refreshKey);

  async function act(fn) {
    try { await fn(); setRefreshKey((k) => k + 1); }
    catch (err) { alert(err.message); }
  }
  async function openReceipts(a) {
    setReceipts({ announcement: a, data: null, loading: true });
    try {
      const res = await adminApi.getAnnouncementReceipts(a.announcementId);
      setReceipts({ announcement: a, data: res.data, loading: false });
    } catch (err) {
      setReceipts({ announcement: a, data: null, loading: false, error: err.message });
    }
  }

  return (
    <>
      <div className="mb-6 flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
        {MANAGE_FILTERS.map((f) => (
          <button key={f.key || "ALL"} type="button" onClick={() => setStatusFilter(f.key)}
            className="rounded-full px-4 py-1.5 text-sm transition-all"
            style={statusFilter === f.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}

      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            Chưa có thông báo nào.
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((a) => {
              const st = MANAGE_STATUS[a.status] ?? MANAGE_STATUS.DRAFT;
              const editable = a.status === "DRAFT" || a.status === "SCHEDULED";
              return (
                <div key={a.announcementId} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeftWidth: a.isPinned ? 4 : 1, borderLeftColor: a.isPinned ? C.orange : C.border }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.orange }}>
                        <Ms name="campaign" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {a.isPinned && <Ms name="push_pin" className="text-[14px]!" style={{ color: C.orange }} />}
                          <h3 className="text-sm font-bold" style={{ color: C.onSurface }}>{a.title}</h3>
                        </div>
                        <p className="text-xs text-slate-400">
                          {scopeLabel(a)} · {AUDIENCE_LABEL[a.audience]} · {a.createdByName ?? "—"} ·{" "}
                          {a.status === "SCHEDULED" ? `lên lịch ${formatDateTimeVN(a.scheduledAt)}` : a.status === "PUBLISHED" ? `phát hành ${formatDateTimeVN(a.publishedAt)}` : `tạo ${formatDateTimeVN(a.createdAt)}`}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                  {a.content && <p className="mt-2 line-clamp-2 pl-13 text-sm text-slate-600">{a.content}</p>}

                  {a.status !== "ARCHIVED" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {editable && (
                        <>
                          <button type="button" onClick={() => act(() => adminApi.publishAnnouncement(a.announcementId))}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: C.success }}>
                            <Ms name="send" className="text-[14px]!" /> Phát hành
                          </button>
                          <button type="button" onClick={() => onOpenModal({ announcement: a })}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
                            <Ms name="edit" className="text-[14px]!" /> Sửa
                          </button>
                        </>
                      )}
                      {a.status === "PUBLISHED" && (
                        <button type="button" onClick={() => openReceipts(a)}
                          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
                          <Ms name="visibility" className="text-[14px]!" /> Đã đọc
                        </button>
                      )}
                      <button type="button" onClick={() => act(() => adminApi.pinAnnouncement(a.announcementId, !a.isPinned))}
                        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.orange }}>
                        <Ms name="push_pin" className="text-[14px]!" /> {a.isPinned ? "Bỏ ghim" : "Ghim"}
                      </button>
                      <button type="button" onClick={() => act(() => adminApi.archiveAnnouncement(a.announcementId))}
                        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: C.surfaceHigh, color: C.muted }}>
                        <Ms name="archive" className="text-[14px]!" /> Lưu trữ
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {receipts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-xl" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Tình trạng đã đọc</h3>
                <p className="truncate text-xs text-slate-500">{receipts.announcement.title}</p>
              </div>
              <button type="button" onClick={() => setReceipts(null)} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"><Ms name="close" className="text-[20px]!" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {receipts.loading ? (
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              ) : receipts.error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{receipts.error}</p>
              ) : receipts.data && (
                <>
                  <div className="mb-4 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-extrabold leading-none" style={{ color: C.orange }}>{receipts.data.readRate ?? 0}%</p>
                      <p className="mt-1 text-xs text-slate-500">đã đọc</p>
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Đã đọc: {receipts.data.readCount}</span><span>Tổng: {receipts.data.total}</span></div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${receipts.data.readRate ?? 0}%`, backgroundColor: C.orange }} /></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {receipts.data.recipients.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: C.surfaceLow }}>
                        <span style={{ color: C.onSurface }}>{r.name}</span>
                        {r.isRead
                          ? <span className="flex items-center gap-1 text-xs font-medium" style={{ color: C.success }}><Ms name="check_circle" className="text-[13px]!" /> Đã đọc</span>
                          : <span className="text-xs text-slate-400">Chưa đọc</span>}
                      </div>
                    ))}
                    {receipts.data.recipients.length === 0 && <p className="text-sm text-slate-400">Chưa có người nhận.</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
function AdminNotificationsPage() {
  const [mode, setMode] = useState("feed"); // 'feed' | 'manage'
  const [modal, setModal] = useState(null);
  const [manageRefreshKey, setManageRefreshKey] = useState(0);
  const { data: meta, loading: metaLoading } = useAdminAnnouncementsMeta();

  const classes = meta?.classes ?? [];
  const grades = meta?.grades ?? [];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Trung tâm thông báo</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {[{ k: "feed", l: "Bảng tin", i: "inbox" }, { k: "manage", l: "Quản lý", i: "tune" }].map((t) => (
              <button key={t.k} type="button" onClick={() => setMode(t.k)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all"
                style={mode === t.k ? { backgroundColor: "#fff", color: C.onSurface, fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.muted, fontWeight: 500 }}>
                <Ms name={t.i} className="text-[16px]!" /> {t.l}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setModal({})} disabled={metaLoading}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
            <Ms name="edit_note" className="text-[20px]!" /> Soạn thông báo
          </button>
        </div>
      </div>

      {mode === "feed"
        ? <FeedMode />
        : <ManageMode key={manageRefreshKey} onOpenModal={setModal} />}

      {modal && (
        <AdminAnnouncementFormModal
          classes={classes}
          grades={grades}
          announcement={modal.announcement}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setMode("manage"); setManageRefreshKey((k) => k + 1); }}
        />
      )}
    </>
  );
}

export default AdminNotificationsPage;
