const { pool } = require("../../config/db");

const PLAN_STATUSES = new Set(["DRAFT", "PUBLISHED", "LOCKED", "CANCELLED"]);
const ASSIGNMENT_STATUSES = new Set(["UNPAID", "PARTIAL", "PAID", "WAIVED"]);
const SCOPES = new Set(["STUDENT", "CLASS", "GRADE", "SCHOOL"]);
const MANUAL_PAYMENT_METHODS = new Set([
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "OTHER",
]);

const EFFECTIVE_STATUS_SQL = `
  CASE
    WHEN fa.status IN ('UNPAID', 'PARTIAL') AND fp.due_date < DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR)
      THEN 'OVERDUE'
    ELSE fa.status
  END
`;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeAssignment(row) {
  const finalAmount = toNumber(row.finalAmount);
  const paidAmount = toNumber(row.paidAmount);

  return {
    ...row,
    amount: toNumber(row.amount),
    discountAmount: toNumber(row.discountAmount),
    finalAmount,
    paidAmount,
    remainingAmount: Math.max(finalAmount - paidAmount, 0),
  };
}

async function listFeePlans(filters = {}) {
  const conditions = ["1 = 1"];
  const params = [];

  if (filters.schoolYearId) {
    conditions.push("fp.school_year_id = ?");
    params.push(filters.schoolYearId);
  }

  if (filters.status) {
    conditions.push("fp.status = ?");
    params.push(filters.status);
  }

  if (filters.search) {
    conditions.push("(fp.title LIKE ? OR fc.name LIKE ? OR fc.code LIKE ?)");
    const search = `%${filters.search}%`;
    params.push(search, search, search);
  }

  const [rows] = await pool.query(
    `
      SELECT
        fp.fee_plan_id AS feePlanId,
        fp.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        fp.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        fp.fee_category_id AS feeCategoryId,
        fc.code AS feeCategoryCode,
        fc.name AS feeType,
        fp.fee_rate_id AS feeRateId,
        fp.title,
        fp.amount,
        DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate,
        fp.scope_type AS scopeType,
        fp.status,
        fp.created_at AS createdAt,
        creator.full_name AS createdByName,
        COUNT(fa.fee_assignment_id) AS studentCount,
        COALESCE(SUM(fa.final_amount), 0) AS totalAmount,
        COALESCE(SUM(fa.paid_amount), 0) AS paidAmount,
        COALESCE(SUM(fa.final_amount - fa.paid_amount), 0) AS remainingAmount
      FROM fee_plan fp
      INNER JOIN fee_category fc
        ON fc.fee_category_id = fp.fee_category_id
      INNER JOIN school_year sy
        ON sy.school_year_id = fp.school_year_id
      LEFT JOIN semester sem
        ON sem.semester_id = fp.semester_id
      LEFT JOIN user_account creator
        ON creator.user_id = fp.created_by
      LEFT JOIN fee_assignment fa
        ON fa.fee_plan_id = fp.fee_plan_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY
        fp.fee_plan_id,
        sy.year_name,
        sem.semester_name,
        fc.code,
        fc.name,
        creator.full_name
      ORDER BY fp.created_at DESC, fp.fee_plan_id DESC
    `,
    params,
  );

  return rows.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
    studentCount: Number(row.studentCount || 0),
    totalAmount: toNumber(row.totalAmount),
    paidAmount: toNumber(row.paidAmount),
    remainingAmount: toNumber(row.remainingAmount),
  }));
}

