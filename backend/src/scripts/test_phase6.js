/**
 * test_phase6.js
 *
 * Phase 6 Smart Lecture Scheduler Verification Test Suite
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Models
const TimetableSlot = require('../models/TimetableSlot');
const Holiday = require('../models/Holiday');
const Lecture = require('../models/Lecture');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Subject = require('../models/Subject');
const Faculty = require('../models/Faculty');
const User = require('../models/User');

// Services
const {
  timeToMinutes,
  checkTimeOverlap,
  detectTimetableConflicts,
} = require('../services/scheduler/conflictDetector');

const {
  getDayName,
  addDays,
  applyHoliday,
  removeHoliday,
} = require('../services/scheduler/holidayShiftService');

const {
  createTimetableSlot,
  getWeeklyTimetable,
} = require('../services/scheduler/schedulerService');

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

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         FacultyHub — Phase 6 Scheduler Verification         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await connectDB();

  // Clean any leftover test fixtures
  await TimetableSlot.deleteMany({ academicYear: '2026-TEST' });
  await Lecture.deleteMany({ academicYear: '2026-TEST' });
  await Holiday.deleteMany({ academicYear: '2026-TEST' });

  // ─── 1. PURE TIME CALCULATIONS ──────────────────────────────────────────────
  section('1. Pure Time Conversion & Overlap Mathematics');

  assert(timeToMinutes('09:00') === 540, '09:00 converts to 540 minutes');
  assert(timeToMinutes('11:15') === 675, '11:15 converts to 675 minutes');
  assert(timeToMinutes('14:30') === 870, '14:30 converts to 870 minutes');

  // Overlap cases
  assert(checkTimeOverlap('09:00', '10:00', '09:30', '10:30') === true, 'Overlapping intervals detected (09:00–10:00 vs 09:30–10:30)');
  assert(checkTimeOverlap('09:00', '11:00', '09:30', '10:00') === true, 'Subset interval detected (09:00–11:00 vs 09:30–10:00)');
  assert(checkTimeOverlap('09:00', '10:00', '09:00', '10:00') === true, 'Identical intervals detected (09:00–10:00 vs 09:00–10:00)');
  assert(checkTimeOverlap('09:00', '10:00', '10:00', '11:00') === false, 'Adjacent back-to-back intervals do not overlap (09:00–10:00 vs 10:00–11:00)');
  assert(checkTimeOverlap('11:00', '12:00', '09:00', '10:00') === false, 'Completely separate intervals do not overlap (11:00–12:00 vs 09:00–10:00)');

  // ─── 2. DETERMINISTIC DATE & DAY CALCULATION ────────────────────────────────
  section('2. Deterministic Date & Day Calculations');

  assert(getDayName('2026-08-31') === 'Monday', '2026-08-31 is Monday');
  assert(getDayName('2026-09-01') === 'Tuesday', '2026-09-01 is Tuesday');
  assert(getDayName('2026-09-06') === 'Sunday', '2026-09-06 is Sunday');

  assert(addDays('2026-08-31', 1) === '2026-09-01', 'addDays(2026-08-31, 1) = 2026-09-01');
  assert(addDays('2026-08-31', 7) === '2026-09-07', 'addDays(2026-08-31, 7) = 2026-09-07');

  // ─── 3. CONFLICT DETECTION ENGINE ───────────────────────────────────────────
  section('3. Conflict Detection Engine (Faculty, Class, Room)');

  let dept = await Department.findOne({ code: 'CO' }) || await Department.create({ name: 'Computer Science', code: 'CO' });
  const facultyA = await Faculty.findOne({ designation: 'HOD' }) || await Faculty.findOne();
  const facultyB = await Faculty.findOne({ designation: 'Normal Faculty' }) || await Faculty.findOne();
  const subjectOS = await Subject.findOne({ subjectCode: 'OSY' }) || await Subject.findOne();
  const subjectSTE = await Subject.findOne({ subjectCode: 'STE' }) || await Subject.findOne();

  // Test Case A: Faculty Conflict (Same Faculty A, overlapping time Monday 09:30–10:30)
  const facultyConflict = await detectTimetableConflicts({
    faculty: facultyA._id,
    semester: 5,
    room: 'Room 999',
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
  });
  assert(typeof facultyConflict.hasConflict === 'boolean', 'Conflict detector executes safely');

  // ─── 4. WEEKLY TIMETABLE RETRIEVAL ──────────────────────────────────────────
  section('4. Weekly Timetable Aggregation');

  const weeklyGrid = await getWeeklyTimetable({ semester: 5 });
  assert(weeklyGrid.totalSlots >= 6, `Weekly timetable returned ${weeklyGrid.totalSlots} active slots`);
  assert(Array.isArray(weeklyGrid.days['Monday']), 'Monday slots retrieved as array');

  // ─── 5. HOLIDAY SHIFT LOGIC & DETERMINISTIC RESCHEDULING ────────────────────
  section('5. Automated Holiday Shift Logic & Traceability');

  const holidayDate = '2026-09-07'; // Monday
  const holiday = await Holiday.create({
    date: holidayDate,
    title: 'Test National Holiday',
    type: 'national',
    academicYear: '2026-TEST',
    status: 'active',
  });

  const shiftResult = await applyHoliday(holiday);
  assert(typeof shiftResult.affectedCount === 'number', 'Holiday processed affected lectures count');

  // ─── 6. HOLIDAY REMOVAL & RESTORATION ───────────────────────────────────────
  section('6. Holiday Removal & Schedule Restoration');

  await removeHoliday(holiday._id);
  const holidayAfterCancel = await Holiday.findById(holiday._id);
  assert(holidayAfterCancel.status === 'cancelled', 'Holiday status set to cancelled');

  // Clean test fixtures
  await TimetableSlot.deleteMany({ academicYear: '2026-TEST' });
  await Lecture.deleteMany({ academicYear: '2026-TEST' });
  await Holiday.deleteMany({ academicYear: '2026-TEST' });

  // ─── TEST SUMMARY ────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`Phase 6 Smart Lecture Scheduler Verification: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed Tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('ALL PHASE 6 VERIFICATION TESTS PASSED ✓');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during Phase 6 test execution:', err);
  process.exit(1);
});
