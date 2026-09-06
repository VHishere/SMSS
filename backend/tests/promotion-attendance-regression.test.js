const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("Attendance threshold aggregation counts only period attendance rows", () => {
  const attendanceModel = read("src/models/attendance.model.js");
  const summariesStart = attendanceModel.indexOf("async function findStudentAbsenceSummaries");
  const overviewStart = attendanceModel.indexOf("async function findClassAttendanceOverview");
  const nextAfterOverview = attendanceModel.indexOf("async function", overviewStart + 30);
  const summariesBlock = attendanceModel.slice(summariesStart, overviewStart);
  const overviewBlock = attendanceModel.slice(
    overviewStart,
    nextAfterOverview === -1 ? overviewStart + 3000 : nextAfterOverview,
  );

  assert.match(summariesBlock, /a\.attendance_context = 'CLASS'[\s\S]*a\.timetable_id IS NOT NULL/);
  assert.match(overviewBlock, /a\.attendance_context = 'CLASS'[\s\S]*a\.timetable_id IS NOT NULL/);
});

test("Promotion absence calculation ignores legacy CLASS attendance without timetable", () => {
  const promotionModel = read("src/models/promotion.model.js");
  const start = promotionModel.indexOf("async function findStudentAbsence");
  const end = promotionModel.indexOf("async function", start + 30);
  const block = promotionModel.slice(start, end === -1 ? start + 1800 : end);

  assert.match(block, /a\.attendance_context = 'CLASS'/);
  assert.match(block, /a\.timetable_id IS NOT NULL/);
});

test("Promotion requires all official score types before final-year evaluation", () => {
  const service = read("src/services/promotion.service.js");
  assert.match(service, /missingScoreTypes = SCORE_TYPES\.filter/);
  assert.match(service, /PENDING_DATA/);
});

test("School-year activation rejects dates before start date", () => {
  const model = read("src/models/staff/schoolYears.js");
  assert.match(model, /start_date <= CURDATE\(\) AS hasStarted/);
  assert.match(model, /if \(!normalized\.hasStarted\)/);
});

test("Staff class assignment enforces the grade authorized by promotion", () => {
  const model = read("src/models/staff/classes.js");
  assert.match(model, /promotedGradeId/);
  assert.match(model, /targetClass\.gradeId/);
});

test("Staff boarding assignment prevents duplicate active placements", () => {
  const model = read("src/models/staff/boarding.js");
  const routes = read("src/routes/staff.routes.js");

  assert.match(model, /SELECT student_id FROM student[\s\S]*FOR UPDATE/);
  assert.match(model, /sta\.student_id = \?[\s\S]*sta\.status = 'ACTIVE'[\s\S]*FOR UPDATE/);
  assert.match(model, /current\.length && !allowTransfer/);
  assert.match(model, /SET status = 'INACTIVE', end_date = \?/);
  assert.match(routes, /"\/boarding\/assignments"[\s\S]*authorize\("STAFF"\)/);
});

test("Supervisor modules exclude historical area rows and reject duplicate support cases", () => {
  const supervisor = read("src/models/supervisor.model.js");
  const support = read("src/models/supportCase.model.js");

  const supportCasesStart = supervisor.indexOf("async function findSupportCases");
  const supportCasesEnd = supervisor.indexOf("async function findAreaStudents", supportCasesStart);
  const supportCasesBlock = supervisor.slice(supportCasesStart, supportCasesEnd);
  assert.match(supportCasesBlock, /saa\.status = 'ACTIVE'/);
  assert.match(support, /status IN \('OPEN', 'MONITORING'\)/);
  assert.match(support, /statusCode = 409/);
  assert.match(support, /ORDER BY sy\.is_active DESC, sy\.start_date DESC/);
  assert.doesNotMatch(support, /LEFT JOIN class_enrollment ce ON ce\.student_id = s\.student_id AND ce\.status = 'ACTIVE'/);
});

