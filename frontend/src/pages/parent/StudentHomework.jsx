import { useEffect, useMemo, useState } from "react";
import {
  FiAward,
  FiBook,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiMessageSquare,
  FiPaperclip,
  FiX,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentApi } from "../../api/client";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentHomework } from "../../hooks/useParentStudentHomework";
import { formatDateTimeVN } from "../../utils/datetime";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";
import PrettySelect from "../../components/molecules/PrettySelect";

// ─── FSchool Stitch design tokens (matches the teacher homework portal) ──────

const C = {
  onSurface: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  orange: "#F27123",
  deepBlue: "#00458E",
  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
  info: "#3B82F6",
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

function fmtDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

// "dd/mm/yyyy HH:mm" → "HH:mm - dd/mm/yyyy" (mirrors teacher's due display order)
function dueDisplay(dueDate) {
  const s = formatDateTimeVN(dueDate);
  const [datePart, timePart] = String(s).split(" ");
  return timePart ? `${timePart} - ${datePart}` : s;
}

function dueCountdown(dueDate, isOverdue) {
  if (!dueDate) return { text: "", color: C.muted };
  const due = new Date(String(dueDate).replace(" ", "T"));
  const days = Math.floor((due - new Date()) / 86400000);
  if (isOverdue || days < 0) return { text: `Trễ ${Math.abs(days)} ngày`, color: C.error };
  if (days === 0) return { text: "Hạn chót hôm nay", color: C.error };
  if (days === 1) return { text: "Hạn chót ngày mai", color: C.warning };
  return { text: `Còn ${days} ngày`, color: C.muted };
}

const STATUS_MAP = {
  GRADED:    { label: "Đã chấm",  cls: "bg-green-50 text-green-700",   dot: "bg-green-500" },
  SUBMITTED: { label: "Đã nộp",   cls: "bg-blue-50 text-[#3B82F6]",    dot: "bg-[#3B82F6]" },
  MISSING:   { label: "Chưa nộp", cls: "bg-amber-50 text-amber-700",   dot: "bg-amber-500" },
  LATE:      { label: "Nộp muộn", cls: "bg-red-50 text-red-600",       dot: "bg-red-500" },
};

function SubmissionBadge({ status, isLate }) {
  const key = isLate && status === "SUBMITTED" ? "LATE" : (status || "MISSING");
  const info = STATUS_MAP[key] || STATUS_MAP.MISSING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${info.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

// ─── Status chip for homework rows (ported from teacher) ─────────────────────

function hwStatusChip(hw) {
  if (hw.status === "CLOSED") return { label: "ĐÃ ĐÓNG",  bg: "#F1F5F9",             text: C.muted };
  if (hw.isOverdue)           return { label: "QUÁ HẠN",  bg: "#FEF2F2",             text: C.error };
  return                             { label: "ĐANG MỞ",  bg: "#FFEDD5",             text: C.orange };
}

const SORT_OPTIONS = [
  { value: "due_asc",      label: "Hạn sớm nhất" },
  { value: "due_desc",     label: "Hạn muộn nhất" },
  { value: "created_desc", label: "Mới tạo" },
  { value: "title_asc",    label: "Tên A→Z" },
];

const selectCls = "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1";

// ─── Progress-ring stat card (ported from teacher) ────────────────────────────

function RingStat({ label, display, fraction, color }) {
  const CIRC = 251.2; // 2πr, r=40
  const offset = CIRC * (1 - Math.min(Math.max(fraction, 0), 1));
  return (
    <div
      className="group flex items-center gap-6 rounded-3xl border bg-white p-6 shadow-sm transition-all hover:shadow-md"
      style={{ borderColor: C.border }}
    >
      <div className="relative flex items-center justify-center">
        <svg className="h-24 w-24">
          <circle cx="48" cy="48" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="8" />
          <circle
            cx="48" cy="48" r="40" fill="transparent"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.35s" }}
          />
        </svg>
        <span className="absolute text-2xl font-black" style={{ color }}>{display}</span>
      </div>
      <div>
        <h3 className="text-lg font-bold" style={{ color: C.onSurface }}>{label}</h3>
      </div>
    </div>
  );
}

// ─── Homework detail modal ─────────────────────────────────────────────────────

function DetailModal({ studentId, homework, onClose }) {
  const [{ detail, loading, error }, setAsync] = useState({ detail: null, loading: true, error: "" });

  useEffect(() => {
    if (!homework) return;
    let cancelled = false;
    parentApi
      .getStudentHomeworkDetail(studentId, homework.homeworkId)
      .then((res) => { if (!cancelled) setAsync({ detail: res.data, loading: false, error: "" }); })
      .catch((err) => { if (!cancelled) setAsync({ detail: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [studentId, homework]);

  if (!homework) return null;

  const chip = hwStatusChip(homework);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-3xl border-b px-6 py-5" style={{ borderColor: C.border, backgroundColor: "#fff" }}>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-2xl px-3 py-1 text-[10px] font-black uppercase tracking-tight text-white" style={{ backgroundColor: C.deepBlue }}>
                {homework.subjectName}
              </span>
              {homework.submissionStatus !== "GRADED" && (
                <span className="rounded px-2 py-0.5 text-[10px] font-extrabold uppercase" style={{ backgroundColor: chip.bg, color: chip.text }}>
                  {chip.label}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-tight" style={{ color: C.onSurface }}>{homework.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="mt-0.5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-sm" style={{ color: C.muted }}>
            <div className="flex items-center gap-1.5">
              <FiClock size={14} style={{ color: C.orange }} />
              <span>Hạn nộp: <strong style={{ color: C.onSurface }}>{fmtDate(homework.dueDate)}</strong></span>
            </div>
            {detail?.teacherName && (
              <div className="flex items-center gap-1.5">
                <FiBook size={14} style={{ color: C.deepBlue }} />
                <span>GV: <strong style={{ color: C.onSurface }}>{detail.teacherName}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <FiAward size={14} className="text-slate-400" />
              <span>Điểm tối đa: <strong style={{ color: C.onSurface }}>{homework.maxScore}</strong></span>
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((n) => <div key={n} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {detail && !loading && (
            <>
              {detail.description && (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.orange }}>Mô tả</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{detail.description}</p>
                </div>
              )}

              {detail.instructions && (
                <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FFF7ED", border: `1px solid ${C.border}` }}>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.orange }}>Hướng dẫn</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{detail.instructions}</p>
                </div>
              )}

              {detail.attachments?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.orange }}>
                    <FiPaperclip className="mr-1 inline" size={12} />Tệp đính kèm ({detail.attachments.length})
                  </p>
                  <div className="space-y-2">
                    {detail.attachments.map((att) => (
                      <a
                        key={att.attachmentId}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-blue-50"
                        style={{ borderColor: C.border, color: C.info }}
                      >
                        <FiFileText size={16} className="shrink-0" style={{ color: C.info }} />
                        <span className="truncate">{att.fileName}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <hr style={{ borderColor: C.border }} />

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: C.orange }}>Kết quả nộp bài</p>
                <div className="space-y-3 rounded-2xl border px-5 py-4" style={{ borderColor: C.border }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SubmissionBadge status={detail.submissionStatus} isLate={detail.isLate} />
                    {detail.submitTime && (
                      <span className="text-xs text-slate-500">Nộp lúc: {fmtDate(detail.submitTime)}</span>
                    )}
                  </div>

                  {detail.submissionStatus === "MISSING" && (
                    <p className="text-sm text-slate-400">Chưa có bài nộp.</p>
                  )}

                  {detail.submissionContent && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-slate-500">Nội dung bài nộp</p>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.submissionContent}</p>
                    </div>
                  )}

                  {detail.submissionFileUrl && (
                    <a
                      href={detail.submissionFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-blue-50"
                      style={{ borderColor: C.border, color: C.info }}
                    >
                      <FiFileText size={15} />Xem file bài nộp
                    </a>
                  )}

                  {detail.score !== null && (
                    <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3">
                      <FiCheckCircle size={16} className="shrink-0 text-green-600" />
                      <span className="text-sm font-bold text-green-700">
                        Điểm: {detail.score} / {detail.maxScore}
                      </span>
                    </div>
                  )}

                  {detail.feedback && (
                    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FFF7ED", border: `1px solid ${C.border}` }}>
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.orange }}>
                        <FiMessageSquare size={12} />Nhận xét của giáo viên
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.feedback}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function StudentHomework() {
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useParentStudents();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [statusFilter,      setStatusFilter]      = useState("");
  const [submissionFilter,  setSubmissionFilter]  = useState("");
  const [subjectId,         setSubjectId]         = useState("");
  const [sort,               setSort]              = useState("due_asc");
  const [subjectOptions,    setSubjectOptions]    = useState([]);
  const [searchInput,       setSearchInput]       = useState("");
  const [search,            setSearch]            = useState("");
  const [page,              setPage]              = useState(1);
  const [showFilters,       setShowFilters]       = useState(false);
  const [selectedHw,        setSelectedHw]        = useState(null);

  const LIMIT = 12;

  const effStudentId = selectedStudentId || (students[0]?.studentId ? String(students[0].studentId) : "");

  const params = useMemo(() => ({
    status:           statusFilter     || undefined,
    submissionStatus: submissionFilter || undefined,
    subjectId:        subjectId        || undefined,
    sort,
    search: search || undefined,
    page,
    limit: LIMIT,
  }), [statusFilter, submissionFilter, subjectId, sort, search, page]);

  const { data, loading, error } = useParentStudentHomework(effStudentId, params, Boolean(effStudentId));

  // Exact "open" total (mirrors teacher's separate overdue-count fetch trick)
  const openParams = useMemo(() => ({ status: "OPEN", page: 1, limit: 1 }), []);
  const { data: openData } = useParentStudentHomework(effStudentId, openParams, Boolean(effStudentId));
  const openTotal = openData?.pagination?.total ?? 0;

  // "Cần chú ý": open homework this child hasn't submitted yet, soonest due first
  const attentionParams = useMemo(() => ({ status: "OPEN", submissionStatus: "MISSING", sort: "due_asc", page: 1, limit: 6 }), []);
  const { data: attentionData } = useParentStudentHomework(effStudentId, attentionParams, Boolean(effStudentId));
  const attentionItems = attentionData?.items ?? [];

  useEffect(() => {
    if (!data?.items?.length) return;
    setSubjectOptions((prev) => {
      const map = Object.fromEntries(prev.map((s) => [s.id, s.name]));
      for (const hw of data.items) map[hw.subjectId] = hw.subjectName;
      return Object.entries(map).map(([id, name]) => ({ id, name }));
    });
  }, [data?.items]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const headerUser = useMemo(() => ({
    name:   user?.fullName || user?.username || "Phụ huynh",
    role:   "Phụ huynh",
    avatar: user?.avatar || "",
  }), [user]);

  function handleStudentChange(id) {
    setSelectedStudentId(String(id));
    setStatusFilter(""); setSubmissionFilter(""); setSubjectId(""); setPage(1);
  }
  function resetPage() { setPage(1); }

  const summary = data?.summary ?? { total: 0, graded: 0, submitted: 0, missing: 0 };
  const avgCompletion = summary.total > 0 ? Math.round(((summary.graded + summary.submitted) / summary.total) * 100) : 0;
  const pagination = data?.pagination;

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {studentsLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
      ) : students.length === 0 ? (
        <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: "#FFF7ED", color: C.onSurface }}>
          Không tìm thấy thông tin học sinh.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Student pill selector — only when >1 child */}
          {students.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {students.map((s) => (
                <button
                  key={s.studentId}
                  type="button"
                  onClick={() => handleStudentChange(s.studentId)}
                  className="rounded-xl px-4 py-2 text-sm font-medium transition"
                  style={
                    String(s.studentId) === effStudentId
                      ? { backgroundColor: C.deepBlue, color: "#fff" }
                      : { border: `1px solid ${C.border}`, backgroundColor: "#fff", color: C.muted }
                  }
                >
                  {s.studentFullName}
                  {s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
                </button>
              ))}
            </div>
          )}

          {/* ── Action Area (Stitch header) ── */}
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: C.onSurface }}>
              Bài tập
            </h2>
          </div>

          {/* ── Statistics (progress rings) ── */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <RingStat
              label="Đang mở"
              display={String(openTotal).padStart(2, "0")}
              fraction={summary.total > 0 ? openTotal / summary.total : 0}
              color={C.orange}
            />
            <RingStat
              label="Hoàn thành TB"
              display={`${avgCompletion}%`}
              fraction={avgCompletion / 100}
              color={C.info}
            />
            <RingStat
              label="Chưa nộp"
              display={String(summary.missing).padStart(2, "0")}
              fraction={summary.total > 0 ? summary.missing / summary.total : 0}
              color={C.error}
            />
          </div>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          {/* ── Main layout: table + attention panel ── */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Homework list */}
            <div className="overflow-hidden rounded-3xl border bg-white shadow-sm xl:col-span-2" style={{ borderColor: C.border }}>
              <div className="flex items-center justify-between border-b bg-slate-50/50 px-6 py-5" style={{ borderColor: C.border }}>
                <div className="flex items-center gap-3">
                  <Ms name="assignment" style={{ color: C.deepBlue }} />
                  <h4 className="text-lg font-bold" style={{ color: C.onSurface }}>Danh sách bài tập</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-bold transition-colors hover:bg-slate-50"
                  style={{ borderColor: C.border, color: showFilters ? C.orange : C.muted }}
                >
                  <Ms name="filter_list" className="!text-[14px]!" /> Bộ lọc
                </button>
              </div>

              {showFilters && (
                <div className="flex flex-wrap items-center gap-2 border-b bg-white px-6 py-3" style={{ borderColor: C.border }}>
                  <PrettySelect value={subjectId} onChange={(e) => { setSubjectId(e.target.value); resetPage(); }} className={selectCls} style={{ borderColor: C.border, color: C.onSurface }}>
                    <option value="">Tất cả môn</option>
                    {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </PrettySelect>
                  <PrettySelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }} className={selectCls} style={{ borderColor: C.border, color: C.onSurface }}>
                    <option value="">Mọi trạng thái</option>
                    <option value="OPEN">Đang mở</option>
                    <option value="CLOSED">Đã đóng</option>
                  </PrettySelect>
                  <PrettySelect value={submissionFilter} onChange={(e) => { setSubmissionFilter(e.target.value); resetPage(); }} className={selectCls} style={{ borderColor: C.border, color: C.onSurface }}>
                    <option value="">Mọi trạng thái nộp</option>
                    <option value="GRADED">Đã chấm</option>
                    <option value="SUBMITTED">Đã nộp</option>
                    <option value="MISSING">Chưa nộp</option>
                  </PrettySelect>
                  <PrettySelect value={sort} onChange={(e) => { setSort(e.target.value); resetPage(); }} className={selectCls} style={{ borderColor: C.border, color: C.onSurface }}>
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </PrettySelect>
                  <div className="flex">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Tìm bài tập..."
                      className="w-40 rounded-l-xl border border-r-0 bg-white px-3 py-2 text-sm outline-none"
                      style={{ borderColor: C.border, color: C.onSurface }}
                    />
                    <span className="flex items-center rounded-r-xl px-3 text-white" style={{ backgroundColor: C.deepBlue }}>
                      <Ms name="search" className="!text-[16px]!" />
                    </span>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="space-y-3 p-6">
                  {[0, 1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}
                </div>
              ) : !data?.items?.length ? (
                <div className="p-12 text-center">
                  <p className="text-sm font-medium" style={{ color: C.onSurface }}>Chưa có bài tập nào</p>
                  <p className="mt-1 text-sm text-slate-400">Không có bài tập nào phù hợp với bộ lọc hiện tại.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/30">
                        {["MÔN HỌC", "TIÊU ĐỀ & THÔNG TIN", "NỘP BÀI", "THAO TÁC"].map((h, i) => (
                          <th
                            key={h}
                            className={`px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 ${i === 2 ? "text-center" : ""} ${i === 3 ? "text-right" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.items.map((hw) => {
                        const chip = hwStatusChip(hw);
                        return (
                          <tr
                            key={hw.homeworkId}
                            onClick={() => setSelectedHw(hw)}
                            className="group cursor-pointer transition-all hover:bg-slate-50/80"
                          >
                            <td className="px-6 py-5">
                              <span className="rounded-2xl px-3 py-1 text-[10px] font-black uppercase tracking-tight text-white shadow-sm" style={{ backgroundColor: C.deepBlue }}>
                                {hw.subjectName}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <p className="font-bold" style={{ color: C.onSurface }}>{hw.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-3">
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                                  <Ms name="event" className="!text-[14px]!" /> {dueDisplay(hw.dueDate)}
                                </span>
                                <span className="rounded px-2 py-0.5 text-[10px] font-extrabold uppercase" style={{ backgroundColor: chip.bg, color: chip.text }}>
                                  {chip.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col items-center gap-1">
                                <SubmissionBadge status={hw.submissionStatus} isLate={hw.isLate} />
                                {hw.score !== null && (
                                  <span className="text-[11px] font-bold text-green-700">{hw.score}/{hw.maxScore} điểm</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSelectedHw(hw); }}
                                  title="Xem chi tiết"
                                  className="flex h-9 w-9 items-center justify-center rounded-2xl transition-colors hover:bg-[#F27123]/10"
                                  style={{ color: C.orange }}
                                >
                                  <Ms name="visibility" className="!text-[20px]!" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-6 py-4 text-sm text-slate-500" style={{ borderColor: C.border }}>
                  <span>{(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} / {pagination.total} bài tập</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40" style={{ borderColor: C.border }}>Trước</button>
                    <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40" style={{ borderColor: C.border }}>Sau</button>
                  </div>
                </div>
              )}
            </div>

            {/* Attention Panel */}
            <div className="flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm" style={{ borderColor: C.border }}>
              <div className="border-b bg-slate-50/50 px-6 py-5" style={{ borderColor: C.border }}>
                <h4 className="text-lg font-bold" style={{ color: C.onSurface }}>Cần chú ý</h4>
                <p className="mt-0.5 text-[11px] text-slate-400">Bài tập đang mở mà con bạn chưa nộp</p>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: 600 }}>
                {attentionItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">Không có bài tập nào cần chú ý.</p>
                ) : (
                  attentionItems.map((hw) => {
                    const cd = dueCountdown(hw.dueDate, hw.isOverdue);
                    return (
                      <button
                        key={hw.homeworkId}
                        type="button"
                        onClick={() => setSelectedHw(hw)}
                        className="group relative w-full cursor-pointer rounded-3xl border p-4 text-left shadow-sm transition-all hover:border-[#F27123]/40 hover:bg-[#F27123]/2"
                        style={{ borderColor: C.border }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                            style={{ backgroundColor: hw.isOverdue ? C.error : C.deepBlue }}
                          >
                            <Ms name={hw.isOverdue ? "warning" : "assignment"} className="!text-[20px]!" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold" style={{ color: C.onSurface }}>{hw.title}</p>
                            <p className="truncate text-[11px] font-medium text-slate-400">{hw.subjectName}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: cd.color }}>{cd.text}</span>
                            <p className="mt-0.5 text-[10px] text-slate-400">{dueDisplay(hw.dueDate)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedHw && (
        <DetailModal
          key={`${effStudentId}-${selectedHw.homeworkId}`}
          studentId={effStudentId}
          homework={selectedHw}
          onClose={() => setSelectedHw(null)}
        />
      )}
    </DashboardShell>
  );
}

export default StudentHomework;
