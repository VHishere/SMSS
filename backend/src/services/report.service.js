const reportModel         = require("../models/report.model");
const studentProfileModel = require("../models/studentProfile.model");
const academicModel       = require("../models/academic.model");
const behaviourModel      = require("../models/behaviour.model");
const attendanceModel     = require("../models/attendance.model");
const goalModel           = require("../models/goal.model");
const academicService     = require("./academic.service");
const behaviourService    = require("./behaviour.service");
const studentProfileService = require("./studentProfile.service");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const REPORT_TYPES = ["ATTENDANCE", "ACADEMIC", "BEHAVIOUR", "PROGRESS", "CLASS_SUMMARY", "GOAL", "EFFICIENCY"];
const REPORT_TITLES = {
  ATTENDANCE:    "Báo cáo chuyên cần",
  ACADEMIC:      "Báo cáo học tập",
  BEHAVIOUR:     "Báo cáo hạnh kiểm",
  PROGRESS:      "Báo cáo tiến bộ học sinh",
  CLASS_SUMMARY: "Báo cáo tổng hợp lớp",
  GOAL:          "Báo cáo hoàn thành mục tiêu",
  EFFICIENCY:    "Báo cáo hiệu quả vận hành",
};

// UC-110: Institutional Efficiency Report — school-wide, admin only.
const ADMIN_ONLY_REPORT_TYPES = ["EFFICIENCY"];

const GOAL_TYPE_LABEL = { ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PERSONAL: "Phát triển cá nhân" };
const GOAL_STATUS_LABEL = { IN_PROGRESS: "Đang thực hiện", COMPLETED: "Hoàn thành", FAILED: "Chưa đạt", ARCHIVED: "Đã lưu trữ" };

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

async function resolveSemesterRange(semesterId) {
  const sem = await studentProfileModel.findSemesterById(semesterId);
  if (!sem) throw httpError("Không tìm thấy học kỳ", 404);
  return sem;
}

// ── Report builders (each returns a normalized dataset) ───────────────────────

async function buildAttendance(filters) {
  const { classId, startDate, endDate, className } = filters;
  if (!classId || !startDate || !endDate) throw httpError("Cần chọn lớp và khoảng thời gian", 400);

  const { students, totals } = await reportModel.getClassAttendanceReport(classId, startDate, endDate);

  return {
    sections: [
      {
        heading: "Chi tiết chuyên cần theo học sinh",
        columns: [
          { key: "studentCode", label: "Mã HS" },
          { key: "studentName", label: "Họ tên" },
          { key: "present", label: "Có mặt" },
          { key: "late", label: "Đi muộn" },
          { key: "absentExcused", label: "Vắng CP" },
          { key: "absentUnexcused", label: "Vắng KP" },
          { key: "earlyLeave", label: "Về sớm" },
          { key: "total", label: "Tổng buổi" },
          { key: "attendanceRate", label: "Tỷ lệ (%)" },
        ],
        rows: students.map((s) => ({ ...s, attendanceRate: s.attendanceRate ?? "—" })),
        summary: [
          { label: "Tổng có mặt", value: totals.present },
          { label: "Tổng đi muộn", value: totals.late },
          { label: "Tổng vắng có phép", value: totals.absentExcused },
          { label: "Tổng vắng không phép", value: totals.absentUnexcused },
          { label: "Tỷ lệ chuyên cần lớp", value: totals.attendanceRate === null ? "—" : `${totals.attendanceRate}%` },
        ],
      },
    ],
    filtersLabel: `Lớp ${className ?? classId} · ${fmtDate(startDate)} – ${fmtDate(endDate)}`,
  };
}

