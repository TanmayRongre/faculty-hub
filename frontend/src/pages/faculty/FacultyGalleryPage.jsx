import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { INSTITUTION } from '../../config/institution';
import { academicService } from '../../services/managementService';
import {
  getModerationSubmissions,
  approveSubmission,
  rejectSubmission,
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

const FacultyGalleryPage = () => {
  // Tabs: 'Pending' | 'Approved' | 'Rejected' | 'all'
  const [statusTab, setStatusTab] = useState('Pending');
  const [category, setCategory] = useState('All Categories');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');

  // Data
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Detail Modal & Action states
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Reject Modal
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    academicService.getDepartments().then(res => setDepartments(res.data || [])).catch(() => {});
  }, []);

  const fetchSubmissions = (page = 1) => {
    setLoading(true);
    const params = { page, limit: 12, status: statusTab };
    if (search.trim()) params.search = search.trim();
    if (category !== 'All Categories') params.category = category;
    if (department) params.department = department;

    getModerationSubmissions(params)
      .then(res => {
        setSubmissions(res.data || []);
        setCounts(res.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
        setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to fetch moderation queue');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubmissions(1);
  }, [statusTab, category, department]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSubmissions(1);
  };

  // Approve Handler
  const handleApprove = async (item) => {
    setProcessingAction(true);
    try {
      await approveSubmission(item._id);
      toast.success(`"${item.title}" approved and published to public gallery`);
      if (selectedItem?._id === item._id) setSelectedItem(null);
      fetchSubmissions(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve submission');
    } finally {
      setProcessingAction(false);
    }
  };

  // Reject Handler
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      return toast.error('Please enter a constructive rejection reason');
    }

    setProcessingAction(true);
    try {
      await rejectSubmission(rejectingItem._id, rejectionReason.trim());
      toast.success(`"${rejectingItem.title}" marked as rejected`);
      setRejectingItem(null);
      setRejectionReason('');
      if (selectedItem?._id === rejectingItem._id) setSelectedItem(null);
      fetchSubmissions(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject submission');
    } finally {
      setProcessingAction(false);
    }
  };

  // Delete Handler
  const handleDelete = async (item) => {
    if (!window.confirm(`Permanently delete "${item.title}" and its uploaded image files?`)) return;

    try {
      await deleteSubmission(item._id);
      toast.success('Activity deleted permanently');
      if (selectedItem?._id === item._id) setSelectedItem(null);
      fetchSubmissions(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete activity');
    }
  };

  return (
    <FacultyLayout>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Extracurricular Activity Moderation</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Review, verify, and approve student activity photos, competitions, sports events, and technical achievements.
            </p>
          </div>
        </div>

        {/* Counter Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div
            onClick={() => setStatusTab('Pending')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusTab === 'Pending' ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-950/30' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-xs font-semibold text-amber-400 uppercase">⏳ Pending Review</div>
            <div className="text-2xl font-bold text-white mt-1">{counts.pending}</div>
          </div>

          <div
            onClick={() => setStatusTab('Approved')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusTab === 'Approved' ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/30' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-xs font-semibold text-emerald-400 uppercase">✓ Approved</div>
            <div className="text-2xl font-bold text-white mt-1">{counts.approved}</div>
          </div>

          <div
            onClick={() => setStatusTab('Rejected')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusTab === 'Rejected' ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/30' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-xs font-semibold text-red-400 uppercase">✕ Rejected</div>
            <div className="text-2xl font-bold text-white mt-1">{counts.rejected}</div>
          </div>

          <div
            onClick={() => setStatusTab('all')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusTab === 'all' ? 'bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-950/30' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-xs font-semibold text-blue-400 uppercase">📁 Total Entries</div>
            <div className="text-2xl font-bold text-white mt-1">{counts.total}</div>
          </div>
        </div>

        {/* Filter and Search */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search submissions by title, student name, keyword..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="absolute left-3 top-2.5 text-slate-500 text-sm">🔍</span>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg"
              >
                Search
              </button>
            </form>

            <div className="flex items-center gap-3">
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

        {/* Queue Grid */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <div className="text-slate-400 text-sm">Loading queue...</div>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-lg font-semibold text-white">No Submissions in "{statusTab}"</div>
            <p className="text-slate-400 text-sm mt-1">
              All student activity submissions in this category have been processed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {submissions.map((item) => (
              <div
                key={item._id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
              >
                <div>
                  {/* Thumbnail */}
                  <div
                    onClick={() => {
                      setSelectedItem(item);
                      setActiveImageIndex(0);
                    }}
                    className="relative aspect-video bg-black cursor-pointer overflow-hidden group"
                  >
                    {item.images && item.images.length > 0 ? (
                      <img
                        src={item.images[0].imageUrl || `/api/gallery/${item._id}/images/0`}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">🖼️</div>
                    )}
                    <span
                      className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.status === 'Approved'
                          ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-800'
                          : item.status === 'Rejected'
                          ? 'bg-red-950/90 text-red-400 border border-red-800'
                          : 'bg-amber-950/90 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-black/80 text-white">
                      📷 {item.images?.length || 0} Photos
                    </span>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span>{item.category}</span>
                      <span>📅 {new Date(item.eventDate).toLocaleDateString()}</span>
                    </div>

                    <h3
                      onClick={() => {
                        setSelectedItem(item);
                        setActiveImageIndex(0);
                      }}
                      className="font-bold text-white text-base hover:text-blue-400 cursor-pointer line-clamp-1"
                    >
                      {item.title}
                    </h3>

                    <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                      Submitted by: <strong className="text-slate-200">{item.studentName}</strong>
                      {item.semester && ` (Sem ${item.semester})`}
                    </div>

                    {item.status === 'Rejected' && item.rejectionReason && (
                      <div className="text-[11px] bg-red-950/50 border border-red-900/50 text-red-300 p-2 rounded">
                        <strong>Reason:</strong> {item.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Moderation Actions Bar */}
                <div className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-slate-800/60 mt-3 pt-3">
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setActiveImageIndex(0);
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold"
                  >
                    Inspect
                  </button>

                  <div className="flex items-center gap-1.5">
                    {item.status !== 'Approved' && (
                      <button
                        onClick={() => handleApprove(item)}
                        disabled={processingAction}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors"
                      >
                        ✓ Approve
                      </button>
                    )}

                    {item.status !== 'Rejected' && (
                      <button
                        onClick={() => {
                          setRejectingItem(item);
                          setRejectionReason('');
                        }}
                        disabled={processingAction}
                        className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded text-xs font-bold transition-colors"
                      >
                        ✕ Reject
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(item)}
                      className="px-2 py-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded text-xs"
                      title="Delete Entry"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── MODAL: INSPECT SUBMISSION DETAILS ───────────────────────────── */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-950 text-blue-400 border border-blue-900">
                    {selectedItem.category}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      selectedItem.status === 'Approved'
                        ? 'bg-emerald-950 text-emerald-400'
                        : selectedItem.status === 'Rejected'
                        ? 'bg-red-950 text-red-400'
                        : 'bg-amber-950 text-amber-400'
                    }`}
                  >
                    {selectedItem.status}
                  </span>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              {/* Carousel */}
              {selectedItem.images && selectedItem.images.length > 0 && (
                <div className="space-y-2">
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                    <img
                      src={selectedItem.images[activeImageIndex]?.imageUrl || `/api/gallery/${selectedItem._id}/images/${activeImageIndex}`}
                      alt={selectedItem.title}
                      className="max-h-full max-w-full object-contain"
                    />

                    {selectedItem.images.length > 1 && (
                      <>
                        <button
                          onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : selectedItem.images.length - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => setActiveImageIndex((prev) => (prev < selectedItem.images.length - 1 ? prev + 1 : 0))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center"
                        >
                          ›
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 px-2.5 py-0.5 rounded-full text-[11px] text-slate-300 font-mono">
                          {activeImageIndex + 1} / {selectedItem.images.length}
                        </div>
                      </>
                    )}
                  </div>

                  {selectedItem.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto py-1">
                      {selectedItem.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`w-16 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                            activeImageIndex === idx ? 'border-blue-500 scale-105' : 'border-slate-800 opacity-60'
                          }`}
                        >
                          <img
                            src={img.imageUrl || `/api/gallery/${selectedItem._id}/images/${idx}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold text-white">{selectedItem.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>📅 Event Date: <strong>{new Date(selectedItem.eventDate).toLocaleDateString()}</strong></span>
                  {selectedItem.eventName && <span>• 🏆 <strong>{selectedItem.eventName}</strong></span>}
                  {selectedItem.location && <span>• 📍 <strong>{selectedItem.location}</strong></span>}
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {selectedItem.description}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Submitted by: <strong className="text-slate-200">{selectedItem.studentName}</strong>
                </div>

                <div className="flex items-center gap-2">
                  {selectedItem.status !== 'Approved' && (
                    <button
                      onClick={() => handleApprove(selectedItem)}
                      disabled={processingAction}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                    >
                      ✓ Approve Submission
                    </button>
                  )}
                  {selectedItem.status !== 'Rejected' && (
                    <button
                      onClick={() => {
                        setRejectingItem(selectedItem);
                        setRejectionReason('');
                      }}
                      disabled={processingAction}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold"
                    >
                      ✕ Reject Submission
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: REJECT SUBMISSION WITH REASON ───────────────────────── */}
        {rejectingItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">Provide Rejection Feedback</h3>
                <button onClick={() => setRejectingItem(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Constructive Feedback for Student *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="e.g. Please provide a higher resolution image of the certificate or describe the event dates accurately..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRejectingItem(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processingAction}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold"
                  >
                    {processingAction ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </FacultyLayout>
  );
};

export default FacultyGalleryPage;
