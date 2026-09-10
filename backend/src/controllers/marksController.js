/**
 * marksController.js
 *
 * HTTP handlers for marks API endpoints:
 *   GET  /api/marks/me                      → student (own marks only)
 *   GET  /api/marks/student/:studentId      → faculty | admin
 *   GET  /api/marks/subject/:subjectCode    → faculty | admin (full 68-student roster for subject)
 *   GET  /api/marks                         → faculty | admin
 *   PUT  /api/marks/batch                   → faculty | admin (SAVE ALL - one batch request)
 *   PUT  /api/marks/bulk                    → faculty | admin (backward compat alias)
 *   PUT  /api/marks/:studentId/:subjectCode → faculty | admin (single update)
 *   POST /api/marks/reset                   → admin (reset all marks)
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
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || undefined,
    });
  }
  if (
    err.message &&
    (err.message.includes('exceed') ||
      err.message.includes('negative') ||
      err.message.includes('between') ||
      err.message.includes('valid number'))
  ) {
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
 * Student sees their own marks (PA1, PA2, Average).
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
    const data = await marksService.getStudentMarks(studentProfile.enrollmentNumber, filters);

    return res.json({
      success: true,
      enrollmentNumber: studentProfile.enrollmentNumber,
      studentName: studentProfile.fullName,
      student: data.student,
      records: data.records,
      summary: data.summary,
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
    const filters = extractFilters(req.query);
    const data = await marksService.getStudentMarks(studentId, filters);

    return res.json({
      success: true,
      student: data.student,
      records: data.records,
      summary: data.summary,
    });
  } catch (err) {
    return handleError(err, res);
  }
}

// ─── Faculty/Admin: marks for a specific subject (68 students) ─────────────────

/**
 * GET /api/marks/subject/:subjectCode
 */
async function getSubjectMarks(req, res) {
  try {
    const { subjectCode } = req.params;
    const { batch, type } = req.query;
    const result = await marksService.getSubjectMarks(subjectCode, { batch, type });
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(err, res);
  }
}

// ─── Faculty/Admin: all marks overview ────────────────────────────────────────

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

// ─── Faculty/Admin: bulk update (SAVE ALL) ────────────────────────────────────

/**
 * PUT /api/marks/batch or PUT /api/marks/bulk
 * Body: { subject: 'STE', marks: [...], type: 'PA'|'PRACTICAL', batch: 'A'|'B'|'C', academicYear, semester }
 */
async function bulkUpdateMarks(req, res) {
  try {
    const { subject, subjectCode, marks, type, batch, academicYear, semester } = req.body;
    const sub = subject || subjectCode;

    if (!sub) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }

    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ success: false, message: 'Marks array is required' });
    }

    const result = await marksService.bulkUpdateMarks({
      subject: sub,
      marks,
      type,
      batch,
      academicYear: academicYear || '2026-2027',
      semester: semester || 5,
    });

    return res.json({
      success: true,
      message: `Successfully saved marks for ${result.processed} students in ${result.subject}`,
      subject: result.subject,
      type: result.type,
      processed: result.processed,
      results: result.results,
    });
  } catch (err) {
    return handleError(err, res);
  }
}

// ─── Faculty/Admin: single mark update ────────────────────────────────────────

/**
 * PUT /api/marks/:studentId/:subjectCode
 */
async function updateMarks(req, res) {
  try {
    const { studentId, subjectCode } = req.params;
    const { pa1, pa2, PA1, PA2, academicYear, semester } = req.body;

    const result = await marksService.updateMarks(studentId, subjectCode, {
      pa1: pa1 !== undefined ? pa1 : PA1,
      pa2: pa2 !== undefined ? pa2 : PA2,
      academicYear: academicYear || '2026-2027',
      semester: semester || 5,
    });

    return res.json({
      success: true,
      message: 'Marks updated successfully',
      result,
    });
  } catch (err) {
    return handleError(err, res);
  }
}

// ─── Admin: reset all marks ───────────────────────────────────────────────────

/**
 * POST /api/marks/reset
 */
async function resetMarks(req, res) {
  try {
    const result = await marksService.resetAllMarks();
    return res.json({
      success: true,
      message: `All marks records deleted (${result.deletedCount} records wiped)`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    return handleError(err, res);
  }
}

module.exports = {
  getMyMarks,
  getStudentMarks,
  getSubjectMarks,
  getAllMarks,
  updateMarks,
  bulkUpdateMarks,
  resetMarks,
};
