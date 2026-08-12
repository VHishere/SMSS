/*
 * One-off migration scoping managed group conversations to a class/area.
 *
 * Trước đây nhóm lớp được nhận diện bằng tiêu đề (`Nhóm lớp 10B1`). Tên lớp
 * không unique — trùng giữa các năm học và trùng ngay trong cùng một năm — nên
 * học sinh của lớp này bị gộp vào nhóm của lớp khác. Migration này:
 *
 *   1. Thêm group_kind / class_id / area_id vào bảng conversation.
 *   2. Backfill các nhóm hệ thống về đúng lớp/khu nội trú của chúng.
 *   3. Gắn class_id cho nhóm giáo viên tự tạo (không đụng vào thành viên).
 *   4. Gỡ thành viên không còn thuộc lớp/khu khỏi các nhóm hệ thống.
 *
 * Bước 4 có xóa dữ liệu (chỉ xóa dòng conversation_participant, tin nhắn giữ
 * nguyên). Chạy với --dry-run để xem trước, không đổi gì:
 *
 *   npm run migrate:conversation-class-scope -- --dry-run
 *   npm run migrate:conversation-class-scope
 *
 * An toàn khi chạy lại nhiều lần.
 */
const { pool } = require("../config/db");
const commModel = require("../models/communication.model");

const DRY_RUN = process.argv.includes("--dry-run");

const GROUP_KINDS = [
  {
    kind: "CLASS",
    prefix: "Nhóm lớp ",
    scope: "class",
    roster: (id) => commModel.findClassGroupParticipants(id),
  },
  {
    kind: "CLASS_PARENTS",
    prefix: "Nhóm phụ huynh lớp ",
    scope: "class",
    roster: (id) => commModel.findParentClassGroupParticipants(id),
  },
  {
    kind: "BOARDING",
    prefix: "Nhóm nội trú ",
    scope: "area",
    roster: (id) => commModel.findBoardingGroupParticipants(id),
  },
];

