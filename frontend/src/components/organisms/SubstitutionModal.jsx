import { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";

import { timetableApi } from "../../api/client";

const TYPES = [
  { value: "SUBSTITUTE", label: "Nhờ dạy thay" },
  { value: "SWAP", label: "Hoán đổi tiết" },
  { value: "CANCEL", label: "Xin nghỉ tiết" },
];

function todayLocal() {
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function SubstitutionModal({ onClose, onSaved }) {
  const [meta, setMeta] = useState({ lessons: [], candidates: [] });
  const [timetableId, setTimetableId] = useState("");
  const [requestType, setRequestType] = useState("SUBSTITUTE");
  const [targetDate, setTargetDate] = useState("");
  const [substituteTeacherId, setSubstituteTeacherId] = useState("");
  const [swapTimetableId, setSwapTimetableId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let m = true;
    timetableApi.getSubstitutionMeta().then((res) => {
      if (!m) return;
      setMeta(res.data);
      if (res.data.lessons[0]) setTimetableId(String(res.data.lessons[0].timetableId));
    }).catch((e) => setErrorMsg(e.message));
    return () => { m = false; };
  }, []);

  const swapOptions = useMemo(
    () => meta.lessons.filter((l) => String(l.timetableId) !== String(timetableId)),
    [meta.lessons, timetableId],
  );

  async function handleSubmit() {
    if (!timetableId) { setErrorMsg("Chọn tiết học"); return; }
    if (!targetDate) { setErrorMsg("Chọn ngày áp dụng"); return; }
    if (targetDate < todayLocal()) { setErrorMsg("Ngày áp dụng phải từ hôm nay trở đi"); return; }
    if (!reason.trim()) { setErrorMsg("Vui lòng nhập lý do"); return; }
    if (requestType === "SUBSTITUTE" && !substituteTeacherId) { setErrorMsg("Chọn giáo viên dạy thay"); return; }
    if (requestType === "SWAP" && !swapTimetableId) { setErrorMsg("Chọn tiết để hoán đổi"); return; }

    setBusy(true); setErrorMsg("");
    try {
      await timetableApi.createSubstitution({
        timetableId: Number(timetableId), requestType, targetDate,
        substituteTeacherId: requestType === "SUBSTITUTE" ? Number(substituteTeacherId) : null,
        swapTimetableId: requestType === "SWAP" ? Number(swapTimetableId) : null,
        reason: reason || null,
      });
      onSaved();
    } catch (err) { setErrorMsg(err.message); } finally { setBusy(false); }
  }

  const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>Yêu cầu đổi tiết</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tiết học <span className="text-red-500">*</span></label>
            <select value={timetableId} onChange={(e) => setTimetableId(e.target.value)} className={inputCls}>
              {meta.lessons.length === 0 && <option value="">Chưa có tiết dạy</option>}
              {meta.lessons.map((l) => <option key={l.timetableId} value={l.timetableId}>{l.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Loại yêu cầu</label>
              <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className={inputCls}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Ngày áp dụng <span className="text-red-500">*</span></label>
              <input type="date" value={targetDate} min={todayLocal()} onChange={(e) => setTargetDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {requestType === "SUBSTITUTE" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Giáo viên dạy thay <span className="text-red-500">*</span></label>
              <select value={substituteTeacherId} onChange={(e) => setSubstituteTeacherId(e.target.value)} className={inputCls}>
                <option value="">— Chọn —</option>
                {meta.candidates.map((c) => <option key={c.teacherId} value={c.teacherId}>{c.name}{c.subjectSpecialize ? ` (${c.subjectSpecialize})` : ""}</option>)}
              </select>
            </div>
          )}
          {requestType === "SWAP" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Hoán đổi với tiết <span className="text-red-500">*</span></label>
              <select value={swapTimetableId} onChange={(e) => setSwapTimetableId(e.target.value)} className={inputCls}>
                <option value="">— Chọn —</option>
                {swapOptions.map((l) => <option key={l.timetableId} value={l.timetableId}>{l.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Lý do <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Nêu lý do đổi tiết..." className={`${inputCls} resize-none`} />
          </div>

          {errorMsg && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
            {busy ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubstitutionModal;
