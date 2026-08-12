/*
 * One-off migration đổi tên loại điểm cũ (QUIZ / ASSIGNMENT / DEMO_WEEK) sang
 * đúng mã điểm thường xuyên TX1 / TX2 / TX3.
 *
 * Ba giá trị này chỉ tồn tại trong DB (do seed cũ), không có chỗ nào trong code
 * sinh ra chúng. Vì SCORE_GROUP trong academic.config chỉ biết TX1-3, MIDTERM,
 * FINAL nên gpa.service ÂM THẦM bỏ qua mọi dòng mang tên cũ: học sinh chỉ có
 * mỗi điểm ASSIGNMENT sẽ hiện GPA rỗng, và toàn bộ điểm DEMO_WEEK của tuần demo
 * không hiển thị ở đâu cả.
 *
 * MIDTERM và FINAL giữ nguyên.
 *
 *   npm run migrate:score-types -- --dry-run
 *   npm run migrate:score-types
 *
 * An toàn khi chạy lại nhiều lần: chỉ đụng vào các dòng còn mang tên cũ.
 */
const { pool } = require("../config/db");

const DRY_RUN = process.argv.includes("--dry-run");

// QUIZ → TX1 (miệng), ASSIGNMENT → TX2, DEMO_WEEK → TX3 (đều là 15 phút).
const RENAMES = [
  ["QUIZ", "TX1"],
  ["ASSIGNMENT", "TX2"],
  ["DEMO_WEEK", "TX3"],
];

async function countLegacy(table) {
  const [rows] = await pool.query(
    `SELECT score_type AS scoreType, COUNT(*) AS cnt
     FROM ${table}
     WHERE score_type IN (?)
     GROUP BY score_type
     ORDER BY score_type`,
    [RENAMES.map(([from]) => from)],
  );
  return rows;
}

// uq_result_cell là (student_id, subject_id, semester_id, score_type): nếu ô
// đích đã có điểm thì đổi tên sẽ vỡ khóa. Tìm trước để báo thay vì để MySQL ném.
async function findCollisions(from, to) {
  const [rows] = await pool.query(
    `SELECT old.result_id AS resultId,
            old.student_id AS studentId,
            old.subject_id AS subjectId,
            old.semester_id AS semesterId,
            old.score_value AS oldValue,
            keep.score_value AS existingValue
     FROM academic_result old
     INNER JOIN academic_result keep
       ON keep.student_id = old.student_id
       AND keep.subject_id = old.subject_id
       AND keep.semester_id = old.semester_id
       AND keep.score_type = ?
     WHERE old.score_type = ?`,
    [to, from],
  );
  return rows;
}

async function run() {
  if (DRY_RUN) {
    console.log("── CHẾ ĐỘ THỬ (--dry-run): không ghi thay đổi nào ──\n");
  }

  console.log("1/3 Kiểm tra dữ liệu mang tên loại điểm cũ...");
  const before = await countLegacy("academic_result");
  const beforeLog = await countLegacy("academic_result_log");

  if (before.length === 0 && beforeLog.length === 0) {
    console.log("✔ Không còn dòng nào mang tên cũ. Không cần làm gì.");
    await pool.end();
    return;
  }

  for (const row of before) {
    const target = RENAMES.find(([from]) => from === row.scoreType)[1];
    console.log(`  academic_result: ${row.scoreType} → ${target} (${row.cnt} dòng)`);
  }
  for (const row of beforeLog) {
    const target = RENAMES.find(([from]) => from === row.scoreType)[1];
    console.log(`  academic_result_log: ${row.scoreType} → ${target} (${row.cnt} dòng)`);
  }

  console.log("\n2/3 Kiểm tra trùng khóa uq_result_cell...");
  const blockedIds = new Map(); // from → [result_id bị bỏ qua]
  let blocked = 0;

  for (const [from, to] of RENAMES) {
    const collisions = await findCollisions(from, to);
    blockedIds.set(from, collisions.map((c) => c.resultId));
    if (collisions.length === 0) continue;

    blocked += collisions.length;
    console.log(
      `  ⚠ ${collisions.length} dòng ${from} không đổi được vì ô ${to} đã có điểm:`,
    );
    for (const c of collisions) {
      console.log(
        `      HS ${c.studentId} · môn ${c.subjectId} · kỳ ${c.semesterId}: ` +
          `${from}=${c.oldValue} nhưng ${to}=${c.existingValue} đã tồn tại`,
      );
    }
  }

  if (blocked === 0) {
    console.log("  ✔ Không có trùng khóa.");
  } else {
    console.log(
      `\n  → ${blocked} dòng trên sẽ được BỎ QUA. Cần xử lý tay: giữ điểm nào ` +
        "thì xóa/đổi dòng còn lại rồi chạy lại script.",
    );
  }

  if (DRY_RUN) {
    console.log("\nDừng ở đây vì đang chạy --dry-run.");
    await pool.end();
    return;
  }

  console.log("\n3/3 Đổi tên loại điểm...");
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    let renamed = 0;
    let renamedLog = 0;

    for (const [from, to] of RENAMES) {
      // Loại trừ bằng danh sách id đã phát hiện ở bước 2 — MySQL không cho tham
      // chiếu lại chính bảng đang UPDATE trong subquery (lỗi 1093).
      const skip = blockedIds.get(from) || [];
      const [result] = await connection.query(
        `UPDATE academic_result
         SET score_type = ?
         WHERE score_type = ?
           ${skip.length ? "AND result_id NOT IN (?)" : ""}`,
        skip.length ? [to, from, skip] : [to, from],
      );
      renamed += result.affectedRows;

      const [logResult] = await connection.query(
        "UPDATE academic_result_log SET score_type = ? WHERE score_type = ?",
        [to, from],
      );
      renamedLog += logResult.affectedRows;
    }

    await connection.commit();
    console.log(`✔ academic_result: đã đổi ${renamed} dòng.`);
    console.log(`✔ academic_result_log: đã đổi ${renamedLog} dòng.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const after = await countLegacy("academic_result");
  if (after.length > 0) {
    console.log(
      `\nℹ Còn ${after.reduce((sum, r) => sum + Number(r.cnt), 0)} dòng mang tên cũ ` +
        "do trùng khóa — xem phần cảnh báo ở bước 2.",
    );
  }

  console.log("\nHoàn tất migration loại điểm.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
