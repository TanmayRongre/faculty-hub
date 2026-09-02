/**
 * holidayController.js
 *
 * HTTP handlers for /api/holidays endpoints.
 */

const Holiday = require('../models/Holiday');
const { applyHoliday, removeHoliday } = require('../services/scheduler/holidayShiftService');

/**
 * GET /api/holidays
 * Returns list of holidays.
 */
const getHolidays = async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.year) query.academicYear = req.query.year;

    const holidays = await Holiday.find(query).sort({ date: 1 }).lean();
    res.json({ success: true, count: holidays.length, data: holidays });
  } catch (err) {
    console.error('[Holiday] Get error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/holidays
 * Adds a new holiday and applies deterministic holiday shift logic.
 */
const createHoliday = async (req, res) => {
  try {
    const { date, title, type, academicYear } = req.body;

    if (!date) return res.status(400).json({ success: false, message: 'Holiday date is required' });
    if (!title) return res.status(400).json({ success: false, message: 'Holiday title is required' });

    let holiday = await Holiday.findOne({ date });
    if (holiday && holiday.status === 'active') {
      return res.status(409).json({ success: false, message: `A holiday on ${date} already exists: ${holiday.title}` });
    }

    if (holiday && holiday.status === 'cancelled') {
      holiday.title = title;
      holiday.type = type || 'national';
      holiday.status = 'active';
      holiday.academicYear = academicYear;
      await holiday.save();
    } else {
      holiday = await Holiday.create({
        date,
        title,
        type: type || 'national',
        academicYear,
        createdBy: req.user.id,
        status: 'active',
      });
    }

    // Apply holiday shift logic
    const shiftResult = await applyHoliday(holiday);

    res.status(201).json({
      success: true,
      message: `Holiday created. ${shiftResult.affectedCount} lectures affected (${shiftResult.rescheduledCount} auto-rescheduled, ${shiftResult.pendingCount} pending)`,
      data: holiday,
      shiftResult,
    });
  } catch (err) {
    console.error('[Holiday] Create error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/holidays/:id
 * Cancels/removes a holiday and restores affected lectures.
 */
const deleteHoliday = async (req, res) => {
  try {
    const result = await removeHoliday(req.params.id);
    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[Holiday] Delete error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getHolidays,
  createHoliday,
  deleteHoliday,
};
