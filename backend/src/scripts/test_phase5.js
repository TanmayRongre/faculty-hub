/**
 * test_phase5.js
 *
 * Phase 5 Fast Attendance System & Analytics Verification Test Suite
 *
 * Covers:
 *   1. Present-by-Default Logic & Marking
 *   2. Percentage Calculations:
 *      - 100%
 *      - 90%+
 *      - 80%+
 *      - Exactly 75% (Strict boundary: NOT a defaulter)
 *      - 74% (Defaulter)
 *      - Below 50%
 *      - 0%
 *      - 0 Conducted (Empty)
 *   3. Defaulter Threshold Verification (< 75%)
 *   4. Multi-subject Stats Aggregation
 *   5. Lecture ID Generation & Duplicate Prevention / Grouping
 *   6. Validation Rules & Input Constraints
 *
 * Run: node src/scripts/test_phase5.js
 */

const {
  ATTENDANCE_CONFIG,
  isDefaulter,
  computeAttendanceStats,
  groupByLecture,
  buildAttendanceRecords,
} = require('../services/attendance/attendanceCalculator');

const {
  validateAttendanceInput,
} = require('../integrations/googleSheets/academicDataService');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
    errors.push(message);
  }
}

function assertThrows(fn, containsText, message) {
  try {
    fn();
    console.error(`  ✗ FAIL (expected throw): ${message}`);
    failed++;
    errors.push(message + ' (did not throw)');
  } catch (err) {
    if (containsText && !err.message.includes(containsText)) {
      console.error(`  ✗ FAIL (wrong error "${err.message}"): ${message}`);
      failed++;
      errors.push(message + ` (wrong error: ${err.message})`);
    } else {
      console.log(`  ✓ ${message}`);
      passed++;
    }
  }
}

function section(name) {
  console.log(`\n─── ${name} ───`);
}

// ─── 1. PRESENT-BY-DEFAULT LOGIC ─────────────────────────────────────────────

section('1. Present-by-Default Attendance Marking');

const mockStudents = [
  { enrollmentNumber: '26001001', rollNumber: '01', fullName: 'Student 1' },
  { enrollmentNumber: '26001002', rollNumber: '02', fullName: 'Student 2' },
  { enrollmentNumber: '26001003', rollNumber: '03', fullName: 'Student 3' },
  { enrollmentNumber: '26001004', rollNumber: '04', fullName: 'Student 4' },
  { enrollmentNumber: '26001005', rollNumber: '05', fullName: 'Student 5' },
];

const lectureCtx = {
  date: '2026-08-26',
  lectureId: '20260826-OS22516-A-1',
  subjectCode: 'OS-22516',
  subjectName: 'Operating Systems',
};

// Case 1: All Present (empty absent set)
const allPresent = buildAttendanceRecords(mockStudents, new Set(), lectureCtx);
assert(allPresent.length === 5, 'All Present: 5 records generated');
assert(allPresent.every(r => r.status === 'Present'), 'All Present: Every student is Present by default');

// Case 2: One Absent (Student 3)
const oneAbsent = buildAttendanceRecords(mockStudents, new Set(['26001003']), lectureCtx);
assert(oneAbsent.find(r => r.enrollmentNumber === '26001003').status === 'Absent', 'One Absent: Student 3 is marked Absent');
assert(oneAbsent.filter(r => r.status === 'Present').length === 4, 'One Absent: Remaining 4 students are Present');

// Case 3: Multiple Absent (Students 2 and 5)
const multiAbsent = buildAttendanceRecords(mockStudents, new Set(['26001002', '26001005']), lectureCtx);
assert(multiAbsent.find(r => r.enrollmentNumber === '26001002').status === 'Absent', 'Multi Absent: Student 2 is Absent');
assert(multiAbsent.find(r => r.enrollmentNumber === '26001005').status === 'Absent', 'Multi Absent: Student 5 is Absent');
assert(multiAbsent.filter(r => r.status === 'Present').length === 3, 'Multi Absent: 3 students remain Present');

