import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

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

// attendance_type: 1 PRESENT, 2 LATE, 3 ABSENT_EXCUSED, 4 ABSENT_UNEXCUSED, 5 EARLY_LEAVE
const TYPE = {
  1: { label: "Có mặt", bg: "#DCFCE7", text: C.success, dot: C.success },
  2: { label: "Đi muộn", bg: "#FEF3C7", text: "#B45309", dot: "#B45309" },
  3: { label: "Có phép", bg: "rgba(242,113,35,0.12)", text: C.orange, dot: C.orange },
  4: { label: "Vắng không phép", bg: "#FFDAD6", text: "#93000A", dot: C.danger },
  5: { label: "Về sớm", bg: "rgba(34,93,173,0.12)", text: C.secondary, dot: C.secondary },
};
const QUICK = [
  { typeId: 1, icon: "check", color: C.success, title: "Có mặt" },
  { typeId: 3, icon: "event_available", color: C.orange, title: "Có phép" },
  { typeId: 4, icon: "close", color: C.danger, title: "Vắng không phép" },
];
const SUMMARY_CARDS = [
  { key: "present", label: "Học sinh có mặt", color: C.success, icon: "groups" },
  { key: "absentUnexcused", label: "Vắng không phép", color: C.danger, icon: "person_off" },
  { key: "absentExcused", label: "Vắng có phép", color: C.orange, icon: "event_busy" },
  { key: "notYet", label: "Chưa điểm danh", color: "#64748B", icon: "help" },
];
const PAGE_SIZE = 8;


