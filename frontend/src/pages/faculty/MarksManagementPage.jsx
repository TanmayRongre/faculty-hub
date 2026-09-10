import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Beaker,
  Save,
  Search,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Award,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { getSubjectMarks, bulkUpdateMarks } from '../../services/marksService';
import { facultyService } from '../../services/managementService';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';

// Applicable PA Subjects (Progressive Assessment - 68 students full roster)
const PA_SUBJECTS = [
  { code: 'STE', name: 'Software Engineering', courseCode: '315323' },
  { code: 'OSY', name: 'Operating System', courseCode: '315319' },
  { code: 'ACN', name: 'Advance Computer Network', courseCode: '315321' },
];

// Applicable Practical Subjects (Laboratory Marks by Batches A, B, C)
const PRACTICAL_SUBJECTS = [
  { code: 'ENDS', name: 'Entrepreneurship Development and Startups', courseCode: '315002' },
  { code: 'SPI',  name: 'Seminar and Project Initiation Course', courseCode: '315003' },
  { code: 'ITR',  name: 'Industrial Training', courseCode: '315004' },
];

// Fixed Practical Batches
const PRACTICAL_BATCHES = [
  { batch: 'A', range: 'Roll No. 1–24', minRoll: 1, maxRoll: 24, count: 24 },
  { batch: 'B', range: 'Roll No. 25–47', minRoll: 25, maxRoll: 47, count: 23 },
  { batch: 'C', range: 'Roll No. 48–68', minRoll: 48, maxRoll: 68, count: 21 },
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
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation Steps: 'TYPE' | 'SUBJECT' | 'BATCH' | 'ENTRY'
  const [step, setStep] = useState('TYPE');

  // Hierarchy Selection State
  const [marksType, setMarksType] = useState(null); // 'PA' | 'PRACTICAL'
  const [selectedSubject, setSelectedSubject] = useState(null); // 'STE', 'OSY', 'ACN', 'ENDS', 'SPI', 'ITR'
  const [selectedBatch, setSelectedBatch] = useState(null); // 'A' | 'B' | 'C'

  // Student list and marks state
  const [students, setStudents] = useState([]);
  const [marksState, setMarksState] = useState({}); // { [rollNo]: { pa1, pa2, practicalMarks } }
  const [initialMarks, setInitialMarks] = useState({}); // Snapshot for detecting unsaved edits
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Faculty assigned subject codes for authorization filtering
  const [assignedSubjectCodes, setAssignedSubjectCodes] = useState([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  // Fetch assigned subjects for faculty
  useEffect(() => {
    if (isAdmin) return;
    const fetchAssigned = async () => {
      setLoadingAssigned(true);
      try {
        const res = await facultyService.getMyAssignedSubjects();
        if (res.success && Array.isArray(res.data)) {
          setAssignedSubjectCodes(res.data.map((s) => s.subjectCode.toUpperCase().trim()));
        }
      } catch (err) {
        console.warn('Failed to load assigned subjects:', err.message);
      } finally {
        setLoadingAssigned(false);
      }
    };
    fetchAssigned();
  }, [isAdmin]);

  const isSubjectAssigned = useCallback(
    (code) => {
      if (isAdmin) return true;
      if (loadingAssigned) return true; // optimistic while loading
      return assignedSubjectCodes.includes(String(code).toUpperCase().trim());
    },
    [isAdmin, loadingAssigned, assignedSubjectCodes]
  );

  // ─── Hierarchy Handlers ───────────────────────────────────────────────────

  const handleSelectType = (type) => {
    setMarksType(type);
    setSelectedSubject(null);
    setSelectedBatch(null);
    setStudents([]);
    setMarksState({});
    setInitialMarks({});
    setSearchQuery('');
    setStep('SUBJECT');
  };

  const handleSelectSubject = (subCode) => {
    if (!isSubjectAssigned(subCode)) {
      toast.error(`You are not assigned to subject ${subCode}. Only assigned faculty or admin can access marks.`);
      return;
    }

    setSelectedSubject(subCode);
    if (marksType === 'PRACTICAL') {
      setSelectedBatch(null);
      setStep('BATCH');
    } else {
      setSelectedBatch(null);
      fetchMarksAndProceed('PA', subCode, null);
    }
  };

  const handleSelectBatch = (batchId) => {
    setSelectedBatch(batchId);
    fetchMarksAndProceed('PRACTICAL', selectedSubject, batchId);
  };

  // Fetch student roster and marks
  const fetchMarksAndProceed = async (type, subCode, batchId) => {
    setLoading(true);
    try {
      const res = await getSubjectMarks(subCode, { batch: batchId, type });
      const studentList = res.students || [];
      setStudents(studentList);

      const mapping = {};
      studentList.forEach((s) => {
        mapping[String(s.rollNo)] = {
          pa1: s.pa1 !== null && s.pa1 !== undefined ? s.pa1 : '',
          pa2: s.pa2 !== null && s.pa2 !== undefined ? s.pa2 : '',
          practicalMarks:
            s.practicalMarks !== null && s.practicalMarks !== undefined ? s.practicalMarks : '',
        };
      });

      setMarksState(mapping);
      setInitialMarks(JSON.parse(JSON.stringify(mapping)));
      setSearchQuery('');
      setStep('ENTRY');
    } catch (err) {
      console.error('Failed to load marks:', err);
      toast.error(err.response?.data?.message || `Failed to load marks for ${subCode}`);
    } finally {
      setLoading(false);
    }
  };

  // Pre-populate if query parameters exist
  useEffect(() => {
    const typeParam = searchParams.get('type')?.toUpperCase();
    const subParam = searchParams.get('subject')?.toUpperCase();
    const batchParam = searchParams.get('batch')?.toUpperCase();

    if (typeParam === 'PA' && subParam && ['STE', 'OSY', 'ACN'].includes(subParam)) {
      setMarksType('PA');
      setSelectedSubject(subParam);
      setSelectedBatch(null);
      fetchMarksAndProceed('PA', subParam, null);
    } else if (
      typeParam === 'PRACTICAL' &&
      subParam &&
      ['ENDS', 'SPI', 'ITR'].includes(subParam) &&
      batchParam &&
      ['A', 'B', 'C'].includes(batchParam)
    ) {
      setMarksType('PRACTICAL');
      setSelectedSubject(subParam);
      setSelectedBatch(batchParam);
      fetchMarksAndProceed('PRACTICAL', subParam, batchParam);
    }
  }, [searchParams]);

  // Back Navigation Handler
  const handleBack = () => {
    if (step === 'ENTRY') {
      if (marksType === 'PRACTICAL') {
        setStep('BATCH');
      } else {
        setStep('SUBJECT');
      }
    } else if (step === 'BATCH') {
      setStep('SUBJECT');
    } else if (step === 'SUBJECT') {
      setStep('TYPE');
    }
  };

  // Handle Mark Input Change
  const handleMarkChange = (rollNo, field, val) => {
    setMarksState((prev) => {
      const current = prev[rollNo] || { pa1: '', pa2: '', practicalMarks: '' };
      return {
        ...prev,
        [rollNo]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  // Live average calculation for PA: (PA1 + PA2) / 2
  const computeAverage = (pa1Val, pa2Val) => {
    if (pa1Val === '' || pa1Val === null || pa1Val === undefined) return null;
    if (pa2Val === '' || pa2Val === null || pa2Val === undefined) return null;
    const n1 = Number(pa1Val);
    const n2 = Number(pa2Val);
    if (isNaN(n1) || isNaN(n2) || n1 < 0 || n1 > 30 || n2 < 0 || n2 > 30) return null;
    return Math.round(((n1 + n2) / 2) * 100) / 100;
  };

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    for (const roll of Object.keys(marksState)) {
      const curr = marksState[roll];
      const init = initialMarks[roll] || { pa1: '', pa2: '', practicalMarks: '' };
      if (marksType === 'PRACTICAL') {
        if (String(curr.practicalMarks ?? '') !== String(init.practicalMarks ?? '')) {
          return true;
        }
      } else {
        if (
          String(curr.pa1 ?? '') !== String(init.pa1 ?? '') ||
          String(curr.pa2 ?? '') !== String(init.pa2 ?? '')
        ) {
          return true;
        }
      }
    }
    return false;
  }, [marksState, initialMarks, marksType]);

  const changedCount = useMemo(() => {
    let count = 0;
    for (const roll of Object.keys(marksState)) {
      const curr = marksState[roll];
      const init = initialMarks[roll] || { pa1: '', pa2: '', practicalMarks: '' };
      if (marksType === 'PRACTICAL') {
        if (String(curr.practicalMarks ?? '') !== String(init.practicalMarks ?? '')) {
          count++;
        }
      } else {
        if (
          String(curr.pa1 ?? '') !== String(init.pa1 ?? '') ||
          String(curr.pa2 ?? '') !== String(init.pa2 ?? '')
        ) {
          count++;
        }
      }
    }
    return count;
  }, [marksState, initialMarks, marksType]);

  // SAVE ALL handler
  const handleSaveAll = async () => {
    const payloadMarks = [];

    for (const s of students) {
      const roll = String(s.rollNo);
      const state = marksState[roll] || { pa1: '', pa2: '', practicalMarks: '' };

      if (marksType === 'PRACTICAL') {
        let pMark = null;
        if (state.practicalMarks !== '' && state.practicalMarks !== null && state.practicalMarks !== undefined) {
          pMark = Number(state.practicalMarks);
          if (isNaN(pMark)) {
            toast.error(`Roll ${roll} (${s.fullName}): Practical mark must be a valid number.`);
            return;
          }
          if (pMark < 0) {
            toast.error(`Roll ${roll} (${s.fullName}): Practical mark cannot be negative.`);
            return;
          }
        }

        payloadMarks.push({
          rollNo: roll,
          studentId: s.studentId,
          enrollmentNumber: s.enrollmentNumber,
          practicalMarks: pMark,
          batch: selectedBatch,
        });
      } else {
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
    }

    setSavingAll(true);
    try {
      const res = await bulkUpdateMarks({
        subject: selectedSubject,
        type: marksType,
        batch: marksType === 'PRACTICAL' ? selectedBatch : null,
        marks: payloadMarks,
        semester: 5,
        academicYear: '2026-2027',
      });

      toast.success(
        res.message ||
          `Successfully saved marks for ${res.processed} students in ${selectedSubject}`
      );
      setInitialMarks(JSON.parse(JSON.stringify(marksState)));
    } catch (err) {
      console.error('Save all marks error:', err);
      toast.error(err.response?.data?.message || 'Failed to save marks');
    } finally {
      setSavingAll(false);
    }
  };

  // Filtered student list by search query
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
      <div className="p-4 sm:p-6 md:p-8 max-w-full space-y-6">
        {/* Top Header & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              <span>{INSTITUTION.name}</span>
              <span>•</span>
              <span>Computer Engineering</span>
            </div>

            {/* Breadcrumbs Navigation */}
            <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
              <button
                onClick={() => setStep('TYPE')}
                className={`hover:text-white transition-colors font-medium ${
                  step === 'TYPE' ? 'text-white font-bold' : ''
                }`}
              >
                Marks
              </button>

              {marksType && (
                <>
                  <ChevronRight size={14} className="text-slate-600" />
                  <button
                    onClick={() => setStep('SUBJECT')}
                    className={`hover:text-white transition-colors font-medium ${
                      step === 'SUBJECT' ? 'text-white font-bold' : ''
                    }`}
                  >
                    {marksType === 'PA' ? 'PA' : 'Practical'}
                  </button>
                </>
              )}

              {selectedSubject && (
                <>
                  <ChevronRight size={14} className="text-slate-600" />
                  {marksType === 'PRACTICAL' ? (
                    <button
                      onClick={() => setStep('BATCH')}
                      className={`hover:text-white transition-colors font-medium ${
                        step === 'BATCH' ? 'text-white font-bold' : ''
                      }`}
                    >
                      {selectedSubject}
                    </button>
                  ) : (
                    <span className="text-white font-bold">{selectedSubject}</span>
                  )}
                </>
              )}

              {selectedBatch && (
                <>
                  <ChevronRight size={14} className="text-slate-600" />
                  <span className="text-white font-bold">Batch {selectedBatch}</span>
                </>
              )}
            </div>
          </div>

          {/* Top Actions: Back Button */}
          {step !== 'TYPE' && (
            <button
              onClick={handleBack}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold border border-slate-700 transition-all flex items-center gap-2 shadow-sm"
            >
              <ArrowLeft size={16} />
              <span>
                Back to{' '}
                {step === 'ENTRY'
                  ? marksType === 'PRACTICAL'
                    ? 'Batches'
                    : 'Subjects'
                  : step === 'BATCH'
                  ? 'Subjects'
                  : 'Marks Landing'}
              </span>
            </button>
          )}
        </div>

        {/* ─── SCREEN 1: MARKS LANDING PAGE (PA vs PRACTICAL) ────────────────── */}
        {step === 'TYPE' && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Step 1 • Select Assessment Category
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Marks Management
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Select between Progressive Assessment (PA) theory exams or Laboratory Practical evaluation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              {/* PA Card */}
              <button
                onClick={() => handleSelectType('PA')}
                className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/80 text-left transition-all group shadow-xl hover:shadow-blue-900/20 relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                    <FileText size={28} />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-950/70 border border-blue-800/40 text-blue-300 font-mono">
                    3 Theory Subjects
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-blue-300 transition-colors mb-2">
                  PA (Paper Assessment)
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                  Manage Progressive Assessment marks (PA1, PA2, and Average) across the entire class roster of 68 students.
                </p>
                <div className="flex items-center text-xs font-bold text-blue-400 group-hover:translate-x-1.5 transition-transform pt-4 border-t border-slate-800">
                  <span>Select PA Subjects (STE, OSY, ACN)</span>
                  <ChevronRight size={16} className="ml-1.5" />
                </div>
              </button>

              {/* Practical Card */}
              <button
                onClick={() => handleSelectType('PRACTICAL')}
                className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500 hover:bg-slate-800/80 text-left transition-all group shadow-xl hover:shadow-purple-900/20 relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
                    <Beaker size={28} />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-950/70 border border-purple-800/40 text-purple-300 font-mono">
                    3 Lab Subjects • Batches A, B, C
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-purple-300 transition-colors mb-2">
                  Practical
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                  Manage Practical laboratory marks partitioned by student batches (Batch A, Batch B, and Batch C).
                </p>
                <div className="flex items-center text-xs font-bold text-purple-400 group-hover:translate-x-1.5 transition-transform pt-4 border-t border-slate-800">
                  <span>Select Practical Subjects (ENDS, SPI, ITR)</span>
                  <ChevronRight size={16} className="ml-1.5" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ─── SCREEN 2: SELECT SUBJECT ───────────────────────────────────────── */}
        {step === 'SUBJECT' && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                {marksType === 'PA' ? 'Step 2 of 2 • PA Subject' : 'Step 2 of 3 • Practical Subject'}
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                {marksType === 'PA'
                  ? 'Select PA Theory Subject'
                  : 'Select Practical Laboratory Course'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {marksType === 'PA'
                  ? 'Applicable theory subjects with Paper Assessment (PA1 & PA2 Max 30): STE, OSY, ACN.'
                  : 'Applicable courses with Practical laboratory evaluation: ENDS, SPI, ITR.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(marksType === 'PA' ? PA_SUBJECTS : PRACTICAL_SUBJECTS).map((sub) => {
                const assigned = isSubjectAssigned(sub.code);
                return (
                  <button
                    key={sub.code}
                    onClick={() => handleSelectSubject(sub.code)}
                    disabled={!assigned}
                    className={`p-6 rounded-2xl border text-left transition-all group shadow-lg ${
                      assigned
                        ? marksType === 'PA'
                          ? 'bg-slate-900 border-slate-800 hover:border-blue-500 hover:bg-slate-800/90 hover:shadow-blue-900/10 cursor-pointer'
                          : 'bg-slate-900 border-slate-800 hover:border-purple-500 hover:bg-slate-800/90 hover:shadow-purple-900/10 cursor-pointer'
                        : 'bg-slate-900/40 border-slate-800/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`text-xl font-mono font-black ${
                          marksType === 'PA' ? 'text-blue-400' : 'text-purple-400'
                        }`}
                      >
                        {sub.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                          Course {sub.courseCode}
                        </span>
                        {!assigned && (
                          <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950/70 border border-amber-800/50 px-2 py-0.5 rounded">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors mb-3">
                      {sub.name}
                    </h4>

                    <div
                      className={`flex items-center text-xs font-medium pt-3 border-t border-slate-800 ${
                        assigned
                          ? marksType === 'PA'
                            ? 'text-blue-400 group-hover:text-blue-300'
                            : 'text-purple-400 group-hover:text-purple-300'
                          : 'text-slate-600'
                      }`}
                    >
                      <span>
                        {assigned
                          ? marksType === 'PA'
                            ? 'Open Full Roster (68 Students)'
                            : 'Select Lab Batch (A, B, C)'
                          : 'Not assigned to you'}
                      </span>
                      {assigned && (
                        <ChevronRight
                          size={14}
                          className="ml-1 group-hover:translate-x-1 transition-transform"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
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
              <h2 className="text-xl font-bold text-white mt-1">
                {selectedSubject} Practical — Select Batch
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Each batch corresponds to an exact, non-overlapping subset of the 68 students.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {PRACTICAL_BATCHES.map((b) => (
                <button
                  key={b.batch}
                  onClick={() => handleSelectBatch(b.batch)}
                  className="p-6 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500 hover:bg-slate-800/90 text-left transition-all group shadow-xl hover:shadow-purple-900/20 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center font-black text-xl text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all">
                      {b.batch}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                      {b.count} Students
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white mb-1">Batch {b.batch}</h4>
                  <p className="text-xs font-mono text-purple-400 font-semibold mb-3">{b.range}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mb-5">
                    Enter direct practical marks for {b.count} students belonging to Batch {b.batch}.
                  </p>
                  <div className="flex items-center text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform pt-3 border-t border-slate-800">
                    <span>Open Marks Sheet</span>
                    <ChevronRight size={14} className="ml-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── SCREEN 4: MARKS ENTRY TABLE (PA OR PRACTICAL) ──────────────────── */}
        {step === 'ENTRY' && (
          <div className="space-y-5">
            {/* Header / Session Metadata Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`p-3 rounded-xl ${
                      marksType === 'PA'
                        ? 'bg-blue-950/80 border border-blue-700/50 text-blue-400'
                        : 'bg-purple-950/80 border border-purple-700/50 text-purple-400'
                    }`}
                  >
                    {marksType === 'PA' ? <FileText size={24} /> : <Beaker size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {marksType === 'PA' ? 'PA Theory' : 'Practical'}
                      </span>
                      <span
                        className={`text-xs font-black uppercase px-2.5 py-0.5 rounded ${
                          marksType === 'PA'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                            : 'bg-purple-950 text-purple-300 border border-purple-800/60'
                        }`}
                      >
                        {selectedSubject}
                      </span>
                      {selectedBatch && (
                        <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                          Batch {selectedBatch}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {marksType === 'PA'
                        ? 'Semester V Computer Engineering • Full Class (68 Students) • Numerical Order (1–68)'
                        : `Semester V Computer Engineering • Batch ${selectedBatch} (${students.length} Students)`}
                    </div>
                  </div>
                </div>

                {/* Search & Actions */}
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                  {/* Search Input */}
                  <div className="relative min-w-[200px] sm:w-64">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="text"
                      placeholder="Search Roll No or Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>

                  {/* Refresh */}
                  <button
                    onClick={() =>
                      fetchMarksAndProceed(marksType, selectedSubject, selectedBatch)
                    }
                    disabled={loading || savingAll}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Reload from database"
                  >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  </button>

                  {/* SAVE ALL Button */}
                  <button
                    onClick={handleSaveAll}
                    disabled={savingAll || loading || students.length === 0}
                    className={`px-5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-lg transition-all flex items-center gap-2 ${
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
                        <Save size={16} />
                        <span>
                          SAVE ALL {hasChanges && changedCount > 0 ? `(${changedCount})` : ''}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="text-xs font-mono">Loading marks records...</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  No students found matching your search.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
                        <th className="py-3.5 px-4 w-16 text-center font-mono">Roll</th>
                        <th className="py-3.5 px-4">Student Details</th>
                        {marksType === 'PRACTICAL' && (
                          <th className="py-3.5 px-4 w-24 text-center">Batch</th>
                        )}
                        {marksType === 'PA' ? (
                          <>
                            <th className="py-3.5 px-4 w-32 text-center">PA 1 (Max 30)</th>
                            <th className="py-3.5 px-4 w-32 text-center">PA 2 (Max 30)</th>
                            <th className="py-3.5 px-4 w-32 text-center">Average</th>
                            <th className="py-3.5 px-4 w-40 text-center">Performance</th>
                          </>
                        ) : (
                          <th className="py-3.5 px-4 w-44 text-center">Practical Marks</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {filteredStudents.map((s) => {
                        const roll = String(s.rollNo);
                        const state = marksState[roll] || {
                          pa1: '',
                          pa2: '',
                          practicalMarks: '',
                        };

                        const avg =
                          marksType === 'PA' ? computeAverage(state.pa1, state.pa2) : null;

                        return (
                          <tr
                            key={s.studentId || roll}
                            className="hover:bg-slate-800/40 transition-colors"
                          >
                            {/* Roll No */}
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                              {roll}
                            </td>

                            {/* Name & Enrollment */}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{s.fullName}</div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {s.enrollmentNumber}
                              </div>
                            </td>

                            {/* Batch (if Practical) */}
                            {marksType === 'PRACTICAL' && (
                              <td className="py-3 px-4 text-center">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800/60">
                                  Batch {s.batch || selectedBatch}
                                </span>
                              </td>
                            )}

                            {/* PA Columns */}
                            {marksType === 'PA' && (
                              <>
                                {/* PA 1 */}
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    step="0.5"
                                    placeholder="—"
                                    value={state.pa1 ?? ''}
                                    onChange={(e) =>
                                      handleMarkChange(roll, 'pa1', e.target.value)
                                    }
                                    className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-center font-mono text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                                  />
                                </td>

                                {/* PA 2 */}
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="30"
                                    step="0.5"
                                    placeholder="—"
                                    value={state.pa2 ?? ''}
                                    onChange={(e) =>
                                      handleMarkChange(roll, 'pa2', e.target.value)
                                    }
                                    className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-center font-mono text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                                  />
                                </td>

                                {/* Average (Read-Only Auto Computed) */}
                                <td className="py-3 px-4 text-center font-mono font-black text-sm">
                                  {avg !== null ? (
                                    <span
                                      className={
                                        avg >= 12
                                          ? 'text-emerald-400 font-bold'
                                          : 'text-red-400 font-bold'
                                      }
                                    >
                                      {avg}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 font-mono">—</span>
                                  )}
                                </td>

                                {/* Status Badge */}
                                <td className="py-3 px-4 text-center">
                                  <StatusBadge average={avg} />
                                </td>
                              </>
                            )}

                            {/* Practical Marks Column */}
                            {marksType === 'PRACTICAL' && (
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="Enter marks"
                                  value={state.practicalMarks ?? ''}
                                  onChange={(e) =>
                                    handleMarkChange(roll, 'practicalMarks', e.target.value)
                                  }
                                  className="w-32 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-center font-mono text-xs font-bold text-white focus:outline-none focus:border-purple-500 transition-colors"
                                />
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
        )}
      </div>
    </FacultyLayout>
  );
};

export default MarksManagementPage;
