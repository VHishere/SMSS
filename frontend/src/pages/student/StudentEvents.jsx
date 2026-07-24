import { useState } from "react";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiMapPin,
  FiStar,
  FiUsers,
} from "react-icons/fi";
import { Link } from "react-router-dom";

import { studentApi } from "../../api/client";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilterInput from "../../components/atoms/FilterInput";
import FilterSelect from "../../components/atoms/FilterSelect";
import LoadingState from "../../components/atoms/LoadingState";
import StatusPill from "../../components/atoms/StatusPill";

import EmptyState from "../../components/molecules/EmptyState";

import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

import { useStudentEvents } from "../../hooks/useStudentEvents";
import { formatDateTime } from "../../utils/dateFormat";

const STATUS_LABELS = {
  ACTIVE: "Đang mở",
  PUBLISHED: "Đã công bố",
  SCHEDULED: "Sắp diễn ra",
  COMPLETED: "Đã kết thúc",
  DONE: "Đã kết thúc",
  CANCELLED: "Đã hủy",
};

function EventCard({ event, onRegistered }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  const registeredCount = Number(event.registeredCount || 0);
  const capacity = event.capacity ? Number(event.capacity) : null;
  const isFull = Boolean(capacity && registeredCount >= capacity);

  const canRegister =
    ["ACTIVE", "PUBLISHED", "SCHEDULED"].includes(event.status) &&
    !event.isRegistered &&
    !isFull;

  return (
    <article className="group overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative min-h-32 overflow-hidden bg-gradient-to-br from-[#0F2747] via-[#18558A] to-[#F27123] p-5 text-white">
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />

        <div className="relative flex h-full flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#F27123] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em]">
              <FiStar size={13} />
              {event.eventType || event.category || "Sự kiện"}
            </span>

            {event.isRegistered ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <FiCheckCircle size={14} />
                Đã đăng ký
              </span>
            ) : (
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/25">
                {STATUS_LABELS[event.status] || event.status}
              </span>
            )}
          </div>

          <h2 className="mb-0 text-2xl font-black leading-tight">
            {event.title}
          </h2>
        </div>
      </div>

      <div className="p-5">
        <p className="mb-4 line-clamp-3 text-sm leading-6 text-slate-500">
          {event.description || "Chưa có mô tả chi tiết."}
        </p>

        <div className="mb-4 grid gap-3 rounded-2xl bg-[#FFF7F2] p-4 text-sm text-slate-600 md:grid-cols-2">
          <span className="flex items-start gap-2">
            <FiCalendar className="mt-0.5 shrink-0 text-[#F27123]" size={15} />
            <span>{formatDateTime(event.startDate)}</span>
          </span>

          <span className="flex items-start gap-2">
            <FiMapPin className="mt-0.5 shrink-0 text-[#F27123]" size={15} />
            <span>{event.location || "Chưa cập nhật"}</span>
          </span>

          <span className="flex items-start gap-2">
            <FiUsers className="mt-0.5 shrink-0 text-[#F27123]" size={15} />
            <span>
              {registeredCount}
              {capacity ? `/${capacity}` : ""} người đăng ký
            </span>
          </span>

          <span className="flex items-start gap-2">
            <FiStar className="mt-0.5 shrink-0 text-[#F27123]" size={15} />
            <span>{event.className || "Toàn trường"}</span>
          </span>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Link
            to={`/student/events/${event.eventId}`}
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#0F2747] no-underline transition hover:text-[#F27123]"
          >
            Xem chi tiết
            <FiArrowRight className="transition group-hover:translate-x-0.5" />
          </Link>

          <button
            type="button"
            onClick={register}
            disabled={!canRegister || submitting}
            className={`
              inline-flex h-10 items-center justify-center rounded-xl px-5
              text-sm font-extrabold text-white transition
              ${canRegister
                ? "bg-[#F27123] shadow-md shadow-orange-200/70 hover:-translate-y-0.5 hover:bg-[#d95f17]"
                : "cursor-not-allowed bg-slate-300"
              }
            `}
          >
            {event.isRegistered
              ? "Đã đăng ký"
              : isFull
                ? "Đã đủ số lượng"
                : submitting
                  ? "Đang đăng ký..."
                  : "Đăng ký"}
          </button>
        </div>
      </div>
    </article>
  );
}

function StudentEvents() {
  const [filters, setFilters] = useState({
    status: "",
    search: "",
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading, error } = useStudentEvents(filters, refreshKey);

  const events = data?.events || [];

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <StudentDashboardShell context={data?.context}>
      <section className="mb-5 flex flex-wrap items-end justify-end gap-4 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-end gap-4">
          <FilterInput
            label="Tìm kiếm"
            value={filters.search}
            placeholder="Tên sự kiện, địa điểm..."
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />

          <FilterSelect
            label="Trạng thái"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">Đang mở</option>
            <option value="PUBLISHED">Đã công bố</option>
            <option value="SCHEDULED">Sắp diễn ra</option>
            <option value="COMPLETED">Đã kết thúc</option>
            <option value="CANCELLED">Đã hủy</option>
          </FilterSelect>
        </div>
      </section>

      {loading && <LoadingState label="Đang tải sự kiện..." />}

      {!loading && error && (
        <ErrorAlert error={`Không tải được sự kiện: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          {events.length === 0 ? (
            <EmptyState
              title="Không tìm thấy sự kiện"
              description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
            />
          ) : (
            <section className="grid gap-5 xl:grid-cols-2">
              {events.map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  onRegistered={refresh}
                />
              ))}
            </section>
          )}
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentEvents;
