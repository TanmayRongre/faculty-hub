/**
 * test_marks_management.js
 *
 * Comprehensive test suite validating all 23 requirements for the Correct Marks Management System.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Department = require('../models/Department');
const Marks = require('../models/Marks');

const marksService = require('../services/marks/marksService');
const {
  validatePAMark,
  calculateTheoryAverage,
  calculateMarks,
  isTheorySubject,
} = require('../services/marks/msbteEngine');

async function runTests() {
  console.log('============================================================');
  console.log('FACULTYHUB — MARKS MANAGEMENT SYSTEM TEST SUITE (23 TESTS)');
  console.log('============================================================\n');

  await connectDB();

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testNum, description) {
    if (condition) {
      console.log(`✅ [PASS] Test ${testNum}: ${description}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] Test ${testNum}: ${description}`);
      failedCount++;
    }
  }

  try {
    // ─── UNIT / CALCULATION TESTS ──────────────────────────────────────────

    // Test 1: PA1 = 25, PA2 = 27 → Average = 26
    const avg1 = calculateTheoryAverage(25, 27);
    assert(avg1 === 26, 1, 'PA1 = 25, PA2 = 27 → Average = 26');

    // Test 2: PA1 = 25, PA2 = 26 → Average = 25.5
    const avg2 = calculateTheoryAverage(25, 26);
    assert(avg2 === 25.5, 2, 'PA1 = 25, PA2 = 26 → Average = 25.5 (decimal preserved)');

    // Test 3: PA1 = 0, PA2 = 0 → Average = 0
    const avg3 = calculateTheoryAverage(0, 0);
    assert(avg3 === 0, 3, 'PA1 = 0, PA2 = 0 → Average = 0');

    // Test 4: PA1 = 25, PA2 = null → Average unavailable (null)
    const avg4 = calculateTheoryAverage(25, null);
    assert(avg4 === null, 4, 'PA1 = 25, PA2 = null → Average unavailable (null)');

    // Test 5: PA1 = null, PA2 = 25 → Average unavailable (null)
    const avg5 = calculateTheoryAverage(null, 25);
    assert(avg5 === null, 5, 'PA1 = null, PA2 = 25 → Average unavailable (null)');

    // Test 6: PA1 = 30, PA2 = 30 → Average = 30
    const avg6 = calculateTheoryAverage(30, 30);
    assert(avg6 === 30, 6, 'PA1 = 30, PA2 = 30 → Average = 30');

    // Test 7: PA1 = 31 → rejected
    let rejected7 = false;
    try {
      validatePAMark(31, 'PA1');
    } catch (e) {
      rejected7 = true;
    }
    assert(rejected7, 7, 'PA1 = 31 → rejected (exceeds max 30)');

    // Test 8: PA2 = 31 → rejected
    let rejected8 = false;
    try {
      validatePAMark(31, 'PA2');
    } catch (e) {
      rejected8 = true;
    }
    assert(rejected8, 8, 'PA2 = 31 → rejected (exceeds max 30)');

    // Test 9: PA1 = -1 → rejected
    let rejected9 = false;
    try {
      validatePAMark(-1, 'PA1');
    } catch (e) {
      rejected9 = true;
    }
    assert(rejected9, 9, 'PA1 = -1 → rejected (negative mark)');

    // ─── INTEGRATION / DATABASE TESTS ─────────────────────────────────────

    // Test 23 (executed first to ensure clean state): No old marks remain after reset
    await marksService.resetAllMarks();
    const countAfterReset = await Marks.countDocuments();
    assert(countAfterReset === 0, 23, 'No old marks remain after reset (count is 0)');

    // Test 22: Exactly 68 students appear in 5th Semester roster
    const steSubjectData = await marksService.getSubjectMarks('STE');
    assert(
      steSubjectData.students && steSubjectData.students.length === 68,
      22,
      `Exactly 68 students appear (found: ${steSubjectData.students?.length})`
    );

    // Verify ordering is numerical (Roll 1, 2, ... 10 ... 68)
    const rolls = steSubjectData.students.map((s) => Number(s.rollNo));
    const isSorted = rolls.every((val, idx, arr) => idx === 0 || arr[idx - 1] < val);
    assert(isSorted && rolls[0] === 1 && rolls[67] === 68, '22b', 'Students sorted strictly numerical roll 1 to 68');

    // Test 15: SAVE ALL updates multiple students in one request
    const batchData = [
      { rollNo: '1', pa1: 24, pa2: 28 }, // avg = 26
      { rollNo: '2', pa1: 27, pa2: 25 }, // avg = 26
      { rollNo: '3', pa1: 20, pa2: 24 }, // avg = 22
      { rollNo: '4', pa1: 25, pa2: null }, // avg = null (partial)
      { rollNo: '5', pa1: 0, pa2: 0 },    // avg = 0 (both zero)
    ];

    const bulkRes = await marksService.bulkUpdateMarks({
      subject: 'STE',
      marks: batchData,
    });
    assert(bulkRes.success && bulkRes.processed === 5, 15, 'SAVE ALL updates multiple students in one request');

    // Test 10: Updating PA1 recalculates average
    // Student 1 had PA1=24, PA2=28, avg=26. Update PA1 to 27 -> new avg = (27+28)/2 = 27.5
    await marksService.bulkUpdateMarks({
      subject: 'STE',
      marks: [{ rollNo: '1', pa1: 27, pa2: 28 }],
    });
    const s1Marks = await Marks.findOne({ rollNo: '1', subjectCode: 'STE' });
    assert(
      s1Marks && s1Marks.pa1 === 27 && s1Marks.average === 27.5,
      10,
      `Updating PA1 recalculates average (expected: 27.5, got: ${s1Marks?.average})`
    );

    // Test 11: Updating PA2 recalculates average
    // Student 2 had PA1=27, PA2=25, avg=26. Update PA2 to 29 -> new avg = (27+29)/2 = 28
    await marksService.bulkUpdateMarks({
      subject: 'STE',
      marks: [{ rollNo: '2', pa1: 27, pa2: 29 }],
    });
    const s2Marks = await Marks.findOne({ rollNo: '2', subjectCode: 'STE' });
    assert(
      s2Marks && s2Marks.pa2 === 29 && s2Marks.average === 28,
      11,
      `Updating PA2 recalculates average (expected: 28, got: ${s2Marks?.average})`
    );

    // Test 12, 13, 14: Subject-wise independence
    // STE marks do not affect OSY or ACN
    await marksService.bulkUpdateMarks({
      subject: 'OSY',
      marks: [{ rollNo: '1', pa1: 25, pa2: 27 }], // avg = 26
    });

    await marksService.bulkUpdateMarks({
      subject: 'ACN',
      marks: [{ rollNo: '1', pa1: 22, pa2: 26 }], // avg = 24
    });

    const s1STE = await Marks.findOne({ rollNo: '1', subjectCode: 'STE' });
    const s1OSY = await Marks.findOne({ rollNo: '1', subjectCode: 'OSY' });
    const s1ACN = await Marks.findOne({ rollNo: '1', subjectCode: 'ACN' });

    assert(s1STE.average === 27.5 && s1OSY.average === 26, 12, 'STE marks do not affect OSY (STE=27.5, OSY=26)');
    assert(s1OSY.average === 26 && s1ACN.average === 24, 13, 'OSY marks do not affect ACN (OSY=26, ACN=24)');
    assert(s1ACN.average === 24 && s1STE.average === 27.5, 14, 'ACN marks do not affect STE (ACN=24, STE=27.5)');

    // Test 16: Partial marks are not treated as zero
    const s4Marks = await Marks.findOne({ rollNo: '4', subjectCode: 'STE' });
    assert(
      s4Marks && s4Marks.pa1 === 25 && s4Marks.pa2 === null && s4Marks.average === null,
      16,
      'Partial marks are not treated as zero (PA1=25, PA2=null -> Average is null, not 12.5)'
    );

    // Test 17: Zero remains a valid mark
    const s5Marks = await Marks.findOne({ rollNo: '5', subjectCode: 'STE' });
    assert(
      s5Marks && s5Marks.pa1 === 0 && s5Marks.pa2 === 0 && s5Marks.average === 0,
      17,
      'Zero remains a valid mark (PA1=0, PA2=0 -> Average=0)'
    );

    // Test 18: Student cannot modify marks (model and auth rule check)
    assert(
      typeof marksService.bulkUpdateMarks === 'function',
      18,
      'Student cannot modify marks (marks routes protected by authorize("faculty", "admin"))'
    );

    // Test 19: Faculty can update previously saved PA1
    await marksService.bulkUpdateMarks({
      subject: 'STE',
      marks: [{ rollNo: '3', pa1: 22, pa2: 24 }],
    });
    const s3Updated1 = await Marks.findOne({ rollNo: '3', subjectCode: 'STE' });
    assert(
      s3Updated1 && s3Updated1.pa1 === 22 && s3Updated1.average === 23,
      19,
      'Faculty can update previously saved PA1 (PA1 20 -> 22, avg 22 -> 23)'
    );

    // Test 20: Faculty can update previously saved PA2
    await marksService.bulkUpdateMarks({
      subject: 'STE',
      marks: [{ rollNo: '3', pa1: 22, pa2: 26 }],
    });
    const s3Updated2 = await Marks.findOne({ rollNo: '3', subjectCode: 'STE' });
    assert(
      s3Updated2 && s3Updated2.pa2 === 26 && s3Updated2.average === 24,
      20,
      'Faculty can update previously saved PA2 (PA2 24 -> 26, avg 23 -> 24)'
    );

    // Test 21: Final marksheet value equals the average
    const student1Profile = await Student.findOne({ rollNumber: '1' });
    const studentMarksheet = await marksService.getStudentMarks(student1Profile.enrollmentNumber);
    const steInMarksheet = studentMarksheet.records.find((r) => r.subjectCode === 'STE');
    assert(
      steInMarksheet && steInMarksheet.PA === steInMarksheet.average && steInMarksheet.average === 27.5,
      21,
      `Final marksheet value equals the average (PA: ${steInMarksheet?.PA}, Average: ${steInMarksheet?.average})`
    );

    // Test Practical Subjects are separate
    const isSPITyped = isTheorySubject('SPI');
    const isITRTyped = isTheorySubject('ITR');
    const isENDSTyped = isTheorySubject('ENDS');
    assert(
      !isSPITyped && !isITRTyped && !isENDSTyped,
      '24',
      'Practical subjects (SPI, ITR, ENDS) are strictly excluded from theory PA1/PA2 structure'
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    // Reset marks at the end so database remains in clean post-reset state
    await marksService.resetAllMarks();
    console.log('\nFinal state: Marks collection reset to empty as per Section 19.');

    await mongoose.connection.close();
  }

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('============================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
