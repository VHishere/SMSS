import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

import { behaviourApi } from "../../api/client";

const GRADE_COLOR = { TOT: "#16A34A", KHA: "#08509F", TB: "#F59E0B", YEU: "#DC2626", NA: "#64748B" };

function ConductEvaluationModal({ student, semesterId, onClose, onSaved }) {
  const [preview,    setPreview]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [adjustment, setAdjustment] = useState(0);
  const [comment,    setComment]    = useState("");
  const [saving,     setSaving]     = useState(false);
  const [errorMsg,   setErrorMsg]   = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    behaviourApi
      .getConductPreview(student.studentId, semesterId)
      .then((res) => {
        if (!mounted) return;
        setPreview(res.data);
        if (res.data.existing) {
          setAdjustment(res.data.existing.adjustment);
          setComment(res.data.existing.comment ?? "");
        }
      })
      .catch((err) => { if (mounted) setErrorMsg(err.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [student.studentId, semesterId]);

  // Live final score = base + merit - demerit + adjustment, clamped 0..100
  const liveFinal = preview
    ? Math.max(0, Math.min(100,
        Math.round((preview.existing?.baseScore ?? 100) + preview.aggregate.meritPoints - preview.aggregate.demeritPoints + Number(adjustment || 0))))
    : null;

  async function handleSave(status) {
    if (!comment.trim()) { setErrorMsg("Đánh giá hạnh kiểm phải có nhận xét"); return; }
    setSaving(true);
    setErrorMsg("");
    try {
      await behaviourApi.evaluateConduct({
        studentId: student.studentId,
        semesterId,
        adjustment: Number(adjustment) || 0,
        comment: comment.trim(),
        status,
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
            <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>Đánh giá hạnh kiểm</h3>
            <p className="text-xs text-slate-500">{student.studentName} · {student.studentCode}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ) : preview && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl px-3 py-3 text-center" style={{ backgroundColor: "#ECFDF5" }}>
                  <p className="text-xs text-slate-500">Điểm thưởng</p>
                  <p className="text-lg font-bold" style={{ color: "#16A34A" }}>+{preview.aggregate.meritPoints}</p>
                </div>
                <div className="rounded-xl px-3 py-3 text-center" style={{ backgroundColor: "#FEF2F2" }}>
                  <p className="text-xs text-slate-500">Điểm trừ</p>
                  <p className="text-lg font-bold" style={{ color: "#DC2626" }}>-{preview.aggregate.demeritPoints}</p>
                </div>
                <div className="rounded-xl px-3 py-3 text-center" style={{ backgroundColor: "#FFF7F2" }}>
                  <p className="text-xs text-slate-500">Hạnh kiểm</p>
                  <p className="text-lg font-bold" style={{ color: GRADE_COLOR[preview.computed.grade.key] }}>{liveFinal}</p>
                </div>
              </div>

              <p className="text-center text-sm font-semibold" style={{ color: GRADE_COLOR[preview.computed.grade.key] }}>
                Xếp loại: {preview.computed.grade.label}
              </p>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Điều chỉnh thủ công (±)</label>
                <input type="number" step="1" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} className={inputCls} />
                <p className="mt-1 text-xs text-slate-400">Cộng/trừ thêm vào điểm hạnh kiểm tự động tính.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Nhận xét <span className="text-red-500">*</span></label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                  placeholder="Nhận xét hạnh kiểm học sinh (bắt buộc)..." className={`${inputCls} resize-none`} />
              </div>

              {preview.existing && (
                <p className="text-xs text-slate-400">
                  Trạng thái hiện tại: {preview.existing.status === "APPROVED" ? "Đã duyệt" : "Nháp"} · cập nhật {preview.existing.updatedAt}
                </p>
              )}

              {errorMsg && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <button type="button" onClick={() => handleSave("DRAFT")} disabled={saving || loading}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            Lưu nháp
          </button>
          <button type="button" onClick={() => handleSave("APPROVED")} disabled={saving || loading}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50" style={{ backgroundColor: "#16A34A" }}>
            {saving ? "Đang lưu..." : "Duyệt đánh giá"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConductEvaluationModal;
