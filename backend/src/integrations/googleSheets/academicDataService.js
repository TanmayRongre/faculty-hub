/**
 * academicDataService.js
 *
 * High-level academic data operations for FacultyHub.
 * Uses googleSheetsService + mappers to provide clean domain-level functions.
 *
 * Responsibilities:
 *   - Sync MongoDB student profiles → Google Sheets Students tab
 *   - Read/write marks by enrollment number (PA / 30)
 *   - Read/write attendance records
 *   - Provide connection + status information
 *
 * This service is the ONLY layer controllers interact with for Sheets data.
 */

const sheets = require('./googleSheetsService');
const {
  SHEET_NAMES, COLUMNS, HEADERS, ATTENDANCE_STATUS, MARKS_CONFIG,
} = require('./spreadsheetConfig');
const {
  rowToStudentRecord, studentRecordToRow,
  rowToMarksRecord, marksRecordToRow,
  rowToAttendanceRecord, attendanceRecordToRow,
} = require('./mappers');
const {
  StudentNotFoundInSheetError,
  DuplicateSheetRowError,
  InvalidSheetDataError,
  GoogleSheetsError,
} = require('./errors');
const { parseNumber, parseDate } = require('./mappers');

// ─── Connection & Status ──────────────────────────────────────────────────────

/**
 * Verifies Google Sheets connection and returns status.
 */
async function getConnectionStatus() {
  try {
    const status = await sheets.verifyConnection(Object.values(SHEET_NAMES));
    return {
      connected: true,
      spreadsheetTitle: status.title,
      existingSheets: status.existingSheets,
      missingSheets: status.missingSheets,
      allSheetsPresent: status.missingSheets.length === 0,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.isOperational ? err.message : 'Google Sheets connection failed',
      code: err.code || 'SHEETS_ERROR',
    };
  }
}

/**
 * Initialises all required worksheets with their header rows if they don't exist.
 */
async function initialiseSpreadsheet() {
  const log = [];
  for (const [key, name] of Object.entries(SHEET_NAMES)) {
    try {
      await sheets.ensureWorksheet(name, HEADERS[key]);
      log.push({ sheet: name, status: 'ok' });
    } catch (err) {
      log.push({ sheet: name, status: 'error', error: err.message });
    }
  }
  return log;
}

// ─── Student Synchronisation ──────────────────────────────────────────────────

/**
 * Syncs a single MongoDB student record to the Students sheet.
 * - If enrollment number already exists → updates the row.
 * - If not found → appends a new row.
 *
 * @param {object} student  MongoDB Student document
 */
async function syncStudentToSheet(student) {
  console.log(`[Sheets] Sync student: ${student.enrollmentNumber}`);

  const allRows = await sheets.readRange(
    `${SHEET_NAMES.STUDENTS}!A:G`
  );

  const rowData = studentRecordToRow(student);

  if (!allRows || allRows.length <= 1) {
    // Sheet empty (header only or completely empty)
    await sheets.appendRows(SHEET_NAMES.STUDENTS, [rowData]);
    console.log(`[Sheets] Appended new student row: ${student.enrollmentNumber}`);
    return { action: 'appended', enrollmentNumber: student.enrollmentNumber };
  }

  const match = sheets.findRow(allRows, COLUMNS.STUDENTS.ENROLLMENT_NUMBER, student.enrollmentNumber);

  if (match) {
    // Update existing row
    const range = `${SHEET_NAMES.STUDENTS}!A${match.sheetRow}:G${match.sheetRow}`;
    await sheets.updateRange(range, [rowData]);
    console.log(`[Sheets] Updated student row ${match.sheetRow}: ${student.enrollmentNumber}`);
    return { action: 'updated', enrollmentNumber: student.enrollmentNumber, row: match.sheetRow };
  } else {
    await sheets.appendRows(SHEET_NAMES.STUDENTS, [rowData]);
    console.log(`[Sheets] Appended new student row: ${student.enrollmentNumber}`);
    return { action: 'appended', enrollmentNumber: student.enrollmentNumber };
  }
}

/**
 * Bulk-syncs an array of MongoDB student documents to the Students sheet.
 *
 * @param {object[]} students
 * @returns {{ processed: number, results: object[] }}
 */
