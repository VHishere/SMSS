import { useState } from "react";

import { studentApi } from "../../api/client";
import PrettySelect from "../molecules/PrettySelect";

function Ms({ name, className = "", style }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}

function toLocalDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function todayLocal() {
  const pad = (value) => String(value).padStart(2, "0");
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function StudentGoalFormModal({
  mode = "create",
  goal = null,
  goalTypes = [],
  onClose,
  onSaved,
}) {
  const isEdit = mode === "edit";
  const initialTargetDate = toLocalDate(goal?.targetDate);

  const [goalType, setGoalType] = useState(
    goal?.goalType ?? goalTypes[0]?.key ?? "ACADEMIC",
  );
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [targetDate, setTargetDate] = useState(initialTargetDate);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function validate() {
    if (!title.trim()) return "Tiêu đề mục tiêu là bắt buộc";
    if (title.trim().length > 255) return "Tiêu đề không được vượt quá 255 ký tự";
    if (!goalType) return "Loại mục tiêu là bắt buộc";
    if (!targetDate) return "Hạn hoàn thành là bắt buộc";

    const unchangedLegacyDate = isEdit && targetDate === initialTargetDate;
    if (targetDate < todayLocal() && !unchangedLegacyDate) {
      return "Hạn hoàn thành phải từ hôm nay trở đi";
    }

    return "";
  }

  async function handleSubmit() {
    const validationMessage = validate();

    if (validationMessage) {
      setErrorMsg(validationMessage);
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const body = {
        goalType,
        title: title.trim(),
        description: description.trim() || null,
        targetDate,
      };

      if (isEdit) {
        await studentApi.updateMyGoal(goal.goalId, body);
      } else {
        await studentApi.createMyGoal(body);
      }

      onSaved?.();
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[#DFC0B2] bg-white px-3 py-2.5 text-sm text-[#1A1C1C] outline-none transition focus:border-[#225DAD] focus:ring-1 focus:ring-[#225DAD]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-xl"
        style={{ border: "1px solid #DFC0B2" }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #DFC0B2" }}
        >
          <div>
            <h3 className="text-base font-bold text-[#0F2747]">
              {isEdit ? "Chỉnh sửa mục tiêu" : "Tạo mục tiêu mới"}
            </h3>
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

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Loại mục tiêu <span className="text-red-500">*</span>
            </label>
            <PrettySelect
              value={goalType}
              onChange={(event) => setGoalType(event.target.value)}
              className={inputClass}
            >
              {goalTypes.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </PrettySelect>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Tiêu đề <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              maxLength={255}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Cải thiện điểm Toán trong học kỳ này"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Mô tả
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Mô tả kế hoạch hoặc điều bạn muốn đạt được..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Hạn hoàn thành <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={targetDate}
              min={isEdit && initialTargetDate < todayLocal() ? undefined : todayLocal()}
              onChange={(event) => setTargetDate(event.target.value)}
              className={inputClass}
            />
          </div>

          {errorMsg && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
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
            className="flex-1 rounded-full bg-[#F27123] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo mục tiêu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StudentGoalFormModal;
