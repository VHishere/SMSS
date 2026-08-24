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

const SHIFTS = [
  { key: "MORNING", label: "Sáng", icon: "wb_sunny" },
  { key: "AFTERNOON", label: "Chiều", icon: "wb_twilight" },
  { key: "EVENING", label: "Tối", icon: "nights_stay" },
  { key: "NIGHT", label: "Đêm", icon: "bedtime" },
];
const EVENT_CFG = {
  EVENT: { label: "Sự kiện", color: C.secondary, icon: "event_note" },
  HANDOVER: { label: "Bàn giao ca", color: C.orange, icon: "sync_alt" },
  INCIDENT: { label: "Cần lưu ý", color: C.danger, icon: "warning" },
};
const SHIFT_VN = { MORNING: "Sáng", AFTERNOON: "Chiều", EVENING: "Tối", NIGHT: "Đêm" };
const STEPS = [
  { n: 1, title: "Ghi nhận bởi GVQN", desc: "Hoàn tất tại chỗ" },
  { n: 2, title: "Phê duyệt bởi GVCN", desc: "Đối với sự kiện nghiêm trọng" },
  { n: 3, title: "Lưu trữ hệ thống", desc: "Tự động sau 24h" },
];

function currentShift() {
  const h = new Date().getHours();
  if (h >= 6 && h < 13) return "MORNING";
  if (h >= 13 && h < 18) return "AFTERNOON";
  if (h >= 18 && h < 22) return "EVENING";
  return "NIGHT";
}

