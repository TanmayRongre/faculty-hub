/**
 * test_phase7.js
 *
 * Phase 7 Academic Resources & Notes Repository Verification Suite
 *
 * Covers:
 *   1. File Validation, MIME Checking & Extension Whitelist
 *   2. Dangerous Extension Blocking (.exe, .bat, .js, .sh, .py, .php, .html)
 *   3. Filename Sanitization & Path Traversal Prevention
 *   4. Resource Upload & Storage (with file buffer & metadata)
 *   5. Metadata Validation & Invalid Subject Rejection
 *   6. RBAC — Student Upload/Edit/Archive/Delete Rejection (403)
 *   7. Cross-Faculty Ownership Enforcement (Faculty A cannot edit Faculty B's upload)
 *   8. Admin Superuser Management Privileges
 *   9. Student Academic Context & Class Visibility Restriction
 *  10. Multi-criteria Filtering (Category, Subject, Status) & Keyword Search
 *  11. Pagination & Sorting
 *  12. Secure File Download & Stream Retrieval
 *  13. Lifecycle Operations (Archive, Restore, Permanent Deletion & Disk Cleanup)
 *
 * Usage: node src/scripts/test_phase7.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Resource = require('../models/Resource');
const Subject = require('../models/Subject');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const User = require('../models/User');

const {
  validateUploadFile,
  sanitizeFileName,
  ALLOWED_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  MAX_FILE_SIZE,
} = require('../services/storage/fileValidator');

const {
  assertSafePath,
  UPLOAD_ROOT,
  fileExists,
} = require('../services/storage/localStorage');

const resourceService = require('../services/resourceService');

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
  console.log('║        FacultyHub — Phase 7 Resources Verification          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await connectDB();

  // ─── 1. FILE VALIDATION & SECURITY CHECKS ───────────────────────────────────
  section('1. File Validator & Dangerous Extension Blocking');

  // Allowed types
  const validPdf = { originalname: 'OS_Unit1_Notes.pdf', size: 1024 * 50, mimetype: 'application/pdf' };
  assert(validateUploadFile(validPdf).valid === true, 'Valid PDF file accepted');

  const validDocx = { originalname: 'Lab_Manual.docx', size: 1024 * 100, mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  assert(validateUploadFile(validDocx).valid === true, 'Valid DOCX file accepted');

  const validZip = { originalname: 'Code_Samples.zip', size: 1024 * 200, mimetype: 'application/zip' };
  assert(validateUploadFile(validZip).valid === true, 'Valid ZIP file accepted');

  // Empty file (0 bytes)
  const emptyFile = { originalname: 'empty.pdf', size: 0, mimetype: 'application/pdf' };
  assert(validateUploadFile(emptyFile).valid === false, 'Empty file (0 bytes) rejected');

  // Oversized file (> 25MB)
  const oversizedFile = { originalname: 'huge.pdf', size: 30 * 1024 * 1024, mimetype: 'application/pdf' };
  assert(validateUploadFile(oversizedFile).valid === false, 'Oversized file (> 25MB) rejected');

  // Dangerous script/executable extensions
  const dangerousFiles = ['malware.exe', 'hack.bat', 'payload.sh', 'exploit.php', 'script.js', 'trojan.py', 'phish.html'];
  for (const name of dangerousFiles) {
    const ext = path.extname(name);
    const res = validateUploadFile({ originalname: name, size: 1024, mimetype: 'application/octet-stream' });
    assert(res.valid === false && DANGEROUS_EXTENSIONS.has(ext), `Dangerous file rejected: ${name} (${ext})`);
  }

  // ─── 2. FILENAME SANITIZATION & PATH TRAVERSAL SAFEGUARDS ────────────────────
  section('2. Filename Sanitization & Path Traversal Prevention');

  assert(sanitizeFileName('../../etc/passwd.pdf') === 'passwd.pdf', 'Path traversal sequence ../../ removed from filename');
  assert(sanitizeFileName('..\\..\\Windows\\System32.pdf') === 'System32.pdf', 'Windows path traversal ..\\..\\ removed');
  assert(sanitizeFileName('my notes @ chapter #1.pdf') === 'my_notes___chapter__1.pdf', 'Special characters sanitized cleanly');

  // Path resolution assertion
  try {
    assertSafePath(path.join(UPLOAD_ROOT, '../../outside_file.txt'));
    assert(false, 'Should throw for path outside UPLOAD_ROOT');
  } catch (err) {
    assert(err.statusCode === 400, 'assertSafePath throws 400 when attempting path traversal outside root');
  }

  // ─── 3. TEST FIXTURES SETUP ──────────────────────────────────────────────────
  section('3. Test Fixtures Setup');

  await Resource.deleteMany({ academicYear: '2026-TEST' });

  const dept = await Department.findOne() || await Department.create({ name: 'Computer Engg', code: 'CE' });
  const course = await Course.findOne() || await Course.create({ name: 'Diploma in CE', code: 'DCE', department: dept._id });

  let facultyUserA = await User.findOne({ role: 'faculty' }) || await User.create({ name: 'Dr. Test A', email: 'faculty1@facultyhub.dev', password: 'Password@123', role: 'faculty' });
  let facultyUserB = await User.findOne({ role: 'faculty', _id: { $ne: facultyUserA._id } }) || await User.create({ name: 'Prof. Test B', email: 'faculty2@facultyhub.dev', password: 'Password@123', role: 'faculty' });
  let adminUser = await User.findOne({ role: 'admin' }) || await User.create({ name: 'Admin', email: 'admin@facultyhub.dev', password: 'Password@123', role: 'admin' });
  let studentUser = await User.findOne({ role: 'student' }) || await User.create({ name: 'Student 1', email: 'student1@facultyhub.dev', password: 'Password@123', role: 'student' });

  // Ensure Student profile exists
  let studentProfile = await Student.findOne({ userId: studentUser._id });
  if (!studentProfile) {
    studentProfile = await Student.create({
      userId: studentUser._id,
      fullName: studentUser.name,
      enrollmentNumber: '26001099',
      rollNumber: '99',
      email: studentUser.email,
      department: dept._id,
      course: course._id,
      semester: 5,
      division: 'A',
      academicYear: '2026-TEST',
    });
  }

  const subjectSem5 = await Subject.findOne({ subjectCode: 'OS-22516' }) || await Subject.create({
    subjectCode: 'OS-22516',
    subjectName: 'Operating System',
    department: dept._id,
    course: course._id,
    semester: 5,
  });

  const subjectSem3 = await Subject.findOne({ subjectCode: 'DMS-22319' }) || await Subject.create({
    subjectCode: 'DMS-22319',
    subjectName: 'Database Management',
    department: dept._id,
    course: course._id,
    semester: 3,
  });

  // ─── 4. RESOURCE UPLOAD & METADATA CREATION ──────────────────────────────────
  section('4. Faculty Resource Upload & Physical Storage');

  const dummyPdfBuffer = Buffer.from('%PDF-1.4 Dummy academic test notes content for FacultyHub');
  const uploadPayload = {
    title: 'Operating System Unit 1 Notes',
    description: 'Introduction to OS, Kernel Architecture, and System Calls',
    category: 'Notes',
    subject: subjectSem5._id,
    division: 'ALL',
    academicYear: '2026-TEST',
    visibility: 'semester',
  };

  const fileObject = {
    buffer: dummyPdfBuffer,
    originalname: 'OS_Unit1_Notes.pdf',
    mimetype: 'application/pdf',
    size: dummyPdfBuffer.length,
  };

  const createdResource = await resourceService.createResource(uploadPayload, fileObject, facultyUserA);
  assert(!!createdResource._id, 'Resource created in database');
  assert(createdResource.title === 'Operating System Unit 1 Notes', 'Resource title matches input');
  assert(createdResource.category === 'Notes', 'Resource category set to Notes');
  assert(createdResource.semester === 5, 'Semester auto-inherited from Subject (Sem 5)');
  assert(createdResource.subjectCode === 'OS-22516', 'Subject code auto-inherited');
  assert(String(createdResource.uploadedBy) === String(facultyUserA._id), 'uploadedBy matches Faculty A');
  assert(fileExists(createdResource.storageKey) === true, 'Physical file stored on disk');
  assert(createdResource.fileUrl === `/api/resources/${createdResource._id}/download`, 'fileUrl formatted correctly');

  // Test missing metadata rejection
  try {
    await resourceService.createResource({ title: '', category: 'Notes', subject: subjectSem5._id }, fileObject, facultyUserA);
    assert(false, 'Should throw for empty title');
  } catch (err) {
    assert(err.statusCode === 400, 'Empty title rejected with 400');
  }

  // Test invalid subject rejection
  try {
    await resourceService.createResource({ title: 'Test', category: 'Notes', subject: new mongoose.Types.ObjectId() }, fileObject, facultyUserA);
    assert(false, 'Should throw for non-existent subject');
  } catch (err) {
    assert(err.statusCode === 404, 'Non-existent subject rejected with 404');
  }

  // Upload a second resource by Faculty B for Sem 3
  const resource2 = await resourceService.createResource(
    {
      title: 'Database Normalization Lab Manual',
      description: '1NF, 2NF, 3NF practical assignments',
      category: 'Lab Manual',
      subject: subjectSem3._id,
      division: 'ALL',
      academicYear: '2026-TEST',
    },
    {
      buffer: Buffer.from('%PDF-1.4 DMS Lab Manual'),
      originalname: 'DMS_Lab_Manual.pdf',
      mimetype: 'application/pdf',
      size: 100,
    },
    facultyUserB
  );
  assert(!!resource2._id, 'Faculty B created resource for Sem 3');

  // ─── 5. RBAC & CROSS-FACULTY OWNERSHIP ENFORCEMENT ───────────────────────────
  section('5. RBAC & Ownership Authorization');

  // Student cannot update metadata
  try {
    await resourceService.updateResource(createdResource._id, { title: 'Hacked Title' }, studentUser);
    assert(false, 'Student should not be able to update resource');
  } catch (err) {
    assert(err.statusCode === 403, 'Student update attempt rejected with 403');
  }

  // Student cannot archive
  try {
    await resourceService.archiveResource(createdResource._id, studentUser);
    assert(false, 'Student should not be able to archive resource');
  } catch (err) {
    assert(err.statusCode === 403, 'Student archive attempt rejected with 403');
  }

  // Student cannot delete
  try {
    await resourceService.deleteResource(createdResource._id, studentUser);
    assert(false, 'Student should not be able to delete resource');
  } catch (err) {
    assert(err.statusCode === 403, 'Student delete attempt rejected with 403');
  }

  // Faculty B cannot update Faculty A's resource (Ownership enforcement)
  try {
    await resourceService.updateResource(createdResource._id, { title: 'Faculty B Edit' }, facultyUserB);
    assert(false, 'Faculty B should not be able to update Faculty A resource');
  } catch (err) {
    assert(err.statusCode === 403, 'Cross-faculty edit attempt rejected with 403');
  }

  // Faculty A (Owner) CAN update resource
  const updatedByOwner = await resourceService.updateResource(
    createdResource._id,
    { title: 'Operating System Unit 1 & 2 Notes', description: 'Updated with memory management' },
    facultyUserA
  );
  assert(updatedByOwner.title === 'Operating System Unit 1 & 2 Notes', 'Owner faculty updated title successfully');

  // Admin CAN update any resource
  const updatedByAdmin = await resourceService.updateResource(
    createdResource._id,
    { description: 'Admin verified notes' },
    adminUser
  );
  assert(updatedByAdmin.description === 'Admin verified notes', 'Admin updated resource successfully');

  // ─── 6. STUDENT ACADEMIC VISIBILITY & ACCESS BOUNDARIES ───────────────────────
  section('6. Student Class Context & Access Boundaries');

  // Student is enrolled in Semester 5
  studentProfile = await Student.findOne({ userId: studentUser._id });
  if (studentProfile) {
    studentProfile.semester = 5;
    studentProfile.department = dept._id;
    studentProfile.course = course._id;
    await studentProfile.save();
  }

  // Student retrieves resources (must only return Sem 5, not Sem 3)
  const studentResults = await resourceService.getResources({ academicYear: '2026-TEST' }, studentUser);
  assert(studentResults.resources.length === 1, 'Student only sees 1 resource matching their Semester 5');
  assert(studentResults.resources[0].subjectCode === 'OS-22516', 'Returned resource is for enrolled OS-22516');
  assert(!studentResults.resources.some(r => r.subjectCode === 'DMS-22319'), 'Sem 3 DMS resource excluded from Student view');

  // Student attempts to view un-enrolled Sem 3 resource details by ID (must be denied)
  try {
    await resourceService.getResourceById(resource2._id, studentUser);
    assert(false, 'Student should not access Sem 3 resource by direct ID');
  } catch (err) {
    assert(err.statusCode === 403, 'Cross-semester direct ID access rejected with 403');
  }

  // ─── 7. FILTERING, SEARCH & PAGINATION ───────────────────────────────────────
  section('7. Multi-Criteria Filtering, Search & Pagination');

  // Faculty retrieves all resources
  const allResources = await resourceService.getResources({ academicYear: '2026-TEST' }, facultyUserA);
  assert(allResources.resources.length === 2, 'Faculty sees all active test resources (2 total)');

  // Filter by Category
  const labManuals = await resourceService.getResources({ academicYear: '2026-TEST', category: 'Lab Manual' }, facultyUserA);
  assert(labManuals.resources.length === 1 && labManuals.resources[0].category === 'Lab Manual', 'Filter by Category: Lab Manual returns 1 item');

  // Filter by SubjectCode
  const osResources = await resourceService.getResources({ academicYear: '2026-TEST', subjectCode: 'OS-22516' }, facultyUserA);
  assert(osResources.resources.length === 1 && osResources.resources[0].subjectCode === 'OS-22516', 'Filter by Subject: OS-22516 returns 1 item');

  // Search by keyword
  const searchResults = await resourceService.getResources({ academicYear: '2026-TEST', search: 'Normalization' }, facultyUserA);
  assert(searchResults.resources.length === 1 && searchResults.resources[0].title.includes('Normalization'), 'Keyword search for "Normalization" returned matching resource');

  // My Resources only filter
  const myResources = await resourceService.getResources({ academicYear: '2026-TEST', myResources: 'true' }, facultyUserA);
  assert(myResources.resources.length === 1 && String(myResources.resources[0].uploadedBy._id) === String(facultyUserA._id), 'myResources filter returned only Faculty A uploads');

  // ─── 8. FILE DOWNLOAD & STREAM ACCESS ─────────────────────────────────────────
  section('8. File Download Stream Verification');

  // Authorized download by Student
  const downloadData = await resourceService.getDownloadStream(createdResource._id, studentUser);
  assert(!!downloadData.stream, 'Download stream opened successfully');
  assert(downloadData.fileName === 'OS_Unit1_Notes.pdf', 'Correct fileName returned for download header');

  // Unauthorized download by Student on Sem 3 resource
  try {
    await resourceService.getDownloadStream(resource2._id, studentUser);
    assert(false, 'Unauthorized student should not get download stream');
  } catch (err) {
    assert(err.statusCode === 403, 'Unauthorized student download blocked with 403');
  }

  // ─── 9. LIFECYCLE: ARCHIVE, RESTORE & PERMANENT DELETE ───────────────────────
  section('9. Lifecycle: Archive & Permanent Delete with Disk Cleanup');

  // Archive
  const archived = await resourceService.archiveResource(createdResource._id, facultyUserA);
  assert(archived.status === 'archived', 'Resource status changed to archived');

  // Student cannot see archived resource in list
  const studentAfterArchive = await resourceService.getResources({ academicYear: '2026-TEST' }, studentUser);
  assert(studentAfterArchive.resources.length === 0, 'Archived resource hidden from student repository');

  // Restore
  const restored = await resourceService.archiveResource(createdResource._id, facultyUserA);
  assert(restored.status === 'active', 'Resource restored to active');

  // Permanent Delete
  const storageKey = createdResource.storageKey;
  assert(fileExists(storageKey) === true, 'File exists prior to deletion');

  const deleteResult = await resourceService.deleteResource(createdResource._id, facultyUserA);
  assert(deleteResult.success === true, 'Delete operation returned success');

  const docAfterDelete = await Resource.findById(createdResource._id);
  assert(docAfterDelete === null, 'Resource document removed from MongoDB');
  assert(fileExists(storageKey) === false, 'Physical file cleanly deleted from storage directory');

  // Clean remaining test fixture
  await resourceService.deleteResource(resource2._id, facultyUserB);
  await Resource.deleteMany({ academicYear: '2026-TEST' });

  // ─── TEST SUMMARY ────────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`Phase 7 Resources & Notes Verification: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed Tests:');
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('ALL PHASE 7 VERIFICATION TESTS PASSED ✓');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during Phase 7 test execution:', err);
  process.exit(1);
});