async function syncStudentsToSheet(students) {
  console.log(`[Sheets] Bulk sync started: ${students.length} students`);
  const results = [];

  for (const s of students) {
    try {
      const res = await syncStudentToSheet(s);
      results.push(res);
    } catch (err) {
      console.error(`[Sheets] Sync error for ${s.enrollmentNumber}:`, err.message);
      results.push({ enrollmentNumber: s.enrollmentNumber, error: err.message });
    }
  }

  return { processed: students.length, results };
}

// ─── Marks Operations ─────────────────────────────────────────────────────────

/**
 * Reads all marks records for a given enrollment number.
 *
 * @param {string} enrollmentNumber
 * @param {object} [filters]  optional { semester, academicYear, subjectCode }
 * @returns {object[]}
 */
async function getMarksByEnrollment(enrollmentNumber, filters = {}) {
  const enroll = enrollmentNumber.toUpperCase().trim();
  const allRows = await sheets.readRange(`${SHEET_NAMES.MARKS}!A:G`);

  if (!allRows || allRows.length <= 1) return [];

  const matches = sheets.findRows(allRows, COLUMNS.MARKS.ENROLLMENT_NUMBER, enroll);
  if (matches.length === 0) return [];

  const records = [];
  for (const { rowData } of matches) {
    try {
      const record = rowToMarksRecord(rowData);
      if (filters.semester && record.semester !== parseInt(filters.semester, 10)) continue;
      if (filters.academicYear && record.academicYear !== filters.academicYear) continue;
      if (filters.subjectCode && record.subjectCode !== filters.subjectCode.toUpperCase()) continue;
      records.push(record);
    } catch (err) {
      console.warn(`[Sheets] Skipping malformed marks row: ${err.message}`);
    }
  }
  return records;
}

/**
 * Reads all marks for a given semester/year/subject (for faculty view).
 *
 * @param {object} filters  { semester?, academicYear?, subjectCode? }
 * @returns {object[]}
 */
async function getAllMarks(filters = {}) {
  const allRows = await sheets.readRange(`${SHEET_NAMES.MARKS}!A:G`);
  if (!allRows || allRows.length <= 1) return [];

  const records = [];
  for (let i = 1; i < allRows.length; i++) {
    try {
      const record = rowToMarksRecord(allRows[i]);
      if (!record.enrollmentNumber) continue;
      if (filters.semester && record.semester !== parseInt(filters.semester, 10)) continue;
      if (filters.academicYear && record.academicYear !== filters.academicYear) continue;
      if (filters.subjectCode && record.subjectCode !== filters.subjectCode.toUpperCase()) continue;
      records.push(record);
    } catch (err) {
      console.warn(`[Sheets] Skipping malformed marks row ${i + 1}: ${err.message}`);
    }
  }
  return records;
}

/**
 * Writes (or updates) a marks record for a specific enrollment + subject.
 *
 * @param {object} marksInput
 * @param {string} marksInput.enrollmentNumber
 * @param {string} marksInput.rollNumber
 * @param {string} marksInput.subjectCode
 * @param {string} marksInput.subjectName
 * @param {number} [marksInput.PA]
 * @param {string} marksInput.academicYear
 * @param {number} marksInput.semester
 */
async function writeMarks(marksInput) {
  const validated = validateMarksInput(marksInput);

  const allRows = await sheets.readRange(`${SHEET_NAMES.MARKS}!A:G`);
  const enroll = validated.enrollmentNumber.toUpperCase().trim();
  const subjCode = validated.subjectCode.toUpperCase().trim();

  let targetRow = null;
  if (allRows && allRows.length > 1) {
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      const rowEnroll = (row[COLUMNS.MARKS.ENROLLMENT_NUMBER] || '').toString().trim().toUpperCase();
      const rowSubj = (row[COLUMNS.MARKS.SUBJECT_CODE] || '').toString().trim().toUpperCase();
      const rowSem = parseInt(row[COLUMNS.MARKS.SEMESTER] || '0', 10);
      if (rowEnroll === enroll && rowSubj === subjCode && rowSem === validated.semester) {
        targetRow = i + 1;
        break;
      }
    }
  }

  const rowData = marksRecordToRow(validated);

  if (targetRow) {
    const range = `${SHEET_NAMES.MARKS}!A${targetRow}:G${targetRow}`;
    await sheets.updateRange(range, [rowData]);
    console.log(`[Sheets] Updated marks row ${targetRow} for ${enroll} / ${subjCode}`);
    return { action: 'updated', row: targetRow, enrollmentNumber: enroll, subjectCode: subjCode, PA: validated.PA };
  } else {
    await sheets.appendRows(SHEET_NAMES.MARKS, [rowData]);
    console.log(`[Sheets] Appended marks for ${enroll} / ${subjCode}`);
    return { action: 'appended', enrollmentNumber: enroll, subjectCode: subjCode, PA: validated.PA };
  }
}

