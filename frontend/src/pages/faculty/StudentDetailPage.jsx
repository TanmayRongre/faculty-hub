import React, { useState, useEffect } from 'react';
import { BarChart3, CalendarCheck2, CalendarDays } from 'lucide-react';
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
      <div className="p-4 sm:p-6 md:p-8 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/faculty/students')}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Student Roster
            </button>
            <span className="text-slate-700">/</span>
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block">
                Academic Student Record
              </span>
              <h1 className="text-xl font-bold text-white">{student.fullName}</h1>
            </div>
            <StatusBadge status={student.status} />
          </div>
          {isAdmin && (
            <button
              id="edit-student-btn"
              onClick={() => navigate(`/faculty/students/${id}/edit`)}
              className="self-start sm:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg border border-slate-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <InfoRow label="Full Name" value={student.fullName} />
            <InfoRow label="Roll Number" value={student.rollNumber} />
            <InfoRow label="Enrollment Number" value={student.enrollmentNumber} />
            <InfoRow label="Exam Seat No." value={student.examSeatNumber || 'Not assigned'} />
            <InfoRow label="Practical Batch" value={student.batch ? `Batch ${student.batch}` : 'Not assigned'} />
            {student.phone && <InfoRow label="Phone" value={student.phone} />}
          </div>
        </div>

        {/* Academic Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Academic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <InfoRow label="Department" value={ACADEMIC_CONFIG.DEPARTMENT.name} />
            <InfoRow label="Semester" value={ACADEMIC_CONFIG.SEMESTER.displayName} />
            <InfoRow label="Academic Year" value={student.academicYear || '2026-2027'} />
          </div>
        </div>

        {/* Quick Access */}
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Quick Navigation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
      </div>
    </FacultyLayout>
  );
};

export default StudentDetailPage;
