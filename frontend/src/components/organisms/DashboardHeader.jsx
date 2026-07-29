import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
} from "react";

import Dropdown from "react-bootstrap/Dropdown";
import { useNavigate } from "react-router-dom";

import {
  FiBell,
  FiInbox,
  FiMenu,
  FiSearch,
} from "react-icons/fi";

import { adminApi, parentApi, studentApi, teacherApi } from "../../api/client";
import {
  useAuth,
} from "../../context/useAuth";
import { isStitchUser } from "../../config/sidebarRoles";

import AppIconButton from "../atoms/AppIconButton";
import ProfileDropdown from "../molecules/ProfileDropdown";

// Nhãn tiếng Việt cho notification.type — phải phủ ĐỦ các giá trị thật trong DB,
// nếu thiếu thì dropdown hiện nguyên chuỗi enum tiếng Anh (vd "LEAVE").
const NOTIFICATION_TYPE_LABEL = {
  LEAVE: "Đơn nghỉ phép",
  ANNOUNCEMENT: "Thông báo",
  ACADEMIC: "Học tập",
  ACADEMIC_WARNING: "Cảnh báo học tập",
  BEHAVIOR: "Nề nếp",
  BEHAVIOUR: "Nề nếp",
  HOMEWORK: "Bài tập",
  ATTENDANCE: "Điểm danh",
  GRADE: "Bảng điểm",
  GOAL: "Mục tiêu",
  EVENT: "Sự kiện",
  MESSAGE: "Tin nhắn",
  SUPPORT: "Hỗ trợ",
  TIMETABLE: "Thời khoá biểu",
  SYSTEM: "Hệ thống",
};

function getNotificationTypeLabel(type) {
  return NOTIFICATION_TYPE_LABEL[type] || type || "Thông báo";
}

// Nhãn cảnh báo học sinh (dùng cho feed của GVCN) — khớp warning_type trong DB.
const TEACHER_WARNING_LABEL = {
  AT_RISK: "Nguy cơ học lực",
  LOW_GPA: "Điểm trung bình thấp",
  DECLINING: "Kết quả đi xuống",
  MULTIPLE_FAIL: "Nhiều môn chưa đạt",
  EXCESSIVE_VIOLATION: "Vi phạm lặp lại",
  INTERVENTION: "Cần can thiệp",
  LOW_CONDUCT: "Hạnh kiểm thấp",
  ABSENCE_RISK: "Nguy cơ nghỉ học vượt ngưỡng",
};

