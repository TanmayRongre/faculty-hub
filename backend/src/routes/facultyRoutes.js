const express = require('express');
const { body } = require('express-validator');
const {
  getFacultyList,
  getMyFacultyProfile,
  getFaculty,
  createFaculty,
  updateFaculty,
  updateFacultyStatus,
  assignSubjects,
  getMyAssignedSubjects,
} = require('../controllers/facultyController');
const { protect, authorize } = require('../middleware/auth');
const { FACULTY_DESIGNATIONS } = require('../config/academic');

const router = express.Router();

const facultyCreateValidation = [
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('department').optional().isMongoId(),
  body('designation')
    .trim()
    .notEmpty()
    .withMessage('Designation is required')
    .isIn(FACULTY_DESIGNATIONS)
    .withMessage(`Designation must be one of: ${FACULTY_DESIGNATIONS.join(', ')}`),
];

const facultyUpdateValidation = [
  body('fullName').optional().trim().notEmpty().isLength({ max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('designation')
    .optional()
    .trim()
    .isIn(FACULTY_DESIGNATIONS)
    .withMessage(`Designation must be one of: ${FACULTY_DESIGNATIONS.join(', ')}`),
];

// Authenticated faculty/admin can access own profile & assigned subjects
router.get('/me', protect, authorize('faculty', 'admin'), getMyFacultyProfile);
router.get('/me/assigned-subjects', protect, authorize('faculty', 'admin'), getMyAssignedSubjects);

// Faculty management (faculty/admin can read, only admin can create/update/status/assign-subjects)
router.get('/', protect, authorize('faculty', 'admin'), getFacultyList);
router.get('/:id', protect, authorize('faculty', 'admin'), getFaculty);
router.post('/', protect, authorize('admin'), facultyCreateValidation, createFaculty);
router.put('/:id', protect, authorize('admin'), facultyUpdateValidation, updateFaculty);
router.patch('/:id/status', protect, authorize('admin'), updateFacultyStatus);
router.post('/:id/subjects', protect, authorize('admin'), assignSubjects);

module.exports = router;
