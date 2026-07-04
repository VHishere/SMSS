import { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";

import { homeworkApi } from "../../api/client";
import FileUploadField from "../molecules/FileUploadField";

// Convert backend 'YYYY-MM-DD HH:mm' → datetime-local 'YYYY-MM-DDTHH:mm'
function toLocalInput(value) {
  if (!value) return "";
  return value.replace(" ", "T").slice(0, 16);
}

function nowLocalInput() {
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function assignmentKey(a) {
  return `${a.classId}::${a.subjectId}`;
}

/**
 * mode: "create" | "edit"
 * - create: pick one or more (class+subject) assignments, attach files.
 * - edit:   class/subject fixed; edit fields, manage attachments, close.
 */
function HomeworkFormModal({ mode, assignments = [], homework = null, onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [title,        setTitle]        = useState(homework?.title ?? "");
  const [description,  setDescription]  = useState(homework?.description ?? "");
  const [instructions, setInstructions] = useState(homework?.instructions ?? "");
  const [dueDate,      setDueDate]      = useState(toLocalInput(homework?.dueDate));
  const [maxScore,     setMaxScore]     = useState(homework?.maxScore ?? 10);
  const [status,       setStatus]       = useState(homework?.status ?? "OPEN");

  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [attachments,  setAttachments]  = useState(homework?.attachments ?? []);

  const [saving,   setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isEdit && homework) {
      setAttachments(homework.attachments ?? []);
    }
  }, [isEdit, homework]);

  // Group assignments by class for a readable picker
  const groupedByClass = useMemo(() => {
    const map = {};
    for (const a of assignments) {
      if (!map[a.classId]) {
        map[a.classId] = { classId: a.classId, className: a.className, gradeName: a.gradeName, subjects: [] };
      }
      map[a.classId].subjects.push(a);
    }
    return Object.values(map);
  }, [assignments]);

  function toggleAssignment(a) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const key = assignmentKey(a);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleRemovePersistedAttachment(item) {
    // Only meaningful in edit mode on a saved homework
    if (isEdit && homework?.homeworkId) {
      try {
        await homeworkApi.deleteAttachment(homework.homeworkId, item.attachmentId);
        setAttachments((prev) => prev.filter((v) => v.attachmentId !== item.attachmentId));
      } catch (err) {
        setErrorMsg(err.message);
      }
    } else {
      setAttachments((prev) => prev.filter((v) => v.attachmentId !== item.attachmentId));
    }
  }

  function validate() {
    if (!title.trim()) return "Tiêu đề bài tập là bắt buộc";
    if (!dueDate) return "Hạn nộp là bắt buộc";
    if (!isEdit && new Date(dueDate).getTime() <= Date.now()) return "Hạn nộp phải sau thời điểm hiện tại";
    const ms = Number(maxScore);
    if (!Number.isFinite(ms) || ms <= 0) return "Điểm tối đa phải lớn hơn 0";
    if (ms > 100) return "Điểm tối đa không được vượt quá 100";
    if (!isEdit && selectedKeys.size === 0) return "Phải chọn ít nhất một lớp để giao bài";
    return "";
  }

  async function handleSubmit() {
    const v = validate();
    if (v) {
      setErrorMsg(v);
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      if (isEdit) {
        await homeworkApi.update(homework.homeworkId, {
          title, description, instructions, dueDate,
          maxScore: Number(maxScore), status,
        });
      } else {
        const selected = assignments.filter((a) => selectedKeys.has(assignmentKey(a)));
        await homeworkApi.create({
          title, description, instructions, dueDate,
          maxScore: Number(maxScore),
          assignments: selected.map((a) => ({ classId: a.classId, subjectId: a.subjectId })),
          attachmentIds: attachments.map((x) => x.attachmentId),
        });
      }
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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        style={{ border: "1px solid #FFE7D6" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>
            {isEdit ? "Chỉnh sửa bài tập" : "Tạo bài tập mới"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Class/subject picker (create only) */}
          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Giao cho lớp / môn <span className="text-red-500">*</span>
              </label>
              {groupedByClass.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                  Bạn chưa được phân công dạy lớp/môn nào.
                </p>
              ) : (
                <div className="space-y-2">
                  {groupedByClass.map((cls) => (
                    <div key={cls.classId} className="rounded-xl p-3" style={{ border: "1px solid #FFE7D6" }}>
                      <p className="mb-2 text-sm font-semibold" style={{ color: "#0F2747" }}>
                        {cls.className}
                        <span className="ml-1 text-xs font-normal text-slate-400">· {cls.gradeName}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {cls.subjects.map((a) => {
                          const active = selectedKeys.has(assignmentKey(a));
                          return (
                            <button
                              key={assignmentKey(a)}
                              type="button"
                              onClick={() => toggleAssignment(a)}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
                              style={
                                active
                                  ? { backgroundColor: "#08509F", color: "#fff" }
                                  : { backgroundColor: "#F8FAFC", color: "#475569", border: "1px solid #E2E8F0" }
                              }
                            >
                              {a.subjectName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isEdit && (
            <div className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>
              <span className="font-medium text-[#0F2747]">{homework.className}</span>
              <span className="ml-2 text-slate-500">· {homework.subjectName}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Tiêu đề <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Bài tập hàm số bậc hai"
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Mô tả ngắn về bài tập..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Hướng dẫn làm bài</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Hướng dẫn chi tiết cho học sinh..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Due date + max score */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Hạn nộp <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                min={!isEdit ? nowLocalInput() : undefined}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Điểm tối đa <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Status (edit only) */}
          {isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Trạng thái</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                <option value="OPEN">Đang mở</option>
                <option value="CLOSED">Đóng bài tập</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Sau khi đóng, bài tập sẽ không thể chỉnh sửa.
              </p>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tệp đính kèm</label>
            <FileUploadField
              value={attachments}
              onChange={setAttachments}
              onRemove={isEdit ? handleRemovePersistedAttachment : undefined}
            />
          </div>

          {errorMsg && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>
          )}
        </div>

        {/* Footer */}
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
            style={{ backgroundColor: "#F27123" }}
          >
            {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo bài tập"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomeworkFormModal;
