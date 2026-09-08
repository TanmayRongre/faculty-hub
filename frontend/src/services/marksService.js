/**
 * marksService.js  (frontend)
 *
 * API wrapper for /api/marks endpoints.
 */

import api from './api';

/** Student: get own marks (with optional filters) */
export async function getMyMarks({ semester, academicYear, subjectCode } = {}) {
  const params = {};
  if (semester) params.semester = semester;
  if (academicYear) params.academicYear = academicYear;
  if (subjectCode) params.subjectCode = subjectCode;
  const res = await api.get('/marks/me', { params });
  return res.data;
}

/** Faculty/admin: get full student roster with marks for a specific subject */
export async function getSubjectMarks(subjectCode) {
  const res = await api.get(`/marks/subject/${encodeURIComponent(subjectCode)}`);
  return res.data;
}

/** Faculty/admin: get a specific student's marks */
export async function getStudentMarks(studentId, { semester, academicYear, subjectCode } = {}) {
  const params = {};
  if (semester) params.semester = semester;
  if (academicYear) params.academicYear = academicYear;
  if (subjectCode) params.subjectCode = subjectCode;
  const res = await api.get(`/marks/student/${studentId}`, { params });
  return res.data;
}

/** Faculty/admin: get all marks (with optional filters) */
export async function getAllMarks({ semester, academicYear, subjectCode } = {}) {
  const params = {};
  if (semester) params.semester = semester;
  if (academicYear) params.academicYear = academicYear;
  if (subjectCode) params.subjectCode = subjectCode;
  const res = await api.get('/marks', { params });
  return res.data;
}

/**
 * Faculty/admin: update marks for a student+subject.
 */
export async function updateMarks(studentId, subjectCode, data) {
  const res = await api.put(`/marks/${studentId}/${encodeURIComponent(subjectCode)}`, data);
  return res.data;
}

/**
 * Faculty/admin: SAVE ALL - bulk save all student marks for a subject in one atomic operation.
 * @param {object} payload
 * @param {string} payload.subject  - e.g. "STE", "OSY", "ACN"
 * @param {Array<{ rollNo: string|number, pa1: number|null, pa2: number|null }>} payload.marks
 * @param {string} [payload.academicYear='2026-2027']
 * @param {number} [payload.semester=5]
 */
export async function bulkUpdateMarks({ subject, marks, academicYear = '2026-2027', semester = 5 }) {
  const res = await api.put('/marks/batch', { subject, marks, academicYear, semester });
  return res.data;
}

/**
 * Admin: reset all marks records
 */
export async function resetMarks() {
  const res = await api.post('/marks/reset');
  return res.data;
}
