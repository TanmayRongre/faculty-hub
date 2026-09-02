/**
 * attendanceController.js
 *
 * HTTP layer for all attendance operations.
 * Delegates all business logic to attendanceService.
 * Enforces authorization via middleware.
 */

const Student = require('../models/Student');
const attendanceService = require('../services/attendance/attendanceService');
const { ATTENDANCE_CONFIG } = require('../services/attendance/attendanceCalculator');

// ─── Faculty / Admin ──────────────────────────────────────────────────────────

/**
 * POST /api/attendance/lecture/:lectureId
 * Submit attendance for a lecture session.
 * Present-by-default — only absent students are submitted.
 */
const submitLectureAttendance = async (req, res) => {
  try {
    const { lectureId: paramLectureId } = req.params;
    const {
      date,
      subjectCode,
      division = 'A',
      semester = 5,
      slot,
      absentEnrollments = [],
    } = req.body;

    if (!date) return res.status(400).json({ success: false, message: 'date is required' });
    if (!subjectCode) return res.status(400).json({ success: false, message: 'subjectCode is required' });

    const result = await attendanceService.submitAttendance({
      date,
      subjectCode,
      division,
      semester,
      slot,
      lectureId: paramLectureId !== 'new' ? paramLectureId : undefined,
      absentEnrollments,
      facultyId: req.user.id,
    });

    res.status(201).json({ success: true, message: `Attendance ${result.action} successfully`, data: result });
  } catch (err) {
    console.error('[Attendance] Submit error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Failed to save attendance' });
  }
};

/**
 * PUT /api/attendance/lecture/:lectureId
 * Edit/update an existing lecture's attendance.
 */
const updateLectureAttendance = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const { absentEnrollments = [] } = req.body;

    if (!lectureId) return res.status(400).json({ success: false, message: 'lectureId is required' });

    const result = await attendanceService.updateAttendance({
      lectureId,
      absentEnrollments,
    });

    res.json({ success: true, message: 'Attendance updated successfully', data: result });
  } catch (err) {
    console.error('[Attendance] Update error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Failed to update attendance' });
  }
};

/**
 * GET /api/attendance/lecture/:lectureId
 */
const getLectureAttendance = async (req, res) => {
  try {
    const { lectureId } = req.params;
    const records = await attendanceService.getLectureAttendance(lectureId);
    res.json({ success: true, lectureId, count: records.length, data: records });
  } catch (err) {
    console.error('[Attendance] Get lecture error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/attendance/class
 */
const getClassAttendance = async (req, res) => {
  try {
    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode.toUpperCase();
    if (req.query.date) filters.date = req.query.date;
    if (req.query.lectureId) filters.lectureId = req.query.lectureId;
    if (req.query.semester) filters.semester = req.query.semester;

    const result = await attendanceService.getClassAttendance(filters);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Attendance] Get class error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/attendance/matrix
 * Returns attendance matrix (Students rows × Lectures columns).
 */
const getAttendanceMatrix = async (req, res) => {
  try {
    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode.toUpperCase();
    if (req.query.semester) filters.semester = req.query.semester;

    const result = await attendanceService.getAttendanceMatrix(filters);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Attendance] Matrix error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/attendance/student/:studentId
 */
const getStudentAttendanceById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId)
      .select('enrollmentNumber')
      .lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;

    const result = await attendanceService.getStudentAttendance(student.enrollmentNumber, filters);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Attendance] Get student error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/attendance/defaulters
 */
const getDefaulters = async (req, res) => {
  try {
    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode.toUpperCase();
    if (req.query.semester) filters.semester = req.query.semester;

    const result = await attendanceService.getDefaulters(filters);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Attendance] Defaulters error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// ─── Student (own data) ───────────────────────────────────────────────────────

/**
 * GET /api/attendance/me
 */
const getMyAttendance = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user.id })
      .select('enrollmentNumber')
      .lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;

    const result = await attendanceService.getStudentAttendance(student.enrollmentNumber, filters);
    res.json({
      success: true,
      studentName: req.user.name,
      enrollmentNumber: student.enrollmentNumber,
      defaulterThreshold: ATTENDANCE_CONFIG.DEFAULTER_THRESHOLD_PERCENT,
      data: result,
    });
  } catch (err) {
    console.error('[Attendance] Me error:', err.message);
    const status = err.statusCode || 503;
    res.status(status).json({ success: false, message: err.message || 'Attendance service unavailable' });
  }
};

/**
 * GET /api/attendance/summary
 */
const getAttendanceSummary = async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user.id }).select('enrollmentNumber').lean();
      if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
      const result = await attendanceService.getStudentAttendance(student.enrollmentNumber);
      return res.json({ success: true, data: result });
    }

    // Faculty / admin
    const filters = {};
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode.toUpperCase();
    if (req.query.date) filters.date = req.query.date;
    const result = await attendanceService.getClassAttendance(filters);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Attendance] Summary error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
  submitLectureAttendance,
  updateLectureAttendance,
  getLectureAttendance,
  getClassAttendance,
  getAttendanceMatrix,
  getStudentAttendanceById,
  getDefaulters,
  getMyAttendance,
  getAttendanceSummary,
};
