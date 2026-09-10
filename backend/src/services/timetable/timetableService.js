/**
 * timetableService.js
 *
 * Core timetable management and slot query service for FacultyHub.
 * Handles weekly timetable slots, conflict detection, and student timetable retrieval.
 */

const TimetableSlot = require('../../models/TimetableSlot');
const Subject = require('../../models/Subject');
const Department = require('../../models/Department');
const Student = require('../../models/Student');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  const candidateSlots = await TimetableSlot.find(query)
    .populate('faculty', 'fullName employeeId')
    .populate('subject', 'subjectName subjectCode')
    .lean();

  const conflicts = [];

  for (const slot of candidateSlots) {
    if (!checkTimeOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
      continue;
    }

    // 1. Faculty Conflict
    if (faculty && slot.faculty && String(slot.faculty._id || slot.faculty) === String(faculty)) {
      const facName = slot.faculty.fullName || 'Faculty member';
      conflicts.push(`Faculty conflict: ${facName} is already scheduled on ${dayOfWeek} from ${slot.startTime} to ${slot.endTime}`);
    }

    // 2. Division / Class Conflict (same semester and division)
    if (
      semester &&
      slot.semester === Number(semester) &&
      division &&
      slot.division.toUpperCase() === division.toUpperCase()
    ) {
      conflicts.push(`Division conflict: Semester ${semester} Division ${division.toUpperCase()} already has a session (${slot.subjectCode || 'Slot'}) on ${dayOfWeek} from ${slot.startTime} to ${slot.endTime}`);
    }

    // 3. Room Conflict
    if (room && slot.room && slot.room.trim().toLowerCase() === room.trim().toLowerCase()) {
      conflicts.push(`Room conflict: ${room} is already booked on ${dayOfWeek} from ${slot.startTime} to ${slot.endTime}`);
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Creates a new weekly Timetable Slot with conflict validation.
 */
async function createTimetableSlot(data) {
  let {
    faculty,
    subject,
    department,
    course,
    semester = 5,
    division = 'A',
    academicYear = '2026-2027',
    dayOfWeek,
    startTime,
    endTime,
    room = 'Classroom',
    lectureType = 'theory',
    batch,
  } = data;

  const subj = await Subject.findById(subject);
  if (!subj) {
    const err = new Error('Subject not found');
    err.statusCode = 404;
    throw err;
  }

  if (!department) {
    const dept = await Department.findOne({ code: 'CO' }) || await Department.findOne();
    department = dept ? dept._id : null;
  }

  const conflictCheck = await detectTimetableConflicts({
    faculty,
    semester: Number(semester),
    division,
    room,
    dayOfWeek,
    startTime,
    endTime,
  });

  if (conflictCheck.hasConflict) {
    const err = new Error(`Timetable conflict: ${conflictCheck.conflicts.join('; ')}`);
    err.statusCode = 409;
    err.conflicts = conflictCheck.conflicts;
    throw err;
  }

  const slot = await TimetableSlot.create({
    faculty,
    subject,
    subjectCode: subj.subjectCode,
    subjectName: subj.subjectName,
    department,
    course: course || null,
    semester: Number(semester),
    division: (division || 'A').toUpperCase(),
    academicYear: academicYear || '2026-2027',
    dayOfWeek,
    startTime,
    endTime,
    room,
    lectureType,
    batch: batch || undefined,
    status: 'active',
  });

  return slot;
}

/**
 * Updates an existing Timetable Slot with conflict validation.
 */
async function updateTimetableSlot(slotId, data) {
  const slot = await TimetableSlot.findById(slotId);
  if (!slot) {
    const err = new Error('Timetable slot not found');
    err.statusCode = 404;
    throw err;
  }

  const faculty = data.faculty || slot.faculty;
  const semester = data.semester !== undefined ? Number(data.semester) : slot.semester;
  const division = data.division || slot.division;
  const room = data.room || slot.room;
  const dayOfWeek = data.dayOfWeek || slot.dayOfWeek;
  const startTime = data.startTime || slot.startTime;
  const endTime = data.endTime || slot.endTime;

  const conflictCheck = await detectTimetableConflicts({
    faculty,
    semester,
    division,
    room,
    dayOfWeek,
    startTime,
    endTime,
    excludeSlotId: slotId,
  });

  if (conflictCheck.hasConflict) {
    const err = new Error(`Timetable conflict: ${conflictCheck.conflicts.join('; ')}`);
    err.statusCode = 409;
    err.conflicts = conflictCheck.conflicts;
    throw err;
  }

  slot.faculty = faculty;
  slot.semester = semester;
  slot.division = division;
  slot.room = room;
  slot.dayOfWeek = dayOfWeek;
  slot.startTime = startTime;
  slot.endTime = endTime;
  if (data.lectureType) slot.lectureType = data.lectureType;
  if (data.batch !== undefined) slot.batch = data.batch;
  if (data.subject) {
    const subj = await Subject.findById(data.subject);
    if (subj) {
      slot.subject = subj._id;
      slot.subjectCode = subj.subjectCode;
      slot.subjectName = subj.subjectName;
    }
  }

  await slot.save();
  return slot;
}

/**
 * Deactivates a timetable slot.
 */
async function deleteTimetableSlot(slotId) {
  const slot = await TimetableSlot.findById(slotId);
  if (!slot) {
    const err = new Error('Timetable slot not found');
    err.statusCode = 404;
    throw err;
  }
  slot.status = 'inactive';
  await slot.save();
  return { success: true, message: 'Slot deactivated' };
}

/**
 * Retrieves the weekly timetable organized by day of week.
 */
async function getWeeklyTimetable(filters = {}) {
  const query = { status: 'active' };
  if (filters.faculty) query.faculty = filters.faculty;
  if (filters.semester) query.semester = Number(filters.semester);
  if (filters.division) query.division = filters.division.toUpperCase();
  if (filters.department) query.department = filters.department;
  if (filters.academicYear) query.academicYear = filters.academicYear;

  const slots = await TimetableSlot.find(query)
    .populate('faculty', 'fullName designation')
    .populate('subject', 'subjectName subjectCode')
    .sort({ startTime: 1 })
    .lean();

  const grouped = {};
  for (const day of DAYS) {
    grouped[day] = [];
  }

  for (const s of slots) {
    if (grouped[s.dayOfWeek]) {
      grouped[s.dayOfWeek].push(s);
    }
  }

  return {
    totalSlots: slots.length,
    days: grouped,
    rawSlots: slots,
  };
}

/**
 * Retrieves the student's timetable based on their profile.
 */
async function getStudentTimetable(userId) {
  const student = await Student.findOne({ userId }).lean();
  if (!student) {
    const err = new Error('Student profile not found');
    err.statusCode = 404;
    throw err;
  }

  const weeklySchedule = await getWeeklyTimetable({
    semester: student.currentSemester || student.semester,
    division: student.division,
    department: student.department,
  });

  return {
    student: {
      name: `${student.firstName} ${student.lastName}`,
      enrollmentNumber: student.enrollmentNumber,
      semester: student.currentSemester || student.semester,
      division: student.division,
    },
    weeklySchedule,
  };
}

/**
 * Retrieves all active subject-to-faculty assignments from database.
 * Returns a mapping of subjectCode -> Array<{ id, fullName, designation }>
 */
async function getFacultySubjectAssignments() {
  const Faculty = require('../../models/Faculty');
  const FacultySubjectAssignment = require('../../models/FacultySubjectAssignment');

  const facultyList = await Faculty.find({ status: 'active' })
    .populate('subjects', 'subjectCode subjectName')
    .lean();

  const map = {};

  for (const fac of facultyList) {
    if (Array.isArray(fac.subjects)) {
      for (const subj of fac.subjects) {
        if (subj && subj.subjectCode) {
          const code = subj.subjectCode.toUpperCase();
          if (!map[code]) map[code] = [];
          if (!map[code].some((f) => String(f.id) === String(fac._id))) {
            map[code].push({
              id: fac._id,
              fullName: fac.fullName,
              designation: fac.designation,
            });
          }
        }
      }
    }
  }

  const directAssignments = await FacultySubjectAssignment.find({ active: true })
    .populate('facultyId', 'fullName designation status')
    .populate('subjectId', 'subjectCode subjectName')
    .lean();

  for (const da of directAssignments) {
    if (
      da.facultyId &&
      da.facultyId.status !== 'inactive' &&
      da.subjectId &&
      da.subjectId.subjectCode
    ) {
      const code = da.subjectId.subjectCode.toUpperCase();
      if (!map[code]) map[code] = [];
      if (!map[code].some((f) => String(f.id) === String(da.facultyId._id))) {
        map[code].push({
          id: da.facultyId._id,
          fullName: da.facultyId.fullName,
          designation: da.facultyId.designation,
        });
      }
    }
  }

  return map;
}

module.exports = {
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  getWeeklyTimetable,
  getStudentTimetable,
  detectTimetableConflicts,
  checkTimeOverlap,
  getFacultySubjectAssignments,
};

