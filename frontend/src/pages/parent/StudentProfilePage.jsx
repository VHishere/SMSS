import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FiAward, FiCalendar, FiFlag, FiShield, FiUser,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentApi } from "../../api/client";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentBehaviourSemesters } from "../../hooks/useParentBehaviourSemesters";
import { useParentBehaviourConduct } from "../../hooks/useParentBehaviourConduct";
import { useParentBehaviourRecords } from "../../hooks/useParentBehaviourRecords";

const TABS = [
  { key: "overview",   label: "Tổng quan", icon: FiUser },
  { key: "academic",   label: "Học tập",   icon: FiAward },
  { key: "attendance", label: "Điểm danh", icon: FiCalendar },
  { key: "behaviour",  label: "Hạnh kiểm", icon: FiShield },
  { key: "goals",      label: "Mục tiêu",  icon: FiFlag },
];

const RISK_COLOR = { HIGH: "#DC2626", MEDIUM: "#F59E0B", LOW: "#F27123", NONE: "#16A34A" };
const RISK_LABELS = { HIGH: "Cao", MEDIUM: "Trung bình", LOW: "Thấp", NONE: "Không có" };
const RISK_LEVELS = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

function computeRisk(attendance, conductData) {
  const rate     = attendance?.attendanceRate ?? 100;
  const absUnexc = attendance?.absentUnexcused ?? 0;

  let attLevel = "NONE";
  const attReasons = [], attActions = [];
  if (rate < 70 || absUnexc >= 10) {
    attLevel = "HIGH";
    attReasons.push(`Tỷ lệ chuyên cần chỉ đạt ${rate}%`);
    if (absUnexc >= 10) attReasons.push(`Vắng không phép ${absUnexc} buổi`);
    attActions.push("Liên hệ với giáo viên chủ nhiệm để tìm hiểu nguyên nhân vắng học.");
  } else if (rate < 80 || absUnexc >= 5) {
    attLevel = "MEDIUM";
    attReasons.push(`Tỷ lệ chuyên cần đạt ${rate}% – cần cải thiện`);
    attActions.push("Nhắc nhở học sinh đi học đầy đủ và đúng giờ.");
  } else if (rate < 90) {
    attLevel = "LOW";
    attReasons.push(`Tỷ lệ chuyên cần đạt ${rate}% – chưa đạt mức tốt`);
  }

  const score = conductData?.computed?.finalScore ?? null;
  let behLevel = "NONE";
  const behReasons = [], behActions = [];
  if (score !== null) {
    if (score < 50) {
      behLevel = "HIGH";
      behReasons.push(`Điểm hạnh kiểm ${score}/100 – mức kém`);
      behActions.push("Trao đổi ngay với giáo viên chủ nhiệm về hành vi của học sinh.");
    } else if (score < 65) {
      behLevel = "MEDIUM";
      behReasons.push(`Điểm hạnh kiểm ${score}/100 – cần cải thiện`);
      behActions.push("Khuyến khích học sinh tham gia các hoạt động tích cực.");
    } else if (score < 80) {
      behLevel = "LOW";
      behReasons.push(`Điểm hạnh kiểm ${score}/100 – mức trung bình`);
    }
  }

  const overall = RISK_LEVELS[attLevel] >= RISK_LEVELS[behLevel] ? attLevel : behLevel;
  return {
    level: overall,
    levelLabel: RISK_LABELS[overall],
    reasons: [...attReasons, ...behReasons],
    actions: [...attActions, ...behActions],
    domains: {
      attendance: { level: attLevel, label: RISK_LABELS[attLevel] },
      behaviour:  { level: behLevel, label: RISK_LABELS[behLevel] },
    },
  };
}

