/**
 * attendanceService.js
 *
 * Orchestrates attendance operations for FacultyHub:
 *   - Resolves MongoDB students / subjects
 *   - Delegates to academicDataService for Google Sheets I/O
 *   - Matrix View & Fast Attendance support
 */

const Student = require('../../models/Student');
const Subject = require('../../models/Subject');
const academicDataService = require('../../integrations/googleSheets/academicDataService');
const {
  computeAttendanceStats,
  groupByLecture,
  buildAttendanceRecords,
  ATTENDANCE_CONFIG,
} = require('./attendanceCalculator');

function validateDate(dateStr) {
  if (!dateStr) throw Object.assign(new Error('date is required'), { statusCode: 400 });
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw Object.assign(new Error(`Invalid date: "${dateStr}"`), { statusCode: 400 });
  return d.toISOString().split('T')[0];
}

function generateLectureId(date, subjectCode, division = 'A', slot = '1') {
  const d = date.replace(/-/g, '');
  return `${d}-${subjectCode.toUpperCase()}-${(division || 'A').toUpperCase()}-${slot}`.replace(/\s+/g, '');
}

async function resolveSubject(subjectCode) {
  const subject = await Subject.findOne({ subjectCode: subjectCode.toUpperCase().trim() })
    .select('subjectCode subjectName semester')
    .lean();
  if (!subject) {
    const err = new Error(`Subject not found: ${subjectCode}`);
    err.statusCode = 404;
    throw err;
  }
  return subject;
}

async function getStudentsForClass({ semester = 5, division, batch } = {}) {
  const query = { status: 'active' };
  if (semester) query.semester = Number(semester);

  // In 5th semester Computer Engineering, all 68 students share a single common class.
  // Only filter by division if students in the DB actually have division populated.
  if (division && division !== 'COMMON' && division !== 'ALL') {
    const hasDivision = await Student.exists({
      status: 'active',
      semester: Number(semester),
      division: division.toUpperCase(),
    });
    if (hasDivision) {
      query.division = division.toUpperCase();
    }
  }

  if (batch) {
    const hasBatch = await Student.exists({
      status: 'active',
      semester: Number(semester),
      batch: batch.toUpperCase(),
    });
    if (hasBatch) {
      query.batch = batch.toUpperCase();
    }
  }

  const students = await Student.find(query)
    .select('enrollmentNumber rollNumber fullName semester division batch')
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ rollNumber: 1 })
    .lean();
  return students;
}

/**
 * Submits attendance for a lecture session (Present-by-default).
 */
async function submitAttendance(params) {
  const {
    date: rawDate,
    subjectCode,
    division = 'A',
    semester = 5,
    slot = '1',
    absentEnrollments = [],
    facultyId,
  } = params;

  const date = validateDate(rawDate);
  const subject = await resolveSubject(subjectCode);
  const lectureId = params.lectureId || generateLectureId(date, subject.subjectCode, division, slot);

  const existing = await academicDataService.getAllAttendance({ lectureId });

  if (existing.length > 0) {
    return updateAttendance({ lectureId, date, subjectCode: subject.subjectCode, division, semester, absentEnrollments, facultyId });
  }

  const students = await getStudentsForClass({ semester, division });
  if (students.length === 0) {
    const err = new Error('No active students found for the specified class');
    err.statusCode = 400;
    throw err;
  }

  const absentSet = new Set(absentEnrollments.map((e) => e.toUpperCase()));
  const records = buildAttendanceRecords(students, absentSet, {
    lectureId,
    date,
    subjectCode: subject.subjectCode,
    subjectName: subject.subjectName,
  });

  await academicDataService.writeAttendanceBatch(records);

  const presentCount = records.filter((r) => r.status === 'Present').length;
  const absentCount = records.filter((r) => r.status === 'Absent').length;

  return {
    lectureId,
    action: 'created',
    saved: records.length,
    present: presentCount,
    absent: absentCount,
    students: records.map((r) => ({ enrollmentNumber: r.enrollmentNumber, rollNumber: r.rollNumber, status: r.status })),
  };
}

/**
 * Updates/edits attendance for an existing lecture.
 */
async function updateAttendance(params) {
  const { lectureId, absentEnrollments = [] } = params;

  const lectureRows = await academicDataService.getAllAttendance({ lectureId });
  if (lectureRows.length === 0) {
    const err = new Error(`No attendance found for lectureId: ${lectureId}`);
    err.statusCode = 404;
    throw err;
  }

  const subjectCode = lectureRows[0].subjectCode;
  const date = lectureRows[0].date;
  const absentSet = new Set(absentEnrollments.map((e) => e.toUpperCase()));

  const studentAttendanceList = lectureRows.map((r) => {
    const isAbsent =
      absentSet.has((r.enrollmentNumber || '').toUpperCase()) ||
      absentSet.has(String(r.rollNumber || '').toUpperCase());
    return {
      rollNumber: r.rollNumber,
      enrollmentNumber: r.enrollmentNumber,
      status: isAbsent ? 'Absent' : 'Present',
    };
  });

  await academicDataService.updateSubjectAttendance(subjectCode, lectureId, date, studentAttendanceList);

  const presentCount = studentAttendanceList.filter((r) => r.status === 'Present').length;
  const absentCount = studentAttendanceList.filter((r) => r.status === 'Absent').length;

  return {
    lectureId,
    action: 'updated',
    saved: studentAttendanceList.length,
    present: presentCount,
    absent: absentCount,
  };
}

