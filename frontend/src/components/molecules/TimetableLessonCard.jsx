import {
  FiClock,
  FiMapPin,
  FiUser,
} from "react-icons/fi";

const STATUS_STYLES = {
  PRESENT: {
    bar: "bg-green-500",
    badge: "border-green-100 bg-green-50 text-green-700",
  },

  LATE: {
    bar: "bg-yellow-400",
    badge: "border-yellow-100 bg-yellow-50 text-yellow-700",
  },

  ABSENT_EXCUSED: {
    bar: "bg-red-500",
    badge: "border-red-100 bg-red-50 text-red-600",
  },

  ABSENT_UNEXCUSED: {
    bar: "bg-red-500",
    badge: "border-red-100 bg-red-50 text-red-600",
  },

  EARLY_LEAVE: {
    bar: "bg-yellow-500",
    badge: "border-yellow-100 bg-yellow-50 text-yellow-700",
  },

  NOT_RECORDED: {
    bar: "bg-blue-500",
    badge: "border-blue-100 bg-blue-50 text-[#08509F]",
  },

  NOT_YET: {
    bar: "bg-blue-400",
    badge: "border-blue-100 bg-blue-50 text-[#08509F]",
  },

  DEFAULT: {
    bar: "bg-blue-500",
    badge: "border-blue-100 bg-blue-50 text-[#08509F]",
  },
};

function getStatusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.DEFAULT;
}

function TimetableLessonCard({
  lesson,
  compact = false,
  onClick,
  actionLabel,
}) {
  if (!lesson) {
    return (
      <div
        className={`
          flex w-full
          items-center justify-center
          ${compact ? "min-h-20" : "h-32 min-h-32"}
          rounded-xl border border-dashed
          border-slate-200 bg-white/70
          px-3 py-4 text-sm
          font-semibold text-slate-400
        `}
      >
        -
      </div>
    );
  }

  const attendanceStatus =
    lesson.attendanceStatus || "NOT_RECORDED";

  const attendanceLabel =
    lesson.attendanceStatusLabel || "Chưa điểm danh";

  const statusStyle = getStatusStyle(attendanceStatus);
  const CardTag = onClick ? "button" : "article";

  return (
    <CardTag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`
        relative flex w-full
        flex-col overflow-hidden rounded-xl
        ${compact ? "min-h-28" : "h-32 min-h-32"}
        border border-slate-200
        bg-white p-3 pl-4 text-left shadow-sm
        transition duration-200
        hover:-translate-y-0.5
        hover:shadow-md
        ${onClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F27123]/40" : ""}
      `}
      title={actionLabel || lesson.subjectName}
    >
      <span
        className={`
          absolute bottom-3 left-0 top-3
          w-[3px] rounded-r-full
          ${statusStyle.bar}
        `}
      />

      <div>
        <h4
          className={`
            mb-2 truncate font-bold
            leading-6 text-[#0F2747]
            ${compact ? "text-base" : "text-lg"}
          `}
          title={lesson.subjectName}
        >
          {lesson.subjectName}
        </h4>

        <div className="space-y-1">
          {lesson.className && (
            <p className="mb-0 truncate text-xs font-semibold text-slate-500">
              Lớp: {lesson.className}
            </p>
          )}

          <p className="mb-0 flex items-center gap-1.5 text-xs text-slate-600">
            <FiUser
              size={13}
              className="shrink-0 text-slate-400"
            />

            <span
              className="truncate"
              title={lesson.teacherName}
            >
              {lesson.teacherName || "Chưa phân công giáo viên"}
            </span>
          </p>

          <p className="mb-0 flex items-center gap-1.5 text-xs font-semibold text-[#08509F]">
            <FiMapPin
              size={13}
              className="shrink-0 text-[#08509F]"
            />

            <span
              className="truncate"
              title={lesson.roomName}
            >
              {lesson.roomName || "Chưa xếp phòng"}
            </span>
          </p>
        </div>
      </div>

      <div
        className={`
          mt-auto inline-flex w-fit max-w-full
          items-center gap-1.5 rounded-full
          border px-2.5 py-1
          text-[11px] font-bold
          ${statusStyle.badge}
        `}
        title={attendanceLabel}
      >
        <FiClock
          size={12}
          className="shrink-0"
        />

        <span className="truncate">
          {actionLabel || attendanceLabel}
          {lesson.attendanceCheckInTime
            ? ` · ${lesson.attendanceCheckInTime}`
            : ""}
        </span>
      </div>
    </CardTag>
  );
}

export default TimetableLessonCard;
