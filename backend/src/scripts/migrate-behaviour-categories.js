/*
 * One-off migration for a DB-backed merit/violation category catalog, with a
 * configurable point value per category ("mức độ cộng/trừ") that admin can
 * manage — this becomes the basis (căn cứ) referenced when logging behaviour
 * records and computing conduct scores. Replaces the previously hardcoded
 * MERIT_CATEGORIES/VIOLATION_CATEGORIES config. Safe to run multiple times.
 *
 * Usage: npm run migrate:behaviour-categories
 */
const { pool } = require("../config/db");

const SEED_CATEGORIES = [
  { code: "ACADEMIC_ACHIEVEMENT",   behaviorType: "POSITIVE",  label: "Thành tích học tập",        points: 15 },
  { code: "GOOD_BEHAVIOUR",         behaviorType: "POSITIVE",  label: "Hành vi tốt",                points: 10 },
  { code: "HELPING_OTHERS",         behaviorType: "POSITIVE",  label: "Giúp đỡ bạn bè",             points: 5 },
  { code: "LEADERSHIP",             behaviorType: "POSITIVE",  label: "Tinh thần lãnh đạo",         points: 10 },
  { code: "SCHOOL_ACTIVITIES",      behaviorType: "POSITIVE",  label: "Hoạt động trường",           points: 10 },
  { code: "COMMUNITY_SERVICE",      behaviorType: "POSITIVE",  label: "Phục vụ cộng đồng",          points: 10 },
  { code: "LATE_ATTENDANCE",        behaviorType: "VIOLATION", label: "Đi muộn",                    points: 2, affectsConductDefault: false },
  { code: "MISSING_HOMEWORK",       behaviorType: "VIOLATION", label: "Không làm bài tập",          points: 2, affectsConductDefault: false },
  { code: "CLASSROOM_MISCONDUCT",   behaviorType: "VIOLATION", label: "Vi phạm trong lớp",          points: 5, affectsConductDefault: false },
  { code: "SCHOOL_RULE_VIOLATION",  behaviorType: "VIOLATION", label: "Vi phạm nội quy",            points: 10, affectsConductDefault: true },
  { code: "DISRESPECTFUL_BEHAVIOUR", behaviorType: "VIOLATION", label: "Thái độ thiếu tôn trọng",   points: 10, affectsConductDefault: true },
];

async function run() {
  console.log("Đang kiểm tra bảng behaviour_category...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS behaviour_category (
      category_id BIGINT NOT NULL AUTO_INCREMENT,
      code VARCHAR(50) NOT NULL,
      behavior_type ENUM('POSITIVE','VIOLATION') NOT NULL,
      label VARCHAR(150) NOT NULL,
      points INT NOT NULL DEFAULT 0,
      affects_conduct_default TINYINT(1) NOT NULL DEFAULT 0,
      status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      created_by BIGINT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (category_id),
      UNIQUE KEY uq_behaviour_category_code (code),
      CONSTRAINT fk_behaviour_category_created_by
        FOREIGN KEY (created_by) REFERENCES user_account (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("✔ Bảng behaviour_category sẵn sàng.");

  const [[{ cnt }]] = await pool.query("SELECT COUNT(*) AS cnt FROM behaviour_category");
  if (cnt > 0) {
    console.log("✔ Đã có dữ liệu danh mục, bỏ qua seed.");
  } else {
    for (const c of SEED_CATEGORIES) {
      await pool.query(
        `INSERT INTO behaviour_category (code, behavior_type, label, points, affects_conduct_default)
         VALUES (?, ?, ?, ?, ?)`,
        [c.code, c.behaviorType, c.label, c.points, c.affectsConductDefault ? 1 : 0],
      );
    }
    console.log(`✔ Đã seed ${SEED_CATEGORIES.length} danh mục khen thưởng/vi phạm.`);
  }

  console.log("Hoàn tất migration behaviour_category.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
