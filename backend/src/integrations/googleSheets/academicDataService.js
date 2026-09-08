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
  SHEET_NAMES,
  COLUMNS,
  HEADERS,
  ATTENDANCE_STATUS,
  MARKS_CONFIG,
  SUBJECT_CATEGORIES,
  VALID_SUBJECTS,
  SUBJECT_SHEETS,
  ATTENDANCE_WORKSHEETS,
  MARKS_WORKSHEETS,
  ALL_CATEGORY_WORKSHEETS,
  normalizeSubjectCode,
  isValidSubject,
  getSubjectWorksheetName,
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
    const requiredSheets = [SHEET_NAMES.STUDENTS, ...ALL_CATEGORY_WORKSHEETS];
    const status = await sheets.verifyConnection(requiredSheets);
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
 * Initialises all required worksheets with their header rows if they don't exist:
 * Students + 6 ATT_<SUBJECT> worksheets + 6 MARK_<SUBJECT> worksheets.
 */
async function initialiseSpreadsheet() {
  const log = [];

  // 1. Students sheet
  try {
    await sheets.ensureWorksheet(SHEET_NAMES.STUDENTS, HEADERS.STUDENTS);
    log.push({ sheet: SHEET_NAMES.STUDENTS, status: 'ok' });
  } catch (err) {
    log.push({ sheet: SHEET_NAMES.STUDENTS, status: 'error', error: err.message });
  }

  // 2. Attendance worksheets: ATT_STE, ATT_ACN, ATT_OSY, ATT_SPI, ATT_ITR, ATT_ENDS
  for (const sub of VALID_SUBJECTS) {
    try {
      const name = await sheets.ensureAttendanceWorksheet(sub);
      log.push({ sheet: name, status: 'ok' });
    } catch (err) {
      log.push({ sheet: `ATT_${sub}`, status: 'error', error: err.message });
    }
  }

  // 3. Marks worksheets: MARK_STE, MARK_ACN, MARK_OSY, MARK_SPI, MARK_ITR, MARK_ENDS
  for (const sub of VALID_SUBJECTS) {
    try {
      const name = await sheets.ensureMarksWorksheet(sub);
      log.push({ sheet: name, status: 'ok' });
    } catch (err) {
      log.push({ sheet: `MARK_${sub}`, status: 'error', error: err.message });
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

// ─── Enrollment / Roll Mapping Helper ─────────────────────────────────────────

let rollToEnrollCache = null;
let lastCacheTime = 0;

async function getRollToEnrollMap() {
  const now = Date.now();
  if (rollToEnrollCache && now - lastCacheTime < 60000) {
    return rollToEnrollCache;
  }
  try {
    const studentRows = await sheets.readRange(`${SHEET_NAMES.STUDENTS}!A2:C`);
    const map = new Map();
    if (studentRows) {
      for (const row of studentRows) {
        const enroll = String(row[0] || '').trim();
        const roll = String(row[1] || '').trim();
        if (enroll && roll) {
          const normRoll = roll.replace(/^0+/, '') || roll;
          map.set(normRoll, enroll);
          map.set(roll, enroll);
        }
      }
    }
    rollToEnrollCache = map;
    lastCacheTime = now;
    return map;
  } catch (err) {
    return new Map();
  }
}

async function enrichRecordsWithEnrollment(records) {
  const map = await getRollToEnrollMap();
  for (const r of records) {
    if (!r.enrollmentNumber && r.rollNumber) {
      const normRoll = String(r.rollNumber).trim().replace(/^0+/, '') || String(r.rollNumber).trim();
      r.enrollmentNumber = map.get(normRoll) || map.get(String(r.rollNumber).trim()) || r.rollNumber;
    }
  }
}

// ─── Subject-Wise Marks Operations (MARK_<SUBJECT>) ──────────────────────────

/**
 * Fallback to read marks from legacy Marks / Marks_Legacy worksheet if present.
 */
async function readLegacyMarks(filters = {}) {
  const sheetNamesToTry = [SHEET_NAMES.MARKS, 'Marks_Legacy'];
  for (const sName of sheetNamesToTry) {
    try {
      const allRows = await sheets.readRange(`${sName}!A:G`);
      if (!allRows || allRows.length <= 1) continue;

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
          // ignore malformed
        }
      }
      if (records.length > 0) return records;
    } catch (err) {
      // ignore
    }
  }
  return [];
}

/**
 * Reads marks from subject worksheets (MARK_STE, MARK_ACN, etc.).
 *
 * @param {object} filters  { semester?, academicYear?, subjectCode? }
 * @returns {Promise<object[]>}
 */
async function getAllMarks(filters = {}) {
  let records = [];

  if (filters.subjectCode) {
    const sub = normalizeSubjectCode(filters.subjectCode);
    if (isValidSubject(sub)) {
      try {
        records = await sheets.readSubjectMarksMatrix(sub);
      } catch (err) {
        console.warn(`[Sheets] Failed reading MARK_${sub} marks:`, err.message);
      }
    }
  } else {
    // Read all 6 subject marks worksheets in parallel
    const results = await Promise.all(
      VALID_SUBJECTS.map((sub) =>
        sheets.readSubjectMarksMatrix(sub).catch((err) => {
          console.warn(`[Sheets] Could not read MARK_${sub} worksheet: ${err.message}`);
          return [];
        })
      )
    );
    records = results.flat();
  }

  // Fallback to legacy Marks if subject sheets have no data
  if (records.length === 0) {
    return readLegacyMarks(filters);
  }

  // Enrich with enrollmentNumber and defaults
  const enrollMap = await getRollToEnrollMap();
  const sem = filters.semester ? parseInt(filters.semester, 10) : 5;
  const year = filters.academicYear || '2026-2027';

  return records.map((r) => {
    const roll = String(r.rollNumber || '').trim();
    const normRoll = roll.replace(/^0+/, '') || roll;
    const enroll = enrollMap.get(normRoll) || enrollMap.get(roll) || roll;

    return {
      enrollmentNumber: enroll,
      rollNumber: roll,
      fullName: r.fullName,
      subjectCode: r.subjectCode,
      subjectName: r.subjectCode,
      PA: r.PA,
      semester: sem,
      academicYear: year,
    };
  });
}

/**
 * Reads marks for a specific student enrollment number.
 *
 * @param {string} enrollmentNumber
 * @param {object} [filters]
 * @returns {Promise<object[]>}
 */
async function getMarksByEnrollment(enrollmentNumber, filters = {}) {
  const all = await getAllMarks(filters);
  const enroll = enrollmentNumber.toUpperCase().trim();
  const normEnroll = enroll.replace(/^0+/, '') || enroll;

  return all.filter((r) => {
    if (r.enrollmentNumber && r.enrollmentNumber.toUpperCase() === enroll) return true;
    if (r.rollNumber) {
      const normRoll = String(r.rollNumber).trim().replace(/^0+/, '') || String(r.rollNumber).trim();
      if (normRoll === normEnroll || String(r.rollNumber).trim() === enroll) return true;
    }
    return false;
  });
}

/**
 * Writes/updates a marks record for a specific student in their subject worksheet (MARK_<SUBJECT>).
 *
 * @param {object} marksInput
 */
async function writeMarks(marksInput) {
  const validated = validateMarksInput(marksInput);
  const sub = validated.subjectCode;

  await sheets.ensureMarksWorksheet(sub);

  const roll = validated.rollNumber || validated.enrollmentNumber;
  await sheets.updateSubjectMarks(sub, [
    {
      rollNumber: roll,
      PA: validated.PA,
    },
  ]);

  console.log(`[Sheets] Updated marks in MARK_${sub} for Roll ${roll} (PA: ${validated.PA})`);
  return {
    action: 'updated',
    enrollmentNumber: validated.enrollmentNumber,
    rollNumber: roll,
    subjectCode: sub,
    PA: validated.PA,
  };
}

/**
 * Bulk writes/updates marks records into their respective MARK_<SUBJECT> worksheets (SAVE ALL).
 * Groups by subject and executes one batch update per subject sheet.
 *
 * @param {object[]} marksArray
 * @returns {Promise<{ processed: number, results: object[] }>}
 */
async function writeMarksBatch(marksArray) {
  if (!marksArray || marksArray.length === 0) return { processed: 0, results: [] };

  const bySubject = {};
  for (const m of marksArray) {
    const valid = validateMarksInput(m);
    const sub = valid.subjectCode;
    if (!bySubject[sub]) bySubject[sub] = [];
    bySubject[sub].push(valid);
  }

  const results = [];
  for (const [sub, items] of Object.entries(bySubject)) {
    await sheets.ensureMarksWorksheet(sub);
    const updatePayload = items.map((it) => ({
      rollNumber: it.rollNumber || it.enrollmentNumber,
      pa1: it.pa1,
      pa2: it.pa2,
      average: it.average,
      PA: it.PA,
    }));

    await sheets.updateSubjectMarks(sub, updatePayload);

    for (const it of items) {
      results.push({
        enrollmentNumber: it.enrollmentNumber,
        rollNumber: it.rollNumber,
        subjectCode: sub,
        pa1: it.pa1,
        pa2: it.pa2,
        average: it.average,
        PA: it.PA,
        status: 'ok',
      });
    }
  }

  return { processed: marksArray.length, results };
}

// ─── Subject-Wise Attendance (ATT_<SUBJECT>) ─────────────────────────────────

/**
 * Fallback to read from legacy Attendance / Attendance_Legacy worksheet if present.
 */
async function readLegacyAttendance(filters = {}) {
  const sheetNamesToTry = [SHEET_NAMES.ATTENDANCE, 'Attendance_Legacy'];
  for (const sName of sheetNamesToTry) {
    try {
      const allRows = await sheets.readRange(`${sName}!A:F`);
      if (!allRows || allRows.length <= 1) continue;

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
          // ignore row
        }
      }
      if (records.length > 0) return records;
    } catch (err) {
      // ignore
    }
  }
  return [];
}

