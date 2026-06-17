import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiLock,
  FiUsers,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import GradeSubmissionModal from "../../components/organisms/GradeSubmissionModal";
import HomeworkFormModal from "../../components/organisms/HomeworkFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { homeworkApi } from "../../api/client";
import { useHomeworkAnalytics } from "../../hooks/useHomeworkAnalytics";
import { useHomeworkDetail } from "../../hooks/useHomeworkDetail";
import { useHomeworkSubmissions } from "../../hooks/useHomeworkSubmissions";

const TABS = [
  { key: "info",        label: "Thông tin",  icon: FiFileText },
  { key: "submissions", label: "Bài nộp",    icon: FiUsers },
  { key: "analytics",   label: "Thống kê",   icon: FiBarChart2 },
];

const SUB_STATUS = {
  GRADED:    { label: "Đã chấm",     bg: "#ECFDF5", text: "#16A34A" },
  SUBMITTED: { label: "Chờ chấm",    bg: "#FFFBEB", text: "#F59E0B" },
  MISSING:   { label: "Chưa nộp",    bg: "#FEF2F2", text: "#DC2626" },
};

function StatusPill({ status }) {
  const cfg = SUB_STATUS[status] ?? SUB_STATUS.MISSING;
  return (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

// ── Info Tab ──────────────────────────────────────────────────────────────────

function InfoTab({ homework, onEdit, onToggleStatus }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={homework.status === "OPEN"
              ? { backgroundColor: "#ECFDF5", color: "#16A34A" }
              : { backgroundColor: "#F1F5F9", color: "#475569" }}
          >
            {homework.status === "OPEN" ? "Đang mở" : "Đã đóng"}
          </span>
          {homework.status === "OPEN" && homework.isOverdue && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
              Quá hạn
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleStatus}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition"
            style={{ borderColor: "#E2E8F0", color: "#475569" }}
          >
            {homework.status === "OPEN" ? <><FiLock size={14} /> Đóng bài</> : <><FiCheckCircle size={14} /> Mở lại</>}
          </button>
          {homework.status === "OPEN" && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white transition"
              style={{ backgroundColor: "#08509F" }}
            >
              <FiEdit3 size={14} /> Chỉnh sửa
            </button>
          )}
        </div>
      </div>

      <h2 className="mb-1 text-xl font-bold" style={{ color: "#0F2747" }}>{homework.title}</h2>
      <p className="mb-4 text-sm text-slate-500">{homework.className} · {homework.gradeName} · {homework.subjectName}</p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
          <p className="text-xs text-slate-400">Ngày giao</p>
          <p className="text-sm font-semibold" style={{ color: "#0F2747" }}>{homework.assignDate}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
          <p className="text-xs text-slate-400">Hạn nộp</p>
          <p className="text-sm font-semibold" style={{ color: "#0F2747" }}>{homework.dueDate}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
          <p className="text-xs text-slate-400">Điểm tối đa</p>
          <p className="text-sm font-semibold" style={{ color: "#0F2747" }}>{homework.maxScore}</p>
        </div>
      </div>

      {homework.description && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Mô tả</p>
          <p className="text-sm text-slate-700">{homework.description}</p>
        </div>
      )}

      {homework.instructions && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Hướng dẫn làm bài</p>
          <div className="rounded-xl px-4 py-3 text-sm text-slate-700 whitespace-pre-line" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
            {homework.instructions}
          </div>
        </div>
      )}

      {homework.attachments?.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Tệp đính kèm</p>
          <ul className="space-y-2">
            {homework.attachments.map((att) => (
              <li key={att.attachmentId}>
                <a href={att.fileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition hover:bg-slate-50"
                  style={{ border: "1px solid #FFE7D6" }}>
                  <FiExternalLink size={14} style={{ color: "#08509F" }} />
                  <span className="font-medium" style={{ color: "#08509F" }}>{att.fileName}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Submissions Tab ───────────────────────────────────────────────────────────

function SubmissionsTab({ homeworkId, maxScore, refreshKey, onGraded }) {
  const { data, loading, error } = useHomeworkSubmissions(homeworkId, refreshKey);
  const [grading, setGrading] = useState(null);

  const submissions = data?.submissions ?? [];

  const counts = useMemo(() => {
    let submitted = 0, graded = 0, missing = 0;
    for (const s of submissions) {
      if (s.status === "MISSING") missing++;
      else if (s.status === "GRADED") { graded++; submitted++; }
      else submitted++;
    }
    return { submitted, graded, missing };
  }, [submissions]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>Đã nộp: {counts.submitted}</span>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "#ECFDF5", color: "#16A34A" }}>Đã chấm: {counts.graded}</span>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>Chưa nộp: {counts.missing}</span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                {["HỌC SINH", "TRẠNG THÁI", "THỜI GIAN NỘP", "ĐIỂM", ""].map((c, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, idx) => (
                <tr key={s.studentId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#08509F" }}>
                        {s.studentAvatar ? <img src={s.studentAvatar} alt={s.studentName} className="h-8 w-8 rounded-full object-cover" /> : (s.studentName?.[0]?.toUpperCase() ?? "?")}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[#0F2747]">{s.studentName}</div>
                        <div className="text-xs text-slate-400">{s.studentCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill status={s.status} />
                      {s.isLate && <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Muộn</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{s.submitTime ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.score === null ? <span className="text-slate-400">—</span> : (
                      <span className="font-semibold" style={{ color: "#0F2747" }}>{s.score}/{maxScore}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.status === "MISSING" ? (
                      <span className="text-xs text-slate-400">Chưa có bài</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setGrading(s)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition"
                        style={{ backgroundColor: s.status === "GRADED" ? "#EBF3FF" : "#ECFDF5", color: s.status === "GRADED" ? "#08509F" : "#16A34A" }}
                      >
                        <FiEdit3 size={11} />
                        {s.status === "GRADED" ? "Sửa điểm" : "Chấm điểm"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {grading && (
        <GradeSubmissionModal
          submission={grading}
          maxScore={maxScore}
          onClose={() => setGrading(null)}
          onSaved={() => { setGrading(null); onGraded(); }}
        />
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticItem({ label, value, suffix = "", color = "#0F2747" }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}{suffix}</p>
    </div>
  );
}

function AnalyticsTab({ homeworkId, enabled, refreshKey }) {
  const { data, loading, error } = useHomeworkAnalytics(homeworkId, enabled, refreshKey);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
      </div>
    );
  }
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const a = data.analytics;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <AnalyticItem label="Tỷ lệ nộp"        value={a.submissionRate} suffix="%" color="#F27123" />
      <AnalyticItem label="Tỷ lệ hoàn thành" value={a.completionRate} suffix="%" color="#16A34A" />
      <AnalyticItem label="Điểm trung bình"  value={a.avgScore === null ? "—" : a.avgScore} color="#08509F" />
      <AnalyticItem label="Tổng bài nộp"     value={`${a.totalSubmissions}/${a.totalStudents}`} />
      <AnalyticItem label="Nộp muộn"         value={a.lateCount} color="#F59E0B" />
      <AnalyticItem label="Chưa nộp"         value={a.missingCount} color="#DC2626" />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function HomeworkDetailPage() {
  const { homeworkId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "info";

  const [refreshKey, setRefreshKey] = useState(0);
  const [showEdit,   setShowEdit]   = useState(false);

  const { data: homework, loading, error } = useHomeworkDetail(homeworkId, refreshKey);

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

  async function handleToggleStatus() {
    if (!homework) return;
    const next = homework.status === "OPEN" ? "CLOSED" : "OPEN";
    try {
      await homeworkApi.changeStatus(homework.homeworkId, next);
      setRefreshKey((k) => k + 1);
    } catch {
      // surfaced on next load; keep silent here
    }
  }

  function setTab(key) {
    setSearchParams({ tab: key });
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Bài tập"
      sidebarFooterValue={homework?.className ?? ""}
    >
      <button
        type="button"
        onClick={() => navigate("/teacher/homework")}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#0F2747]"
      >
        <FiArrowLeft size={15} /> Quay lại danh sách
      </button>

      {loading && (
        <div className="space-y-4">
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && homework && (
        <>
          {/* Tabs */}
          <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={activeTab === key ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6" }}>
            {activeTab === "info" && (
              <InfoTab
                homework={homework}
                onEdit={() => setShowEdit(true)}
                onToggleStatus={handleToggleStatus}
              />
            )}
            {activeTab === "submissions" && (
              <SubmissionsTab
                homeworkId={homework.homeworkId}
                maxScore={homework.maxScore}
                refreshKey={refreshKey}
                onGraded={() => setRefreshKey((k) => k + 1)}
              />
            )}
            {activeTab === "analytics" && (
              <AnalyticsTab
                homeworkId={homework.homeworkId}
                enabled={activeTab === "analytics"}
                refreshKey={refreshKey}
              />
            )}
          </div>
        </>
      )}

      {showEdit && homework && (
        <HomeworkFormModal
          mode="edit"
          homework={homework}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); setRefreshKey((k) => k + 1); }}
        />
      )}
    </DashboardShell>
  );
}

export default HomeworkDetailPage;
