import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import PrettySelect from "../../components/molecules/PrettySelect";
import AnnouncementFormModal from "../../components/organisms/AnnouncementFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useTeacherRole } from "../../hooks/useTeacherRole";
import { announcementApi, communicationApi, teacherApi } from "../../api/client";
import { formatDateTimeVN } from "../../utils/datetime";

// ─── FSchool Stitch design tokens ────────────────────────────────────────────
const C = {
  onSurface: "#1A1C1C",
  muted: "#584238",
  border: "#DFC0B2",
  orange: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  danger: "#DC2626",
  success: "#15803D",
  surface: "#F9F9F9",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

// Nhãn tiếng Việt cho loại cảnh báo (khớp đúng dữ liệu warning_type trong DB)
const WARNING_LABEL = {
  AT_RISK: "Nguy cơ học lực",
  LOW_GPA: "Điểm trung bình thấp",
  DECLINING: "Kết quả đi xuống",
  MULTIPLE_FAIL: "Nhiều môn chưa đạt",
  EXCESSIVE_VIOLATION: "Vi phạm lặp lại",
  INTERVENTION: "Cần can thiệp",
  LOW_CONDUCT: "Hạnh kiểm thấp",
  ABSENCE_RISK: "Nguy cơ nghỉ học vượt ngưỡng",
};
const STATUS_LABEL = { OPEN: "Mới", IN_PROGRESS: "Đang xử lý", RESOLVED: "Đã xử lý" };
const AUDIENCE_LABEL = { CLASS_ALL: "Cả lớp", CLASS_PARENTS: "Phụ huynh", CLASS_STUDENTS: "Học sinh" };

const FEED_FILTERS = [
  { key: "all", label: "Tất cả thông báo" },
  { key: "unread", label: "Chưa đọc" },
  { key: "important", label: "Quan trọng" },
];

const SECTIONS = [
  { key: "school", label: "Thông báo nhà trường", icon: "campaign", color: C.orange },
  { key: "alerts", label: "Cảnh báo học sinh", icon: "warning", color: C.danger },
  { key: "system", label: "Cập nhật hệ thống", icon: "settings_suggest", color: C.secondary },
];

// Quản lý (soạn thảo) — pill trạng thái
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

function seenKey(userId) {
  return `htss_notif_seen_${userId ?? "anon"}`;
}
function loadSeen(userId) {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

// ─── Một dòng thông báo trong bảng tin ───────────────────────────────────────
function FeedItem({ item, unread }) {
  return (
    <div
      className="flex items-start gap-3 rounded-3xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      style={{
        border: `1px solid ${C.border}`,
        borderLeftWidth: item.important ? 4 : 1,
        borderLeftColor: item.important ? item.accent : C.border,
      }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{ backgroundColor: item.iconBg, color: item.accent }}
      >
        <Ms name={item.icon} className="text-[22px]!" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {unread && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.accent }} />
          )}
          <h4 className="min-w-0 text-sm font-bold leading-snug" style={{ color: C.onSurface }}>
            {item.title}
          </h4>
          {item.badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: item.badgeBg, color: item.badgeText }}
            >
              {item.badge}
            </span>
          )}
        </div>

        {item.content && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.content}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          {item.meta && <span>{item.meta}</span>}
          {item.meta && item.ts && <span>·</span>}
          {item.ts && <span>{formatDateTimeVN(item.ts)}</span>}
        </div>

        {item.actions?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                style={a.style}
              >
                <Ms name={a.icon} className="!text-[14px]" /> {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnnouncementsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { homeroomClasses } = useTeacherRole();

  const [mode, setMode] = useState("feed"); // 'feed' | 'manage'

  // ── Bảng tin (feed) ──
  const [feed, setFeed] = useState(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [feedFilter, setFeedFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [seen, setSeen] = useState(() => loadSeen(user?.userId));

  // ── Quản lý (soạn thảo) ──
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classes, setClasses] = useState([]);
  const [modal, setModal] = useState(null);
  const [receipts, setReceipts] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const classOptions = useMemo(() => {
    const ids = new Set((homeroomClasses ?? []).map((c) => String(c.classId)));
    return classes.filter((c) => ids.has(String(c.classId)));
  }, [classes, homeroomClasses]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return {
      name: user?.fullName ?? user?.username ?? "Giáo viên",
      role: roleEntry?.description ?? "Giáo viên",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  // Load feed
  useEffect(() => {
    let m = true;
    setFeedLoading(true); setFeedError("");
    teacherApi.getNotifications()
      .then((res) => { if (m) setFeed(res.data); })
      .catch((err) => { if (m) setFeedError(err.message); })
      .finally(() => { if (m) setFeedLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  // Load danh bạ lớp (cho modal soạn thảo)
  useEffect(() => {
    let m = true;
    communicationApi.getContacts().then((res) => { if (m) setClasses(res.data.classes); }).catch(() => {});
    return () => { m = false; };
  }, []);

  // Load danh sách quản lý khi ở chế độ manage
  useEffect(() => {
    if (mode !== "manage") return;
    let m = true;
    setLoading(true); setError("");
    announcementApi.list({ status: statusFilter, limit: 30 })
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [mode, statusFilter, refresh]);

  // ── Chuẩn hoá feed thành danh sách item thống nhất ──
  const items = useMemo(() => {
    if (!feed) return [];
    const list = [];

    (feed.school ?? []).forEach((a) => {
      list.push({
        id: `ann-${a.announcementId}`,
        category: "school",
        icon: "campaign",
        accent: C.orange,
        iconBg: "rgba(242,113,35,0.12)",
        title: a.title,
        content: a.content,
        meta: `${a.className ?? "—"} · ${AUDIENCE_LABEL[a.audience] ?? ""} · ${a.createdByName ?? ""}`.replace(/ · $/, ""),
        ts: a.createdAt,
        important: !!a.isPinned,
        badge: a.isPinned ? "Đã ghim" : null,
        badgeBg: "rgba(242,113,35,0.12)",
        badgeText: C.orange,
        actions: [],
      });
    });

    (feed.alerts ?? []).forEach((a) => {
      const icon = a.source === "ACADEMIC" ? "trending_down" : a.source === "BEHAVIOUR" ? "gavel" : "event_busy";
      const profilePath =
        a.source === "ACADEMIC" ? `/teacher/academic/students/${a.studentId}`
        : a.source === "BEHAVIOUR" ? `/teacher/behaviour/students/${a.studentId}`
        : `/teacher/students/${a.studentId}`;
      list.push({
        id: `warn-${a.source}-${a.warningId}`,
        category: "alerts",
        icon,
        accent: C.danger,
        iconBg: "rgba(220,38,38,0.10)",
        title: `${a.studentName} — ${WARNING_LABEL[a.warningType] ?? a.warningType}`,
        content: a.note,
        meta: `${a.className ?? "—"} · ${a.studentCode ?? ""}`.replace(/ · $/, ""),
        ts: a.createdAt,
        important: a.status === "OPEN",
        badge: STATUS_LABEL[a.status] ?? a.status,
        badgeBg: a.status === "OPEN" ? "rgba(220,38,38,0.10)" : a.status === "IN_PROGRESS" ? "#FEF3C7" : "#DCFCE7",
        badgeText: a.status === "OPEN" ? C.danger : a.status === "IN_PROGRESS" ? "#B45309" : C.success,
        actions: [
          { label: "Xem hồ sơ", icon: "person", onClick: () => navigate(profilePath), style: { backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary } },
          { label: "Liên hệ phụ huynh", icon: "mail", onClick: () => navigate("/teacher/messages"), style: { backgroundColor: "rgba(242,113,35,0.1)", color: C.orange } },
        ],
      });
    });

    (feed.system ?? []).forEach((s) => {
      list.push({
        id: `sys-${s.key}`,
        category: "system",
        icon: "event_note",
        accent: C.secondary,
        iconBg: "rgba(34,93,173,0.10)",
        title: s.title,
        content: s.content,
        meta: null,
        ts: null,
        important: true,
        badge: "Cần xử lý",
        badgeBg: "rgba(34,93,173,0.10)",
        badgeText: C.secondary,
        actions: s.actionType === "LEAVE_REQUESTS"
          ? [{ label: "Xử lý ngay", icon: "arrow_forward", onClick: () => navigate("/teacher/leave-requests"), style: { backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary } }]
          : [],
      });
    });

    return list;
  }, [feed, navigate]);

  const isUnread = useCallback((id) => !seen.has(id), [seen]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (category !== "all" && it.category !== category) return false;
      if (feedFilter === "unread" && !isUnread(it.id)) return false;
      if (feedFilter === "important" && !it.important) return false;
      return true;
    });
  }, [items, category, feedFilter, isUnread]);

  const unreadCount = useMemo(() => items.filter((it) => isUnread(it.id)).length, [items, isUnread]);
  const importantCount = useMemo(() => items.filter((it) => it.important).length, [items]);
  const newAlerts = feed?.counts?.newAlerts ?? 0;

  function markAllRead() {
    const next = new Set(seen);
    items.forEach((it) => next.add(it.id));
    setSeen(next);
    try { localStorage.setItem(seenKey(user?.userId), JSON.stringify([...next])); } catch { /* ignore */ }
  }

  const grouped = useMemo(() => {
    const g = { school: [], alerts: [], system: [] };
    filtered.forEach((it) => { g[it.category]?.push(it); });
    return g;
  }, [filtered]);

  // ── Actions cho chế độ quản lý ──
  async function act(fn) {
    try { await fn(); setRefresh((k) => k + 1); }
    catch (err) { alert(err.message); }
  }
  async function openReceipts(a) {
    setReceipts({ announcement: a, data: null, loading: true });
    try {
      const res = await announcementApi.getReceipts(a.announcementId);
      setReceipts({ announcement: a, data: res.data, loading: false });
    } catch (err) {
      setReceipts({ announcement: a, data: null, loading: false, error: err.message });
    }
  }

  const visibleSections = category === "all" ? SECTIONS : SECTIONS.filter((s) => s.key === category);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Khu vực" sidebarFooterValue="Thông báo">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Trung tâm thông báo</h2>
          <p className="mt-1 text-sm text-slate-500"></p>
        </div>
        <div className="flex items-center gap-2">
          {/* Segmented: Bảng tin / Quản lý */}
          <div className="flex items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {[{ k: "feed", l: "Bảng tin", i: "inbox" }, { k: "manage", l: "Quản lý", i: "tune" }].map((t) => (
              <button key={t.k} type="button" onClick={() => setMode(t.k)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all"
                style={mode === t.k ? { backgroundColor: "#fff", color: C.onSurface, fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.muted, fontWeight: 500 }}>
                <Ms name={t.i} className="!text-[16px]" /> {t.l}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setModal({})} disabled={classOptions.length === 0}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
            <Ms name="edit_note" className="!text-[20px]" /> Soạn thông báo
          </button>
        </div>
      </div>

      {mode === "feed" ? (
        <>
          {/* Toolbar: filter pills + category select + mark all read */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
              {FEED_FILTERS.map((f) => {
                const count = f.key === "unread" ? unreadCount : f.key === "important" ? importantCount : items.length;
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
            <div className="flex items-center gap-2">
              <PrettySelect value={category} onChange={(e) => setCategory(e.target.value)}
                className="rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]" style={{ borderColor: C.border, color: C.onSurface }}>
                <option value="all">Tất cả danh mục</option>
                <option value="school">Thông báo nhà trường</option>
                <option value="alerts">Cảnh báo học sinh</option>
                <option value="system">Cập nhật hệ thống</option>
              </PrettySelect>
              <button type="button" onClick={markAllRead} disabled={unreadCount === 0}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40" style={{ backgroundColor: C.orange }}>
                <Ms name="done_all" className="text-[18px]!" /> Đánh dấu đã đọc tất cả
              </button>
            </div>
          </div>

          {/* Blue "CẢNH BÁO MỚI" banner */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5 text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${C.deepBlue}, ${C.secondary})` }}>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                <Ms name="notifications_active" className="!text-[30px]" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/80">Cảnh báo mới</p>
                <p className="text-3xl font-extrabold leading-none">{String(newAlerts).padStart(2, "0")}</p>
                <p className="mt-1 text-sm text-white/85">học sinh cần theo dõi ngay</p>
              </div>
            </div>
            <button type="button" onClick={() => { setCategory("alerts"); setFeedFilter("all"); }}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-5 py-2.5 text-sm font-bold backdrop-blur transition-all hover:bg-white/25 active:scale-95">
              Xem tất cả <Ms name="arrow_forward" className="text-[18px]!" />
            </button>
          </div>

          {feedError && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{feedError}</div>}
          {feedLoading && <div className="space-y-3">{[0, 1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}

          {!feedLoading && !feedError && feed && (
            <div className="space-y-7">
              {visibleSections.map((sec) => {
                const secItems = grouped[sec.key];
                return (
                  <section key={sec.key}>
                    <div className="mb-3 flex items-center gap-2">
                      <Ms name={sec.icon} className="!text-[20px]" style={{ color: sec.color }} />
                      <h3 className="text-base font-bold" style={{ color: C.onSurface }}>{sec.label}</h3>
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: C.surfaceLow, color: C.muted }}>{secItems.length}</span>
                    </div>
                    {secItems.length === 0 ? (
                      <div className="rounded-3xl border border-dashed px-4 py-6 text-center text-sm text-slate-400" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
                        Không có mục nào.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {secItems.map((it) => <FeedItem key={it.id} item={it} unread={isUnread(it.id)} />)}
                      </div>
                    )}
                  </section>
                );
              })}

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm text-slate-500" style={{ borderColor: C.border }}>
                <span>Hiển thị <span className="font-bold" style={{ color: C.onSurface }}>{filtered.length}</span> trên <span className="font-bold" style={{ color: C.onSurface }}>{items.length}</span> thông báo</span>
                <button type="button" onClick={() => setMode("manage")} className="flex items-center gap-1.5 font-medium transition-colors hover:text-[#1A1C1C]" style={{ color: C.secondary }}>
                  <Ms name="settings" className="!text-[16px]" /> Quản lý thông báo đã đăng
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Chế độ Quản lý (soạn thảo / phát hành) ── */
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
                              {a.isPinned && <Ms name="push_pin" className="!text-[14px]" style={{ color: C.orange }} />}
                              <h3 className="text-sm font-bold" style={{ color: C.onSurface }}>{a.title}</h3>
                            </div>
                            <p className="text-xs text-slate-400">
                              {a.className ?? "—"} · {AUDIENCE_LABEL[a.audience]} ·{" "}
                              {a.status === "SCHEDULED" ? `lên lịch ${formatDateTimeVN(a.scheduledAt)}` : a.status === "PUBLISHED" ? `phát hành ${formatDateTimeVN(a.publishedAt)}` : `tạo ${formatDateTimeVN(a.createdAt)}`}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                      </div>
                      {a.content && <p className="mt-2 line-clamp-2 pl-[52px] text-sm text-slate-600">{a.content}</p>}

                      {a.status !== "ARCHIVED" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {editable && (
                            <>
                              <button type="button" onClick={() => act(() => announcementApi.publish(a.announcementId))}
                                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: C.success }}>
                                <Ms name="send" className="!text-[14px]" /> Phát hành
                              </button>
                              <button type="button" onClick={() => setModal({ announcement: a })}
                                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
                                <Ms name="edit" className="!text-[14px]" /> Sửa
                              </button>
                            </>
                          )}
                          {a.status === "PUBLISHED" && (
                            <button type="button" onClick={() => openReceipts(a)}
                              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
                              <Ms name="visibility" className="!text-[14px]" /> Đã đọc
                            </button>
                          )}
                          <button type="button" onClick={() => act(() => announcementApi.pin(a.announcementId, !a.isPinned))}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.orange }}>
                            <Ms name="push_pin" className="!text-[14px]" /> {a.isPinned ? "Bỏ ghim" : "Ghim"}
                          </button>
                          <button type="button" onClick={() => act(() => announcementApi.archive(a.announcementId))}
                            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: C.surfaceHigh, color: C.muted }}>
                            <Ms name="archive" className="!text-[14px]" /> Lưu trữ
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {modal && (
        <AnnouncementFormModal classes={classOptions} announcement={modal.announcement}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); setRefresh((k) => k + 1); }} />
      )}

      {receipts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-xl" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Tình trạng đã đọc</h3>
                <p className="truncate text-xs text-slate-500">{receipts.announcement.title}</p>
              </div>
              <button type="button" onClick={() => setReceipts(null)} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
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
                          ? <span className="flex items-center gap-1 text-xs font-medium" style={{ color: C.success }}><Ms name="check_circle" className="!text-[13px]" /> Đã đọc</span>
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
    </DashboardShell>
  );
}

export default AnnouncementsPage;
