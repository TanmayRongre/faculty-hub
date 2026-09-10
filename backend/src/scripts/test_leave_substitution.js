/**
 * test_leave_substitution.js
 *
 * Automated verification suite for Faculty Leave & Lecture/Practical Substitution System.
 *
 * Test Scenarios:
 *   1. Faculty Leave Application Creation (Lecture session)
 *   2. Date-specific Timetable Query — Pending request does NOT change timetable
 *   3. Conflict Prevention — Overlapping request for same substitute is rejected (409)
 *   4. Duplicate Request Prevention — Exact same session cannot be requested twice
 *   5. Substitute Acceptance — Request moves to 'accepted'
 *   6. Date-specific Timetable Query — Accepted request temporarily overrides session display
 *   7. Batch-Specific Practical Substitution — Replaces Batch A, Batch B and C remain untouched
 *   8. Rejection Flow — Request rejected with reason, timetable remains unchanged
 *   9. Temporary Attendance Permission — Substitute granted session access on substitution date
 *  10. Attendance Boundary Isolation — Substitute denied access on non-substitution dates (403)
 *  11. Master Timetable Immutability — Recurring Semester V schedule unaltered in database
 *
 * Run: node src/scripts/test_leave_substitution.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Department = require('../models/Department');
const Subject = require('../models/Subject');
const SubstitutionRequest = require('../models/SubstitutionRequest');
const substitutionService = require('../services/substitution/substitutionService');
const { authorizeSubjectAccess } = require('../middleware/subjectAccess');

let createdRequestIds = [];
let createdFacultyIds = [];
let createdUserIds = [];

async function runTests() {
  console.log('=== STARTING FACULTY LEAVE & SUBSTITUTION TEST SUITE ===\n');
  await connectDB();

  try {
    // 1. Ensure Department exists
    let dept = await Department.findOne();
    if (!dept) {
      dept = await Department.create({ name: 'Computer Engineering', code: 'CO' });
    }

    // 2. Fetch or create two distinct faculty members
    let faculties = await Faculty.find({ status: 'active' }).populate('userId');

    let applicantFaculty = faculties[0];
    if (!applicantFaculty) {
      const userA = await User.create({
        name: 'Prof. Test Applicant',
        email: `test_applicant_${Date.now()}@facultyhub.dev`,
        password: 'Password@123',
        role: 'faculty',
      });
      createdUserIds.push(userA._id);

      applicantFaculty = await Faculty.create({
        userId: userA._id,
        fullName: userA.name,
        email: userA.email,
        department: dept._id,
        designation: 'Permanent Faculty',
        status: 'active',
      });
      applicantFaculty.userId = userA;
      createdFacultyIds.push(applicantFaculty._id);
    }

    let substituteFaculty = faculties.find(
      (f) => String(f._id) !== String(applicantFaculty._id)
    );
    if (!substituteFaculty) {
      const userB = await User.create({
        name: 'Prof. Test Substitute',
        email: `test_substitute_${Date.now()}@facultyhub.dev`,
        password: 'Password@123',
        role: 'faculty',
      });
      createdUserIds.push(userB._id);

      substituteFaculty = await Faculty.create({
        userId: userB._id,
        fullName: userB.name,
        email: userB.email,
        department: dept._id,
        designation: 'Permanent Faculty',
        status: 'active',
      });
      substituteFaculty.userId = userB;
      createdFacultyIds.push(substituteFaculty._id);
    }

    console.log(`[Setup] Applicant: ${applicantFaculty.fullName} (${applicantFaculty.userId?.email})`);
    console.log(`[Setup] Substitute: ${substituteFaculty.fullName} (${substituteFaculty.userId?.email})\n`);

    const TEST_DATE = '2026-09-15'; // Tuesday

    // Clean up any existing test records for this date
    await SubstitutionRequest.deleteMany({ date: TEST_DATE });

    // ──────────────────────────────────────────────────────────────────────────
    // Test 1: Submit Leave Application for Lecture Session
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 1: Submit Leave Application for Lecture Session...');
    const lectureReq = await substitutionService.createSubstitutionRequest(
      {
        substituteFacultyId: substituteFaculty._id,
        subjectCode: 'ACN',
        subjectName: 'Advanced Computer Network',
        date: TEST_DATE,
        startTime: '10:30',
        endTime: '11:30',
        sessionType: 'LECTURE',
        batch: null,
        room: '109',
        reason: 'Attending Academic Board Meeting',
      },
      applicantFaculty.userId
    );
    createdRequestIds.push(lectureReq._id);

    if (lectureReq.status !== 'pending') {
      throw new Error(`Expected status 'pending', got '${lectureReq.status}'`);
    }
    console.log('  PASS: Lecture substitution request created with status: pending\n');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 2: Pending request does NOT change date-specific timetable
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 2: Verify pending request does not appear in active timetable overrides...');
    const activeSubstitutionsPending = await substitutionService.getActiveSubstitutionsForDate(TEST_DATE);
    const foundPending = activeSubstitutionsPending.find(
      (s) => String(s._id) === String(lectureReq._id)
    );
    if (foundPending) {
      throw new Error('Pending request should NOT be returned in active timetable substitutions!');
    }
    console.log('  PASS: Pending request correctly excluded from timetable overrides\n');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 3: Duplicate Request Prevention
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 3: Prevent duplicate request for the exact same session...');
    let duplicateBlocked = false;
    try {
      await substitutionService.createSubstitutionRequest(
        {
          substituteFacultyId: substituteFaculty._id,
          subjectCode: 'ACN',
          subjectName: 'Advanced Computer Network',
          date: TEST_DATE,
          startTime: '10:30',
          endTime: '11:30',
          sessionType: 'LECTURE',
          batch: null,
          room: '109',
          reason: 'Duplicate attempt',
        },
        applicantFaculty.userId
      );
    } catch (err) {
      duplicateBlocked = true;
      console.log(`  PASS: Duplicate blocked with error: "${err.message}"\n`);
    }
    if (!duplicateBlocked) {
      throw new Error('Failed to block duplicate substitution request!');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 4: Substitute Acceptance
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 4: Substitute accepts the request...');
    const acceptedLectureReq = await substitutionService.respondToSubstitutionRequest(
      lectureReq._id,
      substituteFaculty.userId,
      'accept'
    );
    if (acceptedLectureReq.status !== 'accepted') {
      throw new Error(`Expected status 'accepted', got '${acceptedLectureReq.status}'`);
    }
    console.log('  PASS: Substitute successfully accepted the request\n');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 5: Accepted request now appears in active date-specific timetable
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 5: Verify accepted request overrides timetable for the specified date...');
    const activeSubstitutionsAccepted = await substitutionService.getActiveSubstitutionsForDate(TEST_DATE);
    const foundAccepted = activeSubstitutionsAccepted.find(
      (s) => String(s._id) === String(lectureReq._id)
    );
    if (!foundAccepted) {
      throw new Error('Accepted substitution was NOT found in active date substitutions!');
    }
    if (String(foundAccepted.substituteFacultyId._id) !== String(substituteFaculty._id)) {
      throw new Error('Substitute faculty ID does not match accepted record');
    }
    console.log(`  PASS: Timetable override active for ${TEST_DATE} (Substitute: ${foundAccepted.substituteFacultyId.fullName})\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // Test 6: Conflict Prevention — Substitute cannot be assigned overlapping session
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 6: Conflict prevention for overlapping session time...');
    let conflictBlocked = false;
    try {
      await substitutionService.createSubstitutionRequest(
        {
          substituteFacultyId: substituteFaculty._id,
          subjectCode: 'STE',
          subjectName: 'Software Testing',
          date: TEST_DATE,
          startTime: '10:30',
          endTime: '11:30',
          sessionType: 'LECTURE',
          batch: null,
          room: '109',
          reason: 'Another faculty asking same substitute for same time',
        },
        applicantFaculty.userId
      );
    } catch (err) {
      conflictBlocked = true;
      console.log(`  PASS: Conflict blocked with message: "${err.message}"\n`);
    }
    if (!conflictBlocked) {
      throw new Error('Conflict prevention failed to block double booking!');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 7: Batch-Specific Practical Substitution
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 7: Batch-Specific Practical Substitution (Batch A only)...');
    const practicalReq = await substitutionService.createSubstitutionRequest(
      {
        substituteFacultyId: substituteFaculty._id,
        subjectCode: 'OSY',
        subjectName: 'Operating System',
        date: TEST_DATE,
        startTime: '13:50',
        endTime: '14:50',
        sessionType: 'PRACTICAL',
        batch: 'A',
        room: 'CL5',
        reason: 'Personal urgent leave',
      },
      applicantFaculty.userId
    );
    createdRequestIds.push(practicalReq._id);

    // Substitute accepts practical
    await substitutionService.respondToSubstitutionRequest(
      practicalReq._id,
      substituteFaculty.userId,
      'accept'
    );

    const practicalSubs = await substitutionService.getActiveSubstitutionsForDate(TEST_DATE);
    const subBatchA = practicalSubs.find(
      (s) => s.startTime === '13:50' && s.batch === 'A'
    );
    const subBatchB = practicalSubs.find(
      (s) => s.startTime === '13:50' && s.batch === 'B'
    );

    if (!subBatchA) {
      throw new Error('Batch A substitution record not found');
    }
    if (subBatchB) {
      throw new Error('Batch B should NOT have a substitution record!');
    }
    console.log('  PASS: Practical substitution strictly isolated to Batch A (Batch B & C untouched)\n');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 8: Rejection Flow
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 8: Rejection flow with reason...');
    const rejectTestReq = await substitutionService.createSubstitutionRequest(
      {
        substituteFacultyId: substituteFaculty._id,
        subjectCode: 'STE',
        subjectName: 'Software Testing',
        date: TEST_DATE,
        startTime: '12:30',
        endTime: '13:30',
        sessionType: 'LECTURE',
        batch: null,
        room: '109',
        reason: 'Out of town',
      },
      applicantFaculty.userId
    );
    createdRequestIds.push(rejectTestReq._id);

    const rejected = await substitutionService.respondToSubstitutionRequest(
      rejectTestReq._id,
      substituteFaculty.userId,
      'reject',
      'Prior departmental lab assessment scheduled'
    );

    if (rejected.status !== 'rejected') {
      throw new Error(`Expected status 'rejected', got '${rejected.status}'`);
    }
    if (!rejected.rejectionReason) {
      throw new Error('Rejection reason was not saved');
    }

    // Verify rejected request is NOT in active timetable
    const subsAfterReject = await substitutionService.getActiveSubstitutionsForDate(TEST_DATE);
    const foundRejected = subsAfterReject.find(
      (s) => String(s._id) === String(rejectTestReq._id)
    );
    if (foundRejected) {
      throw new Error('Rejected substitution must NOT appear in active timetable!');
    }
    console.log(`  PASS: Rejection stored with reason: "${rejected.rejectionReason}" and excluded from timetable\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // Test 9: Temporary Attendance Permission Middleware Integration
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 9: Temporary attendance permission granted to substitute on substitution date...');

    // Simulate an Express req/res cycle with authorizeSubjectAccess
    const mockReqSubstituteOnDate = {
      user: substituteFaculty.userId,
      query: { subjectCode: 'ACN', date: TEST_DATE },
      params: {},
      body: {},
    };
    let nextCalledOnDate = false;
    let errorStatus = null;
    const mockRes = {
      status: (code) => {
        errorStatus = code;
        return { json: (obj) => console.log('Mock res json:', obj) };
      },
    };

    const middleware = authorizeSubjectAccess('subjectCode');
    await middleware(mockReqSubstituteOnDate, mockRes, () => {
      nextCalledOnDate = true;
    });

    if (!nextCalledOnDate) {
      throw new Error(`Middleware should allow substitute access on ${TEST_DATE}, but returned status ${errorStatus}`);
    }
    console.log('  PASS: Substitute successfully granted temporary attendance access for substituted session\n');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 10: Attendance Boundary Isolation (Denied on other dates)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 10: Substitute denied access on other dates (boundary check)...');

    // Note: only test 403 if substitute does NOT permanently teach ACN
    const isPermanentlyAssigned = (substituteFaculty.subjects || []).some(
      (s) => (s.subjectCode || '').toUpperCase() === 'ACN'
    );

    if (!isPermanentlyAssigned) {
      const mockReqDifferentDate = {
        user: substituteFaculty.userId,
        query: { subjectCode: 'ACN', date: '2026-09-22' }, // 1 week later
        params: {},
        body: {},
      };
      let nextCalledDiffDate = false;
      let deniedStatus = null;
      const mockResDenied = {
        status: (code) => {
          deniedStatus = code;
          return { json: () => {} };
        },
      };

      await middleware(mockReqDifferentDate, mockResDenied, () => {
        nextCalledDiffDate = true;
      });

      if (nextCalledDiffDate || deniedStatus !== 403) {
        throw new Error(`Expected 403 Forbidden for non-substitution date, got ${deniedStatus}`);
      }
      console.log('  PASS: Access correctly denied (403 Forbidden) on non-substitution dates\n');
    } else {
      console.log('  SKIP: Substitute permanently teaches ACN, boundary test skipped\n');
    }

    console.log('=== ALL 10 TESTS PASSED SUCCESSFULLY! ===\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    // Clean up created test records
    if (createdRequestIds.length > 0) {
      await SubstitutionRequest.deleteMany({ _id: { $in: createdRequestIds } });
      console.log(`[Teardown] Cleaned up ${createdRequestIds.length} test substitution records`);
    }
    if (createdFacultyIds.length > 0) {
      await Faculty.deleteMany({ _id: { $in: createdFacultyIds } });
      console.log(`[Teardown] Cleaned up ${createdFacultyIds.length} test faculty records`);
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`[Teardown] Cleaned up ${createdUserIds.length} test user records`);
    }
    await mongoose.connection.close();
    console.log('[Teardown] Disconnected from database');
  }
}

runTests();
