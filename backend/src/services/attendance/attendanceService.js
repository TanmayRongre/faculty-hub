/**
 * attendanceService.js
 *
 * Orchestrates Attendance for FacultyHub (Redesigned Architecture):
 *   - Primary Types: LECTURE and PRACTICAL
 *   - Subjects: Strictly STE, OSY, ENDS, ACN
 *   - Practical Batches:
 *       • Batch A: Roll 1–24 (24 students)
 *       • Batch B: Roll 25–47 (23 students)
 *       • Batch C: Roll 48–68 (21 students)
 *   - MongoDB Attendance storage with atomic batch write
 *   - Google Sheets synchronization with 16 dedicated worksheets:
 *       • ATT-LEC-STE, ATT-LEC-OSY, ATT-LEC-ENDS, ATT-LEC-ACN
 *       • ATT-PR-STE-A, ATT-PR-STE-B, ATT-PR-STE-C
 *       • ATT-PR-OSY-A, ... ATT-PR-ACN-C
 *   - Zero cross-contamination between sheets
 *   - Separate context for lecture vs practical calculations
 *   - Defaulter rule: < 75% (75% exactly is not defaulter)
 */

const Student = require('../../models/Student');
const Subject = require('../../models/Subject');
const Attendance = require('../../models/Attendance');
const sheetsService = require('../../integrations/googleSheets/googleSheetsService');
const {
  ATTENDANCE_SUBJECTS,
  PRACTICAL_BATCHES,
  BATCH_DEFINITIONS,
  getBatchForRoll,
  validateBatchRoll,
  isValidAttendanceSubject,
  getAttendanceWorksheetName,
} = require('../../integrations/googleSheets/spreadsheetConfig');

function validateDate(dateStr) {
  if (!dateStr) {
    const err = new Error('Date is required');
    err.statusCode = 400;
    throw err;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const err = new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD`);
    err.statusCode = 400;
    throw err;
  }
  return d.toISOString().split('T')[0];
}

function normalizeType(type) {
  const t = String(type || '').trim().toUpperCase();
  if (t === 'LECTURE' || t === 'LEC') return 'LECTURE';
  if (t === 'PRACTICAL' || t === 'PR') return 'PRACTICAL';
  const err = new Error(`Invalid attendance type: "${type}". Allowed types: Lecture, Practical`);
  err.statusCode = 400;
  throw err;
}

function normalizeSubject(subCode) {
  const s = String(subCode || '').trim().toUpperCase();
  if (!isValidAttendanceSubject(s)) {
    const err = new Error(
      `Invalid attendance subject: "${subCode}". Allowed subjects for attendance: ${ATTENDANCE_SUBJECTS.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }
  return s;
}

function normalizeBatch(type, batch) {
  if (type === 'LECTURE') {
    if (batch !== null && batch !== undefined && String(batch).trim() !== '' && String(batch).trim() !== '—') {
      const err = new Error(`Batch selection is not allowed for Lecture attendance. Lectures are common for all 68 students.`);
      err.statusCode = 422;
      throw err;
    }
    return null;
  }

  if (type === 'PRACTICAL') {
    const b = String(batch || '').trim().toUpperCase();
    if (!PRACTICAL_BATCHES.includes(b)) {
      const err = new Error(
        `Practical attendance requires a valid batch (A, B, or C). Received: "${batch || 'none'}"`
      );
      err.statusCode = 422;
      throw err;
    }
    return b;
  }

  return null;
}

/**
 * Returns student roster for the selected attendance context:
 * - Lecture: all 68 students
 * - Practical A: Roll 1–24 (24 students)
 * - Practical B: Roll 25–47 (23 students)
 * - Practical C: Roll 48–68 (21 students)
 */
async function getRoster({ attendanceType, subjectCode, batch = null }) {
  const type = normalizeType(attendanceType);
  const sub = normalizeSubject(subjectCode);
  const validatedBatch = normalizeBatch(type, batch);

  // Load all 68 active students sorted numerically
  const allStudents = await Student.find({ semester: 5, status: 'active' })
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ rollNumber: 1 })
    .select('_id rollNumber enrollmentNumber fullName department semester batch')
    .lean();

  if (type === 'LECTURE') {
    return {
      attendanceType: 'LECTURE',
      subjectCode: sub,
      batch: null,
      totalStudents: allStudents.length,
      students: allStudents,
    };
  }

  // PRACTICAL: Filter by batch
  const batchStudents = allStudents.filter((s) => {
    const r = Number(s.rollNumber);
    const def = BATCH_DEFINITIONS[validatedBatch];
    return r >= def.minRoll && r <= def.maxRoll;
  });

  return {
    attendanceType: 'PRACTICAL',
    subjectCode: sub,
    batch: validatedBatch,
    totalStudents: batchStudents.length,
    students: batchStudents,
  };
}

