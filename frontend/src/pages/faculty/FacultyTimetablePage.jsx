import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Clock,
  PartyPopper,
  AlertTriangle,
  Plus,
  UserRound,
  Building2,
  Zap,
  Lightbulb,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import FacultyLayout from './FacultyLayout';
import { academicService, facultyService } from '../../services/managementService';
import {
  getTimetable,
  createTimetableSlot,
  deleteTimetableSlot,
  getHolidays,
  createHoliday,
  deleteHoliday,
  getLectures,
  getReschedulingRequired,
  rescheduleLecture,
} from '../../services/schedulerService';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FacultyTimetablePage = () => {
  const navigate = useNavigate();

  // Tabs: 'timetable' | 'today' | 'holidays' | 'reschedule'
  const [activeTab, setActiveTab] = useState('timetable');

  // Academic Scope: Semester 5, Computer Science
  const [semester] = useState(5);

  // Data state
  const [timetableData, setTimetableData] = useState({ totalSlots: 0, days: {} });
  const [todayLectures, setTodayLectures] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [pendingReschedules, setPendingReschedules] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form metadata
  const [subjects, setSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Add Slot Modal
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState({
    faculty: '',
    subject: '',
    department: '',
    semester: 5,
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    room: 'Room 201',
    lectureType: 'theory',
  });
  const [savingSlot, setSavingSlot] = useState(false);

  // Add Holiday Modal
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    type: 'national',
  });
  const [savingHoliday, setSavingHoliday] = useState(false);

  // Manual Reschedule Modal
  const [selectedLectureForReschedule, setSelectedLectureForReschedule] = useState(null);
  const [manualRescheduleData, setManualRescheduleData] = useState({
    newDate: new Date().toISOString().split('T')[0],
    newStartTime: '14:00',
    newEndTime: '15:00',
    newRoom: 'Room 201',
    reason: 'Faculty adjustment',
  });
  const [rescheduling, setRescheduling] = useState(false);

  // Load Metadata
  useEffect(() => {
    academicService.getDepartments().then((d) => setDepartments(d.data || [])).catch(() => {});
    academicService.getSubjects({ limit: 100, semester: 5 }).then((d) => setSubjects(d.data || [])).catch(() => {});
    facultyService.getFacultyList({ limit: 100 }).then((d) => setFacultyList(d.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (departments.length > 0 && !newSlot.department) {
      setNewSlot((prev) => ({ ...prev, department: departments[0]._id }));
    }
  }, [departments]);

  // Load Timetable
  const loadTimetable = useCallback(() => {
    setLoading(true);
    getTimetable({ semester: 5 })
      .then((d) => setTimetableData(d.data || { totalSlots: 0, days: {} }))
      .catch((err) => {
        console.error('Failed to load timetable:', err);
        setTimetableData({ totalSlots: 0, days: {} });
      })
      .finally(() => setLoading(false));
  }, []);

  // Load Today's Lectures
  const loadTodayLectures = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    getLectures({ date: today, semester: 5 })
      .then((d) => setTodayLectures(d.data || []))
      .catch(() => setTodayLectures([]));
  }, []);

  // Load Holidays
  const loadHolidays = useCallback(() => {
    getHolidays()
      .then((d) => setHolidays(d.data || []))
      .catch(() => setHolidays([]));
  }, []);

  // Load Rescheduling Required
  const loadReschedules = useCallback(() => {
    getReschedulingRequired({ semester: 5 })
      .then((d) => setPendingReschedules(d.data || []))
      .catch(() => setPendingReschedules([]));
  }, []);

  useEffect(() => {
    if (activeTab === 'timetable') loadTimetable();
    if (activeTab === 'today') loadTodayLectures();
    if (activeTab === 'holidays') loadHolidays();
    if (activeTab === 'reschedule') loadReschedules();
  }, [activeTab, loadTimetable, loadTodayLectures, loadHolidays, loadReschedules]);

  // Handle create slot
  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!newSlot.faculty) return toast.error('Please select a faculty member');
    if (!newSlot.subject) return toast.error('Please select a subject');

    setSavingSlot(true);
    try {
      await createTimetableSlot(newSlot);
      toast.success('Timetable slot added successfully');
      setShowAddSlot(false);
      loadTimetable();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add timetable slot');
    } finally {
      setSavingSlot(false);
    }
  };

  // Handle delete slot
  const handleDeleteSlot = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this timetable slot?')) return;
    try {
      await deleteTimetableSlot(id);
      toast.success('Slot removed');
      loadTimetable();
    } catch (err) {
      toast.error('Failed to remove slot');
    }
  };

  // Handle create holiday
  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.date) return toast.error('Date is required');
    if (!newHoliday.title) return toast.error('Title is required');

    setSavingHoliday(true);
    try {
      const res = await createHoliday(newHoliday);
      toast.success(res.message || 'Holiday added');
      setShowAddHoliday(false);
      loadHolidays();
      loadReschedules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create holiday');
    } finally {
      setSavingHoliday(false);
    }
  };

  // Handle delete holiday
  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Cancel this holiday and restore original scheduled lectures?')) return;
    try {
      await deleteHoliday(id);
      toast.success('Holiday cancelled and lectures restored');
      loadHolidays();
      loadReschedules();
    } catch (err) {
      toast.error('Failed to cancel holiday');
    }
  };

  // Handle manual reschedule
  const handleManualReschedule = async (e) => {
    e.preventDefault();
    if (!selectedLectureForReschedule) return;

    setRescheduling(true);
    try {
      await rescheduleLecture(selectedLectureForReschedule._id, manualRescheduleData);
      toast.success('Lecture manually rescheduled successfully');
      setSelectedLectureForReschedule(null);
      loadReschedules();
      if (activeTab === 'today') loadTodayLectures();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reschedule lecture');
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name} • {ACADEMIC_CONFIG.DEPARTMENT.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Smart Lecture Timetable & Scheduler</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Weekly schedule & automated conflict-free holiday shifting for <strong className="text-white">{ACADEMIC_CONFIG.SEMESTER.displayName}</strong>.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('timetable')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'timetable'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarDays size={14} aria-hidden="true" />
              <span>Timetable</span>
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'today'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock size={14} aria-hidden="true" />
              <span>Today's Sessions</span>
            </button>
            <button
              onClick={() => setActiveTab('holidays')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'holidays'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PartyPopper size={14} aria-hidden="true" />
              <span>Holidays & Shift</span>
            </button>
            <button
              onClick={() => setActiveTab('reschedule')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'reschedule'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle size={14} aria-hidden="true" />
              <span>Reschedule Required</span>
              {pendingReschedules.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-bold">
                  {pendingReschedules.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Context Bar & Action Button */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 font-bold text-blue-400">
              Department: {ACADEMIC_CONFIG.DEPARTMENT.name}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 font-bold text-emerald-400">
              {ACADEMIC_CONFIG.SEMESTER.displayName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'timetable' && (
              <button
                onClick={() => setShowAddSlot(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2"
              >
                <Plus size={14} aria-hidden="true" />
                <span>Add Timetable Slot</span>
              </button>
            )}
            {activeTab === 'holidays' && (
              <button
                onClick={() => setShowAddHoliday(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
              >
                <PartyPopper size={14} aria-hidden="true" />
                <span>Declare Holiday</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── TAB 1: WEEKLY TIMETABLE GRID ──────────────────────────────────── */}
        {activeTab === 'timetable' && (
          <div>
            {loading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <div className="text-slate-400 text-sm">Loading weekly schedule...</div>
              </div>
            ) : !timetableData || (timetableData.totalSlots || 0) === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CalendarDays size={24} className="text-slate-500" aria-hidden="true" />
                </div>
                <div className="text-lg font-semibold text-white">No Timetable Slots Found</div>
                <p className="text-slate-400 text-sm mt-1 mb-4">
                  {ACADEMIC_CONFIG.SEMESTER.displayName} has no active timetable slots configured yet.
                </p>
                <button
                  onClick={() => setShowAddSlot(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg"
                >
                  Create First Slot
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {DAYS.map((day) => {
                  const daySlots = timetableData?.days?.[day] || [];
                  return (
                    <div key={day} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
                      <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{day}</span>
                        <span className="text-xs font-mono text-slate-400">{daySlots.length} sessions</span>
                      </div>

                      <div className="p-4 space-y-3 flex-1">
                        {daySlots.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 text-xs italic">
                            No sessions scheduled
                          </div>
                        ) : (
                          daySlots.map((slot) => (
                            <div
                              key={slot._id}
                              className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 hover:border-slate-600 transition-all relative group"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-xs font-bold text-blue-400">
                                  {slot.startTime} – {slot.endTime}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                                  {slot.lectureType || 'Theory'}
                                </span>
                              </div>

                              <div className="font-bold text-white text-sm">{slot.subjectCode}</div>
                              <div className="text-xs text-slate-400 truncate">
                                {slot.subjectName || slot.subject?.subjectName}
                              </div>

                              <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                  <UserRound size={12} aria-hidden="true" />
                                  {slot.faculty?.fullName || slot.faculty?.name || 'Faculty'}
                                </span>
                                <span className="font-mono text-slate-300 flex items-center gap-1">
                                  <Building2 size={12} aria-hidden="true" />
                                  {slot.room || 'Classroom'}
                                </span>
                              </div>

                              {/* Delete Action on Hover */}
                              <button
                                onClick={() => handleDeleteSlot(slot._id)}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 text-xs px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800/60"
                                title="Remove Slot"
                              >
                                <X size={12} aria-hidden="true" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: TODAY'S SESSIONS ───────────────────────────────────────── */}
        {activeTab === 'today' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">Dynamic Session Feed for Today</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              {todayLectures.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No lectures scheduled for today.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {todayLectures.map((lec) => (
                    <div key={lec._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/20">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">{lec.subjectCode}</span>
                          <span className="text-xs text-slate-400">— {lec.subjectName || lec.subject?.subjectName}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                          <span className="font-mono text-blue-400 font-bold">{lec.startTime} – {lec.endTime}</span>
                          <span>|</span>
                          <span>Faculty: {lec.faculty?.fullName || lec.faculty?.name || 'Faculty'}</span>
                          <span>|</span>
                          <span>Room: {lec.room}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                            lec.status === 'scheduled'
                              ? 'bg-blue-950/80 text-blue-400 border border-blue-800/40'
                              : lec.status === 'shifted_due_to_holiday'
                              ? 'bg-purple-950/80 text-purple-400 border border-purple-800/40'
                              : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                          }`}
                        >
                          {lec.status}
                        </span>

                        <button
                          onClick={() => navigate('/faculty/attendance')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow flex items-center gap-1"
                        >
                          <Zap size={13} aria-hidden="true" />
                          <span>Attendance</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: HOLIDAYS & SHIFT LOGIC ─────────────────────────────────── */}
        {activeTab === 'holidays' && (
          <div className="space-y-6">
            <div className="bg-purple-950/20 border border-purple-800/30 rounded-xl p-4 text-xs text-purple-300 flex items-center gap-3">
              <Lightbulb size={18} className="text-purple-400 shrink-0" aria-hidden="true" />
              <div>
                <strong>Automated Holiday Shift:</strong> When an academic holiday is declared, the scheduler automatically marks falling lectures as shifted and deterministically reschedules them to the nearest conflict-free slot.
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Academic Calendar Holidays</h3>
                <span className="text-xs text-slate-400 font-mono">{holidays.length} configured</span>
              </div>

              {holidays.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No holidays declared yet. Click "Declare Holiday" above to add one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="text-left px-4 py-3 font-medium">Date</th>
                        <th className="text-left px-4 py-3 font-medium">Holiday Title</th>
                        <th className="text-center px-4 py-3 font-medium">Category</th>
                        <th className="text-center px-4 py-3 font-medium">Lectures Shifted</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-right px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {holidays.map((h) => (
                        <tr key={h._id} className="hover:bg-slate-800/20">
                          <td className="px-4 py-3 font-mono text-xs text-white">{h.date}</td>
                          <td className="px-4 py-3 text-white font-medium">{h.title}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              {h.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-emerald-400 font-bold">
                            {h.affectedLecturesCount || 0}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                h.status === 'active'
                                  ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/40'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {h.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {h.status === 'active' && (
                              <button
                                onClick={() => handleDeleteHoliday(h._id)}
                                className="px-2.5 py-1 rounded text-xs font-medium bg-red-950/40 border border-red-800/40 text-red-400 hover:bg-red-900/50 transition-colors"
                              >
                                Cancel & Restore
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 4: RESCHEDULING REQUIRED ──────────────────────────────────── */}
        {activeTab === 'reschedule' && (
          <div className="space-y-4">
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 text-xs text-amber-300 flex items-center gap-3">
              <AlertTriangle size={18} className="text-amber-400 shrink-0" aria-hidden="true" />
              <div>
                <strong>Manual Adjustment Needed:</strong> The lectures below could not be automatically shifted because lookahead slots had conflicts.
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Pending Rescheduling Queue</h3>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  {pendingReschedules.length} pending
                </span>
              </div>

              {pendingReschedules.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 size={24} className="text-emerald-500" aria-hidden="true" />
                  <span>No pending reschedules! All holiday-affected lectures were shifted.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {pendingReschedules.map((lec) => (
                    <div key={lec._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/20">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{lec.subjectCode}</span>
                          <span className="text-xs text-slate-400">— {lec.subjectName || lec.subject?.subjectName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-900/40 text-red-300 font-bold border border-red-800/40">
                            MISSED ON {lec.date}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Original Slot: {lec.dayOfWeek} {lec.startTime}–{lec.endTime} | Faculty: {lec.faculty?.fullName || lec.faculty?.name} | Room: {lec.room}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedLectureForReschedule(lec);
                          setManualRescheduleData({
                            newDate: new Date().toISOString().split('T')[0],
                            newStartTime: lec.startTime || '14:00',
                            newEndTime: lec.endTime || '15:00',
                            newRoom: lec.room || 'Room 201',
                            reason: 'Manual adjustment after holiday conflict',
                          });
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all shadow"
                      >
                        Reschedule Now
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MODAL: ADD TIMETABLE SLOT ─────────────────────────────────────── */}
        {showAddSlot && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Add Weekly Timetable Slot</h3>
                <button onClick={() => setShowAddSlot(false)} className="text-slate-400 hover:text-white" aria-label="Close">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleCreateSlot} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Day of Week *</label>
                    <select
                      value={newSlot.dayOfWeek}
                      onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Lecture Type</label>
                    <select
                      value={newSlot.lectureType}
                      onChange={(e) => setNewSlot({ ...newSlot, lectureType: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="theory">Theory</option>
                      <option value="practical">Practical</option>
                      <option value="tutorial">Tutorial</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subject *</label>
                  <select
                    value={newSlot.subject}
                    onChange={(e) => setNewSlot({ ...newSlot, subject: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  >
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.subjectCode} — {s.subjectName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Faculty Member *</label>
                  <select
                    value={newSlot.faculty}
                    onChange={(e) => setNewSlot({ ...newSlot, faculty: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  >
                    <option value="">Select faculty</option>
                    {facultyList.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.fullName} — {f.designation}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Start Time (HH:mm) *</label>
                    <input
                      type="time"
                      value={newSlot.startTime}
                      onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">End Time (HH:mm) *</label>
                    <input
                      type="time"
                      value={newSlot.endTime}
                      onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Room / Lab</label>
                  <input
                    type="text"
                    value={newSlot.room}
                    onChange={(e) => setNewSlot({ ...newSlot, room: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="e.g. Lab 3, Room 204"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddSlot(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSlot}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow flex items-center gap-2"
                  >
                    {savingSlot ? 'Checking Conflicts...' : 'Save Slot'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: DECLARE HOLIDAY ─────────────────────────────────────────── */}
        {showAddHoliday && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Declare Academic Holiday</h3>
                <button onClick={() => setShowAddHoliday(false)} className="text-slate-400 hover:text-white" aria-label="Close">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleCreateHoliday} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Holiday Date *</label>
                  <input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Title / Reason *</label>
                  <input
                    type="text"
                    value={newHoliday.title}
                    onChange={(e) => setNewHoliday({ ...newHoliday, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    placeholder="e.g. Ganesh Chaturthi, Independence Day"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select
                    value={newHoliday.type}
                    onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="national">National Holiday</option>
                    <option value="state">State Holiday</option>
                    <option value="institutional">Institutional Holiday</option>
                    <option value="emergency">Emergency / Weather Closure</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddHoliday(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingHoliday}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow"
                  >
                    {savingHoliday ? 'Applying Shift Logic...' : 'Declare & Shift'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: MANUAL RESCHEDULE ──────────────────────────────────────── */}
        {selectedLectureForReschedule && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Manual Lecture Reschedule</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {selectedLectureForReschedule.subjectCode} — {selectedLectureForReschedule.subjectName}
                  </div>
                </div>
                <button onClick={() => setSelectedLectureForReschedule(null)} className="text-slate-400 hover:text-white" aria-label="Close">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleManualReschedule} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">New Target Date *</label>
                  <input
                    type="date"
                    value={manualRescheduleData.newDate}
                    onChange={(e) => setManualRescheduleData({ ...manualRescheduleData, newDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">New Start Time (HH:mm) *</label>
                    <input
                      type="time"
                      value={manualRescheduleData.newStartTime}
                      onChange={(e) => setManualRescheduleData({ ...manualRescheduleData, newStartTime: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">New End Time (HH:mm) *</label>
                    <input
                      type="time"
                      value={manualRescheduleData.newEndTime}
                      onChange={(e) => setManualRescheduleData({ ...manualRescheduleData, newEndTime: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Room / Lab</label>
                  <input
                    type="text"
                    value={manualRescheduleData.newRoom}
                    onChange={(e) => setManualRescheduleData({ ...manualRescheduleData, newRoom: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Adjustment Reason</label>
                  <input
                    type="text"
                    value={manualRescheduleData.reason}
                    onChange={(e) => setManualRescheduleData({ ...manualRescheduleData, reason: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedLectureForReschedule(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rescheduling}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg shadow"
                  >
                    {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
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

export default FacultyTimetablePage;
