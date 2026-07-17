import {
  FiAward,
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiEdit3,
  FiFileText,
  FiFlag,
  FiGrid,
  FiLifeBuoy,
  FiMessageSquare,
  FiShield,
  FiStar,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";

export const dashboardNavigation = {
  STUDENT: [
    {
      label: "Dashboard",
      path: "/student",
      icon: FiGrid,
      end: true,
    },
    {
      label: "Thời khóa biểu",
      path: "/student/timetable",
      icon: FiClock,
    },
    {
      label: "Điểm danh",
      path: "/student/attendance",
      icon: FiCalendar,
    },
    {
      label: "Bài tập",
      path: "/student/homeworks",
      icon: FiFileText,
    },
    {
      label: "Bảng điểm",
      path: "/student/grades",
      icon: FiAward,
    },
    {
      label: "Hạnh kiểm",
      path: "/student/behaviour",
      icon: FiShield,
    },
    {
      label: "Mục tiêu",
      path: "/student/goals",
      icon: FiFlag,
    },
    {
      label: "Sự kiện",
      path: "/student/events",
      icon: FiStar,
    },
    {
      label: "Tin nhắn",
      path: "/student/messages",
      icon: FiMessageSquare,
    },
  ],

  ADMIN: [
    {
      label: "Tổng quan",
      path: "/admin",
      icon: FiGrid,
      ms: "dashboard",
      end: true,
    },
    {
      label: "Tài khoản",
      path: "/admin/users",
      icon: FiUsers,
      ms: "manage_accounts",
    },
  ],

  STAFF: [
    {
      label: "Dashboard",
      path: "/staff",
      icon: FiGrid,
      end: true,
    },
    {
      label: "Năm học",
      path: "/staff/school-years",
      icon: FiCalendar,
    },
    {
      label: "Lớp học",
      path: "/staff/classes",
      icon: FiBookOpen,
    },
    {
      label: "Học sinh",
      path: "/staff/students",
      icon: FiUsers,
    },
    {
      label: "Phụ huynh",
      path: "/staff/parents",
      icon: FiUserCheck,
    },
    {
      label: "Giáo viên",
      path: "/staff/teachers",
      icon: FiAward,
    },
    {
      label: "Lịch học",
      path: "/staff/timetable",
      icon: FiClock,
    },
    {
      label: "Học phí",
      path: "/staff/fees",
      icon: FiCreditCard,
    },
    {
      label: "Chương trình học",
      path: "/staff/curriculum",
      icon: FiFileText,
    },
    {
      label: "Báo cáo",
      path: "/staff/reports",
      icon: FiBarChart2,
    },
  ],

  TEACHER: [
    {
      label: "Tổng quan",
      path: "/teacher",
      icon: FiGrid,
      ms: "dashboard",
      end: true,
    },
    {
      label: "Điểm danh",
      path: "/teacher/attendance",
      icon: FiCalendar,
      ms: "how_to_reg",
    },
    {
      label: "Đơn nghỉ",
      path: "/teacher/leave-requests",
      icon: FiFileText,
      ms: "event_busy",
    },
    {
      label: "Lớp học",
      path: "/teacher/classes",
      icon: FiBookOpen,
      ms: "school",
    },
    {
      label: "Học sinh",
      path: "/teacher/students",
      icon: FiUsers,
      ms: "group",
    },
    {
      label: "Bài tập",
      path: "/teacher/homework",
      icon: FiEdit3,
      ms: "assignment",
    },
    {
      label: "Nề nếp",
      path: "/teacher/behaviour",
      icon: FiShield,
      ms: "rule",
    },
    {
      label: "Hạnh kiểm",
      path: "/teacher/conduct",
      icon: FiAward,
      ms: "workspace_premium",
    },
    {
      label: "Điểm số",
      path: "/teacher/academic",
      icon: FiAward,
      ms: "grade",
    },
    {
      label: "Lịch dạy/Đổi ca",
      path: "/teacher/timetable",
      icon: FiClock,
      ms: "calendar_month",
    },
    {
      label: "Họp phụ huynh",
      path: "/teacher/meetings",
      icon: FiCalendar,
      ms: "groups",
    },
    {
      label: "Liên lạc",
      path: "/teacher/messages",
      icon: FiMessageSquare,
      ms: "contact_phone",
    },
    {
      label: "Báo cáo",
      path: "/teacher/reports",
      icon: FiBarChart2,
      ms: "assessment",
    },
    {
      label: "Sự kiện",
      path: "/teacher/events",
      icon: FiStar,
      ms: "local_activity",
    },
    {
      label: "Mục tiêu",
      path: "/teacher/goals",
      icon: FiFlag,
      ms: "flag",
    },
    {
      label: "Hỗ trợ học sinh",
      path: "/teacher/support-cases",
      icon: FiLifeBuoy,
      ms: "support_agent",
    },
    {
      label: "Thông báo",
      path: "/teacher/announcements",
      icon: FiBell,
      ms: "campaign",
    },
  ],

  PARENT: [
    {
      label: "Dashboard",
      path: "/parent",
      icon: FiGrid,
      ms: "dashboard",
      end: true,
    },
    {
      label: "Học sinh",
      path: "/parent/student",
      icon: FiUsers,
      ms: "group",
    },
    {
      label: "Điểm danh",
      path: "/parent/attendance",
      icon: FiCalendar,
      ms: "how_to_reg",
    },
    {
      label: "Đơn xin nghỉ",
      path: "/parent/leave-requests",
      icon: FiBookOpen,
      ms: "event_busy",
    },
    {
      label: "Thời khóa biểu",
      path: "/parent/timetable",
      icon: FiClock,
      ms: "calendar_month",
    },
    {
      label: "Bảng điểm",
      path: "/parent/grades",
      icon: FiAward,
      ms: "grade",
    },
    {
      label: "Hạnh kiểm",
      path: "/parent/behaviour",
      icon: FiShield,
      ms: "workspace_premium",
    },
    {
      label: "Bài tập",
      path: "/parent/homework",
      icon: FiEdit3,
      ms: "assignment",
    },
    {
      label: "Học phí",
      path: "/parent/fees",
      icon: FiCreditCard,
      ms: "payments",
    },
    {
      label: "Sự kiện",
      path: "/parent/events",
      icon: FiStar,
      ms: "local_activity",
    },
    {
      label: "Họp phụ huynh",
      path: "/parent/meetings",
      icon: FiCalendar,
      ms: "groups",
    },
    {
      label: "Tin nhắn",
      path: "/parent/messages",
      icon: FiMessageSquare,
      ms: "chat",
    },
    {
      label: "Thông báo",
      path: "/parent/notifications",
      icon: FiBell,
      ms: "notifications",
    },
  ],
};
