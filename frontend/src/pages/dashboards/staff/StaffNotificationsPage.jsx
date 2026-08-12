import { useCallback, useEffect, useMemo, useState } from "react";

import StaffPageHeader from "../../../components/staff/StaffPageHeader";
import PrettySelect from "../../../components/molecules/PrettySelect";
import { staffApi } from "../../../api/client";

function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

// Nhãn tiếng Việt cho notification.type — khớp bộ nhãn ở chuông header.
const TYPE_LABEL = {
  MESSAGE: "Tin nhắn",
  ANNOUNCEMENT: "Thông báo",
  ACADEMIC: "Học tập",
  ACADEMIC_WARNING: "Cảnh báo học tập",
  BEHAVIOR: "Nề nếp",
  BEHAVIOUR: "Nề nếp",
  HOMEWORK: "Bài tập",
  ATTENDANCE: "Điểm danh",
  LEAVE: "Đơn nghỉ phép",
  EVENT: "Sự kiện",
  MEETING: "Cuộc họp",
  SUPPORT: "Hỗ trợ học sinh",
  GOAL: "Mục tiêu",
  GRADE: "Bảng điểm",
  TIMETABLE: "Thời khoá biểu",
  SYSTEM: "Hệ thống",
};

// createdAt từ API đã là 'YYYY-MM-DD HH:mm' (giờ địa phương) — cắt chuỗi sang
// dd/mm/yyyy, KHÔNG dùng new Date() để tránh lệch múi giờ.
function formatTime(value) {
  if (!value) return "";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return String(value);
  const [, y, mo, d, hh, mi] = m;
  return `${d}/${mo}/${y} ${hh}:${mi}`;
}

function NotificationCard({ item, onRead }) {
  const [submitting, setSubmitting] = useState(false);

  async function markRead() {
    if (item.isRead || submitting) return;
    setSubmitting(true);
    try {
      await staffApi.markNotificationRead(item.notificationId);
      onRead();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={markRead}
      className={`w-full rounded-3xl border p-5 text-left shadow-sm transition ${
        item.isRead
          ? "cursor-default border-orange-100 bg-white"
          : "cursor-pointer border-[#F27123]/40 bg-[#FFF7F2] hover:brightness-95"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {!item.isRead && (
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#F27123]" />
        )}
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-[#F27123]">
          {TYPE_LABEL[item.type] || item.type || "Thông báo"}
        </span>
        <span className="ml-auto text-xs text-slate-400">{formatTime(item.createdAt)}</span>
      </div>

      <h3 className="mb-1 text-base font-bold text-[#0F2747]">{item.title}</h3>

      <p className="mb-0 text-sm text-slate-600">
        {item.content || "Không có nội dung chi tiết."}
      </p>

      {!item.isRead && (
        <p className="mb-0 mt-3 text-xs font-bold text-[#08509F]">
          {submitting ? "Đang lưu..." : "Bấm để đánh dấu đã đọc"}
        </p>
      )}
    </button>
  );
}

function StaffNotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    staffApi
      .getMyNotifications({ limit: 50, unreadOnly: unreadOnly || undefined })
      .then((res) => { if (mounted) setData(res.data); })
      .catch((err) => { if (mounted) setError(err.message); })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [unreadOnly, refreshKey]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const unreadCount = Number(data?.summary?.unreadNotifications ?? 0);
  const totalCount = Number(data?.summary?.totalNotifications ?? 0);

  async function markAllRead() {
    try {
      await staffApi.markAllNotificationsRead();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <StaffPageHeader
        title="Thông báo"
        action={
          <>
            <PrettySelect
              value={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.value)}
              options={[
                { value: "", label: "Tất cả" },
                { value: "true", label: "Chưa đọc" },
              ]}
            />
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-2 rounded-full bg-[#F27123] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#d95f17] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Ms name="done_all" className="!text-[18px]" />
              Đánh dấu đã đọc tất cả
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được thông báo: {error}
        </div>
      )}

      {loading && (
        <div className="grid gap-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-28 animate-pulse rounded-3xl bg-slate-200/60" />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-3xl border border-dashed border-orange-200 bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Ms name="inbox" />
          </div>
          <p className="mb-0 text-sm font-semibold text-slate-500">
            {unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item) => (
            <NotificationCard
              key={item.notificationId}
              item={item}
              onRead={refresh}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default StaffNotificationsPage;
