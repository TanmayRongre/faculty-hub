/**
 * sheetsService.js
 *
 * Frontend service for Google Sheets academic data endpoints.
 * All calls go through the authenticated axios instance.
 * Google credentials never appear here — they remain server-side.
 */

import api from './api';

// ─── Administration ───────────────────────────────────────────────────────────

export const getSheetsStatus = () =>
  api.get('/sheets/status').then((r) => r.data);

export const initialiseSpreadsheet = () =>
  api.post('/sheets/initialise').then((r) => r.data);

export const syncAllStudents = () =>
  api.post('/sheets/sync').then((r) => r.data);

export const syncStudent = (studentId) =>
  api.post(`/sheets/sync/${studentId}`).then((r) => r.data);

// ─── Marks ────────────────────────────────────────────────────────────────────

/**
 * Get marks for the authenticated student.
 * @param {object} [params] - { semester?, academicYear?, subjectCode? }
 */
export const getMyMarks = (params = {}) =>
  api.get('/sheets/marks/me', { params }).then((r) => r.data);

/**
 * Get marks for a specific student (faculty/admin).
 * @param {string} studentId - MongoDB _id
 * @param {object} [params] - filters
 */
export const getStudentMarks = (studentId, params = {}) =>
  api.get(`/sheets/marks/${studentId}`, { params }).then((r) => r.data);

/**
 * Get all marks (faculty/admin).
 * @param {object} [params] - { semester?, academicYear?, subjectCode? }
 */
export const getAllMarks = (params = {}) =>
  api.get('/sheets/marks', { params }).then((r) => r.data);

/**
 * Write/update marks for a student+subject.
 * @param {object} marksData
 */
export const writeMarks = (marksData) =>
  api.post('/sheets/marks', marksData).then((r) => r.data);

// ─── Attendance ───────────────────────────────────────────────────────────────

/**
 * Get attendance for the authenticated student.
 * @param {object} [params] - { subjectCode?, date? }
 */
export const getMyAttendance = (params = {}) =>
  api.get('/sheets/attendance/me', { params }).then((r) => r.data);

/**
 * Get attendance for a specific student (faculty/admin).
 * @param {string} studentId
 * @param {object} [params] - filters
 */
export const getStudentAttendance = (studentId, params = {}) =>
  api.get(`/sheets/attendance/${studentId}`, { params }).then((r) => r.data);

/**
 * Get all attendance records (faculty/admin).
 * @param {object} [params] - { subjectCode?, date?, lectureId? }
 */
export const getAllAttendance = (params = {}) =>
  api.get('/sheets/attendance', { params }).then((r) => r.data);

/**
 * Write a batch of attendance records.
 * @param {{ records: object[] }} payload
 */
export const writeAttendance = (records) =>
  api.post('/sheets/attendance', { records }).then((r) => r.data);
