import { useState } from "react";
function Ms({ name, className = "", style }) { return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>; }

import { communicationApi } from "../../api/client";

function GroupConversationModal({ classes, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(classes[0]?.classId ? String(classes[0].classId) : "");
  const [audience, setAudience] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreate() {
    if (!title.trim()) { setErrorMsg("Nhập tên nhóm"); return; }
    if (!classId) { setErrorMsg("Chọn lớp"); return; }
    setBusy(true); setErrorMsg("");
    try {
      const res = await communicationApi.createGroup({ title: title.trim(), classId: Number(classId), audience });
      onCreated(res.data.conversationId);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[#DFC0B2] px-3 py-2.5 text-sm text-[#1A1C1C] outline-none focus:border-[#225DAD] focus:ring-1 focus:ring-[#225DAD]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl" style={{ border: "1px solid #DFC0B2" }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: "#1A1C1C" }}>Tạo nhóm lớp</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tên nhóm</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Thông báo lớp 10B1" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Lớp</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
              {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Thành viên</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputCls}>
              <option value="ALL">Tất cả (phụ huynh + học sinh)</option>
              <option value="PARENTS">Chỉ phụ huynh</option>
              <option value="STUDENTS">Chỉ học sinh</option>
            </select>
          </div>
          {errorMsg && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-[#DFC0B2] py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={handleCreate} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
            {busy ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupConversationModal;