/**
 * Generates deterministic session ID
 */
function generateSessionId(attendanceType, subjectCode, batch, dateStr, slot = '1') {
  const d = dateStr.replace(/-/g, '');
  const cleanSlot = String(slot || '1').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
  if (attendanceType === 'LECTURE') {
    return `LEC-${subjectCode}-${d}-${cleanSlot}`;
  }
  return `PR-${subjectCode}-${batch}-${d}-${cleanSlot}`;
}

/**
 * Submits/Saves an entire attendance session (SAVE ALL).
 * Validates roster, saves to MongoDB, updates Google Sheets.
 */
async function saveAttendanceSession(params) {
  const {
    attendanceType: rawType,
    subjectCode: rawSubject,
    batch: rawBatch = null,
    date: rawDate,
    slot = rawType && String(rawType).toUpperCase().includes('PR') ? '01:50 - 03:50' : '10:30 - 11:30',
    absentEnrollments = [],
    absentRolls = [],
    records = [],
    markedBy = null,
  } = params;

  const attendanceType = normalizeType(rawType);
  const subjectCode = normalizeSubject(rawSubject);
  const batch = normalizeBatch(attendanceType, rawBatch);
  const date = validateDate(rawDate);

  // 1. Resolve Subject document
  const subjectDoc = await Subject.findOne({ subjectCode })
    .select('_id subjectCode subjectName')
    .lean();

  if (!subjectDoc) {
    const err = new Error(`Subject ${subjectCode} not found in database`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Fetch expected roster
  const rosterResult = await getRoster({ attendanceType, subjectCode, batch });
  const expectedStudents = rosterResult.students;
  const expectedRollMap = new Map();
  const expectedEnrollMap = new Map();

  for (const s of expectedStudents) {
    expectedRollMap.set(String(s.rollNumber).trim(), s);
    expectedEnrollMap.set(String(s.enrollmentNumber).toUpperCase().trim(), s);
  }

  // 3. Validate student eligibility (Strict Batch boundary enforcement)
  const absentEnrollSet = new Set(absentEnrollments.map((e) => String(e).toUpperCase().trim()));
  const absentRollSet = new Set(absentRolls.map((r) => String(r).trim()));

  if (Array.isArray(records) && records.length > 0) {
    for (const rec of records) {
      const roll = String(rec.rollNumber || rec.rollNo || '').trim();
      const enroll = String(rec.enrollmentNumber || '').toUpperCase().trim();

      // Check if student belongs to the allowed roster
      const isAllowed =
        (roll && expectedRollMap.has(roll)) || (enroll && expectedEnrollMap.has(enroll));

      if (!isAllowed) {
        const err = new Error(
          `Student with Roll ${roll || enroll} is not eligible for ${attendanceType} ${subjectCode}${batch ? ` Batch ${batch}` : ''}.`
        );
        err.statusCode = 422;
        throw err;
      }

      const status = String(rec.status || '').toUpperCase();
      if (status === 'ABSENT' || status === 'A') {
        if (roll) absentRollSet.add(roll);
        if (enroll) absentEnrollSet.add(enroll);
      }
    }
  }

  // Check manual absentRolls for illegal students
  for (const roll of absentRollSet) {
    if (!expectedRollMap.has(roll)) {
      const err = new Error(
        `Roll number ${roll} is not part of ${attendanceType} ${subjectCode}${batch ? ` Batch ${batch}` : ''}`
      );
      err.statusCode = 422;
      throw err;
    }
  }

  // 4. Build Attendance documents for all students in the roster (Present-by-default)
  const sessionId = params.sessionId || generateSessionId(attendanceType, subjectCode, batch, date, slot);

  const attendanceDocs = [];
  const sheetsStudentList = [];
  let presentCount = 0;
  let absentCount = 0;

  for (const s of expectedStudents) {
    const roll = String(s.rollNumber).trim();
    const enroll = String(s.enrollmentNumber).toUpperCase().trim();

    const isAbsent = absentRollSet.has(roll) || absentEnrollSet.has(enroll);
    const status = isAbsent ? 'ABSENT' : 'PRESENT';

    if (isAbsent) absentCount++;
    else presentCount++;

    attendanceDocs.push({
      attendanceType,
      subjectId: subjectDoc._id,
      subjectCode,
      batch,
      date,
      sessionId,
      slot,
      studentId: s._id,
      rollNumber: roll,
      enrollmentNumber: enroll,
      status,
      markedBy,
    });

    sheetsStudentList.push({
      rollNumber: roll,
      status: isAbsent ? 'Absent' : 'Present',
    });
  }

  // 5. Atomic Upsert into MongoDB Attendance collection
  const bulkOps = attendanceDocs.map((doc) => ({
    updateOne: {
      filter: { sessionId: doc.sessionId, studentId: doc.studentId },
      update: { $set: doc },
      upsert: true,
    },
  }));

  await Attendance.bulkWrite(bulkOps);

  // 6. Update target Google Sheets worksheet with guaranteed zero cross-contamination
  let sheetSyncResult = null;
  try {
    sheetSyncResult = await sheetsService.updateAttendanceSession(
      attendanceType,
      subjectCode,
      batch,
      sessionId,
      date,
      sheetsStudentList
    );
  } catch (sheetErr) {
    console.warn(`[AttendanceService] Google Sheets sync warning for ${sessionId}:`, sheetErr.message);
  }

  return {
    success: true,
    sessionId,
    attendanceType,
    subjectCode,
    batch: batch || '—',
    date,
    slot,
    total: expectedStudents.length,
    present: presentCount,
    absent: absentCount,
    sheetName: sheetSyncResult?.sheetName || getAttendanceWorksheetName(attendanceType, subjectCode, batch),
  };
}

/**
 * Retrieves past attendance sessions for history view
 */
async function getAttendanceHistory(filters = {}) {
  const query = {};
  if (filters.attendanceType) query.attendanceType = normalizeType(filters.attendanceType);
  if (filters.subjectCode) query.subjectCode = normalizeSubject(filters.subjectCode);
  if (filters.batch) query.batch = filters.batch.toUpperCase();
  if (filters.date) query.date = filters.date;

  const sessions = await Attendance.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$sessionId',
        attendanceType: { $first: '$attendanceType' },
        subjectCode: { $first: '$subjectCode' },
        batch: { $first: '$batch' },
        date: { $first: '$date' },
        slot: { $first: '$slot' },
        createdAt: { $first: '$createdAt' },
        totalStudents: { $sum: 1 },
        presentCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['PRESENT', 'Present']] }, 1, 0],
          },
        },
        absentCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['ABSENT', 'Absent']] }, 1, 0],
          },
        },
      },
    },
    { $sort: { date: -1, createdAt: -1 } },
  ]);

  return sessions.map((s) => ({
    sessionId: s._id,
    attendanceType: s.attendanceType,
    subjectCode: s.subjectCode,
    batch: s.batch || '—',
    date: s.date,
    slot: s.slot || (s.attendanceType === 'PRACTICAL' ? '01:50 - 03:50' : '10:30 - 11:30'),
    totalStudents: s.totalStudents,
    presentCount: s.presentCount,
    absentCount: s.absentCount,
    percentage: s.totalStudents > 0 ? Math.round((s.presentCount / s.totalStudents) * 100) : 0,
  }));
}

