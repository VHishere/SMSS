const studentProfileModel = require("../models/studentProfile.model");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const LEVEL_RANK = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const LEVEL_LABEL = { NONE: "Không", LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao" };

function maxLevel(...levels) {
  return levels.reduce((acc, l) => (LEVEL_RANK[l] > LEVEL_RANK[acc] ? l : acc), "NONE");
}

/**
 * Derive risk indicators from raw counts.
 * Returns { overall, level, domains: {attendance, academic, behaviour}, reasons[], actions[] }
 */
function computeRisk(counts) {
  const reasons = [];
  const actions = [];
  const periodsPerSession = Math.max(1, Number(counts.periodsPerSession || 5));
  const absencePeriods = counts.absences ?? (
    Number(counts.absentUnexcused || 0)
    + (counts.countExcused === false ? 0 : Number(counts.absentExcused || 0))
  );
  const absenceSessions = Math.round((absencePeriods / periodsPerSession) * 100) / 100;
  const totalSessions = Number(counts.totalAttendance || 0) / periodsPerSession;

  // Attendance
  let attendance = "NONE";
  const absenceRate = totalSessions > 0 ? absenceSessions / totalSessions : 0;
  if (counts.totalAttendance > 0) {
    if (absenceRate >= 0.2) attendance = "HIGH";
    else if (absenceRate >= 0.1) attendance = "MEDIUM";
    else if (absencePeriods > 0) attendance = "LOW";
  }
  if (attendance === "HIGH" || attendance === "MEDIUM") {
    reasons.push(`Tỷ lệ vắng ${Math.round(absenceRate * 100)}% (${absenceSessions}/${Math.round(totalSessions * 100) / 100} buổi quy đổi).`);
    actions.push("Liên hệ phụ huynh về tình hình chuyên cần.");
  }

  // Academic
  let academic = "NONE";
  if (counts.academicWarnings >= 2) academic = "HIGH";
  else if (counts.academicWarnings === 1) academic = "MEDIUM";
  if (academic !== "NONE") {
    reasons.push(`${counts.academicWarnings} cảnh báo học tập chưa xử lý.`);
    actions.push("Xem lại kết quả học tập và lập kế hoạch hỗ trợ.");
  }

  // Behaviour
  let behaviour = "NONE";
  if (counts.conductScore !== null && counts.conductScore < 50) behaviour = "HIGH";
  else if (counts.behaviourWarnings >= 1) behaviour = maxLevel(behaviour, "MEDIUM");
  if (behaviour !== "NONE") {
    if (counts.conductScore !== null && counts.conductScore < 50) {
      reasons.push(`Điểm hạnh kiểm thấp (${counts.conductScore}/100).`);
    }
    if (counts.behaviourWarnings >= 1) reasons.push(`${counts.behaviourWarnings} cảnh báo hạnh kiểm chưa xử lý.`);
    actions.push("Trao đổi với học sinh và phụ huynh về hành vi.");
  }

  const level = maxLevel(attendance, academic, behaviour);

  return {
    level,
    levelLabel: LEVEL_LABEL[level],
    domains: {
      attendance: { level: attendance, label: LEVEL_LABEL[attendance] },
      academic:   { level: academic,   label: LEVEL_LABEL[academic] },
      behaviour:  { level: behaviour,   label: LEVEL_LABEL[behaviour] },
    },
    reasons,
    actions,
    counts,
  };
}

async function resolveSemester(semesterId) {
  if (semesterId) {
    const sem = await studentProfileModel.findSemesterById(semesterId);
    if (!sem) throw httpError("Không tìm thấy học kỳ", 404);
    return sem;
  }
  const semesters = await studentProfileModel.findSemesters();
  if (!semesters.length) throw httpError("Chưa có học kỳ nào", 404);
  return semesters[0];
}

async function getProfile({ studentId, semesterId }) {
  const profile = await studentProfileModel.find360(studentId);
  if (!profile) throw httpError("Không tìm thấy học sinh", 404);

  const semesters = await studentProfileModel.findSemesters();
  const semester = await resolveSemester(semesterId);

  const [attendance, riskCounts] = await Promise.all([
    studentProfileModel.findAttendanceSummary(studentId, semester.startDate, semester.endDate),
    studentProfileModel.findRiskCounts(studentId, semester.semesterId, semester.startDate, semester.endDate),
  ]);

  return {
    profile,
    semesters,
    targetSemesterId: semester.semesterId,
    attendance,
    risk: computeRisk(riskCounts),
  };
}

async function getAttendanceHistory({ studentId, semesterId }) {
  const semester = await resolveSemester(semesterId);
  const [summary, monthly, history] = await Promise.all([
    studentProfileModel.findAttendanceSummary(studentId, semester.startDate, semester.endDate),
    studentProfileModel.findMonthlyAttendance(studentId, semester.startDate, semester.endDate),
    studentProfileModel.findAttendanceHistory(studentId, semester.startDate, semester.endDate),
  ]);
  return { summary, monthly, history, semesterId: semester.semesterId };
}

async function getClassOverview({ classId, semesterId }) {
  const semester = await resolveSemester(semesterId);
  const rows = await studentProfileModel.findClassRiskOverview(classId, semester.semesterId, semester.startDate, semester.endDate);

  const students = rows.map((r) => {
    const risk = computeRisk({
      absentExcused: r.absentExcused,
      absentUnexcused: r.absentUnexcused,
      totalAttendance: r.totalAttendance,
      academicWarnings: r.academicWarnings,
      behaviourWarnings: r.behaviourWarnings,
      conductScore: r.conductScore,
      periodsPerSession: r.periodsPerSession,
      countExcused: r.countExcused,
    });
    return {
      ...r,
      attendanceRate: r.totalAttendance > 0
        ? Math.round(((r.totalAttendance - r.absentUnexcused - (r.countExcused ? r.absentExcused : 0)) / r.totalAttendance) * 1000) / 10
        : null,
      riskLevel: risk.level,
      riskLabel: risk.levelLabel,
      riskReasons: risk.reasons,
    };
  });

  const summary = {
    total: students.length,
    high:   students.filter((s) => s.riskLevel === "HIGH").length,
    medium: students.filter((s) => s.riskLevel === "MEDIUM").length,
    low:    students.filter((s) => s.riskLevel === "LOW").length,
  };

  return { students, summary, semesterId: semester.semesterId };
}

module.exports = {
  computeRisk,
  getProfile,
  getAttendanceHistory,
  getClassOverview,
};
