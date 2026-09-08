import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { facultyService, academicService } from '../../services/managementService';
import { ACADEMIC_CONFIG } from '../../config/academic';

const inputClass = (err) =>
  `w-full px-3 py-2 rounded-lg bg-slate-800 border text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
    err ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
  }`;

const FormField = ({ label, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
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
    department: '',
    designation: ACADEMIC_CONFIG.FACULTY_DESIGNATIONS[2], // Normal Faculty default
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
    facultyService.getFacultyById(id)
      .then((data) => {
        const f = data.data;
        setForm({
          fullName: f.fullName || '',
          email: f.email || '',
          phone: f.phone || '',
          department: f.department?._id || '',
          designation: f.designation || ACADEMIC_CONFIG.FACULTY_DESIGNATIONS[2],
          status: f.status || 'active',
        });
      })
      .catch(() => toast.error('Failed to load faculty'))
      .finally(() => setFetching(false));
  }, [id, isEdit]);

  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required';
    if (!form.email) errs.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.designation) errs.designation = 'Designation is required';
    else if (!ACADEMIC_CONFIG.FACULTY_DESIGNATIONS.includes(form.designation)) {
      errs.designation = 'Invalid designation selected';
    }
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
      };

      if (isEdit) {
        await facultyService.updateFaculty(id, payload);
        toast.success('Faculty updated successfully');
        navigate('/faculty/faculty');
      } else {
        await facultyService.createFaculty(payload);
        toast.success('Faculty created successfully');
        navigate('/faculty/faculty');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Operation failed';
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
      <div className="max-w-2xl p-4 sm:p-6 md:p-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/faculty/faculty')}
            className="text-slate-400 hover:text-white text-sm transition-colors mb-2"
          >
            ← Back to Faculty Directory
          </button>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? 'Edit Faculty Member' : 'Add Faculty Member'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {ACADEMIC_CONFIG.DEPARTMENT.name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">Faculty Details</h2>

            <FormField label="Full Name *" error={errors.fullName}>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="e.g. Prof. Rajesh Patil"
                value={form.fullName}
                onChange={handleChange}
                className={inputClass(errors.fullName)}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Email Address *" error={errors.email}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="faculty@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass(errors.email)}
                />
              </FormField>

              <FormField label="Phone Number" error={errors.phone}>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass(errors.phone)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Designation *" error={errors.designation}>
                <select
                  id="designation"
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  className={inputClass(errors.designation)}
                >
                  {ACADEMIC_CONFIG.FACULTY_DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Status">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={inputClass()}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/faculty/faculty')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-faculty-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Faculty'}
            </button>
          </div>
        </form>
      </div>
    </FacultyLayout>
  );
};

export default FacultyFormPage;
