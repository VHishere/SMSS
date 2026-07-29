import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentApi } from "../../api/client";
import { useParentStudents } from "../../hooks/useParentStudents";
import { formatDateTimeVN } from "../../utils/datetime";
import PrettySelect from "../../components/molecules/PrettySelect";

// ─── FSchool Stitch design tokens (matches teacher/AnnouncementsPage.jsx) ────
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
];

const ALERT_PROFILE_PATH = { ACADEMIC: "/parent/grades", BEHAVIOUR: "/parent/behaviour", ATTENDANCE: "/parent/attendance" };

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
function resetFeed(setFeed, setFeedLoading) {
  setFeed(null);
  setFeedLoading(false);
}
function beginFeedLoad(setFeedLoading, setFeedError) {
  setFeedLoading(true);
  setFeedError("");
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
                <Ms name={a.icon} className="text-[14px]!" /> {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParentNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { students, loading: studentsLoading } = useParentStudents();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const effStudentId = selectedStudentId || (students[0]?.studentId ? String(students[0].studentId) : "");

  const [feed, setFeed] = useState(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [feedFilter, setFeedFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [seen, setSeen] = useState(() => loadSeen(user?.userId));

  const headerUser = useMemo(() => {
    const parentRole = user?.roles?.find((r) => r.roleName === "PARENT");
    return {
      name: user?.fullName ?? user?.username ?? "Phụ huynh",
      role: parentRole?.description ?? "Phụ huynh",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  useEffect(() => {
    if (!effStudentId) { resetFeed(setFeed, setFeedLoading); return; }
    let m = true;
    beginFeedLoad(setFeedLoading, setFeedError);
    parentApi.getStudentNotificationFeed(effStudentId)
      .then((res) => { if (m) setFeed(res.data); })
      .catch((err) => { if (m) setFeedError(err.message); })
      .finally(() => { if (m) setFeedLoading(false); });
    return () => { m = false; };
  }, [effStudentId]);

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
          { label: "Xem chi tiết", icon: "visibility", onClick: () => navigate(ALERT_PROFILE_PATH[a.source] ?? "/parent/student"), style: { backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary } },
          { label: "Liên hệ giáo viên", icon: "mail", onClick: () => navigate("/parent/messages"), style: { backgroundColor: "rgba(242,113,35,0.1)", color: C.orange } },
        ],
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
    const g = { school: [], alerts: [] };
    filtered.forEach((it) => { g[it.category]?.push(it); });
    return g;
  }, [filtered]);

  const visibleSections = category === "all" ? SECTIONS : SECTIONS.filter((s) => s.key === category);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.PARENT} sidebarFooterLabel="Khu vực" sidebarFooterValue="Thông báo">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Trung tâm thông báo</h2>
        </div>
      </div>

      {students.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {students.map((s) => (
            <button key={s.studentId} type="button" onClick={() => setSelectedStudentId(String(s.studentId))}
              className="rounded-full px-4 py-2 text-sm font-bold transition-colors"
              style={String(s.studentId) === effStudentId
                ? { backgroundColor: C.orange, color: "#fff" }
                : { border: `1px solid ${C.border}`, backgroundColor: "#fff", color: C.muted }}>
              {s.studentFullName}{s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
            </button>
          ))}
        </div>
      )}

      {studentsLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <Ms name="person_off" className="text-[40px]!" style={{ color: C.border }} />
          <p className="mt-2 text-sm text-slate-400">Không tìm thấy thông tin học sinh.</p>
        </div>
      ) : (
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
                <Ms name="notifications_active" className="text-[30px]!" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/80">Cảnh báo mới</p>
                <p className="text-3xl font-extrabold leading-none">{String(newAlerts).padStart(2, "0")}</p>
                <p className="mt-1 text-sm text-white/85">cảnh báo cần lưu ý</p>
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
                      <Ms name={sec.icon} className="text-[20px]!" style={{ color: sec.color }} />
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
              </div>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default ParentNotifications;
