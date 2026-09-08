import React, { useState, useEffect } from 'react';
import { Megaphone, Search, Paperclip, SendHorizonal, Pencil, Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { academicService } from '../../services/managementService';
import {
  getNotices,
  createNotice,
  updateNotice,
  publishNotice,
  archiveNotice,
  deleteNotice,
  downloadAttachment,
} from '../../services/noticeService';
import { INSTITUTION } from '../../config/institution';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = ['All Categories', 'Academic', 'Examination', 'Department', 'General', 'Event', 'Urgent'];
const PRIORITIES = ['All Priorities', 'Normal', 'Important', 'Urgent'];
const STATUS_TABS = ['Published', 'Draft', 'Archived', 'Expired'];

const FacultyNoticesPage = () => {
  const { user } = useAuth();

  // Filter & Search
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('Published');
  const [category, setCategory] = useState('All Categories');
  const [priority, setPriority] = useState('All Priorities');
  const [myOnly, setMyOnly] = useState(false);

  // Data
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    content: '',
    category: 'General',
    priority: 'Normal',
    targetScope: 'all',
    department: '',
    course: '',
    semester: '',
    division: 'ALL',
    publishDate: '',
    expiryDate: '',
    status: 'Published',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [savingNotice, setSavingNotice] = useState(false);

  // Edit Modal
  const [editingNotice, setEditingNotice] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    category: 'General',
    priority: 'Normal',
    targetScope: 'all',
    division: 'ALL',
    expiryDate: '',
  });
  const [updatingNotice, setUpdatingNotice] = useState(false);

  // Load Metadata
  useEffect(() => {
    academicService.getDepartments().then(res => setDepartments(res.data || [])).catch(() => {});
    academicService.getCourses().then(res => setCourses(res.data || [])).catch(() => {});
  }, []);

  const fetchNotices = (page = 1) => {
    setLoading(true);
    const params = {
      page,
      limit: 12,
      status: statusTab,
    };
    if (search.trim()) params.search = search.trim();
    if (category !== 'All Categories') params.category = category;
    if (priority !== 'All Priorities') params.priority = priority;
    if (myOnly) params.myNotices = 'true';

    getNotices(params)
      .then(res => {
        setNotices(res.data || []);
        setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to fetch notices');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotices(1);
  }, [statusTab, category, priority, myOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchNotices(1);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) return toast.error('Notice title is required');
    if (!createForm.content.trim()) return toast.error('Notice content is required');

    const formData = new FormData();
    formData.append('title', createForm.title.trim());
    formData.append('content', createForm.content.trim());
    formData.append('category', createForm.category);
    formData.append('priority', createForm.priority);
    formData.append('targetScope', createForm.targetScope);
    if (createForm.department) formData.append('department', createForm.department);
    if (createForm.course) formData.append('course', createForm.course);
    if (createForm.semester) formData.append('semester', createForm.semester);
    formData.append('division', createForm.division);
    if (createForm.publishDate) formData.append('publishDate', createForm.publishDate);
    if (createForm.expiryDate) formData.append('expiryDate', createForm.expiryDate);
    formData.append('status', createForm.status);
    if (selectedFile) formData.append('file', selectedFile);

    setSavingNotice(true);
    try {
      await createNotice(formData);
      toast.success('Notice created successfully');
      setShowCreateModal(false);
      setSelectedFile(null);
      setCreateForm({
        title: '',
        content: '',
        category: 'General',
        priority: 'Normal',
        targetScope: 'all',
        department: '',
        course: '',
        semester: '',
        division: 'ALL',
        publishDate: '',
        expiryDate: '',
        status: 'Published',
      });
      fetchNotices(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create notice');
    } finally {
      setSavingNotice(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingNotice) return;

    const formData = new FormData();
    formData.append('title', editForm.title.trim());
    formData.append('content', editForm.content.trim());
    formData.append('category', editForm.category);
    formData.append('priority', editForm.priority);
    formData.append('targetScope', editForm.targetScope);
    formData.append('division', editForm.division);
    if (editForm.expiryDate) formData.append('expiryDate', editForm.expiryDate);
    if (selectedFile) formData.append('file', selectedFile);

    setUpdatingNotice(true);
    try {
      await updateNotice(editingNotice._id, formData);
      toast.success('Notice updated successfully');
      setEditingNotice(null);
      setSelectedFile(null);
      fetchNotices(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update notice');
    } finally {
      setUpdatingNotice(false);
    }
  };

  const handlePublishDraft = async (notice) => {
    try {
      await publishNotice(notice._id);
      toast.success('Notice published to student feed');
      fetchNotices(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish notice');
    }
  };

  const handleArchiveToggle = async (notice) => {
    const actionText = notice.status === 'Archived' ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${actionText} "${notice.title}"?`)) return;

    try {
      await archiveNotice(notice._id);
      toast.success(`Notice ${actionText}d successfully`);
      fetchNotices(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${actionText} notice`);
    }
  };

  const handleDelete = async (notice) => {
    if (!window.confirm(`Permanently delete "${notice.title}"? This cannot be undone.`)) return;

    try {
      await deleteNotice(notice._id);
      toast.success('Notice deleted permanently');
      fetchNotices(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete notice');
    }
  };

  const handleDownload = async (notice, attIndex, fileName) => {
    try {
      toast.loading('Downloading attachment...', { id: 'att-dl' });
      await downloadAttachment(notice._id, attIndex, fileName);
      toast.success('Download complete', { id: 'att-dl' });
    } catch {
      toast.error('Download failed', { id: 'att-dl' });
    }
  };

  return (
    <FacultyLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Digital Notice Board & Circulars</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Create, publish, and target academic notices, examination schedules, and urgent institutional circulars.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Megaphone size={15} aria-hidden="true" /> Create Notice
          </button>
        </div>

        {/* Status Tabs & Search Filter */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search notices by title or content keywords..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" aria-hidden="true" />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg"
              >
                Search
              </button>
            </form>

            {/* Status Tabs */}
            <div className="flex flex-wrap gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                    statusTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Category:</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Priority:</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* My Notices Toggle */}
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={myOnly}
                onChange={(e) => setMyOnly(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
              />
              <span>My Notices Only</span>
            </label>
          </div>
        </div>

        {/* Notices Feed */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <div className="text-slate-400 text-sm">Loading notices...</div>
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Megaphone size={24} className="text-slate-500" aria-hidden="true" />
            </div>
            <div className="text-lg font-semibold text-white">No Notices in "{statusTab}"</div>
            <p className="text-slate-400 text-sm mt-1 mb-4">
              {search || category !== 'All Categories' || priority !== 'All Priorities'
                ? 'Try adjusting your search criteria.'
                : 'Create and publish an institutional circular or department announcement.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg"
            >
              Create First Notice
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((n) => {
              const isOwner = user?.role === 'admin' || String(n.publishedBy?._id || n.publishedBy) === String(user?.id);
              return (
                <div
                  key={n._id}
                  className={`bg-slate-900 border rounded-xl p-5 hover:border-slate-700 transition-all ${
                    n.priority === 'Urgent'
                      ? 'border-red-800/60 shadow-lg shadow-red-950/20'
                      : n.priority === 'Important'
                      ? 'border-amber-800/50'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Priority pill */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            n.priority === 'Urgent'
                              ? 'bg-red-950/80 text-red-400 border border-red-800/60 animate-pulse'
                              : n.priority === 'Important'
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {n.priority}
                        </span>

                        {/* Category badge */}
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-950/80 text-blue-400 border border-blue-900/50">
                          {n.category}
                        </span>

                        {/* Target Scope pill */}
                        <span className="text-xs font-mono text-slate-400">
                          Scope: <strong className="text-slate-300 capitalize">{n.targetScope}</strong>
                          {n.semester && ` • Sem ${n.semester}`}
                          {n.division && n.division !== 'ALL' && ` (Div ${n.division})`}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white pt-1">{n.title}</h3>
                    </div>

                    {/* Meta timestamps & status badge */}
                    <div className="flex flex-row md:flex-col items-end gap-1 text-right text-xs">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          n.status === 'Published'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            : n.status === 'Draft'
                            ? 'bg-slate-800 text-slate-300'
                            : n.status === 'Archived'
                            ? 'bg-amber-950 text-amber-400'
                            : 'bg-red-950 text-red-400'
                        }`}
                      >
                        {n.status}
                      </span>
                      <span className="text-slate-500 text-[11px] mt-1">
                        Pub: {new Date(n.publishDate).toLocaleDateString()}
                        {n.expiryDate && ` | Exp: ${new Date(n.expiryDate).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>

                  {/* Content body */}
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line mb-4">
                    {n.content}
                  </p>

                  {/* Attachments list */}
                  {n.attachments && n.attachments.length > 0 && (
                    <div className="mb-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
                      {n.attachments.map((att, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleDownload(n, idx, att.fileName)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-2 border border-slate-700 transition-colors"
                        >
                          <Paperclip size={13} className="text-slate-400" aria-hidden="true" />
                          <span className="font-mono">{att.fileName}</span>
                          <span className="text-slate-500 text-[10px]">({(att.fileSize / 1024).toFixed(1)} KB)</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Footer & Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400">
                    <div>
                      Published by <strong className="text-slate-300">{n.authorName || 'Faculty'}</strong> ({n.authorRole || 'faculty'})
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-2 mt-2 md:mt-0">
                        {n.status === 'Draft' && (
                          <button
                            onClick={() => handlePublishDraft(n)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold transition-colors"
                          >
                            <SendHorizonal size={13} aria-hidden="true" /> Publish
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingNotice(n);
                            setEditForm({
                              title: n.title,
                              content: n.content,
                              category: n.category,
                              priority: n.priority,
                              targetScope: n.targetScope,
                              division: n.division || 'ALL',
                              expiryDate: n.expiryDate ? n.expiryDate.split('T')[0] : '',
                            });
                          }}
                          className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        >
                          <Pencil size={13} aria-hidden="true" /> Edit
                        </button>
                        <button
                          onClick={() => handleArchiveToggle(n)}
                          className="px-2.5 py-1 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          {n.status === 'Archived' ? <><ArchiveRestore size={13} aria-hidden="true" /> Restore</> : <><Archive size={13} aria-hidden="true" /> Archive</>}
                        </button>
                        <button
                          onClick={() => handleDelete(n)}
                          className="px-2.5 py-1 text-slate-300 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Trash2 size={13} aria-hidden="true" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchNotices(pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-slate-400 px-2 font-mono">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchNotices(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}

        {/* ─── MODAL: CREATE NOTICE ──────────────────────────────────────────── */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Create Campus Notice / Circular</h3>
                <button onClick={() => !savingNotice && setShowCreateModal(false)} className="text-slate-400 hover:text-white" aria-label="Close"><X size={18} aria-hidden="true" /></button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notice Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Schedule for MSBTE Winter 2026 Practical Examination"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Category *</label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {CATEGORIES.filter(c => c !== 'All Categories').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Priority Level *</label>
                    <select
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Important">Important</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Target Audience Scope */}
                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-300 font-semibold mb-1">Target Audience Scope</label>
                    <select
                      value={createForm.targetScope}
                      onChange={(e) => setCreateForm({ ...createForm, targetScope: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="all">Entire College (All Students)</option>
                      <option value="department">Specific Department</option>
                      <option value="course">Specific Course</option>
                      <option value="semester">Specific Semester</option>
                      <option value="division">Specific Division</option>
                    </select>
                  </div>

                  {createForm.targetScope !== 'all' && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Department</label>
                        <select
                          value={createForm.department}
                          onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="">Select Department</option>
                          {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                      </div>

                      {['course', 'semester', 'division'].includes(createForm.targetScope) && (
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Course</label>
                          <select
                            value={createForm.course}
                            onChange={(e) => setCreateForm({ ...createForm, course: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="">Select Course</option>
                            {courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}

                      {['semester', 'division'].includes(createForm.targetScope) && (
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Semester</label>
                          <select
                            value={createForm.semester}
                            onChange={(e) => setCreateForm({ ...createForm, semester: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="">Select Semester</option>
                            {[1, 2, 3, 4, 5, 6].map(s => <option key={s} value={s}>Semester {s}</option>)}
                          </select>
                        </div>
                      )}

                      {createForm.targetScope === 'division' && (
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Division</label>
                          <input
                            type="text"
                            value={createForm.division}
                            onChange={(e) => setCreateForm({ ...createForm, division: e.target.value.toUpperCase() })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            placeholder="e.g. A"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notice Content *</label>
                  <textarea
                    rows={4}
                    placeholder="Enter detailed notice content, instructions, timelines..."
                    value={createForm.content}
                    onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={createForm.expiryDate}
                      onChange={(e) => setCreateForm({ ...createForm, expiryDate: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Publication State</label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="Published">Publish Immediately</option>
                      <option value="Draft">Save as Draft</option>
                    </select>
                  </div>
                </div>

                {/* Optional Attachment */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Attachment (Optional PDF, DOCX, Image)</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={savingNotice}
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingNotice}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow"
                  >
                    {savingNotice ? 'Saving Notice...' : createForm.status === 'Draft' ? 'Save Draft' : 'Publish Notice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: EDIT NOTICE ────────────────────────────────────────────── */}
        {editingNotice && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Edit Notice</h3>
                <button onClick={() => !updatingNotice && setEditingNotice(null)} className="text-slate-400 hover:text-white" aria-label="Close"><X size={18} aria-hidden="true" /></button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Category</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {CATEGORIES.filter(c => c !== 'All Categories').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Priority</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Important">Important</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Content *</label>
                  <textarea
                    rows={4}
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={updatingNotice}
                    onClick={() => setEditingNotice(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingNotice}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow"
                  >
                    {updatingNotice ? 'Updating...' : 'Save Changes'}
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

export default FacultyNoticesPage;
