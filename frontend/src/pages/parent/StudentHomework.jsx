import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiAward,
  FiBook,
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiInbox,
  FiMessageSquare,
  FiPaperclip,
  FiSearch,
  FiX,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentApi } from "../../api/client";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentHomework } from "../../hooks/useParentStudentHomework";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

const STATUS_MAP = {
  GRADED:    { label: "Đã chấm",  cls: "bg-green-50 text-green-700",   dot: "bg-green-500" },
  SUBMITTED: { label: "Đã nộp",   cls: "bg-blue-50 text-[#08509F]",    dot: "bg-[#08509F]" },
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

const HW_STATUS = {
  OPEN:   { label: "Đang mở", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "Đã đóng", cls: "bg-slate-100 text-slate-500" },
};

const SORT_OPTIONS = [
  { value: "due_desc",     label: "Hạn nộp mới nhất" },
  { value: "due_asc",      label: "Hạn nộp gần nhất" },
  { value: "created_desc", label: "Mới tạo" },
  { value: "title_asc",    label: "Tên A→Z" },
];

const SELECT_CLS =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

function StatCard({ icon: Icon, iconBg, iconColor, label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-white p-4 shadow-sm text-left transition w-full"
      style={{
        border: active ? "2px solid #F27123" : "1px solid #FFE7D6",
        outline: "none",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold leading-none" style={{ color: "#0F2747" }}>{value}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: active ? "#F27123" : iconBg }}>
          <Icon size={18} style={{ color: active ? "#fff" : iconColor }} />
        </div>
      </div>
    </button>
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

  const hwStatusInfo = HW_STATUS[homework.status] || HW_STATUS.OPEN;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,39,71,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-3xl border-b px-6 py-5" style={{ borderColor: "#FFE7D6", backgroundColor: "#fff" }}>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-[#08509F]">
                {homework.subjectName}
              </span>
              {homework.submissionStatus !== "GRADED" && (
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${hwStatusInfo.cls}`}>
                  {hwStatusInfo.label}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-[#0F2747] leading-tight">{homework.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="mt-0.5 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <FiClock size={14} className="text-[#F27123]" />
              <span>Hạn nộp: <strong className="text-[#0F2747]">{fmtDate(homework.dueDate)}</strong></span>
            </div>
            {detail?.teacherName && (
              <div className="flex items-center gap-1.5">
                <FiBook size={14} className="text-[#08509F]" />
                <span>GV: <strong className="text-[#0F2747]">{detail.teacherName}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <FiAward size={14} className="text-slate-400" />
              <span>Điểm tối đa: <strong className="text-[#0F2747]">{homework.maxScore}</strong></span>
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
              {/* Description */}
              {detail.description && (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#F27123]">Mô tả</p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}

              {/* Instructions */}
              {detail.instructions && (
                <div className="rounded-xl bg-[#FFF7F2] px-4 py-3" style={{ border: "1px solid #FFE7D6" }}>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#F27123]">Hướng dẫn</p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{detail.instructions}</p>
                </div>
              )}

              {/* Attachments */}
              {detail.attachments?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#F27123]">
                    <FiPaperclip className="inline mr-1" size={12} />Tệp đính kèm ({detail.attachments.length})
                  </p>
                  <div className="space-y-2">
                    {detail.attachments.map((att) => (
                      <a
                        key={att.attachmentId}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium text-[#08509F] hover:bg-blue-50 transition"
                        style={{ borderColor: "#E2E8F0" }}
                      >
                        <FiFileText size={16} className="shrink-0 text-[#08509F]" />
                        <span className="truncate">{att.fileName}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider */}
              <hr style={{ borderColor: "#FFE7D6" }} />

              {/* Submission section */}
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#F27123]">Kết quả nộp bài</p>
                <div className="rounded-2xl border px-5 py-4 space-y-3" style={{ borderColor: "#FFE7D6" }}>
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
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.submissionContent}</p>
                    </div>
                  )}

                  {detail.submissionFileUrl && (
                    <a
                      href={detail.submissionFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-[#08509F] hover:bg-blue-50 transition"
                      style={{ borderColor: "#E2E8F0" }}
                    >
                      <FiFileText size={15} />Xem file bài nộp
                    </a>
                  )}

                  {detail.score !== null && (
                    <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3">
                      <FiCheckCircle size={16} className="text-green-600 shrink-0" />
                      <span className="text-sm font-bold text-green-700">
                        Điểm: {detail.score} / {detail.maxScore}
                      </span>
                    </div>
                  )}

                  {detail.feedback && (
                    <div className="rounded-xl bg-[#FFF7F2] px-4 py-3" style={{ border: "1px solid #FFE7D6" }}>
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#F27123]">
                        <FiMessageSquare size={12} />Nhận xét của giáo viên
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.feedback}</p>
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

// ─── Homework card ─────────────────────────────────────────────────────────────

function HomeworkCard({ hw, onClick }) {
  const hwStatus = HW_STATUS[hw.status] || HW_STATUS.OPEN;
  const isOverdue = hw.isOverdue && hw.status === "OPEN";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none"
      style={{ borderColor: "#FFE7D6" }}
    >
      {/* Top row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-[#08509F]">
            {hw.subjectName}
          </span>
          {hw.submissionStatus !== "GRADED" && (
            <>
              <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${hwStatus.cls}`}>
                {hwStatus.label}
              </span>
              {isOverdue && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                  Quá hạn
                </span>
              )}
            </>
          )}
        </div>
        <SubmissionBadge status={hw.submissionStatus} isLate={hw.isLate} />
      </div>

      {/* Title */}
      <h3 className="mb-2 font-bold text-[#0F2747] leading-snug">{hw.title}</h3>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-slate-500" style={{ borderColor: "#FFF0E9" }}>
        <div className="flex items-center gap-1.5">
          <FiClock size={13} className="text-[#F27123]" />
          Hạn: {fmtDate(hw.dueDate)}
        </div>
        {hw.score !== null && (
          <div className="flex items-center gap-1.5">
            <FiCheckCircle size={13} className="text-green-500" />
            Điểm: <strong className="font-bold text-green-700">{hw.score}/{hw.maxScore}</strong>
          </div>
        )}
        {hw.submitTime && hw.score === null && (
          <div className="flex items-center gap-1.5">
            <FiFileText size={13} className="text-[#08509F]" />
            Đã nộp: {fmtDate(hw.submitTime)}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function StudentHomework() {
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useParentStudents();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [statusFilter,      setStatusFilter]      = useState("");
  const [submissionFilter,  setSubmissionFilter]  = useState("");
  const [subjectId,         setSubjectId]         = useState("");
  const [sort,              setSort]              = useState("due_desc");
  const [subjectOptions,    setSubjectOptions]    = useState([]);
  const [search,            setSearch]            = useState("");
  const [searchInput,       setSearchInput]       = useState("");
  const [page,              setPage]              = useState(1);
  const [selectedHw,        setSelectedHw]        = useState(null);

  const LIMIT = 12;

  const effStudentId  = selectedStudentId || (students[0]?.studentId ? String(students[0].studentId) : "");
  const activeStudent = students.find((s) => String(s.studentId) === effStudentId) ?? null;

  const params = useMemo(() => ({
    status:           statusFilter     || undefined,
    submissionStatus: submissionFilter || undefined,
    subjectId:        subjectId        || undefined,
    sort,
    search:           search           || undefined,
    page,
    limit: LIMIT,
  }), [statusFilter, submissionFilter, subjectId, sort, search, page]);

  const { data, loading, error } = useParentStudentHomework(
    effStudentId,
    params,
    Boolean(effStudentId),
  );

  const headerUser = useMemo(() => ({
    name:   user?.fullName || user?.username || "Phụ huynh",
    role:   "Phụ huynh",
    avatar: user?.avatar || "",
  }), [user]);

  function handleStudentChange(id) {
    setSelectedStudentId(String(id));
    setSubmissionFilter("");
    setSubjectId("");
    setPage(1);
  }

  function handleStatusChange(val) {
    setStatusFilter(val);
    setPage(1);
  }

  function handleSubmissionFilter(val) {
    setSubmissionFilter((prev) => (prev === val ? "" : val));
    setPage(1);
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = data?.pagination?.totalPages || 1;
  const summary = data?.summary ?? { total: 0, graded: 0, submitted: 0, missing: 0 };

  useEffect(() => {
    if (!data?.items?.length) return;
    Promise.resolve(data.items).then((items) => {
      setSubjectOptions((prev) => {
        const map = Object.fromEntries(prev.map((s) => [s.id, s.name]));
        for (const hw of items) map[hw.subjectId] = hw.subjectName;
        return Object.entries(map).map(([id, name]) => ({ id, name }));
      });
    });
  }, [data?.items]);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.PARENT}>
      {studentsLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : students.length === 0 ? (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>
          Không tìm thấy thông tin học sinh.
        </div>
      ) : (
        <>
          {/* Student pill selector — only when >1 child */}
          {students.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {students.map((s) => (
                <button
                  key={s.studentId}
                  type="button"
                  onClick={() => handleStudentChange(s.studentId)}
                  className="rounded-full px-4 py-2 text-sm font-medium transition"
                  style={
                    String(s.studentId) === effStudentId
                      ? { backgroundColor: "#08509F", color: "#fff" }
                      : { border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#475569" }
                  }
                >
                  {s.studentFullName}
                  {s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Student info banner */}
          {activeStudent && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
              {activeStudent.studentAvatar ? (
                <img src={activeStudent.studentAvatar} alt={activeStudent.studentFullName}
                  className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#08509F] text-sm font-bold text-white">
                  {activeStudent.studentFullName?.[0] ?? "?"}
                </div>
              )}
              <div>
                <span className="text-sm font-semibold" style={{ color: "#0F2747" }}>{activeStudent.studentFullName}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {activeStudent.studentCode}
                  {activeStudent.className && ` · ${activeStudent.className}`}
                  {activeStudent.relationship && ` · ${activeStudent.relationship}`}
                </span>
              </div>
            </div>
          )}

          {/* Summary stat cards — clickable submission status filter */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={FiBookOpen} iconBg="#FFF0E8" iconColor="#F27123"
              label="Tổng bài tập" value={summary.total}
              active={submissionFilter === ""} onClick={() => handleSubmissionFilter("")}
            />
            <StatCard
              icon={FiCheckCircle} iconBg="#ECFDF5" iconColor="#16A34A"
              label="Đã chấm" value={summary.graded}
              active={submissionFilter === "GRADED"} onClick={() => handleSubmissionFilter("GRADED")}
            />
            <StatCard
              icon={FiEdit3} iconBg="#EBF3FF" iconColor="#08509F"
              label="Đã nộp" value={summary.submitted}
              active={submissionFilter === "SUBMITTED"} onClick={() => handleSubmissionFilter("SUBMITTED")}
            />
            <StatCard
              icon={FiAlertTriangle} iconBg="#FEF3C7" iconColor="#D97706"
              label="Chưa nộp" value={summary.missing}
              active={submissionFilter === "MISSING"} onClick={() => handleSubmissionFilter("MISSING")}
            />
          </div>

          {/* Filters */}
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Môn</label>
              <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPage(1); }} className={SELECT_CLS}>
                <option value="">Tất cả môn</option>
                {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Trạng thái</label>
              <select value={statusFilter} onChange={(e) => { handleStatusChange(e.target.value); }} className={SELECT_CLS}>
                <option value="">Tất cả</option>
                <option value="OPEN">Đang mở</option>
                <option value="CLOSED">Đã đóng</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Sắp xếp</label>
              <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={SELECT_CLS}>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <form onSubmit={handleSearch} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Tìm bài tập</label>
              <div className="flex">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tiêu đề bài tập..."
                  className="w-44 rounded-l-lg border border-r-0 border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
                />
                <button type="submit" className="flex items-center rounded-r-lg px-3 text-white" style={{ backgroundColor: "#08509F" }}>
                  <FiSearch size={15} />
                </button>
              </div>
            </form>
          </div>

          {/* Content */}
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <FiAlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {data.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border bg-white p-12 text-center shadow-sm" style={{ borderColor: "#FFE7D6" }}>
                  <FiInbox size={36} className="mb-3 text-slate-300" />
                  <p className="text-slate-400">Không có bài tập nào phù hợp.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.items.map((hw) => (
                    <HomeworkCard key={hw.homeworkId} hw={hw} onClick={() => setSelectedHw(hw)} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
                  <span>
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.pagination.total)} / {data.pagination.total} bài tập
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50">Trước</button>
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50">Sau</button>
                  </div>
                </div>
              )}
            </>
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
        </>
      )}
    </DashboardShell>
  );
}

export default StudentHomework;
