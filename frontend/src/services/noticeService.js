/**
 * noticeService.js (frontend)
 *
 * API client for /api/notices endpoints.
 */

import api from './api';

/**
 * Get notices list with optional search, filters, pagination
 */
export async function getNotices(params = {}) {
  const res = await api.get('/notices', { params });
  return res.data;
}

/**
 * Get single notice details
 */
export async function getNoticeById(id) {
  const res = await api.get(`/notices/${id}`);
  return res.data;
}

/**
 * Create a new notice (supports multipart/form-data for optional attachment)
 */
export async function createNotice(formData) {
  const res = await api.post('/notices', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

/**
 * Update notice metadata
 */
export async function updateNotice(id, formData) {
  const res = await api.put(`/notices/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

/**
 * Publish a draft notice
 */
export async function publishNotice(id) {
  const res = await api.patch(`/notices/${id}/publish`);
  return res.data;
}

/**
 * Archive or restore a notice
 */
export async function archiveNotice(id) {
  const res = await api.patch(`/notices/${id}/archive`);
  return res.data;
}

/**
 * Delete a notice permanently
 */
export async function deleteNotice(id) {
  const res = await api.delete(`/notices/${id}`);
  return res.data;
}

/**
 * Download notice attachment blob
 */
export async function downloadAttachment(noticeId, attachmentIndex, fileName) {
  const res = await api.get(`/notices/${noticeId}/attachments/${attachmentIndex}/download`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName || 'attachment_download');
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
}
