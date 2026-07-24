function StaffPageHeader({
  title,
  description,
  action,
}) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="mb-1 break-words text-2xl font-bold text-[#1A1C1C] sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mb-0 max-w-3xl text-sm text-slate-500">
            {description}
          </p>
        )}
      </div>

      {action && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{action}</div>}
    </div>
  );
}

export default StaffPageHeader;
