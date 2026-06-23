import {
  FiAward,
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiEdit3,
  FiFileText,
  FiFlag,
  FiGrid,
  FiMessageSquare,
  FiLifeBuoy,
  FiSettings,
  FiShield,
  FiStar,
  FiTrendingUp,
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
      label: "Class",
      path: "/classes",
      icon: FiBookOpen,
    },
    {
      label: "Attendance",
      path: "/attendance",
      icon: FiCalendar,
    },
    {
      label: "Giáo viên",
      path: "/teachers",
      icon: FiUserCheck,
    },
    {
      label: "Timetable",
      path: "/student/timetable",
      icon: FiClock,
    },
    {
      label: "Homework",
      path: "/student/homeworks",
      icon: FiFileText,
    },
    {
      label: "Mark Report",
      path: "/student/grades",
      icon: FiAward,
    },
    {
      label: "Reports",
      path: "/reports",
      icon: FiBarChart2,
    },
    {
      label: "Semester Goal",
      path: "/settings",
      icon: FiSettings,
    },
  ],

  ADMIN: [
    {
      label: "Dashboard",
      path: "/admin",
      icon: FiGrid,
      end: true,
    },
    {
      label: "Tài khoản",
      path: "/admin/users",
      icon: FiUsers,
    },
    {
      label: "Lớp học",
      path: "/admin/classes",
      icon: FiBookOpen,
    },
    {
      label: "Báo cáo",
      path: "/admin/reports",
      icon: FiBarChart2,
    },
    {
      label: "Cài đặt",
      path: "/admin/settings",
      icon: FiSettings,
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
      label: "Lên khối",
      path: "/staff/promotion",
      icon: FiTrendingUp,
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
      label: "Báo cáo",
      path: "/staff/reports",
      icon: FiBarChart2,
    },
  ],

  TEACHER: [
    {
      label: "Dashboard",
      path: "/teacher",
      icon: FiGrid,
      end: true,
    },
    {
      label: "Lớp phụ trách",
      path: "/teacher/classes",
      icon: FiBookOpen,
    },
    {
      label: "Học sinh",
      path: "/teacher/students",
      icon: FiUsers,
    },
    {
      label: "Ca hỗ trợ",
      path: "/teacher/support-cases",
      icon: FiLifeBuoy,
    },
    {
      label: "Điểm danh",
      path: "/teacher/attendance",
      icon: FiCalendar,
    },
    {
      label: "Đơn xin nghỉ",
      path: "/teacher/leave-requests",
      icon: FiFileText,
    },
    {
      label: "Bài tập",
      path: "/teacher/homework",
      icon: FiEdit3,
    },
    {
      label: "Kết quả học tập",
      path: "/teacher/academic",
      icon: FiAward,
    },
    {
      label: "Hạnh kiểm",
      path: "/teacher/behaviour",
      icon: FiShield,
    },
    {
      label: "Mục tiêu",
      path: "/teacher/goals",
      icon: FiFlag,
    },
    {
      label: "Họp phụ huynh",
      path: "/teacher/meetings",
      icon: FiCalendar,
    },
    {
      label: "Sự kiện",
      path: "/teacher/events",
      icon: FiStar,
    },
    {
      label: "Thời khóa biểu",
      path: "/teacher/timetable",
      icon: FiClock,
    },
    {
      label: "Tin nhắn",
      path: "/teacher/messages",
      icon: FiMessageSquare,
    },
    {
      label: "Thông báo",
      path: "/teacher/announcements",
      icon: FiBell,
    },
    {
      label: "Báo cáo",
      path: "/teacher/reports",
      icon: FiBarChart2,
    },
  ],

  PARENT: [
    {
      label: "Dashboard",
      path: "/parent",
      icon: FiGrid,
      end: true,
    },
    {
      label: "Thông tin học sinh",
      path: "/parent/student",
      icon: FiUsers,
    },
    {
      label: "Điểm danh",
      path: "/parent/attendance",
      icon: FiCalendar,
    },
    {
      label: "Đơn xin nghỉ",
      path: "/parent/leave-requests",
      icon: FiBookOpen,
    },
    {
      label: "Thời khóa biểu",
      path: "/parent/timetable",
      icon: FiClock,
    },
    {
      label: "Bảng điểm",
      path: "/parent/grades",
      icon: FiAward,
    },
    {
      label: "Hạnh kiểm",
      path: "/parent/behaviour",
      icon: FiShield,
    },
    {
      label: "Tin nhắn",
      path: "/parent/messages",
      icon: FiMessageSquare,
    },
  ],
};