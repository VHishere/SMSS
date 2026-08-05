const { pool } = require("../../config/db");

const CATEGORY_STATUSES = new Set(["ACTIVE", "INACTIVE"]);
const RATE_STATUSES = new Set(["ACTIVE", "INACTIVE"]);
const BILLING_CYCLES = new Set(["ONE_TIME", "MONTHLY", "PER_SEMESTER", "PER_YEAR"]);
const RATE_SCOPES = new Set(["SCHOOL", "GRADE", "CLASS"]);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCategoryCode(value) {
  const code = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);

  return code || `FEE_${Date.now()}`;
}

function resolveRateScope(data) {
  const requestedScope = String(data.scopeType || "").toUpperCase();
  const scopeType = RATE_SCOPES.has(requestedScope)
    ? requestedScope
    : data.classId
      ? "CLASS"
      : data.gradeId
        ? "GRADE"
        : "SCHOOL";

  if (scopeType === "CLASS" && !data.classId) {
    const error = new Error("Vui lòng chọn lớp cho mức thu theo lớp");
    error.statusCode = 400;
    throw error;
  }

  if (scopeType === "GRADE" && !data.gradeId) {
    const error = new Error("Vui lòng chọn khối cho mức thu theo khối");
    error.statusCode = 400;
    throw error;
  }

  return {
    scopeType,
    gradeId: scopeType === "GRADE" ? data.gradeId : null,
    classId: scopeType === "CLASS" ? data.classId : null,
  };
}

// ---------------------------------------------------------------------------
// UC-10: Manage Tuition Fee Categories
// ---------------------------------------------------------------------------

async function listFeeCategories(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.status) {
    conditions.push("fc.status = ?");
    params.push(filters.status);
  }

  if (filters.search) {
    conditions.push("fc.name LIKE ?");
    params.push(`%${filters.search}%`);
  }

  const [rows] = await pool.query(
    `
      SELECT
        fc.fee_category_id AS feeCategoryId,
        fc.code,
        fc.name,
        fc.description,
        fc.status,
        fc.created_at AS createdAt,
        creator.full_name AS createdByName,
        COUNT(fr.fee_rate_id) AS rateCount
      FROM fee_category fc
      LEFT JOIN user_account creator ON creator.user_id = fc.created_by
      LEFT JOIN fee_rate fr ON fr.fee_category_id = fc.fee_category_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY fc.fee_category_id
      ORDER BY fc.created_at DESC, fc.fee_category_id DESC
    `,
    params,
  );

  return rows;
}

async function getFeeCategoryById(feeCategoryId) {
  const [rows] = await pool.query(
    `
      SELECT
        fc.fee_category_id AS feeCategoryId,
        fc.code,
        fc.name,
        fc.description,
        fc.status,
        fc.created_at AS createdAt,
        creator.full_name AS createdByName
      FROM fee_category fc
      LEFT JOIN user_account creator ON creator.user_id = fc.created_by
      WHERE fc.fee_category_id = ?
      LIMIT 1
    `,
    [feeCategoryId],
  );

  return rows[0] || null;
}

