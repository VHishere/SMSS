const {
  BASE_CONDUCT_SCORE,
  MIN_CONDUCT_SCORE,
  MAX_CONDUCT_SCORE,
  getConductGrade,
} = require("../config/behaviour.config");

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Compute the final conduct score from merit / demerit points + a manual
 * teacher adjustment, clamped to [MIN, MAX].
 *
 * finalScore = clamp(base + merit - demerit + adjustment)
 */
function computeConduct({ meritPoints = 0, demeritPoints = 0, adjustment = 0, base = BASE_CONDUCT_SCORE }) {
  const raw = base + Number(meritPoints) - Number(demeritPoints) + Number(adjustment);
  const finalScore = clamp(Math.round(raw), MIN_CONDUCT_SCORE, MAX_CONDUCT_SCORE);
  return {
    base,
    meritPoints: Number(meritPoints),
    demeritPoints: Number(demeritPoints),
    adjustment: Number(adjustment),
    finalScore,
    grade: getConductGrade(finalScore),
  };
}

module.exports = { computeConduct, clamp };
