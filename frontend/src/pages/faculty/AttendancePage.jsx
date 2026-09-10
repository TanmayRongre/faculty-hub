import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Beaker,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Calendar,
  Clock,
  Search,
  RefreshCw,
  Users,
  ShieldAlert,
  History,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import {
  getRoster,
  saveAttendanceSession,
  getAttendanceHistory,
  getDefaulters,
} from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';

const ATTENDANCE_SUBJECTS = [
  { code: 'STE', name: 'Software Engineering' },
  { code: 'OSY', name: 'Operating System' },
  { code: 'ENDS', name: 'Entrepreneurship Development and Startups' },
  { code: 'ACN', name: 'Advance Computer Network' },
];

const PRACTICAL_BATCHES = [
  { batch: 'A', range: 'Roll No. 1–24', count: 24 },
  { batch: 'B', range: 'Roll No. 25–47', count: 23 },
  { batch: 'C', range: 'Roll No. 48–68', count: 21 },
];

const LECTURE_TIME_SLOTS = [
  '10:30 - 11:30',
  '11:30 - 12:30',
  '12:30 - 01:30',
];

const PRACTICAL_TIME_SLOTS = [
  '01:50 - 03:50',
  '04:00 - 06:00',
];

const AttendancePage = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  // Navigation Steps: 'TYPE' | 'SUBJECT' | 'BATCH' | 'MARKING' | 'HISTORY'
  const [step, setStep] = useState('TYPE');

  // Hierarchy Selection State
  const [attendanceType, setAttendanceType] = useState(null); // 'LECTURE' | 'PRACTICAL'
  const [selectedSubject, setSelectedSubject] = useState(null); // 'STE' | 'OSY' | 'ENDS' | 'ACN'
  const [selectedBatch, setSelectedBatch] = useState(null); // 'A' | 'B' | 'C'

  // Session Marking State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [slot, setSlot] = useState('10:30 - 11:30');
  const [roster, setRoster] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // { [rollNumber]: 'PRESENT' | 'ABSENT' }
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);

  // History & Defaulters State
  const [historyList, setHistoryList] = useState([]);
  const [defaultersList, setDefaultersList] = useState([]);
  const [historyTab, setHistoryTab] = useState('sessions'); // 'sessions' | 'defaulters'
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ─── Hierarchy Handlers ───────────────────────────────────────────────────

  const handleSelectType = (type) => {
    setAttendanceType(type);
    setSelectedSubject(null);
    setSelectedBatch(null);
    setSlot(type === 'PRACTICAL' ? '01:50 - 03:50' : '10:30 - 11:30');
    setStep('SUBJECT');
  };

  const handleSelectSubject = (subCode) => {
    setSelectedSubject(subCode);
    if (attendanceType === 'PRACTICAL') {
      setSelectedBatch(null);
      setStep('BATCH');
    } else {
      setSelectedBatch(null);
      fetchRosterAndProceed('LECTURE', subCode, null, date);
    }
  };

  const handleSelectBatch = (batchId) => {
    setSelectedBatch(batchId);
    fetchRosterAndProceed('PRACTICAL', selectedSubject, batchId, date);
  };

  // Fetch exact student slice for marking
  const fetchRosterAndProceed = async (type, subCode, batchId, targetDate = date) => {
    setLoadingRoster(true);
    try {
      const res = await getRoster({
        attendanceType: type,
        subjectCode: subCode,
        batch: batchId,
        date: targetDate,
      });

      const students = res.students || [];
      setRoster(students);

      // Present by default for all students in the slice
      const initialMap = {};
      for (const s of students) {
        initialMap[String(s.rollNumber)] = 'PRESENT';
      }
      setAttendanceMap(initialMap);
      setSearchQuery('');
      setStep('MARKING');
    } catch (err) {
      console.error('Failed to load roster:', err);
      toast.error(err.response?.data?.message || 'Failed to load student roster');
    } finally {
      setLoadingRoster(false);
    }
  };

  // Pre-populate if query parameters exist (e.g. from substitution or timetable quick action)
  useEffect(() => {
    const subParam = searchParams.get('subject');
    const batchParam = searchParams.get('batch');
    const dateParam = searchParams.get('date');

    if (subParam) {
      const type = batchParam ? 'PRACTICAL' : 'LECTURE';
      const effectiveDate = dateParam || date;
      setAttendanceType(type);
      setSelectedSubject(subParam);
      if (dateParam) setDate(dateParam);
      if (batchParam) {
        setSelectedBatch(batchParam);
        fetchRosterAndProceed('PRACTICAL', subParam, batchParam, effectiveDate);
      } else {
        fetchRosterAndProceed('LECTURE', subParam, null, effectiveDate);
      }
    }
  }, [searchParams]);

  // ─── Status Modification ──────────────────────────────────────────────────

  const toggleStudentStatus = (rollNumber) => {
    setAttendanceMap((prev) => {
      const current = prev[rollNumber] || 'PRESENT';
      return {
        ...prev,
        [rollNumber]: current === 'PRESENT' ? 'ABSENT' : 'PRESENT',
      };
    });
  };

  const setAllStatus = (status) => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      for (const s of roster) {
        next[String(s.rollNumber)] = status;
      }
      return next;
    });
    toast.success(`Marked all students as ${status === 'PRESENT' ? 'Present' : 'Absent'}`);
  };

  // ─── Save Attendance ──────────────────────────────────────────────────────

  const handleSaveAttendance = async () => {
    if (!date) {
      toast.error('Please select a valid date');
      return;
    }

    setSaving(true);
    try {
      const records = roster.map((s) => ({
        rollNumber: s.rollNumber,
        enrollmentNumber: s.enrollmentNumber,
        status: attendanceMap[String(s.rollNumber)] || 'PRESENT',
      }));

      const absentRolls = roster
        .filter((s) => (attendanceMap[String(s.rollNumber)] || 'PRESENT') === 'ABSENT')
        .map((s) => String(s.rollNumber));

      const payload = {
        attendanceType,
        subjectCode: selectedSubject,
        batch: attendanceType === 'PRACTICAL' ? selectedBatch : null,
        date,
        slot,
        absentRolls,
        records,
      };

      const res = await saveAttendanceSession(payload);
      toast.success(
        `Attendance saved! Present: ${res.data.present} | Absent: ${res.data.absent}`,
        { duration: 4500 }
      );
    } catch (err) {
      console.error('Failed to save attendance:', err);
      toast.error(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // ─── History & Defaulters Loading ─────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [histRes, defRes] = await Promise.all([
        getAttendanceHistory(),
        getDefaulters(),
      ]);
      setHistoryList(histRes.data || []);
      setDefaultersList(defRes.data?.defaulters || []);
    } catch (err) {
      console.error('Failed to load history:', err);
      toast.error('Failed to load attendance history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (step === 'HISTORY') {
      loadHistory();
    }
  }, [step, loadHistory]);

  // ─── Filtered Roster for Table ────────────────────────────────────────────

  const filteredRoster = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return roster;
    return roster.filter(
      (s) =>
        String(s.rollNumber).toLowerCase().includes(q) ||
        s.fullName?.toLowerCase().includes(q) ||
        s.enrollmentNumber?.toLowerCase().includes(q)
    );
  }, [roster, searchQuery]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    for (const s of roster) {
      if (attendanceMap[String(s.rollNumber)] === 'ABSENT') {
        absent++;
      } else {
        present++;
      }
    }
    return { present, absent, total: roster.length };
  }, [roster, attendanceMap]);

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">

        {/* ─── Top Bar & Breadcrumb Navigation ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            {/* Breadcrumb Hierarchy */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1 flex-wrap">
              <button
                onClick={() => setStep('TYPE')}
                className="hover:text-blue-400 transition-colors uppercase tracking-wider"
              >
                Attendance
              </button>
              {attendanceType && step !== 'TYPE' && (
                <>
                  <ChevronRight size={12} className="text-slate-600" />
                  <button
                    onClick={() => setStep('SUBJECT')}
                    className="hover:text-blue-400 transition-colors uppercase tracking-wider text-blue-400"
                  >
                    {attendanceType}
                  </button>
                </>
              )}
              {selectedSubject && (step === 'BATCH' || step === 'MARKING') && (
                <>
                  <ChevronRight size={12} className="text-slate-600" />
                  <span className="text-white font-bold">{selectedSubject}</span>
                </>
              )}
              {selectedBatch && step === 'MARKING' && (
                <>
                  <ChevronRight size={12} className="text-slate-600" />
                  <span className="text-purple-400 font-bold">Batch {selectedBatch}</span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {step === 'TYPE' && 'Attendance Management'}
              {step === 'SUBJECT' && `${attendanceType} Attendance — Select Subject`}
              {step === 'BATCH' && `${selectedSubject} — Practical — Select Batch`}
              {step === 'MARKING' &&
                (attendanceType === 'LECTURE'
                  ? `${selectedSubject} — Lecture Attendance`
                  : `${selectedSubject} — Practical — Batch ${selectedBatch}`)}
              {step === 'HISTORY' && 'Attendance History & Analytics'}
            </h1>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5">
            {step !== 'TYPE' && step !== 'HISTORY' && (
              <button
                onClick={() => {
                  if (step === 'MARKING') {
                    setStep(attendanceType === 'PRACTICAL' ? 'BATCH' : 'SUBJECT');
                  } else if (step === 'BATCH') {
                    setStep('SUBJECT');
                  } else if (step === 'SUBJECT') {
                    setStep('TYPE');
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}

            {step !== 'HISTORY' ? (
              <button
                onClick={() => setStep('HISTORY')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <History size={15} className="text-blue-400" />
                <span>History &amp; Defaulters</span>
              </button>
            ) : (
              <button
                onClick={() => setStep('TYPE')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-900/30 flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                <span>Take Attendance</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── SCREEN 1: PRIMARY TWO CHOICES (LECTURE OR PRACTICAL) ─────────── */}
        {step === 'TYPE' && (
          <div className="space-y-6 pt-4">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/40">
                Primary Selection
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Select Attendance Type</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Choose whether you are recording a theory lecture common for the entire class, or a laboratory practical for a specific student batch.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto pt-2">
              {/* 1. LECTURE CARD */}
              <button
                onClick={() => handleSelectType('LECTURE')}
                className="group relative text-left p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900 border-2 border-slate-700/80 hover:border-blue-500 shadow-xl hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-200 transform hover:-translate-y-1 focus:outline-none"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="p-3.5 rounded-xl bg-blue-950/80 border border-blue-700/50 text-blue-400 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <BookOpen size={28} />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800/60">
                    68 Students
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                  Lecture Attendance
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-4">
                  Common theory session for the entire 5th semester Computer Engineering class. All 68 students are presented in numerical roll order (Roll 1–68).
                </p>
                <div className="flex items-center text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                  <span>Continue to Subject Selection</span>
                  <ChevronRight size={14} className="ml-1" />
                </div>
              </button>

              {/* 2. PRACTICAL CARD */}
              <button
                onClick={() => handleSelectType('PRACTICAL')}
                className="group relative text-left p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-800/90 to-slate-900 border-2 border-slate-700/80 hover:border-purple-500 shadow-xl hover:shadow-2xl hover:shadow-purple-900/20 transition-all duration-200 transform hover:-translate-y-1 focus:outline-none"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="p-3.5 rounded-xl bg-purple-950/80 border border-purple-700/50 text-purple-400 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <Beaker size={28} />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                    Batches A / B / C
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  Practical Attendance
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-4">
                  Laboratory practical sessions divided into 3 dedicated batches: Batch A (Roll 1–24), Batch B (Roll 25–47), and Batch C (Roll 48–68).
                </p>
                <div className="flex items-center text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">
                  <span>Select Subject &amp; Batch</span>
                  <ChevronRight size={14} className="ml-1" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ─── SCREEN 2: SELECT SUBJECT (STE, OSY, ENDS, ACN) ───────────────── */}
        {step === 'SUBJECT' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  Step 2 of {attendanceType === 'PRACTICAL' ? '3' : '2'}
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Select {attendanceType === 'LECTURE' ? 'Lecture' : 'Practical'} Subject
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ATTENDANCE_SUBJECTS.map((sub) => (
                <button
                  key={sub.code}
                  onClick={() => handleSelectSubject(sub.code)}
                  className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/80 hover:bg-slate-800/90 text-left transition-all group shadow-lg hover:shadow-blue-900/10"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-mono font-black text-blue-400 group-hover:text-white transition-colors">
                      {sub.code}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      5th Sem
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200 group-hover:text-blue-300 transition-colors mb-2">
                    {sub.name}
                  </h4>
                  <div className="flex items-center text-xs font-medium text-slate-400 group-hover:text-blue-400 pt-2 border-t border-slate-800">
                    <span>Select Subject</span>
                    <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── SCREEN 3: SELECT BATCH (PRACTICAL ONLY: A, B, C) ─────────────── */}
        {step === 'BATCH' && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Step 3 of 3 • Practical Laboratory Batch
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                {selectedSubject} Practical — Select Batch
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Each batch contains a fixed, non-overlapping subset of the 68 students.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {PRACTICAL_BATCHES.map((b) => (
                <button
                  key={b.batch}
                  onClick={() => handleSelectBatch(b.batch)}
                  className="p-6 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500 hover:bg-slate-800/90 text-left transition-all group shadow-xl hover:shadow-purple-900/20"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center font-black text-xl text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all">
                      {b.batch}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300">
                      {b.count} Students
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white mb-1">Batch {b.batch}</h4>
                  <p className="text-xs font-mono text-purple-400 font-semibold mb-3">{b.range}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Attendance will be recorded strictly for {b.count} students belonging to Batch {b.batch}.
                  </p>
                  <div className="flex items-center text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">
                    <span>Open Attendance Sheet</span>
                    <ChevronRight size={14} className="ml-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── SCREEN 4: ATTENDANCE MARKING SHEET (ALL 68 OR BATCH) ──────────── */}
        {step === 'MARKING' && (
          <div className="space-y-5">
            {/* Session Info & Controls Header */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Session Meta */}
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${attendanceType === 'LECTURE' ? 'bg-blue-950/80 border border-blue-700/50 text-blue-400' : 'bg-purple-950/80 border border-purple-700/50 text-purple-400'}`}>
                    {attendanceType === 'LECTURE' ? <BookOpen size={24} /> : <Beaker size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {attendanceType}
                      </span>
                      <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                        {selectedSubject}
                      </span>
                      {selectedBatch && (
                        <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                          Batch {selectedBatch}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {attendanceType === 'LECTURE'
                        ? 'Common Theory • Full Class (68 Students)'
                        : `Laboratory Session • Batch ${selectedBatch} (${counts.total} Students)`}
                    </div>
                  </div>
                </div>

                {/* Date & Time Slot Pickers */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                    <Calendar size={14} className="text-slate-400" />
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-transparent text-white focus:outline-none font-mono text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                    <Clock size={14} className="text-slate-400" />
                    <select
                      value={slot}
                      onChange={(e) => setSlot(e.target.value)}
                      className="bg-transparent text-white focus:outline-none font-mono text-xs cursor-pointer"
                    >
                      {(attendanceType === 'PRACTICAL' ? PRACTICAL_TIME_SLOTS : LECTURE_TIME_SLOTS).map((s) => (
                        <option key={s} value={s} className="bg-slate-800 text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick slot selection pills */}
                  <div className="flex items-center gap-1.5">
                    {(attendanceType === 'PRACTICAL' ? PRACTICAL_TIME_SLOTS : LECTURE_TIME_SLOTS).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                          slot === s
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700/60'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Counts & Search / Utility Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-800">
                {/* Status Badges */}
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span>Present: {counts.present}</span>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-red-950/60 border border-red-800/40 text-red-300 text-xs font-bold flex items-center gap-1.5">
                    <XCircle size={13} className="text-red-400" />
                    <span>Absent: {counts.absent}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono hidden sm:inline">
                    Total: {counts.total}
                  </div>
                </div>

                {/* Bulk Actions & Search */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAllStatus('PRESENT')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
                  >
                    All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllStatus('ABSENT')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
                  >
                    All Absent
                  </button>

                  {/* Search Input */}
                  <div className="relative">
                    <Search size={13} className="absolute inset-y-0 left-2.5 my-auto text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search roll or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-7 pr-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-52"
                    />
                  </div>

                  {/* Primary Save Button */}
                  <button
                    onClick={handleSaveAttendance}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center gap-1.5"
                  >
                    {saving ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    <span>{saving ? 'Saving...' : 'SAVE ATTENDANCE'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Attendance Roster Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              {loadingRoster ? (
                <div className="p-16 text-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <div className="text-slate-400 text-sm">Loading attendance roster...</div>
                </div>
              ) : filteredRoster.length === 0 ? (
                <div className="p-16 text-center text-slate-500 text-sm">
                  No students found matching your query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/70 text-slate-300 text-xs">
                        <th className="text-center px-4 py-3 font-bold w-20">Roll No.</th>
                        <th className="text-left px-5 py-3 font-bold">Student Name</th>
                        <th className="text-center px-4 py-3 font-bold w-36">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredRoster.map((student) => {
                        const roll = String(student.rollNumber);
                        const status = attendanceMap[roll] || 'PRESENT';
                        const isAbsent = status === 'ABSENT';

                        return (
                          <tr
                            key={student._id || roll}
                            className={`hover:bg-slate-800/30 transition-colors ${
                              isAbsent ? 'bg-red-950/15' : ''
                            }`}
                          >
                            {/* 1. Roll No. */}
                            <td className="px-4 py-3 text-center font-mono font-bold text-slate-200">
                              {student.rollNumber}
                            </td>

                            {/* 2. Student Name */}
                            <td className="px-5 py-3 text-white font-medium">
                              {student.fullName}
                              <span className="text-[11px] font-mono text-slate-500 ml-2 hidden sm:inline">
                                ({student.enrollmentNumber})
                              </span>
                            </td>

                            {/* 3. Attendance Toggle Buttons */}
                            <td className="px-4 py-3 text-center">
                              <div className="inline-flex rounded-lg p-1 bg-slate-800/90 border border-slate-700/80 gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAttendanceMap((prev) => ({ ...prev, [roll]: 'PRESENT' }));
                                  }}
                                  className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                                    !isAbsent
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <CheckCircle2 size={12} />
                                  <span>Present</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAttendanceMap((prev) => ({ ...prev, [roll]: 'ABSENT' }));
                                  }}
                                  className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                                    isAbsent
                                      ? 'bg-red-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <XCircle size={12} />
                                  <span>Absent</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sticky Bottom Save Bar */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Default: <strong className="text-emerald-400">Present</strong> • Toggle individual students to <strong className="text-red-400">Absent</strong>.
              </div>
              <button
                onClick={handleSaveAttendance}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-lg shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
              >
                {saving ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span>{saving ? 'Saving...' : 'SAVE ATTENDANCE'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── SCREEN 5: HISTORY & DEFAULTERS VIEW ───────────────────────────── */}
        {step === 'HISTORY' && (
          <div className="space-y-6">
            {/* Tabs Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setHistoryTab('sessions')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    historyTab === 'sessions' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Recorded Sessions ({historyList.length})
                </button>
                <button
                  onClick={() => setHistoryTab('defaulters')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    historyTab === 'defaulters' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldAlert size={13} />
                  <span>Defaulters (&lt; 75%)</span>
                  {defaultersList.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-950 text-white text-[10px] font-mono">
                      {defaultersList.length}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={loadHistory}
                disabled={loadingHistory}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {historyTab === 'sessions' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                {loadingHistory ? (
                  <div className="p-16 text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <div className="text-slate-400 text-sm">Loading attendance history...</div>
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="p-16 text-center text-slate-500 text-sm">
                    No attendance sessions recorded yet. Click "Take Attendance" to record the first session.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/70 text-slate-300 text-xs">
                          <th className="text-left px-5 py-3.5 font-bold">Type</th>
                          <th className="text-left px-4 py-3.5 font-bold">Subject</th>
                          <th className="text-center px-4 py-3.5 font-bold">Batch</th>
                          <th className="text-left px-4 py-3.5 font-bold">Date &amp; Slot</th>
                          <th className="text-center px-4 py-3.5 font-bold">Present</th>
                          <th className="text-center px-4 py-3.5 font-bold">Absent</th>
                          <th className="text-center px-4 py-3.5 font-bold">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {historyList.map((item) => (
                          <tr key={item.sessionId} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-white">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                                item.attendanceType === 'LECTURE'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                                  : 'bg-purple-950 text-purple-300 border border-purple-800/60'
                              }`}>
                                {item.attendanceType}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-blue-400">
                              {item.subjectCode}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-300">
                              {item.batch !== '—' ? (
                                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-purple-300">
                                  Batch {item.batch}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-slate-300 font-mono text-xs">
                              <div>{item.date}</div>
                              <div className="text-[11px] text-slate-500">{item.slot}</div>
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-emerald-400 font-mono">
                              {item.presentCount}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-red-400 font-mono">
                              {item.absentCount}
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold font-mono">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                item.percentage >= 75
                                  ? 'text-emerald-400 bg-emerald-950/40'
                                  : 'text-red-400 bg-red-950/40'
                              }`}>
                                {item.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {historyTab === 'defaulters' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                {loadingHistory ? (
                  <div className="p-16 text-center">
                    <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <div className="text-slate-400 text-sm">Computing defaulter statistics...</div>
                  </div>
                ) : defaultersList.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 text-sm">
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                    No attendance defaulters found! All students maintain 75% or higher attendance.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/70 text-slate-300 text-xs">
                          <th className="text-center px-4 py-3.5 font-bold w-20">Roll No.</th>
                          <th className="text-left px-5 py-3.5 font-bold">Student Name</th>
                          <th className="text-center px-4 py-3.5 font-bold">Batch</th>
                          <th className="text-center px-4 py-3.5 font-bold">Conducted</th>
                          <th className="text-center px-4 py-3.5 font-bold">Attended</th>
                          <th className="text-center px-4 py-3.5 font-bold">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {defaultersList.map((student) => (
                          <tr key={student.rollNumber} className="hover:bg-slate-800/30 transition-colors bg-red-950/10">
                            <td className="px-4 py-3.5 text-center font-mono font-bold text-red-300">
                              {student.rollNumber}
                            </td>
                            <td className="px-5 py-3.5 text-white font-medium">
                              {student.fullName}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono font-bold text-purple-300">
                              Batch {student.batch}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono text-slate-300">
                              {student.conducted}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono text-slate-300">
                              {student.attended}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono font-bold text-red-400">
                              {student.percentage}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </FacultyLayout>
  );
};

export default AttendancePage;
