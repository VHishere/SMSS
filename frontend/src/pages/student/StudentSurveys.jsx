import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
  FiDatabase,
  FiEdit3,
  FiMonitor,
  FiMessageSquare,
  FiShield,
  FiStar,
} from "react-icons/fi";

import { studentApi } from "../../api/client";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";

// Bảng màu chuẩn của hệ thống (giống các trang teacher). Viền đặt qua inline
// style vì utility `border-*` của Tailwind bị CSS unlayered của Bootstrap ghi đè
// (đo được: border-slate-200 ra #DEE2E6 xám thay vì #DFC0B2).
const C = { onSurface: "#1A1C1C", border: "#DFC0B2" };
const CARD_BORDER = { border: `1px solid ${C.border}` };

const SUBJECT_VISUALS = [
  { icon: FiBookOpen, box: "bg-orange-100 text-[#F27123]" },
  { icon: FiDatabase, box: "bg-slate-100 text-slate-500" },
  { icon: FiCheckCircle, box: "bg-emerald-100 text-emerald-600" },
  { icon: FiMonitor, box: "bg-blue-100 text-blue-600" },
];

const EMPTY_FORM = {
  clarity: 0,
  support: 0,
  materials: 0,
  liked: "",
  improvement: "",
};

const MAX_SURVEY_TEXT_LENGTH = 800;
const MAX_SURVEY_COMMENT_LENGTH = 2000;

function StarRating({ value, onChange, label }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = score <= value;

          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${score} sao`}
              onClick={() => onChange(score)}
              className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                active
                  ? "bg-orange-50 text-[#F27123]"
                  : "text-slate-300 hover:bg-slate-50 hover:text-[#F27123]"
              }`}
            >
              <FiStar
                size={21}
                className={active ? "fill-current" : ""}
              />
            </button>
          );
        })}

        <span className="ml-2 text-[11px] font-medium text-slate-400">
          {value ? `${value}/5` : "Vui lòng chọn mức độ"}
        </span>
      </div>
    </div>
  );
}

