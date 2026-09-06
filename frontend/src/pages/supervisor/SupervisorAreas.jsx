import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { supervisorApi } from "../../api/client";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123",
  secondary: "#225DAD", deepBlue: "#00458E", success: "#15803D", surfaceLow: "#F3F3F3",
};
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
function currentShift() {
  const h = new Date().getHours();
  if (h >= 6 && h < 13) return "MORNING";
  if (h >= 13 && h < 18) return "AFTERNOON";
  if (h >= 18 && h < 22) return "EVENING";
  return "NIGHT";
}

const AREA_TYPE_LABEL = { DORM_FLOOR: "Khu nội trú", SELF_STUDY: "Phòng tự học" };

const STATS = [
  { key: "areaCount", label: "Tổng số khu", icon: "apartment", color: C.deepBlue },
  { key: "roomCount", label: "Tổng số phòng", icon: "meeting_room", color: C.secondary },
  { key: "studentCount", label: "Tổng sĩ số", icon: "groups", color: C.success },
];

function SupervisorAreas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Quản nhiệm",
    role: "Giáo viên quản nhiệm",
    avatar: user?.avatar ?? "",
  }), [user]);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    supervisorApi.getAreas()
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, []);

  async function saveNote() {
    const areaId = data?.areas?.[0]?.areaId;
    if (!note.trim() || !areaId) return;
    setSavingNote(true);
    try {
      await supervisorApi.createLogEntry({ areaId, shift: currentShift(), eventType: "EVENT", title: "Ghi chú nhanh", content: note.trim() });
      setNote("");
      alert("Đã lưu ghi chú vào sổ trực.");
    } catch (err) { alert(err.message); }
    finally { setSavingNote(false); }
  }

  function exportReport() {
    const areas = data?.areas ?? [];
    if (!areas.length) return;
    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Khu", "Loại khu", "Số phòng", "Số học sinh", "Tỷ lệ hiện diện", "Trạng thái"],
      ...areas.map((area) => [
        area.areaName,
        AREA_TYPE_LABEL[area.areaType] ?? area.areaType,
        area.roomCount,
        area.studentCount,
        area.presentRate == null ? "" : `${area.presentRate}%`,
        area.status === "ACTIVE" ? "Hoạt động" : area.status,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-khu-noi-tru-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const summary = data?.summary;

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Khu tôi phụ trách</h2>
          <p className="mt-1 text-sm text-slate-500">Danh sách các khu ký túc xá đang được phân công giám sát trực tiếp.</p>
        </div>
        <button type="button" onClick={exportReport} disabled={!data?.areas?.length} className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition hover:bg-[#F3F3F3] disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: C.border, color: C.onSurface }}>
          <Ms name="download" className="!text-[18px]" /> Xuất báo cáo
        </button>
      </div>

      {loading && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((n) => <div key={n} className="h-32 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* 4 stat cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.key} className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${s.color}1a`, color: s.color }}><Ms name={s.icon} /></div>
                <p className="text-3xl font-extrabold leading-none" style={{ color: C.onSurface }}>{summary?.[s.key] ?? "—"}</p>
                <p className="mt-1 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
            <div className="rounded-3xl p-5 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${C.orange}, #F59E0B)` }}>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"><Ms name="trending_up" /></div>
              <p className="text-3xl font-extrabold leading-none">{summary?.presentRate == null ? "—" : `${summary.presentRate}%`}</p>
              <p className="mt-1 text-xs text-white/85">Tỷ lệ hiện diện hôm nay</p>
            </div>
          </div>

          {/* Grid khu */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.areas.length === 0 && <p className="rounded-3xl border border-dashed py-10 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Bạn chưa được phân công khu nào.</p>}
            {data.areas.map((a) => (
              <div key={a.areaId} className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-3 p-4" style={{ background: `linear-gradient(120deg, ${C.deepBlue}, ${C.secondary})` }}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white"><Ms name={a.areaType === "SELF_STUDY" ? "menu_book" : "apartment"} className="!text-[26px]" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-white">{a.areaName}</h3>
                    <p className="text-xs text-white/80">{AREA_TYPE_LABEL[a.areaType] ?? a.areaType}</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}>{a.status === "ACTIVE" ? "Hoạt động" : a.status}</span>
                </div>
                <div className="p-4">
                  {a.description && <p className="mb-3 line-clamp-2 text-sm text-slate-600">{a.description}</p>}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5" style={{ color: C.muted }}><Ms name="meeting_room" className="!text-[18px]" style={{ color: C.secondary }} /> {a.roomCount} phòng</span>
                    <span className="flex items-center gap-1.5" style={{ color: C.muted }}><Ms name="groups" className="!text-[18px]" style={{ color: C.success }} /> {a.studentCount} HS</span>
                    {a.presentRate != null && <span className="flex items-center gap-1.5" style={{ color: C.muted }}><Ms name="how_to_reg" className="!text-[18px]" style={{ color: C.orange }} /> {a.presentRate}%</span>}
                  </div>
                  <button type="button" onClick={() => navigate(`/supervisor/attendance?areaId=${a.areaId}`)} className="mt-3 flex items-center gap-1 text-sm font-bold transition hover:gap-2" style={{ color: C.orange }}>
                    Chi tiết <Ms name="arrow_forward" className="!text-[16px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Ghi chú nhanh (lưu vào sổ trực) */}
          <div className="rounded-3xl p-5 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${C.deepBlue}, #0B3D91)` }}>
            <h3 className="mb-2 flex items-center gap-2 text-base font-bold"><Ms name="edit_note" /> Ghi chú nhanh</h3>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Nhập ghi chú quan trọng trong ca trực..." className="w-full rounded-2xl border-0 bg-white/95 p-3 text-sm text-slate-800 outline-none" />
            <button type="button" onClick={saveNote} disabled={savingNote || !note.trim()} className="mt-3 w-full rounded-full py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
              {savingNote ? "Đang lưu..." : "Lưu ghi chú"}
            </button>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export default SupervisorAreas;
