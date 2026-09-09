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

// Map sheet name aliases so both HEADERS.STUDENTS and HEADERS[SHEET_NAMES.STUDENTS] work
HEADERS[SHEET_NAMES.STUDENTS] = HEADERS.STUDENTS;
HEADERS[SHEET_NAMES.MARKS] = HEADERS.MARKS;
HEADERS[SHEET_NAMES.ATTENDANCE] = HEADERS.ATTENDANCE;
HEADERS[SHEET_NAMES.ACADEMIC_SUMMARY] = HEADERS.ACADEMIC_SUMMARY;

/**
 * Active Subject Categories and Allowed Subjects (strictly Computer Science, 5th Semester)
 */
const SUBJECT_CATEGORIES = {
  ATTENDANCE: 'ATT',
  MARKS: 'MARK',
};

const VALID_SUBJECTS = ['STE', 'ACN', 'OSY', 'SPI', 'ENDS'];
// Backward-compatible alias
const SUBJECT_SHEETS = VALID_SUBJECTS;

/**
 * Attendance Redesign: Subjects strictly STE, OSY, ENDS, ACN
 */
const ATTENDANCE_SUBJECTS = ['STE', 'OSY', 'ENDS', 'ACN'];
const PRACTICAL_BATCHES = ['A', 'B', 'C'];

const BATCH_DEFINITIONS = {
  A: { minRoll: 1, maxRoll: 24, count: 24 },
  B: { minRoll: 25, maxRoll: 47, count: 23 },
  C: { minRoll: 48, maxRoll: 68, count: 21 },
};

function getBatchForRoll(rollNumber) {
  const r = Number(rollNumber);
  if (r >= 1 && r <= 24) return 'A';
  if (r >= 25 && r <= 47) return 'B';
  if (r >= 48 && r <= 68) return 'C';
  return null;
}

function validateBatchRoll(batch, rollNumber) {
  const b = String(batch || '').trim().toUpperCase();
  const def = BATCH_DEFINITIONS[b];
  if (!def) return false;
  const r = Number(rollNumber);
  return r >= def.minRoll && r <= def.maxRoll;
}

/**
 * Normalizes subject code (uppercase, trimmed)
 */
function normalizeSubjectCode(code) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Validates if subject is one of the allowed subjects
 */
function isValidSubject(code) {
  return VALID_SUBJECTS.includes(normalizeSubjectCode(code));
}

function isValidAttendanceSubject(code) {
  return ATTENDANCE_SUBJECTS.includes(normalizeSubjectCode(code));
}

/**
 * Maps Attendance Type + Subject + Batch to Google Sheets Worksheet Name:
 * - Lecture: ATT-LEC-<SUB> (e.g. ATT-LEC-STE)
 * - Practical: ATT-PR-<SUB>-<BATCH> (e.g. ATT-PR-STE-A)
 */
function getAttendanceWorksheetName(attendanceType, subjectCode, batch = null) {
  const normType = String(attendanceType || '').trim().toUpperCase();
  const sub = normalizeSubjectCode(subjectCode);

  if (!isValidAttendanceSubject(sub)) {
    throw new Error(
      `Invalid attendance subject: "${subjectCode}". Allowed attendance subjects: ${ATTENDANCE_SUBJECTS.join(', ')}`
    );
  }

  if (normType === 'LECTURE' || normType === 'LEC') {
    if (batch) {
      throw new Error(`Batch selection is not allowed for Lecture attendance (${sub})`);
    }
    return `ATT-LEC-${sub}`;
  }

  if (normType === 'PRACTICAL' || normType === 'PR') {
    const b = String(batch || '').trim().toUpperCase();
    if (!PRACTICAL_BATCHES.includes(b)) {
      throw new Error(
        `Invalid practical batch: "${batch}". Must be one of: ${PRACTICAL_BATCHES.join(', ')}`
      );
    }
    return `ATT-PR-${sub}-${b}`;
  }

  throw new Error(`Invalid attendance type: "${attendanceType}". Must be LECTURE or PRACTICAL.`);
}

/**
 * Centralized mapping: CATEGORY + SUBJECT -> GOOGLE WORKSHEET NAME
 * Example: getSubjectWorksheetName('ATTENDANCE', 'STE') -> 'ATT_STE' (Legacy)
 * Example: getSubjectWorksheetName('MARK', 'ACN') -> 'MARK_ACN'
 */
function getSubjectWorksheetName(category, subjectCode) {
  const normSubject = normalizeSubjectCode(subjectCode);
  if (!isValidSubject(normSubject)) {
    throw new Error(
      `Invalid subject: "${subjectCode}". Only strictly allowed subjects are: ${VALID_SUBJECTS.join(', ')}`
    );
  }

  const normCat = String(category || '').trim().toUpperCase();
  let prefix = '';
  if (normCat === 'ATTENDANCE' || normCat === 'ATT') {
    prefix = SUBJECT_CATEGORIES.ATTENDANCE;
  } else if (normCat === 'MARKS' || normCat === 'MARK') {
    prefix = SUBJECT_CATEGORIES.MARKS;
  } else {
    throw new Error(`Invalid subject category: "${category}". Must be ATTENDANCE or MARKS.`);
  }

  return `${prefix}_${normSubject}`;
}

