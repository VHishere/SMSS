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
import './App.css';

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
                                allowedRoles={['HOMEROOM_TEACHER', 'SUBJECT_TEACHER', 'DORM_SUPERVISOR']}
                            >
                                <TeacherDashboard />
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
                            <ProtectedRoute
                                allowedRoles={["STUDENT"]}
                            >
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

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
