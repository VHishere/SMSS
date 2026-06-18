import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiCheckCircle,
  FiClock,
  FiEye,
  FiSearch,
  FiXCircle,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import LeaveDecisionModal from "../../components/organisms/LeaveDecisionModal";
import LeaveRequestDetailDrawer from "../../components/organisms/LeaveRequestDetailDrawer";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useLeaveRequests } from "../../hooks/useLeaveRequests";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "PENDING",  label: "Chờ duyệt",  icon: FiClock,       countKey: "PENDING"  },
  { key: "APPROVED", label: "Đã duyệt",   icon: FiCheckCircle, countKey: "APPROVED" },
  { key: "REJECTED", label: "Đã từ chối", icon: FiXCircle,     countKey: "REJECTED" },
];

const LEAVE_TYPE_LABEL = {
  SICK_LEAVE:     "Nghỉ ốm",
  FAMILY:         "Việc gia đình",
  FAMILY_LEAVE:   "Việc gia đình",
  PERSONAL:       "Việc cá nhân",
  PERSONAL_LEAVE: "Việc cá nhân",
  OTHER:          "Khác",
};

const STATUS_BADGE = {
  PENDING:  { label: "Chờ duyệt",  bg: "#FFFBEB", text: "#D97706" },
  APPROVED: { label: "Đã duyệt",   bg: "#ECFDF5", text: "#16A34A" },
  REJECTED: { label: "Đã từ chối", bg: "#FEF2F2", text: "#DC2626" },
};

function leaveTypeLabel(type) {
  if (!type) return "—";
  return LEAVE_TYPE_LABEL[type] ?? type;
}

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, bg: "#F1F5F9", text: "#475569" };
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

const TABLE_COLS = ["HỌC SINH", "LỚP", "LOẠI NGHỈ", "THỜI GIAN", "NGÀY NỘP", "TRẠNG THÁI", ""];

// ─── Page ─────────────────────────────────────────────────────────────────────

function LeaveRequestsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeStatus = searchParams.get("status") || "PENDING";

  // Filters
  const [classId,    setClassId]    = useState("");
  const [startDate,  setStartDate]  = useState("");
  const [endDate,    setEndDate]    = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page,       setPage]       = useState(1);

  // Detail drawer + decision modal state
  const [detailId,     setDetailId]     = useState(null);
  const [decision,     setDecision]     = useState(null); // { request, type }
  const [refreshKey,   setRefreshKey]   = useState(0);

  const filters = useMemo(
    () => ({
      status:    activeStatus,
      classId,
      startDate,
      endDate,
      search:    searchTerm,
      page,
      limit:     15,
      _rk:       refreshKey,
    }),
    [activeStatus, classId, startDate, endDate, searchTerm, page, refreshKey],
  );

  const { data, loading, error } = useLeaveRequests(filters);

  const counts     = data?.counts     ?? { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  const classes    = data?.classes    ?? [];
  const pagination = data?.pagination;

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

  function changeStatus(status) {
    setSearchParams({ status });
    setPage(1);
  }

  function resetToFirstPage() {
    setPage(1);
  }

  function submitSearch(e) {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
    setPage(1);
  }

  function handleDecisionDone() {
    setDecision(null);
    setDetailId(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Đơn chờ duyệt"
      sidebarFooterValue={String(counts.PENDING)}
    >
      {/* Page header */}
      <section
        className="mb-6 rounded-2xl p-5 shadow-sm sm:p-6"
        style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}
      >
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>
          Giáo viên
        </p>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>
          Đơn xin nghỉ phép
        </h1>
        <p className="text-sm text-slate-500">
          Xem xét, duyệt hoặc từ chối đơn xin nghỉ của học sinh trong lớp phụ trách.
        </p>
      </section>

      {/* Status tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {STATUS_TABS.map(({ key, label, icon: Icon, countKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => changeStatus(key)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition"
            style={
              activeStatus === key
                ? { backgroundColor: "#F27123", color: "#fff" }
                : { color: "#64748B" }
            }
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{label}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-xs font-bold"
              style={
                activeStatus === key
                  ? { backgroundColor: "rgba(255,255,255,0.25)", color: "#fff" }
                  : { backgroundColor: "#FFF7F2", color: "#F27123" }
              }
            >
              {counts[countKey]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Lớp</label>
          <select
            value={classId}
            onChange={(e) => { setClassId(e.target.value); resetToFirstPage(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          >
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>{c.className}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Từ ngày</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); resetToFirstPage(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Đến ngày</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); resetToFirstPage(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
        </div>

        <form onSubmit={submitSearch} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Tìm học sinh</label>
          <div className="flex">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tên hoặc mã học sinh..."
              className="w-48 rounded-l-lg border border-r-0 border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
            />
            <button
              type="submit"
              className="flex items-center rounded-r-lg px-3 text-white"
              style={{ backgroundColor: "#08509F" }}
            >
              <FiSearch size={15} />
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <div
            className="overflow-hidden rounded-2xl bg-white shadow-sm"
            style={{ border: "1px solid #FFE7D6" }}
          >
            {!data?.items?.length ? (
              <p className="p-10 text-center text-sm text-slate-400">
                Không có đơn xin nghỉ nào{activeStatus === "PENDING" ? " đang chờ duyệt" : ""}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr
                      className="border-b text-left"
                      style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}
                    >
                      {TABLE_COLS.map((col, i) => (
                        <th
                          key={i}
                          className="px-4 py-3 text-xs font-bold uppercase tracking-wider"
                          style={{ color: "#F27123" }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row, idx) => (
                      <tr
                        key={row.leaveRequestId}
                        className="border-b last:border-b-0 transition hover:bg-[#FFF7F2]"
                        style={{
                          borderColor: "#FFF7F2",
                          backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff",
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: "#08509F" }}
                            >
                              {row.studentAvatar ? (
                                <img src={row.studentAvatar} alt={row.studentName} className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                row.studentName?.[0]?.toUpperCase() ?? "?"
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[#0F2747]">
                                {row.studentName}
                              </div>
                              <div className="text-xs text-slate-400">{row.studentCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.className ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{leaveTypeLabel(row.leaveType)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {row.startDate}
                          {row.endDate && row.endDate !== row.startDate && (
                            <div className="text-xs text-slate-400">→ {row.endDate}</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.createdAt}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDetailId(row.leaveRequestId)}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition"
                            style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}
                          >
                            <FiEye size={12} />
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>
                {(page - 1) * pagination.limit + 1}–
                {Math.min(page * pagination.limit, pagination.total)} trong {pagination.total} đơn
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50"
                >
                  Trước
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {detailId && (
        <LeaveRequestDetailDrawer
          leaveRequestId={detailId}
          refreshKey={refreshKey}
          onClose={() => setDetailId(null)}
          onApprove={(req) => setDecision({ request: req, type: "APPROVE" })}
          onReject={(req) => setDecision({ request: req, type: "REJECT" })}
        />
      )}

      {/* Decision modal */}
      {decision && (
        <LeaveDecisionModal
          request={decision.request}
          decision={decision.type}
          onClose={() => setDecision(null)}
          onDone={handleDecisionDone}
        />
      )}
    </DashboardShell>
  );
}

export default LeaveRequestsPage;
