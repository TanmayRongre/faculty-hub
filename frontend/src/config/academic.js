/**
 * academic.js
 * Centralized Academic Configuration for FacultyHub Frontend
 * Institution: Dr. Panjabrao Deshmukh Polytechnic, Amravati
 */

export const ACADEMIC_CONFIG = {
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

  // Active Subjects (Exactly 6 subjects, no credits)
  SUBJECTS: [
    { code: 'STE', name: 'Software Testing' },
    { code: 'ACN', name: 'Advanced Computer Network' },
    { code: 'OSY', name: 'Operating System' },
    { code: 'SPI', name: 'Software Project Planning & Management' },
    { code: 'ITR', name: 'Industrial Training' },
    { code: 'ENDS', name: 'Emerging Networks & Digital Services' },
  ],

  // Marks Configuration
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
