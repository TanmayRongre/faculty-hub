/**
 * attendanceService.js  (frontend)
 *
 * API wrapper for /api/attendance endpoints in Redesigned Architecture:
 * - Lecture vs Practical
 * - Batches A, B, C
 * - History & Defaulters
 */

import api from './api';

/**
 * Fetch roster for attendance marking:
 * - Lecture: 68 students
 * - Practical A: 24 students (1–24)
 * - Practical B: 23 students (25–47)
 * - Practical C: 21 students (48–68)
 */
export async function getRoster({ attendanceType, subjectCode, batch = null, date = null }) {
  const params = { attendanceType, subjectCode };
  if (batch) params.batch = batch;
  if (date) params.date = date;
  const res = await api.get('/attendance/roster', { params });
  return res.data;
}

/**
 * Saves entire attendance session (SAVE ALL).
 */
export async function saveAttendanceSession(payload) {
  const res = await api.post('/attendance/session', payload);
  return res.data;
}

/**
 * Gets attendance session history.
 */
export async function getAttendanceHistory(params = {}) {
  const res = await api.get('/attendance/history', { params });
  return res.data;
}

/**
 * Gets full session records by sessionId.
 */
export async function getSessionDetails(sessionId) {
  const res = await api.get(`/attendance/session/${encodeURIComponent(sessionId)}`);
  return res.data;
}

/**
 * Gets defaulters list (< 75%).
 */
export async function getDefaulters(params = {}) {
  const res = await api.get('/attendance/defaulters', { params });
  return res.data;
}

// ─── Backward Compatibility Exports ──────────────────────────────────────────

export async function submitAttendance(payload) {
  return saveAttendanceSession(payload);
}

export async function updateLectureAttendance(lectureId, absentEnrollments) {
  const res = await api.put(`/attendance/lecture/${encodeURIComponent(lectureId)}`, {
    absentEnrollments,
  });
  return res.data;
}

export async function getAttendanceMatrix(params = {}) {
  const res = await api.get('/attendance/history', { params });
  return res.data;
}

export async function getLectureAttendance(lectureId) {
  const res = await api.get(`/attendance/session/${encodeURIComponent(lectureId)}`);
  return res.data;
}

export async function getClassAttendance(params = {}) {
  const res = await api.get('/attendance/history', { params });
  return res.data;
}
