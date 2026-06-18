import { useEffect, useMemo, useState } from "react";
import { FiLifeBuoy, FiPlus, FiX } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { supportCaseApi, studentProfileApi } from "../../api/client";
import { useStudentMeta } from "../../hooks/useStudentMeta";

const CATEGORY = { ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PSYCHOLOGICAL: "Tâm lý", FAMILY: "Gia đình", OTHER: "Khác" };
const SEVERITY = { LOW: { label: "Thấp", bg: "#FFF7F2", text: "#F27123" }, MEDIUM: { label: "Trung bình", bg: "#FFFBEB", text: "#F59E0B" }, HIGH: { label: "Cao", bg: "#FEF2F2", text: "#DC2626" } };
const STATUS = { OPEN: { label: "Đang mở", bg: "#FEF2F2", text: "#DC2626" }, MONITORING: { label: "Đang theo dõi", bg: "#FFFBEB", text: "#F59E0B" }, RESOLVED: { label: "Đã xử lý", bg: "#ECFDF5", text: "#16A34A" } };
const selectCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

function SupportCasesPage() {
  const { user } = useAuth();
  const { data: meta } = useStudentMeta();

  const [classF, setClassF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [detailCase, setDetailCase] = useState(null);

  const classes = meta?.classes ?? [];

  useEffect(() => {
    let m = true; setLoading(true);
    supportCaseApi.list({ classId: classF, status: statusF, limit: 50 })
      .then((res) => { if (m) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [classF, statusF, refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const cases = data?.items ?? [];

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Ca hỗ trợ" sidebarFooterValue={String(cases.filter((c) => c.status !== "RESOLVED").length)}>
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
          <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Ca cần hỗ trợ</h1>
          <p className="text-sm text-slate-500">Gắn cờ học sinh cần can thiệp, theo dõi tiến triển đến khi xử lý xong.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#F27123" }}>
          <FiPlus size={15} /> Mở ca hỗ trợ
        </button>
      </section>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Lớp</label>
          <select value={classF} onChange={(e) => setClassF(e.target.value)} className={`${selectCls} w-44`}>
            <option value="">Ca của tôi</option>
            {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Trạng thái</label>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={`${selectCls} w-40`}>
            <option value="">Tất cả</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="space-y-2">{[0,1,2].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {!loading && (
        !cases.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>Chưa có ca hỗ trợ nào.</div>
        ) : (
          <div className="space-y-3">
            {cases.map((c) => {
              const sev = SEVERITY[c.severity] ?? SEVERITY.MEDIUM;
              const st = STATUS[c.status] ?? STATUS.OPEN;
              return (
                <button key={c.caseId} type="button" onClick={() => setDetailCase(c)} className="flex w-full flex-wrap items-start justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>{CATEGORY[c.category] ?? c.category}</span>
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: sev.bg, color: sev.text }}>{sev.label}</span>
                      <span className="text-sm font-bold text-[#0F2747]">{c.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{c.studentName} · {c.studentCode}{c.className ? ` · ${c.className}` : ""} · mở {c.createdAt}</p>
                    {c.description && <p className="mt-1 line-clamp-1 text-sm text-slate-600">{c.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                </button>
              );
            })}
          </div>
        )
      )}

      {showCreate && (
        <CreateCaseModal classes={classes} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); setRefresh((k) => k + 1); }} />
      )}
      {detailCase && (
        <CaseDetailModal caseItem={detailCase} onClose={() => setDetailCase(null)} onChanged={() => setRefresh((k) => k + 1)} />
      )}
    </DashboardShell>
  );
}

function CreateCaseModal({ classes, onClose, onSaved }) {
  const [classId, setClassId] = useState(classes[0]?.classId ? String(classes[0].classId) : "");
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState("ACADEMIC");
  const [severity, setSeverity] = useState("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!classId) return;
    let m = true;
    studentProfileApi.getClassOverview(classId).then((res) => { if (m) { setStudents(res.data.students); setStudentId(String(res.data.students[0]?.studentId ?? "")); } }).catch(() => {});
    return () => { m = false; };
  }, [classId]);

  async function submit() {
    if (!studentId) { setErr("Chọn học sinh"); return; }
    if (!title.trim()) { setErr("Nhập tiêu đề"); return; }
    setBusy(true); setErr("");
    try {
      await supportCaseApi.create({ studentId: Number(studentId), category, severity, title: title.trim(), description: description || null });
      onSaved();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>Mở ca hỗ trợ</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Lớp</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={selectCls}>
                {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
              </select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Học sinh</label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={selectCls}>
                <option value="">— Chọn —</option>
                {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Danh mục</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-600">Mức độ</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectCls}>
                {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-slate-600">Tiêu đề</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Sa sút học tập đột ngột" className={selectCls} /></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-600">Mô tả</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${selectCls} resize-none`} /></div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        </div>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={submit} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>{busy ? "Đang lưu..." : "Mở ca"}</button>
        </div>
      </div>
    </div>
  );
}

function CaseDetailModal({ caseItem, onClose, onChanged }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let m = true; setLoading(true);
    supportCaseApi.getUpdates(caseItem.caseId).then((res) => { if (m) setUpdates(res.data); }).catch(() => {}).finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [caseItem.caseId, refresh]);

  async function submit() {
    if (!note.trim()) return;
    setBusy(true);
    try { await supportCaseApi.addUpdate(caseItem.caseId, { note: note.trim(), newStatus: newStatus || null }); setNote(""); setNewStatus(""); setRefresh((k) => k + 1); onChanged(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <div><h3 className="text-base font-bold" style={{ color: "#0F2747" }}>{caseItem.title}</h3>
            <p className="text-xs text-slate-500">{caseItem.studentName} · {CATEGORY[caseItem.category] ?? caseItem.category}</p></div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {loading ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" /> : updates.map((u) => (
            <div key={u.updateId} className="rounded-xl px-3 py-2" style={{ backgroundColor: "#FFF7F2" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "#0F2747" }}>{u.authorName}{u.newStatus ? ` · → ${STATUS[u.newStatus]?.label ?? u.newStatus}` : ""}</span>
                <span className="text-xs text-slate-400">{u.createdAt}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">{u.note}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ghi nhận tiến triển / can thiệp..." className={`${selectCls} resize-none`} />
          <div className="flex gap-2">
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={selectCls}>
              <option value="">Giữ trạng thái</option>
              <option value="OPEN">Đang mở</option>
              <option value="MONITORING">Đang theo dõi</option>
              <option value="RESOLVED">Đã xử lý</option>
            </select>
            <button type="button" onClick={submit} disabled={busy || !note.trim()} className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>Cập nhật</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupportCasesPage;
