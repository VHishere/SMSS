import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiClock, FiPlus, FiSearch } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import HomeworkFormModal from "../../components/organisms/HomeworkFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useHomeworkList } from "../../hooks/useHomeworkList";
import { formatDateTimeVN } from "../../utils/datetime";

const SORT_OPTIONS = [
  { value: "due_asc",      label: "Hạn sớm nhất" },
  { value: "created_desc", label: "Mới tạo" },
  { value: "title_asc",    label: "Tên A→Z" },
];

const DUE_OPTIONS = [
  { value: "",         label: "Tất cả hạn" },
  { value: "upcoming", label: "Sắp tới hạn" },
  { value: "overdue",  label: "Quá hạn" },
];

const STATUS_BADGE = {
  OPEN:   { label: "Đang mở", bg: "#ECFDF5", text: "#16A34A" },
  CLOSED: { label: "Đã đóng", bg: "#F1F5F9", text: "#475569" },
};

function HomeworkCard({ hw, onOpen }) {
  const badge = STATUS_BADGE[hw.status] ?? STATUS_BADGE.OPEN;
  const overdue = hw.status === "OPEN" && hw.isOverdue;
  const pct = hw.totalStudents > 0 ? Math.round((hw.totalSubmissions / hw.totalStudents) * 100) : 0;
  const accent = overdue ? "#DC2626" : hw.status === "OPEN" ? "#16A34A" : "#CBD5E1";

  return (
    <button
      type="button"
      onClick={() => onOpen(hw.homeworkId)}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ border: "1px solid #FFE7D6" }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: badge.bg, color: badge.text }}>{badge.label}</span>
          {overdue && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>Quá hạn</span>
          )}
          <span className="ml-auto truncate text-xs text-slate-400">{hw.subjectName}</span>
        </div>

        <h3 className="mb-1 line-clamp-2 text-base font-bold" style={{ color: "#0F2747" }}>{hw.title}</h3>
        <p className="mb-3 text-xs text-slate-500">{hw.className}</p>

        <div className="mb-3 flex items-center gap-1.5 text-xs" style={{ color: overdue ? "#DC2626" : "#64748B" }}>
          <FiClock size={12} /> Hạn nộp: {formatDateTimeVN(hw.dueDate)}
        </div>

        <div className="mt-auto">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Đã nộp {hw.totalSubmissions}/{hw.totalStudents}</span>
            <span>Đã chấm {hw.gradedSubmissions}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "#F27123" }} />
          </div>
        </div>
      </div>
    </button>
  );
}

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

  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useMemo(
    () => ({ classId, subjectId, status, due, sort, search: searchTerm, page, limit: 12, _rk: refreshKey }),
    [classId, subjectId, status, due, sort, searchTerm, page, refreshKey],
  );

  const { data, loading, error } = useHomeworkList(filters);

  const assignments = useMemo(() => data?.assignments ?? [], [data]);
  const pagination  = data?.pagination;
  const openCount   = data?.summary?.openCount ?? 0;

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

  const selectCls =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Bài tập đang mở"
      sidebarFooterValue={String(openCount)}
    >
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "#0F2747" }}>Quản lý bài tập</h1>
          {pagination && <span className="text-sm text-slate-400">{pagination.total} bài</span>}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
          style={{ backgroundColor: "#F27123" }}
        >
          <FiPlus size={16} /> Tạo bài tập
        </button>
      </div>

      {/* Filters (right-aligned) */}
      <div className="mb-5 flex flex-wrap items-end justify-end gap-3">
        <select value={classId} onChange={(e) => { setClassId(e.target.value); resetPage(); }} className={selectCls}>
          <option value="">Tất cả lớp</option>
          {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); resetPage(); }} className={selectCls}>
          <option value="">Tất cả môn</option>
          {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }} className={selectCls}>
          <option value="">Mọi trạng thái</option>
          <option value="OPEN">Đang mở</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
        <select value={due} onChange={(e) => { setDue(e.target.value); resetPage(); }} className={selectCls}>
          {DUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); resetPage(); }} className={selectCls}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <form onSubmit={submitSearch} className="flex">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm bài tập..."
            className="w-44 rounded-l-xl border border-r-0 border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
          <button type="submit" className="flex items-center rounded-r-xl px-3 text-white" style={{ backgroundColor: "#08509F" }}>
            <FiSearch size={15} />
          </button>
        </form>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((n) => <div key={n} className="h-48 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      )}

      {!loading && !error && (
        <>
          {!data?.items?.length ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
              <p className="text-sm font-medium text-[#0F2747]">Chưa có bài tập nào</p>
              <p className="mt-1 text-sm text-slate-400">Nhấn “Tạo bài tập” để bắt đầu giao bài cho lớp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((hw) => (
                <HomeworkCard key={hw.homeworkId} hw={hw} onOpen={(id) => navigate(`/teacher/homework/${id}`)} />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
              <span>{(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} / {pagination.total} bài tập</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50">Trước</button>
                <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50">Sau</button>
              </div>
            </div>
          )}
        </>
      )}

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
