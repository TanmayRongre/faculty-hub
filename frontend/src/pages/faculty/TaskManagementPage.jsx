import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  User,
  BookOpen,
  Trash2,
  Edit3,
  X,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import FacultyLayout from './FacultyLayout';
import { taskService } from '../../services/taskService';
import { facultyService, academicService } from '../../services/managementService';
import { useAuth } from '../../context/AuthContext';
import { ACADEMIC_CONFIG } from '../../config/academic';

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

const TaskManagementPage = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [facultyList, setFacultyList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [facultyFilter, setFacultyFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    subjectId: '',
    priority: 'Medium',
    dueDate: '',
    status: 'Pending',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, summaryRes, subjectsRes] = await Promise.all([
        taskService.getTasks(),
        taskService.getTaskSummary(),
        academicService.getSubjects({ semester: 5 }).catch(() => ({ data: [] })),
      ]);

      setTasks(tasksRes.data || []);
      setSummary(summaryRes.data || null);
      setSubjectsList(subjectsRes.data || []);

      if (isAdmin) {
        const facRes = await facultyService.getFacultyList({ limit: 100 }).catch(() => ({ data: [] }));
        setFacultyList(facRes.data || []);
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  // Open modal for create
  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setTaskForm({
      title: '',
      description: '',
      assignedTo: facultyList.length > 0 ? (facultyList[0].userId?._id || facultyList[0]._id) : '',
      subjectId: '',
      priority: 'Medium',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'Pending',
    });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEditModal = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      assignedTo: task.assignedTo?._id || '',
      subjectId: task.subjectId?._id || '',
      priority: task.priority || 'Medium',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
      status: task.status || 'Pending',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    if (isAdmin && !taskForm.assignedTo) {
      toast.error('Please assign this task to a faculty member');
      return;
    }
    if (!taskForm.dueDate) {
      toast.error('Due date is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        assignedTo: taskForm.assignedTo,
        subjectId: taskForm.subjectId || null,
        priority: taskForm.priority,
        dueDate: new Date(taskForm.dueDate).toISOString(),
        status: taskForm.status,
      };

      if (editingTask) {
        await taskService.updateTask(editingTask._id, payload);
        toast.success('Task updated successfully');
      } else {
        await taskService.createTask(payload);
        toast.success('Task created and assigned successfully');
      }

      handleCloseModal();
      loadData();
    } catch (err) {
      console.error('Error saving task:', err);
      toast.error(err.response?.data?.message || 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  };

  // Status toggle handler
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      toast.success(`Task marked as ${newStatus}`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task status');
    }
  };

  // Delete task handler (Admin only)
  const handleDeleteTask = async (taskId, title) => {
    if (!window.confirm(`Are you sure you want to delete task "${title}"?`)) return;
    try {
      await taskService.deleteTask(taskId);
      toast.success('Task deleted successfully');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete task');
    }
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesFaculty = t.assignedTo?.name?.toLowerCase().includes(q);
        const matchesSub = t.subjectId?.subjectCode?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesFaculty && !matchesSub) return false;
      }

      // Status
      if (statusFilter !== 'All') {
        if (statusFilter === 'Overdue') {
          if (!t.isOverdue) return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }

      // Priority
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;

      // Faculty filter (Admin only)
      if (facultyFilter !== 'All') {
        const facUserId = t.assignedTo?._id;
        if (facUserId !== facultyFilter) return false;
      }

      // Subject filter
      if (subjectFilter !== 'All') {
        const subId = t.subjectId?._id;
        if (subId !== subjectFilter) return false;
      }

      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter, facultyFilter, subjectFilter]);

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {isAdmin ? 'Task Management' : 'My Assigned Tasks'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {isAdmin
                ? 'Assign and track academic, administrative, and curriculum responsibilities.'
                : 'Manage your workload, complete deliverables, and update progress in real time.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              title="Refresh tasks"
              className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {isAdmin && (
              <button
                id="create-task-btn"
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Assign New Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Metrics Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div
              onClick={() => setStatusFilter('All')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'All'
                  ? 'bg-slate-800/90 border-blue-500/50 ring-1 ring-blue-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Total Tasks</span>
                <CheckSquare className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{summary.total || 0}</div>
            </div>

            <div
              onClick={() => setStatusFilter('Pending')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'Pending'
                  ? 'bg-amber-950/30 border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <span>Pending</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-300 mt-2">{summary.pending || 0}</div>
            </div>

            <div
              onClick={() => setStatusFilter('In Progress')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'In Progress'
                  ? 'bg-blue-950/30 border-blue-500/50 ring-1 ring-blue-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-blue-400 text-xs font-semibold uppercase tracking-wider">
                <span>In Progress</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400 mt-2">{summary.inProgress || 0}</div>
            </div>

            <div
              onClick={() => setStatusFilter('Overdue')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'Overdue'
                  ? 'bg-red-950/30 border-red-500/50 ring-1 ring-red-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-red-400 text-xs font-semibold uppercase tracking-wider">
                <span>Overdue</span>
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400 mt-2">{summary.overdue || 0}</div>
            </div>

            <div
              onClick={() => setStatusFilter('Completed')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'Completed'
                  ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <span>Completed</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">{summary.completed || 0}</div>
            </div>
          </div>
        )}

        {/* Filters and Controls Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Box */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks by title, description, or subject..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="All">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              {/* Subject Filter */}
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="All">All Subjects</option>
                {subjectsList.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.subjectCode} - {sub.subjectName}
                  </option>
                ))}
              </select>

              {/* Faculty Filter (Admin Only) */}
              {isAdmin && (
                <select
                  value={facultyFilter}
                  onChange={(e) => setFacultyFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="All">All Faculty Members</option>
                  {facultyList.map((fac) => {
                    const uId = fac.userId?._id || fac._id;
                    return (
                      <option key={fac._id} value={uId}>
                        {fac.fullName}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Task List / Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center">
            <CheckSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No tasks found</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              {search || statusFilter !== 'All' || priorityFilter !== 'All'
                ? 'No tasks match the active filters. Try resetting your search or filter options.'
                : isAdmin
                ? 'No tasks have been assigned yet. Click "Assign New Task" to create one.'
                : 'You have no tasks assigned at this moment. Great job!'}
            </p>
            {isAdmin && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Task</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const isOverdue = task.isOverdue;
              const formattedDueDate = task.dueDate
                ? new Date(task.dueDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'No deadline';

              return (
                <div
                  key={task._id}
                  className={`bg-slate-900 border rounded-xl p-4 sm:p-5 transition-all hover:border-slate-700 ${
                    isOverdue
                      ? 'border-red-500/40 bg-red-950/10'
                      : task.status === 'Completed'
                      ? 'border-slate-800/80 opacity-80'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Task Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Priority Badge */}
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.Medium
                          }`}
                        >
                          {task.priority} Priority
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            STATUS_BADGES[task.status] || STATUS_BADGES.Pending
                          }`}
                        >
                          {task.status}
                        </span>

                        {/* Overdue Warning Badge */}
                        {isOverdue && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1 animate-pulse">
                            <AlertCircle className="w-3 h-3" /> Overdue
                          </span>
                        )}

                        {/* Subject Badge */}
                        {task.subjectId && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {task.subjectId.subjectCode}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className={`text-base font-semibold text-white ${
                          task.status === 'Completed' ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {task.title}
                      </h3>

                      {/* Description */}
                      {task.description && (
                        <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                          {task.description}
                        </p>
                      )}

                      {/* Meta: Assigned Faculty, Due Date, Assigned By */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                        {task.assignedTo && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-blue-400" />
                            <span>
                              Assigned to: <strong className="text-slate-200">{task.assignedTo.name}</strong>
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className={isOverdue ? 'text-red-400 font-medium' : ''}>
                            Due: {formattedDueDate}
                          </span>
                        </div>

                        {task.assignedBy && (
                          <div className="text-slate-500">
                            by {task.assignedBy.name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                      {/* Subject Link (if present) */}
                      {task.subjectId && (
                        <button
                          onClick={() => navigate('/faculty/attendance')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                          title="Navigate to academic modules for this subject"
                        >
                          <span>{task.subjectId.subjectCode}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {/* Quick Status Buttons */}
                      {task.status === 'Pending' && (
                        <button
                          onClick={() => handleStatusChange(task._id, 'In Progress')}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium border border-blue-500/30 transition-colors"
                        >
                          Start Task
                        </button>
                      )}

                      {task.status === 'In Progress' && (
                        <button
                          onClick={() => handleStatusChange(task._id, 'Completed')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/30 flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                        </button>
                      )}

                      {task.status === 'Completed' && (
                        <button
                          onClick={() => handleStatusChange(task._id, 'In Progress')}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                        >
                          Reopen
                        </button>
                      )}

                      {/* Admin Edit / Delete Actions */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 ml-1 border-l border-slate-800 pl-2">
                          <button
                            onClick={() => handleOpenEditModal(task)}
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Edit task"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task._id, task.title)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create / Edit Task Modal (Admin) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-bold text-white">
                    {editingTask ? 'Edit Task' : 'Assign New Faculty Task'}
                  </h2>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prepare Question Paper for MSBTE PA1 Exam"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Detailed Instructions / Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add specific guidelines, format expectations, or submission links..."
                    value={taskForm.description}
                    onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Assigned To (Faculty) */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Assign To Faculty Member *
                  </label>
                  <select
                    required
                    value={taskForm.assignedTo}
                    onChange={(e) => setTaskForm((p) => ({ ...p, assignedTo: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select Faculty --</option>
                    {facultyList.map((fac) => {
                      const uId = fac.userId?._id || fac._id;
                      return (
                        <option key={fac._id} value={uId}>
                          {fac.fullName} ({fac.designation})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Related Subject & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Related Subject (Optional)
                    </label>
                    <select
                      value={taskForm.subjectId}
                      onChange={(e) => setTaskForm((p) => ({ ...p, subjectId: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">None (General Administrative)</option>
                      {subjectsList.map((sub) => (
                        <option key={sub._id} value={sub._id}>
                          {sub.subjectCode} - {sub.subjectName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Priority Level *
                    </label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="Low">Low Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="High">High Priority</option>
                      <option value="Urgent">Urgent Priority</option>
                    </select>
                  </div>
                </div>

                {/* Due Date & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Initial Status
                    </label>
                    <select
                      value={taskForm.status}
                      onChange={(e) => setTaskForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingTask ? 'Update Task' : 'Assign Task'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </FacultyLayout>
  );
};

export default TaskManagementPage;
