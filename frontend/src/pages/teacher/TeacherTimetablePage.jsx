import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiPlus, FiRepeat, FiX } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import WeeklyTimetable from "../../components/organisms/WeeklyTimetable";
import SubstitutionModal from "../../components/organisms/SubstitutionModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { timetableApi } from "../../api/client";
import { formatDateVN } from "../../utils/datetime";

const TABS = [
  { key: "schedule", label: "Thời khóa biểu", icon: FiCalendar },
  { key: "swap", label: "Đổi tiết", icon: FiRepeat },
];
const REQ_TYPE = { SUBSTITUTE: "Dạy thay", SWAP: "Hoán đổi", CANCEL: "Xin nghỉ" };
const SUB_STATUS = {
  PENDING: { label: "Chờ duyệt", bg: "#FFFBEB", text: "#F59E0B" },
  APPROVED: { label: "Đã duyệt", bg: "#ECFDF5", text: "#16A34A" },
  REJECTED: { label: "Từ chối", bg: "#FEF2F2", text: "#DC2626" },
  CANCELLED: { label: "Đã hủy", bg: "#F1F5F9", text: "#475569" },
};
const WD = { 2: "Thứ 2", 3: "Thứ 3", 4: "Thứ 4", 5: "Thứ 5", 6: "Thứ 6", 7: "Thứ 7", 8: "CN" };

function TeacherTimetablePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("schedule");
  const [tt, setTt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [subs, setSubs] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let m = true; setLoading(true); setError("");
    timetableApi.getMyTimetable().then((res) => { if (m) setTt(res.data); }).catch((e) => { if (m) setError(e.message); }).finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, []);

  useEffect(() => {
    if (tab !== "swap") return;
    let m = true;
    timetableApi.listSubstitutions({ limit: 50 }).then((res) => { if (m) setSubs(res.data); }).catch(() => {});
    return () => { m = false; };
  }, [tab, refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: tt?.context?.fullName ?? user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [tt, user]);

  async function cancel(id) {
    if (!window.confirm("Hủy yêu cầu này?")) return;
    try { await timetableApi.cancelSubstitution(id); setRefresh((k) => k + 1); } catch (e) { alert(e.message); }
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Thời khóa biểu" sidebarFooterValue="Tuần này">
      <section className="mb-6 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Thời khóa biểu</h1>
      </section>

      <div className="mb-6 flex gap-1 rounded-2xl border border-[#FFE7D6] bg-white p-1 shadow-sm">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)} className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition" style={tab === key ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
            <Icon size={15} /><span>{label}</span>
          </button>
        ))}
      </div>

      {tab === "schedule" && (
        <>
          {loading && <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>Đang tải thời khóa biểu...</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {!loading && !error && tt && (
            tt.lessons.length === 0
              ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>Chưa có tiết dạy nào trong thời khóa biểu.</div>
              : <WeeklyTimetable weekDays={tt.weekDays} slots={tt.slots} lessons={tt.lessons} />
          )}
        </>
      )}

      {tab === "swap" && (
        <div>
          <div className="mb-4 flex justify-end">
            <button type="button" onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#F27123" }}>
              <FiPlus size={15} /> Yêu cầu đổi tiết
            </button>
          </div>

          {!subs ? <div className="space-y-2">{[0,1,2].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div> : (
            !subs.items.length ? (
              <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>Chưa có yêu cầu đổi tiết nào.</div>
            ) : (
              <div className="space-y-3">
                {subs.items.map((s) => {
                  const st = SUB_STATUS[s.status] ?? SUB_STATUS.PENDING;
                  return (
                    <div key={s.substitutionId} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>{REQ_TYPE[s.requestType] ?? s.requestType}</span>
                            <span className="text-sm font-bold text-[#0F2747]">{s.subjectName} · {s.className}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {WD[s.dayOfWeek] ?? ""} tiết {s.periodNo} · áp dụng ngày {formatDateVN(s.targetDate)}
                            {s.substituteName ? ` · GV thay: ${s.substituteName}` : ""}
                          </p>
                        </div>
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                      </div>
                      {s.reason && <p className="mt-2 text-sm text-slate-600">{s.reason}</p>}
                      {s.reviewNote && <p className="mt-1 rounded-lg px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: "#FFF7F2" }}><span className="font-semibold">Phản hồi: </span>{s.reviewNote}{s.reviewerName ? ` (${s.reviewerName})` : ""}</p>}
                      {s.status === "PENDING" && (
                        <button type="button" onClick={() => cancel(s.substitutionId)} className="mt-3 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}><FiX size={12} /> Hủy yêu cầu</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {showModal && <SubstitutionModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); setRefresh((k) => k + 1); }} />}
    </DashboardShell>
  );
}

export default TeacherTimetablePage;