/**
 * 16 Attendance Worksheets (4 Lecture + 12 Practical)
 */
const ATTENDANCE_LECTURE_WORKSHEETS = ATTENDANCE_SUBJECTS.map((sub) => `ATT-LEC-${sub}`);
const ATTENDANCE_PRACTICAL_WORKSHEETS = ATTENDANCE_SUBJECTS.flatMap((sub) =>
  PRACTICAL_BATCHES.map((b) => `ATT-PR-${sub}-${b}`)
);
const ALL_ATTENDANCE_WORKSHEETS = [
  ...ATTENDANCE_LECTURE_WORKSHEETS,
  ...ATTENDANCE_PRACTICAL_WORKSHEETS,
];

// Legacy attendance worksheets
const LEGACY_ATTENDANCE_WORKSHEETS = ['ATT_STE', 'ATT_ACN', 'ATT_OSY', 'ATT_SPI', 'ATT_ENDS', 'Attendance_Legacy'];

// Marks worksheets
const MARKS_WORKSHEETS = VALID_SUBJECTS.map((sub) => `MARK_${sub}`);
const ALL_CATEGORY_WORKSHEETS = [...ALL_ATTENDANCE_WORKSHEETS, ...MARKS_WORKSHEETS];

/**
 * Column definitions for subject-wise worksheets:
 * Attendance: Col A (0): Roll No., Col B (1): Name, Col C+ (2+): Lecture dates (DD-MMM-YYYY)
 * Marks: Col A (0): Roll No., Col B (1): Name, Col C (2): PA1, Col D (3): PA2, Col E (4): Avg
 */
const SUBJECT_ATTENDANCE_HEADERS = ['Roll No.', 'Name'];
const SUBJECT_MARKS_HEADERS = ['Roll No.', 'Name', 'PA1', 'PA2', 'Avg'];

// Register headers for all 16 attendance worksheets and mark worksheets
for (const sheet of ALL_ATTENDANCE_WORKSHEETS) {
  HEADERS[sheet] = SUBJECT_ATTENDANCE_HEADERS;
}
for (const sheet of LEGACY_ATTENDANCE_WORKSHEETS) {
  HEADERS[sheet] = SUBJECT_ATTENDANCE_HEADERS;
}
for (const sheet of MARKS_WORKSHEETS) {
  HEADERS[sheet] = SUBJECT_MARKS_HEADERS;
}

/**
 * Date formatting helper: converts ISO string/Date (YYYY-MM-DD) to DD-MMM-YYYY (e.g. 01-Sep-2026)
 */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatAttendanceDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Parse DD-MMM-YYYY back to YYYY-MM-DD
 */
function parseAttendanceDate(formattedStr) {
  if (!formattedStr) return '';
  const parts = String(formattedStr).trim().split('-');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const monthIndex = MONTH_NAMES.indexOf(parts[1]);
    const year = parts[2];
    if (monthIndex >= 0) {
      const month = String(monthIndex + 1).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  // Fallback if already YYYY-MM-DD
  return String(formattedStr).trim();
}

/** Valid attendance status values */
const ATTENDANCE_STATUS = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
};

const ATTENDANCE_CELL_VALUES = {
  PRESENT: 'P',
  ABSENT: 'A',
};

/** Marks validation config */
const MARKS_CONFIG = {
  MAX_PA: 30, // Direct PA marks max 30
  MIN: 0,
};

module.exports = {
  SHEET_NAMES,
  SUBJECT_CATEGORIES,
  VALID_SUBJECTS,
  SUBJECT_SHEETS,
  ATTENDANCE_SUBJECTS,
  PRACTICAL_BATCHES,
  BATCH_DEFINITIONS,
  getBatchForRoll,
  validateBatchRoll,
  isValidAttendanceSubject,
  getAttendanceWorksheetName,
  ATTENDANCE_LECTURE_WORKSHEETS,
  ATTENDANCE_PRACTICAL_WORKSHEETS,
  ALL_ATTENDANCE_WORKSHEETS,
  LEGACY_ATTENDANCE_WORKSHEETS,
  ATTENDANCE_WORKSHEETS: ALL_ATTENDANCE_WORKSHEETS, // Backward compatible
  MARKS_WORKSHEETS,
  ALL_CATEGORY_WORKSHEETS,
  SUBJECT_ATTENDANCE_HEADERS,
  SUBJECT_MARKS_HEADERS,
  COLUMNS,
  HEADERS,
  ATTENDANCE_STATUS,
  ATTENDANCE_CELL_VALUES,
  MARKS_CONFIG,
  normalizeSubjectCode,
  isValidSubject,
  getSubjectWorksheetName,
  formatAttendanceDate,
  parseAttendanceDate,
};

