import { useMemo, useState } from "react";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiMapPin,
  FiImage,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";

import { studentApi } from "../../api/client";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import EmptyState from "../../components/molecules/EmptyState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";
import { useStudentEvents } from "../../hooks/useStudentEvents";

const STATUS_LABELS = {
  ACTIVE: "Đang mở đăng ký",
  PUBLISHED: "Đã công bố",
  SCHEDULED: "Sắp diễn ra",
  COMPLETED: "Đã kết thúc",
  DONE: "Đã kết thúc",
  CANCELLED: "Đã hủy",
};

const STATUS_STYLES = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PUBLISHED: "bg-blue-50 text-blue-700",
  SCHEDULED: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-slate-100 text-slate-600",
  DONE: "bg-slate-100 text-slate-600",
  CANCELLED: "bg-red-50 text-red-700",
};

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function parseApiDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  const matched = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );

  if (!matched) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = matched;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function toDateKey(value) {
  const date = value instanceof Date ? value : parseApiDate(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const date = parseApiDate(value);
  if (!date) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value) {
  const date = parseApiDate(value);
  if (!date) return "--:--";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value) {
  const date = parseApiDate(value);
  if (!date) return { day: "--", month: "---" };

  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: `TH${date.getMonth() + 1}`,
  };
}

function EventCover({ event, alt = "", className = "" }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = event?.imageUrl || event?.coverImageUrl || "";

  if (!imageUrl || failed) {
    return (
      <div
        className={`grid place-items-center bg-gradient-to-br from-[#0F4C8A] via-[#225DAD] to-[#F27123] ${className}`}
        role="img"
        aria-label={alt || "Sự kiện chưa có ảnh"}
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur-sm">
          <FiImage size={23} />
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function getCalendarDays(year, month) {
  const firstDate = new Date(year, month, 1);
  const mondayOffset = (firstDate.getDay() + 6) % 7;
  const calendarStart = new Date(year, month, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    return day;
  });
}

function EventCalendar({ events, selectedDate, onSelectDate }) {
  const initialEventDate = parseApiDate(events[0]?.startDate) || new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(initialEventDate.getFullYear(), initialEventDate.getMonth(), 1),
  );

  const days = useMemo(
    () => getCalendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );

  const eventDates = useMemo(
    () => new Set(events.map((event) => toDateKey(event.startDate)).filter(Boolean)),
    [events],
  );

  function moveMonth(offset) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2 px-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="Tháng trước"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-orange-50 hover:text-[#F27123]"
        >
          <FiChevronLeft size={16} />
        </button>

        <h4 className="mb-0 text-center text-sm font-extrabold text-[#0F2747]">
          Tháng {visibleMonth.getMonth() + 1}
        </h4>

        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="Tháng sau"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-orange-50 hover:text-[#F27123]"
        >
          <FiChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEK_DAYS.map((day) => (
          <span key={day} className="pb-1 text-[10px] font-bold text-slate-400">
            {day}
          </span>
        ))}

        {days.map((day) => {
          const dateKey = toDateKey(day);
          const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
          const hasEvent = eventDates.has(dateKey);
          const isSelected = selectedDate === dateKey;
          const isToday = dateKey === toDateKey(new Date());

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(isSelected ? "" : dateKey)}
              className={`relative mx-auto grid h-8 w-8 place-items-center rounded-lg text-[11px] font-bold transition ${isSelected
                ? "bg-[#F27123] text-white shadow-sm"
                : isToday
                  ? "bg-orange-100 text-[#F27123]"
                  : isCurrentMonth
                    ? "text-slate-700 hover:bg-slate-100"
                    : "text-slate-300"
                }`}
            >
              {day.getDate()}
              {hasEvent && !isSelected && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#F27123]" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function UpcomingEventItem({ event }) {
  const date = formatShortDate(event.startDate);

  return (
    <Link
      to={`/student/events/${event.eventId}`}
      className="group flex items-center gap-3 rounded-xl border border-transparent bg-slate-50 p-3 no-underline transition hover:border-orange-200 hover:bg-orange-50"
    >
      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-[#0F2747] text-white">
        <strong className="text-sm leading-none">{date.day}</strong>
        <small className="mt-1 text-[9px] font-bold uppercase text-white/70">
          {date.month}
        </small>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-extrabold text-[#0F2747] group-hover:text-[#F27123]">
          {event.title}
        </span>
        <span className="mt-1 block truncate text-[10px] text-slate-500">
          {formatTime(event.startDate)} · {event.location || "Chưa cập nhật"}
        </span>
      </span>
    </Link>
  );
}

function EventFeatureCard({ event, onRegistered }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const registeredCount = Number(event.registeredCount || 0);
  const capacity = event.capacity ? Number(event.capacity) : null;
  const isFull = Boolean(capacity && registeredCount >= capacity);
  const detailPath = `/student/events/${event.eventId}`;

  const canRegister =
    ["ACTIVE", "PUBLISHED", "SCHEDULED"].includes(event.status) &&
    !event.isRegistered &&
    !isFull;

  function openDetail() {
    navigate(detailPath);
  }

  function handleCardKeyDown(keyboardEvent) {
    const interactiveElement = keyboardEvent.target.closest(
      "button, a, input, textarea, select",
    );

    if (interactiveElement) return;

    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      openDetail();
    }
  }

  async function register() {
    setSubmitting(true);
    setError("");

    try {
      await studentApi.registerMyEvent(event.eventId);
      onRegistered();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={handleCardKeyDown}
      className="
        group cursor-pointer overflow-hidden rounded-2xl
        border border-slate-200 bg-white shadow-sm
        transition hover:-translate-y-0.5 hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-orange-200
      "
      aria-label={`Xem chi tiết sự kiện ${event.title}`}
    >
      <div className="relative h-44 overflow-hidden">
        <EventCover
          event={event}
          alt={event.title}
          className="
            h-full w-full object-cover transition duration-500
            group-hover:scale-105
          "
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />

        <span className="absolute left-3 top-3 rounded-full bg-[#F27123] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm">
          {event.eventType || event.category || "Sự kiện"}
        </span>

        <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#0F2747] shadow-sm">
          <FiClock className="mr-1 inline" />
          {formatTime(event.startDate)}
        </span>
      </div>

      <div className="p-4">
        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[#F27123]">
          {event.className || "Toàn trường"}
        </p>

        <h3 className="mb-0 line-clamp-2 text-base font-extrabold leading-6 text-[#0F2747] transition group-hover:text-[#F27123]">
          {event.title}
        </h3>

        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
          {event.description ||
            "Thông tin chi tiết về sự kiện sẽ được cập nhật sớm."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <FiCalendar className="text-[#F27123]" />
            {formatDate(event.startDate)}
          </span>

          <span className="inline-flex min-w-0 items-center gap-1.5">
            <FiUsers className="shrink-0 text-[#F27123]" />
            {registeredCount}
            {capacity ? `/${capacity}` : ""} tham gia
          </span>
        </div>

        {error && <p className="mb-0 mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
              event.isRegistered
                ? "bg-emerald-50 text-emerald-700"
                : STATUS_STYLES[event.status] ||
                  "bg-slate-100 text-slate-600"
            }`}
          >
            {event.isRegistered
              ? "Đã đăng ký"
              : STATUS_LABELS[event.status] || event.status}
          </span>

          {event.isRegistered ? (
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                openDetail();
              }}
              className="
                inline-flex h-9 items-center justify-center gap-1.5
                rounded-xl bg-[#0F2747] px-4 text-xs font-bold
                text-white transition hover:bg-[#173d6c]
              "
            >
              Xem chi tiết
              <FiArrowRight />
            </button>
          ) : (
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                register();
              }}
              disabled={!canRegister || submitting}
              className={`inline-flex h-9 items-center justify-center rounded-xl px-4 text-xs font-bold text-white transition ${
                canRegister
                  ? "bg-[#F27123] hover:bg-[#d95f17]"
                  : "cursor-not-allowed bg-slate-300"
              }`}
            >
              {isFull
                ? "Đã đủ chỗ"
                : submitting
                  ? "Đang đăng ký..."
                  : "Đăng ký ngay"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function CompactEventCard({ event }) {
  const date = formatShortDate(event.startDate);

  return (
    <Link
      to={`/student/events/${event.eventId}`}
      className="group grid grid-cols-[58px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3 no-underline shadow-sm transition hover:border-orange-200 hover:shadow-md"
    >
      <span className="relative flex min-h-16 flex-col items-center justify-center overflow-hidden rounded-xl text-white">
        <EventCover
          event={event}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute inset-0 bg-[#0F2747]/65" />
        <strong className="relative text-lg leading-none">{date.day}</strong>
        <small className="relative mt-1 text-[9px] font-bold uppercase">
          {date.month}
        </small>
      </span>

      <span className="min-w-0 self-center">
        <span className="line-clamp-2 text-xs font-extrabold leading-5 text-[#0F2747] group-hover:text-[#F27123]">
          {event.title}
        </span>
        <span className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
          <FiMapPin className="shrink-0 text-[#F27123]" />
          <span className="truncate">{event.location || "Chưa cập nhật"}</span>
        </span>
      </span>
    </Link>
  );
}

function RegisteredEventsTable({ events }) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-[#0F2747]">
            <FiCheckCircle className="text-[#F27123]" />
            Sự kiện đã đăng ký
          </h2>
          <p className="mb-0 text-xs text-slate-500">
            Theo dõi các sự kiện bạn đã đăng ký tham gia.
          </p>
        </div>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#F27123]">
          {events.length} sự kiện
        </span>
      </div>

      {events.length === 0 ? (
        <p className="m-4 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Bạn chưa đăng ký sự kiện nào.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-left">
            <thead className="bg-slate-100 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Tên sự kiện</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Địa điểm</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {events.map((event) => (
                <tr key={event.eventId} className="transition hover:bg-orange-50/40">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <EventCover
                        event={event}
                        alt=""
                        className="h-9 w-9 rounded-lg object-cover"
                      />
                      <span className="max-w-[260px] font-bold text-[#0F2747]">
                        {event.title}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    {formatDate(event.startDate)} · {formatTime(event.startDate)}
                  </td>
                  <td className="max-w-[210px] px-4 py-3.5">
                    <span className="line-clamp-2">
                      {event.location || "Chưa cập nhật"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      Đã đăng ký
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      to={`/student/events/${event.eventId}`}
                      className="inline-flex items-center gap-1 font-bold text-[#0F2747] no-underline hover:text-[#F27123]"
                    >
                      Chi tiết
                      <FiArrowRight />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StudentEvents() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useMemo(() => ({ search: search.trim() }), [search]);
  const { data, loading, error } = useStudentEvents(filters, refreshKey);

  const events = data?.events || [];
  const registeredEvents = useMemo(
    () => events.filter((event) => event.isRegistered),
    [events],
  );

  const displayedEvents = useMemo(() => {
    let result = viewMode === "registered" ? registeredEvents : events;

    if (selectedDate) {
      result = result.filter((event) => toDateKey(event.startDate) === selectedDate);
    }

    return result;
  }, [events, registeredEvents, selectedDate, viewMode]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((event) => {
        const startDate = parseApiDate(event.startDate);
        return startDate && startDate >= now && event.status !== "CANCELLED";
      })
      .slice(0, 3);
  }, [events]);

  const featuredEvents = displayedEvents.slice(0, 2);
  const compactEvents = displayedEvents.slice(2, 5);

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <StudentDashboardShell context={data?.context}>
      <section
        className="
    mb-4 flex w-full flex-col gap-4
    rounded-2xl border border-slate-200 bg-white
    px-5 py-4 shadow-sm
    md:flex-row md:items-center md:justify-between
  "
      >
        {/* Góc trái: thanh tìm kiếm */}
        <label className="relative block w-full min-w-0 md:w-[400px]">
          <FiSearch
            className="
        pointer-events-none absolute left-3 top-1/2
        -translate-y-1/2 text-slate-400
      "
            size={15}
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm sự kiện, địa điểm..."
            className="
        h-10 w-full rounded-xl border border-slate-200
        bg-slate-50 pl-9 pr-3 text-xs text-slate-700
        outline-none transition placeholder:text-slate-400
        focus:border-orange-300 focus:bg-white
        focus:ring-2 focus:ring-orange-100
      "
          />
        </label>

        {/* Góc phải: bộ lọc sự kiện */}
        <div className="flex w-fit shrink-0 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${viewMode === "all"
              ? "bg-white text-[#F27123] shadow-sm"
              : "text-slate-500 hover:text-[#0F2747]"
              }`}
          >
            Tất cả sự kiện
          </button>

          <button
            type="button"
            onClick={() => setViewMode("registered")}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${viewMode === "registered"
              ? "bg-white text-[#F27123] shadow-sm"
              : "text-slate-500 hover:text-[#0F2747]"
              }`}
          >
            Sự kiện của tôi
          </button>
        </div>
      </section>

      {loading && <LoadingState label="Đang tải sự kiện..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được sự kiện: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-5">
              <EventCalendar
                events={events}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="mb-0 !text-sm !leading-5 font-extrabold uppercase tracking-wide text-slate-500">
                    Sự kiện sắp tới
                  </h2>
                </div>

                <div className="space-y-2">
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.map((event) => (
                      <UpcomingEventItem key={event.eventId} event={event} />
                    ))
                  ) : (
                    <p className="mb-0 rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">
                      Chưa có sự kiện sắp tới.
                    </p>
                  )}
                </div>
              </section>
            </aside>

            <div className="min-w-0 space-y-4">
              {displayedEvents.length === 0 ? (
                <EmptyState
                  title="Không tìm thấy sự kiện"
                  description="Thử đổi từ khóa, ngày được chọn hoặc chế độ hiển thị."
                />
              ) : (
                <>
                  <section className="grid gap-4 lg:grid-cols-2">
                    {featuredEvents.map((event, index) => (
                      <EventFeatureCard
                        key={event.eventId}
                        event={event}
                        onRegistered={refresh}
                      />
                    ))}
                  </section>

                  {compactEvents.length > 0 && (
                    <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {compactEvents.map((event, index) => (
                        <CompactEventCard
                          key={event.eventId}
                          event={event}
                        />
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
          </div>

          <RegisteredEventsTable events={registeredEvents} />
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentEvents;