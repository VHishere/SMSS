import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiPlus,
  FiSearch,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import HomeworkFormModal from "../../components/organisms/HomeworkFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useHomeworkList } from "../../hooks/useHomeworkList";

const SORT_OPTIONS = [
  { value: "due_desc",     label: "Hạn nộp mới nhất" },
  { value: "due_asc",      label: "Hạn nộp gần nhất" },
  { value: "created_desc", label: "Mới tạo" },
  { value: "title_asc",    label: "Tên A→Z" },
];

const STATUS_BADGE = {
  OPEN:   { label: "Đang mở", bg: "#ECFDF5", text: "#16A34A" },
  CLOSED: { label: "Đã đóng", bg: "#F1F5F9", text: "#475569" },
};

function StatCard({ icon: Icon, iconBg, iconColor, label, value }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold leading-none" style={{ color: "#0F2747" }}>{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: iconBg }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

function HomeworkCard({ hw, onOpen }) {
  const badge = STATUS_BADGE[hw.status] ?? STATUS_BADGE.OPEN;
  const submissionPct = hw.totalStudents > 0
    ? Math.round((hw.totalSubmissions / hw.totalStudents) * 100)
    : 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(hw.homeworkId)}
      className="flex flex-col rounded-2xl bg-white p-5 text-left shadow-sm transition hover:shadow-md"
      style={{ border: "1px solid #FFE7D6" }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: badge.bg, color: badge.text }}
        >
          {badge.label}
        </span>
        {hw.status === "OPEN" && hw.isOverdue && (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
            Quá hạn
          </span>
        )}
      </div>

      <h3 className="mb-1 line-clamp-2 text-base font-bold" style={{ color: "#0F2747" }}>
        {hw.title}
      </h3>
      <p className="mb-3 text-xs text-slate-500">
        {hw.className} · {hw.subjectName}
      </p>

      <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
        <FiClock size={12} />
        Hạn: {hw.dueDate}
      </div>

      {/* Submission progress */}
      <div className="mt-auto">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Đã nộp: {hw.totalSubmissions}/{hw.totalStudents}</span>
          <span>Đã chấm: {hw.gradedSubmissions}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${submissionPct}%`, backgroundColor: "#F27123" }}
          />
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
  const [sort,       setSort]       = useState("due_desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page,       setPage]       = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useMemo(
    () => ({ classId, subjectId, status, sort, search: searchTerm, page, limit: 12, _rk: refreshKey }),
    [classId, subjectId, status, sort, searchTerm, page, refreshKey],
  );

  const { data, loading, error } = useHomeworkList(filters);

  const summary     = data?.summary ?? { totalHomework: 0, openCount: 0, pendingGrading: 0, overdueOpen: 0 };
  const assignments = data?.assignments ?? [];
  const pagination  = data?.pagination;

  // Distinct classes / subjects for the filter dropdowns
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
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Bài tập đang mở"
      sidebarFooterValue={String(summary.openCount)}
    >
      {/* Header */}
      <section className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
          <h1 className="mb-1 text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Quản lý bài tập</h1>
          <p className="text-sm text-slate-500">Tạo, theo dõi bài nộp và chấm điểm bài tập cho các lớp bạn phụ trách.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition"
          style={{ backgroundColor: "#F27123" }}
        >
          <FiPlus size={16} />
          Tạo bài tập
        </button>
      </section>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FiBookOpen}     iconBg="#FFF0E8" iconColor="#F27123" label="Tổng bài tập"     value={summary.totalHomework} />
        <StatCard icon={FiCheckCircle}  iconBg="#ECFDF5" iconColor="#16A34A" label="Đang mở"          value={summary.openCount} />
        <StatCard icon={FiEdit3}        iconBg="#EBF3FF" iconColor="#08509F" label="Chờ chấm"         value={summary.pendingGrading} />
        <StatCard icon={FiAlertTriangle} iconBg="#FEF2F2" iconColor="#DC2626" label="Quá hạn (đang mở)" value={summary.overdueOpen} />
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Lớp</label>
          <select value={classId} onChange={(e) => { setClassId(e.target.value); resetPage(); }} className={selectCls}>
            <option value="">Tất cả lớp</option>
            {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Môn</label>
          <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); resetPage(); }} className={selectCls}>
            <option value="">Tất cả môn</option>
            {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Trạng thái</label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }} className={selectCls}>
            <option value="">Tất cả</option>
            <option value="OPEN">Đang mở</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Sắp xếp</label>
          <select value={sort} onChange={(e) => { setSort(e.target.value); resetPage(); }} className={selectCls}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <form onSubmit={submitSearch} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Tìm bài tập</label>
          <div className="flex">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tiêu đề bài tập..."
              className="w-48 rounded-l-lg border border-r-0 border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
            />
            <button type="submit" className="flex items-center rounded-r-lg px-3 text-white" style={{ backgroundColor: "#08509F" }}>
              <FiSearch size={15} />
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((n) => <div key={n} className="h-44 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      )}

      {!loading && !error && (
        <>
          {!data?.items?.length ? (
            <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
              Chưa có bài tập nào. Nhấn "Tạo bài tập" để bắt đầu.
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
              <span>
                {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} / {pagination.total} bài tập
              </span>
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
