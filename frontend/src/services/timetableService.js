/**
 * timetableService.js (frontend)
 *
 * API wrappers for /api/timetable endpoints.
 */

import api from './api';

/** Get weekly timetable (supports filters: semester, division, faculty, myTimetable) */
export async function getTimetable(params = {}) {
  const res = await api.get('/timetable', { params });
  return res.data;
}

/** Create a new timetable slot (admin / faculty) */
export async function createTimetableSlot(data) {
  const res = await api.post('/timetable', data);
  return res.data;
}

/** Update an existing timetable slot */
export async function updateTimetableSlot(id, data) {
  const res = await api.put(`/timetable/${id}`, data);
  return res.data;
}

/** Deactivate a timetable slot */
export async function deleteTimetableSlot(id) {
  const res = await api.delete(`/timetable/${id}`);
  return res.data;
}

/** Get dynamic subject-to-faculty assignments */
export async function getFacultyAssignments() {
  const res = await api.get('/timetable/faculty-assignments');
  return res.data;
}
