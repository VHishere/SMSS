import { useMemo, useState } from "react";
import {
  FiArrowRight,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiFlag,
  FiStar,
  FiTrendingUp,
} from "react-icons/fi";
import { Link } from "react-router-dom";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import WelcomeBanner from "../../components/molecules/WelcomeBanner";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useAuth } from "../../context/useAuth";
import { useStudentDashboard } from "../../hooks/useStudentDashboard";

function parseDate(value) {
  if (!value) return null;

  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatLongDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "Hôm nay";

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatTime(value) {
  const date = parseDate(value);
  if (!date) return "--:--";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(1);
}

function hasNumericValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
}

function semesterShortLabel(item) {
  const semesterName = String(item.semesterName || "Học kỳ")
    .replace(/Học kỳ/gi, "HK")
    .replace(/Semester/gi, "HK");

  return `${semesterName} ${item.schoolYearName || ""}`.trim();
}

function getHomeworkStatus(homework) {
  if (homework.studentHomeworkStatus === "OVERDUE") {
    return {
      label: "Quá hạn",
      className: "bg-red-50 text-red-600",
      borderClass: "border-red-500",
    };
  }

  return {
    label: "Chưa nộp",
    className: "bg-orange-50 text-[#F27123]",
    borderClass: "border-[#F27123]",
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  iconClassName,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${iconClassName}`}
        >
          <Icon size={18} />
        </span>

        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium text-slate-500">
            {label}
          </p>

          <strong className="block text-xl font-black text-[#0F2747]">
            {value}
          </strong>

          {helper && (
            <p className="mb-0 mt-1 truncate text-[10px] font-semibold text-slate-400">
              {helper}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function TodayLesson({ lesson }) {
  const attendanceTone = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-600",
    purple: "bg-violet-50 text-violet-700",
    orange: "bg-orange-50 text-[#F27123]",
    slate: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="grid grid-cols-[64px_3px_minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0">
      <div>
        <strong className="block text-sm font-black text-[#0F2747]">
          {lesson.startTime || "--:--"}
        </strong>
        <span className="text-[10px] text-slate-400">
          {lesson.endTime || "--:--"}
        </span>
      </div>

      <span className="h-10 rounded-full bg-[#F27123]" />

      <div className="min-w-0">
        <p className="mb-1 truncate text-sm font-extrabold text-[#0F2747]">
          {lesson.subjectName}
        </p>
        <p className="mb-0 truncate text-[10px] text-slate-500">
          Phòng: {lesson.roomName || "Chưa cập nhật"} · GV:{" "}
          {lesson.teacherName || "Chưa cập nhật"}
        </p>
      </div>

      <span
        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
          attendanceTone[lesson.attendanceStatusTone] ||
          attendanceTone.slate
        }`}
      >
        {lesson.attendanceStatusLabel || "Chưa cập nhật"}
      </span>
    </div>
  );
}

