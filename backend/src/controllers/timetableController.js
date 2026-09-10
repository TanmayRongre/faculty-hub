/**
 * timetableController.js
 *
 * HTTP handlers for /api/timetable endpoints.
 */

const timetableService = require('../services/timetable/timetableService');
const Faculty = require('../models/Faculty');

/**
 * GET /api/timetable
 * Returns weekly timetable for faculty, student, or admin.
 */
const getTimetable = async (req, res) => {
  try {
    // If student, resolve based on student's own class
    if (req.user.role === 'student') {
      const data = await timetableService.getStudentTimetable(req.user.id);
      return res.json({ success: true, data });
    }

    // Faculty or admin
    const filters = {};
    if (req.query.faculty) filters.faculty = req.query.faculty;
    if (req.query.semester) filters.semester = req.query.semester;
    if (req.query.division) filters.division = req.query.division;
    if (req.query.department) filters.department = req.query.department;
    if (req.query.course) filters.course = req.query.course;

    // If faculty wants their own timetable by default
    if (req.user.role === 'faculty' && req.query.myTimetable === 'true') {
      const faculty = await Faculty.findOne({ userId: req.user.id }).lean();
      if (faculty) filters.faculty = faculty._id;
    }

    const data = await timetableService.getWeeklyTimetable(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Timetable] Get error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/timetable
 * Creates a new timetable slot (admin or authorized faculty).
 */
const createSlot = async (req, res) => {
  try {
    const slot = await timetableService.createTimetableSlot(req.body);
    res.status(201).json({ success: true, message: 'Timetable slot created successfully', data: slot });
  } catch (err) {
    console.error('[Timetable] Create error:', err.message);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      conflicts: err.conflicts,
    });
  }
};

/**
 * PUT /api/timetable/:id
 * Updates an existing timetable slot.
 */
const updateSlot = async (req, res) => {
  try {
    const slot = await timetableService.updateTimetableSlot(req.params.id, req.body);
    res.json({ success: true, message: 'Timetable slot updated successfully', data: slot });
  } catch (err) {
    console.error('[Timetable] Update error:', err.message);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      conflicts: err.conflicts,
    });
  }
};

/**
 * DELETE /api/timetable/:id
 * Deactivates a timetable slot.
 */
const deleteSlot = async (req, res) => {
  try {
    const result = await timetableService.deleteTimetableSlot(req.params.id);
    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[Timetable] Delete error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/timetable/faculty-assignments
 * Retrieves dynamic mapping of subjectCode -> assigned faculty.
 */
const getFacultyAssignments = async (req, res) => {
  try {
    const data = await timetableService.getFacultySubjectAssignments();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Timetable] Get faculty assignments error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getTimetable,
  createSlot,
  updateSlot,
  deleteSlot,
  getFacultyAssignments,
};
