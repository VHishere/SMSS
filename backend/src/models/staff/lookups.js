const { pool } = require("../../config/db");

async function getLookups() {
  const [classes] = await pool.query(
    `
      SELECT
        sc.class_id AS classId,
        sc.class_name AS className,
        sc.grade_id AS gradeId,
        sc.school_year_id AS schoolYearId,
        g.grade_name AS gradeName,
        sy.year_name AS schoolYearName
      FROM school_class sc
      INNER JOIN grade g ON g.grade_id = sc.grade_id
      INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
      WHERE sc.status = 'ACTIVE'
      ORDER BY sc.class_name
    `,
  );

  const [subjects] = await pool.query(
    `
      SELECT subject_id AS subjectId, subject_name AS subjectName, subject_code AS subjectCode
      FROM subject
      WHERE status = 'ACTIVE'
      ORDER BY subject_name
    `,
  );

  const [semesters] = await pool.query(
    `
      SELECT
        sem.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        sem.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName
      FROM semester sem
      INNER JOIN school_year sy ON sy.school_year_id = sem.school_year_id
      WHERE sem.status = 'ACTIVE'
      ORDER BY sy.start_date DESC, sem.start_date
    `,
  );

  const [students] = await pool.query(
    `
      SELECT s.student_id AS studentId, s.student_code AS studentCode, ua.full_name AS fullName
      FROM student s
      INNER JOIN user_account ua ON ua.user_id = s.user_id
      WHERE s.status = 'ACTIVE'
      ORDER BY s.student_code
    `,
  );

  const [schoolYears] = await pool.query(
    `
      SELECT
        sy.school_year_id AS schoolYearId,
        sy.year_name AS yearName,
        sy.is_active AS isActive,
        sy.status,
        DATE_FORMAT(sy.start_date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(sy.end_date, '%Y-%m-%d') AS endDate
      FROM school_year sy
      ORDER BY sy.start_date DESC
    `,
  );

  const [grades] = await pool.query(
    `
      SELECT grade_id AS gradeId, grade_name AS gradeName
      FROM grade
      WHERE status = 'ACTIVE'
      ORDER BY grade_id
    `,
  );

  const [teachers] = await pool.query(
    `
      SELECT
        t.teacher_id AS teacherId,
        t.teacher_code AS teacherCode,
        t.subject_specialize AS subjectSpecialize,
        ua.full_name AS fullName,
        ua.email,
        GROUP_CONCAT(DISTINCT COALESCE(tc.subject_id, specialize_subject.subject_id)) AS subjectIds
      FROM teacher t
      INNER JOIN user_account ua ON ua.user_id = t.user_id
      LEFT JOIN subject specialize_subject
        ON (
          LOWER(specialize_subject.subject_name) = LOWER(t.subject_specialize)
          OR LOWER(specialize_subject.subject_code) = LOWER(t.subject_specialize)
          OR LOWER(specialize_subject.subject_name) LIKE CONCAT('%', LOWER(TRIM(t.subject_specialize)), '%')
          OR LOWER(TRIM(t.subject_specialize)) LIKE CONCAT('%', LOWER(specialize_subject.subject_name), '%')
        )
        AND specialize_subject.status = 'ACTIVE'
      LEFT JOIN teacher_class tc
        ON tc.teacher_id = t.teacher_id
        AND tc.subject_id IS NOT NULL
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
      WHERE ua.status = 'ACTIVE'
      GROUP BY t.teacher_id, t.teacher_code, t.subject_specialize, ua.full_name, ua.email
      ORDER BY ua.full_name
    `,
  );

  const [feeCategories] = await pool.query(
    `
      SELECT
        fee_category_id AS feeCategoryId,
        code,
        name,
        description
      FROM fee_category
      WHERE status = 'ACTIVE'
      ORDER BY fee_category_id
    `,
  );

  const [feeRates] = await pool.query(
    `
      SELECT
        fr.fee_rate_id AS feeRateId,
        fr.fee_category_id AS feeCategoryId,
        fc.name AS feeCategoryName,
        fr.school_year_id AS schoolYearId,
        fr.semester_id AS semesterId,
        fr.scope_type AS scopeType,
        fr.grade_id AS gradeId,
        g.grade_name AS gradeName,
        fr.class_id AS classId,
        sc.class_name AS className,
        fr.amount,
        fr.billing_cycle AS billingCycle
      FROM fee_rate fr
      INNER JOIN fee_category fc ON fc.fee_category_id = fr.fee_category_id
      LEFT JOIN grade g ON g.grade_id = fr.grade_id
      LEFT JOIN school_class sc ON sc.class_id = fr.class_id
      WHERE fr.status = 'ACTIVE'
      ORDER BY fc.name, fr.created_at DESC
    `,
  );

  return {
    classes,
    subjects,
    semesters,
    students,
    schoolYears: schoolYears.map((row) => ({
      ...row,
      isActive: Boolean(row.isActive),
    })),
    grades,
    teachers: teachers.map((row) => ({
      ...row,
      subjectIds: row.subjectIds
        ? row.subjectIds.split(",").map((subjectId) => Number(subjectId))
        : [],
    })),
    feeCategories,
    feeRates: feeRates.map((row) => ({ ...row, amount: Number(row.amount) })),
  };
}

module.exports = { getLookups };