async function buildAcademic(filters) {
  const { classId, semesterId, className } = filters;
  if (!classId || !semesterId) throw httpError("Cần chọn lớp và học kỳ", 400);

  const a = await academicService.getClassAnalytics({ teacherId: null, classId, semesterId });

  return {
    sections: [
      {
        heading: "Xếp hạng học tập",
        columns: [
          { key: "rank", label: "Hạng" },
          { key: "studentCode", label: "Mã HS" },
          { key: "studentName", label: "Họ tên" },
          { key: "gpa", label: "GPA" },
          { key: "standing", label: "Xếp loại" },
        ],
        rows: a.students.map((s) => ({ rank: s.rank, studentCode: s.studentCode, studentName: s.studentName, gpa: s.gpa, standing: s.standing?.label ?? "—" })),
        summary: [
          { label: "Điểm TB lớp", value: a.summary.classAverage ?? "—" },
          { label: "Tỷ lệ đạt", value: `${a.summary.passRate}%` },
          { label: "Tỷ lệ chưa đạt", value: `${a.summary.failRate}%` },
          { label: "Đã có điểm", value: `${a.summary.scored}/${a.summary.totalStudents}` },
        ],
      },
      {
        heading: "Hiệu suất theo môn",
        columns: [
          { key: "subjectName", label: "Môn" },
          { key: "average", label: "Điểm TB" },
          { key: "highest", label: "Cao nhất" },
          { key: "lowest", label: "Thấp nhất" },
        ],
        rows: a.subjectPerformance,
      },
    ],
    filtersLabel: `Lớp ${className ?? classId}`,
  };
}

async function buildBehaviour(filters) {
  const { classId, semesterId, className } = filters;
  if (!classId || !semesterId) throw httpError("Cần chọn lớp và học kỳ", 400);

  const b = await behaviourService.getClassAnalytics({ classId, semesterId });

  return {
    sections: [
      {
        heading: "Hạnh kiểm theo học sinh",
        columns: [
          { key: "studentCode", label: "Mã HS" },
          { key: "studentName", label: "Họ tên" },
          { key: "meritPoints", label: "Điểm thưởng" },
          { key: "demeritPoints", label: "Điểm trừ" },
          { key: "finalScore", label: "Hạnh kiểm" },
          { key: "grade", label: "Xếp loại" },
        ],
        rows: b.students.map((s) => ({
          studentCode: s.studentCode, studentName: s.studentName,
          meritPoints: s.meritPoints, demeritPoints: s.demeritPoints,
          finalScore: s.finalScore, grade: s.grade?.label ?? "—",
        })),
        summary: [
          { label: "Hạnh kiểm TB", value: b.summary.avgConduct ?? "—" },
          { label: "Tổng điểm thưởng", value: b.summary.totalMerit },
          { label: "Tổng điểm trừ", value: b.summary.totalDemerit },
          { label: "Sĩ số", value: b.summary.totalStudents },
        ],
      },
    ],
    filtersLabel: `Lớp ${className ?? classId}`,
  };
}

async function buildProgress(filters) {
  const { studentId, semesterId } = filters;
  if (!studentId) throw httpError("Cần chọn học sinh", 400);

  const [profile, academic, behaviour, goals] = await Promise.all([
    studentProfileService.getProfile({ studentId, semesterId }),
    academicService.getStudentAcademic({ studentId, semesterId }),
    behaviourService.getStudentBehaviour({ studentId, semesterId }),
    goalModel.findByStudent(parseInt(studentId, 10), {}),
  ]);

  const att = profile.attendance;
  const cur = academic.current;
  const cc = behaviour.currentConduct;

  return {
    subjectName: profile.profile.fullName,
    sections: [
      {
        heading: "Tổng quan",
        columns: [{ key: "metric", label: "Chỉ số" }, { key: "value", label: "Giá trị" }],
        rows: [
          { metric: "Tỷ lệ chuyên cần", value: att.attendanceRate === null ? "—" : `${att.attendanceRate}%` },
          { metric: "Vắng không phép", value: att.absentUnexcused },
          { metric: "GPA học kỳ", value: cur?.gpa ?? "—" },
          { metric: "Xếp loại học lực", value: cur?.standing?.label ?? "—" },
          { metric: "Xếp hạng lớp", value: academic.ranking?.rank ? `#${academic.ranking.rank}/${academic.ranking.totalRanked}` : "—" },
          { metric: "Điểm hạnh kiểm", value: cc?.finalScore ?? "—" },
          { metric: "Xếp loại hạnh kiểm", value: cc?.grade?.label ?? "—" },
          { metric: "Mức rủi ro", value: profile.risk.levelLabel },
        ],
      },
      {
        heading: "Kết quả theo môn",
        columns: [
          { key: "subjectName", label: "Môn" },
          { key: "average", label: "Điểm TB" },
          { key: "result", label: "Kết quả" },
        ],
        rows: (cur?.subjects ?? []).map((s) => ({
          subjectName: s.subjectName, average: s.average ?? "—",
          result: s.passed === null ? "—" : s.passed ? "Đạt" : "Chưa đạt",
        })),
      },
      {
        heading: "Mục tiêu cá nhân",
        columns: [
          { key: "title", label: "Mục tiêu" },
          { key: "goalType", label: "Loại" },
          { key: "progress", label: "Tiến độ (%)" },
          { key: "status", label: "Trạng thái" },
        ],
        rows: (goals ?? []).map((g) => ({
          title: g.title,
          goalType: GOAL_TYPE_LABEL[g.goalType] ?? g.goalType,
          progress: g.progress,
          status: GOAL_STATUS_LABEL[g.status] ?? g.status,
        })),
      },
      {
        heading: "Chỉ báo rủi ro & đề xuất",
        columns: [{ key: "item", label: "Nội dung" }],
        rows: [
          ...profile.risk.reasons.map((r) => ({ item: `⚠ ${r}` })),
          ...profile.risk.actions.map((a) => ({ item: `→ ${a}` })),
        ],
      },
    ],
    filtersLabel: `Học sinh ${profile.profile.fullName} (${profile.profile.studentCode}) · ${profile.profile.className ?? ""}`,
  };
}

