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
 * Ensures a named worksheet exists. If it does not, creates it.
 * Writes the header row explicitly at A1, styles it, and freezes row 1.
 *
 * @param {string}   sheetName
 * @param {string[]} headers
 */
async function ensureWorksheet(sheetName, headers) {
  const info = await getSpreadsheetInfo();
  let existing = info.sheets.find(
    (s) => s.properties.title.toLowerCase() === sheetName.toLowerCase()
  );

  let sheetId = existing?.properties?.sheetId;

  if (!existing) {
    // Create the sheet
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID(),
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
  }

  // Always write the header row explicitly at A1
  if (headers && headers.length > 0) {
    await updateRange(`${sheetName}!A1`, [headers]);

    // Format header row (bold, frozen) if sheetId is known
    if (sheetId !== undefined && sheetId !== null) {
      try {
        const sheets = getSheetsClient();
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID(),
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      backgroundColor: { red: 0.93, green: 0.95, blue: 0.98 },
                    },
                  },
                  fields: 'userEnteredFormat(textFormat,backgroundColor)',
                },
              },
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: { frozenRowCount: 1 },
                  },
                  fields: 'gridProperties.frozenRowCount',
                },
              },
            ],
          },
        });
      } catch (formatErr) {
        // Non-critical formatting error
      }
    }
  }
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

// ─── Subject-Wise Category Helpers ────────────────────────────────────────────

const {
  SUBJECT_CATEGORIES,
  VALID_SUBJECTS,
  SUBJECT_SHEETS,
  ATTENDANCE_SUBJECTS,
  PRACTICAL_BATCHES,
  BATCH_DEFINITIONS,
  getBatchForRoll,
  validateBatchRoll,
  isValidAttendanceSubject,
  getAttendanceWorksheetName,
  ATTENDANCE_LECTURE_WORKSHEETS,
  ATTENDANCE_PRACTICAL_WORKSHEETS,
  ALL_ATTENDANCE_WORKSHEETS,
  LEGACY_ATTENDANCE_WORKSHEETS,
  SUBJECT_ATTENDANCE_HEADERS,
  SUBJECT_MARKS_HEADERS,
  formatAttendanceDate,
  parseAttendanceDate,
  ATTENDANCE_CELL_VALUES,
  normalizeSubjectCode,
  isValidSubject,
  getSubjectWorksheetName,
} = require('./spreadsheetConfig');

function colIndexToLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Renames a worksheet in the spreadsheet if it exists.
 *
 * @param {string} oldTitle
 * @param {string} newTitle
 * @returns {Promise<boolean>} true if renamed, false if old sheet not found
 */
async function renameWorksheet(oldTitle, newTitle) {
  const info = await getSpreadsheetInfo();
  const sheet = info.sheets.find(
    (s) => s.properties.title.toLowerCase() === oldTitle.toLowerCase()
  );
  if (!sheet) return false;

  const sheetId = sheet.properties.sheetId;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID(),
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, title: newTitle },
            fields: 'title',
          },
        },
      ],
    },
  });
  return true;
}

/**
 * Resolves worksheet name for a category + subject.
 * Validates against allowed subjects and categories.
 */
function getSubjectWorksheet(category, subjectCode) {
  return getSubjectWorksheetName(category, subjectCode);
}

/**
 * Ensures an attendance worksheet (ATT_<SUBJECT>) exists with header row and roster.
 */
async function ensureAttendanceWorksheet(subjectCode, students = []) {
  const sheetName = getSubjectWorksheetName('ATT', subjectCode);
  await ensureWorksheet(sheetName, SUBJECT_ATTENDANCE_HEADERS);
  if (students && students.length > 0) {
    await syncStudentRoster(subjectCode, 'ATT', students);
  }
  return sheetName;
}

/**
 * Ensures a marks worksheet (MARK_<SUBJECT>) exists with header row and roster.
 */