async function hasColumn(column) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'conversation'
       AND COLUMN_NAME = ?`,
    [column],
  );
  return row.cnt > 0;
}

async function addColumns() {
  if (await hasColumn("group_kind")) {
    console.log("✔ Cột group_kind/class_id/area_id đã tồn tại, bỏ qua.");
    return;
  }

  await pool.query(
    `ALTER TABLE conversation
       ADD COLUMN group_kind ENUM('CLASS','CLASS_PARENTS','BOARDING') NULL AFTER title,
       ADD COLUMN class_id BIGINT NULL AFTER group_kind,
       ADD COLUMN area_id BIGINT NULL AFTER class_id,
       ADD CONSTRAINT fk_conversation_class
         FOREIGN KEY (class_id) REFERENCES school_class (class_id),
       ADD CONSTRAINT fk_conversation_area
         FOREIGN KEY (area_id) REFERENCES supervisor_area (area_id)`,
  );
  console.log("✔ Đã thêm group_kind, class_id, area_id vào bảng conversation.");

  // Một lớp chỉ được có duy nhất một nhóm học sinh và một nhóm phụ huynh.
  // Đây là ràng buộc thay thế cho việc dò theo tiêu đề.
  await pool.query(
    `ALTER TABLE conversation
       ADD UNIQUE KEY uq_conversation_class_group (group_kind, class_id),
       ADD UNIQUE KEY uq_conversation_area_group (group_kind, area_id)`,
  );
  console.log("✔ Đã thêm ràng buộc duy nhất cho nhóm theo lớp/khu.");
}

// Tiêu đề cũ không đủ để suy ra lớp khi tên lớp bị trùng. Với các ứng viên cùng
// tên, chọn lớp có nhiều thành viên hiện tại trùng với thành viên nhóm nhất —
// đó gần như chắc chắn là lớp mà nhóm được tạo ra cho.
async function resolveScopeId(conversation, spec) {
  const label = conversation.title.slice(spec.prefix.length).trim();
  if (!label) return null;

  const [candidates] = spec.scope === "class"
    ? await pool.query(
      `SELECT sc.class_id AS id
       FROM school_class sc
       INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
       WHERE sc.class_name = ?
       ORDER BY sy.is_active DESC, sy.start_date DESC, sc.class_id DESC`,
      [label],
    )
    : await pool.query(
      `SELECT area_id AS id FROM supervisor_area WHERE area_name = ? ORDER BY area_id ASC`,
      [label],
    );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  const [members] = await pool.query(
    `SELECT user_id AS userId FROM conversation_participant WHERE conversation_id = ?`,
    [conversation.conversationId],
  );
  const memberIds = new Set(members.map((m) => Number(m.userId)));

  let best = null;
  for (const candidate of candidates) {
    const roster = await spec.roster(candidate.id);
    const overlap = roster.filter((p) => memberIds.has(Number(p.userId))).length;
    if (!best || overlap > best.overlap) {
      best = { id: candidate.id, overlap };
    }
  }

  return best.overlap > 0 ? best.id : candidates[0].id;
}

async function backfillScopes() {
  let resolved = 0;
  let unresolved = 0;

  for (const spec of GROUP_KINDS) {
    const [rows] = await pool.query(
      `SELECT conversation_id AS conversationId, title
       FROM conversation
       WHERE conversation_type = 'GROUP'
         AND group_kind IS NULL
         AND title LIKE ?
       ORDER BY conversation_id ASC`,
      [`${spec.prefix}%`],
    );

    for (const conversation of rows) {
      const scopeId = await resolveScopeId(conversation, spec);

      if (!scopeId) {
        unresolved += 1;
        console.log(
          `  ⚠ Không xác định được ${spec.scope} cho hội thoại #${conversation.conversationId} "${conversation.title}" — bỏ qua.`,
        );
        continue;
      }

      // Nếu lớp/khu này đã có nhóm được gắn (do tiêu đề trùng gộp nhầm trước
      // đây), để nguyên bản sao thừa: nó thành nhóm thủ công, không tự đồng bộ.
      const [[taken]] = await pool.query(
        `SELECT conversation_id AS conversationId FROM conversation
         WHERE group_kind = ? AND ${spec.scope === "class" ? "class_id" : "area_id"} = ?
         LIMIT 1`,
        [spec.kind, scopeId],
      );

      if (taken) {
        unresolved += 1;
        console.log(
          `  ⚠ Hội thoại #${conversation.conversationId} "${conversation.title}" trùng phạm vi với #${taken.conversationId} — giữ nguyên dạng nhóm thủ công.`,
        );
        continue;
      }

      if (!DRY_RUN) {
        await pool.query(
          `UPDATE conversation
           SET group_kind = ?, ${spec.scope === "class" ? "class_id" : "area_id"} = ?
           WHERE conversation_id = ?`,
          [spec.kind, scopeId, conversation.conversationId],
        );
      }

      resolved += 1;
      console.log(
        `  → #${conversation.conversationId} "${conversation.title}" ⇒ ${spec.kind} ${spec.scope}_id=${scopeId}`,
      );
    }
  }

  console.log(`✔ Backfill: ${resolved} nhóm được gắn phạm vi, ${unresolved} nhóm bỏ qua.`);
}

