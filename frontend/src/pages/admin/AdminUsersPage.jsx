import { useEffect, useMemo, useState } from "react";

import { adminApi, staffApi } from "../../api/client";
import { formatRoleLabel, ROLE_LABELS } from "../../utils/formatters";
import Modal from "../../components/atoms/Modal";
import ConfirmModal from "../../components/atoms/ConfirmModal";
import PrettySelect from "../../components/molecules/PrettySelect";

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
  { value: "NONE", label: "Chưa có vai trò (chờ duyệt)" },
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

const RELATIONSHIP_OPTIONS = [
  { value: "Father", label: "Cha" },
  { value: "Mother", label: "Mẹ" },
  { value: "Guardian", label: "Người giám hộ" },
];

function EditUserModal({ user, roles, students, onClose, onSaved }) {
  const [detail, setDetail] = useState(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [children, setChildren] = useState([]);
  const [addStudentId, setAddStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    adminApi
      .getUserDetail(user.userId)
      .then((res) => {
        if (cancelled) return;
        setDetail(res.data);
        setSelectedRoleIds(res.data.roles.map((r) => r.roleId));
        setChildren(res.data.children || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user.userId]);

  const parentRoleId = roles.find((r) => r.roleName === "PARENT")?.roleId;
  const isParent = parentRoleId != null && selectedRoleIds.includes(parentRoleId);

  const availableStudents = useMemo(
    () =>
      students.filter(
        (s) => !children.some((c) => Number(c.studentId) === Number(s.studentId)),
      ),
    [students, children],
  );

  const toggleRole = (roleId) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  const updateChild = (studentId, patch) => {
    setChildren((prev) =>
      prev.map((c) => (c.studentId === studentId ? { ...c, ...patch } : c)),
    );
  };

  const removeChild = (studentId) => {
    setChildren((prev) => prev.filter((c) => c.studentId !== studentId));
  };

  const addChild = () => {
    if (!addStudentId) return;
    const student = students.find((s) => String(s.studentId) === addStudentId);
    if (!student) return;

    setChildren((prev) => [
      ...prev,
      {
        studentId: student.studentId,
        studentCode: student.studentCode,
        studentName: student.fullName,
        relationship: "Guardian",
        isPrimary: prev.length === 0,
      },
    ]);
    setAddStudentId("");
  };

  const handleSave = async () => {
    if (!window.confirm(`Xác nhận cập nhật vai trò cho "${user.fullName}"?`)) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await adminApi.updateUserRoles(user.userId, selectedRoleIds);

      if (isParent) {
        await adminApi.updateUserChildren(
          user.userId,
          children.map((c) => ({
            studentId: c.studentId,
            relationship: c.relationship,
            isPrimary: c.isPrimary,
          })),
        );
      }

      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={`${user.fullName}`} onClose={onClose} maxWidth="max-w-2xl">
      {loading || !detail ? (
        <p className="py-6 text-center text-sm text-slate-500">Đang tải...</p>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold" style={{ color: C.onSurface }}>
              Vai trò
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {roles.map((r) => (
                <label
                  key={r.roleId}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: C.outlineVariant }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(r.roleId)}
                    onChange={() => toggleRole(r.roleId)}
                  />
                  {ROLE_LABELS[r.roleName] || r.roleName}
                </label>
              ))}
            </div>
          </div>

          {isParent && (
            <div>
              <h3 className="mb-2 text-sm font-bold" style={{ color: C.onSurface }}>
                Con của phụ huynh
              </h3>

              {children.length === 0 ? (
                <p className="mb-2 text-sm text-slate-500">Chưa liên kết học sinh nào.</p>
              ) : (
                <div className="mb-3 space-y-2">
                  {children.map((c) => (
                    <div
                      key={c.studentId}
                      className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                      style={{ borderColor: C.outlineVariant }}
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {c.studentCode} · {c.studentName}
                      </span>

                      <PrettySelect
                        value={c.relationship || "Guardian"}
                        onChange={(e) =>
                          updateChild(c.studentId, { relationship: e.target.value })
                        }
                        className="rounded-lg border px-2 py-1 text-xs"
                        style={{ borderColor: C.outlineVariant }}
                      >
                        {RELATIONSHIP_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </PrettySelect>

                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(c.isPrimary)}
                          onChange={(e) =>
                            updateChild(c.studentId, { isPrimary: e.target.checked })
                          }
                        />
                        Liên hệ chính
                      </label>

                      <button
                        type="button"
                        onClick={() => removeChild(c.studentId)}
                        className="rounded-full px-2 py-1 text-xs font-bold"
                        style={{ color: C.error }}
                      >
                        Gỡ
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <PrettySelect
                  value={addStudentId}
                  onChange={(e) => setAddStudentId(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: C.outlineVariant }}
                >
                  <option value="">-- Chọn học sinh để thêm --</option>
                  {availableStudents.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.studentCode} · {s.fullName}
                    </option>
                  ))}
                </PrettySelect>
                <button
                  type="button"
                  onClick={addChild}
                  disabled={!addStudentId}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: C.secondary }}
                >
                  Thêm
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: C.outlineVariant }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: C.outlineVariant, color: C.onSurfaceVariant }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: C.primary }}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
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
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [roles, setRoles] = useState([]);
  const [students, setStudents] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [statusConfirmUser, setStatusConfirmUser] = useState(null);

  useEffect(() => {
    adminApi.getRoles().then((res) => setRoles(res.data)).catch(() => {});
    staffApi
      .getLookups()
      .then((res) => setStudents(res.data.students || []))
      .catch(() => {});
  }, []);

  const loadUsers = () => {
    setLoading(true);
    adminApi
      .getUsers({ search, status, role, dateFrom, dateTo, page, limit: PAGE_SIZE })
      .then((response) => {
        setUsers(response.data.items);
        setPagination(response.data.pagination);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(loadUsers, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, role, dateFrom, dateTo, page]);

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

  const requestToggleAccountStatus = (user) => {
    if (user.status === "INACTIVE") return;
    setStatusConfirmUser(user);
  };

  const confirmToggleAccountStatus = async () => {
    const user = statusConfirmUser;
    if (!user) return;

    const nextStatus = user.status === "ACTIVE" ? "LOCKED" : "ACTIVE";

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
      setStatusConfirmUser(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingUserId(null);
    }
  };

  const rows = useMemo(() => users, [users]);

  const totalPages = pagination.totalPages;
  const currentPage = pagination.page;
  const pagedRows = rows;

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
            <PrettySelect
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
            </PrettySelect>
          </div>

          <div className="flex items-center rounded-xl border bg-white p-1 px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
            <Ms name="badge" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
            <PrettySelect
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
            </PrettySelect>
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={user.status !== "ACTIVE"}
                            title={
                              user.status === "LOCKED"
                                ? "Tài khoản đang bị khóa, hãy mở khóa trước khi sửa vai trò"
                                : user.status === "INACTIVE"
                                  ? "Tài khoản đã ngưng hoạt động, không thể sửa vai trò"
                                  : undefined
                            }
                            onClick={() => setEditingUser(user)}
                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40"
                            style={{ borderColor: C.secondary, color: C.secondary, backgroundColor: "#fff" }}
                          >
                            <Ms name="edit" className="!text-[14px]!" />
                            Sửa
                          </button>

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
                              onClick={() => requestToggleAccountStatus(user)}
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
                        </div>
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
              <PrettySelect
                value={currentPage}
                onChange={(event) => setPage(Number(event.target.value))}
                dropUp
                className="cursor-pointer rounded-lg border bg-white px-2 py-1 text-sm font-semibold outline-none"
                style={{ borderColor: C.outlineVariant, color: C.onSurface }}
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </PrettySelect>
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

      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          students={students}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            loadUsers();
          }}
        />
      )}

      <ConfirmModal
        open={Boolean(statusConfirmUser)}
        title={statusConfirmUser?.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
        message={
          statusConfirmUser?.status === "ACTIVE"
            ? `Khóa tài khoản của "${statusConfirmUser?.fullName}"?`
            : `Mở khóa tài khoản của "${statusConfirmUser?.fullName}"?`
        }
        confirmLabel={statusConfirmUser?.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
        tone={statusConfirmUser?.status === "ACTIVE" ? "danger" : "default"}
        loading={pendingUserId === statusConfirmUser?.userId}
        onConfirm={confirmToggleAccountStatus}
        onClose={() => setStatusConfirmUser(null)}
      />
    </div>
  );
}

export default AdminUsersPage;
