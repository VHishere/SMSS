// =========================================================
// Academic policy configuration.
// All scores are normalized to a 10-point scale before averaging,
// so mixed max_score values across score types are handled correctly.
//
// NOTE: weights / thresholds below are configurable defaults. Adjust here
// to match the official academic policy if it differs.
// =========================================================

// Supported score types (UC requirement) and their weight (hệ số) used when
// computing a subject's weighted average.
const SCORE_TYPE_WEIGHTS = {
  QUIZ:          1,
  PARTICIPATION: 1,
  HOMEWORK:      1,
  ASSIGNMENT:    1,
  MIDTERM:       2,
  FINAL:         3,
};

const SCORE_TYPES = Object.keys(SCORE_TYPE_WEIGHTS);

const SCORE_TYPE_LABELS = {
  QUIZ:          "Kiểm tra ngắn",
  PARTICIPATION: "Điểm chuyên cần",
  HOMEWORK:      "Bài tập về nhà",
  ASSIGNMENT:    "Bài tập lớn",
  MIDTERM:       "Giữa kỳ",
  FINAL:         "Cuối kỳ",
};

// Pass threshold for a single subject (10-scale).
const SUBJECT_PASS_THRESHOLD = 5.0;

// Academic standing bands (10-scale), evaluated top-down.
const STANDING_BANDS = [
  { key: "GIOI",   label: "Giỏi",        min: 8.0 },
  { key: "KHA",    label: "Khá",         min: 6.5 },
  { key: "TB",     label: "Trung bình",  min: 5.0 },
  { key: "YEU",    label: "Yếu",         min: 3.5 },
  { key: "KEM",    label: "Kém",         min: 0 },
];

// Warning thresholds.
const WARNING_RULES = {
  LOW_GPA_BELOW:        5.0, // GPA < 5.0
  AT_RISK_BELOW:        3.5, // GPA < 3.5
  MULTIPLE_FAIL_COUNT:  2,   // >= 2 subjects below pass threshold
  DECLINING_DROP:       1.0, // GPA dropped >= 1.0 vs previous semester
};

// Grade distribution buckets for analytics charts (10-scale).
const GRADE_BUCKETS = [
  { key: "0-3.5",   label: "Kém (0–3.5)",        min: 0,   max: 3.5 },
  { key: "3.5-5",   label: "Yếu (3.5–5)",        min: 3.5, max: 5.0 },
  { key: "5-6.5",   label: "Trung bình (5–6.5)", min: 5.0, max: 6.5 },
  { key: "6.5-8",   label: "Khá (6.5–8)",        min: 6.5, max: 8.0 },
  { key: "8-10",    label: "Giỏi (8–10)",        min: 8.0, max: 10.01 },
];

function getStanding(gpa) {
  if (gpa === null || gpa === undefined) return { key: "NA", label: "Chưa có điểm" };
  for (const band of STANDING_BANDS) {
    if (gpa >= band.min) return { key: band.key, label: band.label };
  }
  return STANDING_BANDS[STANDING_BANDS.length - 1];
}

module.exports = {
  SCORE_TYPE_WEIGHTS,
  SCORE_TYPES,
  SCORE_TYPE_LABELS,
  SUBJECT_PASS_THRESHOLD,
  STANDING_BANDS,
  WARNING_RULES,
  GRADE_BUCKETS,
  getStanding,
};
