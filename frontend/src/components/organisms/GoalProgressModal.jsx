import { useEffect, useState } from "react";
import { FiClock, FiFlag, FiX } from "react-icons/fi";

import { goalApi } from "../../api/client";

function GoalProgressModal({ goal, onClose, onSaved }) {
  const [progress,       setProgress]       = useState(goal.progress ?? 0);
  const [note,           setNote]           = useState("");
  const [isMilestone,    setIsMilestone]    = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [saving,         setSaving]         = useState(false);
  const [errorMsg,       setErrorMsg]       = useState("");

  const [log,        setLog]        = useState([]);
  const [logLoading, setLogLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLogLoading(true);
    goalApi.getLog(goal.goalId)
      .then((res) => { if (mounted) setLog(res.data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLogLoading(false); });
    return () => { mounted = false; };
  }, [goal.goalId]);

  async function handleSubmit() {
    const p = Number(progress);
    if (!Number.isInteger(p) || p < 0 || p > 100) { setErrorMsg("Tiến độ phải từ 0 đến 100"); return; }
    if (isMilestone && !milestoneTitle.trim()) { setErrorMsg("Vui lòng nhập tên mốc"); return; }

    setSaving(true);
    setErrorMsg("");
    try {
      await goalApi.updateProgress(goal.goalId, {
        progress: p,
        note: note.trim() || null,
        milestoneTitle: isMilestone ? milestoneTitle.trim() : null,
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
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>Cập nhật tiến độ</h3>
            <p className="truncate text-xs text-slate-500">{goal.title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-medium text-slate-600">
              <span>Tiến độ</span><span className="font-bold" style={{ color: "#F27123" }}>{progress}%</span>
            </label>
            <input type="range" min="0" max="100" step="5" value={progress} onChange={(e) => setProgress(e.target.value)} className="w-full accent-[#F27123]" />
            <input type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} className={`${inputCls} mt-2`} />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#0F2747]">
            <input type="checkbox" checked={isMilestone} onChange={(e) => setIsMilestone(e.target.checked)} className="accent-[#F27123]" />
            <FiFlag size={14} style={{ color: "#08509F" }} /> Đánh dấu là một mốc (milestone)
          </label>

          {isMilestone && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Tên mốc <span className="text-red-500">*</span></label>
              <input type="text" value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} placeholder="Ví dụ: Hoàn thành 5 đề luyện tập" className={inputCls} />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Ghi chú tiến độ</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Nhận xét về tiến độ..." className={`${inputCls} resize-none`} />
          </div>

          {errorMsg && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}

          {!logLoading && log.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><FiClock size={12} /> Nhật ký</p>
              <div className="space-y-2">
                {log.map((e) => (
                  <div key={e.logId} className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#F8FAFC" }}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium" style={{ color: "#0F2747" }}>
                        {e.action === "MILESTONE" ? `🏁 ${e.milestoneTitle}` : e.action === "EVALUATE" ? "Đánh giá" : e.action === "CREATE" ? "Tạo mục tiêu" : e.action === "ARCHIVE" ? "Lưu trữ" : "Cập nhật"}
                        {e.newProgress !== null && <span className="ml-1 text-slate-400">{e.oldProgress !== null ? `${e.oldProgress}→` : ""}{e.newProgress}%</span>}
                      </span>
                      <span className="text-slate-400">{e.createdAt}</span>
                    </div>
                    {e.note && <p className="mt-1 text-slate-500">{e.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
            {saving ? "Đang lưu..." : "Lưu tiến độ"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoalProgressModal;
