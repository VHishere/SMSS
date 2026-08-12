// Định dạng ngày theo GIỜ ĐỊA PHƯƠNG của server.
//
// `new Date().toISOString().slice(0, 10)` trả về ngày theo UTC — ở múi giờ +07
// mọi thời điểm trước 07:00 sáng sẽ ra ngày HÔM QUA. Dùng các helper dưới đây
// thay cho toISOString() ở mọi chỗ cần một ngày dạng 'YYYY-MM-DD'.

function toIsoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayIso() {
  return toIsoDate(new Date());
}

// Cộng/trừ ngày trên chuỗi 'YYYY-MM-DD' mà không rơi vào bẫy UTC.
function addIsoDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

module.exports = { addIsoDays, toIsoDate, todayIso };
