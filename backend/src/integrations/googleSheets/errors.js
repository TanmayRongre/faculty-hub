/**
 * errors.js
 *
 * Application-level error types for the Google Sheets integration.
 * All Google API errors are translated here before bubbling up to controllers.
 * Raw Google API error messages and credential details are never passed through.
 */

class GoogleSheetsError extends Error {
  constructor(message, code = 'SHEETS_ERROR', originalCode = null) {
    super(message);
    this.name = 'GoogleSheetsError';
    this.code = code;
    this.originalCode = originalCode;
    this.isOperational = true;
  }
}

class SheetsAuthError extends GoogleSheetsError {
  constructor(message = 'Google Sheets authentication failed. Check service account credentials.') {
    super(message, 'SHEETS_AUTH_ERROR', 401);
  }
}

class SpreadsheetNotFoundError extends GoogleSheetsError {
  constructor(spreadsheetId) {
    super(
      `Spreadsheet not found or inaccessible. Ensure the service account has access.`,
      'SPREADSHEET_NOT_FOUND',
      404
    );
    this.spreadsheetId = spreadsheetId;
  }
}

class WorksheetNotFoundError extends GoogleSheetsError {
  constructor(sheetName) {
    super(`Worksheet "${sheetName}" was not found in the spreadsheet.`, 'WORKSHEET_NOT_FOUND', 404);
    this.sheetName = sheetName;
  }
}

class RateLimitError extends GoogleSheetsError {
  constructor() {
    super('Google Sheets API rate limit reached. Please retry shortly.', 'RATE_LIMIT', 429);
  }
}

class StudentNotFoundInSheetError extends GoogleSheetsError {
  constructor(enrollmentNumber) {
    super(
      `Student with enrollment number "${enrollmentNumber}" not found in spreadsheet.`,
      'STUDENT_NOT_IN_SHEET',
      404
    );
    this.enrollmentNumber = enrollmentNumber;
  }
}

class DuplicateSheetRowError extends GoogleSheetsError {
  constructor(enrollmentNumber) {
    super(
      `Duplicate entries found for enrollment number "${enrollmentNumber}" in spreadsheet.`,
      'DUPLICATE_SHEET_ROW',
      409
    );
    this.enrollmentNumber = enrollmentNumber;
  }
}

class InvalidSheetDataError extends GoogleSheetsError {
  constructor(message) {
    super(message, 'INVALID_SHEET_DATA', 422);
  }
}

class SheetsNetworkError extends GoogleSheetsError {
  constructor() {
    super('Network error communicating with Google Sheets. Please retry.', 'SHEETS_NETWORK_ERROR', 503);
  }
}

class SheetsPermissionError extends GoogleSheetsError {
  constructor() {
    super(
      'Permission denied accessing the spreadsheet. Grant the service account read/write access.',
      'SHEETS_PERMISSION_ERROR',
      403
    );
  }
}

/**
 * Translates raw googleapis errors into typed application errors.
 * Never propagates credentials or raw Google messages upward.
 */
function translateGoogleError(err) {
  if (!err) return new GoogleSheetsError('Unknown Google Sheets error');

  const code = err.code || (err.response && err.response.status);
  const status = parseInt(code, 10);

  if (status === 401 || (err.message && err.message.toLowerCase().includes('invalid_grant'))) {
    return new SheetsAuthError();
  }
  if (status === 403) {
    const msg = (err.message || '') + ' ' + (err.cause?.message || '');
    if (msg.toLowerCase().includes('rate')) return new RateLimitError();
    if (msg.includes('has not been used') || msg.includes('disabled')) {
      return new GoogleSheetsError(
        'Google Sheets API is not enabled in your Google Cloud project. Enable the Google Sheets API in Google Cloud Console.',
        'SHEETS_API_DISABLED',
        403
      );
    }
    return new SheetsPermissionError();
  }
  if (status === 404) {
    return new SpreadsheetNotFoundError('(configured)');
  }
  if (status === 429) {
    return new RateLimitError();
  }
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
    return new SheetsNetworkError();
  }

  return new GoogleSheetsError(
    'An error occurred communicating with Google Sheets. Please try again.',
    'SHEETS_ERROR',
    status || 500
  );
}

module.exports = {
  GoogleSheetsError,
  SheetsAuthError,
  SpreadsheetNotFoundError,
  WorksheetNotFoundError,
  RateLimitError,
  StudentNotFoundInSheetError,
  DuplicateSheetRowError,
  InvalidSheetDataError,
  SheetsNetworkError,
  SheetsPermissionError,
  translateGoogleError,
};
