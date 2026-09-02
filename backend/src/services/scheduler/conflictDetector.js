/**
 * conflictDetector.js
 *
 * Deterministic scheduling conflict detection logic for FacultyHub.
 * Detects:
 *   1. Faculty conflicts (same faculty, overlapping time)
 *   2. Division/Class conflicts (same semester & division, overlapping time)
 *   3. Room conflicts (same room, overlapping time)
 *
 * Used by Timetable management, Dynamic Lecture scheduling, and Holiday Rescheduling.
 */

const TimetableSlot = require('../../models/TimetableSlot');
const Lecture = require('../../models/Lecture');

/**
 * Converts "HH:mm" time string to minutes from midnight.
 * e.g., "09:30" -> 570
 */
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks if two time intervals [start1, end1) and [start2, end2) overlap.
 * Both times in "HH:mm" format.
 */
function checkTimeOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  // Overlap occurs if start of one is before end of other for both
  return s1 < e2 && s2 < e1;
}

/**
 * Validates that startTime and endTime are valid and endTime > startTime.
 */
function validateTimeRange(startTime, endTime) {
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  if (e <= s) {
    const err = new Error('End time must be strictly after start time');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Detects conflicts for a weekly Timetable Slot.
 *
 * @param {object} params
 * @param {string|ObjectId} params.faculty
 * @param {number} params.semester
 * @param {string} params.division
 * @param {string} [params.room]
 * @param {string} params.dayOfWeek
 * @param {string} params.startTime
 * @param {string} params.endTime
 * @param {string|ObjectId} [params.excludeSlotId]
 * @returns {Promise<{ hasConflict: boolean, conflicts: string[] }>}
 */
async function detectTimetableConflicts(params) {
  const {
    faculty,
    semester,
    division,
    room,
    dayOfWeek,
    startTime,
    endTime,
    excludeSlotId,
  } = params;

  validateTimeRange(startTime, endTime);

  const query = {
    dayOfWeek,
    status: 'active',
  };
  if (excludeSlotId) {
    query._id = { $ne: excludeSlotId };
  }

  // Find all active slots on this day
  const candidateSlots = await TimetableSlot.find(query)
    .populate('faculty', 'name employeeId')
    .populate('subject', 'subjectName subjectCode')
    .lean();

  const conflicts = [];

  for (const slot of candidateSlots) {
    // Only check if time intervals overlap
    if (!checkTimeOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
      continue;
    }

    const slotSubj = slot.subject?.subjectCode || slot.subjectCode || 'Subject';
    const slotFaculty = slot.faculty?.name || 'Faculty';

    // 1. Faculty conflict
    if (String(slot.faculty?._id || slot.faculty) === String(faculty)) {
      conflicts.push(
        `Faculty conflict: Faculty is already scheduled for ${slotSubj} (${slot.startTime}–${slot.endTime}) on ${dayOfWeek}`
      );
    }

    // 2. Division conflict
    if (
      Number(slot.semester) === Number(semester) &&
      (slot.division || '').toUpperCase() === (division || '').toUpperCase()
    ) {
      conflicts.push(
        `Class conflict: Semester ${semester} Div ${division} already has ${slotSubj} (${slot.startTime}–${slot.endTime}) on ${dayOfWeek}`
      );
    }

    // 3. Room conflict (if room specified and not standard generic/online)
    if (
      room &&
      slot.room &&
      room.toLowerCase() !== 'online' &&
      slot.room.trim().toLowerCase() === room.trim().toLowerCase()
    ) {
      conflicts.push(
        `Room conflict: Room "${room}" is already occupied by ${slotSubj} (${slot.startTime}–${slot.endTime}) on ${dayOfWeek}`
      );
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Detects conflicts for a specific date's dynamic/rescheduled lecture.
 *
 * @param {object} params
 * @param {string|ObjectId} params.faculty
 * @param {number} params.semester
 * @param {string} params.division
 * @param {string} [params.room]
 * @param {string} params.date  "YYYY-MM-DD"
 * @param {string} params.startTime
 * @param {string} params.endTime
 * @param {string|ObjectId} [params.excludeLectureId]
 * @returns {Promise<{ hasConflict: boolean, conflicts: string[] }>}
 */
async function detectLectureConflicts(params) {
  const {
    faculty,
    semester,
    division,
    room,
    date,
    startTime,
    endTime,
    excludeLectureId,
  } = params;

  validateTimeRange(startTime, endTime);

  const query = {
    date,
    status: { $in: ['scheduled', 'conducted'] },
  };
  if (excludeLectureId) {
    query._id = { $ne: excludeLectureId };
  }

  const existingLectures = await Lecture.find(query)
    .populate('faculty', 'name employeeId')
    .populate('subject', 'subjectName subjectCode')
    .lean();

  const conflicts = [];

  for (const lec of existingLectures) {
    if (!checkTimeOverlap(startTime, endTime, lec.startTime, lec.endTime)) {
      continue;
    }

    const lecSubj = lec.subject?.subjectCode || lec.subjectCode || 'Subject';

    // Faculty conflict
    if (String(lec.faculty?._id || lec.faculty) === String(faculty)) {
      conflicts.push(
        `Faculty conflict on ${date}: Faculty already has lecture ${lecSubj} (${lec.startTime}–${lec.endTime})`
      );
    }

    // Division conflict
    if (
      Number(lec.semester) === Number(semester) &&
      (lec.division || '').toUpperCase() === (division || '').toUpperCase()
    ) {
      conflicts.push(
        `Class conflict on ${date}: Sem ${semester} Div ${division} already has lecture ${lecSubj} (${lec.startTime}–${lec.endTime})`
      );
    }

    // Room conflict
    if (
      room &&
      lec.room &&
      room.toLowerCase() !== 'online' &&
      lec.room.trim().toLowerCase() === room.trim().toLowerCase()
    ) {
      conflicts.push(
        `Room conflict on ${date}: Room "${room}" is already occupied (${lec.startTime}–${lec.endTime})`
      );
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

module.exports = {
  timeToMinutes,
  checkTimeOverlap,
  validateTimeRange,
  detectTimetableConflicts,
  detectLectureConflicts,
};
