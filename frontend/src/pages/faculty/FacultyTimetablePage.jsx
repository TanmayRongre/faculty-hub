import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Clock,
  UserRound,
  Building2,
  BookOpen,
  Activity,
  Users,
  GraduationCap,
  Info,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FacultyLayout from './FacultyLayout';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';
import { facultyService } from '../../services/managementService';
import { getFacultyAssignments } from '../../services/timetableService';

// ─── TIMETABLE DATA DEFINITIONS ──────────────────────────────────────────────
// Subjects and rooms are fixed according to Semester V CE official curriculum.
// Faculty names are dynamically resolved from Admin Panel -> Faculty Management.

const MORNING_SLOTS = ['10:30–11:30', '11:30–12:30', '12:30–1:30'];

const MORNING_SCHEDULE = [
  {
    day: 'Monday',
    slots: [
      { subject: 'STE', room: '109' },
      { subject: 'OSY', room: '109' },
      { subject: 'ACN', room: '109' },
    ],
  },
  {
    day: 'Tuesday',
    slots: [
      { subject: 'ACN', room: '109' },
      { subject: 'OSY', room: '109' },
      { subject: 'STE', room: '109' },
    ],
  },
  {
    day: 'Wednesday',
    slots: [
      { subject: 'OSY', room: '109' },
      { subject: 'ACN', room: '109' },
      { subject: 'STE', room: '109' },
    ],
  },
  {
    day: 'Thursday',
    slots: [
      { subject: 'OSY', room: '109' },
      { subject: 'STE', room: '109' },
      { subject: 'ENDS', room: '109' },
    ],
  },
  {
    day: 'Friday',
    slots: [
      { subject: 'ACN', room: '109' },
      { subject: 'OSY', room: '109' },
      { isOff: true },
    ],
  },
];

const AFTERNOON_SCHEDULE = [
  {
    day: 'Monday',
    rows: [
      {
        time: '1:50–2:50',
        batchA: { subject: 'OSY', room: 'CL5' },
        batchB: { subject: 'STE', room: 'CL7' },
        batchC: { subject: 'ENDS', room: '109' },
      },
      {
        time: '2:50–3:50',
        batchA: { subject: 'STE', room: 'CL7' },
        batchB: { subject: 'ACN', room: 'CL5' },
        batchC: { type: 'library', label: 'Library Time' },
      },
    ],
  },
  {
    day: 'Tuesday',
    rows: [
      {
        time: '1:50–2:50',
        batchA: { subject: 'ACN', room: 'CL5' },
        batchB: { type: 'library', label: 'Library Time' },
        batchC: { subject: 'STE', room: 'CL6' },
      },
      {
        time: '4:00–5:00',
        isCommon: true,
        type: 'sports',
        label: 'Cocurricular Activities / Sports Time',
      },
    ],
  },
  {
    day: 'Wednesday',
    rows: [
      {
        time: '1:50–2:50',
        batchA: { subject: 'STE', room: 'CL6' },
        batchB: { subject: 'ENDS', room: '109' },
        batchC: { subject: 'OSY', room: 'CL5' },
      },
      {
        time: '4:00–5:00',
        isCommon: true,
        type: 'sports',
        label: 'Cocurricular Activities / Sports Time',
      },
    ],
  },
  {
    day: 'Thursday',
    rows: [
      {
        time: '1:50–2:50',
        batchA: { type: 'library', label: 'Library Time' },
        batchB: { subject: 'OSY', room: 'CL5' },
        batchC: { subject: 'STE', room: 'CL7' },
      },
      {
        time: '4:00–5:00',
        batchA: { subject: 'SPI', room: 'CL1' },
        batchB: { subject: 'SPI', room: 'CL5' },
        batchC: { subject: 'SPI', room: 'CL7' },
      },
    ],
  },
  {
    day: 'Friday',
    rows: [
      {
        time: '1:50–2:50',
        batchA: { subject: 'ENDS', room: '109' },
        batchB: { subject: 'STE', room: 'CL7' },
        batchC: { subject: 'ACN', room: 'CL5' },
      },
    ],
  },
];

