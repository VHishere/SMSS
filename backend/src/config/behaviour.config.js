// =========================================================
// Behaviour policy configuration.
// Conduct score starts from BASE and is adjusted by merit (+) / demerit (-).
// NOTE: categories / thresholds are configurable defaults — adjust to match
// the official discipline policy if it differs.
// =========================================================

const MERIT_CATEGORIES = [
  "ACADEMIC_ACHIEVEMENT",
  "GOOD_BEHAVIOUR",
  "HELPING_OTHERS",
  "LEADERSHIP",
  "SCHOOL_ACTIVITIES",
  "COMMUNITY_SERVICE",
];

const VIOLATION_CATEGORIES = [
  "LATE_ATTENDANCE",
  "MISSING_HOMEWORK",
  "CLASSROOM_MISCONDUCT",
  "SCHOOL_RULE_VIOLATION",
  "DISRESPECTFUL_BEHAVIOUR",
];

const CATEGORY_LABELS = {
  ACADEMIC_ACHIEVEMENT:   "Thành tích học tập",
  GOOD_BEHAVIOUR:         "Hành vi tốt",
  HELPING_OTHERS:         "Giúp đỡ bạn bè",
  LEADERSHIP:             "Tinh thần lãnh đạo",
  SCHOOL_ACTIVITIES:      "Hoạt động trường",
  COMMUNITY_SERVICE:      "Phục vụ cộng đồng",
  LATE_ATTENDANCE:        "Đi muộn",
  MISSING_HOMEWORK:       "Không làm bài tập",
  CLASSROOM_MISCONDUCT:   "Vi phạm trong lớp",
  SCHOOL_RULE_VIOLATION:  "Vi phạm nội quy",
  DISRESPECTFUL_BEHAVIOUR:"Thái độ thiếu tôn trọng",
};

const BASE_CONDUCT_SCORE = 100;
const MIN_CONDUCT_SCORE = 0;
const MAX_CONDUCT_SCORE = 100;

// Thang hạnh kiểm CỐ ĐỊNH 5 mức của nhà trường (Tốt / Khá / Trung bình / Yếu / Kém).
// GVCN CHỐT THỦ CÔNG mức này; điểm final_score dưới đây chỉ là GỢI Ý THAM KHẢO
// (suy từ khen/kỷ luật) để GV cân nhắc, KHÔNG tự động quyết định xếp loại.
const CONDUCT_GRADES = [
  { key: "TOT", label: "Tốt" },
  { key: "KHA", label: "Khá" },
  { key: "TB",  label: "Trung bình" },
  { key: "YEU", label: "Yếu" },
  { key: "KEM", label: "Kém" },
];
const CONDUCT_GRADE_KEYS = CONDUCT_GRADES.map((g) => g.key);
const CONDUCT_GRADE_LABEL = Object.fromEntries(CONDUCT_GRADES.map((g) => [g.key, g.label]));

// Ngưỡng điểm cho mức GỢI Ý (tham khảo), xét top-down.
const CONDUCT_BANDS = [
  { key: "TOT", label: "Tốt",        min: 80 },
  { key: "KHA", label: "Khá",        min: 65 },
  { key: "TB",  label: "Trung bình", min: 50 },
  { key: "YEU", label: "Yếu",        min: 35 },
  { key: "KEM", label: "Kém",        min: 0 },
];

const WARNING_RULES = {
  LOW_CONDUCT_BELOW:        50, // final conduct score < 50
  EXCESSIVE_VIOLATION_COUNT: 3, // >= 3 active violation records in the semester
  EXCESSIVE_DEMERIT_POINTS:  20, // OR total demerit points >= 20
};

const CONDUCT_BUCKETS = [
  { key: "0-35",   label: "Kém (<35)",          min: 0,  max: 35 },
  { key: "35-50",  label: "Yếu (35–50)",        min: 35, max: 50 },
  { key: "50-65",  label: "Trung bình (50–65)", min: 50, max: 65 },
  { key: "65-80",  label: "Khá (65–80)",        min: 65, max: 80 },
  { key: "80-100", label: "Tốt (80–100)",       min: 80, max: 101 },
];

// Mức hạnh kiểm GỢI Ý từ điểm tham khảo (GV vẫn là người chốt).
function getConductGrade(score) {
  if (score === null || score === undefined) return { key: "NA", label: "Chưa đánh giá" };
  for (const b of CONDUCT_BANDS) {
    if (score >= b.min) return { key: b.key, label: b.label };
  }
  return CONDUCT_BANDS[CONDUCT_BANDS.length - 1];
}

module.exports = {
  MERIT_CATEGORIES,
  VIOLATION_CATEGORIES,
  CATEGORY_LABELS,
  BASE_CONDUCT_SCORE,
  MIN_CONDUCT_SCORE,
  MAX_CONDUCT_SCORE,
  CONDUCT_BANDS,
  CONDUCT_GRADES,
  CONDUCT_GRADE_KEYS,
  CONDUCT_GRADE_LABEL,
  WARNING_RULES,
  CONDUCT_BUCKETS,
  getConductGrade,
};