// Đổi mốc thời gian sang dd/mm/yyyy HH:mm bằng cách CẮT CHUỖI, không dùng
// new Date(): giá trị từ MySQL đã là giờ địa phương, nếu parse rồi đổi múi giờ
// sẽ bị lệch ngày (đúng cạm bẫy timezone đã gặp ở các module khác).
function formatNotificationTime(value) {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return text;
  const [, y, m, d, hh, mm] = match;
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

const NotificationToggle = forwardRef(
  function NotificationToggle(
    {
      onClick,
      unreadCount,
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Thông báo"
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        className="
          relative flex h-10 w-10
          items-center justify-center
          rounded-xl text-[#0F2747]
          transition hover:bg-[#FFE7D6]
        "
      >
        <FiBell size={21} />

        {unreadCount > 0 && (
          <span
            className="
              absolute -right-1 -top-1
              flex h-5 min-w-5 items-center
              justify-center rounded-full
              border-2 border-white
              bg-[#F27123] px-1
              text-[10px] font-bold text-white
            "
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    );
  },
);

// Thân dropdown thông báo — DÙNG CHUNG cho student / phụ huynh / giáo viên để 3
// nơi luôn giống nhau về giao diện. items đã được chuẩn hoá:
//   { key, label, title, content, time, unread, onClick }
function NotificationMenuBody({
  items,
  unreadCount,
  loading,
  error,
  allPath,
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");

  const displayItems = useMemo(() => {
    const base =
      activeTab === "unread" ? items.filter((item) => item.unread) : items;
    return base.slice(0, 6);
  }, [items, activeTab]);

  return (
    <Dropdown.Menu
      className="
        mt-2 w-[min(22rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]
        border-orange-100 p-0 shadow-xl
      "
      // borderRadius đặt inline: Bootstrap có rule unlayered
      // `.dropdown-menu { border-radius: var(--bs-dropdown-border-radius) }`
      // thắng utility `rounded-2xl` của Tailwind (đo được chỉ 6px). Inline style
      // luôn thắng nên khung mới bo đúng 16px, khớp panel của PrettySelect.
      style={{ borderRadius: "16px", overflow: "hidden" }}
    >
      {/* Header + Tabs */}
      <div className="border-b border-orange-100 px-3 pt-3 pb-2">
        <p className="mb-2 px-1 text-sm font-bold text-[#0F2747]">Thông báo</p>

        <div className="flex gap-1 rounded-xl bg-orange-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition"
            style={
              activeTab === "all"
                ? { backgroundColor: "#F27123", color: "#fff" }
                : { color: "#64748B" }
            }
          >
            Tất cả
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition"
            style={
              activeTab === "unread"
                ? { backgroundColor: "#F27123", color: "#fff" }
                : { color: "#64748B" }
            }
          >
            Chưa đọc{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        </div>
      </div>

      {/* Items — dùng flex + gap để giãn cách các thẻ, KHÔNG dùng margin trên
          <button>: Bootstrap có rule unlayered `button{margin:0}` thắng utility
          `mb-*` của Tailwind, khiến các thẻ dính sát nhau (đã đo 0px). */}
      <div className="flex max-h-100 flex-col gap-2.5 overflow-y-auto p-2.5">
        {loading && (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-6 text-center text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && displayItems.length === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <FiInbox size={20} />
            </div>
            <p className="mb-0 text-sm font-semibold text-slate-500">
              {activeTab === "unread"
                ? "Không có thông báo chưa đọc"
                : "Chưa có thông báo"}
            </p>
          </div>
        )}

        {!loading && !error && displayItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className="w-full rounded-xl px-3 py-3 text-left transition hover:brightness-95"
            style={{
              backgroundColor: item.unread ? "#FFF7F2" : "#F8FAFC",
              border: item.unread
                ? "1px solid rgba(242,113,35,0.25)"
                : "1px solid #F1F5F9",
            }}
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-[#F27123]">
                {item.label}
              </span>
              {item.unread && (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#F27123]" />
              )}
            </div>

            <p className="mb-1 line-clamp-1 text-sm font-bold text-[#0F2747]">
              {item.title}
            </p>

            <p className="mb-1.5 line-clamp-2 text-xs leading-5 text-slate-500">
              {item.content || "Không có nội dung chi tiết."}
            </p>

            <p className="mb-0 text-[11px] text-slate-400">{item.time}</p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-orange-100 px-3 py-2.5">
        <button
          type="button"
          onClick={() => navigate(allPath)}
          className="
            inline-flex w-full items-center justify-center gap-2
            rounded-xl bg-[#F27123] px-4 py-2.5
            text-sm font-bold text-white transition hover:bg-[#d95f17]
          "
        >
          <FiInbox size={16} />
          Xem tất cả thông báo
        </button>
      </div>
    </Dropdown.Menu>
  );
}

// Student / Phụ huynh: đọc bảng notification (có notificationId + is_read nên
// bấm vào là đánh dấu đã đọc được).
function NotificationDropdown({ api, allNotificationsPath }) {
  const [data, setData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const unreadCount = useMemo(() => {
    const summaryUnread = data?.summary?.unreadNotifications;
    if (summaryUnread !== undefined && summaryUnread !== null) {
      return Number(summaryUnread);
    }
    return data.items.filter((item) => !item.isRead).length;
  }, [data]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    api
      .getMyNotifications({ limit: 30 })
      .then((response) => {
        if (!mounted) return;
        setData({
          items: response?.data?.items || [],
          summary: response?.data?.summary || {},
        });
      })
      .catch((requestError) => {
        if (!mounted) return;
        setError(requestError.message || "Không tải được thông báo");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [refreshKey, api]);

  const items = useMemo(
    () =>
      data.items.map((item) => ({
        key: item.notificationId,
        label: getNotificationTypeLabel(item.type),
        title: item.title,
        content: item.content,
        time: formatNotificationTime(item.createdAt),
        unread: !item.isRead,
        onClick: async () => {
          if (item.isRead || !item.notificationId) return;
          try {
            await api.markNotificationRead(item.notificationId);
            setRefreshKey((key) => key + 1);
          } catch {
            // im lặng: không chặn người dùng chỉ vì lỗi đánh dấu đã đọc
          }
        },
      })),
    [data.items, api],
  );

  return (
    <Dropdown align="end">
      <Dropdown.Toggle as={NotificationToggle} unreadCount={unreadCount} />
      <NotificationMenuBody
        items={items}
        unreadCount={unreadCount}
        loading={loading}
        error={error}
        allPath={allNotificationsPath}
      />
    </Dropdown>
  );
}

// Giáo viên: KHÔNG đọc bảng notification (bảng này chỉ có dữ liệu cho HS/PH) mà
// dùng feed tổng hợp của GVCN: việc cần xử lý + cảnh báo học sinh + thông báo lớp.
// Vì feed là dữ liệu dẫn xuất nên không có trạng thái "đã đọc" cho từng mục:
// bấm vào sẽ điều hướng tới trang xử lý tương ứng.
function TeacherNotificationDropdown() {
  const navigate = useNavigate();

  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    teacherApi
      .getNotifications()
      .then((response) => {
        if (mounted) setFeed(response?.data ?? null);
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.message || "Không tải được thông báo");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const unreadCount = Number(feed?.counts?.unread ?? 0);

  const items = useMemo(() => {
    if (!feed) return [];

    const list = [];

    // 1) Việc cần xử lý (ưu tiên cao nhất)
    (feed.system ?? []).forEach((task) => {
      list.push({
        key: `sys-${task.key}`,
        label: "Cần xử lý",
        title: task.title,
        content: task.content,
        time: "",
        unread: true,
        onClick: () =>
          navigate(
            task.actionType === "LEAVE_REQUESTS"
              ? "/teacher/leave-requests"
              : "/teacher/announcements",
          ),
      });
    });

    // 2) Cảnh báo học sinh — "chưa đọc" = cảnh báo còn mở (status OPEN)
    (feed.alerts ?? []).forEach((alert) => {
      const isAcademic = alert.source === "ACADEMIC";
      list.push({
        key: `alert-${alert.warningId}`,
        label: isAcademic ? "Cảnh báo học tập" : "Cảnh báo nề nếp",
        title: `${alert.studentName} — ${
          TEACHER_WARNING_LABEL[alert.warningType] ?? alert.warningType
        }`,
        content: alert.note || (alert.className ? `Lớp ${alert.className}` : ""),
        time: formatNotificationTime(alert.ts ?? alert.createdAt),
        unread: alert.status === "OPEN",
        onClick: () =>
          navigate(
            isAcademic
              ? `/teacher/academic/students/${alert.studentId}`
              : `/teacher/behaviour/students/${alert.studentId}`,
          ),
      });
    });

    // 3) Thông báo của lớp / trường
    (feed.school ?? []).forEach((announcement) => {
      list.push({
        key: `ann-${announcement.announcementId}`,
        label: "Thông báo",
        title: announcement.title,
        content: announcement.content,
        time: formatNotificationTime(announcement.ts ?? announcement.createdAt),
        unread: false,
        onClick: () => navigate("/teacher/announcements"),
      });
    });

    return list;
  }, [feed, navigate]);

  return (
    <Dropdown align="end">
      <Dropdown.Toggle as={NotificationToggle} unreadCount={unreadCount} />
      <NotificationMenuBody
        items={items}
        unreadCount={unreadCount}
        loading={loading}
        error={error}
        allPath="/teacher/announcements"
      />
    </Dropdown>
  );
}


function TeacherSearchBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <div className="relative hidden w-full max-w-md md:block">
      <FiSearch
        size={16}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate("/teacher/students");
        }}
        placeholder="Tìm học sinh, lớp học, hoặc điểm số..."
        className="w-full rounded-full border-none bg-[#E2E2E2] py-2 pl-10 pr-4 text-sm text-[#1A1C1C] outline-none transition focus:ring-2 focus:ring-[#9F4200]/20"
      />
    </div>
  );
}

function DashboardHeader({
  user,
  onOpenSidebar,
  showNotificationBadge = true,
}) {
  const {
    user: authUser,
  } = useAuth();

  const roleNames =
    authUser?.roles?.map((role) => role.roleName) || [];

  const isStudent = roleNames.includes("STUDENT");
  const isParent = roleNames.includes("PARENT");
  const isTeacher = ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"]
    .some((r) => roleNames.includes(r));
  const isAdmin = roleNames.includes("ADMIN");
  const isStitch = isStitchUser(authUser);

  return (
    <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center gap-3 px-3 sm:px-5 lg:px-8">
        <AppIconButton
          icon={FiMenu}
          label="Mở menu"
          onClick={onOpenSidebar}
          className="lg:hidden"
        />

        {/* FSchool teacher portal: global search (Stitch design) */}
        {isTeacher && (
          <TeacherSearchBox />
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {isStudent && (
            <NotificationDropdown
              api={studentApi}
              allNotificationsPath="/student/notifications"
            />
          )}

          {isParent && (
            <NotificationDropdown
              api={parentApi}
              allNotificationsPath="/parent/notifications"
            />
          )}

          {isTeacher && <TeacherNotificationDropdown />}

          {isAdmin && (
            <NotificationDropdown
              api={adminApi}
              allNotificationsPath="/admin/notifications"
            />
          )}

          {!isStudent && !isParent && !isTeacher && !isAdmin && (
            <AppIconButton
              icon={FiBell}
              label="Thông báo"
              badge={showNotificationBadge}
            />
          )}

          {isStitch && <div className="mx-2 h-8 w-px bg-[#DFC0B2]" />}

          <ProfileDropdown user={user} variant={isStitch ? "stitch" : "default"} />
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;