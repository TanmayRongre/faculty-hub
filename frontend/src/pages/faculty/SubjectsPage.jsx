import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { academicService, facultyService } from '../../services/managementService';
import { INSTITUTION } from '../../config/institution';
import { ACADEMIC_CONFIG } from '../../config/academic';
import { useAuth } from '../../context/AuthContext';

const SubjectsPage = () => {
  const { isAdmin } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    subjectCode: '',
    subjectName: '',
    department: '',
    semester: 5,
    assignedFaculty: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadSubjects = useCallback(() => {
    setLoading(true);
    academicService.getSubjects({ all: 'true', semester: 5 })
      .then((d) => setSubjects(d.data || []))
      .catch(() => toast.error('Failed to load subjects'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      academicService.getDepartments(),
      facultyService.getFacultyList({ limit: 100 }),
    ]).then(([d, f]) => {
      const depts = d.data || [];
      setDepartments(depts);
      setFacultyList(f.data || []);
      if (depts.length > 0 && !form.department) {
        setForm((prev) => ({ ...prev, department: depts[0]._id }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subjectCode || !form.subjectName) {
      toast.error('Please fill required fields');
      return;
    }
    setFormLoading(true);
    try {
      await academicService.createSubject({
        ...form,
        department: form.department || (departments.length > 0 ? departments[0]._id : undefined),
        semester: 5,
        assignedFaculty: form.assignedFaculty || undefined,
      });
      toast.success('Subject created');
      setForm({ subjectCode: '', subjectName: '', department: '', semester: 5, assignedFaculty: '' });
      setShowForm(false);
      loadSubjects();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create subject');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name} • {ACADEMIC_CONFIG.DEPARTMENT.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Curriculum & Subject Catalog</h1>
            <p className="text-slate-400 text-sm mt-1">
              {ACADEMIC_CONFIG.SEMESTER.displayName} — {subjects.length} active curriculum subjects
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="self-start sm:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20"
            >
              {showForm ? 'Cancel' : '+ Add Subject'}
            </button>
          )}
        </div>

        {/* Add Subject Modal / Inline Form */}
        {showForm && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6 shadow-xl">
            <h2 className="text-sm font-semibold text-white mb-4">Add Curriculum Subject</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subject Code *</label>
                  <input
                    type="text"
                    placeholder="e.g. STE"
                    value={form.subjectCode}
                    onChange={(e) => setForm({ ...form, subjectCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Software Testing"
                    value={form.subjectName}
                    onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Assigned Faculty</label>
                  <select
                    value={form.assignedFaculty}
                    onChange={(e) => setForm({ ...form, assignedFaculty: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none"
                  >
                    <option value="">None / Unassigned</option>
                    {facultyList.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.fullName} ({f.designation})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Semester</label>
                  <input
                    type="text"
                    disabled
                    value={ACADEMIC_CONFIG.SEMESTER.displayName}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow"
                >
                  {formLoading ? 'Saving...' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Subjects Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-16 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-slate-400 text-sm">Loading curriculum subjects...</div>
            </div>
          ) : subjects.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-sm flex flex-col items-center">
              <BookOpen size={24} className="text-slate-500 mb-2" aria-hidden="true" />
              <span>No subjects found for Semester 5.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/50">
                    <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Subject Code</th>
                    <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Subject Title</th>
                    <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Department</th>
                    <th className="text-left px-5 py-3.5 text-slate-400 font-medium">Assigned Faculty</th>
                    <th className="text-center px-5 py-3.5 text-slate-400 font-medium">Semester</th>
                    <th className="text-center px-5 py-3.5 text-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {subjects.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-blue-400">
                        {s.subjectCode}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-white">
                        {s.subjectName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {ACADEMIC_CONFIG.DEPARTMENT.name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {s.assignedFaculty ? (
                          <div>
                            <div className="text-white font-medium">{s.assignedFaculty.fullName}</div>
                            <div className="text-xs text-slate-500">{s.assignedFaculty.designation}</div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-300 font-mono">
                        Sem {s.semester || 5}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </FacultyLayout>
  );
};

export default SubjectsPage;
