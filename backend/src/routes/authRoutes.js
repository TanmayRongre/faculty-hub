const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, adminCreateUser, adminDashboard } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ─── Validation rules ────────────────────────────────────────────────────────

// Public student registration — role is not accepted; always forced to 'student' in controller
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// Admin user creation — role accepted, full validation (faculty or admin only)
const adminCreateUserValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .isIn(['faculty', 'admin'])
    .withMessage('Role must be faculty or admin'),
];

// ─── Public routes ────────────────────────────────────────────────────────────

// Public registration is disabled (returns 403)
router.post('/register', register);

// Login
router.post('/login', loginValidation, login);

// ─── Authenticated routes ─────────────────────────────────────────────────────

// Current user profile
router.get('/me', protect, getMe);

// ─── Admin-only routes ────────────────────────────────────────────────────────
// Both routes require JWT (protect) AND admin role (authorize)

// Create any role user (faculty, admin, student) — admin only
router.post(
  '/admin/create-user',
  protect,
  authorize('admin'),
  adminCreateUserValidation,
  adminCreateUser
);

// Admin dashboard stats — used to verify RBAC authorization
router.get(
  '/admin/dashboard',
  protect,
  authorize('admin'),
  adminDashboard
);

module.exports = router;
