/**
 * attendanceRoutes.js
 *
 * /api/attendance route definitions for Redesigned Attendance Architecture.
 * Enforces authentication, role checks ('faculty', 'admin'), and subject authorization.
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { authorizeSubjectAccess } = require('../middleware/subjectAccess');
const {
  getRoster,
  saveAttendanceSession,
  getAttendanceHistory,
  getSessionDetails,
  getDefaulters,
  submitLectureAttendance,
  updateLectureAttendance,
  getLectureAttendance,
} = require('../controllers/attendanceController');

// ─── Active Redesigned Attendance Endpoints ───────────────────────────────────

/** GET /api/attendance/roster — fetches exact student slice for type/subject/batch */
router.get(
  '/roster',
  protect,
  authorize('faculty', 'admin'),
  authorizeSubjectAccess('subjectCode'),
  getRoster
);

/** POST /api/attendance/session — saves attendance session (SAVE ALL) */
router.post(
  '/session',
  protect,
  authorize('faculty', 'admin'),
  authorizeSubjectAccess('subjectCode'),
  saveAttendanceSession
);

/** GET /api/attendance/history — distinct session listing with filters */
router.get(
  '/history',
  protect,
  authorize('faculty', 'admin'),
  authorizeSubjectAccess('subjectCode'),
  getAttendanceHistory
);

/** GET /api/attendance/session/:sessionId — full attendance records for session */
router.get(
  '/session/:sessionId',
  protect,
  authorize('faculty', 'admin'),
  getSessionDetails
);

/** GET /api/attendance/defaulters — defaulter list (< 75%) */
router.get(
  '/defaulters',
  protect,
  authorize('faculty', 'admin'),
  authorizeSubjectAccess('subjectCode'),
  getDefaulters
);

// ─── Backward Compatibility Routes ────────────────────────────────────────────

router.get('/lecture/:lectureId', protect, authorize('faculty', 'admin'), getLectureAttendance);
router.post('/lecture/:lectureId', protect, authorize('faculty', 'admin'), authorizeSubjectAccess('subjectCode'), submitLectureAttendance);
router.put('/lecture/:lectureId', protect, authorize('faculty', 'admin'), updateLectureAttendance);

module.exports = router;
