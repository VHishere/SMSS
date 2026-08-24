import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import StaffPageHeader from "../../components/staff/StaffPageHeader";
import BehaviourRecordModal from "../../components/organisms/BehaviourRecordModal";
import BehaviourWarningModal from "../../components/organisms/BehaviourWarningModal";
import BehaviourCategoryManagerModal from "../../components/organisms/BehaviourCategoryManagerModal";
import { adminApi } from "../../api/client";
import { useAdminBehaviourMeta } from "../../hooks/useAdminBehaviourMeta";
import { useAdminBehaviourRecords } from "../../hooks/useAdminBehaviourRecords";
import { useAdminBehaviourAnalytics } from "../../hooks/useAdminBehaviourAnalytics";
import { useAdminBehaviourWarnings } from "../../hooks/useAdminBehaviourWarnings";
import PrettySelect from "../../components/molecules/PrettySelect";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", primary: "#9F4200",
  orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", tertiary: "#4A5F82",
  error: "#BA1A1A", success: "#15803D", surface: "#F9F9F9", surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style, fill = false }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}>{name}</span>;
}
function initials(name) {
  const p = (name || "").trim().split(/\s+/);
  if (!p.length) return "?";
  if (p.length === 1) return p[0][0]?.toUpperCase() ?? "?";
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function ago(dt) {
  if (!dt) return "";
  const d = new Date(String(dt).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 0)} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const dd = Math.floor(h / 24);
  if (dd === 1) return "Hôm qua";
  return `${dd} ngày trước`;
}

// Bridges the shared BehaviourRecordModal/BehaviourWarningModal (built for
// the teacher API) onto the admin endpoints — same shape, no ownership check.
const adminBehaviourApi = {
  createRecord: adminApi.createBehaviourRecord,
  updateRecord: adminApi.updateBehaviourRecord,
  updateWarning: adminApi.updateBehaviourWarning,
};

const TABS = [
  { key: "overview", label: "Tổng quan", ms: "dashboard" },
  { key: "warnings", label: "Cảnh báo", ms: "warning" },
];
const WARNING_LABEL = {
  LOW_CONDUCT: { label: "Hạnh kiểm thấp", color: "#BA1A1A" },
  EXCESSIVE_VIOLATION: { label: "Vi phạm nhiều", color: "#B45309" },
  INTERVENTION: { label: "Cần can thiệp", color: "#F27123" },
};
const WARNING_STATUS = {
  IN_PROGRESS: { label: "Đang can thiệp", bg: "#FEF3C7", text: "#B45309" },
  RESOLVED: { label: "Đã xử lý", bg: "#DCFCE7", text: "#15803D" },
};
const AVA = ["#00458E", "#4A5F82", "#225DAD", "#F27123"];

const selectCls = "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";
const selStyle = { borderColor: C.border, color: C.onSurface };
const THEAD_STYLE = { backgroundColor: C.deepBlue };
const TH = "px-4 py-3 text-xs font-medium uppercase tracking-wider";

function AvatarChip({ name, avatar, i = 0, size = 9 }) {
  const cls = size === 8 ? "h-8 w-8" : "h-9 w-9";
  return (
    <div className={`flex ${cls} shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`} style={{ backgroundColor: AVA[i % AVA.length] }}>
      {avatar ? <img src={avatar} alt={name} className={`${cls} rounded-full object-cover`} /> : initials(name)}
    </div>
  );
}
function recStatus(r) {
  if (r.behaviorType === "VIOLATION") return { label: "Vi phạm", bg: "rgba(186,26,26,0.1)", text: C.error, delta: `-${Math.abs(r.points)}`, dcolor: C.error };
  if (r.points >= 20) return { label: "Khen thưởng cao", bg: "rgba(242,113,35,0.1)", text: C.orange, delta: `+${r.points}`, dcolor: C.orange };
  return { label: "Khen thưởng", bg: "rgba(34,93,173,0.1)", text: C.secondary, delta: `+${r.points}`, dcolor: C.secondary };
}

