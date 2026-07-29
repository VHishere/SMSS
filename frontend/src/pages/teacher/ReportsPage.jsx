import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import PrettySelect from "../../components/molecules/PrettySelect";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { reportApi } from "../../api/client";
import { useAcademicMeta } from "../../hooks/useAcademicMeta";
import { useAcademicAnalytics } from "../../hooks/useAcademicAnalytics";
import { useBehaviourAnalytics } from "../../hooks/useBehaviourAnalytics";
import { useAcademicWarnings } from "../../hooks/useAcademicWarnings";
import { formatDateTimeVN, formatDateVN } from "../../utils/datetime";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", primary: "#9F4200",
  orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", tertiary: "#4A5F82",
  error: "#BA1A1A", success: "#15803D", surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style, fill = false }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}>{name}</span>;
}
function initials(n) { const p = (n || "").trim().split(/\s+/); return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?"; }
const GRADE_BADGE = { TOT: { bg: "#DCFCE7", text: "#15803D" }, KHA: { bg: "#EBF3FF", text: "#225DAD" }, TB: { bg: "#FEF3C7", text: "#B45309" }, YEU: { bg: "#FFDAD6", text: "#93000A" }, NA: { bg: "#F1F5F9", text: "#475569" } };
const STANDING_COLOR = { GIOI: "#15803D", KHA: "#225DAD", TB: "#B45309", YEU: "#F27123", KEM: "#BA1A1A", NA: "#64748B" };
const BUCKET_COLOR = { "0-3.5": "#BA1A1A", "3.5-5": "#B45309", "5-6.5": "#225DAD", "6.5-8": "#4A5F82", "8-10": "#15803D" };
const AVA = ["#00458E", "#225DAD", "#4A5F82", "#F27123"];
const selectCls = "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";
const selStyle = { borderColor: C.border, color: C.onSurface };

const REPORT_TYPES = [
  { key: "ACADEMIC", label: "Kết quả học tập" },
  { key: "ATTENDANCE", label: "Chuyên cần" },
  { key: "BEHAVIOUR", label: "Hạnh kiểm" },
  { key: "PROGRESS", label: "Tiến bộ học sinh" },
  { key: "CLASS_SUMMARY", label: "Tổng hợp lớp" },
  { key: "GOAL", label: "Hoàn thành mục tiêu" },
];
const typeLabel = (t) => REPORT_TYPES.find((r) => r.key === t)?.label ?? t;

function ReportsPage() {
  const { user } = useAuth();
  const isHomeroom = useMemo(() => !!user?.roles?.some((r) => r.roleName === "HOMEROOM_TEACHER"), [user]);
  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Khu vực" sidebarFooterValue="Báo cáo">
      {isHomeroom ? <HomeroomReportView teacherName={headerUser.name} /> : <ReportingView />}
    </DashboardShell>
  );
}

