import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/dashboards/AdminDashboard';
import { StaffDashboard } from './pages/dashboards/StaffDashboard';
import { TeacherDashboard } from './pages/dashboards/TeacherDashboard';
import ParentDashboard from './pages/dashboards/ParentDashboard';
import StudentDashboard from "./pages/dashboards/StudentDashboard";
import StudentTimetable from "./pages/student/StudentTimetable";
import ParentStudentTimetable from "./pages/parent/StudentTimetable";
import ParentStudentAttendanceHistory from "./pages/parent/StudentAttendanceHistory";
import ParentStudentLeaveRequests from "./pages/parent/StudentLeaveRequests";
import AttendancePage from "./pages/teacher/AttendancePage";
import LeaveRequestsPage from "./pages/teacher/LeaveRequestsPage";
import HomeworkPage from "./pages/teacher/HomeworkPage";
import HomeworkDetailPage from "./pages/teacher/HomeworkDetailPage";
import AcademicPage from "./pages/teacher/AcademicPage";
import StudentAcademicProfilePage from "./pages/teacher/StudentAcademicProfilePage";
import BehaviourPage from "./pages/teacher/BehaviourPage";
import StudentBehaviourProfilePage from "./pages/teacher/StudentBehaviourProfilePage";
import StudentsOverviewPage from "./pages/teacher/StudentsOverviewPage";
import StudentProfilePage from "./pages/teacher/StudentProfilePage";
import GoalManagementPage from "./pages/teacher/GoalManagementPage";
import ReportsPage from "./pages/teacher/ReportsPage";
import ReportBuilderPage from "./pages/teacher/ReportBuilderPage";
import MessagesPage from "./pages/teacher/MessagesPage";
import AnnouncementsPage from "./pages/teacher/AnnouncementsPage";
import MeetingsPage from "./pages/teacher/MeetingsPage";
import MeetingDetailPage from "./pages/teacher/MeetingDetailPage";
import EventsPage from "./pages/teacher/EventsPage";
import EventDetailPage from "./pages/teacher/EventDetailPage";
import TeacherTimetablePage from "./pages/teacher/TeacherTimetablePage";
import SupportCasesPage from "./pages/teacher/SupportCasesPage";
import './App.css';

const TEACHER_ROLES = ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER', 'DORM_SUPERVISOR'];

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login/school" element={<LoginPage portal="school" />} />
                    <Route path="/login/parent" element={<LoginPage portal="parent" />} />

                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/staff"
                        element={
                            <ProtectedRoute allowedRoles={['STAFF']}>
                                <StaffDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher"
                        element={
                            <ProtectedRoute
                                allowedRoles={['HOMEROOM_TEACHER', 'SUBJECT_TEACHER', 'DORM_SUPERVISOR','TEACHER_ROLES']}
                            >
                                <TeacherDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/attendance"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <AttendancePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/leave-requests"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <LeaveRequestsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/homework"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <HomeworkPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/homework/:homeworkId"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <HomeworkDetailPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/academic"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <AcademicPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/academic/students/:studentId"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <StudentAcademicProfilePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/behaviour"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <BehaviourPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/behaviour/students/:studentId"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <StudentBehaviourProfilePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/students"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <StudentsOverviewPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/students/:studentId"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <StudentProfilePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/goals"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <GoalManagementPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/reports"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <ReportsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/reports/builder"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <ReportBuilderPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/messages"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <MessagesPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/announcements"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <AnnouncementsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/meetings"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <MeetingsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/meetings/:meetingId"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <MeetingDetailPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/events"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <EventsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/events/:eventId"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <EventDetailPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/timetable"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <TeacherTimetablePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/support-cases"
                        element={
                            <ProtectedRoute allowedRoles={TEACHER_ROLES}>
                                <SupportCasesPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/parent"
                        element={
                            <ProtectedRoute allowedRoles={['PARENT']}>
                                <ParentDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/student"
                        element={
                            <ProtectedRoute allowedRoles={['STUDENT']}>
                                <StudentDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/student/timetable"
                        element={
                            <ProtectedRoute allowedRoles={["STUDENT"]}>
                                <StudentTimetable />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/parent/timetable"
                        element={
                            <ProtectedRoute allowedRoles={['PARENT']}>
                                <ParentStudentTimetable />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/parent/attendance"
                        element={
                            <ProtectedRoute allowedRoles={['PARENT']}>
                                <ParentStudentAttendanceHistory />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/parent/leave-requests"
                        element={
                            <ProtectedRoute allowedRoles={['PARENT']}>
                                <ParentStudentLeaveRequests />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