/**
 * Reads attendance records for a given enrollment number.
 *
 * @param {string} enrollmentNumber
 * @param {object} [filters]  { subjectCode?, date?, dateFrom?, dateTo? }
 * @returns {object[]}
 */
async function getAttendanceByEnrollment(enrollmentNumber, filters = {}) {
  const allRecords = await getAllAttendance(filters);
  const enroll = enrollmentNumber.toUpperCase().trim();
  const normEnroll = enroll.replace(/^0+/, '') || enroll;

  return allRecords.filter((r) => {
    if (r.enrollmentNumber && r.enrollmentNumber.toUpperCase() === enroll) return true;
    if (r.rollNumber) {
      const normRoll = String(r.rollNumber).trim().replace(/^0+/, '') || String(r.rollNumber).trim();
      if (normRoll === normEnroll || String(r.rollNumber).trim() === enroll) return true;
    }
    return false;
  });
}

/**
 * Reads all attendance records with optional filters.
 * Queries dedicated subject worksheets (ATT_STE, ATT_ACN, etc.).
 *
 * @param {object} [filters]  { subjectCode?, date?, lectureId? }
 * @returns {object[]}
 */
async function getAllAttendance(filters = {}) {
  let records = [];

  // 1. If a specific subject is requested
  if (filters.subjectCode) {
    const sub = normalizeSubjectCode(filters.subjectCode);
    if (isValidSubject(sub)) {
      try {
        records = await sheets.readSubjectAttendanceMatrix(sub);
      } catch (err) {
        console.warn(`[Sheets] Failed reading ATT_${sub} attendance:`, err.message);
      }
    }
  } else {
    // Read all 6 subject worksheets in parallel
    const results = await Promise.all(
      VALID_SUBJECTS.map((sub) =>
        sheets.readSubjectAttendanceMatrix(sub).catch((err) => {
          console.warn(`[Sheets] Could not read ATT_${sub} worksheet: ${err.message}`);
          return [];
        })
      )
    );
    records = results.flat();
  }

  // Fallback to legacy Attendance sheet if subject sheets are empty
  if (records.length === 0) {
    const legacyRecords = await readLegacyAttendance(filters);
    if (legacyRecords.length > 0) {
      return legacyRecords;
    }
  }

  // Enrich records with enrollmentNumber
  await enrichRecordsWithEnrollment(records);

  // Apply filters
  if (filters.date) {
    records = records.filter((r) => r.date === filters.date);
  }
  if (filters.lectureId) {
    records = records.filter((r) => r.lectureId === filters.lectureId);
  }

  return records;
}

