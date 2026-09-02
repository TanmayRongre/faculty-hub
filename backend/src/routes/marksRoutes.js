/**
 * marksRoutes.js
 *
 * Route definitions for the marks API.
 *
 * Authorization:
 *   GET /me                     → student
 *   GET /student/:studentId     → faculty | admin
 *   GET /                       → faculty | admin
 *   PUT /bulk                   → faculty | admin (SAVE ALL)
 *   PUT /:studentId/:subjectCode → faculty | admin
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getMyMarks,
  getStudentMarks,
  getAllMarks,
  updateMarks,
  bulkUpdateMarks,
} = require('../controllers/marksController');

// Student: own marks
router.get('/me', protect, authorize('student'), getMyMarks);

// Faculty/admin: specific student marks
router.get('/student/:studentId', protect, authorize('faculty', 'admin'), getStudentMarks);

// Faculty/admin: bulk update marks (SAVE ALL)
router.put('/bulk', protect, authorize('faculty', 'admin'), bulkUpdateMarks);

// Faculty/admin: all marks (with filters)
router.get('/', protect, authorize('faculty', 'admin'), getAllMarks);

// Faculty/admin: update marks
router.put('/:studentId/:subjectCode', protect, authorize('faculty', 'admin'), updateMarks);

module.exports = router;
