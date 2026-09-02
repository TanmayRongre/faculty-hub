/**
 * googleSheetsService.js
 *
 * Core reusable operations for reading and writing Google Sheets data.
 * All spreadsheet I/O flows through this service — never directly from controllers.
 *
 * Uses the authenticated client from googleSheetsClient.js.
 * Translates all Google API errors into typed application errors.
 */

const { getSheetsClient } = require('./googleSheetsClient');
const { translateGoogleError, WorksheetNotFoundError, GoogleSheetsError } = require('./errors');

const SPREADSHEET_ID = () => {
  const id = process.env.GOOGLE_SPREADSHEET_ID?.trim().replace(/^["']|["']$/g, '');
  if (!id) throw new Error('GOOGLE_SPREADSHEET_ID is not set in environment variables');
  return id;
};

/**
 * Reads a range from the spreadsheet.
 *
 * @param {string} range  e.g. "Students!A:I" or "Marks!A2:K100"
 * @returns {string[][]|null}  array of rows, or null if range is empty
 */
async function readRange(range) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
    return response.data.values || null;
  } catch (err) {
    if (err instanceof GoogleSheetsError) throw err; // already translated
    throw translateGoogleError(err);
  }
}

/**
 * Appends rows to the end of a named sheet.
 *
 * @param {string} sheetName   e.g. "Students"
 * @param {string[][]} rows    array of row arrays
 * @returns {object}  API response data
 */
async function appendRows(sheetName, rows) {
  if (!rows || rows.length === 0) return null;
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });
    return response.data;
  } catch (err) {
    if (err instanceof GoogleSheetsError) throw err; // already translated
    throw translateGoogleError(err);
  }
}

/**
 * Overwrites a specific range with new values.
 *
 * @param {string} range   e.g. "Marks!A5:K5"
 * @param {string[][]} values
 * @returns {object}  API response data
 */
async function updateRange(range, values) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
    return response.data;
  } catch (err) {
    if (err instanceof GoogleSheetsError) throw err; // already translated
    throw translateGoogleError(err);
  }
}

/**
 * Finds the first row matching a value in a given column (0-indexed).
 * Returns { rowIndex (1-based in sheet), rowData } or null if not found.
 *
 * @param {string[][]} rows       all rows to search (including header row)
 * @param {number}     colIndex   0-based column index
 * @param {string}     value      value to match (case-insensitive for strings)
 * @param {number}     skipRows   header rows to skip (default 1)
 */
function findRow(rows, colIndex, value, skipRows = 1) {
  if (!rows) return null;
  const needle = String(value).trim().toLowerCase();

  for (let i = skipRows; i < rows.length; i++) {
    const cell = String(rows[i][colIndex] || '').trim().toLowerCase();
    if (cell === needle) {
      return { rowIndex: i + 1, sheetRow: i + 1, rowData: rows[i] }; // 1-based sheet row
    }
  }
  return null;
}

/**
 * Finds all rows matching a value in a given column (0-indexed).
 *
 * @param {string[][]} rows
 * @param {number}     colIndex
 * @param {string}     value
 * @param {number}     skipRows
 * @returns {{ rowIndex: number, rowData: string[] }[]}
 */
function findRows(rows, colIndex, value, skipRows = 1) {
  if (!rows) return [];
  const needle = String(value).trim().toLowerCase();
  const results = [];

  for (let i = skipRows; i < rows.length; i++) {
    const cell = String(rows[i][colIndex] || '').trim().toLowerCase();
    if (cell === needle) {
      results.push({ rowIndex: i + 1, sheetRow: i + 1, rowData: rows[i] });
    }
  }
  return results;
}

/**
 * Performs a batch update of multiple ranges in a single API call.
 *
 * @param {{ range: string, values: string[][] }[]} updates
 * @returns {object}  API response data
 */
async function batchUpdate(updates) {
  if (!updates || updates.length === 0) return null;
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID(),
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map(({ range, values }) => ({ range, values })),
      },
    });
    return response.data;
  } catch (err) {
    if (err instanceof GoogleSheetsError) throw err; // already translated
    throw translateGoogleError(err);
  }
}

/**
 * Gets spreadsheet metadata (title, list of sheets, etc.).
 * Used for connection verification.
 *
 * @returns {object}
 */
async function getSpreadsheetInfo() {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID(),
      fields: 'spreadsheetId,properties.title,sheets.properties',
    });
    return response.data;
  } catch (err) {
    if (err instanceof GoogleSheetsError) throw err; // already translated
    throw translateGoogleError(err);
  }
}

/**
 * Ensures a named worksheet exists. If it does not, creates it with the given headers.
 *
 * @param {string}   sheetName
 * @param {string[]} headers
 */
async function ensureWorksheet(sheetName, headers) {
  const info = await getSpreadsheetInfo();
  const existing = info.sheets.find(
    (s) => s.properties.title.toLowerCase() === sheetName.toLowerCase()
  );

  if (existing) return; // already present

  // Create the sheet
  const sheets = getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID(),
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  });

  // Write the header row
  await appendRows(sheetName, [headers]);
}

/**
 * Verifies the spreadsheet is accessible and that required sheets exist.
 *
 * @param {string[]} requiredSheets
 * @returns {{ connected: boolean, title: string, existingSheets: string[], missingSheets: string[] }}
 */
async function verifyConnection(requiredSheets = []) {
  const info = await getSpreadsheetInfo();
  const existingSheets = info.sheets.map((s) => s.properties.title);
  const missingSheets = requiredSheets.filter(
    (name) => !existingSheets.some((s) => s.toLowerCase() === name.toLowerCase())
  );
  return {
    connected: true,
    title: info.properties.title,
    existingSheets,
    missingSheets,
  };
}

/**
 * Clears values from a specific range.
 *
 * @param {string} range  e.g. "Marks!A2:K"
 * @returns {object}  API response data
 */
async function clearRange(range) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID(),
      range,
    });
    return response.data;
  } catch (err) {
    if (err instanceof GoogleSheetsError) throw err; // already translated
    throw translateGoogleError(err);
  }
}

/**
 * Clears all data from a named sheet (all rows, including header).
 * The sheet itself is preserved — only values are cleared.
 *
 * @param {string} sheetName
 * @returns {object}  API response data
 */
async function clearSheet(sheetName) {
  return clearRange(`${sheetName}!A:Z`);
}

module.exports = {
  readRange,
  appendRows,
  updateRange,
  clearRange,
  clearSheet,
  findRow,
  findRows,
  batchUpdate,
  getSpreadsheetInfo,
  ensureWorksheet,
  verifyConnection,
};
