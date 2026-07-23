const { pool } = require("../../config/db");

const PLAN_STATUSES = new Set(["DRAFT", "PUBLISHED", "LOCKED", "CANCELLED"]);
const ASSIGNMENT_STATUSES = new Set(["UNPAID", "PARTIAL", "PAID", "OVERDUE", "WAIVED"]);
const SCOPES = new Set(["STUDENT", "CLASS", "GRADE", "SCHOOL"]);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function getAssignmentStatus(finalAmount, paidAmount, dueDate, currentStatus) {
  if (currentStatus === "WAIVED") return "WAIVED";
  if (paidAmount >= finalAmount) return "PAID";
  if (paidAmount > 0) return "PARTIAL";

  if (dueDate) {
    const due = new Date(`${dueDate}T23:59:59`);
    if (!Number.isNaN(due.getTime()) && due < new Date()) {
      return "OVERDUE";
    }
  }

  return "UNPAID";
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
    conditions.push("(fp.title LIKE ? OR fp.fee_type LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const [rows] = await pool.query(
    `
      SELECT
        fp.fee_plan_id AS feePlanId,
        fp.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        fp.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        fp.title,
        fp.fee_type AS feeType,
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
      INNER JOIN school_year sy ON sy.school_year_id = fp.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = fp.semester_id
      LEFT JOIN user_account creator ON creator.user_id = fp.created_by
      LEFT JOIN fee_assignment fa ON fa.fee_plan_id = fp.fee_plan_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY fp.fee_plan_id
      ORDER BY fp.created_at DESC, fp.fee_plan_id DESC
    `,
    params,
  );

  return rows.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
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
        fp.title,
        fp.fee_type AS feeType,
        fp.amount,
        DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate,
        fp.description,
        fp.scope_type AS scopeType,
        fp.scope_ref_id AS scopeRefId,
        fp.status,
        fp.created_at AS createdAt,
        creator.full_name AS createdByName
      FROM fee_plan fp
      INNER JOIN school_year sy ON sy.school_year_id = fp.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = fp.semester_id
      LEFT JOIN user_account creator ON creator.user_id = fp.created_by
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
        fa.status,
        fa.assigned_at AS assignedAt
      FROM fee_assignment fa
      INNER JOIN student s ON s.student_id = fa.student_id
      INNER JOIN user_account student_user ON student_user.user_id = s.user_id
      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status = 'ACTIVE'
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
      LEFT JOIN grade g ON g.grade_id = sc.grade_id
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
        fpmt.amount,
        DATE_FORMAT(fpmt.payment_date, '%Y-%m-%d') AS paymentDate,
        fpmt.payment_method AS paymentMethod,
        fpmt.transaction_code AS transactionCode,
        fpmt.note,
        recorder.full_name AS recordedByName,
        fpmt.created_at AS createdAt
      FROM fee_payment fpmt
      LEFT JOIN user_account recorder ON recorder.user_id = fpmt.recorded_by
      INNER JOIN fee_assignment fa ON fa.fee_assignment_id = fpmt.fee_assignment_id
      WHERE fa.fee_plan_id = ?
      ORDER BY fpmt.created_at DESC
    `,
    [feePlanId],
  );

  const normalizedAssignments = assignments.map(normalizeAssignment);
  const totalAmount = normalizedAssignments.reduce((sum, row) => sum + row.finalAmount, 0);
  const paidAmount = normalizedAssignments.reduce((sum, row) => sum + row.paidAmount, 0);

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
    const error = new Error("Phạm vi áp dụng không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const conditions = ["s.status = 'ACTIVE'", "ce.status = 'ACTIVE'", "sc.status = 'ACTIVE'"];
  const params = [];

  if (scope === "STUDENT") {
    if (!data.studentId) {
      const error = new Error("Vui lòng chọn học sinh");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("s.student_id = ?");
    params.push(data.studentId);
  } else if (scope === "CLASS") {
    if (!data.classId) {
      const error = new Error("Vui lòng chọn lớp");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.class_id = ?");
    params.push(data.classId);
  } else if (scope === "GRADE") {
    if (!data.schoolYearId || !data.gradeId) {
      const error = new Error("Vui lòng chọn năm học và khối");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.school_year_id = ?");
    conditions.push("sc.grade_id = ?");
    params.push(data.schoolYearId, data.gradeId);
  } else if (scope === "SCHOOL") {
    if (!data.schoolYearId) {
      const error = new Error("Vui lòng chọn năm học");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.school_year_id = ?");
    params.push(data.schoolYearId);
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
      INNER JOIN user_account student_user ON student_user.user_id = s.user_id
      INNER JOIN class_enrollment ce ON ce.student_id = s.student_id
      INNER JOIN school_class sc ON sc.class_id = ce.class_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY sc.class_name, s.student_code
    `,
    params,
  );

  if (!rows.length) {
    const error = new Error("Không có học sinh phù hợp để tạo khoản học phí");
    error.statusCode = 404;
    throw error;
  }

  return rows;
}

function getScopeRefId(data) {
  if (data.scopeType === "STUDENT") return data.studentId;
  if (data.scopeType === "CLASS") return data.classId;
  if (data.scopeType === "GRADE") return data.gradeId;
  return null;
}

