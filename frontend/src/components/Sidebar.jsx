import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { INSTITUTION } from '../config/institution';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Library,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  FolderOpen,
  Megaphone,
  Images,
  LogOut,
} from 'lucide-react';

const NAV_ICONS = {
  '/faculty/dashboard': LayoutDashboard,
  '/faculty/students': Users,
  '/faculty/faculty': GraduationCap,
  '/faculty/academic': Library,
  '/faculty/subjects': BookOpen,
  '/faculty/marks': BarChart3,
  '/faculty/attendance': CalendarCheck2,
  '/faculty/timetable': CalendarDays,
  '/faculty/resources': FolderOpen,
  '/faculty/notices': Megaphone,
  '/faculty/gallery': Images,
};

const NavLink = ({ to, label, active }) => {
  const navigate = useNavigate();
  const Icon = NAV_ICONS[to] || LayoutDashboard;
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
};

const Sidebar = ({ activePath }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login', { replace: true });
  };

  const navItems = [
    { to: '/faculty/dashboard', label: 'Dashboard' },
    { to: '/faculty/students', label: 'Students' },
    { to: '/faculty/faculty', label: 'Faculty' },
    { to: '/faculty/academic', label: 'Academic Structure' },
    { to: '/faculty/subjects', label: 'Subjects' },
    { to: '/faculty/marks', label: 'Marks Management' },
    { to: '/faculty/attendance', label: 'Fast Attendance' },
    { to: '/faculty/timetable', label: 'Smart Scheduler' },
    { to: '/faculty/resources', label: 'Resources & Notes' },
    { to: '/faculty/notices', label: 'Notice Board' },
    { to: '/faculty/gallery', label: 'Activity Gallery' },
  ];

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">FacultyHub</div>
            <div className="text-[10px] text-blue-400 font-medium uppercase tracking-wider mt-0.5">{user?.role} Portal</div>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium leading-tight line-clamp-2 border-t border-slate-800/80 pt-2">
          {INSTITUTION.name}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            label={item.label}
            active={activePath === item.to || activePath?.startsWith(item.to + '/')}
          />
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="px-3 py-2 mb-2">
          <div className="text-sm font-medium text-white truncate">{user?.name}</div>
          <div className="text-xs text-slate-500 truncate">{user?.email}</div>
        </div>
        <button
          id="sidebar-logout-btn"
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2"
          aria-label="Sign out"
        >
          <LogOut size={14} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