async function buildClassSummary(filters) {
  const { classId, semesterId, className } = filters;
  if (!classId || !semesterId) throw httpError("Cần chọn lớp và học kỳ", 400);

  const [overview, academic, behaviour] = await Promise.all([
    studentProfileService.getClassOverview({ classId, semesterId }),
    academicService.getClassAnalytics({ teacherId: null, classId, semesterId }),
    behaviourService.getClassAnalytics({ classId, semesterId }),
  ]);

  const topStudents = academic.students.slice(0, 5);
  const atRisk = overview.students.filter((s) => s.riskLevel === "HIGH" || s.riskLevel === "MEDIUM");

  return {
    sections: [
      {
        heading: "Thống kê chung",
        columns: [{ key: "metric", label: "Chỉ số" }, { key: "value", label: "Giá trị" }],
        rows: [
          { metric: "Sĩ số", value: overview.summary.total },
          { metric: "Điểm TB lớp", value: academic.summary.classAverage ?? "—" },
          { metric: "Tỷ lệ đạt học lực", value: `${academic.summary.passRate}%` },
          { metric: "Hạnh kiểm TB", value: behaviour.summary.avgConduct ?? "—" },
          { metric: "HS rủi ro cao", value: overview.summary.high },
          { metric: "HS rủi ro trung bình", value: overview.summary.medium },
        ],
      },
      {
        heading: "Học sinh tiêu biểu (GPA cao nhất)",
        columns: [
          { key: "rank", label: "Hạng" },
          { key: "studentName", label: "Họ tên" },
          { key: "gpa", label: "GPA" },
        ],
        rows: topStudents.map((s) => ({ rank: s.rank, studentName: s.studentName, gpa: s.gpa })),
      },
      {
        heading: "Học sinh cần chú ý",
        columns: [
          { key: "studentName", label: "Họ tên" },
          { key: "riskLabel", label: "Mức rủi ro" },
          { key: "attendanceRate", label: "Chuyên cần (%)" },
          { key: "conductScore", label: "Hạnh kiểm" },
        ],
        rows: atRisk.map((s) => ({
          studentName: s.studentName, riskLabel: s.riskLabel,
          attendanceRate: s.attendanceRate ?? "—", conductScore: s.conductScore ?? "—",
        })),
      },
    ],
    filtersLabel: `Lớp ${className ?? classId}`,
  };
}

