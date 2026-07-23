import {
  useMemo,
  useState,
} from "react";

import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiHome,
  FiSlash,
  FiUser,
  FiXCircle,
} from "react-icons/fi";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";

import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

import { useStudentAttendance } from "../../hooks/useStudentAttendance";
import { formatDate } from "../../utils/dateFormat";

const WEEK_DAYS = [
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "CN",
];

const TYPE_CONFIG = {
  PRESENT: {
    label: "Có mặt",
    icon: FiCheckCircle,
    dotClass: "bg-green-500",
    textClass: "text-green-700",
    bgClass: "bg-green-50",
    pillClass: "bg-green-50 text-green-700 border-green-100",
  },

  LATE: {
    label: "Đi muộn",
    icon: FiClock,
    dotClass: "bg-orange-500",
    textClass: "text-orange-700",
    bgClass: "bg-orange-50",
    pillClass: "bg-orange-50 text-orange-700 border-orange-100",
  },

  ABSENT_EXCUSED: {
    label: "Vắng có phép",
    icon: FiSlash,
    dotClass: "bg-blue-500",
    textClass: "text-blue-700",
    bgClass: "bg-blue-50",
    pillClass: "bg-blue-50 text-blue-700 border-blue-100",
  },

  ABSENT_UNEXCUSED: {
    label: "Vắng không phép",
    icon: FiXCircle,
    dotClass: "bg-red-500",
    textClass: "text-red-700",
    bgClass: "bg-red-50",
    pillClass: "bg-red-50 text-red-700 border-red-100",
  },

  EARLY_LEAVE: {
    label: "Về sớm",
    icon: FiClock,
    dotClass: "bg-purple-500",
    textClass: "text-purple-700",
    bgClass: "bg-purple-50",
    pillClass: "bg-purple-50 text-purple-700 border-purple-100",
  },
};