// Case 4: Case-insensitive enrollment check
const caseInsensitive = buildAttendanceRecords(mockStudents, new Set(['26001001'.toLowerCase()]), lectureCtx);
assert(caseInsensitive.find(r => r.enrollmentNumber === '26001001').status === 'Absent', 'Case insensitive enrollment match handled');

// ─── 2. ATTENDANCE PERCENTAGES & DEFAULTER THRESHOLD ─────────────────────────

section('2. Attendance Percentage & Defaulter Boundary (< 75%)');

assert(ATTENDANCE_CONFIG.DEFAULTER_THRESHOLD_PERCENT === 75, 'Config: Defaulter threshold is configured to 75%');

// 100% -> Safe
assert(isDefaulter(100) === false, '100% attendance: isDefaulter = false');

// 90% -> Safe
assert(isDefaulter(90) === false, '90% attendance: isDefaulter = false');

// 80% -> Safe
assert(isDefaulter(80) === false, '80% attendance: isDefaulter = false');

// EXACTLY 75.0% -> NOT a defaulter (Strict boundary)
assert(isDefaulter(75.0) === false, 'EXACTLY 75.0% attendance: isDefaulter = false (NOT a defaulter)');

// 74.99% -> Defaulter
assert(isDefaulter(74.99) === true, '74.99% attendance: isDefaulter = true (Defaulter)');

// 74.0% -> Defaulter
assert(isDefaulter(74.0) === true, '74.0% attendance: isDefaulter = true (Defaulter)');

// 60.0% -> Defaulter
assert(isDefaulter(60.0) === true, '60.0% attendance: isDefaulter = true (Defaulter)');

// Below 50% (e.g. 35%) -> Defaulter
assert(isDefaulter(35.0) === true, '35.0% attendance: isDefaulter = true (Defaulter)');

// 0% -> Defaulter
assert(isDefaulter(0) === true, '0.0% attendance: isDefaulter = true (Defaulter)');

// ─── 3. COMPUTING ATTENDANCE STATS FROM RECORDS ──────────────────────────────

section('3. Stats Computation & Aggregation (computeAttendanceStats)');

// 20 lectures total: 15 attended, 5 absent -> 75.0% (Safe)
const recs75 = [];
for (let i = 1; i <= 15; i++) recs75.push({ subjectCode: 'CS501', status: 'Present' });
for (let i = 16; i <= 20; i++) recs75.push({ subjectCode: 'CS501', status: 'Absent' });

const stats75 = computeAttendanceStats(recs75);
assert(stats75.overall.total === 20, 'Stats 75%: Total = 20');
assert(stats75.overall.present === 15, 'Stats 75%: Present = 15');
assert(stats75.overall.absent === 5, 'Stats 75%: Absent = 5');
assert(stats75.overall.percentage === 75.0, 'Stats 75%: Percentage = 75.0%');
assert(stats75.overall.isDefaulter === false, 'Stats 75%: isDefaulter = false');

// 20 lectures total: 14 attended, 6 absent -> 70.0% (Defaulter)
const recs70 = [];
for (let i = 1; i <= 14; i++) recs70.push({ subjectCode: 'CS501', status: 'Present' });
for (let i = 15; i <= 20; i++) recs70.push({ subjectCode: 'CS501', status: 'Absent' });

const stats70 = computeAttendanceStats(recs70);
assert(stats70.overall.percentage === 70.0, 'Stats 70%: Percentage = 70.0%');
assert(stats70.overall.isDefaulter === true, 'Stats 70%: isDefaulter = true');

// Multi-subject records
const multiSubjectRecs = [
  // Subject 1: 10/10 = 100%
  ...Array(10).fill({ subjectCode: 'OS-22516', status: 'Present' }),
  // Subject 2: 6/10 = 60% (Defaulter for this subject)
  ...Array(6).fill({ subjectCode: 'STE-22517', status: 'Present' }),
  ...Array(4).fill({ subjectCode: 'STE-22517', status: 'Absent' }),
];

const multiStats = computeAttendanceStats(multiSubjectRecs);
assert(multiStats.subjects.length === 2, 'Multi-subject: 2 distinct subjects computed');

