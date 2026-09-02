/**
 * galleryService.js (frontend)
 *
 * API client for /api/gallery endpoints.
 */

import api from './api';

/**
 * Get approved public gallery activities with filters, search, and pagination
 */
export async function getApprovedGallery(params = {}) {
  const res = await api.get('/gallery', { params });
  return res.data;
}

/**
 * Get single activity details by ID
 */
export async function getGalleryById(id) {
  const res = await api.get(`/gallery/${id}`);
  return res.data;
}

/**
 * Get authenticated student's own submissions with status tracking
 */
export async function getMySubmissions(params = {}) {
  const res = await api.get('/gallery/my-submissions', { params });
  return res.data;
}

/**
 * Get moderation dashboard submissions (Faculty / Admin only)
 */
export async function getModerationSubmissions(params = {}) {
  const res = await api.get('/gallery/moderation', { params });
  return res.data;
}

/**
 * Create a new extracurricular activity submission (multipart/form-data for images)
 */
export async function createSubmission(formData) {
  const res = await api.post('/gallery', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

/**
 * Update an activity submission
 */
export async function updateSubmission(id, formData) {
  const res = await api.put(`/gallery/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

/**
 * Approve a pending activity (Faculty / Admin only)
 */
export async function approveSubmission(id) {
  const res = await api.patch(`/gallery/${id}/approve`);
  return res.data;
}

/**
 * Reject an activity submission with reason (Faculty / Admin only)
 */
export async function rejectSubmission(id, rejectionReason) {
  const res = await api.patch(`/gallery/${id}/reject`, { rejectionReason });
  return res.data;
}

/**
 * Delete an activity submission permanently
 */
export async function deleteSubmission(id) {
  const res = await api.delete(`/gallery/${id}`);
  return res.data;
}