async function getFeePlanById(feePlanId) {
  const [plans] = await pool.query(
    `
      SELECT
        fp.fee_plan_id AS feePlanId,
        fp.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        fp.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        fp.fee_category_id AS feeCategoryId,
        fc.code AS feeCategoryCode,
        fc.name AS feeType,
        fp.fee_rate_id AS feeRateId,
        fp.title,
        fp.amount,
        DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate,
        fp.description,
        fp.scope_type AS scopeType,
        fp.scope_student_id AS scopeStudentId,
        fp.scope_class_id AS scopeClassId,
        fp.scope_grade_id AS scopeGradeId,
        CASE fp.scope_type
          WHEN 'STUDENT' THEN fp.scope_student_id
          WHEN 'CLASS' THEN fp.scope_class_id
          WHEN 'GRADE' THEN fp.scope_grade_id
          ELSE NULL
        END AS scopeRefId,
        fp.status,
        fp.created_at AS createdAt,
        creator.full_name AS createdByName
      FROM fee_plan fp
      INNER JOIN fee_category fc
        ON fc.fee_category_id = fp.fee_category_id
      INNER JOIN school_year sy
        ON sy.school_year_id = fp.school_year_id
      LEFT JOIN semester sem
        ON sem.semester_id = fp.semester_id
      LEFT JOIN user_account creator
        ON creator.user_id = fp.created_by
      WHERE fp.fee_plan_id = ?
      LIMIT 1
    `,
    [feePlanId],
  );

  const plan = plans[0];
  if (!plan) return null;

  const [assignments] = await pool.query(
    `
      SELECT
        fa.fee_assignment_id AS feeAssignmentId,
        fa.student_id AS studentId,
        s.student_code AS studentCode,
        student_user.full_name AS studentName,
        sc.class_name AS className,
        g.grade_name AS gradeName,
        fa.amount,
        fa.discount_amount AS discountAmount,
        fa.final_amount AS finalAmount,
        fa.paid_amount AS paidAmount,
        ${EFFECTIVE_STATUS_SQL} AS status,
        fa.status AS paymentStatus,
        fa.is_waived AS isWaived,
        fa.waived_reason AS waivedReason,
        fa.assigned_at AS assignedAt
      FROM fee_assignment fa
      INNER JOIN fee_plan fp
        ON fp.fee_plan_id = fa.fee_plan_id
      INNER JOIN student s
        ON s.student_id = fa.student_id
      INNER JOIN user_account student_user
        ON student_user.user_id = s.user_id
      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status = 'ACTIVE'
        AND ce.class_id IN (
          SELECT sc2.class_id
          FROM school_class sc2
          WHERE sc2.school_year_id = fp.school_year_id
        )
      LEFT JOIN school_class sc
        ON sc.class_id = ce.class_id
      LEFT JOIN grade g
        ON g.grade_id = sc.grade_id
      WHERE fa.fee_plan_id = ?
      ORDER BY g.grade_id, sc.class_name, s.student_code
    `,
    [feePlanId],
  );

  const [payments] = await pool.query(
    `
      SELECT
        fpmt.payment_id AS paymentId,
        fpmt.fee_assignment_id AS feeAssignmentId,
        fpmt.payment_transaction_id AS paymentTransactionId,
        fpmt.amount,
        DATE_FORMAT(fpmt.payment_date, '%Y-%m-%d %H:%i:%s') AS paymentDate,
        fpmt.payment_method AS paymentMethod,
        fpmt.transaction_code AS transactionCode,
        fpmt.note,
        recorder.full_name AS recordedByName,
        fpmt.created_at AS createdAt
      FROM fee_payment fpmt
      LEFT JOIN user_account recorder
        ON recorder.user_id = fpmt.recorded_by
      INNER JOIN fee_assignment fa
        ON fa.fee_assignment_id = fpmt.fee_assignment_id
      WHERE fa.fee_plan_id = ?
      ORDER BY fpmt.payment_date DESC, fpmt.payment_id DESC
    `,
    [feePlanId],
  );

  const normalizedAssignments = assignments.map((row) => ({
    ...normalizeAssignment(row),
    isWaived: Boolean(row.isWaived),
  }));
  const totalAmount = normalizedAssignments.reduce(
    (sum, row) => sum + row.finalAmount,
    0,
  );
  const paidAmount = normalizedAssignments.reduce(
    (sum, row) => sum + row.paidAmount,
    0,
  );

  return {
    ...plan,
    amount: toNumber(plan.amount),
    totalAmount,
    paidAmount,
    remainingAmount: Math.max(totalAmount - paidAmount, 0),
    assignments: normalizedAssignments,
    payments: payments.map((row) => ({ ...row, amount: toNumber(row.amount) })),
  };
}

async function findFeeTargetStudents(data, connection = pool) {
  const scope = data.scopeType || "CLASS";

  if (!SCOPES.has(scope)) {
    throw createHttpError("Phạm vi áp dụng không hợp lệ");
  }

  const conditions = [
    "s.status = 'ACTIVE'",
    "ce.status = 'ACTIVE'",
    "sc.status = 'ACTIVE'",
    "sc.school_year_id = ?",
  ];
  const params = [data.schoolYearId];

  if (scope === "STUDENT") {
    if (!data.studentId) {
      throw createHttpError("Vui lòng chọn học sinh");
    }
    conditions.push("s.student_id = ?");
    params.push(data.studentId);
  } else if (scope === "CLASS") {
    if (!data.classId) {
      throw createHttpError("Vui lòng chọn lớp");
    }
    conditions.push("sc.class_id = ?");
    params.push(data.classId);
  } else if (scope === "GRADE") {
    if (!data.gradeId) {
      throw createHttpError("Vui lòng chọn khối");
    }
    conditions.push("sc.grade_id = ?");
    params.push(data.gradeId);
  }

  const [rows] = await connection.query(
    `
      SELECT DISTINCT
        s.student_id AS studentId,
        s.student_code AS studentCode,
        student_user.full_name AS studentName,
        sc.class_id AS classId,
        sc.class_name AS className
      FROM student s
      INNER JOIN user_account student_user
        ON student_user.user_id = s.user_id
      INNER JOIN class_enrollment ce
        ON ce.student_id = s.student_id
      INNER JOIN school_class sc
        ON sc.class_id = ce.class_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY sc.class_name, s.student_code
    `,
    params,
  );

  if (!rows.length) {
    throw createHttpError(
      "Không có học sinh phù hợp để tạo khoản học phí",
      404,
    );
  }

  return rows;
}

