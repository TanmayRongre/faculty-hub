/**
 * marksController.js
 *
 * HTTP handlers for marks API endpoints:
 *   GET /api/marks/me                      → student (own marks only)
 *   GET /api/marks/student/:studentId      → faculty | admin
 *   GET /api/marks                         → faculty | admin
 *   PUT /api/marks/bulk                    → faculty | admin (SAVE ALL)
 *   PUT /api/marks/:studentId/:subjectCode → faculty | admin
 */

const Student = require('../models/Student');
const marksService = require('../services/marks/marksService');

function handleError(err, res) {
  if (err.isOperational) {
    const AUTH_ERROR = err.code === 'SHEETS_AUTH_ERROR' || err.code === 'SHEETS_NETWORK_ERROR';
    const status = AUTH_ERROR ? 503 : (err.statusCode || 500);
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  if (err.message && (err.message.includes('exceed') || err.message.includes('negative') || err.message.includes('number'))) {
    return res.status(422).json({ success: false, message: err.message });
  }
  console.error('[MarksController] Unexpected error:', err);
  return res.status(500).json({ success: false, message: 'An internal error occurred' });
}

function extractFilters(query) {
  const filters = {};
  if (query.semester) filters.semester = query.semester;
  if (query.academicYear) filters.academicYear = query.academicYear;
  if (query.subjectCode) filters.subjectCode = query.subjectCode;
  return filters;
}

// ─── Student: own marks ───────────────────────────────────────────────────────

/**
 * GET /api/marks/me
 * Student sees their own marks (PA / 30).
 */
async function getMyMarks(req, res) {
  try {
    const studentProfile = await Student.findOne({ userId: req.user._id })
      .select('enrollmentNumber rollNumber fullName')
      .lean();

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not linked to this account. Contact admin.',
      });
    }

    const filters = extractFilters(req.query);
    const { records, summary } = await marksService.getStudentMarks(
      studentProfile.enrollmentNumber,
      filters
    );

    return res.json({
      success: true,
      enrollmentNumber: studentProfile.enrollmentNumber,
      studentName: studentProfile.fullName,
      records,
      summary,
    });
  } catch (err) {
    return handleError(err, res);
  }
}

// ─── Faculty/Admin: specific student marks ────────────────────────────────────

/**
 * GET /api/marks/student/:studentId
 */
async function getStudentMarks(req, res) {
  try {
    const { studentId } = req.params;
    const student = await marksService.resolveStudent(studentId);
    const filters = extractFilters(req.query);
    const { records, summary } = await marksService.getStudentMarks(
      student.enrollmentNumber,
      filters
    );

    return res.json({
      success: true,
      enrollmentNumber: student.enrollmentNumber,
      studentName: student.fullName,
      records,
      summary,
    });
  } catch (err) {
    return handleError(err, res);
  }
}

// ─── Faculty/Admin: all marks ─────────────────────────────────────────────────

/**
 * GET /api/marks
 */
async function getAllMarks(req, res) {
  try {
    const filters = extractFilters(req.query);
    const records = await marksService.getAllMarks(filters);
    return res.json({ success: true, count: records.length, records });
  } catch (err) {
    return handleError(err, res);
  }
}

// ─── Faculty/Admin: single mark update ────────────────────────────────────────

/**
 * PUT /api/marks/:studentId/:subjectCode
 * Body: { PA, academicYear, semester }
 */
async function updateMarks(req, res) {
  try {
    const { studentId, subjectCode } = req.params;
    const { PA, academicYear, semester } = req.body;

    const result = await marksService.updateMarks(studentId, subjectCode, {
      PA,
      academicYear: academicYear || '2026-2027',
      semester: semester || 5,
    });

    return res.json({
      success: true,
      message: `Marks ${result.action} successfully`,
      action: result.action,
      enrollmentNumber: result.enrollmentNumber,
      subjectCode: result.subjectCode,
      PA: result.PA,
      calculated: result.calculated,
    });
  } catch (err) {
    return handleError(err, res);
  }
}

// ─── Faculty/Admin: bulk update (SAVE ALL) ────────────────────────────────────

/**
 * PUT /api/marks/bulk
 * Body: { marks: [{ enrollmentNumber, subjectCode, PA }], academicYear, semester }
 */
async function bulkUpdateMarks(req, res) {
  try {
    const { marks, academicYear, semester } = req.body;
    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ success: false, message: 'Marks array is required' });
    }

    const result = await marksService.bulkUpdateMarks(
      marks,
      academicYear || '2026-2027',
      semester || 5
    );

    return res.json({
      success: true,
      message: `Successfully saved marks for ${result.processed} entries`,
      processed: result.processed,
      results: result.results,
    });
  } catch (err) {
    return handleError(err, res);
  }
}

module.exports = {
  getMyMarks,
  getStudentMarks,
  getAllMarks,
  updateMarks,
  bulkUpdateMarks,
};
