import React, { useState, useEffect } from 'react';
import { PartyPopper, RefreshCw, UserRound, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';
import { getTimetable } from '../../services/schedulerService';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const StudentTimetablePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTimetable()
      .then((res) => {
        setData(res.data || null);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('Student profile not linked. Contact administrator.');
        } else {
          setError(err.response?.data?.message || 'Failed to load timetable.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const studentInfo = data?.student;
  const weekly = data?.weekly;
  const upcoming = data?.upcomingLectures || [];
  const holidays = data?.holidays || [];

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
            <span className="text-white font-semibold text-sm">Class Timetable</span>
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
              {INSTITUTION.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Weekly Class Schedule</h1>
            <p className="text-slate-400 mt-1 text-sm">
              <strong className="text-white">{ACADEMIC_CONFIG.DEPARTMENT.name}</strong> • <strong className="text-white">{ACADEMIC_CONFIG.SEMESTER.displayName}</strong>
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

        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Holiday Notice Banner */}
            {holidays.length > 0 && (
              <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-4 flex items-center gap-3 text-purple-300 text-xs">
                <PartyPopper size={18} className="text-purple-400 shrink-0" aria-hidden="true" />
                <div>
                  <strong>Upcoming Holiday:</strong> {holidays[0].title} ({holidays[0].date}). Any lectures falling on this day are automatically rescheduled.
                </div>
              </div>
            )}

            {/* Upcoming Rescheduled Lectures Banner */}
            {upcoming.some((l) => l.isRescheduled) && (
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 flex items-center gap-3 text-amber-300 text-xs">
                <RefreshCw size={18} className="text-amber-400 shrink-0" aria-hidden="true" />
                <div>
                  <strong>Rescheduled Lectures:</strong> One or more lectures in your upcoming week have been shifted to replacement slots due to holidays. Check the schedule below.
                </div>
              </div>
            )}

            {/* Weekly Timetable Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DAYS.map((day) => {
                const daySlots = weekly?.days ? (weekly.days[day] || []) : [];
                return (
                  <div key={day} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
                    <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
                      <span className="font-bold text-white text-sm tracking-wide">{day}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                        {daySlots.length} {daySlots.length === 1 ? 'lecture' : 'lectures'}
                      </span>
                    </div>

                    <div className="p-3 space-y-3 flex-1">
                      {daySlots.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500 italic">
                          No lectures scheduled
                        </div>
                      ) : (
                        daySlots.map((slot) => (
                          <div
                            key={slot._id}
                            className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 hover:border-slate-600 transition-all"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/50">
                                {slot.startTime} – {slot.endTime}
                              </span>
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                {slot.lectureType}
                              </span>
                            </div>

                            <div className="font-bold text-white text-sm">{slot.subjectCode}</div>
                            <div className="text-xs text-slate-400 truncate">{slot.subjectName || slot.subject?.subjectName}</div>

                            <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <UserRound size={12} aria-hidden="true" /> {slot.faculty?.fullName || slot.faculty?.name || 'Faculty'}
                              </span>
                              <span className="font-mono text-slate-300 flex items-center gap-1">
                                <Building2 size={12} aria-hidden="true" /> {slot.room || 'Classroom'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentTimetablePage;
