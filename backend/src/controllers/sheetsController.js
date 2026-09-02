/**
 * sheetsController.js
 *
 * HTTP controllers for the Google Sheets academic data endpoints.
 *
 * Authorization model:
 *   - GET /marks/:studentId, /attendance/:studentId  → student (own) | faculty | admin
 *   - GET /marks, /attendance                        → faculty | admin
 *   - POST /marks                                    → faculty | admin
 *   - POST /attendance                               → faculty | admin
 *   - POST /sync                                     → admin only
 *   - GET /status                                    → admin only
 *   - POST /initialise                               → admin only
 *
 * The middleware stack (authenticate + authorize) is applied in the router.
 * This controller only handles business logic and response shaping.
 */

const { checkConfiguration } = require('../integrations/googleSheets/googleSheetsClient');
const academicDataService = require('../integrations/googleSheets/academicDataService');
const { GoogleSheetsError } = require('../integrations/googleSheets/errors');
const Student = require('../models/Student');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleSheetsError(err, res) {
  if (err.isOperational) {
    const innerCode = err.originalCode;
    // Auth errors (missing/invalid credentials) → 503 Service Unavailable
    // so callers can distinguish "service not available" from "server error"
    const AUTH_CODE = err.code === 'SHEETS_AUTH_ERROR' || err.code === 'SHEETS_NETWORK_ERROR';
    let httpStatus;
    if (AUTH_CODE) {
      httpStatus = 503;
    } else {
      httpStatus = [400, 403, 404, 409, 422, 429, 503].includes(innerCode) ? innerCode : 500;
    }
    return res.status(httpStatus).json({ success: false, message: err.message, code: err.code });
  }
  console.error('[SheetsController] Unexpected error:', err.message);
  return res.status(500).json({ success: false, message: 'An internal error occurred' });
}

/**
 * Resolves a studentId (MongoDB _id) to an enrollmentNumber.
 * Also validates the student exists.
 */
async function resolveEnrollment(studentId) {
  const student = await Student.findById(studentId).select('enrollmentNumber').lean();
  if (!student) return null;
  return student.enrollmentNumber;
}

// ─── Status & Administration ──────────────────────────────────────────────────

/**
 * GET /api/sheets/status
 * Returns Google Sheets configuration and connection status.
 * Admin only.
 */
