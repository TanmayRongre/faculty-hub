import React, { useState, useEffect } from 'react';
import { Upload, Search, FolderOpen, Download, Pencil, Archive, ArchiveRestore, Trash2, FileText, FileSpreadsheet, FileImage, FileArchive, Presentation, File, Folder, X } from 'lucide-react';
import toast from 'react-hot-toast';
import FacultyLayout from './FacultyLayout';
import { academicService } from '../../services/managementService';
import {
  getResources,
  uploadResource,
  updateResource,
  archiveResource,
  deleteResource,
  downloadResource,
} from '../../services/resourceService';
import { INSTITUTION } from '../../config/institution';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
  'All Categories',
  'Notes',
  'Syllabus',
  'Lab Manual',
  'Reference PDF',
  'Question Paper',
  'Practical Material',
  'Other',
];

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileIconComponent(fileType = '') {
  const ext = fileType.toLowerCase();
  if (ext.includes('pdf')) return FileText;
  if (ext.includes('doc')) return FileText;
  if (ext.includes('ppt')) return Presentation;
  if (ext.includes('xls') || ext.includes('sheet')) return FileSpreadsheet;
  if (ext.includes('png') || ext.includes('jpg') || ext.includes('jpeg')) return FileImage;
  if (ext.includes('zip')) return FileArchive;
  return File;
}

