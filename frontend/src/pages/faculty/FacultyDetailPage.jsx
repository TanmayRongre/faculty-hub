import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { facultyService } from '../../services/managementService';
import { StatusBadge } from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';
import { ACADEMIC_CONFIG } from '../../config/academic';

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-white">{value || '—'}</span>
  </div>
);

const FacultyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    facultyService.getFacultyById(id)
      .then((data) => setFaculty(data.data))
      .catch(() => toast.error('Failed to load faculty'))
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

  if (!faculty) {
    return (
      <FacultyLayout>
        <div className="px-8 py-8">
          <p className="text-slate-400">Faculty not found.</p>
          <button onClick={() => navigate('/faculty/faculty')} className="mt-3 text-blue-400 hover:text-blue-300 text-sm">
            ← Back to Directory
          </button>
        </div>
      </FacultyLayout>
    );
  }

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button onClick={() => navigate('/faculty/faculty')} className="text-slate-400 hover:text-white text-sm">
              ← Faculty Directory
            </button>
            <span className="text-slate-700">/</span>
            <h1 className="text-xl font-bold text-white">{faculty.fullName}</h1>
            <StatusBadge status={faculty.status} />
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate(`/faculty/faculty/${id}/edit`)}
              className="self-start sm:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg border border-slate-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Faculty Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <InfoRow label="Full Name" value={faculty.fullName} />
            <InfoRow label="Email" value={faculty.email} />
            <InfoRow label="Phone" value={faculty.phone} />
            <InfoRow label="Department" value={ACADEMIC_CONFIG.DEPARTMENT.name} />
            <InfoRow label="Designation" value={faculty.designation} />
          </div>
        </div>

        {faculty.subjects?.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
              Assigned Subjects ({faculty.subjects.length})
            </h2>
            <div className="space-y-2">
              {faculty.subjects.map((s) => (
                <div key={s._id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                  <span className="font-mono text-xs text-blue-400 font-bold">{s.subjectCode}</span>
                  <span className="text-sm text-white">{s.subjectName}</span>
                  <span className="ml-auto text-xs text-slate-400">{ACADEMIC_CONFIG.SEMESTER.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FacultyLayout>
  );
};

export default FacultyDetailPage;
