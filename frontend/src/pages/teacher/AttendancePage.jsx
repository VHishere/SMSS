import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import PrettySelect from "../../components/molecules/PrettySelect";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useAttendanceAnalytics } from "../../hooks/useAttendanceAnalytics";
import { useTeacherClasses } from "../../hooks/useTeacherClasses";
import { reportApi, teacherApi } from "../../api/client";
import { formatDateVN } from "../../utils/datetime";

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

// Nhãn ngắn + màu active của pill trạng thái (theo design Stitch)
const STATUS_PILL = {
  PRESENT:          { label: "Hiện diện", bg: "#F2712315", text: "#9F4200", border: "#F27123" },
  LATE:             { label: "Muộn",      bg: "#4A5F8215", text: "#4A5F82", border: "#4A5F82" },
  ABSENT_UNEXCUSED: { label: "Vắng",      bg: "#BA1A1A15", text: "#BA1A1A", border: "#BA1A1A" },
  ABSENT_EXCUSED:   { label: "Phép",      bg: "#225DAD15", text: "#225DAD", border: "#225DAD" },
  EARLY_LEAVE:      { label: "Về sớm",    bg: "#8298BE20", text: "#4A5F82", border: "#8298BE" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthRange(offsetMonths = 0) {
  const now  = new Date();
  const year = now.getFullYear();
  const mo   = now.getMonth() + offsetMonths;
  const start = new Date(year, mo, 1);
  const end   = new Date(year, mo + 1, 0);
  return { startDate: toISO(start), endDate: toISO(end) };
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Quick Stat Card (Stitch: left accent border, 48px number, progress) ─────

function QuickStatCard({ label, count, total, accent, iconName, iconColor, iconBg }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      className="rounded-[2rem] bg-white p-5 shadow-sm transition-transform hover:-translate-y-1"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.onSurfaceVariant }}>
            {label}
          </p>
          <h3 className="mt-2 text-5xl font-bold leading-none" style={{ color: C.onSurface }}>
            {count}
          </h3>
        </div>
        <div className="rounded-lg p-2" style={{ backgroundColor: iconBg }}>
          <Ms name={iconName} fill style={{ color: iconColor }} />
        </div>
      </div>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#E2E2E2" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
      </div>
    </div>
  );
}

// ─── Status pill radio group ──────────────────────────────────────────────────

