import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { academicService } from '../../services/managementService';
import { INSTITUTION } from '../../config/institution';
import { useAuth } from '../../context/AuthContext';

const SectionCard = ({ title, count, children }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-6">
    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-white">
        {title} {count !== undefined && <span className="text-slate-400 font-normal">({count})</span>}
      </h2>
    </div>
    {children}
  </div>
);

const AcademicStructurePage = () => {
  const { isAdmin } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [deptLoading, setDeptLoading] = useState(false);

  const [courseForm, setCourseForm] = useState({ name: '', code: '', department: '', totalSemesters: 6 });
  const [courseLoading, setCourseLoading] = useState(false);

  const [semForm, setSemForm] = useState({ semesterNumber: 1, academicYear: '2023-2024', department: '', course: '' });
  const [semLoading, setSemLoading] = useState(false);

  const [divForm, setDivForm] = useState({ name: 'A', semester: 1, academicYear: '2023-2024', department: '', course: '' });
  const [divLoading, setDivLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      academicService.getDepartments({ all: 'true' }),
      academicService.getCourses({ all: 'true' }),
      academicService.getSemesters({ all: 'true' }),
      academicService.getDivisions({ all: 'true' }),
    ])
      .then(([d, c, s, div]) => {
        setDepartments(d.data || []);
        setCourses(c.data || []);
        setSemesters(s.data || []);
        setDivisions(div.data || []);
      })
      .catch(() => toast.error('Failed to load academic structure'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!deptForm.name || !deptForm.code) return;
    setDeptLoading(true);
    try {
      await academicService.createDepartment(deptForm);
      toast.success('Department created');
      setDeptForm({ name: '', code: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create department');
    } finally {
      setDeptLoading(false);
    }
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.name || !courseForm.code || !courseForm.department) return;
    setCourseLoading(true);
    try {
      await academicService.createCourse(courseForm);
      toast.success('Course created');
      setCourseForm({ name: '', code: '', department: '', totalSemesters: 6 });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create course');
    } finally {
      setCourseLoading(false);
    }
  };

  const handleAddSemester = async (e) => {
    e.preventDefault();
    if (!semForm.department || !semForm.course || !semForm.academicYear) return;
    setSemLoading(true);
    try {
      await academicService.createSemester({
        ...semForm,
        semesterNumber: Number(semForm.semesterNumber),
      });
      toast.success('Semester created');
      setSemForm({ semesterNumber: 1, academicYear: '2023-2024', department: '', course: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create semester');
    } finally {
      setSemLoading(false);
    }
  };

  const handleAddDivision = async (e) => {
    e.preventDefault();
    if (!divForm.name || !divForm.department || !divForm.course || !divForm.academicYear) return;
    setDivLoading(true);
    try {
      await academicService.createDivision({
        ...divForm,
        semester: Number(divForm.semester),
      });
      toast.success('Division created');
      setDivForm({ name: 'A', semester: 1, academicYear: '2023-2024', department: '', course: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create division');
    } finally {
      setDivLoading(false);
    }
  };

  if (loading) {
    return (
      <FacultyLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </FacultyLayout>
    );
  }

  return (
    <FacultyLayout>
      <div className="px-8 py-8 max-w-5xl">
        <div className="mb-6">
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            {INSTITUTION.name}
          </div>
          <h1 className="text-2xl font-bold text-white">Academic Structure</h1>
          <p className="text-slate-400 text-sm mt-1">Manage departments, courses, semesters, and divisions</p>
        </div>

        {/* Departments */}
        <SectionCard title="Departments" count={departments.length}>
          <div className="divide-y divide-slate-800">
            {departments.length === 0 ? (
              <p className="px-5 py-4 text-slate-500 text-sm">No departments yet.</p>
            ) : (
              departments.map(d => (
                <div key={d._id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{d.code}</span>
                  <span className="text-sm text-white">{d.name}</span>
                  <span className={`ml-auto text-xs ${d.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {d.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))
            )}
          </div>
          {isAdmin && (
            <form onSubmit={handleAddDept} className="px-5 py-4 border-t border-slate-800 bg-slate-800/30">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Department Name</label>
                  <input value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Computer Engineering"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="w-28">
                  <label className="text-xs text-slate-400 mb-1 block">Code</label>
                  <input value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="CE"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 uppercase" />
                </div>
                <button type="submit" disabled={deptLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                  Add
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        {/* Courses */}
        <SectionCard title="Courses" count={courses.length}>
          <div className="divide-y divide-slate-800">
            {courses.length === 0 ? (
              <p className="px-5 py-4 text-slate-500 text-sm">No courses yet.</p>
            ) : (
              courses.map(c => (
                <div key={c._id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-mono text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{c.code}</span>
                  <span className="text-sm text-white">{c.name}</span>
                  <span className="text-xs text-slate-500 ml-2">{c.department?.name}</span>
                  <span className="ml-auto text-xs text-slate-500">{c.totalSemesters} sems</span>
                </div>
              ))
            )}
          </div>
          {isAdmin && (
            <form onSubmit={handleAddCourse} className="px-5 py-4 border-t border-slate-800 bg-slate-800/30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 mb-1 block">Course Name</label>
                  <input value={courseForm.name} onChange={e => setCourseForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Diploma in Computer Engineering"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Code</label>
                  <input value={courseForm.code} onChange={e => setCourseForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="DCE"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 uppercase" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Department</label>
                  <select value={courseForm.department} onChange={e => setCourseForm(p => ({ ...p, department: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={courseLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors col-span-2 md:col-span-1">
                  Add Course
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        {/* Semesters */}
        <SectionCard title="Semesters" count={semesters.length}>
          <div className="divide-y divide-slate-800">
            {semesters.length === 0 ? (
              <p className="px-5 py-4 text-slate-500 text-sm">No semesters configured yet.</p>
            ) : (
              semesters.map(s => (
                <div key={s._id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-semibold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Semester {s.semesterNumber}
                  </span>
                  <span className="text-sm text-white">{s.course?.name || '—'}</span>
                  <span className="text-xs text-slate-400">({s.department?.name})</span>
                  <span className="ml-auto text-xs text-slate-500">{s.academicYear}</span>
                </div>
              ))
            )}
          </div>
          {isAdmin && (
            <form onSubmit={handleAddSemester} className="px-5 py-4 border-t border-slate-800 bg-slate-800/30">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Semester No.</label>
                  <select value={semForm.semesterNumber} onChange={e => setSemForm(p => ({ ...p, semesterNumber: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Sem {n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Academic Year</label>
                  <input value={semForm.academicYear} onChange={e => setSemForm(p => ({ ...p, academicYear: e.target.value }))}
                    placeholder="2023-2024"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Department</label>
                  <select value={semForm.department} onChange={e => setSemForm(p => ({ ...p, department: e.target.value, course: '' }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Course</label>
                  <select value={semForm.course} onChange={e => setSemForm(p => ({ ...p, course: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                    disabled={!semForm.department}>
                    <option value="">Select</option>
                    {courses.filter(c => !semForm.department || c.department?._id === semForm.department || c.department === semForm.department).map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={semLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                  Add Semester
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        {/* Divisions */}
        <SectionCard title="Divisions" count={divisions.length}>
          <div className="divide-y divide-slate-800">
            {divisions.length === 0 ? (
              <p className="px-5 py-4 text-slate-500 text-sm">No divisions configured yet.</p>
            ) : (
              divisions.map(d => (
                <div key={d._id} className="px-5 py-3 flex items-center gap-3">
                  <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    Division {d.name}
                  </span>
                  <span className="text-sm text-white">Sem {d.semester} — {d.course?.name || '—'}</span>
                  <span className="ml-auto text-xs text-slate-500">{d.academicYear}</span>
                </div>
              ))
            )}
          </div>
          {isAdmin && (
            <form onSubmit={handleAddDivision} className="px-5 py-4 border-t border-slate-800 bg-slate-800/30">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Division Name</label>
                  <input value={divForm.name} onChange={e => setDivForm(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                    placeholder="A"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 uppercase" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Semester No.</label>
                  <select value={divForm.semester} onChange={e => setDivForm(p => ({ ...p, semester: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Sem {n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Academic Year</label>
                  <input value={divForm.academicYear} onChange={e => setDivForm(p => ({ ...p, academicYear: e.target.value }))}
                    placeholder="2023-2024"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Department</label>
                  <select value={divForm.department} onChange={e => setDivForm(p => ({ ...p, department: e.target.value, course: '' }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Select</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Course</label>
                  <select value={divForm.course} onChange={e => setDivForm(p => ({ ...p, course: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                    disabled={!divForm.department}>
                    <option value="">Select</option>
                    {courses.filter(c => !divForm.department || c.department?._id === divForm.department || c.department === divForm.department).map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={divLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                  Add Division
                </button>
              </div>
            </form>
          )}
        </SectionCard>
      </div>
    </FacultyLayout>
  );
};

export default AcademicStructurePage;
