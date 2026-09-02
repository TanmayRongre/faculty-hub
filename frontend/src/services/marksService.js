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
 * @param {string} studentId
 * @param {string} subjectCode
 * @param {{ PA: number|null, academicYear?: string, semester?: number }} data
 */
export async function updateMarks(studentId, subjectCode, data) {
  const res = await api.put(`/marks/${studentId}/${encodeURIComponent(subjectCode)}`, data);
  return res.data;
}

/**
 * Faculty/admin: bulk save all marks in one operation.
 * @param {Array<{ enrollmentNumber: string, subjectCode: string, PA: number|null }>} marks
 * @param {string} [academicYear='2026-2027']
 * @param {number} [semester=5]
 */
export async function bulkUpdateMarks(marks, academicYear = '2026-2027', semester = 5) {
  const res = await api.put('/marks/bulk', { marks, academicYear, semester });
  return res.data;
}
