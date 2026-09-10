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

/** Faculty/admin: get full student roster or batch with marks for a specific subject */
export async function getSubjectMarks(subjectCode, { batch, type } = {}) {
  const params = {};
  if (batch) params.batch = batch;
  if (type) params.type = type;
  const res = await api.get(`/marks/subject/${encodeURIComponent(subjectCode)}`, { params });
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
 * Faculty/admin: SAVE ALL - bulk save student marks for a subject (PA or Practical) in one atomic operation.
 * @param {object} payload
 * @param {string} payload.subject  - e.g. "STE", "OSY", "ACN", "ENDS", "SPI", "ITR"
 * @param {string} [payload.type]   - "PA" | "PRACTICAL"
 * @param {string} [payload.batch]  - "A" | "B" | "C"
 * @param {Array<object>} payload.marks
 * @param {string} [payload.academicYear='2026-2027']
 * @param {number} [payload.semester=5]
 */
export async function bulkUpdateMarks({ subject, marks, type, batch, academicYear = '2026-2027', semester = 5 }) {
  const res = await api.put('/marks/batch', { subject, marks, type, batch, academicYear, semester });
  return res.data;
}

/**
 * Admin: reset all marks records
 */
export async function resetMarks() {
  const res = await api.post('/marks/reset');
  return res.data;
}
