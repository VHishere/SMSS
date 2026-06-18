import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FiArrowLeft, FiCheckSquare, FiClock, FiEdit3, FiFileText, FiInfo, FiMail, FiPlus, FiRefreshCw,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import MeetingFormModal from "../../components/organisms/MeetingFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { meetingApi } from "../../api/client";

const TABS = [
  { key: "info", label: "Thông tin", icon: FiInfo },
  { key: "minutes", label: "Biên bản", icon: FiFileText },
  { key: "actions", label: "Việc cần làm", icon: FiCheckSquare },
  { key: "log", label: "Nhật ký", icon: FiClock },
];
const MEETING_STATUS = {
  SCHEDULED: { label: "Đã lên lịch", bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED: { label: "Hoàn thành", bg: "#ECFDF5", text: "#16A34A" },
  CANCELLED: { label: "Đã hủy", bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED: { label: "Lưu trữ", bg: "#F1F5F9", text: "#475569" },
};
const INVITE_STATUS = {
  SENT: { label: "Đã gửi", bg: "#EBF3FF", text: "#08509F" },
  PENDING: { label: "Chờ", bg: "#FFFBEB", text: "#F59E0B" },
  ACCEPTED: { label: "Đồng ý", bg: "#ECFDF5", text: "#16A34A" },
  DECLINED: { label: "Từ chối", bg: "#FEF2F2", text: "#DC2626" },
};
const ACTION_STATUS = {
  PENDING: { label: "Chờ", bg: "#F1F5F9", text: "#475569" },
  IN_PROGRESS: { label: "Đang làm", bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED: { label: "Hoàn thành", bg: "#ECFDF5", text: "#16A34A" },
};
const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

function MeetingDetailPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "info";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    meetingApi.getDetail(meetingId)
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [meetingId, refresh]);

  useEffect(() => {
    let m = true;
    meetingApi.getMeta().then((res) => { if (m) setClasses(res.data.classes); }).catch(() => {});
    return () => { m = false; };
  }, []);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  function setTab(key) { setSearchParams({ tab: key }); }
  function refetch() { setRefresh((k) => k + 1); }

  async function changeStatus(status) {
    if (status === "CANCELLED" && !window.confirm("Hủy cuộc họp này?")) return;
    try { await meetingApi.changeStatus(meetingId, status); refetch(); }
    catch (err) { alert(err.message); }
  }

  const meeting = data?.meeting;
  const readOnly = meeting && ["ARCHIVED", "CANCELLED"].includes(meeting.status);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Cuộc họp" sidebarFooterValue={meeting?.className ?? ""}>
      <button type="button" onClick={() => navigate("/teacher/meetings")} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#0F2747]">
        <FiArrowLeft size={15} /> Về danh sách
      </button>

      {loading && <div className="space-y-4"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-64 animate-pulse rounded-2xl bg-slate-100" /></div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && meeting && (
        <>
          {/* Header */}
          <section className="mb-6 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: MEETING_STATUS[meeting.status]?.bg, color: MEETING_STATUS[meeting.status]?.text }}>{MEETING_STATUS[meeting.status]?.label}</span>
                  <span className="text-xs text-slate-400">{meeting.meetingType === "INDIVIDUAL" ? "Họp cá nhân" : "Họp lớp"}</span>
                </div>
                <h1 className="text-2xl font-bold" style={{ color: "#0F2747" }}>{meeting.title}</h1>
                <p className="text-sm text-slate-500">
                  {meeting.meetingDate}{meeting.endTime ? ` – ${meeting.endTime.slice(11)}` : ""} · {meeting.className ?? "—"}{meeting.location ? ` · ${meeting.location}` : ""}{meeting.studentName ? ` · HS: ${meeting.studentName}` : ""}
                </p>
              </div>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  {meeting.status === "SCHEDULED" && <>
                    <button type="button" onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: "#08509F" }}><FiEdit3 size={14} /> Sửa</button>
                    <button type="button" onClick={() => changeStatus("COMPLETED")} className="rounded-xl px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: "#16A34A" }}>Hoàn thành</button>
                    <button type="button" onClick={() => changeStatus("CANCELLED")} className="rounded-xl px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: "#DC2626" }}>Hủy</button>
                  </>}
                  {meeting.status === "COMPLETED" && <button type="button" onClick={() => changeStatus("ARCHIVED")} className="rounded-xl px-3 py-2 text-sm font-medium" style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>Lưu trữ</button>}
                </div>
              )}
            </div>
            {meeting.content && <p className="mt-3 rounded-xl px-4 py-3 text-sm text-slate-600" style={{ backgroundColor: "#FFF7F2" }}>{meeting.content}</p>}
          </section>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition" style={activeTab === key ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
                <Icon size={15} /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6" }}>
            {activeTab === "info" && <InfoTab meetingId={meetingId} meeting={meeting} invitations={data.invitations} readOnly={readOnly} onChanged={refetch} />}
            {activeTab === "minutes" && <MinutesTab meetingId={meetingId} minutes={data.minutes} readOnly={readOnly} onChanged={refetch} />}
            {activeTab === "actions" && <ActionsTab meetingId={meetingId} actions={data.actions} invitations={data.invitations} readOnly={readOnly} onChanged={refetch} />}
            {activeTab === "log" && <LogTab logs={data.logs} />}
          </div>
        </>
      )}

      {showEdit && meeting && (
        <MeetingFormModal mode="edit" classes={classes} meeting={meeting} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); refetch(); }} />
      )}
    </DashboardShell>
  );
}

