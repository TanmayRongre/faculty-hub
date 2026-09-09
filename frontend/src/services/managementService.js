import api from './api';

export const studentService = {
  getStudents: (params) => api.get('/students', { params }).then(r => r.data),
  getMyProfile: () => api.get('/students/me').then(r => r.data),
  getStudent: (id) => api.get(`/students/${id}`).then(r => r.data),
  createStudent: (data) => api.post('/students', data).then(r => r.data),
  updateStudent: (id, data) => api.put(`/students/${id}`, data).then(r => r.data),
  updateStudentStatus: (id, status) => api.patch(`/students/${id}/status`, { status }).then(r => r.data),
  deleteStudent: (id) => api.delete(`/students/${id}`).then(r => r.data),
};

export const facultyService = {
  getFaculty: (params) => api.get('/faculty', { params }).then(r => r.data),
  getFacultyList: (params) => api.get('/faculty', { params }).then(r => r.data),
  getMyFacultyProfile: () => api.get('/faculty/me').then(r => r.data),
  getMyAssignedSubjects: () => api.get('/faculty/me/assigned-subjects').then(r => r.data),
  getFacultyById: (id) => api.get(`/faculty/${id}`).then(r => r.data),
  createFaculty: (data) => api.post('/faculty', data).then(r => r.data),
  updateFaculty: (id, data) => api.put(`/faculty/${id}`, data).then(r => r.data),
  updateFacultyStatus: (id, status) => api.patch(`/faculty/${id}/status`, { status }).then(r => r.data),
  assignSubjects: (id, subjectIds) => api.post(`/faculty/${id}/subjects`, { subjectIds }).then(r => r.data),
};

export const academicService = {
  getDepartments: (params) => api.get('/academic/departments', { params }).then(r => r.data),
  createDepartment: (data) => api.post('/academic/departments', data).then(r => r.data),
  updateDepartment: (id, data) => api.put(`/academic/departments/${id}`, data).then(r => r.data),

  getCourses: (params) => api.get('/academic/courses', { params }).then(r => r.data),
  createCourse: (data) => api.post('/academic/courses', data).then(r => r.data),
  updateCourse: (id, data) => api.put(`/academic/courses/${id}`, data).then(r => r.data),

  getSemesters: (params) => api.get('/academic/semesters', { params }).then(r => r.data),
  createSemester: (data) => api.post('/academic/semesters', data).then(r => r.data),
  updateSemester: (id, data) => api.put(`/academic/semesters/${id}`, data).then(r => r.data),

  getDivisions: (params) => api.get('/academic/divisions', { params }).then(r => r.data),
  createDivision: (data) => api.post('/academic/divisions', data).then(r => r.data),
  updateDivision: (id, data) => api.put(`/academic/divisions/${id}`, data).then(r => r.data),

  getSubjects: (params) => api.get('/academic/subjects', { params }).then(r => r.data),
  createSubject: (data) => api.post('/academic/subjects', data).then(r => r.data),
  updateSubject: (id, data) => api.put(`/academic/subjects/${id}`, data).then(r => r.data),
};
