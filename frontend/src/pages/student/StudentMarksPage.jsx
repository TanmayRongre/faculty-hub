import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';
import { getMyMarks } from '../../services/marksService';
import { BookOpen, CheckCircle2, TrendingUp, Star, Layers } from 'lucide-react';

const StatusBadge = ({ average }) => {
  if (average === null || average === undefined) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const num = Number(average);
  if (num >= 24) {
    return <span className="text-xs px-2.5 py-1 rounded-full border bg-emerald-950 text-emerald-400 border-emerald-800 font-semibold">Excellent</span>;
  }
  if (num >= 19.5) {
    return <span className="text-xs px-2.5 py-1 rounded-full border bg-blue-950 text-blue-400 border-blue-800 font-semibold">Good</span>;
  }
  if (num >= 15) {
    return <span className="text-xs px-2.5 py-1 rounded-full border bg-amber-950 text-amber-400 border-amber-800 font-semibold">Average</span>;
  }
  return <span className="text-xs px-2.5 py-1 rounded-full border bg-red-950 text-red-400 border-red-800 font-semibold">Needs Attention</span>;
};

const StudentMarksPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMyMarks({ semester: 5 })
      .then((res) => {
        setRecords(res.records || []);
        setSummary(res.summary || null);
        setStudentInfo(res.student || { fullName: res.studentName, enrollmentNumber: res.enrollmentNumber });
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Student profile not linked. Contact administrator.');
        } else {
          setError(err.response?.data?.message || 'Failed to load marks.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const theoryRecords = records.filter((r) => r.isTheory);
  const practicalRecords = records.filter((r) => !r.isTheory);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student/dashboard')}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <span className="text-slate-700">|</span>
            <span className="text-white font-semibold text-sm">Academic Marksheet</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name} • Computer Engineering
            </div>
            <h1 className="text-2xl font-bold text-white">5th Semester Progressive Assessment Marksheet</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Student: <strong className="text-white">{studentInfo?.fullName || user?.name}</strong> • Roll No:{' '}
              <strong className="text-white">{studentInfo?.rollNumber || '—'}</strong> • Enrollment:{' '}
              <strong className="text-white">{studentInfo?.enrollmentNumber || '—'}</strong>
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Theory Subjects</div>
                <div className="text-2xl font-bold text-white">3 (STE, OSY, ACN)</div>
                <div className="text-xs text-slate-500 mt-1">PA1 + PA2 Assessment</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Assessed Theory</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {summary?.assessedTheorySubjects || 0} / 3
                </div>
                <div className="text-xs text-slate-500 mt-1">Evaluated Complete</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Average Final PA</div>
                <div className="text-2xl font-bold text-blue-400">
                  {summary?.averagePA !== null && summary?.averagePA !== undefined
                    ? `${summary.averagePA} / 30`
                    : 'Not Available'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Across Assessed Subjects</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Passing Minimum</div>
                <div className="text-2xl font-bold text-purple-400">12 / 30</div>
                <div className="text-xs text-slate-500 mt-1">40% Threshold</div>
              </div>
            </div>

            {/* Theory Subjects Marksheet Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Theory Assessments (PA1 & PA2)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Final Marksheet PA = (PA1 + PA2) / 2</p>
                </div>
                <span className="text-xs font-mono text-slate-400">Max Marks: 30</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/40 text-slate-400 text-xs">
                      <th className="text-left px-5 py-3.5 font-semibold">Subject</th>
                      <th className="text-left px-5 py-3.5 font-semibold">Course Title</th>
                      <th className="text-center px-4 py-3.5 font-semibold w-24">PA 1 (30)</th>
                      <th className="text-center px-4 py-3.5 font-semibold w-24">PA 2 (30)</th>
                      <th className="text-center px-5 py-3.5 font-semibold w-36">Final PA Average</th>
                      <th className="text-center px-5 py-3.5 font-semibold w-40">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {theoryRecords.map((r) => (
                      <tr key={r.subjectCode} className="hover:bg-slate-800/20">
                        <td className="px-5 py-3.5 font-mono font-bold text-blue-400">
                          {r.subjectCode}
                        </td>
                        <td className="px-5 py-3.5 text-white font-medium">
                          {r.subjectName}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono text-slate-300">
                          {r.pa1 !== null && r.pa1 !== undefined ? r.pa1 : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono text-slate-300">
                          {r.pa2 !== null && r.pa2 !== undefined ? r.pa2 : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {r.average !== null && r.average !== undefined ? (
                            <span
                              className={`font-mono font-bold text-base px-2.5 py-1 rounded-md ${
                                r.average >= 12
                                  ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/30'
                                  : 'text-red-400 bg-red-950/40 border border-red-800/30'
                              }`}
                            >
                              {r.average} <span className="text-xs font-normal text-slate-400">/ 30</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono text-xs">Not Available</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <StatusBadge average={r.average} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Practical-Oriented Subjects */}
            {practicalRecords.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Practical & Continuous Assessment Courses</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Seminar, Internship, and Practical Courses</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/40 text-xs">
                    Practical Evaluation
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/40 text-slate-400 text-xs">
                        <th className="text-left px-5 py-3 font-semibold">Subject</th>
                        <th className="text-left px-5 py-3 font-semibold">Course Title</th>
                        <th className="text-left px-5 py-3 font-semibold">Assessment Type</th>
                        <th className="text-center px-5 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {practicalRecords.map((r) => (
                        <tr key={r.subjectCode} className="hover:bg-slate-800/20">
                          <td className="px-5 py-3.5 font-mono font-bold text-purple-400">
                            {r.subjectCode}
                          </td>
                          <td className="px-5 py-3.5 text-slate-300">
                            {r.subjectName}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-400">
                            Continuous Practical / Rubric Assessment
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              Term Evaluation In Progress
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentMarksPage;