/**
 * Bulk writes/updates marks records in Google Sheets (SAVE ALL).
 *
 * @param {object[]} marksArray
 * @returns {{ processed: number, results: object[] }}
 */
async function writeMarksBatch(marksArray) {
  const results = [];
  for (const m of marksArray) {
    try {
      const res = await writeMarks(m);
      results.push(res);
    } catch (err) {
      results.push({
        enrollmentNumber: m.enrollmentNumber,
        subjectCode: m.subjectCode,
        error: err.message,
      });
    }
  }
  return { processed: marksArray.length, results };
}

// ─── Attendance ───────────────────────────────────────────────────────────────

/**
 * Reads attendance records for a given enrollment number.
 *
 * @param {string} enrollmentNumber
 * @param {object} [filters]  { subjectCode?, date?, dateFrom?, dateTo? }
 * @returns {object[]}
 */
async function getAttendanceByEnrollment(enrollmentNumber, filters = {}) {
  const enroll = enrollmentNumber.toUpperCase().trim();
  const allRows = await sheets.readRange(`${SHEET_NAMES.ATTENDANCE}!A:F`);

  if (!allRows || allRows.length <= 1) return [];

  const matches = sheets.findRows(allRows, COLUMNS.ATTENDANCE.ENROLLMENT_NUMBER, enroll);
  const records = [];

  for (const { rowData } of matches) {
    try {
      const record = rowToAttendanceRecord(rowData);
      if (filters.subjectCode && record.subjectCode !== filters.subjectCode.toUpperCase()) continue;
      if (filters.date && record.date !== filters.date) continue;
      records.push(record);
    } catch (err) {
      console.warn(`[Sheets] Skipping malformed attendance row: ${err.message}`);
    }
  }
  return records;
}

/**
 * Reads all attendance records (faculty view) with optional filters.
 *
 * @param {object} [filters]  { subjectCode?, date?, lectureId? }
 * @returns {object[]}
 */
async function getAllAttendance(filters = {}) {
  const allRows = await sheets.readRange(`${SHEET_NAMES.ATTENDANCE}!A:F`);
  if (!allRows || allRows.length <= 1) return [];

  const records = [];
  for (let i = 1; i < allRows.length; i++) {
    try {
      const record = rowToAttendanceRecord(allRows[i]);
      if (!record.enrollmentNumber) continue;
      if (filters.subjectCode && record.subjectCode !== filters.subjectCode.toUpperCase()) continue;
      if (filters.date && record.date !== filters.date) continue;
      if (filters.lectureId && record.lectureId !== filters.lectureId) continue;
      records.push(record);
    } catch (err) {
      console.warn(`[Sheets] Skipping malformed attendance row ${i + 1}: ${err.message}`);
    }
  }
  return records;
}

/**
 * Appends a batch of attendance records.
 *
 * @param {object[]} records  Array of attendance input objects
 * @returns {{ count: number }}
 */
async function writeAttendanceBatch(records) {
  if (!records || records.length === 0) return { count: 0 };

  const validatedRows = [];
  for (const rec of records) {
    const valid = validateAttendanceInput(rec);
    validatedRows.push(attendanceRecordToRow(valid));
  }

  await sheets.appendRows(SHEET_NAMES.ATTENDANCE, validatedRows);
  console.log(`[Sheets] Appended ${validatedRows.length} attendance records`);
  return { count: validatedRows.length };
}

