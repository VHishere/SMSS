import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiEdit2,
  FiList,
  FiLock,
  FiSave,
  FiX,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useAttendanceAnalytics } from "../../hooks/useAttendanceAnalytics";
import { useAttendanceHistory } from "../../hooks/useAttendanceHistory";
import { useAttendanceSheet } from "../../hooks/useAttendanceSheet";
import { useTeacherClasses } from "../../hooks/useTeacherClasses";
import { teacherApi } from "../../api/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "roll-call", label: "Điểm danh",   icon: FiCheck },
  { key: "history",   label: "Lịch sử",     icon: FiList },
  { key: "analytics", label: "Thống kê",    icon: FiBarChart2 },
];

const STATUS_CONFIG = {
  PRESENT:          { label: "Có mặt",         bg: "#ECFDF5", text: "#059669", border: "#6EE7B7" },
  LATE:             { label: "Đi muộn",         bg: "#FFFBEB", text: "#D97706", border: "#FCD34D" },
  ABSENT_EXCUSED:   { label: "Vắng có phép",    bg: "#EBF3FF", text: "#08509F", border: "#93C5FD" },
  ABSENT_UNEXCUSED: { label: "Vắng không phép", bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" },
  EARLY_LEAVE:      { label: "Về sớm",          bg: "#F5F3FF", text: "#7C3AED", border: "#C4B5FD" },
};

const VN_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatVN(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${VN_DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function getMonthRange(offsetMonths = 0) {
  const now  = new Date();
  const year = now.getFullYear();
  const mo   = now.getMonth() + offsetMonths;
  const start = new Date(year, mo, 1);
  const end   = new Date(year, mo + 1, 0);
  return { startDate: toISO(start), endDate: toISO(end) };
}

// ─── Shared: Status Badge ─────────────────────────────────────────────────────

function StatusBadge({ typeName }) {
  if (!typeName) return <span className="text-slate-400">—</span>;
  const cfg = STATUS_CONFIG[typeName] ?? { label: typeName, bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Roll Call: Status Button ─────────────────────────────────────────────────

function StatusButton({ typeName, isActive, disabled, onClick }) {
  const cfg = STATUS_CONFIG[typeName] ?? { label: typeName, bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
      style={
        isActive
          ? { backgroundColor: cfg.text, color: "#fff", border: `1px solid ${cfg.text}`, opacity: disabled ? 0.6 : 1 }
          : { backgroundColor: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0", cursor: disabled ? "not-allowed" : "pointer" }
      }
    >
      {cfg.label}
    </button>
  );
}

// ─── Roll Call: Student Row ────────────────────────────────────────────────────

function StudentRollCallRow({ student, typeId, attendanceTypes, onSelect, isLocked }) {
  const [showNote, setShowNote] = useState(false);
  const [note,     setNote]     = useState(student.note ?? "");

  useEffect(() => {
    setNote(student.note ?? "");
  }, [student.note]);

  const handleNoteBlur = useCallback(() => {
    onSelect(student.studentId, typeId, note);
  }, [student.studentId, typeId, note, onSelect]);

  return (
    <div
      className="border-b py-3 last:border-b-0"
      style={{ borderColor: "#FFE7D6" }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* Avatar + name */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: "#08509F" }}
          >
            {student.avatar ? (
              <img src={student.avatar} alt={student.fullName} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              student.fullName?.[0]?.toUpperCase() ?? "?"
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: "#0F2747" }}>
              {student.fullName}
            </p>
            <p className="text-xs text-slate-400">{student.studentCode}</p>
          </div>
        </div>

        {/* Status buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {attendanceTypes.map((t) => (
            <StatusButton
              key={t.typeId}
              typeName={t.typeName}
              isActive={typeId === t.typeId}
              disabled={isLocked}
              onClick={() => onSelect(student.studentId, t.typeId, note)}
            />
          ))}

          {isLocked ? (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              <FiLock size={10} />
              Đã khóa
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              className="ml-1 flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
            >
              {showNote ? <FiChevronUp size={10} /> : <FiChevronDown size={10} />}
              Ghi chú
            </button>
          )}
        </div>
      </div>

      {showNote && !isLocked && (
        <div className="mt-2 pl-12">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Ghi chú (tùy chọn)..."
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
        </div>
      )}
    </div>
  );
}

// ─── Roll Call Tab ─────────────────────────────────────────────────────────────

function RollCallTab({ classId, className, teacherName }) {
  const todayStr = useMemo(() => toISO(new Date()), []);
  const [date, setDate] = useState(todayStr);

  const { data: sheet, loading: sheetLoading, error: sheetError } = useAttendanceSheet(classId, date);

  const [selections, setSelections] = useState({});
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState({ text: "", isError: false });

  // Initialize selections when sheet loads
  useEffect(() => {
    if (!sheet) return;
    const init = {};
    for (const s of sheet.students) {
      init[s.studentId] = {
        typeId:       s.typeId       ?? null,
        note:         s.note         ?? "",
        attendanceId: s.attendanceId ?? null,
        isEditable:   s.isEditable,
      };
    }
    setSelections(init);
    setSaveMsg({ text: "", isError: false });
  }, [sheet]);

  const handleSelect = useCallback((studentId, typeId, note) => {
    setSelections((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], typeId, note },
    }));
    setSaveMsg({ text: "", isError: false });
  }, []);

  const markedCount   = Object.values(selections).filter((s) => s.typeId).length;
  const totalStudents = sheet?.students?.length ?? 0;
  const allMarked     = markedCount === totalStudents && totalStudents > 0;

  async function handleSave() {
    if (!sheet || markedCount === 0) return;

    const records = Object.entries(selections)
      .filter(([, v]) => v.typeId && v.isEditable)
      .map(([studentId, v]) => ({
        studentId: parseInt(studentId, 10),
        typeId:    v.typeId,
        note:      v.note || null,
      }));

    if (records.length === 0) {
      setSaveMsg({ text: "Không có bản ghi nào để lưu.", isError: true });
      return;
    }

    setSaving(true);
    setSaveMsg({ text: "", isError: false });

    try {
      await teacherApi.submitAttendance(classId, { date, records });
      setSaveMsg({ text: `Đã lưu điểm danh ${records.length} học sinh.`, isError: false });
    } catch (err) {
      setSaveMsg({ text: err.message, isError: true });
    } finally {
      setSaving(false);
    }
  }

  const editableCount = sheet
    ? sheet.students.filter((s) => s.isEditable).length
    : 0;

  return (
    <div>
      {/* Date + info bar */}
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Ngày điểm danh</label>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
        </div>

        <div
          className="rounded-xl px-3 py-2 text-sm"
          style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}
        >
          <span className="font-medium text-[#0F2747]">{className}</span>
          {sheet && (
            <span className="ml-2 text-slate-500">
              · {markedCount}/{totalStudents} đã điểm danh
            </span>
          )}
        </div>
      </div>

      {sheetLoading && (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {sheetError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {sheetError}
        </div>
      )}

      {!sheetLoading && !sheetError && sheet && (
        <>
          {/* Legend */}
          {sheet.students.some((s) => !s.isEditable) && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <FiLock size={12} />
              Một số bản ghi đã vượt quá 48 giờ (BR-ATT-01) và không thể chỉnh sửa.
            </div>
          )}

          {/* Student list */}
          <div
            className="mb-5 rounded-xl bg-white px-4 py-2 shadow-sm"
            style={{ border: "1px solid #FFE7D6" }}
          >
            {sheet.students.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Lớp chưa có học sinh nào đăng ký.
              </p>
            ) : (
              sheet.students.map((student) => (
                <StudentRollCallRow
                  key={student.studentId}
                  student={student}
                  typeId={selections[student.studentId]?.typeId ?? null}
                  attendanceTypes={sheet.attendanceTypes}
                  onSelect={handleSelect}
                  isLocked={!student.isEditable}
                />
              ))
            )}
          </div>

          {/* Summary row */}
          <div className="mb-4 flex flex-wrap gap-2">
            {sheet.attendanceTypes.map((t) => {
              const count = Object.values(selections).filter(
                (s) => s.typeId === t.typeId,
              ).length;
              const cfg = STATUS_CONFIG[t.typeName] ?? { label: t.typeName, bg: "#F1F5F9", text: "#475569" };
              return (
                <span
                  key={t.typeId}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: cfg.bg, color: cfg.text }}
                >
                  {cfg.label}: {count}
                </span>
              );
            })}
          </div>

          {/* Save button + message */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || markedCount === 0 || editableCount === 0}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: "#F27123" }}
            >
              {saving ? (
                <>
                  <FiClock size={15} className="animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <FiSave size={15} />
                  Lưu điểm danh
                  {markedCount > 0 && <span>({markedCount})</span>}
                </>
              )}
            </button>

            {!allMarked && markedCount > 0 && (
              <span className="text-xs text-amber-600">
                <FiAlertTriangle className="mr-1 inline" size={12} />
                Còn {totalStudents - markedCount} học sinh chưa được điểm danh.
              </span>
            )}

            {saveMsg.text && (
              <span
                className={`text-xs font-medium ${saveMsg.isError ? "text-red-600" : "text-green-600"}`}
              >
                {saveMsg.text}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── History Tab ───────────────────────────────────────────────────────────────

const HISTORY_COLS = ["STT", "NGÀY", "HỌC SINH", "TRẠNG THÁI", "GHI CHÚ", ""];

function EditModal({ record, attendanceTypes, onClose, onSaved }) {
  const [typeId,   setTypeId]   = useState(record.typeId);
  const [note,     setNote]     = useState(record.note ?? "");
  const [saving,   setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSave() {
    setSaving(true);
    setErrorMsg("");
    try {
      await teacherApi.updateAttendanceRecord(record.attendanceId, {
        typeId: parseInt(typeId, 10),
        note:   note || null,
      });
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        style={{ border: "1px solid #FFE7D6" }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>
              Cập nhật điểm danh
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {record.fullName} · {formatVN(record.attendanceDate)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Trạng thái điểm danh
          </label>
          <div className="flex flex-wrap gap-2">
            {attendanceTypes.map((t) => (
              <button
                key={t.typeId}
                type="button"
                onClick={() => setTypeId(t.typeId)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                style={
                  typeId === t.typeId
                    ? {
                        backgroundColor: STATUS_CONFIG[t.typeName]?.text ?? "#0F2747",
                        color: "#fff",
                      }
                    : {
                        backgroundColor: "#F8FAFC",
                        color: "#94A3B8",
                        border: "1px solid #E2E8F0",
                      }
                }
              >
                {STATUS_CONFIG[t.typeName]?.label ?? t.typeName}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Ghi chú (tùy chọn)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập ghi chú..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
        </div>

        {errorMsg && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {errorMsg}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: "#F27123" }}
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ classId, className }) {
  const todayStr = toISO(new Date());
  const monthAgo = toISO(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const [startDate, setStartDate] = useState(monthAgo);
  const [endDate,   setEndDate]   = useState(todayStr);
  const [studentId, setStudentId] = useState("");
  const [typeId,    setTypeId]    = useState("");
  const [page,      setPage]      = useState(1);

  const [editRecord,       setEditRecord]       = useState(null);
  const [attendanceTypes,  setAttendanceTypes]  = useState([]);
  const [refreshKey,       setRefreshKey]       = useState(0);

  const filters = useMemo(
    () => ({
      startDate,
      endDate,
      ...(studentId ? { studentId } : {}),
      ...(typeId    ? { typeId }    : {}),
      page,
      limit: 20,
      _rk: refreshKey,
    }),
    [startDate, endDate, studentId, typeId, page, refreshKey],
  );

  const { data, loading, error } = useAttendanceHistory(classId, filters);

  // Fetch attendance types once for the edit modal
  useEffect(() => {
    if (!classId) return;
    teacherApi
      .getAttendanceSheet(classId, todayStr)
      .then((res) => setAttendanceTypes(res.data?.attendanceTypes ?? []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const pagination = data?.pagination;

  function handleFilterChange() {
    setPage(1);
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Từ ngày</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); handleFilterChange(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Đến ngày</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); handleFilterChange(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Trạng thái</label>
          <select
            value={typeId}
            onChange={(e) => { setTypeId(e.target.value); handleFilterChange(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          >
            <option value="">Tất cả</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div
            className="overflow-hidden rounded-xl bg-white shadow-sm"
            style={{ border: "1px solid #FFE7D6" }}
          >
            {!data?.items?.length ? (
              <p className="p-10 text-center text-sm text-slate-400">
                Không có dữ liệu điểm danh trong khoảng thời gian này.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr
                      className="border-b text-left"
                      style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}
                    >
                      {HISTORY_COLS.map((col) => (
                        <th
                          key={col}
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
                        key={row.attendanceId}
                        className="border-b last:border-b-0"
                        style={{
                          borderColor: "#FFF7F2",
                          backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff",
                        }}
                      >
                        <td className="px-4 py-3 text-slate-400">
                          {(page - 1) * 20 + idx + 1}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[#0F2747]">
                          {formatVN(row.attendanceDate)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-[#0F2747]">
                            {row.fullName}
                          </div>
                          <div className="text-xs text-slate-400">{row.studentCode}</div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge typeName={row.typeName} />
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-slate-500">
                          {row.note || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {Number(row.isEditable) ? (
                            <button
                              type="button"
                              onClick={() => setEditRecord(row)}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition"
                              style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}
                            >
                              <FiEdit2 size={11} />
                              Sửa
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <FiLock size={11} />
                              Đã khóa
                            </span>
                          )}
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
                {Math.min(page * pagination.limit, pagination.total)} trong {pagination.total} bản ghi
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

      {editRecord && (
        <EditModal
          record={editRecord}
          attendanceTypes={attendanceTypes}
          onClose={() => setEditRecord(null)}
          onSaved={() => {
            setEditRecord(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

const ANALYTICS_PERIODS = [
  { label: "Tháng này",   ...getMonthRange(0)  },
  { label: "Tháng trước", ...getMonthRange(-1) },
  { label: "2 tháng trước", ...getMonthRange(-2) },
];

const TYPE_LABEL = {
  PRESENT:          { label: "Có mặt",         color: "#059669" },
  LATE:             { label: "Đi muộn",         color: "#D97706" },
  ABSENT_EXCUSED:   { label: "Vắng có phép",    color: "#08509F" },
  ABSENT_UNEXCUSED: { label: "Vắng không phép", color: "#DC2626" },
  EARLY_LEAVE:      { label: "Về sớm",          color: "#7C3AED" },
};

function AnalyticsSummaryCard({ typeName, count, rate }) {
  const cfg = TYPE_LABEL[typeName] ?? { label: typeName, color: "#475569" };
  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm"
      style={{ border: "1px solid #FFE7D6" }}
    >
      <p className="mb-1 text-xs font-medium text-slate-500">{cfg.label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color: "#0F2747" }}>
        {rate}%
      </p>
      <p className="mt-1 text-xs text-slate-400">{count} lần</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: cfg.color }}
        />
      </div>
    </div>
  );
}

function AnalyticsTimelineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex h-36 items-center justify-center rounded-xl border border-dashed text-sm text-slate-400"
        style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}
      >
        Không có dữ liệu trong khoảng thời gian này
      </div>
    );
  }

  const SLOT   = 48;
  const BAR_W  = 32;
  const CH     = 100;
  const PAD_T  = 18;
  const LABEL_H = 20;
  const SVG_H  = PAD_T + CH + LABEL_H;
  const SVG_W  = data.length * SLOT;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" role="img" aria-label="Biểu đồ điểm danh">
      {data.map((day, i) => {
        const cx      = i * SLOT + SLOT / 2;
        const bx      = cx - BAR_W / 2;
        const totalH  = Math.round((day.total / maxTotal) * CH);
        const presentH = day.total > 0 ? Math.round(((day.present + day.late) / day.total) * totalH) : 0;
        const absentH = totalH - presentH;
        const barTop  = PAD_T + CH - totalH;

        const d  = new Date(day.date + "T00:00:00");
        const lbl = `${d.getDate()}/${d.getMonth() + 1}`;

        return (
          <g key={day.date}>
            <rect x={bx} y={PAD_T} width={BAR_W} height={CH} rx={5} fill="#F1F5F9" />
            {totalH > 1 && (
              <rect x={bx} y={barTop} width={BAR_W} height={totalH} rx={5} fill="#F27123" />
            )}
            {absentH > 1 && (
              <rect x={bx} y={barTop} width={BAR_W} height={absentH} rx={3} fill="#0F2747" fillOpacity={0.5} />
            )}
            {day.total > 0 && (
              <text x={cx} y={barTop - 4} textAnchor="middle" fontSize="9" fontFamily="system-ui, sans-serif" fill="#0F2747" fontWeight="600">
                {day.total}
              </text>
            )}
            <text x={cx} y={PAD_T + CH + 14} textAnchor="middle" fontSize="9" fontFamily="system-ui, sans-serif" fill="#64748B">
              {lbl}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AnalyticsTab({ classId, className }) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [useCustom,   setUseCustom]   = useState(false);

  const period    = ANALYTICS_PERIODS[periodIdx];
  const startDate = useCustom ? customStart : period.startDate;
  const endDate   = useCustom ? customEnd   : period.endDate;

  const { data, loading, error } = useAttendanceAnalytics(
    classId,
    startDate || undefined,
    endDate   || undefined,
  );

  const allTypes = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "EARLY_LEAVE"];

  return (
    <div>
      {/* Period selector */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          {ANALYTICS_PERIODS.map((p, idx) => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setPeriodIdx(idx); setUseCustom(false); }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
              style={
                !useCustom && periodIdx === idx
                  ? { backgroundColor: "#F27123", color: "#fff" }
                  : { color: "#64748B" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Tùy chỉnh từ</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => { setCustomStart(e.target.value); setUseCustom(true); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">đến</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => { setCustomEnd(e.target.value); setUseCustom(true); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {allTypes.map((t) => (
              <AnalyticsSummaryCard
                key={t}
                typeName={t}
                count={data.summary.byType[t]?.count ?? 0}
                rate={data.summary.byType[t]?.rate ?? 0}
              />
            ))}
          </div>

          {/* Timeline chart */}
          <div
            className="mb-6 rounded-xl bg-white p-5 shadow-sm"
            style={{ border: "1px solid #FFE7D6" }}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>
                  Biểu đồ điểm danh theo ngày
                </h3>
                <p className="text-xs text-slate-500">
                  {data.period.startDate} → {data.period.endDate}
                  <span className="ml-2 text-slate-400">
                    · Tổng {data.summary.totalRecords} lần ghi nhận
                  </span>
                </p>
              </div>
              <div className="flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#F27123" }} />
                  Có mặt / Muộn
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm opacity-50" style={{ backgroundColor: "#0F2747" }} />
                  Vắng
                </span>
              </div>
            </div>
            {data.timeline.length > 0 ? (
              <div className="overflow-x-auto">
                <div style={{ minWidth: data.timeline.length * 48 }}>
                  <AnalyticsTimelineChart data={data.timeline} />
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                Chưa có dữ liệu điểm danh trong giai đoạn này.
              </p>
            )}
          </div>

          {/* Per-student table */}
          <div
            className="overflow-hidden rounded-xl bg-white shadow-sm"
            style={{ border: "1px solid #FFE7D6" }}
          >
            <div className="border-b px-5 py-3" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
              <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>
                Chi tiết theo học sinh
              </h3>
            </div>
            {data.students.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "#FFE7D6" }}>
                      {["Học sinh", "Có mặt", "Đi muộn", "Vắng có phép", "Vắng không phép", "Về sớm", "Chuyên cần"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider"
                          style={{ color: "#F27123" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s, idx) => (
                      <tr
                        key={s.studentId}
                        className="border-b last:border-b-0"
                        style={{
                          borderColor: "#FFF7F2",
                          backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff",
                        }}
                      >
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium text-[#0F2747]">{s.fullName}</div>
                          <div className="text-xs text-slate-400">{s.studentCode}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-700">{s.present}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={s.late > 0 ? "font-semibold text-amber-600" : "text-slate-400"}>
                            {s.late}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={s.absentExcused > 0 ? "font-semibold text-blue-600" : "text-slate-400"}>
                            {s.absentExcused}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={s.absentUnexcused > 0 ? "font-semibold text-red-600" : "text-slate-400"}>
                            {s.absentUnexcused}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{s.earlyLeave}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${s.attendanceRate}%`,
                                  backgroundColor: s.attendanceRate >= 80 ? "#059669" : s.attendanceRate >= 60 ? "#D97706" : "#DC2626",
                                }}
                              />
                            </div>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: s.attendanceRate >= 80 ? "#059669" : s.attendanceRate >= 60 ? "#D97706" : "#DC2626" }}
                            >
                              {s.attendanceRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AttendancePage() {
  const { user }                               = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useTeacherClasses();
  const [searchParams, setSearchParams]        = useSearchParams();
  const activeTab = searchParams.get("tab") || "roll-call";

  const [selectedClassId, setSelectedClassId] = useState(null);

  // Select primary class once profile loads
  useEffect(() => {
    if (!profile?.classes?.length) return;
    const primary =
      profile.classes.find((c) => c.roleInClass === "HOMEROOM_TEACHER") ||
      profile.classes[0];
    setSelectedClassId((prev) => prev ?? primary.classId);
  }, [profile]);

  const selectedClass = useMemo(
    () => profile?.classes?.find((c) => c.classId === selectedClassId) ?? null,
    [profile, selectedClassId],
  );

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName),
    );
    return {
      name:   profile?.fullName ?? user?.fullName ?? user?.username ?? "Giáo viên",
      role:   roleEntry?.description ?? "Giáo viên",
      avatar: profile?.avatar ?? user?.avatar ?? "",
    };
  }, [profile, user]);

  function setTab(key) {
    setSearchParams({ tab: key });
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp chủ nhiệm"
      sidebarFooterValue={selectedClass?.className ?? "Chưa phân công"}
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
          Quản lý điểm danh
        </h1>
        <p className="text-sm text-slate-500">
          Điểm danh, xem lịch sử và thống kê chuyên cần theo lớp.
        </p>
      </section>

      {profileLoading && (
        <div className="space-y-4">
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      {profileError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được thông tin giáo viên: {profileError}
        </div>
      )}

      {!profileLoading && !profileError && profile && (
        <>
          {/* Class selector (when multiple) */}
          {profile.classes.length > 1 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {profile.classes.map((c) => (
                <button
                  key={c.classId}
                  type="button"
                  onClick={() => setSelectedClassId(c.classId)}
                  className="rounded-full px-4 py-2 text-sm font-medium transition"
                  style={
                    c.classId === selectedClassId
                      ? { backgroundColor: "#08509F", color: "#fff" }
                      : { backgroundColor: "#fff", color: "#475569", border: "1px solid #E2E8F0" }
                  }
                >
                  {c.className}
                  <span className="ml-1.5 opacity-70">· {c.gradeName}</span>
                </button>
              ))}
            </div>
          )}

          {profile.classes.length === 0 && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}
            >
              Tài khoản chưa được phân công lớp học. Vui lòng liên hệ quản trị viên.
            </div>
          )}

          {selectedClass && (
            <>
              {/* Tab navigation */}
              <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                    style={
                      activeTab === key
                        ? { backgroundColor: "#F27123", color: "#fff" }
                        : { color: "#64748B" }
                    }
                  >
                    <Icon size={15} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div
                className="rounded-2xl bg-white p-5 shadow-sm sm:p-6"
                style={{ border: "1px solid #FFE7D6" }}
              >
                {activeTab === "roll-call" && (
                  <RollCallTab
                    classId={selectedClass.classId}
                    className={selectedClass.className}
                    teacherName={profile.fullName}
                  />
                )}
                {activeTab === "history" && (
                  <HistoryTab
                    classId={selectedClass.classId}
                    className={selectedClass.className}
                  />
                )}
                {activeTab === "analytics" && (
                  <AnalyticsTab
                    classId={selectedClass.classId}
                    className={selectedClass.className}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default AttendancePage;
