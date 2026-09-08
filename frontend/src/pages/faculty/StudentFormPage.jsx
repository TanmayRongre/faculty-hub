import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { studentService, academicService } from '../../services/managementService';
import { ACADEMIC_CONFIG } from '../../config/academic';

const FormField = ({ label, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
  </div>
);

const inputClass = (err) =>
  `w-full px-3 py-2 rounded-lg bg-slate-800 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
    err ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
  }`;

const StudentFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    enrollmentNumber: '',
    rollNumber: '',
    fullName: '',
    email: '',
    phone: '',
    examSeatNumber: '',
    batch: '',
    department: '',
    semester: 5,
    academicYear: '2026-2027',
    status: 'active',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    academicService.getDepartments().then((d) => {
      const depts = d.data || [];
      setDepartments(depts);
      if (depts.length > 0 && !form.department) {
        setForm((prev) => ({ ...prev, department: depts[0]._id }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    studentService.getStudent(id)
      .then((data) => {
        const s = data.data;
        setForm({
          enrollmentNumber: s.enrollmentNumber || '',
          rollNumber: s.rollNumber || '',
          fullName: s.fullName || '',
          email: s.email || '',
          phone: s.phone || '',
          examSeatNumber: s.examSeatNumber || '',
          batch: s.batch || '',
          department: s.department?._id || '',
          semester: s.semester || 5,
          academicYear: s.academicYear || '2026-2027',
          status: s.status || 'active',
        });
      })
      .catch(() => toast.error('Failed to load student'))
      .finally(() => setFetching(false));
  }, [id, isEdit]);

  const validate = () => {
    const errs = {};
    if (!form.enrollmentNumber.trim()) errs.enrollmentNumber = 'Enrollment number is required';
    if (!form.rollNumber.trim()) errs.rollNumber = 'Roll number is required';
    if (!form.fullName.trim()) errs.fullName = 'Full name is required';
    // Email is optional for CE students
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Invalid email format';
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        department: form.department || (departments.length > 0 ? departments[0]._id : undefined),
        semester: 5,
      };

      if (isEdit) {
        await studentService.updateStudent(id, payload);
        toast.success('Student updated successfully');
      } else {
        await studentService.createStudent(payload);
        toast.success('Student created successfully');
      }
      navigate('/faculty/students');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Save failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
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
      <div className="max-w-3xl px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/faculty/students')}
            className="text-slate-400 hover:text-white text-sm transition-colors mb-2"
          >
            ← Back to Student Directory
          </button>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? 'Edit Student Record' : 'Add New Student'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {ACADEMIC_CONFIG.DEPARTMENT.name} • {ACADEMIC_CONFIG.SEMESTER.displayName}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">Personal Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Full Name *" error={errors.fullName}>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputClass(errors.fullName)}
                />
              </FormField>

              <FormField label="Roll Number *" error={errors.rollNumber}>
                <input
                  id="rollNumber"
                  name="rollNumber"
                  type="text"
                  placeholder="e.g. 01"
                  value={form.rollNumber}
                  onChange={handleChange}
                  className={inputClass(errors.rollNumber)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Enrollment Number *" error={errors.enrollmentNumber}>
                <input
                  id="enrollmentNumber"
                  name="enrollmentNumber"
                  type="text"
                  placeholder="e.g. 24410360142"
                  value={form.enrollmentNumber}
                  onChange={handleChange}
                  disabled={isEdit}
                  className={`${inputClass(errors.enrollmentNumber)} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </FormField>

              <FormField label="Exam Seat No. (optional)" error={errors.examSeatNumber}>
                <input
                  id="examSeatNumber"
                  name="examSeatNumber"
                  type="text"
                  placeholder="Leave blank — not yet provided"
                  value={form.examSeatNumber}
                  onChange={handleChange}
                  className={inputClass(errors.examSeatNumber)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Email Address (optional)" error={errors.email}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Optional — leave blank if not available"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass(errors.email)}
                />
              </FormField>

              <FormField label="Phone Number (optional)" error={errors.phone}>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  placeholder="Optional"
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass(errors.phone)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Practical Batch">
                <select
                  name="batch"
                  value={form.batch}
                  onChange={handleChange}
                  className={inputClass()}
                >
                  <option value="">Not assigned yet</option>
                  <option value="A">Batch A</option>
                  <option value="B">Batch B</option>
                  <option value="C">Batch C</option>
                </select>
              </FormField>

              <FormField label="Academic Status">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={inputClass()}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                </select>
              </FormField>
            </div>
          </div>

          {/* Academic Context (Fixed) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">Academic Scope</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <span className="text-slate-500 block mb-1">Department</span>
                <span className="font-bold text-white">{ACADEMIC_CONFIG.DEPARTMENT.name}</span>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <span className="text-slate-500 block mb-1">Semester</span>
                <span className="font-bold text-white">{ACADEMIC_CONFIG.SEMESTER.displayName}</span>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <span className="text-slate-500 block mb-1">Academic Year</span>
                <span className="font-bold text-white">{form.academicYear}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/faculty/students')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-student-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Student'}
            </button>
          </div>
        </form>
      </div>
    </FacultyLayout>
  );
};

export default StudentFormPage;
