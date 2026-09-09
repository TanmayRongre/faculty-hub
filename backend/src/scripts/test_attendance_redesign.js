const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Faculty = require('../models/Faculty');
const FacultySubjectAssignment = require('../models/FacultySubjectAssignment');
const Attendance = require('../models/Attendance');
const attendanceService = require('../services/attendance/attendanceService');
const googleSheetsService = require('../integrations/googleSheets/googleSheetsService');
const { authorizeSubjectAccess } = require('../middleware/subjectAccess');
const {
  ATTENDANCE_SUBJECTS,
  PRACTICAL_BATCHES,
  BATCH_DEFINITIONS,
  getAttendanceWorksheetName,
  formatAttendanceDate,
} = require('../integrations/googleSheets/spreadsheetConfig');

async function runTests() {
  console.log('============================================================');
  console.log('STARTING ATTENDANCE REDESIGN COMPREHENSIVE VERIFICATION SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB Atlas\n');

    // ------------------------------------------------------------
    // 1. CLASS STRUCTURE & BATCH ASSIGNMENT
    // ------------------------------------------------------------
    console.log('--- 1. Class Structure & Student Batches ---');
    const allStudents = await Student.find({ semester: 5, status: 'active' })
      .collation({ locale: 'en', numericOrdering: true })
      .sort({ rollNumber: 1 });
    assert(allStudents.length === 68, `Total active students must be 68 (Found: ${allStudents.length})`);

    const batchAStudents = allStudents.filter(s => s.batch === 'A');
    const batchBStudents = allStudents.filter(s => s.batch === 'B');
    const batchCStudents = allStudents.filter(s => s.batch === 'C');

    assert(batchAStudents.length === 24, `Batch A count must be 24 (Found: ${batchAStudents.length})`);
    assert(Number(batchAStudents[0].rollNumber) === 1 && Number(batchAStudents[batchAStudents.length - 1].rollNumber) === 24,
      `Batch A roll numbers must be 1 to 24 (Found: ${batchAStudents[0]?.rollNumber} to ${batchAStudents[batchAStudents.length - 1]?.rollNumber})`);

    assert(batchBStudents.length === 23, `Batch B count must be 23 (Found: ${batchBStudents.length})`);
    assert(Number(batchBStudents[0].rollNumber) === 25 && Number(batchBStudents[batchBStudents.length - 1].rollNumber) === 47,
      `Batch B roll numbers must be 25 to 47 (Found: ${batchBStudents[0]?.rollNumber} to ${batchBStudents[batchBStudents.length - 1]?.rollNumber})`);

    assert(batchCStudents.length === 21, `Batch C count must be 21 (Found: ${batchCStudents.length})`);
    assert(Number(batchCStudents[0].rollNumber) === 48 && Number(batchCStudents[batchCStudents.length - 1].rollNumber) === 68,
      `Batch C roll numbers must be 48 to 68 (Found: ${batchCStudents[0]?.rollNumber} to ${batchCStudents[batchCStudents.length - 1]?.rollNumber})`);

    // ------------------------------------------------------------
    // 2. ROSTER GENERATION FOR ALL ACTIVE SUBJECTS & BATCHES
    // ------------------------------------------------------------
    console.log('\n--- 2. Roster Retrieval Logic ---');
    for (const code of ATTENDANCE_SUBJECTS) {
      // Lecture
      const lecRoster = await attendanceService.getRoster({ attendanceType: 'Lecture', subjectCode: code });
      assert(lecRoster.students.length === 68, `Lecture roster for ${code} must contain all 68 students (Found: ${lecRoster.students.length})`);
      assert(Number(lecRoster.students[0].rollNumber) === 1 && Number(lecRoster.students[67].rollNumber) === 68, `Lecture ${code} covers roll 1 to 68`);

      // Practical A
      const prARoster = await attendanceService.getRoster({ attendanceType: 'Practical', subjectCode: code, batch: 'A' });
      assert(prARoster.students.length === 24, `Practical Batch A roster for ${code} must have 24 students`);
      assert(Number(prARoster.students[0].rollNumber) === 1 && Number(prARoster.students[23].rollNumber) === 24, `Practical ${code}-A covers roll 1 to 24`);

      // Practical B
      const prBRoster = await attendanceService.getRoster({ attendanceType: 'Practical', subjectCode: code, batch: 'B' });
      assert(prBRoster.students.length === 23, `Practical Batch B roster for ${code} must have 23 students`);
      assert(Number(prBRoster.students[0].rollNumber) === 25 && Number(prBRoster.students[22].rollNumber) === 47, `Practical ${code}-B covers roll 25 to 47`);

      // Practical C
      const prCRoster = await attendanceService.getRoster({ attendanceType: 'Practical', subjectCode: code, batch: 'C' });
      assert(prCRoster.students.length === 21, `Practical Batch C roster for ${code} must have 21 students`);
      assert(Number(prCRoster.students[0].rollNumber) === 48 && Number(prCRoster.students[20].rollNumber) === 68, `Practical ${code}-C covers roll 48 to 68`);
    }

    // Prohibit SPI and ITR
    let spiRejected = false;
    try {
      await attendanceService.getRoster({ attendanceType: 'Lecture', subjectCode: 'SPI' });
    } catch (e) {
      spiRejected = true;
    }
    assert(spiRejected, 'Requesting roster for SPI must be rejected');

    let itrRejected = false;
    try {
      await attendanceService.getRoster({ attendanceType: 'Lecture', subjectCode: 'ITR' });
    } catch (e) {
      itrRejected = true;
    }
    assert(itrRejected, 'Requesting roster for ITR must be rejected');

    // ------------------------------------------------------------
    // 3. BACKEND VALIDATION REJECTION TESTS
    // ------------------------------------------------------------
    console.log('\n--- 3. Validation & Boundary Rejections ---');

    let lecWithBatchRejected = false;
    try {
      await attendanceService.getRoster({ attendanceType: 'Lecture', subjectCode: 'STE', batch: 'A' });
    } catch (e) {
      lecWithBatchRejected = e.message.includes('not allowed for Lecture');
    }
    assert(lecWithBatchRejected, 'Lecture with batch specified must be rejected');

    let prWithoutBatchRejected = false;
    try {
      await attendanceService.getRoster({ attendanceType: 'Practical', subjectCode: 'STE', batch: null });
    } catch (e) {
      prWithoutBatchRejected = e.message.includes('requires a valid batch');
    }
    assert(prWithoutBatchRejected, 'Practical without batch specified must be rejected');

    let prInvalidBatchRejected = false;
    try {
      await attendanceService.getRoster({ attendanceType: 'Practical', subjectCode: 'STE', batch: 'D' });
    } catch (e) {
      prInvalidBatchRejected = e.message.includes('requires a valid batch');
    }
    assert(prInvalidBatchRejected, 'Practical with batch D must be rejected');

    // Batch cross-boundary student rejection: Submit Batch A with Roll 25
    let roll25InBatchARejected = false;
    try {
      const mockRecords = [
        { rollNumber: '25', status: 'Present' }
      ];
      await attendanceService.saveAttendanceSession({
        attendanceType: 'Practical',
        subjectCode: 'STE',
        batch: 'A',
        date: '2026-09-09',
        slot: '09:00 - 10:00 AM',
        records: mockRecords,
        markedBy: allStudents[0]._id
      });
    } catch (e) {
      roll25InBatchARejected = e.message.includes('not eligible');
    }
    assert(roll25InBatchARejected, 'Submitting Roll 25 inside Batch A session must be rejected with 422 boundary error');

    // Batch cross-boundary student rejection: Submit Batch B with Roll 1
    let roll1InBatchBRejected = false;
    try {
      const mockRecords = [
        { rollNumber: '1', status: 'Present' }
      ];
      await attendanceService.saveAttendanceSession({
        attendanceType: 'Practical',
        subjectCode: 'STE',
        batch: 'B',
        date: '2026-09-09',
        slot: '09:00 - 10:00 AM',
        records: mockRecords,
        markedBy: allStudents[0]._id
      });
    } catch (e) {
      roll1InBatchBRejected = e.message.includes('not eligible');
    }
    assert(roll1InBatchBRejected, 'Submitting Roll 1 inside Batch B session must be rejected with 422 boundary error');

    // ------------------------------------------------------------
    // 4. LIVE GOOGLE SHEETS WRITE & READ & ZERO CROSS-CONTAMINATION
    // ------------------------------------------------------------
    console.log('\n--- 4. Live Google Sheets Write & Cross-Contamination Test ---');

    const testAdmin = await User.findOne({ role: 'admin' });
    const testDate = '2026-09-09';
    const formattedTestDate = formatAttendanceDate(testDate); // '09-Sep-2026'
    const testLecSlot = '10:30 - 11:30';
    const testPrSlot = '01:50 - 03:50';

    // 4a. Save Lecture Session for STE
    console.log('  Saving test Lecture session for STE (all 68 students, Roll 7 & 45 Absent)...');
    const lecRecords = allStudents.map(s => ({
      studentId: s._id,
      rollNumber: s.rollNumber,
      enrollmentNumber: s.enrollmentNumber,
      status: (Number(s.rollNumber) === 7 || Number(s.rollNumber) === 45) ? 'Absent' : 'Present'
    }));

    const savedLec = await attendanceService.saveAttendanceSession({
      attendanceType: 'Lecture',
      subjectCode: 'STE',
      date: testDate,
      slot: testLecSlot,
      records: lecRecords,
      markedBy: testAdmin._id
    });
    assert(savedLec.success && savedLec.total === 68, 'Saved Lecture session for STE with 68 student records');

    // Verify Lecture in Google Sheet ATT-LEC-STE
    const lecRows = await googleSheetsService.readRange('ATT-LEC-STE!A:ZZ');
    assert(lecRows && lecRows.length === 69, `ATT-LEC-STE contains header + 68 student rows (Total rows: ${lecRows?.length})`);
    
    const lecHeader = lecRows[0];
    const dateColIdx = lecHeader.findIndex(h => h.includes(formattedTestDate) || h.includes(testDate));
    assert(dateColIdx >= 2, `ATT-LEC-STE has session column for date "${formattedTestDate}" at index ${dateColIdx}`);

    const r7Row = lecRows.find(r => String(r[0]).trim() === '7');
    const r45Row = lecRows.find(r => String(r[0]).trim() === '45');
    const r1Row = lecRows.find(r => String(r[0]).trim() === '1');

    assert(r7Row && r7Row[dateColIdx] === 'A', 'Roll 7 is marked "A" in ATT-LEC-STE');
    assert(r45Row && r45Row[dateColIdx] === 'A', 'Roll 45 is marked "A" in ATT-LEC-STE');
    assert(r1Row && r1Row[dateColIdx] === 'P', 'Roll 1 is marked "P" in ATT-LEC-STE');

    // 4b. Save Practical Session for STE Batch A
    console.log('  Saving test Practical session for STE Batch A (24 students, Roll 12 Absent)...');
    const prARecords = batchAStudents.map(s => ({
      studentId: s._id,
      rollNumber: s.rollNumber,
      enrollmentNumber: s.enrollmentNumber,
      status: (Number(s.rollNumber) === 12) ? 'Absent' : 'Present'
    }));

    const savedPrA = await attendanceService.saveAttendanceSession({
      attendanceType: 'Practical',
      subjectCode: 'STE',
      batch: 'A',
      date: testDate,
      slot: testPrSlot,
      records: prARecords,
      markedBy: testAdmin._id
    });
    assert(savedPrA.success && savedPrA.total === 24, 'Saved Practical session for STE Batch A with 24 records');

    // Verify Practical in Google Sheet ATT-PR-STE-A
    const prARows = await googleSheetsService.readRange('ATT-PR-STE-A!A:ZZ');
    assert(prARows && prARows.length === 25, `ATT-PR-STE-A contains header + 24 student rows (Total rows: ${prARows?.length})`);
    
    const prAHeader = prARows[0];
    const prADateColIdx = prAHeader.findIndex(h => h.includes(formattedTestDate) || h.includes(testDate));
    assert(prADateColIdx >= 2, `ATT-PR-STE-A has session column for date "${formattedTestDate}" at index ${prADateColIdx}`);

    const prA_r12 = prARows.find(r => String(r[0]).trim() === '12');
    const prA_r2 = prARows.find(r => String(r[0]).trim() === '2');
    assert(prA_r12 && prA_r12[prADateColIdx] === 'A', 'Roll 12 is marked "A" in ATT-PR-STE-A');
    assert(prA_r2 && prA_r2[prADateColIdx] === 'P', 'Roll 2 is marked "P" in ATT-PR-STE-A');

    // 4c. Cross-contamination check across all other 14 sheets
    console.log('  Verifying Zero Cross-Contamination across other 14 worksheets...');
    const sheetsToCheck = [
      'ATT-LEC-OSY', 'ATT-LEC-ENDS', 'ATT-LEC-ACN',
      'ATT-PR-STE-B', 'ATT-PR-STE-C',
      'ATT-PR-OSY-A', 'ATT-PR-OSY-B', 'ATT-PR-OSY-C',
      'ATT-PR-ENDS-A', 'ATT-PR-ENDS-B', 'ATT-PR-ENDS-C',
      'ATT-PR-ACN-A', 'ATT-PR-ACN-B', 'ATT-PR-ACN-C'
    ];

    let crossContaminated = false;
    for (const sheetName of sheetsToCheck) {
      const headerRow = await googleSheetsService.readRange(`${sheetName}!1:1`);
      const headers = headerRow && headerRow[0] ? headerRow[0] : [];
      if (headers.length > 2) {
        console.error(`  Cross-contamination found in sheet ${sheetName}! Header length: ${headers.length}`);
        crossContaminated = true;
      }
    }
    assert(!crossContaminated, 'Zero cross-contamination confirmed: All other 14 worksheets remain completely untouched!');

    // ------------------------------------------------------------
    // 5. HISTORY & DEFAULTERS
    // ------------------------------------------------------------
    console.log('\n--- 5. History and Defaulter Calculations ---');
    const lecHistory = await attendanceService.getAttendanceHistory({ subjectCode: 'STE', attendanceType: 'Lecture' });
    assert(lecHistory.length >= 1, 'History retrieved at least 1 Lecture session for STE');
    assert(lecHistory[0].attendanceType === 'LECTURE', 'History session correctly identified as LECTURE');

    const prAHistory = await attendanceService.getAttendanceHistory({ subjectCode: 'STE', attendanceType: 'Practical', batch: 'A' });
    assert(prAHistory.length >= 1, 'History retrieved at least 1 Practical Batch A session for STE');
    assert(prAHistory[0].batch === 'A', 'History session correctly tagged with Batch A');

    const defaultersData = await attendanceService.getDefaulters({ subjectCode: 'STE', attendanceType: 'Lecture' });
    assert(defaultersData.threshold === 75, 'Defaulters threshold strictly configured to 75%');
    assert(defaultersData.defaulters.some(d => Number(d.rollNumber) === 7), 'Roll 7 correctly identified as defaulter (< 75%)');

    // ------------------------------------------------------------
    // 6. SUBJECT AUTHORIZATION SECURITY CHECK
    // ------------------------------------------------------------
    console.log('\n--- 6. Subject Authorization (RBAC) ---');
    // Test Admin access
    let adminAllowed = false;
    const mockAdminReq = { user: testAdmin, params: {}, query: { subjectCode: 'STE' }, body: {} };
    const createMockRes = () => ({
      statusCode: null,
      data: null,
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.data = data; return this; }
    });

    await authorizeSubjectAccess('subjectCode')(mockAdminReq, createMockRes(), () => { adminAllowed = true; });
    assert(adminAllowed, 'Admin has full unrestricted access across all subjects');

    // Test Faculty access (create or find faculty assigned to STE)
    const steSubject = await Subject.findOne({ subjectCode: 'STE' });
    const acnSubject = await Subject.findOne({ subjectCode: 'ACN' });
    
    // Find a faculty user
    const facultyUser = await User.findOne({ role: 'faculty' });
    if (facultyUser && steSubject && acnSubject) {
      const facultyDoc = await Faculty.findOne({ userId: facultyUser._id });
      if (facultyDoc) {
        // Ensure assigned to STE, NOT assigned to ACN for test
        facultyDoc.subjects = [steSubject._id];
        await facultyDoc.save();

        let steFacultyAllowed = false;
        const resSTE = createMockRes();
        const mockFacultyReqSTE = { user: facultyUser, params: {}, query: { subjectCode: 'STE' }, body: {} };
        await authorizeSubjectAccess('subjectCode')(mockFacultyReqSTE, resSTE, () => { steFacultyAllowed = true; });
        assert(steFacultyAllowed, 'Faculty assigned to STE is permitted to access STE');

        let acnFacultyAllowed = false;
        const resACN = createMockRes();
        const mockFacultyReqACN = { user: facultyUser, params: {}, query: { subjectCode: 'ACN' }, body: {} };
        await authorizeSubjectAccess('subjectCode')(mockFacultyReqACN, resACN, () => { acnFacultyAllowed = true; });
        assert(!acnFacultyAllowed && resACN.statusCode === 403, 'Faculty NOT assigned to ACN is rejected with 403 Forbidden');
      }
    }

    console.log('\n============================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('CRITICAL TEST ERROR:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