/**
 * Appends / updates a batch of attendance records into their respective ATT_<SUBJECT> worksheets.
 *
 * @param {object[]} records  Array of attendance input objects
 * @returns {{ count: number }}
 */
async function writeAttendanceBatch(records) {
  if (!records || records.length === 0) return { count: 0 };

  // Group records by subjectCode
  const bySubject = {};
  for (const rec of records) {
    const valid = validateAttendanceInput(rec);
    const sub = valid.subjectCode;
    if (!bySubject[sub]) bySubject[sub] = [];
    bySubject[sub].push(valid);
  }

  let totalUpdated = 0;

  for (const [sub, subRecords] of Object.entries(bySubject)) {
    if (!isValidSubject(sub)) {
      console.warn(`[Sheets] Skipping attendance batch for unrecognized subject: ${sub}`);
      continue;
    }

    // Ensure subject worksheet exists (ATT_<SUBJECT>)
    await sheets.ensureAttendanceWorksheet(sub);

    // Group by lectureId and date
    const byLecture = {};
    for (const r of subRecords) {
      const key = r.lectureId || r.date;
      if (!byLecture[key]) {
        byLecture[key] = { lectureId: r.lectureId, date: r.date, list: [] };
      }
      byLecture[key].list.push(r);
    }

    for (const item of Object.values(byLecture)) {
      const res = await sheets.updateSubjectAttendance(sub, item.lectureId, item.date, item.list);
      totalUpdated += res.updatedCount || item.list.length;
    }
  }

  return { count: totalUpdated };
}