async function buildGoals(filters) {
  const { classId, className } = filters;
  if (!classId) throw httpError("Cần chọn lớp", 400);

  const { rows } = await goalModel.findByClass(parseInt(classId, 10), { page: 1, limit: 1000 });

  const counts = { IN_PROGRESS: 0, COMPLETED: 0, FAILED: 0, ARCHIVED: 0 };
  for (const g of rows) if (counts[g.status] !== undefined) counts[g.status] += 1;
  const total = rows.length;
  const completionRate = total > 0 ? Math.round((counts.COMPLETED / total) * 1000) / 10 : 0;

  return {
    sections: [
      {
        heading: "Tổng quan mục tiêu",
        columns: [{ key: "metric", label: "Chỉ số" }, { key: "value", label: "Giá trị" }],
        rows: [
          { metric: "Tổng mục tiêu", value: total },
          { metric: "Đang thực hiện", value: counts.IN_PROGRESS },
          { metric: "Hoàn thành", value: counts.COMPLETED },
          { metric: "Chưa đạt", value: counts.FAILED },
          { metric: "Tỷ lệ hoàn thành", value: `${completionRate}%` },
        ],
      },
      {
        heading: "Danh sách mục tiêu",
        columns: [
          { key: "studentName", label: "Học sinh" },
          { key: "goalType", label: "Loại" },
          { key: "title", label: "Mục tiêu" },
          { key: "progress", label: "Tiến độ (%)" },
          { key: "status", label: "Trạng thái" },
          { key: "targetDate", label: "Hạn" },
        ],
        rows: rows.map((g) => ({
          studentName: g.studentName,
          goalType: GOAL_TYPE_LABEL[g.goalType] ?? g.goalType,
          title: g.title,
          progress: g.progress,
          status: GOAL_STATUS_LABEL[g.status] ?? g.status,
          targetDate: g.targetDate ?? "—",
        })),
      },
    ],
    filtersLabel: `Lớp ${className ?? classId}`,
  };
}

// ── UC-110: Institutional Efficiency Report (school-wide, grouped by grade or term) ──

// Aggregates operational metrics (attendance rate, average GPA, average
// conduct, open warnings) across a set of classes for one semester. Reuses
// the same per-class analytics services as the other report builders so the
// numbers stay consistent with everything else in the app, rather than
// re-deriving the GPA/conduct weighting formulas in raw SQL.
async function computeGroupMetrics(classes, semesterId, schoolYearId, startDate, endDate) {
  let totalStudents = 0;
  let attendanceWeighted = 0, attendanceWeight = 0;
  let gpaWeighted = 0, gpaWeight = 0;
  let conductWeighted = 0, conductWeight = 0;
  let openWarnings = 0;

  for (const c of classes) {
    const [academic, behaviour, attendance, academicWarnings, behaviourWarnings, absenceWarnings] = await Promise.all([
      academicService.getClassAnalytics({ teacherId: null, classId: c.classId, semesterId }).catch(() => null),
      behaviourService.getClassAnalytics({ classId: c.classId, semesterId }).catch(() => null),
      reportModel.getClassAttendanceReport(c.classId, startDate, endDate).catch(() => null),
      academicModel.findWarnings({ classId: c.classId, semesterId, status: "OPEN", page: 1, limit: 1 }).catch(() => ({ total: 0 })),
      behaviourModel.findWarnings({ classId: c.classId, semesterId, status: "OPEN", page: 1, limit: 1 }).catch(() => ({ total: 0 })),
      attendanceModel.findAbsenceWarnings(c.classId, schoolYearId).catch(() => []),
    ]);

    const classSize = academic?.summary?.totalStudents ?? behaviour?.summary?.totalStudents ?? 0;
    totalStudents += classSize;

    if (academic?.summary?.classAverage != null) { gpaWeighted += academic.summary.classAverage * classSize; gpaWeight += classSize; }
    if (behaviour?.summary?.avgConduct != null) { conductWeighted += behaviour.summary.avgConduct * classSize; conductWeight += classSize; }
    if (attendance?.totals?.attendanceRate != null) { attendanceWeighted += attendance.totals.attendanceRate * classSize; attendanceWeight += classSize; }

    openWarnings += (academicWarnings.total ?? 0) + (behaviourWarnings.total ?? 0)
      + absenceWarnings.filter((w) => w.status === "OPEN").length;
  }

  return {
    classCount: classes.length,
    totalStudents,
    attendanceRate: attendanceWeight > 0 ? Math.round((attendanceWeighted / attendanceWeight) * 10) / 10 : null,
    avgGpa: gpaWeight > 0 ? Math.round((gpaWeighted / gpaWeight) * 100) / 100 : null,
    avgConduct: conductWeight > 0 ? Math.round((conductWeighted / conductWeight) * 10) / 10 : null,
    openWarnings,
  };
}

