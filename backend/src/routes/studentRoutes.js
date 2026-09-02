const express = require('express');
const { body } = require('express-validator');
const {
  getStudents, getMyProfile, getStudent,
  createStudent, updateStudent, updateStudentStatus, deleteStudent,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Validation rules (No Course, Division, or Admission Year required)
const studentCreateValidation = [
  body('enrollmentNumber').trim().notEmpty().withMessage('Enrollment number is required'),
  body('rollNumber').trim().notEmpty().withMessage('Roll number is required'),
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('department').optional().isMongoId(),
  body('semester').optional().isInt({ min: 1, max: 8 }),
  body('academicYear').optional().matches(/^\d{4}-\d{4}$/),
];

const studentUpdateValidation = [
  body('fullName').optional().trim().notEmpty().isLength({ max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('rollNumber').optional().trim().notEmpty(),
  body('semester').optional().isInt({ min: 1, max: 8 }),
  body('academicYear').optional().matches(/^\d{4}-\d{4}$/),
];

// ─── Student self-access ───────────────────────────────────────────────────────
router.get('/me', protect, authorize('student'), getMyProfile);

// ─── Faculty/Admin management ──────────────────────────────────────────────────
router.get('/', protect, authorize('faculty', 'admin'), getStudents);
router.post('/', protect, authorize('admin'), studentCreateValidation, createStudent);

router.get('/:id', protect, authorize('faculty', 'admin'), getStudent);
router.put('/:id', protect, authorize('admin'), studentUpdateValidation, updateStudent);
router.patch('/:id/status', protect, authorize('admin'), updateStudentStatus);
router.delete('/:id', protect, authorize('admin'), deleteStudent);

module.exports = router;
