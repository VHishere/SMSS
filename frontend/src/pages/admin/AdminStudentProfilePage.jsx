import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { staffApi } from "../../api/client";
import Modal from "../../components/atoms/Modal";
import { StaffField, inputClass } from "../../components/staff/StaffFormCard";
import { useAdminStudentProfile } from "../../hooks/useAdminStudentProfile";
import { useAdminStudentGoals } from "../../hooks/useAdminStudentGoals";
import { useAdminStudentAcademic } from "../../hooks/useAdminStudentAcademic";
import { useAdminStudentBehaviour } from "../../hooks/useAdminStudentBehaviour";
import { formatDateVN } from "../../utils/datetime";

const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", surfaceLow: "#F3F3F3" };
function Ms({ name, className = "", style, fill = false }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}>{name}</span>;
}

const TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "academic", label: "Kết quả học tập" },
  { key: "roadmap", label: "Mục tiêu & Lộ trình" },
  { key: "rewards", label: "Khen thưởng & Kỷ luật" },
];
const GOAL_TYPE_LABEL = { ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PERSONAL: "Phát triển cá nhân" };

function ageOf(dob) {
  if (!dob) return null;
  const d = new Date(dob); if (Number.isNaN(d.getTime())) return null;
  const now = new Date(); let a = now.getFullYear() - d.getFullYear();
  const mm = now.getMonth() - d.getMonth();
  if (mm < 0 || (mm === 0 && now.getDate() < d.getDate())) a--;
  return a;
}
function subjectBand(avg) {
  if (avg === null || avg === undefined) return null;
  if (avg >= 8.5) return { label: "XUẤT SẮC", bg: "#DCFCE7", text: "#15803D" };
  if (avg >= 8) return { label: "GIỎI", bg: "#DCFCE7", text: "#15803D" };
  if (avg >= 6.5) return { label: "KHÁ", bg: "#EBF3FF", text: "#225DAD" };
  if (avg >= 5) return { label: "TRUNG BÌNH", bg: "#FEF3C7", text: "#B45309" };
  return { label: "YẾU", bg: "#FFDAD6", text: "#93000A" };
}