const EFFICIENCY_COLUMNS = (groupLabel) => [
  { key: "groupLabel", label: groupLabel },
  { key: "classCount", label: "Số lớp" },
  { key: "totalStudents", label: "Sĩ số" },
  { key: "attendanceRate", label: "Chuyên cần (%)" },
  { key: "avgGpa", label: "Điểm TB" },
  { key: "avgConduct", label: "Hạnh kiểm TB" },
  { key: "openWarnings", label: "Cảnh báo đang mở" },
];

function fillDashes(row) {
  return {
    ...row,
    attendanceRate: row.attendanceRate ?? "—",
    avgGpa: row.avgGpa ?? "—",
    avgConduct: row.avgConduct ?? "—",
  };
}

async function buildEfficiencyByGrade(filters) {
  const { semesterId } = filters;
  if (!semesterId) throw httpError("Cần chọn học kỳ", 400);
  const sem = await resolveSemesterRange(semesterId);
  if (!sem) throw httpError("Không tìm thấy học kỳ", 404);

  const allClasses = await studentProfileModel.findAllClasses();
  const classesInYear = allClasses.filter((c) => c.schoolYearId === sem.schoolYearId);

  const gradeMap = new Map();
  for (const c of classesInYear) {
    if (!gradeMap.has(c.gradeId)) gradeMap.set(c.gradeId, { gradeId: c.gradeId, gradeName: c.gradeName, classes: [] });
    gradeMap.get(c.gradeId).classes.push(c);
  }

  const rows = [];
  for (const grade of [...gradeMap.values()].sort((a, b) => a.gradeId - b.gradeId)) {
    const metrics = await computeGroupMetrics(grade.classes, semesterId, sem.schoolYearId, sem.startDate, sem.endDate);
    rows.push(fillDashes({ groupLabel: grade.gradeName, ...metrics }));
  }

  return {
    sections: [{ heading: "Hiệu quả vận hành theo khối lớp", columns: EFFICIENCY_COLUMNS("Khối"), rows }],
    filtersLabel: `Theo khối · Học kỳ ${sem.semesterName} · ${sem.schoolYearName}`,
  };
}

async function buildEfficiencyBySemester() {
  const [semesters, allClasses] = await Promise.all([
    studentProfileModel.findSemesters(),
    studentProfileModel.findAllClasses(),
  ]);

  const rows = [];
  for (const sem of semesters) {
    const classesInYear = allClasses.filter((c) => c.schoolYearId === sem.schoolYearId);
    const metrics = classesInYear.length > 0
      ? await computeGroupMetrics(classesInYear, sem.semesterId, sem.schoolYearId, sem.startDate, sem.endDate)
      : { classCount: 0, totalStudents: 0, attendanceRate: null, avgGpa: null, avgConduct: null, openWarnings: 0 };
    rows.push(fillDashes({ groupLabel: `${sem.semesterName} · ${sem.schoolYearName}`, ...metrics }));
  }

  return {
    sections: [{ heading: "Hiệu quả vận hành theo học kỳ", columns: EFFICIENCY_COLUMNS("Học kỳ"), rows }],
    filtersLabel: "Theo học kỳ · tất cả năm học",
  };
}

async function buildEfficiency(filters) {
  if (filters.groupBy === "SEMESTER") return buildEfficiencyBySemester();
  return buildEfficiencyByGrade(filters);
}

const BUILDERS = {
  ATTENDANCE: buildAttendance,
  ACADEMIC: buildAcademic,
  BEHAVIOUR: buildBehaviour,
  PROGRESS: buildProgress,
  CLASS_SUMMARY: buildClassSummary,
  GOAL: buildGoals,
  EFFICIENCY: buildEfficiency,
};

/**
 * Generate a normalized report dataset (used for on-screen preview + exports).
 */
async function generate({ reportType, filters }) {
  if (!REPORT_TYPES.includes(reportType)) throw httpError("Loại báo cáo không hợp lệ", 400);
  const builder = BUILDERS[reportType];
  const result = await builder(filters || {});

  return {
    reportType,
    title: REPORT_TITLES[reportType],
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    filtersLabel: result.filtersLabel,
    sections: result.sections,
  };
}

module.exports = {
  REPORT_TYPES,
  REPORT_TITLES,
  ADMIN_ONLY_REPORT_TYPES,
  generate,
};
