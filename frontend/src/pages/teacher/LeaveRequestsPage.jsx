import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import LeaveDecisionModal from "../../components/organisms/LeaveDecisionModal";
import LeaveRequestDetailDrawer from "../../components/organisms/LeaveRequestDetailDrawer";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useLeaveRequests } from "../../hooks/useLeaveRequests";
import { formatLeaveDateRange, formatLeavePeriods } from "../../utils/leaveTime";

// ─── FSchool Stitch design tokens ────────────────────────────────────────────

const C = {
  onSurface: "#1A1C1C",
  onSurfaceVariant: "#584238",
  outlineVariant: "#DFC0B2",
  primary: "#9F4200",
  primaryContainer: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  tertiary: "#4A5F82",
  error: "#BA1A1A",
  surface: "#F9F9F9",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

const CARD_SHADOW = "0px 4px 12px rgba(15, 39, 71, 0.08)";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { key: "PENDING",  label: "Chờ duyệt" },
  { key: "APPROVED", label: "Đã duyệt"  },
  { key: "REJECTED", label: "Từ chối"   },
];

const LEAVE_TYPE_LABEL = {
  SICK_LEAVE:     "Nghỉ ốm",
  FAMILY:         "Việc gia đình",
  FAMILY_LEAVE:   "Việc gia đình",
  PERSONAL:       "Việc cá nhân",
  PERSONAL_LEAVE: "Việc cá nhân",
  OTHER:          "Khác",
};

// Icon + màu loại đơn theo design Stitch (medical_services / family_restroom / assignment_turned_in)
const LEAVE_TYPE_META = {
  SICK_LEAVE:     { icon: "medical_services",     color: C.primary },
  FAMILY:         { icon: "family_restroom",      color: C.tertiary },
  FAMILY_LEAVE:   { icon: "family_restroom",      color: C.tertiary },
  PERSONAL:       { icon: "assignment_turned_in", color: "#003C7C" },
  PERSONAL_LEAVE: { icon: "assignment_turned_in", color: "#003C7C" },
  OTHER:          { icon: "description",          color: C.onSurfaceVariant },
};

// Status pill theo design Stitch (.status-pill .status-*)
const STATUS_PILL = {
  PENDING:  { label: "Chờ duyệt", bg: "rgba(242, 113, 35, 0.1)", text: "#9F4200" },
  APPROVED: { label: "Đã duyệt",  bg: "rgba(34, 93, 173, 0.1)",  text: "#225DAD" },
  REJECTED: { label: "Từ chối",   bg: "rgba(186, 26, 26, 0.1)",  text: "#BA1A1A" },
};

const TABLE_COLS = [
  { label: "Tên học sinh", align: "text-left"   },
  { label: "Lớp",          align: "text-left"   },
  { label: "Loại đơn",     align: "text-left"   },
  { label: "Thời gian",    align: "text-left"   },
  { label: "Trạng thái",   align: "text-center" },
  { label: "Thao tác",     align: "text-right"  },
];

function leaveTypeLabel(type) {
  if (!type) return "—";
  return LEAVE_TYPE_LABEL[type] ?? type;
}

function leaveTypeMeta(type) {
  return LEAVE_TYPE_META[type] ?? { icon: "description", color: C.onSurfaceVariant };
}

