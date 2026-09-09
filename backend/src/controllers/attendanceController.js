/**
 * attendanceController.js
 *
 * HTTP layer for all attendance operations in FacultyHub (Redesigned Architecture):
 *   - LECTURE vs PRACTICAL
 *   - Batch A, B, C for Practical
 *   - Strict subject-level authorization and validation
 *   - Idempotent and batch-safe Google Sheets sync
 */

const attendanceService = require('../services/attendance/attendanceService');

function handleError(err, res) {
  console.error('[AttendanceController] Error:', err.message);
  const status = err.statusCode || (err.message.includes('not eligible') || err.message.includes('not allowed') || err.message.includes('requires a valid batch') ? 422 : 500);
  return res.status(status).json({
    success: false,
    message: err.message || 'Internal attendance error',
    details: err.details || undefined,
  });
}

/**
 * GET /api/attendance/roster
 * Returns the exact student roster for the chosen attendance context.
 * Query params:
 *   - attendanceType: 'LECTURE' | 'PRACTICAL'
 *   - subjectCode: 'STE' | 'OSY' | 'ENDS' | 'ACN'
 *   - batch: 'A' | 'B' | 'C' (required if PRACTICAL)
 */
const getRoster = async (req, res) => {
  try {
    const { attendanceType, subjectCode, batch } = req.query;
    const result = await attendanceService.getRoster({
      attendanceType,
      subjectCode,
      batch: batch || null,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(err, res);
  }
};

/**
 * POST /api/attendance/session
 * Saves/Submits an attendance session (SAVE ALL).
 * Body:
 *   - attendanceType: 'LECTURE' | 'PRACTICAL'
 *   - subjectCode: 'STE' | 'OSY' | 'ENDS' | 'ACN'
 *   - batch: 'A' | 'B' | 'C' | null
 *   - date: 'YYYY-MM-DD'
 *   - slot: '09:00 - 10:00'
 *   - absentEnrollments / absentRolls: array of string
 *   - records: optional array of { rollNumber, status }
 */
const saveAttendanceSession = async (req, res) => {
  try {
    const {
      attendanceType,
      subjectCode,
      batch,
      date,
      slot,
      absentEnrollments,
      absentRolls,
      records,
      sessionId,
    } = req.body;

    const result = await attendanceService.saveAttendanceSession({
      attendanceType,
      subjectCode,
      batch,
      date,
      slot,
      absentEnrollments,
      absentRolls,
      records,
      sessionId,
      markedBy: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: `Attendance saved for ${result.attendanceType} ${result.subjectCode}${result.batch !== '—' ? ` Batch ${result.batch}` : ''}`,
      data: result,
    });
  } catch (err) {
    return handleError(err, res);
  }
};

/**
 * GET /api/attendance/history
 * Returns distinct attendance sessions sorted by date.
 */
const getAttendanceHistory = async (req, res) => {
  try {
    const filters = {};
    if (req.query.attendanceType) filters.attendanceType = req.query.attendanceType;
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;
    if (req.query.batch) filters.batch = req.query.batch;
    if (req.query.date) filters.date = req.query.date;

    const history = await attendanceService.getAttendanceHistory(filters);
    return res.json({ success: true, count: history.length, data: history });
  } catch (err) {
    return handleError(err, res);
  }
};

/**
 * GET /api/attendance/session/:sessionId
 * Returns full attendance records for a specific session.
 */
const getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const details = await attendanceService.getSessionDetails(sessionId);
    return res.json({ success: true, data: details });
  } catch (err) {
    return handleError(err, res);
  }
};

/**
 * GET /api/attendance/defaulters
 * Calculates defaulters (< 75%) respecting lecture vs practical contexts and batches.
 */
const getDefaulters = async (req, res) => {
  try {
    const filters = {};
    if (req.query.attendanceType) filters.attendanceType = req.query.attendanceType;
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;

    const result = await attendanceService.getDefaulters(filters);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(err, res);
  }
};

// ─── Backward Compatibility Handlers ──────────────────────────────────────────

const submitLectureAttendance = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { date, subjectCode, slot, absentEnrollments = [], absentRolls = [] } = req.body;
    const result = await attendanceService.saveAttendanceSession({
      attendanceType: 'LECTURE',
      subjectCode,
      batch: null,
      date,
      slot: slot || '10:30 - 11:30',
      sessionId: lectureId !== 'new' ? lectureId : undefined,
      absentEnrollments,
      absentRolls,
      markedBy: req.user?._id,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return handleError(err, res);
  }
};

const updateLectureAttendance = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { absentEnrollments = [], absentRolls = [], date, subjectCode, slot } = req.body;
    const result = await attendanceService.saveAttendanceSession({
      attendanceType: 'LECTURE',
      subjectCode,
      batch: null,
      date,
      slot,
      sessionId: lectureId,
      absentEnrollments,
      absentRolls,
      markedBy: req.user?._id,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(err, res);
  }
};

const getLectureAttendance = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const details = await attendanceService.getSessionDetails(lectureId);
    return res.json({ success: true, lectureId, count: details.records.length, data: details.records });
  } catch (err) {
    return handleError(err, res);
  }
};

module.exports = {
  getRoster,
  saveAttendanceSession,
  getAttendanceHistory,
  getSessionDetails,
  getDefaulters,
  submitLectureAttendance,
  updateLectureAttendance,
  getLectureAttendance,
};