function EventCard({ event }) {
  const date = parseDate(event.startDate);

  return (
    <Link
      to={`/student/events/${event.eventId}`}
      className="group flex items-center gap-3 rounded-xl px-2 py-2 no-underline transition hover:bg-orange-50"
    >
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-50 text-[#F27123]">
        <strong className="text-sm leading-none">
          {date ? String(date.getDate()).padStart(2, "0") : "--"}
        </strong>
        <small className="mt-1 text-[9px] font-extrabold uppercase">
          {date ? `TH${date.getMonth() + 1}` : "---"}
        </small>
      </span>

      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-xs font-extrabold leading-5 text-[#0F2747] group-hover:text-[#F27123]">
          {event.title}
        </span>
        <span className="mt-1 block truncate text-[10px] text-slate-400">
          {event.location || "Chưa cập nhật"} ·{" "}
          {formatTime(event.startDate)}
        </span>
      </span>
    </Link>
  );
}

function HomeworkCard({ homework }) {
  const status = getHomeworkStatus(homework);

  return (
    <Link
      to={`/student/homeworks/${homework.homeworkId}`}
      className={`group block rounded-xl border-l-4 bg-white px-4 py-3 text-inherit no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${status.borderClass}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="mb-0 line-clamp-2 text-xs font-extrabold leading-5 text-[#0F2747] group-hover:text-[#F27123]">
          {homework.subjectName}: {homework.title}
        </p>

        <FiArrowRight className="mt-1 shrink-0 text-slate-300 group-hover:text-[#F27123]" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-slate-400">
          Hạn nộp: {formatDate(homework.dueDate)} ·{" "}
          {formatTime(homework.dueDate)}
        </span>

        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${status.className}`}
        >
          {status.label}
        </span>
      </div>
    </Link>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="grid min-h-[250px] place-items-center rounded-xl bg-slate-50 px-4 text-center">
      <div>
        <FiTrendingUp
          className="mx-auto mb-3 text-slate-300"
          size={30}
        />
        <p className="mb-0 text-sm font-semibold text-slate-500">
          {message}
        </p>
      </div>
    </div>
  );
}

function ScoreTrendChart({ data }) {
  const [tooltip, setTooltip] = useState(null);

  const validData = data.filter(
    (item) =>
      hasNumericValue(item.regularScore) ||
      hasNumericValue(item.attendanceScore),
  );

  if (validData.length === 0) {
    return (
      <EmptyChart message="Chưa có đủ dữ liệu điểm theo học kỳ." />
    );
  }

  const width = 760;
  const height = 280;
  const padding = {
    top: 24,
    right: 24,
    bottom: 58,
    left: 48,
  };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  function xAt(index) {
    if (data.length <= 1) {
      return padding.left + plotWidth / 2;
    }

    return padding.left + (index / (data.length - 1)) * plotWidth;
  }

  function yAt(value) {
    return (
      padding.top +
      ((10 - Number(value)) / 10) * plotHeight
    );
  }

  function linePoints(key) {
    return data
      .map((item, index) => {
        if (!hasNumericValue(item[key])) {
          return null;
        }

        const value = Number(item[key]);

        return `${xAt(index)},${yAt(value)}`;
      })
      .filter(Boolean)
      .join(" ");
  }

  function showTooltip({
    x,
    y,
    semester,
    label,
    value,
    color,
  }) {
    setTooltip({
      x,
      y,
      semester,
      label,
      value,
      color,
    });
  }

  const yTicks = [0, 2, 4, 6, 8, 10];

  const tooltipWidth = 210;
  const tooltipHeight = 62;

  const tooltipX = tooltip
    ? Math.min(
        Math.max(
          tooltip.x - tooltipWidth / 2,
          padding.left,
        ),
        width - padding.right - tooltipWidth,
      )
    : 0;

  const tooltipY = tooltip
    ? tooltip.y < padding.top + tooltipHeight + 16
      ? tooltip.y + 14
      : tooltip.y - tooltipHeight - 14
    : 0;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[680px] w-full"
        role="img"
        aria-label="Biểu đồ điểm thường xuyên và điểm chuyên cần theo học kỳ"
        onMouseLeave={() => setTooltip(null)}
      >
        {yTicks.map((tick) => {
          const y = yAt(tick);

          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 12}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94A3B8"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <line
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke="#CBD5E1"
        />

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
          stroke="#CBD5E1"
        />

        <polyline
          points={linePoints("regularScore")}
          fill="none"
          stroke="#0F4C8A"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />

        <polyline
          points={linePoints("attendanceScore")}
          fill="none"
          stroke="#F27123"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />

        {data.map((item, index) => {
          const regularScore = hasNumericValue(
            item.regularScore,
          )
            ? Number(item.regularScore)
            : null;

          const attendanceScore = hasNumericValue(
            item.attendanceScore,
          )
            ? Number(item.attendanceScore)
            : null;

          const x = xAt(index);
          const semester = semesterShortLabel(item);

          return (
            <g key={item.semesterId}>
              {regularScore !== null && (
                <g
                  className="cursor-pointer"
                  tabIndex="0"
                  role="button"
                  aria-label={`${semester}, điểm thường xuyên ${regularScore.toFixed(
                    1,
                  )}`}
                  onMouseEnter={() =>
                    showTooltip({
                      x,
                      y: yAt(regularScore),
                      semester,
                      label: "Điểm thường xuyên",
                      value: regularScore,
                      color: "#0F4C8A",
                    })
                  }
                  onFocus={() =>
                    showTooltip({
                      x,
                      y: yAt(regularScore),
                      semester,
                      label: "Điểm thường xuyên",
                      value: regularScore,
                      color: "#0F4C8A",
                    })
                  }
                  onBlur={() => setTooltip(null)}
                >
                  {/* Vùng bắt chuột lớn hơn điểm hiển thị */}
                  <circle
                    cx={x}
                    cy={yAt(regularScore)}
                    r="14"
                    fill="transparent"
                  />

                  <circle
                    cx={x}
                    cy={yAt(regularScore)}
                    r={
                      tooltip?.semester === semester &&
                      tooltip?.label === "Điểm thường xuyên"
                        ? "7"
                        : "5"
                    }
                    fill="#0F4C8A"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </g>
              )}

              {attendanceScore !== null && (
                <g
                  className="cursor-pointer"
                  tabIndex="0"
                  role="button"
                  aria-label={`${semester}, điểm chuyên cần ${attendanceScore.toFixed(
                    1,
                  )}`}
                  onMouseEnter={() =>
                    showTooltip({
                      x,
                      y: yAt(attendanceScore),
                      semester,
                      label: "Điểm chuyên cần",
                      value: attendanceScore,
                      color: "#F27123",
                    })
                  }
                  onFocus={() =>
                    showTooltip({
                      x,
                      y: yAt(attendanceScore),
                      semester,
                      label: "Điểm chuyên cần",
                      value: attendanceScore,
                      color: "#F27123",
                    })
                  }
                  onBlur={() => setTooltip(null)}
                >
                  {/* Vùng bắt chuột lớn hơn điểm hiển thị */}
                  <circle
                    cx={x}
                    cy={yAt(attendanceScore)}
                    r="14"
                    fill="transparent"
                  />

                  <circle
                    cx={x}
                    cy={yAt(attendanceScore)}
                    r={
                      tooltip?.semester === semester &&
                      tooltip?.label === "Điểm chuyên cần"
                        ? "7"
                        : "5"
                    }
                    fill="#F27123"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </g>
              )}

              <text
                x={x}
                y={height - padding.bottom + 24}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#64748B"
              >
                {String(item.semesterName || "").replace(
                  /Học kỳ/gi,
                  "HK",
                )}
              </text>

              <text
                x={x}
                y={height - padding.bottom + 39}
                textAnchor="middle"
                fontSize="9"
                fill="#94A3B8"
              >
                {item.schoolYearName}
              </text>
            </g>
          );
        })}

        {/* Tooltip được vẽ cuối cùng để luôn nằm trên đường và điểm */}
        {tooltip && (
          <g pointerEvents="none">
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx="10"
              fill="#FFFFFF"
              stroke="#E2E8F0"
              strokeWidth="1"
              filter="url(#score-tooltip-shadow)"
            />

            <circle
              cx={tooltipX + 16}
              cy={tooltipY + 20}
              r="4"
              fill={tooltip.color}
            />

            <text
              x={tooltipX + 28}
              y={tooltipY + 23}
              fontSize="11"
              fontWeight="700"
              fill="#64748B"
            >
              {tooltip.semester}
            </text>

            <text
              x={tooltipX + 16}
              y={tooltipY + 47}
              fontSize="12"
              fontWeight="700"
              fill="#0F2747"
            >
              {tooltip.label}
            </text>

            <text
              x={tooltipX + tooltipWidth - 16}
              y={tooltipY + 47}
              textAnchor="end"
              fontSize="14"
              fontWeight="800"
              fill={tooltip.color}
            >
              {Number(tooltip.value).toFixed(1)} / 10
            </text>
          </g>
        )}

        <defs>
          <filter
            id="score-tooltip-shadow"
            x="-20%"
            y="-30%"
            width="140%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="4"
              floodColor="#0F172A"
              floodOpacity="0.14"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

function HomeworkSemesterChart({ data }) {
  const hasData = data.some(
    (item) =>
      Number(item.onTimeHomework || 0) > 0 ||
      Number(item.overdueHomework || 0) > 0,
  );

  if (!hasData) {
    return (
      <EmptyChart message="Chưa có dữ liệu bài tập theo học kỳ." />
    );
  }

  const width = 760;
  const height = 280;
  const padding = {
    top: 24,
    right: 24,
    bottom: 58,
    left: 48,
  };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [
      Number(item.onTimeHomework || 0),
      Number(item.overdueHomework || 0),
    ]),
  );

  const tickStep = Math.max(1, Math.ceil(maxValue / 4));
  const yMax = Math.ceil(maxValue / tickStep) * tickStep;
  const yTicks = Array.from(
    { length: Math.floor(yMax / tickStep) + 1 },
    (_, index) => index * tickStep,
  );

  const groupWidth = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(30, groupWidth * 0.25);

  function yAt(value) {
    return (
      padding.top +
      (1 - Number(value) / yMax) * plotHeight
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[680px] w-full"
        role="img"
        aria-label="Biểu đồ số lượng bài tập đúng hạn và quá hạn theo học kỳ"
      >
        {yTicks.map((tick) => {
          const y = yAt(tick);

          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 12}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94A3B8"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <line
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke="#CBD5E1"
        />

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
          stroke="#CBD5E1"
        />

        {data.map((item, index) => {
          const centerX =
            padding.left + groupWidth * index + groupWidth / 2;

          const onTime = Number(item.onTimeHomework || 0);
          const overdue = Number(item.overdueHomework || 0);

          const onTimeY = yAt(onTime);
          const overdueY = yAt(overdue);

          return (
            <g key={item.semesterId}>
              <rect
                x={centerX - barWidth - 3}
                y={onTimeY}
                width={barWidth}
                height={
                  height -
                  padding.bottom -
                  onTimeY
                }
                rx="5"
                fill="#0F4C8A"
              >
                <title>
                  {semesterShortLabel(item)} - Đúng hạn: {onTime}
                </title>
              </rect>

              <rect
                x={centerX + 3}
                y={overdueY}
                width={barWidth}
                height={
                  height -
                  padding.bottom -
                  overdueY
                }
                rx="5"
                fill="#F27123"
              >
                <title>
                  {semesterShortLabel(item)} - Quá hạn: {overdue}
                </title>
              </rect>

              <text
                x={centerX}
                y={height - padding.bottom + 24}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#64748B"
              >
                {String(item.semesterName || "").replace(
                  /Học kỳ/gi,
                  "HK",
                )}
              </text>

              <text
                x={centerX}
                y={height - padding.bottom + 39}
                textAnchor="middle"
                fontSize="9"
                fill="#94A3B8"
              >
                {item.schoolYearName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useStudentDashboard();
  const context = data?.context;
  const today = new Date();
  const todayKey = toDateKey(today);

  const todayLessons = useMemo(
    () =>
      (data?.timetable?.lessons || [])
        .filter((lesson) => lesson.lessonDate === todayKey)
        .sort(
          (first, second) =>
            Number(first.periodNo || 0) -
            Number(second.periodNo || 0),
        ),
    [data, todayKey],
  );

  const pendingHomeworks = useMemo(
    () =>
      (data?.homeworkItems || [])
        .filter((homework) =>
          ["PENDING", "OVERDUE"].includes(
            homework.studentHomeworkStatus,
          ),
        )
        .sort((first, second) => {
          const firstDate =
            parseDate(first.dueDate)?.getTime() || 0;
          const secondDate =
            parseDate(second.dueDate)?.getTime() || 0;

          return firstDate - secondDate;
        })
        .slice(0, 4),
    [data],
  );

  const upcomingEvents = useMemo(
    () => (data?.upcomingEvents || []).slice(0, 3),
    [data],
  );

  const semesterAnalytics = data?.semesterAnalytics || [];

  if (
    import.meta.env.DEV &&
    !loading &&
    data &&
    !Array.isArray(data.semesterAnalytics)
  ) {
    console.warn(
      "Dashboard API chưa trả về semesterAnalytics. Hãy cập nhật students.js và khởi động lại backend.",
    );
  }

  const currentSemester = useMemo(
    () =>
      semesterAnalytics.find((item) => item.isCurrent) ||
      semesterAnalytics[semesterAnalytics.length - 1] ||
      null,
    [semesterAnalytics],
  );

  return (
    <StudentDashboardShell context={context}>
      <WelcomeBanner
        name={context?.fullName || user?.fullName || user?.username}
        message="Chúc bạn một ngày học tập hiệu quả."
      />

      {loading && (
        <LoadingState label="Đang tải bảng điều khiển học sinh..." />
      )}

      {!loading && error && (
        <ErrorAlert error={`Không tải được dashboard: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <section className="mb-4 grid gap-3 md:grid-cols-3">
            <StatCard
              icon={FiStar}
              label="Điểm thường xuyên"
              value={
                currentSemester?.regularScore == null
                  ? "—"
                  : `${formatScore(
                      currentSemester.regularScore,
                    )} / 10`
              }
              helper={
                currentSemester
                  ? semesterShortLabel(currentSemester)
                  : "Chưa có dữ liệu học kỳ"
              }
              iconClassName="bg-blue-50 text-blue-600"
            />

            <StatCard
              icon={FiCheckCircle}
              label="Điểm chuyên cần"
              value={
                currentSemester?.attendanceScore == null
                  ? "—"
                  : `${formatScore(
                      currentSemester.attendanceScore,
                    )} / 10`
              }
              helper={
                currentSemester
                  ? `${currentSemester.attendanceRecords || 0} bản ghi điểm danh`
                  : "Chưa có dữ liệu học kỳ"
              }
              iconClassName="bg-emerald-50 text-emerald-600"
            />

            <StatCard
              icon={FiFileText}
              label="Hoàn thành bài tập"
              value={`${currentSemester?.onTimeHomework || 0} đúng hạn`}
              helper={`${currentSemester?.overdueHomework || 0} quá hạn`}
              iconClassName="bg-orange-50 text-[#F27123]"
            />
          </section>

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                      <FiCalendar className="text-[#F27123]" />
                      Thời khóa biểu hôm nay
                    </h3>
                    <p className="mb-0 text-[10px] text-slate-400">
                      {formatLongDate(today)}
                    </p>
                  </div>

                  <Link
                    to="/student/timetable"
                    className="text-xs font-bold text-[#0F4C8A] no-underline hover:text-[#F27123]"
                  >
                    Xem toàn bộ
                  </Link>
                </div>

                {todayLessons.length > 0 ? (
                  <div>
                    {todayLessons.map((lesson) => (
                      <TodayLesson
                        key={lesson.timetableId}
                        lesson={lesson}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <FiBookOpen
                      className="mx-auto mb-3 text-slate-300"
                      size={28}
                    />
                    <p className="mb-0 text-sm font-semibold text-slate-500">
                      Hôm nay chưa có tiết học nào.
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                      <FiTrendingUp className="text-[#F27123]" />
                      Điểm theo từng học kỳ
                    </h3>
                  </div>

                  <ChartLegend
                    items={[
                      {
                        label: "Điểm thường xuyên",
                        color: "#0F4C8A",
                      },
                      {
                        label: "Điểm chuyên cần",
                        color: "#F27123",
                      },
                    ]}
                  />
                </div>

                <ScoreTrendChart data={semesterAnalytics} />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                      <FiFlag className="text-[#F27123]" />
                      Bài tập theo từng học kỳ
                    </h3>
                  </div>

                  <ChartLegend
                    items={[
                      {
                        label: "Đúng hạn",
                        color: "#0F4C8A",
                      },
                      {
                        label: "Quá hạn",
                        color: "#F27123",
                      },
                    ]}
                  />
                </div>

                <HomeworkSemesterChart data={semesterAnalytics} />
              </section>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="mb-0 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                    <FiCalendar className="text-[#F27123]" />
                    Sự kiện sắp tới
                  </h3>

                  <Link
                    to="/student/events"
                    className="text-[10px] font-bold text-[#0F4C8A] no-underline hover:text-[#F27123]"
                  >
                    Xem tất cả
                  </Link>
                </div>

                {upcomingEvents.length > 0 ? (
                  <div className="space-y-1">
                    {upcomingEvents.map((event) => (
                      <EventCard
                        key={event.eventId}
                        event={event}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mb-0 rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                    Chưa có sự kiện sắp tới.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="mb-0 flex items-center gap-2 text-sm font-extrabold text-[#0F2747]">
                    <FiFlag className="text-[#F27123]" />
                    Bài tập chưa nộp
                  </h3>

                  <Link
                    to="/student/homeworks"
                    className="text-[10px] font-bold text-[#0F4C8A] no-underline hover:text-[#F27123]"
                  >
                    Xem tất cả
                  </Link>
                </div>

                {pendingHomeworks.length > 0 ? (
                  <div className="space-y-3">
                    {pendingHomeworks.map((homework) => (
                      <HomeworkCard
                        key={homework.homeworkId}
                        homework={homework}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mb-0 rounded-xl bg-emerald-50 px-4 py-6 text-center text-xs font-semibold text-emerald-700">
                    Bạn đã hoàn thành tất cả bài tập.
                  </p>
                )}
              </section>
            </aside>
          </section>
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentDashboard;