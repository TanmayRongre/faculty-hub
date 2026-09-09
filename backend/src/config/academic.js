/**
 * academic.js
 * Centralized Academic Configuration for FacultyHub
 * Institution: Dr. Panjabrao Deshmukh Polytechnic, Amravati
 * Department: Computer Engineering (5th Semester)
 */

const ACADEMIC_CONFIG = {
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

  // Academic Year
  ACADEMIC_YEAR: '2026-2027',

  // Faculty Designations (Strictly 4 allowed values)
  FACULTY_DESIGNATIONS: [
    'HOD',
    'Permanent Faculty',
    'Normal Faculty',
    'NCC Administrator',
  ],

  // Active Subjects for 5th Semester Computer Engineering (Exactly 5 subjects)
  // Source: Official MSBTE Scheme (315xxx series)
  SUBJECTS: [
    { code: 'STE',  name: 'Software Engineering',                        courseCode: '315323' },
    { code: 'ACN',  name: 'Advance Computer Network',                    courseCode: '315321' },
    { code: 'OSY',  name: 'Operating System',                            courseCode: '315319' },
    { code: 'SPI',  name: 'Seminar and Project Initiation Course',        courseCode: '315003' },
    { code: 'ENDS', name: 'Entrepreneurship Development and Startups',    courseCode: '315002' },
  ],

  // Assessment Structure Matrix
  PRACTICAL_SUBJECTS: ['STE', 'OSY', 'ACN', 'ENDS'],
  THEORY_PA_SUBJECTS: ['STE', 'OSY', 'ACN'],
  ASSESSMENT_MATRIX: {
    STE:  { practical: true,  pa1: true,  pa2: true,  average: true },
    OSY:  { practical: true,  pa1: true,  pa2: true,  average: true },
    ACN:  { practical: true,  pa1: true,  pa2: true,  average: true },
    ENDS: { practical: true,  pa1: false, pa2: false, average: false },
    SPI:  { practical: false, pa1: false, pa2: false, average: false },
  },

  // Marks Configuration (PA Only, Max 30)
  MARKS: {
    MAX_PA: 30,
    MIN_PA: 0,
  },

  // Attendance Thresholds
  ATTENDANCE: {
    DEFAULTER_THRESHOLD: 75,
  },
};

// Export FACULTY_DESIGNATIONS at top level for Faculty model backward compat
const FACULTY_DESIGNATIONS = ACADEMIC_CONFIG.FACULTY_DESIGNATIONS;

module.exports = {
  ACADEMIC_CONFIG,
  FACULTY_DESIGNATIONS,
  ...ACADEMIC_CONFIG,
};

