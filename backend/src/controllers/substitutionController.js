/**
 * substitutionController.js
 *
 * HTTP request handlers for Faculty Leave & Substitution endpoints.
 */

const substitutionService = require('../services/substitution/substitutionService');
const Faculty = require('../models/Faculty');

/**
 * POST /api/substitutions
 * Create a new leave & substitution request.
 */
const createSubstitution = async (req, res) => {
  try {
    const request = await substitutionService.createSubstitutionRequest(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Substitution request submitted successfully',
      data: request,
    });
  } catch (err) {
    console.error('[Substitution] Create error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/substitutions/:id/respond
 * Substitute faculty accepts or rejects a request.
 */
const respondSubstitution = async (req, res) => {
  try {
    const { action, reason } = req.body;
    const request = await substitutionService.respondToSubstitutionRequest(
      req.params.id,
      req.user,
      action,
      reason
    );
    res.json({
      success: true,
      message: `Substitution request ${request.status}`,
      data: request,
    });
  } catch (err) {
    console.error('[Substitution] Respond error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/substitutions/:id/cancel
 * Applicant faculty or Admin cancels a substitution request.
 */
const cancelSubstitution = async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await substitutionService.cancelSubstitutionRequest(
      req.params.id,
      req.user,
      reason
    );
    res.json({
      success: true,
      message: 'Substitution request cancelled',
      data: request,
    });
  } catch (err) {
    console.error('[Substitution] Cancel error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/substitutions/my-requests
 * Retrieves leave applications submitted by the logged-in faculty.
 */
const getMyApplications = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.json({ success: true, data: [] });
    }
    const data = await substitutionService.getSubstitutionRequests({
      applicantId: faculty._id,
      status: req.query.status,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Substitution] Get applications error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve applications' });
  }
};

/**
 * GET /api/substitutions/received
 * Retrieves substitution requests sent to the logged-in faculty.
 */
const getReceivedRequests = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.json({ success: true, data: [] });
    }
    const data = await substitutionService.getSubstitutionRequests({
      substituteFacultyId: faculty._id,
      status: req.query.status || 'pending',
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Substitution] Get received error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve received requests' });
  }
};

/**
 * GET /api/substitutions/my-substitutions
 * Retrieves sessions accepted by the logged-in faculty (active coverage).
 */
const getMySubstitutions = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.json({ success: true, data: [] });
    }
    const data = await substitutionService.getSubstitutionRequests({
      substituteFacultyId: faculty._id,
      status: 'accepted',
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Substitution] Get my substitutions error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve active substitutions' });
  }
};

/**
 * GET /api/substitutions/all
 * Admin management view for all substitution requests.
 */
const getAllSubstitutions = async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.date) filters.date = req.query.date;
    if (req.query.subjectCode) filters.subjectCode = req.query.subjectCode;

    const data = await substitutionService.getSubstitutionRequests(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Substitution] Admin get all error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve substitution records' });
  }
};

/**
 * GET /api/substitutions/by-date
 * Retrieves active accepted substitutions for a calendar date (used by timetable).
 */
const getDateSubstitutions = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date query parameter is required (YYYY-MM-DD)' });
    }
    const data = await substitutionService.getActiveSubstitutionsForDate(date);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Substitution] Get date substitutions error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve date substitutions' });
  }
};

module.exports = {
  createSubstitution,
  respondSubstitution,
  cancelSubstitution,
  getMyApplications,
  getReceivedRequests,
  getMySubstitutions,
  getAllSubstitutions,
  getDateSubstitutions,
};
