import { useEffect, useMemo, useState } from "react";

import { adminApi } from "../../../api/client";
import { formatRoleLabel } from "../../../utils/formatters";

// FSchool Admin Portal — Stitch design tokens (matches the parent/teacher portal)
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

const STATUS_PILL = {
  ACTIVE: { label: "Hoạt động", bg: "#16A34A15", text: "#16A34A", border: "#16A34A" },
  LOCKED: { label: "Đã khóa", bg: "#BA1A1A15", text: "#BA1A1A", border: "#BA1A1A" },
  INACTIVE: { label: "Ngưng hoạt động", bg: "#58423815", text: C.onSurfaceVariant, border: C.outlineVariant },
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "INACTIVE", label: "Ngưng hoạt động" },
  { value: "LOCKED", label: "Đã khóa" },
];

const ROLE_OPTIONS = [
  { value: "", label: "Tất cả vai trò" },
  { value: "ADMIN", label: "Admin" },
  { value: "STAFF", label: "Nhân viên" },
  { value: "HOMEROOM_TEACHER", label: "Giáo viên chủ nhiệm" },
  { value: "SUBJECT_TEACHER", label: "Giáo viên bộ môn" },
  { value: "DORM_SUPERVISOR", label: "Quản nhiệm (Mentor)" },
  { value: "PARENT", label: "Phụ huynh" },
  { value: "STUDENT", label: "Học sinh" },
];

const PAGE_SIZE = 10;

function Ms({ name, className = "", style }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

function getInitials(fullName = "") {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function StatusBadge({ status }) {
  const cfg = STATUS_PILL[status] ?? { label: status || "—", bg: "#EEEEEE", text: C.onSurfaceVariant, border: C.outlineVariant };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase"
      style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.text }} />
      {cfg.label}
    </span>
  );
}

