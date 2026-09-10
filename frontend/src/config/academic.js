/**
 * academic.js
 * Centralized Academic Configuration for FacultyHub Frontend
 * Institution: Dr. Panjabrao Deshmukh Polytechnic, Amravati
 * Department: Computer Engineering (5th Semester)
 */

export const ACADEMIC_CONFIG = {
  INSTITUTION_NAME: 'Dr. Panjabrao Deshmukh Polytechnic, Amravati',
  APPLICATION_NAME: 'FacultyHub',

  // Active Department (Only Computer Engineering)
  DEPARTMENT: {
    name: 'Computer Engineering',
    code: 'CE',
  },

  // Active Semester (Only 5th Semester)
  SEMESTER: {
    number: 5,
    displayName: '5th Semester',
  },

  // Faculty Designations (Strictly 4 allowed values)
  FACULTY_DESIGNATIONS: [
    'HOD',
    'Permanent Faculty',
    'Normal Faculty',
    'NCC Administrator',
  ],

  // Active Subjects for 5th Semester Computer Engineering
  SUBJECTS: [
    { code: 'STE',  name: 'Software Engineering',                     courseCode: '315323' },
    { code: 'ACN',  name: 'Advance Computer Network',                 courseCode: '315321' },
    { code: 'OSY',  name: 'Operating System',                         courseCode: '315319' },
    { code: 'SPI',  name: 'Seminar and Project Initiation Course',    courseCode: '315003' },
    { code: 'ENDS', name: 'Entrepreneurship Development and Startups',courseCode: '315002' },
    { code: 'ITR',  name: 'Industrial Training',                      courseCode: '315004' },
  ],

  // Subject Categorization for Marks Flow
  PA_SUBJECTS: ['STE', 'OSY', 'ACN'],
  PRACTICAL_MARKS_SUBJECTS: ['ENDS', 'SPI', 'ITR'],

  // Practical Laboratory Batches
  PRACTICAL_BATCHES: [
    { batch: 'A', range: 'Roll No. 1–24', minRoll: 1, maxRoll: 24, count: 24 },
    { batch: 'B', range: 'Roll No. 25–47', minRoll: 25, maxRoll: 47, count: 23 },
    { batch: 'C', range: 'Roll No. 48–68', minRoll: 48, maxRoll: 68, count: 21 },
  ],

  // Assessment Structure Matrix
  PRACTICAL_SUBJECTS: ['ENDS', 'SPI', 'ITR'],
  THEORY_PA_SUBJECTS: ['STE', 'OSY', 'ACN'],
  ASSESSMENT_MATRIX: {
    STE:  { practical: false, pa1: true,  pa2: true,  average: true },
    OSY:  { practical: false, pa1: true,  pa2: true,  average: true },
    ACN:  { practical: false, pa1: true,  pa2: true,  average: true },
    ENDS: { practical: true,  pa1: false, pa2: false, average: false },
    SPI:  { practical: true,  pa1: false, pa2: false, average: false },
    ITR:  { practical: true,  pa1: false, pa2: false, average: false },
  },

  // Marks Configuration (PA only, 0–30)
  MARKS: {
    MAX_PA: 30,
    MIN_PA: 0,
  },

  // Attendance
  ATTENDANCE: {
    DEFAULTER_THRESHOLD: 75,
  },
};

export default ACADEMIC_CONFIG;