async function createFeePlan(data, createdBy) {
  const amount = toNumber(data.amount);
  const discountAmount = toNumber(data.discountAmount);
  const finalAmount = Math.max(amount - discountAmount, 0);
  const status = data.status || "PUBLISHED";
  const scopeType = data.scopeType || "CLASS";

  if (!data.title || !data.schoolYearId || !amount || !data.dueDate) {
    const error = new Error("Vui lòng nhập tên khoản phí, năm học, số tiền và hạn đóng");
    error.statusCode = 400;
    throw error;
  }

  if (!PLAN_STATUSES.has(status)) {
    const error = new Error("Trạng thái khoản phí không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const targetStudents = await findFeeTargetStudents(
      {
        ...data,
        scopeType,
      },
      connection,
    );

    const [planResult] = await connection.query(
      `
        INSERT INTO fee_plan (
          school_year_id, semester_id, title, fee_type, amount,
          due_date, description, scope_type, scope_ref_id, status, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.schoolYearId,
        data.semesterId || null,
        data.title.trim(),
        data.feeType || "Học phí",
        amount,
        data.dueDate,
        data.description || null,
        scopeType,
        getScopeRefId({ ...data, scopeType }),
        status,
        createdBy || null,
      ],
    );

    await connection.query(
      `
        INSERT INTO fee_assignment (
          fee_plan_id, student_id, amount, discount_amount,
          final_amount, paid_amount, status
        )
        VALUES ?
      `,
      [
        targetStudents.map((student) => [
          planResult.insertId,
          student.studentId,
          amount,
          discountAmount,
          finalAmount,
          0,
          getAssignmentStatus(finalAmount, 0, data.dueDate),
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
    const error = new Error("Trạng thái khoản phí không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const [result] = await pool.query(
    "UPDATE fee_plan SET status = ? WHERE fee_plan_id = ?",
    [status, feePlanId],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy khoản học phí");
    error.statusCode = 404;
    throw error;
  }

  return getFeePlanById(feePlanId);
}

async function recordFeePayment(feePlanId, assignmentId, data, recordedBy) {
  const paymentAmount = toNumber(data.amount);

  if (!paymentAmount || paymentAmount <= 0) {
    const error = new Error("Số tiền thanh toán phải lớn hơn 0");
    error.statusCode = 400;
    throw error;
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
          fa.status,
          DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate
        FROM fee_assignment fa
        INNER JOIN fee_plan fp ON fp.fee_plan_id = fa.fee_plan_id
        WHERE fa.fee_assignment_id = ?
          AND fa.fee_plan_id = ?
        LIMIT 1
      `,
      [assignmentId, feePlanId],
    );

    const assignment = assignments[0];
    if (!assignment) {
      const error = new Error("Không tìm thấy công nợ học phí của học sinh");
      error.statusCode = 404;
      throw error;
    }

    if (!ASSIGNMENT_STATUSES.has(assignment.status)) {
      const error = new Error("Trạng thái công nợ không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const finalAmount = toNumber(assignment.finalAmount);
    const paidAmount = toNumber(assignment.paidAmount);
    const remaining = Math.max(finalAmount - paidAmount, 0);

    if (paymentAmount > remaining) {
      const error = new Error("Số tiền thanh toán vượt quá số tiền còn phải đóng");
      error.statusCode = 400;
      throw error;
    }

    const newPaidAmount = paidAmount + paymentAmount;
    const newStatus = getAssignmentStatus(
      finalAmount,
      newPaidAmount,
      assignment.dueDate,
      assignment.status,
    );

    await connection.query(
      `
        INSERT INTO fee_payment (
          fee_assignment_id, amount, payment_date, payment_method,
          transaction_code, note, recorded_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        assignmentId,
        paymentAmount,
        data.paymentDate || new Date(),
        data.paymentMethod || "CASH",
        data.transactionCode || null,
        data.note || null,
        recordedBy || null,
      ],
    );

    await connection.query(
      `
        UPDATE fee_assignment
        SET paid_amount = ?, status = ?
        WHERE fee_assignment_id = ?
      `,
      [newPaidAmount, newStatus, assignmentId],
    );

    await connection.commit();
    return getFeePlanById(feePlanId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function refreshFeeAssignmentStatuses(feePlanId) {
  const [assignments] = await pool.query(
    `
      SELECT
        fa.fee_assignment_id AS feeAssignmentId,
        fa.final_amount AS finalAmount,
        fa.paid_amount AS paidAmount,
        fa.status,
        DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate
      FROM fee_assignment fa
      INNER JOIN fee_plan fp ON fp.fee_plan_id = fa.fee_plan_id
      WHERE fa.fee_plan_id = ?
    `,
    [feePlanId],
  );

  await Promise.all(
    assignments.map((assignment) => {
      const nextStatus = getAssignmentStatus(
        toNumber(assignment.finalAmount),
        toNumber(assignment.paidAmount),
        assignment.dueDate,
        assignment.status,
      );

      if (nextStatus === assignment.status) return null;
      return pool.query(
        "UPDATE fee_assignment SET status = ? WHERE fee_assignment_id = ?",
        [nextStatus, assignment.feeAssignmentId],
      );
    }),
  );
}

module.exports = {
  listFeePlans,
  getFeePlanById,
  createFeePlan,
  updateFeePlanStatus,
  recordFeePayment,
  refreshFeeAssignmentStatuses,
};
