/**
 * attendanceService.js  (frontend)
 *
 * API wrapper for /api/attendance endpoints.
 */

import api from './api';

/** Faculty: submit attendance for a lecture (Present-by-default). */
export async function submitAttendance({ date, subjectCode, division = 'A', semester = 5, slot = '1', absentEnrollments }) {
  const res = await api.post('/attendance/lecture/new', {
    date,
    subjectCode,
    division,
    semester,
    slot,
    absentEnrollments,
  });
  return res.data;
}

/** Faculty: update (edit) an existing lecture's attendance. */
export async function updateLectureAttendance(lectureId, absentEnrollments) {
  const res = await api.put(`/attendance/lecture/${encodeURIComponent(lectureId)}`, {
    absentEnrollments,
  });
  return res.data;
}

/** Faculty: get attendance matrix (students rows × lectures columns). */
export async function getAttendanceMatrix({ subjectCode, semester = 5 } = {}) {
  const params = {};
  if (subjectCode) params.subjectCode = subjectCode;
  if (semester) params.semester = semester;
  const res = await api.get('/attendance/matrix', { params });
  return res.data;
}

/** Faculty: get existing attendance records for a lecture (for edit mode). */
export async function getLectureAttendance(lectureId) {
  const res = await api.get(`/attendance/lecture/${encodeURIComponent(lectureId)}`);
  return res.data;
}

/** Faculty: get class-level attendance summary with optional filters. */
export async function getClassAttendance({ subjectCode, date, lectureId, semester = 5 } = {}) {
  const params = {};
  if (subjectCode) params.subjectCode = subjectCode;
  if (date) params.date = date;
  if (lectureId) params.lectureId = lectureId;
  if (semester) params.semester = semester;
  const res = await api.get('/attendance/class', { params });
  return res.data;
}

/** Faculty: get attendance for a specific student by MongoDB ID. */
export async function getStudentAttendanceById(studentId, { subjectCode } = {}) {
  const params = {};
  if (subjectCode) params.subjectCode = subjectCode;
  const res = await api.get(`/attendance/student/${studentId}`, { params });
  return res.data;
}

/** Faculty: get defaulters list. */
export async function getDefaulters({ subjectCode, semester = 5 } = {}) {
  const params = {};
  if (subjectCode) params.subjectCode = subjectCode;
  if (semester) params.semester = semester;
  const res = await api.get('/attendance/defaulters', { params });
  return res.data;
}

/** Student: get own attendance. */
export async function getMyAttendance({ subjectCode } = {}) {
  const params = {};
  if (subjectCode) params.subjectCode = subjectCode;
  const res = await api.get('/attendance/me', { params });
  return res.data;
}