async function resolveFeeCategoryId(data, connection = pool) {
  if (data.feeCategoryId) {
    const [[category]] = await connection.query(
      `
        SELECT fee_category_id AS feeCategoryId
        FROM fee_category
        WHERE fee_category_id = ?
          AND status = 'ACTIVE'
        LIMIT 1
      `,
      [data.feeCategoryId],
    );

    if (!category) {
      throw createHttpError("Loại phí không tồn tại hoặc đã ngừng sử dụng");
    }
    return category.feeCategoryId;
  }

  const legacyValue = String(data.feeType || "Học phí").trim();
  const legacyAliases = {
    "Bán trú": "BOARDING",
    "Xe đưa đón": "SCHOOL_BUS",
    "Hoạt động ngoại khóa": "ACTIVITY",
    Khác: "OTHER",
  };
  const code = legacyAliases[legacyValue] || legacyValue;

  const [[category]] = await connection.query(
    `
      SELECT fee_category_id AS feeCategoryId
      FROM fee_category
      WHERE status = 'ACTIVE'
        AND (code = ? OR name = ?)
      ORDER BY (code = ?) DESC
      LIMIT 1
    `,
    [code, legacyValue, code],
  );

  if (!category) {
    throw createHttpError("Không tìm thấy loại phí phù hợp");
  }

  return category.feeCategoryId;
}

async function resolveFeeRate(feeRateId, data, connection = pool) {
  const [[rate]] = await connection.query(
    `
      SELECT
        fee_rate_id AS feeRateId,
        fee_category_id AS feeCategoryId,
        school_year_id AS schoolYearId,
        semester_id AS semesterId,
        amount
      FROM fee_rate
      WHERE fee_rate_id = ?
        AND status = 'ACTIVE'
      LIMIT 1
    `,
    [feeRateId],
  );

  if (!rate) {
    throw createHttpError("Mức thu không tồn tại hoặc đã ngừng sử dụng");
  }

  if (String(rate.schoolYearId) !== String(data.schoolYearId)) {
    throw createHttpError("Mức thu không thuộc năm học đã chọn");
  }

  if (rate.semesterId != null && String(rate.semesterId) !== String(data.semesterId || "")) {
    throw createHttpError("Mức thu không thuộc học kỳ đã chọn");
  }

  return { feeCategoryId: rate.feeCategoryId, amount: toNumber(rate.amount) };
}

async function validateAcademicReferences(data, connection = pool) {
  if (data.semesterId) {
    const [[semester]] = await connection.query(
      `
        SELECT semester_id
        FROM semester
        WHERE semester_id = ?
          AND school_year_id = ?
        LIMIT 1
      `,
      [data.semesterId, data.schoolYearId],
    );

    if (!semester) {
      throw createHttpError("Học kỳ không thuộc năm học đã chọn");
    }
  }
}

function getScopeColumns(data, scopeType) {
  return {
    scopeStudentId: scopeType === "STUDENT" ? data.studentId : null,
    scopeClassId: scopeType === "CLASS" ? data.classId : null,
    scopeGradeId: scopeType === "GRADE" ? data.gradeId : null,
  };
}

