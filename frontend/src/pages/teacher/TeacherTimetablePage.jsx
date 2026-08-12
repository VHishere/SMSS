import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "../../components/templates/DashboardShell";
import WeeklyTimetable from "../../components/organisms/WeeklyTimetable";
import SubstitutionModal from "../../components/organisms/SubstitutionModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { timetableApi } from "../../api/client";
import { formatDateVN } from "../../utils/datetime";

const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8" };
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
function initials(n) { const p = (n || "").trim().split(/\s+/); return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?"; }

const TABS = [
  { key: "schedule", label: "Thời khóa biểu", ms: "calendar_month" },
  { key: "swap", label: "Đổi ca hỗ trợ", ms: "swap_horiz" },
];
const SUBTABS = [
  { key: "create", label: "Tạo yêu cầu đổi ca" },
  { key: "processing", label: "Đang xử lý" },
  { key: "history", label: "Lịch sử" },
];
const REQ_TYPE = { SUBSTITUTE: "Dạy thay", SWAP: "Hoán đổi", CANCEL: "Nhờ sắp xếp" };
const SUB_STATUS = {
  PENDING: { label: "Chờ duyệt", bg: "#FFFBEB", text: "#B45309" },
  APPROVED: { label: "Đã duyệt", bg: "#DCFCE7", text: "#15803D" },
  REJECTED: { label: "Từ chối", bg: "#FFDAD6", text: "#93000A" },
  CANCELLED: { label: "Đã hủy", bg: "#F1F5F9", text: "#475569" },
};
const WD = { 2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5", 6: "Thứ 6", 7: "Thứ 7", 8: "Chủ nhật" };
const AVA = ["#00458E", "#225DAD", "#4A5F82", "#F27123"];

function TeacherTimetablePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("schedule");
  const [subTab, setSubTab] = useState("create");
  const [tt, setTt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [meta, setMeta] = useState({ lessons: [], candidates: [] });
  const [subs, setSubs] = useState(null);
  const [modal, setModal] = useState(null); // { initialTimetableId, initialMode, initialTeacherId }
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let mounted = true;
    timetableApi.getMyTimetable()
      .then((res) => { if (mounted) setTt(res.data); })
      .catch((e) => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (tab !== "swap") return;
    let m = true;
    timetableApi.getSubstitutionMeta().then((res) => { if (m) setMeta(res.data); }).catch(() => {});
    timetableApi.listSubstitutions({ limit: 50 }).then((res) => { if (m) setSubs(res.data); }).catch(() => {});
    return () => { m = false; };
  }, [tab, refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: tt?.context?.fullName ?? user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [tt, user]);

  const myLessons = tt?.lessons ?? [];
  const items = subs?.items ?? [];
  const processing = items.filter((s) => s.status === "PENDING");
  const history = items.filter((s) => ["APPROVED", "REJECTED", "CANCELLED"].includes(s.status));

  async function cancel(id) {
    if (!window.confirm("Hủy yêu cầu này?")) return;
    try { await timetableApi.cancelSubstitution(id); setRefresh((k) => k + 1); } catch (e) { alert(e.message); }
  }

  const todayKey = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  function getLessonDate(lesson, day) {
    return lesson?.lessonDate || day?.date || todayKey;
  }

  function canOpenAttendance(lesson, day) {
    return getLessonDate(lesson, day) <= todayKey;
  }

  function openAttendance(lesson, day) {
    if (!lesson || !canOpenAttendance(lesson, day)) return;
    const lessonDate = getLessonDate(lesson, day);
    navigate(
      `/teacher/attendance?tab=roll-call&date=${lessonDate}&timetableId=${lesson.timetableId}`,
    );
  }

  function reqCard(s) {
    const st = SUB_STATUS[s.status] ?? SUB_STATUS.PENDING;
    return (
      <div key={s.substitutionId} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>{REQ_TYPE[s.requestType] ?? s.requestType}</span>
              <span className="text-sm font-bold" style={{ color: C.onSurface }}>{s.subjectName} · {s.className}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {WD[s.dayOfWeek] ?? ""} tiết {s.periodNo} · áp dụng {formatDateVN(s.targetDate)}{s.substituteName ? ` · GV thay: ${s.substituteName}` : ""}
            </p>
          </div>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
        </div>
        {s.reason && <p className="mt-2 text-sm text-slate-600">{s.reason}</p>}
        {s.reviewNote && <p className="mt-1 rounded-2xl px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: C.surfaceLow }}><span className="font-semibold">Phản hồi: </span>{s.reviewNote}{s.reviewerName ? ` (${s.reviewerName})` : ""}</p>}
        {s.status === "PENDING" && (
          <button type="button" onClick={() => cancel(s.substitutionId)} className="mt-3 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "#FFDAD6", color: "#93000A" }}><Ms name="close" className="!text-[14px]" /> Hủy yêu cầu</button>
        )}
      </div>
    );
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Thời khóa biểu" sidebarFooterValue="Tuần này">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>{tab === "swap" ? "Đổi ca hỗ trợ" : "Lịch dạy"}</h1>
      <section className="mb-6 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Thời khóa biểu</h1>
      </section>

      <div className="mb-6 flex w-fit gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
        {TABS.map(({ key, label, ms }) => (
          <button key={key} type="button" onClick={() => setTab(key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all" style={tab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
            <Ms name={ms} className="!text-[18px]" /><span>{label}</span>
          </button>
        ))}
      </div>

      {tab === "schedule" && (
        <>
          {loading && <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Đang tải thời khóa biểu...</div>}
          {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {!loading && !error && tt && (
            tt.lessons.length === 0
              ? <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Chưa có tiết dạy nào trong thời khóa biểu.</div>
              : (
                <WeeklyTimetable
                  weekDays={tt.weekDays}
                  slots={tt.slots}
                  lessons={tt.lessons}
                  onLessonClick={(lesson, day) => openAttendance(lesson, day)}
                  getLessonActionLabel={(lesson, day) =>
                    canOpenAttendance(lesson, day) ? "Mở điểm danh" : undefined
                  }
                />
              )
          )}
        </>
      )}

      {tab === "swap" && (
        <>
          {/* Sub-tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            {SUBTABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setSubTab(t.key)} className="rounded-full px-4 py-2 text-sm transition-all"
                style={subTab === t.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { backgroundColor: C.surfaceHigh, color: C.muted, fontWeight: 500 }}>
                {t.label}
              </button>
            ))}
          </div>

          {subTab === "create" && (
            <div className="grid grid-cols-12 gap-6">
              {/* Left: CTA + my shifts */}
              <div className="col-span-12 space-y-4 lg:col-span-4">
                <div className="rounded-3xl p-5" style={{ backgroundColor: C.orange }}>
                  <button type="button" onClick={() => setModal({})} className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-dashed border-white/60 py-3 font-bold text-white transition-colors hover:bg-white/10">
                    <Ms name="add_circle" className="!text-[20px]" /> Tạo yêu cầu đổi ca
                  </button>
                </div>
                <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between border-b p-4" style={{ borderColor: C.border }}>
                    <h3 className="font-bold" style={{ color: C.onSurface }}>Ca của tôi</h3>
                    <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.orange }}>{myLessons.length} ca</span>
                  </div>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
                    {myLessons.length === 0 ? <p className="p-4 text-center text-sm text-slate-400">Chưa có tiết dạy.</p> : myLessons.map((l) => (
                      <button key={l.timetableId} type="button" onClick={() => setModal({ initialTimetableId: l.timetableId })} className="w-full rounded-2xl border p-3 text-left transition-colors hover:border-[#F27123]" style={{ borderColor: C.border }}>
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: C.surfaceHigh, color: C.muted }}>{l.subjectName}</span>
                        <p className="mt-1.5 flex items-center gap-1 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="schedule" className="!text-[14px]" style={{ color: C.orange }} /> {WD[l.dayOfWeek]} · Tiết {l.periodNo} ({l.startTime}{l.endTime ? `-${l.endTime}` : ""})</p>
                        <p className="text-xs text-slate-400">Phòng {l.roomName ?? "—"} · {l.className}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: colleagues who can cover */}
              <div className="col-span-12 lg:col-span-8">
                <h3 className="mb-4 font-bold" style={{ color: C.onSurface }}>Đồng nghiệp có thể nhận dạy thay</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {meta.candidates.map((c, i) => (
                    <div key={c.teacherId} className="flex flex-col rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: AVA[i % AVA.length] }}>{initials(c.name)}</div>
                          <div><p className="text-sm font-bold" style={{ color: C.onSurface }}>{c.name}</p><p className="text-xs text-slate-400">{c.subjectSpecialize ?? "Giáo viên"}</p></div>
                        </div>
                        <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>Có thể nhận</span>
                      </div>
                      <button type="button" onClick={() => setModal({ initialMode: "SPECIFIC", initialTeacherId: c.teacherId })} className="mt-auto flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: C.orange }}>
                        Đề nghị dạy thay <Ms name="arrow_forward" className="!text-[16px]" />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center" style={{ borderColor: C.border }}>
                    <Ms name="campaign" className="!text-[28px]" style={{ color: C.border }} />
                    <p className="mb-2 mt-1 text-sm text-slate-400">Không tìm thấy người phù hợp?</p>
                    <button type="button" onClick={() => setModal({ initialMode: "BOARD" })} className="rounded-full border px-4 py-1.5 text-xs font-bold" style={{ borderColor: C.orange, color: C.orange }}>Đăng yêu cầu chung</button>
                  </div>
                </div>
                {meta.candidates.length === 0 && <p className="mt-3 text-xs text-slate-400">Chưa có đồng nghiệp khả dụng — bạn vẫn có thể “Đăng yêu cầu chung” để quản lý sắp xếp.</p>}
              </div>
            </div>
          )}

          {subTab === "processing" && (
            !subs ? <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-20 animate-pulse rounded-3xl bg-slate-100" />)}</div>
              : processing.length === 0 ? <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Không có yêu cầu đang chờ xử lý.</div>
                : <div className="space-y-3">{processing.map(reqCard)}</div>
          )}

          {subTab === "history" && (
            !subs ? <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-20 animate-pulse rounded-3xl bg-slate-100" />)}</div>
              : history.length === 0 ? <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Chưa có lịch sử đổi ca.</div>
                : <div className="space-y-3">{history.map(reqCard)}</div>
          )}
        </>
      )}

      {modal && (
        <SubstitutionModal
          lessons={myLessons}
          candidates={meta.candidates}
          initialTimetableId={modal.initialTimetableId}
          initialMode={modal.initialMode}
          initialTeacherId={modal.initialTeacherId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setRefresh((k) => k + 1); setSubTab("processing"); }}
        />
      )}
    </DashboardShell>
  );
}

export default TeacherTimetablePage;
