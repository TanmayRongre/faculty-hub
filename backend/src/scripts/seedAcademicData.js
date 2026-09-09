/**
 * seedAcademicData.js
 *
 * Full Academic Data Seeder for Dr. Panjabrao Deshmukh Polytechnic, Amravati
 *
 * Scope:
 *  - Department: Computer Science (CO)
 *  - Semester: 5th Semester (5)
 *  - 4 Faculty: HOD, Permanent Faculty, Normal Faculty, NCC Administrator
 *  - 6 Subjects: STE, ACN, OSY, SPI, ITR, ENDS
 *  - 40 Students (Roll 01–40, Enrollment 26001001–26001040)
 *  - Progressive Assessment (PA) marks out of 30 for all 40 students across 6 subjects (240 entries)
 *  - Multi-session Attendance logs with realistic attendance distribution (including >=75% and <75% defaulters)
 *  - Google Sheets bidirectional synchronization
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// MongoDB Models
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Subject = require('../models/Subject');
const TimetableSlot = require('../models/TimetableSlot');
const Lecture = require('../models/Lecture');

// Google Sheets Integration
const { checkConfiguration } = require('../integrations/googleSheets/googleSheetsClient');
const sheetsService = require('../integrations/googleSheets/googleSheetsService');
const { SHEET_NAMES, HEADERS, ATTENDANCE_STATUS } = require('../integrations/googleSheets/spreadsheetConfig');
const {
  studentRecordToRow,
  marksRecordToRow,
  attendanceRecordToRow,
  academicSummaryRecordToRow,
} = require('../integrations/googleSheets/mappers');
const { ACADEMIC_CONFIG } = require('../config/academic');

const STUDENT_NAMES = [
  'Aarav Sharma', 'Aditya Patel', 'Ananya Deshmukh', 'Aryan Kulkarni', 'Bhavya Joshi',
  'Chinmay Shinde', 'Devendra Patil', 'Diya Mehta', 'Esha Kadam', 'Gaurav More',
  'Harshada Chavan', 'Ishan Gaikwad', 'Janhavi Sawant', 'Karan Jadhav', 'Khushi Bhosale',
  'Manas Pawar', 'Mayuri Mane', 'Neha Salunkhe', 'Nikhil Tambe', 'Omkar Jagtap',
  'Parth Wagh', 'Pooja Gokhale', 'Pranav Mohite', 'Pratiksha Suryavanshi', 'Rahul Shinde',
  'Riya Inamdar', 'Rohan Thorat', 'Sakshi Shirodkar', 'Sameer Ghorpade', 'Sanika Nalawade',
  'Sanket Mule', 'Sayali Bapat', 'Shreya Dixit', 'Siddharth Mahajan', 'Sneha Khare',
  'Soham Phadke', 'Tanvi Bhagat', 'Utkarsh Sane', 'Vaidehi Pendse', 'Yashraj Rajput',
];

// Deterministic PRNG
function createPrng(seed = 20260831) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

async function seedAcademicData() {
  const isReset = process.argv.includes('--reset');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       FacultyHub — Academic Data Seeder (5th Semester)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Mode: ${isReset ? 'RESET & RE-POPULATE (--reset)' : 'INCREMENTAL / SYNC'}`);

  await connectDB();

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

  // 1. Department
  console.log('\n[1/7] Setting up Computer Science Department...');
  let dept = await Department.findOne({ code: ACADEMIC_CONFIG.DEPARTMENT.code });
  if (!dept) {
    dept = await Department.create({
      name: ACADEMIC_CONFIG.DEPARTMENT.name,
      code: ACADEMIC_CONFIG.DEPARTMENT.code,
    });
  } else {
    dept.name = ACADEMIC_CONFIG.DEPARTMENT.name;
    await dept.save();
  }
  console.log(`  ✓ Department: ${dept.name} (${dept.code})`);

  // 2. Faculty
  console.log('\n[2/7] Setting up 4 Faculty Members...');
  const facultyData = [
    { name: 'Prof. Anand Deshmukh', email: 'hod@facultyhub.dev', phone: '+91 98220 11001', designation: 'HOD' },
    { name: 'Prof. Rajesh Patil', email: 'faculty@facultyhub.dev', phone: '+91 98220 11002', designation: 'Permanent Faculty' },
    { name: 'Prof. Sneha Kulkarni', email: 'faculty2@facultyhub.dev', phone: '+91 98220 11003', designation: 'Normal Faculty' },
    { name: 'Prof. Vikram Joshi', email: 'ncc@facultyhub.dev', phone: '+91 98220 11004', designation: 'NCC Administrator' },
  ];

  const seededFaculty = [];
  for (const f of facultyData) {
    let fUser = await User.findOne({ email: f.email });
    if (!fUser) {
      fUser = await User.create({
        name: f.name,
        email: f.email,
        password: 'Faculty@1234',
        role: 'faculty',
      });
    }
    let fProfile = await Faculty.findOne({ userId: fUser._id });
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
    } else {
      fProfile.fullName = f.name;
      fProfile.designation = f.designation;
      fProfile.department = dept._id;
      await fProfile.save();
    }
    seededFaculty.push(fProfile);
    console.log(`  ✓ Faculty: ${f.name} — ${f.designation}`);
  }

  // 3. Subjects
  console.log('\n[3/7] Setting up 6 MSBTE Curriculum Subjects...');
  const subjectFacultyMap = {
    STE: seededFaculty[0]._id, // HOD
    ACN: seededFaculty[1]._id, // Permanent Faculty
    OSY: seededFaculty[2]._id, // Normal Faculty
    SPI: seededFaculty[1]._id, // Permanent Faculty
    ENDS: seededFaculty[0]._id, // HOD
  };

  const seededSubjects = [];
  for (const s of ACADEMIC_CONFIG.SUBJECTS) {
    let sub = await Subject.findOne({ subjectCode: s.code });
    const facId = subjectFacultyMap[s.code] || seededFaculty[0]._id;
    if (!sub) {
      sub = await Subject.create({
        subjectCode: s.code,
        subjectName: s.name,
        department: dept._id,
        semester: 5,
        assignedFaculty: facId,
      });
    } else {
      sub.subjectName = s.name;
      sub.department = dept._id;
      sub.semester = 5;
      sub.assignedFaculty = facId;
      await sub.save();
    }
    seededSubjects.push(sub);
    console.log(`  ✓ Subject: ${s.code} — ${s.name}`);
  }

  // 4. Timetable Slots
  console.log('\n[4/7] Generating Weekly Timetable Schedule...');
  await TimetableSlot.deleteMany({ semester: 5 });
  const weeklySchedule = [
    { day: 'Monday', time: '09:00', end: '10:00', code: 'STE', room: 'Room 201', fac: seededFaculty[0]._id },
    { day: 'Monday', time: '10:15', end: '11:15', code: 'ACN', room: 'Lab 1', fac: seededFaculty[1]._id },
    { day: 'Tuesday', time: '09:00', end: '10:00', code: 'OSY', room: 'Room 201', fac: seededFaculty[2]._id },
    { day: 'Tuesday', time: '10:15', end: '11:15', code: 'SPI', room: 'Room 202', fac: seededFaculty[1]._id },
    { day: 'Wednesday', time: '09:00', end: '10:00', code: 'STE', room: 'Room 201', fac: seededFaculty[0]._id },
    { day: 'Wednesday', time: '10:15', end: '11:15', code: 'ENDS', room: 'Seminar Hall', fac: seededFaculty[0]._id },
    { day: 'Thursday', time: '09:00', end: '10:00', code: 'STE', room: 'Lab 2', fac: seededFaculty[0]._id },
    { day: 'Thursday', time: '10:15', end: '11:15', code: 'ACN', room: 'Room 201', fac: seededFaculty[1]._id },
    { day: 'Friday', time: '09:00', end: '10:00', code: 'OSY', room: 'Lab 3', fac: seededFaculty[2]._id },
    { day: 'Friday', time: '10:15', end: '11:15', code: 'SPI', room: 'Room 201', fac: seededFaculty[1]._id },
    { day: 'Saturday', time: '09:00', end: '10:00', code: 'OSY', room: 'Room 201', fac: seededFaculty[2]._id },
    { day: 'Saturday', time: '10:15', end: '11:15', code: 'ENDS', room: 'Room 202', fac: seededFaculty[0]._id },
  ];

  for (const slot of weeklySchedule) {
    const subObj = seededSubjects.find((s) => s.subjectCode === slot.code);
    await TimetableSlot.create({
      dayOfWeek: slot.day,
      startTime: slot.time,
      endTime: slot.end,
      subjectCode: slot.code,
      subjectName: subObj?.subjectName || slot.code,
      subject: subObj?._id,
      department: dept._id,
      semester: 5,
      faculty: slot.fac,
      room: slot.room,
      lectureType: slot.room.includes('Lab') ? 'practical' : 'theory',
      isActive: true,
    });
  }
  console.log(`  ✓ Generated ${weeklySchedule.length} timetable slots.`);

  // 5. Students (40)
  console.log('\n[5/7] Generating 40 Student Profiles...');
  const seededStudents = [];
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const rollNum = String(i + 1).padStart(2, '0');
    const enrollment = `260010${rollNum}`;
    const name = STUDENT_NAMES[i];
    const email = `student${rollNum}@facultyhub.dev`;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: 'Student@1234',
        role: 'student',
      });
    }

    let student = await Student.findOne({ enrollmentNumber: enrollment });
    if (!student) {
      student = await Student.create({
        userId: user._id,
        enrollmentNumber: enrollment,
        rollNumber: rollNum,
        fullName: name,
        email,
        phone: `+91 98765 000${rollNum}`,
        department: dept._id,
        semester: 5,
        academicYear: '2026-2027',
        status: 'active',
      });
    } else {
      student.department = dept._id;
      student.fullName = name;
      student.rollNumber = rollNum;
      student.semester = 5;
      await student.save();
    }
    seededStudents.push(student);
  }
  console.log(`  ✓ Seeded ${seededStudents.length} students (Roll 01–40).`);

  // 6. Generate Realistic PA Marks (40 × 6 = 240 records)
  console.log('\n[6/7] Generating Progressive Assessment (PA / 30) Marks...');
  const prng = createPrng(20260831);
  const marksRows = [];

  for (const student of seededStudents) {
    const roll = parseInt(student.rollNumber, 10);

    for (const subj of ACADEMIC_CONFIG.SUBJECTS) {
      let paMark;
      if (roll <= 8) {
        // High performers: 24 - 30
        paMark = Math.min(30, Math.round(24 + prng() * 6));
      } else if (roll <= 24) {
        // Good performers: 19.5 - 24
        paMark = Math.round(19.5 + prng() * 4.5);
      } else if (roll <= 34) {
        // Average performers: 15 - 19
        paMark = Math.round(15 + prng() * 4);
      } else {
        // Low performers: 8 - 14
        paMark = Math.round(8 + prng() * 6);
      }

      marksRows.push(
        marksRecordToRow({
          enrollmentNumber: student.enrollmentNumber,
          rollNumber: student.rollNumber,
          studentName: student.fullName,
          subjectCode: subj.code,
          subjectName: subj.name,
          semester: 5,
          academicYear: '2026-2027',
          PA: paMark,
        })
      );
    }
  }
  console.log(`  ✓ Generated ${marksRows.length} PA mark records.`);

  // 7. Generate Multi-Lecture Attendance Records
  console.log('\n[7/7] Generating Multi-Lecture Attendance Matrix Data...');
  const attendanceRows = [];
  const sessionDates = ['2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29'];

  for (const sDate of sessionDates) {
    for (const subj of ACADEMIC_CONFIG.SUBJECTS.slice(0, 4)) {
      for (const student of seededStudents) {
        const roll = parseInt(student.rollNumber, 10);
        let status = ATTENDANCE_STATUS.PRESENT;

        if (roll <= 5) {
          // 100% attendance
          status = ATTENDANCE_STATUS.PRESENT;
        } else if (roll <= 25) {
          // ~85-90% attendance
          status = prng() < 0.1 ? ATTENDANCE_STATUS.ABSENT : ATTENDANCE_STATUS.PRESENT;
        } else if (roll <= 30) {
          // ~75% attendance
          status = prng() < 0.25 ? ATTENDANCE_STATUS.ABSENT : ATTENDANCE_STATUS.PRESENT;
        } else {
          // Defaulters (<75%)
          status = prng() < 0.6 ? ATTENDANCE_STATUS.ABSENT : ATTENDANCE_STATUS.PRESENT;
        }

        attendanceRows.push(
          attendanceRecordToRow({
            date: sDate,
            enrollmentNumber: student.enrollmentNumber,
            rollNumber: student.rollNumber,
            studentName: student.fullName,
            subjectCode: subj.code,
            subjectName: subj.name,
            semester: 5,
            status,
          })
        );
      }
    }
  }
  console.log(`  ✓ Generated ${attendanceRows.length} attendance session records.`);

  // 8. Google Sheets Synchronization
  const isSheetsConfigured = checkConfiguration();
  if (isSheetsConfigured) {
    console.log('\n[Google Sheets] Synchronizing with Google Spreadsheet...');
    try {
      // 1. Ensure Students Sheet exists with Row 1 headers
      await sheetsService.ensureWorksheet(SHEET_NAMES.STUDENTS, HEADERS.STUDENTS);

      // 2. Students Sheet
      const studentRows = seededStudents.map((s) => studentRecordToRow(s));
      await sheetsService.clearRange(`${SHEET_NAMES.STUDENTS}!A2:Z1000`);
      await sheetsService.updateRange(`${SHEET_NAMES.STUDENTS}!A2`, studentRows);
      console.log(`  ✓ Synced ${studentRows.length} students to Google Sheets.`);

      // 3. Subject-Wise Marks Worksheets (MARK_STE, MARK_ACN, MARK_OSY, MARK_SPI, MARK_ITR, MARK_ENDS)
      const { VALID_SUBJECTS } = require('../integrations/googleSheets/spreadsheetConfig');
      for (const sub of VALID_SUBJECTS) {
        await sheetsService.ensureMarksWorksheet(sub, seededStudents);
      }

      // Group marksRows by subjectCode and update each MARK_<SUBJECT> sheet
      const marksBySubject = {};
      for (const row of marksRows) {
        const sub = row[2]; // subjectCode
        if (!marksBySubject[sub]) marksBySubject[sub] = [];
        marksBySubject[sub].push({
          rollNumber: row[1],
          enrollmentNumber: row[0],
          PA: row[4],
        });
      }

      for (const [sub, mList] of Object.entries(marksBySubject)) {
        if (!VALID_SUBJECTS.includes(sub)) continue;
        await sheetsService.updateSubjectMarks(sub, mList);
      }
      console.log(`  ✓ Synced marks across all active MARK_<SUBJECT> worksheets.`);

      // 4. Subject-Wise Attendance Worksheets (ATT_STE, ATT_ACN, ATT_OSY, ATT_SPI, ATT_ITR, ATT_ENDS)
      for (const sub of VALID_SUBJECTS) {
        await sheetsService.ensureAttendanceWorksheet(sub, seededStudents);
      }

      // Group attendanceRows by subjectCode and lecture session
      const bySubject = {};
      for (const r of attendanceRows) {
        const sub = r[2]; // subjectCode
        if (!bySubject[sub]) bySubject[sub] = [];
        bySubject[sub].push(r);
      }

      for (const [sub, subRows] of Object.entries(bySubject)) {
        if (!VALID_SUBJECTS.includes(sub)) continue;
        const byDate = {};
        for (const row of subRows) {
          const d = row[0]; // date
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push({ rollNumber: row[4], status: row[5] });
        }
        for (const [d, list] of Object.entries(byDate)) {
          await sheetsService.updateSubjectAttendance(sub, `${d.replace(/-/g, '')}-${sub}-A-1`, d, list);
        }
      }
      console.log(`  ✓ Synced attendance sessions across all active ATT_<SUBJECT> worksheets.`);
    } catch (sheetErr) {
      console.warn('  ⚠️ Google Sheets sync encountered an issue (using local cache):', sheetErr.message);
    }
  } else {
    console.log('\n[Google Sheets] Not configured or credentials missing; local database seeded successfully.');
  }

  await mongoose.disconnect();
  console.log('\n======================================================');
  console.log('✅ ACADEMIC DATA SEEDING COMPLETE');
  console.log('======================================================\n');
}

seedAcademicData().catch((err) => {
  console.error('Seed academic data failed:', err);
  process.exit(1);
});
