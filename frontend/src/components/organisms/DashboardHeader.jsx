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
} from "react-icons/fi";

import { parentApi, studentApi } from "../../api/client";
import {
  useAuth,
} from "../../context/useAuth";

import AppIconButton from "../atoms/AppIconButton";
import ProfileDropdown from "../molecules/ProfileDropdown";

function getNotificationTypeLabel(type) {
  const map = {
    HOMEWORK: "Bài tập",
    ATTENDANCE: "Điểm danh",
    GRADE: "Bảng điểm",
    BEHAVIOUR: "Hạnh kiểm",
    EVENT: "Sự kiện",
    MESSAGE: "Tin nhắn",
    SYSTEM: "Hệ thống",
  };

  return map[type] || type || "Thông báo";
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

function NotificationDropdown({ api, allNotificationsPath }) {
  const navigate = useNavigate();

  const [data, setData] = useState({
    items: [],
    summary: {},
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const unreadCount = useMemo(() => {
    const summaryUnread =
      data?.summary?.unreadNotifications;

    if (
      summaryUnread !== undefined &&
      summaryUnread !== null
    ) {
      return Number(summaryUnread);
    }

    return data.items.filter((item) => !item.isRead).length;
  }, [data]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    api
      .getMyNotifications()
      .then((response) => {
        if (!mounted) return;

        setData({
          items: response?.data?.items || [],
          summary: response?.data?.summary || {},
        });
      })
      .catch((requestError) => {
        if (!mounted) return;

        setError(
          requestError.message ||
            "Không tải được thông báo",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [refreshKey, api]);

  async function markRead(notificationId) {
    if (!notificationId) return;

    try {
      await api.markNotificationRead(notificationId);

      setRefreshKey((key) => key + 1);
    } catch {
      // Không chặn UI nếu lỗi nhỏ khi đánh dấu đã đọc.
    }
  }

  function goToAllNotifications() {
    navigate(allNotificationsPath);
  }

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        as={NotificationToggle}
        unreadCount={unreadCount}
      />

      <Dropdown.Menu
        className="
          mt-2 w-[360px] max-w-[calc(100vw-32px)]
          rounded-2xl border-orange-100
          p-0 shadow-xl
        "
      >
        <div
          className="
            border-b border-orange-100
            px-4 py-3
          "
        >
          <p className="mb-0 text-sm font-bold text-[#0F2747]">
            Thông báo
          </p>

          <p className="mb-0 text-xs text-slate-500">
            {unreadCount} thông báo chưa đọc
          </p>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              Đang tải thông báo...
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-6 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && data.items.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div
                className="
                  mx-auto mb-3 flex h-12 w-12
                  items-center justify-center
                  rounded-full bg-slate-100
                  text-slate-400
                "
              >
                <FiInbox size={20} />
              </div>

              <p className="mb-0 text-sm font-semibold text-slate-500">
                Chưa có thông báo
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            data.items.slice(0, 6).map((item) => (
              <button
                key={item.notificationId}
                type="button"
                onClick={() => {
                  if (!item.isRead) {
                    markRead(item.notificationId);
                  }
                }}
                className="
                  mb-2 w-full rounded-xl
                  bg-white px-3 py-3
                  text-left transition
                  hover:bg-orange-50
                "
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <span
                    className="
                      rounded-full bg-orange-50
                      px-2 py-0.5
                      text-[11px] font-bold
                      text-[#F27123]
                    "
                  >
                    {getNotificationTypeLabel(item.type)}
                  </span>

                  {!item.isRead && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#F27123]" />
                  )}
                </div>

                <p className="mb-1 line-clamp-1 text-sm font-bold text-[#0F2747]">
                  {item.title}
                </p>

                <p className="mb-2 line-clamp-2 text-xs leading-5 text-slate-500">
                  {item.content || "Không có nội dung chi tiết."}
                </p>

                <p className="mb-0 text-[11px] text-slate-400">
                  {item.createdAt || ""}
                </p>
              </button>
            ))}
        </div>

        <div className="border-t border-orange-100 px-4 py-3">
          <button
            type="button"
            onClick={goToAllNotifications}
            className="
              inline-flex w-full items-center
              justify-center gap-2
              rounded-xl bg-[#F27123]
              px-4 py-2.5 text-sm
              font-bold text-white
              transition hover:bg-[#d95f17]
            "
          >
            <FiInbox size={16} />
            Xem tất cả thông báo
          </button>
        </div>
      </Dropdown.Menu>
    </Dropdown>
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

  return (
    <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center px-4 sm:px-6 lg:px-8">
        <AppIconButton
          icon={FiMenu}
          label="Mở menu"
          onClick={onOpenSidebar}
          className="lg:hidden"
        />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
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

          {!isStudent && !isParent && (
            <AppIconButton
              icon={FiBell}
              label="Thông báo"
              badge={showNotificationBadge}
            />
          )}

          <ProfileDropdown user={user} />
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;