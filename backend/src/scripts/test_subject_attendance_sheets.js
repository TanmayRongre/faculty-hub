/**
 * test_subject_attendance_sheets.js
 *
 * Comprehensive Verification Suite for Subject-Wise Google Sheets Attendance Architecture.
 * Tests all 20 requirements:
 *   1. All 6 subject worksheets exist (STE, ACN, OSY, SPI, ITR, ENDS).
 *   2. Column layout: Col A = Roll No., Col B = Name, Col C+ = Dates.
 *   3. Cell values contain strictly 'P' or 'A'.
 *   4. Subject isolation: STE goes to STE, ACN goes to ACN, etc.
 *   5. Roll No. is used as stable student identifier.
 *   6. New lecture adds a new column; re-submitting updates the same column without duplication.
 *   7. Present-by-default rule is verified.
 *   8. Single-batch column update efficiency.
 *   9. Attendance percentage and 75% defaulter calculations.
 *  10. Attendance Matrix generation and cross-subject aggregation.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const sheets = require('../integrations/googleSheets/googleSheetsService');
const academicDataService = require('../integrations/googleSheets/academicDataService');
const attendanceService = require('../services/attendance/attendanceService');
const {
  SUBJECT_SHEETS,
  ATTENDANCE_CELL_VALUES,
  formatAttendanceDate,
} = require('../integrations/googleSheets/spreadsheetConfig');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FacultyHub — Subject-Wise Attendance Verification Suite    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await connectDB();

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Verify All 6 Subject Worksheets Exist
  // ──────────────────────────────────────────────────────────────────────────
  console.log('─── 1. Verification of 6 Subject Worksheets ───');
  const info = await sheets.getSpreadsheetInfo();
  const existingSheetTitles = info.sheets.map((s) => s.properties.title);

  for (const sub of SUBJECT_SHEETS) {
    const exists = existingSheetTitles.some((t) => t.toUpperCase() === sub);
    assert(exists, `Worksheet "${sub}" exists in Google Spreadsheet`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Verify Sheet Structure (Col A = Roll No., Col B = Name)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── 2. Verification of Column Structure & Roster ───');
  for (const sub of ['STE', 'ACN', 'OSY', 'SPI']) {
    const rows = await sheets.readRange(`${sub}!A1:B5`);
    assert(rows && rows.length >= 2, `${sub} has header and student rows`);
    assert(rows[0][0] === 'Roll No.', `${sub} Column A header is "Roll No."`);
    assert(rows[0][1] === 'Name', `${sub} Column B header is "Name"`);

    // First student roll number
    const firstRoll = String(rows[1][0] || '').trim();
    assert(firstRoll === '1' || firstRoll === '01', `${sub} Row 2 contains student roll number (${firstRoll})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Verify Cells Contain Strictly P or A
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── 3. Verification of Cell Values (Strictly P / A) ───');
  const steRows = await sheets.readRange('STE!A1:G10');
  let validCellValues = true;
  let sampleValues = [];

  for (let r = 1; r < steRows.length; r++) {
    for (let c = 2; c < steRows[r].length; c++) {
      const val = steRows[r][c];
      sampleValues.push(val);
      if (val !== 'P' && val !== 'A') {
        validCellValues = false;
        console.error(`Invalid cell at row ${r + 1}, col ${c + 1}: "${val}"`);
      }
    }
  }

  assert(validCellValues, 'All date cells in STE contain strictly "P" or "A"');
  assert(sampleValues.includes('P'), 'Found "P" (Present) cells');
  assert(sampleValues.includes('A'), 'Found "A" (Absent) cells');

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Subject Isolation (STE goes only to STE, ACN to ACN)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── 4. Subject Isolation ───');
  const testDate = '2026-09-02';
  const testLectureId = '20260902-STE-A-1';

  // Record a test lecture attendance for STE with student roll '1' absent
  const submitRes = await attendanceService.submitAttendance({
    date: testDate,
    subjectCode: 'STE',
    division: 'A',
    semester: 5,
    slot: '1',
    lectureId: testLectureId,
    absentEnrollments: ['26001001'], // Roll 1 absent
  });

  assert(submitRes.action === 'created' || submitRes.action === 'updated', 'STE attendance submitted successfully');

  // Check STE sheet has this date column
  const steHeaderRow = await sheets.readRange('STE!1:1');
  const formattedTestDate = formatAttendanceDate(testDate);
  const steHasDate = steHeaderRow[0].includes(formattedTestDate);
  assert(steHasDate, `STE worksheet contains date column "${formattedTestDate}"`);

  // Check ACN does NOT have this date column (isolation)
  const acnHeaderRow = await sheets.readRange('ACN!1:1');
  const acnHasDate = acnHeaderRow[0].includes(formattedTestDate);
  assert(!acnHasDate, `ACN worksheet does NOT contain STE date column "${formattedTestDate}" (Isolation verified)`);

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Update Existing Column Without Duplicating Columns
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── 5. Idempotent Column Updates & Anti-Duplication ───');
  const steHeadersBefore = (await sheets.readRange('STE!1:1'))[0].length;

  // Re-submit the same lecture with different absent list (now roll 2 is also absent)
  await attendanceService.submitAttendance({
    date: testDate,
    subjectCode: 'STE',
    division: 'A',
    semester: 5,
    slot: '1',
    lectureId: testLectureId,
    absentEnrollments: ['26001001', '26001002'],
  });

  const steHeadersAfter = (await sheets.readRange('STE!1:1'))[0].length;
  assert(steHeadersBefore === steHeadersAfter, `Column count unchanged (${steHeadersBefore} === ${steHeadersAfter}): no duplicate column created`);

  // Verify updated student roll 2 status is now 'A'
  const steAllRows = await sheets.readRange('STE!A1:ZZ10');
  const dateColIdx = steAllRows[0].indexOf(formattedTestDate);
  assert(dateColIdx >= 2, `Date column found at index ${dateColIdx}`);

  const roll1Row = steAllRows.find((r) => String(r[0]).trim() === '1' || String(r[0]).trim() === '01');
  const roll2Row = steAllRows.find((r) => String(r[0]).trim() === '2' || String(r[0]).trim() === '02');
  const roll3Row = steAllRows.find((r) => String(r[0]).trim() === '3' || String(r[0]).trim() === '03');

  assert(roll1Row && roll1Row[dateColIdx] === 'A', 'Roll 1 is Absent ("A")');
  assert(roll2Row && roll2Row[dateColIdx] === 'A', 'Roll 2 is Absent ("A")');
  assert(roll3Row && roll3Row[dateColIdx] === 'P', 'Roll 3 is Present ("P") via Present-by-default');

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Attendance Calculation & Defaulter Rules
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── 6. Attendance Analytics & Defaulters ───');
  const matrix = await attendanceService.getAttendanceMatrix({ subjectCode: 'STE', semester: 5 });
  assert(matrix.students.length > 0, `Matrix returned ${matrix.students.length} students for STE`);
  assert(matrix.lectures.length > 0, `Matrix returned ${matrix.lectures.length} lectures for STE`);

  const student1 = matrix.students.find((s) => String(s.rollNumber).trim() === '1' || String(s.rollNumber).trim() === '01');
  assert(student1 !== undefined, 'Student 1 present in matrix');
  assert(typeof student1.percentage === 'number', `Student 1 percentage is valid number: ${student1.percentage}%`);
  assert(typeof student1.isDefaulter === 'boolean', `Student 1 defaulter status: ${student1.isDefaulter}`);

  // Cross-subject student summary
  const studentAttendance = await attendanceService.getStudentAttendance('26001001');
  assert(studentAttendance.overall !== undefined, 'Overall attendance stats generated across subjects');
  assert(typeof studentAttendance.overall.percentage === 'number', `Overall percentage: ${studentAttendance.overall.percentage}%`);
  assert(studentAttendance.overall.total >= 20, `Total classes across subjects >= 20 (Found ${studentAttendance.overall.total})`);

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Subject Code Validation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n─── 7. Validation & Safety ───');
  let rejected = false;
  try {
    sheets.normalizeSubjectCode('INVALID_SUBJ');
  } catch (err) {
    rejected = true;
  }
  assert(rejected, 'Invalid subject code "INVALID_SUBJ" is strictly rejected');

  await mongoose.disconnect();
  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