async function ensureMarksWorksheet(subjectCode, students = []) {
  const sheetName = getSubjectWorksheetName('MARK', subjectCode);
  await ensureWorksheet(sheetName, SUBJECT_MARKS_HEADERS);
  if (students && students.length > 0) {
    await syncStudentRoster(subjectCode, 'MARK', students);
  }
  return sheetName;
}

// Backward compatibility alias
async function ensureSubjectWorksheet(subjectCode, students = []) {
  return ensureAttendanceWorksheet(subjectCode, students);
}

/**
 * Synchronizes the student roster (Roll No. and Name in columns A:B) for a subject worksheet.
 * Preserves all other columns (attendance dates or PA marks).
 * Updates names if changed, appends new students without duplicating Roll Numbers.
 *
 * @param {string} subjectCode
 * @param {'ATT'|'MARK'} category
 * @param {Array<{ rollNumber: string, fullName: string }>} students
 */
async function syncStudentRoster(subjectCode, category = 'ATT', students = []) {
  const sheetName = getSubjectWorksheetName(category, subjectCode);
  const rows = await readRange(`${sheetName}!A:B`);

  if (!rows || rows.length <= 1) {
    const studentRows = students.map((s) => [String(s.rollNumber), String(s.fullName)]);
    if (studentRows.length > 0) {
      await updateRange(`${sheetName}!A2:B${1 + studentRows.length}`, studentRows);
    }
    return;
  }

  // Map existing rows by normalized Roll No.
  const existingRollMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const roll = String(rows[i][0] || '').trim();
    if (roll) {
      const normRoll = roll.replace(/^0+/, '') || roll;
      existingRollMap.set(normRoll, {
        sheetRow: i + 1,
        roll,
        name: rows[i][1] || '',
      });
    }
  }

  const updates = [];
  const toAppend = [];

  for (const s of students) {
    const studentRoll = String(s.rollNumber || '').trim();
    if (!studentRoll) continue;
    const normRoll = studentRoll.replace(/^0+/, '') || studentRoll;
    const existing = existingRollMap.get(normRoll);

    if (existing) {
      if (s.fullName && existing.name !== s.fullName) {
        updates.push({
          range: `${sheetName}!B${existing.sheetRow}`,
          values: [[s.fullName]],
        });
      }
    } else {
      toAppend.push([studentRoll, s.fullName || '']);
    }
  }

  for (const u of updates) {
    await updateRange(u.range, u.values);
  }

  if (toAppend.length > 0) {
    const startRow = rows.length + 1;
    await updateRange(`${sheetName}!A${startRow}:B${startRow + toAppend.length - 1}`, toAppend);
  }
}

async function syncSubjectAttendance(subjectCode, students = []) {
  return syncStudentRoster(subjectCode, 'ATT', students);
}

async function syncSubjectMarks(subjectCode, students = []) {
  return syncStudentRoster(subjectCode, 'MARK', students);
}

// Backward compatibility alias
async function syncSubjectStudentRoster(subjectCode, students = []) {
  return syncSubjectAttendance(subjectCode, students);
}

/**
 * Generic: Finds or creates a date column in row 1 of any attendance worksheet.
 * Stores the sessionId in the cell note for reliable session mapping.
 *
 * @param {string} sheetName
 * @param {string} sessionId
 * @param {string} dateStr
 */