function SupervisionLog() {
  const { user } = useAuth();
  const [shift, setShift] = useState(currentShift());
  const [data, setData] = useState(null);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState(null); // {eventType, areaId, title, content}
  const [saving, setSaving] = useState(false);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Quản nhiệm",
    role: "Giáo viên quản nhiệm", avatar: user?.avatar ?? "",
  }), [user]);

  useEffect(() => {
    supervisorApi.getAreas().then((res) => setAreas(res.data.areas)).catch(() => {});
  }, []);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    supervisorApi.getLogbook({ shift })
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [shift, refresh]);

  function openAdd() {
    setModal({ eventType: "EVENT", areaId: areas[0]?.areaId ?? "", title: "", content: "" });
  }
  async function saveEntry() {
    if (!modal.content.trim() || !modal.areaId) { alert("Nhập nội dung và chọn khu."); return; }
    setSaving(true);
    try {
      await supervisorApi.createLogEntry({ areaId: Number(modal.areaId), shift, eventType: modal.eventType, title: modal.title.trim() || null, content: modal.content.trim() });
      setModal(null); setRefresh((k) => k + 1);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  const stats = data?.stats;
  const STAT_CARDS = [
    { label: "Sự kiện ca này", value: stats?.events, icon: "event_note", color: C.secondary },
    { label: "Ghi chú bàn giao", value: stats?.handovers, icon: "sync_alt", color: C.orange },
    { label: "Học sinh vắng", value: stats?.absent, icon: "person_off", color: C.danger },
  ];

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Sổ trực quản nhiệm</h2>
          <p className="mt-1 text-sm text-slate-500">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
        </div>
        <button type="button" onClick={openAdd} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95" style={{ backgroundColor: C.orange }}>
          <Ms name="add" className="!text-[20px]" /> Thêm sự kiện
        </button>
      </div>

      {/* 3 stat cards */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${s.color}1a`, color: s.color }}><Ms name={s.icon} /></div>
            <p className="text-3xl font-extrabold leading-none" style={{ color: C.onSurface }}>{s.value == null ? "—" : String(s.value).padStart(2, "0")}</p>
            <p className="mt-1 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Shift tabs */}
      <div className="mb-5 flex w-fit items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
        {SHIFTS.map((s) => (
          <button key={s.key} type="button" onClick={() => setShift(s.key)} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all"
            style={shift === s.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
            <Ms name={s.icon} className="!text-[18px]" /> {s.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />}

      {!loading && !error && data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Timeline ca hiện tại */}
          <section className="lg:col-span-2">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: C.onSurface }}><Ms name="list_alt" style={{ color: C.orange }} /> Chi tiết ca trực — {SHIFT_VN[shift]}</h3>
            {data.entries.length === 0 ? (
              <div className="rounded-3xl border border-dashed py-12 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Chưa có sự kiện nào trong ca này.</div>
            ) : (
              <div className="space-y-3">
                {data.entries.map((e) => {
                  const cfg = EVENT_CFG[e.eventType] ?? EVENT_CFG.EVENT;
                  const isHandover = e.eventType === "HANDOVER";
                  return (
                    <div key={e.logId} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeft: `4px solid ${cfg.color}` }}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${cfg.color}1a`, color: cfg.color }}><Ms name={cfg.icon} className="!text-[14px]" /> {cfg.label}</span>
                        <span className="text-xs text-slate-400">{e.time} · {e.areaName}</span>
                        {isHandover && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>Đã bàn giao</span>}
                      </div>
                      {e.title && <p className="text-sm font-bold" style={{ color: C.onSurface }}>{e.title}</p>}
                      {e.content && <p className="mt-0.5 text-sm text-slate-600">{e.content}</p>}
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Ms name="person" className="!text-[14px]" /> {e.author}</span>
                        {e.replyCount > 0 && <span className="flex items-center gap-1"><Ms name="forum" className="!text-[14px]" /> {e.replyCount} phản hồi</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sidebar */}
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <h3 className="mb-3 text-base font-bold" style={{ color: C.onSurface }}>Nhật ký các ca trước</h3>
              <div className="space-y-2">
                {data.previous.length === 0 && <p className="text-sm text-slate-400">Chưa có nhật ký.</p>}
                {data.previous.map((p) => (
                  <div key={p.logId} className="rounded-2xl px-3 py-2" style={{ backgroundColor: C.surfaceLow }}>
                    <p className="text-xs font-bold" style={{ color: C.secondary }}>Ca {SHIFT_VN[p.shift]} · {new Date(p.logDate).toLocaleDateString("vi-VN")}</p>
                    <p className="truncate text-sm" style={{ color: C.onSurface }}>{p.title}</p>
                    <p className="text-xs text-slate-400">{p.time}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl p-5 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${C.deepBlue}, #0B3D91)` }}>
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold"><Ms name="verified" /> Quy trình phê duyệt</h3>
              <div className="space-y-4">
                {STEPS.map((s, i) => (
                  <div key={s.n} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-bold">{s.n}</div>
                      {i < STEPS.length - 1 && <div className="mt-1 h-8 w-px bg-white/25" />}
                    </div>
                    <div><p className="text-sm font-bold">{s.title}</p><p className="text-xs text-white/75">{s.desc}</p></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Modal thêm sự kiện */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Thêm sự kiện sổ trực — ca {SHIFT_VN[shift]}</h3>
              <button type="button" onClick={() => setModal(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><Ms name="close" className="!text-[20px]" /></button>
            </div>
            <div className="space-y-3 px-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">Loại sự kiện
                  <PrettySelect value={modal.eventType} onChange={(e) => setModal({ ...modal, eventType: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }}>
                    <option value="EVENT">Sự kiện</option>
                    <option value="HANDOVER">Bàn giao ca</option>
                    <option value="INCIDENT">Cần lưu ý</option>
                  </PrettySelect>
                </label>
                <label className="text-sm">Khu
                  <PrettySelect value={modal.areaId} onChange={(e) => setModal({ ...modal, areaId: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }}>
                    {areas.map((a) => <option key={a.areaId} value={a.areaId}>{a.areaName}</option>)}
                  </PrettySelect>
                </label>
              </div>
              <label className="block text-sm">Tiêu đề
                <input value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} placeholder="VD: Kiểm tra vệ sinh phòng..." className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }} />
              </label>
              <label className="block text-sm">Nội dung
                <textarea value={modal.content} onChange={(e) => setModal({ ...modal, content: e.target.value })} rows={4} placeholder="Mô tả chi tiết sự kiện trong ca trực..." className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }} />
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <button type="button" onClick={() => setModal(null)} className="rounded-full px-4 py-2 text-sm font-medium" style={{ color: C.muted }}>Huỷ</button>
              <button type="button" onClick={saveEntry} disabled={saving} className="rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: C.orange }}>{saving ? "Đang lưu..." : "Ghi sổ trực"}</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default SupervisionLog;
