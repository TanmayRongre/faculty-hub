import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Check, X, Shield, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { facultyService, academicService } from '../../services/managementService';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';
import { StatusBadge } from '../../components/Badge';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';

const FacultyListPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  // All active curriculum subjects for assignment
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Subject Assignment Modal State
  const [assignModalFaculty, setAssignModalFaculty] = useState(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  // Fetch all subjects once for assignment
  useEffect(() => {
    academicService.getSubjects({ semester: 5 })
      .then((res) => {
        setAvailableSubjects(res.data || []);
      })
      .catch((err) => console.error('Failed to load subjects:', err));
  }, []);

  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (filterDesignation) params.designation = filterDesignation;
      if (filterStatus) params.status = filterStatus;

      const data = await facultyService.getFaculty(params);
      setList(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, pages: 1, limit: 50 });
    } catch {
      toast.error('Failed to load faculty directory');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterDesignation, filterStatus]);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  // Open Assign Subjects Modal
  const handleOpenAssignModal = (faculty) => {
    setAssignModalFaculty(faculty);
    const currentSubjectIds = (faculty.subjects || []).map((s) => s._id || s);
    setSelectedSubjectIds(currentSubjectIds);
  };

  // Toggle subject selection in modal
  const handleToggleSubject = (subjectId) => {
    setSelectedSubjectIds((prev) => {
      if (prev.includes(subjectId)) {
        return prev.filter((id) => id !== subjectId);
      }
      return [...prev, subjectId];
    });
  };

  // Save Subject Assignments (Batch)
  const handleSaveAssignments = async () => {
    if (!assignModalFaculty) return;
    setSavingAssignments(true);
    try {
      await facultyService.assignSubjects(assignModalFaculty._id, selectedSubjectIds);
      toast.success(`Assigned ${selectedSubjectIds.length} subject(s) to ${assignModalFaculty.fullName}`);
      setAssignModalFaculty(null);
      fetchFaculty();
    } catch (err) {
      console.error('Failed to assign subjects:', err);
      toast.error(err.response?.data?.message || 'Failed to save subject assignments');
    } finally {
      setSavingAssignments(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (faculty) => {
    const newStatus = faculty.status === 'active' ? 'inactive' : 'active';
    try {
      await facultyService.updateFacultyStatus(faculty._id, newStatus);
      toast.success(`Faculty ${faculty.fullName} is now ${newStatus}`);
      fetchFaculty();
    } catch (err) {
      toast.error('Failed to update faculty status');
    }
  };

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name} • {ACADEMIC_CONFIG.DEPARTMENT.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Faculty Management</h1>
            <p className="text-slate-400 text-sm mt-1">
              {pagination.total} total faculty profiles • Subject Assignments &amp; Workload
            </p>
          </div>
          {isAdmin && (
            <button
              id="add-faculty-btn"
              onClick={() => navigate('/faculty/faculty/new')}
              className="self-start sm:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              <span>+ Add Faculty</span>
            </button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search faculty name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
          />

          <select
            value={filterDesignation}
            onChange={(e) => {
              setFilterDesignation(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Designations</option>
            {ACADEMIC_CONFIG.FACULTY_DESIGNATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Faculty Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                <GraduationCap size={24} className="text-slate-500" aria-hidden="true" />
              </div>
              <p className="text-sm">No faculty found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Faculty Member</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Designation</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Academic Dept</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Assigned Subjects</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {list.map((f) => {
                    const assignedSubjects = f.subjects || [];
                    const workloadCount = assignedSubjects.length;

                    return (
                      <tr key={f._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{f.fullName}</div>
                          <div className="text-xs text-slate-400">{f.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 border border-slate-700 text-blue-300">
                            {f.designation}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">
                          <div>{ACADEMIC_CONFIG.DEPARTMENT.name}</div>
                          <div className="text-slate-500">5th Semester</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                            {assignedSubjects.length > 0 ? (
                              assignedSubjects.map((s) => (
                                <span
                                  key={s._id || s.subjectCode}
                                  className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-blue-950/80 text-blue-300 border border-blue-800/60"
                                  title={s.subjectName}
                                >
                                  {s.subjectCode}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500 italic">None assigned</span>
                            )}
                            <span className="text-[11px] text-slate-500 ml-1">
                              ({workloadCount} {workloadCount === 1 ? 'subject' : 'subjects'})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={f.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              onClick={() => navigate(`/faculty/faculty/${f._id}`)}
                              className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded transition-colors"
                              title="View Profile"
                            >
                              View
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleOpenAssignModal(f)}
                                  className="px-2.5 py-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 rounded border border-purple-800/40 transition-colors font-medium flex items-center gap-1"
                                  title="Assign Subjects"
                                >
                                  <BookOpen size={12} />
                                  <span>Assign</span>
                                </button>

                                <button
                                  onClick={() => navigate(`/faculty/faculty/${f._id}/edit`)}
                                  className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                                  title="Edit Faculty"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() => handleToggleStatus(f)}
                                  className={`px-2 py-1 text-xs rounded transition-colors ${
                                    f.status === 'active'
                                      ? 'text-red-400 hover:text-red-300 hover:bg-red-950/40'
                                      : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
                                  }`}
                                  title={f.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                                >
                                  <Power size={13} className="inline mr-1" />
                                  {f.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="p-4 border-t border-slate-800">
              <Pagination page={page} pages={pagination.pages} onPageChange={(p) => setPage(p)} />
            </div>
          )}
        </div>

        {/* ─── SUBJECT ASSIGNMENT MODAL (BATCH) ─────────────────────────────── */}
        {assignModalFaculty && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Assign Subjects</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Faculty: <strong className="text-blue-400">{assignModalFaculty.fullName}</strong> ({assignModalFaculty.designation})
                  </p>
                </div>
                <button
                  onClick={() => setAssignModalFaculty(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Available Subjects (5th Semester Computer Engineering)
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {availableSubjects.map((sub) => {
                    const isSelected = selectedSubjectIds.includes(sub._id);
                    return (
                      <div
                        key={sub._id}
                        onClick={() => handleToggleSubject(sub._id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-950/40 border-blue-600 text-white shadow-sm'
                            : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 bg-slate-900'
                            }`}
                          >
                            {isSelected && <Check size={13} strokeWidth={3} />}
                          </div>
                          <div>
                            <div className="font-bold text-sm font-mono flex items-center gap-2">
                              <span>{sub.subjectCode}</span>
                              {sub.courseCode && (
                                <span className="text-xs font-normal text-slate-500 font-sans">
                                  ({sub.courseCode})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{sub.subjectName}</div>
                          </div>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Sem {sub.semester || 5}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-xs text-slate-400 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
                <span className="text-blue-400 font-semibold">Security Note:</span> The faculty member will receive authorized access to Attendance, Marks, and Timetable for ONLY the selected subjects. Direct API access to other subjects will be blocked (403 Forbidden).
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setAssignModalFaculty(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignments}
                  disabled={savingAssignments}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {savingAssignments ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>SAVE ASSIGNMENTS ({selectedSubjectIds.length})</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FacultyLayout>
  );
};

export default FacultyListPage;
