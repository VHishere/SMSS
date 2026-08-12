function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function requireText(value, label, maxLength = 255) {
  const text = cleanText(value);
  if (!text) {
    throw createHttpError(`Vui lòng nhập ${label}`);
  }
  if (text.length > maxLength) {
    throw createHttpError(`${label} không được vượt quá ${maxLength} ký tự`);
  }
  return text;
}

function optionalText(value, label, maxLength = 255) {
  const text = cleanText(value);
  if (!text) return null;
  if (text.length > maxLength) {
    throw createHttpError(`${label} không được vượt quá ${maxLength} ký tự`);
  }
  return text;
}

function validateCode(value, label, maxLength = 30) {
  const code = requireText(value, label, maxLength).toUpperCase();
  if (!/^[A-Z0-9._-]+$/.test(code)) {
    throw createHttpError(
      `${label} chỉ được chứa chữ, số, dấu chấm, gạch ngang hoặc gạch dưới`,
    );
  }
  return code;
}

function validateUsername(value) {
  const username = requireText(value, "tên đăng nhập", 50).toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw createHttpError(
      "Tên đăng nhập phải từ 3-50 ký tự và chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới",
    );
  }
  return username;
}

function validatePassword(value) {
  const password = cleanText(value);
  if (password && password.length < 6) {
    throw createHttpError("Mật khẩu phải có ít nhất 6 ký tự");
  }
  return password || undefined;
}

function validateEmail(value) {
  const email = requireText(value, "email", 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createHttpError("Email không hợp lệ");
  }
  return email;
}

// Số VN sau chuẩn hóa 2018: 0 + 9 chữ số (10 số), hoặc +84 + 9 chữ số.
// Regex cũ `^(0|\+84)[0-9]{8,10}$` cho lọt cả số 9 chữ số lẫn 11 chữ số.
function validateOptionalPhone(value) {
  const phone = cleanText(value).replace(/[\s.-]/g, "");
  if (!phone) return null;
  if (!/^(0\d{9}|\+84\d{9})$/.test(phone)) {
    throw createHttpError(
      "Số điện thoại không hợp lệ (10 số bắt đầu bằng 0, hoặc +84 và 9 số)",
    );
  }
  return phone;
}

function validateEnum(value, allowed, label, fallback) {
  const raw = cleanText(value || fallback);
  const normalized = raw.toUpperCase();
  const matched = allowed.find((item) => item.toUpperCase() === normalized);
  if (!matched) {
    throw createHttpError(`${label} không hợp lệ`);
  }
  return matched;
}

function validateDate(value, label, options = {}) {
  const { required = false, notFuture = false, minYear = 1900 } = options;
  const text = cleanText(value);

  if (!text) {
    if (required) throw createHttpError(`Vui lòng chọn ${label}`);
    return null;
  }

  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < minYear) {
    throw createHttpError(`${label} không hợp lệ`);
  }

  if (notFuture && date > new Date()) {
    throw createHttpError(`${label} không được lớn hơn ngày hiện tại`);
  }

  return text;
}

function validateDateRange(start, end) {
  const startDate = validateDate(start, "ngày bắt đầu", {
    required: true,
    minYear: 2000,
  });
  const endDate = validateDate(end, "ngày kết thúc", {
    required: true,
    minYear: 2000,
  });

  if (new Date(`${startDate}T00:00:00`) >= new Date(`${endDate}T00:00:00`)) {
    throw createHttpError("Ngày kết thúc phải sau ngày bắt đầu");
  }

  return { startDate, endDate };
}

function validatePositiveInt(value, label, options = {}) {
  const { min = 1, max = 999999 } = options;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw createHttpError(`${label} phải từ ${min} đến ${max}`);
  }
  return number;
}

// Tên đăng nhập tự sinh (từ mã HS/GV hoặc email phụ huynh) có thể quá ngắn hoặc
// trùng với tài khoản khác — trước đây staff nhận lỗi "Tên đăng nhập đã tồn tại"
// dù chưa từng nhập ô nào. Ở đây tự làm sạch và thêm hậu tố cho tới khi trống.
async function generateUniqueUsername(connection, base) {
  const normalized = cleanText(base).toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const seed = (normalized.length >= 3 ? normalized : `${normalized}user`).slice(
    0,
    50,
  );

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate =
      suffix === 0 ? seed : `${seed.slice(0, 50 - String(suffix).length)}${suffix}`;
    const [rows] = await connection.query(
      "SELECT user_id FROM user_account WHERE username = ? LIMIT 1",
      [candidate],
    );
    if (!rows[0]) return validateUsername(candidate);
  }

  throw createHttpError(
    "Không tạo được tên đăng nhập tự động, vui lòng nhập thủ công",
  );
}

async function assertExists(connection, sql, params, message) {
  const [rows] = await connection.query(sql, params);
  if (!rows[0]) {
    throw createHttpError(message, 404);
  }
  return rows[0];
}

async function assertUnique(connection, sql, params, message) {
  const [rows] = await connection.query(sql, params);
  if (rows[0]) {
    throw createHttpError(message, 409);
  }
}

module.exports = {
  assertExists,
  assertUnique,
  cleanText,
  createHttpError,
  generateUniqueUsername,
  optionalText,
  requireText,
  validateCode,
  validateDate,
  validateDateRange,
  validateEmail,
  validateEnum,
  validateOptionalPhone,
  validatePassword,
  validatePositiveInt,
  validateUsername,
};