async function getStatus(req, res) {
  try {
    const config = checkConfiguration();
    if (!config.configured) {
      return res.status(200).json({
        success: true,
        configured: false,
        missing: config.missing,
        connected: false,
        message: 'Google Sheets is not configured. Set the missing environment variables.',
      });
    }

    const status = await academicDataService.getConnectionStatus();
    return res.json({ success: true, configured: true, ...status });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

/**
 * POST /api/sheets/initialise
 * Creates required worksheets with headers if they don't already exist.
 * Admin only.
 */
async function initialiseSpreadsheet(req, res) {
  try {
    const config = checkConfiguration();
    if (!config.configured) {
      return res.status(503).json({
        success: false,
        message: 'Google Sheets is not configured. Set the missing environment variables.',
        missing: config.missing,
      });
    }
    console.log('[Sheets] Initialisation started');
    const result = await academicDataService.initialiseSpreadsheet();
    console.log('[Sheets] Initialisation completed');
    return res.json({ success: true, message: 'Spreadsheet initialised', sheets: result });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

// ─── Student Synchronisation ──────────────────────────────────────────────────

/**
 * POST /api/sheets/sync
 * Syncs all MongoDB students to the Google Sheets Students tab.
 * Admin only.
 */
async function syncStudents(req, res) {
  try {
    const config = checkConfiguration();
    if (!config.configured) {
      return res.status(503).json({
        success: false,
        message: 'Google Sheets is not configured.',
        missing: config.missing,
      });
    }

    const students = await Student.find({})
      .populate('department', 'name')
      .populate('course', 'name')
      .lean();

    console.log(`[Sheets] Sync started: ${students.length} students`);
    const result = await academicDataService.syncStudentsToSheet(students);
    console.log(`[Sheets] Sync completed: ${result.processed} processed`);

    return res.json({
      success: true,
      message: `Synchronised ${result.processed} student records`,
      ...result,
    });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

/**
 * POST /api/sheets/sync/:studentId
 * Syncs a single student record to the Students sheet.
 * Admin only.
 */
async function syncSingleStudent(req, res) {
  try {
    const student = await Student.findById(req.params.studentId)
      .populate('department', 'name')
      .populate('course', 'name')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const result = await academicDataService.syncStudentToSheet(student);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

// ─── Marks ────────────────────────────────────────────────────────────────────

/**
 * GET /api/sheets/marks/:studentId
 * Returns marks for a specific student.
 * - Student: can only view own data (req.user.id must match student's userId).
 * - Faculty/Admin: any student.
 */
async function getStudentMarks(req, res) {
  try {
    const student = await Student.findById(req.params.studentId)
      .select('enrollmentNumber userId')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Students can only access their own data
    if (req.user.role === 'student') {
      if (!student.userId || student.userId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const filters = {};
    if (req.query.semester) filters.semester = req.query.semester;
    if (req.query.academicYear) filters.academicYear = req.query.academicYear;
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;

    const marks = await academicDataService.getMarksByEnrollment(student.enrollmentNumber, filters);
    return res.json({ success: true, enrollmentNumber: student.enrollmentNumber, count: marks.length, marks });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

/**
 * GET /api/sheets/marks/me
 * Returns marks for the authenticated student.
 */
async function getMyMarks(req, res) {
  try {
    const student = await Student.findOne({ userId: req.user.id }).select('enrollmentNumber').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const filters = {};
    if (req.query.semester) filters.semester = req.query.semester;
    if (req.query.academicYear) filters.academicYear = req.query.academicYear;
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;

    const marks = await academicDataService.getMarksByEnrollment(student.enrollmentNumber, filters);
    return res.json({ success: true, enrollmentNumber: student.enrollmentNumber, count: marks.length, marks });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

/**
 * GET /api/sheets/marks
 * Returns all marks records (faculty/admin).
 */
async function getAllMarks(req, res) {
  try {
    const filters = {};
    if (req.query.semester) filters.semester = req.query.semester;
    if (req.query.academicYear) filters.academicYear = req.query.academicYear;
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;

    const marks = await academicDataService.getAllMarks(filters);
    return res.json({ success: true, count: marks.length, marks });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

/**
 * POST /api/sheets/marks
 * Writes marks for a student+subject (faculty/admin).
 * Body: { enrollmentNumber, rollNumber?, subjectCode, subjectName?, PA1?, PA2?, Test1?, Test2?, academicYear, semester }
 */
async function writeMarks(req, res) {
  try {
    const result = await academicDataService.writeMarks(req.body);
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.isOperational) {
      return res.status(422).json({ success: false, message: err.message, code: err.code });
    }
    return handleSheetsError(err, res);
  }
}

// ─── Attendance ───────────────────────────────────────────────────────────────

/**
 * GET /api/sheets/attendance/:studentId
 * Returns attendance for a specific student.
 * Student: own data only.
 */
async function getStudentAttendance(req, res) {
  try {
    const student = await Student.findById(req.params.studentId)
      .select('enrollmentNumber userId')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (req.user.role === 'student') {
      if (!student.userId || student.userId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;
    if (req.query.date) filters.date = req.query.date;

    const records = await academicDataService.getAttendanceByEnrollment(student.enrollmentNumber, filters);
    const stats = academicDataService.computeAttendanceStats(records);

    return res.json({
      success: true,
      enrollmentNumber: student.enrollmentNumber,
      count: records.length,
      attendance: records,
      stats,
    });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

/**
 * GET /api/sheets/attendance/me
 * Returns attendance for the authenticated student.
 */
async function getMyAttendance(req, res) {
  try {
    const student = await Student.findOne({ userId: req.user.id }).select('enrollmentNumber').lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;
    if (req.query.date) filters.date = req.query.date;

    const records = await academicDataService.getAttendanceByEnrollment(student.enrollmentNumber, filters);
    const stats = academicDataService.computeAttendanceStats(records);

    return res.json({
      success: true,
      enrollmentNumber: student.enrollmentNumber,
      count: records.length,
      attendance: records,
      stats,
    });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

/**
 * GET /api/sheets/attendance
 * Returns all attendance records (faculty/admin).
 */
async function getAllAttendance(req, res) {
  try {
    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;
    if (req.query.date) filters.date = req.query.date;
    if (req.query.lectureId) filters.lectureId = req.query.lectureId;

    const records = await academicDataService.getAllAttendance(filters);
    return res.json({ success: true, count: records.length, attendance: records });
  } catch (err) {
    return handleSheetsError(err, res);
  }
}

/**
 * POST /api/sheets/attendance
 * Writes a batch of attendance records (faculty/admin).
 * Body: { records: [{ date, lectureId, subjectCode, enrollmentNumber, rollNumber, status }] }
 */
async function writeAttendance(req, res) {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'records array is required' });
    }
    const result = await academicDataService.writeAttendanceBatch(records);
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.isOperational) {
      return res.status(422).json({ success: false, message: err.message, code: err.code });
    }
    return handleSheetsError(err, res);
  }
}

module.exports = {
  getStatus,
  initialiseSpreadsheet,
  syncStudents,
  syncSingleStudent,
  getStudentMarks,
  getMyMarks,
  getAllMarks,
  writeMarks,
  getStudentAttendance,
  getMyAttendance,
  getAllAttendance,
  writeAttendance,
};
