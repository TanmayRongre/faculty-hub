/**
 * marksService.js
 *
 * Orchestrates marks operations for FacultyHub:
 *   - Resolves MongoDB students/subjects
 *   - Delegates to academicDataService for Google Sheets I/O
 *   - Direct Progressive Assessment (PA) marks out of 30
 *   - Atomic bulk validation and update (SAVE ALL)
 */

const Student = require('../../models/Student');
const Subject = require('../../models/Subject');
const academicDataService = require('../../integrations/googleSheets/academicDataService');
const {
  enrichMarksRecords,
  generatePerformanceSummary,
  validatePAMark,
  calculateMarks,
} = require('./msbteEngine');

/**
 * Resolves a MongoDB Student _id → enrollment number + roll number.
 * @param {string} studentId  Mongo ObjectId string
 */
async function resolveStudent(studentId) {
  const student = await Student.findById(studentId)
    .select('enrollmentNumber rollNumber fullName')
    .lean();
  if (!student) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }
  return student;
}

/**
 * Resolves a subject code → subject document.
 * @param {string} subjectCode
 */
async function resolveSubject(subjectCode) {
  const subject = await Subject.findOne({ subjectCode: subjectCode.toUpperCase().trim() })
    .select('subjectCode subjectName semester')
    .lean();
  if (!subject) {
    const err = new Error(`Subject not found: ${subjectCode}`);
    err.statusCode = 404;
    throw err;
  }
  return subject;
}

/**
 * Get all marks for a student, enriched with PA calculations and summary.
 *
 * @param {string} enrollmentNumber
 * @param {object} [filters]  { semester, academicYear, subjectCode }
 * @returns {{ records: object[], summary: object }}
 */
async function getStudentMarks(enrollmentNumber, filters = {}) {
  const raw = await academicDataService.getMarksByEnrollment(enrollmentNumber, filters);
  const enriched = enrichMarksRecords(raw);
  const summary = generatePerformanceSummary(enriched);
  return { records: enriched, summary };
}

/**
 * Get marks for all students (faculty view), enriched with calculated fields.
 *
 * @param {object} [filters]  { semester, academicYear, subjectCode }
 * @returns {object[]}
 */
async function getAllMarks(filters = {}) {
  const raw = await academicDataService.getAllMarks(filters);
  return enrichMarksRecords(raw);
}

/**
 * Update marks for a specific student + subject (PA / 30).
 *
 * @param {string} studentId    MongoDB _id of student
 * @param {string} subjectCode
 * @param {object} marksInput   { PA, academicYear, semester }
 * @returns {object}
 */
async function updateMarks(studentId, subjectCode, marksInput) {
  // 1. Resolve student
  const student = await resolveStudent(studentId);

  // 2. Resolve subject
  const subject = await resolveSubject(subjectCode);

  // 3. Validate PA mark (0–30)
  const validatedPA = validatePAMark(marksInput.PA);

  // 4. Calculate evaluation fields
  const calculated = calculateMarks({ PA: validatedPA });

  // 5. Build payload for Sheets
  const sheetsPayload = {
    enrollmentNumber: student.enrollmentNumber,
    rollNumber: student.rollNumber,
    subjectCode: subject.subjectCode,
    subjectName: subject.subjectName,
    PA: validatedPA,
    academicYear: marksInput.academicYear || '2026-2027',
    semester: marksInput.semester ? Number(marksInput.semester) : 5,
  };

  const result = await academicDataService.writeMarks(sheetsPayload);

  return {
    action: result.action,
    enrollmentNumber: student.enrollmentNumber,
    subjectCode: subject.subjectCode,
    PA: validatedPA,
    calculated,
  };
}

/**
 * Bulk updates marks for multiple students in a single atomic/batch operation (SAVE ALL).
 *
 * @param {Array<{ studentId?: string, enrollmentNumber?: string, rollNumber?: string, subjectCode: string, PA: number|null }>} marksUpdates
 * @param {string} [academicYear='2026-2027']
 * @param {number} [semester=5]
 * @returns {{ processed: number, success: boolean, results: object[] }}
 */
async function bulkUpdateMarks(marksUpdates, academicYear = '2026-2027', semester = 5) {
  if (!Array.isArray(marksUpdates) || marksUpdates.length === 0) {
    const err = new Error('No marks data provided for bulk update');
    err.statusCode = 400;
    throw err;
  }

  // 1. Pre-validate all entries before writing any to avoid partial corrupt state
  const validatedEntries = [];
  for (let i = 0; i < marksUpdates.length; i++) {
    const entry = marksUpdates[i];
    if (!entry.subjectCode) {
      const err = new Error(`Entry at index ${i} missing subjectCode`);
      err.statusCode = 400;
      throw err;
    }
    if (!entry.enrollmentNumber && !entry.studentId) {
      const err = new Error(`Entry at index ${i} missing enrollmentNumber or studentId`);
      err.statusCode = 400;
      throw err;
    }

    let enroll = entry.enrollmentNumber;
    let roll = entry.rollNumber || '';
    if (!enroll && entry.studentId) {
      const s = await Student.findById(entry.studentId).select('enrollmentNumber rollNumber').lean();
      if (!s) {
        const err = new Error(`Student not found for id ${entry.studentId}`);
        err.statusCode = 404;
        throw err;
      }
      enroll = s.enrollmentNumber;
      roll = s.rollNumber;
    }

    const validatedPA = validatePAMark(entry.PA);

    validatedEntries.push({
      enrollmentNumber: enroll.toUpperCase().trim(),
      rollNumber: roll,
      subjectCode: entry.subjectCode.toUpperCase().trim(),
      subjectName: entry.subjectName || entry.subjectCode,
      PA: validatedPA,
      academicYear: entry.academicYear || academicYear,
      semester: entry.semester ? Number(entry.semester) : semester,
    });
  }

  // 2. Perform bulk write to Google Sheets
  const result = await academicDataService.writeMarksBatch(validatedEntries);

  return {
    processed: validatedEntries.length,
    success: true,
    results: result.results,
  };
}

module.exports = {
  resolveStudent,
  resolveSubject,
  getStudentMarks,
  getAllMarks,
  updateMarks,
  bulkUpdateMarks,
};
