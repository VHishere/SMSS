function StudentHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}) {
  return (
    <section
      className="
        mb-6 overflow-hidden rounded-3xl
        border border-orange-100
        bg-white shadow-sm
      "
    >
      <div
        className="
          flex flex-col items-start
          justify-between gap-5 px-4 py-5 sm:px-6 sm:py-6
          lg:flex-row lg:items-center lg:gap-6 lg:px-8
        "
      >
        <div className="flex w-full min-w-0 items-center gap-4 sm:gap-5 lg:w-auto">
          <div
            className="
              flex h-14 w-14 shrink-0
              items-center justify-center
              rounded-full bg-[#FFE7D6]
              text-[#F27123] sm:h-20 sm:w-20
            "
          >
            <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>

          <div className="min-w-0">
            {eyebrow && (
              <p
                className="
                  mb-2 text-xs font-bold uppercase
                  tracking-[0.18em] text-[#F27123]
                "
              >
                {eyebrow}
              </p>
            )}

            <h1 className="mb-0 break-words text-2xl font-bold leading-tight text-[#0F2747] sm:text-3xl">
              {title}
            </h1>

            {description && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                {description}
              </p>
            )}
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}

export default StudentHero;