async function ensureDateColumnForWorksheet(sheetName, sessionId, dateStr) {
  const formattedDate = formatAttendanceDate(dateStr);

  const row1 = await readRange(`${sheetName}!1:1`);
  const headers = row1 && row1.length > 0 ? row1[0] : ['Roll No.', 'Name'];

  let matchedColIndex = -1;

  // Check cell notes for exact sessionId match
  try {
    const sheets = getSheetsClient();
    const metaRes = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID(),
      ranges: [`${sheetName}!1:1`],
      fields: 'sheets.properties.sheetId,sheets.data.rowData.values(formattedValue,note)',
    });
    const sheetData = metaRes.data.sheets?.[0];
    const sheetId = sheetData?.properties?.sheetId;
    const cellValues = sheetData?.data?.[0]?.rowData?.[0]?.values || [];

    for (let c = 2; c < cellValues.length; c++) {
      const cell = cellValues[c];
      const cellNote = cell?.note?.trim();
      const cellText = cell?.formattedValue?.trim();

      if (sessionId && cellNote && cellNote.toLowerCase() === sessionId.trim().toLowerCase()) {
        matchedColIndex = c;
        break;
      }
      if (!cellNote && cellText === formattedDate) {
        matchedColIndex = c;
        break;
      }
    }

    if (matchedColIndex >= 0) {
      return {
        colIndex: matchedColIndex,
        colLetter: colIndexToLetter(matchedColIndex),
        isNew: false,
        formattedDate,
        sheetId,
      };
    }
  } catch (err) {
    for (let c = 2; c < headers.length; c++) {
      if (headers[c] === formattedDate) {
        matchedColIndex = c;
        break;
      }
    }
    if (matchedColIndex >= 0) {
      return {
        colIndex: matchedColIndex,
        colLetter: colIndexToLetter(matchedColIndex),
        isNew: false,
        formattedDate,
      };
    }
  }

  // Create new column
  const newColIndex = Math.max(headers.length, 2);
  const colLetter = colIndexToLetter(newColIndex);

  await updateRange(`${sheetName}!${colLetter}1`, [[formattedDate]]);

  try {
    const info = await getSpreadsheetInfo();
    const targetSheet = info.sheets.find(
      (s) => s.properties.title.toUpperCase() === sheetName.toUpperCase()
    );
    const sheetId = targetSheet?.properties?.sheetId;

    if (sheetId !== undefined && sheetId !== null) {
      const sheets = getSheetsClient();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID(),
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: newColIndex,
                  endColumnIndex: newColIndex + 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.93, green: 0.95, blue: 0.98 },
                    horizontalAlignment: 'CENTER',
                  },
                  note: sessionId || '',
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment),note',
              },
            },
          ],
        },
      });
    }
  } catch (fmtErr) {
    // Non-critical formatting error
  }

  return {
    colIndex: newColIndex,
    colLetter,
    isNew: true,
    formattedDate,
  };
}

/**
 * Generic: Updates attendance for a single session in a specified worksheet in one batch operation.
 * Guaranteed zero cross-contamination.
 *
 * @param {string} sheetName
 * @param {string} sessionId
 * @param {string} dateStr
 * @param {Array<{ rollNumber: string|number, status: string }>} studentAttendanceList
 */
async function updateWorksheetAttendance(sheetName, sessionId, dateStr, studentAttendanceList) {
  // 1. Ensure date column exists in the target worksheet
  const { colLetter } = await ensureDateColumnForWorksheet(sheetName, sessionId, dateStr);

  // 2. Read all student roll numbers in this worksheet (Column A)
  const rollRows = await readRange(`${sheetName}!A2:A`);
  if (!rollRows || rollRows.length === 0) return { updatedCount: 0 };

  // 3. Build status map by normalized roll number
  const statusMap = new Map();
  for (const item of studentAttendanceList) {
    const roll = String(item.rollNumber || '').trim();
    const normRoll = roll.replace(/^0+/, '') || roll;
    const isAbsent = item.status === 'Absent' || item.status === 'A' || item.status === 'ABSENT';
    statusMap.set(normRoll, isAbsent ? ATTENDANCE_CELL_VALUES.ABSENT : ATTENDANCE_CELL_VALUES.PRESENT);
  }

  // 4. Construct column values for each student row in the worksheet (present-by-default)
  const colValues = [];
  for (let i = 0; i < rollRows.length; i++) {
    const roll = String(rollRows[i][0] || '').trim();
    const normRoll = roll.replace(/^0+/, '') || roll;
    const status = statusMap.has(normRoll) ? statusMap.get(normRoll) : ATTENDANCE_CELL_VALUES.PRESENT;
    colValues.push([status]);
  }

  // 5. Update entire column in one batch request
  const range = `${sheetName}!${colLetter}2:${colLetter}${1 + colValues.length}`;
  await updateRange(range, colValues);

  return {
    sheetName,
    sessionId,
    date: dateStr,
    colLetter,
    updatedCount: colValues.length,
  };
}