const CONTEXT_CONFIG = {
  CLASS: {
    label: "Lớp học",
    icon: FiBookOpen,
    className: "bg-blue-50 text-[#08509F]",
  },

  DORM: {
    label: "Ký túc xá",
    icon: FiHome,
    className: "bg-purple-50 text-purple-700",
  },

  SELF_STUDY: {
    label: "Tự học",
    icon: FiFileText,
    className: "bg-green-50 text-green-700",
  },

  EVENT: {
    label: "Sự kiện",
    icon: FiCalendar,
    className: "bg-orange-50 text-[#C94F00]",
  },
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function toISO(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function getMonthStart(monthValue) {
  return `${monthValue}-01`;
}

function getMonthEnd(monthValue) {
  const [year, month] = monthValue
    .split("-")
    .map(Number);

  const endDate = new Date(year, month, 0);

  return toISO(endDate);
}

function addMonths(monthValue, amount) {
  const [year, month] = monthValue
    .split("-")
    .map(Number);

  const next = new Date(year, month - 1 + amount, 1);

  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
}

function formatMonth(monthValue) {
  const [year, month] = monthValue.split("-");

  return `Tháng ${Number(month)}/${year}`;
}

function buildMonthCalendar(monthValue) {
  const [year, month] = monthValue
    .split("-")
    .map(Number);

  const firstDate = new Date(year, month - 1, 1);
  const firstDay = firstDate.getDay();
  const offsetToMonday = firstDay === 0 ? 6 : firstDay - 1;

  const gridStart = new Date(firstDate);
  gridStart.setDate(firstDate.getDate() - offsetToMonday);

  const todayText = toISO(new Date());
  const days = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const dateText = toISO(date);

    days.push({
      date: dateText,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === firstDate.getMonth(),
      isToday: dateText === todayText,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  return days;
}

function getTypeConfig(typeName) {
  return (
    TYPE_CONFIG[typeName] || {
      label: typeName || "Khác",
      icon: FiClock,
      dotClass: "bg-slate-400",
      textClass: "text-slate-600",
      bgClass: "bg-slate-50",
      pillClass: "bg-slate-50 text-slate-600 border-slate-100",
    }
  );
}

function getContextConfig(context) {
  return (
    CONTEXT_CONFIG[context] || {
      label: context || "Khác",
      icon: FiFileText,
      className: "bg-slate-50 text-slate-600",
    }
  );
}

function cleanNote(note) {
  if (!note) return "Không có ghi chú";

  return note
    .replace("[TEST_ATTENDANCE]", "")
    .replace("[TEST_TIMETABLE_ATTENDANCE]", "")
    .trim();
}

function countByType(records = []) {
  return records.reduce((result, item) => {
    const key = item.typeName || "UNKNOWN";

    result[key] = (result[key] || 0) + 1;

    return result;
  }, {});
}

function countByContext(items = []) {
  return items.reduce((result, item) => {
    const key = item.context || "UNKNOWN";

    result[key] = (result[key] || 0) + 1;

    return result;
  }, {});
}

function groupRecordsByDate(items = []) {
  return items.reduce((map, item) => {
    const date = item.attendanceDate;

    if (!date) return map;

    if (!map[date]) {
      map[date] = [];
    }

    map[date].push(item);

    return map;
  }, {});
}

function groupRecordsByContext(records = []) {
  const order = [
    "CLASS",
    "DORM",
    "SELF_STUDY",
    "EVENT",
  ];

  const grouped = records.reduce((map, record) => {
    const key = record.context || "UNKNOWN";

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(record);

    return map;
  }, {});

  const knownGroups = order
    .filter((context) => grouped[context])
    .map((context) => ({
      context,
      records: grouped[context],
    }));

  const otherGroups = Object.keys(grouped)
    .filter((context) => !order.includes(context))
    .map((context) => ({
      context,
      records: grouped[context],
    }));

  return [
    ...knownGroups,
    ...otherGroups,
  ];
}

function filterRecordsByContext(items = [], selectedContext) {
  if (!selectedContext) return items;

  return items.filter(
    (item) => item.context === selectedContext,
  );
}

function CompactCalendarDay({
  day,
  records = [],
  selected,
  onClick,
}) {
  const counts = countByType(records);
  const typeEntries = Object.entries(counts);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group flex h-[76px] flex-col
        rounded-xl border px-2.5 py-2
        text-left transition duration-200
        hover:-translate-y-0.5 hover:shadow-md
        ${
          selected
            ? "border-[#F27123] bg-[#FFF7F2] ring-2 ring-orange-100"
            : "border-slate-100 bg-white hover:border-orange-100"
        }
        ${
          !day.isCurrentMonth
            ? "opacity-35"
            : ""
        }
      `}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`
            flex h-7 w-7 items-center justify-center
            rounded-full text-xs font-bold
            ${
              day.isToday
                ? "bg-[#F27123] text-white"
                : selected
                  ? "bg-white text-[#F27123]"
                  : day.isWeekend
                    ? "bg-slate-100 text-slate-500"
                    : "bg-blue-50 text-[#08509F]"
            }
          `}
        >
          {day.dayNumber}
        </span>

        {records.length > 0 && (
          <span
            className="
              rounded-full bg-[#0F2747]
              px-2 py-0.5 text-[10px]
              font-bold text-white
            "
          >
            {records.length}
          </span>
        )}
      </div>

      {records.length > 0 ? (
        <div className="mt-auto flex flex-wrap gap-1">
          {typeEntries.slice(0, 4).map(([typeName]) => {
            const config = getTypeConfig(typeName);

            return (
              <span
                key={typeName}
                className={`
                  h-2 w-2 rounded-full
                  ${config.dotClass}
                `}
              />
            );
          })}
        </div>
      ) : (
        <p className="mt-auto mb-0 truncate text-[10px] text-slate-300">
          Không có
        </p>
      )}
    </button>
  );
}

function AttendanceFilterBar({
  selectedMonth,
  selectedContext,
  items = [],
  onMonthChange,
  onContextChange,
}) {
  const contextCounts = countByContext(items);

  return (
    <div className="mb-6 flex justify-end">
      <div className="flex flex-wrap items-center justify-end gap-5">
        <div className="flex items-center gap-3">
          <label className="mb-0 text-sm font-medium text-slate-500">
            Tháng
          </label>

          <div
            className="
              flex items-center overflow-hidden
              rounded-xl border border-slate-200
              bg-white shadow-sm
            "
          >
            <button
              type="button"
              onClick={() =>
                onMonthChange(addMonths(selectedMonth, -1))
              }
              className="
                flex h-11 w-11 items-center
                justify-center text-slate-500
                transition hover:bg-orange-50
              "
            >
              <FiChevronLeft size={18} />
            </button>

            <input
              type="month"
              value={selectedMonth}
              onChange={(event) =>
                onMonthChange(event.target.value)
              }
              className="
                h-11 border-x border-slate-200
                bg-white px-4 text-sm
                font-bold text-[#0F2747]
                outline-none
              "
            />

            <button
              type="button"
              onClick={() =>
                onMonthChange(addMonths(selectedMonth, 1))
              }
              className="
                flex h-11 w-11 items-center
                justify-center text-slate-500
                transition hover:bg-orange-50
              "
            >
              <FiChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label
            htmlFor="attendance-context-filter"
            className="mb-0 text-sm font-medium text-slate-500"
          >
            Ngữ cảnh
          </label>

          <select
            id="attendance-context-filter"
            value={selectedContext}
            onChange={(event) =>
              onContextChange(event.target.value)
            }
            className="
              h-11 min-w-[230px]
              rounded-xl border border-slate-200
              bg-white px-4 text-sm
              font-bold text-[#0F2747]
              shadow-sm outline-none transition
              hover:border-orange-200
              focus:border-[#F27123]
              focus:ring-4 focus:ring-orange-100
            "
          >
            <option value="">
              Tất cả ngữ cảnh ({items.length})
            </option>

            <option value="CLASS">
              Lớp học ({contextCounts.CLASS || 0})
            </option>

            <option value="DORM">
              Ký túc xá ({contextCounts.DORM || 0})
            </option>

            <option value="SELF_STUDY">
              Tự học ({contextCounts.SELF_STUDY || 0})
            </option>

            <option value="EVENT">
              Sự kiện ({contextCounts.EVENT || 0})
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}

function AttendanceMiniDetailCard({
  record,
}) {
  const typeConfig = getTypeConfig(record.typeName);
  const contextConfig = getContextConfig(record.context);

  const TypeIcon = typeConfig.icon;
  const ContextIcon = contextConfig.icon;

  const title =
    record.subjectName ||
    record.className ||
    "Chưa có lớp / môn";

  return (
    <article
      className="
        rounded-2xl border border-slate-100
        bg-white p-4 shadow-sm
      "
    >
      <div className="flex gap-3">
        <div
          className={`
            flex h-10 w-10 shrink-0
            items-center justify-center
            rounded-xl
            ${typeConfig.bgClass}
            ${typeConfig.textClass}
          `}
        >
          <TypeIcon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-2">
            <span
              className={`
                inline-flex rounded-full border px-2.5 py-1
                text-xs font-bold
                ${typeConfig.pillClass}
              `}
            >
              {typeConfig.label}
            </span>

            <span
              className={`
                inline-flex items-center gap-1.5
                rounded-full px-2.5 py-1
                text-xs font-bold
                ${contextConfig.className}
              `}
            >
              <ContextIcon size={12} />
              {contextConfig.label}
            </span>
          </div>

          <h3 className="mb-1 truncate text-base font-bold text-[#0F2747]">
            {title}
          </h3>

          <p className="mb-0 flex items-center gap-1.5 text-sm text-slate-500">
            <FiUser
              size={14}
              className="shrink-0 text-slate-400"
            />

            <span className="truncate">
              {record.createdByName || "Chưa cập nhật"}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-[#FFF7F2] px-3 py-2">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#F27123]">
          Ghi chú
        </p>

        <p className="mb-0 text-sm text-slate-600">
          {cleanNote(record.note)}
        </p>
      </div>
    </article>
  );
}

function AttendanceDetailPanel({
  selectedDate,
  records = [],
}) {
  const groupedByContext = groupRecordsByContext(records);

  return (
    <aside
      className="
        rounded-3xl border border-orange-100
        bg-white p-5 shadow-sm
      "
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#F27123]">
            Chi tiết ngày
          </p>

          <h2 className="mb-1 text-2xl font-bold text-[#0F2747]">
            {formatDate(selectedDate)}
          </h2>

          <p className="mb-0 text-sm text-slate-500">
            {records.length} bản ghi
          </p>
        </div>

        <div
          className="
            flex h-12 w-12 items-center
            justify-center rounded-2xl
            bg-[#FFF7F2] text-[#F27123]
          "
        >
          <FiCalendar size={22} />
        </div>
      </div>

      {records.length === 0 ? (
        <div
          className="
            rounded-2xl border border-dashed
            border-slate-200 bg-slate-50
            px-5 py-10 text-center
          "
        >
          <p className="mb-2 text-base font-bold text-[#0F2747]">
            Không có bản ghi
          </p>

          <p className="mb-0 text-sm text-slate-500">
            Ngày này không có dữ liệu theo ngữ cảnh đang chọn.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {groupedByContext.map((group) => {
            const config = getContextConfig(group.context);
            const Icon = config.icon;

            return (
              <section key={group.context}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`
                      inline-flex h-7 w-7
                      items-center justify-center
                      rounded-full
                      ${config.className}
                    `}
                  >
                    <Icon size={14} />
                  </span>

                  <h3 className="mb-0 text-sm font-bold text-[#0F2747]">
                    {config.label}
                  </h3>

                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                    {group.records.length}
                  </span>
                </div>

                <div className="grid gap-3">
                  {group.records.map((record, index) => (
                    <AttendanceMiniDetailCard
                      key={record.attendanceId || index}
                      record={record}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function StudentAttendance() {
  const currentMonth = getCurrentMonth();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [selectedDate, setSelectedDate] = useState(
    toISO(new Date()),
  );

  const [selectedContext, setSelectedContext] = useState("");

  const [filters, setFilters] = useState({
    startDate: getMonthStart(currentMonth),
    endDate: getMonthEnd(currentMonth),
  });

  const {
    history,
    loading,
    error,
  } = useStudentAttendance(filters);

  const context = history?.context;
  const allItems = history?.items || [];

  const items = useMemo(
    () => filterRecordsByContext(allItems, selectedContext),
    [
      allItems,
      selectedContext,
    ],
  );

  const recordsByDate = useMemo(
    () => groupRecordsByDate(items),
    [items],
  );

  const calendarDays = useMemo(
    () => buildMonthCalendar(selectedMonth),
    [selectedMonth],
  );

  const selectedRecords =
    recordsByDate[selectedDate] || [];

  function updateMonth(nextMonth) {
    setSelectedMonth(nextMonth);

    const startDate = getMonthStart(nextMonth);
    const endDate = getMonthEnd(nextMonth);

    setSelectedDate(startDate);

    setFilters({
      startDate,
      endDate,
    });
  }

  function updateContext(value) {
    setSelectedContext(value);
  }

  return (
    <StudentDashboardShell context={context}>
      <AttendanceFilterBar
        selectedMonth={selectedMonth}
        selectedContext={selectedContext}
        items={allItems}
        onMonthChange={updateMonth}
        onContextChange={updateContext}
      />

      {loading && (
        <LoadingState label="Đang tải lịch sử điểm danh..." />
      )}

      {!loading && error && (
        <ErrorAlert error={`Không tải được điểm danh: ${error}`} />
      )}

      {!loading && !error && (
        <section
          className="
            grid gap-6 xl:grid-cols-[0.9fr_1.1fr]
          "
        >
          <div
            className="
              rounded-3xl border border-orange-100
              bg-white p-5 shadow-sm
            "
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#F27123]">
                  Lịch sử điểm danh
                </p>

                <h2 className="mb-0 text-xl font-bold text-[#0F2747]">
                  {formatMonth(selectedMonth)}
                </h2>
              </div>

              <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Có mặt
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Đi muộn
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Vắng
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="mb-2 grid grid-cols-7 gap-2">
                  {WEEK_DAYS.map((day) => (
                    <div
                      key={day}
                      className="
                        rounded-xl bg-[#0F2747]
                        px-2 py-2 text-center
                        text-xs font-bold text-white
                      "
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => (
                    <CompactCalendarDay
                      key={day.date}
                      day={day}
                      records={recordsByDate[day.date] || []}
                      selected={selectedDate === day.date}
                      onClick={() => setSelectedDate(day.date)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <AttendanceDetailPanel
            selectedDate={selectedDate}
            records={selectedRecords}
          />
        </section>
      )}
    </StudentDashboardShell>
  );
}

export default StudentAttendance;