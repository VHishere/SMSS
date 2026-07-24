import { useEffect, useMemo, useState } from "react";
import {
    FiArrowLeft,
    FiArrowRight,
    FiBookOpen,
    FiCalendar,
    FiCheckCircle,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
    FiMapPin,
    FiTag,
    FiUser,
    FiUsers,
} from "react-icons/fi";
import { Link, useNavigate, useParams } from "react-router-dom";

import { studentApi } from "../../api/client";
import ErrorAlert from "../../components/atoms/ErrorAlert";
import LoadingState from "../../components/atoms/LoadingState";
import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

const EVENT_STATUS = {
    ACTIVE: {
        label: "Đang mở đăng ký",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    PUBLISHED: {
        label: "Đã công bố",
        className: "bg-blue-50 text-blue-700 ring-blue-200",
    },
    SCHEDULED: {
        label: "Sắp diễn ra",
        className: "bg-amber-50 text-amber-700 ring-amber-200",
    },
    COMPLETED: {
        label: "Đã kết thúc",
        className: "bg-slate-100 text-slate-600 ring-slate-200",
    },
    DONE: {
        label: "Đã kết thúc",
        className: "bg-slate-100 text-slate-600 ring-slate-200",
    },
    CANCELLED: {
        label: "Đã hủy",
        className: "bg-red-50 text-red-700 ring-red-200",
    },
};

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function parseApiDate(value) {
    if (!value) {
        return null;
    }

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

function startOfDay(date) {
    if (!date) {
        return null;
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(left, right) {
    return Boolean(
        left &&
        right &&
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate(),
    );
}

function formatDate(value) {
    const date = parseApiDate(value);

    if (!date) {
        return "Chưa cập nhật";
    }

    return new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

function formatTime(value) {
    const date = parseApiDate(value);

    if (!date) {
        return "--:--";
    }

    return new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatCompactDate(value) {
    const date = parseApiDate(value);

    if (!date) {
        return "--/--";
    }

    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
    }).format(date);
}

function formatDateRange(startValue, endValue) {
    const start = parseApiDate(startValue);
    const end = parseApiDate(endValue) || start;

    if (!start) {
        return "Chưa cập nhật thời gian";
    }

    if (sameDay(start, end)) {
        return `${formatTime(start)} - ${formatTime(end)}, ${formatDate(start)}`;
    }

    return `${formatTime(start)}, ${formatDate(start)} - ${formatTime(end)}, ${formatDate(end)}`;
}

function getCalendarDays(year, month) {
    const firstDate = new Date(year, month, 1);
    const mondayFirstOffset = (firstDate.getDay() + 6) % 7;
    const calendarStart = new Date(year, month, 1 - mondayFirstOffset);

    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + index);
        return date;
    });
}

function EventRangeCalendar({ startDate, endDate }) {
    const start = useMemo(() => parseApiDate(startDate), [startDate]);
    const end = useMemo(
        () => parseApiDate(endDate) || start,
        [endDate, start],
    );

    const [visibleMonth, setVisibleMonth] = useState(() => {
        const initial = start || new Date();
        return new Date(initial.getFullYear(), initial.getMonth(), 1);
    });

    useEffect(() => {
        if (start) {
            setVisibleMonth(new Date(start.getFullYear(), start.getMonth(), 1));
        }
    }, [start]);

    const days = useMemo(
        () => getCalendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()),
        [visibleMonth],
    );

    const rangeStart = startOfDay(start);
    const rangeEnd = startOfDay(end);

    function moveMonth(offset) {
        setVisibleMonth((current) =>
            new Date(current.getFullYear(), current.getMonth() + offset, 1),
        );
    }

    return (
        <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="mb-5 grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-3">
                <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    aria-label="Tháng trước"
                    className="
            grid h-9 w-9 place-items-center rounded-full
            border border-slate-200 bg-white text-slate-600
            transition
            hover:border-orange-300 hover:bg-orange-50 hover:text-[#F27123]
        "
                >
                    <FiChevronLeft size={17} />
                </button>

                <h3 className="mb-0 text-center text-lg font-extrabold text-[#0F2747]">
                    Tháng {visibleMonth.getMonth() + 1} {visibleMonth.getFullYear()}
                </h3>

                <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    aria-label="Tháng sau"
                    className="
            grid h-9 w-9 place-items-center rounded-full
            border border-slate-200 bg-white text-slate-600
            transition
            hover:border-orange-300 hover:bg-orange-50 hover:text-[#F27123]
        "
                >
                    <FiChevronRight size={17} />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-y-2 text-center">
                {WEEK_DAYS.map((day) => (
                    <span
                        key={day}
                        className="pb-1 text-[11px] font-bold uppercase text-slate-400"
                    >
                        {day}
                    </span>
                ))}

                {days.map((day) => {
                    const dayValue = startOfDay(day);
                    const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
                    const isInRange = Boolean(
                        rangeStart &&
                        rangeEnd &&
                        dayValue >= rangeStart &&
                        dayValue <= rangeEnd,
                    );
                    const isStart = sameDay(day, rangeStart);
                    const isEnd = sameDay(day, rangeEnd);

                    return (
                        <div
                            key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                            className="flex h-9 items-center justify-center"
                        >
                            <span
                                title={isInRange ? "Ngày diễn ra sự kiện" : undefined}
                                className={`
                  grid h-8 w-8 place-items-center rounded-lg text-xs font-bold
                  transition
                  ${isInRange
                                        ? "bg-[#F27123] text-white shadow-sm"
                                        : isCurrentMonth
                                            ? "text-slate-700"
                                            : "text-slate-300"
                                    }
                  ${isStart || isEnd
                                        ? "ring-2 ring-[#F27123] ring-offset-1"
                                        : ""
                                    }
                `}
                            >
                                {day.getDate()}
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function InformationItem({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#F27123] shadow-sm">
                <Icon size={18} />
            </span>
            <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold text-slate-400">{label}</p>
                <p className="mb-0 break-words text-sm font-bold leading-6 text-[#0F2747]">
                    {value || "Chưa cập nhật"}
                </p>
            </div>
        </div>
    );
}

function StudentEventDetail() {
    const { eventId } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [registering, setRegistering] = useState(false);
    const [registerError, setRegisterError] = useState("");

    async function loadEvent() {
        setLoading(true);
        setError("");

        try {
            const response = await studentApi.getMyEventDetail(eventId);
            setData(response.data);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadEvent();
    }, [eventId]);

    const event = data?.event;
    const relatedEvents = data?.relatedEvents || [];
    const eventStart = parseApiDate(event?.startDate);
    const eventEnd = parseApiDate(event?.endDate) || eventStart;
    const statusInfo = EVENT_STATUS[event?.status] || {
        label: event?.status || "Chưa cập nhật",
        className: "bg-slate-100 text-slate-600 ring-slate-200",
    };

    const registeredCount = Number(event?.registeredCount || 0);
    const capacity = event?.capacity ? Number(event.capacity) : null;
    const registrationPercent = capacity
        ? Math.min(100, Math.round((registeredCount / capacity) * 100))
        : null;

    const canRegister = Boolean(
        event &&
        ["ACTIVE", "PUBLISHED", "SCHEDULED"].includes(event.status) &&
        !event.isRegistered &&
        (!capacity || registeredCount < capacity),
    );

    async function register() {
        setRegistering(true);
        setRegisterError("");

        try {
            await studentApi.registerMyEvent(event.eventId);
            await loadEvent();
        } catch (requestError) {
            setRegisterError(requestError.message);
        } finally {
            setRegistering(false);
        }
    }

    return (
        <StudentDashboardShell context={data?.context}>
            <div className="mb-3 mt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => navigate("/student/events")}
                    className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-[#0F2747] shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-[#F27123]"
                >
                    <FiArrowLeft size={17} />
                    Quay lại
                </button>
            </div>

            {loading && <LoadingState label="Đang tải chi tiết sự kiện..." />}

            {!loading && error && (
                <ErrorAlert error={`Không tải được chi tiết sự kiện: ${error}`} />
            )}

            {!loading && !error && event && (
                <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]"><div className="min-w-0 space-y-5">
                    <article className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
                        <div className="relative min-h-[250px] overflow-hidden bg-gradient-to-br from-[#0F2747] via-[#134f83] to-[#F27123] p-6 text-white sm:p-8">
                            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
                            <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-orange-300/20" />
                            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />

                            <div className="relative flex min-h-[200px] flex-col justify-between">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-[#F27123] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] shadow-lg shadow-orange-950/10">
                                        <FiTag size={14} />
                                        {event.eventType || event.category || "Sự kiện"}
                                    </span>

                                    <span
                                        className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${statusInfo.className}`}
                                    >
                                        {statusInfo.label}
                                    </span>
                                </div>

                                <div className="max-w-3xl">
                                    <h2 className="mb-4 text-3xl font-black leading-tight sm:text-4xl">
                                        {event.title}
                                    </h2>

                                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/90">
                                        <span className="inline-flex items-center gap-2">
                                            <FiCalendar size={16} />
                                            {formatCompactDate(event.startDate)}
                                            {!sameDay(eventStart, eventEnd) &&
                                                ` - ${formatCompactDate(eventEnd)}`}
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                            <FiClock size={16} />
                                            {formatTime(event.startDate)} - {formatTime(event.endDate)}
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                            <FiMapPin size={16} />
                                            {event.location || "Chưa cập nhật địa điểm"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 sm:p-7">
                            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[#F27123]">
                                        Thông tin sự kiện
                                    </p>
                                    <h3 className="mb-0 text-2xl font-extrabold text-[#0F2747]">
                                        Nội dung chi tiết
                                    </h3>
                                </div>

                                {event.isRegistered && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
                                        <FiCheckCircle size={17} />
                                        Bạn đã đăng ký
                                    </span>
                                )}
                            </div>

                            <p className="mb-6 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">
                                {event.description || "Sự kiện chưa có mô tả chi tiết."}
                            </p>

                            <div className="grid gap-3 md:grid-cols-2">
                                <InformationItem
                                    icon={FiCalendar}
                                    label="Thời gian diễn ra"
                                    value={formatDateRange(event.startDate, event.endDate)}
                                />
                                <InformationItem
                                    icon={FiMapPin}
                                    label="Địa điểm"
                                    value={event.location}
                                />
                                <InformationItem
                                    icon={FiUser}
                                    label="Đơn vị tổ chức"
                                    value={event.organizer}
                                />
                                <InformationItem
                                    icon={FiBookOpen}
                                    label="Phạm vi tham gia"
                                    value={event.className || "Toàn trường"}
                                />
                            </div>

                            {event.outcome && (
                                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                                    <span className="font-extrabold">Kết quả sự kiện: </span>
                                    {event.outcome}
                                </div>
                            )}
                        </div>
                    </article>

                    <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-7">
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                            <div>
                                <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-[#F27123]">
                                    Đăng ký tham gia
                                </p>
                                <h3 className="mb-2 text-2xl font-extrabold text-[#0F2747]">
                                    {registeredCount}
                                    {capacity ? `/${capacity}` : ""} học sinh đã đăng ký
                                </h3>

                                {capacity && (
                                    <div>
                                        <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                                            <span>Số lượng đăng ký</span>
                                            <span>{registrationPercent}%</span>
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-orange-100">
                                            <div
                                                className="h-full rounded-full bg-[#F27123] transition-all"
                                                style={{ width: `${registrationPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl bg-[#FFF7F2] p-4 text-center">
                                <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white text-[#F27123] shadow-sm">
                                    <FiUsers size={21} />
                                </span>

                                {registerError && (
                                    <p className="mb-3 text-xs leading-5 text-red-600">
                                        {registerError}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={register}
                                    disabled={!canRegister || registering}
                                    className={`
                      inline-flex h-11 w-full items-center justify-center rounded-xl
                      px-5 text-sm font-extrabold text-white transition
                      ${canRegister
                                            ? "bg-[#F27123] shadow-lg shadow-orange-200/70 hover:-translate-y-0.5 hover:bg-[#d95f17]"
                                            : "cursor-not-allowed bg-slate-300"
                                        }
                    `}
                                >
                                    {event.isRegistered
                                        ? "Đã đăng ký"
                                        : capacity && registeredCount >= capacity
                                            ? "Đã đủ số lượng"
                                            : registering
                                                ? "Đang đăng ký..."
                                                : "Đăng ký tham gia"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                    <aside className="min-w-0 space-y-5 xl:sticky xl:top-6">
                        <EventRangeCalendar
                            startDate={event.startDate}
                            endDate={event.endDate}
                        />

                        <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
                            <div className="border-b border-orange-100 bg-[#FFF7F2] px-5 py-4">
                                <h2 className="mb-0 flex items-center gap-2 text-lg font-extrabold text-[#0F2747]">
                                    <FiMapPin className="text-[#F27123]" />
                                    Địa điểm tổ chức
                                </h2>
                            </div>
                            <div className="relative min-h-[170px] overflow-hidden bg-gradient-to-br from-slate-100 to-orange-50 p-5">
                                <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]" />
                                <div className="relative flex min-h-[130px] flex-col items-center justify-center text-center">
                                    <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white text-[#F27123] shadow-md">
                                        <FiMapPin size={22} />
                                    </span>
                                    <p className="mb-1 text-sm font-extrabold text-[#0F2747]">
                                        {event.location || "Chưa cập nhật địa điểm"}
                                    </p>
                                    <p className="mb-0 text-xs text-slate-500">
                                        {event.className || "Sự kiện toàn trường"}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="mb-0 text-lg font-extrabold text-[#0F2747]">
                                    Sự kiện khác
                                </h3>
                                <Link
                                    to="/student/events"
                                    className="text-xs font-bold text-[#F27123] no-underline hover:text-[#d95f17]"
                                >
                                    Xem tất cả
                                </Link>
                            </div>

                            {relatedEvents.length === 0 ? (
                                <p className="mb-0 rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                                    Chưa có sự kiện khác phù hợp.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {relatedEvents.map((relatedEvent) => (
                                        <Link
                                            key={relatedEvent.eventId}
                                            to={`/student/events/${relatedEvent.eventId}`}
                                            className="group flex items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left no-underline transition hover:border-orange-200 hover:bg-orange-50/60"
                                        >
                                            <span
                                                className="
        flex h-12 w-12 shrink-0 items-center justify-center
        rounded-xl bg-[#FFF7F2]
        text-sm font-extrabold text-[#F27123]
    "
                                            >
                                                {parseApiDate(relatedEvent.startDate)
                                                    ? `${parseApiDate(relatedEvent.startDate).getDate()}/${parseApiDate(relatedEvent.startDate).getMonth() + 1
                                                    }`
                                                    : "--/--"}
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="mb-1 block truncate text-sm font-extrabold text-[#0F2747]">
                                                    {relatedEvent.title}
                                                </span>
                                                <span className="block truncate text-xs text-slate-500">
                                                    {relatedEvent.location || "Chưa cập nhật địa điểm"}
                                                </span>
                                            </span> 
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    </aside>
                </div>
            )}
        </StudentDashboardShell>
    );
}

export default StudentEventDetail;
