import { useState } from "react";

import { goalApi } from "../../api/client";

function Ms({ name, className = "", style }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

function GoalCommentModal({ goal, onClose, onSaved }) {
  const [comment, setComment] = useState(goal?.teacherRemark ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit() {
    const normalizedComment = comment.trim();

    if (!normalizedComment) {
      setErrorMsg("Vui lòng nhập nhận xét cho mục tiêu");
      return;
    }

    if (normalizedComment.length > 2000) {
      setErrorMsg("Nhận xét không được vượt quá 2000 ký tự");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      await goalApi.comment(goal.goalId, normalizedComment);
      onSaved?.();
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-3xl bg-white shadow-xl"
        style={{ border: "1px solid #DFC0B2" }}
      >
        <div
          className="flex items-start justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #DFC0B2" }}
        >
          <div className="min-w-0 pr-4">
            <h3 className="text-base font-bold text-[#1A1C1C]">
              Nhận xét mục tiêu
            </h3>
            <p className="mt-1 truncate text-xs text-slate-500">
              {goal?.studentName ? `${goal.studentName} · ` : ""}{goal?.title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 transition hover:text-slate-600 disabled:opacity-50"
            aria-label="Đóng"
          >
            <Ms name="close" className="!text-[20px]" />
          </button>
        </div>

        <div className="px-6 py-5">

          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Nhận xét của GVCN <span className="text-red-500">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Nhập góp ý, định hướng hoặc lời khuyên cho học sinh..."
            className="w-full resize-none rounded-xl border border-[#DFC0B2] px-3 py-2.5 text-sm text-[#1A1C1C] outline-none transition focus:border-[#225DAD] focus:ring-1 focus:ring-[#225DAD]"
          />
          <div className="mt-1 flex justify-end text-[10px] text-slate-400">
            {comment.length}/2000
          </div>

          {errorMsg && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
              {errorMsg}
            </p>
          )}
        </div>

        <div
          className="flex gap-3 px-6 py-4"
          style={{ borderTop: "1px solid #DFC0B2" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-full border border-[#DFC0B2] py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-full bg-[#225DAD] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : goal?.teacherRemark ? "Cập nhật nhận xét" : "Lưu nhận xét"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoalCommentModal;
