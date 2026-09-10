const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getTimetable,
  createSlot,
  updateSlot,
  deleteSlot,
  getFacultyAssignments,
} = require('../controllers/timetableController');

// All authenticated roles (student, faculty, admin) can view timetable & faculty assignments
router.get('/', protect, getTimetable);
router.get('/faculty-assignments', protect, getFacultyAssignments);

// Faculty & Admin can manage timetable slots
router.post('/', protect, authorize('admin', 'faculty'), createSlot);
router.put('/:id', protect, authorize('admin', 'faculty'), updateSlot);
router.delete('/:id', protect, authorize('admin', 'faculty'), deleteSlot);

module.exports = router;
