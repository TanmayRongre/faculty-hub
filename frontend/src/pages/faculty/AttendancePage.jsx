import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  UserRound,
  Clock,
  ShieldAlert,
  Save,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { studentService } from '../../services/managementService';
import {
  getAttendanceMatrix,
  submitAttendance,
  getDefaulters,
} from '../../services/attendanceService';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';

const AttendancePage = () => {
  // Tabs: 'matrix' | 'defaulters'
  const [activeTab, setActiveTab] = useState('matrix');

  // Filter state
  const [selectedSubject, setSelectedSubject] = useState(ACADEMIC_CONFIG.SUBJECTS[0].code);
  const [searchQuery, setSearchQuery] = useState('');

  // Data state
  const [matrixData, setMatrixData] = useState({ lectures: [], students: [] });
  const [defaultersData, setDefaultersData] = useState({ defaulters: [] });
  const [loading, setLoading] = useState(true);

  // Fast Attendance Modal state
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markDate, setMarkDate] = useState(new Date().toISOString().split('T')[0]);
  const [markSubject, setMarkSubject] = useState(ACADEMIC_CONFIG.SUBJECTS[0].code);
  const [markSlot, setMarkSlot] = useState('09:00 - 10:00');
  const [rosterStudents, setRosterStudents] = useState([]);
  const [absentEnrollments, setAbsentEnrollments] = useState(new Set());
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  // Load Matrix Data
  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const [matrixRes, defRes] = await Promise.all([
        getAttendanceMatrix({ subjectCode: selectedSubject, semester: 5 }),
        getDefaulters({ subjectCode: selectedSubject, semester: 5 }),
      ]);
      setMatrixData(matrixRes.data || { lectures: [], students: [] });
      setDefaultersData(defRes.data || { defaulters: [] });
    } catch (err) {
      console.error('Failed to load attendance matrix:', err);
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [selectedSubject]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // Load Student Roster for Fast Marking Modal
  const openMarkModal = async () => {
    try {
      const res = await studentService.getStudents({ limit: 100, semester: 5 });
      setRosterStudents(res.data || []);
      setAbsentEnrollments(new Set()); // All present by default
      setShowMarkModal(true);
    } catch (err) {
      toast.error('Failed to load student roster');
    }
  };

  // Toggle student absent status in modal
  const toggleAbsent = (enrollmentNumber) => {
    setAbsentEnrollments((prev) => {
      const next = new Set(prev);
      if (next.has(enrollmentNumber)) {
        next.delete(enrollmentNumber);
      } else {
        next.add(enrollmentNumber);
      }
      return next;
    });
  };

  // Mark all absent or reset
  const markAllAbsent = () => {
    const all = new Set(rosterStudents.map((s) => s.enrollmentNumber));
    setAbsentEnrollments(all);
    toast('All students marked Absent');
  };

  const markAllPresent = () => {
    setAbsentEnrollments(new Set());
    toast.success('All students marked Present');
  };

  // Submit Fast Attendance
  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!markDate) return toast.error('Date is required');
    if (!markSubject) return toast.error('Subject is required');

    setSubmittingAttendance(true);
    try {
      const payload = {
        date: markDate,
        subjectCode: markSubject,
        semester: 5,
        slot: markSlot.replace(/\s+/g, ''),
        absentEnrollments: Array.from(absentEnrollments),
      };

      const res = await submitAttendance(payload);
      toast.success(
        `Attendance recorded! Present: ${res.data.present}, Absent: ${res.data.absent}`,
        { duration: 4000 }
      );
      setShowMarkModal(false);
      loadMatrix();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record attendance');
    } finally {
      setSubmittingAttendance(false);
    }
  };

  // Filter students in matrix view
  const filteredMatrixStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matrixData.students || [];
    return (matrixData.students || []).filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.rollNumber?.toLowerCase().includes(q) ||
        s.enrollmentNumber?.toLowerCase().includes(q)
    );
  }, [matrixData.students, searchQuery]);

  return (
    <FacultyLayout>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name} • {ACADEMIC_CONFIG.DEPARTMENT.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Attendance Management Matrix</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Session-by-session matrix view for {ACADEMIC_CONFIG.SEMESTER.displayName}. All students default to <span className="text-emerald-400 font-semibold">Present</span>.
            </p>
          </div>

          {/* Actions: Refresh & Take Attendance */}
          <div className="flex items-center gap-3">
            <button
              onClick={loadMatrix}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-all flex items-center gap-2"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            <button
              onClick={openMarkModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Take Attendance</span>
            </button>
          </div>
        </div>

        {/* Tab & Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Subject Selector Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase mr-1">Subject:</span>
              {ACADEMIC_CONFIG.SUBJECTS.map((sub) => {
                const isActive = selectedSubject === sub.code;
                return (
                  <button
                    key={sub.code}
                    onClick={() => setSelectedSubject(sub.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 border border-blue-500'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700/60'
                    }`}
                  >
                    {sub.code}
                  </button>
                );
              })}
            </div>

            {/* Tab switch: Matrix View vs Defaulters */}
            <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                  activeTab === 'matrix' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Matrix View ({matrixData.lectures?.length || 0} Lectures)
              </button>
              <button
                onClick={() => setActiveTab('defaulters')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'defaulters' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldAlert size={13} aria-hidden="true" />
                Defaulters (&lt;75%)
                {defaultersData.defaulters?.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-950 text-white text-[10px] font-mono">
                    {defaultersData.defaulters.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                <Search size={14} aria-hidden="true" />
              </span>
              <input
                type="text"
                placeholder="Search Roll No or Student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-slate-400 font-mono hidden md:block">
              Defaulter Threshold: &lt; 75%
            </div>
          </div>
        </div>

        {/* ─── VIEW 1: MATRIX TABLE ────────────────────────────────────────── */}
        {activeTab === 'matrix' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {loading ? (
              <div className="p-16 text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <div className="text-slate-400 text-sm">Loading attendance matrix for {selectedSubject}...</div>
              </div>
            ) : filteredMatrixStudents.length === 0 ? (
              <div className="p-16 text-center text-slate-500 text-sm">
                No attendance records found. Click "Take Attendance" above to record the first session.
              </div>
            ) : (
              <div className="overflow-x-auto max-w-full">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/80 text-slate-400">
                      {/* Sticky Student Name & Roll No */}
                      <th className="sticky left-0 bg-slate-800 z-20 px-4 py-3.5 font-bold text-white border-r border-slate-700 min-w-[200px]">
                        Student Name
                      </th>
                      <th className="px-3 py-3.5 font-semibold text-center w-16 border-r border-slate-700">
                        Roll
                      </th>

                      {/* Dynamic Lecture Columns */}
                      {matrixData.lectures?.map((lec, idx) => (
                        <th
                          key={lec.lectureId || idx}
                          className="px-3 py-2 text-center border-r border-slate-800 min-w-[110px]"
                        >
                          <div className="font-bold text-slate-200 font-mono text-[11px]">{lec.date}</div>
                          <div className="text-[10px] text-blue-400 uppercase font-mono">{lec.subjectCode}</div>
                        </th>
                      ))}

                      {/* Summary Columns */}
                      <th className="px-4 py-3.5 font-bold text-center border-l border-slate-700 min-w-[90px]">
                        Attended
                      </th>
                      <th className="px-4 py-3.5 font-bold text-center min-w-[90px]">
                        Overall %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredMatrixStudents.map((student) => {
                      const isDef = student.isDefaulter;
                      return (
                        <tr
                          key={student.enrollmentNumber}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isDef ? 'bg-red-950/10' : ''
                          }`}
                        >
                          {/* Student Name */}
                          <td className="sticky left-0 bg-slate-900 hover:bg-slate-850 z-10 px-4 py-3 font-semibold text-white border-r border-slate-800 truncate max-w-[200px]">
                            {student.fullName}
                          </td>

                          {/* Roll No */}
                          <td className="px-3 py-3 text-center font-mono font-bold text-slate-400 border-r border-slate-800">
                            {student.rollNumber || '—'}
                          </td>

                          {/* Lecture Matrix Cells */}
                          {matrixData.lectures?.map((lec, idx) => {
                            const status = student.attendance[lec.lectureId];
                            const isPresent = status === 'Present';
                            const isAbsent = status === 'Absent';

                            return (
                              <td
                                key={lec.lectureId || idx}
                                className="px-3 py-3 text-center border-r border-slate-800/80 font-mono"
                              >
                                {isPresent && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-bold text-[11px]">
                                    P
                                  </span>
                                )}
                                {isAbsent && (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-red-950/80 text-red-400 border border-red-800/40 font-bold text-[11px]">
                                    A
                                  </span>
                                )}
                                {!status && <span className="text-slate-600 font-mono">—</span>}
                              </td>
                            );
                          })}

                          {/* Attended Count */}
                          <td className="px-4 py-3 text-center font-mono text-slate-300 font-semibold border-l border-slate-800">
                            {student.attendedCount} / {student.totalClasses}
                          </td>

                          {/* Overall Percentage */}
                          <td className="px-4 py-3 text-center font-mono font-bold">
                            <span
                              className={`px-2 py-1 rounded-md text-xs ${
                                isDef
                                  ? 'bg-red-950 text-red-400 border border-red-800/40'
                                  : student.percentage >= 85
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                  : 'bg-blue-950 text-blue-400 border border-blue-800/40'
                              }`}
                            >
                              {student.percentage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── VIEW 2: DEFAULTERS LIST ─────────────────────────────────────── */}
        {activeTab === 'defaulters' && (
          <div className="space-y-4">
            <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4 flex items-center justify-between text-red-300 text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400 shrink-0" aria-hidden="true" />
                <span>
                  Showing students with attendance below the mandatory <strong className="text-white">75%</strong> threshold.
                </span>
              </div>
              <span className="font-mono font-bold text-red-400">
                {defaultersData.defaulters?.length || 0} Defaulters
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              {defaultersData.defaulters?.length === 0 ? (
                <div className="p-16 text-center text-emerald-400 text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 size={32} className="text-emerald-500" aria-hidden="true" />
                  <span className="font-bold text-base">No Defaulters Found!</span>
                  <span className="text-slate-400 text-xs">All students maintain attendance ≥ 75%.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/50 text-slate-400 text-xs">
                        <th className="text-left px-5 py-3.5 font-semibold">Roll No</th>
                        <th className="text-left px-5 py-3.5 font-semibold">Enrollment Number</th>
                        <th className="text-center px-5 py-3.5 font-semibold">Classes Attended</th>
                        <th className="text-center px-5 py-3.5 font-semibold">Total Classes</th>
                        <th className="text-center px-5 py-3.5 font-semibold">Attendance %</th>
                        <th className="text-center px-5 py-3.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {defaultersData.defaulters?.map((d) => (
                        <tr key={d.enrollmentNumber} className="hover:bg-slate-800/20">
                          <td className="px-5 py-3.5 font-mono font-bold text-white">
                            {d.rollNumber || '—'}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                            {d.enrollmentNumber}
                          </td>
                          <td className="px-5 py-3.5 text-center font-mono text-red-400">
                            {d.totalPresent || d.attendedCount || 0}
                          </td>
                          <td className="px-5 py-3.5 text-center font-mono text-slate-400">
                            {d.totalClasses || 0}
                          </td>
                          <td className="px-5 py-3.5 text-center font-mono font-bold text-red-400">
                            {d.overallPercentage || d.percentage}%
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950/80 text-red-400 border border-red-800/40">
                              DEFAULTER
                            </span>
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

        {/* ─── MODAL: FAST ATTENDANCE RECORDING ─────────────────────────────── */}
        {showMarkModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Fast Attendance Marking</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click students who are <span className="text-red-400 font-bold">ABSENT</span>. Everyone is <span className="text-emerald-400 font-bold">Present</span> by default.
                  </p>
                </div>
                <button
                  onClick={() => setShowMarkModal(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Form Controls */}
              <form onSubmit={handleAttendanceSubmit} className="flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-medium">Session Date *</label>
                    <input
                      type="date"
                      value={markDate}
                      onChange={(e) => setMarkDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-medium">Subject *</label>
                    <select
                      value={markSubject}
                      onChange={(e) => setMarkSubject(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                    >
                      {ACADEMIC_CONFIG.SUBJECTS.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-medium">Time / Slot</label>
                    <input
                      type="text"
                      value={markSlot}
                      onChange={(e) => setMarkSlot(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      placeholder="e.g. 10:00 - 11:00"
                    />
                  </div>
                </div>

                {/* Quick Toggle Buttons */}
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="text-slate-400">
                    Present: <strong className="text-emerald-400 font-mono">{rosterStudents.length - absentEnrollments.size}</strong> | Absent: <strong className="text-red-400 font-mono">{absentEnrollments.size}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={markAllPresent}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px]"
                    >
                      Reset All Present
                    </button>
                    <button
                      type="button"
                      onClick={markAllAbsent}
                      className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/40 text-[11px]"
                    >
                      Mark All Absent
                    </button>
                  </div>
                </div>

                {/* Student Clickable Roster */}
                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl p-3 bg-slate-950/50 grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {rosterStudents.map((student) => {
                    const isAbsent = absentEnrollments.has(student.enrollmentNumber);
                    return (
                      <div
                        key={student._id || student.enrollmentNumber}
                        onClick={() => toggleAbsent(student.enrollmentNumber)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                          isAbsent
                            ? 'bg-red-950/40 border-red-800/60 shadow-md shadow-red-950/30'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-300">
                            {student.rollNumber || '—'}
                          </span>
                          <div>
                            <div className="font-semibold text-white text-xs leading-tight">
                              {student.fullName}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {student.enrollmentNumber}
                            </div>
                          </div>
                        </div>

                        {isAbsent ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/60 text-red-300 border border-red-700/50">
                            ABSENT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                            PRESENT
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Submit Bar */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowMarkModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAttendance || rosterStudents.length === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
                  >
                    {submittingAttendance ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} aria-hidden="true" />
                        <span>Save Attendance</span>
                      </>
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

export default AttendancePage;