/**
 * Returns full attendance details for a specific session
 */
async function getSessionDetails(sessionId) {
  const records = await Attendance.find({ sessionId })
    .populate('studentId', 'fullName rollNumber enrollmentNumber')
    .sort({ rollNumber: 1 })
    .lean();

  if (records.length === 0) {
    const err = new Error(`Session ${sessionId} not found`);
    err.statusCode = 404;
    throw err;
  }

  const first = records[0];
  return {
    sessionId: first.sessionId,
    attendanceType: first.attendanceType,
    subjectCode: first.subjectCode,
    batch: first.batch || '—',
    date: first.date,
    slot: first.slot,
    total: records.length,
    present: records.filter((r) => r.status === 'PRESENT' || r.status === 'Present').length,
    absent: records.filter((r) => r.status === 'ABSENT' || r.status === 'Absent').length,
    records: records.map((r) => ({
      studentId: r.studentId?._id || r.studentId,
      rollNumber: r.rollNumber,
      fullName: r.studentId?.fullName || '',
      enrollmentNumber: r.enrollmentNumber,
      status: r.status === 'ABSENT' || r.status === 'Absent' ? 'Absent' : 'Present',
    })),
  };
}

/**
 * Calculates student attendance percentages and defaulters (< 75%)
 * Treats lecture and practical as separate contexts.
 * Respects student batch for practicals.
 */