/**
 * Generic: Reads all attendance records from any attendance worksheet.
 * Converts matrix rows into normalized attendance records:
 * { date, sessionId, rollNumber, studentName, status }
 *
 * @param {string} sheetName
 * @returns {Promise<Array<object>>}
 */
async function readWorksheetAttendanceMatrix(sheetName) {
  let rows = null;
  try {
    rows = await readRange(`${sheetName}!A:ZZ`);
  } catch (err) {
    return [];
  }

  if (!rows || rows.length <= 1) return [];

  const headers = rows[0];
  if (headers.length < 3) return [];

  // Fetch cell notes for sessionId mapping
  const notes = [];
  try {
    const sheets = getSheetsClient();
    const metaRes = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID(),
      ranges: [`${sheetName}!1:1`],
      fields: 'sheets.data.rowData.values(note)',
    });
    const cells = metaRes.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values || [];
    for (let c = 0; c < cells.length; c++) {
      notes[c] = cells[c]?.note?.trim() || null;
    }
  } catch (err) {
    // Non-critical fallback
  }

  const records = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rollNumber = String(row[0] || '').trim();
    const studentName = String(row[1] || '').trim();
    if (!rollNumber) continue;

    for (let c = 2; c < headers.length; c++) {
      const headerText = headers[c];
      if (!headerText) continue;

      const cellVal = String(row[c] || '').trim().toUpperCase();
      if (!cellVal && cellVal !== 'P' && cellVal !== 'A') continue;

      const isAbsent = cellVal === 'A' || cellVal === 'ABSENT';
      const status = isAbsent ? 'Absent' : 'Present';
      const parsedDate = parseAttendanceDate(headerText);
      const sessionId = notes[c] || `${parsedDate.replace(/-/g, '')}-${sheetName}`;

      records.push({
        date: parsedDate,
        sessionId,
        rollNumber,
        studentName,
        status,
        sheetName,
      });
    }
  }

  return records;
}

/**
 * Ensures an attendance worksheet for the Redesigned Architecture exists.
 * - Lecture: ATT-LEC-<SUB>
 * - Practical: ATT-PR-<SUB>-<BATCH>
 *
 * @param {'LECTURE'|'PRACTICAL'} attendanceType
 * @param {string} subjectCode
 * @param {'A'|'B'|'C'|null} batch
 * @param {Array<{ rollNumber: string|number, fullName: string }>} students
 */
async function ensureRedesignedAttendanceWorksheet(attendanceType, subjectCode, batch = null, students = []) {
  const sheetName = getAttendanceWorksheetName(attendanceType, subjectCode, batch);
  await ensureWorksheet(sheetName, SUBJECT_ATTENDANCE_HEADERS);

  if (students && students.length > 0) {
    const existing = await readRange(`${sheetName}!A:B`);
    if (!existing || existing.length <= 1) {
      const studentRows = students.map((s) => [Number(s.rollNumber) || s.rollNumber, String(s.fullName || '')]);
      await updateRange(`${sheetName}!A2:B${1 + studentRows.length}`, studentRows);
    }
  }
  return sheetName;
}

/**
 * Updates attendance for a specific session (Lecture or Practical Batch)
 * in its dedicated worksheet.
 *
 * @param {'LECTURE'|'PRACTICAL'} attendanceType
 * @param {string} subjectCode
 * @param {'A'|'B'|'C'|null} batch
 * @param {string} sessionId
 * @param {string} dateStr
 * @param {Array<{ rollNumber: string|number, status: string }>} studentAttendanceList
 */
async function updateAttendanceSession(attendanceType, subjectCode, batch, sessionId, dateStr, studentAttendanceList) {
  const sheetName = getAttendanceWorksheetName(attendanceType, subjectCode, batch);
  return updateWorksheetAttendance(sheetName, sessionId, dateStr, studentAttendanceList);
}

