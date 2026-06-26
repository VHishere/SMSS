function EmptyState({
  title = "Chưa có dữ liệu",
  description,
}) {
  return (
    <div
      className="
        rounded-2xl border border-dashed
        border-orange-200 bg-[#FFF7F2]
        p-10 text-center
      "
    >
      <p className="mb-1 text-base font-semibold text-[#0F2747]">
        {title}
      </p>

      {description && (
        <p className="mb-0 text-sm text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

export default EmptyState;