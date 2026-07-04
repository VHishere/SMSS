function StaffPageHeader({
  title,
  action,
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-[#0F2747]">
          {title}
        </h1>

      </div>

      {action}
    </div>
  );
}

export default StaffPageHeader;
