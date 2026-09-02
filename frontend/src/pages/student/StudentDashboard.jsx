import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import toast from 'react-hot-toast';
import {
  CircleUserRound,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  FolderOpen,
  Megaphone,
  Images,
  LogOut,
} from 'lucide-react';

const MODULE_ICONS = {
  'My Profile': CircleUserRound,
  'My Marks': BarChart3,
  Attendance: CalendarCheck2,
  Timetable: CalendarDays,
  Resources: FolderOpen,
  Notices: Megaphone,
  'Activity Gallery': Images,
};

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  const modules = [
    { label: 'My Profile', desc: 'View your academic profile', to: '/student/profile', ready: true },
    { label: 'My Marks', desc: 'View your MSBTE marks', to: '/student/marks', ready: true },
    { label: 'Attendance', desc: 'Check your attendance', to: '/student/attendance', ready: true },
    { label: 'Timetable', desc: 'View lecture schedule', to: '/student/timetable', ready: true },
    { label: 'Resources', desc: 'Notes & study material', to: '/student/resources', ready: true },
    { label: 'Notices', desc: 'Campus announcements', to: '/student/notices', ready: true },
    { label: 'Activity Gallery', desc: 'Extracurricular showcase & achievements', to: '/student/gallery', ready: true },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top navbar */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <div>
              <span className="font-semibold text-white">FacultyHub</span>
              <span className="text-slate-500 text-xs ml-2 hidden sm:inline">{INSTITUTION.shortName}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {user?.name}
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-500/20">
                Student
              </span>
            </span>
            <button
              id="student-logout-btn"
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              aria-label="Logout"
            >
              <LogOut size={14} aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            {INSTITUTION.name}
          </div>
          <h1 className="text-2xl font-bold text-white">Student Academic Portal</h1>
          <p className="text-slate-400 mt-1">
            Welcome, {user?.name}
            {user?.rollNumber && ` (${user.rollNumber})`}.
          </p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => {
            const Icon = MODULE_ICONS[m.label];
            return (
              <div
                key={m.label}
                onClick={() => m.ready && navigate(m.to)}
                className={`bg-slate-900 border border-slate-800 rounded-xl p-5 transition-all ${m.ready ? 'cursor-pointer hover:border-emerald-500/50 hover:bg-slate-800/80' : 'opacity-50'}`}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-3 text-emerald-400">
                  {Icon && <Icon size={20} aria-hidden="true" />}
                </div>
                <h3 className="font-semibold text-white">{m.label}</h3>
                <p className="text-sm text-slate-400 mt-1">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
