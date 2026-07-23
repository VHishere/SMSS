import { useMemo, useState } from "react";
import {
  FiCalendar,
  FiMapPin,
  FiStar,
  FiUsers,
} from "react-icons/fi";

import { parentApi } from "../../api/client";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilterInput from "../../components/atoms/FilterInput";
import FilterSelect from "../../components/atoms/FilterSelect";
import LoadingState from "../../components/atoms/LoadingState";
import StatusPill from "../../components/atoms/StatusPill";

import EmptyState from "../../components/molecules/EmptyState";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";

import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentEvents } from "../../hooks/useParentStudentEvents";
import { formatDateTime } from "../../utils/dateFormat";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

const STATUS_LABELS = {
  ACTIVE: { label: "Đang mở", tone: "blue" },
  PUBLISHED: { label: "Đã công bố", tone: "blue" },
  SCHEDULED: { label: "Đã lên lịch", tone: "blue" },
  COMPLETED: { label: "Đã kết thúc", tone: "slate" },
  CANCELLED: { label: "Đã hủy", tone: "red" },
};

function EventCard({ studentId, event, onRegistered }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function register() {
    setSubmitting(true);
    setError("");

    try {
      await parentApi.registerStudentEvent(studentId, event.eventId);
      onRegistered();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isCancelled = event.status === "CANCELLED";
  const canRegister =
    ["ACTIVE", "PUBLISHED", "SCHEDULED"].includes(event.status) &&
    !event.isRegistered;
  const statusInfo = STATUS_LABELS[event.status] || { label: event.status, tone: "blue" };

  return (
    <article
      className="
        rounded-3xl border border-orange-100
        bg-white p-5 shadow-sm
        transition hover:-translate-y-0.5
        hover:shadow-md
      "
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="
              mb-2 text-xs font-bold uppercase
              tracking-[0.16em] text-[#F27123]
            "
          >
            {event.eventType || event.category || "Sự kiện"}
          </p>

          <h3 className="mb-2 text-2xl font-bold text-[#0F2747]">
            {event.title}
          </h3>

          <p className="mb-0 line-clamp-3 text-sm leading-6 text-slate-500">
            {event.description || "Chưa có mô tả chi tiết."}
          </p>
        </div>

        {event.isRegistered && !isCancelled ? (
          <StatusPill tone="green">
            Đã đăng ký
          </StatusPill>
        ) : (
          <StatusPill tone={statusInfo.tone}>
            {statusInfo.label}
          </StatusPill>
        )}
      </div>

      <div
        className="
          mb-4 grid gap-3 rounded-2xl
          bg-[#FFF7F2] p-4
          text-sm text-slate-600
          md:grid-cols-2
        "
      >
        <span className="flex items-center gap-2">
          <FiCalendar size={15} />
          {formatDateTime(event.startDate)}
        </span>

        <span className="flex items-center gap-2">
          <FiMapPin size={15} />
          {event.location || "Chưa cập nhật"}
        </span>

        <span className="flex items-center gap-2">
          <FiUsers size={15} />
          {event.registeredCount || 0}
          {event.capacity ? `/${event.capacity}` : ""} đăng ký
        </span>

        <span className="flex items-center gap-2">
          <FiStar size={15} />
          {event.className || "Toàn trường"}
        </span>
      </div>

      {event.outcome && (
        <p className="mb-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-[#08509F]">
          Kết quả: {event.outcome}
        </p>
      )}

      {error && (
        <p className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={register}
          disabled={!canRegister || submitting}
          style={{ borderRadius: "10px" }}
          className={
            canRegister
              ? `
                inline-flex h-11 items-center justify-center
                bg-[#F27123] px-6 text-sm font-bold
                text-white shadow-lg shadow-orange-200/70
                transition hover:-translate-y-0.5
                hover:bg-[#d95f17]
                hover:shadow-xl hover:shadow-orange-200
                disabled:cursor-not-allowed
                disabled:opacity-70
                disabled:hover:translate-y-0
              `
              : `
                inline-flex h-11 items-center justify-center
                bg-slate-300 px-6 text-sm font-bold
                text-white shadow-sm
                cursor-not-allowed opacity-80
              `
          }
        >
          {isCancelled
            ? "Sự kiện đã hủy"
            : event.status === "COMPLETED"
              ? "Đã kết thúc"
              : event.isRegistered
                ? "Đã đăng ký"
                : submitting
                  ? "Đang đăng ký..."
                  : "Đăng ký cho con"}
        </button>
      </div>
    </article>
  );
}

function StudentEvents() {
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useParentStudents();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    search: "",
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const effStudentId =
    selectedStudentId || (students[0]?.studentId ? String(students[0].studentId) : "");

  const { data, loading, error } = useParentStudentEvents(
    effStudentId,
    filters,
    refreshKey,
  );

  const events = data?.events || [];

  const headerUser = useMemo(
    () => ({
      name: user?.fullName || user?.username || "Phụ huynh",
      role: "Phụ huynh",
      avatar: user?.avatar || "",
    }),
    [user],
  );

  function handleStudentChange(id) {
    setSelectedStudentId(String(id));
  }

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {studentsLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : students.length === 0 ? (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}
        >
          Không tìm thấy thông tin học sinh.
        </div>
      ) : (
        <>
          {students.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {students.map((s) => (
                <button
                  key={s.studentId}
                  type="button"
                  onClick={() => handleStudentChange(s.studentId)}
                  className="rounded-xl px-4 py-2 text-sm font-medium transition"
                  style={
                    String(s.studentId) === effStudentId
                      ? { backgroundColor: "#08509F", color: "#fff" }
                      : { border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#475569" }
                  }
                >
                  {s.studentFullName}
                  {s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
                </button>
              ))}
            </div>
          )}

          <section className="mb-5 flex flex-wrap items-center justify-end gap-4">
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
              <option value="COMPLETED">Đã kết thúc</option>
              <option value="CANCELLED">Đã hủy</option>
            </FilterSelect>
          </section>

          {loading && (
            <LoadingState label="Đang tải sự kiện..." />
          )}

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
                <section className="grid gap-4 xl:grid-cols-2">
                  {events.map((event) => (
                    <EventCard
                      key={event.eventId}
                      studentId={effStudentId}
                      event={event}
                      onRegistered={refresh}
                    />
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default StudentEvents;
