const WEEKDAY = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function todayLabel() {
  const d = new Date();
  return `${WEEKDAY[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

// Banner chào mừng đầu trang dashboard — dùng chung cho GVCN / GVQN / Staff /
// Phụ huynh để 4 portal luôn giống nhau. Chỉ đổi câu chúc theo vai trò.
//   name    : họ tên đầy đủ (component tự lấy tên gọi = từ cuối)
//   message : câu chúc phía sau ngày tháng
function WelcomeBanner({
  name,
  message = "Chúc bạn một ngày làm việc hiệu quả.",
}) {
  const firstName = String(name || "").trim().split(/\s+/).pop() || "bạn";

  return (
    <div
      className="mb-6 rounded-3xl p-6 text-white shadow-md"
      style={{ background: "linear-gradient(120deg, #00458E, #225DAD)" }}
    >
      <h2 className="mb-0 text-2xl font-extrabold">
        Chào mừng bạn trở lại, {firstName}!
      </h2>

      <p className="mb-0 mt-1 text-sm text-white/85">
        Hôm nay là {todayLabel()}. {message}
      </p>
    </div>
  );
}

export default WelcomeBanner;
