import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

import {
  adminApi,
  parentApi,
  staffApi,
  studentApi,
  studentProfileApi,
  supervisorApi,
  teacherApi,
} from "../../api/client";
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

// ── "Đã đọc" cho các feed dẫn xuất (GIÁO VIÊN & QUẢN NHIỆM) ──────────────────
// Hai feed này tổng hợp từ nhiều bảng nên từng mục không có cột is_read như bảng
// notification của HS/PH. Trạng thái đã đọc lưu ở DB (notification_read_state):
// server trả `readKeys`, bấm item thì POST .../notifications/read.
// → bền theo TÀI KHOẢN, reload / đổi máy / đổi trình duyệt vẫn giữ đã đọc.
//
// Hook dùng chung: gộp readKeys từ server với các key vừa bấm (optimistic) để
// badge trừ ngay, không phải chờ refetch.
function useFeedReadState(feed, markReadApi) {
  const [justRead, setJustRead] = useState(() => new Set());

  const seen = useMemo(
    () => new Set([...(feed?.readKeys ?? []), ...justRead]),
    [feed, justRead],
  );

  const markSeen = useCallback(
    async (key) => {
      setJustRead((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
      try {
        await markReadApi(key);
      } catch {
        // im lặng: không chặn điều hướng chỉ vì lỗi đánh dấu đã đọc
      }
    },
    [markReadApi],
  );

  return { seen, markSeen };
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

  // Đồng bộ với thao tác đọc ở NƠI KHÁC (trang thông báo, hoặc mark-all): các hàm
  // markNotification(All)Read phát "notifications:changed" → dropdown refetch để
  // badge số chưa đọc trừ NGAY, không phải đợi chuyển trang / remount header.
  useEffect(() => {
    const onChanged = () => setRefreshKey((key) => key + 1);
    window.addEventListener("notifications:changed", onChanged);
    return () => window.removeEventListener("notifications:changed", onChanged);
  }, []);

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
            // markNotificationRead phát "notifications:changed" → dropdown tự refetch
            await api.markNotificationRead(item.notificationId);
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

  // Trạng thái "đã đọc" lấy từ DB (feed.readKeys) + key vừa bấm (optimistic).
  const { seen, markSeen } = useFeedReadState(feed, teacherApi.markNotificationRead);

  const items = useMemo(() => {
    if (!feed) return [];

    const list = [];

    // 1) Việc cần xử lý (ưu tiên cao nhất)
    (feed.system ?? []).forEach((task) => {
      const key = `sys-${task.key}`;
      list.push({
        key,
        label: "Cần xử lý",
        title: task.title,
        content: task.content,
        time: "",
        unread: !seen.has(key),
        // await để chắc chắn ghi DB xong rồi mới điều hướng (điều hướng làm
        // header remount + refetch feed; nếu chưa ghi xong badge sẽ nhảy lại).
        onClick: async () => {
          await markSeen(key);
          navigate(
            task.actionType === "LEAVE_REQUESTS"
              ? "/teacher/leave-requests"
              : "/teacher/announcements",
          );
        },
      });
    });

    // 2) Cảnh báo học sinh — "chưa đọc" = cảnh báo còn mở (OPEN) & chưa bấm xem
    (feed.alerts ?? []).forEach((alert) => {
      const isAcademic = alert.source === "ACADEMIC";
      const key = `alert-${alert.warningId}`;
      list.push({
        key,
        label: isAcademic ? "Cảnh báo học tập" : "Cảnh báo nề nếp",
        title: `${alert.studentName} — ${
          TEACHER_WARNING_LABEL[alert.warningType] ?? alert.warningType
        }`,
        content: alert.note || (alert.className ? `Lớp ${alert.className}` : ""),
        time: formatNotificationTime(alert.ts ?? alert.createdAt),
        unread: alert.status === "OPEN" && !seen.has(key),
        onClick: async () => {
          await markSeen(key);
          navigate(
            isAcademic
              ? `/teacher/academic/students/${alert.studentId}`
              : `/teacher/behaviour/students/${alert.studentId}`,
          );
        },
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
  }, [feed, navigate, seen, markSeen]);

  // Badge = số item đang "chưa đọc" (đã tính cả trạng thái đã xem ở trên).
  const unreadCount = items.filter((item) => item.unread).length;

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

// Giáo viên quản nhiệm (DORM_SUPERVISOR): chuông dùng FEED DORM riêng — đơn nghỉ
// đang chờ GVQN duyệt + việc trực còn tồn. Bấm item → ghi đã đọc xuống DB
// (notification_read_state, giống feed giáo viên) → badge trừ → rồi điều hướng.
function SupervisorNotificationDropdown() {
  const navigate = useNavigate();

  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Trạng thái "đã đọc" lấy từ DB (feed.readKeys) + key vừa bấm (optimistic).
  const { seen, markSeen } = useFeedReadState(feed, supervisorApi.markNotificationRead);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    supervisorApi
      .getNotifications()
      .then((response) => { if (mounted) setFeed(response?.data ?? null); })
      .catch((requestError) => {
        if (mounted) setError(requestError.message || "Không tải được thông báo");
      })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, []);

  const items = useMemo(() => {
    if (!feed) return [];

    const list = [];

    // 1) Đơn nghỉ chờ quản nhiệm duyệt (ưu tiên)
    (feed.leaveApprovals ?? []).forEach((lv) => {
      const key = `lv-${lv.id}`;
      list.push({
        key,
        label: "Duyệt nghỉ",
        title: `${lv.studentName} · đơn nghỉ${lv.leaveType ? ` ${lv.leaveType}` : ""}`,
        content: lv.className ? `Lớp ${lv.className} · chờ bạn duyệt` : "Chờ quản nhiệm duyệt",
        time: "",
        unread: !seen.has(key),
        // await để ghi DB xong rồi mới điều hướng (tránh badge nhảy lại khi
        // header remount và refetch feed).
        onClick: async () => {
          await markSeen(key);
          navigate("/supervisor/leave-approvals");
        },
      });
    });

    // 2) Việc cần làm trong ca trực còn tồn
    (feed.tasks ?? []).forEach((t) => {
      const key = `task-${t.taskId}`;
      list.push({
        key,
        label: "Việc trực",
        title: t.title,
        content: [t.note, t.dueTime ? `Hạn ${t.dueTime}` : null].filter(Boolean).join(" · "),
        time: "",
        unread: !seen.has(key),
        onClick: async () => {
          await markSeen(key);
          navigate("/supervisor");
        },
      });
    });

    return list;
  }, [feed, navigate, seen, markSeen]);

  // Badge = số item CHƯA đọc (đã trừ mục đã bấm xem), không lấy cứng từ server.
  const unreadCount = items.filter((item) => item.unread).length;

  return (
    <Dropdown align="end">
      <Dropdown.Toggle as={NotificationToggle} unreadCount={unreadCount} />
      <NotificationMenuBody
        items={items}
        unreadCount={unreadCount}
        loading={loading}
        error={error}
        allPath="/supervisor/leave-approvals"
      />
    </Dropdown>
  );
}


// Bỏ dấu tiếng Việt + thường hoá để so khớp gợi ý không phân biệt dấu/hoa-thường.
function normText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

// ── Nguồn gợi ý theo role: trả [{ key, label, sublabel, to }] ────────────────
// Lỗi/không có dữ liệu → trả [] (Enter điều hướng vẫn hoạt động bình thường).

// Chuẩn hoá về MẢNG dù API trả array trực tiếp hay bọc trong object
// ({ items } / { homeworks } / { students } / { children }). Không bao giờ map
// nhầm cả object thành phần tử.
function asArray(d) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== "object") return [];
  for (const k of ["items", "homeworks", "students", "children", "data"]) {
    if (Array.isArray(d[k])) return d[k];
  }
  return [];
}

async function loadStaffStudents() {
  const res = await staffApi.getStudents();
  return asArray(res?.data).map((s) => ({
    key: `st-${s.studentId}`,
    label: s.fullName ?? s.studentName ?? "",
    sublabel: [s.studentCode, s.className].filter(Boolean).join(" · "),
    to: `/staff/students/${s.studentId}`,
  }));
}

async function loadStudentHomeworks() {
  const res = await studentApi.getMyHomeworks();
  return asArray(res?.data).map((h) => ({
    key: `hw-${h.homeworkId}`,
    label: h.title ?? "",
    sublabel: h.subjectName ?? "",
    to: `/student/homeworks/${h.homeworkId}`,
  }));
}

async function loadParentChildren() {
  const res = await parentApi.getMyStudents();
  return asArray(res?.data).map((c) => ({
    key: `ch-${c.studentId}`,
    label: c.studentFullName ?? c.fullName ?? c.studentName ?? "",
    sublabel: c.className ?? "",
    to: `/parent/student/${c.studentId}`,
  }));
}

async function loadTeacherStudents() {
  const dash = await teacherApi.getDashboardSummary().catch(() => null);
  const classId =
    dash?.data?.primaryClass?.classId ?? dash?.data?.primaryClass?.id;
  if (!classId) return [];
  // Endpoint của GIÁO VIÊN (/teachers/students/overview) — data.students.
  // KHÔNG dùng getStudentsClassOverview vì nó gọi /admin/... (teacher bị 403).
  const res = await studentProfileApi.getClassOverview(classId);
  return asArray(res?.data).map((s) => ({
    key: `ts-${s.studentId}`,
    label: s.studentName ?? s.fullName ?? "",
    sublabel: s.studentCode ?? s.className ?? "",
    to: `/teacher/students/${s.studentId}`,
  }));
}

// Ô tìm kiếm header có DROPDOWN GỢI Ý. Gõ → lọc danh sách (nạp 1 lần qua
// loadItems rồi cache) và hiện mục khớp; bấm mục → tới trang chi tiết. Enter khi
// KHÔNG chọn mục → tới trang danh sách kèm ?search= để trang đó tự lọc.
function HeaderSearchBox({ to, placeholder, loadItems, enterToFirstMatch = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = chưa nạp
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const loadedRef = useRef(false);

  const ensureLoaded = useCallback(() => {
    if (loadedRef.current || !loadItems) return;
    loadedRef.current = true;
    loadItems()
      .then((list) => setItems(Array.isArray(list) ? list : []))
      .catch(() => setItems([]));
  }, [loadItems]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const matches = useMemo(() => {
    const kw = normText(q.trim());
    if (!kw || !items) return [];
    return items
      .filter(
        (it) => normText(it.label).includes(kw) || normText(it.sublabel).includes(kw),
      )
      .slice(0, 8);
  }, [q, items]);

  function goList() {
    const kw = q.trim();
    navigate(kw ? `${to}?search=${encodeURIComponent(kw)}` : to);
    setOpen(false);
  }

  function pick(it) {
    navigate(it.to);
    setOpen(false);
    setQ("");
    setActive(-1);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      // Ưu tiên mục đang chọn; nếu không chọn mà bật enterToFirstMatch (parent —
      // trang đích là hồ sơ 1 con, không lọc được) thì nhảy vào mục khớp đầu tiên.
      const chosen =
        active >= 0 ? matches[active] : enterToFirstMatch ? matches[0] : null;
      if (chosen) pick(chosen);
      else goList();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-md md:block">
      <FiSearch
        size={16}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        value={q}
        onChange={(e) => {
          ensureLoaded();
          setQ(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => {
          ensureLoaded();
          if (q.trim()) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-full border-none bg-[#E2E2E2] py-2 pl-10 pr-4 text-sm text-[#1A1C1C] outline-none transition focus:ring-2 focus:ring-[#9F4200]/20"
      />

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-2xl border border-orange-100 bg-white py-1 shadow-xl">
          {matches.length === 0 ? (
            <p className="mb-0 px-4 py-3 text-sm text-slate-400">
              {items === null
                ? "Đang tải gợi ý..."
                : "Không tìm thấy kết quả phù hợp"}
            </p>
          ) : (
            matches.map((it, i) => (
              <button
                key={it.key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === active ? "bg-[#FFF7F2]" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[11px] font-bold text-[#F27123]">
                  {it.label?.trim()?.[0]?.toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#0F2747]">
                    {it.label}
                  </span>
                  {it.sublabel && (
                    <span className="block truncate text-xs text-slate-400">
                      {it.sublabel}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DashboardHeader({
  user,
  onOpenSidebar,
  // Mặc định KHÔNG hiện chấm đỏ: chỉ dùng cho role chưa có nguồn thông báo thật,
  // bật lên sẽ thành báo giả (bug cũ của chuông STAFF).
  showNotificationBadge = false,
}) {
  const {
    user: authUser,
  } = useAuth();

  const roleNames =
    authUser?.roles?.map((role) => role.roleName) || [];

  const isStudent = roleNames.includes("STUDENT");
  const isParent = roleNames.includes("PARENT");
  const isStaff = roleNames.includes("STAFF");
  const isTeacher = ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"]
    .some((r) => roleNames.includes(r));
  const isAdmin = roleNames.includes("ADMIN");
  // GVQN thuần (chỉ DORM_SUPERVISOR, không phải GVCN/GVBM) → chuông dùng feed dorm
  // riêng, vì feed teacher rỗng với người không có hồ sơ giáo viên.
  const isTeacherProper = roleNames.includes("HOMEROOM_TEACHER") || roleNames.includes("SUBJECT_TEACHER");
  const isSupervisorOnly = roleNames.includes("DORM_SUPERVISOR") && !isTeacherProper && !isAdmin && !isStudent && !isParent;
  const isStitch = isStitchUser(authUser);

  // Đích tìm kiếm theo role (trang danh sách phù hợp nhất). Teacher giữ nguyên.
  const search = isTeacher
    ? { to: "/teacher/students", placeholder: "Tìm học sinh, lớp học, hoặc điểm số...", loadItems: loadTeacherStudents }
    : isStaff
      ? { to: "/staff/students", placeholder: "Tìm học sinh, lớp học...", loadItems: loadStaffStudents }
      : isStudent
        ? { to: "/student/homeworks", placeholder: "Tìm bài tập, môn học...", loadItems: loadStudentHomeworks }
        : isParent
          ? { to: "/parent/student", placeholder: "Tìm thông tin học tập của con...", loadItems: loadParentChildren, enterToFirstMatch: true }
          : null;

  return (
    <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center gap-3 px-3 sm:px-5 lg:px-8">
        <AppIconButton
          icon={FiMenu}
          label="Mở menu"
          onClick={onOpenSidebar}
          className="lg:hidden"
        />

        {/* Ô tìm kiếm trên header — teacher / staff / student / phụ huynh */}
        {search && (
          <HeaderSearchBox
            to={search.to}
            placeholder={search.placeholder}
            loadItems={search.loadItems}
            enterToFirstMatch={search.enterToFirstMatch}
          />
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

          {isTeacherProper && <TeacherNotificationDropdown />}

          {isSupervisorOnly && <SupervisorNotificationDropdown />}

          {isAdmin && (
            <NotificationDropdown
              api={adminApi}
              allNotificationsPath="/admin/notifications"
            />
          )}

          {/* STAFF (không kiêm ADMIN — admin đã có hộp thư riêng ở trên) */}
          {isStaff && !isAdmin && (
            <NotificationDropdown
              api={staffApi}
              allNotificationsPath="/staff/notifications"
            />
          )}

          {/* Role chưa có nguồn thông báo: chuông tĩnh, mặc định KHÔNG chấm đỏ
              (trước đây prop mặc định true nên luôn báo "có thông báo" dù rỗng). */}
          {!isStudent && !isParent && !isTeacherProper && !isSupervisorOnly
            && !isAdmin && !isStaff && (
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