// ═══ Giáo viên bộ môn: Báo cáo & Xuất dữ liệu ═══════════════════════════════════
function ReportingView() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [cfg, setCfg] = useState({ type: "ACADEMIC", format: "PDF" });

  useEffect(() => {
    let m = true;
    reportApi.listTemplates().then((res) => { if (m) setTemplates(res.data); }).catch(() => {});
    reportApi.getHistory({ limit: 20 }).then((res) => { if (m) setHistory(res.data.items); }).catch(() => {});
    return () => { m = false; };
  }, [refresh]);

  const pdfCount = history.filter((h) => h.format === "PDF").length;
  const xlsxCount = history.filter((h) => h.format !== "PDF").length;
  const maxFmt = Math.max(pdfCount, xlsxCount, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Báo cáo & Xuất dữ liệu</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate("/teacher/reports/builder?type=ACADEMIC")} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: C.secondary }}><Ms name="bookmark" className="!text-[18px]" /> Mẫu đã lưu ({templates.length})</button>
          <button type="button" onClick={() => navigate("/teacher/reports/builder?type=" + cfg.type)} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: C.orange }}><Ms name="add" className="!text-[18px]" /> Tạo báo cáo mới</button>
        </div>
      </div>

      {/* Top usage stat cards (real report data) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Báo cáo đã xuất</p>
          <p className="text-4xl font-extrabold" style={{ color: C.orange }}>{history.length}</p>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>tổng số lượt xuất gần đây</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Định dạng phổ biến</p>
          {[["PDF", pdfCount, C.error], ["Excel", xlsxCount, C.success]].map(([label, n, col]) => (
            <div key={label} className="mb-2">
              <div className="mb-1 flex justify-between text-xs"><span style={{ color: C.onSurface }}>{label}</span><span className="font-bold" style={{ color: col }}>{n}</span></div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${(n / maxFmt) * 100}%`, backgroundColor: col }} /></div>
            </div>
          ))}
        </div>
        <div className="rounded-3xl p-5 text-white shadow-sm" style={{ backgroundColor: C.deepBlue }}>
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Mẫu & tự động hoá</p>
          <p className="text-4xl font-extrabold">{templates.length}</p>
          <p className="mt-1 text-xs opacity-80">mẫu báo cáo đã lưu để tái sử dụng</p>
        </div>
      </div>

      {/* Config row */}
      <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <h3 className="mb-4 flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="tune" style={{ color: C.orange }} /> Cấu hình báo cáo</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="mb-1 block text-[11px] font-bold uppercase" style={{ color: C.muted }}>Danh mục báo cáo</label>
            <PrettySelect value={cfg.type} onChange={(e) => setCfg((c) => ({ ...c, type: e.target.value }))} className={`${selectCls} w-full`} style={selStyle}>
              {REPORT_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </PrettySelect>
          </div>
          <div><label className="mb-1 block text-[11px] font-bold uppercase" style={{ color: C.muted }}>Định dạng xuất</label>
            <div className="flex gap-2">
              {["PDF", "Excel"].map((f) => (
                <button key={f} type="button" onClick={() => setCfg((c) => ({ ...c, format: f }))} className="flex-1 rounded-xl border py-2 text-sm font-medium" style={cfg.format === f ? { borderColor: C.orange, color: C.orange, backgroundColor: "rgba(242,113,35,0.08)" } : { borderColor: C.border, color: C.muted }}>{f}</button>
              ))}
            </div>
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-2">
            <button type="button" onClick={() => navigate(`/teacher/reports/builder?type=${cfg.type}`)} className="w-full rounded-full py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: C.orange }}>Tạo bản xem trước</button>
          </div>
        </div>
      </div>

      {/* Export center */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
          <h3 className="flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="folder_open" style={{ color: C.orange }} /> Trung tâm xuất dữ liệu</h3>
          <button type="button" onClick={() => setRefresh((k) => k + 1)} className="flex items-center gap-1 text-xs" style={{ color: C.muted }}><Ms name="refresh" className="!text-[16px]" /> Làm mới</button>
        </div>
        {history.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">Chưa có lượt xuất nào.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                <tr>{["Tên tài liệu", "Loại báo cáo", "Ngày tạo", "Định dạng", "Trạng thái", "Thao tác"].map((h) => <th key={h} className="px-5 py-3 text-xs font-medium uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: C.border }}>
                {history.map((h) => {
                  const ready = !!h.fileUrl;
                  return (
                    <tr key={h.reportId} className="group transition-colors hover:bg-[#F3F3F3]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: h.format === "PDF" ? "#FFE4E6" : "rgba(21,128,61,0.12)", color: h.format === "PDF" ? C.error : C.success }}><Ms name={h.format === "PDF" ? "picture_as_pdf" : "table_view"} className="!text-[18px]" /></div>
                          <span className="text-sm font-semibold" style={{ color: C.onSurface }}>{h.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5" style={{ color: C.muted }}>{typeLabel(h.reportType)}</td>
                      <td className="px-5 py-3.5" style={{ color: C.muted }}>{formatDateTimeVN(h.createdAt)}</td>
                      <td className="px-5 py-3.5"><span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: C.surfaceHigh, color: C.muted }}>{h.format}</span></td>
                      <td className="px-5 py-3.5"><span className="flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={ready ? { backgroundColor: "#DCFCE7", color: C.success } : { backgroundColor: "#FEF3C7", color: C.primary }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ready ? C.success : C.primary }} />{ready ? "Sẵn sàng" : "Đang xử lý"}</span></td>
                      <td className="px-5 py-3.5">{ready ? <a href={h.fileUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg p-2 hover:bg-[#F27123]/10" style={{ color: C.orange }}><Ms name="download" className="!text-[18px]" /></a> : <span className="text-xs text-slate-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ Giáo viên chủ nhiệm: Báo cáo chủ nhiệm ═════════════════════════════════════
function HStat({ label, value, sub, icon, color }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}`, borderTop: `3px solid ${color}` }}>
      <div className="mb-1 flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p><Ms name={icon} className="!text-[18px]" style={{ color }} /></div>
      <p className="text-3xl font-extrabold leading-none" style={{ color }}>{value}</p>
      {sub && <p className="mt-1.5 text-xs" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );
}
const HR_TABS = [{ key: "week", label: "Tổng kết tuần", ms: "calendar_view_week" }, { key: "month", label: "Tổng kết tháng", ms: "calendar_month" }, { key: "semester", label: "Đánh giá học kỳ", ms: "school" }];

function HomeroomReportView({ teacherName }) {
  const navigate = useNavigate();
  const { data: meta } = useAcademicMeta();
  const [tab, setTab] = useState("week");
  const [history, setHistory] = useState([]);

  const classes = useMemo(() => { const m = {}; for (const a of meta?.assignments ?? []) m[a.classId] = a.className; return Object.entries(m).map(([id, name]) => ({ id, name })); }, [meta]);
  const classId = classes[0]?.id ?? "";
  const semesterId = meta?.semesters?.[0]?.semesterId ? String(meta.semesters[0].semesterId) : "";
  const className = classes[0]?.name ?? "";

  const { data: academic } = useAcademicAnalytics(classId, semesterId, Boolean(classId && semesterId));
  const { data: behaviour } = useBehaviourAnalytics(classId, semesterId, Boolean(classId && semesterId));
  const warnFilters = useMemo(() => ({ classId, semesterId }), [classId, semesterId]);
  const { data: warnings } = useAcademicWarnings(warnFilters, Boolean(classId && semesterId));

  useEffect(() => { let m = true; reportApi.getHistory({ limit: 6 }).then((res) => { if (m) setHistory(res.data.items); }).catch(() => {}); return () => { m = false; }; }, []);

  const acadStudents = academic?.students ?? [];
  const behMap = useMemo(() => Object.fromEntries((behaviour?.students ?? []).map((s) => [s.studentId, s])), [behaviour]);
  const matrix = acadStudents.map((s) => ({ ...s, grade: behMap[s.studentId]?.grade, finalScore: behMap[s.studentId]?.finalScore }));
  const dist = academic?.distribution ?? [];
  const distMax = Math.max(...dist.map((d) => d.count), 1);
  const totGood = (behaviour?.students ?? []).filter((s) => s.grade?.key === "TOT").length;
  const riskCount = warnings?.items?.length ?? 0;
  const notes = (warnings?.items ?? []).filter((w) => w.note).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Báo cáo chủ nhiệm{className ? ` · ${className}` : ""}</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: C.border, color: C.onSurface }}>{meta?.semesters?.[0]?.semesterName ?? "Học kỳ hiện tại"}</button>
          <button type="button" onClick={() => navigate("/teacher/reports/builder?type=CLASS_SUMMARY")} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: C.orange }}><Ms name="file_download" className="!text-[18px]" /> Xuất tất cả báo cáo</button>
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HStat label="Sĩ số lớp" value={academic?.summary?.totalStudents ?? "—"} sub={`${academic?.summary?.scored ?? 0} HS đã có điểm`} icon="groups" color={C.secondary} />
        <HStat label="Điểm GPA trung bình" value={academic?.summary?.classAverage ?? "—"} sub="Trung bình toàn lớp" icon="trending_up" color={C.orange} />
        <HStat label="Xếp loại hạnh kiểm" value="Tốt" sub={`${totGood} học sinh loại Tốt`} icon="verified_user" color={C.success} />
        <HStat label="Cảnh báo rủi ro" value={String(riskCount).padStart(2, "0")} sub="Học sinh cần hỗ trợ" icon="warning" color={C.error} />
      </div>

      {/* Tabs — dạng pill bo tròn, di chuyển trong thẻ (giống trang Điểm số) */}
      <div className="flex w-fit items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
        {HR_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all" style={tab === t.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
            <Ms name={t.ms} className="!text-[18px]" /><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Recent reports */}
      <div>
        <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="event_note" style={{ color: C.secondary }} /> Báo cáo gần đây</h3><button type="button" onClick={() => navigate("/teacher/reports/builder?type=CLASS_SUMMARY")} className="text-xs font-bold hover:underline" style={{ color: C.orange }}>Xem lịch sử</button></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {history.slice(0, 2).map((h) => (
            <button key={h.reportId} type="button" onClick={() => h.fileUrl && window.open(h.fileUrl, "_blank")} className="rounded-3xl bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ border: `1px solid ${C.border}` }}>
              <div className="mb-2 flex items-center justify-between"><span className="rounded px-2 py-0.5 text-[10px] font-bold" style={h.fileUrl ? { backgroundColor: "#DCFCE7", color: C.success } : { backgroundColor: "#FEF3C7", color: C.primary }}>{h.fileUrl ? "HOÀN THÀNH" : "ĐANG XỬ LÝ"}</span><span className="text-[10px] text-slate-400">{formatDateVN(h.createdAt)}</span></div>
              <p className="text-sm font-bold" style={{ color: C.onSurface }}>{h.title}</p>
              <p className="text-xs" style={{ color: C.muted }}>{typeLabel(h.reportType)} · {h.format}</p>
            </button>
          ))}
          <button type="button" onClick={() => navigate("/teacher/reports/builder?type=CLASS_SUMMARY")} className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 text-center transition-colors hover:border-[#F27123]" style={{ borderColor: C.border }}>
            <Ms name="add_circle" className="!text-[28px]" style={{ color: C.orange }} /><p className="mt-1 text-sm font-bold" style={{ color: C.orange }}>Tạo báo cáo mới</p>
          </button>
        </div>
      </div>

      {/* Student matrix */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="border-b p-5" style={{ borderColor: C.border }}><h3 className="font-bold" style={{ color: C.onSurface }}>Ma trận kết quả học sinh</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
              <tr>{["Họ và tên", "Mã HS", "GPA hiện tại", "Hạnh kiểm", "Hiệu suất", "Thao tác"].map((h) => <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {matrix.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Chưa có dữ liệu.</td></tr> : matrix.map((s, i) => {
                const gb = GRADE_BADGE[s.grade?.key] ?? GRADE_BADGE.NA;
                const pct = s.gpa != null ? Math.round(s.gpa * 10) : 0;
                return (
                  <tr key={s.studentId} className="transition-colors hover:bg-[#F3F3F3]">
                    <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: AVA[i % AVA.length] }}>{initials(s.studentName)}</div><span className="text-sm font-medium" style={{ color: C.onSurface }}>{s.studentName}</span></div></td>
                    <td className="px-4 py-3 text-slate-400">{s.studentCode}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: STANDING_COLOR[s.standing?.key] ?? C.onSurface }}>{s.gpa ?? "—"}</td>
                    <td className="px-4 py-3">{s.grade ? <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: gb.bg, color: gb.text }}>{s.grade.label}</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? C.success : pct >= 65 ? C.secondary : C.orange }} /></div><span className="text-xs font-semibold" style={{ color: C.muted }}>{pct}%</span></div></td>
                    <td className="px-4 py-3"><button type="button" onClick={() => navigate(`/teacher/students/${s.studentId}?semesterId=${semesterId}`)} className="rounded-lg p-2 transition-colors hover:bg-[#F27123]/10" style={{ color: C.orange }}><Ms name="assignment" className="!text-[18px]" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* GPA distribution + teacher notes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-4 font-bold" style={{ color: C.onSurface }}>Phân bố GPA{className ? ` (${className})` : ""}</h3>
          {dist.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p> : (
            <div className="flex items-end justify-around gap-3" style={{ height: 170 }}>
              {dist.map((d) => (
                <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-sm font-bold" style={{ color: C.onSurface }}>{d.count}</span>
                  <div className="w-full max-w-[52px] rounded-t-lg" style={{ height: `${(d.count / distMax) * 120 + 4}px`, backgroundColor: BUCKET_COLOR[d.key] ?? "#94A3B8" }} />
                  <span className="mt-2 text-center text-[10px]" style={{ color: C.muted }}>{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-4 font-bold" style={{ color: C.onSurface }}>Ghi chú của giáo viên</h3>
          {notes.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Chưa có ghi chú cảnh báo nào.</p> : (
            <div className="space-y-3">
              {notes.map((w, i) => (
                <div key={w.warningId ?? i} className="rounded-2xl p-3" style={{ backgroundColor: "rgba(242,113,35,0.06)", borderLeft: `3px solid ${C.orange}` }}>
                  <p className="text-sm" style={{ color: C.onSurface }}><span className="font-bold">{w.studentName}: </span>{w.note}</p>
                  <p className="mt-1 text-[11px]" style={{ color: C.muted }}>{w.gpaSnapshot != null ? `GPA ${w.gpaSnapshot}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => navigate("/teacher/announcements")} className="flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}><Ms name="campaign" /></div>
          <div><p className="font-bold" style={{ color: C.onSurface }}>Gửi thông báo tổng hợp</p><p className="text-xs" style={{ color: C.muted }}>Gửi bản cập nhật tới phụ huynh lớp</p></div>
        </button>
        <button type="button" onClick={() => navigate("/teacher/conduct")} className="flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.orange }}><Ms name="task_alt" /></div>
          <div><p className="font-bold" style={{ color: C.onSurface }}>Đánh giá hạnh kiểm cuối kỳ</p><p className="text-xs" style={{ color: C.muted }}>Xác nhận điểm & xếp loại hạnh kiểm</p></div>
        </button>
      </div>
    </div>
  );
}

export default ReportsPage;