test("Teacher surveys reject and collapse duplicate open configurations", () => {
  const feedback = read("src/models/feedback.model.js");
  assert.match(feedback, /subject_id <=> \? AND class_id <=> \? AND status = 'OPEN'/);
  assert.match(feedback, /Khảo sát này đang mở và đã tồn tại/);
  assert.match(feedback, /NOT EXISTS \([\s\S]*earlier\.survey_id < ts\.survey_id/);
});

test("Approved leave writes excused period attendance", () => {
  const model = read("src/models/leaveRequest.model.js");
  assert.match(model, /async function markApprovedLeaveAttendance/);
  assert.match(model, /tt\.lesson_date = d\.attendance_date/);
  assert.match(model, /at\.type_name = 'ABSENT_EXCUSED'/);
  assert.match(model, /ON DUPLICATE KEY UPDATE/);
});

test("Student class attendance excludes legacy daily attendance", () => {
  const model = read("src/models/attendance.model.js");
  assert.match(model, /context === "CLASS"[\s\S]*a\.timetable_id IS NOT NULL/);

  const studentModel = read("src/models/students.js");
  const dashboardStart = studentModel.indexOf("async function findDashboardByUserId");
  const dashboardBlock = studentModel.slice(dashboardStart, dashboardStart + 6500);
  assert.match(dashboardBlock, /a\.attendance_context = 'CLASS'/);
  assert.match(dashboardBlock, /a\.timetable_id IS NOT NULL/);
});

test("Dorm attendance is restricted to the 21:00 current-day roll call", () => {
  const model = read("src/models/supervisor.model.js");
  const controller = read("src/controllers/supervisor.controller.js");

  assert.match(model, /opensAt: "21:00"/);
  assert.match(model, /isToday && row\.currentTime >= "21:00"/);
  assert.match(controller, /if \(!attendanceWindow\.canSubmit\)/);
  assert.match(controller, /Điểm danh nội trú chỉ mở từ 21:00/);
});

test("Student attendance combines scheduled lessons with dorm records", () => {
  const page = read("../frontend/src/pages/student/StudentAttendance.jsx");
  assert.match(page, /useStudentTimetable\(selectedDate, 15000\)/);
  assert.match(page, /attendanceStatusLabel/);
  assert.match(page, /record\.context !== "CLASS"/);
});

test("Parent attendance lists scheduled lessons before attendance is recorded", () => {
  const attendanceModel = read("src/models/attendance.model.js");
  const page = read("../frontend/src/pages/parent/StudentAttendanceHistory.jsx");

  assert.match(attendanceModel, /a\.timetable_id\s+AS timetableId/);
  assert.match(page, /useParentStudentTimetable\(studentId, selectedWeekStart, 15000\)/);
  assert.match(page, /NOT_RECORDED/);
  assert.match(page, /NOT_YET/);
  assert.match(page, /21:00 · Nội trú/);
});

test("Dashboard grade summary uses the shared weighted GPA service", () => {
  const model = read("src/models/students.js");
  const dashboardStart = model.indexOf("async function findDashboardByUserId");
  const dashboardBlock = model.slice(dashboardStart, dashboardStart + 6500);
  assert.doesNotMatch(dashboardBlock, /AVG\(score_value\)/);
  assert.match(dashboardBlock, /buildOverallScoreSummary\(gradeRows\)/);
  assert.match(dashboardBlock, /ar\.max_score AS maxScore/);
});

test("Timetable review keeps cancellation and swap semantics", () => {
  const model = read("src/models/timetable.model.js");
  const start = model.indexOf("async function reviewSubstitution");
  const block = model.slice(start, start + 10000);
  assert.match(block, /requestType === "CANCEL"/);
  assert.match(block, /requestType === "SWAP"/);
  assert.doesNotMatch(block, /request_type = CASE WHEN/);
});

test("Substitute teachers must match the exact lesson subject", () => {
  const subjectModel = read("src/models/teacherSubject.model.js");
  const timetableModel = read("src/models/timetable.model.js");
  const modal = read("../frontend/src/components/organisms/SubstitutionModal.jsx");

  assert.match(subjectModel, /tc_subject\.subject_id = sb\.subject_id/);
  assert.match(subjectModel, /subject_specialize\)\) = LOWER\(TRIM\(sb\.subject_name\)\)/);
  assert.doesNotMatch(subjectModel, /LIKE CONCAT/);
  assert.match(timetableModel, /teacherSubjectModel\.teacherCanTeachSubject\([\s\S]*connection/);
  assert.doesNotMatch(modal, /specialize\.includes\(subjectName\)/);
  assert.doesNotMatch(modal, /subjectName\.includes\(specialize\)/);
});

test("Substitution requests apply only to the selected dated lesson", () => {
  const controller = read("src/controllers/teacherTimetable.controller.js");
  const model = read("src/models/timetable.model.js");
  const modal = read("../frontend/src/components/organisms/SubstitutionModal.jsx");

  assert.match(controller, /lesson\.lessonDate[\s\S]*targetDate[\s\S]*đúng ngày của tiết học/);
  assert.match(model, /substitution\.targetDate !== substitution\.lessonDate/);
  assert.match(modal, /selectedLesson\.lessonDate \|\| nextDateForDow/);
});

test("Substitution creation serializes duplicate checks per lesson", () => {
  const model = read("src/models/timetable.model.js");
  const start = model.indexOf("async function createSubstitution");
  const end = model.indexOf("async function findSubstitutionsByRequester", start);
  const block = model.slice(start, end);

  assert.match(block, /beginTransaction/);
  assert.match(block, /FROM timetable WHERE timetable_id = \? FOR UPDATE/);
  assert.match(block, /status IN \('PENDING', 'APPROVED'\)/);
  assert.match(block, /connection\.commit/);
});