async function rewriteAttendanceSheet(records) {
  await academicDataService.writeAttendanceBatch(records);
}

async function getLectureAttendance(lectureId) {
  return academicDataService.getAllAttendance({ lectureId });
}

async function getStudentAttendance(enrollmentNumber, filters = {}) {
  const records = await academicDataService.getAttendanceByEnrollment(enrollmentNumber, filters);
  const { subjects, overall } = computeAttendanceStats(records);

  return {
    enrollmentNumber,
    records,
    subjects,
    overall,
    defaulterThreshold: ATTENDANCE_CONFIG.DEFAULTER_THRESHOLD_PERCENT,
  };
}

async function getClassAttendance(filters = {}) {
  const records = await academicDataService.getAllAttendance(filters);

  const byStudent = {};
  for (const rec of records) {
    const enroll = rec.enrollmentNumber;
    if (!enroll) continue;
    if (!byStudent[enroll]) {
      byStudent[enroll] = { enrollmentNumber: enroll, rollNumber: rec.rollNumber, records: [] };
    }
    byStudent[enroll].records.push(rec);
  }

  const studentSummaries = Object.values(byStudent).map((s) => {
    const { overall } = computeAttendanceStats(s.records);
    return {
      enrollmentNumber: s.enrollmentNumber,
      rollNumber: s.rollNumber,
      ...overall,
    };
  });

  const defaulters = studentSummaries.filter((s) => s.isDefaulter);
  const lectureGroups = groupByLecture(records);
  const totalLectures = Object.keys(lectureGroups).length;

  return {
    records,
    totalRecords: records.length,
    totalLectures,
    studentSummaries,
    defaulters,
    defaulterThreshold: ATTENDANCE_CONFIG.DEFAULTER_THRESHOLD_PERCENT,
  };
}

async function getDefaulters(filters = {}) {
  const { studentSummaries, defaulters, defaulterThreshold } = await getClassAttendance(filters);
  return { defaulters, allStudents: studentSummaries.length, defaulterThreshold };
}

/**
 * Returns structured attendance matrix for frontend table rendering.
 * Matrix layout:
 *   Columns: distinct lectures sorted by date
 *   Rows: students with status per lecture column
 */
async function getAttendanceMatrix(filters = {}) {
  const sem = filters.semester ? Number(filters.semester) : 5;
  const students = await Student.find({ status: 'active', semester: sem })
    .select('enrollmentNumber rollNumber fullName batch')
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ rollNumber: 1 })
    .lean();

  const records = await academicDataService.getAllAttendance(filters);

  // Group lectures
  const lectureMap = {};
  for (const rec of records) {
    if (!rec.lectureId) continue;
    if (!lectureMap[rec.lectureId]) {
      lectureMap[rec.lectureId] = {
        lectureId: rec.lectureId,
        date: rec.date,
        subjectCode: rec.subjectCode,
      };
    }
  }

  const lectures = Object.values(lectureMap).sort((a, b) => (a.date > b.date ? 1 : -1));

  // Build matrix rows
  const studentRows = students.map((student) => {
    const studentRecords = records.filter((r) => r.enrollmentNumber === student.enrollmentNumber);
    const attendanceMap = {};
    studentRecords.forEach((r) => {
      attendanceMap[r.lectureId] = r.status;
    });

    const attendedCount = studentRecords.filter((r) => r.status === 'Present').length;
    const totalClasses = studentRecords.length;
    const percentage = totalClasses > 0 ? Math.round((attendedCount / totalClasses) * 10000) / 100 : 100;

    return {
      enrollmentNumber: student.enrollmentNumber,
      rollNumber: student.rollNumber,
      fullName: student.fullName,
      attendance: attendanceMap,
      attendedCount,
      totalClasses,
      percentage,
      isDefaulter: totalClasses > 0 ? percentage < 75 : false,
    };
  });

  return {
    lectures,
    students: studentRows,
    totalLectures: lectures.length,
    totalStudents: studentRows.length,
  };
}

module.exports = {
  submitAttendance,
  updateAttendance,
  getLectureAttendance,
  getStudentAttendance,
  getClassAttendance,
  getDefaulters,
  getAttendanceMatrix,
  generateLectureId,
  getStudentsForClass,
  resolveSubject,
};
