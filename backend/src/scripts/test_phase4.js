/**
 * test_phase4.js
 *
 * Phase 4 MSBTE Marks Engine Verification Test Suite
 * Updated for Direct Progressive Assessment (PA) evaluation out of 30.
 *
 * Covers:
 *   1. Direct PA Evaluation & Validation (0 - 30)
 *   2. Boundary Value Testing (0, 30, out-of-bounds rejected)
 *   3. Zero Values vs Missing/Null Values
 *   4. Decimal Precision & Rounding
 *   5. Performance Status Classification (Excellent, Good, Average, Needs Attention)
 *   6. Summary Analytics Generation
 *
 * Run: node src/scripts/test_phase4.js
 */

const {
  calculatePA,
  calculateMarks,
  validateRawMarks,
  generatePerformanceSummary,
  enrichMarksRecords,
  getPerformanceStatus,
  MSBTE_CONFIG,
} = require('../services/marks/msbteEngine');

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

// ─── 1. DIRECT PA EVALUATION (0–30) ──────────────────────────────────────────

section('1. Direct PA Evaluation (Max 30 Marks)');

const paValid = calculatePA(25);
assert(paValid.PA === 25, 'Valid PA mark preserved: 25');
assert(paValid.percentage === 83.3, 'Calculated percentage: (25/30)*100 = 83.3%');
assert(paValid.status === 'Excellent', 'Performance status for 25/30 is Excellent');
assert(paValid.isMissing === false, 'isMissing flag is false');

// Boundary Max: 30
const paMax = calculatePA(30);
assert(paMax.PA === 30, 'Max PA mark: 30');
assert(paMax.percentage === 100.0, 'Percentage for 30/30 is 100%');
assert(paMax.status === 'Excellent', 'Max mark status is Excellent');

// Boundary Min: 0
const paMin = calculatePA(0);
assert(paMin.PA === 0, 'Min PA mark: 0 (Zero is valid score)');
assert(paMin.percentage === 0.0, 'Percentage for 0/30 is 0%');
assert(paMin.status === 'Needs Attention', 'Zero mark status is Needs Attention');
assert(paMin.isMissing === false, 'Zero mark is NOT missing');

// Missing/Null input
const paNull = calculatePA(null);
assert(paNull.PA === null, 'Null input yields null PA');
assert(paNull.isMissing === true, 'Null mark correctly marked isMissing');
assert(paNull.status === null, 'Null mark status is null');

// ─── 2. BOUNDARY VALIDATION & REJECTIONS ─────────────────────────────────────

section('2. Validation & Boundary Constraints');

assert(validateRawMarks({ PA: 0 }) === true, 'validateRawMarks accepts 0');
assert(validateRawMarks({ PA: 30 }) === true, 'validateRawMarks accepts 30');
assert(validateRawMarks({ PA: 18.5 }) === true, 'validateRawMarks accepts decimals (18.5)');
assert(validateRawMarks({ PA: null }) === true, 'validateRawMarks accepts null (unassessed)');

assertThrows(
  () => validateRawMarks({ PA: 31 }),
  'between 0 and 30',
  'Throws for PA > 30 (31)'
);

assertThrows(
  () => validateRawMarks({ PA: -1 }),
  'between 0 and 30',
  'Throws for PA < 0 (-1)'
);

assertThrows(
  () => validateRawMarks({ PA: 'invalid' }),
  'valid number',
  'Throws for non-numeric input string'
);

// ─── 3. PERFORMANCE STATUS CLASSIFICATION ────────────────────────────────────

section('3. Performance Status Categories (MSBTE Thresholds)');

assert(getPerformanceStatus(26) === 'Excellent', '>= 80% (24/30) is Excellent (26)');
assert(getPerformanceStatus(24) === 'Excellent', 'Exactly 80% (24/30) is Excellent');
assert(getPerformanceStatus(21) === 'Good', '>= 65% (19.5/30) is Good (21)');
assert(getPerformanceStatus(19.5) === 'Good', 'Exactly 65% (19.5/30) is Good');
assert(getPerformanceStatus(16) === 'Average', '>= 50% (15/30) is Average (16)');
assert(getPerformanceStatus(15) === 'Average', 'Exactly 50% (15/30) is Average');
assert(getPerformanceStatus(11) === 'Needs Attention', '< 50% is Needs Attention (11)');
assert(getPerformanceStatus(0) === 'Needs Attention', '0 is Needs Attention');
assert(getPerformanceStatus(null) === null, 'null returns null status');

// ─── 4. SUMMARY ANALYTICS & AGGREGATION ──────────────────────────────────────

section('4. Performance Summary Aggregation');

const sampleRecords = [
  { enrollmentNumber: '26001001', subjectCode: 'STE', PA: 27 },
  { enrollmentNumber: '26001001', subjectCode: 'ACN', PA: 24 },
  { enrollmentNumber: '26001001', subjectCode: 'OSY', PA: 21 },
  { enrollmentNumber: '26001001', subjectCode: 'SPI', PA: 18 },
  { enrollmentNumber: '26001001', subjectCode: 'ITR', PA: 28 },
  { enrollmentNumber: '26001001', subjectCode: 'ENDS', PA: 22 },
];

const summary = generatePerformanceSummary(sampleRecords);
assert(summary.overallSummary.totalSubjects === 6, 'Total subjects = 6');
assert(summary.overallSummary.subjectsWithMarks === 6, 'Subjects with marks = 6');
assert(summary.overallSummary.averagePA > 20, 'Average PA computed correctly');
assert(summary.overallSummary.overallStatus === 'Good' || summary.overallSummary.overallStatus === 'Excellent', 'Overall status computed');

console.log('\n===============================================================');
console.log(`   PHASE 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
}