/**
 * Reusable helper functions exposed on academicDataService
 */
async function ensureWorksheet(sheetName, headers = []) {
  return sheets.ensureWorksheet(sheetName, headers);
}

function getSubjectWorksheet(category, subjectCode) {
  return sheets.getSubjectWorksheet(category, subjectCode);
}

async function ensureAttendanceWorksheet(subjectCode, students = []) {
  return sheets.ensureAttendanceWorksheet(subjectCode, students);
}

async function ensureMarksWorksheet(subjectCode, students = []) {
  return sheets.ensureMarksWorksheet(subjectCode, students);
}

async function ensureSubjectWorksheet(subjectCode, students = []) {
  return sheets.ensureAttendanceWorksheet(subjectCode, students);
}

async function syncStudentRoster(subjectCode, category = 'ATT', students = []) {
  return sheets.syncStudentRoster(subjectCode, category, students);
}

async function syncSubjectAttendance(subjectCode, students = []) {
  return sheets.syncSubjectAttendance(subjectCode, students);
}

async function syncSubjectMarks(subjectCode, students = []) {
  return sheets.syncSubjectMarks(subjectCode, students);
}

async function getSubjectAttendance(subjectCode) {
  return sheets.readSubjectAttendanceMatrix(subjectCode);
}

async function updateSubjectAttendance(subjectCode, lectureId, dateStr, studentList) {
  return sheets.updateSubjectAttendance(subjectCode, lectureId, dateStr, studentList);
}

async function getSubjectMarks(subjectCode) {
  return sheets.readSubjectMarksMatrix(subjectCode);
}

async function updateSubjectMarks(subjectCode, marksList) {
  return sheets.updateSubjectMarks(subjectCode, marksList);
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

  const raw1 = input.pa1 !== undefined ? input.pa1 : (input.PA1 !== undefined ? input.PA1 : null);
  if (raw1 !== undefined && raw1 !== null && raw1 !== '') {
    validated.pa1 = parseNumber(raw1, 'PA1', { min: 0, max: MARKS_CONFIG.MAX_PA });
  } else {
    validated.pa1 = null;
  }

  const raw2 = input.pa2 !== undefined ? input.pa2 : (input.PA2 !== undefined ? input.PA2 : null);
  if (raw2 !== undefined && raw2 !== null && raw2 !== '') {
    validated.pa2 = parseNumber(raw2, 'PA2', { min: 0, max: MARKS_CONFIG.MAX_PA });
  } else {
    validated.pa2 = null;
  }

  if (validated.pa1 !== null && validated.pa2 !== null) {
    validated.average = Math.round(((validated.pa1 + validated.pa2) / 2) * 100) / 100;
  } else {
    validated.average = null;
  }

  const rawPA = input.PA !== undefined ? input.PA : validated.average;
  if (rawPA !== undefined && rawPA !== null && rawPA !== '') {
    validated.PA = parseNumber(rawPA, 'PA', { min: 0, max: MARKS_CONFIG.MAX_PA });
  } else {
    validated.PA = validated.average;
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
  // Reusable Category + Subject Helpers
  ensureWorksheet,
  getSubjectWorksheet,
  ensureAttendanceWorksheet,
  ensureMarksWorksheet,
  ensureSubjectWorksheet,
  syncStudentRoster,
  syncSubjectAttendance,
  syncSubjectMarks,
  getSubjectAttendance,
  updateSubjectAttendance,
  getSubjectMarks,
  updateSubjectMarks,
};
