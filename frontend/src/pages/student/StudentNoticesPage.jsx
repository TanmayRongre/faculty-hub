import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { INSTITUTION } from '../../config/institution';
import { getNotices, downloadAttachment } from '../../services/noticeService';
import { Search, Megaphone, Paperclip, AlertCircle, X } from 'lucide-react';

const CATEGORIES = ['All Categories', 'Academic', 'Examination', 'Department', 'General', 'Event', 'Urgent'];
const PRIORITIES = ['All Priorities', 'Normal', 'Important', 'Urgent'];

const StudentNoticesPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Filters & Search
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [priority, setPriority] = useState('All Priorities');
  const [sort, setSort] = useState('newest');

  // Data
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Detail Modal
  const [selectedNotice, setSelectedNotice] = useState(null);

  const fetchNotices = (page = 1) => {
    setLoading(true);
    const params = {
      page,
      limit: 12,
      sort,
    };
    if (search.trim()) params.search = search.trim();
    if (category !== 'All Categories') params.category = category;
    if (priority !== 'All Priorities') params.priority = priority;

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
  }, [category, priority, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchNotices(1);
  };

  const handleDownload = async (notice, attIndex, fileName) => {
    try {
      toast.loading(`Downloading ${fileName}...`, { id: 'att-dl' });
      await downloadAttachment(notice._id, attIndex, fileName);
      toast.success('Download complete', { id: 'att-dl' });
    } catch {
      toast.error('Download failed', { id: 'att-dl' });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const urgentNotices = notices.filter(n => n.priority === 'Urgent');

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student/dashboard')}
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <span className="text-slate-700">|</span>
            <span className="text-white font-semibold text-sm">Campus Notice Board</span>
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name}
            </div>
            <h1 className="text-2xl font-bold text-white">Official Notice Board &amp; Campus Circulars</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Official institute announcements, examination updates, department circulars, and campus events.
            </p>
          </div>
        </div>

        {/* Pinned Urgent Notice Banner */}
        {urgentNotices.length > 0 && (
          <div className="mb-6 bg-red-950/40 border border-red-800/80 rounded-xl p-4 shadow-lg shadow-red-950/20">
            <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider mb-1">
              <AlertCircle size={14} className="animate-pulse" aria-hidden="true" />
              URGENT CAMPUS ANNOUNCEMENT
            </div>
            <div className="font-bold text-white text-base">{urgentNotices[0].title}</div>
            <p className="text-slate-300 text-xs mt-1 line-clamp-2">{urgentNotices[0].content}</p>
            <button
              onClick={() => setSelectedNotice(urgentNotices[0])}
              className="mt-3 text-xs font-semibold text-red-400 hover:text-red-300 underline"
            >
              Read full circular →
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search circulars by keywords..."
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
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Notices List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Megaphone size={24} className="text-slate-500" aria-hidden="true" />
            </div>
            <div className="text-lg font-semibold text-white">No Notices Found</div>
            <p className="text-slate-400 text-sm mt-1">
              {search || category !== 'All Categories' || priority !== 'All Priorities'
                ? 'No circulars match your search filters.'
                : 'There are currently no active announcements for your class.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((n) => (
              <div
                key={n._id}
                className={`bg-slate-900 border rounded-xl p-5 hover:border-slate-700 transition-all cursor-pointer ${
                  n.priority === 'Urgent'
                    ? 'border-red-800/60 shadow-lg shadow-red-950/20'
                    : n.priority === 'Important'
                    ? 'border-amber-800/50'
                    : 'border-slate-800'
                }`}
                onClick={() => setSelectedNotice(n)}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          n.priority === 'Urgent'
                            ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                            : n.priority === 'Important'
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {n.priority}
                      </span>

                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-950/80 text-blue-400 border border-blue-900/50">
                        {n.category}
                      </span>

                      {n.attachments && n.attachments.length > 0 && (
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                          <Paperclip size={11} aria-hidden="true" /> Attachment
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-white pt-1 hover:text-blue-400 transition-colors">
                      {n.title}
                    </h3>
                  </div>

                  <div className="text-xs text-slate-500 font-mono">
                    Published: {new Date(n.publishDate).toLocaleDateString()}
                  </div>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-3">
                  {n.content}
                </p>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Issued by: <strong className="text-slate-400">{n.authorName || 'Institute Administration'}</strong></span>
                  <span className="text-blue-400 font-semibold">View Notice Details →</span>
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

        {/* ─── MODAL: NOTICE DETAILS ────────────────────────────────────────── */}
        {selectedNotice && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      selectedNotice.priority === 'Urgent'
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : selectedNotice.priority === 'Important'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {selectedNotice.priority}
                  </span>
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-950 text-blue-400 border border-blue-900">
                    {selectedNotice.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedNotice.title}</h2>
                  <div className="text-xs text-slate-400 mt-1">
                    Published on {new Date(selectedNotice.publishDate).toLocaleDateString()} by <strong>{selectedNotice.authorName || 'Faculty'}</strong>
                  </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                  {selectedNotice.content}
                </div>

                {/* Attachments */}
                {selectedNotice.attachments && selectedNotice.attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400">Attached Documents</div>
                    {selectedNotice.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 text-xs truncate">
                          <Paperclip size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                          <span className="font-mono text-slate-200 truncate">{att.fileName}</span>
                          <span className="text-slate-500">({(att.fileSize / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          onClick={() => handleDownload(selectedNotice, idx, att.fileName)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all shrink-0"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setSelectedNotice(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
                  >
                    Close
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

export default StudentNoticesPage;
