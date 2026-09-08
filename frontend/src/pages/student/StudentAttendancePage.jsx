import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { getMyAttendance } from '../../services/attendanceService';

const StudentAttendancePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMyAttendance()
      .then(res => {
        setData(res.data);
      })
      .catch(err => {
        if (err.response?.status === 404) {
          setError('Your student profile is not linked yet. Please contact your administrator.');
        } else {
          setError(err.response?.data?.message || 'Failed to load attendance records.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const overall = data?.overall || { total: 0, present: 0, absent: 0, percentage: 0, isDefaulter: false };
  const subjects = data?.subjects || [];
  const threshold = data?.defaulterThreshold || 75;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student/dashboard')}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ← Dashboard
            </button>
            <span className="text-slate-700">|</span>
            <span className="text-white font-semibold">My Attendance</span>
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            {INSTITUTION.name}
          </div>
          <h1 className="text-2xl font-bold text-white">Student Attendance Records</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Live attendance status computed from official academic records. Minimum threshold is <strong className="text-white">{threshold}%</strong>.
          </p>
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

        {!loading && !error && data && (
          <>
            {/* Defaulter Alert if < 75% */}
            {overall.isDefaulter && (
              <div className="bg-red-950/40 border border-red-700/60 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-lg shadow-red-950/30">
                <span className="text-2xl">⚠️</span>
                <div>
                  <div className="text-sm font-bold text-red-300">
                    Defaulter Warning — Attendance below {threshold}%
                  </div>
                  <div className="text-xs text-red-400/90 mt-1 leading-relaxed">
                    Your overall attendance is currently <strong>{overall.percentage}%</strong> ({overall.present}/{overall.total} lectures attended), which is below the mandatory MSBTE minimum of {threshold}%. You may be detained from appearing in board examinations if not improved.
                  </div>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5">
                <div className="text-[11px] sm:text-xs text-slate-400">Total Lectures</div>
                <div className="text-xl sm:text-2xl font-bold text-white mt-1">{overall.total}</div>
                <div className="text-[10px] sm:text-xs text-slate-500 mt-1">Conducted to date</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5">
                <div className="text-[11px] sm:text-xs text-emerald-400">Lectures Attended</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{overall.present}</div>
                <div className="text-[10px] sm:text-xs text-slate-500 mt-1">Classes present</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5">
                <div className="text-[11px] sm:text-xs text-red-400">Lectures Missed</div>
                <div className="text-xl sm:text-2xl font-bold text-red-400 mt-1">{overall.absent}</div>
                <div className="text-[10px] sm:text-xs text-slate-500 mt-1">Classes absent</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-5">
                <div className="text-[11px] sm:text-xs text-slate-400">Overall Attendance</div>
                <div className={`text-xl sm:text-2xl font-bold mt-1 ${overall.isDefaulter ? 'text-red-400' : 'text-emerald-400'}`}>
                  {overall.percentage}%
                </div>
                <div className="text-[10px] sm:text-xs mt-1 font-medium truncate">
                  {overall.isDefaulter ? (
                    <span className="text-red-400 font-semibold">Defaulter (&lt;{threshold}%)</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">Safe (&ge;{threshold}%)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Subject-wise Register and Progress Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Subject Table */}
              <div className="lg:col-span-2">
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Subject-wise Attendance</h3>
                  </div>

                  {subjects.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No subject attendance recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="text-left px-4 py-3 font-medium">Subject</th>
                            <th className="text-center px-4 py-3 font-medium">Conducted</th>
                            <th className="text-center px-4 py-3 font-medium text-emerald-400">Attended</th>
                            <th className="text-center px-4 py-3 font-medium text-red-400">Absent</th>
                            <th className="text-center px-4 py-3 font-medium">Percentage</th>
                            <th className="text-center px-4 py-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {subjects.map(s => (
                            <tr key={s.subjectCode} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-white font-medium text-xs">{s.subjectCode}</div>
                                <div className="text-slate-500 text-xs mt-0.5 truncate max-w-[160px]">
                                  {s.subjectName}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-300 font-mono">{s.total}</td>
                              <td className="px-4 py-3 text-center text-emerald-400 font-mono font-semibold">{s.present}</td>
                              <td className="px-4 py-3 text-center text-red-400 font-mono">{s.absent}</td>
                              <td className="px-4 py-3 text-center font-mono font-bold">
                                <span className={s.isDefaulter ? 'text-red-400' : 'text-emerald-400'}>
                                  {s.percentage}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {s.isDefaulter ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-900/40 text-red-400 border border-red-700/40">
                                    Defaulter
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
                                    Safe
                                  </span>
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

              {/* Visual Progress Bars */}
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Subject Attendance Bars</h3>
                  <div className="space-y-3">
                    {subjects.map(s => {
                      const color = s.isDefaulter
                        ? 'bg-red-500'
                        : s.percentage >= 85
                        ? 'bg-emerald-500'
                        : 'bg-blue-500';
                      return (
                        <div key={s.subjectCode}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-300 font-medium">{s.subjectCode}</span>
                            <span className="text-xs text-slate-400 font-mono">{s.percentage}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${color}`}
                              style={{ width: `${Math.min(s.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-2">
                  <div className="font-semibold text-white">Attendance Criteria</div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Safe Attendance
                    </span>
                    <span className="text-slate-300 font-mono">&ge; 75%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      Defaulter Shortage
                    </span>
                    <span className="text-slate-300 font-mono">&lt; 75%</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default StudentAttendancePage;
