/**
 * schedulerService.js (frontend)
 *
 * API wrappers for /api/timetable, /api/holidays, and /api/lectures endpoints.
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

/** Get holidays list */
export async function getHolidays(params = {}) {
  const res = await api.get('/holidays', { params });
  return res.data;
}

/** Create a holiday and trigger deterministic shift logic */
export async function createHoliday(data) {
  const res = await api.post('/holidays', data);
  return res.data;
}

/** Delete / cancel a holiday and restore lectures */
export async function deleteHoliday(id) {
  const res = await api.delete(`/holidays/${id}`);
  return res.data;
}

/** Get dynamic lecture instances */
export async function getLectures(params = {}) {
  const res = await api.get('/lectures', { params });
  return res.data;
}

/** Get lectures requiring manual rescheduling */
export async function getReschedulingRequired(params = {}) {
  const res = await api.get('/lectures/rescheduling-required', { params });
  return res.data;
}

/** Manually reschedule a lecture */
export async function rescheduleLecture(id, data) {
  const res = await api.post(`/lectures/${id}/reschedule`, data);
  return res.data;
}
