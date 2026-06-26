function StudentHero({
  icon: Icon,
  eyebrow,
  title,
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
          flex flex-wrap items-center
          justify-between gap-6 px-6 py-6 lg:px-8
        "
      >
        <div className="flex items-center gap-5">
          <div
            className="
              flex h-20 w-20 shrink-0
              items-center justify-center
              rounded-full bg-[#FFE7D6]
              text-[#F27123]
            "
          >
            <Icon size={34} />
          </div>

          <div>
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

            <h1 className="mb-0 text-3xl font-bold text-[#0F2747]">
              {title}
            </h1>
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}

export default StudentHero;