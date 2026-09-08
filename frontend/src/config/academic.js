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

  // Active Subjects for 5th Semester Computer Engineering (Exactly 6 — official MSBTE scheme)
  SUBJECTS: [
    { code: 'STE',  name: 'Software Engineering',                     courseCode: '315323' },
    { code: 'ACN',  name: 'Advance Computer Network',                 courseCode: '315321' },
    { code: 'OSY',  name: 'Operating System',                         courseCode: '315319' },
    { code: 'SPI',  name: 'Seminar and Project Initiation Course',    courseCode: '315003' },
    { code: 'ITR',  name: 'Internship (12 Weeks)',                    courseCode: '315004' },
    { code: 'ENDS', name: 'Entrepreneurship Development and Startups',courseCode: '315002' },
  ],

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
