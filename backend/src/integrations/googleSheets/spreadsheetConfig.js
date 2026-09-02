/**
 * spreadsheetConfig.js
 *
 * Defines the spreadsheet structure used by FacultyHub.
 * All sheet names and column layouts are maintained here.
 * Controllers and services reference this config — never hardcode sheet/column names elsewhere.
 */

const SHEET_NAMES = {
  STUDENTS: 'Students',
  MARKS: 'Marks',
  ATTENDANCE: 'Attendance',
  ACADEMIC_SUMMARY: 'AcademicSummary',
};

/**
 * Column definitions (0-indexed positions in the sheet).
 * The header row is always row 1; data starts at row 2.
 */
const COLUMNS = {
  STUDENTS: {
    ENROLLMENT_NUMBER: 0,
    ROLL_NUMBER: 1,
    FULL_NAME: 2,
    DEPARTMENT: 3,
    SEMESTER: 4,
    ACADEMIC_YEAR: 5,
    STATUS: 6,
  },
  MARKS: {
    ENROLLMENT_NUMBER: 0,
    ROLL_NUMBER: 1,
    SUBJECT_CODE: 2,
    SUBJECT_NAME: 3,
    PA: 4,
    ACADEMIC_YEAR: 5,
    SEMESTER: 6,
  },
  ATTENDANCE: {
    DATE: 0,
    LECTURE_ID: 1,
    SUBJECT_CODE: 2,
    ENROLLMENT_NUMBER: 3,
    ROLL_NUMBER: 4,
    STATUS: 5,
  },
  ACADEMIC_SUMMARY: {
    ENROLLMENT_NUMBER: 0,
    FULL_NAME: 1,
    SEMESTER: 2,
    ACADEMIC_YEAR: 3,
    TOTAL_MARKS: 4,
    ATTENDANCE_PERCENT: 5,
    LAST_UPDATED: 6,
  },
};

/**
 * The expected header rows for each sheet.
 * Used for sheet initialisation and validation.
 */
const HEADERS = {
  STUDENTS: [
    'enrollmentNumber',
    'rollNumber',
    'fullName',
    'department',
    'semester',
    'academicYear',
    'status',
  ],
  MARKS: [
    'enrollmentNumber',
    'rollNumber',
    'subjectCode',
    'subjectName',
    'PA',
    'academicYear',
    'semester',
  ],
  ATTENDANCE: [
    'date',
    'lectureId',
    'subjectCode',
    'enrollmentNumber',
    'rollNumber',
    'status',
  ],
  ACADEMIC_SUMMARY: [
    'enrollmentNumber',
    'fullName',
    'semester',
    'academicYear',
    'totalMarks',
    'attendancePercent',
    'lastUpdated',
  ],
};

/** Valid attendance status values */
const ATTENDANCE_STATUS = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
};

/** Marks validation config */
const MARKS_CONFIG = {
  MAX_PA: 30, // Direct PA marks max 30
  MIN: 0,
};

module.exports = {
  SHEET_NAMES,
  COLUMNS,
  HEADERS,
  ATTENDANCE_STATUS,
  MARKS_CONFIG,
};