// ─── Input Validation Helpers ─────────────────────────────────────────────────

function validateMarksInput(input) {
  if (!input.enrollmentNumber) throw new InvalidSheetDataError('enrollmentNumber is required');
  if (!input.subjectCode) throw new InvalidSheetDataError('subjectCode is required');
  if (!input.academicYear) throw new InvalidSheetDataError('academicYear is required');
  if (!/^\d{4}-\d{4}$/.test(input.academicYear)) {
    throw new InvalidSheetDataError('academicYear must be in YYYY-YYYY format');
  }

  const sem = parseInt(input.semester, 10) || 5;

  const validated = {
    enrollmentNumber: input.enrollmentNumber.toUpperCase().trim(),
    rollNumber: (input.rollNumber || '').trim(),
    subjectCode: input.subjectCode.toUpperCase().trim(),
    subjectName: (input.subjectName || '').trim(),
    academicYear: input.academicYear,
    semester: sem,
  };

  const rawPA = input.PA !== undefined ? input.PA : (input.PA1 !== undefined ? input.PA1 : null);
  if (rawPA !== undefined && rawPA !== null && rawPA !== '') {
    validated.PA = parseNumber(rawPA, 'PA', { min: 0, max: MARKS_CONFIG.MAX_PA });
  } else {
    validated.PA = null;
  }

  return validated;
}

function validateAttendanceInput(input) {
  if (!input.enrollmentNumber) throw new InvalidSheetDataError('enrollmentNumber is required');
  if (!input.date) throw new InvalidSheetDataError('date is required');
  if (!input.subjectCode) throw new InvalidSheetDataError('subjectCode is required');
  if (!input.status) throw new InvalidSheetDataError('status is required');

  const validDate = parseDate(input.date, 'date');
  if (!validDate) throw new InvalidSheetDataError(`Invalid date: "${input.date}"`);

  if (input.status !== ATTENDANCE_STATUS.PRESENT && input.status !== ATTENDANCE_STATUS.ABSENT) {
    throw new InvalidSheetDataError(
      `Attendance status must be "${ATTENDANCE_STATUS.PRESENT}" or "${ATTENDANCE_STATUS.ABSENT}"`
    );
  }

  return {
    date: validDate,
    lectureId: (input.lectureId || '').trim(),
    subjectCode: input.subjectCode.toUpperCase().trim(),
    enrollmentNumber: input.enrollmentNumber.toUpperCase().trim(),
    rollNumber: (input.rollNumber || '').trim(),
    status: input.status,
  };
}

/**
 * Computes attendance statistics for a student from their attendance records.
 */
function computeAttendanceStats(records) {
  const bySubject = {};
  for (const rec of records) {
    if (!rec.subjectCode) continue;
    if (!bySubject[rec.subjectCode]) {
      bySubject[rec.subjectCode] = { subjectCode: rec.subjectCode, total: 0, present: 0 };
    }
    bySubject[rec.subjectCode].total++;
    if (rec.status === ATTENDANCE_STATUS.PRESENT) bySubject[rec.subjectCode].present++;
  }

  const subjects = Object.values(bySubject).map((s) => ({
    ...s,
    percentage: s.total > 0 ? parseFloat(((s.present / s.total) * 100).toFixed(2)) : 0,
    isDefaulter: s.total > 0 ? (s.present / s.total) < 0.75 : false,
  }));

  const totalClasses = records.length;
  const totalPresent = records.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
  const overallPercentage = totalClasses > 0
    ? parseFloat(((totalPresent / totalClasses) * 100).toFixed(2))
    : 0;

  return { subjects, totalClasses, totalPresent, overallPercentage };
}

module.exports = {
  getConnectionStatus,
  initialiseSpreadsheet,
  syncStudentToSheet,
  syncStudentsToSheet,
  getMarksByEnrollment,
  getAllMarks,
  writeMarks,
  writeMarksBatch,
  getAttendanceByEnrollment,
  getAllAttendance,
  writeAttendanceBatch,
  validateMarksInput,
  validateAttendanceInput,
  computeAttendanceStats,
};