// ── Info + invitations ────────────────────────────────────────────────────────

function InfoTab({ meetingId, meeting, invitations, readOnly, onChanged }) {
  const [parents, setParents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (!showInvite) return;
    let m = true;
    meetingApi.getClassParents(meeting.classId).then((res) => { if (m) setParents(res.data); }).catch(() => {});
    return () => { m = false; };
  }, [showInvite, meeting.classId]);

  const invitedUserIds = new Set(invitations.map((i) => i.userId));

  async function resend(inv) {
    try { await meetingApi.resendInvitation(meetingId, inv.invitationId, inv.userId); onChanged(); }
    catch (err) { alert(err.message); }
  }
  async function inviteMore() {
    const invitees = [...selected].map((k) => { const [u, s] = k.split("::"); return { userId: Number(u), studentId: s ? Number(s) : null }; });
    if (!invitees.length) return;
    try { await meetingApi.addInvitees(meetingId, invitees); setShowInvite(false); setSelected(new Set()); onChanged(); }
    catch (err) { alert(err.message); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: "#0F2747" }}><FiMail size={15} /> Người tham dự ({invitations.length})</h3>
        {!readOnly && <button type="button" onClick={() => setShowInvite((s) => !s)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "#F27123" }}><FiPlus size={12} /> Mời thêm</button>}
      </div>

      {showInvite && (
        <div className="mb-4 rounded-xl p-3" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2" }}>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {parents.filter((p) => !invitedUserIds.has(p.userId)).map((p) => {
              const key = `${p.userId}::${p.studentId ?? ""}`;
              return (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                  <input type="checkbox" checked={selected.has(key)} onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })} className="accent-[#F27123]" />
                  <span className="text-[#0F2747]">{p.parentName}</span><span className="text-xs text-slate-400">· {p.studentName}</span>
                </label>
              );
            })}
            {parents.filter((p) => !invitedUserIds.has(p.userId)).length === 0 && <p className="p-2 text-xs text-slate-400">Đã mời tất cả phụ huynh.</p>}
          </div>
          <button type="button" onClick={inviteMore} className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "#08509F" }}>Gửi lời mời ({selected.size})</button>
        </div>
      )}

      <div className="space-y-2">
        {invitations.length === 0 ? <p className="text-sm text-slate-400">Chưa mời ai.</p> : invitations.map((inv) => {
          const st = INVITE_STATUS[inv.status] ?? INVITE_STATUS.SENT;
          return (
            <div key={inv.invitationId} className="flex items-center justify-between gap-2 rounded-xl px-4 py-2.5" style={{ border: "1px solid #FFE7D6" }}>
              <div>
                <p className="text-sm font-medium text-[#0F2747]">{inv.name}</p>
                <p className="text-xs text-slate-400">{inv.studentName ? `PH của ${inv.studentName} · ` : ""}{inv.phone ?? ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                {!readOnly && <button type="button" onClick={() => resend(inv)} className="text-slate-400 hover:text-[#F27123]" title="Gửi lại"><FiRefreshCw size={14} /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Minutes ───────────────────────────────────────────────────────────────────

function MinutesTab({ meetingId, minutes, readOnly, onChanged }) {
  const submitted = minutes?.isSubmitted;
  const [discussion, setDiscussion] = useState(minutes?.discussion ?? "");
  const [agreements, setAgreements] = useState(minutes?.agreements ?? "");
  const [decisions, setDecisions] = useState(minutes?.decisions ?? "");
  const [busy, setBusy] = useState(false);

  async function save(submit) {
    if (submit && !window.confirm("Chốt biên bản? Sau khi chốt sẽ không thể chỉnh sửa.")) return;
    setBusy(true);
    try { await meetingApi.saveMinutes(meetingId, { discussion, agreements, decisions, submit }); onChanged(); }
    catch (err) { alert(err.message); }
    finally { setBusy(false); }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl px-3 py-2 text-xs font-medium" style={{ backgroundColor: "#ECFDF5", color: "#16A34A" }}>Biên bản đã chốt lúc {minutes.submittedAt} — chỉ đọc.</div>
        {[["Nội dung thảo luận", minutes.discussion], ["Thống nhất", minutes.agreements], ["Quyết định", minutes.decisions]].map(([label, val]) => (
          <div key={label}><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="whitespace-pre-wrap rounded-xl px-4 py-3 text-sm text-slate-700" style={{ backgroundColor: "#FFF7F2", border: "1px solid #FFE7D6" }}>{val || "—"}</p></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Nội dung thảo luận</label><textarea value={discussion} onChange={(e) => setDiscussion(e.target.value)} rows={3} className={`${inputCls} resize-none`} disabled={readOnly} /></div>
      <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Thống nhất</label><textarea value={agreements} onChange={(e) => setAgreements(e.target.value)} rows={2} className={`${inputCls} resize-none`} disabled={readOnly} /></div>
      <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Quyết định</label><textarea value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={2} className={`${inputCls} resize-none`} disabled={readOnly} /></div>
      {!readOnly && (
        <div className="flex gap-3">
          <button type="button" onClick={() => save(false)} disabled={busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Lưu nháp</button>
          <button type="button" onClick={() => save(true)} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>Chốt biên bản</button>
        </div>
      )}
    </div>
  );
}

// ── Follow-up actions ─────────────────────────────────────────────────────────

function ActionsTab({ meetingId, actions, invitations, readOnly, onChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function create() {
    if (!title.trim()) { setErr("Nhập tiêu đề"); return; }
    if (!deadline) { setErr("Chọn hạn"); return; }
    setBusy(true); setErr("");
    try {
      await meetingApi.createAction(meetingId, { title: title.trim(), deadline, assigneeUserId: assignee ? Number(assignee) : null });
      setShowForm(false); setTitle(""); setDeadline(""); setAssignee(""); onChanged();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function setStatus(actionId, status) {
    try { await meetingApi.updateActionStatus(meetingId, actionId, status); onChanged(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>Việc cần làm ({actions.length})</h3>
        {!readOnly && <button type="button" onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "#F27123" }}><FiPlus size={12} /> Thêm việc</button>}
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 rounded-xl p-3" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên công việc" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
              <option value="">Giao cho... (tùy chọn)</option>
              {invitations.map((i) => <option key={i.invitationId} value={i.userId}>{i.name}</option>)}
            </select>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="button" onClick={create} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#08509F" }}>Tạo</button>
        </div>
      )}

      <div className="space-y-2">
        {actions.length === 0 ? <p className="text-sm text-slate-400">Chưa có việc nào.</p> : actions.map((a) => {
          const st = ACTION_STATUS[a.status] ?? ACTION_STATUS.PENDING;
          return (
            <div key={a.actionId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3" style={{ border: "1px solid #FFE7D6" }}>
              <div>
                <p className="text-sm font-medium text-[#0F2747]">{a.title}</p>
                <p className="text-xs text-slate-400">
                  Hạn {a.deadline}{a.assigneeName ? ` · ${a.assigneeName}` : ""}
                  {a.isOverdue && <span className="ml-1 font-semibold" style={{ color: "#DC2626" }}>· Quá hạn</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                {!readOnly && a.status !== "COMPLETED" && (
                  <select value={a.status} onChange={(e) => setStatus(a.actionId, e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none">
                    <option value="PENDING">Chờ</option>
                    <option value="IN_PROGRESS">Đang làm</option>
                    <option value="COMPLETED">Hoàn thành</option>
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Log ───────────────────────────────────────────────────────────────────────

function LogTab({ logs }) {
  if (!logs.length) return <p className="text-sm text-slate-400">Chưa có hoạt động.</p>;
  return (
    <div className="space-y-2">
      {logs.map((l, i) => (
        <div key={i} className="flex items-start justify-between gap-3 rounded-xl px-4 py-2.5" style={{ backgroundColor: "#FFF7F2" }}>
          <div><p className="text-sm text-[#0F2747]">{l.detail || l.action}</p><p className="text-xs text-slate-400">{l.changedByName}</p></div>
          <span className="shrink-0 text-xs text-slate-400">{l.createdAt}</span>
        </div>
      ))}
    </div>
  );
}

export default MeetingDetailPage;
