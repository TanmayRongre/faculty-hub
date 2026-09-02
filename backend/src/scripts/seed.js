/**
 * seed.js — Development-only script to bootstrap initial accounts and academic structure.
 *
 * Scope:
 *  - Department: Computer Science (CO)
 *  - Semester: 5th Semester (5)
 *  - 4 Faculty accounts:
 *      * HOD: Prof. Anand Deshmukh (hod@facultyhub.dev)
 *      * Permanent Faculty: Prof. Rajesh Patil (faculty@facultyhub.dev)
 *      * Normal Faculty: Prof. Sneha Kulkarni (faculty2@facultyhub.dev)
 *      * NCC Administrator: Prof. Vikram Joshi (ncc@facultyhub.dev)
 *  - 6 Subjects: STE, ACN, OSY, SPI, ITR, ENDS
 *  - Admin User: admin@facultyhub.dev
 *  - Student User: student@facultyhub.dev (Roll 01)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Subject = require('../models/Subject');
const { ACADEMIC_CONFIG } = require('../config/academic');

async function seed() {
  await connectDB();

  console.log('=== SEEDING FACULTYHUB CORE DATABASE ===');

  // 0. Drop obsolete legacy indexes if present
  try {
    const facultyIndexes = await mongoose.connection.collection('faculties').indexes();
    if (facultyIndexes.some((idx) => idx.name === 'employeeId_1')) {
      await mongoose.connection.collection('faculties').dropIndex('employeeId_1');
      console.log('[INDEX CLEANUP] Dropped legacy employeeId_1 index from faculties');
    }
  } catch (err) {
    // Ignore index cleanup errors
  }

  // 1. Seed Department: Computer Science (CO)
  let dept = await Department.findOne({ code: ACADEMIC_CONFIG.DEPARTMENT.code });
  if (!dept) {
    dept = await Department.create({
      name: ACADEMIC_CONFIG.DEPARTMENT.name,
      code: ACADEMIC_CONFIG.DEPARTMENT.code,
    });
    console.log(`[CREATED] Department: ${dept.name} (${dept.code})`);
  } else {
    dept.name = ACADEMIC_CONFIG.DEPARTMENT.name;
    await dept.save();
    console.log(`[UPDATED] Department: ${dept.name} (${dept.code})`);
  }

  // 2. Seed Admin User
  let adminUser = await User.findOne({ email: 'admin@facultyhub.dev' });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@facultyhub.dev',
      password: 'Admin@1234',
      role: 'admin',
    });
    console.log('[CREATED] Admin user: admin@facultyhub.dev');
  }

  // 3. Seed 4 Faculty Users & Profiles
  const facultyData = [
    {
      name: 'Prof. Anand Deshmukh',
      email: 'hod@facultyhub.dev',
      phone: '+91 98220 11001',
      designation: 'HOD',
    },
    {
      name: 'Prof. Rajesh Patil',
      email: 'faculty@facultyhub.dev',
      phone: '+91 98220 11002',
      designation: 'Permanent Faculty',
    },
    {
      name: 'Prof. Sneha Kulkarni',
      email: 'faculty2@facultyhub.dev',
      phone: '+91 98220 11003',
      designation: 'Normal Faculty',
    },
    {
      name: 'Prof. Vikram Joshi',
      email: 'ncc@facultyhub.dev',
      phone: '+91 98220 11004',
      designation: 'NCC Administrator',
    },
  ];

  const seededFacultyProfiles = [];

  for (const f of facultyData) {
    let fUser = await User.findOne({ email: f.email });
    if (!fUser) {
      fUser = await User.create({
        name: f.name,
        email: f.email,
        password: 'Faculty@1234',
        role: 'faculty',
      });
      console.log(`[CREATED] Faculty User: ${f.email}`);
    }

    let fProfile = await Faculty.findOne({ email: f.email });
    if (!fProfile) {
      fProfile = await Faculty.create({
        userId: fUser._id,
        fullName: f.name,
        email: f.email,
        phone: f.phone,
        department: dept._id,
        designation: f.designation,
        status: 'active',
      });
      console.log(`[CREATED] Faculty Profile: ${f.name} (${f.designation})`);
    } else {
      fProfile.fullName = f.name;
      fProfile.designation = f.designation;
      fProfile.department = dept._id;
      fProfile.userId = fUser._id;
      await fProfile.save();
      console.log(`[UPDATED] Faculty Profile: ${f.name} (${f.designation})`);
    }
    seededFacultyProfiles.push(fProfile);
  }

  // 4. Seed the 6 Subjects & Assign Faculty
  const subjectFacultyMap = {
    STE: seededFacultyProfiles[0]._id, // HOD
    ACN: seededFacultyProfiles[1]._id, // Permanent Faculty
    OSY: seededFacultyProfiles[2]._id, // Normal Faculty
    SPI: seededFacultyProfiles[1]._id, // Permanent Faculty
    ITR: seededFacultyProfiles[3]._id, // NCC Administrator
    ENDS: seededFacultyProfiles[0]._id, // HOD
  };

  for (const s of ACADEMIC_CONFIG.SUBJECTS) {
    let sub = await Subject.findOne({ subjectCode: s.code });
    const assignedFacId = subjectFacultyMap[s.code] || seededFacultyProfiles[0]._id;

    if (!sub) {
      sub = await Subject.create({
        subjectCode: s.code,
        subjectName: s.name,
        department: dept._id,
        semester: 5,
        assignedFaculty: assignedFacId,
      });
      console.log(`[CREATED] Subject: ${s.code} - ${s.name}`);
    } else {
      sub.subjectName = s.name;
      sub.department = dept._id;
      sub.semester = 5;
      sub.assignedFaculty = assignedFacId;
      await sub.save();
      console.log(`[UPDATED] Subject: ${s.code} - ${s.name}`);
    }
  }

  // 5. Seed Primary Demo Student User & Profile (Roll 01)
  let studentUser = await User.findOne({ email: 'student@facultyhub.dev' });
  if (!studentUser) {
    studentUser = await User.create({
      name: 'Aarav Sharma',
      email: 'student@facultyhub.dev',
      password: 'Student@1234',
      role: 'student',
    });
    console.log('[CREATED] Student User: student@facultyhub.dev');
  }

  // Remove any old conflicting profile for this user that does not have 26001001
  await Student.deleteMany({ userId: studentUser._id, enrollmentNumber: { $ne: '26001001' } });

  let studentProfile = await Student.findOne({ enrollmentNumber: '26001001' });
  if (!studentProfile) {
    studentProfile = await Student.create({
      userId: studentUser._id,
      enrollmentNumber: '26001001',
      rollNumber: '01',
      fullName: 'Aarav Sharma',
      email: studentUser.email,
      phone: '+91 98765 00001',
      department: dept._id,
      semester: 5,
      academicYear: '2026-2027',
      status: 'active',
    });
    console.log('[CREATED] Student Profile: Aarav Sharma (26001001)');
  } else {
    studentProfile.fullName = 'Aarav Sharma';
    studentProfile.rollNumber = '01';
    studentProfile.department = dept._id;
    studentProfile.semester = 5;
    studentProfile.userId = studentUser._id;
    studentProfile.email = studentUser.email;
    await studentProfile.save();
    console.log('[UPDATED] Student Profile: Aarav Sharma (26001001)');
  }

  await mongoose.disconnect();
  console.log('=== CORE DATABASE SEED COMPLETE ===');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