// Subject theme tokens for consistent aesthetics
const SUBJECT_THEMES = {
  STE: {
    bg: 'bg-blue-950/40',
    border: 'border-blue-700/50',
    badgeBg: 'bg-blue-900/60',
    text: 'text-blue-300',
    roomText: 'text-blue-400',
  },
  OSY: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-700/50',
    badgeBg: 'bg-emerald-900/60',
    text: 'text-emerald-300',
    roomText: 'text-emerald-400',
  },
  ACN: {
    bg: 'bg-purple-950/40',
    border: 'border-purple-700/50',
    badgeBg: 'bg-purple-900/60',
    text: 'text-purple-300',
    roomText: 'text-purple-400',
  },
  ENDS: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-700/50',
    badgeBg: 'bg-amber-900/60',
    text: 'text-amber-300',
    roomText: 'text-amber-400',
  },
  SPI: {
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-700/50',
    badgeBg: 'bg-cyan-900/60',
    text: 'text-cyan-300',
    roomText: 'text-cyan-400',
  },
};

const LEGEND_ITEMS = [
  { code: 'STE', name: 'Software Testing', color: 'text-blue-400' },
  { code: 'OSY', name: 'Operating System', color: 'text-emerald-400' },
  { code: 'ACN', name: 'Advanced Computer Network', color: 'text-purple-400' },
  { code: 'ENDS', name: 'Environmental Studies', color: 'text-amber-400' },
  { code: 'SPI', name: 'Scripting Language (Python)', color: 'text-cyan-400' },
];

// ─── DYNAMIC TIMETABLE CELL RENDERER ─────────────────────────────────────────

