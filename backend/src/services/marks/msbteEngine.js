/**
 * msbteEngine.js
 *
 * Assessment calculation and evaluation engine for 5th Semester Computer Engineering.
 *
 * Theory Subjects (PA1 + PA2):
 *   - STE: Software Engineering
 *   - OSY: Operating System
 *   - ACN: Advance Computer Network
 *
 * Practical-oriented subjects (SPI, ITR, ENDS) remain separate without theory PA1/PA2 assessments.
 *
 * Rules:
 *   - PA1, PA2 allowed range: 0 to 30.
 *   - 0 is a valid mark (distinct from null / not entered).
 *   - Final PA Average = (PA1 + PA2) / 2.
 *   - If either PA1 or PA2 is null/missing: Average is null (Not Available).
 *   - Decimal values (e.g. 25.5) are preserved.
 */

const THEORY_SUBJECTS = ['STE', 'OSY', 'ACN'];
const PRACTICAL_SUBJECTS = ['SPI', 'ITR', 'ENDS'];

const MSBTE_CONFIG = {
  MAX_PA: 30,
  MIN_PA: 0,
  PASSING_PA: 12, // 40% of 30
  PERFORMANCE_THRESHOLDS: {
    EXCELLENT: 80, // >= 24/30
    GOOD: 65,      // >= 19.5/30
    AVERAGE: 50,   // >= 15/30
  },
};

/**
 * Checks if a subject is a theory subject with PA1 + PA2.
 * @param {string} subjectCode
 * @returns {boolean}
 */
function isTheorySubject(subjectCode) {
  if (!subjectCode) return false;
  return THEORY_SUBJECTS.includes(subjectCode.toUpperCase().trim());
}

/**
 * Validates a single PA mark value (PA1 or PA2).
 * Valid range: 0 to 30. Zero is valid. Missing/empty is null.
 * Throws an Error with status 422 if invalid.
 *
 * @param {number|string|null|undefined} value
 * @param {string} [fieldName='PA mark']
 * @returns {number|null}
 */
function validatePAMark(value, fieldName = 'PA mark') {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  if (isNaN(n)) {
    const err = new Error(`${fieldName} must be a valid number, got: "${value}"`);
    err.statusCode = 422;
    throw err;
  }
  if (n < MSBTE_CONFIG.MIN_PA || n > MSBTE_CONFIG.MAX_PA) {
    const err = new Error(
      `${fieldName} must be between ${MSBTE_CONFIG.MIN_PA} and ${MSBTE_CONFIG.MAX_PA} (got ${n})`
    );
    err.statusCode = 422;
    throw err;
  }
  // Preserve exact value, round at most to 2 decimal places to avoid floating point artifacts
  return Math.round(n * 100) / 100;
}

/**
 * Calculates the authoritative average for PA1 and PA2.
 * Formula: (PA1 + PA2) / 2
 *
 * If either is null/undefined: returns null.
 * If both are 0: returns 0.
 *
 * @param {number|null} pa1
 * @param {number|null} pa2
 * @returns {number|null}
 */
function calculateTheoryAverage(pa1, pa2) {
  if (pa1 === null || pa1 === undefined || pa2 === null || pa2 === undefined) {
    return null;
  }
  const avg = (Number(pa1) + Number(pa2)) / 2;
  return Math.round(avg * 100) / 100;
}

/**
 * Computes performance status from PA average out of 30.
 *
 * @param {number|null} average
 * @returns {'Excellent'|'Good'|'Average'|'Needs Attention'|null}
 */
function getPerformanceStatus(average) {
  if (average === null || average === undefined) return null;
  const pct = (average / MSBTE_CONFIG.MAX_PA) * 100;
  if (pct >= MSBTE_CONFIG.PERFORMANCE_THRESHOLDS.EXCELLENT) return 'Excellent';
  if (pct >= MSBTE_CONFIG.PERFORMANCE_THRESHOLDS.GOOD) return 'Good';
  if (pct >= MSBTE_CONFIG.PERFORMANCE_THRESHOLDS.AVERAGE) return 'Average';
  return 'Needs Attention';
}

/**
 * Calculates evaluation fields for a student marks record.
 *
 * @param {object} record  { pa1, pa2 } or { PA1, PA2 }
 * @returns {object}
 */
function calculateMarks(record) {
  const rawPA1 = record.pa1 !== undefined ? record.pa1 : record.PA1;
  const rawPA2 = record.pa2 !== undefined ? record.pa2 : record.PA2;

  const pa1 = validatePAMark(rawPA1, 'PA1');
  const pa2 = validatePAMark(rawPA2, 'PA2');
  const average = calculateTheoryAverage(pa1, pa2);

  const isComplete = pa1 !== null && pa2 !== null;
  const isPassing = average !== null ? average >= MSBTE_CONFIG.PASSING_PA : null;
  const performancePercent =
    average !== null ? Math.round((average / MSBTE_CONFIG.MAX_PA) * 1000) / 10 : null;
  const performanceStatus = getPerformanceStatus(average);

  return {
    pa1,
    pa2,
    average,
    totalPossible: MSBTE_CONFIG.MAX_PA,
    isComplete,
    isPassing,
    performancePercent,
    performanceStatus,
  };
}

module.exports = {
  THEORY_SUBJECTS,
  PRACTICAL_SUBJECTS,
  MSBTE_CONFIG,
  isTheorySubject,
  validatePAMark,
  calculateTheoryAverage,
  getPerformanceStatus,
  calculateMarks,
};