async function createFeeCategory(data, createdBy) {
  if (!data.name || !data.name.trim()) {
    const error = new Error("Vui lòng nhập tên loại phí");
    error.statusCode = 400;
    throw error;
  }

  const name = data.name.trim();
  const code = normalizeCategoryCode(data.code || name);

  const [result] = await pool.query(
    `
      INSERT INTO fee_category (code, name, description, status, created_by)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      code,
      name,
      data.description || null,
      CATEGORY_STATUSES.has(data.status) ? data.status : "ACTIVE",
      createdBy || null,
    ],
  );

  return getFeeCategoryById(result.insertId);
}

async function updateFeeCategory(feeCategoryId, data) {
  if (!data.name || !data.name.trim()) {
    const error = new Error("Vui lòng nhập tên loại phí");
    error.statusCode = 400;
    throw error;
  }

  const current = await getFeeCategoryById(feeCategoryId);
  if (!current) {
    const error = new Error("Không tìm thấy loại phí");
    error.statusCode = 404;
    throw error;
  }

  const [result] = await pool.query(
    `
      UPDATE fee_category
      SET code = ?, name = ?, description = ?
      WHERE fee_category_id = ?
    `,
    [
      data.code ? normalizeCategoryCode(data.code) : current.code,
      data.name.trim(),
      data.description || null,
      feeCategoryId,
    ],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy loại phí");
    error.statusCode = 404;
    throw error;
  }

  return getFeeCategoryById(feeCategoryId);
}

async function setFeeCategoryStatus(feeCategoryId, status) {
  if (!CATEGORY_STATUSES.has(status)) {
    const error = new Error("Trạng thái loại phí không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const [result] = await pool.query(
    "UPDATE fee_category SET status = ? WHERE fee_category_id = ?",
    [status, feeCategoryId],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy loại phí");
    error.statusCode = 404;
    throw error;
  }

  return getFeeCategoryById(feeCategoryId);
}

// ---------------------------------------------------------------------------
// UC-11: Configure Fee Rates
// ---------------------------------------------------------------------------

async function listFeeRates(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.feeCategoryId) {
    conditions.push("fr.fee_category_id = ?");
    params.push(filters.feeCategoryId);
  }

  if (filters.schoolYearId) {
    conditions.push("fr.school_year_id = ?");
    params.push(filters.schoolYearId);
  }

  if (filters.semesterId) {
    conditions.push("fr.semester_id = ?");
    params.push(filters.semesterId);
  }

  if (filters.gradeId) {
    conditions.push("fr.grade_id = ?");
    params.push(filters.gradeId);
  }

  if (filters.classId) {
    conditions.push("fr.class_id = ?");
    params.push(filters.classId);
  }

  if (filters.status) {
    conditions.push("fr.status = ?");
    params.push(filters.status);
  }

  if (filters.search) {
    conditions.push("fc.name LIKE ?");
    params.push(`%${filters.search}%`);
  }

  const [rows] = await pool.query(
    `
      SELECT
        fr.fee_rate_id AS feeRateId,
        fr.fee_category_id AS feeCategoryId,
        fc.name AS feeCategoryName,
        fr.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        fr.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        fr.grade_id AS gradeId,
        g.grade_name AS gradeName,
        fr.class_id AS classId,
        sc.class_name AS className,
        fr.scope_type AS scopeType,
        fr.amount,
        fr.billing_cycle AS billingCycle,
        fr.status,
        fr.created_at AS createdAt,
        creator.full_name AS createdByName
      FROM fee_rate fr
      INNER JOIN fee_category fc ON fc.fee_category_id = fr.fee_category_id
      INNER JOIN school_year sy ON sy.school_year_id = fr.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = fr.semester_id
      LEFT JOIN grade g ON g.grade_id = fr.grade_id
      LEFT JOIN school_class sc ON sc.class_id = fr.class_id
      LEFT JOIN user_account creator ON creator.user_id = fr.created_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY fr.created_at DESC, fr.fee_rate_id DESC
    `,
    params,
  );

  return rows.map((row) => ({ ...row, amount: toNumber(row.amount) }));
}

async function getFeeRateById(feeRateId) {
  const [rows] = await pool.query(
    `
      SELECT
        fr.fee_rate_id AS feeRateId,
        fr.fee_category_id AS feeCategoryId,
        fc.name AS feeCategoryName,
        fr.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        fr.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        fr.grade_id AS gradeId,
        g.grade_name AS gradeName,
        fr.class_id AS classId,
        sc.class_name AS className,
        fr.scope_type AS scopeType,
        fr.amount,
        fr.billing_cycle AS billingCycle,
        fr.status,
        fr.created_at AS createdAt,
        creator.full_name AS createdByName
      FROM fee_rate fr
      INNER JOIN fee_category fc ON fc.fee_category_id = fr.fee_category_id
      INNER JOIN school_year sy ON sy.school_year_id = fr.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = fr.semester_id
      LEFT JOIN grade g ON g.grade_id = fr.grade_id
      LEFT JOIN school_class sc ON sc.class_id = fr.class_id
      LEFT JOIN user_account creator ON creator.user_id = fr.created_by
      WHERE fr.fee_rate_id = ?
      LIMIT 1
    `,
    [feeRateId],
  );

  const rate = rows[0];
  if (!rate) return null;
  return { ...rate, amount: toNumber(rate.amount) };
}

function validateRatePayload(data) {
  if (!data.feeCategoryId) {
    const error = new Error("Vui lòng chọn loại phí");
    error.statusCode = 400;
    throw error;
  }

  if (!data.schoolYearId) {
    const error = new Error("Vui lòng chọn năm học");
    error.statusCode = 400;
    throw error;
  }

  const amount = toNumber(data.amount, -1);
  if (amount <= 0) {
    const error = new Error("Số tiền phải lớn hơn 0");
    error.statusCode = 400;
    throw error;
  }

  const billingCycle = data.billingCycle || "PER_SEMESTER";
  if (!BILLING_CYCLES.has(billingCycle)) {
    const error = new Error("Chu kỳ thu phí không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const scope = resolveRateScope(data);
  return { amount, billingCycle, ...scope };
}

async function validateRateReferences(data, scope, connection = pool) {
  const [[schoolYear]] = await connection.query(
    "SELECT school_year_id FROM school_year WHERE school_year_id = ? LIMIT 1",
    [data.schoolYearId],
  );
  if (!schoolYear) {
    const error = new Error("Năm học không tồn tại");
    error.statusCode = 400;
    throw error;
  }

  if (data.semesterId) {
    const [[semester]] = await connection.query(
      `
        SELECT semester_id
        FROM semester
        WHERE semester_id = ? AND school_year_id = ?
        LIMIT 1
      `,
      [data.semesterId, data.schoolYearId],
    );
    if (!semester) {
      const error = new Error("Học kỳ không thuộc năm học đã chọn");
      error.statusCode = 400;
      throw error;
    }
  }

  if (scope.scopeType === "GRADE") {
    const [[grade]] = await connection.query(
      "SELECT grade_id FROM grade WHERE grade_id = ? LIMIT 1",
      [scope.gradeId],
    );
    if (!grade) {
      const error = new Error("Khối học không tồn tại");
      error.statusCode = 400;
      throw error;
    }
  }

  if (scope.scopeType === "CLASS") {
    const [[schoolClass]] = await connection.query(
      `
        SELECT class_id
        FROM school_class
        WHERE class_id = ? AND school_year_id = ?
        LIMIT 1
      `,
      [scope.classId, data.schoolYearId],
    );
    if (!schoolClass) {
      const error = new Error("Lớp không thuộc năm học đã chọn");
      error.statusCode = 400;
      throw error;
    }
  }
}

async function createFeeRate(data, createdBy) {
  const { amount, billingCycle, scopeType, gradeId, classId } = validateRatePayload(data);
  await validateRateReferences(data, { scopeType, gradeId, classId });

  const [result] = await pool.query(
    `
      INSERT INTO fee_rate (
        fee_category_id, school_year_id, semester_id, scope_type, grade_id, class_id,
        amount, billing_cycle, status, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.feeCategoryId,
      data.schoolYearId,
      data.semesterId || null,
      scopeType,
      gradeId,
      classId,
      amount,
      billingCycle,
      RATE_STATUSES.has(data.status) ? data.status : "ACTIVE",
      createdBy || null,
    ],
  );

  return getFeeRateById(result.insertId);
}

