import { useMemo, useState } from "react";
function Ms({ name, className = "", style }) { return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>; }

import { communicationApi } from "../../api/client";

/**
 * contacts: { students: [...], parents: [...] }
 * onStarted(conversationId)
 */
function NewConversationModal({ contacts, onClose, onStarted }) {
  const [tab, setTab] = useState("PARENT"); // PARENT | STUDENT
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (tab === "PARENT") {
      return (contacts.parents ?? []).filter((p) =>
        !q || p.parentName.toLowerCase().includes(q) || (p.studentName ?? "").toLowerCase().includes(q));
    }
    return (contacts.students ?? []).filter((s) =>
      !q || s.studentName.toLowerCase().includes(q) || s.studentCode.toLowerCase().includes(q));
  }, [tab, search, contacts]);

  async function start(target) {
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await communicationApi.startConversation(target);
      onStarted(res.data.conversationId);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-xl" style={{ border: "1px solid #DFC0B2" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #DFC0B2" }}>
          <h3 className="text-base font-bold" style={{ color: "#1A1C1C" }}>Soạn tin nhắn mới</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="px-6 pt-4">
          <div className="mb-3 flex gap-1 rounded-full border border-[#DFC0B2] p-1">
            <button type="button" onClick={() => setTab("PARENT")} className="flex-1 rounded-full py-2 text-sm font-medium transition"
              style={tab === "PARENT" ? { backgroundColor: "#225DAD", color: "#fff" } : { color: "#64748B" }}>Phụ huynh</button>
            <button type="button" onClick={() => setTab("STUDENT")} className="flex-1 rounded-full py-2 text-sm font-medium transition"
              style={tab === "STUDENT" ? { backgroundColor: "#225DAD", color: "#fff" } : { color: "#64748B" }}>Học sinh</button>
          </div>
          <div className="mb-3 flex items-center rounded-full border border-[#DFC0B2] px-3">
            <Ms name="search" className="text-slate-400 !text-[15px]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên..." className="w-full px-2 py-2 text-sm outline-none" />
          </div>
          {errorMsg && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Không tìm thấy liên hệ.</p>
          ) : (
            <div className="flex flex-col gap-[5px]">
              {tab === "PARENT"
                ? list.map((p) => (
                    <button key={`${p.parentUserId}-${p.studentId}`} type="button" disabled={busy}
                      onClick={() => start({ kind: "PARENT", userId: p.parentUserId, studentId: p.studentId })}
                      className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition hover:bg-[#F3F3F3] disabled:opacity-50" style={{ border: "1px solid #DFC0B2" }}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1A1C1C]">{p.parentName}</p>
                        <p className="text-xs text-slate-400">{p.relationship ?? "PH"} của {p.studentName} · {p.className}</p>
                      </div>
                    </button>
                  ))
                : list.map((s) => (
                    <button key={s.studentId} type="button" disabled={busy}
                      onClick={() => start({ kind: "STUDENT", userId: s.studentUserId, studentId: s.studentId })}
                      className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left transition hover:bg-[#F3F3F3] disabled:opacity-50" style={{ border: "1px solid #DFC0B2" }}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1A1C1C]">{s.studentName}</p>
                        <p className="text-xs text-slate-400">{s.studentCode} · {s.className}</p>
                      </div>
                    </button>
                  ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewConversationModal;
