import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Save, Search, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { studentService } from '../../services/managementService';
import { getAllMarks, bulkUpdateMarks } from '../../services/marksService';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';

const StatusBadge = ({ pa }) => {
  if (pa === null || pa === undefined || pa === '') {
    return <span className="text-slate-500 text-xs font-mono">—</span>;
  }
  const num = Number(pa);
  if (num >= 24) {
    return <span className="text-xs px-2.5 py-0.5 rounded-full border bg-emerald-950/80 text-emerald-400 border-emerald-800/40 font-semibold">Excellent ({num}/30)</span>;
  }
  if (num >= 19.5) {
    return <span className="text-xs px-2.5 py-0.5 rounded-full border bg-blue-950/80 text-blue-400 border-blue-800/40 font-semibold">Good ({num}/30)</span>;
  }
  if (num >= 15) {
    return <span className="text-xs px-2.5 py-0.5 rounded-full border bg-amber-950/80 text-amber-400 border-amber-800/40 font-semibold">Average ({num}/30)</span>;
  }
  return <span className="text-xs px-2.5 py-0.5 rounded-full border bg-red-950/80 text-red-400 border-red-800/40 font-semibold">Needs Attention ({num}/30)</span>;
};

const MarksManagementPage = () => {
  // Academic scope: Semester 5, Computer Science
  const [selectedSubject, setSelectedSubject] = useState(ACADEMIC_CONFIG.SUBJECTS[0].code);
  const [academicYear] = useState('2026-2027');
  const [searchQuery, setSearchQuery] = useState('');

  // Data state
  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({}); // { enrollmentNumber: PA }
  const [initialMarksMap, setInitialMarksMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);

  // Load students & marks for the active subject
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsRes, marksRes] = await Promise.all([
        studentService.getStudents({ limit: 100, semester: 5 }),
        getAllMarks({ semester: 5, subjectCode: selectedSubject, academicYear }),
      ]);

      const studentList = studentsRes.data || [];
      setStudents(studentList);

      const mData = marksRes.records || marksRes.data || [];
      const mapping = {};
      mData.forEach((rec) => {
        if (rec.enrollmentNumber) {
          const val = rec.PA ?? rec.calculatedPA;
          mapping[rec.enrollmentNumber.toUpperCase()] = val !== undefined && val !== null ? val : null;
        }
      });

      setMarksMap(mapping);
      setInitialMarksMap(mapping);
    } catch (err) {
      console.error('Failed to load marks data:', err);
      toast.error('Failed to load marks for ' + selectedSubject);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, academicYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle PA mark change
  const handleMarkChange = (enrollmentNumber, rawValue) => {
    const enroll = enrollmentNumber.toUpperCase();
    if (rawValue === '') {
      setMarksMap((prev) => ({ ...prev, [enroll]: null }));
      return;
    }
    const val = Number(rawValue);
    setMarksMap((prev) => ({ ...prev, [enroll]: val }));
  };

  // Check if any mark has changed
  const hasChanges = useMemo(() => {
    for (const s of students) {
      const enroll = s.enrollmentNumber.toUpperCase();
      const current = marksMap[enroll] ?? null;
      const initial = initialMarksMap[enroll] ?? null;
      if (current !== initial) return true;
    }
    return false;
  }, [students, marksMap, initialMarksMap]);

  // SAVE ALL handler
  const handleSaveAll = async () => {
    // 1. Client-side Validation
    const updates = [];
    for (const s of students) {
      const enroll = s.enrollmentNumber.toUpperCase();
      const val = marksMap[enroll];

      if (val !== null && val !== undefined && val !== '') {
        const num = Number(val);
        if (isNaN(num)) {
          toast.error(`Invalid mark for ${s.fullName} (${s.rollNumber}). Must be a number.`);
          return;
        }
        if (num < 0 || num > 30) {
          toast.error(`Mark for ${s.fullName} (${s.rollNumber}) must be between 0 and 30. Got: ${num}`);
          return;
        }
        updates.push({
          enrollmentNumber: enroll,
          rollNumber: s.rollNumber,
          subjectCode: selectedSubject,
          subjectName: ACADEMIC_CONFIG.SUBJECTS.find((sub) => sub.code === selectedSubject)?.name || selectedSubject,
          PA: num,
          academicYear,
          semester: 5,
        });
      } else {
        // Explicitly saving null/empty
        updates.push({
          enrollmentNumber: enroll,
          rollNumber: s.rollNumber,
          subjectCode: selectedSubject,
          subjectName: ACADEMIC_CONFIG.SUBJECTS.find((sub) => sub.code === selectedSubject)?.name || selectedSubject,
          PA: null,
          academicYear,
          semester: 5,
        });
      }
    }

    if (updates.length === 0) {
      toast('No marks to save');
      return;
    }

    setSavingAll(true);
    try {
      await bulkUpdateMarks(updates, academicYear, 5);
      toast.success(`Marks saved successfully for ${selectedSubject}!`);
      setInitialMarksMap({ ...marksMap });
    } catch (err) {
      console.error('Save all error:', err);
      toast.error(err.response?.data?.message || 'Failed to save marks');
    } finally {
      setSavingAll(false);
    }
  };

  // Filtered student roster
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.rollNumber?.toLowerCase().includes(q) ||
        s.enrollmentNumber?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  return (
    <FacultyLayout>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name} • {ACADEMIC_CONFIG.DEPARTMENT.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Progressive Assessment (PA) Marks</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Direct PA marks evaluation out of <strong className="text-white">30 marks</strong> for {ACADEMIC_CONFIG.SEMESTER.displayName}.
            </p>
          </div>

          {/* Action Button: SAVE ALL */}
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading || savingAll}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-all flex items-center gap-2"
              title="Refresh marks"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            <button
              id="save-all-marks-btn"
              onClick={handleSaveAll}
              disabled={savingAll || loading || students.length === 0}
              className={`px-5 py-2 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2 ${
                hasChanges
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {savingAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving to Sheets...</span>
                </>
              ) : (
                <>
                  <Save size={16} aria-hidden="true" />
                  <span>SAVE ALL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Controls Bar: Subject Selector & Search */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
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
                    <span className="ml-1 opacity-70 font-normal hidden sm:inline">— {sub.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Student Search */}
            <div className="relative w-full md:w-72">
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

        {/* Notice Info Box */}
        <div className="mb-4 flex items-center justify-between text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
            <span>
              Academic Evaluation: <strong className="text-slate-300">Progressive Assessment (0–30)</strong>. Passing threshold is <strong className="text-emerald-400">12 / 30</strong>.
            </span>
          </div>
          <span className="text-slate-500 font-mono">
            {filteredStudents.length} Students Loaded
          </span>
        </div>

        {/* Marks Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-slate-400 text-sm">Loading students & marks for {selectedSubject}...</div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-sm">
              No students found for Semester 5.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/60 text-slate-400 text-xs">
                    <th className="text-left px-5 py-3.5 font-semibold w-16">Roll No</th>
                    <th className="text-left px-5 py-3.5 font-semibold">Student Name</th>
                    <th className="text-left px-5 py-3.5 font-semibold">Enrollment Number</th>
                    <th className="text-center px-5 py-3.5 font-semibold w-40">
                      PA Marks <span className="text-blue-400 font-bold">(Max 30)</span>
                    </th>
                    <th className="text-center px-5 py-3.5 font-semibold w-48">Performance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStudents.map((student) => {
                    const enroll = student.enrollmentNumber.toUpperCase();
                    const currentVal = marksMap[enroll];
                    const isEdited = currentVal !== (initialMarksMap[enroll] ?? null);

                    return (
                      <tr
                        key={student._id || enroll}
                        className={`hover:bg-slate-800/30 transition-colors ${
                          isEdited ? 'bg-blue-950/20' : ''
                        }`}
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-300">
                          {student.rollNumber || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-white font-medium">
                          {student.fullName}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                          {student.enrollmentNumber}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="30"
                              step="0.5"
                              value={currentVal !== null && currentVal !== undefined ? currentVal : ''}
                              onChange={(e) => handleMarkChange(student.enrollmentNumber, e.target.value)}
                              placeholder="0-30"
                              className={`w-24 px-3 py-1.5 bg-slate-800 border rounded-lg text-center font-mono font-bold text-sm focus:outline-none transition-all ${
                                currentVal !== null && (currentVal < 0 || currentVal > 30)
                                  ? 'border-red-500 text-red-400 bg-red-950/20 focus:ring-1 focus:ring-red-500'
                                  : isEdited
                                  ? 'border-blue-500 text-blue-300 bg-blue-950/40 focus:ring-1 focus:ring-blue-500'
                                  : 'border-slate-700 text-white focus:ring-1 focus:ring-blue-500'
                              }`}
                            />
                            <span className="text-xs text-slate-500 font-mono">/ 30</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <StatusBadge pa={currentVal} />
                        </td>
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
