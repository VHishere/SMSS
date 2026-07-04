import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiSave,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useAttendanceAnalytics } from "../../hooks/useAttendanceAnalytics";
import { useAttendanceSheet } from "../../hooks/useAttendanceSheet";
import { useTeacherClasses } from "../../hooks/useTeacherClasses";
import { teacherApi } from "../../api/client";
import { formatDateVN } from "../../utils/datetime";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "roll-call", label: "Điểm danh", icon: FiCheck },
  { key: "analytics", label: "Thống kê",  icon: FiBarChart2 },
];

const STATUS_CONFIG = {
  PRESENT:          { label: "Có mặt",         text: "#059669" },
  LATE:             { label: "Đi muộn",         text: "#D97706" },
  ABSENT_EXCUSED:   { label: "Vắng có phép",    text: "#08509F" },
  ABSENT_UNEXCUSED: { label: "Vắng không phép", text: "#DC2626" },
  EARLY_LEAVE:      { label: "Về sớm",          text: "#7C3AED" },
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

// ─── Roll Call: Status Button ─────────────────────────────────────────────────

function StatusButton({ typeName, isActive, disabled, onClick }) {
  const cfg = STATUS_CONFIG[typeName] ?? { label: typeName, text: "#475569" };
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

function StudentRollCallRow({ student, typeId, note, attendanceTypes, onSelect, isLocked }) {
  const [localNote, setLocalNote] = useState(note ?? "");
  useEffect(() => { setLocalNote(note ?? ""); }, [note]);

  return (
    <div className="flex flex-col gap-2.5 border-b py-3 last:border-b-0 lg:flex-row lg:items-center lg:gap-4" style={{ borderColor: "#FFE7D6" }}>
      {/* Avatar + name */}
      <div className="flex min-w-0 items-center gap-3 lg:w-56 lg:shrink-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: "#08509F" }}>
          {student.avatar ? <img src={student.avatar} alt={student.fullName} className="h-9 w-9 rounded-full object-cover" /> : (student.fullName?.[0]?.toUpperCase() ?? "?")}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "#0F2747" }}>{student.fullName}</p>
          <p className="text-xs text-slate-400">{student.studentCode}</p>
        </div>
      </div>

      {/* Status buttons */}
      <div className="flex flex-wrap items-center gap-1.5 lg:flex-1">
        {attendanceTypes.map((t) => (
          <StatusButton
            key={t.typeId}
            typeName={t.typeName}
            isActive={typeId === t.typeId}
            disabled={isLocked}
            onClick={() => onSelect(student.studentId, t.typeId, localNote)}
          />
        ))}
        {isLocked && (
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"><FiLock size={10} /> Đã khóa</span>
        )}
      </div>

      {/* Inline note */}
      <input
        type="text"
        value={localNote}
        disabled={isLocked}
        onChange={(e) => setLocalNote(e.target.value)}
        onBlur={() => onSelect(student.studentId, typeId, localNote)}
        placeholder="Ghi chú..."
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F] disabled:bg-slate-50 disabled:text-slate-400 lg:w-48 lg:shrink-0"
      />
    </div>
  );
}

// ─── Roll Call Tab ─────────────────────────────────────────────────────────────

