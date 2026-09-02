import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';
import { studentService } from '../../services/managementService';
import { StatusBadge } from '../../components/Badge';
import toast from 'react-hot-toast';
import {
  CircleUserRound,
  Hash,
  CreditCard,
  Mail,
  Phone,
  School,
  Library,
  CalendarDays,
  CalendarRange,
  BarChart3,
  CalendarCheck2,
  FolderOpen,
  LogOut,
} from 'lucide-react';

const FIELD_ICONS = {
  'Full Name': CircleUserRound,
  'Roll Number': Hash,
  Enrollment: CreditCard,
  Email: Mail,
  Phone: Phone,
  Institution: School,
  Department: Library,
  Semester: CalendarDays,
  'Academic Year': CalendarRange,
};

const InfoCard = ({ label, value }) => {
  const Icon = FIELD_ICONS[label];
  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={13} className="text-slate-500" aria-hidden="true" />}
        <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm font-medium text-white">{value || '—'}</div>
    </div>
  );
};

const StudentProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentService.getMyProfile()
      .then((data) => setProfile(data.data))
      .catch(() => {
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-sm">
              FH
            </div>
            <span className="font-semibold text-white">FacultyHub</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <LogOut size={13} aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">My Profile</h1>
                <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
              </div>
              {profile && <StatusBadge status={profile.status} />}
            </div>

            {profile ? (
              <>
                {/* Basic info */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Basic Information</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoCard label="Full Name" value={profile.fullName} />
                    <InfoCard label="Roll Number" value={profile.rollNumber} />
                    <InfoCard label="Enrollment" value={profile.enrollmentNumber} />
                    <InfoCard label="Email" value={profile.email} />
                    <InfoCard label="Phone" value={profile.phone} />
                  </div>
                </div>

                {/* Academic info */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Academic Information</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoCard label="Institution" value={INSTITUTION.name} />
                    <InfoCard label="Department" value={ACADEMIC_CONFIG.DEPARTMENT.name} />
                    <InfoCard label="Semester" value={ACADEMIC_CONFIG.SEMESTER.displayName} />
                    <InfoCard label="Academic Year" value={profile.academicYear || '2026-2027'} />
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mb-4 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CircleUserRound size={28} className="text-slate-500" aria-hidden="true" />
                </div>
                <p className="text-slate-400 text-sm">Your student profile has not been set up yet.</p>
                <p className="text-slate-500 text-xs mt-1">Contact your faculty admin to complete your profile.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default StudentProfilePage;
