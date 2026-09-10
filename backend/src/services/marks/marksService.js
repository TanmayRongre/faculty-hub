/**
 * marksService.js
 *
 * Orchestrates marks operations for FacultyHub:
 *   - Direct MongoDB storage in Marks collection for high performance & reliability
 *   - Synchronizes with Google Sheets MARK_<SUBJECT> worksheets
 *   - Theory subjects (STE, OSY, ACN) with PA1 + PA2 assessments
 *   - Authoritative average = (PA1 + PA2) / 2
 *   - Practical subjects (SPI, ITR, ENDS) remain separate without theory PA1/PA2 assessments
 *   - Atomic batch update (SAVE ALL) for the entire class roster (68 students)
 */

const mongoose = require('mongoose');
const Student = require('../../models/Student');
const Subject = require('../../models/Subject');
const Department = require('../../models/Department');
const Marks = require('../../models/Marks');
const academicDataService = require('../../integrations/googleSheets/academicDataService');
const sheetsService = require('../../integrations/googleSheets/googleSheetsService');
const { ACADEMIC_CONFIG } = require('../../config/academic');
const {
  THEORY_SUBJECTS,
  PRACTICAL_SUBJECTS,
  ALL_ACTIVE_SUBJECTS,
  SUBJECT_ASSESSMENT_MATRIX,
  isTheorySubject,
  hasPracticalAssessment,
  validatePAMark,
  calculateTheoryAverage,
  calculateMarks,
  getPerformanceStatus,
} = require('./msbteEngine');

const PA_SUBJECTS = ACADEMIC_CONFIG.PA_SUBJECTS || ['STE', 'OSY', 'ACN'];
const PRACTICAL_MARKS_SUBJECTS = ACADEMIC_CONFIG.PRACTICAL_MARKS_SUBJECTS || ['ENDS', 'SPI', 'ITR'];

function getBatchForRoll(rollNumber) {
  const r = Number(rollNumber);
  if (r >= 1 && r <= 24) return 'A';
  if (r >= 25 && r <= 47) return 'B';
  if (r >= 48 && r <= 68) return 'C';
  return null;
}

function validatePracticalMark(value, fieldName = 'Practical mark') {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  if (isNaN(n)) {
    const err = new Error(`${fieldName} must be a valid number, got: "${value}"`);
    err.statusCode = 422;
    throw err;
  }
  if (n < 0) {
    const err = new Error(`${fieldName} cannot be negative (got ${n})`);
    err.statusCode = 422;
    throw err;
  }
  return Math.round(n * 100) / 100;
}

/**
 * Resolves a Student by MongoDB ObjectId, enrollmentNumber, or rollNumber.
 * @param {string} studentId  Mongo ObjectId string, enrollmentNumber, or rollNumber
 */
async function resolveStudent(studentId) {
  let student = null;
  if (mongoose.Types.ObjectId.isValid(studentId)) {
    student = await Student.findById(studentId)
      .select('enrollmentNumber rollNumber fullName department semester')
      .lean();
  }
  if (!student) {
    student = await Student.findOne({
      $or: [{ enrollmentNumber: studentId }, { rollNumber: studentId }],
    })
      .select('enrollmentNumber rollNumber fullName department semester')
      .lean();
  }
  if (!student) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }
  return student;
}

/**
 * Resolves a subject code → subject document.
 * Auto-creates ITR if missing in MongoDB.
 * @param {string} subjectCode
 */
async function resolveSubject(subjectCode) {
  const code = (subjectCode || '').toUpperCase().trim();
  let subject = await Subject.findOne({ subjectCode: code })
    .select('subjectCode subjectName semester department')
    .lean();

  if (!subject && code === 'ITR') {
    const dept = await Department.findOne();
    if (dept) {
      const created = await Subject.create({
        subjectCode: 'ITR',
        subjectName: 'Industrial Training',
        courseCode: '315004',
        department: dept._id,
        semester: 5,
      });
      subject = created.toObject();
    }
  }

  if (!subject) {
    const err = new Error(`Subject not found: ${subjectCode}`);
    err.statusCode = 404;
    throw err;
  }
  return subject;
}

