/**
 * Import ảnh đại diện học sinh hàng loạt (tối ưu cho lần nạp dữ liệu ban đầu).
 *
 * Cách dùng:
 *   node src/scripts/import-avatars.js <thư-mục-ảnh>
 *
 * Quy ước:
 *   - Mỗi ảnh đặt tên theo MÃ HỌC SINH, ví dụ: HS001.jpg, HS002.png, HS003.webp
 *   - Script sẽ: tìm HS theo mã → upload ảnh lên Cloudinary (public_id = mã HS,
 *     GHI ĐÈ nếu đã có) → cập nhật user_account.avatar.
 *   - Dùng CHUNG kho lưu (Cloudinary) và CHUNG cột (user_account.avatar) với nút
 *     "Tải ảnh" trên giao diện staff → dữ liệu không bị phân mảnh.
 *   - Chạy lại nhiều lần an toàn (idempotent theo mã HS).
 *
 * Yêu cầu: .env đã cấu hình CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET.
 */
const fs = require("fs");
const path = require("path");

const { pool } = require("../config/db"); // nạp dotenv + pool trước
const cloudinary = require("../config/cloudinary");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const BASE_FOLDER = process.env.CLOUDINARY_FOLDER || "fpt-school";

async function main() {
  const dir = process.argv[2];

  if (!dir) {
    console.error(
      "❌ Thiếu tham số.\n   Dùng: node src/scripts/import-avatars.js <thư-mục-ảnh>",
    );
    process.exit(1);
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.error(
      "❌ Chưa cấu hình Cloudinary trong .env " +
        "(CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET).",
    );
    process.exit(1);
  }

  const absDir = path.resolve(dir);
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    console.error(`❌ Không tìm thấy thư mục: ${absDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(absDir)
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));

  if (files.length === 0) {
    console.error(
      `❌ Không có ảnh (${[...IMAGE_EXT].join(", ")}) trong: ${absDir}`,
    );
    process.exit(1);
  }

  console.log(`Tìm thấy ${files.length} ảnh trong ${absDir}\n`);

  let ok = 0;
  let notFound = 0;
  let failed = 0;

  for (const file of files) {
    const studentCode = path.basename(file, path.extname(file)).trim();
    const filePath = path.join(absDir, file);

    try {
      const [rows] = await pool.query(
        `SELECT s.user_id AS userId, ua.full_name AS fullName
           FROM student s
           INNER JOIN user_account ua ON ua.user_id = s.user_id
          WHERE s.student_code = ? LIMIT 1`,
        [studentCode],
      );

      if (!rows[0]) {
        console.warn(
          `  ⚠ Bỏ qua "${file}" — không có học sinh mã "${studentCode}"`,
        );
        notFound += 1;
        continue;
      }

      const result = await cloudinary.uploader.upload(filePath, {
        folder: `${BASE_FOLDER}/avatars`,
        public_id: studentCode,
        overwrite: true,
        resource_type: "image",
      });

      await pool.query(
        "UPDATE user_account SET avatar = ?, updated_at = NOW() WHERE user_id = ?",
        [result.secure_url, rows[0].userId],
      );

      console.log(`  ✓ ${studentCode} — ${rows[0].fullName}`);
      ok += 1;
    } catch (err) {
      console.error(`  ✗ Lỗi với "${file}": ${err.message}`);
      failed += 1;
    }
  }

  console.log(
    `\nHoàn tất: ${ok} cập nhật · ${notFound} không khớp mã · ${failed} lỗi.`,
  );
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
