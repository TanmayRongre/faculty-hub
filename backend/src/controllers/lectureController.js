/**
 * lectureController.js
 *
 * HTTP handlers for /api/lectures endpoints.
 */

const schedulerService = require('../services/scheduler/schedulerService');
const { manualRescheduleLecture } = require('../services/scheduler/holidayShiftService');

/**
 * GET /api/lectures
 * Returns lectures for a date or date range.
 */
const getLectures = async (req, res) => {
  try {
    const filters = {};
    if (req.query.date) filters.date = req.query.date;
    if (req.query.startDate && req.query.endDate) {
      filters.startDate = req.query.startDate;
      filters.endDate = req.query.endDate;
    }
    if (req.query.faculty) filters.faculty = req.query.faculty;
    if (req.query.semester) filters.semester = req.query.semester;
    if (req.query.division) filters.division = req.query.division;
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;
    if (req.query.status) filters.status = req.query.status;

    const lectures = await schedulerService.getLectures(filters);
    res.json({ success: true, count: lectures.length, data: lectures });
  } catch (err) {
    console.error('[Lectures] Get error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/lectures/rescheduling-required
 * Returns lectures that need manual rescheduling.
 */
const getReschedulingRequired = async (req, res) => {
  try {
    const filters = {};
    if (req.query.faculty) filters.faculty = req.query.faculty;
    if (req.query.semester) filters.semester = req.query.semester;
    if (req.query.division) filters.division = req.query.division;

    const lectures = await schedulerService.getReschedulingRequiredLectures(filters);
    res.json({ success: true, count: lectures.length, data: lectures });
  } catch (err) {
    console.error('[Lectures] Rescheduling required error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/lectures/:id/reschedule
 * Manually reschedules a lecture.
 */
const rescheduleLecture = async (req, res) => {
  try {
    const { newDate, newStartTime, newEndTime, newRoom, reason } = req.body;

    if (!newDate) return res.status(400).json({ success: false, message: 'New date is required' });
    if (!newStartTime) return res.status(400).json({ success: false, message: 'New start time is required' });
    if (!newEndTime) return res.status(400).json({ success: false, message: 'New end time is required' });

    const replacement = await manualRescheduleLecture(req.params.id, {
      newDate,
      newStartTime,
      newEndTime,
      newRoom,
      reason,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Lecture rescheduled successfully',
      data: replacement,
    });
  } catch (err) {
    console.error('[Lectures] Reschedule error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getLectures,
  getReschedulingRequired,
  rescheduleLecture,
};
