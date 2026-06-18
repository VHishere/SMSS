const { pool } = require('../config/db');

async function main() {
    const [s] = await pool.query('SELECT COUNT(*) AS c FROM student');
    const [p] = await pool.query('SELECT COUNT(*) AS c FROM parent_profile');
    const [a] = await pool.query('SELECT COUNT(*) AS c FROM academic_result');
    const [sy] = await pool.query('SELECT year_name FROM school_year WHERE is_active = 1 LIMIT 1');

    console.log('students', s[0].c, 'parents', p[0].c, 'academic', a[0].c, 'year', sy[0]?.year_name);

    const [students] = await pool.query(`
        SELECT s.student_id, s.student_code, u.full_name, u.email, sc.class_name, g.grade_name, s.status
        FROM student s
        JOIN user_account u ON s.user_id = u.user_id
        LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
        LEFT JOIN school_class sc ON sc.class_id = ce.class_id
        LEFT JOIN grade g ON g.grade_id = sc.grade_id
        LIMIT 5
    `);
    console.log('students sample:', JSON.stringify(students, null, 2));

    const [parents] = await pool.query(`
        SELECT pp.parent_id, u.full_name, u.email, u.phone, pp.relationship, sp.student_id, su.full_name AS student_name
        FROM parent_profile pp
        JOIN user_account u ON pp.user_id = u.user_id
        LEFT JOIN student_parent sp ON sp.parent_id = pp.parent_id
        LEFT JOIN student st ON st.student_id = sp.student_id
        LEFT JOIN user_account su ON st.user_id = su.user_id
        LIMIT 5
    `);
    console.log('parents sample:', JSON.stringify(parents, null, 2));

    const [academic] = await pool.query(`
        SELECT ar.result_id, s.student_code, su.full_name, sub.subject_name, sem.semester_name, ar.score_type, ar.score_value
        FROM academic_result ar
        JOIN student s ON s.student_id = ar.student_id
        JOIN user_account su ON s.user_id = su.user_id
        JOIN subject sub ON sub.subject_id = ar.subject_id
        JOIN semester sem ON sem.semester_id = ar.semester_id
        LIMIT 5
    `);
    console.log('academic sample:', JSON.stringify(academic, null, 2));

    await pool.end();
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
