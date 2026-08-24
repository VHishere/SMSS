import { useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiImage,
  FiTag,
  FiUser,
  FiUserPlus,
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
    className: "bg-emerald-50 text-emerald-700",
  },
  PUBLISHED: {
    label: "Đã công bố",
    className: "bg-blue-50 text-blue-700",
  },
  SCHEDULED: {
    label: "Sắp diễn ra",
    className: "bg-amber-50 text-amber-700",
  },
  COMPLETED: {
    label: "Đã kết thúc",
    className: "bg-slate-100 text-slate-600",
  },
  DONE: {
    label: "Đã kết thúc",
    className: "bg-slate-100 text-slate-600",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "bg-red-50 text-red-700",
  },
};

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
  if (!date) return "Chưa cập nhật";

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
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

function formatDateRange(startValue, endValue) {
  const start = parseApiDate(startValue);
  const end = parseApiDate(endValue) || start;

  if (!start) return "Chưa cập nhật thời gian";

  if (sameDay(start, end)) {
    return `${formatDate(start)} · ${formatTime(start)} - ${formatTime(end)}`;
  }

  return `${formatDate(start)} ${formatTime(start)} - ${formatDate(end)} ${formatTime(end)}`;
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
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur-sm">
          <FiImage size={28} />
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

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-right text-xs font-extrabold text-[#0F2747]">
        {value}
      </span>
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
  const gallery = data?.gallery || [];
  const statusInfo = EVENT_STATUS[event?.status] || {
    label: event?.status || "Chưa cập nhật",
    className: "bg-slate-100 text-slate-600",
  };

  const registeredCount = Number(event?.registeredCount || 0);
  const capacity = event?.capacity ? Number(event.capacity) : null;
  const isFull = Boolean(capacity && registeredCount >= capacity);
  const parsedStartDate = parseApiDate(event?.startDate);
  const hasStarted = Boolean(event?.hasStarted) || Boolean(
    parsedStartDate && parsedStartDate <= new Date(),
  );
  const canRegister = Boolean(
    event &&
      ["ACTIVE", "PUBLISHED", "SCHEDULED"].includes(event.status) &&
      !event.isRegistered &&
      !isFull &&
      !hasStarted,
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
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <button
          type="button"
          onClick={() => navigate("/student/events")}
          className="inline-flex items-center gap-1.5 font-bold text-slate-500 transition hover:text-[#F27123]"
        >
          <FiArrowLeft />
          Sự kiện
        </button>
        <span>/</span>
        <span className="font-bold text-[#0F2747]">Chi tiết sự kiện</span>
      </div>

      {loading && <LoadingState label="Đang tải chi tiết sự kiện..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được chi tiết sự kiện: ${error}`} />
      )}

      {!loading && !error && event && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-w-0 space-y-4">
            <article className="overflow-hidden rounded-3xl border card-border bg-white shadow-sm">
              <div className="relative h-[260px] overflow-hidden sm:h-[360px]">
                <EventCover
                  event={event}
                  alt={event.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-slate-950/10" />

                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#F27123] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm">
                    {statusInfo.label}
                  </span>
                  <span className="rounded-full bg-blue-100/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-blue-700 shadow-sm">
                    {event.eventType || event.category || "Hoạt động học sinh"}
                  </span>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <h1 className="mb-4 text-2xl font-black leading-tight text-[#0F2747] sm:text-3xl">
                  {event.title}
                </h1>

                <div className="mb-5 flex flex-col gap-2.5 border-b border-slate-200 pb-5 text-xs font-medium text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
                  <span className="inline-flex items-center gap-2">
                    <FiCalendar className="text-[#F27123]" size={15} />
                    {formatDate(event.startDate)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <FiClock className="text-[#F27123]" size={15} />
                    {formatTime(event.startDate)} - {formatTime(event.endDate)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <FiMapPin className="text-[#F27123]" size={15} />
                    {event.location || "Chưa cập nhật địa điểm"}
                  </span>
                </div>

                <section>
                  <h2 className="mb-3 text-sm font-extrabold text-[#0F2747]">
                    Giới thiệu sự kiện
                  </h2>
                  <p className="mb-4 whitespace-pre-line text-sm leading-7 text-slate-600">
                    {event.description || "Sự kiện chưa có mô tả chi tiết."}
                  </p>

                  <div className="space-y-2.5 text-xs leading-5 text-slate-600">
                    <p className="mb-0 flex items-start gap-2">
                      <FiCheckCircle className="mt-0.5 shrink-0 text-[#0F2747]" />
                      <span>
                        Thời gian diễn ra: {formatDateRange(event.startDate, event.endDate)}.
                      </span>
                    </p>
                    <p className="mb-0 flex items-start gap-2">
                      <FiCheckCircle className="mt-0.5 shrink-0 text-[#0F2747]" />
                      <span>
                        Phạm vi tham gia: {event.className || "Học sinh toàn trường"}.
                      </span>
                    </p>
                    <p className="mb-0 flex items-start gap-2">
                      <FiCheckCircle className="mt-0.5 shrink-0 text-[#0F2747]" />
                      <span>
                        Học sinh cần đăng ký trước khi sự kiện đủ số lượng tham gia.
                      </span>
                    </p>
                  </div>
                </section>

                {event.outcome && (
                  <section className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <h3 className="mb-1 text-xs font-extrabold text-blue-800">
                      Kết quả sự kiện
                    </h3>
                    <p className="mb-0 text-xs leading-6 text-blue-700">
                      {event.outcome}
                    </p>
                  </section>
                )}
              </div>
            </article>

            {gallery.length > 0 && (
              <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="mb-0 text-sm font-extrabold text-[#0F2747]">
                    Thư viện hình ảnh
                  </h2>
                  <span className="text-[10px] font-bold text-[#F27123]">
                    {gallery.length} hình ảnh
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gallery.map((image, index) => (
                    <a
                      key={image.attachmentId || image.fileUrl}
                      href={image.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`overflow-hidden rounded-xl ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}
                    >
                      <EventCover
                        event={{ imageUrl: image.fileUrl }}
                        alt={image.fileName || `Hình ảnh sự kiện ${index + 1}`}
                        className="h-32 w-full object-cover transition duration-500 hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {relatedEvents.length > 0 && (
              <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="mb-0 text-sm font-extrabold text-[#0F2747]">
                    Sự kiện liên quan
                  </h2>
                  <Link
                    to="/student/events"
                    className="text-xs font-bold text-[#F27123] no-underline hover:text-[#d95f17]"
                  >
                    Xem tất cả
                  </Link>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {relatedEvents.map((relatedEvent) => (
                    <Link
                      key={relatedEvent.eventId}
                      to={`/student/events/${relatedEvent.eventId}`}
                      className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 no-underline transition hover:border-orange-200 hover:bg-orange-50/50"
                    >
                      <EventCover
                        event={relatedEvent}
                        alt=""
                        className="h-14 w-16 shrink-0 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-xs font-extrabold leading-5 text-[#0F2747] group-hover:text-[#F27123]">
                          {relatedEvent.title}
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                          <FiMapPin className="shrink-0 text-[#F27123]" />
                          <span className="truncate">
                            {relatedEvent.location || "Chưa cập nhật"}
                          </span>
                        </span>
                      </span>
                      <FiArrowRight className="shrink-0 text-slate-400 group-hover:text-[#F27123]" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-5">
            <section className="rounded-3xl border card-border bg-white p-5 text-center shadow-sm">
              <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-orange-50 text-[#F27123]">
                <FiUserPlus size={23} />
              </span>
              <h2 className="mb-1 text-base font-black text-[#0F2747]">
                Tham gia sự kiện
              </h2>
              <p className="mb-4 text-[11px] leading-5 text-slate-500">
                Đăng ký để giữ chỗ và nhận thông báo cập nhật về sự kiện.
              </p>

              <div className="space-y-2">
                <DetailRow
                  label="Số người tham gia"
                  value={`${registeredCount}${capacity ? ` / ${capacity}` : ""}`}
                />
                <DetailRow label="Phí đăng ký" value="Miễn phí" />
              </div>

              {registerError && (
                <p className="mb-0 mt-3 text-xs leading-5 text-red-600">
                  {registerError}
                </p>
              )}

              <button
                type="button"
                onClick={register}
                disabled={!canRegister || registering}
                className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold text-white transition ${
                  canRegister
                    ? "bg-[#c75a00] shadow-md shadow-orange-200 hover:-translate-y-0.5 hover:bg-[#a94d00]"
                    : event.isRegistered
                      ? "cursor-default bg-emerald-600"
                      : "cursor-not-allowed bg-slate-300"
                }`}
              >
                {event.isRegistered && <FiCheckCircle />}
                {event.isRegistered
                  ? "Đã đăng ký tham gia"
                  : hasStarted
                    ? "Sự kiện đã bắt đầu"
                    : isFull
                      ? "Sự kiện đã đủ chỗ"
                      : registering
                        ? "Đang đăng ký..."
                        : "Đăng ký ngay"}
              </button>

              <p className="mb-0 mt-3 text-[10px] leading-4 text-slate-400">
                Hãy kiểm tra thời gian và địa điểm trước khi đăng ký.
              </p>
            </section>

            <section className="rounded-3xl border card-border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-extrabold text-[#0F2747]">
                Đơn vị tổ chức
              </h2>

              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#0F4C8A] text-white">
                  <FiUser size={19} />
                </span>
                <div className="min-w-0">
                  <p className="mb-1 text-xs font-extrabold text-[#0F2747]">
                    {event.organizer || "Nhà trường"}
                  </p>
                  <p className="mb-0 text-[10px] leading-4 text-slate-500">
                    Phụ trách tổ chức và điều phối sự kiện
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-[11px] text-slate-600">
                <p className="mb-0 flex items-center gap-2">
                  <FiTag className="text-[#0F4C8A]" />
                  {event.eventType || event.category || "Hoạt động học sinh"}
                </p>
                <p className="mb-0 flex items-center gap-2">
                  <FiUsers className="text-[#0F4C8A]" />
                  {event.className || "Học sinh toàn trường"}
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border card-border bg-white shadow-sm">
              <div className="p-5 pb-3">
                <h2 className="mb-0 text-sm font-extrabold text-[#0F2747]">
                  Địa điểm
                </h2>
              </div>

              <div className="px-5">
                <div className="relative h-36 overflow-hidden rounded-xl bg-slate-100">
                  {event.location ? (
                    <iframe
                      title="Bản đồ địa điểm tổ chức"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                      className="h-full w-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-slate-400">
                      <FiMapPin size={28} />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 pt-3">
                <p className="mb-1 text-xs font-extrabold leading-5 text-[#0F2747]">
                  {event.location || "Chưa cập nhật địa điểm"}
                </p>
                <p className="mb-0 text-[10px] leading-4 text-slate-500">
                  Vui lòng có mặt sớm để hoàn tất thủ tục tham gia.
                </p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </StudentDashboardShell>
  );
}

export default StudentEventDetail;
