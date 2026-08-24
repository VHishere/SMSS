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

  // Bấm vào cả thẻ để đánh dấu đã đọc (giống trang admin), không cần nút riêng.
  // markNotificationRead cũng phát "notifications:changed" → badge chuông trừ ngay.
  async function markRead() {
    if (item.isRead || submitting) return;

    setSubmitting(true);

    try {
      await studentApi.markNotificationRead(item.notificationId);
      onRead();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={markRead}
      className={`
        w-full rounded-2xl border p-5 text-left shadow-sm transition
        ${
          item.isRead
            ? "cursor-default border-orange-100 bg-white"
            : "cursor-pointer border-[#F27123]/40 bg-[#FFF7F2] hover:brightness-95"
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

        {item.isRead ? (
          <span className="shrink-0 text-xs font-semibold text-slate-400">
            Đã đọc
          </span>
        ) : (
          <StatusPill tone="orange">
            Mới
          </StatusPill>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="mb-0 text-xs text-slate-400">
          {item.createdAt}
        </p>

        {!item.isRead && (
          <span className="text-xs font-bold text-[#08509F]">
            {submitting ? "Đang lưu..." : "Bấm để đánh dấu đã đọc"}
          </span>
        )}
      </div>
    </button>
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