const FacultyResourcesPage = () => {
  const { user } = useAuth();

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [subjectCode, setSubjectCode] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [myOnly, setMyOnly] = useState(false);

  // Data states
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    category: 'Notes',
    subject: '',
    division: 'ALL',
    academicYear: '2026-2027',
    visibility: 'semester',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Edit Modal State
  const [editingResource, setEditingResource] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'Notes',
    division: 'ALL',
  });
  const [updating, setUpdating] = useState(false);

  // Load Subjects for metadata
  useEffect(() => {
    academicService.getSubjects({ limit: 100 }).then(res => {
      setSubjects(res.data || []);
    }).catch(() => {});
  }, []);

  // Fetch Resources
  const fetchResources = (page = 1) => {
    setLoading(true);
    const params = {
      page,
      limit: 12,
      status: statusFilter,
    };
    if (search.trim()) params.search = search.trim();
    if (category !== 'All Categories') params.category = category;
    if (subjectCode) params.subjectCode = subjectCode;
    if (myOnly) params.myResources = 'true';

    getResources(params)
      .then(res => {
        setResources(res.data || []);
        setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
      })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to fetch resources');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResources(1);
  }, [category, subjectCode, statusFilter, myOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchResources(1);
  };

  // Upload Handler
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadData.title.trim()) return toast.error('Please enter a resource title');
    if (!uploadData.subject) return toast.error('Please select a subject');
    if (!selectedFile) return toast.error('Please select a file to upload');

    const formData = new FormData();
    formData.append('title', uploadData.title.trim());
    formData.append('description', uploadData.description.trim());
    formData.append('category', uploadData.category);
    formData.append('subject', uploadData.subject);
    formData.append('division', uploadData.division);
    formData.append('academicYear', uploadData.academicYear);
    formData.append('visibility', uploadData.visibility);
    formData.append('file', selectedFile);

    setUploading(true);
    setUploadProgress(0);

    try {
      await uploadResource(formData, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
        setUploadProgress(percent);
      });

      toast.success('Resource uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadData({
        title: '',
        description: '',
        category: 'Notes',
        subject: '',
        division: 'ALL',
        academicYear: '2026-2027',
        visibility: 'semester',
      });
      fetchResources(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Edit Handler
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingResource) return;

    setUpdating(true);
    try {
      await updateResource(editingResource._id, editForm);
      toast.success('Resource updated successfully');
      setEditingResource(null);
      fetchResources(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update resource');
    } finally {
      setUpdating(false);
    }
  };

  // Archive / Restore Handler
  const handleArchiveToggle = async (resource) => {
    const actionText = resource.status === 'active' ? 'archive' : 'restore';
    if (!window.confirm(`Are you sure you want to ${actionText} "${resource.title}"?`)) return;

    try {
      await archiveResource(resource._id);
      toast.success(`Resource ${actionText}d successfully`);
      fetchResources(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${actionText} resource`);
    }
  };

  // Delete Handler
  const handleDelete = async (resource) => {
    if (!window.confirm(`Permanently delete "${resource.title}" and its physical file? This cannot be undone.`)) return;

    try {
      await deleteResource(resource._id);
      toast.success('Resource deleted permanently');
      fetchResources(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete resource');
    }
  };

  // Download Handler
  const handleDownload = async (resource) => {
    try {
      toast.loading('Downloading file...', { id: 'download' });
      await downloadResource(resource._id, resource.fileName);
      toast.success('Download complete', { id: 'download' });
    } catch (err) {
      toast.error('Download failed. File may be unavailable.', { id: 'download' });
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
            <h1 className="text-2xl font-bold text-white">Academic Resources & Notes Repository</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Upload, organize, and manage syllabus notes, lab manuals, reference materials, and question papers.
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Upload size={15} aria-hidden="true" /> Upload Resource
          </button>
        </div>

        {/* Filters & Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by title, description, or subject code..."
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

            {/* Status Filter */}
            <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 text-xs font-semibold rounded ${
                  statusFilter === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('archived')}
                className={`px-3 py-1 text-xs font-semibold rounded ${
                  statusFilter === 'archived' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Archived
              </button>
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

            {/* Subject Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Subject:</span>
              <select
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none max-w-[200px]"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s._id} value={s.subjectCode}>
                    {s.subjectCode} — {s.subjectName}
                  </option>
                ))}
              </select>
            </div>

            {/* My Uploads Toggle */}
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={myOnly}
                onChange={(e) => setMyOnly(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
              />
              <span>My Uploads Only</span>
            </label>
          </div>
        </div>

        {/* Resources Grid */}
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <div className="text-slate-400 text-sm">Loading resources...</div>
          </div>
        ) : resources.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <FolderOpen size={24} className="text-slate-500" aria-hidden="true" />
            </div>
            <div className="text-lg font-semibold text-white">No Resources Found</div>
            <p className="text-slate-400 text-sm mt-1 mb-4">
              {search || category !== 'All Categories' || subjectCode
                ? 'Try adjusting your search filters.'
                : 'Upload your first lecture note, syllabus, or lab manual.'}
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg"
            >
              Upload Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((res) => {
              const isOwner = user?.role === 'admin' || String(res.uploadedBy?._id || res.uploadedBy) === String(user?.id);
              return (
                <div
                  key={res._id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between group"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400">
                        {(() => { const FileIcon = getFileIconComponent(res.fileType); return <FileIcon size={20} aria-hidden="true" />; })()}
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-950/80 text-blue-400 border border-blue-800/40">
                        {res.category}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white leading-snug group-hover:text-blue-400 transition-colors line-clamp-1">
                        {res.title}
                      </h3>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">
                        {res.subjectCode} • Sem {res.semester} {res.division !== 'ALL' && `(Div ${res.division})`}
                      </div>
                    </div>

                    {res.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {res.description}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                      <span className="flex items-center gap-1"><Folder size={11} aria-hidden="true" /> {res.fileName}</span>
                      <span className="font-mono">{formatBytes(res.fileSize)}</span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Uploaded by <strong className="text-slate-400">{res.uploaderName || res.uploadedBy?.name || 'Faculty'}</strong> on {new Date(res.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="bg-slate-800/40 px-4 py-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleDownload(res)}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Download size={13} aria-hidden="true" /> Download
                    </button>

                    {isOwner && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingResource(res);
                            setEditForm({
                              title: res.title,
                              description: res.description || '',
                              category: res.category,
                              division: res.division || 'ALL',
                            });
                          }}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                          title="Edit Metadata"
                        >
                          <Pencil size={13} aria-hidden="true" /> Edit
                        </button>
                        <button
                          onClick={() => handleArchiveToggle(res)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-700/50 rounded transition-colors"
                          title={res.status === 'active' ? 'Archive' : 'Restore'}
                        >
                          {res.status === 'active' ? <Archive size={13} aria-hidden="true" /> : <ArchiveRestore size={13} aria-hidden="true" />}
                        </button>
                        <button
                          onClick={() => handleDelete(res)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded transition-colors"
                          title="Delete Permanently"
                        >
                          <Trash2 size={13} aria-hidden="true" />
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
              onClick={() => fetchResources(pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="text-xs text-slate-400 px-2 font-mono">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchResources(pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}

        {/* ─── MODAL: UPLOAD RESOURCE ────────────────────────────────────────── */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Upload Academic Resource</h3>
                <button onClick={() => !uploading && setShowUploadModal(false)} className="text-slate-400 hover:text-white" aria-label="Close"><X size={18} aria-hidden="true" /></button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Resource Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Chapter 3: Process Synchronization Notes"
                    value={uploadData.title}
                    onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Category *</label>
                    <select
                      value={uploadData.category}
                      onChange={(e) => setUploadData({ ...uploadData, category: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {CATEGORIES.filter(c => c !== 'All Categories').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Subject *</label>
                    <select
                      value={uploadData.subject}
                      onChange={(e) => setUploadData({ ...uploadData, subject: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      required
                    >
                      <option value="">Select subject</option>
                      {subjects.map(s => (
                        <option key={s._id} value={s._id}>
                          {s.subjectCode} — {s.subjectName} (Sem {s.semester})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Summary of topics covered, reference textbooks, etc."
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Division Filter</label>
                    <select
                      value={uploadData.division}
                      onChange={(e) => setUploadData({ ...uploadData, division: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      <option value="ALL">All Divisions (Entire Semester)</option>
                      <option value="A">Division A</option>
                      <option value="B">Division B</option>
                      <option value="C">Division C</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Academic Year</label>
                    <input
                      type="text"
                      value={uploadData.academicYear}
                      onChange={(e) => setUploadData({ ...uploadData, academicYear: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* File input */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">File to Upload * (Max 25MB)</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                    required
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    Allowed formats: PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, ZIP
                  </div>
                </div>

                {/* Progress bar */}
                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow flex items-center gap-2"
                  >
                    {uploading ? 'Uploading File...' : 'Upload Resource'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: EDIT RESOURCE ──────────────────────────────────────────── */}
        {editingResource && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Edit Resource Metadata</h3>
                <button onClick={() => !updating && setEditingResource(null)} className="text-slate-400 hover:text-white" aria-label="Close"><X size={18} aria-hidden="true" /></button>
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

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category *</label>
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
                  <label className="block text-xs text-slate-400 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Division</label>
                  <select
                    value={editForm.division}
                    onChange={(e) => setEditForm({ ...editForm, division: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="ALL">All Divisions</option>
                    <option value="A">Division A</option>
                    <option value="B">Division B</option>
                    <option value="C">Division C</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => setEditingResource(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow"
                  >
                    {updating ? 'Saving Changes...' : 'Save Changes'}
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

export default FacultyResourcesPage;
