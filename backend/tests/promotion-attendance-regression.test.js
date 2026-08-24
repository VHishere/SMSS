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