/**
 * Reads attendance matrix from a specific session worksheet (Lecture or Practical Batch).
 *
 * @param {'LECTURE'|'PRACTICAL'} attendanceType
 * @param {string} subjectCode
 * @param {'A'|'B'|'C'|null} batch
 */
async function readAttendanceSession(attendanceType, subjectCode, batch = null) {
  const sheetName = getAttendanceWorksheetName(attendanceType, subjectCode, batch);
  return readWorksheetAttendanceMatrix(sheetName);
}

/**
 * Backward compatibility: Finds or creates a lecture date column in ATT_<SUBJECT>.
 */
async function ensureAttendanceDateColumn(subjectCode, lectureId, dateStr) {
  const sheetName = getSubjectWorksheetName('ATT', subjectCode);
  return ensureDateColumnForWorksheet(sheetName, lectureId, dateStr);
}

/**
 * Backward compatibility: Updates attendance for a single lecture session in ATT_<SUBJECT>.
 */
async function updateSubjectAttendance(subjectCode, lectureId, dateStr, studentAttendanceList) {
  const sheetName = getSubjectWorksheetName('ATT', subjectCode);
  return updateWorksheetAttendance(sheetName, lectureId, dateStr, studentAttendanceList);
}

/**
 * Backward compatibility: Reads all attendance records from ATT_<SUBJECT>.
 */
async function readSubjectAttendanceMatrix(subjectCode) {
  const sub = normalizeSubjectCode(subjectCode);
  const sheetName = getSubjectWorksheetName('ATT', sub);
  return readWorksheetAttendanceMatrix(sheetName);
}

/**
 * Reusable helper alias (backward compatibility)
 */
async function getSubjectAttendance(subjectCode) {
  return readSubjectAttendanceMatrix(subjectCode);
}

/**
 * Updates marks for multiple students in MARK_<SUBJECT> in a single batch operation (SAVE ALL).
 * Columns: Col C = PA1, Col D = PA2, Col E = Average
 *
 * @param {string} subjectCode
 * @param {Array<{ rollNumber: string, pa1?: number|null, pa2?: number|null, average?: number|null, PA?: number|null }>} marksList
 * @returns {Promise<{ updatedCount: number, subject: string, sheetName: string }>}
 */
async function updateSubjectMarks(subjectCode, marksList) {
  const sub = normalizeSubjectCode(subjectCode);
  const sheetName = getSubjectWorksheetName('MARK', sub);

  // 1. Read existing rows in MARK_<SUBJECT>
  const rows = await readRange(`${sheetName}!A:E`);
  if (!rows || rows.length <= 1) {
    throw new Error(`Worksheet ${sheetName} has no student roster to update marks for`);
  }

  // 2. Map existing students by normalized Roll No.
  const rollToRowMap = new Map();
  for (let i = 1; i < rows.length; i++) {
    const roll = String(rows[i][0] || '').trim();
    if (roll) {
      const normRoll = roll.replace(/^0+/, '') || roll;
      rollToRowMap.set(normRoll, i + 1); // 1-based sheet row
    }
  }

  // 3. Prepare updates
  const rangeUpdates = [];
  let updatedCount = 0;

  for (const item of marksList) {
    const roll = String(item.rollNumber || item.rollNo || '').trim();
    if (!roll) continue;
    const normRoll = roll.replace(/^0+/, '') || roll;
    const sheetRow = rollToRowMap.get(normRoll);

    if (sheetRow) {
      const raw1 = item.pa1 !== undefined ? item.pa1 : (item.PA1 !== undefined ? item.PA1 : null);
      const raw2 = item.pa2 !== undefined ? item.pa2 : (item.PA2 !== undefined ? item.PA2 : null);

      let val1 = '';
      let n1 = null;
      if (raw1 !== null && raw1 !== undefined && raw1 !== '') {
        n1 = Number(raw1);
        if (isNaN(n1) || n1 < 0 || n1 > 30) {
          throw new Error(`Invalid PA1 mark: "${raw1}" for Roll No. ${roll}. Must be 0–30.`);
        }
        val1 = n1;
      }

      let val2 = '';
      let n2 = null;
      if (raw2 !== null && raw2 !== undefined && raw2 !== '') {
        n2 = Number(raw2);
        if (isNaN(n2) || n2 < 0 || n2 > 30) {
          throw new Error(`Invalid PA2 mark: "${raw2}" for Roll No. ${roll}. Must be 0–30.`);
        }
        val2 = n2;
      }

      let valAvg = '';
      if (n1 !== null && n2 !== null) {
        valAvg = Math.round(((n1 + n2) / 2) * 100) / 100;
      }

      rangeUpdates.push({
        range: `${sheetName}!C${sheetRow}:E${sheetRow}`,
        values: [[val1, val2, valAvg]],
      });
      updatedCount++;
    }
  }

  // 4. Execute batch update in a single API call
  if (rangeUpdates.length > 0) {
    await batchUpdate(rangeUpdates);
  }

  return {
    subject: sub,
    sheetName,
    updatedCount,
  };
}