function StatBox({ label, value, color = "#0F2747", sub }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ studentId, profile, semesterId, semester }) {
  const [attData, setAttData] = useState(null);
  const { data: conductData } = useParentBehaviourConduct(studentId, semesterId);

  useEffect(() => {
    if (!studentId || !semester?.startDate || !semester?.endDate) return;
    let m = true;
    parentApi.getStudentAttendanceAnalytics(studentId, {
      startDate: semester.startDate,
      endDate:   semester.endDate,
    }).then((res) => { if (m) setAttData(res.data); });
    return () => { m = false; };
  }, [studentId, semester?.startDate, semester?.endDate]);

  const attendance = useMemo(() => {
    if (!attData) return null;
    const byType   = attData.summary?.byType ?? {};
    const total    = attData.summary?.totalRecords ?? 0;
    const present  = byType.PRESENT?.count          ?? 0;
    const late     = byType.LATE?.count             ?? 0;
    const absUnexc = byType.ABSENT_UNEXCUSED?.count ?? 0;
    const rate     = total > 0 ? +((present + late) / total * 100).toFixed(1) : null;
    return { attendanceRate: rate, total, absentUnexcused: absUnexc, late };
  }, [attData]);

  const risk = useMemo(() => computeRisk(attendance, conductData), [attendance, conductData]);

  return (
    <div className="space-y-6">
      {/* Stat boxes */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Chuyên cần" value={attendance?.attendanceRate !== null && attendance?.attendanceRate !== undefined ? `${attendance.attendanceRate}%` : "—"} color="#F27123" sub={attendance ? `${attendance.total} buổi` : undefined} />
        <StatBox label="Vắng KP"    value={attendance?.absentUnexcused ?? "—"} color="#DC2626" />
        <StatBox label="Đi muộn"    value={attendance?.late ?? "—"}            color="#F59E0B" />
        <StatBox label="Mức rủi ro" value={risk.levelLabel}                    color={RISK_COLOR[risk.level]} />
      </div>

      {/* Risk panel */}
      <div className="rounded-2xl p-5 shadow-sm" style={{ border: `1px solid ${risk.level === "NONE" ? "#FFE7D6" : RISK_COLOR[risk.level]}`, backgroundColor: "#fff" }}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: RISK_COLOR[risk.level] }}>
          <FiShield size={15} /> Cảnh báo rủi ro: {risk.levelLabel}
        </h3>
        {risk.reasons.length === 0 ? (
          <p className="text-sm text-slate-500">Không có dấu hiệu rủi ro nổi bật.</p>
        ) : (
          <>
            <ul className="mb-3 list-inside list-disc space-y-1 text-sm text-slate-600">
              {risk.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Đề xuất</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
              {risk.actions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(risk.domains).map(([k, d]) => (
            <span key={k} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#FFF7F2", color: RISK_COLOR[d.level] }}>
              {k === "attendance" ? "Chuyên cần" : "Hạnh kiểm"}: {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Personal + class/homeroom */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Thông tin cá nhân</h3>
          <dl className="space-y-2 text-sm">
            {[
              ["Mã học sinh", profile.studentCode],
              ["Giới tính", profile.gender === "MALE" ? "Nam" : profile.gender === "FEMALE" ? "Nữ" : "Khác"],
              ["Ngày sinh", profile.dateOfBirth ?? "—"],
              ["Địa chỉ", profile.address ?? "—"],
              ["Email", profile.email ?? "—"],
              ["Năm học", profile.schoolYearName ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-400">{k}</dt>
                <dd className="text-right font-medium text-[#0F2747]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Thông tin lớp học</h3>
            <dl className="space-y-2 text-sm">
              {[
                ["Lớp", `${profile.className ?? "—"} · ${profile.gradeName ?? ""}`],
                ["Phòng học", profile.roomName ?? "—"],
                ["Khối", profile.gradeName ?? "—"],
                ["Năm học", profile.schoolYearName ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="text-right font-medium text-[#0F2747]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Giáo viên chủ nhiệm</h3>
            {profile.homeroomTeacherId ? (
              <div className="flex items-start gap-3">
                {profile.homeroomTeacherAvatar ? (
                  <img src={profile.homeroomTeacherAvatar} alt={profile.homeroomTeacherName}
                    className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#08509F] text-sm font-bold text-white">
                    {profile.homeroomTeacherName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <dl className="space-y-1.5 text-sm">
                  {[
                    ["Họ tên", profile.homeroomTeacherName],
                    ["Email", profile.homeroomTeacherEmail],
                    ["Điện thoại", profile.homeroomTeacherPhone],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="text-right font-medium text-[#0F2747]">{v ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Chưa có thông tin giáo viên chủ nhiệm.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Academic helpers ─────────────────────────────────────────────────────────

const SCORE_WEIGHTS = { tx1: 1, tx2: 1, tx3: 1, onePeriod: 2, final: 3 };

function detectSlot(scoreType) {
  const t = (scoreType || "").toUpperCase();
  if (["TX1", "REGULAR_1", "FREQUENT_1", "THUONG_XUYEN_1"].includes(t)) return "tx1";
  if (["TX2", "REGULAR_2", "FREQUENT_2", "THUONG_XUYEN_2"].includes(t)) return "tx2";
  if (["TX3", "REGULAR_3", "FREQUENT_3", "THUONG_XUYEN_3"].includes(t)) return "tx3";
  if (["ONE_PERIOD", "ONE_PERIOD_TEST", "MOT_TIET", "MIDTERM", "MID_TERM"].includes(t)) return "onePeriod";
  if (["FINAL", "FINAL_EXAM", "CUOI_KY", "END_TERM"].includes(t)) return "final";
  return "tx1";
}

function computeWeightedAvg(gradeList) {
  let total = 0, totalW = 0;
  for (const g of gradeList) {
    if (g.scoreValue === null || g.scoreValue === undefined) continue;
    const w = SCORE_WEIGHTS[detectSlot(g.scoreType)] ?? 1;
    total += Number(g.scoreValue) * w;
    totalW += w;
  }
  return totalW > 0 ? parseFloat((total / totalW).toFixed(2)) : null;
}

function buildSubjectSummary(allGrades, semesterId) {
  const map = {};
  for (const g of allGrades) {
    if (String(g.semesterId) !== String(semesterId)) continue;
    if (!map[g.subjectId]) {
      map[g.subjectId] = { subjectId: g.subjectId, subjectName: g.subjectName, grades: [] };
    }
    map[g.subjectId].grades.push(g);
  }
  return Object.values(map).map((s) => {
    const avg = computeWeightedAvg(s.grades);
    return { ...s, average: avg, passed: avg !== null ? avg >= 5 : null };
  });
}

function buildSemesterSummaries(allGrades) {
  const semMap = {};
  for (const g of allGrades) {
    const id = g.semesterId;
    if (!semMap[id]) semMap[id] = { semesterId: id, semesterName: g.semesterName, subMap: {} };
    const sm = semMap[id].subMap;
    if (!sm[g.subjectId]) sm[g.subjectId] = [];
    sm[g.subjectId].push(g);
  }
  return Object.values(semMap).map(({ semesterId: id, semesterName, subMap }) => {
    const avgs = Object.values(subMap).map(computeWeightedAvg).filter((a) => a !== null);
    const gpa  = avgs.length ? parseFloat((avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2)) : null;
    return { semesterId: id, semesterName, gpa };
  });
}

function computeStanding(gpa) {
  if (gpa === null || gpa === undefined) return null;
  if (gpa >= 9.0) return { label: "Xuất sắc" };
  if (gpa >= 8.0) return { label: "Giỏi" };
  if (gpa >= 6.5) return { label: "Khá" };
  if (gpa >= 5.0) return { label: "Trung bình" };
  return { label: "Yếu" };
}

// ─── Academic Tab ─────────────────────────────────────────────────────────────

function AcademicTab({ studentId, semesterId }) {
  const [rawData, setRawData] = useState(null);
  const [error, setError]     = useState("");
  const loading = rawData === null && !error;

  useEffect(() => {
    if (!studentId) return;
    let m = true;
    parentApi.getStudentGrades(studentId)
      .then((res) => { if (m) setRawData(res.data); })
      .catch((err) => { if (m) setError(err.message); });
    return () => { m = false; };
  }, [studentId]);

  const subjects = useMemo(
    () => (rawData?.grades && semesterId ? buildSubjectSummary(rawData.grades, semesterId) : []),
    [rawData, semesterId],
  );

  const semesterSummaries = useMemo(
    () => (rawData?.grades ? buildSemesterSummaries(rawData.grades) : []),
    [rawData],
  );

  const gpa = useMemo(() => {
    const avgs = subjects.map((s) => s.average).filter((a) => a !== null);
    return avgs.length ? parseFloat((avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2)) : null;
  }, [subjects]);

  const standing     = computeStanding(gpa);
  const failedCount  = subjects.filter((s) => s.average !== null && s.average < 5).length;

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  if (error)   return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="GPA học kỳ"   value={gpa ?? "—"}              color="#F27123" />
        <StatBox label="Xếp loại"     value={standing?.label ?? "—"}  color="#08509F" />
        <StatBox label="Xếp hạng"     value="—"                       color="#0F2747" />
        <StatBox label="Môn chưa đạt" value={failedCount}             color={failedCount > 0 ? "#DC2626" : "#16A34A"} />
      </div>

      {subjects.length > 0 ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                {["MÔN", "ĐIỂM TB", "KẾT QUẢ"].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-xs font-bold uppercase" style={{ color: "#F27123" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, idx) => (
                <tr key={s.subjectId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 ? "#FAFAFA" : "#fff" }}>
                  <td className="px-4 py-2.5 font-medium text-[#0F2747]">{s.subjectName}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#0F2747]">{s.average ?? "—"}</td>
                  <td className="px-4 py-2.5">{s.passed === null ? "—" : (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={s.passed ? { backgroundColor: "#ECFDF5", color: "#16A34A" } : { backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                      {s.passed ? "Đạt" : "Chưa đạt"}
                    </span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          Chưa có dữ liệu điểm cho học kỳ này.
        </div>
      )}

      {semesterSummaries.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Lịch sử GPA</h3>
          <div className="flex items-end gap-4 overflow-x-auto pb-2">
            {[...semesterSummaries].reverse().filter((s) => s.gpa !== null).map((s) => (
              <div key={s.semesterId} className="flex flex-col items-center gap-1" style={{ minWidth: 64 }}>
                <span className="text-xs font-bold text-[#0F2747]">{s.gpa}</span>
                <div className="flex h-24 w-7 items-end overflow-hidden rounded-lg bg-slate-100">
                  <div className="w-full rounded-lg" style={{ height: `${(s.gpa / 10) * 100}%`, backgroundColor: "#F27123" }} />
                </div>
                <span className="text-center text-[10px] text-slate-500">{s.semesterName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function buildMonthlyAttendance(timeline) {
  const monthMap = {};
  for (const day of timeline) {
    const month = day.date.slice(0, 7);
    if (!monthMap[month]) monthMap[month] = { attended: 0, total: 0 };
    monthMap[month].attended += day.present + day.late;
    monthMap[month].total    += day.total;
  }
  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { attended, total }]) => ({
      month,
      rate: total > 0 ? Math.round((attended / total) * 1000) / 10 : 0,
    }));
}

function AttendanceTab({ studentId, semester }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState("");

  const startDate = semester?.startDate;
  const endDate   = semester?.endDate;
  const loading   = !!startDate && !!endDate && data === null && !error;

  useEffect(() => {
    if (!studentId || !startDate || !endDate) return;
    let m = true;
    parentApi.getStudentAttendanceAnalytics(studentId, { startDate, endDate })
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); });
    return () => { m = false; };
  }, [studentId, startDate, endDate]);

  if (!startDate || !endDate) return (
    <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      Chưa có thông tin học kỳ để tải dữ liệu điểm danh.
    </div>
  );
  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  if (error)   return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data)   return null;

  const byType   = data.summary?.byType ?? {};
  const total    = data.summary?.totalRecords ?? 0;
  const present  = byType.PRESENT?.count          ?? 0;
  const late     = byType.LATE?.count             ?? 0;
  const absExc   = byType.ABSENT_EXCUSED?.count   ?? 0;
  const absUnexc = byType.ABSENT_UNEXCUSED?.count ?? 0;
  const rate     = total > 0 ? +((present + late) / total * 100).toFixed(1) : null;
  const monthly  = buildMonthlyAttendance(data.timeline ?? []);
  const maxRate  = 100;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatBox label="Tỷ lệ chuyên cần" value={rate !== null ? `${rate}%` : "—"} color="#F27123" />
        <StatBox label="Có mặt"           value={present}  color="#16A34A" />
        <StatBox label="Đi muộn"          value={late}     color="#F59E0B" />
        <StatBox label="Vắng có phép"     value={absExc}   color="#08509F" />
        <StatBox label="Vắng không phép"  value={absUnexc} color="#DC2626" />
      </div>

      {monthly.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Tỷ lệ chuyên cần theo tháng</h3>
          <div className="flex items-end gap-4 overflow-x-auto pb-2">
            {monthly.map((m) => (
              <div key={m.month} className="flex flex-col items-center gap-1" style={{ minWidth: 56 }}>
                <span className="text-xs font-bold text-[#0F2747]">{m.rate}%</span>
                <div className="flex h-24 w-7 items-end overflow-hidden rounded-lg bg-slate-100">
                  <div className="w-full rounded-lg" style={{ height: `${(m.rate / maxRate) * 100}%`, backgroundColor: m.rate >= 90 ? "#16A34A" : m.rate >= 75 ? "#F59E0B" : "#DC2626" }} />
                </div>
                <span className="text-[10px] text-slate-500">{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Behaviour Tab ────────────────────────────────────────────────────────────

function BehaviourTab({ studentId, semesterId, semester }) {
  const { data, loading, error } = useParentBehaviourConduct(studentId, semesterId);

  const hasDateRange = Boolean(semester?.startDate && semester?.endDate);

  const meritFilters = useMemo(() => ({
    behaviorType: "POSITIVE",
    startDate: semester?.startDate,
    endDate:   semester?.endDate,
    page: 1, limit: 5,
  }), [semester?.startDate, semester?.endDate]);

  const demeritFilters = useMemo(() => ({
    behaviorType: "VIOLATION",
    startDate: semester?.startDate,
    endDate:   semester?.endDate,
    page: 1, limit: 5,
  }), [semester?.startDate, semester?.endDate]);

  const { data: meritData   } = useParentBehaviourRecords(studentId, meritFilters,   hasDateRange);
  const { data: demeritData } = useParentBehaviourRecords(studentId, demeritFilters, hasDateRange);

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  if (error)   return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data)   return null;

  const cc = data.computed;

  return (
    <div className="space-y-5">
      {cc && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBox label="Điểm thưởng" value={`+${cc.meritPoints}`}              color="#16A34A" />
          <StatBox label="Điểm trừ"    value={`-${Math.abs(cc.demeritPoints)}`}  color="#DC2626" />
          <StatBox label="Hạnh kiểm"   value={cc.finalScore}                      color="#F27123" />
          <StatBox label="Xếp loại"    value={cc.grade?.label ?? "—"}             color="#08509F" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#16A34A" }}>Khen thưởng gần đây</h3>
          {!meritData?.items?.length ? <p className="text-sm text-slate-400">Chưa có.</p> : (
            <div className="space-y-2">
              {meritData.items.map((r) => (
                <div key={r.behaviorId} className="flex justify-between gap-2 text-sm">
                  <span className="text-[#0F2747]">{r.title}</span>
                  <span className="font-bold" style={{ color: "#16A34A" }}>+{r.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#DC2626" }}>Vi phạm gần đây</h3>
          {!demeritData?.items?.length ? <p className="text-sm text-slate-400">Chưa có.</p> : (
            <div className="space-y-2">
              {demeritData.items.map((r) => (
                <div key={r.behaviorId} className="flex justify-between gap-2 text-sm">
                  <span className="text-[#0F2747]">{r.title}</span>
                  <span className="font-bold" style={{ color: "#DC2626" }}>-{r.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Goals Tab ────────────────────────────────────────────────────────────────

const GOAL_STATUS = {
  IN_PROGRESS: { label: "Đang thực hiện", bg: "#FFF7ED", text: "#F27123" },
  COMPLETED:   { label: "Hoàn thành",     bg: "#ECFDF5", text: "#16A34A" },
  FAILED:      { label: "Không đạt",      bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED:    { label: "Đã lưu trữ",     bg: "#F1F5F9", text: "#475569" },
};
const GOAL_TYPE_LABEL = { ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PERSONAL: "Phát triển cá nhân" };

function GoalsTab({ studentId }) {
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState("");
  const loading = goals === null && !error;

  useEffect(() => {
    if (!studentId) return;
    let m = true;
    parentApi.getStudentGoals(studentId)
      .then((res) => { if (m) setGoals(res.data); })
      .catch((err) => { if (m) setError(err.message); });
    return () => { m = false; };
  }, [studentId]);

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (error)   return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!goals)  return null;

  if (!goals.length) return (
    <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      Chưa có mục tiêu nào được giáo viên thiết lập.
    </div>
  );

  return (
    <div className="space-y-3">
      {goals.map((g) => {
        const st = GOAL_STATUS[g.status] ?? GOAL_STATUS.IN_PROGRESS;
        return (
          <div key={g.goalId} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>{GOAL_TYPE_LABEL[g.goalType] ?? g.goalType}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                </div>
                <h4 className="mt-1.5 text-sm font-bold text-[#0F2747]">{g.title}</h4>
                {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                {g.targetDate && <p className="mt-0.5 text-xs text-slate-400">Hạn: {g.targetDate}</p>}
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Tiến độ</span><span className="font-semibold">{g.progress}%</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: g.status === "FAILED" ? "#DC2626" : g.status === "COMPLETED" ? "#16A34A" : "#F27123" }} />
              </div>
            </div>

            {g.finalComment && (
              <p className="mt-2 rounded-lg px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: "#FFF7F2" }}>
                <span className="font-semibold">Đánh giá: </span>{g.finalComment}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function StudentProfilePage() {
  const { studentId } = useParams();
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const { students }  = useParentStudents();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  function selectStudent(id) {
    navigate(`/parent/student/${id}`);
  }

  const [profile, setProfile] = useState(null);
  const [error, setError]     = useState("");
  const loading = profile === null && !error;

  useEffect(() => {
    if (!studentId) return;
    let m = true;
    parentApi.getStudentProfile(studentId)
      .then((res) => { if (m) setProfile(res.data); })
      .catch((err) => { if (m) setError(err.message); });
    return () => { m = false; };
  }, [studentId]);

  const { data: semesters } = useParentBehaviourSemesters(studentId);

  const semesterId    = searchParams.get("semesterId") || "";
  const effSemId      = semesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");
  const activeSem     = semesters.find((s) => String(s.semesterId) === effSemId) ?? semesters[0] ?? null;

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => r.roleName === "PARENT");
    return { name: user?.fullName ?? user?.username ?? "Phụ huynh", role: roleEntry?.description ?? "Phụ huynh", avatar: user?.avatar ?? "" };
  }, [user]);

  function setTab(key) {
    const next = { tab: key };
    if (effSemId) next.semesterId = effSemId;
    setSearchParams(next);
  }

  function changeSemester(value) {
    setSearchParams({ tab: activeTab, semesterId: value });
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={profile?.schoolYearName ?? "Chưa cập nhật"}
    >
      {/* Student selector — only shown when parent has more than one child */}
      {students.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => selectStudent(s.studentId)}
              className="rounded-xl px-4 py-2 text-sm font-medium transition"
              style={
                String(s.studentId) === studentId
                  ? { backgroundColor: "#08509F", color: "#fff" }
                  : { border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#475569" }
              }
            >
              {s.studentFullName}
              {s.className && (
                <span className="ml-1.5 opacity-70">· {s.className}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && profile && (
        <>
          {/* Header */}
          <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white" style={{ backgroundColor: "#08509F" }}>
              {profile.avatar
                ? <img src={profile.avatar} alt={profile.fullName} className="h-16 w-16 rounded-full object-cover" />
                : (profile.fullName?.[0]?.toUpperCase() ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold" style={{ color: "#0F2747" }}>{profile.fullName}</h1>
              <p className="text-sm text-slate-500">{profile.studentCode} · {profile.className ?? "—"} · {profile.gradeName ?? ""}</p>
            </div>
            {semesters.length > 0 && (
              <select value={effSemId} onChange={(e) => changeSemester(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]">
                {semesters.map((s) => (
                  <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>
                ))}
              </select>
            )}
          </section>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={activeTab === key ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
                <Icon size={15} /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6" }}>
            {activeTab === "overview"   && <OverviewTab studentId={studentId} profile={profile} semesterId={effSemId} semester={activeSem} />}
            {activeTab === "academic"   && <AcademicTab studentId={studentId} semesterId={effSemId} />}
            {activeTab === "attendance" && <AttendanceTab studentId={studentId} semester={activeSem} />}
            {activeTab === "behaviour"  && <BehaviourTab studentId={studentId} semesterId={effSemId} semester={activeSem} />}
            {activeTab === "goals"      && <GoalsTab studentId={studentId} />}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export default StudentProfilePage;
