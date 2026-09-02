/**
 * attendanceRoutes.js
 *
 * /api/attendance route definitions.
 * Authorization:
 *   - Students: GET /me, GET /summary
 *   - Faculty/Admin: all other endpoints
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  submitLectureAttendance,
  updateLectureAttendance,
  getLectureAttendance,
  getClassAttendance,
  getAttendanceMatrix,
  getStudentAttendanceById,
  getDefaulters,
  getMyAttendance,
  getAttendanceSummary,
} = require('../controllers/attendanceController');

// ─── Student-only routes ──────────────────────────────────────────────────────

/** GET /api/attendance/me — student's own attendance */
router.get('/me', protect, authorize('student'), getMyAttendance);

/** GET /api/attendance/summary — summary for authenticated user */
router.get('/summary', protect, authorize('student', 'faculty', 'admin'), getAttendanceSummary);

// ─── Faculty / Admin routes ───────────────────────────────────────────────────

/** GET /api/attendance/matrix — attendance matrix table */
router.get('/matrix', protect, authorize('faculty', 'admin'), getAttendanceMatrix);

/** GET /api/attendance/defaulters */
router.get('/defaulters', protect, authorize('faculty', 'admin'), getDefaulters);

/** GET /api/attendance/class */
router.get('/class', protect, authorize('faculty', 'admin'), getClassAttendance);

/** GET /api/attendance/student/:studentId */
router.get('/student/:studentId', protect, authorize('faculty', 'admin'), getStudentAttendanceById);

/** GET /api/attendance/lecture/:lectureId — load existing attendance for edit */
router.get('/lecture/:lectureId', protect, authorize('faculty', 'admin'), getLectureAttendance);

/** POST /api/attendance/lecture/:lectureId — submit new attendance */
router.post('/lecture/:lectureId', protect, authorize('faculty', 'admin'), submitLectureAttendance);

/** PUT /api/attendance/lecture/:lectureId — edit existing attendance */
router.put('/lecture/:lectureId', protect, authorize('faculty', 'admin'), updateLectureAttendance);

module.exports = router;
