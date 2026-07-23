import { useEffect, useMemo, useState } from "react";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { studentApi } from "../../api/client";

function SurveyCard({ survey, onSubmitted }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", isError: false });

  async function submit() {
    if (!score) { setMsg({ text: "Vui lòng chọn điểm đánh giá (1–5).", isError: true }); return; }
    setSaving(true); setMsg({ text: "", isError: false });
    try {
      await studentApi.submitMySurvey(survey.surveyId, { score, comment: comment.trim() || null });
      onSubmitted();
    } catch (err) {
      setMsg({ text: err.message, isError: true });
    } finally { setSaving(false); }
  }

  if (survey.submitted) {
    return (
      <div className="rounded-2xl border border-green-100 bg-green-50 px-5 py-4">
        <p className="mb-0 text-sm font-semibold text-green-700">
          {survey.title || `Đánh giá GV ${survey.teacherName}`}{survey.subjectName ? ` · ${survey.subjectName}` : ""}
        </p>
        <p className="mb-0 text-xs text-green-600">Bạn đã gửi đánh giá (ẩn danh). Cảm ơn bạn!</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <p className="mb-1 text-sm font-bold text-[#0F2747]">
        {survey.title || `Đánh giá giáo viên ${survey.teacherName}`}
      </p>
      <p className="mb-3 text-xs text-slate-500">
        GV {survey.teacherName}{survey.subjectName ? ` · Môn ${survey.subjectName}` : ""} · Ẩn danh
      </p>

      <div className="mb-3 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setScore(n)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition"
            style={n <= score
              ? { backgroundColor: "#F27123", color: "#fff" }
              : { backgroundColor: "#F3F3F3", color: "#64748B" }}>
            {n}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-400">{score ? `${score}/5` : "Chọn điểm"}</span>
      </div>

      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
        placeholder="Góp ý thêm (tùy chọn)..."
        className="w-full resize-none rounded-xl border border-orange-100 px-3 py-2 text-sm text-[#0F2747] outline-none focus:border-[#F27123] focus:ring-2 focus:ring-orange-100" />

      {msg.text && <p className={`mt-2 text-xs font-medium ${msg.isError ? "text-red-600" : "text-green-600"}`}>{msg.text}</p>}

      <div className="mt-3 flex justify-end">
        <button type="button" onClick={submit} disabled={saving}
          className="rounded-full bg-[#F27123] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Đang gửi..." : "Gửi đánh giá"}
        </button>
      </div>
    </div>
  );
}

function StudentSurveys() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    studentApi.getMySurveys()
      .then((res) => { if (m) setSurveys(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  const headerUser = useMemo(() => {
    const role = user?.roles?.find((r) => r.roleName === "STUDENT");
    return { name: user?.fullName || user?.username || "Học sinh", role: role?.description || "Học sinh", avatar: user?.avatar || "" };
  }, [user]);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.STUDENT} sidebarFooterLabel="Khảo sát" sidebarFooterValue="Đánh giá giáo viên">
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold text-[#0F2747]">Khảo sát đánh giá giáo viên</h1>
        <p className="mb-0 text-sm text-slate-500">Đánh giá ẩn danh — chỉ tổng hợp cho nhà trường, không hiển thị danh tính của bạn.</p>
      </div>

      {loading && <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Đang tải khảo sát...</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>}

      {!loading && !error && surveys && (
        surveys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Hiện chưa có khảo sát nào đang mở.
          </div>
        ) : (
          <div className="space-y-4">
            {surveys.map((s) => <SurveyCard key={s.surveyId} survey={s} onSubmitted={() => setRefresh((k) => k + 1)} />)}
          </div>
        )
      )}
    </DashboardShell>
  );
}

export default StudentSurveys;
