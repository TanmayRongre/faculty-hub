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
  Megaphone,
  CheckSquare,
  LogOut,
  X,
} from 'lucide-react';

const NAV_ICONS = {
  '/faculty/dashboard': LayoutDashboard,
  '/faculty/students': Users,
  '/faculty/faculty': GraduationCap,
  '/faculty/tasks': CheckSquare,
  '/faculty/academic': Library,
  '/faculty/subjects': BookOpen,
  '/faculty/marks': BarChart3,
  '/faculty/attendance': CalendarCheck2,
  '/faculty/timetable': CalendarDays,
  '/faculty/notices': Megaphone,
};

const NavLink = ({ to, label, active, onClick }) => {
  const navigate = useNavigate();
  const Icon = NAV_ICONS[to] || LayoutDashboard;
  return (
    <button
      onClick={() => {
        navigate(to);
        if (onClick) onClick();
      }}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-left ${
        active
          ? 'bg-blue-600 text-white font-medium shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={17} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
};

const Sidebar = ({ activePath, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login', { replace: true });
    if (onClose) onClose();
  };

  const navItems = [
    { to: '/faculty/dashboard', label: 'Dashboard' },
    { to: '/faculty/students', label: 'Students' },
    { to: '/faculty/faculty', label: user?.role === 'admin' ? 'Faculty Management' : 'Faculty Directory' },
    { to: '/faculty/tasks', label: user?.role === 'admin' ? 'Task Management' : 'My Tasks' },
    { to: '/faculty/academic', label: 'Academic Structure' },
    { to: '/faculty/subjects', label: 'Subjects' },
    { to: '/faculty/marks', label: 'Marks Management' },
    { to: '/faculty/attendance', label: 'Fast Attendance' },
    { to: '/faculty/timetable', label: 'Timetable' },
    { to: '/faculty/notices', label: 'Notice Board' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Drawer */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 md:w-56 bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none">FacultyHub</div>
              <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mt-0.5">
                {user?.role} Portal
              </div>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Institution Info */}
        <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/50">
          <div className="text-[10px] text-slate-400 font-medium leading-tight line-clamp-2">
            {INSTITUTION.name}
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              label={item.label}
              active={activePath === item.to || activePath?.startsWith(item.to + '/')}
              onClick={onClose}
            />
          ))}
        </nav>

        {/* User Footer */}
        <div className="px-3 py-3 border-t border-slate-800 bg-slate-900/90">
          <div className="px-3 py-1.5 mb-1.5">
            <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
            <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
          </div>
          <button
            id="sidebar-logout-btn"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 font-medium"
            aria-label="Sign out"
          >
            <LogOut size={14} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
