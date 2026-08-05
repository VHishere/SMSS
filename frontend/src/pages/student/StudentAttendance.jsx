import { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiHome,
  FiInfo,
  FiSearch,
  FiSlash,
  FiUser,
  FiXCircle,
} from "react-icons/fi";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useStudentAttendance } from "../../hooks/useStudentAttendance";
import PrettySelect from "../../components/molecules/PrettySelect";

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const TYPE_CONFIG = {
  PRESENT: {
    label: "Hiện diện",
    shortLabel: "P",
    icon: FiCheckCircle,
    dotClass: "bg-emerald-500",
    lineClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700",
  },
  LATE: {
    label: "Đi muộn",
    shortLabel: "L",
    icon: FiClock,
    dotClass: "bg-orange-500",
    lineClass: "bg-orange-500",
    badgeClass: "bg-orange-50 text-orange-700",
  },
  ABSENT_EXCUSED: {
    label: "Vắng có phép",
    shortLabel: "P",
    icon: FiSlash,
    dotClass: "bg-blue-600",
    lineClass: "bg-blue-600",
    badgeClass: "bg-blue-50 text-blue-700",
  },
  ABSENT_UNEXCUSED: {
    label: "Vắng không phép",
    shortLabel: "A",
    icon: FiXCircle,
    dotClass: "bg-red-600",
    lineClass: "bg-red-600",
    badgeClass: "bg-red-50 text-red-700",
  },
  EARLY_LEAVE: {
    label: "Về sớm",
    shortLabel: "S",
    icon: FiClock,
    dotClass: "bg-violet-500",
    lineClass: "bg-violet-500",
    badgeClass: "bg-violet-50 text-violet-700",
  },
};

const CONTEXT_CONFIG = {
  CLASS: {
    label: "Lớp học",
    icon: FiBookOpen,
  },
  DORM: {
    label: "Ký túc xá",
    icon: FiHome,
  },
  SELF_STUDY: {
    label: "Tự học",
    icon: FiFileText,
  },
  EVENT: {
    label: "Sự kiện",
    icon: FiCalendar,
  },
};

const LEAVE_STATUS_CONFIG = {
  PENDING: {
    label: "Đang chờ duyệt",
    className: "bg-amber-50 text-amber-700",
  },
  APPROVED: {
    label: "Đã duyệt",
    className: "bg-emerald-50 text-emerald-700",
  },
  REJECTED: {
    label: "Bị từ chối",
    className: "bg-red-50 text-red-600",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "bg-slate-100 text-slate-600",
  },
};

