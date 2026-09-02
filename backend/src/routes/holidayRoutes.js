const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getHolidays,
  createHoliday,
  deleteHoliday,
} = require('../controllers/holidayController');

// All authenticated roles can view holidays
router.get('/', protect, getHolidays);

// Admin & Faculty can manage holidays
router.post('/', protect, authorize('admin', 'faculty'), createHoliday);
router.delete('/:id', protect, authorize('admin', 'faculty'), deleteHoliday);

module.exports = router;
