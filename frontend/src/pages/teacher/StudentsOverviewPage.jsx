import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import PrettySelect from "../../components/molecules/PrettySelect";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useClassOverview } from "../../hooks/useClassOverview";
import { useStudentMeta } from "../../hooks/useStudentMeta";

// ─── FSchool Stitch design tokens ────────────────────────────────────────────
const C = {
  onSurface: "#1A1C1C",
  muted: "#584238",
  border: "#DFC0B2",
  orange: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  success: "#15803D",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

function initials(name) {
  const p = (name || "").trim().split(/\s+/);
  if (!p.length) return "?";
  if (p.length === 1) return p[0][0]?.toUpperCase() ?? "?";
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// "Cần quan tâm" thay cho "Rủi ro" cho bớt tiêu cực.
const ATTENTION = {
  HIGH:   { label: "Ưu tiên",      bg: "#FFDAD6", text: "#93000A" },
  MEDIUM: { label: "Cần theo dõi", bg: "#FEF3C7", text: "#B45309" },
  LOW:    { label: "Lưu ý",        bg: "rgba(242,113,35,0.12)", text: "#9F4200" },
  NONE:   { label: "Ổn định",      bg: "#DCFCE7", text: "#15803D" },
};

// Xếp loại hạnh kiểm theo điểm rèn luyện (đồng bộ CONDUCT_BANDS phía backend, keys TT22).
const CONDUCT_BANDS = [
  { key: "TOT", min: 80, label: "Tốt",      bg: "#DCFCE7", text: "#15803D" },
  { key: "KHA", min: 65, label: "Khá",      bg: "rgba(34,93,173,0.12)", text: "#00458E" },
  { key: "TB",  min: 50, label: "Đạt",      bg: "#FEF3C7", text: "#B45309" },
  { key: "YEU", min: 0,  label: "Chưa đạt", bg: "#FFDAD6", text: "#93000A" },
];

function conductGrade(score) {
  if (score === null || score === undefined) {
    return { key: "NA", label: "Chưa đánh giá", bg: "#E8E8E8", text: "#584238" };
  }
  return CONDUCT_BANDS.find((b) => score >= b.min) ?? CONDUCT_BANDS[CONDUCT_BANDS.length - 1];
}

const selectCls =
  "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";
const selStyle = { borderColor: C.border, color: C.onSurface };

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-[2rem] bg-white p-4 shadow-sm" style={{ borderLeft: `4px solid ${accent}` }}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
      <p className="text-3xl font-extrabold leading-none" style={{ color: accent }}>{value}</p>
    </div>
  );
}

function StudentsOverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: meta, loading: metaLoading } = useStudentMeta();

  const [classId,       setClassId]       = useState("");
  const [semesterId,    setSemesterId]    = useState("");
  // Khởi tạo từ ?search= (ô tìm kiếm header điều hướng tới đây kèm từ khóa).
  const [search,        setSearch]        = useState(searchParams.get("search") ?? "");
  const [riskFilter,    setRiskFilter]    = useState("");
  const [conductFilter, setConductFilter] = useState("");
  const [sort,          setSort]          = useState({ key: "name", dir: "asc" });

  const classes   = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];
  const effClassId    = classId    || (classes[0]?.classId ? String(classes[0].classId) : "");
  const effSemesterId = semesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");

  const { data, loading, error } = useClassOverview(effClassId, effSemesterId, Boolean(effClassId));

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  function toggleSort(key) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  const filtered = useMemo(() => {
    let list = data?.students ?? [];
    if (riskFilter) list = list.filter((s) => s.riskLevel === riskFilter);
    if (conductFilter) list = list.filter((s) => conductGrade(s.conductScore).key === conductFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.studentName.toLowerCase().includes(q) || s.studentCode.toLowerCase().includes(q));
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort.key === "name") {
        return sort.dir === "asc"
          ? a.studentName.localeCompare(b.studentName)
          : b.studentName.localeCompare(a.studentName);
      }
      let av; let bv;
      if (sort.key === "attendance")   { av = a.attendanceRate ?? -1; bv = b.attendanceRate ?? -1; }
      else if (sort.key === "conduct") { av = a.conductScore ?? -1;   bv = b.conductScore ?? -1; }
      else                             { av = a.activeGoals ?? 0;     bv = b.activeGoals ?? 0; }
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return sorted;
  }, [data, riskFilter, conductFilter, search, sort]);

  const summary = data?.summary ?? { total: 0, high: 0, medium: 0, low: 0 };

  const sortIcon = (key) =>
    sort.key === key
      ? <Ms name={sort.dir === "asc" ? "arrow_upward" : "arrow_downward"} className="!text-[13px]" />
      : null;

  const TH = "px-4 py-3 text-xs font-medium uppercase tracking-wider";

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp"
      sidebarFooterValue={classes.find((c) => String(c.classId) === effClassId)?.className ?? "—"}
    >
      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-[2rem] bg-slate-200/60" />
      ) : classes.length === 0 ? (
        <div className="rounded-[2rem] px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>
          Bạn chưa phụ trách lớp nào.
        </div>
      ) : (
        <>
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Quản lý học sinh</h2>

          {/* Chọn lớp — pill */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Lớp phụ trách</p>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => {
                const active = String(c.classId) === effClassId;
                return (
                  <button key={c.classId} type="button" onClick={() => setClassId(String(c.classId))}
                    className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition"
                    style={active
                      ? { backgroundColor: C.orange, color: "#fff", boxShadow: "0 4px 12px rgba(242,113,35,0.30)" }
                      : { backgroundColor: "#fff", color: C.onSurface, border: `1px solid ${C.border}` }}>
                    <Ms name="school" className="!text-[16px]" /> {c.className}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bộ lọc phụ */}
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Học kỳ</label>
              <PrettySelect value={effSemesterId} onChange={(e) => setSemesterId(e.target.value)} className={selectCls} style={selStyle}>
                {semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
              </PrettySelect>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Mức quan tâm</label>
              <PrettySelect value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className={selectCls} style={selStyle}>
                <option value="">Tất cả</option>
                <option value="HIGH">Ưu tiên</option>
                <option value="MEDIUM">Cần theo dõi</option>
                <option value="LOW">Lưu ý</option>
                <option value="NONE">Ổn định</option>
              </PrettySelect>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Hạnh kiểm</label>
              <PrettySelect value={conductFilter} onChange={(e) => setConductFilter(e.target.value)} className={selectCls} style={selStyle}>
                <option value="">Tất cả</option>
                <option value="TOT">Tốt</option>
                <option value="KHA">Khá</option>
                <option value="TB">Đạt</option>
                <option value="YEU">Chưa đạt</option>
                <option value="NA">Chưa đánh giá</option>
              </PrettySelect>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Tìm học sinh</label>
              <div className="flex items-center rounded-full border bg-white px-3 shadow-sm" style={{ borderColor: C.border }}>
                <Ms name="search" className="!text-[18px]" style={{ color: "#94A3B8" }} />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên hoặc mã..."
                  className="w-44 bg-transparent px-2 py-2 text-sm outline-none" style={{ color: C.onSurface }} />
              </div>
            </div>
          </div>

          {/* Tổng hợp mức quan tâm */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Tổng học sinh" value={summary.total} accent={C.secondary} />
            <StatCard label="Ưu tiên" value={summary.high} accent="#BA1A1A" />
            <StatCard label="Cần theo dõi" value={summary.medium} accent="#B45309" />
            <StatCard label="Lưu ý" value={summary.low} accent={C.orange} />
          </div>

          {error && <div className="rounded-[2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {loading && <div className="space-y-2">{[0, 1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded-[2rem] bg-slate-200/60" />)}</div>}

          {!loading && !error && data && (
            !filtered.length ? (
              <div className="rounded-[2rem] bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                Không có học sinh phù hợp.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                      <tr className="text-left">
                        <th className={TH}><button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 uppercase">Học sinh {sortIcon("name")}</button></th>
                        <th className={TH}><button type="button" onClick={() => toggleSort("attendance")} className="inline-flex items-center gap-1 uppercase">Chuyên cần {sortIcon("attendance")}</button></th>
                        <th className={TH}><button type="button" onClick={() => toggleSort("conduct")} className="inline-flex items-center gap-1 uppercase">Hạnh kiểm {sortIcon("conduct")}</button></th>
                        <th className={TH}><button type="button" onClick={() => toggleSort("goals")} className="inline-flex items-center gap-1 uppercase">Mục tiêu {sortIcon("goals")}</button></th>
                        <th className={TH}>Cần quan tâm</th>
                        <th className={TH} />
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: C.border }}>
                      {filtered.map((s) => {
                        const rc = ATTENTION[s.riskLevel] ?? ATTENTION.NONE;
                        const cg = conductGrade(s.conductScore);
                        return (
                          <tr key={s.studentId} className="cursor-pointer transition-colors hover:bg-[#F3F3F3]"
                            onClick={() => navigate(`/teacher/students/${s.studentId}?semesterId=${effSemesterId}`)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>
                                  {s.studentAvatar ? <img src={s.studentAvatar} alt={s.studentName} className="h-8 w-8 rounded-full object-cover" /> : initials(s.studentName)}
                                </div>
                                <div>
                                  <div className="text-sm font-medium" style={{ color: C.onSurface }}>{s.studentName}</div>
                                  <div className="text-xs text-slate-400">{s.studentCode}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{s.attendanceRate === null ? "—" : `${s.attendanceRate}%`}</td>
                            <td className="px-4 py-3">
                              <span title={s.conductScore != null ? `${s.conductScore}đ rèn luyện` : undefined}
                                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                                style={{ backgroundColor: cg.bg, color: cg.text }}>{cg.label}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{s.activeGoals}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: rc.bg, color: rc.text }}>{rc.label}</span>
                              {s.riskReasons?.length > 0 && (
                                <span title={s.riskReasons.join("\n")} className="ml-1 inline-flex"><Ms name="warning" className="!text-[13px]" style={{ color: rc.text }} /></span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/teacher/students/${s.studentId}?semesterId=${effSemesterId}`); }}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
                                <Ms name="person" className="!text-[13px]" /> Hồ sơ
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default StudentsOverviewPage;
