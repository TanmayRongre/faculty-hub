import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { facultyService } from '../../services/managementService';
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

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name} • {ACADEMIC_CONFIG.DEPARTMENT.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Faculty Directory</h1>
            <p className="text-slate-400 text-sm mt-1">{pagination.total} total faculty profiles</p>
          </div>
          {isAdmin && (
            <button
              id="add-faculty-btn"
              onClick={() => navigate('/faculty/faculty/new')}
              className="self-start sm:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20"
            >
              + Add Faculty
            </button>
          )}
        </div>

        {/* Filters */}
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

        {/* Table */}
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
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Faculty Name</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Department</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Designation</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {list.map((f) => (
                    <tr key={f._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{f.fullName}</div>
                        <div className="text-xs text-slate-500">{f.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {ACADEMIC_CONFIG.DEPARTMENT.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 border border-slate-700 text-blue-300">
                          {f.designation}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/faculty/faculty/${f._id}`)}
                            className="px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded transition-colors"
                          >
                            View
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => navigate(`/faculty/faculty/${f._id}/edit`)}
                              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
      </div>
    </FacultyLayout>
  );
};

export default FacultyListPage;
