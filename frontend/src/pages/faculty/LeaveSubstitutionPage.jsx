import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  FileText,
  Shield,
  BookOpen,
  Users,
  Check,
  X,
  ExternalLink,
  Send,
  CalendarCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { useAuth } from '../../context/AuthContext';
import { facultyService } from '../../services/managementService';
import { substitutionService } from '../../services/substitutionService';
import {
  getTeachableSessionsForDay,
  SUBJECT_THEMES,
  formatLocalDate,
  getDayNameFromDateString,
} from '../../utils/timetableSchedule';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LeaveSubstitutionPage = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Active tab: 'APPLY' | 'RECEIVED' | 'MY_REQUESTS' | 'MY_SUBSTITUTIONS' | 'ADMIN'
  const [activeTab, setActiveTab] = useState('APPLY');

  // Faculty profile & directory state
  const [currentFaculty, setCurrentFaculty] = useState(null);
  const [facultyList, setFacultyList] = useState([]);
  const [loadingFaculty, setLoadingFaculty] = useState(true);

  // Leave Form State
  const [leaveDate, setLeaveDate] = useState(() => {
    const today = new Date();
    // If today is weekend, default to coming Monday
    const day = today.getDay();
    if (day === 6) today.setDate(today.getDate() + 2);
    else if (day === 0) today.setDate(today.getDate() + 1);
    return formatLocalDate(today);
  });
  const [reason, setReason] = useState('');
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [substituteFacultyId, setSubstituteFacultyId] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Tab Data States
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [mySubstitutions, setMySubstitutions] = useState([]);
  const [allSubstitutions, setAllSubstitutions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Status Filter for Admin / Lists
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');

  // Modal for Rejecting
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Determine Day name of selected leaveDate (timezone-safe)
  const leaveDayName = useMemo(() => getDayNameFromDateString(leaveDate), [leaveDate]);

  const isWeekend = leaveDayName === 'Saturday' || leaveDayName === 'Sunday';

  // Available sessions for selected weekday
  const availableSessions = useMemo(() => {
    if (!leaveDayName || isWeekend) return [];
    return getTeachableSessionsForDay(leaveDayName);
  }, [leaveDayName, isWeekend]);

  // Load faculty list and current faculty profile
  useEffect(() => {
    const loadFacultyData = async () => {
      setLoadingFaculty(true);
      try {
        const [profRes, listRes] = await Promise.all([
          facultyService.getMyFacultyProfile().catch(() => ({ data: null })),
          facultyService.getFacultyList({ limit: 100 }).catch(() => ({ data: [] })),
        ]);
        if (profRes?.data) setCurrentFaculty(profRes.data);
        if (listRes?.data) setFacultyList(listRes.data);
      } catch (err) {
        console.error('Failed to load faculty information:', err);
      } finally {
        setLoadingFaculty(false);
      }
    };
    loadFacultyData();
  }, []);

  // Filtered substitute candidates (cannot choose oneself)
  const candidateSubstitutes = useMemo(() => {
    if (!currentFaculty) return facultyList;
    return facultyList.filter(
      (f) => String(f._id) !== String(currentFaculty._id) && String(f.userId) !== String(user?._id)
    );
  }, [facultyList, currentFaculty, user]);

  // Load requests based on active tab
  const loadTabData = useCallback(async () => {
    setLoadingData(true);
    try {
      if (activeTab === 'RECEIVED') {
        const res = await substitutionService.getReceivedRequests();
        setReceivedRequests(res.data || []);
      } else if (activeTab === 'MY_REQUESTS') {
        const res = await substitutionService.getMyApplications();
        setMyApplications(res.data || []);
      } else if (activeTab === 'MY_SUBSTITUTIONS') {
        const res = await substitutionService.getMySubstitutions();
        setMySubstitutions(res.data || []);
      } else if (activeTab === 'ADMIN' && isAdmin) {
        const params = adminStatusFilter !== 'all' ? { status: adminStatusFilter } : {};
        const res = await substitutionService.getAllSubstitutions(params);
        setAllSubstitutions(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load substitution data:', err);
      toast.error('Failed to load substitution data');
    } finally {
      setLoadingData(false);
    }
  }, [activeTab, isAdmin, adminStatusFilter]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // Count pending received requests for badge
  useEffect(() => {
    substitutionService
      .getReceivedRequests({ status: 'pending' })
      .then((res) => {
        setReceivedRequests(res.data || []);
      })
      .catch(() => {});
  }, []);

  const pendingReceivedCount = useMemo(() => {
    return receivedRequests.filter((r) => r.status === 'pending').length;
  }, [receivedRequests]);

  // Handle Session Toggle in Leave Form
  const toggleSession = (sessionId) => {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  const selectAllSessions = () => {
    setSelectedSessionIds(availableSessions.map((s) => s.id));
  };

  const clearSessionSelection = () => {
    setSelectedSessionIds([]);
  };

  // Submit Leave & Substitution Applications
  const handleSubmitLeave = async (e) => {
    e.preventDefault();

    if (!leaveDate) {
      toast.error('Please select a leave date');
      return;
    }
    if (isWeekend) {
      toast.error('Cannot apply for leave on weekends (no scheduled sessions)');
      return;
    }
    if (selectedSessionIds.length === 0) {
      toast.error('Please select at least one timetable session to cover');
      return;
    }
    if (!substituteFacultyId) {
      toast.error('Please select a substitute faculty member');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for absence');
      return;
    }

    setSubmittingLeave(true);
    let successCount = 0;
    let failedErrors = [];

    const sessionsToCover = availableSessions.filter((s) => selectedSessionIds.includes(s.id));

    for (const session of sessionsToCover) {
      try {
        await substitutionService.createSubstitution({
          substituteFacultyId,
          subjectCode: session.subjectCode,
          subjectName: session.subjectName,
          date: leaveDate,
          startTime: session.startTime,
          endTime: session.endTime,
          sessionType: session.sessionType,
          batch: session.batch,
          room: session.room,
          reason: reason.trim(),
        });
        successCount++;
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Error creating substitution';
        failedErrors.push(`${session.subjectCode} (${session.timeDisplay}): ${msg}`);
      }
    }

    setSubmittingLeave(false);

    if (successCount > 0) {
      toast.success(
        `Successfully submitted ${successCount} substitution request${successCount > 1 ? 's' : ''}`
      );
      setSelectedSessionIds([]);
      setReason('');
      // Switch to My Requests tab to see pending status
      setActiveTab('MY_REQUESTS');
    }

    if (failedErrors.length > 0) {
      failedErrors.forEach((errMsg) => toast.error(errMsg));
    }
  };

  // Accept a Received Request
  const handleAcceptRequest = async (requestId) => {
    setActionLoading(true);
    try {
      await substitutionService.respondSubstitution(requestId, 'accept');
      toast.success('Substitution accepted! That session will reflect on your timetable and attendance.');
      loadTabData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept substitution');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Reject Modal
  const openRejectModal = (request) => {
    setRequestToReject(request);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  // Confirm Rejection
  const handleConfirmReject = async () => {
    if (!requestToReject) return;
    setActionLoading(true);
    try {
      await substitutionService.respondSubstitution(requestToReject._id, 'reject', rejectionReason);
      toast.success('Substitution request rejected');
      setRejectModalOpen(false);
      setRequestToReject(null);
      loadTabData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject substitution');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Request (Applicant or Admin)
  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this substitution request?')) {
      return;
    }
    setActionLoading(true);
    try {
      await substitutionService.cancelSubstitution(requestId, 'Cancelled by user');
      toast.success('Substitution request cancelled');
      loadTabData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setActionLoading(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
            <CheckCircle2 size={12} aria-hidden="true" />
            Accepted
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60">
            <Clock size={12} aria-hidden="true" />
            Pending Response
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/60">
            <XCircle size={12} aria-hidden="true" />
            Rejected
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <UserX size={12} aria-hidden="true" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">
              Faculty Leave & Substitution Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Leave & Lecture Substitution
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Apply for leave, nominate substitutes for Semester V sessions, and manage incoming requests.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/faculty/timetable')}
              className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Calendar size={14} className="text-blue-400" aria-hidden="true" />
              <span>View Timetable</span>
            </button>
            <button
              onClick={loadTabData}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => setActiveTab('APPLY')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'APPLY'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Plus size={14} aria-hidden="true" />
            <span>Apply for Leave</span>
          </button>

          <button
            onClick={() => setActiveTab('RECEIVED')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all relative ${
              activeTab === 'RECEIVED'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <UserCheck size={14} aria-hidden="true" />
            <span>Requests Received</span>
            {pendingReceivedCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-slate-950 rounded-full">
                {pendingReceivedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('MY_REQUESTS')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'MY_REQUESTS'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileText size={14} aria-hidden="true" />
            <span>My Leave Applications</span>
          </button>

          <button
            onClick={() => setActiveTab('MY_SUBSTITUTIONS')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'MY_SUBSTITUTIONS'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <CalendarCheck size={14} aria-hidden="true" />
            <span>My Accepted Substitutions</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('ADMIN')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'ADMIN'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Shield size={14} aria-hidden="true" />
              <span>Admin Overview</span>
            </button>
          )}
        </div>

        {/* ─── TAB 1: APPLY FOR LEAVE ────────────────────────────────────────── */}
        {activeTab === 'APPLY' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Leave Parameters & Sessions Selection (2 cols) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Date & Day Selection Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar size={16} className="text-purple-400" aria-hidden="true" />
                    <span>Select Leave Date</span>
                  </h2>
                  {leaveDayName && (
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                        isWeekend
                          ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                          : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                      }`}
                    >
                      {leaveDayName}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Date of Absence
                    </label>
                    <input
                      type="date"
                      value={leaveDate}
                      onChange={(e) => {
                        setLeaveDate(e.target.value);
                        setSelectedSessionIds([]);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Reason for Absence
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Medical emergency, Official training, Personal leave"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                {isWeekend && (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
                    <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <strong>No scheduled sessions on weekends.</strong>
                      <div className="text-amber-400/90 mt-0.5">
                        Please select a weekday (Monday through Friday) to view and select timetable sessions.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sessions Selection */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Clock size={16} className="text-purple-400" aria-hidden="true" />
                      <span>Select Semester V Sessions to Cover</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select the specific lectures or batch practicals you will miss on this date.
                    </p>
                  </div>

                  {!isWeekend && availableSessions.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllSessions}
                        className="text-purple-400 hover:text-purple-300 font-semibold"
                      >
                        Select All
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={clearSessionSelection}
                        className="text-slate-400 hover:text-slate-300"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {isWeekend ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                    Select a weekday to load timetable slots.
                  </div>
                ) : availableSessions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                    No teachable sessions found for {leaveDayName}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availableSessions.map((session) => {
                        const isSelected = selectedSessionIds.includes(session.id);
                        const theme = SUBJECT_THEMES[session.subjectCode] || {
                          text: 'text-white',
                          border: 'border-slate-700',
                          bg: 'bg-slate-800/40',
                        };

                        return (
                          <div
                            key={session.id}
                            onClick={() => toggleSession(session.id)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                              isSelected
                                ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-950/50 ring-1 ring-purple-500/50'
                                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // handled by parent div onClick
                                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700 cursor-pointer"
                                />
                                <div>
                                  <span className={`text-sm font-bold tracking-wide ${theme.text}`}>
                                    {session.subjectCode}
                                  </span>
                                  <span className="text-xs text-slate-400 block">
                                    {session.subjectName}
                                  </span>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  session.sessionType === 'LECTURE'
                                    ? 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                                    : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                                }`}
                              >
                                {session.sessionType === 'LECTURE'
                                  ? 'Lecture'
                                  : `Batch ${session.batch} Practical`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                              <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                                <Clock size={11} className="text-purple-400" aria-hidden="true" />
                                {session.timeDisplay}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                                Room {session.room}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Nominate Substitute & Review Summary (1 col) */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-800">
                  <UserCheck size={16} className="text-purple-400" aria-hidden="true" />
                  <span>Nominate Substitute</span>
                </h2>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Substitute Faculty Member
                  </label>
                  <select
                    value={substituteFacultyId}
                    onChange={(e) => setSubstituteFacultyId(e.target.value)}
                    disabled={loadingFaculty}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    <option value="">-- Select Substitute Faculty --</option>
                    {candidateSubstitutes.map((fac) => {
                      const deptText =
                        typeof fac.department === 'object'
                          ? fac.department?.name || fac.department?.code || 'Computer'
                          : fac.department || 'Computer';
                      return (
                        <option key={fac._id} value={fac._id}>
                          {fac.fullName || fac.name} ({deptText})
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    The chosen faculty will receive a notification and must explicitly accept this request before the timetable is updated.
                  </p>
                </div>

                {/* Summary Box */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Application Summary
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Date:</span>
                      <span className="text-white font-medium">{leaveDate || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Day:</span>
                      <span className="text-white font-medium">{leaveDayName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Selected Sessions:</span>
                      <span className="text-purple-400 font-bold">
                        {selectedSessionIds.length} session{selectedSessionIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Substitute:</span>
                      <span className="text-white font-medium truncate max-w-[150px]">
                        {candidateSubstitutes.find((f) => String(f._id) === String(substituteFacultyId))
                          ?.fullName || 'Not selected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleSubmitLeave}
                  disabled={submittingLeave || selectedSessionIds.length === 0 || !substituteFacultyId || isWeekend}
                  className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-950/50"
                >
                  {submittingLeave ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} aria-hidden="true" />
                      <span>Submit Leave & Substitution</span>
                    </>
                  )}
                </button>
              </div>

              {/* Policy Notes */}
              <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2 text-xs text-slate-400">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Shield size={13} className="text-purple-400" aria-hidden="true" />
                  <span>Important Substitution Guidelines</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                  <li>The Semester V master timetable is never permanently modified.</li>
                  <li>Only accepted substitutions will override the schedule for that specific calendar date.</li>
                  <li>Accepted substitutes receive temporary session-level attendance marking permissions.</li>
                  <li>Practical substitutions apply strictly to the requested batch (Batch A, B, or C).</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: REQUESTS RECEIVED ──────────────────────────────────────── */}
        {activeTab === 'RECEIVED' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck size={16} className="text-purple-400" aria-hidden="true" />
                  <span>Substitution Requests Sent to You</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Colleagues requesting you to cover their lecture or practical sessions.
                </p>
              </div>
            </div>

            {loadingData ? (
              <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-purple-400" aria-hidden="true" />
                <span>Loading received requests...</span>
              </div>
            ) : receivedRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No substitution requests received at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {receivedRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  return (
                    <div
                      key={req._id}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {req.subjectCode} — {req.subjectName}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              req.sessionType === 'LECTURE'
                                ? 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                                : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                            }`}
                          >
                            {req.sessionType === 'LECTURE'
                              ? 'Lecture'
                              : `Batch ${req.batch} Practical`}
                          </span>
                          {renderStatusBadge(req.status)}
                        </div>

                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>
                            <strong className="text-slate-300">Applicant:</strong>{' '}
                            {req.applicantId?.fullName || 'Faculty Member'}
                          </span>
                          <span>
                            <strong className="text-slate-300">Date:</strong> {req.date}
                          </span>
                          <span>
                            <strong className="text-slate-300">Time:</strong> {req.startTime} – {req.endTime}
                          </span>
                          <span>
                            <strong className="text-slate-300">Room:</strong> {req.room}
                          </span>
                        </div>

                        {req.reason && (
                          <div className="text-xs text-slate-500 italic">
                            Reason: "{req.reason}"
                          </div>
                        )}
                      </div>

                      {/* Action buttons if pending */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(req._id)}
                            disabled={actionLoading}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Check size={14} aria-hidden="true" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openRejectModal(req)}
                            disabled={actionLoading}
                            className="px-3.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-200 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <X size={14} aria-hidden="true" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: MY LEAVE APPLICATIONS ──────────────────────────────────── */}
        {activeTab === 'MY_REQUESTS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText size={16} className="text-purple-400" aria-hidden="true" />
                  <span>Your Submitted Leave Applications</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track the status of your substitution requests.
                </p>
              </div>
            </div>

            {loadingData ? (
              <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-purple-400" aria-hidden="true" />
                <span>Loading your applications...</span>
              </div>
            ) : myApplications.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                You have not submitted any leave applications yet.
              </div>
            ) : (
              <div className="space-y-3">
                {myApplications.map((req) => {
                  const isPending = req.status === 'pending';
                  return (
                    <div
                      key={req._id}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {req.subjectCode} — {req.subjectName}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              req.sessionType === 'LECTURE'
                                ? 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                                : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                            }`}
                          >
                            {req.sessionType === 'LECTURE'
                              ? 'Lecture'
                              : `Batch ${req.batch} Practical`}
                          </span>
                          {renderStatusBadge(req.status)}
                        </div>

                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>
                            <strong className="text-slate-300">Nominated Substitute:</strong>{' '}
                            {req.substituteFacultyId?.fullName || 'Faculty Member'}
                          </span>
                          <span>
                            <strong className="text-slate-300">Date:</strong> {req.date}
                          </span>
                          <span>
                            <strong className="text-slate-300">Time:</strong> {req.startTime} – {req.endTime}
                          </span>
                          <span>
                            <strong className="text-slate-300">Room:</strong> {req.room}
                          </span>
                        </div>

                        {req.rejectionReason && req.status === 'rejected' && (
                          <div className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/60">
                            <strong>Reason for Rejection:</strong> {req.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Cancel option if pending */}
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleCancelRequest(req._id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 text-xs font-semibold transition-colors"
                        >
                          Cancel Request
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: MY ACCEPTED SUBSTITUTIONS ──────────────────────────────── */}
        {activeTab === 'MY_SUBSTITUTIONS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarCheck size={16} className="text-purple-400" aria-hidden="true" />
                  <span>Sessions You Have Agreed to Cover</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  You have full temporary attendance marking permissions for these sessions on these dates.
                </p>
              </div>
            </div>

            {loadingData ? (
              <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-purple-400" aria-hidden="true" />
                <span>Loading active substitutions...</span>
              </div>
            ) : mySubstitutions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                You have no active accepted substitutions.
              </div>
            ) : (
              <div className="space-y-3">
                {mySubstitutions.map((req) => (
                  <div
                    key={req._id}
                    className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {req.subjectCode} — {req.subjectName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            req.sessionType === 'LECTURE'
                              ? 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                              : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                          }`}
                        >
                          {req.sessionType === 'LECTURE'
                            ? 'Lecture'
                            : `Batch ${req.batch} Practical`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                          Active Coverage
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          <strong className="text-slate-300">Covering For:</strong>{' '}
                          {req.applicantId?.fullName || 'Original Faculty'}
                        </span>
                        <span>
                          <strong className="text-slate-300">Date:</strong> {req.date}
                        </span>
                        <span>
                          <strong className="text-slate-300">Time:</strong> {req.startTime} – {req.endTime}
                        </span>
                        <span>
                          <strong className="text-slate-300">Room:</strong> {req.room}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/faculty/attendance?subject=${req.subjectCode}&batch=${
                              req.batch || ''
                            }&date=${req.date}`
                          )
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-purple-950/50"
                      >
                        <span>Take Attendance</span>
                        <ExternalLink size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 5: ADMIN OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === 'ADMIN' && isAdmin && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield size={16} className="text-purple-400" aria-hidden="true" />
                  <span>Admin Substitution Audit & Control</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete view of all leave applications and faculty substitutions across the institution.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filter:</span>
                <select
                  value={adminStatusFilter}
                  onChange={(e) => setAdminStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {loadingData ? (
              <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-purple-400" aria-hidden="true" />
                <span>Loading all substitution records...</span>
              </div>
            ) : allSubstitutions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No substitution records found matching filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Applicant</th>
                      <th className="py-2.5 px-3">Substitute</th>
                      <th className="py-2.5 px-3">Session</th>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Room</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {allSubstitutions.map((row) => (
                      <tr key={row._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono">{row.date}</td>
                        <td className="py-2.5 px-3 font-medium text-white">
                          {row.applicantId?.fullName || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-purple-300">
                          {row.substituteFacultyId?.fullName || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold">{row.subjectCode}</span>{' '}
                          <span className="text-[10px] text-slate-400">
                            ({row.sessionType === 'LECTURE' ? 'Lecture' : `Batch ${row.batch}`})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{row.startTime}–{row.endTime}</td>
                        <td className="py-2.5 px-3">{row.room}</td>
                        <td className="py-2.5 px-3">{renderStatusBadge(row.status)}</td>
                        <td className="py-2.5 px-3 text-right">
                          {row.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleCancelRequest(row._id)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── MODAL: REJECT REQUEST ────────────────────────────────────────── */}
        {rejectModalOpen && requestToReject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <XCircle size={16} className="text-rose-400" aria-hidden="true" />
                  <span>Reject Substitution Request</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  Declining substitution for{' '}
                  <strong className="text-white">
                    {requestToReject.subjectCode} ({requestToReject.sessionType})
                  </strong>{' '}
                  on <strong className="text-white">{requestToReject.date}</strong>.
                </div>
                <div>The applicant faculty member will be informed.</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Prior academic commitment, lab assessment at the same time"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FacultyLayout>
  );
};

export default LeaveSubstitutionPage;