function SurveySubjectItem({ survey, active, index, onClick }) {
  const visual = SUBJECT_VISUALS[index % SUBJECT_VISUALS.length];
  const Icon = visual.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-orange-200 bg-orange-50 shadow-sm"
          : survey.submitted
            ? "border-emerald-100 bg-emerald-50/60"
            : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${visual.box}`}>
        <Icon size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-extrabold text-[#0F2747]">
          {survey.subjectName || survey.title || "Khảo sát giáo viên"}
        </span>
        <span className="mt-1 block truncate text-[10px] text-slate-500">
          GV: {survey.teacherName || "Chưa cập nhật"}
        </span>
      </span>

      {survey.submitted ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <FiCheck size={14} />
        </span>
      ) : (
        <FiChevronRight
          className={`shrink-0 ${active ? "text-[#F27123]" : "text-slate-400 group-hover:text-[#F27123]"}`}
        />
      )}
    </button>
  );
}

function SurveyForm({ survey, onSubmitted }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(EMPTY_FORM);
    setError("");
  }, [survey?.surveyId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();

    const ratings = [form.clarity, form.support, form.materials];

    if (ratings.some((score) => !score)) {
      setError("Vui lòng đánh giá đầy đủ các tiêu chí trước khi gửi.");
      return;
    }

    const averageScore = Math.round(
      ratings.reduce((total, score) => total + score, 0) / ratings.length,
    );

    const commentLines = [
      `Chất lượng giảng dạy: ${form.clarity}/5`,
      `Hỗ trợ và giải đáp: ${form.support}/5`,
      `Tài liệu học tập: ${form.materials}/5`,
      form.liked.trim() ? `Điều em thích nhất: ${form.liked.trim()}` : "",
      form.improvement.trim()
        ? `Đề xuất cải thiện: ${form.improvement.trim()}`
        : "",
    ].filter(Boolean);
    const normalizedComment = commentLines.join("\n");

    if (normalizedComment.length > MAX_SURVEY_COMMENT_LENGTH) {
      setError("Nội dung góp ý quá dài, vui lòng rút gọn trước khi gửi.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await studentApi.submitMySurvey(survey.surveyId, {
        score: averageScore,
        comment: normalizedComment,
      });
      onSubmitted();
    } catch (requestError) {
      setError(requestError.message || "Không thể gửi khảo sát.");
    } finally {
      setSaving(false);
    }
  }

  if (survey.submitted) {
    return (
      <section className="grid min-h-[520px] place-items-center rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
        <div className="max-w-sm">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <FiCheckCircle size={30} />
          </span>
          <h2 className="mb-2 text-xl font-black text-[#0F2747]">
            Bạn đã hoàn thành khảo sát
          </h2>
          <p className="mb-0 text-sm leading-6 text-slate-500">
            Cảm ơn bạn đã gửi góp ý cho giáo viên {survey.teacherName}. Kết quả được lưu ẩn danh và chỉ dùng để tổng hợp chất lượng giảng dạy.
          </p>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="overflow-hidden rounded-3xl bg-white shadow-sm"
      style={CARD_BORDER}
    >
      <header className="flex items-start justify-between gap-4 bg-[#0F4C8A] px-5 py-4 text-white">
        <div className="min-w-0">
          <span className="mb-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide">
            Đang thực hiện
          </span>
          <h2 className="mb-1 truncate text-base font-black">
            {survey.subjectName || survey.title || "Khảo sát giáo viên"}
          </h2>
          <p className="mb-0 text-[11px] text-white/80">
            Giảng viên: {survey.teacherName || "Chưa cập nhật"}
          </p>
        </div>

        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-white/70 bg-white/10">
          <FiEdit3 size={19} />
        </span>
      </header>

      <div className="space-y-6 p-5">
        <section>
          <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#0F4C8A]">
            <FiShield />
            1. Chất lượng giảng dạy
          </h3>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold text-[#0F2747]">
                Giáo viên truyền đạt kiến thức rõ ràng, dễ hiểu?
              </p>
              <StarRating
                label="Chất lượng giảng dạy"
                value={form.clarity}
                onChange={(value) => updateField("clarity", value)}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[#0F2747]">
                Giáo viên nhiệt tình hỗ trợ và giải đáp thắc mắc?
              </p>
              <StarRating
                label="Hỗ trợ và giải đáp"
                value={form.support}
                onChange={(value) => updateField("support", value)}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#0F4C8A]">
            <FiBookOpen />
            2. Tài liệu và học liệu
          </h3>

          <p className="mb-2 text-xs font-semibold text-[#0F2747]">
            Tài liệu học tập đầy đủ, cập nhật và sát với thực tế?
          </p>
          <StarRating
            label="Tài liệu và học liệu"
            value={form.materials}
            onChange={(value) => updateField("materials", value)}
          />
        </section>

        <section>
          <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#0F4C8A]">
            <FiMessageSquare />
            3. Ý kiến đóng góp khác
          </h3>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[#0F2747]">
                Điều bạn thích nhất ở môn học hoặc giáo viên này?
              </span>
              <textarea
                value={form.liked}
                maxLength={MAX_SURVEY_TEXT_LENGTH}
                onChange={(event) => updateField("liked", event.target.value)}
                rows={3}
                placeholder="Nhập ý kiến của bạn..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
              <span className="mt-1 block text-right text-[10px] text-slate-400">
                {form.liked.length}/{MAX_SURVEY_TEXT_LENGTH}
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[#0F2747]">
                Đề xuất để cải thiện chất lượng giảng dạy?
              </span>
              <textarea
                value={form.improvement}
                maxLength={MAX_SURVEY_TEXT_LENGTH}
                onChange={(event) => updateField("improvement", event.target.value)}
                rows={3}
                placeholder="Nhập đề xuất của bạn..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-xs leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
              <span className="mt-1 block text-right text-[10px] text-slate-400">
                {form.improvement.length}/{MAX_SURVEY_TEXT_LENGTH}
              </span>
            </label>
          </div>
        </section>

        {error && (
          <p className="mb-0 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#F27123] px-6 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </div>
      </div>
    </form>
  );
}

function StudentSurveys() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    studentApi
      .getMySurveys()
      .then((response) => {
        if (!mounted) return;
        const nextSurveys = Array.isArray(response.data) ? response.data : [];
        setSurveys(nextSurveys);
        setSelectedSurveyId((current) => {
          if (nextSurveys.some((survey) => survey.surveyId === current)) {
            return current;
          }
          return (
            nextSurveys.find((survey) => !survey.submitted)?.surveyId ||
            nextSurveys[0]?.surveyId ||
            null
          );
        });
      })
      .catch((requestError) => {
        if (mounted) {
          setError(requestError.message || "Không thể tải danh sách khảo sát.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const headerUser = useMemo(() => {
    const studentRole = user?.roles?.find(
      (role) => role.roleName === "STUDENT",
    );

    return {
      name: user?.fullName || user?.username || "Học sinh",
      role: studentRole?.description || "Học sinh",
      avatar: user?.avatar || "",
    };
  }, [user]);

  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.surveyId === selectedSurveyId),
    [selectedSurveyId, surveys],
  );

  const completedCount = surveys.filter((survey) => survey.submitted).length;
  const progress = surveys.length
    ? Math.round((completedCount / surveys.length) * 100)
    : 0;

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STUDENT}
      sidebarFooterLabel="Khảo sát"
      sidebarFooterValue="Đánh giá giáo viên"
    >
      <h1
        className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl"
        style={{ color: C.onSurface }}
      >
        Khảo sát ý kiến học sinh
      </h1>

      <section
        className="mb-4 grid gap-4 rounded-3xl bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center"
        style={CARD_BORDER}
      >
        <div>
          <p className="mb-0 max-w-3xl text-xs leading-5 text-slate-500">
            Ý kiến của bạn là cơ sở quan trọng để nhà trường và giáo viên nâng cao chất lượng giảng dạy. Mọi phản hồi đều được tổng hợp ẩn danh.
          </p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <strong className="block text-xl leading-none text-[#0F4C8A]">
                {String(completedCount).padStart(2, "0")} / {String(surveys.length).padStart(2, "0")}
              </strong>
              <span className="text-[10px] font-semibold text-blue-600">
                Khảo sát đã hoàn thành
              </span>
            </div>
            <span className="text-xs font-extrabold text-[#0F4C8A]">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-[#F27123] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {loading && (
        <div
          className="rounded-3xl bg-white p-10 text-center text-sm text-slate-500 shadow-sm"
          style={CARD_BORDER}
        >
          Đang tải khảo sát...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && surveys.length === 0 && (
        <div
          className="rounded-3xl border-dashed bg-white p-10 text-center text-sm text-slate-500"
          style={{ border: `1px dashed ${C.border}` }}
        >
          Hiện chưa có khảo sát giáo viên nào đang mở.
        </div>
      )}

      {!loading && !error && surveys.length > 0 && selectedSurvey && (
        <div className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside
            className="rounded-3xl bg-white p-4 shadow-sm xl:sticky xl:top-5"
            style={CARD_BORDER}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="mb-0 text-xs font-extrabold text-[#0F2747]">
                Danh sách môn học
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                {surveys.length} khảo sát
              </span>
            </div>

            <div className="space-y-2.5">
              {surveys.map((survey, index) => (
                <SurveySubjectItem
                  key={survey.surveyId}
                  survey={survey}
                  index={index}
                  active={survey.surveyId === selectedSurveyId}
                  onClick={() => setSelectedSurveyId(survey.surveyId)}
                />
              ))}
            </div>
          </aside>

          <SurveyForm
            key={selectedSurvey.surveyId}
            survey={selectedSurvey}
            onSubmitted={() => setRefreshKey((current) => current + 1)}
          />
        </div>
      )}
    </DashboardShell>
  );
}

export default StudentSurveys;