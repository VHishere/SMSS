import { useState } from "react";
import { FiCheckCircle, FiX, FiXCircle } from "react-icons/fi";

import { teacherApi } from "../../api/client";

/**
 * Shared modal for approving or rejecting a leave request.
 * decision: 'APPROVE' | 'REJECT'
 */
function LeaveDecisionModal({ request, decision, onClose, onDone }) {
  const [comment,  setComment]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isApprove = decision === "APPROVE";

  const config = isApprove
    ? {
        title:       "Duyệt đơn xin nghỉ",
        label:       "Ghi chú duyệt đơn",
        placeholder: "Nhập ghi chú khi duyệt đơn (bắt buộc)...",
        color:       "#16A34A",
        icon:        FiCheckCircle,
        button:      "Xác nhận duyệt",
      }
    : {
        title:       "Từ chối đơn xin nghỉ",
        label:       "Lý do từ chối",
        placeholder: "Nhập lý do từ chối đơn (bắt buộc)...",
        color:       "#DC2626",
        icon:        FiXCircle,
        button:      "Xác nhận từ chối",
      };

  async function handleSubmit() {
    if (!comment.trim()) {
      setErrorMsg(
        isApprove ? "Vui lòng nhập ghi chú duyệt đơn." : "Vui lòng nhập lý do từ chối.",
      );
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      await teacherApi.decideLeaveRequest(request.leaveRequestId, {
        decision,
        comment: comment.trim(),
      });
      onDone(decision);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        style={{ border: "1px solid #FFE7D6" }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: isApprove ? "#ECFDF5" : "#FEF2F2" }}
            >
              <Icon size={20} style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>
                {config.title}
              </h3>
              <p className="text-xs text-slate-500">
                {request.studentName} · {request.className ?? "—"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            {config.label} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={config.placeholder}
            rows={4}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
          />
        </div>

        {errorMsg && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {errorMsg}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: config.color }}
          >
            {saving ? "Đang xử lý..." : config.button}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveDecisionModal;
