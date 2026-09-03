import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import FacultyLayout from './FacultyLayout';
import {
  Users,
  GraduationCap,
  Library,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Megaphone,
  Images,
} from 'lucide-react';

const MODULE_ICONS = {
  Students: Users,
  Faculty: GraduationCap,
  'Academic Structure': Library,
  'Marks Engine': BarChart3,
  Attendance: CalendarCheck2,
  Scheduler: CalendarDays,
  'Notice Board': Megaphone,
  'Activity Gallery': Images,
};

const ModuleCard = ({ label, desc, icon: IconName, to, phase }) => {
  const navigate = useNavigate();
  const isReady = !phase;
  const Icon = MODULE_ICONS[label] || Library;
  return (
    <div
      onClick={() => isReady && navigate(to)}
      className={`bg-slate-900 border border-slate-800 rounded-xl p-5 transition-all ${
        isReady ? 'cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/80' : 'opacity-50'
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-3 text-blue-400">
        <Icon size={20} aria-hidden="true" />
      </div>
      <h3 className="font-semibold text-white">{label}</h3>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
      {phase && (
        <span className="inline-block mt-3 text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          {phase}
        </span>
      )}
    </div>
  );
};

const FacultyDashboard = () => {
  const { user } = useAuth();

  const modules = [
    { label: 'Students', desc: 'Manage student records', to: '/faculty/students' },
    { label: 'Faculty', desc: 'Manage faculty profiles', to: '/faculty/faculty' },
    { label: 'Academic Structure', desc: 'Departments, courses, subjects', to: '/faculty/academic' },
    { label: 'Marks Engine', desc: 'MSBTE marks & analytics', to: '/faculty/marks' },
    { label: 'Attendance', desc: 'Fast attendance tracking', to: '/faculty/attendance' },
    { label: 'Scheduler', desc: 'Smart lecture planner', to: '/faculty/timetable' },
    { label: 'Notice Board', desc: 'Campus announcements', to: '/faculty/notices' },
    { label: 'Activity Gallery', desc: 'Extracurricular showcase & moderation', to: '/faculty/gallery' },
  ];

  return (
    <FacultyLayout>
      <div className="px-8 py-8">
        <div className="mb-8">
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            {INSTITUTION.name}
          </div>
          <h1 className="text-2xl font-bold text-white">Faculty & Academic Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Welcome back, {user?.name}
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 capitalize">
              {user?.role}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <ModuleCard key={m.label} {...m} />
          ))}
        </div>
      </div>
    </FacultyLayout>
  );
};

export default FacultyDashboard;
