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
const { authorizeSubjectAccess } = require('../middleware/subjectAccess');
const {
  getMyMarks,
  getStudentMarks,
  getSubjectMarks,
  getAllMarks,
  updateMarks,
  bulkUpdateMarks,
  resetMarks,
} = require('../controllers/marksController');

// Faculty/admin: subject-wise student marks (68 students) — strictly authorized by assigned subject
router.get('/subject/:subjectCode', protect, authorize('faculty', 'admin'), authorizeSubjectAccess('subjectCode'), getSubjectMarks);

// Faculty/admin: specific student marks
router.get('/student/:studentId', protect, authorize('faculty', 'admin'), getStudentMarks);

// Faculty/admin: bulk update marks (SAVE ALL) — strictly authorized by assigned subject in body
router.put('/batch', protect, authorize('faculty', 'admin'), authorizeSubjectAccess('subject'), bulkUpdateMarks);
router.put('/bulk', protect, authorize('faculty', 'admin'), authorizeSubjectAccess('subject'), bulkUpdateMarks);

// Faculty/admin: all marks (with filters)
router.get('/', protect, authorize('faculty', 'admin'), authorizeSubjectAccess('subjectCode'), getAllMarks);

// Faculty/admin: update single student mark — strictly authorized by assigned subject
router.put('/:studentId/:subjectCode', protect, authorize('faculty', 'admin'), authorizeSubjectAccess('subjectCode'), updateMarks);

// Admin: reset marks data
router.post('/reset', protect, authorize('admin'), resetMarks);

module.exports = router;
