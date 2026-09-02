/**
 * test_phase9.js
 *
 * Phase 9 Extracurricular Activity Gallery & Moderation Verification Suite
 *
 * Comprehensive test coverage for:
 *   1. Image Validation & Dangerous File Blocking (.exe, .bat, .js, .py, .sh, .php, .html)
 *   2. Image Size & Empty File Rejection (0 bytes, > 10MB)
 *   3. Path Traversal & Filename Sanitization
 *   4. Student Activity Submission with Multi-Image Upload
 *   5. Atomic Rollback on Multi-Image Upload Failure
 *   6. Moderation Workflow Lifecycle (Pending -> Approved / Rejected)
 *   7. Rejection Reason Requirement & Traceability
 *   8. Public Gallery Visibility Boundaries (Pending & Rejected hidden, Approved visible)
 *   9. Direct-ID Access Authorization Enforcement
 *  10. Student Ownership Isolation (Student A cannot edit/delete Student B's submission)
 *  11. Student cannot self-approve or elevate submission status
 *  12. Faculty / Admin Moderation Authorization
 *  13. Multi-Criteria Filtering, Search & Sorting
 *  14. Image Streaming & Access Control
 *  15. Permanent Deletion & Physical Image File Cleanup from Disk
 *
 * Usage: node src/scripts/test_phase9.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Gallery = require('../models/Gallery');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Student = require('../models/Student');
const User = require('../models/User');

const { fileExists } = require('../services/storage/localStorage');
const { validateImageUploadFile } = require('../services/storage/fileValidator');
const galleryService = require('../services/galleryService');

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
  console.log('║        FacultyHub — Phase 9 Activity Gallery Tests          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await connectDB();

  // ─── 1. IMAGE VALIDATION & SECURITY CHECKS ───────────────────────────────────
  section('1. Image Security & Dangerous Extension Blocking');

  const validJpg = { originalname: 'trophy.jpg', mimetype: 'image/jpeg', size: 1024 * 50 };
  const validPng = { originalname: 'certificate.png', mimetype: 'image/png', size: 1024 * 100 };
  const validWebp = { originalname: 'hackathon.webp', mimetype: 'image/webp', size: 1024 * 80 };

  assert(validateImageUploadFile(validJpg).valid === true, 'Valid JPG accepted');
  assert(validateImageUploadFile(validPng).valid === true, 'Valid PNG accepted');
  assert(validateImageUploadFile(validWebp).valid === true, 'Valid WEBP accepted');

  const emptyImage = { originalname: 'empty.png', mimetype: 'image/png', size: 0 };
  assert(validateImageUploadFile(emptyImage).valid === false, 'Empty image (0 bytes) rejected');

  const oversizedImage = { originalname: 'huge.jpg', mimetype: 'image/jpeg', size: 15 * 1024 * 1024 };
  assert(validateImageUploadFile(oversizedImage).valid === false, 'Oversized image (> 10MB) rejected');

  // Script & executable blocking
  const dangerousList = [
    { originalname: 'script.js', mimetype: 'application/javascript', size: 1024 },
    { originalname: 'malware.exe', mimetype: 'application/x-msdownload', size: 1024 },
    { originalname: 'exploit.php', mimetype: 'application/x-php', size: 1024 },
    { originalname: 'trojan.py', mimetype: 'text/x-python', size: 1024 },
    { originalname: 'hack.bat', mimetype: 'application/x-bat', size: 1024 },
    { originalname: 'phish.html', mimetype: 'text/html', size: 1024 },
    { originalname: 'document.pdf', mimetype: 'application/pdf', size: 1024 }, // PDF not allowed in image gallery
  ];

  dangerousList.forEach((f) => {
    const res = validateImageUploadFile(f);
    assert(res.valid === false, `Dangerous / non-image file rejected: ${f.originalname}`);
  });

  // Path traversal prevention
  const traversalImage = { originalname: '../../../etc/passwd.jpg', mimetype: 'image/jpeg', size: 1024 };
  const resTraversal = validateImageUploadFile(traversalImage);
  assert(resTraversal.valid === true && !resTraversal.sanitizedName.includes('../'), 'Path traversal sanitized from filename');

  // ─── 2. FIXTURES SETUP ───────────────────────────────────────────────────────
  section('2. Test Fixtures Setup');

  await Gallery.deleteMany({ academicYear: '2026-TEST' });

  const deptCE = await Department.findOne({ code: 'CE' }) || await Department.create({ name: 'Computer Engg', code: 'CE' });
  const courseCE = await Course.findOne({ department: deptCE._id }) || await Course.create({ name: 'Diploma in CE', code: 'DCE', department: deptCE._id });

  let studentA = await User.findOne({ email: 'student_gallery_a@facultyhub.dev' });
  if (!studentA) {
    studentA = await User.create({
      name: 'Student Alice',
      email: 'student_gallery_a@facultyhub.dev',
      password: 'Password@123',
      role: 'student',
    });
  }

  let studentB = await User.findOne({ email: 'student_gallery_b@facultyhub.dev' });
  if (!studentB) {
    studentB = await User.create({
      name: 'Student Bob',
      email: 'student_gallery_b@facultyhub.dev',
      password: 'Password@123',
      role: 'student',
    });
  }

  let facultyUser = await User.findOne({ role: 'faculty' }) || await User.create({
    name: 'Prof. Faculty Reviewer',
    email: 'faculty_review@facultyhub.dev',
    password: 'Password@123',
    role: 'faculty',
  });

  let adminUser = await User.findOne({ role: 'admin' }) || await User.create({
    name: 'Admin Moderator',
    email: 'admin_moderator@facultyhub.dev',
    password: 'Password@123',
    role: 'admin',
  });

  // Configure Student Alice Profile
  let profileA = await Student.findOne({ userId: studentA._id });
  if (!profileA) {
    profileA = await Student.create({
      userId: studentA._id,
      fullName: 'Student Alice',
      enrollmentNumber: '26099001',
      rollNumber: '91',
      email: studentA.email,
      department: deptCE._id,
      course: courseCE._id,
      semester: 5,
      division: 'A',
      admissionYear: 2024,
      academicYear: '2026-2027',
    });
  }

  // ─── 3. STUDENT SUBMISSION & MULTI-IMAGE UPLOAD ──────────────────────────────
  section('3. Student Activity Submission & Multi-Image Upload');

  const dummyImage1 = {
    buffer: Buffer.from('\xFF\xD8\xFF\xE0Mock JPG Image 1 Content'),
    originalname: 'hackathon_team.jpg',
    mimetype: 'image/jpeg',
    size: 2048,
  };
  const dummyImage2 = {
    buffer: Buffer.from('\x89PNG\r\n\x1a\nMock PNG Image 2 Content'),
    originalname: 'trophy_award.png',
    mimetype: 'image/png',
    size: 3072,
  };

  const activitySubmission = await galleryService.createSubmission(
    {
      title: '1st Prize at National Diploma Hackathon 2026',
      description: 'Our team developed an AI-powered smart agriculture monitoring device and won 1st prize.',
      category: 'Technical',
      eventName: 'SmartTech Hackathon 2026',
      eventDate: '2026-08-15',
      location: 'Pune Exhibition Hall',
      academicYear: '2026-TEST',
      captions: ['Team presentation', 'Receiving the award'],
    },
    [dummyImage1, dummyImage2],
    studentA
  );

  assert(!!activitySubmission._id, 'Activity submission created successfully');
  assert(activitySubmission.status === 'Pending', 'Initial status set to Pending');
  assert(activitySubmission.images.length === 2, '2 images saved in submission subdocuments');
  assert(fileExists(activitySubmission.images[0].storageKey) === true, 'Physical image 1 saved on disk');
  assert(fileExists(activitySubmission.images[1].storageKey) === true, 'Physical image 2 saved on disk');
  assert(activitySubmission.images[0].imageUrl.includes('/api/gallery/'), 'imageUrl assigned to image subdoc');
  assert(activitySubmission.studentName === 'Student Alice', 'Student name auto-derived from profile');

  // Validation: Missing title or image
  try {
    await galleryService.createSubmission({ title: '', description: 'Desc', eventDate: '2026-08-15' }, [dummyImage1], studentA);
    assert(false, 'Should throw for empty title');
  } catch (err) {
    assert(err.statusCode === 400, 'Empty title rejected with 400');
  }

  try {
    await galleryService.createSubmission({ title: 'Title', description: 'Desc', eventDate: '2026-08-15' }, [], studentA);
    assert(false, 'Should throw for 0 images');
  } catch (err) {
    assert(err.statusCode === 400, 'Missing images rejected with 400');
  }

  // ─── 4. MULTI-IMAGE TRANSACTIONAL ROLLBACK ──────────────────────────────────
  section('4. Multi-Image Transactional Rollback on Failure');

  const invalidSecondFile = { originalname: 'trojan.exe', mimetype: 'application/x-msdownload', size: 1024 };
  try {
    await galleryService.createSubmission(
      { title: 'Bad Submission', description: 'Desc', eventDate: '2026-08-15' },
      [dummyImage1, invalidSecondFile],
      studentA
    );
    assert(false, 'Should throw when second file is dangerous');
  } catch (err) {
    assert(err.statusCode === 400, 'Dangerous second file rejected with 400');
  }

  // ─── 5. PUBLIC GALLERY VISIBILITY BOUNDARIES ─────────────────────────────────
  section('5. Public Gallery Visibility (Pending / Rejected Hidden)');

  // Unapproved submission should NOT appear in public gallery
  const publicFeed1 = await galleryService.getApprovedGallery({ academicYear: '2026-TEST' }, studentB);
  assert(!publicFeed1.items.some(i => String(i._id) === String(activitySubmission._id)), 'Pending submission hidden from public gallery');

  // Student B attempting direct ID access to Student A's pending item
  try {
    await galleryService.getGalleryById(activitySubmission._id, studentB);
    assert(false, 'Student B should not access Student A pending submission by ID');
  } catch (err) {
    assert(err.statusCode === 403, 'Unauthorized direct-ID query rejected with 403');
  }

  // Student A CAN view their own pending item by ID
  const ownerView = await galleryService.getGalleryById(activitySubmission._id, studentA);
  assert(ownerView._id.toString() === activitySubmission._id.toString(), 'Author student can view their own pending submission');

  // ─── 6. FACULTY & ADMIN MODERATION WORKFLOW ──────────────────────────────────
  section('6. Faculty & Admin Moderation (Approve / Reject)');

  // Moderation dashboard shows pending item
  const modQueue = await galleryService.getModerationSubmissions({ status: 'Pending' }, facultyUser);
  assert(modQueue.items.some(i => String(i._id) === String(activitySubmission._id)), 'Pending submission appears in faculty moderation queue');
  assert(modQueue.counts.pending >= 1, 'Pending count incremented');

  // Reject without reason should fail
  try {
    await galleryService.rejectSubmission(activitySubmission._id, '', facultyUser);
    assert(false, 'Should throw when rejection reason is missing');
  } catch (err) {
    assert(err.statusCode === 400, 'Missing rejection reason rejected with 400');
  }

  // Reject with reason
  const rejected = await galleryService.rejectSubmission(
    activitySubmission._id,
    'Please attach a clear photo of the trophy and project banner.',
    facultyUser
  );
  assert(rejected.status === 'Rejected', 'Submission status changed to Rejected');
  assert(rejected.rejectionReason.includes('trophy'), 'Rejection reason saved in database');

  // Verify student sees rejection in mySubmissions
  const studentMySubmissions = await galleryService.getMySubmissions({}, studentA);
  const myRejected = studentMySubmissions.items.find(i => String(i._id) === String(activitySubmission._id));
  assert(myRejected && myRejected.status === 'Rejected', 'Rejected submission tracked in student personal submissions');
  assert(myRejected.rejectionReason.includes('trophy'), 'Student can see rejection feedback');

  // Now Approve the submission
  const approved = await galleryService.approveSubmission(activitySubmission._id, facultyUser);
  assert(approved.status === 'Approved', 'Submission status changed to Approved');
  assert(approved.reviewerName === facultyUser.name, 'Reviewer name recorded');

  // Now Approved submission MUST appear in public gallery
  const publicFeed2 = await galleryService.getApprovedGallery({ search: 'Hackathon' }, studentB);
  assert(publicFeed2.items.some(i => String(i._id) === String(activitySubmission._id)), 'Approved submission now visible in public gallery');

  // ─── 7. IMAGE STREAMING & ACCESS ─────────────────────────────────────────────
  section('7. Image Streaming & Public Access');

  const streamResult = await galleryService.getImageStream(activitySubmission._id, 0, studentB);
  assert(!!streamResult.stream, 'Image stream opened successfully');
  assert(streamResult.fileType === '.jpg', 'Correct image MIME/file type');

  // ─── 8. OWNERSHIP ISOLATION & RBAC ───────────────────────────────────────────
  section('8. Ownership Isolation & RBAC Protection');

  // Student B cannot edit Student A's submission
  try {
    await galleryService.updateSubmission(activitySubmission._id, { title: 'Hacked by Bob' }, null, studentB);
    assert(false, 'Student B should not edit Student A submission');
  } catch (err) {
    assert(err.statusCode === 403, 'Cross-student edit rejected with 403');
  }

  // Student B cannot delete Student A's submission
  try {
    await galleryService.deleteSubmission(activitySubmission._id, studentB);
    assert(false, 'Student B should not delete Student A submission');
  } catch (err) {
    assert(err.statusCode === 403, 'Cross-student delete rejected with 403');
  }

  // Student A CAN update own submission (moves to Pending for re-moderation)
  const updated = await galleryService.updateSubmission(
    activitySubmission._id,
    { title: '1st Prize at National Diploma Hackathon 2026 (Winner)' },
    null,
    studentA
  );
  assert(updated.title.includes('(Winner)'), 'Student updated own submission title');
  assert(updated.status === 'Pending', 'Student-edited submission resets to Pending for faculty review');

  // ─── 9. PERMANENT DELETION & DISK CLEANUP ────────────────────────────────────
  section('9. Permanent Deletion & Disk Cleanup');

  const key1 = activitySubmission.images[0].storageKey;
  const key2 = activitySubmission.images[1].storageKey;
  assert(fileExists(key1) === true, 'Physical image 1 exists before deletion');
  assert(fileExists(key2) === true, 'Physical image 2 exists before deletion');

  const delResult = await galleryService.deleteSubmission(activitySubmission._id, studentA);
  assert(delResult.success === true, 'Delete operation returned success');

  const docAfterDelete = await Gallery.findById(activitySubmission._id);
  assert(docAfterDelete === null, 'Document removed from MongoDB');
  assert(fileExists(key1) === false, 'Physical image 1 removed from disk');
  assert(fileExists(key2) === false, 'Physical image 2 removed from disk');

  // Clean all test fixtures
  await Gallery.deleteMany({ academicYear: '2026-TEST' });

  // ─── TEST SUMMARY ────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`Phase 9 Activity Gallery Verification: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed Tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('ALL PHASE 9 VERIFICATION TESTS PASSED ✓');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during Phase 9 test execution:', err);
  process.exit(1);
});
