/**
 * mappers.js
 *
 * Converts raw Google Sheets row arrays to typed application objects and vice versa.
 * Keeps mapping logic out of controllers and the service layer.
 */

const { COLUMNS, ATTENDANCE_STATUS, MARKS_CONFIG } = require('./spreadsheetConfig');
const { InvalidSheetDataError } = require('./errors');

// ─── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Safely parses a numeric cell value.
 * Returns null for empty/undefined, throws InvalidSheetDataError for malformed values.
 */
function parseNumber(value, fieldName, { min = MARKS_CONFIG.MIN, max = null } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (isNaN(n)) {
    throw new InvalidSheetDataError(`Field "${fieldName}" must be numeric, got: "${value}"`);
  }
  if (n < min) {
    throw new InvalidSheetDataError(`Field "${fieldName}" cannot be negative (got ${n})`);
  }
  if (max !== null && n > max) {
    throw new InvalidSheetDataError(`Field "${fieldName}" exceeds maximum of ${max} (got ${n})`);
  }
  return n;
}

/**
 * Safely parses a date string from the sheet.
 */
function parseDate(value, fieldName = 'date') {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new InvalidSheetDataError(`Field "${fieldName}" is not a valid date: "${value}"`);
  }
  return d.toISOString().split('T')[0]; // normalise to YYYY-MM-DD
}

// ─── Students sheet ────────────────────────────────────────────────────────────

/**
 * Maps a raw row array from the Students sheet to an application object.
 * @param {string[]} row
 * @returns {object}
 */
function rowToStudentRecord(row) {
  const c = COLUMNS.STUDENTS;
  return {
    enrollmentNumber: (row[c.ENROLLMENT_NUMBER] || '').toString().trim().toUpperCase(),
    rollNumber: (row[c.ROLL_NUMBER] || '').toString().trim(),
    fullName: (row[c.FULL_NAME] || '').toString().trim(),
    department: (row[c.DEPARTMENT] || 'Computer Science').toString().trim(),
    semester: row[c.SEMESTER] !== undefined ? parseInt(row[c.SEMESTER], 10) || 5 : 5,
    academicYear: (row[c.ACADEMIC_YEAR] || '2026-2027').toString().trim(),
    status: (row[c.STATUS] || 'active').toString().trim().toLowerCase(),
  };
}

/**
 * Maps a MongoDB Student document to a flat row array for the Students sheet.
 * @param {object} student
 * @returns {string[]}
 */
function studentRecordToRow(student) {
  return [
    student.enrollmentNumber || '',
    student.rollNumber || '',
    student.fullName || '',
    student.department?.name || student.department || 'Computer Science',
    student.semester != null ? String(student.semester) : '5',
    student.academicYear || '2026-2027',
    student.status || 'active',
  ];
}

// ─── Marks sheet ──────────────────────────────────────────────────────────────

/**
 * Maps a raw row array from the Marks sheet to an application object.
 * Validates numeric fields and returns nulls for empty cells.
 * @param {string[]} row
 * @returns {object}
 */
function rowToMarksRecord(row) {
  const c = COLUMNS.MARKS;
  try {
    return {
      enrollmentNumber: (row[c.ENROLLMENT_NUMBER] || '').toString().trim().toUpperCase(),
      rollNumber: (row[c.ROLL_NUMBER] || '').toString().trim(),
      subjectCode: (row[c.SUBJECT_CODE] || '').toString().trim().toUpperCase(),
      subjectName: (row[c.SUBJECT_NAME] || '').toString().trim(),
      PA: parseNumber(row[c.PA], 'PA', { min: 0, max: MARKS_CONFIG.MAX_PA }),
      academicYear: (row[c.ACADEMIC_YEAR] || '2026-2027').toString().trim(),
      semester: row[c.SEMESTER] !== undefined ? parseInt(row[c.SEMESTER], 10) || 5 : 5,
    };
  } catch (err) {
    throw new InvalidSheetDataError(
      `Marks row error (enrollment: "${row[c.ENROLLMENT_NUMBER] || '?'}"): ${err.message}`
    );
  }
}

