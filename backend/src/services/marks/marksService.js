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
const {
  THEORY_SUBJECTS,
  PRACTICAL_SUBJECTS,
  isTheorySubject,
  validatePAMark,
  calculateTheoryAverage,
  calculateMarks,
  getPerformanceStatus,
} = require('./msbteEngine');

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
 * @param {string} subjectCode
 */
async function resolveSubject(subjectCode) {
  const code = (subjectCode || '').toUpperCase().trim();
  const subject = await Subject.findOne({ subjectCode: code })
    .select('subjectCode subjectName semester department')
    .lean();
  if (!subject) {
    const err = new Error(`Subject not found: ${subjectCode}`);
    err.statusCode = 404;
    throw err;
  }
  return subject;
}

/**
 * Get marks for all 68 students for a given subject.
 * Returns students in exact numerical roll order (1 -> 68).
 *
 * @param {string} subjectCode
 * @returns {Promise<{ subject: object, students: Array<object> }>}
 */
async function getSubjectMarks(subjectCode) {
  const code = (subjectCode || '').toUpperCase().trim();
  const subject = await resolveSubject(code);

  const isTheory = isTheorySubject(code);

  // 1. Fetch all active 5th semester students in numerical roll order
  const students = await Student.find({ semester: 5, status: 'active' })
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ rollNumber: 1 })
    .select('_id rollNumber enrollmentNumber fullName department semester')
    .lean();

  if (!isTheory) {
    // Return practical subject response
    return {
      subjectCode: code,
      subjectName: subject.subjectName,
      isTheory: false,
      practicalAssessment: true,
      message: `${code} is a practical-oriented course. Theory PA1/PA2 assessments do not apply.`,
      students: students.map((s) => ({
        studentId: s._id,
        rollNo: s.rollNumber,
        enrollmentNumber: s.enrollmentNumber,
        fullName: s.fullName,
        pa1: null,
        pa2: null,
        average: null,
      })),
    };
  }

  // 2. Fetch existing marks from MongoDB for this subject
  const marksList = await Marks.find({ subjectCode: code }).lean();
  const marksMap = new Map();
  for (const m of marksList) {
    marksMap.set(String(m.rollNo).trim(), m);
    if (m.studentId) {
      marksMap.set(String(m.studentId), m);
    }
  }

  // 3. Merge roster with marks
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
    isTheory: true,
    totalStudents: mergedList.length,
    students: mergedList,
  };
}

/**
 * Bulk updates marks for multiple students in a single atomic request (SAVE ALL).
 *
 * @param {object} payload
 * @param {string} payload.subject - e.g. "STE", "OSY", "ACN"
 * @param {Array<{ rollNo?: string|number, studentId?: string, enrollmentNumber?: string, pa1?: number|string|null, pa2?: number|string|null }>} payload.marks
 * @param {string} [payload.academicYear='2026-2027']
 * @param {number} [payload.semester=5]
 * @returns {Promise<{ success: boolean, subject: string, processed: number, results: Array<object> }>}
 */
async function bulkUpdateMarks({ subject, marks, academicYear = '2026-2027', semester = 5 }) {
  if (!subject) {
    const err = new Error('Subject code is required');
    err.statusCode = 400;
    throw err;
  }

  const subCode = subject.toUpperCase().trim();
  if (!isTheorySubject(subCode)) {
    const err = new Error(
      `Subject ${subCode} is not a theory subject with PA1/PA2 assessments. Allowed theory subjects: ${THEORY_SUBJECTS.join(', ')}`
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

  // 2. Validate all entries strictly before writing anything
  const validatedRecords = [];
  const errors = [];

  for (let i = 0; i < marks.length; i++) {
    const entry = marks[i];
    const rawRoll = entry.rollNo !== undefined ? String(entry.rollNo).trim() : (entry.rollNumber ? String(entry.rollNumber).trim() : null);
    const rawEnroll = entry.enrollmentNumber ? String(entry.enrollmentNumber).toUpperCase().trim() : null;
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
      const pa1 = validatePAMark(entry.pa1 !== undefined ? entry.pa1 : entry.PA1, `Roll ${student.rollNumber} PA1`);
      const pa2 = validatePAMark(entry.pa2 !== undefined ? entry.pa2 : entry.PA2, `Roll ${student.rollNumber} PA2`);
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
      });
    } catch (valErr) {
      errors.push(valErr.message);
    }
  }

  if (errors.length > 0) {
    const err = new Error(`Validation failed for ${errors.length} record(s): ${errors.slice(0, 5).join('; ')}`);
    err.statusCode = 422;
    err.details = errors;
    throw err;
  }

  // 3. Atomic bulkWrite to MongoDB Marks collection
  const bulkOps = validatedRecords.map((rec) => ({
    updateOne: {
      filter: { studentId: rec.studentId, subjectId: rec.subjectId },
      update: {
        $set: {
          rollNo: rec.rollNo,
          subjectCode: rec.subjectCode,
          semester: rec.semester,
          department: rec.department,
          pa1: rec.pa1,
          pa2: rec.pa2,
          average: rec.average,
          updatedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await Marks.bulkWrite(bulkOps);
  }

  // 4. Sync to Google Sheets MARK_<SUBJECT>
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

  return {
    success: true,
    subject: subCode,
    processed: validatedRecords.length,
    results: validatedRecords.map((r) => ({
      rollNo: r.rollNo,
      pa1: r.pa1,
      pa2: r.pa2,
      average: r.average,
      status: getPerformanceStatus(r.average),
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
    marks: [
      {
        studentId: student._id,
        rollNo: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        pa1: marksInput.pa1 !== undefined ? marksInput.pa1 : marksInput.PA1,
        pa2: marksInput.pa2 !== undefined ? marksInput.pa2 : marksInput.PA2,
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
