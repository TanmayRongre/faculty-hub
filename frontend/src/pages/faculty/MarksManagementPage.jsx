import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart3, Save, Search, RefreshCw, CheckCircle2, AlertCircle, Info, BookOpen, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { getSubjectMarks, bulkUpdateMarks } from '../../services/marksService';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';

const THEORY_SUBJECTS = [
  { code: 'STE', name: 'Software Engineering' },
  { code: 'OSY', name: 'Operating System' },
  { code: 'ACN', name: 'Advance Computer Network' },
];

const PRACTICAL_SUBJECTS = [
  { code: 'SPI', name: 'Seminar and Project Initiation Course' },
  { code: 'ITR', name: 'Internship (12 Weeks)' },
  { code: 'ENDS', name: 'Entrepreneurship Development and Startups' },
];

const StatusBadge = ({ average }) => {
  if (average === null || average === undefined || average === '') {
    return <span className="text-slate-500 text-xs font-mono">—</span>;
  }
  const num = Number(average);
  if (num >= 24) {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-400 border-emerald-800/40 font-semibold">
        Excellent ({num}/30)
      </span>
    );
  }
  if (num >= 19.5) {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full border bg-blue-950/80 text-blue-400 border-blue-800/40 font-semibold">
        Good ({num}/30)
      </span>
    );
  }
  if (num >= 15) {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full border bg-amber-950/80 text-amber-400 border-amber-800/40 font-semibold">
        Average ({num}/30)
      </span>
    );
  }
  return (
    <span className="text-xs px-2.5 py-0.5 rounded-full border bg-red-950/80 text-red-400 border-red-800/40 font-semibold">
      Needs Attention ({num}/30)
    </span>
  );
};