async function createFeePlan(data, createdBy) {
  const discountAmount = toNumber(data.discountAmount, 0);
  const status = data.status || "PUBLISHED";
  const scopeType = data.scopeType || "CLASS";
  const title = String(data.title || "").trim();

  if (!title || !data.schoolYearId || !data.dueDate) {
    throw createHttpError(
      "Vui lòng nhập tên khoản phí, năm học, số tiền và hạn đóng",
    );
  }

  if (!PLAN_STATUSES.has(status)) {
    throw createHttpError("Trạng thái khoản phí không hợp lệ");
  }

  if (!SCOPES.has(scopeType)) {
    throw createHttpError("Phạm vi áp dụng không hợp lệ");
  }

  const dueDate = new Date(`${data.dueDate}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    throw createHttpError("Hạn đóng không hợp lệ");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await validateAcademicReferences(data, connection);

    // Nếu chọn mức thu đã cấu hình (fee_rate), số tiền và loại phí lấy từ
    // đó — không cho nhập tay lệch khỏi mức thu đã công bố.
    let feeCategoryId;
    let amount;
    if (data.feeRateId) {
      const rate = await resolveFeeRate(data.feeRateId, data, connection);
      feeCategoryId = rate.feeCategoryId;
      amount = rate.amount;
    } else {
      feeCategoryId = await resolveFeeCategoryId(data, connection);
      amount = toNumber(data.amount, NaN);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw createHttpError("Số tiền phải lớn hơn 0");
    }

    if (
      !Number.isFinite(discountAmount)
      || discountAmount < 0
      || discountAmount > amount
    ) {
      throw createHttpError("Số tiền giảm trừ không hợp lệ");
    }

    const targetStudents = await findFeeTargetStudents(
      { ...data, scopeType },
      connection,
    );
    const scope = getScopeColumns(data, scopeType);

    const [planResult] = await connection.query(
      `
        INSERT INTO fee_plan (
          school_year_id,
          semester_id,
          fee_category_id,
          fee_rate_id,
          title,
          amount,
          due_date,
          description,
          scope_type,
          scope_student_id,
          scope_class_id,
          scope_grade_id,
          status,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.schoolYearId,
        data.semesterId || null,
        feeCategoryId,
        data.feeRateId || null,
        title,
        amount,
        data.dueDate,
        String(data.description || "").trim() || null,
        scopeType,
        scope.scopeStudentId || null,
        scope.scopeClassId || null,
        scope.scopeGradeId || null,
        status,
        createdBy || null,
      ],
    );

    await connection.query(
      `
        INSERT INTO fee_assignment (
          fee_plan_id,
          student_id,
          amount,
          discount_amount
        )
        VALUES ?
      `,
      [
        targetStudents.map((student) => [
          planResult.insertId,
          student.studentId,
          amount,
          discountAmount,
        ]),
      ],
    );

    await connection.commit();
    return getFeePlanById(planResult.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateFeePlanStatus(feePlanId, status) {
  if (!PLAN_STATUSES.has(status)) {
    throw createHttpError("Trạng thái khoản phí không hợp lệ");
  }

  const [result] = await pool.query(
    "UPDATE fee_plan SET status = ? WHERE fee_plan_id = ?",
    [status, feePlanId],
  );

  if (result.affectedRows === 0) {
    throw createHttpError("Không tìm thấy khoản học phí", 404);
  }

  return getFeePlanById(feePlanId);
}

async function recordFeePayment(feePlanId, assignmentId, data, recordedBy) {
  const paymentAmount = toNumber(data.amount, NaN);
  const paymentMethod = String(data.paymentMethod || "CASH").toUpperCase();

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw createHttpError("Số tiền thanh toán phải lớn hơn 0");
  }

  if (!MANUAL_PAYMENT_METHODS.has(paymentMethod)) {
    throw createHttpError(
      "ZaloPay/VietQR trực tuyến phải được ghi nhận qua giao dịch và callback, không nhập tay",
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [assignments] = await connection.query(
      `
        SELECT
          fa.fee_assignment_id AS feeAssignmentId,
          fa.final_amount AS finalAmount,
          fa.paid_amount AS paidAmount,
          fa.status
        FROM fee_assignment fa
        WHERE fa.fee_assignment_id = ?
          AND fa.fee_plan_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [assignmentId, feePlanId],
    );

    const assignment = assignments[0];
    if (!assignment) {
      throw createHttpError(
        "Không tìm thấy công nợ học phí của học sinh",
        404,
      );
    }

    if (!ASSIGNMENT_STATUSES.has(assignment.status)) {
      throw createHttpError("Trạng thái công nợ không hợp lệ");
    }

    if (assignment.status === "WAIVED") {
      throw createHttpError("Khoản phí đã được miễn, không thể ghi nhận thanh toán");
    }

    const remaining = Math.max(
      toNumber(assignment.finalAmount) - toNumber(assignment.paidAmount),
      0,
    );

    if (paymentAmount > remaining) {
      throw createHttpError(
        "Số tiền thanh toán vượt quá số tiền còn phải đóng",
      );
    }

    await connection.query(
      `
        INSERT INTO fee_payment (
          fee_assignment_id,
          payment_transaction_id,
          amount,
          payment_date,
          payment_method,
          transaction_code,
          note,
          recorded_by
        )
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
      `,
      [
        assignmentId,
        paymentAmount,
        data.paymentDate || new Date(),
        paymentMethod,
        String(data.transactionCode || "").trim() || null,
        String(data.note || "").trim() || null,
        recordedBy || null,
      ],
    );

    // paid_amount và status được trigger trong DB cập nhật từ fee_payment.
    await connection.commit();
    return getFeePlanById(feePlanId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// status của fee_assignment là generated column; OVERDUE chỉ là trạng thái hiển thị.
async function refreshFeeAssignmentStatuses(_feePlanId) {
  return 0;
}

module.exports = {
  listFeePlans,
  getFeePlanById,
  createFeePlan,
  updateFeePlanStatus,
  recordFeePayment,
  refreshFeeAssignmentStatuses,
};