/**
 * Maps a marks input object to a flat row for the Marks sheet.
 * @param {object} marks
 * @returns {string[]}
 */
function marksRecordToRow(marks) {
  return [
    marks.enrollmentNumber || '',
    marks.rollNumber || '',
    marks.subjectCode || '',
    marks.subjectName || '',
    marks.PA != null ? String(marks.PA) : '',
    marks.academicYear || '2026-2027',
    marks.semester != null ? String(marks.semester) : '5',
  ];
}

// ─── Attendance sheet ─────────────────────────────────────────────────────────

/**
 * Maps a raw row array from the Attendance sheet to an application object.
 * @param {string[]} row
 * @returns {object}
 */
function rowToAttendanceRecord(row) {
  const c = COLUMNS.ATTENDANCE;
  const status = (row[c.STATUS] || '').toString().trim();

  if (status && status !== ATTENDANCE_STATUS.PRESENT && status !== ATTENDANCE_STATUS.ABSENT) {
    throw new InvalidSheetDataError(
      `Invalid attendance status "${status}". Must be "Present" or "Absent".`
    );
  }

  return {
    date: parseDate(row[c.DATE], 'date'),
    lectureId: (row[c.LECTURE_ID] || '').toString().trim(),
    subjectCode: (row[c.SUBJECT_CODE] || '').toString().trim().toUpperCase(),
    enrollmentNumber: (row[c.ENROLLMENT_NUMBER] || '').toString().trim().toUpperCase(),
    rollNumber: (row[c.ROLL_NUMBER] || '').toString().trim(),
    status: status || ATTENDANCE_STATUS.PRESENT,
  };
}

/**
 * Maps an attendance input to a flat row for the Attendance sheet.
 * @param {object} record
 * @returns {string[]}
 */
function attendanceRecordToRow(record) {
  return [
    record.date || '',
    record.lectureId || '',
    record.subjectCode || '',
    record.enrollmentNumber || '',
    record.rollNumber || '',
    record.status || ATTENDANCE_STATUS.PRESENT,
  ];
}

// ─── Academic Summary sheet ───────────────────────────────────────────────────

/**
 * Maps a raw row array from AcademicSummary sheet to an application object.
 * @param {string[]} row
 * @returns {object}
 */
function rowToAcademicSummaryRecord(row) {
  const c = COLUMNS.ACADEMIC_SUMMARY;
  return {
    enrollmentNumber: (row[c.ENROLLMENT_NUMBER] || '').toString().trim().toUpperCase(),
    fullName: (row[c.FULL_NAME] || '').toString().trim(),
    semester: row[c.SEMESTER] !== undefined ? parseInt(row[c.SEMESTER], 10) || 5 : 5,
    academicYear: (row[c.ACADEMIC_YEAR] || '2026-2027').toString().trim(),
    totalMarks: parseNumber(row[c.TOTAL_MARKS], 'totalMarks'),
    attendancePercent: parseNumber(row[c.ATTENDANCE_PERCENT], 'attendancePercent', { max: 100 }),
    lastUpdated: row[c.LAST_UPDATED] ? row[c.LAST_UPDATED].toString().trim() : null,
  };
}

/**
 * Maps an academic summary object to a flat row for the AcademicSummary sheet.
 * @param {object} summary
 * @returns {string[]}
 */
function academicSummaryRecordToRow(summary) {
  return [
    summary.enrollmentNumber || '',
    summary.fullName || '',
    summary.semester != null ? String(summary.semester) : '5',
    summary.academicYear || '2026-2027',
    summary.totalMarks != null ? String(summary.totalMarks) : '',
    summary.attendancePercent != null ? String(summary.attendancePercent) : '',
    summary.lastUpdated || new Date().toISOString(),
  ];
}

module.exports = {
  rowToStudentRecord,
  studentRecordToRow,
  rowToMarksRecord,
  marksRecordToRow,
  rowToAttendanceRecord,
  attendanceRecordToRow,
  rowToAcademicSummaryRecord,
  academicSummaryRecordToRow,
  parseNumber,
  parseDate,
};
