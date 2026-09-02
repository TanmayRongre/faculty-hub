/**
 * resourceService.js (frontend)
 *
 * API client for /api/resources endpoints.
 */

import api from './api';

/**
 * Get resources list with optional search, filters, pagination
 */
export async function getResources(params = {}) {
  const res = await api.get('/resources', { params });
  return res.data;
}

/**
 * Get single resource details
 */
export async function getResourceById(id) {
  const res = await api.get(`/resources/${id}`);
  return res.data;
}

/**
 * Upload a new academic resource (Multipart/form-data)
 */
export async function uploadResource(formData, onUploadProgress) {
  const res = await api.post('/resources', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });
  return res.data;
}

/**
 * Update resource metadata
 */
export async function updateResource(id, data) {
  const res = await api.put(`/resources/${id}`, data);
  return res.data;
}

/**
 * Archive or restore a resource
 */
export async function archiveResource(id) {
  const res = await api.patch(`/resources/${id}/archive`);
  return res.data;
}

/**
 * Delete a resource permanently
 */
export async function deleteResource(id) {
  const res = await api.delete(`/resources/${id}`);
  return res.data;
}

/**
 * Download a resource file blob
 */
export async function downloadResource(id, fileName) {
  const res = await api.get(`/resources/${id}/download`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName || 'resource_download');
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
}
