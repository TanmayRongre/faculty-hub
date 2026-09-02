import React, { useState, useEffect } from 'react';
import { BarChart3, CalendarCheck2, CalendarDays, FolderOpen } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { studentService } from '../../services/managementService';
import { StatusBadge } from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';
import { ACADEMIC_CONFIG } from '../../config/academic';

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-white">{value || '—'}</span>
  </div>
);

const StudentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentService.getStudent(id)
      .then((data) => setStudent(data.data))
      .catch(() => toast.error('Failed to load student'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <FacultyLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </FacultyLayout>
    );
  }

  if (!student) {
    return (
      <FacultyLayout>
        <div className="px-8 py-8">
          <p className="text-slate-400">Student not found.</p>
          <button onClick={() => navigate('/faculty/students')} className="mt-3 text-blue-400 hover:text-blue-300 text-sm">
            ← Back to students
          </button>
        </div>
      </FacultyLayout>
    );
  }

  return (
    <FacultyLayout>
      <div className="px-8 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/faculty/students')}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Students
            </button>
            <span className="text-slate-700">/</span>
            <h1 className="text-xl font-bold text-white">{student.fullName}</h1>
            <StatusBadge status={student.status} />
          </div>
          {isAdmin && (
            <button
              id="edit-student-btn"
              onClick={() => navigate(`/faculty/students/${id}/edit`)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg border border-slate-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <InfoRow label="Full Name" value={student.fullName} />
            <InfoRow label="Roll Number" value={student.rollNumber} />
            <InfoRow label="Enrollment Number" value={student.enrollmentNumber} />
            <InfoRow label="Email" value={student.email} />
            <InfoRow label="Phone" value={student.phone} />
          </div>
        </div>

        {/* Academic Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Academic Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <InfoRow label="Department" value={ACADEMIC_CONFIG.DEPARTMENT.name} />
            <InfoRow label="Semester" value={ACADEMIC_CONFIG.SEMESTER.displayName} />
            <InfoRow label="Academic Year" value={student.academicYear || '2026-2027'} />
          </div>
        </div>

        {/* Quick Access */}
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Quick Navigation</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/faculty/marks')}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all"
          >
            <BarChart3 size={18} className="text-blue-400 mb-2" aria-hidden="true" />
            <div className="font-semibold text-white text-sm">Marks Management</div>
            <div className="text-xs text-slate-500 mt-0.5">PA / 30 Evaluation</div>
          </button>
          <button
            onClick={() => navigate('/faculty/attendance')}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all"
          >
            <CalendarCheck2 size={18} className="text-emerald-400 mb-2" aria-hidden="true" />
            <div className="font-semibold text-white text-sm">Attendance Matrix</div>
            <div className="text-xs text-slate-500 mt-0.5">Session-wise Logs</div>
          </button>
          <button
            onClick={() => navigate('/faculty/timetable')}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all"
          >
            <CalendarDays size={18} className="text-purple-400 mb-2" aria-hidden="true" />
            <div className="font-semibold text-white text-sm">Timetable & Schedule</div>
            <div className="text-xs text-slate-500 mt-0.5">Weekly Sessions</div>
          </button>
          <button
            onClick={() => navigate('/faculty/resources')}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-all"
          >
            <FolderOpen size={18} className="text-amber-400 mb-2" aria-hidden="true" />
            <div className="font-semibold text-white text-sm">Notes & Resources</div>
            <div className="text-xs text-slate-500 mt-0.5">Academic Repository</div>
          </button>
        </div>
      </div>
    </FacultyLayout>
  );
};

export default StudentDetailPage;
