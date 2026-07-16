import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiChevronLeft,
  FiChevronRight,
  FiLock,
  FiRefreshCw,
  FiUnlock,
  FiX,
} from "react-icons/fi";

import { adminApi } from "../../../api/client";
import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import StatusBadge from "../../../components/staff/StatusBadge";
import { inputClass } from "../../../components/staff/StaffFormCard";
import {
  formatRoleLabel,
  getAccountStatusInfo,
} from "../../../utils/formatters";

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

function getInitials(fullName = "") {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

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
    <>
      <StaffPageHeader
        title="Quản lý tài khoản"
        action={
          <Link
            to="/admin/users/new"
            className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white no-underline"
          >
            + Tạo tài khoản
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-orange-100 bg-white shadow-sm">
        <div className="space-y-4 border-b border-orange-50 px-5 py-4 sm:px-6">
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(event) => updateFilter(setSearch)(event.target.value)}
              placeholder="Tìm kiếm theo email..."
              className={`${inputClass} w-full`}
            />

            {search && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => updateFilter(setSearch)("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FiX size={16} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
            <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <span className="mb-3 block">Trạng thái</span>
              <select
                className={`${inputClass} block w-full`}
                value={status}
                onChange={(event) => updateFilter(setStatus)(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <span className="mb-3 block">Vai trò</span>
              <select
                className={`${inputClass} block w-full`}
                value={role}
                onChange={(event) => updateFilter(setRole)(event.target.value)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <span className="mb-3 block">Từ ngày</span>
              <input
                type="date"
                className={`${inputClass} block w-full`}
                value={dateFrom}
                onChange={(event) => updateFilter(setDateFrom)(event.target.value)}
              />
            </label>

            <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <span className="mb-3 block">Đến ngày</span>
              <input
                type="date"
                className={`${inputClass} block w-full`}
                value={dateTo}
                onChange={(event) => updateFilter(setDateTo)(event.target.value)}
              />
            </label>

            <button
              type="button"
              aria-label="Đặt lại bộ lọc"
              onClick={resetFilters}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-[#F27123] hover:text-[#F27123]"
            >
              <FiRefreshCw size={16} />
            </button>
          </div>

          <p className="mb-0 text-sm text-slate-500">
            {loading ? "Đang tải..." : `${rows.length} tài khoản được tìm thấy`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#FFF7F2] text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap sm:px-6">Thành viên</th>
                <th className="px-5 py-3 whitespace-nowrap sm:px-6">Vai trò</th>
                <th className="px-5 py-3 whitespace-nowrap sm:px-6">Ngày tham gia</th>
                <th className="px-5 py-3 whitespace-nowrap sm:px-6">Trạng thái</th>
                <th className="px-5 py-3 whitespace-nowrap sm:px-6">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    Không tìm thấy tài khoản phù hợp
                  </td>
                </tr>
              ) : (
                pagedRows.map((user) => {
                  const statusInfo = getAccountStatusInfo(user.status);
                  const isLocked = user.status !== "ACTIVE";

                  return (
                    <tr
                      key={user.userId}
                      className="border-t border-slate-100 transition hover:bg-[#FFE7D6]/25"
                    >
                      <td className="px-5 py-4 align-top sm:px-6">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#08509F] text-sm font-bold text-white">
                            {getInitials(user.fullName)}
                          </div>

                          <div>
                            <p className="mb-0 font-semibold text-[#0F2747]">
                              {user.fullName}
                            </p>
                            <p className="mb-0 text-xs text-slate-500">
                              {user.email}
                            </p>
                            {user.phone && (
                              <p className="mb-0 text-xs text-slate-500">
                                {user.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 align-top whitespace-nowrap sm:px-6">
                        <StatusBadge
                          value={formatRoleLabel(user.roleNames)}
                          tone={user.roleNames?.length ? "info" : "neutral"}
                        />
                      </td>

                      <td className="px-5 py-4 align-top whitespace-nowrap text-[#0F2747] sm:px-6">
                        {user.joinedDate || "—"}
                      </td>

                      <td className="px-5 py-4 align-top whitespace-nowrap sm:px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              statusInfo.tone === "success"
                                ? "bg-emerald-500"
                                : statusInfo.tone === "danger"
                                  ? "bg-red-500"
                                  : "bg-[#F27123]"
                            }`}
                          />
                          <span
                            className={
                              statusInfo.tone === "success"
                                ? "text-emerald-700"
                                : statusInfo.tone === "danger"
                                  ? "text-red-600"
                                  : "text-[#F27123]"
                            }
                          >
                            {statusInfo.label}
                          </span>
                        </span>
                      </td>

                      <td className="px-5 py-4 align-top whitespace-nowrap sm:px-6">
                        {user.status === "INACTIVE" ? (
                          <span
                            title="Tài khoản đã ngưng hoạt động, không thể mở khóa lại"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400"
                          >
                            <FiLock size={14} />
                            Không thể mở khóa
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={pendingUserId === user.userId}
                            onClick={() => toggleAccountStatus(user)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0F2747] transition hover:border-[#F27123] hover:text-[#F27123] disabled:opacity-60"
                          >
                            {isLocked ? <FiUnlock size={14} /> : <FiLock size={14} />}
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-50 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              Trang
              <select
                value={currentPage}
                onChange={(event) => setPage(Number(event.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-[#0F2747] outline-none focus:border-[#F27123] focus:ring-2 focus:ring-[#F27123]/20"
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
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-[#0F2747] transition hover:border-[#F27123] hover:text-[#F27123] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-[#0F2747]"
              >
                <FiChevronLeft size={16} />
                Trước
              </button>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-[#0F2747] transition hover:border-[#F27123] hover:text-[#F27123] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-[#0F2747]"
              >
                Sau
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

export default AdminUsersPage;
