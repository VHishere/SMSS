function TimetableLessonCard({
  lesson,
}) {
  if (!lesson) {
    return (
      <div
        className="
          flex min-h-28 items-center
          justify-center rounded-xl
          border border-dashed
          border-slate-200 bg-slate-50
          px-3 py-4 text-xs
          font-medium text-slate-400
        "
      >
        Trống
      </div>
    );
  }

  return (
    <article
      className="
        min-h-28 rounded-xl
        border border-orange-100
        bg-[#FFF7F2] p-3
        shadow-sm transition
        hover:-translate-y-0.5
        hover:shadow-md
      "
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="mb-0 text-sm font-bold leading-5 text-[#0F2747]">
          {lesson.subjectName}
        </h4>

        <span
          className="
            shrink-0 rounded-full
            bg-[#FFE7D6] px-2 py-1
            text-[10px] font-bold
            text-[#C94F00]
          "
        >
          {lesson.subjectCode}
        </span>
      </div>

      <p className="mb-1 text-xs text-slate-600">
        {lesson.className ? `Lớp: ${lesson.className}` : `GV: ${lesson.teacherName}`}
      </p>

      <p className="mb-0 text-xs font-semibold text-[#08509F]">
        Phòng{" "}
        {lesson.roomName || "Chưa xếp"}
      </p>
    </article>
  );
}

export default TimetableLessonCard;