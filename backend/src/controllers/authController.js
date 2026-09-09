const { validationResult } = require('express-validator');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * POST /api/auth/register
 * DECOMMISSIONED — FacultyHub is a Faculty & Admin platform only.
 * Public registration is disabled.
 */
const register = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Public registration is disabled. Faculty accounts are managed by administration.',
  });
};

/**
 * POST /api/auth/login
 * Authenticate faculty or admin user and return JWT.
 * Student logins are rejected with 403 Forbidden.
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Explicitly select password field back (excluded by default via schema)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Reject student login attempts — FacultyHub is Faculty/Admin only
    if (user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Student access has been decommissioned. FacultyHub is a Faculty and Administration platform only.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/auth/admin/create-user
 * ADMIN ONLY — creates faculty or admin accounts.
 * Student role creation is removed.
 */
const adminCreateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role } = req.body;

    if (!['faculty', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either faculty or admin',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, role });

    return res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created`,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ success: false, message: 'Server error during user creation' });
  }
};

/**
 * GET /api/auth/admin/dashboard
 * ADMIN ONLY — returns basic stats. Used to verify RBAC middleware.
 */
const adminDashboard = async (req, res) => {
  try {
    const [totalUsers, totalStudents, totalFaculty, totalAdmins] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'faculty' }),
      User.countDocuments({ role: 'admin' }),
    ]);
    return res.status(200).json({
      success: true,
      data: { totalUsers, totalStudents, totalFaculty, totalAdmins },
      accessedBy: { id: req.user._id, name: req.user.name, role: req.user.role },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { register, login, getMe, adminCreateUser, adminDashboard };
