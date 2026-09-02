/**
 * sheetsRoutes.js
 *
 * Routes for Google Sheets academic data integration.
 *
 * Mount point: /api/sheets
 *
 * Authorization summary:
 *   GET  /status                   → admin
 *   POST /initialise               → admin
 *   POST /sync                     → admin (bulk student sync)
 *   POST /sync/:studentId          → admin (single student sync)
 *
 *   GET  /marks/me                 → student (own)
 *   GET  /marks/:studentId         → student (own) | faculty | admin
 *   GET  /marks                    → faculty | admin
 *   POST /marks                    → faculty | admin
 *
 *   GET  /attendance/me            → student (own)
 *   GET  /attendance/:studentId    → student (own) | faculty | admin
 *   GET  /attendance               → faculty | admin
 *   POST /attendance               → faculty | admin
 */

const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const {
  getStatus,
  initialiseSpreadsheet,
  syncStudents,
  syncSingleStudent,
  getStudentMarks,
  getMyMarks,
  getAllMarks,
  writeMarks,
  getStudentAttendance,
  getMyAttendance,
  getAllAttendance,
  writeAttendance,
} = require('../controllers/sheetsController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// ─── Administration ───────────────────────────────────────────────────────────
router.get('/status', authorize('admin'), getStatus);
router.post('/initialise', authorize('admin'), initialiseSpreadsheet);

// ─── Synchronisation ──────────────────────────────────────────────────────────
router.post('/sync', authorize('admin'), syncStudents);
router.post('/sync/:studentId', authorize('admin'), syncSingleStudent);

// ─── Marks — /me must be before /:studentId ──────────────────────────────────
router.get('/marks/me', authorize('student'), getMyMarks);
router.get('/marks/:studentId', authorize('student', 'faculty', 'admin'), getStudentMarks);
router.get('/marks', authorize('faculty', 'admin'), getAllMarks);
router.post('/marks', authorize('faculty', 'admin'), writeMarks);

// ─── Attendance — /me must be before /:studentId ─────────────────────────────
router.get('/attendance/me', authorize('student'), getMyAttendance);
router.get('/attendance/:studentId', authorize('student', 'faculty', 'admin'), getStudentAttendance);
router.get('/attendance', authorize('faculty', 'admin'), getAllAttendance);
router.post('/attendance', authorize('faculty', 'admin'), writeAttendance);

module.exports = router;
