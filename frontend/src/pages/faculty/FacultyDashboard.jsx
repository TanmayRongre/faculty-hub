import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users,
  GraduationCap,
  Library,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Megaphone,
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronRight,
  FileSpreadsheet,
  Plus,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';
import FacultyLayout from './FacultyLayout';
import { facultyService, academicService } from '../../services/managementService';
import { taskService } from '../../services/taskService';
import { getTimetable } from '../../services/timetableService';

const PRIORITY_BADGES = {
  Urgent: 'bg-red-500/10 text-red-400 border-red-500/30',
  High: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Medium: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const STATUS_BADGES = {
  Pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Cancelled: 'bg-slate-700/40 text-slate-400 border-slate-700',
};

const FacultyDashboard = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskSummary, setTaskSummary] = useState(null);
  const [todayClasses, setTodayClasses] = useState([]);
  const [adminStats, setAdminStats] = useState({
    totalFaculty: 0,
    activeFaculty: 0,
    totalSubjects: ACADEMIC_CONFIG.SUBJECTS?.length || 6,
  });

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        // Admin data
        const [facultyRes, subjectsRes, tasksRes, summaryRes] = await Promise.all([
          facultyService.getFacultyList({ limit: 100 }).catch(() => ({ data: [] })),
          academicService.getSubjects({ semester: 5 }).catch(() => ({ data: [] })),
          taskService.getTasks({ limit: 10 }).catch(() => ({ data: [] })),
          taskService.getTaskSummary().catch(() => ({ data: null })),
        ]);

        const facList = facultyRes.data || [];
        const activeFac = facList.filter((f) => f.status === 'active').length;
        const subs = subjectsRes.data || [];

        setAdminStats({
          totalFaculty: facList.length,
          activeFaculty: activeFac,
          totalSubjects: subs.length || ACADEMIC_CONFIG.SUBJECTS?.length || 6,
        });
        setTasks(tasksRes.data || []);
        setTaskSummary(summaryRes.data || null);
      } else {
        // Faculty data (only loads necessary subjects, tasks, and schedule)
        const [subRes, tasksRes, timetableRes] = await Promise.all([
          facultyService.getMyAssignedSubjects().catch(() => ({ data: [] })),
          taskService.getTasks().catch(() => ({ data: [] })),
          getTimetable().catch(() => ({ data: [] })),
        ]);

        const mySubs = subRes.data || [];
        setAssignedSubjects(mySubs);
        setTasks(tasksRes.data || []);

        // Filter today's classes for assigned subjects
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[new Date().getDay()];
        const allSlots = timetableRes.data || [];

        const assignedCodes = new Set(mySubs.map((s) => s.subjectCode));
        const filteredSlots = allSlots.filter((slot) => {
          const subCode = slot.subject?.subjectCode || slot.subjectCode;
          return (
            (assignedCodes.size === 0 || assignedCodes.has(subCode)) &&
            (slot.dayOfWeek === currentDay || slot.day === currentDay)
          );
        });
        setTodayClasses(filteredSlots);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [isAdmin]);

  // Handle fast task status toggle directly from dashboard
  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      toast.success(`Task marked as ${newStatus}`);
      loadDashboardData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    }
  };

  // Ordered tasks for Faculty: Overdue -> Urgent -> High -> Nearest due date -> Completed
  const sortedTasks = useMemo(() => {
    const priorityWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    return [...tasks].sort((a, b) => {
      // 1. Completed tasks always go to the bottom
      if (a.status === 'Completed' && b.status !== 'Completed') return 1;
      if (b.status === 'Completed' && a.status !== 'Completed') return -1;

      // 2. Overdue tasks first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;

      // 3. Priority weight
      const pDiff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (pDiff !== 0) return pDiff;

      // 4. Due date
      const dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dA - dB;
    });
  }, [tasks]);

  const modules = [
    { label: 'Students', desc: 'Manage 68 enrolled students', to: '/faculty/students', icon: Users },
    { label: 'Faculty Management', desc: 'Profiles, subject workload & roles', to: '/faculty/faculty', icon: GraduationCap },
    { label: 'Task Management', desc: 'Academic & administrative tasks', to: '/faculty/tasks', icon: CheckSquare },
    { label: 'Attendance', desc: 'Fast lecture attendance tracking', to: '/faculty/attendance', icon: CalendarCheck2 },
    { label: 'Marks Engine', desc: 'MSBTE PA1, PA2 & practical records', to: '/faculty/marks', icon: BarChart3 },
    { label: 'Timetable', desc: 'Weekly class timetable', to: '/faculty/timetable', icon: CalendarDays },
    { label: 'Leave & Substitution', desc: 'Apply for leave & manage substitutions', to: '/faculty/leave', icon: UserCheck },
    { label: 'Academic Structure', desc: 'MSBTE curriculum & subjects', to: '/faculty/academic', icon: Library },
    { label: 'Campus Notices', desc: 'Broadcast circulars & updates', to: '/faculty/notices', icon: Megaphone },
    ...(isAdmin
      ? [{ label: 'Google Sheets', desc: 'Sync live database & backups', to: '/faculty/sheets', icon: FileSpreadsheet }]
      : []),
  ];

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <div>
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {INSTITUTION.name}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isAdmin ? 'Academic & Administration Portal' : 'Faculty Workspace'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Welcome back, <strong className="text-slate-200">{user?.name}</strong>
              <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
                {user?.role}
              </span>
              <span className="ml-2 text-slate-500">•</span>
              <span className="ml-2 text-slate-400">
                {ACADEMIC_CONFIG.DEPARTMENT.name} ({ACADEMIC_CONFIG.SEMESTER.displayName})
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/faculty/tasks')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-colors"
            >
              <CheckSquare className="w-4 h-4 text-blue-400" />
              <span>{isAdmin ? 'Manage All Tasks' : 'My Tasks'}</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/faculty/faculty/new')}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Faculty</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SYSTEM MODULES & NAVIGATION GRID (TOP LEVEL) */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white tracking-wide uppercase">
              System Modules & Navigation
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.label}
                  onClick={() => navigate(m.to)}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 cursor-pointer transition-all hover:border-blue-500/50 hover:bg-slate-800/80 group shadow-md"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-800 group-hover:bg-blue-600/20 flex items-center justify-center mb-3 text-blue-400 transition-colors">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {m.label}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">{m.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUMMARY CARDS */}
        {/* ========================================================================= */}
        {isAdmin && (
          /* Admin Summary Cards */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div
              onClick={() => navigate('/faculty/faculty')}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                <span>Total Faculty</span>
                <GraduationCap className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{adminStats.totalFaculty}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {adminStats.activeFaculty} Active Profiles
              </div>
            </div>

            <div
              onClick={() => navigate('/faculty/academic')}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                <span>Active Subjects</span>
                <BookOpen className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{adminStats.totalSubjects}</div>
              <div className="text-[11px] text-emerald-400/80 mt-1">MSBTE 5th Semester</div>
            </div>

            <div
              onClick={() => navigate('/faculty/tasks')}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-400">
                <span>Pending Tasks</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-300 mt-2">{taskSummary?.pending || 0}</div>
              <div className="text-[11px] text-slate-500 mt-1">Awaiting completion</div>
            </div>

            <div
              onClick={() => navigate('/faculty/tasks')}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-blue-400">
                <span>In Progress</span>
                <CheckSquare className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400 mt-2">
                {taskSummary?.inProgress || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Currently active</div>
            </div>

            <div
              onClick={() => navigate('/faculty/tasks')}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-red-400">
                <span>Overdue Tasks</span>
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400 mt-2">{taskSummary?.overdue || 0}</div>
              <div className="text-[11px] text-red-400/80 mt-1">Requires immediate attention</div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FACULTY SPECIFIC: "MY SUBJECTS" SECTION */}
        {/* ========================================================================= */}
        {!isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-bold text-white tracking-wide uppercase">
                  My Assigned Subjects ({assignedSubjects.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Access authorized for attendance, marks, and evaluations
              </span>
            </div>

            {assignedSubjects.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
                <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-300 font-semibold text-sm">No subjects currently assigned</p>
                <p className="text-slate-500 text-xs mt-1">
                  Contact the Academic Administrator to assign 5th Semester subjects to your profile.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedSubjects.map((subject) => {
                  const isPractical = ACADEMIC_CONFIG.PRACTICAL_SUBJECTS.includes(subject.subjectCode);
                  const isTheory = ACADEMIC_CONFIG.THEORY_PA_SUBJECTS.includes(subject.subjectCode);

                  return (
                    <div
                      key={subject._id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-bold text-sm">
                            {subject.subjectCode}
                          </span>
                          {subject.courseCode && (
                            <span className="text-xs font-mono text-slate-500">
                              MSBTE: {subject.courseCode}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-semibold text-white mt-2.5 line-clamp-1">
                          {subject.subjectName}
                        </h3>

                        <div className="flex items-center gap-2 mt-2">
                          {isTheory && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium border border-slate-700">
                              Theory (PA1 & PA2)
                            </span>
                          )}
                          {isPractical && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 font-medium border border-emerald-500/30">
                              Practical
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick action buttons */}
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80">
                        <button
                          onClick={() => navigate('/faculty/attendance')}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 text-center transition-colors"
                        >
                          Attendance
                        </button>
                        <button
                          onClick={() => navigate('/faculty/marks')}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 text-center transition-colors"
                        >
                          Marks
                        </button>
                        <button
                          onClick={() => navigate('/faculty/timetable')}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 text-center transition-colors"
                        >
                          Timetable
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* "MY TASKS" / "RECENT TASKS" SECTION */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-wide uppercase">
                {isAdmin ? 'Recent Faculty Tasks' : 'My Current Tasks'}
              </h2>
            </div>
            <button
              onClick={() => navigate('/faculty/tasks')}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View All Tasks</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {sortedTasks.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
              <CheckSquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold text-sm">No tasks pending</p>
              <p className="text-slate-500 text-xs mt-1">
                {isAdmin
                  ? 'No tasks created yet. Click "Manage All Tasks" to assign responsibilities.'
                  : 'All caught up! You have no pending or overdue deliverables.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedTasks.slice(0, 5).map((task) => {
                const isOverdue = task.isOverdue;
                const formattedDate = task.dueDate
                  ? new Date(task.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : null;

                return (
                  <div
                    key={task._id}
                    className={`bg-slate-900 border rounded-xl p-4 transition-all hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isOverdue
                        ? 'border-red-500/40 bg-red-950/10'
                        : task.status === 'Completed'
                        ? 'border-slate-800/60 opacity-75'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.Medium
                          }`}
                        >
                          {task.priority}
                        </span>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            STATUS_BADGES[task.status] || STATUS_BADGES.Pending
                          }`}
                        >
                          {task.status}
                        </span>

                        {isOverdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Overdue
                          </span>
                        )}

                        {task.subjectId && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                            {task.subjectId.subjectCode}
                          </span>
                        )}
                      </div>

                      <h3
                        className={`text-sm font-semibold text-white truncate ${
                          task.status === 'Completed' ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {task.title}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {formattedDate && (
                          <span className={isOverdue ? 'text-red-400 font-medium' : ''}>
                            Due: {formattedDate}
                          </span>
                        )}
                        {isAdmin && task.assignedTo && (
                          <span>
                            Assigned to: <strong className="text-slate-300">{task.assignedTo.name}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {task.subjectId && (
                        <button
                          onClick={() => navigate('/faculty/attendance')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors"
                          title={`Open ${task.subjectId.subjectCode}`}
                        >
                          <span>{task.subjectId.subjectCode}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {task.status === 'Pending' && (
                        <button
                          onClick={() => handleTaskStatusChange(task._id, 'In Progress')}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium border border-blue-500/30 transition-colors"
                        >
                          Start
                        </button>
                      )}

                      {task.status === 'In Progress' && (
                        <button
                          onClick={() => handleTaskStatusChange(task._id, 'Completed')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/30 flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* UPCOMING / TODAY'S CLASSES (FACULTY ONLY) */}
        {/* ========================================================================= */}
        {!isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white tracking-wide uppercase">
                  Today's Scheduled Lectures (Assigned Subjects)
                </h2>
              </div>
              <button
                onClick={() => navigate('/faculty/timetable')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
              >
                <span>Full Timetable</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {todayClasses.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center">
                <CalendarDays className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-300 font-semibold text-sm">No lectures scheduled for today</p>
                <p className="text-slate-500 text-xs mt-1">
                  Enjoy your preparation time or verify the weekly master timetable.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {todayClasses.map((cls, idx) => (
                  <div
                    key={cls._id || idx}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-400">
                        {cls.subject?.subjectCode || cls.subjectCode}
                      </span>
                      <h4 className="text-sm font-semibold text-white mt-1">
                        {cls.subject?.subjectName || cls.subjectName || 'Lecture Slot'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {cls.startTime || '09:00'} - {cls.endTime || '10:00'} • Room {cls.room || 'Lab 3'}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/faculty/attendance')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium border border-blue-500/30 transition-colors"
                    >
                      Take Attendance
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </FacultyLayout>
  );
};

export default FacultyDashboard;