const MarksManagementPage = () => {
  const [selectedSubject, setSelectedSubject] = useState('STE');
  const [searchQuery, setSearchQuery] = useState('');

  // Student rows data
  // Each student: { studentId, rollNo, enrollmentNumber, fullName, pa1, pa2, average }
  const [students, setStudents] = useState([]);
  const [initialMarks, setInitialMarks] = useState({}); // { [rollNo]: { pa1, pa2 } }
  const [marksState, setMarksState] = useState({}); // { [rollNo]: { pa1, pa2 } }
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [isTheory, setIsTheory] = useState(true);

  // Load subject marks
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSubjectMarks(selectedSubject);
      const studentList = res.students || [];
      setStudents(studentList);
      setIsTheory(res.isTheory !== false);

      const mapping = {};
      studentList.forEach((s) => {
        mapping[String(s.rollNo)] = {
          pa1: s.pa1 !== null && s.pa1 !== undefined ? s.pa1 : '',
          pa2: s.pa2 !== null && s.pa2 !== undefined ? s.pa2 : '',
        };
      });

      setMarksState(mapping);
      setInitialMarks(JSON.parse(JSON.stringify(mapping)));
    } catch (err) {
      console.error('Failed to load marks:', err);
      toast.error(err.response?.data?.message || `Failed to load marks for ${selectedSubject}`);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle input change
  const handleMarkChange = (rollNo, field, val) => {
    setMarksState((prev) => {
      const current = prev[rollNo] || { pa1: '', pa2: '' };
      return {
        ...prev,
        [rollNo]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  // Live average calculation helper
  const computeAverage = (pa1Val, pa2Val) => {
    if (pa1Val === '' || pa1Val === null || pa1Val === undefined) return null;
    if (pa2Val === '' || pa2Val === null || pa2Val === undefined) return null;
    const n1 = Number(pa1Val);
    const n2 = Number(pa2Val);
    if (isNaN(n1) || isNaN(n2) || n1 < 0 || n1 > 30 || n2 < 0 || n2 > 30) return null;
    return Math.round(((n1 + n2) / 2) * 100) / 100;
  };

  // Determine if there are unsaved edits
  const hasChanges = useMemo(() => {
    for (const roll of Object.keys(marksState)) {
      const curr = marksState[roll];
      const init = initialMarks[roll] || { pa1: '', pa2: '' };
      if (String(curr.pa1) !== String(init.pa1) || String(curr.pa2) !== String(init.pa2)) {
        return true;
      }
    }
    return false;
  }, [marksState, initialMarks]);

  // Count changed records
  const changedCount = useMemo(() => {
    let count = 0;
    for (const roll of Object.keys(marksState)) {
      const curr = marksState[roll];
      const init = initialMarks[roll] || { pa1: '', pa2: '' };
      if (String(curr.pa1) !== String(init.pa1) || String(curr.pa2) !== String(init.pa2)) {
        count++;
      }
    }
    return count;
  }, [marksState, initialMarks]);

  // SAVE ALL handler (one batch request)
  const handleSaveAll = async () => {
    if (!isTheory) {
      toast('Practical subjects are assessed under separate guidelines.');
      return;
    }

    // 1. Client-side validation across all students
    const payloadMarks = [];
    for (const s of students) {
      const roll = String(s.rollNo);
      const state = marksState[roll] || { pa1: '', pa2: '' };

      let val1 = null;
      if (state.pa1 !== '' && state.pa1 !== null && state.pa1 !== undefined) {
        val1 = Number(state.pa1);
        if (isNaN(val1)) {
          toast.error(`Roll ${roll} (${s.fullName}): PA 1 must be a valid number.`);
          return;
        }
        if (val1 < 0 || val1 > 30) {
          toast.error(`Roll ${roll} (${s.fullName}): PA 1 must be between 0 and 30. Got: ${val1}`);
          return;
        }
      }

      let val2 = null;
      if (state.pa2 !== '' && state.pa2 !== null && state.pa2 !== undefined) {
        val2 = Number(state.pa2);
        if (isNaN(val2)) {
          toast.error(`Roll ${roll} (${s.fullName}): PA 2 must be a valid number.`);
          return;
        }
        if (val2 < 0 || val2 > 30) {
          toast.error(`Roll ${roll} (${s.fullName}): PA 2 must be between 0 and 30. Got: ${val2}`);
          return;
        }
      }

      payloadMarks.push({
        rollNo: roll,
        studentId: s.studentId,
        enrollmentNumber: s.enrollmentNumber,
        pa1: val1,
        pa2: val2,
      });
    }

    setSavingAll(true);
    try {
      const res = await bulkUpdateMarks({
        subject: selectedSubject,
        marks: payloadMarks,
        semester: 5,
        academicYear: '2026-2027',
      });

      toast.success(`Successfully saved marks for ${res.processed} students in ${selectedSubject}!`);
      // Update baseline initial marks
      setInitialMarks(JSON.parse(JSON.stringify(marksState)));
    } catch (err) {
      console.error('Save all error:', err);
      const msg = err.response?.data?.message || 'Failed to save marks batch';
      toast.error(msg);
    } finally {
      setSavingAll(false);
    }
  };

  // Filtered student list
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        String(s.rollNo).includes(q) ||
        s.enrollmentNumber?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name} • Computer Engineering
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Theory Marks Management (PA 1 & PA 2)</h1>
            <p className="text-slate-400 mt-1 text-xs sm:text-sm">
              5th Semester Assessment • Continuous Progressive Assessment (PA1 + PA2) / 2 = Final PA Mark (Max 30)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <button
              onClick={loadData}
              disabled={loading || savingAll}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-medium border border-slate-700 transition-all flex items-center gap-2"
              title="Refresh marks from database"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            {isTheory && (
              <button
                id="save-all-marks-btn"
                onClick={handleSaveAll}
                disabled={savingAll || loading || students.length === 0}
                className={`px-4 sm:px-5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-lg transition-all flex items-center gap-2 ${
                  hasChanges
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {savingAll ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving All Marks...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} aria-hidden="true" />
                    <span>SAVE ALL {hasChanges && changedCount > 0 ? `(${changedCount})` : ''}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Subject Navigation Tabs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Theory Subjects */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase mr-1">Theory Subjects (PA1 + PA2):</span>
              {THEORY_SUBJECTS.map((sub) => {
                const isActive = selectedSubject === sub.code;
                return (
                  <button
                    key={sub.code}
                    onClick={() => setSelectedSubject(sub.code)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border border-blue-500'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/60'
                    }`}
                  >
                    {sub.code}
                    <span className="ml-1 opacity-80 font-normal hidden sm:inline">— {sub.name}</span>
                  </button>
                );
              })}

              {/* Practical Subjects Separator */}
              <div className="hidden lg:flex items-center mx-2 text-slate-600">|</div>

              {/* Practical-only Subjects */}
              <div className="flex items-center gap-1.5 mt-2 lg:mt-0">
                <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Practical:</span>
                {PRACTICAL_SUBJECTS.map((sub) => {
                  const isActive = selectedSubject === sub.code;
                  return (
                    <button
                      key={sub.code}
                      onClick={() => setSelectedSubject(sub.code)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-purple-900 text-purple-200 border border-purple-600 shadow-md'
                          : 'bg-slate-800/60 text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-slate-800'
                      }`}
                      title={`${sub.code} (${sub.name}) is practical/continuous assessment`}
                    >
                      {sub.code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Box */}
            <div className="relative w-full md:w-64">
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
          </div>
        </div>

        {/* Practical Subject Notice */}
        {!isTheory && (
          <div className="mb-6 p-4 rounded-xl bg-purple-950/40 border border-purple-800/40 flex items-start gap-3">
            <Info size={18} className="text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-purple-200">
                {selectedSubject} — Practical Assessment Structure
              </h4>
              <p className="text-xs text-purple-300/80 mt-1 leading-relaxed">
                {selectedSubject} is a practical-oriented course (Seminar / Internship / Practical). The theory PA1/PA2 examination structure does not apply to this course. Its assessment guidelines and rubrics will be entered under the dedicated practical evaluation module once instituted.
              </p>
            </div>
          </div>
        )}

        {/* Theory Information Notice */}
        {isTheory && (
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
              <span>
                Assessment Formula: <strong className="text-white">FINAL PA MARK = (PA1 + PA2) / 2</strong>. Allowed range: <strong className="text-blue-400">0 to 30</strong>. Passing threshold: <strong className="text-emerald-400">12 / 30</strong>.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 font-mono">
              <span>{filteredStudents.length} Students (Numerical Order)</span>
              {hasChanges && (
                <span className="text-amber-400 font-bold animate-pulse">● Unsaved Changes</span>
              )}
            </div>
          </div>
        )}

        {/* Marks Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-slate-400 text-sm">Loading 68 students & marks for {selectedSubject}...</div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-sm">
              No students found matching your query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/70 text-slate-400 text-xs">
                    <th className="text-center px-4 py-3.5 font-semibold w-16">Roll No</th>
                    <th className="text-left px-5 py-3.5 font-semibold">Student Name</th>
                    <th className="text-left px-5 py-3.5 font-semibold w-40">Enrollment No</th>
                    {isTheory ? (
                      <>
                        <th className="text-center px-4 py-3.5 font-semibold w-36">
                          PA 1 <span className="text-blue-400 font-bold">(Max 30)</span>
                        </th>
                        <th className="text-center px-4 py-3.5 font-semibold w-36">
                          PA 2 <span className="text-blue-400 font-bold">(Max 30)</span>
                        </th>
                        <th className="text-center px-4 py-3.5 font-semibold w-36">
                          Average <span className="text-emerald-400 font-bold">(Final PA)</span>
                        </th>
                        <th className="text-center px-4 py-3.5 font-semibold w-48">Status</th>
                      </>
                    ) : (
                      <th className="text-center px-5 py-3.5 font-semibold text-slate-500">
                        Practical Assessment
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStudents.map((student) => {
                    const roll = String(student.rollNo);
                    const state = marksState[roll] || { pa1: '', pa2: '' };
                    const init = initialMarks[roll] || { pa1: '', pa2: '' };
                    const isEdited =
                      String(state.pa1) !== String(init.pa1) || String(state.pa2) !== String(init.pa2);

                    const currentAvg = computeAverage(state.pa1, state.pa2);

                    const pa1Num = state.pa1 !== '' && state.pa1 !== null ? Number(state.pa1) : null;
                    const pa2Num = state.pa2 !== '' && state.pa2 !== null ? Number(state.pa2) : null;

                    const isPA1Invalid =
                      pa1Num !== null && (isNaN(pa1Num) || pa1Num < 0 || pa1Num > 30);
                    const isPA2Invalid =
                      pa2Num !== null && (isNaN(pa2Num) || pa2Num < 0 || pa2Num > 30);

                    return (
                      <tr
                        key={student.studentId || roll}
                        className={`hover:bg-slate-800/30 transition-colors ${
                          isEdited ? 'bg-blue-950/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-300">
                          {student.rollNo}
                        </td>
                        <td className="px-5 py-3.5 text-white font-medium">
                          {student.fullName}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                          {student.enrollmentNumber}
                        </td>

                        {isTheory ? (
                          <>
                            {/* PA 1 Input */}
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="0.5"
                                value={state.pa1}
                                onChange={(e) => handleMarkChange(roll, 'pa1', e.target.value)}
                                placeholder="—"
                                className={`w-20 px-2.5 py-1.5 bg-slate-800 border rounded-lg text-center font-mono font-bold text-sm focus:outline-none transition-all ${
                                  isPA1Invalid
                                    ? 'border-red-500 text-red-400 bg-red-950/40 focus:ring-1 focus:ring-red-500'
                                    : String(state.pa1) !== String(init.pa1)
                                    ? 'border-blue-500 text-blue-300 bg-blue-950/40 focus:ring-1 focus:ring-blue-500'
                                    : 'border-slate-700 text-white focus:ring-1 focus:ring-blue-500'
                                }`}
                              />
                            </td>

                            {/* PA 2 Input */}
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="0.5"
                                value={state.pa2}
                                onChange={(e) => handleMarkChange(roll, 'pa2', e.target.value)}
                                placeholder="—"
                                className={`w-20 px-2.5 py-1.5 bg-slate-800 border rounded-lg text-center font-mono font-bold text-sm focus:outline-none transition-all ${
                                  isPA2Invalid
                                    ? 'border-red-500 text-red-400 bg-red-950/40 focus:ring-1 focus:ring-red-500'
                                    : String(state.pa2) !== String(init.pa2)
                                    ? 'border-blue-500 text-blue-300 bg-blue-950/40 focus:ring-1 focus:ring-blue-500'
                                    : 'border-slate-700 text-white focus:ring-1 focus:ring-blue-500'
                                }`}
                              />
                            </td>

                            {/* Authoritative / Live Calculated Average */}
                            <td className="px-4 py-3.5 text-center">
                              {currentAvg !== null ? (
                                <span
                                  className={`font-mono font-bold text-base px-2.5 py-1 rounded-md ${
                                    currentAvg >= 12
                                      ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/30'
                                      : 'text-red-400 bg-red-950/40 border border-red-800/30'
                                  }`}
                                >
                                  {currentAvg}
                                </span>
                              ) : (
                                <span
                                  className="text-slate-500 font-mono text-xs"
                                  title="Average is unavailable until both PA1 and PA2 are entered"
                                >
                                  Not Available
                                </span>
                              )}
                            </td>

                            {/* Performance Status */}
                            <td className="px-4 py-3.5 text-center">
                              <StatusBadge average={currentAvg} />
                            </td>
                          </>
                        ) : (
                          <td className="px-5 py-3.5 text-center text-slate-500 text-xs italic">
                            Practical Assessment Only (No Theory PA1/PA2)
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </FacultyLayout>
  );
};

export default MarksManagementPage;
