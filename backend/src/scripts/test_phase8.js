/**
 * test_phase8.js
 *
 * Phase 8 Campus Notice Board & Circulars Verification Suite
 *
 * Covers:
 *   1. Notice Creation & Validation (Title, Content, Category, Dates)
 *   2. Draft Lifecycle & Student Invisibility
 *   3. Scheduled Future Notices (Hidden until publishDate)
 *   4. Automated Expiration (Expired notices removed from student feed)
 *   5. Academic Targeting (College-wide, Department, Course, Semester, Division)
 *   6. Student Academic Visibility Boundaries & Cross-Class 403 Blocking
 *   7. Priority-based Sorting (Urgent > Important > Normal)
 *   8. Attachment Upload & Protected Download Streaming
 *   9. RBAC — Student Create/Edit/Publish/Archive/Delete Rejection (403)
 *  10. Cross-Faculty Ownership Enforcement & Admin Superuser Access
 *  11. Lifecycle Operations (Publish Draft, Archive, Restore, Delete with File Cleanup)
 *
 * Usage: node src/scripts/test_phase8.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Notice = require('../models/Notice');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Student = require('../models/Student');
const User = require('../models/User');

const { fileExists } = require('../services/storage/localStorage');
const noticeService = require('../services/noticeService');

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

function section(name) {
  console.log(`\n─── ${name} ───`);
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          FacultyHub — Phase 8 Notices Verification          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await connectDB();

  // ─── 1. FIXTURES SETUP ───────────────────────────────────────────────────────
  section('1. Test Fixtures Setup');

  await Notice.deleteMany({ academicYear: '2026-TEST' });

  const deptCE = await Department.findOne({ code: 'CE' }) || await Department.create({ name: 'Computer Engg', code: 'CE' });
  const deptME = await Department.findOne({ code: 'ME' }) || await Department.create({ name: 'Mechanical Engg', code: 'ME' });
  const courseCE = await Course.findOne({ department: deptCE._id }) || await Course.create({ name: 'Diploma in CE', code: 'DCE', department: deptCE._id });

  let facultyA = await User.findOne({ role: 'faculty' }) || await User.create({ name: 'Dr. Faculty A', email: 'faculty1@facultyhub.dev', password: 'Password@123', role: 'faculty' });
  let facultyB = await User.findOne({ role: 'faculty', _id: { $ne: facultyA._id } }) || await User.create({ name: 'Prof. Faculty B', email: 'faculty2@facultyhub.dev', password: 'Password@123', role: 'faculty' });
  let adminUser = await User.findOne({ role: 'admin' }) || await User.create({ name: 'Admin User', email: 'admin@facultyhub.dev', password: 'Password@123', role: 'admin' });
  let studentUser = await User.findOne({ role: 'student' }) || await User.create({ name: 'Student Sem 5', email: 'student1@facultyhub.dev', password: 'Password@123', role: 'student' });

  // Configure student in CE Department, Semester 5, Division A
  let studentProfile = await Student.findOne({ userId: studentUser._id });
  if (!studentProfile) {
    studentProfile = await Student.create({
      userId: studentUser._id,
      fullName: studentUser.name,
      enrollmentNumber: '26001001',
      rollNumber: '1',
      email: studentUser.email,
      department: deptCE._id,
      course: courseCE._id,
      semester: 5,
      division: 'A',
      academicYear: '2026-TEST',
    });
  } else {
    studentProfile.department = deptCE._id;
    studentProfile.course = courseCE._id;
    studentProfile.semester = 5;
    studentProfile.division = 'A';
    await studentProfile.save();
  }

  // ─── 2. NOTICE CREATION & VALIDATION ────────────────────────────────────────
  section('2. Notice Creation, Validation & Attachments');

  // Test Case A: Valid College-wide Notice with Attachment
  const dummyAttachment = {
    buffer: Buffer.from('%PDF-1.4 Official Circular Attachment'),
    originalname: 'Exam_Guidelines.pdf',
    mimetype: 'application/pdf',
    size: 150,
  };

  const collegeNotice = await noticeService.createNotice(
    {
      title: 'Annual Sports & Cultural Week 2026',
      content: 'All students and faculty members are invited to participate.',
      category: 'Event',
      priority: 'Normal',
      targetScope: 'all',
      academicYear: '2026-TEST',
      status: 'Published',
    },
    dummyAttachment,
    facultyA
  );

  assert(!!collegeNotice._id, 'College-wide notice created successfully');
  assert(collegeNotice.targetScope === 'all', 'targetScope set to "all"');
  assert(collegeNotice.attachments.length === 1, 'File attachment saved to notice');
  assert(fileExists(collegeNotice.attachments[0].storageKey) === true, 'Physical attachment file saved to disk');

  // Test Case B: Validation Errors (Empty title, empty content, bad expiry date)
  try {
    await noticeService.createNotice({ title: '', content: 'Content' }, null, facultyA);
    assert(false, 'Should throw for empty title');
  } catch (err) {
    assert(err.statusCode === 400, 'Empty title rejected with 400');
  }

  try {
    await noticeService.createNotice({ title: 'Title', content: '' }, null, facultyA);
    assert(false, 'Should throw for empty content');
  } catch (err) {
    assert(err.statusCode === 400, 'Empty content rejected with 400');
  }

  try {
    await noticeService.createNotice(
      {
        title: 'Bad Date Notice',
        content: 'Content',
        publishDate: '2026-09-10',
        expiryDate: '2026-09-01',
      },
      null,
      facultyA
    );
    assert(false, 'Should throw for expiryDate <= publishDate');
  } catch (err) {
    assert(err.statusCode === 400, 'Expiry date prior to publish date rejected with 400');
  }

  // ─── 3. DRAFT & SCHEDULED FUTURE NOTICE LIFECYCLE ────────────────────────────
  section('3. Draft & Scheduled Future Publication Rules');

  // Draft Notice
  const draftNotice = await noticeService.createNotice(
    {
      title: 'Unpublished Draft Exam Schedule',
      content: 'Draft internal schedule pending principal approval.',
      category: 'Examination',
      priority: 'Important',
      targetScope: 'all',
      academicYear: '2026-TEST',
      status: 'Draft',
    },
    null,
    facultyA
  );
  assert(draftNotice.status === 'Draft', 'Notice created as Draft');

  // Scheduled Future Notice (publishDate in future)
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);

  const scheduledNotice = await noticeService.createNotice(
    {
      title: 'Future Scheduled Circular',
      content: 'This announcement should not be visible to students yet.',
      category: 'General',
      priority: 'Normal',
      targetScope: 'all',
      publishDate: futureDate,
      academicYear: '2026-TEST',
      status: 'Published',
    },
    null,
    facultyA
  );
  assert(scheduledNotice.publishDate > new Date(), 'Future publish date set');

  // Student queries notices
  const studentFeed1 = await noticeService.getNotices({ academicYear: '2026-TEST' }, studentUser);
  assert(!studentFeed1.notices.some(n => String(n._id) === String(draftNotice._id)), 'Draft notice hidden from student feed');
  assert(!studentFeed1.notices.some(n => String(n._id) === String(scheduledNotice._id)), 'Future scheduled notice hidden from student feed');

  // Student attempts direct ID query on Draft
  try {
    await noticeService.getNoticeById(draftNotice._id, studentUser);
    assert(false, 'Student should not access Draft by direct ID');
  } catch (err) {
    assert(err.statusCode === 403, 'Direct ID access to Draft rejected with 403');
  }

  // ─── 4. AUTOMATED EXPIRATION HANDLING ────────────────────────────────────────
  section('4. Notice Expiration Lifecycle');

  const pastExpiryDate = new Date();
  pastExpiryDate.setDate(pastExpiryDate.getDate() - 1); // Yesterday

  const expiredNotice = await noticeService.createNotice(
    {
      title: 'Yesterday Expired Submission Deadline',
      content: 'Submissions closed yesterday.',
      category: 'Academic',
      priority: 'Normal',
      targetScope: 'all',
      publishDate: new Date(Date.now() - 86400000 * 3),
      expiryDate: pastExpiryDate,
      academicYear: '2026-TEST',
      status: 'Published',
    },
    null,
    facultyA
  );

  // When getNotices is called, notice is auto-expired
  const studentFeedAfterExpiry = await noticeService.getNotices({ academicYear: '2026-TEST' }, studentUser);
  assert(!studentFeedAfterExpiry.notices.some(n => String(n._id) === String(expiredNotice._id)), 'Expired notice automatically excluded from active student feed');

  const docAfterCheck = await Notice.findById(expiredNotice._id);
  assert(docAfterCheck.status === 'Expired', 'Notice document status updated to Expired in database');

  // ─── 5. ACADEMIC TARGETING & VISIBILITY BOUNDARIES ───────────────────────────
  section('5. Academic Targeting & Student Class Boundaries');

  // Targeted to Mechanical Engg Department (Student is in CE)
  const meDeptNotice = await noticeService.createNotice(
    {
      title: 'Mechanical Workshop Safety Protocol',
      content: 'Mandatory for all Mechanical Engineering students.',
      category: 'Department',
      targetScope: 'department',
      department: deptME._id,
      academicYear: '2026-TEST',
      status: 'Published',
    },
    null,
    facultyB
  );

  // Targeted to CE Semester 5 (Student is in Sem 5)
  const sem5Notice = await noticeService.createNotice(
    {
      title: 'Sem 5 Project Submission Guidelines',
      content: 'Capstone project phase 1 deadline is next week.',
      category: 'Academic',
      priority: 'Important',
      targetScope: 'semester',
      department: deptCE._id,
      course: courseCE._id,
      semester: 5,
      academicYear: '2026-TEST',
      status: 'Published',
    },
    null,
    facultyA
  );

  // Targeted to CE Semester 3 (Student is in Sem 5)
  const sem3Notice = await noticeService.createNotice(
    {
      title: 'Sem 3 Remedial Classes Schedule',
      content: 'Extra lecture series for Semester 3 subjects.',
      category: 'Academic',
      targetScope: 'semester',
      department: deptCE._id,
      course: courseCE._id,
      semester: 3,
      academicYear: '2026-TEST',
      status: 'Published',
    },
    null,
    facultyA
  );

  // Targeted to Sem 5 Division B (Student is in Div A)
  const divBNotice = await noticeService.createNotice(
    {
      title: 'Division B Lab Room Relocation',
      content: 'Div B practicals shifted to Lab 4.',
      category: 'Department',
      targetScope: 'division',
      department: deptCE._id,
      course: courseCE._id,
      semester: 5,
      division: 'B',
      academicYear: '2026-TEST',
      status: 'Published',
    },
    null,
    facultyA
  );

  // Fetch student notices
  const studentTargetedFeed = await noticeService.getNotices({ academicYear: '2026-TEST' }, studentUser);
  const studentNoticeIds = studentTargetedFeed.notices.map(n => String(n._id));

  assert(studentNoticeIds.includes(String(collegeNotice._id)), 'College-wide notice included in student feed');
  assert(studentNoticeIds.includes(String(sem5Notice._id)), 'Enrolled Sem 5 notice included in student feed');
  assert(!studentNoticeIds.includes(String(meDeptNotice._id)), 'Un-enrolled ME Department notice excluded from student feed');
  assert(!studentNoticeIds.includes(String(sem3Notice._id)), 'Un-enrolled Sem 3 notice excluded from student feed');
  assert(!studentNoticeIds.includes(String(divBNotice._id)), 'Division B notice excluded from Division A student feed');

  // Direct ID access to un-enrolled notice rejected
  try {
    await noticeService.getNoticeById(meDeptNotice._id, studentUser);
    assert(false, 'Student should not access ME notice by direct ID');
  } catch (err) {
    assert(err.statusCode === 403, 'Cross-department direct ID query rejected with 403');
  }

  // ─── 6. PRIORITY ORDERING VERIFICATION ───────────────────────────────────────
  section('6. Priority-Based Ordering (Urgent > Important > Normal)');

  const urgentNotice = await noticeService.createNotice(
    {
      title: '🚨 Severe Cyclone Alert: Campus Closed Tomorrow',
      content: 'All lectures and practicals suspended on 29 Aug 2026.',
      category: 'Urgent',
      priority: 'Urgent',
      targetScope: 'all',
      academicYear: '2026-TEST',
      status: 'Published',
    },
    null,
    facultyA
  );

  const studentPriorityFeed = await noticeService.getNotices({ academicYear: '2026-TEST' }, studentUser);
  assert(studentPriorityFeed.notices[0].priority === 'Urgent', 'Top notice is Urgent priority');
  assert(studentPriorityFeed.notices[0].title.includes('Severe Cyclone Alert'), 'Urgent alert displayed first in student feed');

  // ─── 7. RBAC & CROSS-FACULTY OWNERSHIP ENFORCEMENT ───────────────────────────
  section('7. RBAC & Cross-Faculty Ownership Authorization');

  // Student cannot update notice
  try {
    await noticeService.updateNotice(collegeNotice._id, { title: 'Hacked Title' }, null, studentUser);
    assert(false, 'Student should not update notice');
  } catch (err) {
    assert(err.statusCode === 403, 'Student update attempt rejected with 403');
  }

  // Student cannot publish
  try {
    await noticeService.publishNotice(draftNotice._id, studentUser);
    assert(false, 'Student should not publish draft');
  } catch (err) {
    assert(err.statusCode === 403, 'Student publish attempt rejected with 403');
  }

  // Student cannot delete
  try {
    await noticeService.deleteNotice(collegeNotice._id, studentUser);
    assert(false, 'Student should not delete notice');
  } catch (err) {
    assert(err.statusCode === 403, 'Student delete attempt rejected with 403');
  }

  // Faculty B cannot edit Faculty A notice
  try {
    await noticeService.updateNotice(collegeNotice._id, { title: 'Faculty B Edit' }, null, facultyB);
    assert(false, 'Faculty B should not edit Faculty A notice');
  } catch (err) {
    assert(err.statusCode === 403, 'Cross-faculty edit rejected with 403');
  }

  // Faculty A (Owner) CAN update
  const updatedByOwner = await noticeService.updateNotice(
    collegeNotice._id,
    { title: 'Annual Sports & Cultural Festival 2026' },
    null,
    facultyA
  );
  assert(updatedByOwner.title === 'Annual Sports & Cultural Festival 2026', 'Owner updated notice successfully');

  // Admin CAN update
  const updatedByAdmin = await noticeService.updateNotice(
    collegeNotice._id,
    { content: 'Official principal announcement for festival.' },
    null,
    adminUser
  );
  assert(updatedByAdmin.content === 'Official principal announcement for festival.', 'Admin updated notice successfully');

  // ─── 8. ATTACHMENT DOWNLOAD STREAM ───────────────────────────────────────────
  section('8. Attachment Streaming & Protected Access');

  // Authorized download by student on College notice
  const downloadStreamData = await noticeService.getAttachmentStream(collegeNotice._id, 0, studentUser);
  assert(!!downloadStreamData.stream, 'Authorized student download stream opened');
  assert(downloadStreamData.fileName === 'Exam_Guidelines.pdf', 'Correct attachment filename returned');

  // ─── 9. LIFECYCLE: PUBLISH DRAFT, ARCHIVE, RESTORE & PERMANENT DELETE ────────
  section('9. Complete Notice Lifecycle & Disk Cleanup');

  // Publish Draft
  const publishedDraft = await noticeService.publishNotice(draftNotice._id, facultyA);
  assert(publishedDraft.status === 'Published', 'Draft notice published successfully');

  const studentFeedAfterPublish = await noticeService.getNotices({ academicYear: '2026-TEST' }, studentUser);
  assert(studentFeedAfterPublish.notices.some(n => String(n._id) === String(draftNotice._id)), 'Newly published draft now visible in student feed');

  // Archive
  const archived = await noticeService.archiveNotice(collegeNotice._id, facultyA);
  assert(archived.status === 'Archived', 'Notice archived');

  const studentFeedAfterArchive = await noticeService.getNotices({ academicYear: '2026-TEST' }, studentUser);
  assert(!studentFeedAfterArchive.notices.some(n => String(n._id) === String(collegeNotice._id)), 'Archived notice hidden from student feed');

  // Restore
  const restored = await noticeService.archiveNotice(collegeNotice._id, facultyA);
  assert(restored.status === 'Published', 'Notice restored to Published');

  // Permanent Delete & File Cleanup
  const attStorageKey = collegeNotice.attachments[0].storageKey;
  assert(fileExists(attStorageKey) === true, 'Attachment file exists on disk prior to notice deletion');

  const deleteResult = await noticeService.deleteNotice(collegeNotice._id, facultyA);
  assert(deleteResult.success === true, 'Delete operation returned success');

  const docAfterDelete = await Notice.findById(collegeNotice._id);
  assert(docAfterDelete === null, 'Notice document removed from MongoDB');
  assert(fileExists(attStorageKey) === false, 'Attached physical file cleanly removed from disk storage');

  // Clean all test fixtures
  await Notice.deleteMany({ academicYear: '2026-TEST' });

  // ─── TEST SUMMARY ────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`Phase 8 Campus Notice Board Verification: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed Tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('ALL PHASE 8 VERIFICATION TESTS PASSED ✓');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during Phase 8 test execution:', err);
  process.exit(1);
});