// ─── GPA trend line chart (real per-semester GPA) ─────────────────────────────
function TrendChart({ history }) {
  const stepX = 96, padX = 40, padTop = 24, chartH = 130, padBottom = 30;
  const n = history.length;
  const W = padX * 2 + Math.max(1, n - 1) * stepX;
  const H = padTop + chartH + padBottom;
  const baseY = padTop + chartH;
  const x = (i) => padX + i * stepX;
  const y = (g) => padTop + (1 - Math.min(g, 10) / 10) * chartH;
  const pts = history.map((s, i) => `${x(i)},${y(s.gpa)}`).join(" ");
  const area = n ? `M ${x(0)},${baseY} ${history.map((s, i) => `L ${x(i)},${y(s.gpa)}`).join(" ")} L ${x(n - 1)},${baseY} Z` : "";
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {[0, 2.5, 5, 7.5, 10].map((g) => (
          <g key={g}>
            <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#F1F5F9" strokeWidth="1" />
            <text x={padX - 12} y={y(g) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{g}</text>
          </g>
        ))}
        {n > 1 && <path d={area} fill="rgba(242,113,35,0.10)" />}
        {n > 1 && <polyline points={pts} fill="none" stroke={C.orange} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {history.map((s, i) => (
          <g key={s.semesterId}>
            <circle cx={x(i)} cy={y(s.gpa)} r="4.5" fill="#fff" stroke={C.orange} strokeWidth="2.5" />
            <text x={x(i)} y={y(s.gpa) - 11} fontSize="11" fontWeight="700" fill={C.onSurface} textAnchor="middle">{s.gpa}</text>
            <text x={x(i)} y={baseY + 17} fontSize="9" fill="#64748B" textAnchor="middle">{s.semesterName}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Edits the student's personal info only (name/email/phone/DOB/gender/
// address) via the same endpoint staff's student form uses. studentCode and
// status are resent unchanged so the update doesn't clobber them.
function EditPersonalInfoModal({ studentId, profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: profile.fullName || "",
    email: profile.email || "",
    phone: profile.phone || "",
    dateOfBirth: profile.dateOfBirth || "",
    gender: profile.gender || "OTHER",
    address: profile.address || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await staffApi.updateStudent(studentId, {
        ...form,
        studentCode: profile.studentCode,
        status: profile.studentStatus,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Sửa thông tin cá nhân" onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StaffField label="Họ và tên" className="sm:col-span-2">
            <input className={inputClass} value={form.fullName} onChange={setField("fullName")} required />
          </StaffField>

          <StaffField label="Email">
            <input type="email" className={inputClass} value={form.email} onChange={setField("email")} required />
          </StaffField>

          <StaffField label="Điện thoại">
            <input className={inputClass} value={form.phone} onChange={setField("phone")} />
          </StaffField>

          <StaffField label="Ngày sinh">
            <input type="date" className={inputClass} value={form.dateOfBirth} onChange={setField("dateOfBirth")} />
          </StaffField>

          <StaffField label="Giới tính">
            <select className={inputClass} value={form.gender} onChange={setField("gender")}>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </select>
          </StaffField>

          <StaffField label="Địa chỉ" className="sm:col-span-2">
            <input className={inputClass} value={form.address} onChange={setField("address")} />
          </StaffField>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0F2747]"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#F27123] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Admin equivalent of the teacher student-profile page — same 360 view
// (overview/academic/goals/discipline) for any student in the school.
// Read-only except for editing the student's own personal info.
function AdminStudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "overview";
  const semParam = sp.get("semesterId") || "";

  const [refreshKey, setRefreshKey] = useState(0);
  const [showEdit, setShowEdit] = useState(false);

  const { data: prof, loading, error } = useAdminStudentProfile(studentId, semParam, refreshKey);
  const effSem = prof?.targetSemesterId ? String(prof.targetSemesterId) : semParam;
  const { data: acad } = useAdminStudentAcademic(studentId, effSem);
  const { data: beh } = useAdminStudentBehaviour(studentId, effSem);
  const { data: goals } = useAdminStudentGoals(studentId, {});

  const p = prof?.profile;
  const att = prof?.attendance ?? {};
  const primaryGuardian = p?.guardians?.find((g) => g.isPrimary) ?? p?.guardians?.[0];

  function setTab(key) { const n = { tab: key }; if (effSem) n.semesterId = effSem; setSp(n); }
  function setSem(v) { setSp({ tab, semesterId: v }); }

  const teacherNote = useMemo(() => {
    const c = beh?.conductHistory?.find((h) => h.comment)?.comment;
    if (c) return c;
    return (goals ?? []).find((g) => g.teacherRemark)?.teacherRemark ?? "";
  }, [beh, goals]);

  return (
    <>
      {loading && <div className="space-y-4"><div className="h-16 animate-pulse rounded-3xl bg-slate-100" /><div className="h-96 animate-pulse rounded-3xl bg-slate-100" /></div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && prof && p && (
        <>
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <nav className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
              <button type="button" onClick={() => navigate("/admin/students")} className="hover:text-[#F27123]">Học sinh</button>
              <Ms name="chevron_right" className="text-[14px]!" />
              <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ backgroundColor: C.orange }}>{p.className ?? "—"}</span>
              <Ms name="chevron_right" className="text-[14px]!" />
              <span className="font-bold" style={{ color: C.orange }}>Hồ sơ</span>
            </nav>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowEdit(true)} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90" style={{ backgroundColor: C.orange }}>
                <Ms name="edit" className="text-[16px]!" /> Sửa thông tin cá nhân
              </button>
              <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-[#225DAD]/5" style={{ borderColor: C.secondary, color: C.secondary }}>
                <Ms name="print" className="text-[16px]!" /> Xuất dữ liệu
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {/* ── Left: student info ── */}
            <div className="space-y-6 lg:col-span-3">
              <div className="flex flex-col items-center rounded-3xl border bg-white p-6 text-center shadow-sm" style={{ borderColor: C.border }}>
                <div className="relative mb-4">
                  {p.avatar
                    ? <img src={p.avatar} alt={p.fullName} className="h-32 w-32 rounded-2xl border-4 border-white object-cover shadow-sm" />
                    : <div className="flex h-32 w-32 items-center justify-center rounded-2xl text-4xl font-bold text-white shadow-sm" style={{ backgroundColor: C.deepBlue }}>{p.fullName?.[0]?.toUpperCase() ?? "?"}</div>}
                  <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white" style={{ backgroundColor: "#22C55E" }}>
                    <Ms name="check_circle" className="text-[14px]! text-white" fill />
                  </div>
                </div>
                <h2 className="text-xl font-bold" style={{ color: C.onSurface }}>{p.fullName}</h2>
                <p className="mt-1 text-sm font-bold" style={{ color: C.orange }}>MSHS: {p.studentCode}</p>
                <div className="my-5 h-px w-full" style={{ backgroundColor: C.border }} />
                <dl className="w-full space-y-4 text-left">
                  {[
                    ["Lớp học", `${p.className ?? "—"}${p.gradeName ? ` - ${p.gradeName}` : ""}`],
                    ["Ngày sinh", p.dateOfBirth ? `${formatDateVN(p.dateOfBirth)}${ageOf(p.dateOfBirth) != null ? ` (${ageOf(p.dateOfBirth)} tuổi)` : ""}` : "—"],
                    ["Giới tính", p.gender === "MALE" ? "Nam" : p.gender === "FEMALE" ? "Nữ" : "Khác"],
                    ["Liên hệ", p.phone ?? "—"],
                    ["Địa chỉ", p.address ?? "—"],
                    ["Phụ huynh/Giám hộ", primaryGuardian ? `${primaryGuardian.fullName}${primaryGuardian.relationship ? ` (${primaryGuardian.relationship})` : ""}` : "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{k}</dt>
                      <dd className="text-sm font-medium" style={{ color: C.onSurface }}>{v}</dd>
                    </div>
                  ))}
                </dl>
                {primaryGuardian?.phone && (
                  <a href={`tel:${primaryGuardian.phone}`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
                    <Ms name="call" className="text-[16px]!" /> Liên hệ phụ huynh
                  </a>
                )}
              </div>

              {teacherNote && (
                <div className="relative overflow-hidden rounded-3xl border p-6" style={{ backgroundColor: "rgba(242,113,35,0.05)", borderColor: "rgba(242,113,35,0.25)" }}>
                  <Ms name="format_quote" className="absolute -bottom-2 -right-2 rotate-12 text-[64px]!" style={{ color: "rgba(242,113,35,0.12)" }} />
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: C.orange }}>Ghi chú gần nhất</h4>
                  <p className="relative z-10 text-sm italic leading-relaxed" style={{ color: C.onSurface }}>“{teacherNote}”</p>
                </div>
              )}
            </div>

            {/* ── Right: tabs ── */}
            <div className="lg:col-span-9">
              <div className="mb-4 flex w-full gap-1 overflow-x-auto rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
                {TABS.map((t) => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)}
                    className="flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all"
                    style={tab === t.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: C.border, minHeight: 560 }}>
                {tab === "overview" && <OverviewTab acad={acad} att={att} beh={beh} />}
                {tab === "academic" && <AcademicTab acad={acad} semesters={prof.semesters ?? []} effSem={effSem} setSem={setSem} />}
                {tab === "roadmap" && <RoadmapTab goals={goals} acad={acad} />}
                {tab === "rewards" && <RewardsTab beh={beh} note={teacherNote} />}
              </div>
            </div>
          </div>

          {showEdit && (
            <EditPersonalInfoModal
              studentId={studentId}
              profile={p}
              onClose={() => setShowEdit(false)}
              onSaved={() => {
                setShowEdit(false);
                setRefreshKey((k) => k + 1);
              }}
            />
          )}
        </>
      )}
    </>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({ acad, att, beh }) {
  const gpa = acad?.current?.gpa ?? null;
  const sums = acad?.semesterSummaries ?? [];
  const curIdx = sums.findIndex((s) => s.semesterId === acad?.current?.semesterId);
  const prev = curIdx >= 0 ? sums[curIdx + 1] : null;
  const delta = (gpa != null && prev?.gpa != null) ? +(gpa - prev.gpa).toFixed(1) : null;
  const rate = att?.attendanceRate ?? null;

  const activity = useMemo(() => {
    const merits = (beh?.merits ?? []).map((m) => ({ ...m, kind: "merit" }));
    const dems = (beh?.demerits ?? []).map((m) => ({ ...m, kind: "demerit" }));
    return [...merits, ...dems].sort((a, b) => String(b.recordDate).localeCompare(String(a.recordDate))).slice(0, 4);
  }, [beh]);
  const dot = { merit: "#22C55E", demerit: "#DC2626" };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border p-6" style={{ backgroundColor: C.surfaceLow, borderColor: "rgba(223,192,178,0.4)" }}>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ backgroundColor: "rgba(242,113,35,0.1)", color: C.orange }}><Ms name="trending_up" /></div>
            <h3 className="font-bold" style={{ color: C.onSurface }}>Kết quả học tập gần đây</h3>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: C.muted }}>GPA {acad?.current?.semesterName ?? "học kỳ"}</span>
            <span className="text-lg font-bold" style={{ color: C.onSurface }}>{gpa != null ? `${gpa}/10` : "—"}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(223,192,178,0.3)" }}>
            <div className="h-full rounded-full" style={{ width: `${gpa != null ? gpa * 10 : 0}%`, backgroundColor: C.orange }} />
          </div>
          {delta != null && (
            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium" style={{ color: delta >= 0 ? "#16A34A" : "#DC2626" }}>
              <Ms name={delta >= 0 ? "arrow_upward" : "arrow_downward"} className="text-[14px]!" /> {delta >= 0 ? "+" : ""}{delta} so với kỳ trước
            </p>
          )}
        </div>

        <div className="rounded-2xl border p-6" style={{ backgroundColor: C.surfaceLow, borderColor: "rgba(223,192,178,0.4)" }}>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}><Ms name="event_available" /></div>
            <h3 className="font-bold" style={{ color: C.onSurface }}>Chuyên cần</h3>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: C.muted }}>Tỉ lệ có mặt</span>
            <span className="text-lg font-bold" style={{ color: C.onSurface }}>{rate != null ? `${rate}%` : "—"}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(223,192,178,0.3)" }}>
            <div className="h-full rounded-full" style={{ width: `${rate ?? 0}%`, backgroundColor: C.secondary }} />
          </div>
          <p className="mt-2 text-[11px] italic" style={{ color: C.muted }}>Vắng có phép: {String(att?.absentExcused ?? 0).padStart(2, "0")} | Vắng không phép: {String(att?.absentUnexcused ?? 0).padStart(2, "0")}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
        <h3 className="mb-4 font-bold" style={{ color: C.onSurface }}>Hoạt động gần nhất</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có hoạt động nề nếp nào được ghi nhận.</p>
        ) : (
          <div className="relative space-y-6">
            <div className="absolute left-2.75 top-2 bottom-2 w-0.5" style={{ backgroundColor: "rgba(223,192,178,0.4)" }} />
            {activity.map((a, i) => (
              <div key={`${a.kind}-${a.behaviorId ?? i}`} className="relative pl-10">
                <div className="absolute left-0 top-1 z-10 h-6 w-6 rounded-full border-4 border-white" style={{ backgroundColor: dot[a.kind] }} />
                <p className="text-sm font-bold" style={{ color: C.onSurface }}>{a.title}{a.points ? ` (${a.kind === "merit" ? "+" : "-"}${a.points}đ)` : ""}</p>
                <p className="text-xs" style={{ color: C.muted }}>{formatDateVN(a.recordDate)}{a.createdByName ? ` · ${a.createdByName}` : ""}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Academic ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, bg, color }) {
  return (
    <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: bg }}>
      <p className="text-3xl font-extrabold leading-none" style={{ color }}>{value}</p>
      <p className="mt-1 text-sm font-bold" style={{ color: C.onSurface }}>{label}</p>
      {sub && <p className="text-xs" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );
}
function AcademicTab({ acad, semesters, effSem, setSem }) {
  const c = acad?.current;
  const ranking = acad?.ranking;
  const history = useMemo(() => (acad?.semesterSummaries ? [...acad.semesterSummaries].filter((s) => s.gpa != null).reverse() : []), [acad]);
  const topPct = ranking?.rank && ranking?.totalRanked ? Math.round((ranking.rank / ranking.totalRanked) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="GPA Hiện tại" value={c?.gpa ?? "—"} sub={`Học lực ${c?.standing?.label ?? "—"}`} bg="rgba(242,113,35,0.08)" color={C.orange} />
        <StatTile label="Xếp hạng lớp" value={ranking?.rank ? `${String(ranking.rank).padStart(2, "0")}` : "—"} sub={ranking?.totalRanked ? `/${ranking.totalRanked}${topPct != null ? ` · Top ${topPct}% lớp` : ""}` : "—"} bg="rgba(0,69,142,0.08)" color={C.deepBlue} />
        <StatTile label="Môn học" value={c?.subjects?.length ?? "—"} sub="Trong học kỳ hiện tại" bg="rgba(34,93,173,0.08)" color={C.secondary} />
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: C.border }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="show_chart" style={{ color: C.orange }} /> Tiến độ GPA theo học kỳ</h3>
          {semesters.length > 0 && (
            <select value={effSem} onChange={(e) => setSem(e.target.value)} className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-[#00458E]" style={{ borderColor: C.border, color: C.onSurface }}>
              {semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
            </select>
          )}
        </div>
        {history.length > 0 ? <TrendChart history={history} /> : <p className="py-8 text-center text-sm text-slate-400">Chưa đủ dữ liệu để vẽ biểu đồ.</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: C.border }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Môn học</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">Điểm TB (thang 10)</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider">Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {!c?.subjects?.length ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">Chưa có điểm trong học kỳ này.</td></tr>
              ) : c.subjects.map((s) => {
                const b = subjectBand(s.average);
                return (
                  <tr key={s.subjectId} className="transition-colors hover:bg-[#F3F3F3]">
                    <td className="px-4 py-3 font-semibold" style={{ color: C.onSurface }}>{s.subjectName}</td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: C.orange }}>{s.average ?? "—"}</td>
                    <td className="px-4 py-3">{b && <span className="rounded px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: b.bg, color: b.text }}>{b.label}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Roadmap (goals + derived competency + goal-based timeline) ───────────────
function RoadmapTab({ goals, acad }) {
  const gs = useMemo(() => goals ?? [], [goals]);
  const active = gs.filter((g) => g.status === "IN_PROGRESS" || g.status === "COMPLETED");
  const subjects = acad?.current?.subjects;
  const skillTags = useMemo(() => {
    const tags = new Set();
    for (const g of gs) if (GOAL_TYPE_LABEL[g.goalType]) tags.add(GOAL_TYPE_LABEL[g.goalType]);
    for (const s of subjects ?? []) if (s.average >= 8) tags.add(s.subjectName);
    return [...tags].slice(0, 8);
  }, [gs, subjects]);
  const tagColors = [
    { bg: "rgba(242,113,35,0.1)", text: C.orange }, { bg: "rgba(34,93,173,0.1)", text: C.secondary },
    { bg: "#DCFCE7", text: "#15803D" }, { bg: "#FEF3C7", text: "#B45309" }, { bg: "#EBF3FF", text: "#225DAD" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="track_changes" style={{ color: C.orange }} /> Mục tiêu hiện tại</h3>
          </div>
          {active.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Học sinh chưa thiết lập mục tiêu nào.</p>
          ) : (
            <div className="space-y-4">
              {active.map((g) => {
                const done = g.status === "COMPLETED";
                const col = done ? "#16A34A" : (g.goalType === "ACADEMIC" ? C.orange : C.secondary);
                return (
                  <div key={g.goalId} className="rounded-2xl border p-4" style={{ backgroundColor: C.surfaceLow, borderColor: "rgba(223,192,178,0.4)" }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold" style={{ color: C.onSurface }}>{g.title}</span>
                      <span className="text-xs font-bold" style={{ color: col }}>{g.progress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(223,192,178,0.3)" }}>
                      <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: col }} />
                    </div>
                    {g.description && <p className="mt-2 text-[10px] italic" style={{ color: C.muted }}>Kế hoạch: {g.description}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-4 flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="psychology" style={{ color: C.secondary }} /> Đánh giá năng lực</h3>
          <div className="rounded-2xl border p-6" style={{ backgroundColor: C.surfaceLow, borderColor: "rgba(223,192,178,0.4)" }}>
            {skillTags.length === 0 ? (
              <p className="text-center text-sm text-slate-400">Chưa có dữ liệu năng lực.</p>
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                {skillTags.map((t, i) => {
                  const c = tagColors[i % tagColors.length];
                  return <span key={t} className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: c.bg, color: c.text }}>{t}</span>;
                })}
              </div>
            )}
            <p className="mt-4 text-center text-[11px] italic" style={{ color: C.muted }}>Suy ra từ mục tiêu &amp; môn học nổi bật (điểm ≥ 8).</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-6 flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="rocket_launch" style={{ color: C.orange }} /> Lộ trình mục tiêu</h3>
        {gs.filter((g) => g.targetDate).length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Chưa có mục tiêu gắn mốc thời gian.</p>
        ) : (
          <div className="relative overflow-x-auto p-4">
            <div className="flex gap-6">
              {[...gs].filter((g) => g.targetDate).sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate))).slice(0, 5).map((g, i) => {
                const done = g.status === "COMPLETED";
                return (
                  <div key={g.goalId} className="flex min-w-30 flex-col items-center text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white text-white shadow-sm" style={{ backgroundColor: done ? "#16A34A" : (i === 0 ? C.orange : C.secondary) }}>
                      <Ms name={done ? "check" : "flag"} className="text-[18px]!" />
                    </div>
                    <p className="text-[11px] font-bold" style={{ color: C.onSurface }}>{g.title}</p>
                    <p className="text-[10px] uppercase" style={{ color: C.muted }}>{formatDateVN(g.targetDate)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rewards & Discipline ─────────────────────────────────────────────────────
function RewardsTab({ beh, note }) {
  const merits = beh?.merits ?? [];
  const demerits = beh?.demerits ?? [];
  const conduct = beh?.currentConduct;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-4 flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="emoji_events" style={{ color: C.orange }} fill /> Khen thưởng</h3>
        {merits.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Chưa có khen thưởng.</p>
        ) : (
          <div className="space-y-4">
            {merits.map((m) => (
              <div key={m.behaviorId} className="rounded-2xl p-4" style={{ backgroundColor: "#F0FDF4", borderLeft: "4px solid #22C55E" }}>
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-2" style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}><Ms name="star" fill className="text-[18px]!" /></div>
                  <div className="min-w-0">
                    <p className="font-bold" style={{ color: C.onSurface }}>{m.title} <span style={{ color: "#16A34A" }}>(+{m.points}đ)</span></p>
                    {m.description && <p className="mt-1 text-sm" style={{ color: C.muted }}>{m.description}</p>}
                    <p className="mt-2 text-xs font-medium" style={{ color: C.muted }}>{m.createdByName ? `${m.createdByName} · ` : ""}{formatDateVN(m.recordDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="verified_user" style={{ color: C.secondary }} fill /> Kỷ luật &amp; Nề nếp</h3>

        {conduct && (
          <div className="relative mb-4 overflow-hidden rounded-2xl p-4" style={{ backgroundColor: "rgba(34,93,173,0.06)" }}>
            <Ms name="shield" className="absolute -right-2 -bottom-2 text-[64px]!" style={{ color: "rgba(34,93,173,0.1)" }} fill />
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>Điểm rèn luyện</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold" style={{ color: C.deepBlue }}>{conduct.finalScore}</span>
              <span className="text-sm" style={{ color: C.muted }}>/100</span>
              <span className="ml-auto rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>{conduct.grade?.label ?? "—"}</span>
            </div>
          </div>
        )}

        <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>Nhật ký vi phạm ({String(demerits.length).padStart(2, "0")})</p>
        {demerits.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-4 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Không có vi phạm.</p>
        ) : (
          <div className="space-y-3">
            {demerits.map((d) => (
              <div key={d.behaviorId} className="flex items-start gap-3 rounded-2xl border p-3" style={{ borderColor: C.border }}>
                <div className="rounded-lg p-1.5" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}><Ms name="warning" className="text-[18px]!" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: C.onSurface }}>{d.title}</p>
                  <p className="text-xs" style={{ color: C.muted }}>{formatDateVN(d.recordDate)}{d.description ? ` · ${d.description}` : ""}</p>
                </div>
                <span className="shrink-0 text-sm font-bold" style={{ color: "#DC2626" }}>-{d.points}đ</span>
              </div>
            ))}
          </div>
        )}

        {note && (
          <div className="mt-4 rounded-2xl border p-4" style={{ backgroundColor: "rgba(34,93,173,0.06)", borderColor: "rgba(34,93,173,0.2)" }}>
            <p className="mb-1 flex items-center gap-1 text-xs font-bold" style={{ color: C.secondary }}><Ms name="sticky_note_2" className="text-[14px]!" /> Ghi chú gần nhất</p>
            <p className="text-sm italic" style={{ color: C.onSurface }}>“{note}”</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminStudentProfilePage;
