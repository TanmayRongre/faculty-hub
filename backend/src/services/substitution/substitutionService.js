/**
 * substitutionService.js
 *
 * Core business logic for Faculty Leave Applications & Lecture/Practical Substitutions.
 * Handles validation, conflict detection, request lifecycle (Pending, Accepted, Rejected, Cancelled),
 * date-specific timetable overrides, and temporary session-level attendance access.
 */

const SubstitutionRequest = require('../../models/SubstitutionRequest');
const Faculty = require('../../models/Faculty');
const Subject = require('../../models/Subject');
const TimetableSlot = require('../../models/TimetableSlot');

/**
 * Converts "HH:mm" time string to minutes from midnight.
 */
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks if two time intervals [start1, end1) and [start2, end2) overlap.
 */
function checkTimeOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

/**
 * Checks if a substitute faculty member has a timetable or accepted substitution conflict.
 */
async function checkSubstituteConflict({ substituteFacultyId, date, startTime, endTime }) {
  // 1. Check if substitute faculty already has an accepted substitution at the same date and overlapping time
  const existingAccepted = await SubstitutionRequest.find({
    substituteFacultyId,
    date,
    status: 'accepted',
  }).lean();

  for (const sub of existingAccepted) {
    if (checkTimeOverlap(startTime, endTime, sub.startTime, sub.endTime)) {
      return {
        hasConflict: true,
        reason: `Selected substitute is already covering ${sub.subjectCode} (${sub.startTime}–${sub.endTime}) on this date`,
      };
    }
  }

  // 2. Check if substitute faculty has a permanent timetable slot on that weekday at overlapping time
  const dateObj = new Date(date + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[dateObj.getDay()];

  if (dayOfWeek !== 'Sunday') {
    const timetableConflicts = await TimetableSlot.find({
      faculty: substituteFacultyId,
      dayOfWeek,
      status: 'active',
    }).populate('subject', 'subjectCode').lean();

    for (const slot of timetableConflicts) {
      if (checkTimeOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
        return {
          hasConflict: true,
          reason: `Selected substitute has their own scheduled class (${slot.subjectCode || 'Slot'} from ${slot.startTime} to ${slot.endTime}) on ${dayOfWeek}s`,
        };
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Creates a new Faculty Leave / Substitution request.
 */
async function createSubstitutionRequest(data, applicantUser) {
  const {
    substituteFacultyId,
    subjectCode,
    subjectName,
    date,
    startTime,
    endTime,
    sessionType,
    batch,
    room,
    reason,
  } = data;

  // Resolve applicant faculty profile
  const applicantFaculty = await Faculty.findOne({ userId: applicantUser._id });
  if (!applicantFaculty && applicantUser.role !== 'admin') {
    const err = new Error('Applicant must have an active faculty profile');
    err.statusCode = 403;
    throw err;
  }
  const applicantId = applicantFaculty ? applicantFaculty._id : data.applicantId;

  if (String(applicantId) === String(substituteFacultyId)) {
    const err = new Error('You cannot select yourself as a substitute faculty');
    err.statusCode = 400;
    throw err;
  }

  // Validate substitute faculty exists and is active
  const substituteFaculty = await Faculty.findById(substituteFacultyId);
  if (!substituteFaculty || substituteFaculty.status === 'inactive') {
    const err = new Error('Selected substitute faculty is not active');
    err.statusCode = 404;
    throw err;
  }

  // Validate sessionType & batch
  const cleanType = String(sessionType).toUpperCase();
  if (!['LECTURE', 'PRACTICAL'].includes(cleanType)) {
    const err = new Error('Session type must be LECTURE or PRACTICAL');
    err.statusCode = 400;
    throw err;
  }

  const cleanBatch = cleanType === 'PRACTICAL' ? (batch ? String(batch).toUpperCase() : null) : null;
  if (cleanType === 'PRACTICAL' && !['A', 'B', 'C'].includes(cleanBatch)) {
    const err = new Error('Practical substitution requires a valid batch (A, B, or C)');
    err.statusCode = 400;
    throw err;
  }

  // Check for duplicate pending/accepted substitution for the exact same session
  const duplicateQuery = {
    date,
    startTime,
    subjectCode: subjectCode.toUpperCase(),
    status: { $in: ['pending', 'accepted'] },
  };
  if (cleanBatch) duplicateQuery.batch = cleanBatch;

  const existingDuplicate = await SubstitutionRequest.findOne(duplicateQuery);
  if (existingDuplicate) {
    const err = new Error(
      `A substitution request for this session is already ${existingDuplicate.status}. Duplicate requests are not permitted.`
    );
    err.statusCode = 409;
    throw err;
  }

  // Check for scheduling conflict on substitute faculty
  const conflict = await checkSubstituteConflict({
    substituteFacultyId,
    date,
    startTime,
    endTime,
  });

  if (conflict.hasConflict) {
    const err = new Error(`Timetable conflict: ${conflict.reason}`);
    err.statusCode = 409;
    throw err;
  }

  // Create record
  const request = await SubstitutionRequest.create({
    applicantId,
    substituteFacultyId,
    subjectCode: subjectCode.toUpperCase(),
    subjectName: subjectName || subjectCode.toUpperCase(),
    date,
    startTime,
    endTime,
    sessionType: cleanType,
    batch: cleanBatch,
    room,
    reason,
    status: 'pending',
  });

  return await request.populate([
    { path: 'applicantId', select: 'fullName designation email phone' },
    { path: 'substituteFacultyId', select: 'fullName designation email phone' },
  ]);
}

/**
 * Substitute faculty accepts or rejects a pending substitution request.
 */
async function respondToSubstitutionRequest(requestId, user, action, rejectionReason = '') {
  const request = await SubstitutionRequest.findById(requestId)
    .populate('applicantId', 'fullName designation email')
    .populate('substituteFacultyId', 'fullName designation email');

  if (!request) {
    const err = new Error('Substitution request not found');
    err.statusCode = 404;
    throw err;
  }

  // Authorize: user must be the substitute faculty (or admin)
  if (user.role !== 'admin') {
    const faculty = await Faculty.findOne({ userId: user._id });
    if (!faculty || String(faculty._id) !== String(request.substituteFacultyId._id)) {
      const err = new Error('You are not authorized to respond to this substitution request');
      err.statusCode = 403;
      throw err;
    }
  }

  if (request.status !== 'pending') {
    const err = new Error(`Request has already been ${request.status}`);
    err.statusCode = 400;
    throw err;
  }

  const cleanAction = String(action).toLowerCase();
  if (!['accept', 'reject'].includes(cleanAction)) {
    const err = new Error('Action must be accept or reject');
    err.statusCode = 400;
    throw err;
  }

  if (cleanAction === 'accept') {
    // Re-verify conflicts to prevent race condition
    const conflict = await checkSubstituteConflict({
      substituteFacultyId: request.substituteFacultyId._id,
      date: request.date,
      startTime: request.startTime,
      endTime: request.endTime,
    });
    if (conflict.hasConflict) {
      const err = new Error(`Cannot accept: ${conflict.reason}`);
      err.statusCode = 409;
      throw err;
    }

    request.status = 'accepted';
    request.respondedAt = new Date();
  } else {
    request.status = 'rejected';
    request.rejectionReason = rejectionReason || 'Declined by substitute faculty';
    request.respondedAt = new Date();
  }

  await request.save();
  return request;
}

/**
 * Cancels a substitution request (Applicant faculty or Admin).
 */
async function cancelSubstitutionRequest(requestId, user, cancelReason = '') {
  const request = await SubstitutionRequest.findById(requestId);
  if (!request) {
    const err = new Error('Substitution request not found');
    err.statusCode = 404;
    throw err;
  }

  // Only applicant faculty or Admin can cancel
  if (user.role !== 'admin') {
    const faculty = await Faculty.findOne({ userId: user._id });
    if (!faculty || String(faculty._id) !== String(request.applicantId)) {
      const err = new Error('Only the applicant faculty or Admin can cancel this request');
      err.statusCode = 403;
      throw err;
    }
  }

  if (request.status === 'cancelled') {
    const err = new Error('Request is already cancelled');
    err.statusCode = 400;
    throw err;
  }

  request.status = 'cancelled';
  request.cancelledBy = user._id;
  request.cancelledAt = new Date();
  request.rejectionReason = cancelReason || 'Cancelled by applicant or administrator';
  await request.save();

  return request;
}

/**
 * Retrieves substitution requests with flexible filtering.
 */
async function getSubstitutionRequests(filters = {}) {
  const query = {};

  if (filters.applicantId) query.applicantId = filters.applicantId;
  if (filters.substituteFacultyId) query.substituteFacultyId = filters.substituteFacultyId;
  if (filters.status) query.status = filters.status;
  if (filters.date) query.date = filters.date;
  if (filters.subjectCode) query.subjectCode = filters.subjectCode.toUpperCase();

  const requests = await SubstitutionRequest.find(query)
    .populate('applicantId', 'fullName designation email phone')
    .populate('substituteFacultyId', 'fullName designation email phone')
    .sort({ date: 1, startTime: 1 })
    .lean();

  return requests;
}

/**
 * Retrieves all active ACCEPTED substitutions for a specific calendar date.
 * Used for date-specific timetable overrides.
 */
async function getActiveSubstitutionsForDate(date) {
  if (!date) return [];

  const substitutions = await SubstitutionRequest.find({
    date,
    status: 'accepted',
  })
    .populate('applicantId', 'fullName designation')
    .populate('substituteFacultyId', 'fullName designation')
    .lean();

  return substitutions;
}

/**
 * Verifies if a faculty member has an active ACCEPTED substitution for a session.
 * Used by attendance authorization middleware.
 */
async function checkSubstitutePermission({ facultyId, subjectCode, date, batch }) {
  if (!facultyId || !subjectCode || !date) return false;

  const query = {
    substituteFacultyId: facultyId,
    subjectCode: subjectCode.toUpperCase(),
    date,
    status: 'accepted',
  };

  // If batch specified (practical), ensure batch matches or is common
  if (batch) {
    query.$or = [{ batch: String(batch).toUpperCase() }, { batch: null }];
  }

  const activeSub = await SubstitutionRequest.findOne(query);
  return Boolean(activeSub);
}

module.exports = {
  createSubstitutionRequest,
  respondToSubstitutionRequest,
  cancelSubstitutionRequest,
  getSubstitutionRequests,
  getActiveSubstitutionsForDate,
  checkSubstitutePermission,
  checkSubstituteConflict,
};
