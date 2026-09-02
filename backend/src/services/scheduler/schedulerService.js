/**
 * schedulerService.js
 *
 * Core timetable management and lecture schedule query service for FacultyHub.
 */

const TimetableSlot = require('../../models/TimetableSlot');
const Lecture = require('../../models/Lecture');
const Holiday = require('../../models/Holiday');
const Subject = require('../../models/Subject');
const Faculty = require('../../models/Faculty');
const Student = require('../../models/Student');
const Department = require('../../models/Department');
const { detectTimetableConflicts } = require('./conflictDetector');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  } = data;

  // Resolve subject details
  const subj = await Subject.findById(subject);
  if (!subj) {
    const err = new Error('Subject not found');
    err.statusCode = 404;
    throw err;
  }

  // Resolve department fallback if missing
  if (!department) {
    const dept = await Department.findOne({ code: 'CO' }) || await Department.findOne();
    department = dept ? dept._id : null;
  }

  // Validate conflicts
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
 * Retrieves dynamic lecture instances for a date or date range.
 */
async function getLectures(filters = {}) {
  const query = {};
  if (filters.date) query.date = filters.date;
  if (filters.startDate && filters.endDate) {
    query.date = { $gte: filters.startDate, $lte: filters.endDate };
  }
  if (filters.faculty) query.faculty = filters.faculty;
  if (filters.semester) query.semester = Number(filters.semester);
  if (filters.division) query.division = filters.division.toUpperCase();
  if (filters.subjectCode) query.subjectCode = filters.subjectCode.toUpperCase();
  if (filters.status) query.status = filters.status;

  const lectures = await Lecture.find(query)
    .populate('faculty', 'fullName designation')
    .populate('subject', 'subjectName subjectCode')
    .populate('originalLecture')
    .populate('replacementLecture')
    .populate('holiday', 'title date type')
    .sort({ date: 1, startTime: 1 })
    .lean();

  return lectures;
}

/**
 * Returns lectures that need manual rescheduling.
 */
async function getReschedulingRequiredLectures(filters = {}) {
  const query = { status: 'rescheduling_required' };
  if (filters.faculty) query.faculty = filters.faculty;
  if (filters.semester) query.semester = Number(filters.semester);
  if (filters.division) query.division = filters.division.toUpperCase();

  const lectures = await Lecture.find(query)
    .populate('faculty', 'fullName designation')
    .populate('subject', 'subjectName subjectCode')
    .populate('holiday', 'title date')
    .sort({ date: 1 })
    .lean();

  return lectures;
}

/**
 * Retrieves the student's timetable and upcoming lectures based on their profile.
 */
async function getStudentTimetable(userId) {
  const student = await Student.findOne({ userId }).lean();
  if (!student) {
    const err = new Error('Student profile not found');
    err.statusCode = 404;
    throw err;
  }

  const { semester = 5, division = 'A', department, academicYear = '2026-2027' } = student;

  const weekly = await getWeeklyTimetable({
    semester,
    division,
    department,
    academicYear,
  });

  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const upcomingLectures = await getLectures({
    semester,
    division,
    startDate: today,
    endDate: nextWeekStr,
  });

  const activeHolidays = await Holiday.find({
    date: { $gte: today, $lte: nextWeekStr },
    status: 'active',
  }).lean();

  return {
    student: {
      enrollmentNumber: student.enrollmentNumber,
      fullName: student.fullName,
      semester: student.semester || 5,
      department: 'Computer Science',
    },
    weekly: weekly || { totalSlots: 0, days: {} },
    upcomingLectures: upcomingLectures || [],
    holidays: activeHolidays || [],
  };
}

module.exports = {
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
  getWeeklyTimetable,
  getLectures,
  getReschedulingRequiredLectures,
  getStudentTimetable,
};
