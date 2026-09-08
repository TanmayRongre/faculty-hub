/**
 * marksRoutes.js
 *
 * Route definitions for the marks API.
 *
 * Authorization:
 *   GET  /me                     → student
 *   GET  /subject/:subjectCode   → faculty | admin (full 68-student roster for subject)
 *   GET  /student/:studentId     → faculty | admin
 *   PUT  /batch                  → faculty | admin (SAVE ALL - one batch request)
 *   PUT  /bulk                   → faculty | admin (alias for batch)
 *   GET  /                       → faculty | admin
 *   PUT  /:studentId/:subjectCode → faculty | admin
 *   POST /reset                  → admin
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getMyMarks,
  getStudentMarks,
  getSubjectMarks,
  getAllMarks,
  updateMarks,
  bulkUpdateMarks,
  resetMarks,
} = require('../controllers/marksController');

// Student: own marks
router.get('/me', protect, authorize('student'), getMyMarks);

// Faculty/admin: subject-wise student marks (68 students)
router.get('/subject/:subjectCode', protect, authorize('faculty', 'admin'), getSubjectMarks);

// Faculty/admin: specific student marks
router.get('/student/:studentId', protect, authorize('faculty', 'admin'), getStudentMarks);

// Faculty/admin: bulk update marks (SAVE ALL)
router.put('/batch', protect, authorize('faculty', 'admin'), bulkUpdateMarks);
router.put('/bulk', protect, authorize('faculty', 'admin'), bulkUpdateMarks);

// Faculty/admin: all marks (with filters)
router.get('/', protect, authorize('faculty', 'admin'), getAllMarks);

// Faculty/admin: update single student mark
router.put('/:studentId/:subjectCode', protect, authorize('faculty', 'admin'), updateMarks);

// Admin: reset marks data
router.post('/reset', protect, authorize('admin'), resetMarks);

module.exports = router;
