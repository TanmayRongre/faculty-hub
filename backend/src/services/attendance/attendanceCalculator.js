/**
 * attendanceCalculator.js
 *
 * Pure attendance calculation functions.
 * Stateless — no I/O, no side effects.
 *
 * Defaulter rule: < 75% (exactly 75% is NOT a defaulter).
 * Threshold is isolated in ATTENDANCE_CONFIG so it is never duplicated.
 *
 * Formula: Attendance % = (Classes Attended / Classes Conducted) * 100
 */

const ATTENDANCE_CONFIG = {
  /** Students strictly below this threshold are defaulters. >= is safe. */
  DEFAULTER_THRESHOLD_PERCENT: 75,
};

/**
 * Calculates whether a percentage is a defaulter.
 * Exactly 75.00 is NOT a defaulter.
 *
 * @param {number} pct
 * @returns {boolean}
 */
function isDefaulter(pct) {
  return pct < ATTENDANCE_CONFIG.DEFAULTER_THRESHOLD_PERCENT;
}

/**
 * Computes subject-wise and overall attendance statistics from raw records.
 *
 * @param {object[]} records  Array of { subjectCode, subjectName?, status } attendance records
 * @param {object} [subjectNameMap]  Optional { [subjectCode]: subjectName }
 * @returns {{
 *   subjects: object[],
 *   overall: { total, present, absent, percentage, isDefaulter }
 * }}
 */
function computeAttendanceStats(records, subjectNameMap = {}) {
  const bySubject = {};

  for (const rec of records) {
    const code = (rec.subjectCode || '').toUpperCase();
    if (!code) continue;

    if (!bySubject[code]) {
      bySubject[code] = {
        subjectCode: code,
        subjectName: subjectNameMap[code] || rec.subjectName || code,
        total: 0,
        present: 0,
        absent: 0,
      };
    }

    bySubject[code].total++;
    if (rec.status === 'Present') {
      bySubject[code].present++;
    } else {
      bySubject[code].absent++;
    }
  }

  const subjects = Object.values(bySubject).map((s) => {
    const pct = s.total > 0
      ? Math.round((s.present / s.total) * 10000) / 100
      : 0;
    return {
      ...s,
      percentage: pct,
      isDefaulter: isDefaulter(pct),
    };
  });

  const totalAll = records.length;
  const presentAll = records.filter((r) => r.status === 'Present').length;
  const absentAll = totalAll - presentAll;
  const overallPct = totalAll > 0
    ? Math.round((presentAll / totalAll) * 10000) / 100
    : 0;

  return {
    subjects,
    overall: {
      total: totalAll,
      present: presentAll,
      absent: absentAll,
      percentage: overallPct,
      isDefaulter: totalAll > 0 ? isDefaulter(overallPct) : false,
    },
  };
}

/**
 * Groups raw attendance records by lectureId.
 * Used to detect already-marked lectures (duplicate prevention).
 *
 * @param {object[]} records
 * @returns {{ [lectureId]: object[] }}
 */
function groupByLecture(records) {
  const groups = {};
  for (const rec of records) {
    const lid = rec.lectureId || '';
    if (!groups[lid]) groups[lid] = [];
    groups[lid].push(rec);
  }
  return groups;
}

/**
 * Builds the attendance record set for a lecture submission.
 * Applies the Present-by-default rule: students not in absentSet are marked Present.
 *
 * @param {object[]} students  Array of { enrollmentNumber, rollNumber, fullName }
 * @param {Set<string>} absentEnrollments  Set of enrollment numbers who are absent
 * @param {object} lectureContext  { lectureId, date, subjectCode, subjectName }
 * @returns {object[]}
 */
function buildAttendanceRecords(students, absentEnrollments, lectureContext) {
  return students.map((s) => ({
    date: lectureContext.date,
    lectureId: lectureContext.lectureId,
    subjectCode: lectureContext.subjectCode,
    subjectName: lectureContext.subjectName || '',
    enrollmentNumber: s.enrollmentNumber,
    rollNumber: s.rollNumber || '',
    status: absentEnrollments.has(s.enrollmentNumber.toUpperCase()) ? 'Absent' : 'Present',
  }));
}

module.exports = {
  ATTENDANCE_CONFIG,
  isDefaulter,
  computeAttendanceStats,
  groupByLecture,
  buildAttendanceRecords,
};