/**
 * Get marks for a given subject.
 * - PA: Returns all 68 active students in numerical roll order (1 -> 68).
 * - Practical: Returns students for the requested batch (A: 1-24, B: 25-47, C: 48-68).
 *
 * @param {string} subjectCode
 * @param {object} [options]
 * @param {string} [options.batch] - 'A' | 'B' | 'C'
 * @param {string} [options.type] - 'PA' | 'PRACTICAL'
 * @returns {Promise<{ subjectCode: string, subjectName: string, type: string, students: Array<object> }>}
 */
async function getSubjectMarks(subjectCode, options = {}) {
  const code = (subjectCode || '').toUpperCase().trim();
  const subject = await resolveSubject(code);

  const determinedType = (
    options.type ||
    (PRACTICAL_MARKS_SUBJECTS.includes(code) ? 'PRACTICAL' : 'PA')
  ).toUpperCase().trim();

  const requestedBatch = options.batch ? String(options.batch).toUpperCase().trim() : null;

  // 1. Fetch all active 5th semester students in numerical roll order
  let students = await Student.find({ semester: 5, status: 'active' })
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ rollNumber: 1 })
    .select('_id rollNumber enrollmentNumber fullName department semester')
    .lean();

  // 2. Fetch existing marks from MongoDB for this subject
  const marksList = await Marks.find({ subjectCode: code }).lean();
  const marksMap = new Map();
  for (const m of marksList) {
    marksMap.set(String(m.rollNo).trim(), m);
    if (m.studentId) {
      marksMap.set(String(m.studentId), m);
    }
  }

  // Practical Flow (ENDS, SPI, ITR)
  if (determinedType === 'PRACTICAL' || PRACTICAL_MARKS_SUBJECTS.includes(code)) {
    if (requestedBatch) {
      if (requestedBatch === 'A') {
        students = students.filter((s) => Number(s.rollNumber) >= 1 && Number(s.rollNumber) <= 24);
      } else if (requestedBatch === 'B') {
        students = students.filter((s) => Number(s.rollNumber) >= 25 && Number(s.rollNumber) <= 47);
      } else if (requestedBatch === 'C') {
        students = students.filter((s) => Number(s.rollNumber) >= 48 && Number(s.rollNumber) <= 68);
      }
    }

    const mergedList = students.map((s) => {
      const roll = String(s.rollNumber).trim();
      const existing = marksMap.get(roll) || marksMap.get(String(s._id));
      const practicalMarks =
        existing?.practicalMarks !== undefined && existing?.practicalMarks !== null
          ? existing.practicalMarks
          : null;

      return {
        studentId: s._id,
        rollNo: roll,
        enrollmentNumber: s.enrollmentNumber,
        fullName: s.fullName,
        subjectCode: code,
        batch: existing?.batch || getBatchForRoll(roll),
        practicalMarks,
        pa1: null,
        pa2: null,
        average: null,
        updatedAt: existing?.updatedAt || null,
      };
    });

    return {
      subjectCode: code,
      subjectName: subject.subjectName,
      type: 'PRACTICAL',
      batch: requestedBatch,
      isTheory: false,
      totalStudents: mergedList.length,
      students: mergedList,
    };
  }

  // PA Flow (STE, OSY, ACN) - Full Class (68 Students)
  const mergedList = students.map((s) => {
    const roll = String(s.rollNumber).trim();
    const existing = marksMap.get(roll) || marksMap.get(String(s._id));

    const pa1 = existing?.pa1 !== undefined && existing?.pa1 !== null ? existing.pa1 : null;
    const pa2 = existing?.pa2 !== undefined && existing?.pa2 !== null ? existing.pa2 : null;
    const average = calculateTheoryAverage(pa1, pa2);

    return {
      studentId: s._id,
      rollNo: roll,
      enrollmentNumber: s.enrollmentNumber,
      fullName: s.fullName,
      subjectCode: code,
      pa1,
      pa2,
      average,
      status: getPerformanceStatus(average),
      updatedAt: existing?.updatedAt || null,
    };
  });

  return {
    subjectCode: code,
    subjectName: subject.subjectName,
    type: 'PA',
    isTheory: true,
    totalStudents: mergedList.length,
    students: mergedList,
  };
}