function StatusBadge({ status }) {
  const cfg = STATUS_PILL[status] ?? { label: status, bg: "#F1F5F9", text: "#475569" };
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Summary Bento Card (Stitch: left accent border, icon phải, số display-lg) ─

function SummaryCard({ label, value, caption, iconName, accent, children }) {
  return (
    <div
      className="rounded-[2rem] bg-white p-6 transition-transform hover:-translate-y-0.5"
      style={{ borderLeft: `4px solid ${accent}`, boxShadow: CARD_SHADOW }}
    >
      <div className="mb-2 flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>
          {label}
        </p>
        <Ms name={iconName} style={{ color: accent }} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-bold leading-none tracking-tight" style={{ color: C.onSurface }}>
          {value}
        </span>
      </div>
      {caption && (
        <p className="mt-2 text-xs italic" style={{ color: C.onSurfaceVariant }}>
          {caption}
        </p>
      )}
      {children}
    </div>
  );
}

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

  const totalRequests = (counts.PENDING ?? 0) + (counts.APPROVED ?? 0) + (counts.REJECTED ?? 0);
  const processedRate = totalRequests > 0
    ? Math.round((((counts.APPROVED ?? 0) + (counts.REJECTED ?? 0)) / totalRequests) * 100)
    : 0;

  const pad2 = (n) => String(n ?? 0).padStart(2, "0");

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

  function clearFilters() {
    setClassId("");
    setStartDate("");
    setEndDate("");
    setSearchInput("");
    setSearchTerm("");
    setPage(1);
  }

  function handleDecisionDone() {
    setDecision(null);
    setDetailId(null);
    setRefreshKey((k) => k + 1);
  }

  function exportCsv() {
    const items = data?.items ?? [];
    if (!items.length) return;
    const head = ["Học sinh", "Mã HS", "Lớp", "Loại nghỉ", "Từ ngày", "Đến ngày", "Trạng thái", "Ngày nộp"];
    const rows = items.map((r) => [
      r.studentName ?? "", r.studentCode ?? "", r.className ?? "", r.leaveType ?? "",
      r.startDate ?? "", r.endDate ?? "", STATUS_PILL[r.status]?.label ?? r.status ?? "", r.createdAt ?? "",
    ]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "danh-sach-don-nghi.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const summaryCards = [
    { label: "ĐƠN ĐANG CHỜ", value: pad2(counts.PENDING),  caption: "Cần bạn phê duyệt", iconName: "hourglass_empty", accent: C.primaryContainer },
    { label: "ĐÃ DUYỆT",     value: pad2(counts.APPROVED), caption: null,                iconName: "fact_check",      accent: C.secondary },
    { label: "TỪ CHỐI",      value: pad2(counts.REJECTED), caption: null,                iconName: "cancel",          accent: C.error },
  ];

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Đơn chờ duyệt"
      sidebarFooterValue={String(counts.PENDING)}
    >
      <div className="flex flex-col gap-6">
        {/* Header section (Stitch) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold" style={{ color: C.onSurface }}>
            Quản lý đơn nghỉ
          </h2>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data?.items?.length}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: C.primaryContainer }}
          >
            <Ms name="file_download" className="!text-[18px]" /> Xuất danh sách
          </button>
        </div>

        {/* Summary bento grid (Stitch) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
          <SummaryCard
            label="TỔNG SỐ ĐƠN"
            value={pad2(totalRequests)}
            caption={`Tỷ lệ hoàn thành ${processedRate}%`}
            iconName="event_busy"
            accent={C.deepBlue}
          >
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceHigh }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${processedRate}%`, backgroundColor: C.tertiary }}
              />
            </div>
          </SummaryCard>
        </div>

        {/* Filters card (Stitch) */}
        <div
          className="flex flex-wrap items-center gap-4 rounded-[2rem] bg-white p-4"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ backgroundColor: "#EEEEEE" }}>
            <Ms name="filter_list" className="!text-[18px]" style={{ color: C.onSurfaceVariant }} />
            <span className="text-xs font-bold" style={{ color: C.onSurface }}>Bộ lọc:</span>
          </div>

          <select
            value={classId}
            onChange={(e) => { setClassId(e.target.value); resetToFirstPage(); }}
            className="cursor-pointer rounded-full border bg-white px-4 py-2 text-sm outline-none focus:ring-1"
            style={{ borderColor: C.outlineVariant, color: C.onSurface }}
          >
            <option value="">Tất cả các lớp</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>{c.className}</option>
            ))}
          </select>

          <select
            value={activeStatus}
            onChange={(e) => changeStatus(e.target.value)}
            className="cursor-pointer rounded-full border bg-white px-4 py-2 text-sm outline-none focus:ring-1"
            style={{ borderColor: C.outlineVariant, color: C.onSurface }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              title="Từ ngày"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); resetToFirstPage(); }}
              className="rounded-full border bg-white px-4 py-2 text-sm outline-none focus:ring-1"
              style={{ borderColor: C.outlineVariant, color: C.onSurface }}
            />
            <span className="text-sm" style={{ color: C.onSurfaceVariant }}>–</span>
            <input
              type="date"
              title="Đến ngày"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); resetToFirstPage(); }}
              className="rounded-full border bg-white px-4 py-2 text-sm outline-none focus:ring-1"
              style={{ borderColor: C.outlineVariant, color: C.onSurface }}
            />
          </div>

          <form
            onSubmit={submitSearch}
            className="flex items-center overflow-hidden rounded-full border bg-white pl-4"
            style={{ borderColor: C.outlineVariant }}
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm kiếm đơn, học sinh..."
              className="w-44 border-none bg-transparent py-2 text-sm outline-none"
              style={{ color: C.onSurface }}
            />
            <button
              type="submit"
              title="Tìm kiếm"
              className="flex items-center rounded-full px-3 py-2 transition-colors hover:bg-[#EEEEEE]"
              style={{ color: C.onSurfaceVariant }}
            >
              <Ms name="search" className="!text-[18px]" />
            </button>
          </form>

          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto text-xs font-bold hover:underline"
            style={{ color: C.primary }}
          >
            Xóa tất cả
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-[2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} className="h-14 animate-pulse rounded-[2rem] bg-slate-200/60" />
            ))}
          </div>
        )}

        {/* Requests table (Stitch) */}
        {!loading && !error && (
          <div
            className="overflow-hidden rounded-[2rem] border bg-white"
            style={{ borderColor: C.outlineVariant, boxShadow: CARD_SHADOW }}
          >
            {!data?.items?.length ? (
              <p className="p-10 text-center text-sm text-slate-400">
                Không có đơn xin nghỉ nào{activeStatus === "PENDING" ? " đang chờ duyệt" : ""}.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                      <tr>
                        {TABLE_COLS.map((col) => (
                          <th
                            key={col.label}
                            className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${col.align}`}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: C.outlineVariant }}>
                      {data.items.map((row) => {
                        const typeMeta = leaveTypeMeta(row.leaveType);
                        const periods  = formatLeavePeriods(row.startDate, row.endDate);
                        return (
                          <tr
                            key={row.leaveRequestId}
                            onClick={() => setDetailId(row.leaveRequestId)}
                            className="group cursor-pointer transition-colors hover:bg-[#F3F3F3]"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {row.studentAvatar ? (
                                  <img
                                    src={row.studentAvatar}
                                    alt={row.studentName}
                                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                                    style={{ backgroundColor: C.surfaceHigh, color: C.onSurfaceVariant }}
                                  >
                                    {row.studentName?.[0]?.toUpperCase() ?? "?"}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold" style={{ color: C.onSurface }}>
                                    {row.studentName}
                                  </p>
                                  <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
                                    ID: {row.studentCode ?? "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm" style={{ color: C.onSurfaceVariant }}>
                              {row.className ?? "—"}
                            </td>
                            <td className="px-6 py-4">
                              <span className="flex items-center gap-1.5 text-sm" style={{ color: C.onSurface }}>
                                <Ms name={typeMeta.icon} className="!text-[16px]" style={{ color: typeMeta.color }} />
                                {leaveTypeLabel(row.leaveType)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <p className="text-sm font-medium" style={{ color: C.onSurface }}>
                                {formatLeaveDateRange(row.startDate, row.endDate)}
                              </p>
                              {periods && (
                                <p className="text-xs" style={{ color: C.onSurfaceVariant }}>{periods}</p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="px-6 py-4 text-right">
                              {row.status === "PENDING" ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    title="Duyệt đơn"
                                    onClick={(e) => { e.stopPropagation(); setDecision({ request: row, type: "APPROVE" }); }}
                                    className="rounded-full p-2 transition-colors hover:bg-[#225DAD]/10"
                                    style={{ color: C.secondary }}
                                  >
                                    <Ms name="check_circle" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Từ chối"
                                    onClick={(e) => { e.stopPropagation(); setDecision({ request: row, type: "REJECT" }); }}
                                    className="rounded-full p-2 transition-colors hover:bg-[#BA1A1A]/10"
                                    style={{ color: C.error }}
                                  >
                                    <Ms name="cancel" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  title="Xem chi tiết"
                                  onClick={(e) => { e.stopPropagation(); setDetailId(row.leaveRequestId); }}
                                  className="rounded-full p-2 transition-colors hover:bg-[#EEEEEE]"
                                  style={{ color: C.onSurfaceVariant }}
                                >
                                  <Ms name="more_vert" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer: count + pagination (Stitch) */}
                {pagination && (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 border-t p-4"
                    style={{ borderColor: C.outlineVariant, backgroundColor: C.surface }}
                  >
                    <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
                      Hiển thị {(page - 1) * pagination.limit + 1} đến{" "}
                      {Math.min(page * pagination.limit, pagination.total)} trong số {pagination.total} đơn
                    </p>
                    {pagination.totalPages > 1 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="flex items-center rounded-full border px-3 py-1 transition-colors hover:bg-[#EEEEEE] disabled:opacity-50"
                          style={{ borderColor: C.outlineVariant, color: C.onSurface }}
                        >
                          <Ms name="chevron_left" className="!text-[18px]" />
                        </button>
                        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPage(n)}
                            className="rounded-full px-3 py-1 text-xs font-bold transition-colors"
                            style={
                              n === page
                                ? { backgroundColor: C.primaryContainer, color: "#fff" }
                                : { border: `1px solid ${C.outlineVariant}`, color: C.onSurface }
                            }
                          >
                            {n}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                          disabled={page >= pagination.totalPages}
                          className="flex items-center rounded-full border px-3 py-1 transition-colors hover:bg-[#EEEEEE] disabled:opacity-50"
                          style={{ borderColor: C.outlineVariant, color: C.onSurface }}
                        >
                          <Ms name="chevron_right" className="!text-[18px]" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

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
