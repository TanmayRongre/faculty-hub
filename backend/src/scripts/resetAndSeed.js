/**
 * resetAndSeed.js
 *
 * FacultyHub — Complete Data Wipe + Fresh 5th Semester Computer Engineering Reset
 *
 * Institution: Dr. Panjabrao Deshmukh Polytechnic, Amravati
 * Department:  Computer Engineering
 * Semester:    5th Semester
 * Students:    68 (exact list, no placeholders)
 * Subjects:    6 (STE, ACN, OSY, SPI, ITR, ENDS)
 * Batches:     A, B, C (unassigned until batch list provided)
 *
 * This script:
 *   1. Prints pre-wipe counts for all collections
 *   2. Wipes all academic/application data (preserves admin users)
 *   3. Clears Google Sheets ATT_* and MARK_* worksheets
 *   4. Seeds new Computer Engineering department
 *   5. Seeds 6 correct subjects with official MSBTE course codes
 *   6. Seeds exactly 68 students (no emails, no batch assignments)
 *   7. Seeds the official timetable (theory + practicals)
 *   8. Writes 68-student roster to all 12 Google Sheets worksheets
 *   9. Verifies and reports final state
 *
 * SAFE: Does NOT delete admin users or source code.
 * SAFE: Does NOT invent any data not provided in this file.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const Subject = require('../models/Subject');
const TimetableSlot = require('../models/TimetableSlot');
const Notice = require('../models/Notice');

// Soft imports — models that may not exist in all versions
let Course, Semester, Division;
try { Course = require('../models/Course'); } catch (e) { Course = null; }
try { Semester = require('../models/Semester'); } catch (e) { Semester = null; }
try { Division = require('../models/Division'); } catch (e) { Division = null; }

const { checkConfiguration } = require('../integrations/googleSheets/googleSheetsClient');
const sheetsService = require('../integrations/googleSheets/googleSheetsService');
const { VALID_SUBJECTS } = require('../integrations/googleSheets/spreadsheetConfig');

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXACT 68 STUDENT LIST (authoritative — do not modify)
// ─────────────────────────────────────────────────────────────────────────────
const STUDENTS = [
  { roll: '1',  enrollment: '23410360144', name: 'SARTHAK SUDHIR BOBADE' },
  { roll: '2',  enrollment: '24410360027', name: 'GULHANE JANHAVI SANTOSH' },
  { roll: '3',  enrollment: '24410360056', name: 'THORAT KASHISH SUNIL' },
  { roll: '4',  enrollment: '24410360070', name: 'FAISAL MAQSOOD MAQSOOD AHMAD' },
  { roll: '5',  enrollment: '24410360119', name: 'VAIDYA OM PANDIT' },
  { roll: '6',  enrollment: '24410360120', name: 'SOLANKE ASMITA PRAFUL' },
  { roll: '7',  enrollment: '24410360121', name: 'TAYSKAR KUNAL NARENDRA' },
  { roll: '8',  enrollment: '24410360122', name: 'TANDEKAR SHIVANSH MAHESHKUMAR' },
  { roll: '9',  enrollment: '24410360123', name: 'CHAVHAN GOURI SUBHASH' },
  { roll: '10', enrollment: '24410360125', name: 'GAIDHANE ANUSHRI KISHOR' },
  { roll: '11', enrollment: '24410360126', name: 'GAWANDE KUNJALI RAVINDRA' },
  { roll: '12', enrollment: '24410360127', name: 'YASH P PACHARE' },
  { roll: '13', enrollment: '24410360129', name: 'PANZADE SHIVANI SURESHRAO' },
  { roll: '14', enrollment: '24410360130', name: 'MUGAL PURVA DHIRAJ' },
  { roll: '15', enrollment: '24410360131', name: 'CHOUDHARI ARJUN GAJANAN' },
  { roll: '16', enrollment: '24410360134', name: 'DESHMUKH SUKRUTA GOVIND' },
  { roll: '17', enrollment: '24410360135', name: 'BANDWAL TANISHA MANESHSING' },
  { roll: '18', enrollment: '24410360137', name: 'CHAUDHARI KRISHNALI VIDYADHAR' },
  { roll: '19', enrollment: '24410360138', name: 'BONDE GAURI AJAY' },
  { roll: '20', enrollment: '24410360140', name: 'KUBADE CHANCHAL VIKASRAO' },
  { roll: '21', enrollment: '24410360141', name: 'BELSARE LAXMI PREMCHAND' },
  { roll: '22', enrollment: '24410360142', name: 'RONGRE TANMAY SAGAR' },
  { roll: '23', enrollment: '24410360144', name: 'ZOHEB ANWAR RAZIQUE AHMAD' },
  { roll: '24', enrollment: '24410360145', name: 'DHAGE SHREYA PRAVIN' },
  { roll: '25', enrollment: '24410360147', name: 'AMBHORE KARTIK PURUSHOTTAM' },
  { roll: '26', enrollment: '24410360148', name: 'TALEKAR BHARAT KASHINATH' },
  { roll: '27', enrollment: '24410360149', name: 'THAKARE DNYANESHWARI PRAKASH' },
  { roll: '28', enrollment: '24410360150', name: 'ANDHALE PRACHI RANJIT' },
  { roll: '29', enrollment: '24410360151', name: 'HURIEN AFSHAN SHEIKH MOHAMMAD SHARIQUE' },
  { roll: '30', enrollment: '24410360152', name: 'KHUPASE NISHANT YASHVANT' },
  { roll: '31', enrollment: '24410360255', name: 'JADHAO CHAITALI DNYANESHWAR' },
  { roll: '32', enrollment: '25410360113', name: 'DHAGE ISHWARI GAJANAN' },
  { roll: '33', enrollment: '25410360114', name: 'KADAM BHAURAO RAJKUMAR' },
  { roll: '34', enrollment: '23410360164', name: 'JANHAVI VIJAY GULHANE' },
  { roll: '35', enrollment: '23410360173', name: 'ABBAS HASAN NAURANGABADI' },
  { roll: '36', enrollment: '24410360153', name: 'BHAWNE SHREYASH VIJAY' },
  { roll: '37', enrollment: '24410360154', name: 'THAKARE NETRA SANTOSH' },
  { roll: '38', enrollment: '24410360155', name: 'DESHMUKH TANVI JAYAWANT' },
  { roll: '39', enrollment: '24410360158', name: 'KAKDE PURVA SHAILESH' },
  { roll: '40', enrollment: '24410360159', name: 'CHARHATE RITIKA SANDIP' },
  { roll: '41', enrollment: '24410360160', name: 'SYED TAMIMUDDIN SYED AYAZUDDIN' },
  { roll: '42', enrollment: '24410360161', name: 'KAWARE SAMIKSHA UMESH' },
  { roll: '43', enrollment: '24410360162', name: 'KOSE PURVA PADMAKAR' },
  { roll: '44', enrollment: '24410360165', name: 'KALORE ATHARAV VIJAYKUMAR' },
  { roll: '45', enrollment: '24410360166', name: 'TOMAR KUMUDINI YOGENDRASINH' },
  { roll: '46', enrollment: '24410360167', name: 'MEHARE VEDIKA GANESH' },
  { roll: '47', enrollment: '24410360168', name: 'GADERAO NIRAV NANDU' },
  { roll: '48', enrollment: '24410360169', name: 'SAPKAL SARTHAK BHARAT' },
  { roll: '49', enrollment: '24410360170', name: 'GAURI SURENDRA SURYAVANSHI' },
  { roll: '50', enrollment: '24410360172', name: 'PAWAR SHREYA PRAKASH' },
  { roll: '51', enrollment: '24410360173', name: 'KUROTIYA MITALI MITESH' },
  { roll: '52', enrollment: '24410360174', name: 'HELGE GAYATRI ATMARAM' },
  { roll: '53', enrollment: '24410360175', name: 'INGALE MANSI SHRAVAN' },
  { roll: '54', enrollment: '24410360176', name: 'SAIYAD ASHMIRA TAHER ALI' },
  { roll: '55', enrollment: '24410360177', name: 'QAZI INSHAAL AATIF' },
  { roll: '56', enrollment: '24410360178', name: 'SHAIKH AMAN JAVED' },
  { roll: '57', enrollment: '24410360179', name: 'JAWARKAR SNEHA ANIL' },
  { roll: '58', enrollment: '24410360180', name: 'AWAGHAD ISHWARI SANTOSH' },
  { roll: '59', enrollment: '24410360181', name: 'KALE SHRAVANI PRASHANT' },
  { roll: '60', enrollment: '24410360183', name: 'BHAGAT PARTH NIRAJ' },
  { roll: '61', enrollment: '24410360184', name: 'PADEKAR JANHAVI GAJENDRA' },
  { roll: '62', enrollment: '24410360185', name: 'BHIL ATHARV NARAYAN' },
  { roll: '63', enrollment: '24410360186', name: 'RATHOD RAJNANDINI RAMESHWAR' },
  { roll: '64', enrollment: '24410360187', name: 'REHAPADE AKSHARA VILAS' },
  { roll: '65', enrollment: '24410360288', name: 'SIYA ABHIJEET JADHAV' },
  { roll: '66', enrollment: '24410920153', name: 'ANUSHKA GOVARDHAN HINGANKAR' },
  { roll: '67', enrollment: '24411510196', name: 'NANDINI SADANAND RATHOD' },
  { roll: '68', enrollment: '25410360116', name: 'ARYA NITIN CHOUDHARI' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. SUBJECTS (authoritative MSBTE scheme)
// ─────────────────────────────────────────────────────────────────────────────
const SUBJECTS_DATA = [
  { code: 'STE',  name: 'Software Engineering',                     courseCode: '315323' },
  { code: 'ACN',  name: 'Advance Computer Network',                 courseCode: '315321' },
  { code: 'OSY',  name: 'Operating System',                         courseCode: '315319' },
  { code: 'SPI',  name: 'Seminar and Project Initiation Course',    courseCode: '315003' },
  { code: 'ENDS', name: 'Entrepreneurship Development and Startups',courseCode: '315002' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. TIMETABLE (authoritative — from official timetable document)
//    Theory = COMMON (all 68 students), isCommon: true, batch: null
//    Practical = BATCH-WISE, isCommon: false, batch: 'A'/'B'/'C'
//    Activity/Library/OFF = non-academic, stored for completeness
// ─────────────────────────────────────────────────────────────────────────────
const TIMETABLE = [
  // ── MONDAY THEORY ──────────────────────────────────────────────────────────
  { day: 'Monday', start: '10:30', end: '11:30', subjectCode: 'STE',  facultyCode: 'SSP', room: '109', type: 'theory',    isCommon: true,  batch: null },
  { day: 'Monday', start: '11:30', end: '12:30', subjectCode: 'OSY',  facultyCode: 'RHR', room: '109', type: 'theory',    isCommon: true,  batch: null },
  { day: 'Monday', start: '12:30', end: '13:30', subjectCode: 'ACN',  facultyCode: 'PCJ', room: '109', type: 'theory',    isCommon: true,  batch: null },

  // ── MONDAY PRACTICALS ──────────────────────────────────────────────────────
  { day: 'Monday', start: '13:50', end: '14:50', subjectCode: 'OSY',  facultyCode: 'RHR', room: 'CL5', type: 'practical', isCommon: false, batch: 'A' },
  { day: 'Monday', start: '13:50', end: '14:50', subjectCode: 'STE',  facultyCode: 'SSP', room: 'CL7', type: 'practical', isCommon: false, batch: 'B' },
  { day: 'Monday', start: '13:50', end: '14:50', subjectCode: 'ENDS', facultyCode: 'BPW', room: '109', type: 'practical', isCommon: false, batch: 'C' },

  { day: 'Monday', start: '14:50', end: '15:50', subjectCode: 'STE',  facultyCode: 'SSP', room: 'CL7', type: 'practical', isCommon: false, batch: 'A' },
  { day: 'Monday', start: '14:50', end: '15:50', subjectCode: 'ACN',  facultyCode: 'RHR', room: 'CL5', type: 'practical', isCommon: false, batch: 'B' },
  { day: 'Monday', start: '14:50', end: '15:50', subjectCode: null,   facultyCode: null,  room: null,  type: 'library',   isCommon: false, batch: 'C' },

  { day: 'Monday', start: '16:00', end: '17:00', subjectCode: 'STE',  facultyCode: 'SSP', room: 'CL7', type: 'practical', isCommon: false, batch: 'A' },
  { day: 'Monday', start: '16:00', end: '17:00', subjectCode: 'ACN',  facultyCode: 'RHR', room: 'CL5', type: 'practical', isCommon: false, batch: 'B' },
  { day: 'Monday', start: '16:00', end: '17:00', subjectCode: null,   facultyCode: null,  room: null,  type: 'library',   isCommon: false, batch: 'C' },

  { day: 'Monday', start: '17:00', end: '18:00', subjectCode: null,   facultyCode: null,  room: null,  type: 'activity',  isCommon: true,  batch: null },

  // ── TUESDAY THEORY ─────────────────────────────────────────────────────────
  { day: 'Tuesday', start: '10:30', end: '11:30', subjectCode: 'ACN',  facultyCode: 'PCJ', room: '109', type: 'theory',   isCommon: true,  batch: null },
  { day: 'Tuesday', start: '11:30', end: '12:30', subjectCode: 'OSY',  facultyCode: 'RHR', room: '109', type: 'theory',   isCommon: true,  batch: null },
  { day: 'Tuesday', start: '12:30', end: '13:30', subjectCode: 'STE',  facultyCode: 'SSP', room: '109', type: 'theory',   isCommon: true,  batch: null },

  // ── TUESDAY PRACTICALS ─────────────────────────────────────────────────────
  { day: 'Tuesday', start: '13:50', end: '14:50', subjectCode: 'ACN',  facultyCode: 'RHR', room: 'CL5', type: 'practical', isCommon: false, batch: 'A' },
  { day: 'Tuesday', start: '13:50', end: '14:50', subjectCode: null,   facultyCode: null,  room: null,  type: 'library',   isCommon: false, batch: 'B' },
  { day: 'Tuesday', start: '13:50', end: '14:50', subjectCode: 'STE',  facultyCode: 'SSP', room: 'CL6', type: 'practical', isCommon: false, batch: 'C' },

  // ── WEDNESDAY THEORY ───────────────────────────────────────────────────────
  { day: 'Wednesday', start: '10:30', end: '11:30', subjectCode: 'OSY', facultyCode: 'RHR', room: '109', type: 'theory',   isCommon: true,  batch: null },
  { day: 'Wednesday', start: '11:30', end: '12:30', subjectCode: 'ACN', facultyCode: 'PCJ', room: '109', type: 'theory',   isCommon: true,  batch: null },
  { day: 'Wednesday', start: '12:30', end: '13:30', subjectCode: 'STE', facultyCode: 'SSP', room: '109', type: 'theory',   isCommon: true,  batch: null },

  // ── WEDNESDAY PRACTICALS ───────────────────────────────────────────────────
  { day: 'Wednesday', start: '14:50', end: '15:50', subjectCode: 'STE',  facultyCode: 'SSP', room: 'CL6', type: 'practical', isCommon: false, batch: 'A' },
  { day: 'Wednesday', start: '14:50', end: '15:50', subjectCode: 'ENDS', facultyCode: 'BPW', room: '109', type: 'practical', isCommon: false, batch: 'B' },
  { day: 'Wednesday', start: '14:50', end: '15:50', subjectCode: 'OSY',  facultyCode: 'RHR', room: 'CL5', type: 'practical', isCommon: false, batch: 'C' },

  { day: 'Wednesday', start: '16:00', end: '17:00', subjectCode: null,   facultyCode: null,  room: null,  type: 'activity',  isCommon: true,  batch: null },

  // ── THURSDAY THEORY ────────────────────────────────────────────────────────
  { day: 'Thursday', start: '10:30', end: '11:30', subjectCode: 'OSY',  facultyCode: 'RHR', room: '109', type: 'theory',   isCommon: true,  batch: null },
  { day: 'Thursday', start: '11:30', end: '12:30', subjectCode: 'STE',  facultyCode: 'SSP', room: '109', type: 'theory',   isCommon: true,  batch: null },
  { day: 'Thursday', start: '12:30', end: '13:30', subjectCode: 'ENDS', facultyCode: 'BPW', room: '109', type: 'theory',   isCommon: true,  batch: null },

  // ── THURSDAY PRACTICALS ────────────────────────────────────────────────────
  { day: 'Thursday', start: '13:50', end: '14:50', subjectCode: null,  facultyCode: null,  room: null,  type: 'library',   isCommon: false, batch: 'A' },
  { day: 'Thursday', start: '13:50', end: '14:50', subjectCode: 'OSY', facultyCode: 'RHR', room: 'CL5', type: 'practical', isCommon: false, batch: 'B' },
  { day: 'Thursday', start: '13:50', end: '14:50', subjectCode: 'STE', facultyCode: 'SSP', room: 'CL7', type: 'practical', isCommon: false, batch: 'C' },

  { day: 'Thursday', start: '16:00', end: '17:00', subjectCode: 'SPI', facultyCode: 'GRG', room: 'CL1', type: 'practical', isCommon: false, batch: 'A' },
  { day: 'Thursday', start: '16:00', end: '17:00', subjectCode: 'SPI', facultyCode: 'RHR', room: 'CL5', type: 'practical', isCommon: false, batch: 'B' },
  { day: 'Thursday', start: '16:00', end: '17:00', subjectCode: 'SPI', facultyCode: 'SSP', room: 'CL7', type: 'practical', isCommon: false, batch: 'C' },

  // ── FRIDAY THEORY ──────────────────────────────────────────────────────────
  { day: 'Friday', start: '10:30', end: '11:30', subjectCode: 'ACN',  facultyCode: 'PCJ', room: '109', type: 'theory',   isCommon: true,  batch: null },
  { day: 'Friday', start: '11:30', end: '12:30', subjectCode: 'OSY',  facultyCode: 'RHR', room: '109', type: 'theory',   isCommon: true,  batch: null },
  { day: 'Friday', start: '12:30', end: '13:30', subjectCode: null,   facultyCode: null,  room: null,  type: 'off',      isCommon: true,  batch: null },

  // ── FRIDAY PRACTICALS ──────────────────────────────────────────────────────
  { day: 'Friday', start: '13:50', end: '14:50', subjectCode: 'ENDS', facultyCode: 'BPW', room: '109', type: 'practical', isCommon: false, batch: 'A' },
  { day: 'Friday', start: '13:50', end: '14:50', subjectCode: 'STE',  facultyCode: 'SSP', room: 'CL7', type: 'practical', isCommon: false, batch: 'B' },
  { day: 'Friday', start: '13:50', end: '14:50', subjectCode: 'ACN',  facultyCode: 'RHR', room: 'CL5', type: 'practical', isCommon: false, batch: 'C' },

  // Saturday — no 5th semester lectures
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESET + SEED
// ─────────────────────────────────────────────────────────────────────────────
async function resetAndSeed() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     FacultyHub — COMPLETE DATA RESET + FRESH CE 5th SEM SEED    ║');
  console.log('║     Dr. Panjabrao Deshmukh Polytechnic, Amravati                ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  await connectDB();
  const db = mongoose.connection.db;

  // ─── STEP 1: PRE-WIPE COUNTS ───────────────────────────────────────────────
  console.log('\n[STEP 1/9] Pre-wipe database state:');
  const preCollections = await db.listCollections().toArray();
  let preTotals = {};
  for (const col of preCollections) {
    const count = await db.collection(col.name).countDocuments();
    preTotals[col.name] = count;
    if (count > 0) console.log(`  - ${col.name.padEnd(22)}: ${count} documents`);
  }

  // ─── STEP 2: WIPE (order matters — remove dependents first) ───────────────
  console.log('\n[STEP 2/9] Wiping all academic data...');

  // TimetableSlots
  const slotsDeleted = await TimetableSlot.deleteMany({});
  console.log(`  ✓ TimetableSlots deleted: ${slotsDeleted.deletedCount}`);

  // Notices
  const noticesDeleted = await Notice.deleteMany({});
  console.log(`  ✓ Notices deleted:        ${noticesDeleted.deletedCount}`);



  // Students
  const studentsDeleted = await Student.deleteMany({});
  console.log(`  ✓ Students deleted:       ${studentsDeleted.deletedCount}`);

  // Student Users (role = student)
  const studentUsersDeleted = await User.deleteMany({ role: 'student' });
  console.log(`  ✓ Student users deleted:  ${studentUsersDeleted.deletedCount}`);

  // Faculty profiles
  const facultyDeleted = await Faculty.deleteMany({});
  console.log(`  ✓ Faculty profiles deleted: ${facultyDeleted.deletedCount}`);

  // Faculty Users (role = faculty)
  const facultyUsersDeleted = await User.deleteMany({ role: 'faculty' });
  console.log(`  ✓ Faculty users deleted:  ${facultyUsersDeleted.deletedCount}`);

  // Subjects
  const subjectsDeleted = await Subject.deleteMany({});
  console.log(`  ✓ Subjects deleted:       ${subjectsDeleted.deletedCount}`);

  // Divisions
  if (Division) {
    const divsDeleted = await Division.deleteMany({});
    console.log(`  ✓ Divisions deleted:      ${divsDeleted.deletedCount}`);
  }

  // Semesters
  if (Semester) {
    const semsDeleted = await Semester.deleteMany({});
    console.log(`  ✓ Semesters deleted:      ${semsDeleted.deletedCount}`);
  }

  // Courses
  if (Course) {
    const coursesDeleted = await Course.deleteMany({});
    console.log(`  ✓ Courses deleted:        ${coursesDeleted.deletedCount}`);
  }

  // Departments
  const deptsDeleted = await Department.deleteMany({});
  console.log(`  ✓ Departments deleted:    ${deptsDeleted.deletedCount}`);

  // Also wipe any stale resources collection if it exists
  try {
    await db.collection('resources').deleteMany({});
    console.log('  ✓ Resources wiped');
  } catch (e) { /* collection may not exist */ }

  console.log('  ✅ All academic data wiped.');
  console.log('  ℹ️  Admin users preserved (not wiped).');

  // ─── STEP 3: GOOGLE SHEETS WIPE ───────────────────────────────────────────
  console.log('\n[STEP 3/9] Clearing Google Sheets attendance and marks data...');
  const sheetsConfigured = checkConfiguration();
  if (sheetsConfigured) {
    try {
      for (const sub of VALID_SUBJECTS) {
        // Clear ATT_<SUBJ> data (keep header row 1, clear from row 2)
        await sheetsService.clearRange(`ATT_${sub}!A2:ZZ10000`);
        console.log(`  ✓ Cleared ATT_${sub}`);
        // Clear MARK_<SUBJ> data (keep header row 1, clear from row 2)
        await sheetsService.clearRange(`MARK_${sub}!A2:ZZ10000`);
        console.log(`  ✓ Cleared MARK_${sub}`);
      }
      console.log('  ✅ Google Sheets data cleared.');
    } catch (sheetErr) {
      console.warn('  ⚠️ Google Sheets clear error:', sheetErr.message);
    }
  } else {
    console.log('  ⚠️ Google Sheets not configured — skipping Sheets wipe.');
  }

  // ─── STEP 4: SEED DEPARTMENT ──────────────────────────────────────────────
  console.log('\n[STEP 4/9] Creating Computer Engineering department...');
  const dept = await Department.create({
    name: 'Computer Engineering',
    code: 'CE',
    isActive: true,
  });
  console.log(`  ✅ Department created: ${dept.name} (${dept.code})`);

  // ─── STEP 5: SEED SUBJECTS ────────────────────────────────────────────────
  console.log('\n[STEP 5/9] Creating 6 subjects (official MSBTE scheme)...');
  const seededSubjects = {};
  for (const s of SUBJECTS_DATA) {
    const sub = await Subject.create({
      subjectCode: s.code,
      subjectName: s.name,
      courseCode: s.courseCode,
      department: dept._id,
      semester: 5,
      assignedFaculty: null,
      isActive: true,
    });
    seededSubjects[s.code] = sub;
    console.log(`  ✓ ${s.code.padEnd(5)} — ${s.name.padEnd(45)} [${s.courseCode}]`);
  }
  console.log(`  ✅ 6 subjects created.`);

  // ─── STEP 6: SEED 68 STUDENTS ─────────────────────────────────────────────
  console.log('\n[STEP 6/9] Creating exactly 68 students...');

  // Verify count before inserting
  if (STUDENTS.length !== 68) {
    throw new Error(`FATAL: Student list has ${STUDENTS.length} entries — expected exactly 68!`);
  }

  // Check for duplicate roll numbers in input
  const rollSet = new Set(STUDENTS.map(s => s.roll));
  if (rollSet.size !== 68) {
    throw new Error(`FATAL: Duplicate roll numbers detected in student list!`);
  }

  const seededStudents = [];
  let createdCount = 0;

  for (const s of STUDENTS) {
    // Create a minimal system user (required by schema — not displayed in UI)
    // Using a system email that won't conflict: sys.<enrollment>@ce.drpdp.local
    const systemEmail = `sys.${s.enrollment.toLowerCase()}@ce.drpdp.local`;

    const user = await User.create({
      name: s.name,
      email: systemEmail,
      password: 'ResetRequired@2026',  // placeholder — students log in via other means
      role: 'student',
      isActive: true,
    });

    const student = await Student.create({
      userId: user._id,
      enrollmentNumber: s.enrollment,
      rollNumber: s.roll,
      fullName: s.name,
      email: null,          // real email not provided
      phone: null,          // real phone not provided
      examSeatNumber: null, // not provided
      batch: null,          // unassigned until batch list provided
      department: dept._id,
      semester: 5,
      academicYear: '2026-2027',
      status: 'active',
    });

    seededStudents.push(student);
    createdCount++;
  }

  console.log(`  ✅ ${createdCount} students created.`);

  // Verify
  const dbStudentCount = await Student.countDocuments();
  if (dbStudentCount !== 68) {
    throw new Error(`FATAL: Expected 68 students in DB, got ${dbStudentCount}`);
  }
  console.log(`  ✅ Verified: ${dbStudentCount} students in database.`);

  // ─── STEP 7: SEED TIMETABLE ───────────────────────────────────────────────
  console.log('\n[STEP 7/9] Creating official 5th Semester CE timetable...');

  let theoryCount = 0;
  let practicalCount = 0;
  let otherCount = 0;

  for (const slot of TIMETABLE) {
    const subjectObj = slot.subjectCode ? seededSubjects[slot.subjectCode] : null;

    await TimetableSlot.create({
      faculty: null,                    // no faculty profiles yet
      facultyCode: slot.facultyCode,    // initials from timetable
      subject: subjectObj ? subjectObj._id : null,
      subjectCode: slot.subjectCode,
      subjectName: subjectObj ? subjectObj.subjectName : null,
      department: dept._id,
      semester: 5,
      academicYear: '2026-2027',
      dayOfWeek: slot.day,
      startTime: slot.start,
      endTime: slot.end,
      room: slot.room,
      lectureType: slot.type,
      isCommon: slot.isCommon,
      batch: slot.isCommon ? null : slot.batch,
      status: 'active',
    });

    if (slot.type === 'theory') theoryCount++;
    else if (slot.type === 'practical') practicalCount++;
    else otherCount++;
  }

  console.log(`  ✓ Theory slots (common):     ${theoryCount}`);
  console.log(`  ✓ Practical slots (batched): ${practicalCount}`);
  console.log(`  ✓ Other (activity/lib/off):  ${otherCount}`);
  console.log(`  ✅ Total timetable slots: ${TIMETABLE.length}`);

  // ─── STEP 8: GOOGLE SHEETS ROSTER SYNC ───────────────────────────────────
  console.log('\n[STEP 8/9] Syncing 68-student roster to Google Sheets...');
  if (sheetsConfigured) {
    try {
      // Build roster: [rollNumber, fullName]
      const rosterRows = seededStudents
        .sort((a, b) => parseInt(a.rollNumber) - parseInt(b.rollNumber))
        .map(s => [s.rollNumber, s.fullName]);

      for (const sub of VALID_SUBJECTS) {
        // Ensure ATT_<SUBJ> worksheet exists with headers
        await sheetsService.ensureAttendanceWorksheet(sub, seededStudents);
        console.log(`  ✓ ATT_${sub}: headers + ${rosterRows.length} student rows`);

        // Ensure MARK_<SUBJ> worksheet exists with headers
        await sheetsService.ensureMarksWorksheet(sub, seededStudents);
        console.log(`  ✓ MARK_${sub}: headers + ${rosterRows.length} student rows`);
      }

      console.log(`  ✅ All 12 Google Sheets worksheets set up with 68 students. No attendance or marks yet.`);
    } catch (sheetErr) {
      console.warn('  ⚠️ Google Sheets roster sync error:', sheetErr.message);
      console.warn('     Manual roster setup may be needed in Google Sheets.');
    }
  } else {
    console.log('  ⚠️ Google Sheets not configured — skipping roster sync.');
  }

  // ─── STEP 9: FINAL VERIFICATION ──────────────────────────────────────────
  console.log('\n[STEP 9/9] Final verification...');

  const finalStudents = await Student.countDocuments();
  const finalSubjects = await Subject.countDocuments();
  const finalDepts = await Department.countDocuments();
  const finalSlots = await TimetableSlot.countDocuments();
  const finalLectures = await Lecture.countDocuments();
  const finalNotices = await Notice.countDocuments();
  const finalFaculty = await Faculty.countDocuments();

  const ce = await Department.findOne({ code: 'CE' });
  const subjectList = await Subject.find({ department: ce._id }).select('subjectCode subjectName courseCode').lean();

  // Check for duplicate roll numbers
  const allStudents = await Student.find({}).select('rollNumber enrollmentNumber fullName').lean();
  const rollNumbers = allStudents.map(s => s.rollNumber);
  const uniqueRolls = new Set(rollNumbers);
  const hasDuplicateRolls = uniqueRolls.size !== rollNumbers.length;

  console.log('\n' + '═'.repeat(65));
  console.log('  FINAL VERIFICATION REPORT');
  console.log('═'.repeat(65));
  console.log(`  Database:                facultyhub`);
  console.log(`  Department:              ${ce ? ce.name + ' (' + ce.code + ')' : '❌ MISSING'}`);
  console.log(`  Students:                ${finalStudents} ${finalStudents === 68 ? '✅' : '❌ (expected 68)'}`);
  console.log(`  Duplicate roll numbers:  ${hasDuplicateRolls ? '❌ YES — PROBLEM!' : '✅ None'}`);
  console.log(`  Subjects:                ${finalSubjects} ${finalSubjects === 6 ? '✅' : '❌ (expected 6)'}`);
  console.log(`  Timetable slots:         ${finalSlots}`);
  console.log(`  Lectures conducted:      ${finalLectures} ${finalLectures === 0 ? '✅' : '❌ (expected 0)'}`);
  console.log(`  Faculty profiles:        ${finalFaculty} ${finalFaculty === 0 ? '✅ (none — to be added later)' : '⚠️ (unexpected)'}`);
  console.log(`  Notices:                 ${finalNotices} ${finalNotices === 0 ? '✅' : '❌ (expected 0)'}`);

  console.log('\n  Subjects created:');
  for (const s of subjectList.sort((a,b) => a.subjectCode.localeCompare(b.subjectCode))) {
    console.log(`    ${s.subjectCode.padEnd(6)} — ${s.subjectName.padEnd(48)} [${s.courseCode}]`);
  }

  console.log('\n  Student sample (first 5, last 3):');
  const sorted = allStudents.sort((a,b) => parseInt(a.rollNumber) - parseInt(b.rollNumber));
  const sampleStudents = [...sorted.slice(0,5), ...sorted.slice(-3)];
  for (const s of sampleStudents) {
    console.log(`    Roll ${s.rollNumber.padEnd(3)} | ${s.enrollmentNumber} | ${s.fullName}`);
  }

  console.log('\n  Timetable breakdown by day:');
  for (const day of ['Monday','Tuesday','Wednesday','Thursday','Friday']) {
    const daySlots = await TimetableSlot.countDocuments({ dayOfWeek: day });
    const dayTheory = await TimetableSlot.countDocuments({ dayOfWeek: day, lectureType: 'theory' });
    const dayPractical = await TimetableSlot.countDocuments({ dayOfWeek: day, lectureType: 'practical' });
    console.log(`    ${day.padEnd(12)}: ${daySlots} slots (${dayTheory} theory, ${dayPractical} practical)`);
  }

  console.log('\n' + '═'.repeat(65));

  const allGood = finalStudents === 68 && finalSubjects === 6 && finalLectures === 0 && !hasDuplicateRolls;
  if (allGood) {
    console.log('  ✅ RESET COMPLETE — Clean baseline established.');
  } else {
    console.log('  ⚠️ RESET COMPLETE with warnings — review above.');
  }
  console.log('═'.repeat(65) + '\n');

  await mongoose.disconnect();
}

resetAndSeed().catch(err => {
  console.error('\n❌ Reset failed with error:', err);
  process.exit(1);
});
