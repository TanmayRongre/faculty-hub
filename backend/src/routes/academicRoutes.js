const express = require('express');
const { body } = require('express-validator');
const {
  getDepartments, createDepartment, updateDepartment,
  getCourses, createCourse, updateCourse,
  getSemesters, createSemester, updateSemester,
  getDivisions, createDivision, updateDivision,
  getSubjects, createSubject, updateSubject,
} = require('../controllers/academicController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ─── Departments ───────────────────────────────────────────────────────────────
router.get('/departments', protect, getDepartments);
router.post(
  '/departments',
  protect,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Department name is required'),
    body('code').trim().notEmpty().withMessage('Department code is required'),
  ],
  createDepartment
);
router.put('/departments/:id', protect, authorize('admin'), updateDepartment);

// ─── Courses ──────────────────────────────────────────────────────────────────
router.get('/courses', protect, getCourses);
router.post(
  '/courses',
  protect,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Course name is required'),
    body('code').trim().notEmpty().withMessage('Course code is required'),
    body('department').notEmpty().isMongoId().withMessage('Valid department ID required'),
    body('totalSemesters').isInt({ min: 1, max: 8 }).withMessage('Total semesters must be 1-8'),
  ],
  createCourse
);
router.put('/courses/:id', protect, authorize('admin'), updateCourse);

// ─── Semesters ────────────────────────────────────────────────────────────────
router.get('/semesters', protect, getSemesters);
router.post(
  '/semesters',
  protect,
  authorize('admin'),
  [
    body('semesterNumber').isInt({ min: 1, max: 8 }).withMessage('Semester number must be 1-8'),
    body('academicYear').matches(/^\d{4}-\d{4}$/).withMessage('Format: YYYY-YYYY'),
  ],
  createSemester
);
router.put('/semesters/:id', protect, authorize('admin'), updateSemester);

// ─── Divisions ────────────────────────────────────────────────────────────────
router.get('/divisions', protect, getDivisions);
router.post(
  '/divisions',
  protect,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Division name is required'),
  ],
  createDivision
);
router.put('/divisions/:id', protect, authorize('admin'), updateDivision);

// ─── Subjects ─────────────────────────────────────────────────────────────────
router.get('/subjects', protect, getSubjects);
router.post(
  '/subjects',
  protect,
  authorize('admin'),
  [
    body('subjectCode').trim().notEmpty().withMessage('Subject code is required'),
    body('subjectName').trim().notEmpty().withMessage('Subject name is required'),
    body('department').optional().isMongoId(),
    body('semester').optional().isInt({ min: 1, max: 8 }),
  ],
  createSubject
);
router.put('/subjects/:id', protect, authorize('admin'), updateSubject);

module.exports = router;
