/**
 * holidayShiftService.js
 *
 * Implements deterministic Holiday Shift & Lecture Rescheduling Logic.
 *
 * Rules:
 *   1. Holiday is date-specific.
 *   2. Scheduled lectures falling on a holiday are marked 'holiday' / 'rescheduled' / 'rescheduling_required'.
 *   3. Holidays are NEVER counted as conducted lectures in attendance.
 *   4. Deterministic rescheduling strategy searches nearest future working dates (excluding holidays/Sundays).
 *   5. Prevents faculty, division, and room conflicts.
 *   6. Preserves subject, faculty, and original-to-replacement relationship.
 *   7. Idempotent — running multiple times prevents duplicate replacement lectures.
 */

const Holiday = require('../../models/Holiday');
const Lecture = require('../../models/Lecture');
const TimetableSlot = require('../../models/TimetableSlot');
const { detectLectureConflicts, detectTimetableConflicts } = require('./conflictDetector');

const STANDARD_SLOTS = [
  { startTime: '09:00', endTime: '10:00' },
  { startTime: '10:00', endTime: '11:00' },
  { startTime: '11:15', endTime: '12:15' },
  { startTime: '12:15', endTime: '13:15' },
  { startTime: '14:00', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:00' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Returns the day of week for a "YYYY-MM-DD" date string.
 */
function getDayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return DAYS[d.getUTCDay()];
}

/**
 * Adds N calendar days to a "YYYY-MM-DD" string.
 */
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

/**
 * Applies a holiday to the academic schedule:
 *  - Identifies all lectures on holiday.date
 *  - Marks affected lectures
 *  - Executes deterministic rescheduling
 *
 * @param {object} holidayDocument  Mongoose Holiday document or object with { _id, date, title }
 * @returns {Promise<{ affectedCount: number, rescheduledCount: number, pendingCount: number }>}
 */
async function applyHoliday(holidayDocument) {
  const { _id: holidayId, date: holidayDate, title } = holidayDocument;
  const dayOfWeek = getDayName(holidayDate);

  // 1. Ensure Lecture records exist for this holiday date from active TimetableSlots
  const activeSlots = await TimetableSlot.find({ dayOfWeek, status: 'active' }).lean();

  for (const slot of activeSlots) {
    const lectureIdStr = `${holidayDate.replace(/-/g, '')}-${slot.subjectCode}-${slot.division}-${slot.startTime.replace(':', '')}`;
    const existing = await Lecture.findOne({ date: holidayDate, timetableSlot: slot._id });
    if (!existing) {
      await Lecture.create({
        timetableSlot: slot._id,
        lectureId: lectureIdStr,
        date: holidayDate,
        dayOfWeek,
        faculty: slot.faculty,
        subject: slot.subject,
        subjectCode: slot.subjectCode,
        subjectName: slot.subjectName,
        department: slot.department,
        course: slot.course,
        semester: slot.semester,
        division: slot.division,
        academicYear: slot.academicYear,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        lectureType: slot.lectureType,
        status: 'holiday',
        holiday: holidayId,
        rescheduleReason: `Holiday: ${title}`,
      });
    }
  }

  // 2. Fetch all lectures on holiday date
  const affectedLectures = await Lecture.find({
    date: holidayDate,
    status: { $in: ['scheduled', 'holiday', 'rescheduling_required', 'rescheduled'] },
  });

  // Update affected count on holiday model
  await Holiday.findByIdAndUpdate(holidayId, { affectedLecturesCount: affectedLectures.length });

  let rescheduledCount = 0;
  let pendingCount = 0;

  // Active holidays list to avoid scheduling on another holiday
  const allHolidays = await Holiday.find({ status: 'active' }).select('date').lean();
  const holidayDateSet = new Set(allHolidays.map((h) => h.date));
  holidayDateSet.add(holidayDate);

  // 3. For each affected lecture, search for a valid replacement slot
  for (const lecture of affectedLectures) {
    // If already rescheduled and valid replacement exists, skip (idempotent)
    if (lecture.status === 'rescheduled' && lecture.replacementLecture) {
      rescheduledCount++;
      continue;
    }

    const replacement = await findAndCreateReplacementSlot(lecture, holidayDocument, holidayDateSet);

    if (replacement) {
      lecture.status = 'rescheduled';
      lecture.replacementLecture = replacement._id;
      lecture.holiday = holidayId;
      lecture.rescheduleReason = `Shifted from ${holidayDate} (${title})`;
      await lecture.save();
      rescheduledCount++;
    } else {
      lecture.status = 'rescheduling_required';
      lecture.holiday = holidayId;
      lecture.rescheduleReason = `Holiday: ${title} — No conflict-free slot found automatically`;
      await lecture.save();
      pendingCount++;
    }
  }

  return {
    affectedCount: affectedLectures.length,
    rescheduledCount,
    pendingCount,
  };
}

/**
 * Deterministically finds the nearest suitable future slot and creates replacement lecture.
 */
async function findAndCreateReplacementSlot(originalLecture, holiday, holidayDateSet, maxLookaheadDays = 14) {
  for (let offset = 1; offset <= maxLookaheadDays; offset++) {
    const candidateDate = addDays(originalLecture.date, offset);
    const candidateDay = getDayName(candidateDate);

    // Skip Sundays and any other active holidays
    if (candidateDay === 'Sunday' || holidayDateSet.has(candidateDate)) {
      continue;
    }

    // Evaluate standard candidate slots in order
    for (const slot of STANDARD_SLOTS) {
      // 1. Check weekly Timetable conflicts on candidateDay
      const ttConflict = await detectTimetableConflicts({
        faculty: originalLecture.faculty,
        semester: originalLecture.semester,
        division: originalLecture.division,
        room: originalLecture.room,
        dayOfWeek: candidateDay,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });

      if (ttConflict.hasConflict) continue;

      // 2. Check dynamic Lecture conflicts on candidateDate
      const lecConflict = await detectLectureConflicts({
        faculty: originalLecture.faculty,
        semester: originalLecture.semester,
        division: originalLecture.division,
        room: originalLecture.room,
        date: candidateDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });

      if (lecConflict.hasConflict) continue;

      // Found a conflict-free slot! Create the replacement lecture
      const replacementLectureId = `${candidateDate.replace(/-/g, '')}-${originalLecture.subjectCode}-${originalLecture.division}-R${slot.startTime.replace(':', '')}`;

      const replacement = await Lecture.create({
        timetableSlot: originalLecture.timetableSlot,
        lectureId: replacementLectureId,
        date: candidateDate,
        dayOfWeek: candidateDay,
        faculty: originalLecture.faculty,
        subject: originalLecture.subject,
        subjectCode: originalLecture.subjectCode,
        subjectName: originalLecture.subjectName,
        department: originalLecture.department,
        course: originalLecture.course,
        semester: originalLecture.semester,
        division: originalLecture.division,
        academicYear: originalLecture.academicYear,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: originalLecture.room,
        lectureType: originalLecture.lectureType,
        status: 'scheduled',
        isRescheduled: true,
        originalLecture: originalLecture._id,
        holiday: holiday._id,
        rescheduleReason: `Replacement for lecture on ${originalLecture.date} (${holiday.title})`,
        rescheduledAt: new Date(),
      });

      return replacement;
    }
  }

  return null; // No slot found
}

/**
 * Removes or cancels a holiday, restoring affected lectures.
 */
async function removeHoliday(holidayId) {
  const holiday = await Holiday.findById(holidayId);
  if (!holiday) {
    const err = new Error('Holiday not found');
    err.statusCode = 404;
    throw err;
  }

  // Find lectures linked to this holiday
  const linkedLectures = await Lecture.find({ holiday: holidayId });

  for (const lec of linkedLectures) {
    if (lec.isRescheduled) {
      // It's a dynamic replacement lecture -> remove if not conducted
      if (lec.status !== 'conducted') {
        await Lecture.findByIdAndDelete(lec._id);
      }
    } else {
      // It's an original affected lecture -> restore to scheduled
      if (lec.status !== 'conducted') {
        lec.status = 'scheduled';
        lec.replacementLecture = undefined;
        lec.holiday = undefined;
        lec.rescheduleReason = undefined;
        await lec.save();
      }
    }
  }

  holiday.status = 'cancelled';
  await holiday.save();

  return { success: true, message: 'Holiday cancelled and affected lectures restored' };
}

/**
 * Manually reschedules a lecture with strict conflict checking.
 */
async function manualRescheduleLecture(lectureId, params) {
  const { newDate, newStartTime, newEndTime, newRoom, reason, userId } = params;

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    const err = new Error('Lecture not found');
    err.statusCode = 404;
    throw err;
  }

  if (lecture.status === 'conducted') {
    const err = new Error('Cannot reschedule an already conducted lecture');
    err.statusCode = 400;
    throw err;
  }

  const candidateDay = getDayName(newDate);

  // Check conflicts on target date
  const ttConflict = await detectTimetableConflicts({
    faculty: lecture.faculty,
    semester: lecture.semester,
    division: lecture.division,
    room: newRoom || lecture.room,
    dayOfWeek: candidateDay,
    startTime: newStartTime,
    endTime: newEndTime,
  });
  if (ttConflict.hasConflict) {
    const err = new Error(`Cannot reschedule: ${ttConflict.conflicts.join('; ')}`);
    err.statusCode = 409;
    throw err;
  }

  const lecConflict = await detectLectureConflicts({
    faculty: lecture.faculty,
    semester: lecture.semester,
    division: lecture.division,
    room: newRoom || lecture.room,
    date: newDate,
    startTime: newStartTime,
    endTime: newEndTime,
  });
  if (lecConflict.hasConflict) {
    const err = new Error(`Cannot reschedule: ${lecConflict.conflicts.join('; ')}`);
    err.statusCode = 409;
    throw err;
  }

  // Create replacement lecture
  const replacementLectureId = `${newDate.replace(/-/g, '')}-${lecture.subjectCode}-${lecture.division}-M${newStartTime.replace(':', '')}`;
  const replacement = await Lecture.create({
    timetableSlot: lecture.timetableSlot,
    lectureId: replacementLectureId,
    date: newDate,
    dayOfWeek: candidateDay,
    faculty: lecture.faculty,
    subject: lecture.subject,
    subjectCode: lecture.subjectCode,
    subjectName: lecture.subjectName,
    department: lecture.department,
    course: lecture.course,
    semester: lecture.semester,
    division: lecture.division,
    academicYear: lecture.academicYear,
    startTime: newStartTime,
    endTime: newEndTime,
    room: newRoom || lecture.room,
    lectureType: lecture.lectureType,
    status: 'scheduled',
    isRescheduled: true,
    originalLecture: lecture._id,
    rescheduleReason: reason || 'Manual faculty reschedule',
    rescheduledBy: userId,
    rescheduledAt: new Date(),
  });

  lecture.status = 'rescheduled';
  lecture.replacementLecture = replacement._id;
  lecture.rescheduleReason = reason || 'Manual reschedule';
  await lecture.save();

  return replacement;
}

module.exports = {
  applyHoliday,
  removeHoliday,
  manualRescheduleLecture,
  getDayName,
  addDays,
};
