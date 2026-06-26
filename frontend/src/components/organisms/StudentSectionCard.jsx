function StudentSectionCard({
  title,
  description,
  action,
  children,
}) {
  return (
    <section
      className="
        rounded-2xl border border-orange-100
        bg-white p-6 shadow-sm
      "
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-bold text-[#0F2747]">
            {title}
          </h2>

          {description && (
            <p className="mb-0 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

export default StudentSectionCard;