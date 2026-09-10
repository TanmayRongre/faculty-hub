const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createSubstitution,
  respondSubstitution,
  cancelSubstitution,
  getMyApplications,
  getReceivedRequests,
  getMySubstitutions,
  getAllSubstitutions,
  getDateSubstitutions,
} = require('../controllers/substitutionController');

// Active date substitutions for timetable display (all authenticated users)
router.get('/by-date', protect, getDateSubstitutions);

// Faculty personal leave & substitution portal
router.post('/', protect, authorize('faculty', 'admin'), createSubstitution);
router.get('/my-requests', protect, authorize('faculty', 'admin'), getMyApplications);
router.get('/received', protect, authorize('faculty', 'admin'), getReceivedRequests);
router.get('/my-substitutions', protect, authorize('faculty', 'admin'), getMySubstitutions);
router.patch('/:id/respond', protect, authorize('faculty', 'admin'), respondSubstitution);
router.patch('/:id/cancel', protect, authorize('faculty', 'admin'), cancelSubstitution);

// Admin-level substitution management
router.get('/all', protect, authorize('admin'), getAllSubstitutions);

module.exports = router;
