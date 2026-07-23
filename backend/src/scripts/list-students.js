const { pool, testConnection } = require('../config/db');

const sql = `
    SELECT
        s.student_id,
        s.student_code,
        u.full_name,
        s.date_of_birth,
        s.gender,
        s.address,
        s.status
    FROM student s
    JOIN user_account u ON s.user_id = u.user_id
    ORDER BY s.student_id
`;

async function main() {
    try {
        await testConnection();
        const [results] = await pool.query(sql);

        console.log(`\n=== DANH SÁCH HỌC SINH (${results.length} học sinh) ===\n`);

        results.forEach((student, index) => {
            const dob = student.date_of_birth
                ? new Date(student.date_of_birth).toLocaleDateString('vi-VN')
                : '—';

            console.log(`${index + 1}. ${student.full_name}`);
            console.log(`   Mã HS   : ${student.student_code}`);
            console.log(`   Ngày sinh: ${dob}`);
            console.log(`   Giới tính: ${student.gender}`);
            console.log(`   Địa chỉ  : ${student.address || '—'}`);
            console.log(`   Trạng thái: ${student.status}`);
            console.log('');
        });
    } catch (err) {
        console.error('Lỗi:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();
