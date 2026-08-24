import { useEffect, useMemo, useState } from "react";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { supervisorApi } from "../../api/client";
import PrettySelect from "../../components/molecules/PrettySelect";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123",
  secondary: "#225DAD", deepBlue: "#00458E", success: "#15803D", danger: "#DC2626",
  surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
function initials(n) {
  const p = (n || "").trim().split(/\s+/);
  return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?";
}
const CATEGORY = { ACADEMIC: "Học tập", BEHAVIOUR: "Hành vi", ATTENDANCE: "Chuyên cần", PSYCHOLOGICAL: "Tâm lý", FAMILY: "Gia đình", OTHER: "Khác" };
const SEVERITY = { HIGH: { label: "Cao", bg: "#FFDAD6", text: "#93000A" }, MEDIUM: { label: "Trung bình", bg: "#FEF3C7", text: "#B45309" }, LOW: { label: "Thấp", bg: C.surfaceHigh, text: C.muted } };
const STATUS = { OPEN: { label: "Đang xử lý", dot: C.danger }, MONITORING: { label: "Đang theo dõi", dot: C.secondary }, RESOLVED: { label: "Đã giải quyết", dot: C.success } };
const FILTERS = [{ key: "", label: "Tất cả" }, { key: "OPEN", label: "Đang xử lý" }, { key: "MONITORING", label: "Đang theo dõi" }, { key: "RESOLVED", label: "Đã giải quyết" }];

function CreateModal({ students, onClose, onCreated }) {
  const [form, setForm] = useState({ studentId: students[0]?.studentId ?? "", category: "PSYCHOLOGICAL", severity: "MEDIUM", title: "", description: "" });
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!form.studentId || !form.title.trim()) { alert("Chọn học sinh và nhập tiêu đề."); return; }
    setSaving(true);
    try { await supervisorApi.createSupport({ ...form, studentId: Number(form.studentId) }); onCreated(); }
    catch (err) { alert(err.message); } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Tạo ca hỗ trợ mới</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><Ms name="close" className="!text-[20px]" /></button>
        </div>
        <div className="space-y-3 px-6 py-4">
          <label className="block text-sm">Học sinh
            <PrettySelect value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }}>
              {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName}{s.roomName ? ` · ${s.roomName}` : ""}</option>)}
            </PrettySelect>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Nhóm vấn đề
              <PrettySelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }}>
                {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </PrettySelect>
            </label>
            <label className="text-sm">Mức độ
              <PrettySelect value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }}>
                {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </PrettySelect>
            </label>
          </div>
          <label className="block text-sm">Tiêu đề
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VD: HS có biểu hiện căng thẳng..." className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }} />
          </label>
          <label className="block text-sm">Mô tả
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium" style={{ color: C.muted }}>Huỷ</button>
          <button type="button" onClick={submit} disabled={saving} className="rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: C.orange }}>{saving ? "Đang tạo..." : "Tạo ca"}</button>
        </div>
      </div>
    </div>
  );
}

function SupervisorSupport() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState(false);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Quản nhiệm", role: "Giáo viên quản nhiệm", avatar: user?.avatar ?? "",
  }), [user]);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    supervisorApi.getSupport()
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  const shown = useMemo(() => (data?.cases ?? []).filter((c) => !filter || c.status === filter), [data, filter]);
  const s = data?.stats;
  const CARDS = [
    { label: "Đang xử lý", value: s?.open, color: C.danger, icon: "error" },
    { label: "Đang theo dõi", value: s?.monitoring, color: C.secondary, icon: "visibility" },
    { label: "Đã giải quyết", value: s?.resolved, color: C.success, icon: "task_alt" },
  ];

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Hỗ trợ học sinh</h2>
          <p className="mt-1 text-sm text-slate-500">Theo dõi các ca cần hỗ trợ của học sinh thuộc khu bạn phụ trách.</p>
        </div>
        <button type="button" onClick={() => setModal(true)} disabled={!data?.students?.length} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
          <Ms name="add" className="!text-[20px]" /> Tạo ca hỗ trợ
        </button>
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" />}

      {!loading && !error && data && (
        <>
          <div className="mb-5 grid grid-cols-3 gap-4">
            {CARDS.map((c) => (
              <div key={c.label} className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.color}` }}>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${c.color}1a`, color: c.color }}><Ms name={c.icon} className="!text-[20px]" /></div>
                <p className="text-2xl font-extrabold leading-none" style={{ color: c.color }}>{String(c.value ?? 0).padStart(2, "0")}</p>
                <p className="mt-1 text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {FILTERS.map((f) => (
              <button key={f.key || "all"} type="button" onClick={() => setFilter(f.key)} className="rounded-full px-4 py-1.5 text-sm transition-all"
                style={filter === f.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>{f.label}</button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed py-12 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Không có ca hỗ trợ nào.</div>
          ) : (
            <div className="space-y-3">
              {shown.map((c) => {
                const sev = SEVERITY[c.severity] ?? SEVERITY.LOW;
                const st = STATUS[c.status] ?? STATUS.OPEN;
                return (
                  <div key={c.caseId} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeft: `4px solid ${sev.text}` }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{initials(c.studentName)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold" style={{ color: C.onSurface }}>{c.studentName}</span>
                          <span className="text-xs text-slate-400">{c.studentCode}{c.roomName ? ` · ${c.roomName}` : ""}</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: C.surfaceLow, color: C.muted }}>{CATEGORY[c.category] ?? c.category}</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: sev.bg, color: sev.text }}>{sev.label}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold" style={{ color: C.onSurface }}>{c.title}</p>
                        {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold" style={{ color: st.dot }}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: st.dot }} />{st.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {modal && <CreateModal students={data.students} onClose={() => setModal(false)} onCreated={() => { setModal(false); setRefresh((k) => k + 1); }} />}
    </DashboardShell>
  );
}

export default SupervisorSupport;