const LEAVE_TYPE_LABELS = {
  SICK_LEAVE: "Nghỉ ốm",
  FAMILY_LEAVE: "Nghỉ việc gia đình",
  PERSONAL_LEAVE: "Nghỉ việc cá nhân",
  OTHER: "Lý do khác",
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function parseDateKey(value) {
  if (!value) return null;

  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCurrentMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
}

function getMonthStart(monthValue) {
  return `${monthValue}-01`;
}

function getMonthEnd(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return toDateKey(new Date(year, month, 0));
}

function addMonths(monthValue, amount) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatMonth(monthValue) {
  const [year, month] = monthValue.split("-");
  return `Tháng ${Number(month)}, ${year}`;
}

function formatDate(value) {
  const date = parseDateKey(value);
  if (!date) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value) {
  if (!value) return "—";

  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function parseApiDateTime(value) {
  if (!value) return null;

  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatApiDateTime(value) {
  const date = parseApiDateTime(value);
  if (!date) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatLeavePeriod(startValue, endValue) {
  const start = parseApiDateTime(startValue);
  const end = parseApiDateTime(endValue) || start;

  if (!start) return "Chưa cập nhật thời gian nghỉ";

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) {
    return `${dateFormatter.format(start)} · ${timeFormatter.format(
      start,
    )} - ${timeFormatter.format(end)}`;
  }

  return `${formatApiDateTime(startValue)} - ${formatApiDateTime(
    endValue,
  )}`;
}

function buildCalendar(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const mondayOffset = (firstDate.getDay() + 6) % 7;
  const calendarStart = new Date(year, month - 1, 1 - mondayOffset);
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);

    return {
      key: toDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1,
      isToday: toDateKey(date) === todayKey,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
}

function getTypeConfig(typeName) {
  return (
    TYPE_CONFIG[typeName] || {
      label: typeName || "Khác",
      shortLabel: "?",
      icon: FiInfo,
      dotClass: "bg-slate-400",
      lineClass: "bg-slate-400",
      badgeClass: "bg-slate-100 text-slate-600",
    }
  );
}

function getContextConfig(context) {
  return (
    CONTEXT_CONFIG[context] || {
      label: context || "Khác",
      icon: FiFileText,
    }
  );
}

function cleanNote(note) {
  if (!note) return "Chưa cập nhật";

  return String(note)
    .replace("[TEST_ATTENDANCE]", "")
    .replace("[TEST_TIMETABLE_ATTENDANCE]", "")
    .trim();
}

function groupByDate(items = []) {
  return items.reduce((result, item) => {
    if (!item.attendanceDate) return result;

    if (!result[item.attendanceDate]) {
      result[item.attendanceDate] = [];
    }

    result[item.attendanceDate].push(item);
    return result;
  }, {});
}

function countTypes(items = []) {
  return items.reduce((result, item) => {
    const key = item.typeName || "UNKNOWN";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  accentClass,
  valueClass = "text-[#1A1C1C]",
}) {
  return (
    <article
      className={`
        relative overflow-hidden rounded-3xl border card-border
        bg-white p-6 shadow-sm
      `}
    >
      <span
        className={`
          absolute left-0 top-0 h-full w-1.5
          ${accentClass}
        `}
      />

      {/* Cỡ chữ theo chuẩn thẻ tổng quan của teacher: nhãn 12px in hoa,
          số text-5xl (48px), chú thích 12px in nghiêng. */}
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[#584238]">
            {label}
          </p>
          <strong
            className={`block text-5xl font-bold leading-none tracking-tight ${valueClass}`}
          >
            {value}
          </strong>
          <p className="mb-0 mt-2 text-xs italic text-[#584238]">
            {helper}
          </p>
        </div>

        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-50 text-slate-400">
          <Icon size={20} />
        </span>
      </div>
    </article>
  );
}

function CalendarCell({
  day,
  records,
  selected,
  onSelect,
}) {
  const counts = countTypes(records);
  const typeEntries = Object.entries(counts);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative min-h-[78px] border-r border-t border-slate-200
        px-2 py-2 text-left transition
        ${selected ? "bg-blue-50 ring-2 ring-inset ring-[#0F4C8A]" : "bg-white"}
        ${day.isCurrentMonth ? "" : "bg-slate-50 text-slate-300"}
        hover:bg-orange-50/50
      `}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`
            grid h-7 w-7 place-items-center rounded-lg
            text-[11px] font-extrabold
            ${
              day.isToday
                ? "bg-[#0F4C8A] text-white"
                : day.isCurrentMonth
                  ? day.isWeekend
                    ? "text-slate-400"
                    : "text-[#0F2747]"
                  : "text-slate-300"
            }
          `}
        >
          {pad(day.day)}
        </span>

        {records.length > 0 && (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
            {records.length}
          </span>
        )}
      </div>

      {day.isToday && (
        <span className="mt-1 block text-[8px] font-bold italic text-[#0F4C8A]">
          Hôm nay
        </span>
      )}

      <div className="absolute bottom-2 left-2 right-2 space-y-1">
        {typeEntries.slice(0, 3).map(([typeName]) => {
          const config = getTypeConfig(typeName);

          return (
            <span
              key={typeName}
              className={`block h-1 rounded-full ${config.lineClass}`}
            />
          );
        })}
      </div>
    </button>
  );
}

function StatusLegend({
  summary,
}) {
  return (
    <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-extrabold text-[#0F2747]">
        Chú giải và trạng thái
      </h2>

      <div className="space-y-3">
        {Object.entries(TYPE_CONFIG).map(([typeName, config]) => (
          <div
            key={typeName}
            className="flex items-center justify-between gap-3"
          >
            <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-slate-600">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.dotClass}`} />
              <span className="truncate">
                {config.label} ({config.shortLabel})
              </span>
            </span>

            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${config.badgeClass}`}>
              {summary?.[typeName]?.count || 0} buổi
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentLeaveRequestCard({
  request,
}) {
  if (!request) {
    return (
      <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-extrabold text-[#0F2747]">
          Đơn nghỉ phép gần nhất
        </h2>

        <div className="rounded-xl bg-slate-50 px-4 py-5 text-center">
          <FiFileText className="mx-auto mb-2 text-slate-400" size={22} />
          <p className="mb-0 text-xs font-semibold leading-5 text-slate-500">
            Học sinh chưa có đơn nghỉ phép nào.
          </p>
        </div>
      </section>
    );
  }

  const status =
    LEAVE_STATUS_CONFIG[request.status] || {
      label: request.status || "Chưa cập nhật",
      className: "bg-slate-100 text-slate-600",
    };

  return (
    <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-sm font-extrabold text-[#0F2747]">
            Đơn nghỉ phép gần nhất
          </h2>
          <p className="mb-0 text-[10px] text-slate-400">
            Gửi lúc {formatApiDateTime(request.createdAt)}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-extrabold ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="mb-2 text-xs font-extrabold text-[#0F2747]">
          {LEAVE_TYPE_LABELS[request.leaveType] ||
            request.leaveType ||
            "Đơn xin nghỉ"}
        </p>

        <p className="mb-3 inline-flex items-start gap-2 text-[11px] leading-5 text-slate-500">
          <FiCalendar className="mt-0.5 shrink-0 text-[#F27123]" />
          <span>
            {formatLeavePeriod(
              request.startDate,
              request.endDate,
            )}
          </span>
        </p>

        <div className="rounded-lg bg-white px-3 py-3">
          <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
            Lý do nghỉ
          </p>
          <p className="mb-0 text-xs leading-5 text-slate-600">
            {request.reason || "Không có nội dung lý do."}
          </p>
        </div>

        {request.homeroomTeacherName && (
          <p className="mb-0 mt-3 inline-flex items-center gap-1.5 text-[10px] text-slate-400">
            <FiUser />
            GVCN: {request.homeroomTeacherName}
          </p>
        )}

        {request.attachmentFileUrl && (
          <a
            href={request.attachmentFileUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0F4C8A] no-underline hover:text-[#F27123]"
          >
            <FiFileText />
            {request.attachmentFileName || "Xem tệp đính kèm"}
          </a>
        )}
      </div>
    </section>
  );
}

function AttendanceTable({
  items,
  selectedDate,
}) {
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const subjectOptions = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => item.subjectName)
          .filter(Boolean),
      ),
    ).sort((first, second) => first.localeCompare(second, "vi"));
  }, [items]);

  const displayedItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSubject =
        !subjectFilter || item.subjectName === subjectFilter;
      const matchesStatus =
        !statusFilter || item.typeName === statusFilter;
      const matchesSearch =
        !keyword ||
        [
          item.subjectName,
          item.className,
          item.createdByName,
          cleanNote(item.note),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));

      return matchesSubject && matchesStatus && matchesSearch;
    });
  }, [items, search, statusFilter, subjectFilter]);

  return (
    <section className="mt-4 overflow-hidden rounded-3xl border card-border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="mb-1 text-sm font-extrabold text-[#0F2747]">
            Điểm danh ngày {formatDate(selectedDate)}
          </h2>
          <p className="mb-0 text-xs text-slate-500">
            Chọn một ngày trên lịch để xem các bản ghi tương ứng.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block sm:w-52">
            <FiSearch
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm môn, giáo viên..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <PrettySelect
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
            className="h-10 min-w-[170px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-[#0F2747] outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
          >
            <option value="">Tất cả môn học</option>
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </PrettySelect>

          <PrettySelect
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 min-w-[170px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-[#0F2747] outline-none transition focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </PrettySelect>
        </div>
      </div>

      {displayedItems.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="Không có bản ghi phù hợp"
            description="Thử đổi môn học, trạng thái hoặc từ khóa đang tìm."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse text-left">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Ngày</th>
                <th className="px-4 py-3">Môn học / ngữ cảnh</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người ghi nhận</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-5 py-3">Ghi chú</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {displayedItems.map((item, index) => {
                const type = getTypeConfig(item.typeName);
                const context = getContextConfig(item.context);
                const ContextIcon = context.icon;

                return (
                  <tr
                    key={item.attendanceId || `${item.attendanceDate}-${index}`}
                    className="transition hover:bg-orange-50/30"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold text-slate-600">
                      {formatDate(item.attendanceDate)}
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="mb-1 text-xs font-extrabold text-[#0F2747]">
                        {item.subjectName || item.className || context.label}
                      </p>
                      <p className="mb-0 inline-flex items-center gap-1.5 text-[10px] text-slate-400">
                        <ContextIcon />
                        {context.label}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">
                      {formatTime(item.checkInTime)}
                      {item.checkOutTime
                        ? ` - ${formatTime(item.checkOutTime)}`
                        : ""}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <FiUser className="text-slate-400" />
                        {item.createdByName || "Chưa cập nhật"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1.5 text-[10px] font-extrabold ${type.badgeClass}`}>
                        {type.label}
                      </span>
                    </td>

                    <td className="max-w-[260px] px-5 py-3.5">
                      <p className="mb-0 line-clamp-2 text-xs leading-5 text-slate-500">
                        {cleanNote(item.note)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StudentAttendance() {
  const currentMonth = getCurrentMonth();
  const todayKey = toDateKey(new Date());

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const filters = useMemo(
    () => ({
      startDate: getMonthStart(selectedMonth),
      endDate: getMonthEnd(selectedMonth),
      limit: 100,
    }),
    [selectedMonth],
  );

  const {
    history,
    analytics,
    leaveRequests,
    loading,
    error,
  } = useStudentAttendance(filters);

  const context = history?.context;
  const items = history?.items || [];
  const summary = analytics?.summary?.byType || {};

  const recordsByDate = useMemo(
    () => groupByDate(items),
    [items],
  );

  const calendarDays = useMemo(
    () => buildCalendar(selectedMonth),
    [selectedMonth],
  );

  const selectedRecords = recordsByDate[selectedDate] || [];

  const totalRecords = Number(analytics?.summary?.totalRecords || 0);
  const presentCount = Number(summary.PRESENT?.count || 0);
  const lateCount = Number(summary.LATE?.count || 0);
  const absentCount =
    Number(summary.ABSENT_EXCUSED?.count || 0) +
    Number(summary.ABSENT_UNEXCUSED?.count || 0);

  const presentRate =
    totalRecords > 0
      ? Math.round((presentCount / totalRecords) * 1000) / 10
      : 0;

  const latestLeaveRequest =
    leaveRequests?.items?.[0] || null;

  function updateMonth(nextMonth) {
    setSelectedMonth(nextMonth);

    if (nextMonth === currentMonth) {
      setSelectedDate(todayKey);
    } else {
      setSelectedDate(getMonthStart(nextMonth));
    }
  }

  function selectToday() {
    setSelectedMonth(currentMonth);
    setSelectedDate(todayKey);
  }

  return (
    <StudentDashboardShell context={context}>
      <section className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mb-1 text-2xl font-black text-[#0F2747]">
            Theo dõi điểm danh
          </h2>
        </div>
      </section>

      {loading && <LoadingState label="Đang tải dữ liệu điểm danh..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được điểm danh: ${error}`} />
      )}

      {!loading && !error && history && analytics && (
        <>
          <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Tổng số buổi"
              value={totalRecords}
              helper="Bản ghi trong tháng"
              icon={FiCalendar}
              accentClass="bg-[#0F4C8A]"
            />

            <SummaryCard
              label="Hiện diện"
              value={presentCount}
              helper={`${presentRate}% tổng số buổi`}
              icon={FiCheckCircle}
              accentClass="bg-emerald-500"
              valueClass="text-emerald-600"
            />

            <SummaryCard
              label="Đi muộn"
              value={lateCount}
              helper={lateCount > 0 ? "Cần lưu ý" : "Không có bản ghi"}
              icon={FiClock}
              accentClass="bg-orange-500"
              valueClass="text-orange-600"
            />

            <SummaryCard
              label="Vắng mặt"
              value={absentCount}
              helper={`${summary.ABSENT_UNEXCUSED?.count || 0} không phép`}
              icon={FiAlertCircle}
              accentClass="bg-red-600"
              valueClass="text-red-600"
            />
          </section>

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-hidden rounded-3xl border card-border bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <FiCalendar className="text-[#0F4C8A]" />
                  <h2 className="mb-0 text-sm font-extrabold text-[#0F2747]">
                    {formatMonth(selectedMonth)}
                  </h2>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => updateMonth(addMonths(selectedMonth, -1))}
                    className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-orange-50 hover:text-[#F27123]"
                    aria-label="Tháng trước"
                  >
                    <FiChevronLeft />
                  </button>

                  <button
                    type="button"
                    onClick={selectToday}
                    className="h-9 rounded-xl px-3 text-xs font-bold text-[#0F4C8A] transition hover:bg-blue-50"
                  >
                    Hôm nay
                  </button>

                  <button
                    type="button"
                    onClick={() => updateMonth(addMonths(selectedMonth, 1))}
                    className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-orange-50 hover:text-[#F27123]"
                    aria-label="Tháng sau"
                  >
                    <FiChevronRight />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[650px]">
                  <div className="grid grid-cols-7 bg-slate-50">
                    {WEEK_DAYS.map((day) => (
                      <div
                        key={day}
                        className="border-r border-slate-200 px-2 py-3 text-center text-[10px] font-extrabold uppercase text-slate-500 last:border-r-0"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 border-b border-l border-slate-200">
                    {calendarDays.map((day) => (
                      <CalendarCell
                        key={day.key}
                        day={day}
                        records={recordsByDate[day.key] || []}
                        selected={selectedDate === day.key}
                        onSelect={() => setSelectedDate(day.key)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-5">
              <StatusLegend summary={summary} />
              <RecentLeaveRequestCard request={latestLeaveRequest} />
            </aside>
          </section>

          <AttendanceTable
            key={selectedDate}
            items={selectedRecords}
            selectedDate={selectedDate}
          />
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentAttendance;