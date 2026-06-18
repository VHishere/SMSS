import {
  FiMapPin,
  FiUser,
} from "react-icons/fi";

const PERIOD_STYLES = {
  1: {
    bar: "bg-[#F27123]",
    badge: "bg-orange-50 text-[#C94F00]",
  },
  2: {
    bar: "bg-[#22C55E]",
    badge: "bg-green-50 text-green-700",
  },
  3: {
    bar: "bg-[#08509F]",
    badge: "bg-blue-50 text-[#08509F]",
  },
  4: {
    bar: "bg-[#14B8A6]",
    badge: "bg-cyan-50 text-cyan-700",
  },
  5: {
    bar: "bg-[#8B5CF6]",
    badge: "bg-purple-50 text-purple-700",
  },
  6: {
    bar: "bg-[#F59E0B]",
    badge: "bg-amber-50 text-amber-700",
  },
  7: {
    bar: "bg-[#EC4899]",
    badge: "bg-pink-50 text-pink-700",
  },
  8: {
    bar: "bg-[#64748B]",
    badge: "bg-slate-100 text-slate-700",
  },
};

function getPeriodStyle(periodNo) {
  return PERIOD_STYLES[periodNo] || PERIOD_STYLES[1];
}

function TimetableLessonCard({
  lesson,
  periodNo,
}) {
  const periodStyle = getPeriodStyle(periodNo);

  if (!lesson) {
    return (
      <div
        className="
          flex min-h-24 items-center
          justify-center rounded-xl
          border border-dashed
          border-slate-200 bg-white/70
          px-3 py-4 text-sm
          font-semibold text-slate-400
        "
      >
        -
      </div>
    );
  }

  return (
    <article
      className="
        relative min-h-24 overflow-hidden
        rounded-xl border border-slate-200
        bg-white p-3 pl-4 shadow-sm
        transition duration-200
        hover:-translate-y-0.5
        hover:shadow-md
      "
    >
      <span
        className={`
          absolute bottom-3 left-0 top-3
          w-[3px] rounded-r-full
          ${periodStyle.bar}
        `}
      />

      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="mb-0 line-clamp-2 text-sm font-bold leading-5 text-[#0F2747]">
          {lesson.subjectName}
        </h4>

        {lesson.subjectCode && (
          <span
            className={`
              shrink-0 rounded-full
              px-2 py-1 text-[10px]
              font-bold
              ${periodStyle.badge}
            `}
          >
            {lesson.subjectCode}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="mb-0 flex items-center gap-1.5 text-xs text-slate-600">
          <FiUser
            size={13}
            className="text-slate-400"
          />

          <span className="truncate">
            {lesson.teacherName}
          </span>
        </p>

        <p className="mb-0 flex items-center gap-1.5 text-xs font-semibold text-[#08509F]">
          <FiMapPin
            size={13}
            className="text-[#08509F]"
          />

          <span>
            {lesson.roomName || "Chưa xếp phòng"}
          </span>
        </p>
      </div>
    </article>
  );
}

export default TimetableLessonCard;