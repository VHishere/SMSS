import { useMemo, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";

import { parentApi } from "../../api/client";

/**
 * contacts: { students: [...], teachers: [...] }
 * onStarted(conversationId)
 */
function NewParentConversationModal({ contacts, onClose, onStarted }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const teachers = useMemo(() => {
    const map = new Map();

    (contacts.teachers ?? []).forEach((t) => {
      if (!map.has(t.teacherUserId)) {
        map.set(t.teacherUserId, { ...t, subjects: [], students: [] });
      }
      const entry = map.get(t.teacherUserId);
      if (t.subjectName && !entry.subjects.includes(t.subjectName)) entry.subjects.push(t.subjectName);
      if (t.studentName && !entry.students.includes(t.studentName)) entry.students.push(t.studentName);
    });

    return Array.from(map.values());
  }, [contacts]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;

    return teachers.filter((t) =>
      `${t.teacherName} ${t.subjects.join(" ")} ${t.students.join(" ")}`.toLowerCase().includes(q));
  }, [teachers, search]);

  async function start(teacherUserId) {
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await parentApi.startConversation(teacherUserId);
      onStarted(res.data.conversationId);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>Soạn tin nhắn mới</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="px-6 pt-4">
          <div className="mb-3 flex items-center rounded-lg border border-slate-200 px-2.5">
            <FiSearch size={15} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm giáo viên..." className="w-full px-2 py-2 text-sm outline-none" />
          </div>
          {errorMsg && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Không tìm thấy giáo viên.</p>
          ) : (
            <div className="space-y-1.5">
              {list.map((t) => {
                const roleLabel = t.roleInClass === "HOMEROOM_TEACHER" ? "GVCN" : "GV bộ môn";
                const subtitle = [roleLabel, t.subjects.join(", "), t.students.length ? `HS: ${t.students.join(", ")}` : ""]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <button key={t.teacherUserId} type="button" disabled={busy}
                    onClick={() => start(t.teacherUserId)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#FFF7F2] disabled:opacity-50" style={{ border: "1px solid #FFE7D6" }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0F2747]">{t.teacherName}</p>
                      <p className="truncate text-xs text-slate-400">{subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewParentConversationModal;
