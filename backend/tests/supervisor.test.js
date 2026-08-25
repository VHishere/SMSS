// =============================================================================
// Test API Quản nhiệm (GVQN): phân quyền theo khu + điểm danh hàng loạt.
// Chạy: npm test   (dùng node:test built-in, không cần cài thêm)
// Khởi động app trên cổng ngẫu nhiên rồi gọi HTTP thật (route + auth + controller).
// =============================================================================
const test = require("node:test");
const assert = require("node:assert");

const app = require("../src/app");
const { signToken } = require("../src/utils/jwt");
const { pool } = require("../src/config/db");

let server;
let base;
let A; // { userId, areaId }  — GVQN A
let B; // { userId, areaId }  — GVQN B (khu khác)
let studentsA; // vài student_id thuộc khu của A

test.before(async () => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api/supervisor`;

  // Lấy 2 quản nhiệm KHÁC NHAU, mỗi người 1 khu DORM_FLOOR có học sinh
  const [rows] = await pool.query(
    `SELECT ds.user_id AS userId, sa.area_id AS areaId,
            (SELECT COUNT(*) FROM student_area st WHERE st.area_id = sa.area_id AND st.status = 'ACTIVE') AS hs
     FROM supervisor_area sa
     JOIN dorm_supervisor ds ON ds.supervisor_id = sa.supervisor_id
     WHERE sa.area_type = 'DORM_FLOOR'
     HAVING hs > 0
     ORDER BY sa.area_id`,
  );
  const distinct = [];
  const seen = new Set();
  for (const r of rows) {
    if (!seen.has(r.userId)) { seen.add(r.userId); distinct.push(r); }
    if (distinct.length === 2) break;
  }
  assert.ok(distinct.length === 2, "Cần ít nhất 2 GVQN có khu để test phân quyền");
  [A, B] = distinct;

  const [studs] = await pool.query(
    "SELECT student_id FROM student_area WHERE area_id = ? AND status = 'ACTIVE' LIMIT 3",
    [A.areaId],
  );
  studentsA = studs.map((s) => s.student_id);
});

test.after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});

function tokenFor(userId) {
  return signToken({ userId, email: `u${userId}@fpt`, roles: ["DORM_SUPERVISOR"], portal: "SUPERVISOR" });
}
async function api(token, path, opts = {}) {
  const res = await fetch(base + path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body };
}

// ── Phân quyền theo khu ──────────────────────────────────────────────────────
test("GVQN xem được điểm danh khu CỦA MÌNH (200)", async () => {
  const res = await api(tokenFor(A.userId), `/attendance?areaId=${A.areaId}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.areaId, A.areaId);
});

test("GVQN A KHÔNG xem được điểm danh khu của GVQN B (403)", async () => {
  const res = await api(tokenFor(A.userId), `/attendance?areaId=${B.areaId}`);
  assert.strictEqual(res.status, 403, "Phải chặn truy cập khu người khác");
});

test("GVQN B cũng KHÔNG xem được khu của A (403) — đối xứng", async () => {
  const res = await api(tokenFor(B.userId), `/attendance?areaId=${A.areaId}`);
  assert.strictEqual(res.status, 403);
});

test("Ghi sổ trực vào khu người khác bị chặn (403)", async () => {
  const res = await api(tokenFor(A.userId), "/logbook", {
    method: "POST",
    body: JSON.stringify({ areaId: B.areaId, shift: "MORNING", eventType: "EVENT", content: "x" }),
  });
  assert.strictEqual(res.status, 403);
});

test("Không có token → 401", async () => {
  const res = await fetch(`${base}/dashboard`);
  assert.strictEqual(res.status, 401);
});

// ── Điểm danh hàng loạt (1 API call cập nhật nhiều HS) ───────────────────────
test("Điểm danh hàng loạt cập nhật nhiều HS trong 1 request", async () => {
  assert.ok(studentsA.length >= 2, "Cần ≥2 HS trong khu để test bulk");
  const records = studentsA.map((studentId, i) => ({ studentId, typeId: i === 0 ? 4 : 1 })); // HS đầu vắng KP, còn lại có mặt
  const res = await api(tokenFor(A.userId), "/attendance/bulk", {
    method: "POST",
    body: JSON.stringify({ areaId: A.areaId, records }),
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.updated, records.length, "Phải cập nhật đúng số HS gửi lên trong 1 call");
  assert.ok(res.body.data.summary.present >= records.length - 1, "Summary phản ánh số có mặt");

  // Xác nhận đã lưu: GET lại roster thấy đúng trạng thái
  const check = await api(tokenFor(A.userId), `/attendance?areaId=${A.areaId}`);
  const map = new Map(check.body.data.roster.map((r) => [r.studentId, r.typeId]));
  assert.strictEqual(map.get(records[0].studentId), 4, "HS đầu = Vắng không phép");
  assert.strictEqual(map.get(records[1].studentId), 1, "HS thứ 2 = Có mặt");
});

test("Bulk với typeId không hợp lệ → 400", async () => {
  const res = await api(tokenFor(A.userId), "/attendance/bulk", {
    method: "POST",
    body: JSON.stringify({ areaId: A.areaId, records: [{ studentId: studentsA[0], typeId: 99 }] }),
  });
  assert.strictEqual(res.status, 400);
});
