import { useMemo, useState } from "react";
import { FiBell, FiCheckCircle, FiInbox } from "react-icons/fi";

import { parentApi } from "../../api/client";
import { useAuth } from "../../context/useAuth";
import { useParentNotifications } from "../../hooks/useParentNotifications";
import { useParentStudents } from "../../hooks/useParentStudents";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";

const TYPE_META = {
  HOMEWORK:   { label: "Bài tập",    bg: "#EFF6FF", text: "#2563EB" },
  ATTENDANCE: { label: "Điểm danh",  bg: "#F0FDF4", text: "#16A34A" },
  GRADE:      { label: "Bảng điểm",  bg: "#F5F3FF", text: "#7C3AED" },
  BEHAVIOUR:  { label: "Hạnh kiểm",  bg: "#FFF1F2", text: "#E11D48" },
  EVENT:      { label: "Sự kiện",    bg: "#FFFBEB", text: "#D97706" },
  LEAVE:      { label: "Xin nghỉ",   bg: "#F0FDFA", text: "#0D9488" },
  MEETING:    { label: "Cuộc họp",   bg: "#EEF2FF", text: "#4F46E5" },
  MESSAGE:    { label: "Tin nhắn",   bg: "#F8FAFC", text: "#475569" },
  SYSTEM:     { label: "Hệ thống",   bg: "#F8FAFC", text: "#64748B" },
};

function getTypeMeta(type) {
  return TYPE_META[type] ?? { label: type || "Thông báo", bg: "#FFF7F2", text: "#F27123" };
}

function NotificationRow({ item, onRead }) {
  const [submitting, setSubmitting] = useState(false);
  const meta = getTypeMeta(item.type);

  async function handleMarkRead() {
    if (item.isRead || submitting) return;
    setSubmitting(true);
    try {
      await parentApi.markNotificationRead(item.notificationId);
      onRead();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-4 shadow-sm"
      style={{
        border: item.isRead ? "1px solid #FFE7D6" : "1px solid rgba(242,113,35,0.4)",
        backgroundColor: item.isRead ? "#fff" : "#FFF7F2",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: meta.bg, color: meta.text }}
            >
              {meta.label}
            </span>

            {!item.isRead && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: "#FEF2F2", color: "#EF4444" }}
              >
                Mới
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-[#0F2747]">{item.title}</h3>

          {item.content && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.content}</p>
          )}

          <p className="mt-1 text-xs text-slate-400">{item.createdAt}</p>
        </div>

        <button
          type="button"
          onClick={handleMarkRead}
          disabled={item.isRead || submitting}
          className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
          style={
            item.isRead
              ? { backgroundColor: "#F1F5F9", color: "#94A3B8" }
              : { backgroundColor: "#EBF3FF", color: "#08509F" }
          }
        >
          <FiCheckCircle size={12} />
          {item.isRead ? "Đã đọc" : submitting ? "Đang lưu..." : "Đánh dấu đã đọc"}
        </button>
      </div>
    </div>
  );
}

function ParentNotifications() {
  const { user } = useAuth();
  const { students } = useParentStudents();
  const [activeTab, setActiveTab] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading, error } = useParentNotifications({ limit: 50 }, refreshKey);

  const allItems = data?.items || [];
  const unreadCount = Number(data?.summary?.unreadNotifications || 0);
  const totalCount = Number(data?.summary?.totalNotifications || 0);

  const displayItems = useMemo(
    () => activeTab === "unread" ? allItems.filter((n) => !n.isRead) : allItems,
    [allItems, activeTab],
  );

  const headerUser = useMemo(() => {
    const parentRole = user?.roles?.find((r) => r.roleName === "PARENT");
    return {
      name: user?.fullName || user?.username || "Phụ huynh",
      role: parentRole?.description || "Phụ huynh",
      avatar: user?.avatar || "",
    };
  }, [user]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function markAllRead() {
    try {
      await parentApi.markAllNotificationsRead();
      refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "#0F2747" }}>
            Trung tâm thông báo
          </h1>
          {!loading && data && (
            <p className="mt-0.5 text-sm text-slate-500">
              {totalCount} thông báo · {unreadCount} chưa đọc
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40"
          style={{ backgroundColor: "#F27123" }}
        >
          <FiCheckCircle size={15} />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* Tab bar */}
      <div
        className="mb-5 flex gap-1 rounded-2xl p-1 shadow-sm"
        style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}
      >
        {[
          { key: "all", label: "Tất cả" },
          { key: "unread", label: `Chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
            style={
              activeTab === key
                ? { backgroundColor: "#F27123", color: "#fff" }
                : { color: "#64748B" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && displayItems.length === 0 && (
        <div
          className="rounded-2xl p-10 text-center text-sm text-slate-400 shadow-sm"
          style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#F27123]">
            <FiBell size={22} />
          </div>
          {activeTab === "unread" ? "Không có thông báo chưa đọc." : "Chưa có thông báo nào."}
        </div>
      )}

      {/* List */}
      {!loading && !error && displayItems.length > 0 && (
        <div className="space-y-2">
          {displayItems.map((item) => (
            <NotificationRow key={item.notificationId} item={item} onRead={refresh} />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {!loading && !error && displayItems.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <FiInbox size={13} />
          Hiển thị {displayItems.length} / {activeTab === "unread" ? unreadCount : totalCount} thông báo
        </div>
      )}
    </DashboardShell>
  );
}

export default ParentNotifications;