function StatusPills({ types, activeTypeId, disabled, onPick }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {types.map((t) => {
        const cfg = STATUS_PILL[t.typeName] ?? { label: t.typeName, bg: "#EEEEEE", text: C.onSurfaceVariant, border: C.outlineVariant };
        const active = activeTypeId === t.typeId;
        return (
          <button
            key={t.typeId}
            type="button"
            disabled={disabled}
            onClick={() => onPick(t.typeId)}
            className="rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={
              active
                ? { backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }
                : { backgroundColor: "transparent", color: C.onSurfaceVariant, borderColor: C.outlineVariant }
            }
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Roll Call: Student Row ───────────────────────────────────────────────────

function StudentRow({ index, student, typeId, note, attendanceTypes, onSelect, isLocked }) {
  const [localNote, setLocalNote] = useState(note ?? "");
  useEffect(() => { setLocalNote(note ?? ""); }, [note]);

  return (
    <tr className="transition-colors hover:bg-[#F3F3F3]">
      <td className="px-6 py-4 text-sm" style={{ color: C.onSurfaceVariant }}>
        {String(index + 1).padStart(2, "0")}
      </td>
      <td className="px-6 py-4 text-sm font-bold" style={{ color: C.secondary }}>
        {student.studentCode}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {student.avatar ? (
            <img
              src={student.avatar}
              alt={student.fullName}
              className="h-9 w-9 rounded-full border object-cover"
              style={{ borderColor: C.outlineVariant }}
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: C.surfaceHigh, color: C.onSurfaceVariant }}
            >
              {initials(student.fullName)}
            </div>
          )}
          <span className="text-sm font-medium" style={{ color: C.onSurface }}>
            {student.fullName}
          </span>
          {isLocked && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              <Ms name="lock" className="!text-[11px]" /> Đã khóa
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <StatusPills
          types={attendanceTypes}
          activeTypeId={typeId}
          disabled={isLocked}
          onPick={(tId) => onSelect(student.studentId, tId, localNote)}
        />
      </td>
      <td className="px-6 py-4">
        <input
          type="text"
          value={localNote}
          disabled={isLocked}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => onSelect(student.studentId, typeId, localNote)}
          placeholder="Thêm ghi chú..."
          className="w-full rounded-xl border bg-white px-3 py-1.5 text-sm outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-400"
          style={{ borderColor: C.outlineVariant, color: C.onSurface }}
        />
      </td>
    </tr>
  );
}

// ─── Roll Call Tab ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function PeriodSheet({ period, date, onBack }) {
  const [sheet, setSheet] = useState(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState("");

  useEffect(() => {
    let m = true;
    setSheetLoading(true); setSheetError("");
    teacherApi.getPeriodSheet(period.timetableId, date)
      .then((res) => { if (m) setSheet(res.data); })
      .catch((e) => { if (m) setSheetError(e.message); })
      .finally(() => { if (m) setSheetLoading(false); });
    return () => { m = false; };
  }, [period.timetableId, date]);

  const [selections, setSelections] = useState({});
  const [saving,     setSaving]     = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [saveMsg,    setSaveMsg]    = useState({ text: "", isError: false });
  const [page,       setPage]       = useState(1);
  const [feedback,   setFeedback]   = useState({}); // studentId → { rating, content }
  const [fbSaving,   setFbSaving]   = useState(false);
  const [fbMsg,      setFbMsg]      = useState({ text: "", isError: false });

  useEffect(() => {
    if (!sheet) return;
    const init = {};
    const fb = {};
    for (const s of sheet.students) {
      init[s.studentId] = { typeId: s.typeId ?? null, note: s.note ?? "", attendanceId: s.attendanceId ?? null, isEditable: s.isEditable };
      fb[s.studentId] = { rating: s.feedbackRating ?? "", content: s.feedbackContent ?? "" };
    }
    setSelections(init);
    setFeedback(fb);
    setSaveMsg({ text: "", isError: false });
    setFbMsg({ text: "", isError: false });
    setPage(1);
  }, [sheet]);

  function setFb(studentId, key, value) {
    setFeedback((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [key]: value } }));
    setFbMsg({ text: "", isError: false });
  }

  async function handleSaveFeedback() {
    const items = Object.entries(feedback)
      .map(([studentId, v]) => ({ studentId: Number(studentId), rating: v.rating || null, content: v.content || null }))
      .filter((it) => it.rating || it.content);
    if (!items.length) { setFbMsg({ text: "Chưa nhập nhận xét nào.", isError: true }); return; }
    setFbSaving(true); setFbMsg({ text: "", isError: false });
    try {
      await teacherApi.submitPeriodFeedback(period.timetableId, { date, items });
      setFbMsg({ text: `Đã lưu nhận xét ${items.length} học sinh.`, isError: false });
    } catch (err) {
      setFbMsg({ text: err.message, isError: true });
    } finally { setFbSaving(false); }
  }

  const handleSelect = useCallback((studentId, typeId, note) => {
    setSelections((prev) => ({ ...prev, [studentId]: { ...prev[studentId], typeId, note } }));
    setSaveMsg({ text: "", isError: false });
  }, []);

  function markAllPresent() {
    if (!sheet) return;
    const present = sheet.attendanceTypes.find((t) => t.typeName === "PRESENT");
    if (!present) return;
    setSelections((prev) => {
      const next = { ...prev };
      for (const s of sheet.students) {
        if (s.isEditable) next[s.studentId] = { ...next[s.studentId], typeId: present.typeId };
      }
      return next;
    });
    setSaveMsg({ text: "", isError: false });
  }

  const typeIdToName = useMemo(() => {
    const map = {};
    for (const t of sheet?.attendanceTypes ?? []) map[t.typeId] = t.typeName;
    return map;
  }, [sheet]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT_UNEXCUSED: 0, LATE: 0, ABSENT_EXCUSED: 0, EARLY_LEAVE: 0 };
    for (const s of Object.values(selections)) {
      const name = typeIdToName[s.typeId];
      if (name && c[name] !== undefined) c[name] += 1;
    }
    return c;
  }, [selections, typeIdToName]);

  const markedCount   = Object.values(selections).filter((s) => s.typeId).length;
  const totalStudents = sheet?.students?.length ?? 0;
  const editableCount = sheet ? sheet.students.filter((s) => s.isEditable).length : 0;

  const totalPages = Math.max(1, Math.ceil(totalStudents / PAGE_SIZE));
  const pageStudents = useMemo(
    () => (sheet?.students ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sheet, page],
  );

  async function handleSave() {
    if (!sheet || markedCount === 0) return;

    const unmarkedEditable = sheet.students.filter((s) => s.isEditable && !selections[s.studentId]?.typeId);
    if (unmarkedEditable.length > 0) {
      setSaveMsg({ text: `Vui lòng điểm danh đầy đủ trước khi lưu. Còn ${unmarkedEditable.length} học sinh chưa chọn trạng thái.`, isError: true });
      return;
    }

    const records = Object.entries(selections)
      .filter(([, v]) => v.typeId && v.isEditable)
      .map(([studentId, v]) => ({ studentId: parseInt(studentId, 10), typeId: v.typeId, note: v.note || null }));

    if (records.length === 0) {
      setSaveMsg({ text: "Không có bản ghi nào để lưu.", isError: true });
      return;
    }

    setSaving(true);
    setSaveMsg({ text: "", isError: false });
    try {
      await teacherApi.submitPeriodAttendance(period.timetableId, { date, records });
      setSaveMsg({ text: `Đã lưu điểm danh ${records.length} học sinh.`, isError: false });
    } catch (err) {
      setSaveMsg({ text: err.message, isError: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleExcel() {
    setExporting(true);
    try {
      await reportApi.exportExcel("ATTENDANCE", { className: period.className, classId: Number(period.classId), startDate: date, endDate: date });
    } catch (err) {
      setSaveMsg({ text: err.message, isError: true });
    } finally {
      setExporting(false);
    }
  }

  const statCards = [
    { label: "Hiện diện", count: counts.PRESENT,          accent: C.primary,   iconName: "check_circle", iconColor: C.primaryContainer, iconBg: "rgba(242,113,35,0.10)" },
    { label: "Vắng mặt",  count: counts.ABSENT_UNEXCUSED, accent: C.error,     iconName: "cancel",       iconColor: C.error,            iconBg: "rgba(255,218,214,0.4)" },
    { label: "Đi muộn",   count: counts.LATE,             accent: C.tertiary,  iconName: "schedule",     iconColor: C.tertiary,         iconBg: "rgba(130,152,190,0.2)" },
    { label: "Nghỉ phép", count: counts.ABSENT_EXCUSED,   accent: C.secondary, iconName: "event_busy",   iconColor: C.secondary,        iconBg: "rgba(119,169,254,0.2)" },
  ];

  return (
    <div className="space-y-6">
      {/* Period header + back */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border bg-white p-4 shadow-sm" style={{ borderColor: C.outlineVariant }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[#E8E8E8]" style={{ color: C.onSurfaceVariant }}>
            <Ms name="arrow_back" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold" style={{ color: C.onSurface }}>
                Tiết {period.periodNo} · {period.subjectName}
              </h4>
              {period.isSubstitute && (
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: "rgba(242,113,35,0.12)", color: C.primaryContainer }}>Dạy thay</span>
              )}
            </div>
            <p className="text-sm" style={{ color: C.onSurfaceVariant }}>
              Lớp {period.className}{period.startTime ? ` · ${period.startTime}–${period.endTime}` : ""}{period.roomName ? ` · Phòng ${period.roomName}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Bento Grid */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {statCards.map((s) => (
          <QuickStatCard key={s.label} {...s} total={totalStudents} />
        ))}
      </div>

      {sheetLoading && <div className="space-y-3">{[0, 1, 2, 3, 4].map((n) => <div key={n} className="h-14 animate-pulse rounded-[2rem] bg-slate-200/60" />)}</div>}
      {sheetError && <div className="rounded-[2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{sheetError}</div>}

      {!sheetLoading && !sheetError && sheet && (
        <>
          {sheet.students.some((s) => !s.isEditable) && (
            <div className="flex items-center gap-2 rounded-[2rem] px-4 py-2.5 text-xs" style={{ backgroundColor: C.surfaceLow, color: C.onSurfaceVariant }}>
              <Ms name="lock" className="!text-[14px]" /> Một số bản ghi đã quá 48 giờ (BR-ATT-01) và không thể chỉnh sửa.
            </div>
          )}

          {/* Attendance Table Card */}
          <div className="flex flex-col overflow-hidden rounded-[2rem] border bg-white shadow-md" style={{ borderColor: C.outlineVariant }}>
            {/* Card header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ backgroundColor: C.surfaceLow, borderColor: C.outlineVariant }}>
              <h4 className="text-lg font-semibold" style={{ color: C.onSurface }}>
                Danh sách học sinh
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                {editableCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-[#225DAD]/5"
                    style={{ borderColor: C.secondary, color: C.secondary }}
                  >
                    <Ms name="done_all" className="!text-[18px]" />
                    Tất cả có mặt
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExcel}
                  disabled={exporting}
                  className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-[#225DAD]/5 disabled:opacity-50"
                  style={{ borderColor: C.secondary, color: C.secondary }}
                >
                  <Ms name="download" className="!text-[18px]" />
                  {exporting ? "Đang xuất..." : "Xuất Excel"}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || markedCount === 0 || editableCount === 0}
                  className="flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: C.primaryContainer }}
                >
                  <Ms name={saving ? "sync" : "save"} className={`!text-[18px] ${saving ? "animate-spin" : ""}`} />
                  {saving ? "Đang lưu..." : "Lưu điểm danh"}
                </button>
              </div>
            </div>

            {/* Save feedback */}
            {(saveMsg.text || (markedCount > 0 && markedCount < totalStudents)) && (
              <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs" style={{ borderColor: C.outlineVariant, backgroundColor: "#fff" }}>
                {saveMsg.text && (
                  <span className={`font-medium ${saveMsg.isError ? "text-red-600" : "text-green-600"}`}>{saveMsg.text}</span>
                )}
                {!saveMsg.text && markedCount > 0 && markedCount < totalStudents && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Ms name="warning" className="!text-[13px]" /> Còn {totalStudents - markedCount} học sinh chưa được điểm danh.
                  </span>
                )}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                  <tr>
                    <th className="px-6 py-4 text-xs font-medium tracking-wider">STT</th>
                    <th className="px-6 py-4 text-xs font-medium tracking-wider">Mã học sinh</th>
                    <th className="px-6 py-4 text-xs font-medium tracking-wider">Họ và tên</th>
                    <th className="px-6 py-4 text-center text-xs font-medium tracking-wider">Trạng thái</th>
                    <th className="px-6 py-4 text-xs font-medium tracking-wider">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: C.outlineVariant }}>
                  {sheet.students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                        Lớp chưa có học sinh nào đăng ký.
                      </td>
                    </tr>
                  ) : (
                    pageStudents.map((student, i) => (
                      <StudentRow
                        key={student.studentId}
                        index={(page - 1) * PAGE_SIZE + i}
                        student={student}
                        typeId={selections[student.studentId]?.typeId ?? null}
                        note={selections[student.studentId]?.note ?? ""}
                        attendanceTypes={sheet.attendanceTypes}
                        onSelect={handleSelect}
                        isLocked={!student.isEditable}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer: count + pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm" style={{ backgroundColor: C.surface, color: C.onSurfaceVariant }}>
              <span>
                Đang hiển thị {pageStudents.length} trên {totalStudents} học sinh · {markedCount}/{totalStudents} đã điểm danh
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg p-2 transition-colors hover:bg-[#E8E8E8] disabled:opacity-40"
                  >
                    <Ms name="chevron_left" className="!text-[20px]" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className="rounded-lg px-3 py-1 transition-colors"
                      style={n === page ? { backgroundColor: C.primaryContainer, color: "#fff" } : {}}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg p-2 transition-colors hover:bg-[#E8E8E8] disabled:opacity-40"
                  >
                    <Ms name="chevron_right" className="!text-[20px]" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Nhận xét theo tiết (GVBM → HS) — phụ huynh xem được */}
          <div className="flex flex-col overflow-hidden rounded-[2rem] border bg-white shadow-md" style={{ borderColor: C.outlineVariant }}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ backgroundColor: C.surfaceLow, borderColor: C.outlineVariant }}>
              <div>
                <h4 className="text-lg font-semibold" style={{ color: C.onSurface }}>Nhận xét theo tiết</h4>
                <p className="text-xs" style={{ color: C.onSurfaceVariant }}>Nhận xét của giáo viên bộ môn cho tiết này · phụ huynh xem được.</p>
              </div>
              <div className="flex items-center gap-3">
                {fbMsg.text && <span className={`text-xs font-medium ${fbMsg.isError ? "text-red-600" : "text-green-600"}`}>{fbMsg.text}</span>}
                <button type="button" onClick={handleSaveFeedback} disabled={fbSaving}
                  className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.secondary }}>
                  <Ms name={fbSaving ? "sync" : "rate_review"} className={`!text-[18px] ${fbSaving ? "animate-spin" : ""}`} /> {fbSaving ? "Đang lưu..." : "Lưu nhận xét"}
                </button>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: C.outlineVariant }}>
              {pageStudents.map((s) => (
                <div key={s.studentId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-44 min-w-0 truncate text-sm font-medium" style={{ color: C.onSurface }}>{s.fullName}</span>
                  <PrettySelect value={feedback[s.studentId]?.rating ?? ""} onChange={(e) => setFb(s.studentId, "rating", e.target.value)}
                    className="rounded-xl border px-2 py-1.5 text-sm outline-none" style={{ borderColor: C.outlineVariant, color: C.onSurface }}>
                    <option value="">— Mức —</option>
                    <option value="GOOD">Tốt</option>
                    <option value="NORMAL">Bình thường</option>
                    <option value="NEEDS_IMPROVEMENT">Cần cố gắng</option>
                  </PrettySelect>
                  <input type="text" value={feedback[s.studentId]?.content ?? ""} onChange={(e) => setFb(s.studentId, "content", e.target.value)}
                    placeholder="Nhận xét (tùy chọn)..." className="min-w-40 flex-1 rounded-xl border px-3 py-1.5 text-sm outline-none" style={{ borderColor: C.outlineVariant, color: C.onSurface }} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Analytics Tab (Lịch sử & Thống kê) ───────────────────────────────────────

const ANALYTICS_PERIODS = [
  { label: "Tháng này",     ...getMonthRange(0)  },
  { label: "Tháng trước",   ...getMonthRange(-1) },
  { label: "2 tháng trước", ...getMonthRange(-2) },
];

const TYPE_LABEL = {
  PRESENT:          { label: "Có mặt",         color: "#059669" },
  LATE:             { label: "Đi muộn",         color: "#D97706" },
  ABSENT_EXCUSED:   { label: "Vắng có phép",    color: "#08509F" },
  ABSENT_UNEXCUSED: { label: "Vắng không phép", color: "#DC2626" },
  EARLY_LEAVE:      { label: "Về sớm",          color: "#7C3AED" },
};
const ALL_TYPES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "EARLY_LEAVE"];

// Bento stat card (Stitch: "Statistics Overview Cards - Bento Style")
function AnalyticsSummaryCard({ label, value, unit, iconName, iconColor, iconBg, hoverClass = "", badge, decor, children }) {
  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-transparent bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)] transition-all ${hoverClass}`}>
      {decor}
      <div className="relative z-10 flex items-start justify-between">
        <div className="rounded-xl p-3" style={{ backgroundColor: iconBg, color: iconColor }}>
          <Ms name={iconName} className="!text-3xl" />
        </div>
        {badge}
      </div>
      <div className="relative z-10 mt-4">
        <h3 className="text-sm" style={{ color: C.onSurfaceVariant }}>{label}</h3>
        <p className="mt-1 text-4xl font-bold" style={{ color: C.onSurface }}>
          {value}
          {unit && <span className="text-lg font-normal" style={{ color: C.onSurfaceVariant }}> {unit}</span>}
        </p>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Mini sparkline of daily late counts (line instead of design's decorative bars — app standard)
function LateSparkline({ timeline }) {
  const pts = timeline.map((d) => d.late);
  if (pts.length < 2) {
    return <div className="mt-4 h-1 w-full rounded-full" style={{ backgroundColor: C.surfaceLow }} />;
  }
  const W = 120, H = 40, pad = 4;
  const max = Math.max(1, ...pts);
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const line = pts.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M 0,${H} L ${pts.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${W},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-4 h-10 w-full">
      <path d={area} fill="rgba(34,93,173,0.10)" />
      <polyline points={line} fill="none" stroke={C.secondary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Donut chart for attendance-type composition (Stitch: "Phân bổ trạng thái")
function DonutChart({ segments, total }) {
  const R = 60, cx = 80, cy = 80, Circ = 2 * Math.PI * R;
  const arcs = segments.map((s, i) => {
    const before = segments.slice(0, i).reduce((sum, x) => sum + x.count, 0);
    const len = total > 0 ? (s.count / total) * Circ : 0;
    const off = total > 0 ? -(before / total) * Circ : 0;
    return { color: s.color, len, off };
  });
  return (
    <div className="flex w-full flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F1F1F1" strokeWidth="18" />
        {arcs.map((a, i) => a.len > 0 && (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth="18"
            strokeDasharray={`${a.len} ${Circ}`} strokeDashoffset={a.off} transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="26" fontWeight="700" fill={C.onSurface}>{total}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="10" fill={C.onSurfaceVariant}>Lượt điểm danh</text>
      </svg>
      <div className="mt-6 w-full space-y-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span style={{ color: C.onSurface }}>{s.label}</span>
            </div>
            <span className="font-bold" style={{ color: C.onSurface }}>{s.count} ({s.rate ?? 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Line chart for daily attendance rate (kept as line per app standard; design palette adopted)
function AttendanceRateLine({ timeline }) {
  const pts = timeline.filter((d) => d.total > 0).map((d) => ({ date: d.date, rate: Math.round(((d.present + d.late) / d.total) * 100) }));
  if (pts.length === 0) {
    return <p className="w-full py-6 text-center text-sm text-slate-400">Chưa có dữ liệu trong giai đoạn này.</p>;
  }
  const stepX = 64, padX = 32, padTop = 24, chartH = 170, padBottom = 26;
  const n = pts.length;
  const W = padX * 2 + Math.max(1, n - 1) * stepX;
  const H = padTop + chartH + padBottom;
  const baseY = padTop + chartH;
  const x = (i) => padX + i * stepX;
  const y = (r) => padTop + (1 - r / 100) * chartH;
  const line = pts.map((p, i) => `${x(i)},${y(p.rate)}`).join(" ");
  const area = `M ${x(0)},${baseY} ${pts.map((p, i) => `L ${x(i)},${y(p.rate)}`).join(" ")} L ${x(n - 1)},${baseY} Z`;
  const fmt = (ds) => { const d = new Date(ds + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; };
  return (
    <div className="w-full overflow-x-auto">
      <svg width={W} height={H} className="block">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#F1F1F1" strokeWidth="1" />
            <text x={padX - 10} y={y(g) + 3} fontSize="9" fill="#8C7266" textAnchor="end">{g}</text>
          </g>
        ))}
        {n > 1 && <path d={area} fill="rgba(242,113,35,0.12)" />}
        {n > 1 && <polyline points={line} fill="none" stroke={C.primaryContainer} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(i)} cy={y(p.rate)} r="4" fill="#fff" stroke={C.primaryContainer} strokeWidth="2.5" />
            <text x={x(i)} y={y(p.rate) - 10} fontSize="10" fontWeight="700" fill={C.onSurface} textAnchor="middle">{p.rate}%</text>
            <text x={x(i)} y={baseY + 16} fontSize="9" fill="#8C7266" textAnchor="middle">{fmt(p.date)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AnalyticsTab({ classId }) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [useCustom,   setUseCustom]   = useState(false);

  const period    = ANALYTICS_PERIODS[periodIdx];
  const startDate = useCustom ? customStart : period.startDate;
  const endDate   = useCustom ? customEnd   : period.endDate;

  const { data, loading, error } = useAttendanceAnalytics(classId, startDate || undefined, endDate || undefined);

  const donutSegments = data
    ? ALL_TYPES.map((t) => ({
        label: TYPE_LABEL[t].label,
        color: TYPE_LABEL[t].color,
        count: data.summary.byType[t]?.count ?? 0,
        rate:  data.summary.byType[t]?.rate  ?? 0,
      }))
    : [];

  const totalRecords    = data?.summary.totalRecords ?? 0;
  const presentCount    = data?.summary.byType.PRESENT?.count ?? 0;
  const lateCount       = data?.summary.byType.LATE?.count ?? 0;
  const absentExcused   = data?.summary.byType.ABSENT_EXCUSED?.count ?? 0;
  const absentUnexcused = data?.summary.byType.ABSENT_UNEXCUSED?.count ?? 0;
  const avgRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Filter section (Stitch: Filter & Search) */}
      <section className="rounded-[2rem] bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)]">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>
              Khoảng thời gian
            </label>
            <div className="flex flex-wrap gap-2">
              {ANALYTICS_PERIODS.map((p, idx) => {
                const active = !useCustom && periodIdx === idx;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setPeriodIdx(idx); setUseCustom(false); }}
                    className={`rounded-full px-4 py-1.5 text-xs transition-all ${active ? "font-bold text-white shadow-sm" : "border bg-white font-medium hover:bg-[#F3F3F3]"}`}
                    style={active ? { backgroundColor: C.primaryContainer } : { borderColor: C.outlineVariant, color: C.onSurfaceVariant }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>Từ ngày</label>
            <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: useCustom ? C.primaryContainer : C.outlineVariant }}>
              <Ms name="calendar_month" className="mr-2 !text-[20px]" style={{ color: C.primary }} />
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setUseCustom(true); }}
                className="cursor-pointer border-none bg-transparent py-2 text-sm font-medium outline-none"
                style={{ color: C.onSurface }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>Đến ngày</label>
            <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: useCustom ? C.primaryContainer : C.outlineVariant }}>
              <Ms name="calendar_month" className="mr-2 !text-[20px]" style={{ color: C.primary }} />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setUseCustom(true); }}
                className="cursor-pointer border-none bg-transparent py-2 text-sm font-medium outline-none"
                style={{ color: C.onSurface }}
              />
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[0, 1, 2].map((n) => <div key={n} className="h-44 animate-pulse rounded-[2rem] bg-slate-200/60" />)}
        </div>
      )}
      {error && <div className="rounded-[2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* Statistics overview (Stitch: bento cards) */}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <AnalyticsSummaryCard
              label="Tỷ lệ hiện diện trung bình"
              value={`${avgRate}%`}
              iconName="verified_user"
              iconColor={C.primaryContainer}
              iconBg="rgba(242,113,35,0.10)"
              hoverClass="hover:border-[#F27123]"
              badge={data.timeline.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  <Ms name="event_available" className="!text-[14px]" /> {data.timeline.length} ngày học
                </span>
              ) : null}
            >
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(avgRate, 100)}%`, backgroundColor: C.primaryContainer }} />
              </div>
            </AnalyticsSummaryCard>

            <AnalyticsSummaryCard
              label="Tổng số buổi vắng"
              value={absentExcused + absentUnexcused}
              iconName="person_off"
              iconColor={C.error}
              iconBg="rgba(255,218,214,0.50)"
              hoverClass="hover:border-[#BA1A1A]"
              badge={
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  {absentUnexcused} không phép
                </span>
              }
            >
              <p className="mt-2 text-xs italic" style={{ color: C.onSurfaceVariant }}>
                Trong đó {absentExcused} buổi vắng có phép
              </p>
            </AnalyticsSummaryCard>

            <AnalyticsSummaryCard
              label="Số lượt đi muộn"
              value={lateCount}
              unit="lượt"
              iconName="query_stats"
              iconColor={C.secondary}
              iconBg="rgba(119,169,254,0.20)"
              hoverClass="hover:border-[#225DAD]"
              decor={<div className="absolute -right-4 -top-4 h-32 w-32 rounded-full blur-3xl" style={{ backgroundColor: "rgba(34,93,173,0.05)" }} />}
            >
              <LateSparkline timeline={data.timeline} />
            </AnalyticsSummaryCard>
          </section>

          {/* Trend chart + status distribution (Stitch: Trend Chart Section) */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col rounded-[2rem] bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)] lg:col-span-2">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Biểu đồ xu hướng chuyên cần</h3>
                <span className="rounded-full border bg-white px-4 py-1.5 text-xs font-medium" style={{ borderColor: C.outlineVariant, color: C.onSurfaceVariant }}>
                  {formatDateVN(data.period.startDate)} – {formatDateVN(data.period.endDate)}
                </span>
              </div>
              <div className="flex flex-1 items-end">
                <AttendanceRateLine timeline={data.timeline} />
              </div>
            </div>

            <div className="flex flex-col items-center rounded-[2rem] bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)]">
              <h3 className="mb-6 w-full text-center text-base font-bold" style={{ color: C.onSurface }}>Phân bổ trạng thái</h3>
              {data.summary.totalRecords > 0 ? (
                <DonutChart segments={donutSegments} total={data.summary.totalRecords} />
              ) : (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu trong giai đoạn này.</p>
              )}
            </div>
          </section>

          {/* Per-student detail table (Stitch: Detailed History Table) */}
          <section className="overflow-hidden rounded-[2rem] bg-white shadow-[0_4px_12px_rgba(15,39,71,0.08)]" style={{ border: `1px solid ${C.outlineVariant}` }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: C.outlineVariant, backgroundColor: C.surfaceLow }}>
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Thống kê điểm danh chi tiết</h3>
            </div>
            {data.students.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Học sinh</th>
                        {["Có mặt", "Đi muộn", "Vắng có phép", "Vắng không phép", "Về sớm"].map((h) => (
                          <th key={h} className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">{h}</th>
                        ))}
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Chuyên cần</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFC0B2]">
                      {data.students.map((s) => {
                        const rateColor = s.attendanceRate >= 80 ? "#059669" : s.attendanceRate >= 60 ? "#D97706" : "#DC2626";
                        return (
                          <tr key={s.studentId} className="transition-colors hover:bg-[#F3F3F3]">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium" style={{ color: C.onSurface }}>{s.fullName}</div>
                              <div className="text-xs" style={{ color: "#8C7266" }}>{s.studentCode}</div>
                            </td>
                            <td className="px-6 py-4 text-center" style={{ color: C.onSurface }}>{s.present}</td>
                            <td className="px-6 py-4 text-center"><span className={s.late > 0 ? "font-semibold text-amber-600" : "text-slate-400"}>{s.late}</span></td>
                            <td className="px-6 py-4 text-center"><span className={s.absentExcused > 0 ? "font-semibold text-blue-600" : "text-slate-400"}>{s.absentExcused}</span></td>
                            <td className="px-6 py-4 text-center"><span className={s.absentUnexcused > 0 ? "font-semibold text-red-600" : "text-slate-400"}>{s.absentUnexcused}</span></td>
                            <td className="px-6 py-4 text-center"><span className={s.earlyLeave > 0 ? "font-semibold text-purple-600" : "text-slate-400"}>{s.earlyLeave}</span></td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-20 overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(s.attendanceRate, 100)}%`, backgroundColor: rateColor }} />
                                </div>
                                <span className="text-xs font-semibold" style={{ color: rateColor }}>{s.attendanceRate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t px-6 py-3" style={{ borderColor: C.outlineVariant, backgroundColor: C.surfaceLow }}>
                  <span className="text-sm italic" style={{ color: C.onSurfaceVariant }}>
                    Hiển thị {data.students.length} học sinh
                  </span>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Danh sách tiết dạy của giáo viên trong 1 ngày (điểm danh theo tiết).
function PeriodList({ date, onSelect }) {
  const [periods, setPeriods] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    teacherApi.getMyPeriods(date)
      .then((res) => { if (m) setPeriods(res.data.periods); })
      .catch((e) => { if (m) setError(e.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [date]);

  if (loading) return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((n) => <div key={n} className="h-32 animate-pulse rounded-[2rem] bg-slate-200/60" />)}</div>;
  if (error) return <div className="rounded-[2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!periods) return null;
  if (periods.length === 0) return (
    <div className="rounded-[2rem] border bg-white p-10 text-center shadow-sm" style={{ borderColor: C.outlineVariant }}>
      <Ms name="event_available" className="!text-4xl" style={{ color: C.onSurfaceVariant }} />
      <p className="mt-2 text-sm" style={{ color: C.onSurfaceVariant }}>Bạn không có tiết dạy nào trong ngày này.</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {periods.map((p) => {
        const done = p.markedCount > 0;
        return (
          <button
            key={p.timetableId}
            type="button"
            onClick={() => onSelect(p)}
            className="flex flex-col gap-3 rounded-[2rem] border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
            style={{ borderColor: C.outlineVariant }}
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>Tiết {p.periodNo}</span>
              {p.isSubstitute && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: "rgba(242,113,35,0.12)", color: C.primaryContainer }}>Dạy thay</span>}
            </div>
            <div>
              <h4 className="text-base font-semibold" style={{ color: C.onSurface }}>{p.subjectName}</h4>
              <p className="text-sm" style={{ color: C.onSurfaceVariant }}>Lớp {p.className} · {p.studentCount} học sinh</p>
              {p.startTime && <p className="text-xs" style={{ color: C.onSurfaceVariant }}>{p.startTime}–{p.endTime}{p.roomName ? ` · Phòng ${p.roomName}` : ""}</p>}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: done ? C.primary : C.onSurfaceVariant }}>
              <Ms name={done ? "check_circle" : "radio_button_unchecked"} className="!text-[16px]" />
              {done ? `Đã điểm danh ${p.markedCount}/${p.studentCount}` : "Chưa điểm danh"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// GVCN: tổng hợp điểm danh toàn tiết/môn của lớp chủ nhiệm + ngưỡng nghỉ.
const ABS_LEVEL = {
  OVER: { label: "Vượt ngưỡng", bg: "#FFDAD6", text: "#93000A" },
  WARN: { label: "Cảnh báo",    bg: "#FEF3C7", text: "#B45309" },
  OK:   { label: "Bình thường", bg: "#DCFCE7", text: "#15803D" },
};

function OverviewTab({ homeroomClasses }) {
  const [classId, setClassId] = useState(homeroomClasses[0]?.classId ?? null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!classId) return undefined;
    let m = true; setLoading(true); setError("");
    teacherApi.getClassAttendanceOverview(classId)
      .then((res) => { if (m) setData(res.data); })
      .catch((e) => { if (m) setError(e.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [classId, refresh]);

  async function handleGenerate() {
    setGenerating(true); setGenMsg("");
    try {
      const res = await teacherApi.generateAbsenceWarnings(classId);
      setGenMsg(`Đã cập nhật ${res.data.generated} cảnh báo & thông báo phụ huynh.`);
      setRefresh((k) => k + 1);
    } catch (e) { setGenMsg(e.message); } finally { setGenerating(false); }
  }

  const th = "px-4 py-3 text-xs font-medium tracking-wider text-white";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {homeroomClasses.length > 1 ? (
          <PrettySelect value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}
            className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none" style={{ borderColor: C.outlineVariant, color: C.onSurface }}>
            {homeroomClasses.map((c) => <option key={c.classId} value={c.classId}>Lớp {c.className}</option>)}
          </PrettySelect>
        ) : <span />}
        <button type="button" onClick={handleGenerate} disabled={generating || !classId}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.deepBlue }}>
          <Ms name={generating ? "sync" : "notifications_active"} className={`!text-[18px] ${generating ? "animate-spin" : ""}`} /> {generating ? "Đang quét..." : "Quét cảnh báo & báo PH"}
        </button>
      </div>
      {genMsg && <p className="text-xs font-medium text-green-600">{genMsg}</p>}

      {loading && <div className="h-64 animate-pulse rounded-[2rem] bg-slate-200/60" />}
      {error && <div className="rounded-[2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="rounded-[2rem] p-4 text-sm" style={{ backgroundColor: "#FFF7F2", color: C.onSurface }}>
            <span className="font-semibold">Ngưỡng nghỉ:</span> tối đa {data.policy.maxAbsentSessions} buổi/năm (1 buổi = {data.policy.periodsPerSession} tiết) · cảnh báo từ {data.warnThreshold} buổi.
            {" "}<span style={{ color: "#93000A" }}>{data.summary.over} vượt ngưỡng</span> · <span style={{ color: "#B45309" }}>{data.summary.warn} cần lưu ý</span> / {data.summary.total} HS.
          </div>

          <div className="overflow-hidden rounded-[2rem] border bg-white shadow-sm" style={{ borderColor: C.outlineVariant }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead style={{ backgroundColor: C.deepBlue }}>
                  <tr>
                    <th className={th}>Học sinh</th>
                    <th className={`${th} text-center`}>Tiết đã ĐD</th>
                    <th className={`${th} text-center`}>Đi muộn</th>
                    <th className={`${th} text-center`}>Vắng CP</th>
                    <th className={`${th} text-center`}>Vắng KP</th>
                    <th className={`${th} text-center`}>Quy đổi buổi nghỉ</th>
                    <th className={`${th} text-center`}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: C.outlineVariant }}>
                  {data.students.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Lớp chưa có học sinh.</td></tr>
                  ) : data.students.map((s) => {
                    const lv = ABS_LEVEL[s.level] ?? ABS_LEVEL.OK;
                    return (
                      <tr key={s.studentId} className="transition-colors hover:bg-[#F3F3F3]">
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium" style={{ color: C.onSurface }}>{s.fullName}</div>
                          <div className="text-xs text-slate-400">{s.studentCode}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center" style={{ color: C.onSurfaceVariant }}>{s.totalPeriods}</td>
                        <td className="px-4 py-2.5 text-center" style={{ color: C.onSurfaceVariant }}>{s.late}</td>
                        <td className="px-4 py-2.5 text-center" style={{ color: C.onSurfaceVariant }}>{s.absentExcused}</td>
                        <td className="px-4 py-2.5 text-center font-semibold" style={{ color: s.absentUnexcused > 0 ? "#BA1A1A" : C.onSurfaceVariant }}>{s.absentUnexcused}</td>
                        <td className="px-4 py-2.5 text-center font-bold" style={{ color: C.onSurface }}>{s.absentSessions}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: lv.bg, color: lv.text }}>{lv.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AttendancePage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useTeacherClasses();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "roll-call";

  const todayStr = useMemo(() => toISO(new Date()), []);
  const [date, setDate] = useState(todayStr);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);

  // Đổi ngày → bỏ chọn tiết (tiết khác nhau theo ngày).
  useEffect(() => { setSelectedPeriod(null); }, [date]);

  useEffect(() => {
    if (!profile?.classes?.length) return;
    setSelectedClassId((prev) => prev ?? profile.classes[0].classId);
  }, [profile]);

  // Lớp chủ nhiệm → tab "Tổng hợp lớp CN" (chỉ GVCN mới xem tổng hợp toàn tiết/môn).
  const homeroomClasses = useMemo(
    () => (profile?.classes ?? []).filter((c) => c.roleInClass === "HOMEROOM_TEACHER"),
    [profile],
  );
  const isHomeroom = homeroomClasses.length > 0;

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return {
      name:   profile?.fullName ?? user?.fullName ?? user?.username ?? "Giáo viên",
      role:   roleEntry?.description ?? "Giáo viên",
      avatar: profile?.avatar ?? user?.avatar ?? "",
    };
  }, [profile, user]);

  function setTab(key) { setSearchParams({ tab: key }); }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Điểm danh"
      sidebarFooterValue={date}
    >
      {profileLoading && (
        <div className="space-y-4">
          <div className="h-12 animate-pulse rounded-[2rem] bg-slate-200/60" />
          <div className="h-64 animate-pulse rounded-[2rem] bg-slate-200/60" />
        </div>
      )}

      {profileError && (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được thông tin giáo viên: {profileError}
        </div>
      )}

      {!profileLoading && !profileError && profile && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 className="text-2xl font-semibold" style={{ color: C.onSurface }}>Quản lý điểm danh</h2>
            <div className="flex flex-wrap items-center gap-3">
              {activeTab === "analytics" && profile.classes.length > 0 && (
                <div className="flex items-center rounded-xl border bg-white p-1 shadow-sm" style={{ borderColor: C.outlineVariant }}>
                  <Ms name="school" className="px-3" style={{ color: C.primary }} />
                  <PrettySelect
                    value={selectedClassId ?? ""}
                    onChange={(e) => setSelectedClassId(Number(e.target.value))}
                    className="cursor-pointer border-none bg-transparent pr-8 text-sm font-medium outline-none"
                    style={{ color: C.onSurface }}
                  >
                    {profile.classes.map((c) => <option key={c.classId} value={c.classId}>Lớp {c.className}</option>)}
                  </PrettySelect>
                </div>
              )}
              {activeTab === "roll-call" && (
                <div className="flex items-center rounded-xl border bg-white p-1 px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
                  <Ms name="calendar_today" className="mr-2 !text-[20px]" style={{ color: C.primary }} />
                  <input
                    type="date"
                    value={date}
                    max={todayStr}
                    onChange={(e) => setDate(e.target.value)}
                    className="cursor-pointer border-none bg-transparent p-1 text-sm font-medium outline-none"
                    style={{ color: C.onSurface }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex w-fit items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.outlineVariant }}>
            <button
              type="button"
              onClick={() => setTab("roll-call")}
              className="rounded-full px-4 py-1.5 text-sm font-bold transition-all"
              style={activeTab === "roll-call" ? { backgroundColor: C.primaryContainer, color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" } : { color: C.onSurfaceVariant }}
            >
              Điểm danh
            </button>
            <button
              type="button"
              onClick={() => setTab("analytics")}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:bg-[#E8E8E8]"
              style={activeTab === "analytics" ? { backgroundColor: C.primaryContainer, color: "#fff", fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" } : { color: C.onSurfaceVariant }}
            >
              Lịch sử &amp; Thống kê
            </button>
            {isHomeroom && (
              <button
                type="button"
                onClick={() => setTab("overview")}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:bg-[#E8E8E8]"
                style={activeTab === "overview" ? { backgroundColor: C.primaryContainer, color: "#fff", fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" } : { color: C.onSurfaceVariant }}
              >
                Tổng hợp lớp CN
              </button>
            )}
          </div>

          {activeTab === "roll-call" && (
            selectedPeriod
              ? <PeriodSheet period={selectedPeriod} date={date} onBack={() => setSelectedPeriod(null)} />
              : <PeriodList date={date} onSelect={setSelectedPeriod} />
          )}
          {activeTab === "analytics" && (
            profile.classes.length === 0
              ? <div className="rounded-[2rem] px-4 py-3 text-sm" style={{ border: `1px solid ${C.outlineVariant}`, backgroundColor: "#FFF7F2", color: C.onSurface }}>Bạn chưa được phân công lớp nào để xem thống kê.</div>
              : selectedClassId && <AnalyticsTab classId={selectedClassId} />
          )}
          {activeTab === "overview" && isHomeroom && <OverviewTab homeroomClasses={homeroomClasses} />}
        </div>
      )}
    </DashboardShell>
  );
}

export default AttendancePage;
