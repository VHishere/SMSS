import { useEffect, useState } from "react";

import { homeworkApi } from "../../api/client";

// FSchool Stitch design — grading panel (homework-grading screen)
const C = {
  onSurface: "#1A1C1C",
  muted: "#584238",
  border: "#DFC0B2",
  primary: "#9F4200",
  orange: "#F27123",
  deepBlue: "#00458E",
  error: "#BA1A1A",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

function Ms({ name, className = "", style }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

const QUICK_TAGS = ["Bố cục tốt", "Cần bổ sung dẫn chứng", "Phân tích sâu sắc"];

function scoreColor(value, maxScore) {
  const s = Number(value);
  if (!Number.isFinite(s)) return C.onSurface;
  const ratio = maxScore > 0 ? s / maxScore : 0;
  if (ratio >= 0.8) return C.deepBlue;
  if (ratio < 0.5) return C.error;
  return C.primary;
}

function GradeSubmissionModal({ submission, maxScore, onClose, onSaved }) {
  const [score,    setScore]    = useState(submission.score ?? "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [saving,   setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [log,        setLog]        = useState([]);
  const [logLoading, setLogLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLogLoading(true);
    homeworkApi
      .getGradeLog(submission.submissionId)
      .then((res) => { if (mounted) setLog(res.data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLogLoading(false); });
    return () => { mounted = false; };
  }, [submission.submissionId]);

  function validate() {
    const s = Number(score);
    if (score === "" || !Number.isFinite(s)) return "Vui lòng nhập điểm";
    if (s < 0) return "Điểm không được âm";
    if (s > maxScore) return `Điểm không được vượt quá ${maxScore}`;
    return "";
  }

  async function handleSubmit() {
    const v = validate();
    if (v) { setErrorMsg(v); return; }

    setSaving(true);
    setErrorMsg("");
    try {
      await homeworkApi.grade(submission.submissionId, {
        score: Number(score),
        feedback: feedback.trim() || null,
      });
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  function addTag(tag) {
    setFeedback((cur) => (cur ? `${cur}\n- ${tag}` : `- ${tag}`));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
        style={{ border: `1px solid ${C.border}` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: C.border, backgroundColor: "rgba(0,69,142,0.05)" }}
        >
          <h3
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest"
            style={{ color: C.muted }}
          >
            <Ms name="edit_square" className="!text-[20px]" /> Chấm điểm &amp; Nhận xét
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <Ms name="close" className="!text-[20px]" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-2">
          {/* Left: student + submission content */}
          <div className="space-y-4 border-b p-6 lg:border-b-0 lg:border-r" style={{ borderColor: C.border }}>
            {/* Student header */}
            <div className="flex items-center gap-4 rounded-xl border p-3" style={{ borderColor: C.border }}>
              {submission.studentAvatar ? (
                <img src={submission.studentAvatar} alt={submission.studentName} className="h-12 w-12 rounded-xl object-cover shadow-md" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white shadow-md" style={{ backgroundColor: C.deepBlue }}>
                  {submission.studentName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="truncate text-base font-semibold" style={{ color: C.onSurface }}>{submission.studentName}</h4>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs" style={{ color: C.muted }}>
                  <span className="flex items-center gap-1"><Ms name="badge" className="!text-[13px]" /> {submission.studentCode}</span>
                  {submission.submitTime && (
                    <span className="flex items-center gap-1"><Ms name="schedule" className="!text-[13px]" /> {submission.submitTime}</span>
                  )}
                </div>
              </div>
              {submission.isLate && (
                <span className="ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase" style={{ backgroundColor: "#FFDAD6", color: "#93000A" }}>
                  Nộp muộn
                </span>
              )}
            </div>

            {/* Submission content */}
            <div>
              <h4 className="mb-2 text-base font-semibold" style={{ color: C.onSurface }}>Bài làm của học sinh</h4>
              <div
                className="max-h-64 overflow-y-auto whitespace-pre-line rounded-xl border p-4 text-sm leading-relaxed"
                style={{ borderColor: C.border, backgroundColor: C.surfaceLow, color: C.muted }}
              >
                {submission.content || "Không có nội dung văn bản."}
              </div>
            </div>

            {/* Attachment */}
            {submission.fileUrl && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>Tệp đính kèm</p>
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-4 rounded-xl border p-3 transition-colors hover:bg-[#E8E8E8]"
                  style={{ borderColor: C.border, backgroundColor: C.surfaceLow, textDecoration: "none" }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(255,218,214,0.4)", color: C.error }}>
                    <Ms name="picture_as_pdf" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: C.onSurface }}>Bài nộp của {submission.studentName}</p>
                    <p className="text-xs" style={{ color: C.muted }}>Nhấn để mở tệp</p>
                  </div>
                  <Ms name="download" className="opacity-0 transition-opacity group-hover:opacity-100" style={{ color: C.muted }} />
                </a>
              </div>
            )}

            {/* Grade history */}
            {!logLoading && log.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>Lịch sử chấm điểm</p>
                <div className="space-y-2">
                  {log.map((entry) => (
                    <div key={entry.gradeLogId} className="flex items-center justify-between rounded-lg border border-transparent p-2 text-xs transition-all hover:border-[#DFC0B2]" style={{ backgroundColor: C.surfaceLow }}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.action === "REGRADE" ? C.tertiary ?? "#4A5F82" : C.primary }} />
                        <span style={{ color: C.onSurface }}>
                          {entry.action === "REGRADE" ? "Chấm lại" : "Chấm điểm"}
                          {entry.oldScore !== null && <span className="text-slate-400"> {entry.oldScore} →</span>}
                          <span className="font-bold" style={{ color: C.deepBlue }}> {entry.newScore}</span>
                          <span className="text-slate-400"> · {entry.graderName}</span>
                        </span>
                      </div>
                      <span className="text-slate-400">{entry.createdAt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: grading panel (Stitch) */}
          <div className="flex flex-col">
            <div className="flex-1 space-y-5 p-6">
              {/* Score input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                  Điểm (thang 0-{maxScore})
                </label>
                <div className="flex items-end gap-2">
                  <input
                    type="number"
                    min="0"
                    max={maxScore}
                    step="0.25"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="w-full rounded-xl border-2 px-4 py-2 text-center text-5xl font-bold outline-none transition-all focus:border-[#9F4200]"
                    style={{ borderColor: C.border, backgroundColor: C.surfaceLow, color: scoreColor(score, maxScore) }}
                  />
                  <span className="mb-2 shrink-0 text-3xl font-semibold" style={{ color: C.muted }}>/ {maxScore}</span>
                </div>
              </div>

              {/* Feedback */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                  Nhận xét của giáo viên
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={7}
                  placeholder="Viết phản hồi chi tiết cho học sinh tại đây..."
                  className="w-full resize-none rounded-xl border p-4 text-sm outline-none transition-all focus:border-[#9F4200]"
                  style={{ borderColor: C.border, backgroundColor: C.surfaceLow, color: C.onSurface }}
                />
              </div>

              {/* Quick feedback tags */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="rounded-full px-3 py-1 text-xs transition-colors hover:text-white"
                    style={{ backgroundColor: C.surfaceHigh, color: C.muted }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.orange; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = C.surfaceHigh; e.currentTarget.style.color = C.muted; }}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {errorMsg && (
                <p className="rounded-xl px-3 py-2 text-xs font-medium" style={{ backgroundColor: "#FFDAD6", color: "#93000A" }}>{errorMsg}</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3 border-t p-6" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: C.orange }}
              >
                <Ms name={saving ? "sync" : "save"} className={saving ? "animate-spin" : ""} />
                {saving ? "Đang lưu..." : "Lưu & công bố điểm"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="w-full rounded-full border py-3 font-bold transition-all hover:bg-white disabled:opacity-50"
                style={{ borderColor: C.border, color: C.muted, backgroundColor: "transparent" }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GradeSubmissionModal;
