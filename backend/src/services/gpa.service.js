const {
  SCORE_TYPE_WEIGHTS,
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

  let weightedSum = 0;
  let weightTotal = 0;

  for (const r of rows) {
    const weight = SCORE_TYPE_WEIGHTS[r.scoreType] ?? 1;
    weightedSum += normalize(r.scoreValue, r.maxScore) * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;
  return round2(weightedSum / weightTotal);
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

  return {
    gpa,
    standing: getStanding(gpa),
    subjects,
    failedCount: failedSubjects.length,
    failedSubjects: failedSubjects.map((s) => s.subjectName),
  };
}

module.exports = {
  round2,
  normalize,
  subjectAverage,
  subjectAverages,
  computeGpa,
  buildStudentSemesterSummary,
};
