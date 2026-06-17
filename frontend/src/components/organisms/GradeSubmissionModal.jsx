import { useEffect, useState } from "react";
import { FiClock, FiExternalLink, FiX } from "react-icons/fi";

import { homeworkApi } from "../../api/client";

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

  const inputCls =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
        style={{ border: "1px solid #FFE7D6" }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>Chấm điểm bài nộp</h3>
            <p className="text-xs text-slate-500">{submission.studentName} · {submission.studentCode}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Submission content */}
          <div className="rounded-xl px-3 py-3" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Nội dung nộp</p>
            <p className="text-sm text-slate-700">{submission.content || "—"}</p>
            {submission.fileUrl && (
              <a
                href={submission.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: "#08509F" }}
              >
                <FiExternalLink size={12} />
                Xem tệp đã nộp
              </a>
            )}
            {submission.isLate && (
              <p className="mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                Nộp muộn
              </p>
            )}
          </div>

          {/* Score */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Điểm (tối đa {maxScore}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              max={maxScore}
              step="0.25"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Feedback */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Nhận xét</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="Nhận xét cho học sinh..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {errorMsg && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>
          )}

          {/* Grade history */}
          {!logLoading && log.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <FiClock size={12} />
                Lịch sử chấm điểm
              </p>
              <div className="space-y-2">
                {log.map((entry) => (
                  <div key={entry.gradeLogId} className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#F8FAFC" }}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium" style={{ color: "#0F2747" }}>
                        {entry.action === "REGRADE" ? "Chấm lại" : "Chấm điểm"}
                        {entry.oldScore !== null && (
                          <span className="ml-1 text-slate-400">{entry.oldScore} → </span>
                        )}
                        <span style={{ color: "#16A34A" }}>{entry.newScore}</span>
                      </span>
                      <span className="text-slate-400">{entry.createdAt}</span>
                    </div>
                    {entry.feedback && <p className="mt-1 text-slate-500">{entry.feedback}</p>}
                    <p className="mt-0.5 text-slate-400">bởi {entry.graderName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: "#16A34A" }}
          >
            {saving ? "Đang lưu..." : "Lưu điểm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GradeSubmissionModal;
