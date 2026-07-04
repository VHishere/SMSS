function LoadingState({ label = "Đang tải dữ liệu..." }) {
  return (
    <div
      className="
        rounded-2xl border border-orange-100
        bg-white p-8 text-center
        text-sm text-slate-500 shadow-sm
      "
    >
      {label}
    </div>
  );
}

export default LoadingState;