// Nhóm do giáo viên tự đặt tên (`Nhóm thông báo lớp 10B3`) không khớp tiền tố
// nào ở trên nhưng vẫn gắn với một lớp. Gắn class_id cho chúng để cổng lọc theo
// lớp hoạt động; group_kind vẫn để NULL nên roster không bị tự động sửa.
async function backfillManualClassGroups() {
  const [rows] = await pool.query(
    `SELECT conversation_id AS conversationId, title, created_by AS createdBy
     FROM conversation
     WHERE conversation_type = 'GROUP'
       AND group_kind IS NULL
       AND class_id IS NULL
       AND title IS NOT NULL
     ORDER BY conversation_id ASC`,
  );

  let scoped = 0;

  for (const conversation of rows) {
    const [candidates] = await pool.query(
      `SELECT sc.class_id AS id, sc.class_name AS name
       FROM school_class sc
       WHERE CHAR_LENGTH(sc.class_name) >= 3
         AND ? LIKE CONCAT('%', sc.class_name, '%')
       ORDER BY CHAR_LENGTH(sc.class_name) DESC, sc.class_id DESC`,
      [conversation.title],
    );

    if (candidates.length === 0) continue;

    const [members] = await pool.query(
      `SELECT user_id AS userId FROM conversation_participant WHERE conversation_id = ?`,
      [conversation.conversationId],
    );
    const memberIds = new Set(members.map((m) => Number(m.userId)));

    // Chỉ nhận lớp có thành viên thật sự trùng khớp — tránh đoán mò từ tên.
    let best = null;
    for (const candidate of candidates) {
      const roster = await commModel.findClassGroupParticipants(candidate.id);
      const overlap = roster.filter((p) => memberIds.has(Number(p.userId))).length;
      if (overlap > 0 && (!best || overlap > best.overlap)) {
        best = { id: candidate.id, name: candidate.name, overlap };
      }
    }

    if (!best) {
      console.log(
        `  ⚠ #${conversation.conversationId} "${conversation.title}" không khớp lớp nào còn thành viên — bỏ qua.`,
      );
      continue;
    }

    if (!DRY_RUN) {
      await pool.query(
        `UPDATE conversation SET class_id = ? WHERE conversation_id = ?`,
        [best.id, conversation.conversationId],
      );
    }

    scoped += 1;
    console.log(
      `  → #${conversation.conversationId} "${conversation.title}" ⇒ class_id=${best.id} (${best.name}, khớp ${best.overlap} thành viên)`,
    );

    // Không xóa ai khỏi nhóm thủ công — giáo viên có thể đã thêm người ngoài lớp
    // một cách có chủ đích. Cổng lọc theo lớp lo phần hiển thị.
  }

  console.log(`✔ Nhóm thủ công: ${scoped} nhóm được gắn class_id.`);
}

async function cleanupRosters() {
  let totalAdded = 0;
  let totalRemoved = 0;

  for (const spec of GROUP_KINDS) {
    const scopeColumn = spec.scope === "class" ? "class_id" : "area_id";
    const [groups] = await pool.query(
      `SELECT conversation_id AS conversationId, title, ${scopeColumn} AS scopeId
       FROM conversation
       WHERE group_kind = ? AND ${scopeColumn} IS NOT NULL
       ORDER BY conversation_id ASC`,
      [spec.kind],
    );

    for (const group of groups) {
      const roster = await spec.roster(group.scopeId);

      if (roster.length === 0) {
        console.log(
          `  ⚠ #${group.conversationId} "${group.title}" không còn thành viên hợp lệ — giữ nguyên để rà soát thủ công.`,
        );
        continue;
      }

      if (DRY_RUN) {
        const keepIds = roster.map((p) => Number(p.userId));
        const [stale] = await pool.query(
          `SELECT user_id AS userId FROM conversation_participant
           WHERE conversation_id = ? AND user_id NOT IN (?)`,
          [group.conversationId, keepIds],
        );

        if (stale.length) {
          totalRemoved += stale.length;
          console.log(
            `  → #${group.conversationId} "${group.title}": sẽ gỡ ${stale.length} thành viên (user_id: ${stale.map((s) => s.userId).join(", ")})`,
          );
        }
        continue;
      }

      const { added, removed } = await commModel.syncParticipants(
        group.conversationId,
        roster,
      );

      totalAdded += added;
      totalRemoved += removed;

      if (added || removed) {
        console.log(
          `  → #${group.conversationId} "${group.title}": +${added} / -${removed} thành viên`,
        );
      }
    }
  }

  console.log(`✔ Đồng bộ thành viên: thêm ${totalAdded}, gỡ ${totalRemoved}.`);
}

async function run() {
  if (DRY_RUN) {
    console.log("── CHẾ ĐỘ THỬ (--dry-run): không ghi thay đổi nào ──\n");
  }

  console.log("1/4 Kiểm tra cấu trúc bảng conversation...");
  if (DRY_RUN && !(await hasColumn("group_kind"))) {
    console.log("  ⚠ Chưa có cột group_kind. Chạy thật một lần trước để xem được backfill.");
    await pool.end();
    return;
  }
  if (!DRY_RUN) await addColumns();

  console.log("\n2/4 Gắn phạm vi lớp/khu cho các nhóm hệ thống...");
  await backfillScopes();

  console.log("\n3/4 Gắn class_id cho nhóm giáo viên tự tạo...");
  await backfillManualClassGroups();

  console.log("\n4/4 Dọn thành viên không còn thuộc lớp/khu (chỉ nhóm hệ thống)...");
  await cleanupRosters();

  console.log("\nHoàn tất migration conversation class scope.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
