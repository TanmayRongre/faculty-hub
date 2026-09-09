import api from './api';

export const taskService = {
  getTasks: (params) => api.get('/tasks', { params }).then((r) => r.data),
  getTaskSummary: () => api.get('/tasks/summary').then((r) => r.data),
  getTaskById: (id) => api.get(`/tasks/${id}`).then((r) => r.data),
  createTask: (data) => api.post('/tasks', data).then((r) => r.data),
  updateTask: (id, data) => api.put(`/tasks/${id}`, data).then((r) => r.data),
  updateTaskStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }).then((r) => r.data),
  deleteTask: (id) => api.delete(`/tasks/${id}`).then((r) => r.data),
};

export default taskService;
