import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import HomeworkFormModal from "../../components/organisms/HomeworkFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useHomeworkList } from "../../hooks/useHomeworkList";
import { homeworkApi } from "../../api/client";
import { formatDateTimeVN } from "../../utils/datetime";

// ─── FSchool Stitch design tokens (homework screen) ──────────────────────────

const C = {
  onSurface: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  orange: "#F27123",
  deepBlue: "#00458E",
  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
  info: "#3B82F6",
};

function Ms({ name, className = "", style, fill = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}
    >
      {name}
    </span>
  );
}

const DUE_TABS = [
  { value: "",         label: "Tất cả" },
  { value: "upcoming", label: "Sắp tới hạn" },
  { value: "overdue",  label: "Quá hạn" },
];

const SORT_OPTIONS = [
  { value: "due_asc",      label: "Hạn sớm nhất" },
  { value: "created_desc", label: "Mới tạo" },
  { value: "title_asc",    label: "Tên A→Z" },
];

// "dd/mm/yyyy HH:mm" → "HH:mm - dd/mm/yyyy" (design order)
function dueDisplay(dueDate) {
  const s = formatDateTimeVN(dueDate);
  const [datePart, timePart] = String(s).split(" ");
  return timePart ? `${timePart} - ${datePart}` : s;
}

