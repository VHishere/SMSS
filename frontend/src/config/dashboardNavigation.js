import {
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiGrid,
  FiMessageSquare,
  FiSettings,
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
      label: "Học sinh",
      path: "/staff/students",
      icon: FiUsers,
    },
    {
      label: "Lớp học",
      path: "/staff/classes",
      icon: FiBookOpen,
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
      label: "Điểm danh",
      path: "/teacher/attendance",
      icon: FiCalendar,
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
      label: "Tin nhắn",
      path: "/parent/messages",
      icon: FiMessageSquare,
    },
  ],
};