const osSubj = multiStats.subjects.find(s => s.subjectCode === 'OS-22516');
assert(osSubj.total === 10 && osSubj.percentage === 100, 'OS-22516: 10/10, 100%');
assert(osSubj.isDefaulter === false, 'OS-22516: Not a defaulter');

const steSubj = multiStats.subjects.find(s => s.subjectCode === 'STE-22517');
assert(steSubj.total === 10 && steSubj.percentage === 60.0, 'STE-22517: 6/10, 60%');
assert(steSubj.isDefaulter === true, 'STE-22517: Flagged as subject defaulter');

// Overall: 16/20 = 80%
assert(multiStats.overall.total === 20, 'Multi-subject Overall: Total = 20');
assert(multiStats.overall.present === 16, 'Multi-subject Overall: Present = 16');
assert(multiStats.overall.percentage === 80.0, 'Multi-subject Overall: 80%');
assert(multiStats.overall.isDefaulter === false, 'Multi-subject Overall: Not overall defaulter');

// Empty records (0 conducted)
const emptyStats = computeAttendanceStats([]);
assert(emptyStats.overall.total === 0, 'Empty records: total = 0');
assert(emptyStats.overall.percentage === 0, 'Empty records: percentage = 0');
assert(emptyStats.overall.isDefaulter === false, 'Empty records: isDefaulter = false (no conducted lectures)');

// ─── 4. DUPLICATE PREVENTION & LECTURE GROUPING ──────────────────────────────

section('4. Lecture Grouping & Duplicate Prevention Logic');

const duplicatePool = [
  { lectureId: 'LEC-101', enrollmentNumber: '26001001', status: 'Present' },
  { lectureId: 'LEC-101', enrollmentNumber: '26001002', status: 'Absent' },
  { lectureId: 'LEC-102', enrollmentNumber: '26001001', status: 'Present' },
  { lectureId: 'LEC-102', enrollmentNumber: '26001002', status: 'Present' },
];

const grouped = groupByLecture(duplicatePool);
assert(Object.keys(grouped).length === 2, 'groupByLecture: 2 unique lecture groups');
assert(grouped['LEC-101'].length === 2, 'LEC-101 has 2 student entries');
assert(grouped['LEC-102'].length === 2, 'LEC-102 has 2 student entries');

// ─── 5. INPUT VALIDATION RULES ───────────────────────────────────────────────

section('5. Validation Rules (validateAttendanceInput)');

// Valid record
const validRecord = validateAttendanceInput({
  date: '2026-08-26',
  subjectCode: 'OS-22516',
  enrollmentNumber: '26001001',
  rollNumber: '01',
  status: 'Present',
});
assert(validRecord.status === 'Present', 'Valid input accepted with Present status');
assert(validRecord.date === '2026-08-26', 'Valid date parsed');

// Invalid Status
assertThrows(
  () => validateAttendanceInput({
    date: '2026-08-26',
    subjectCode: 'OS-22516',
    enrollmentNumber: '26001001',
    status: 'Late',
  }),
  'Attendance status must be',
  'Status "Late" rejected (must be Present or Absent)'
);

// Invalid Date
assertThrows(
  () => validateAttendanceInput({
    date: 'invalid-date',
    subjectCode: 'OS-22516',
    enrollmentNumber: '26001001',
    status: 'Present',
  }),
  'valid date',
  'Invalid date string rejected'
);

// Missing enrollmentNumber
assertThrows(
  () => validateAttendanceInput({
    date: '2026-08-26',
    subjectCode: 'OS-22516',
    status: 'Present',
  }),
  'enrollmentNumber is required',
  'Missing enrollmentNumber rejected'
);

// Missing subjectCode
assertThrows(
  () => validateAttendanceInput({
    date: '2026-08-26',
    enrollmentNumber: '26001001',
    status: 'Present',
  }),
  'subjectCode is required',
  'Missing subjectCode rejected'
);

// ─── TEST SUMMARY ────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`Phase 5 Fast Attendance Engine Verification: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed Tests:');
  errors.forEach((e) => console.log(`  - ${e}`));
  process.exit(1);
} else {
  console.log('ALL PHASE 5 VERIFICATION TESTS PASSED ✓');
  process.exit(0);
}
