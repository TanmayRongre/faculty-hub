import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import FacultyResourcesPage from './pages/faculty/FacultyResourcesPage';
import FacultyNoticesPage from './pages/faculty/FacultyNoticesPage';
import FacultyGalleryPage from './pages/faculty/FacultyGalleryPage';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentProfilePage from './pages/student/StudentProfilePage';
import StudentMarksPage from './pages/student/StudentMarksPage';
import StudentAttendancePage from './pages/student/StudentAttendancePage';
import StudentTimetablePage from './pages/student/StudentTimetablePage';
import StudentResourcesPage from './pages/student/StudentResourcesPage';
import StudentNoticesPage from './pages/student/StudentNoticesPage';
import StudentGalleryPage from './pages/student/StudentGalleryPage';

// Root redirect
const RootRedirect = () => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'student') return <Navigate to="/student/dashboard" replace />;
  return <Navigate to="/faculty/dashboard" replace />;
};

const App = () => (
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
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── Faculty / Admin ───────────────────────────────────── */}
        <Route path="/faculty/dashboard" element={
          <ProtectedRoute roles={['faculty', 'admin']}><FacultyDashboard /></ProtectedRoute>
        } />

        {/* Students management */}
        <Route path="/faculty/students" element={
          <ProtectedRoute roles={['faculty', 'admin']}><StudentsPage /></ProtectedRoute>
        } />
        <Route path="/faculty/students/new" element={
          <ProtectedRoute roles={['admin']}><StudentFormPage /></ProtectedRoute>
        } />
        <Route path="/faculty/students/:id" element={
          <ProtectedRoute roles={['faculty', 'admin']}><StudentDetailPage /></ProtectedRoute>
        } />
        <Route path="/faculty/students/:id/edit" element={
          <ProtectedRoute roles={['admin']}><StudentFormPage /></ProtectedRoute>
        } />

        {/* Faculty management */}
        <Route path="/faculty/faculty" element={
          <ProtectedRoute roles={['faculty', 'admin']}><FacultyListPage /></ProtectedRoute>
        } />
        <Route path="/faculty/faculty/new" element={
          <ProtectedRoute roles={['admin']}><FacultyFormPage /></ProtectedRoute>
        } />
        <Route path="/faculty/faculty/:id" element={
          <ProtectedRoute roles={['faculty', 'admin']}><FacultyDetailPage /></ProtectedRoute>
        } />
        <Route path="/faculty/faculty/:id/edit" element={
          <ProtectedRoute roles={['admin']}><FacultyFormPage /></ProtectedRoute>
        } />

        {/* Academic structure */}
        <Route path="/faculty/academic" element={
          <ProtectedRoute roles={['faculty', 'admin']}><AcademicStructurePage /></ProtectedRoute>
        } />
        <Route path="/faculty/subjects" element={
          <ProtectedRoute roles={['faculty', 'admin']}><SubjectsPage /></ProtectedRoute>
        } />

        {/* Google Sheets integration — admin only */}
        <Route path="/faculty/sheets" element={
          <ProtectedRoute roles={['admin']}><SheetsStatusPage /></ProtectedRoute>
        } />

        {/* Marks management — faculty + admin */}
        <Route path="/faculty/marks" element={
          <ProtectedRoute roles={['faculty', 'admin']}><MarksManagementPage /></ProtectedRoute>
        } />

        {/* Fast Attendance — faculty + admin */}
        <Route path="/faculty/attendance" element={
          <ProtectedRoute roles={['faculty', 'admin']}><AttendancePage /></ProtectedRoute>
        } />

        {/* Smart Scheduler & Timetable — faculty + admin */}
        <Route path="/faculty/timetable" element={
          <ProtectedRoute roles={['faculty', 'admin']}><FacultyTimetablePage /></ProtectedRoute>
        } />

        {/* Resources & Notes — faculty + admin */}
        <Route path="/faculty/resources" element={
          <ProtectedRoute roles={['faculty', 'admin']}><FacultyResourcesPage /></ProtectedRoute>
        } />

        {/* Campus Notices & Circulars — faculty + admin */}
        <Route path="/faculty/notices" element={
          <ProtectedRoute roles={['faculty', 'admin']}><FacultyNoticesPage /></ProtectedRoute>
        } />

        {/* Extracurricular Activity Moderation — faculty + admin */}
        <Route path="/faculty/gallery" element={
          <ProtectedRoute roles={['faculty', 'admin']}><FacultyGalleryPage /></ProtectedRoute>
        } />

        {/* ── Student ───────────────────────────────────────────── */}
        <Route path="/student/dashboard" element={
          <ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>
        } />
        <Route path="/student/profile" element={
          <ProtectedRoute roles={['student']}><StudentProfilePage /></ProtectedRoute>
        } />
        <Route path="/student/marks" element={
          <ProtectedRoute roles={['student']}><StudentMarksPage /></ProtectedRoute>
        } />
        <Route path="/student/attendance" element={
          <ProtectedRoute roles={['student']}><StudentAttendancePage /></ProtectedRoute>
        } />
        <Route path="/student/timetable" element={
          <ProtectedRoute roles={['student']}><StudentTimetablePage /></ProtectedRoute>
        } />
        <Route path="/student/resources" element={
          <ProtectedRoute roles={['student']}><StudentResourcesPage /></ProtectedRoute>
        } />
        <Route path="/student/notices" element={
          <ProtectedRoute roles={['student']}><StudentNoticesPage /></ProtectedRoute>
        } />
        <Route path="/student/gallery" element={
          <ProtectedRoute roles={['student']}><StudentGalleryPage /></ProtectedRoute>
        } />

        {/* Root & catch-all */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;