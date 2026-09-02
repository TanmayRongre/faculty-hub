const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getLectures,
  getReschedulingRequired,
  rescheduleLecture,
} = require('../controllers/lectureController');

// All authenticated roles can view lectures
router.get('/', protect, getLectures);

// Faculty & Admin can view lectures needing rescheduling
router.get('/rescheduling-required', protect, authorize('admin', 'faculty'), getReschedulingRequired);

// Faculty & Admin can manually reschedule a lecture
router.post('/:id/reschedule', protect, authorize('admin', 'faculty'), rescheduleLecture);

module.exports = router;
