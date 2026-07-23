// =========================================================
// Academic policy configuration.
// All scores are normalized to a 10-point scale before averaging,
// so mixed max_score values across score types are handled correctly.
//
// NOTE: weights / thresholds below are configurable defaults. Adjust here
// to match the official academic policy if it differs.
// =========================================================

// Cơ cấu điểm chính thức của nhà trường:
//   ĐĐGtx (hệ số 1) = tối thiểu 1 điểm miệng + 2 điểm kiểm tra 15 phút — LẤY TRUNG BÌNH
//   ĐĐGgk (hệ số 2) = điểm kiểm tra giữa kỳ
//   ĐĐGck (hệ số 3) = điểm kiểm tra cuối kỳ
//   ĐTB môn = (ĐĐGtx×1 + ĐĐGgk×2 + ĐĐGck×3) / 6
//            (mẫu số = tổng hệ số các NHÓM có điểm → khi đủ 3 nhóm là /6)
// Các đầu điểm thường xuyên TX1/TX2/TX3 thuộc CÙNG nhóm TX và được lấy TRUNG BÌNH
// (không cộng riêng từng cột) trước khi nhân hệ số 1.
const SCORE_TYPES = ["TX1", "TX2", "TX3", "MIDTERM", "FINAL"];

// Nhóm hệ số của mỗi đầu điểm.
const SCORE_GROUP = { TX1: "TX", TX2: "TX", TX3: "TX", MIDTERM: "GK", FINAL: "CK" };
// Hệ số theo NHÓM (không phải theo từng cột TX).
const GROUP_WEIGHT = { TX: 1, GK: 2, CK: 3 };
const GROUP_LABEL  = { TX: "Thường xuyên", GK: "Giữa kỳ", CK: "Cuối kỳ" };

// Loại đầu điểm thường xuyên — để kiểm tra tối thiểu 1 miệng + 2 bài 15 phút.
const SCORE_TYPE_KIND = { TX1: "ORAL", TX2: "QUIZ_15", TX3: "QUIZ_15", MIDTERM: "MIDTERM", FINAL: "FINAL" };
const REQUIRED_TX = { ORAL: 1, QUIZ_15: 2 };

// Hệ số hiển thị cho từng đầu điểm = hệ số của nhóm nó thuộc về.
const SCORE_TYPE_WEIGHTS = {
  TX1:     GROUP_WEIGHT.TX,
  TX2:     GROUP_WEIGHT.TX,
  TX3:     GROUP_WEIGHT.TX,
  MIDTERM: GROUP_WEIGHT.GK,
  FINAL:   GROUP_WEIGHT.CK,
};

const SCORE_TYPE_LABELS = {
  TX1:     "Miệng",
  TX2:     "15 phút",
  TX3:     "15 phút",
  MIDTERM: "Giữa kỳ",
  FINAL:   "Cuối kỳ",
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
  SCORE_GROUP,
  GROUP_WEIGHT,
  GROUP_LABEL,
  SCORE_TYPE_KIND,
  REQUIRED_TX,
  SUBJECT_PASS_THRESHOLD,
  STANDING_BANDS,
  WARNING_RULES,
  GRADE_BUCKETS,
  getStanding,
};