/**
 * Bulk updates marks for multiple students in a single atomic request (SAVE ALL).
 * Handles both PA (pa1, pa2, average) and Practical (practicalMarks, batch).
 *
 * @param {object} payload
 * @param {string} payload.subject - e.g. "STE", "OSY", "ACN", "ENDS", "SPI", "ITR"
 * @param {string} [payload.type] - "PA" | "PRACTICAL"
 * @param {string} [payload.batch] - "A" | "B" | "C"
 * @param {Array<object>} payload.marks
 * @param {string} [payload.academicYear='2026-2027']
 * @param {number} [payload.semester=5]
 * @returns {Promise<{ success: boolean, subject: string, type: string, processed: number, results: Array<object> }>}
 */
async function bulkUpdateMarks({
  subject,
  marks,
  type,
  batch,
  academicYear = '2026-2027',
  semester = 5,
}) {
  if (!subject) {
    const err = new Error('Subject code is required');
    err.statusCode = 400;
    throw err;
  }

  const subCode = subject.toUpperCase().trim();
  const determinedType = (
    type ||
    (PRACTICAL_MARKS_SUBJECTS.includes(subCode) ? 'PRACTICAL' : 'PA')
  ).toUpperCase().trim();

  if (determinedType === 'PA' && !PA_SUBJECTS.includes(subCode)) {
    const err = new Error(
      `Subject ${subCode} is not an applicable PA subject. Allowed PA subjects: ${PA_SUBJECTS.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (determinedType === 'PRACTICAL' && !PRACTICAL_MARKS_SUBJECTS.includes(subCode)) {
    const err = new Error(
      `Subject ${subCode} is not an applicable Practical subject. Allowed Practical subjects: ${PRACTICAL_MARKS_SUBJECTS.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(marks) || marks.length === 0) {
    const err = new Error('No marks data provided for bulk update');
    err.statusCode = 400;
    throw err;
  }

  const subjectDoc = await resolveSubject(subCode);

  // 1. Preload student roster
  const allStudents = await Student.find({ semester: 5, status: 'active' }).lean();
  const rollMap = new Map();
  const enrollMap = new Map();
  const idMap = new Map();

  for (const s of allStudents) {
    rollMap.set(String(s.rollNumber).trim(), s);
    enrollMap.set(s.enrollmentNumber.toUpperCase().trim(), s);
    idMap.set(String(s._id), s);
  }

  // 2. Validate all entries
  const validatedRecords = [];
  const errors = [];

  for (let i = 0; i < marks.length; i++) {
    const entry = marks[i];
    const rawRoll =
      entry.rollNo !== undefined
        ? String(entry.rollNo).trim()
        : entry.rollNumber
        ? String(entry.rollNumber).trim()
        : null;
    const rawEnroll = entry.enrollmentNumber
      ? String(entry.enrollmentNumber).toUpperCase().trim()
      : null;
    const rawId = entry.studentId ? String(entry.studentId).trim() : null;

    let student = null;
    if (rawRoll && rollMap.has(rawRoll)) {
      student = rollMap.get(rawRoll);
    } else if (rawEnroll && enrollMap.has(rawEnroll)) {
      student = enrollMap.get(rawEnroll);
    } else if (rawId && idMap.has(rawId)) {
      student = idMap.get(rawId);
    }

    if (!student) {
      errors.push(`Row ${i + 1}: Student with Roll "${rawRoll || rawEnroll || rawId}" not found`);
      continue;
    }

    try {
      if (determinedType === 'PRACTICAL') {
        const rawPractical =
          entry.practicalMarks !== undefined ? entry.practicalMarks : entry.practicalMark;
        const practicalMark = validatePracticalMark(
          rawPractical,
          `Roll ${student.rollNumber} Practical Mark`
        );
        const entryBatch = entry.batch || batch || getBatchForRoll(student.rollNumber);

        validatedRecords.push({
          studentId: student._id,
          rollNo: student.rollNumber,
          enrollmentNumber: student.enrollmentNumber,
          fullName: student.fullName,
          department: student.department,
          subjectId: subjectDoc._id,
          subjectCode: subCode,
          semester: Number(semester) || 5,
          practicalMarks: practicalMark,
          batch: entryBatch,
          assessmentType: 'PRACTICAL',
        });
      } else {
        const pa1 = validatePAMark(
          entry.pa1 !== undefined ? entry.pa1 : entry.PA1,
          `Roll ${student.rollNumber} PA1`
        );
        const pa2 = validatePAMark(
          entry.pa2 !== undefined ? entry.pa2 : entry.PA2,
          `Roll ${student.rollNumber} PA2`
        );
        const average = calculateTheoryAverage(pa1, pa2);

        validatedRecords.push({
          studentId: student._id,
          rollNo: student.rollNumber,
          enrollmentNumber: student.enrollmentNumber,
          fullName: student.fullName,
          department: student.department,
          subjectId: subjectDoc._id,
          subjectCode: subCode,
          semester: Number(semester) || 5,
          pa1,
          pa2,
          average,
          assessmentType: 'PA',
        });
      }
    } catch (valErr) {
      errors.push(valErr.message);
    }
  }

  if (errors.length > 0) {
    const err = new Error(
      `Validation failed for ${errors.length} record(s): ${errors.slice(0, 5).join('; ')}`
    );
    err.statusCode = 422;
    err.details = errors;
    throw err;
  }

  // 3. Atomic bulkWrite to MongoDB Marks collection
  const bulkOps = validatedRecords.map((rec) => {
    const updateSet = {
      rollNo: rec.rollNo,
      subjectCode: rec.subjectCode,
      semester: rec.semester,
      department: rec.department,
      assessmentType: rec.assessmentType,
      updatedAt: new Date(),
    };

    if (determinedType === 'PRACTICAL') {
      updateSet.practicalMarks = rec.practicalMarks;
      updateSet.batch = rec.batch;
    } else {
      updateSet.pa1 = rec.pa1;
      updateSet.pa2 = rec.pa2;
      updateSet.average = rec.average;
    }

    return {
      updateOne: {
        filter: { studentId: rec.studentId, subjectId: rec.subjectId },
        update: { $set: updateSet },
        upsert: true,
      },
    };
  });

  if (bulkOps.length > 0) {
    await Marks.bulkWrite(bulkOps);
  }

  // 4. Sync to Google Sheets if PA
  if (determinedType === 'PA') {
    try {
      const sheetsPayload = validatedRecords.map((r) => ({
        rollNumber: r.rollNo,
        fullName: r.fullName,
        pa1: r.pa1,
        pa2: r.pa2,
        average: r.average,
        PA: r.average,
      }));
      await sheetsService.updateSubjectMarks(subCode, sheetsPayload);
    } catch (sheetErr) {
      console.warn(`[MarksService] Google Sheets sync warning for ${subCode}:`, sheetErr.message);
    }
  }

  return {
    success: true,
    subject: subCode,
    type: determinedType,
    processed: validatedRecords.length,
    results: validatedRecords.map((r) => ({
      rollNo: r.rollNo,
      ...(determinedType === 'PRACTICAL'
        ? { practicalMarks: r.practicalMarks, batch: r.batch }
        : { pa1: r.pa1, pa2: r.pa2, average: r.average, status: getPerformanceStatus(r.average) }),
    })),
  };
}

/**
 * Update marks for a single student and subject.
 */
async function updateMarks(studentId, subjectCode, marksInput) {
  const student = await resolveStudent(studentId);
  const subCode = (subjectCode || '').toUpperCase().trim();

  return bulkUpdateMarks({
    subject: subCode,
    type: marksInput.type,
    batch: marksInput.batch,
    marks: [
      {
        studentId: student._id,
        rollNo: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        pa1: marksInput.pa1 !== undefined ? marksInput.pa1 : marksInput.PA1,
        pa2: marksInput.pa2 !== undefined ? marksInput.pa2 : marksInput.PA2,
        practicalMarks:
          marksInput.practicalMarks !== undefined
            ? marksInput.practicalMarks
            : marksInput.practicalMark,
        batch: marksInput.batch,
      },
    ],
    academicYear: marksInput.academicYear,
    semester: marksInput.semester,
  });
}

/**
 * Get marks for a specific student across all subjects (or filtered).
 *
 * @param {string} enrollmentOrId
 * @param {object} [filters]
 */
async function getStudentMarks(enrollmentOrId, filters = {}) {
  const student = await resolveStudent(enrollmentOrId);

  // Query MongoDB marks for this student
  const query = { studentId: student._id };
  if (filters.subjectCode) {
    query.subjectCode = filters.subjectCode.toUpperCase().trim();
  }
  const studentMarks = await Marks.find(query).populate('subjectId', 'subjectName subjectCode').lean();

  const marksBySubject = new Map();
  for (const m of studentMarks) {
    marksBySubject.set(m.subjectCode, m);
  }

  // Load subject names
  const allSubjects = await Subject.find({ semester: 5 }).lean();
  const records = allSubjects.map((sub) => {
    const isTheory = isTheorySubject(sub.subjectCode);
    const existing = marksBySubject.get(sub.subjectCode);

    const pa1 = existing?.pa1 !== undefined && existing?.pa1 !== null ? existing.pa1 : null;
    const pa2 = existing?.pa2 !== undefined && existing?.pa2 !== null ? existing.pa2 : null;
    const average = isTheory ? calculateTheoryAverage(pa1, pa2) : null;

    const calc = isTheory ? calculateMarks({ pa1, pa2 }) : null;

    return {
      subjectCode: sub.subjectCode,
      subjectName: sub.subjectName,
      isTheory,
      pa1,
      pa2,
      average,
      PA: average, // Marksheet-facing final PA mark
      totalPossible: 30,
      isComplete: calc?.isComplete ?? false,
      isPassing: calc?.isPassing ?? null,
      performancePercent: calc?.performancePercent ?? null,
      performanceStatus: calc?.performanceStatus ?? null,
    };
  });

  // Performance summary for assessed theory subjects
  const assessed = records.filter((r) => r.isTheory && r.average !== null);
  const avgPA =
    assessed.length > 0
      ? Math.round((assessed.reduce((acc, curr) => acc + curr.average, 0) / assessed.length) * 100) / 100
      : null;

  return {
    student: {
      studentId: student._id,
      rollNumber: student.rollNumber,
      enrollmentNumber: student.enrollmentNumber,
      fullName: student.fullName,
    },
    records,
    summary: {
      totalSubjects: records.length,
      theorySubjects: records.filter((r) => r.isTheory).length,
      assessedTheorySubjects: assessed.length,
      averagePA: avgPA,
      overallStatus: getPerformanceStatus(avgPA),
    },
  };
}

/**
 * Get all marks across all subjects (faculty/admin overview).
 */
async function getAllMarks(filters = {}) {
  if (filters.subjectCode) {
    const result = await getSubjectMarks(filters.subjectCode);
    return result.students;
  }

  // Return all records from Marks collection
  const allMarks = await Marks.find({ semester: 5 })
    .populate('studentId', 'rollNumber fullName enrollmentNumber')
    .lean();

  return allMarks.map((m) => ({
    studentId: m.studentId?._id,
    rollNumber: m.rollNo || m.studentId?.rollNumber,
    enrollmentNumber: m.studentId?.enrollmentNumber,
    fullName: m.studentId?.fullName,
    subjectCode: m.subjectCode,
    pa1: m.pa1,
    pa2: m.pa2,
    average: m.average,
    PA: m.average,
    updatedAt: m.updatedAt,
  }));
}

/**
 * Complete reset of all marks records in MongoDB and Google Sheets.
 */
async function resetAllMarks() {
  // 1. Delete all records from MongoDB Marks
  const deletedCount = await Marks.deleteMany({});
  console.log(`[MarksService] Deleted ${deletedCount.deletedCount} marks from MongoDB`);

  // 2. Clear PA1, PA2, Average columns in Google Sheets for theory subjects
  for (const sub of THEORY_SUBJECTS) {
    try {
      const sheetName = `MARK_${sub}`;
      const rows = await sheetsService.readRange(`${sheetName}!A:B`);
      if (rows && rows.length > 1) {
        const clearValues = rows.slice(1).map(() => ['', '', '']);
        await sheetsService.updateRange(`${sheetName}!C2:E${rows.length}`, clearValues);
      }
    } catch (e) {
      console.warn(`[MarksService] Warning resetting sheet MARK_${sub}:`, e.message);
    }
  }

  return { success: true, deletedCount: deletedCount.deletedCount };
}

module.exports = {
  resolveStudent,
  resolveSubject,
  getSubjectMarks,
  getStudentMarks,
  getAllMarks,
  updateMarks,
  bulkUpdateMarks,
  resetAllMarks,
};
