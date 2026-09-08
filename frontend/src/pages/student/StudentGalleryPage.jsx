import React, { useState, useEffect } from 'react';
import { Images, Camera, ClipboardList, Search, Trophy, CalendarDays, MapPin, ImageOff, ClipboardEdit, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { academicService } from '../../services/managementService';
import {
  getApprovedGallery,
  getMySubmissions,
  createSubmission,
  deleteSubmission,
} from '../../services/galleryService';

const CATEGORIES = [
  'All Categories',
  'Sports',
  'Cultural',
  'Technical',
  'Workshop',
  'Seminar',
  'Competition',
  'Club Activity',
  'Social Activity',
  'Other',
];

const StudentGalleryPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active View Tab: 'gallery' | 'submit' | 'my'
  const [activeTab, setActiveTab] = useState('gallery');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [department, setDepartment] = useState('');
  const [sort, setSort] = useState('newest');

  // Data state
  const [galleryItems, setGalleryItems] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Submission Form State
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Technical',
    eventName: '',
    eventDate: '',
    location: '',
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  // Detail Modal / Lightbox
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Load Metadata
  useEffect(() => {
    academicService.getDepartments().then(res => setDepartments(res.data || [])).catch(() => {});
  }, []);

  // Fetch Public Approved Gallery
  const fetchApproved = (page = 1) => {
    setLoading(true);
    const params = { page, limit: 12, sort };
    if (search.trim()) params.search = search.trim();
    if (category !== 'All Categories') params.category = category;
    if (department) params.department = department;

    getApprovedGallery(params)
      .then(res => {
        setGalleryItems(res.data || []);
        setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to load gallery');
      })
      .finally(() => setLoading(false));
  };

  // Fetch Student's Own Submissions
  const fetchMySubmissions = (page = 1) => {
    setLoading(true);
    getMySubmissions({ page, limit: 20 })
      .then(res => {
        setMySubmissions(res.data || []);
      })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to load submissions');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'gallery') {
      fetchApproved(1);
    } else if (activeTab === 'my') {
      fetchMySubmissions(1);
    }
  }, [activeTab, category, department, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchApproved(1);
  };

  // File Picker Handler
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 10) {
      return toast.error('You can upload a maximum of 10 photos per activity');
    }

    setSelectedFiles(files);
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  // Activity Submission Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Activity title is required');
    if (!form.description.trim()) return toast.error('Activity description is required');
    if (!form.eventDate) return toast.error('Event date is required');
    if (selectedFiles.length === 0) return toast.error('Please upload at least one photo');

    const formData = new FormData();
    formData.append('title', form.title.trim());
    formData.append('description', form.description.trim());
    formData.append('category', form.category);
    if (form.eventName) formData.append('eventName', form.eventName.trim());
    formData.append('eventDate', form.eventDate);
    if (form.location) formData.append('location', form.location.trim());

    selectedFiles.forEach((file) => {
      formData.append('images', file);
    });

    setSubmitting(true);
    try {
      await createSubmission(formData);
      toast.success('Activity submitted! It will appear in the gallery after faculty review.');
      setForm({
        title: '',
        description: '',
        category: 'Technical',
        eventName: '',
        eventDate: '',
        location: '',
      });
      setSelectedFiles([]);
      setPreviewUrls([]);
      setActiveTab('my');
      fetchMySubmissions(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit activity');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Own Submission
  const handleDeleteOwn = async (item) => {
    if (!window.confirm(`Delete your submission "${item.title}"?`)) return;
    try {
      await deleteSubmission(item._id);
      toast.success('Submission deleted');
      fetchMySubmissions(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete submission');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student/dashboard')}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <span className="text-slate-700">|</span>
            <span className="text-white font-semibold text-sm">Extracurricular Showcase</span>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header with Institution Branding */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Student Extracurricular Activity Gallery</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Showcase technical achievements, sports victories, cultural celebrations, hackathons, and workshops.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap sm:flex-nowrap gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'gallery'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Images size={14} className="mr-1.5" aria-hidden="true" /> Campus Showcase
            </button>
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'submit'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Camera size={14} className="mr-1.5" aria-hidden="true" /> Submit Activity
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'my'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ClipboardList size={14} className="mr-1.5" aria-hidden="true" /> My Submissions
            </button>
          </div>
        </div>

        {/* ─── TAB 1: APPROVED CAMPUS SHOWCASE ─────────────────────────────── */}
        {activeTab === 'gallery' && (
          <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search activities, competitions, workshops, tags..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-500" aria-hidden="true" />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow"
                  >
                    Search
                  </button>
                </form>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Gallery Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <Trophy size={24} className="text-slate-500" aria-hidden="true" />
                </div>
                <div className="text-lg font-semibold text-white">No Activities in Showcase</div>
                <p className="text-slate-400 text-sm mt-1 mb-4">
                  {search || category !== 'All Categories' || department
                    ? 'No activities match your current search filters.'
                    : 'Be the first to submit a photo and event story to the campus gallery!'}
                </p>
                <button
                  onClick={() => setActiveTab('submit')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg"
                >
                  Submit Activity Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {galleryItems.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => {
                      setSelectedActivity(item);
                      setActiveImageIndex(0);
                    }}
                    className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer group flex flex-col shadow-lg"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-slate-950 overflow-hidden">
                      {item.images && item.images.length > 0 ? (
                        <img
                          src={item.images[0].imageUrl || `/api/gallery/${item._id}/images/0`}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageOff size={28} className="text-slate-600" aria-hidden="true" />
                        </div>
                      )}

                      {/* Category Pill */}
                      <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900/90 text-emerald-400 backdrop-blur-md border border-slate-700">
                        {item.category}
                      </span>

                      {/* Photo count indicator */}
                      {item.images && item.images.length > 1 && (
                        <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-white backdrop-blur-sm flex items-center gap-1">
                          <Camera size={10} aria-hidden="true" /> {item.images.length} Photos
                        </span>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-slate-500 font-mono mb-1 flex items-center gap-1.5">
                          <CalendarDays size={11} aria-hidden="true" /> {new Date(item.eventDate).toLocaleDateString()} {item.location && <><span className="text-slate-600">•</span><MapPin size={11} aria-hidden="true" />{item.location}</>}
                        </div>
                        <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="text-slate-400 text-xs mt-2 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate">By <strong className="text-slate-300">{item.studentName}</strong></span>
                        <span className="text-emerald-400 font-semibold shrink-0">View Story →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Bar */}
            {pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchApproved(pagination.page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-xs text-slate-400 px-2 font-mono">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchApproved(pagination.page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: SUBMIT ACTIVITY FORM ─────────────────────────────────── */}
        {activeTab === 'submit' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-1">Submit Extracurricular Activity</h2>
            <p className="text-slate-400 text-xs mb-6">
              Share details of technical events, workshops, sports competitions, or cultural festivities. Submissions will be published once reviewed by department faculty.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Activity Title *</label>
                <input
                  type="text"
                  placeholder="e.g. 1st Prize in State-Level Diploma Project Competition"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {CATEGORIES.filter(c => c !== 'All Categories').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Event Date *</label>
                  <input
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Event / Competition Name</label>
                  <input
                    type="text"
                    placeholder="e.g. TechFest 2026 / MSBTE Sports Meet"
                    value={form.eventName}
                    onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Location / Venue</label>
                  <input
                    type="text"
                    placeholder="e.g. Main Auditorium / Sports Ground"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Activity Description & Narrative *</label>
                <textarea
                  rows={4}
                  placeholder="Describe your participation, achievements, project details, team members, and highlights..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Multi-Image File Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Upload Activity Photos * (1 to 10 Images, JPG/PNG/WEBP up to 10MB each)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />

                {/* Previews Grid */}
                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700">
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] px-1 rounded text-white font-mono">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('gallery')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
                >
                  {submitting ? 'Uploading Activity...' : 'Submit for Faculty Review'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── TAB 3: MY SUBMISSIONS & STATUS ──────────────────────────────── */}
        {activeTab === 'my' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">My Activity Submissions</h2>
              <button
                onClick={() => setActiveTab('submit')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
              >
                + New Submission
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : mySubmissions.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <ClipboardEdit size={24} className="text-slate-500" aria-hidden="true" />
                </div>
                <div className="text-lg font-semibold text-white">No Submissions Yet</div>
                <p className="text-slate-400 text-sm mt-1 mb-4">
                  You haven't submitted any extracurricular activity photos yet.
                </p>
                <button
                  onClick={() => setActiveTab('submit')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg"
                >
                  Submit Activity Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {mySubmissions.map((item) => (
                  <div
                    key={item._id}
                    className={`bg-slate-900 border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      item.status === 'Approved'
                        ? 'border-emerald-800/40'
                        : item.status === 'Rejected'
                        ? 'border-red-800/40 bg-red-950/10'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* First image thumbnail */}
                      <div className="w-16 h-16 rounded-lg bg-slate-950 overflow-hidden shrink-0 border border-slate-800">
                        {item.images && item.images.length > 0 ? (
                          <img
                            src={item.images[0].imageUrl || `/api/gallery/${item._id}/images/0`}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff size={16} className="text-slate-600" aria-hidden="true" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              item.status === 'Approved'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : item.status === 'Rejected'
                                ? 'bg-red-950 text-red-400 border border-red-800/60'
                                : 'bg-amber-950 text-amber-400 border border-amber-800/60 animate-pulse'
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">• {item.category}</span>
                          <span className="text-xs text-slate-500">({item.images?.length || 0} images)</span>
                        </div>

                        <h3 className="font-bold text-white text-base">{item.title}</h3>
                        <p className="text-slate-400 text-xs line-clamp-1">{item.description}</p>

                        {item.status === 'Rejected' && item.rejectionReason && (
                          <div className="mt-2 text-xs bg-red-950/60 border border-red-800/80 text-red-300 p-2.5 rounded-lg flex items-start gap-2">
                            <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <div>
                              <strong>Rejection Feedback:</strong> {item.rejectionReason}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                      <button
                        onClick={() => {
                          setSelectedActivity(item);
                          setActiveImageIndex(0);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleDeleteOwn(item)}
                        className="px-3 py-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── MODAL / LIGHTBOX: ACTIVITY DETAILS ──────────────────────────── */}
        {selectedActivity && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {selectedActivity.category}
                  </span>
                  {selectedActivity.status !== 'Approved' && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        selectedActivity.status === 'Rejected' ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'
                      }`}
                    >
                      {selectedActivity.status}
                    </span>
                  )}
                </div>
                <button onClick={() => setSelectedActivity(null)} className="text-slate-400 hover:text-white" aria-label="Close"><X size={18} aria-hidden="true" /></button>
              </div>

              {/* Main Image Lightbox with Carousel Controls */}
              {selectedActivity.images && selectedActivity.images.length > 0 && (
                <div className="space-y-2">
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                    <img
                      src={selectedActivity.images[activeImageIndex]?.imageUrl || `/api/gallery/${selectedActivity._id}/images/${activeImageIndex}`}
                      alt={selectedActivity.title}
                      className="max-h-full max-w-full object-contain"
                    />

                    {selectedActivity.images.length > 1 && (
                      <>
                        <button
                          onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : selectedActivity.images.length - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-sm"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => setActiveImageIndex((prev) => (prev < selectedActivity.images.length - 1 ? prev + 1 : 0))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-sm"
                        >
                          ›
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 px-2.5 py-0.5 rounded-full text-[11px] text-slate-300 font-mono">
                          {activeImageIndex + 1} / {selectedActivity.images.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Thumbnail Selector Bar */}
                  {selectedActivity.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto py-1">
                      {selectedActivity.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                            activeImageIndex === idx ? 'border-emerald-500 scale-105' : 'border-slate-800 opacity-60'
                          }`}
                        >
                          <img
                            src={img.imageUrl || `/api/gallery/${selectedActivity._id}/images/${idx}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Title & Metadata */}
              <div>
                <h2 className="text-xl font-bold text-white">{selectedActivity.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1"><CalendarDays size={12} aria-hidden="true" /> Event Date: <strong>{new Date(selectedActivity.eventDate).toLocaleDateString()}</strong></span>
                  {selectedActivity.eventName && <span className="flex items-center gap-1">• <Trophy size={12} aria-hidden="true" /> <strong>{selectedActivity.eventName}</strong></span>}
                  {selectedActivity.location && <span className="flex items-center gap-1">• <MapPin size={12} aria-hidden="true" /> <strong>{selectedActivity.location}</strong></span>}
                </div>
              </div>

              {/* Narrative Content */}
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {selectedActivity.description}
              </div>

              {/* Contributor Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Submitted by <strong className="text-slate-200">{selectedActivity.studentName}</strong>
                  {selectedActivity.semester && ` (Semester ${selectedActivity.semester})`}
                </div>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentGalleryPage;
