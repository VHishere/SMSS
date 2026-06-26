import { useState } from "react";
import {
  FiBell,
  FiFilter,
  FiInbox,
} from "react-icons/fi";

import { studentApi } from "../../api/client";

import ErrorAlert from "../../components/atoms/ErrorAlert";
import FilterSelect from "../../components/atoms/FilterSelect";
import LoadingState from "../../components/atoms/LoadingState";
import StatusPill from "../../components/atoms/StatusPill";

import EmptyState from "../../components/molecules/EmptyState";
import StudentStatCard from "../../components/molecules/StudentStatCard";

import StudentDashboardShell from "../../components/templates/StudentDashboardShell";

import { useStudentNotifications } from "../../hooks/useStudentNotifications";

function NotificationCard({
  item,
  onRead,
}) {
  const [submitting, setSubmitting] = useState(false);

  async function markRead() {
    if (item.isRead) return;

    setSubmitting(true);

    try {
      await studentApi.markNotificationRead(item.notificationId);
      onRead();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article
      className={`
        rounded-2xl border p-5 shadow-sm
        ${
          item.isRead
            ? "border-orange-100 bg-white"
            : "border-[#F27123]/40 bg-[#FFF7F2]"
        }
      `}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#F27123]">
            {item.type || "Thông báo"}
          </p>

          <h3 className="mb-2 text-lg font-bold text-[#0F2747]">
            {item.title}
          </h3>

          <p className="mb-0 text-sm text-slate-600">
            {item.content || "Không có nội dung chi tiết."}
          </p>
        </div>

        {!item.isRead && (
          <StatusPill tone="orange">
            Mới
          </StatusPill>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mb-0 text-xs text-slate-400">
          {item.createdAt}
        </p>

        <button
          type="button"
          onClick={markRead}
          disabled={item.isRead || submitting}
          className="
            rounded-xl border border-[#08509F]
            bg-white px-4 py-2
            text-sm font-bold text-[#08509F]
            transition hover:bg-blue-50
            disabled:cursor-not-allowed
            disabled:border-slate-200
            disabled:text-slate-400
          "
        >
          {item.isRead
            ? "Đã đọc"
            : submitting
              ? "Đang lưu..."
              : "Đánh dấu đã đọc"}
        </button>
      </div>
    </article>
  );
}

function StudentNotifications() {
  const [filters, setFilters] = useState({
    unreadOnly: "",
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const {
    data,
    loading,
    error,
  } = useStudentNotifications(filters, refreshKey);

  const notifications = data?.items || [];

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  async function markAllRead() {
    await studentApi.markAllNotificationsRead();
    refresh();
  }

  return (
    <StudentDashboardShell>
      <section className="mb-5 flex flex-wrap items-center justify-end gap-3">
        <FilterSelect
          label="Bộ lọc"
          value={filters.unreadOnly}
          onChange={(event) =>
            setFilters({
              unreadOnly: event.target.value,
            })
          }
        >
          <option value="">Tất cả</option>
          <option value="true">Chưa đọc</option>
        </FilterSelect>

        <button
          type="button"
          onClick={markAllRead}
          className="
            rounded-xl bg-[#F27123]
            px-4 py-2 text-sm font-bold
            text-white transition
            hover:bg-[#d95f17]
          "
        >
          Đánh dấu tất cả đã đọc
        </button>
      </section>

      {loading && (
        <LoadingState label="Đang tải thông báo..." />
      )}

      {!loading && error && (
        <ErrorAlert error={`Không tải được thông báo: ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StudentStatCard
              icon={FiInbox}
              label="Tổng thông báo"
              value={data.summary?.totalNotifications || 0}
              tone="blue"
            />

            <StudentStatCard
              icon={FiBell}
              label="Chưa đọc"
              value={data.summary?.unreadNotifications || 0}
              tone="orange"
            />

            <StudentStatCard
              icon={FiFilter}
              label="Đang hiển thị"
              value={notifications.length}
              tone="purple"
            />
          </section>

          {notifications.length === 0 ? (
            <EmptyState title="Không có thông báo" />
          ) : (
            <section className="grid gap-4 xl:grid-cols-2">
              {notifications.map((item) => (
                <NotificationCard
                  key={item.notificationId}
                  item={item}
                  onRead={refresh}
                />
              ))}
            </section>
          )}
        </>
      )}
    </StudentDashboardShell>
  );
}

export default StudentNotifications;