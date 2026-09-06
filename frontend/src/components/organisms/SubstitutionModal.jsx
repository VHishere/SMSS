import { useMemo, useState } from "react";
import PrettySelect from "../molecules/PrettySelect";

import { timetableApi } from "../../api/client";

const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", surfaceLow: "#F3F3F3" };
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
const WD = { 2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5", 6: "Thứ 6", 7: "Thứ 7", 8: "Chủ nhật" };

// DB day_of_week: 2=Mon … 7=Sat, 8=Sun → JS getDay: Mon=1…Sat=6, Sun=0
function nextDateForDow(dbDow) {
  const jsDow = dbDow === 8 ? 0 : dbDow - 1;
  const d = new Date();
  const diff = (jsDow - d.getDay() + 7) % 7; // 0 = today
  d.setDate(d.getDate() + diff);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function lessonLabel(l) {
  return `${l.subjectName} · Tiết ${l.periodNo} (${l.startTime}${l.endTime ? `-${l.endTime}` : ""}) · ${WD[l.dayOfWeek] ?? ""}`;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function canTeachSelectedLesson(candidate, lesson) {
  if (!lesson) return true;
  const subjectId = Number(lesson.subjectId);
  if (subjectId && candidate.subjectIds?.map(Number).includes(subjectId)) return true;
  const specialize = normalizeText(candidate.subjectSpecialize);
  const subjectName = normalizeText(lesson.subjectName);
  const subjectCode = normalizeText(lesson.subjectCode);
  if (!specialize) return false;
  return specialize === subjectName
    || specialize === subjectCode;
}

/**
 * lessons: structured [{ timetableId, subjectName, periodNo, startTime, endTime, dayOfWeek, className, roomName }]
 * candidates: [{ teacherId, name, subjectSpecialize }]
 */
function SubstitutionModal({ lessons = [], candidates = [], initialTimetableId, initialMode = "SPECIFIC", initialTeacherId, onClose, onSaved }) {
  const [timetableId, setTimetableId] = useState(String(initialTimetableId ?? lessons[0]?.timetableId ?? ""));
  const [mode, setMode] = useState(initialMode); // "SPECIFIC" | "BOARD"
  const [teacherId, setTeacherId] = useState(initialTeacherId ? String(initialTeacherId) : "");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const selectedLesson = lessons.find((l) => String(l.timetableId) === String(timetableId));
  const compatibleCandidates = useMemo(
    () => candidates.filter((c) => canTeachSelectedLesson(c, selectedLesson)),
    [candidates, selectedLesson],
  );
  const filteredCandidates = useMemo(
    () => compatibleCandidates.filter((c) =>
      normalizeText(c.name).includes(normalizeText(teacherSearch)),
    ),
    [compatibleCandidates, teacherSearch],
  );

  async function handleSubmit() {
    if (!timetableId) { setErrorMsg("Vui lòng chọn ca dạy"); return; }
    if (mode === "SPECIFIC" && !teacherId) { setErrorMsg("Chọn giáo viên bạn muốn nhờ dạy thay"); return; }
    if (!selectedLesson) { setErrorMsg("Ca dạy không hợp lệ"); return; }
    if (!reason.trim()) { setErrorMsg("Vui lòng nhập lý do đổi tiết"); return; }
    if (mode === "SPECIFIC" && !compatibleCandidates.some((c) => String(c.teacherId) === String(teacherId))) {
      setErrorMsg("Giáo viên được chọn không cùng chuyên môn với tiết học này");
      return;
    }

    setBusy(true); setErrorMsg("");
    try {
      await timetableApi.createSubstitution({
        timetableId: Number(timetableId),
        requestType: "SUBSTITUTE",
        targetDate: selectedLesson.lessonDate || nextDateForDow(selectedLesson.dayOfWeek),
        substituteTeacherId: mode === "SPECIFIC" ? Number(teacherId) : null,
        swapTimetableId: null,
        reason: reason.trim(),
      });
      onSaved();
    } catch (err) { setErrorMsg(err.message); } finally { setBusy(false); }
  }

  const inputCls = "w-full rounded-xl border border-[#DFC0B2] px-3 py-2.5 text-sm text-[#1A1C1C] outline-none focus:ring-1 focus:ring-[#00458E]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-xl" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h3 className="flex items-center gap-2 text-base font-bold" style={{ color: C.onSurface }}><Ms name="swap_horiz" style={{ color: C.orange }} /> Tạo yêu cầu đổi ca mới</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Bước 1 */}
          <div>
            <label className="mb-1.5 block text-sm font-bold" style={{ color: C.onSurface }}>Bước 1: Chọn ca dạy của bạn muốn đổi</label>
            <PrettySelect
              value={timetableId}
              onChange={(e) => {
                setTimetableId(e.target.value);
                setTeacherId("");
              }}
              className={inputCls}
            >
              {lessons.length === 0 && <option value="">Chưa có tiết dạy</option>}
              {lessons.map((l) => <option key={l.timetableId} value={l.timetableId}>{lessonLabel(l)}</option>)}
            </PrettySelect>
            {selectedLesson && <p className="mt-1 text-xs text-slate-400">Áp dụng cho {WD[selectedLesson.dayOfWeek]} gần nhất · Phòng {selectedLesson.roomName ?? "—"} · {selectedLesson.className}</p>}
          </div>

          {/* Bước 2 */}
          <div>
            <label className="mb-1.5 block text-sm font-bold" style={{ color: C.onSurface }}>Bước 2: Chọn hình thức đổi</label>
            <div className="grid grid-cols-2 gap-2">
              {[["SPECIFIC", "Đổi với giáo viên cụ thể"], ["BOARD", "Đăng yêu cầu chung"]].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setMode(val)} className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors"
                  style={mode === val ? { borderColor: C.orange, backgroundColor: "rgba(242,113,35,0.08)", color: C.onSurface } : { borderColor: C.border, color: C.muted }}>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: mode === val ? C.orange : C.border }}>{mode === val && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.orange }} />}</span>
                  <span className="text-xs font-medium leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Teacher search (specific) */}
          {mode === "SPECIFIC" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Tìm kiếm đồng nghiệp</label>
              <div className="mb-2 flex items-center rounded-xl border px-3" style={{ borderColor: C.border }}>
                <Ms name="search" className="!text-[18px]" style={{ color: "#94A3B8" }} />
                <input value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} placeholder="Nhập tên giáo viên..." className="w-full bg-transparent px-2 py-2.5 text-sm outline-none" style={{ color: C.onSurface }} />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {filteredCandidates.length === 0 ? <p className="px-1 py-2 text-xs text-slate-400">Không có đồng nghiệp phù hợp.</p> : filteredCandidates.map((c) => (
                  <button key={c.teacherId} type="button" onClick={() => setTeacherId(String(c.teacherId))} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors"
                    style={String(teacherId) === String(c.teacherId) ? { backgroundColor: "rgba(242,113,35,0.1)", color: C.orange } : { color: C.onSurface }}>
                    <span>{c.name}{c.subjectSpecialize ? <span className="text-xs text-slate-400"> · {c.subjectSpecialize}</span> : ""}</span>
                    {String(teacherId) === String(c.teacherId) && <Ms name="check_circle" className="!text-[18px]" style={{ color: C.orange }} />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mode === "BOARD" && (
            <p className="rounded-2xl px-3 py-2 text-xs" style={{ backgroundColor: "rgba(34,93,173,0.08)", color: C.secondary }}>Yêu cầu sẽ được gửi tới quản lý để sắp xếp người dạy thay.</p>
          )}

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Lý do đổi tiết</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Nhập lý do của bạn..." className={`${inputCls} resize-none`} />
          </div>

          {errorMsg && <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-[#F3F3F3] disabled:opacity-50">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={busy || !lessons.length} className="rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
            {busy ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubstitutionModal;
