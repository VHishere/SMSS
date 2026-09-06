const {
  SCORE_GROUP,
  GROUP_WEIGHT,
  SCORE_TYPE_KIND,
  REQUIRED_TX,
  SUBJECT_PASS_THRESHOLD,
  getStanding,
} = require("../config/academic.config");

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Normalize a raw score to the 10-point scale.
function normalize(scoreValue, maxScore) {
  if (maxScore <= 0) return 0;
  return (Number(scoreValue) / Number(maxScore)) * 10;
}

/**
 * Compute a weighted subject average (10-scale) from raw score rows.
 * rows: [{ scoreType, scoreValue, maxScore }]
 * Returns null if there are no scores.
 */
function subjectAverage(rows) {
  if (!rows || rows.length === 0) return null;

  // Gom theo nhóm hệ số. Nhóm TX (thường xuyên) lấy TRUNG BÌNH các đầu điểm rồi
  // mới nhân hệ số 1; GK hệ số 2; CK hệ số 3. Mẫu số = tổng hệ số các nhóm CÓ điểm
  // → đủ 3 nhóm là /6. (ĐTB = (ĐĐGtx×1 + ĐĐGgk×2 + ĐĐGck×3)/6)
  const groupVals = { TX: [], GK: [], CK: [] };
  for (const r of rows) {
    const g = SCORE_GROUP[r.scoreType];
    if (!g || !(g in groupVals)) continue;
    const v = normalize(r.scoreValue, r.maxScore);
    if (Number.isFinite(v)) groupVals[g].push(v);
  }

  let weightedSum = 0;
  let weightTotal = 0;
  for (const g of Object.keys(GROUP_WEIGHT)) {
    const vals = groupVals[g];
    if (!vals.length) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    weightedSum += avg * GROUP_WEIGHT[g];
    weightTotal += GROUP_WEIGHT[g];
  }

  if (weightTotal === 0) return null;
  return round2(weightedSum / weightTotal);
}

function hasCompleteScoreSet(rows) {
  const counts = { ORAL: 0, QUIZ_15: 0 };
  let hasMidterm = false;
  let hasFinal = false;

  for (const row of rows || []) {
    const kind = SCORE_TYPE_KIND[row.scoreType];
    if (kind === "ORAL" || kind === "QUIZ_15") counts[kind] += 1;
    if (kind === "MIDTERM") hasMidterm = true;
    if (kind === "FINAL") hasFinal = true;
  }

  return counts.ORAL >= REQUIRED_TX.ORAL
    && counts.QUIZ_15 >= REQUIRED_TX.QUIZ_15
    && hasMidterm
    && hasFinal;
}

/**
 * Group flat score rows by subject and compute each subject's average.
 * rows: [{ subjectId, subjectName, scoreType, scoreValue, maxScore }]
 * Returns: [{ subjectId, subjectName, average, passed }]
 */
function subjectAverages(rows) {
  const bySubject = {};
  for (const r of rows) {
    if (!bySubject[r.subjectId]) {
      bySubject[r.subjectId] = { subjectId: r.subjectId, subjectName: r.subjectName, rows: [] };
    }
    bySubject[r.subjectId].rows.push(r);
  }

  return Object.values(bySubject).map((s) => {
    const avg = subjectAverage(s.rows);
    return {
      subjectId:   s.subjectId,
      subjectName: s.subjectName,
      average:     avg,
      passed:      avg === null ? null : avg >= SUBJECT_PASS_THRESHOLD,
      complete:    hasCompleteScoreSet(s.rows),
    };
  });
}

/**
 * GPA = mean of subject averages (equal weight per subject).
 * Returns null when no subject has any score.
 */
function computeGpa(subjectResults) {
  const valid = subjectResults.filter((s) => s.average !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, s) => acc + s.average, 0);
  return round2(sum / valid.length);
}

/**
 * Full academic summary for one student in one semester.
 */
function buildStudentSemesterSummary(rows) {
  const subjects = subjectAverages(rows);
  const gpa = computeGpa(subjects);
  const failedSubjects = subjects.filter((s) => s.passed === false);
  const complete = subjects.length > 0 && subjects.every((subject) => subject.complete);

  return {
    gpa,
    standing: getStanding(gpa),
    subjects,
    failedCount: failedSubjects.length,
    failedSubjects: failedSubjects.map((s) => s.subjectName),
    complete,
  };
}

function buildOverallScoreSummary(rows) {
  const normalizedRows = (rows || [])
    .filter((row) => Number(row.maxScore) > 0)
    .map((row) => ({
      ...row,
      subjectId: `${row.semesterId}:${row.subjectId}`,
      normalizedScore: normalize(row.scoreValue, row.maxScore),
    }));
  const values = normalizedRows.map((row) => row.normalizedScore);
  const subjectResults = subjectAverages(normalizedRows);

  return {
    totalScores: normalizedRows.length,
    averageScore: computeGpa(subjectResults),
    highestScore: values.length ? round2(Math.max(...values)) : null,
    lowestScore: values.length ? round2(Math.min(...values)) : null,
  };
}

module.exports = {
  round2,
  normalize,
  subjectAverage,
  hasCompleteScoreSet,
  subjectAverages,
  computeGpa,
  buildStudentSemesterSummary,
  buildOverallScoreSummary,
};
