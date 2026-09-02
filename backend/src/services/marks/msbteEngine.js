/**
 * msbteEngine.js
 *
 * Evaluation and calculation helpers for Progressive Assessment (PA) marks.
 * Implements direct PA / 30 evaluation structure.
 */

const { MARKS } = require('../../config/academic');

const MSBTE_CONFIG = {
  MAX_PA: MARKS?.MAX_PA || 30,       // 30
  MIN_PA: MARKS?.MIN_PA || 0,        // 0
  PASSING_PA: 12,                    // 40% of 30 = 12 minimum passing
  PERFORMANCE_THRESHOLDS: {
    EXCELLENT: 80,                   // >= 80% (>= 24/30)
    GOOD: 65,                        // >= 65% (>= 19.5/30)
    AVERAGE: 50,                     // >= 50% (>= 15/30)
  },
};

/**
 * Validates a single PA mark value.
 * Valid range: 0 to 30. Zero is valid. Missing is null.
 *
 * @param {number|string|null} value
 * @returns {number|null}
 */
function validatePAMark(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (isNaN(n)) throw new Error(`PA mark must be a valid number, got: "${value}"`);
  if (n < MSBTE_CONFIG.MIN_PA || n > MSBTE_CONFIG.MAX_PA) {
    throw new Error(`PA mark must be between ${MSBTE_CONFIG.MIN_PA} and ${MSBTE_CONFIG.MAX_PA} (got ${n})`);
  }
  return Math.round(n * 100) / 100;
}

/**
 * Validates raw marks object.
 */
function validateRawMarks(input) {
  if (!input) throw new Error('Marks input required');
  const val = input.PA !== undefined ? input.PA : input.calculatedPA;
  validatePAMark(val);
  return true;
}

/**
 * Computes performance status from PA marks out of 30.
 *
 * @param {number|null} pa
 * @returns {'Excellent'|'Good'|'Average'|'Needs Attention'|null}
 */
function getPerformanceStatus(pa) {
  if (pa === null || pa === undefined) return null;
  const pct = (pa / MSBTE_CONFIG.MAX_PA) * 100;
  if (pct >= MSBTE_CONFIG.PERFORMANCE_THRESHOLDS.EXCELLENT) return 'Excellent';
  if (pct >= MSBTE_CONFIG.PERFORMANCE_THRESHOLDS.GOOD) return 'Good';
  if (pct >= MSBTE_CONFIG.PERFORMANCE_THRESHOLDS.AVERAGE) return 'Average';
  return 'Needs Attention';
}

/**
 * Helper to calculate PA score, percentage and status for a single mark.
 */
function calculatePA(value) {
  if (value === null || value === undefined || value === '') {
    return { PA: null, percentage: null, status: null, isMissing: true };
  }
  const pa = validatePAMark(value);
  const percentage = Math.round((pa / MSBTE_CONFIG.MAX_PA) * 1000) / 10;
  const status = getPerformanceStatus(pa);
  return { PA: pa, percentage, status, isMissing: false };
}

/**
 * Calculates derived evaluation fields for a PA mark.
 *
 * @param {object} record  { PA }
 * @returns {object}
 */
function calculateMarks(record) {
  const pa = record.PA !== undefined && record.PA !== null && record.PA !== ''
    ? validatePAMark(record.PA)
    : (record.calculatedPA !== undefined && record.calculatedPA !== null && record.calculatedPA !== ''
        ? validatePAMark(record.calculatedPA)
        : null);

  const isMissing = pa === null;
  const isPassing = pa !== null ? pa >= MSBTE_CONFIG.PASSING_PA : null;
  const performancePercent = pa !== null
    ? Math.round((pa / MSBTE_CONFIG.MAX_PA) * 1000) / 10
    : null;
  const performanceStatus = getPerformanceStatus(pa);

  return {
    rawInputs: { PA: pa },
    calculatedPA: pa,
    PA: pa,
    totalPossible: MSBTE_CONFIG.MAX_PA,
    isPassing,
    performancePercent,
    performanceStatus,
    isMissing,
  };
}

/**
 * Enriches an array of marks records with evaluation metadata.
 */
function enrichMarksRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.map((rec) => {
    const calc = calculateMarks(rec);
    return {
      ...rec,
      ...calc,
      enrollmentNumber: (rec.enrollmentNumber || '').toUpperCase(),
    };
  });
}

/**
 * Generates an aggregated performance summary across all subjects for a student.
 */
function generatePerformanceSummary(marksRecords) {
  const enriched = enrichMarksRecords(marksRecords);

  const subjects = enriched.map((rec) => ({
    subjectCode: rec.subjectCode,
    subjectName: rec.subjectName || rec.subjectCode,
    PA: rec.PA,
    totalPossible: rec.totalPossible || MSBTE_CONFIG.MAX_PA,
    performancePercent: rec.performancePercent,
    performanceStatus: rec.performanceStatus,
    isPassing: rec.isPassing,
    isMissing: rec.isMissing,
  }));

  const withMarks = subjects.filter((s) => s.PA !== null);
  const percentages = withMarks.map((s) => s.performancePercent).filter((p) => p !== null);
  const paValues = withMarks.map((s) => s.PA).filter((p) => p !== null);

  const averagePercent = percentages.length > 0
    ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100
    : null;

  const averagePA = paValues.length > 0
    ? Math.round((paValues.reduce((a, b) => a + b, 0) / paValues.length) * 100) / 100
    : null;

  const strongestSubject = withMarks.reduce((best, s) => {
    if (!best || (s.PA || 0) > (best.PA || 0)) return s;
    return best;
  }, null);

  const needsAttentionSubjects = subjects
    .filter((s) => s.performanceStatus === 'Needs Attention')
    .map((s) => s.subjectCode);

  const overallStatus = averagePA !== null
    ? getPerformanceStatus(averagePA)
    : null;

  return {
    subjects,
    overallSummary: {
      totalSubjects: subjects.length,
      subjectsWithMarks: withMarks.length,
      averagePercent,
      averagePA,
      strongestSubject: strongestSubject
        ? {
            subjectCode: strongestSubject.subjectCode,
            subjectName: strongestSubject.subjectName,
            PA: strongestSubject.PA,
            percent: strongestSubject.performancePercent,
          }
        : null,
      needsAttentionSubjects,
      overallStatus,
    },
  };
}

module.exports = {
  MSBTE_CONFIG,
  validatePAMark,
  validateRawMarks,
  calculatePA,
  calculateMarks,
  getPerformanceStatus,
  enrichMarksRecords,
  generatePerformanceSummary,
};