function timeAgo(dt) {
  if (!dt) return "";
  const d = new Date(String(dt).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return formatDateTimeVN(dt);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatDateTimeVN(dt);
}

// ─── Progress-ring stat card (Stitch) ─────────────────────────────────────────

function RingStat({ label, display, fraction, color }) {
  const CIRC = 251.2; // 2πr, r=40
  const offset = CIRC * (1 - Math.min(Math.max(fraction, 0), 1));
  return (
    <div
      className="group flex items-center gap-6 rounded-3xl border bg-white p-6 shadow-sm transition-all hover:shadow-md"
      style={{ borderColor: C.border }}
    >
      <div className="relative flex items-center justify-center">
        <svg className="h-24 w-24">
          <circle cx="48" cy="48" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="8" />
          <circle
            cx="48" cy="48" r="40" fill="transparent"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.35s" }}
          />
        </svg>
        <span className="absolute text-2xl font-black" style={{ color }}>{display}</span>
      </div>
      <div>
        <h3 className="text-lg font-bold" style={{ color: C.onSurface }}>{label}</h3>
      </div>
    </div>
  );
}

// ─── Status chip for homework rows ────────────────────────────────────────────

function hwStatusChip(hw) {
  if (hw.status === "CLOSED") return { label: "HOÀN THÀNH", bg: "rgba(34,197,94,0.1)", text: C.success };
  if (hw.isOverdue)           return { label: "QUÁ HẠN",    bg: "#FEF2F2",             text: C.error };
  return                             { label: "ĐÃ GIAO",    bg: "#FFEDD5",             text: C.orange };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function HomeworkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classId,    setClassId]    = useState("");
  const [subjectId,  setSubjectId]  = useState("");
  const [status,     setStatus]     = useState("");
  const [due,        setDue]        = useState("");
  const [sort,       setSort]       = useState("due_asc");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page,       setPage]       = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useMemo(
    () => ({ classId, subjectId, status, due, sort, search: searchTerm, page, limit: 12, _rk: refreshKey }),
    [classId, subjectId, status, due, sort, searchTerm, page, refreshKey],
  );
  const { data, loading, error } = useHomeworkList(filters);

  // exact overdue total (for the 3rd ring)
  const overdueFilters = useMemo(() => ({ due: "overdue", page: 1, limit: 1, _rk: refreshKey }), [refreshKey]);
  const { data: overdueData } = useHomeworkList(overdueFilters);
  const overdueTotal = overdueData?.pagination?.total ?? 0;

  // recent submissions of the most recent open homework (right panel)
  const [recent, setRecent] = useState(null); // { homeworkId, title, subs: [] }
  const [subFilter, setSubFilter] = useState("");
  const [subSort, setSubSort] = useState(false); // true = sort by score desc
  useEffect(() => {
    const first = data?.items?.find((h) => h.status === "OPEN") ?? data?.items?.[0];
    if (!first) { setRecent(null); return; }
    let m = true;
    homeworkApi.detail(first.homeworkId)
      .then((res) => {
        if (!m) return;
        const subs = (res.data?.submissions ?? [])
          .filter((s) => s.submittedAt)
          .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
        setRecent({ homeworkId: first.homeworkId, title: first.title, subs });
      })
      .catch(() => { if (m) setRecent(null); });
    return () => { m = false; };
  }, [data]);

  const assignments = useMemo(() => data?.assignments ?? [], [data]);
  const pagination  = data?.pagination;
  const openCount   = data?.summary?.openCount ?? 0;
  const totalCount  = pagination?.total ?? 0;

  const avgCompletion = useMemo(() => {
    const items = data?.items ?? [];
    const withStudents = items.filter((h) => h.totalStudents > 0);
    if (!withStudents.length) return 0;
    const sum = withStudents.reduce((acc, h) => acc + h.totalSubmissions / h.totalStudents, 0);
    return Math.round((sum / withStudents.length) * 100);
  }, [data]);

  const classOptions = useMemo(() => {
    const map = {};
    for (const a of assignments) map[a.classId] = a.className;
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [assignments]);

  const subjectOptions = useMemo(() => {
    const map = {};
    for (const a of assignments) map[a.subjectId] = a.subjectName;
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [assignments]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName),
    );
    return {
      name:   user?.fullName ?? user?.username ?? "Giáo viên",
      role:   roleEntry?.description ?? "Giáo viên",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  function submitSearch(e) {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
    setPage(1);
  }
  function resetPage() { setPage(1); }

  const displaySubs = useMemo(() => {
    if (!recent) return [];
    let list = recent.subs;
    if (subFilter === "PENDING") list = list.filter((s) => s.score === null && !s.isLate);
    else if (subFilter === "GRADED") list = list.filter((s) => s.score !== null);
    else if (subFilter === "LATE") list = list.filter((s) => s.isLate);
    if (subSort) list = [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return list.slice(0, 6);
  }, [recent, subFilter, subSort]);

  const selectCls =
    "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1";

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Bài tập đang mở"
      sidebarFooterValue={String(openCount)}
    >
      <div className="space-y-6">
        {/* ── Action Area (Stitch header) ── */}
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: "#0F172A" }}>
            Quản lý Bài tập
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-3xl border bg-white p-1 shadow-sm" style={{ borderColor: C.border }}>
              {DUE_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { setDue(t.value); resetPage(); }}
                  className="rounded-full px-4 py-2 text-sm transition-all"
                  style={due === t.value ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mx-1 h-8 w-px" style={{ backgroundColor: C.border }} />
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-white shadow-lg transition-all active:scale-95"
              style={{ backgroundColor: C.orange, boxShadow: "0 10px 15px -3px rgba(242,113,35,0.2)" }}
            >
              <Ms name="add" className="!text-[20px]" />
              <span>Tạo bài tập mới</span>
            </button>
          </div>
        </div>

        {/* ── Statistics (progress rings) ── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <RingStat
            label="Đang giao"
            display={String(openCount).padStart(2, "0")}
            fraction={totalCount > 0 ? openCount / totalCount : 0}
            color={C.orange}
          />
          <RingStat
            label="Hoàn thành TB"
            display={`${avgCompletion}%`}
            fraction={avgCompletion / 100}
            color={C.info}
          />
          <RingStat
            label="Quá hạn"
            display={String(overdueTotal).padStart(2, "0")}
            fraction={totalCount > 0 ? overdueTotal / totalCount : 0}
            color={C.error}
          />
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        {/* ── Main layout: table + submissions panel ── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Recent Homework List */}
          <div className="overflow-hidden rounded-3xl border bg-white shadow-sm xl:col-span-2" style={{ borderColor: C.border }}>
            <div className="flex items-center justify-between border-b bg-slate-50/50 px-6 py-5" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-3">
                <Ms name="history" style={{ color: C.deepBlue }} />
                <h4 className="text-lg font-bold" style={{ color: "#0F172A" }}>Bài tập gần đây</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-bold transition-colors hover:bg-slate-50"
                style={{ borderColor: C.border, color: showFilters ? C.orange : C.muted }}
              >
                <Ms name="filter_list" className="!text-[14px]" /> Bộ lọc
              </button>
            </div>

            {/* Collapsible filters */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 border-b bg-white px-6 py-3" style={{ borderColor: C.border }}>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); resetPage(); }} className={selectCls} style={{ borderColor: C.border, color: C.onSurface }}>
                  <option value="">Tất cả lớp</option>
                  {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); resetPage(); }} className={selectCls} style={{ borderColor: C.border, color: C.onSurface }}>
                  <option value="">Tất cả môn</option>
                  {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }} className={selectCls} style={{ borderColor: C.border, color: C.onSurface }}>
                  <option value="">Mọi trạng thái</option>
                  <option value="OPEN">Đang mở</option>
                  <option value="CLOSED">Đã đóng</option>
                </select>
                <select value={sort} onChange={(e) => { setSort(e.target.value); resetPage(); }} className={selectCls} style={{ borderColor: C.border, color: C.onSurface }}>
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <form onSubmit={submitSearch} className="flex">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tìm bài tập..."
                    className="w-40 rounded-l-xl border border-r-0 bg-white px-3 py-2 text-sm outline-none"
                    style={{ borderColor: C.border, color: C.onSurface }}
                  />
                  <button type="submit" className="flex items-center rounded-r-xl px-3 text-white" style={{ backgroundColor: C.deepBlue }}>
                    <Ms name="search" className="!text-[16px]" />
                  </button>
                </form>
              </div>
            )}

            {loading ? (
              <div className="space-y-3 p-6">
                {[0, 1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}
              </div>
            ) : !data?.items?.length ? (
              <div className="p-12 text-center">
                <p className="text-sm font-medium" style={{ color: C.onSurface }}>Chưa có bài tập nào</p>
                <p className="mt-1 text-sm text-slate-400">Nhấn “Tạo bài tập mới” để bắt đầu giao bài cho lớp.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/30">
                      {["MÔN HỌC", "TIÊU ĐỀ & THÔNG TIN", "TIẾN ĐỘ", "THAO TÁC"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 ${i === 2 ? "text-center" : ""} ${i === 3 ? "text-right" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((hw) => {
                      const chip = hwStatusChip(hw);
                      const pct = hw.totalStudents > 0 ? Math.round((hw.totalSubmissions / hw.totalStudents) * 100) : 0;
                      const done = pct >= 100;
                      return (
                        <tr
                          key={hw.homeworkId}
                          onClick={() => navigate(`/teacher/homework/${hw.homeworkId}`)}
                          className="group cursor-pointer transition-all hover:bg-slate-50/80"
                        >
                          <td className="px-6 py-5">
                            <span className="rounded-2xl px-3 py-1 text-[10px] font-black uppercase tracking-tight text-white shadow-sm" style={{ backgroundColor: C.deepBlue }}>
                              {hw.subjectName}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <p className="font-bold" style={{ color: "#0F172A" }}>{hw.title}</p>
                            <div className="mt-1 flex items-center gap-3">
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                                <Ms name="event" className="!text-[14px]" /> {dueDisplay(hw.dueDate)}
                              </span>
                              <span className="rounded px-2 py-0.5 text-[10px] font-extrabold uppercase" style={{ backgroundColor: chip.bg, color: chip.text }}>
                                {chip.label}
                              </span>
                              <span className="text-[11px] text-slate-400">{hw.className}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col items-center">
                              <div className="mb-1.5 h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: done ? C.success : C.orange }} />
                              </div>
                              <span className="text-[11px] font-bold" style={{ color: done ? C.success : "#475569" }}>
                                {done ? `Hoàn tất (${hw.totalSubmissions}/${hw.totalStudents})` : `${hw.totalSubmissions}/${hw.totalStudents} Học sinh`}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); navigate(`/teacher/homework/${hw.homeworkId}`); }}
                                title="Chỉnh sửa"
                                className="flex h-9 w-9 items-center justify-center rounded-2xl transition-colors hover:bg-[#00458E]/10"
                                style={{ color: C.deepBlue }}
                              >
                                <Ms name="edit" className="!text-[20px]" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); navigate(`/teacher/homework/${hw.homeworkId}`); }}
                                title="Xem chi tiết"
                                className="flex h-9 w-9 items-center justify-center rounded-2xl transition-colors hover:bg-[#F27123]/10"
                                style={{ color: C.orange }}
                              >
                                <Ms name="visibility" className="!text-[20px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-6 py-4 text-sm text-slate-500" style={{ borderColor: C.border }}>
                <span>{(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} / {pagination.total} bài tập</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40" style={{ borderColor: C.border }}>Trước</button>
                  <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                    className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40" style={{ borderColor: C.border }}>Sau</button>
                </div>
              </div>
            )}
          </div>

          {/* Submissions Panel */}
          <div className="flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm" style={{ borderColor: C.border }}>
            <div className="border-b bg-slate-50/50 px-6 py-5" style={{ borderColor: C.border }}>
              <h4 className="text-lg font-bold" style={{ color: "#0F172A" }}>Nộp bài gần đây</h4>
              {recent && <p className="mt-0.5 truncate text-[11px] text-slate-400">{recent.title}</p>}
              <div className="mt-4 flex items-center gap-2">
                <select
                  value={subFilter}
                  onChange={(e) => setSubFilter(e.target.value)}
                  className="flex-1 rounded-full border bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 outline-none"
                  style={{ borderColor: C.border }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="PENDING">Chờ chấm</option>
                  <option value="GRADED">Đã chấm</option>
                  <option value="LATE">Nộp muộn</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSubSort((v) => !v)}
                  title="Sắp xếp theo điểm"
                  className="rounded-full border bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50"
                  style={{ borderColor: C.border, color: subSort ? C.orange : undefined }}
                >
                  <Ms name="sort_by_alpha" className="!text-[18px]" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: 600 }}>
              {displaySubs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Chưa có bài nộp nào.</p>
              ) : (
                displaySubs.map((s, i) => {
                  const st = s.score !== null
                    ? { label: "ĐÃ CHẤM", color: C.deepBlue }
                    : s.isLate
                      ? { label: "NỘP MUỘN", color: C.warning }
                      : { label: "CHỜ CHẤM", color: C.error };
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => navigate(`/teacher/homework/${recent.homeworkId}`)}
                      className="group relative w-full cursor-pointer rounded-3xl border p-4 text-left shadow-sm transition-all hover:border-[#F27123]/40 hover:bg-[#F27123]/[0.02]"
                      style={{ borderColor: C.border }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {s.studentAvatar ? (
                            <img src={s.studentAvatar} alt={s.studentName} className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow-sm" style={{ backgroundColor: C.deepBlue }}>
                              {s.studentName?.[0]?.toUpperCase() ?? "?"}
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white" style={{ backgroundColor: C.success }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold" style={{ color: "#0F172A" }}>{s.studentName}</p>
                          <p className="truncate text-[11px] font-medium text-slate-400">{recent.title}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: st.color }}>{st.label}</span>
                          <p className="mt-0.5 text-[10px] text-slate-400">{timeAgo(s.submittedAt)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {recent && (
              <div className="border-t bg-slate-50/30 p-4 text-center" style={{ borderColor: C.border }}>
                <button
                  type="button"
                  onClick={() => navigate(`/teacher/homework/${recent.homeworkId}`)}
                  className="mx-auto flex items-center justify-center gap-2 text-sm font-bold hover:underline"
                  style={{ color: C.orange }}
                >
                  Xem tất cả bài nộp <Ms name="arrow_forward" className="!text-[16px]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <HomeworkFormModal
          mode="create"
          assignments={assignments}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }}
        />
      )}
    </DashboardShell>
  );
}

export default HomeworkPage;