/**
 * Reads all marks records from MARK_<SUBJECT>.
 * Returns array of:
 * { rollNumber, fullName, pa1, pa2, average, PA, subjectCode }
 *
 * @param {string} subjectCode
 * @returns {Promise<Array<object>>}
 */
async function readSubjectMarksMatrix(subjectCode) {
  const sub = normalizeSubjectCode(subjectCode);
  const sheetName = getSubjectWorksheetName('MARK', sub);

  let rows = null;
  try {
    rows = await readRange(`${sheetName}!A:E`);
  } catch (err) {
    return [];
  }

  if (!rows || rows.length <= 1) return [];

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rollNumber = String(row[0] || '').trim();
    const fullName = String(row[1] || '').trim();
    if (!rollNumber) continue;

    let pa1 = null;
    let pa2 = null;
    let average = null;

    const raw1 = row[2];
    if (raw1 !== undefined && raw1 !== null && String(raw1).trim() !== '') {
      const num = Number(raw1);
      if (!isNaN(num)) pa1 = num;
    }

    const raw2 = row[3];
    if (raw2 !== undefined && raw2 !== null && String(raw2).trim() !== '') {
      const num = Number(raw2);
      if (!isNaN(num)) pa2 = num;
    }

    const rawAvg = row[4];
    if (rawAvg !== undefined && rawAvg !== null && String(rawAvg).trim() !== '') {
      const num = Number(rawAvg);
      if (!isNaN(num)) average = num;
    } else if (pa1 !== null && pa2 !== null) {
      average = Math.round(((pa1 + pa2) / 2) * 100) / 100;
    }

    records.push({
      rollNumber,
      fullName,
      subjectCode: sub,
      pa1,
      pa2,
      average,
      PA: average ?? pa1, // Marksheet facing PA mark is the average
    });
  }

  return records;
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
  renameWorksheet,
  verifyConnection,
  // Subject & Category methods
  normalizeSubjectCode,
  isValidSubject,
  colIndexToLetter,
  getSubjectWorksheet,
  ensureAttendanceWorksheet,
  ensureMarksWorksheet,
  ensureSubjectWorksheet,
  syncStudentRoster,
  syncSubjectAttendance,
  syncSubjectMarks,
  syncSubjectStudentRoster,
  ensureAttendanceDateColumn,
  updateSubjectAttendance,
  readSubjectAttendanceMatrix,
  getSubjectAttendance,
  updateSubjectMarks,
  readSubjectMarksMatrix,
  // Redesigned Attendance Methods
  ensureDateColumnForWorksheet,
  updateWorksheetAttendance,
  readWorksheetAttendanceMatrix,
  ensureRedesignedAttendanceWorksheet,
  updateAttendanceSession,
  readAttendanceSession,
};

