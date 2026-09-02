/**
 * academic.js
 * Centralized Academic Configuration for FacultyHub
 * Institution: Dr. Panjabrao Deshmukh Polytechnic, Amravati
 */

const ACADEMIC_CONFIG = {
  INSTITUTION_NAME: 'Dr. Panjabrao Deshmukh Polytechnic, Amravati',
  APPLICATION_NAME: 'FacultyHub',

  // Active Department (Only Computer Science)
  DEPARTMENT: {
    name: 'Computer Science',
    code: 'CO',
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

  // Active Subjects for 5th Semester Computer Science (Exactly 6 subjects, no credits)
  SUBJECTS: [
    { code: 'STE', name: 'Software Testing' },
    { code: 'ACN', name: 'Advanced Computer Network' },
    { code: 'OSY', name: 'Operating System' },
    { code: 'SPI', name: 'Software Project Planning & Management' },
    { code: 'ITR', name: 'Industrial Training' },
    { code: 'ENDS', name: 'Emerging Networks & Digital Services' },
  ],

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

module.exports = {
  ACADEMIC_CONFIG,
  ...ACADEMIC_CONFIG,
};
