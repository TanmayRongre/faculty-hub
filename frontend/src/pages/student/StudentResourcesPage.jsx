import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { getResources, downloadResource } from '../../services/resourceService';
import {
  Search,
  Library,
  Download,
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  Presentation,
  File,
  X,
} from 'lucide-react';

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

const StudentResourcesPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Search & Filter
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [sort, setSort] = useState('newest');

  // Data
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Details Modal
  const [selectedResource, setSelectedResource] = useState(null);

  const fetchResources = (page = 1) => {
    setLoading(true);
    const params = {
      page,
      limit: 12,
      sort,
    };
    if (search.trim()) params.search = search.trim();
    if (category !== 'All Categories') params.category = category;

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
  }, [category, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchResources(1);
  };

  const handleDownload = async (res) => {
    try {
      toast.loading(`Downloading ${res.fileName}...`, { id: 'download' });
      await downloadResource(res._id, res.fileName);
      toast.success('Download complete', { id: 'download' });
    } catch {
      toast.error('Download failed. File may be unavailable.', { id: 'download' });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student/dashboard')}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <span className="text-slate-700">|</span>
            <span className="text-white font-semibold text-sm">Notes &amp; Study Resources</span>
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
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Academic Resource Library</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Official faculty lecture notes, MSBTE syllabus references, lab manuals, and previous question papers.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search notes, chapters, topics, or subject codes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" aria-hidden="true" />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow"
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
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="alphabetical">Title (A–Z)</option>
                <option value="updated">Recently Updated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Resources Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : resources.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Library size={24} className="text-slate-500" aria-hidden="true" />
            </div>
            <div className="text-lg font-semibold text-white">No Resources Available</div>
            <p className="text-slate-400 text-sm mt-1">
              {search || category !== 'All Categories'
                ? 'No resources match your search criteria. Try adjusting filters.'
                : 'Faculty has not uploaded resources for your semester yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((res) => {
              const FileIcon = getFileIconComponent(res.fileType);
              return (
                <div
                  key={res._id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between group"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400">
                        <FileIcon size={20} aria-hidden="true" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-950/80 text-blue-400 border border-blue-800/40">
                        {res.category}
                      </span>
                    </div>

                    <div>
                      <h3
                        onClick={() => setSelectedResource(res)}
                        className="text-base font-bold text-white leading-snug group-hover:text-blue-400 transition-colors line-clamp-1 cursor-pointer"
                      >
                        {res.title}
                      </h3>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">
                        {res.subjectCode} • {res.subject?.subjectName || 'Subject'}
                      </div>
                    </div>

                    {res.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {res.description}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Folder size={11} aria-hidden="true" /> {res.fileName}
                      </span>
                      <span className="font-mono">{formatBytes(res.fileSize)}</span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Uploaded by <strong className="text-slate-400">{res.uploaderName || 'Faculty'}</strong> • {new Date(res.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="bg-slate-800/40 px-4 py-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedResource(res)}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleDownload(res)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow"
                    >
                      <Download size={13} aria-hidden="true" /> Download
                    </button>
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

        {/* ─── MODAL: RESOURCE DETAILS ──────────────────────────────────────── */}
        {selectedResource && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const FileIcon = getFileIconComponent(selectedResource.fileType);
                    return (
                      <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400">
                        <FileIcon size={18} aria-hidden="true" />
                      </div>
                    );
                  })()}
                  <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-blue-950 text-blue-400 border border-blue-800/50">
                    {selectedResource.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedResource(null)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedResource.title}</h3>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    {selectedResource.subjectCode} — {selectedResource.subject?.subjectName}
                  </div>
                </div>

                {selectedResource.description ? (
                  <div className="bg-slate-800/50 rounded-xl p-3.5 border border-slate-700/50 text-xs text-slate-300 leading-relaxed">
                    {selectedResource.description}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No description provided.</div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-800/30 rounded-xl p-3 border border-slate-800">
                  <div>
                    <span className="text-slate-500 block">File Name</span>
                    <span className="text-slate-300 font-mono truncate block">{selectedResource.fileName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">File Size</span>
                    <span className="text-slate-300 font-mono">{formatBytes(selectedResource.fileSize)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Academic Context</span>
                    <span className="text-slate-300">Sem {selectedResource.semester} {selectedResource.division !== 'ALL' && `(Div ${selectedResource.division})`}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Uploaded By</span>
                    <span className="text-slate-300">{selectedResource.uploaderName || 'Faculty'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setSelectedResource(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleDownload(selectedResource)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow flex items-center gap-2"
                  >
                    <Download size={14} aria-hidden="true" /> Download File
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentResourcesPage;