// ─── Tổng quan (records — no quick award for admin) ────────────────────────────
function OverviewTab({ records, warnings, catMap, onEdit }) {
  const [catFilter, setCatFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => (catFilter ? records.filter((r) => r.category === catFilter) : records),
    [records, catFilter],
  );
  const shown = showAll ? filtered : filtered.slice(0, 6);

  const feed = useMemo(() => {
    const items = (warnings ?? []).slice(0, 5).map((w) => ({
      key: `w${w.warningId}`,
      title: WARNING_LABEL[w.warningType]?.label ?? "Cảnh báo hành vi",
      time: ago(w.createdAt),
      student: w.studentName,
      desc: w.note || "Cần theo dõi và can thiệp kịp thời.",
      action: w.status === "RESOLVED"
        ? { label: "Đã xử lý", icon: "check_circle", color: C.success }
        : { label: "Yêu cầu tham vấn", icon: "report", color: C.error },
    }));
    if (items.length < 3) {
      for (const r of records.filter((x) => x.behaviorType === "POSITIVE" && x.points >= 10).slice(0, 3 - items.length)) {
        items.push({ key: `m${r.behaviorId}`, title: "Đề xuất khen thưởng", time: ago(r.recordDate), student: r.studentName, desc: r.title, action: { label: "Đề xuất Khen thưởng", icon: "star", color: C.secondary, fill: true } });
      }
    }
    return items;
  }, [warnings, records]);

  const catOptions = Object.entries(catMap);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm lg:col-span-2" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between border-b p-5" style={{ borderColor: C.border }}>
          <h4 className="font-bold" style={{ color: C.onSurface }}>Ghi nhận gần đây</h4>
          <PrettySelect value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#00458E]" style={selStyle}>
            <option value="">Tất cả các mục</option>
            {catOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </PrettySelect>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white" style={THEAD_STYLE}>
              <tr>
                <th className={TH}>Học sinh</th>
                <th className={TH}>Loại</th>
                <th className={TH}>Trạng thái</th>
                <th className={`${TH} text-right`}>Điểm rèn luyện</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {shown.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">Chưa có ghi nhận nào.</td></tr>
              ) : shown.map((r, i) => {
                const st = recStatus(r);
                return (
                  <tr key={r.behaviorId} onClick={() => onEdit(r)} className="cursor-pointer transition-colors hover:bg-[#F3F3F3]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <AvatarChip name={r.studentName} avatar={r.studentAvatar} i={i} size={8} />
                        <div className="min-w-0">
                          <p className="font-bold" style={{ color: C.onSurface }}>{r.studentName}</p>
                          <p className="text-[11px]" style={{ color: C.muted }}>{r.className ?? "—"} • {r.studentCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p style={{ color: C.onSurface }}>{r.title}</p>
                      <p className="text-[11px]" style={{ color: C.muted }}>{catMap[r.category] ?? (r.behaviorType === "VIOLATION" ? "Vi phạm" : "Khen thưởng")}</p>
                    </td>
                    <td className="px-4 py-4"><span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                    <td className="px-4 py-4 text-right font-bold" style={{ color: st.dcolor, fontFamily: "monospace" }}>{st.delta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 6 && (
          <div className="flex justify-center border-t p-3" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-bold hover:underline" style={{ color: C.secondary }}>
              {showAll ? "Thu gọn" : `Xem tất cả ${filtered.length} hồ sơ`}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <h4 className="mb-4 flex items-center justify-between font-bold" style={{ color: C.onSurface }}>
          Đánh giá gần đây <Ms name="more_vert" style={{ color: "#94A3B8" }} />
        </h4>
        <div className="max-h-130 space-y-4 overflow-y-auto pr-1">
          {feed.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Chưa có cảnh báo/đánh giá nào.</p>
          ) : feed.map((f) => (
            <div key={f.key} className="rounded-2xl border p-3 transition-all hover:border-[#F27123]" style={{ borderColor: C.border }}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h5 className="text-sm font-bold" style={{ color: C.onSurface }}>{f.title}</h5>
                <span className="rounded px-2 py-0.5 text-[10px]" style={{ backgroundColor: C.surfaceHigh, color: C.muted }}>{f.time}</span>
              </div>
              <p className="mb-2 text-sm" style={{ color: C.muted }}><span className="font-semibold" style={{ color: C.onSurface }}>{f.student}</span>: {f.desc}</p>
              <div className="flex items-center gap-2">
                <Ms name={f.action.icon} className="text-[16px]!" style={{ color: f.action.color }} fill={f.action.fill} />
                <span className="text-xs font-bold" style={{ color: f.action.color }}>{f.action.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Cảnh báo (quét tự động + can thiệp) ───────────────────────────────────────
function WarningsTab({ classId, semesterId }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [editWarning, setEditWarning] = useState(null);
  const filters = useMemo(() => ({ classId, semesterId, status: statusFilter, _rk: refreshKey }), [classId, semesterId, statusFilter, refreshKey]);
  const { data, loading, error } = useAdminBehaviourWarnings(filters, Boolean(classId && semesterId));

  async function handleGenerate() {
    setGenerating(true); setGenMsg("");
    try { const res = await adminApi.generateBehaviourWarnings(classId, semesterId); setGenMsg(`Đã tạo/cập nhật ${res.data.generated} cảnh báo.`); setRefreshKey((k) => k + 1); }
    catch (err) { setGenMsg(err.message); } finally { setGenerating(false); }
  }
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PrettySelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls} style={selStyle}>
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Mở</option>
          <option value="IN_PROGRESS">Đang can thiệp</option>
          <option value="RESOLVED">Đã xử lý</option>
        </PrettySelect>
        <div className="flex items-center gap-3">
          {genMsg && <span className="text-xs text-slate-500">{genMsg}</span>}
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.deepBlue }}>
            <Ms name="autorenew" className={`text-[18px]! ${generating ? "animate-spin" : ""}`} />
            {generating ? "Đang quét..." : "Quét cảnh báo tự động"}
          </button>
        </div>
      </div>
      {loading && <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Không có cảnh báo. Nhấn "Quét cảnh báo tự động".</div>
        ) : (
          <div className="space-y-3">
            {data.items.map((w, i) => {
              const typeCfg = WARNING_LABEL[w.warningType] ?? { label: w.warningType, color: "#64748B" };
              const stCfg = WARNING_STATUS[w.status];
              return (
                <div key={w.warningId} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeftWidth: 4, borderLeftColor: typeCfg.color }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AvatarChip name={w.studentName} avatar={w.studentAvatar} i={i} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: C.onSurface }}>{w.studentName}</p>
                        <p className="text-xs text-slate-400">{w.studentCode} · {w.className ?? "—"} · HK {w.conductScore ?? "—"}đ</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: typeCfg.color }}>{typeCfg.label}</span>
                      {stCfg && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>}
                    </div>
                  </div>
                  {w.note && <p className="mt-2 text-sm text-slate-600">{w.note}</p>}
                  {w.intervention && <p className="mt-2 rounded-xl px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: C.surfaceLow }}><span className="font-semibold">Can thiệp: </span>{w.intervention}</p>}
                  <div className="mt-3">
                    <button type="button" onClick={() => setEditWarning(w)} className="rounded-full px-4 py-1.5 text-xs font-bold text-white transition hover:opacity-90" style={{ backgroundColor: C.orange }}>Can thiệp</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
      {editWarning && <BehaviourWarningModal warning={editWarning} api={adminBehaviourApi} onClose={() => setEditWarning(null)} onSaved={() => { setEditWarning(null); setRefreshKey((k) => k + 1); }} />}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────
// Admin equivalent of teacher's "Quản lý nề nếp" page (BehaviourPage.jsx) —
// same 2 tabs (Tổng quan / Cảnh báo), admin can pick ANY class school-wide,
// EXCEPT there is no "Cộng điểm nhanh" quick-award shortcut. Admin also gets
// a "Quản lý danh mục" panel to define the point value of each merit/
// violation category, which is what the record composer (and conduct score)
// draws on as its reference/basis.
function AdminDisciplinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { data: meta, loading: metaLoading, error: metaError } = useAdminBehaviourMeta();

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [createMenu, setCreateMenu] = useState(false);
  const [createType, setCreateType] = useState(null); // "POSITIVE" | "VIOLATION"
  const [editRecord, setEditRecord] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const menuRef = useRef(null);

  const classes = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];
  const classId = selectedClassId || String(classes[0]?.classId || "");
  const semesterId = selectedSemesterId || String(semesters[0]?.semesterId || "");
  const semester = semesters.find((s) => String(s.semesterId) === semesterId);

  const recFilters = (type) => ({ classId, behaviorType: type, startDate: semester?.startDate, endDate: semester?.endDate, page: 1, limit: 50, _rk: refresh });
  const { data: meritData } = useAdminBehaviourRecords(recFilters("POSITIVE"), Boolean(classId));
  const { data: violData } = useAdminBehaviourRecords(recFilters("VIOLATION"), Boolean(classId));
  const { data: warnData } = useAdminBehaviourWarnings({ classId, semesterId, _rk: refresh }, Boolean(classId && semesterId));
  // Full class roster (not just students with existing records) for the
  // "Ghi nhận sự việc" student picker.
  const { data: analytics } = useAdminBehaviourAnalytics(classId, semesterId, Boolean(classId && semesterId));

  const records = useMemo(
    () => [...(meritData?.items ?? []), ...(violData?.items ?? [])].sort((a, b) => String(b.recordDate).localeCompare(String(a.recordDate))),
    [meritData, violData],
  );

  useEffect(() => {
    if (!createMenu) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setCreateMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [createMenu]);

  const categories = useMemo(() => ({ merit: meta?.meritCategories ?? [], violation: meta?.violationCategories ?? [] }), [meta]);
  const catMap = useMemo(() => {
    const m = {};
    for (const c of [...(meta?.meritCategories ?? []), ...(meta?.violationCategories ?? [])]) m[c.key] = c.label;
    return m;
  }, [meta]);
  const studentsForModal = useMemo(
    () => (analytics?.students ?? []).map((s) => ({ studentId: s.studentId, studentName: s.studentName, studentCode: s.studentCode })),
    [analytics],
  );

  function setTab(key) { setSearchParams({ tab: key }); }
  function bump() { setRefresh((k) => k + 1); }

  function exportCsv() {
    const head = ["Học sinh", "Mã", "Lớp", "Loại", "Danh mục", "Điểm", "Ngày", "GV ghi"];
    const rows = records.map((r) => [r.studentName, r.studentCode, r.className ?? "", r.behaviorType === "VIOLATION" ? "Vi phạm" : "Khen thưởng", catMap[r.category] ?? "", (r.behaviorType === "VIOLATION" ? "-" : "+") + Math.abs(r.points), r.recordDate, r.createdByName ?? ""]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ne-nep-${classId}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const headerAction = !metaLoading && classes.length > 0 && (
    <>
      <PrettySelect value={classId} onChange={(e) => setSelectedClassId(e.target.value)} className={selectCls} style={selStyle}>
        {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
      </PrettySelect>
      <PrettySelect value={semesterId} onChange={(e) => setSelectedSemesterId(e.target.value)} className={selectCls} style={selStyle}>
        {semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
      </PrettySelect>
      <button type="button" onClick={() => setShowCategoryManager(true)} className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[#F3F3F3]" style={{ borderColor: C.border, color: C.onSurface }}>
        <Ms name="tune" className="text-[18px]!" /> Danh mục
      </button>
      <button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: C.secondary }}>
        <Ms name="file_download" className="text-[18px]!" /> Xuất báo cáo
      </button>
      <div className="relative" ref={menuRef}>
        <button type="button" onClick={() => setCreateMenu((v) => !v)} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: C.orange }}>
          <Ms name="add" className="text-[18px]!" /> Ghi nhận sự việc
        </button>
        {createMenu && (
          <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border bg-white shadow-lg" style={{ borderColor: C.border }}>
            <button type="button" onClick={() => { setCreateType("POSITIVE"); setCreateMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#F3F3F3]" style={{ color: C.success }}><Ms name="add_circle" className="text-[18px]!" /> Khen thưởng</button>
            <button type="button" onClick={() => { setCreateType("VIOLATION"); setCreateMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#F3F3F3]" style={{ color: C.error }}><Ms name="do_not_disturb_on" className="text-[18px]!" /> Vi phạm</button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <StaffPageHeader title="Nề nếp" action={headerAction} />

      {metaError && <div className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}

      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />
      ) : classes.length === 0 ? (
        <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chưa có lớp học nào trong hệ thống.</div>
      ) : (
        <>
          <div className="mb-6 flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {TABS.map(({ key, label, ms }) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all"
                style={activeTab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                <Ms name={ms} className="text-[18px]!" /><span>{label}</span>
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <OverviewTab records={records} warnings={warnData?.items ?? []} catMap={catMap} onEdit={(r) => setEditRecord(r)} />
          )}
          {activeTab === "warnings" && (
            <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" style={{ border: `1px solid ${C.border}` }}>
              <WarningsTab classId={classId} semesterId={semesterId} />
            </div>
          )}
        </>
      )}

      {createType && (
        <BehaviourRecordModal mode="create" behaviorType={createType} students={studentsForModal}
          categories={createType === "POSITIVE" ? categories.merit : categories.violation}
          api={adminBehaviourApi}
          onClose={() => setCreateType(null)} onSaved={() => { setCreateType(null); bump(); }} />
      )}
      {editRecord && (
        <BehaviourRecordModal mode="edit" behaviorType={editRecord.behaviorType} record={editRecord}
          categories={editRecord.behaviorType === "POSITIVE" ? categories.merit : categories.violation}
          api={adminBehaviourApi}
          onClose={() => setEditRecord(null)} onSaved={() => { setEditRecord(null); bump(); }} />
      )}
      {showCategoryManager && (
        <BehaviourCategoryManagerModal onClose={() => { setShowCategoryManager(false); bump(); }} />
      )}
    </>
  );
}

export default AdminDisciplinePage;