async function updateFeeRate(feeRateId, data) {
  const { amount, billingCycle, scopeType, gradeId, classId } = validateRatePayload(data);
  await validateRateReferences(data, { scopeType, gradeId, classId });

  const [result] = await pool.query(
    `
      UPDATE fee_rate
      SET fee_category_id = ?, school_year_id = ?, semester_id = ?,
          scope_type = ?, grade_id = ?, class_id = ?, amount = ?, billing_cycle = ?
      WHERE fee_rate_id = ?
    `,
    [
      data.feeCategoryId,
      data.schoolYearId,
      data.semesterId || null,
      scopeType,
      gradeId,
      classId,
      amount,
      billingCycle,
      feeRateId,
    ],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy mức thu");
    error.statusCode = 404;
    throw error;
  }

  return getFeeRateById(feeRateId);
}

async function setFeeRateStatus(feeRateId, status) {
  if (!RATE_STATUSES.has(status)) {
    const error = new Error("Trạng thái mức thu không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const [result] = await pool.query(
    "UPDATE fee_rate SET status = ? WHERE fee_rate_id = ?",
    [status, feeRateId],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy mức thu");
    error.statusCode = 404;
    throw error;
  }

  return getFeeRateById(feeRateId);
}

// ---------------------------------------------------------------------------
// Dashboard: school-wide fee collection summary for the active school year
// ---------------------------------------------------------------------------

async function getFeeSummary() {
  const [[row]] = await pool.query(`
    SELECT
      COALESCE(SUM(fa.paid_amount), 0) AS totalCollected,
      COALESCE(SUM(fa.final_amount - fa.paid_amount), 0) AS totalOutstanding,
      SUM(
        CASE
          WHEN fa.status IN ('UNPAID', 'PARTIAL')
            AND fp.due_date < DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR)
          THEN 1 ELSE 0
        END
      ) AS overdueCount,
      SUM(CASE WHEN fa.status IN ('UNPAID', 'PARTIAL') THEN 1 ELSE 0 END) AS unpaidCount,
      COUNT(*) AS totalAssignments
    FROM fee_assignment fa
    INNER JOIN fee_plan fp ON fp.fee_plan_id = fa.fee_plan_id
    INNER JOIN school_year sy ON sy.school_year_id = fp.school_year_id AND sy.is_active = 1
  `);

  return {
    totalCollected: toNumber(row.totalCollected),
    totalOutstanding: toNumber(row.totalOutstanding),
    overdueCount: toNumber(row.overdueCount),
    unpaidCount: toNumber(row.unpaidCount),
    totalAssignments: toNumber(row.totalAssignments),
  };
}

module.exports = {
  listFeeCategories,
  getFeeCategoryById,
  createFeeCategory,
  updateFeeCategory,
  setFeeCategoryStatus,
  listFeeRates,
  getFeeRateById,
  createFeeRate,
  updateFeeRate,
  setFeeRateStatus,
  getFeeSummary,
};
