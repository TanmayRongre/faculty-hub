import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';
import { getMyMarks } from '../../services/marksService';
import { BookOpen, CheckCircle2, TrendingUp, Star } from 'lucide-react';

const StatusBadge = ({ pa }) => {
  if (pa === null || pa === undefined) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const num = Number(pa);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMyMarks({ semester: 5 })
      .then((res) => {
        setRecords(res.records || []);
        setSummary(res.summary || null);
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
            <span className="text-white font-semibold text-sm">Academic Marks</span>
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
              {INSTITUTION.name} • {ACADEMIC_CONFIG.DEPARTMENT.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Progressive Assessment (PA) Report</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Continuous assessment marks for <strong className="text-white">{ACADEMIC_CONFIG.SEMESTER.displayName}</strong> (Out of 30 marks per subject).
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
                <div className="text-xs text-slate-500 mb-1">Total Subjects</div>
                <div className="text-2xl font-bold text-white">{ACADEMIC_CONFIG.SUBJECTS.length}</div>
                <div className="text-xs text-slate-500 mt-1">Semester 5 Curriculum</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Assessed Subjects</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {summary?.overallSummary?.subjectsWithMarks || records.filter((r) => r.PA !== null).length}
                </div>
                <div className="text-xs text-slate-500 mt-1">Marks Recorded</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Average PA Score</div>
                <div className="text-2xl font-bold text-blue-400">
                  {summary?.overallSummary?.averagePA ? `${summary.overallSummary.averagePA} / 30` : '—'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {summary?.overallSummary?.averagePercent ? `${summary.overallSummary.averagePercent}% overall` : 'Continuous Eval'}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-1">Passing Threshold</div>
                <div className="text-2xl font-bold text-purple-400">12 / 30</div>
                <div className="text-xs text-slate-500 mt-1">40% Minimum</div>
              </div>
            </div>

            {/* Marks Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Subject-wise PA Marks</h3>
                <span className="text-xs font-mono text-slate-400">Max Marks: 30</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/40 text-slate-400 text-xs">
                      <th className="text-left px-5 py-3.5 font-semibold">Subject Code</th>
                      <th className="text-left px-5 py-3.5 font-semibold">Subject Name</th>
                      <th className="text-center px-5 py-3.5 font-semibold">PA Marks (30)</th>
                      <th className="text-center px-5 py-3.5 font-semibold">Percentage</th>
                      <th className="text-center px-5 py-3.5 font-semibold">Evaluation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {ACADEMIC_CONFIG.SUBJECTS.map((sub) => {
                      const match = records.find((r) => r.subjectCode === sub.code);
                      const pa = match ? (match.PA ?? match.calculatedPA) : null;
                      const percent = pa !== null && pa !== undefined ? ((pa / 30) * 100).toFixed(1) : null;

                      return (
                        <tr key={sub.code} className="hover:bg-slate-800/20">
                          <td className="px-5 py-3.5 font-mono font-bold text-blue-400">
                            {sub.code}
                          </td>
                          <td className="px-5 py-3.5 text-white font-medium">
                            {sub.name}
                          </td>
                          <td className="px-5 py-3.5 text-center font-mono font-bold text-base">
                            {pa !== null && pa !== undefined ? (
                              <span className={pa >= 12 ? 'text-white' : 'text-red-400'}>
                                {pa} <span className="text-xs text-slate-500 font-normal">/ 30</span>
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center font-mono text-slate-300">
                            {percent !== null ? `${percent}%` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <StatusBadge pa={pa} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentMarksPage;