async function getDefaulters(filters = {}) {
  const students = await Student.find({ semester: 5, status: 'active' })
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ rollNumber: 1 })
    .select('_id rollNumber enrollmentNumber fullName batch')
    .lean();

  const query = {};
  if (filters.attendanceType) query.attendanceType = normalizeType(filters.attendanceType);
  if (filters.subjectCode) query.subjectCode = normalizeSubject(filters.subjectCode);

  const allRecords = await Attendance.find(query).lean();

  const result = [];
  for (const s of students) {
    const roll = String(s.rollNumber).trim();
    const batch = getBatchForRoll(roll);

    // Filter sessions applicable to this student
    const studentRecords = allRecords.filter((rec) => {
      // Must be this student
      if (String(rec.studentId) !== String(s._id) && String(rec.rollNumber) !== roll) {
        return false;
      }
      // If practical, must match student's batch
      if (rec.attendanceType === 'PRACTICAL' && rec.batch && rec.batch !== batch) {
        return false;
      }
      return true;
    });

    const conducted = studentRecords.length;
    const attended = studentRecords.filter(
      (r) => r.status === 'PRESENT' || r.status === 'Present'
    ).length;

    const percentage = conducted > 0 ? Math.round((attended / conducted) * 10000) / 100 : 100;
    const isDefaulter = conducted > 0 && percentage < 75; // Exactly 75% is NOT a defaulter

    result.push({
      studentId: s._id,
      rollNumber: s.rollNumber,
      fullName: s.fullName,
      enrollmentNumber: s.enrollmentNumber,
      batch,
      conducted,
      attended,
      percentage,
      isDefaulter,
    });
  }

  const defaultersList = result.filter((r) => r.isDefaulter);

  return {
    totalStudents: result.length,
    defaultersCount: defaultersList.length,
    defaulterThreshold: 75,
    threshold: 75,
    defaulters: defaultersList,
    allStudents: result,
  };
}

/**
 * Backward compatibility alias for older controllers
 */
async function submitAttendance(params) {
  return saveAttendanceSession(params);
}

async function updateAttendance(params) {
  return saveAttendanceSession(params);
}

module.exports = {
  getRoster,
  saveAttendanceSession,
  getAttendanceHistory,
  getSessionDetails,
  getDefaulters,
  submitAttendance,
  updateAttendance,
  normalizeType,
  normalizeSubject,
  normalizeBatch,
  validateDate,
  generateSessionId,
};