function RollCallTab({ classId, className }) {
  const todayStr = useMemo(() => toISO(new Date()), []);
  const [date, setDate] = useState(todayStr);

  const { data: sheet, loading: sheetLoading, error: sheetError } = useAttendanceSheet(classId, date);

  const [selections, setSelections] = useState({});
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState({ text: "", isError: false });

  useEffect(() => {
    if (!sheet) return;
    const init = {};
    for (const s of sheet.students) {
      init[s.studentId] = { typeId: s.typeId ?? null, note: s.note ?? "", attendanceId: s.attendanceId ?? null, isEditable: s.isEditable };
    }
    setSelections(init);
    setSaveMsg({ text: "", isError: false });
  }, [sheet]);

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

  const markedCount   = Object.values(selections).filter((s) => s.typeId).length;
  const totalStudents = sheet?.students?.length ?? 0;
  const allMarked     = markedCount === totalStudents && totalStudents > 0;
  const editableCount = sheet ? sheet.students.filter((s) => s.isEditable).length : 0;

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
      await teacherApi.submitAttendance(classId, { date, records });
      setSaveMsg({ text: `Đã lưu điểm danh ${records.length} học sinh.`, isError: false });
    } catch (err) {
      setSaveMsg({ text: err.message, isError: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Date + actions */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Ngày điểm danh</label>
            <input type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]" />
          </div>
          {editableCount > 0 && (
            <button type="button" onClick={markAllPresent}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-emerald-50"
              style={{ borderColor: "#6EE7B7", color: "#059669" }}>
              <FiCheckCircle size={15} /> Tất cả có mặt
            </button>
          )}
        </div>

        {sheet && (
          <div className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
            <span className="font-medium text-[#0F2747]">{className}</span>
            <span className="ml-2 text-slate-500">· {markedCount}/{totalStudents} đã điểm danh</span>
          </div>
        )}
      </div>

      {sheetLoading && <div className="space-y-3">{[0,1,2,3,4].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {sheetError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{sheetError}</div>}

      {!sheetLoading && !sheetError && sheet && (
        <>
          {sheet.students.some((s) => !s.isEditable) && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <FiLock size={12} /> Một số bản ghi đã quá 48 giờ (BR-ATT-01) và không thể chỉnh sửa.
            </div>
          )}

          <div className="mb-5 rounded-xl bg-white px-4 py-2 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            {sheet.students.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Lớp chưa có học sinh nào đăng ký.</p>
            ) : (
              sheet.students.map((student) => (
                <StudentRollCallRow
                  key={student.studentId}
                  student={student}
                  typeId={selections[student.studentId]?.typeId ?? null}
                  note={selections[student.studentId]?.note ?? ""}
                  attendanceTypes={sheet.attendanceTypes}
                  onSelect={handleSelect}
                  isLocked={!student.isEditable}
                />
              ))
            )}
          </div>

          {/* Summary pills */}
          <div className="mb-4 flex flex-wrap gap-2">
            {sheet.attendanceTypes.map((t) => {
              const count = Object.values(selections).filter((s) => s.typeId === t.typeId).length;
              const cfg = STATUS_CONFIG[t.typeName] ?? { label: t.typeName, text: "#475569" };
              return (
                <span key={t.typeId} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${cfg.text}14`, color: cfg.text }}>
                  {cfg.label}: {count}
                </span>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleSave} disabled={saving || markedCount === 0 || editableCount === 0}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
              style={{ backgroundColor: "#F27123" }}>
              {saving ? <>Đang lưu...</> : <>Lưu điểm danh{markedCount > 0 && <span>({markedCount})</span>}</>}
            </button>

            {!allMarked && markedCount > 0 && (
              <span className="text-xs text-amber-600"><FiAlertTriangle className="mr-1 inline" size={12} /> Còn {totalStudents - markedCount} học sinh chưa được điểm danh.</span>
            )}
            {saveMsg.text && <span className={`text-xs font-medium ${saveMsg.isError ? "text-red-600" : "text-green-600"}`}>{saveMsg.text}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

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

function AnalyticsSummaryCard({ typeName, count, rate }) {
  const cfg = TYPE_LABEL[typeName] ?? { label: typeName, color: "#475569" };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{cfg.label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color: "#0F2747" }}>{rate}%</p>
      <p className="mt-1 text-xs text-slate-400">{count} lần</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: cfg.color }} />
      </div>
    </div>
  );
}

// Donut chart for attendance-type composition
function DonutChart({ segments, total }) {
  const R = 52, cx = 70, cy = 70, C = 2 * Math.PI * R;
  const arcs = segments.map((s, i) => {
    const before = segments.slice(0, i).reduce((sum, x) => sum + x.count, 0);
    const len = total > 0 ? (s.count / total) * C : 0;
    const off = total > 0 ? -(before / total) * C : 0;
    return { color: s.color, len, off };
  });
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {arcs.map((a, i) => a.len > 0 && (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth="16"
            strokeDasharray={`${a.len} ${C}`} strokeDashoffset={a.off} transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0F2747">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="#64748B">lượt</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-auto pl-3 font-semibold text-[#0F2747]">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Line chart for daily attendance rate
function AttendanceRateLine({ timeline }) {
  const pts = timeline.filter((d) => d.total > 0).map((d) => ({ date: d.date, rate: Math.round(((d.present + d.late) / d.total) * 100) }));
  if (pts.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu trong giai đoạn này.</p>;
  }
  const stepX = 64, padX = 32, padTop = 20, chartH = 120, padBottom = 26;
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
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#F1F5F9" strokeWidth="1" />
            <text x={padX - 10} y={y(g) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{g}</text>
          </g>
        ))}
        {n > 1 && <path d={area} fill="rgba(5,150,105,0.10)" />}
        {n > 1 && <polyline points={line} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(i)} cy={y(p.rate)} r="4" fill="#fff" stroke="#059669" strokeWidth="2.5" />
            <text x={x(i)} y={y(p.rate) - 10} fontSize="10" fontWeight="700" fill="#0F2747" textAnchor="middle">{p.rate}%</text>
            <text x={x(i)} y={baseY + 16} fontSize="9" fill="#64748B" textAnchor="middle">{fmt(p.date)}</text>
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
    ? ALL_TYPES.map((t) => ({ label: TYPE_LABEL[t].label, color: TYPE_LABEL[t].color, count: data.summary.byType[t]?.count ?? 0 }))
    : [];

  return (
    <div>
      {/* Period selector */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          {ANALYTICS_PERIODS.map((p, idx) => (
            <button key={p.label} type="button" onClick={() => { setPeriodIdx(idx); setUseCustom(false); }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
              style={!useCustom && periodIdx === idx ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Tùy chỉnh từ</label>
            <input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setUseCustom(true); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">đến</label>
            <input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setUseCustom(true); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]" />
          </div>
        </div>
      </div>

      {loading && <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">{[0,1,2,3,4].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {ALL_TYPES.map((t) => (
              <AnalyticsSummaryCard key={t} typeName={t} count={data.summary.byType[t]?.count ?? 0} rate={data.summary.byType[t]?.rate ?? 0} />
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Composition donut */}
            <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
              <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Cơ cấu điểm danh</h3>
              {data.summary.totalRecords > 0 ? (
                <DonutChart segments={donutSegments} total={data.summary.totalRecords} />
              ) : (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu trong giai đoạn này.</p>
              )}
            </div>

            {/* Daily rate line */}
            <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
              <h3 className="mb-1 text-sm font-bold" style={{ color: "#0F2747" }}>Tỷ lệ chuyên cần theo ngày</h3>
              <p className="mb-3 text-xs text-slate-400">{formatDateVN(data.period.startDate)} → {formatDateVN(data.period.endDate)}</p>
              <AttendanceRateLine timeline={data.timeline} />
            </div>
          </div>

          {/* Per-student table */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <div className="border-b px-5 py-3" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
              <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>Chi tiết theo học sinh</h3>
            </div>
            {data.students.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "#FFE7D6" }}>
                      {["Học sinh", "Có mặt", "Đi muộn", "Vắng có phép", "Vắng không phép", "Về sớm", "Chuyên cần"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s, idx) => (
                      <tr key={s.studentId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium text-[#0F2747]">{s.fullName}</div>
                          <div className="text-xs text-slate-400">{s.studentCode}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-700">{s.present}</td>
                        <td className="px-4 py-2.5 text-center"><span className={s.late > 0 ? "font-semibold text-amber-600" : "text-slate-400"}>{s.late}</span></td>
                        <td className="px-4 py-2.5 text-center"><span className={s.absentExcused > 0 ? "font-semibold text-blue-600" : "text-slate-400"}>{s.absentExcused}</span></td>
                        <td className="px-4 py-2.5 text-center"><span className={s.absentUnexcused > 0 ? "font-semibold text-red-600" : "text-slate-400"}>{s.absentUnexcused}</span></td>
                        <td className="px-4 py-2.5 text-center text-slate-600">{s.earlyLeave}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${s.attendanceRate}%`, backgroundColor: s.attendanceRate >= 80 ? "#059669" : s.attendanceRate >= 60 ? "#D97706" : "#DC2626" }} />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: s.attendanceRate >= 80 ? "#059669" : s.attendanceRate >= 60 ? "#D97706" : "#DC2626" }}>{s.attendanceRate}%</span>
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
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useTeacherClasses();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "roll-call";

  const [selectedClassId, setSelectedClassId] = useState(null);

  useEffect(() => {
    if (!profile?.classes?.length) return;
    const primary = profile.classes.find((c) => c.roleInClass === "HOMEROOM_TEACHER") || profile.classes[0];
    setSelectedClassId((prev) => prev ?? primary.classId);
  }, [profile]);

  const selectedClass = useMemo(
    () => profile?.classes?.find((c) => c.classId === selectedClassId) ?? null,
    [profile, selectedClassId],
  );

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
      sidebarFooterLabel="Lớp chủ nhiệm"
      sidebarFooterValue={selectedClass?.className ?? "Chưa phân công"}
    >
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
                <button key={c.classId} type="button" onClick={() => setSelectedClassId(c.classId)}
                  className="rounded-full px-4 py-2 text-sm font-medium transition"
                  style={c.classId === selectedClassId ? { backgroundColor: "#08509F", color: "#fff" } : { backgroundColor: "#fff", color: "#475569", border: "1px solid #E2E8F0" }}>
                  {c.className}
                  <span className="ml-1.5 opacity-70">· {c.gradeName}</span>
                </button>
              ))}
            </div>
          )}

          {profile.classes.length === 0 && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>
              Tài khoản chưa được phân công lớp học. Vui lòng liên hệ quản trị viên.
            </div>
          )}

          {selectedClass && (
            <>
              <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" onClick={() => setTab(key)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                    style={activeTab === key ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
                    <Icon size={15} /><span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6" }}>
                {activeTab === "roll-call" && <RollCallTab classId={selectedClass.classId} className={selectedClass.className} />}
                {activeTab === "analytics" && <AnalyticsTab classId={selectedClass.classId} />}
              </div>
            </>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default AttendancePage;
