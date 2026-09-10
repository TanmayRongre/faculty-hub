import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { wakeUpBackend } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';

// Auth
import LoginPage from './pages/LoginPage';

// Faculty / Admin pages
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import StudentsPage from './pages/faculty/StudentsPage';
import StudentDetailPage from './pages/faculty/StudentDetailPage';
import StudentFormPage from './pages/faculty/StudentFormPage';
import FacultyListPage from './pages/faculty/FacultyListPage';
import FacultyDetailPage from './pages/faculty/FacultyDetailPage';
import FacultyFormPage from './pages/faculty/FacultyFormPage';
import AcademicStructurePage from './pages/faculty/AcademicStructurePage';
import SubjectsPage from './pages/faculty/SubjectsPage';
import SheetsStatusPage from './pages/faculty/SheetsStatusPage';
import MarksManagementPage from './pages/faculty/MarksManagementPage';
import AttendancePage from './pages/faculty/AttendancePage';
import FacultyTimetablePage from './pages/faculty/FacultyTimetablePage';
import LeaveSubstitutionPage from './pages/faculty/LeaveSubstitutionPage';
import FacultyNoticesPage from './pages/faculty/FacultyNoticesPage';
import TaskManagementPage from './pages/faculty/TaskManagementPage';

// Root redirect — FacultyHub is a Faculty & Admin only platform
const RootRedirect = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to="/faculty/dashboard" replace />;
};

const App = () => {
  useEffect(() => {
    wakeUpBackend();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1e293b' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
          }}
        />
        <Routes>
          {/* Public Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Faculty / Admin Workspaces ───────────────────────── */}
          <Route
            path="/faculty/dashboard"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />

          {/* Academic Student Records Management (Faculty/Admin only) */}
          <Route
            path="/faculty/students"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <StudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/students/new"
            element={
              <ProtectedRoute roles={['admin']}>
                <StudentFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/students/:id"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <StudentDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/students/:id/edit"
            element={
              <ProtectedRoute roles={['admin']}>
                <StudentFormPage />
              </ProtectedRoute>
            }
          />

          {/* Faculty Management (Admin only / Directory for Faculty) */}
          <Route
            path="/faculty/faculty"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <FacultyListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/faculty/new"
            element={
              <ProtectedRoute roles={['admin']}>
                <FacultyFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/faculty/:id"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <FacultyDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/faculty/:id/edit"
            element={
              <ProtectedRoute roles={['admin']}>
                <FacultyFormPage />
              </ProtectedRoute>
            }
          />

          {/* Academic Structure & Subjects */}
          <Route
            path="/faculty/academic"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <AcademicStructurePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/subjects"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <SubjectsPage />
              </ProtectedRoute>
            }
          />

          {/* Google Sheets Integration — Admin only */}
          <Route
            path="/faculty/sheets"
            element={
              <ProtectedRoute roles={['admin']}>
                <SheetsStatusPage />
              </ProtectedRoute>
            }
          />

          {/* Marks Management (MSBTE Scheme) — Faculty + Admin */}
          <Route
            path="/faculty/marks"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <MarksManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Fast Attendance Management — Faculty + Admin */}
          <Route
            path="/faculty/attendance"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />

          {/* Timetable — Faculty + Admin */}
          <Route
            path="/faculty/timetable"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <FacultyTimetablePage />
              </ProtectedRoute>
            }
          />

          {/* Faculty Leave & Substitution — Faculty + Admin */}
          <Route
            path="/faculty/leave"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <LeaveSubstitutionPage />
              </ProtectedRoute>
            }
          />

          {/* Campus Notices & Announcements — Faculty + Admin */}
          <Route
            path="/faculty/notices"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <FacultyNoticesPage />
              </ProtectedRoute>
            }
          />

          {/* Task Management — Faculty + Admin */}
          <Route
            path="/faculty/tasks"
            element={
              <ProtectedRoute roles={['faculty', 'admin']}>
                <TaskManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Decommissioned Student Routes Fallback — redirect to login without blank screen */}
          <Route path="/student/*" element={<Navigate to="/login" replace />} />

          {/* Root & Catch-all */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;