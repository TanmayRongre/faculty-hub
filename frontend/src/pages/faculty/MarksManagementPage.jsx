import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart3, Save, Search, RefreshCw, CheckCircle2, AlertCircle, Info, BookOpen, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { getSubjectMarks, bulkUpdateMarks } from '../../services/marksService';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';

const PA_THEORY_SUBJECTS = [
  { code: 'STE', name: 'Software Engineering', practical: true },
  { code: 'OSY', name: 'Operating System', practical: true },
  { code: 'ACN', name: 'Advance Computer Network', practical: true },
];

const NON_PA_SUBJECTS = [
  { code: 'ENDS', name: 'Entrepreneurship Development and Startups', practical: true },
  { code: 'SPI', name: 'Seminar and Project Initiation Course', practical: false },
];

const ASSESSMENT_MATRIX = {
  STE:  { practical: true,  pa1: true,  pa2: true,  average: true },
  OSY:  { practical: true,  pa1: true,  pa2: true,  average: true },
  ACN:  { practical: true,  pa1: true,  pa2: true,  average: true },
  ENDS: { practical: true,  pa1: false, pa2: false, average: false },
  SPI:  { practical: false, pa1: false, pa2: false, average: false },
};

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
  const [showMatrixInfo, setShowMatrixInfo] = useState(false);

  // Student rows data
  // Each student: { studentId, rollNo, enrollmentNumber, fullName, pa1, pa2, average }
  const [students, setStudents] = useState([]);
  const [initialMarks, setInitialMarks] = useState({}); // { [rollNo]: { pa1, pa2 } }
  const [marksState, setMarksState] = useState({}); // { [rollNo]: { pa1, pa2 } }
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [isTheory, setIsTheory] = useState(true);

  const currentSubjectAssessment = ASSESSMENT_MATRIX[selectedSubject] || {
    practical: false,
    pa1: false,
    pa2: false,
    average: false,
  };

  // Load subject marks
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSubjectMarks(selectedSubject);
      const studentList = res.students || [];
      setStudents(studentList);
      setIsTheory(res.isTheory !== false && currentSubjectAssessment.pa1);

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

  // Live average calculation helper: (PA1 + PA2) / 2
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
    if (!currentSubjectAssessment.pa1) {
      toast(`${selectedSubject} does not have Progressive Assessment (PA1/PA2) under official MSBTE curriculum.`);
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
            <h1 className="text-xl sm:text-2xl font-bold text-white">Marks & Assessment Management</h1>
            <p className="text-slate-400 mt-1 text-xs sm:text-sm">
              5th Semester MSBTE Scheme • Theory Progressive Assessment (PA1 &amp; PA2 Max 30, Avg = (PA1 + PA2)/2)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <button
              onClick={() => setShowMatrixInfo((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs sm:text-sm font-medium border border-slate-700 transition-all flex items-center gap-2"
              title="View Subject Assessment Matrix"
            >
              <Layers size={15} aria-hidden="true" />
              <span>Assessment Matrix</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading || savingAll}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-medium border border-slate-700 transition-all flex items-center gap-2"
              title="Refresh marks from database"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            {currentSubjectAssessment.pa1 && (
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

        {/* Assessment Matrix Overview Banner (Expandable) */}
        {showMatrixInfo && (
          <div className="bg-slate-900 border border-blue-900/50 rounded-xl p-4 sm:p-5 mb-6 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  5th Semester Computer Engineering — Subject Assessment Matrix
                </h3>
              </div>
              <button
                onClick={() => setShowMatrixInfo(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Subject Code</th>
                    <th className="py-2 px-3">Subject Name</th>
                    <th className="py-2 px-3 text-center">Practical</th>
                    <th className="py-2 px-3 text-center">PA 1 (Max 30)</th>
                    <th className="py-2 px-3 text-center">PA 2 (Max 30)</th>
                    <th className="py-2 px-3 text-center">Final PA Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-400">STE</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Software Engineering</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-400">OSY</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Operating System</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-400">ACN</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Advance Computer Network</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-purple-400">ENDS</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Entrepreneurship Development and Startups</td>
                    <td className="py-2 px-3 text-center text-emerald-400 font-bold">YES</td>
                    <td className="py-2 px-3 text-center text-slate-500">NO</td>
                    <td className="py-2 px-3 text-center text-slate-500">NO</td>
                    <td className="py-2 px-3 text-center text-slate-500">NO</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-400">SPI</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Seminar and Project Initiation Course</td>
                    <td className="py-2 px-3 text-center text-slate-500">NO</td>
                    <td className="py-2 px-3 text-center text-slate-500">NO</td>
                    <td className="py-2 px-3 text-center text-slate-500">NO</td>
                    <td className="py-2 px-3 text-center text-slate-500">NO</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subject Navigation Tabs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* PA Theory Subjects */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase mr-1">PA Subjects (PA1 + PA2):</span>
              {PA_THEORY_SUBJECTS.map((sub) => {
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

              {/* Separator */}
              <div className="hidden lg:flex items-center mx-2 text-slate-600">|</div>

              {/* Non-PA Subjects (ENDS & SPI) */}
              <div className="flex items-center gap-1.5 mt-2 lg:mt-0">
                <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Other Subjects:</span>
                {NON_PA_SUBJECTS.map((sub) => {
                  const isActive = selectedSubject === sub.code;
                  return (
                    <button
                      key={sub.code}
                      onClick={() => setSelectedSubject(sub.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-purple-900 text-purple-200 border border-purple-600 shadow-md font-bold'
                          : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                      }`}
                      title={`${sub.code} (${sub.name})`}
                    >
                      {sub.code}
                      <span className="ml-1 opacity-80 text-[10px] hidden sm:inline">({sub.practical ? 'Practical' : 'No PA'})</span>
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

        {/* Non-PA Subject Notice */}
        {!currentSubjectAssessment.pa1 && (
          <div className="mb-6 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-lg">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-800/40 text-blue-400 shrink-0 mt-0.5">
                <Info size={20} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h4 className="text-base font-bold text-white">
                    {selectedSubject} — {selectedSubject === 'ENDS' ? 'Entrepreneurship Development and Startups' : 'Seminar and Project Initiation Course'}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                    Practical: {currentSubjectAssessment.practical ? 'YES' : 'NO'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                    PA1: NO | PA2: NO | Average: NO
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {selectedSubject === 'ENDS' ? (
                    <>
                      <strong>ENDS</strong> has <strong>Practical Assessment = YES</strong>. Progressive Assessment (PA1 and PA2) is <strong>strictly NOT applicable</strong> for this course under the official MSBTE curriculum scheme. Practical evaluation is recorded under laboratory evaluation.
                    </>
                  ) : (
                    <>
                      <strong>SPI</strong> (Seminar and Project Initiation Course) has <strong>Practical = NO</strong>, <strong>PA1 = NO</strong>, <strong>PA2 = NO</strong>, and <strong>Average = NO</strong>. It is evaluated via project seminar milestones and continuous mentoring reviews.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Theory Information Notice */}
        {currentSubjectAssessment.pa1 && (
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
              <span>
                Assessment Formula: <strong className="text-white">FINAL PA MARK = (PA1 + PA2) / 2</strong>. Range: <strong className="text-blue-400">0 to 30</strong>. Passing mark: <strong className="text-emerald-400">12 / 30</strong>. Practical Assessment: <strong className="text-emerald-400">YES</strong>.
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
                  <tr className="border-b border-slate-800 bg-slate-800/70 text-slate-300 text-xs">
                    <th className="text-center px-4 py-3.5 font-bold w-20">Roll No.</th>
                    <th className="text-left px-5 py-3.5 font-bold">Name</th>
                    {isTheory ? (
                      <>
                        <th className="text-center px-4 py-3.5 font-bold w-36">PA1</th>
                        <th className="text-center px-4 py-3.5 font-bold w-36">PA2</th>
                        <th className="text-center px-4 py-3.5 font-bold w-36">Avg</th>
                      </>
                    ) : (
                      <th className="text-center px-5 py-3.5 font-semibold text-slate-400" colSpan={3}>
                        Assessment Structure
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
                        {/* 1. Roll No. */}
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-200">
                          {student.rollNo}
                        </td>

                        {/* 2. Name */}
                        <td className="px-5 py-3.5 text-white font-medium">
                          {student.fullName}
                        </td>

                        {isTheory ? (
                          <>
                            {/* 3. PA1 */}
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="0.5"
                                value={state.pa1}
                                onChange={(e) => handleMarkChange(roll, 'pa1', e.target.value)}
                                placeholder="—"
                                className={`w-24 px-3 py-1.5 bg-slate-800 border rounded-lg text-center font-mono font-bold text-sm focus:outline-none transition-all ${
                                  isPA1Invalid
                                    ? 'border-red-500 text-red-400 bg-red-950/40 focus:ring-1 focus:ring-red-500'
                                    : String(state.pa1) !== String(init.pa1)
                                    ? 'border-blue-500 text-blue-300 bg-blue-950/40 focus:ring-1 focus:ring-blue-500'
                                    : 'border-slate-700 text-white focus:ring-1 focus:ring-blue-500'
                                }`}
                              />
                            </td>

                            {/* 4. PA2 */}
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max="30"
                                step="0.5"
                                value={state.pa2}
                                onChange={(e) => handleMarkChange(roll, 'pa2', e.target.value)}
                                placeholder="—"
                                className={`w-24 px-3 py-1.5 bg-slate-800 border rounded-lg text-center font-mono font-bold text-sm focus:outline-none transition-all ${
                                  isPA2Invalid
                                    ? 'border-red-500 text-red-400 bg-red-950/40 focus:ring-1 focus:ring-red-500'
                                    : String(state.pa2) !== String(init.pa2)
                                    ? 'border-blue-500 text-blue-300 bg-blue-950/40 focus:ring-1 focus:ring-blue-500'
                                    : 'border-slate-700 text-white focus:ring-1 focus:ring-blue-500'
                                }`}
                              />
                            </td>

                            {/* 5. Avg */}
                            <td className="px-4 py-3.5 text-center">
                              {currentAvg !== null ? (
                                <span
                                  className={`font-mono font-bold text-sm px-3 py-1 rounded-md inline-block min-w-[3rem] ${
                                    currentAvg >= 12
                                      ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/30'
                                      : 'text-red-400 bg-red-950/40 border border-red-800/30'
                                  }`}
                                >
                                  {currentAvg}
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono text-xs">—</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <td className="px-5 py-3.5 text-center text-xs">
                            {selectedSubject === 'ENDS' ? (
                              <span className="px-2.5 py-1 rounded bg-purple-950/60 border border-purple-800/40 text-purple-300 font-semibold">
                                Practical Assessment Only (No PA1 / PA2)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400">
                                Seminar &amp; Project (No Practical / No PA)
                              </span>
                            )}
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
