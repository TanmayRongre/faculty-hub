/**
 * SheetsStatusPage.jsx
 *
 * Google Sheets integration status and management page.
 * Visible to: admin only (enforced via route guard + backend).
 *
 * Shows:
 *  - Connection status
 *  - Sheet inventory
 *  - Last sync info
 *  - Actions: Initialise / Sync All Students
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getSheetsStatus,
  initialiseSpreadsheet,
  syncAllStudents,
} from '../../services/sheetsService';
import { INSTITUTION } from '../../config/institution';

// ─── Utilities ────────────────────────────────────────────────────────────────

const StatusBadge = ({ ok, label }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      ok
        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
        : 'bg-red-500/20 text-red-300 border border-red-500/30'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
    {label}
  </span>
);

const InfoBadge = ({ label }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
    {label}
  </span>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function SheetsStatusPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSheetsStatus();
      setStatus(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch Google Sheets status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleInitialise = async () => {
    setActionLoading('init');
    setActionResult(null);
    try {
      const result = await initialiseSpreadsheet();
      setActionResult({ type: 'success', message: result.message, detail: result.sheets });
      fetchStatus();
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err.response?.data?.message || 'Initialisation failed',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async () => {
    setActionLoading('sync');
    setActionResult(null);
    try {
      const result = await syncAllStudents();
      setActionResult({
        type: 'success',
        message: result.message,
        detail: result.results,
      });
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err.response?.data?.message || 'Sync failed',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              {INSTITUTION.name}
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              Google Sheets Integration
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Academic data pipeline status and synchronisation controls
            </p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-gray-300 transition-all disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !status && (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 rounded-2xl bg-white/5" />
            <div className="h-24 rounded-2xl bg-white/5" />
          </div>
        )}

        {/* Status card */}
        {status && (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold text-white">Connection Status</h2>
                {status.configured === false ? (
                  <InfoBadge label="Not Configured" />
                ) : status.connected ? (
                  <StatusBadge ok={true} label="Connected" />
                ) : (
                  <StatusBadge ok={false} label="Disconnected" />
                )}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Not configured */}
              {status.configured === false && (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-2">
                  <p className="text-yellow-300 font-medium text-sm">
                    Google Sheets credentials are not configured.
                  </p>
                  <p className="text-gray-400 text-sm">
                    Set the following environment variables in <code className="text-yellow-200 bg-yellow-900/30 px-1 py-0.5 rounded">.env</code>:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {status.missing?.map((v) => (
                      <li key={v} className="text-xs font-mono text-yellow-200 bg-black/30 px-3 py-1.5 rounded-lg">
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Connected */}
              {status.connected && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <p className="text-xs text-gray-400 mb-1">Spreadsheet</p>
                      <p className="font-medium text-white truncate">
                        {status.spreadsheetTitle || '—'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <p className="text-xs text-gray-400 mb-1">All Sheets Present</p>
                      <div className="mt-1">
                        <StatusBadge ok={status.allSheetsPresent} label={status.allSheetsPresent ? 'Yes' : 'Missing Sheets'} />
                      </div>
                    </div>
                  </div>

                  {/* Sheet inventory */}
                  {status.existingSheets && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Worksheets</p>
                      <div className="flex flex-wrap gap-2">
                        {status.existingSheets.map((s) => (
                          <span key={s} className="px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-xs font-mono">
                            {s}
                          </span>
                        ))}
                        {status.missingSheets?.map((s) => (
                          <span key={s} className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-mono">
                            {s} (missing)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Disconnected with error */}
              {status.configured !== false && !status.connected && status.error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                  <p className="text-red-300 text-sm">{status.error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Actions</h2>
            <p className="mt-0.5 text-xs text-gray-400">Manage spreadsheet structure and data synchronisation</p>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Initialise */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
              <div>
                <h3 className="font-medium text-white text-sm">Initialise Spreadsheet</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Creates the Students, Marks, Attendance, and AcademicSummary worksheets with correct headers if they do not exist.
                </p>
              </div>
              <button
                id="btn-initialise-spreadsheet"
                onClick={handleInitialise}
                disabled={actionLoading === 'init'}
                className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'init' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
                {actionLoading === 'init' ? 'Initialising…' : 'Initialise'}
              </button>
            </div>

            {/* Sync Students */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
              <div>
                <h3 className="font-medium text-white text-sm">Sync All Students</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Pushes all MongoDB student profiles to the Google Sheets Students tab. Updates existing rows or appends new ones.
                </p>
              </div>
              <button
                id="btn-sync-students"
                onClick={handleSync}
                disabled={actionLoading === 'sync'}
                className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'sync' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {actionLoading === 'sync' ? 'Syncing…' : 'Sync Students'}
              </button>
            </div>
          </div>
        </div>

        {/* Action result */}
        {actionResult && (
          <div
            className={`rounded-2xl border p-5 transition-all ${
              actionResult.type === 'success'
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}
          >
            <p className={`font-medium text-sm ${actionResult.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
              {actionResult.message}
            </p>
            {Array.isArray(actionResult.detail) && actionResult.detail.length > 0 && (
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {actionResult.detail.slice(0, 20).map((item, i) => (
                  <div key={i} className="text-xs font-mono text-gray-300 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.status === 'error' || item.action === 'error' ? 'bg-red-400' : 'bg-green-400'}`} />
                    {item.sheet || item.enrollmentNumber || '—'}&nbsp;
                    <span className="text-gray-500">{item.status || item.action}</span>
                    {item.error && <span className="text-red-400"> — {item.error}</span>}
                  </div>
                ))}
                {actionResult.detail.length > 20 && (
                  <p className="text-xs text-gray-500">… and {actionResult.detail.length - 20} more</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Architecture note */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Integration Architecture</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 font-mono">
            {['Google Sheets', '→', 'Sheets API', '→', 'Backend Service', '→', 'REST API', '→', 'React'].map((part, i) => (
              <span key={i} className={part === '→' ? 'text-gray-600' : 'px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-300'}>
                {part}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Google credentials exist only server-side. The frontend never receives or transmits spreadsheet credentials or IDs.
          </p>
        </div>

      </div>
    </div>
  );
}
