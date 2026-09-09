import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, User, Mail, Phone, Lock, BookOpen, Building2, CheckCircle2, Shield } from 'lucide-react';
import FacultyLayout from './FacultyLayout';
import { facultyService, academicService } from '../../services/managementService';
import { ACADEMIC_CONFIG } from '../../config/academic';

const inputClass = (err) =>
  `w-full px-3.5 py-2.5 rounded-lg bg-slate-800/80 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all ${
    err ? 'border-red-500/80' : 'border-slate-700/80 hover:border-slate-600 focus:border-blue-500'
  }`;

const FormField = ({ label, error, helper, children }) => (
  <div>
    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
      {label}
    </label>
    {children}
    {error ? (
      <p className="mt-1 text-xs text-red-400 font-medium">{error}</p>
    ) : helper ? (
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    ) : null}
  </div>
);

const FacultyFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    department: '',
    designation: ACADEMIC_CONFIG.FACULTY_DESIGNATIONS[2], // Normal Faculty default
    status: 'active',
  });
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        // Load departments & subjects
        const [deptsRes, subsRes] = await Promise.all([
          academicService.getDepartments().catch(() => ({ data: [] })),
          academicService.getSubjects({ semester: 5 }).catch(() => ({ data: [] })),
        ]);

        const depts = deptsRes.data || [];
        setDepartments(depts);

        const subs = subsRes.data && subsRes.data.length > 0
          ? subsRes.data
          : ACADEMIC_CONFIG.SUBJECTS.map((s, idx) => ({
              _id: `fallback_${s.code}`,
              subjectCode: s.code,
              subjectName: s.name,
              courseCode: s.courseCode,
              semester: 5,
            }));
        setAvailableSubjects(subs);

        if (isEdit) {
          const facultyRes = await facultyService.getFacultyById(id);
          const f = facultyRes.data;
          setForm({
            fullName: f.fullName || '',
            email: f.email || '',
            phone: f.phone || '',
            password: '',
            department: f.department?._id || (depts[0]?._id || ''),
            designation: f.designation || ACADEMIC_CONFIG.FACULTY_DESIGNATIONS[2],
            status: f.status || 'active',
          });
          const assignedIds = (f.subjects || []).map((s) => (typeof s === 'object' ? s._id : s));
          setSelectedSubjects(assignedIds);
        } else {
          if (depts.length > 0) {
            setForm((prev) => ({ ...prev, department: depts[0]._id }));
          }
        }
      } catch (err) {
        console.error('Error initializing form:', err);
        toast.error('Failed to load initial data');
      } finally {
        setFetching(false);
      }
    };

    initData();
  }, [id, isEdit]);

  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required';
    if (!form.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errs.email = 'Invalid email address';
    }
    if (!isEdit && !form.password) {
      errs.password = 'Initial password is required for new faculty';
    } else if (!isEdit && form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters long';
    }
    if (!form.designation) {
      errs.designation = 'Designation is required';
    } else if (!ACADEMIC_CONFIG.FACULTY_DESIGNATIONS.includes(form.designation)) {
      errs.designation = 'Invalid designation selected';
    }
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const toggleSubject = (subjectId) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setLoading(true);
    try {
      // Filter out fallback IDs if any
      const validSubjectIds = selectedSubjects.filter((sid) => !sid.startsWith('fallback_'));

      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        designation: form.designation,
        status: form.status,
        department: form.department || (departments.length > 0 ? departments[0]._id : undefined),
        subjects: validSubjectIds,
      };

      if (!isEdit && form.password) {
        payload.password = form.password;
      }

      if (isEdit) {
        await facultyService.updateFaculty(id, payload);
        // Also ensure subject assignment is updated
        await facultyService.assignSubjects(id, validSubjectIds);
        toast.success('Faculty details and subject assignments updated successfully');
      } else {
        const res = await facultyService.createFaculty(payload);
        const newFacultyId = res.data?._id;
        if (newFacultyId && validSubjectIds.length > 0) {
          // Double verify assignment
          await facultyService.assignSubjects(newFacultyId, validSubjectIds).catch(() => {});
        }
        toast.success('Faculty member added successfully');
      }
      navigate('/faculty/faculty');
    } catch (err) {
      console.error('Save faculty error:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        'Operation failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <FacultyLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </FacultyLayout>
    );
  }

  return (
    <FacultyLayout>
      <div className="max-w-3xl p-4 sm:p-6 md:p-8 mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/faculty/faculty')}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Faculty Directory
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {isEdit ? 'Edit Faculty Member' : 'Add New Faculty Member'}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {ACADEMIC_CONFIG.DEPARTMENT.name} • {ACADEMIC_CONFIG.SEMESTER.displayName}
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> MSBTE Faculty Scheme
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <User className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
                Faculty Profile Information
              </h2>
            </div>

            <FormField label="Full Name *" error={errors.fullName}>
              <div className="relative">
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="e.g. Prof. R. K. Sharma"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass(errors.fullName)}
                />
              </div>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Email Address *" error={errors.email}>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="sharma@facultyhub.edu"
                    value={form.email}
                    onChange={handleChange}
                    className={inputClass(errors.email)}
                  />
                </div>
              </FormField>

              <FormField label="Phone Number" error={errors.phone}>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass(errors.phone)}
                />
              </FormField>
            </div>

            {!isEdit && (
              <FormField
                label="Account Password *"
                error={errors.password}
                helper="Initial password for the faculty member to log in. Must be at least 6 characters."
              >
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter password (e.g. Faculty@123)"
                    value={form.password}
                    onChange={handleChange}
                    className={inputClass(errors.password)}
                  />
                </div>
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Designation *"
                error={errors.designation}
                helper="Select official academic designation"
              >
                <select
                  id="designation"
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  className={inputClass(errors.designation)}
                >
                  {ACADEMIC_CONFIG.FACULTY_DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Account Status">
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={inputClass()}
                >
                  <option value="active">Active (Access Enabled)</option>
                  <option value="inactive">Inactive (Access Suspended)</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Department
                </label>
                <div className="px-3.5 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-300 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{ACADEMIC_CONFIG.DEPARTMENT.name} ({ACADEMIC_CONFIG.DEPARTMENT.code})</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Current Semester
                </label>
                <div className="px-3.5 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50 text-slate-300 text-sm">
                  <span>{ACADEMIC_CONFIG.SEMESTER.displayName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Subject Assignment */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
                  Assign Subjects ({selectedSubjects.length} selected)
                </h2>
              </div>
              <span className="text-xs text-slate-400">5th Semester Computer Engineering</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Faculty members only have access to marks, attendance, and student evaluations for
              their assigned subjects. Check all subjects this faculty member will teach.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {availableSubjects.map((sub) => {
                const isSelected = selectedSubjects.includes(sub._id);
                return (
                  <label
                    key={sub._id}
                    onClick={() => toggleSubject(sub._id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/30'
                        : 'bg-slate-800/40 border-slate-700/70 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by container
                      className="mt-0.5 rounded bg-slate-800 border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white tracking-wide">
                          {sub.subjectCode}
                        </span>
                        {sub.courseCode && (
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {sub.courseCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 truncate mt-0.5">{sub.subjectName}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/faculty/faculty')}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-faculty-submit-btn"
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEdit ? 'Save Changes' : 'Create Faculty Member'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </FacultyLayout>
  );
};

export default FacultyFormPage;