const TimetableCell = ({ item, assignedFacultyName }) => {
  if (!item) return null;

  if (item.isOff) {
    return (
      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-lg p-2.5 flex items-center justify-center min-h-[76px] text-xs font-bold text-slate-500 uppercase tracking-wider">
        OFF
      </div>
    );
  }

  if (item.type === 'library') {
    return (
      <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-lg p-2.5 flex items-center justify-center gap-1.5 min-h-[76px] text-xs font-semibold text-indigo-300">
        <BookOpen size={13} className="text-indigo-400 shrink-0" aria-hidden="true" />
        <span>Library Time</span>
      </div>
    );
  }

  if (item.type === 'sports') {
    return (
      <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2.5 flex items-center justify-center gap-2 min-h-[60px] text-xs font-semibold text-emerald-300">
        <Activity size={13} className="text-emerald-400 shrink-0" aria-hidden="true" />
        <span>Cocurricular Activities / Sports Time</span>
      </div>
    );
  }

  const theme = SUBJECT_THEMES[item.subject] || {
    bg: 'bg-slate-800/60',
    border: 'border-slate-700/60',
    badgeBg: 'bg-slate-800',
    text: 'text-white',
    roomText: 'text-slate-300',
  };

  return (
    <div
      className={`${theme.bg} border ${theme.border} rounded-lg p-2.5 flex flex-col justify-between min-h-[76px] hover:border-slate-500 transition-colors shadow-xs`}
    >
      {/* Top: Subject code & Room */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className={`font-bold text-sm tracking-wide ${theme.text}`}>
          {item.subject}
        </span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border border-slate-700/60 ${theme.badgeBg} ${theme.roomText}`}
        >
          Room {item.room}
        </span>
      </div>

      {/* Bottom: Dynamically assigned faculty */}
      <div className="flex items-center gap-1.5 text-xs">
        <UserRound size={11} className="text-slate-400 shrink-0" aria-hidden="true" />
        <span className="text-slate-400 text-[11px]">Faculty:</span>
        {assignedFacultyName ? (
          <span className="text-white font-medium truncate" title={assignedFacultyName}>
            {assignedFacultyName}
          </span>
        ) : (
          <span className="text-amber-400/90 font-medium italic text-[11px]">
            Not Assigned
          </span>
        )}
      </div>
    </div>
  );
};

// ─── MAIN TIMETABLE PAGE COMPONENT ───────────────────────────────────────────

const FacultyTimetablePage = () => {
  // Current Day of Week Detection
  const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Dynamic faculty assignments loaded from database (Admin Panel -> Faculty Management)
  const [facultyAssignments, setFacultyAssignments] = useState({});
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentsRes, facultyRes] = await Promise.all([
        getFacultyAssignments().catch(() => ({ data: {} })),
        facultyService.getFacultyList({ limit: 100 }).catch(() => ({ data: [] })),
      ]);

      setFacultyAssignments(assignmentsRes.data || {});
      setFacultyList(facultyRes.data || []);
    } catch (err) {
      console.error('Failed to load faculty assignments for timetable:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  /**
   * Resolves assigned faculty name dynamically for a subject code.
   * If subject is assigned to a faculty member in database -> returns faculty name.
   * If not assigned -> returns null (cell renders 'Faculty: Not Assigned').
   */
  const getAssignedFacultyForSubject = (subjectCode) => {
    if (!subjectCode) return null;
    const code = subjectCode.toUpperCase();

    // 1. Check direct dictionary from getFacultyAssignments
    const assignedFromApi = facultyAssignments[code];
    if (assignedFromApi && assignedFromApi.length > 0) {
      return assignedFromApi.map((f) => f.fullName).join(', ');
    }

    // 2. Fallback to facultyList inspection
    const matches = facultyList.filter(
      (f) => f.status !== 'inactive' && f.subjects?.some((s) => s.subjectCode === code)
    );
    if (matches.length > 0) {
      return matches.map((f) => f.fullName).join(', ');
    }

    return null;
  };

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* 1. Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Timetable
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              <strong className="text-white">Computer Engineering • Semester V</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Users size={13} className="text-blue-400" aria-hidden="true" />
              <span>68 Students Enrolled</span>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <GraduationCap size={13} className="text-emerald-400" aria-hidden="true" />
              <span>Batches: A (1–24), B (25–47), C (48–68)</span>
            </span>
          </div>
        </div>

        {/* 2. Morning / Written Timetable */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays size={18} className="text-blue-400" aria-hidden="true" />
                <span>Morning — Written Lectures</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Common lecture sessions for all 68 students • Conducted in Room 109
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 self-start sm:self-auto">
              10:30 AM – 1:30 PM
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700/80 text-xs font-semibold text-slate-300">
                  <th className="py-3 px-4 w-36">Day</th>
                  {MORNING_SLOTS.map((slot) => (
                    <th key={slot} className="py-3 px-4 font-mono text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock size={12} className="text-blue-400" aria-hidden="true" />
                        <span>{slot}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {MORNING_SCHEDULE.map((row) => {
                  const isToday = row.day === currentDayName;
                  return (
                    <tr
                      key={row.day}
                      className={`transition-colors ${
                        isToday
                          ? 'bg-blue-950/25 hover:bg-blue-950/35 border-l-4 border-l-blue-500'
                          : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{row.day}</span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500 text-white">
                              Today
                            </span>
                          )}
                        </div>
                      </td>
                      {row.slots.map((slot, idx) => (
                        <td key={idx} className="py-2.5 px-3">
                          <TimetableCell
                            item={slot}
                            assignedFacultyName={getAssignedFacultyForSubject(slot.subject)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Afternoon Practical / Batch Timetable */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-purple-400" aria-hidden="true" />
                <span>Afternoon — Practical / Batch Schedule</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Batch-wise lab practicals and student co-curricular activities
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 self-start sm:self-auto">
              1:50 PM – 5:00 PM
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700/80 text-xs font-semibold text-slate-300">
                  <th className="py-3 px-4 w-32">Day</th>
                  <th className="py-3 px-3 w-32 font-mono text-center">Time</th>
                  <th className="py-3 px-3 text-center">
                    <div className="font-bold text-white">Batch A</div>
                    <div className="text-[10px] text-slate-400 font-normal">Roll 1–24 (24)</div>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <div className="font-bold text-white">Batch B</div>
                    <div className="text-[10px] text-slate-400 font-normal">Roll 25–47 (23)</div>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <div className="font-bold text-white">Batch C</div>
                    <div className="text-[10px] text-slate-400 font-normal">Roll 48–68 (21)</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {AFTERNOON_SCHEDULE.map((dayGroup) => {
                  const isToday = dayGroup.day === currentDayName;
                  return dayGroup.rows.map((row, rIdx) => (
                    <tr
                      key={`${dayGroup.day}-${rIdx}`}
                      className={`transition-colors ${
                        isToday
                          ? 'bg-purple-950/20 hover:bg-purple-950/30 border-l-4 border-l-purple-500'
                          : 'hover:bg-slate-800/30'
                      }`}
                    >
                      {rIdx === 0 && (
                        <td
                          rowSpan={dayGroup.rows.length}
                          className="py-3 px-4 font-semibold text-white border-r border-slate-800/80 align-middle bg-slate-900/40"
                        >
                          <div className="flex items-center gap-2">
                            <span>{dayGroup.day}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500 text-white">
                                Today
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-300 text-center border-r border-slate-800/60 whitespace-nowrap">
                        {row.time}
                      </td>

                      {row.isCommon ? (
                        <td colSpan={3} className="py-2.5 px-3">
                          <TimetableCell item={row} />
                        </td>
                      ) : (
                        <>
                          <td className="py-2.5 px-3">
                            <TimetableCell
                              item={row.batchA}
                              assignedFacultyName={getAssignedFacultyForSubject(row.batchA?.subject)}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <TimetableCell
                              item={row.batchB}
                              assignedFacultyName={getAssignedFacultyForSubject(row.batchB?.subject)}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <TimetableCell
                              item={row.batchC}
                              assignedFacultyName={getAssignedFacultyForSubject(row.batchC?.subject)}
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Subject & Dynamic Faculty Reference Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Info size={14} className="text-blue-400" aria-hidden="true" />
              <span>Course Curriculum & Dynamic Faculty Assignments</span>
            </div>
            <Link
              to="/faculty/faculty"
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Manage in Faculty Management</span>
              <ExternalLink size={12} aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subjects Reference */}
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2">Prescribed Course Codes</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LEGEND_ITEMS.map((sub) => {
                  const assigned = getAssignedFacultyForSubject(sub.code);
                  return (
                    <div
                      key={sub.code}
                      className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-xs ${sub.color}`}>{sub.code}</span>
                        {assigned ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                            Assigned
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">
                            Not Assigned
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{sub.name}</div>
                      <div className="text-[11px] text-slate-300 font-medium mt-1 truncate">
                        {assigned || <span className="text-amber-400/80 italic">Not Assigned</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Faculty Roster */}
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2">
                Active Faculty Members ({facultyList.length})
              </div>
              {loading ? (
                <div className="text-xs text-slate-500 py-6 text-center">Loading faculty assignments...</div>
              ) : facultyList.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400 flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    No faculty members found in the system. Add faculty and assign subjects in{' '}
                    <Link to="/faculty/faculty" className="text-blue-400 underline">
                      Faculty Management
                    </Link>{' '}
                    to reflect them dynamically on this timetable.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {facultyList.map((fac) => (
                    <div
                      key={fac._id}
                      className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 flex flex-col justify-between"
                    >
                      <div className="font-semibold text-xs text-white truncate">{fac.fullName}</div>
                      <div className="text-[10px] text-slate-400">{fac.designation}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {fac.subjects && fac.subjects.length > 0 ? (
                          fac.subjects.map((s) => (
                            <span
                              key={s._id || s.subjectCode}
                              className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800/50"
                            >
                              {s.subjectCode}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No subjects assigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </FacultyLayout>
  );
};

export default FacultyTimetablePage;