const selectStyle = "cursor-pointer border-none bg-transparent pr-6 text-sm font-medium outline-none";

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingUserId, setPendingUserId] = useState(null);
  const [page, setPage] = useState(1);

  const loadUsers = () => {
    setLoading(true);
    adminApi
      .getUsers({ search, status, role, dateFrom, dateTo })
      .then((response) => {
        setUsers(response.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(loadUsers, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, role, dateFrom, dateTo]);

  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setRole("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const toggleAccountStatus = async (user) => {
    if (user.status === "INACTIVE") return;

    const nextStatus = user.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    const confirmMessage =
      nextStatus === "LOCKED"
        ? `Khóa tài khoản của "${user.fullName}"?`
        : `Mở khóa tài khoản của "${user.fullName}"?`;

    if (!window.confirm(confirmMessage)) return;

    setPendingUserId(user.userId);

    try {
      await adminApi.setUserStatus(user.userId, nextStatus);
      setUsers((prev) =>
        prev.map((item) =>
          item.userId === user.userId
            ? { ...item, status: nextStatus }
            : item,
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingUserId(null);
    }
  };

  const rows = useMemo(() => users, [users]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold" style={{ color: C.onSurface }}>
          Quản lý tài khoản
        </h2>
      </div>

      {error && (
        <div className="rounded-4xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Filter section (Stitch) */}
      <section className="rounded-4xl bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)]">
        <div className="mb-4 flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
          <Ms name="search" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
          <input
            type="search"
            value={search}
            onChange={(event) => updateFilter(setSearch)(event.target.value)}
            placeholder="Tìm kiếm theo email..."
            className="w-full border-none bg-transparent py-2.5 text-sm font-medium outline-none"
            style={{ color: C.onSurface }}
          />
          {search && (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => updateFilter(setSearch)("")}
              className="shrink-0 text-slate-400 hover:text-slate-600"
            >
              <Ms name="close" className="!text-[18px]!" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl border bg-white p-1 px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
            <Ms name="filter_alt" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
            <select
              value={status}
              onChange={(event) => updateFilter(setStatus)(event.target.value)}
              className={selectStyle}
              style={{ color: C.onSurface }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center rounded-xl border bg-white p-1 px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
            <Ms name="badge" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
            <select
              value={role}
              onChange={(event) => updateFilter(setRole)(event.target.value)}
              className={selectStyle}
              style={{ color: C.onSurface }}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
            <Ms name="calendar_month" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => updateFilter(setDateFrom)(event.target.value)}
              className="cursor-pointer border-none bg-transparent py-2 text-sm font-medium outline-none"
              style={{ color: C.onSurface }}
            />
          </div>

          <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
            <Ms name="calendar_month" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => updateFilter(setDateTo)(event.target.value)}
              className="cursor-pointer border-none bg-transparent py-2 text-sm font-medium outline-none"
              style={{ color: C.onSurface }}
            />
          </div>

          <button
            type="button"
            aria-label="Đặt lại bộ lọc"
            onClick={resetFilters}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:bg-[#F3F3F3]"
            style={{ borderColor: C.outlineVariant, color: C.onSurfaceVariant }}
          >
            <Ms name="restart_alt" className="!text-[20px]!" />
          </button>
        </div>

        <p className="mb-0 mt-4 text-sm" style={{ color: C.onSurfaceVariant }}>
          {loading ? "Đang tải..." : `${rows.length} tài khoản được tìm thấy`}
        </p>
      </section>

      {/* Table (Stitch) */}
      <section className="overflow-hidden rounded-4xl border bg-white shadow-[0_4px_12px_rgba(15,39,71,0.08)]" style={{ borderColor: C.outlineVariant }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
              <tr>
                {["Thành viên", "Vai trò", "Ngày tham gia", "Trạng thái", "Thao tác"].map((h) => (
                  <th key={h} className="px-6 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y" style={{ borderColor: C.outlineVariant }}>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                    Không tìm thấy tài khoản phù hợp
                  </td>
                </tr>
              ) : (
                pagedRows.map((user) => {
                  const isLocked = user.status !== "ACTIVE";

                  return (
                    <tr key={user.userId} className="transition-colors hover:bg-[#F3F3F3]">
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                            style={{ backgroundColor: `${C.secondary}1A`, color: C.secondary }}
                          >
                            {getInitials(user.fullName)}
                          </div>

                          <div className="min-w-0">
                            <p className="mb-0 truncate font-bold" style={{ color: C.onSurface }}>
                              {user.fullName}
                            </p>
                            <p className="mb-0 truncate text-xs" style={{ color: C.onSurfaceVariant }}>
                              {user.email}
                            </p>
                            {user.phone && (
                              <p className="mb-0 truncate text-xs" style={{ color: C.onSurfaceVariant }}>
                                {user.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        <span
                          className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                          style={{ borderColor: C.outlineVariant, color: C.onSurface, backgroundColor: C.surfaceLow }}
                        >
                          {formatRoleLabel(user.roleNames)}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top whitespace-nowrap text-sm" style={{ color: C.onSurfaceVariant }}>
                        {user.joinedDate || "—"}
                      </td>

                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        <StatusBadge status={user.status} />
                      </td>

                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        {user.status === "INACTIVE" ? (
                          <span
                            title="Tài khoản đã ngưng hoạt động, không thể mở khóa lại"
                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                            style={{ borderColor: C.outlineVariant, color: "#94A3B8" }}
                          >
                            <Ms name="lock" className="!text-[14px]!" />
                            Không thể mở khóa
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={pendingUserId === user.userId}
                            onClick={() => toggleAccountStatus(user)}
                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:opacity-80 disabled:opacity-60"
                            style={
                              isLocked
                                ? { backgroundColor: C.secondary, borderColor: C.secondary, color: "#fff" }
                                : { borderColor: C.error, color: C.error, backgroundColor: "#fff" }
                            }
                          >
                            <Ms name={isLocked ? "lock_open" : "lock"} className="!text-[14px]!" />
                            {isLocked ? "Mở khóa" : "Khóa"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4"
            style={{ borderColor: C.outlineVariant, backgroundColor: C.surfaceLow }}
          >
            <div className="flex items-center gap-1.5 text-sm" style={{ color: C.onSurfaceVariant }}>
              Trang
              <select
                value={currentPage}
                onChange={(event) => setPage(Number(event.target.value))}
                className="cursor-pointer rounded-lg border bg-white px-2 py-1 text-sm font-semibold outline-none"
                style={{ borderColor: C.outlineVariant, color: C.onSurface }}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              /{totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
                className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-sm font-semibold transition hover:bg-[#F3F3F3] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: C.outlineVariant, color: C.onSurface }}
              >
                <Ms name="chevron_left" className="!text-[18px]!" />
                Trước
              </button>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-sm font-semibold transition hover:bg-[#F3F3F3] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: C.outlineVariant, color: C.onSurface }}
              >
                Sau
                <Ms name="chevron_right" className="!text-[18px]!" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminUsersPage;