function DormAttendance() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState(sp.get("areaId") ? Number(sp.get("areaId")) : null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);

  const [floor, setFloor] = useState("");
  const [roomId, setRoomId] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState({}); // { studentId: typeId }
  const [selected, setSelected] = useState(new Set());

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Quản nhiệm",
    role: "Giáo viên quản nhiệm", avatar: user?.avatar ?? "",
  }), [user]);

  // Load danh sách khu (dropdown)
  useEffect(() => {
    let m = true;
    supervisorApi.getAreas().then((res) => {
      if (!m) return;
      const dorm = res.data.areas.filter((a) => a.areaType !== "SELF_STUDY" || a.studentCount > 0);
      setAreas(dorm);
      if (!areaId && dorm.length) setAreaId(dorm[0].areaId);
    }).catch(() => {});
    return () => { m = false; };
  }, []); // eslint-disable-line

  // Load roster theo khu
  useEffect(() => {
    if (!areaId) { setLoading(false); return; }
    let m = true;
    setLoading(true); setError("");
    supervisorApi.getAttendance({ areaId })
      .then((res) => { if (m) { setData(res.data); setPending({}); setSelected(new Set()); setPage(1); } })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [areaId, refresh]);

  const roster = data?.roster ?? [];
  const floors = useMemo(() => [...new Set((data?.rooms ?? []).map((r) => r.floor).filter((f) => f != null))].sort(), [data]);

  const filtered = useMemo(() => roster.filter((r) => {
    if (floor && String(r.floor) !== String(floor)) return false;
    if (roomId && r.roomName !== (data.rooms.find((x) => String(x.roomId) === String(roomId))?.roomName)) return false;
    if (q && !(`${r.studentName} ${r.studentCode}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [roster, floor, roomId, q, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function statusOf(r) { return pending[r.studentId] ?? r.typeId ?? null; }
  function setStatus(studentId, typeId) { setPending((p) => ({ ...p, [studentId]: typeId })); }
  function applyToSelected(typeId) {
    setPending((p) => { const n = { ...p }; selected.forEach((id) => { n[id] = typeId; }); return n; });
  }
  function markAllPresent() {
    setPending((p) => { const n = { ...p }; filtered.forEach((r) => { n[r.studentId] = 1; }); return n; });
  }

  async function save() {
    const records = Object.entries(pending).map(([studentId, typeId]) => ({ studentId: Number(studentId), typeId }));
    if (!records.length) return;
    setSaving(true);
    try {
      await supervisorApi.submitBulkAttendance({ areaId, records }); // 1 API call
      setRefresh((k) => k + 1);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  const pendingCount = Object.keys(pending).length;
  const summary = data?.summary;

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Điểm danh nội trú</h2>
          <p className="mt-1 text-sm text-slate-500">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={markAllPresent} disabled={!filtered.length} className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition hover:bg-[#F3F3F3] disabled:opacity-50" style={{ borderColor: C.border, color: C.onSurface }}>
            <Ms name="done_all" className="!text-[18px]" /> Điểm danh hàng loạt
          </button>
          <button type="button" onClick={save} disabled={saving || pendingCount === 0} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
            <Ms name="save" className="!text-[18px]" /> {saving ? "Đang lưu..." : `Lưu điểm danh${pendingCount ? ` (${pendingCount})` : ""}`}
          </button>
        </div>
      </div>

      {/* Filters — pill bo tròn */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PrettySelect icon="apartment" title="Khu phụ trách" value={areaId ?? ""}
          onChange={(e) => setAreaId(Number(e.target.value))}
          options={areas.map((a) => ({ value: a.areaId, label: a.areaName }))} />
        <PrettySelect icon="layers" title="Tầng" value={floor}
          onChange={(e) => { setFloor(e.target.value); setPage(1); }}
          options={[{ value: "", label: "Tất cả tầng" }, ...floors.map((f) => ({ value: f, label: `Tầng ${f}` }))]} />
        <PrettySelect icon="meeting_room" title="Phòng" value={roomId}
          onChange={(e) => { setRoomId(e.target.value); setPage(1); }}
          options={[{ value: "", label: "Tất cả phòng" }, ...(data?.rooms ?? []).map((r) => ({ value: r.roomId, label: r.roomName }))]} />
        <div className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[#DFC0B2] bg-white px-4 shadow-sm transition-colors focus-within:border-[#F27123] focus-within:ring-2 focus-within:ring-[#F27123]/20">
          <Ms name="search" className="!text-[18px] text-slate-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm nhanh tên / MSHS..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {q && <button type="button" onClick={() => { setQ(""); setPage(1); }} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100"><Ms name="close" className="!text-[16px]" /></button>}
        </div>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2.5 text-sm" style={{ backgroundColor: "rgba(34,93,173,0.08)", border: `1px solid ${C.border}` }}>
          <span className="font-bold" style={{ color: C.secondary }}>Đã chọn {selected.size} HS:</span>
          {QUICK.map((a) => (
            <button key={a.typeId} type="button" onClick={() => applyToSelected(a.typeId)} className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: a.color }}>{TYPE[a.typeId].label}</button>
          ))}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-500 hover:underline">Bỏ chọn</button>
        </div>
      )}

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />}

      {!loading && !error && data && (
        <>
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: C.surfaceLow }}>
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.studentId))}
                        onChange={(e) => { const n = new Set(selected); pageRows.forEach((r) => e.target.checked ? n.add(r.studentId) : n.delete(r.studentId)); setSelected(n); }} />
                    </th>
                    {["Học sinh", "Lớp", "Phòng", "Trạng thái", "Thao tác"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">Không có học sinh phù hợp.</td></tr>}
                  {pageRows.map((r) => {
                    const st = statusOf(r);
                    const cfg = st ? TYPE[st] : { label: "Chưa điểm danh", bg: C.surfaceHigh, text: C.muted, dot: "#94A3B8" };
                    const isPending = pending[r.studentId] != null;
                    return (
                      <tr key={r.studentId} style={{ borderTop: `1px solid ${C.surfaceLow}`, backgroundColor: isPending ? "rgba(242,113,35,0.05)" : "#fff" }}>
                        <td className="px-4 py-3"><input type="checkbox" checked={selected.has(r.studentId)} onChange={(e) => { const n = new Set(selected); e.target.checked ? n.add(r.studentId) : n.delete(r.studentId); setSelected(n); }} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{r.avatar ? <img src={r.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : initials(r.studentName)}</div>
                            <div><p className="font-semibold" style={{ color: C.onSurface }}>{r.studentName}</p><p className="text-xs text-slate-400">{r.studentCode}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.className ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{r.roomName ?? "—"}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />{cfg.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {QUICK.map((a) => (
                              <button key={a.typeId} type="button" title={a.title} onClick={() => setStatus(r.studentId, a.typeId)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg transition"
                                style={st === a.typeId ? { backgroundColor: a.color, color: "#fff" } : { backgroundColor: `${a.color}1a`, color: a.color }}>
                                <Ms name={a.icon} className="!text-[18px]" />
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${C.surfaceLow}` }}>
                <span className="text-xs text-slate-500">Hiển thị {pageRows.length}/{filtered.length} HS</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-2 py-1 text-sm disabled:opacity-40" style={{ borderColor: C.border }}><Ms name="chevron_left" className="!text-[18px]" /></button>
                  <span className="text-sm" style={{ color: C.onSurface }}>Trang {page}/{totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-2 py-1 text-sm disabled:opacity-40" style={{ borderColor: C.border }}><Ms name="chevron_right" className="!text-[18px]" /></button>
                </div>
              </div>
            )}
          </div>

          {/* 4 summary cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {SUMMARY_CARDS.map((c) => (
              <div key={c.key} className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.color}` }}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${c.color}1a`, color: c.color }}><Ms name={c.icon} className="!text-[20px]" /></div>
                </div>
                <p className="text-2xl font-extrabold leading-none" style={{ color: c.color }}>{String(summary?.[c.key] ?? 0).padStart(2, "0")}</p>
                <p className="mt-1 text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export default DormAttendance;
