import api from './api';

export const substitutionService = {
  /** Create a new leave & substitution request */
  createSubstitution: (data) => api.post('/substitutions', data).then((r) => r.data),

  /** Substitute responds: accept or reject */
  respondSubstitution: (id, action, reason) =>
    api.patch(`/substitutions/${id}/respond`, { action, reason }).then((r) => r.data),

  /** Cancel a substitution request */
  cancelSubstitution: (id, reason) =>
    api.patch(`/substitutions/${id}/cancel`, { reason }).then((r) => r.data),

  /** Get leave applications submitted by logged-in faculty */
  getMyApplications: (params) =>
    api.get('/substitutions/my-requests', { params }).then((r) => r.data),

  /** Get substitution requests received by logged-in faculty */
  getReceivedRequests: (params) =>
    api.get('/substitutions/received', { params }).then((r) => r.data),

  /** Get active substitutions accepted by logged-in faculty */
  getMySubstitutions: (params) =>
    api.get('/substitutions/my-substitutions', { params }).then((r) => r.data),

  /** Admin: get all substitution requests */
  getAllSubstitutions: (params) =>
    api.get('/substitutions/all', { params }).then((r) => r.data),

  /** Get active accepted substitutions for a calendar date (used by timetable) */
  getDateSubstitutions: (date) =>
    api.get('/substitutions/by-date', { params: { date } }).then((r) => r.data),
};
