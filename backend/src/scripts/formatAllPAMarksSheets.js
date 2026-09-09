/**
 * formatAllPAMarksSheets.js
 *
 * Enforces the EXACT 5-column table format for ALL PA marks sheets in Google Sheets without exception:
 * | Roll No. | Name | PA1 | PA2 | Avg |
 *
 * Columns:
 * - Col A: Roll No. (Student roll number)
 * - Col B: Name (Student name)
 * - Col C: PA1 (PA1 marks)
 * - Col D: PA2 (PA2 marks)
 * - Col E: Avg (Average of PA1 and PA2)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const { getSheetsClient } = require('../integrations/googleSheets/googleSheetsClient');
const {
  ensureWorksheet,
  clearSheet,
  updateRange,
  readRange,
  getSpreadsheetInfo,
} = require('../integrations/googleSheets/googleSheetsService');
const {
  VALID_SUBJECTS,
  SUBJECT_MARKS_HEADERS,
  getSubjectWorksheetName,
} = require('../integrations/googleSheets/spreadsheetConfig');
const Student = require('../models/Student');
const Marks = require('../models/Marks');

async function formatAllPAMarksSheets() {
  console.log('============================================================');
  console.log('FORMATTING ALL PA MARKS SHEETS TO EXACT SPECIFICATION:');
  console.log('| Roll No. | Name | PA1 | PA2 | Avg |');
  console.log('============================================================\n');

  // 1. Connect to MongoDB
  console.log('1. Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('   MongoDB connected successfully.');

  // 2. Load the 68 active students sorted numerically
  const students = await Student.find({ semester: 5, status: 'active' })
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ rollNumber: 1 })
    .select('_id rollNumber fullName')
    .lean();

  console.log(`   Loaded ${students.length} active students in numerical roll order.`);
  if (students.length === 0) {
    throw new Error('No active students found in MongoDB!');
  }

  // 3. Connect to Google Sheets
  console.log('\n2. Connecting to Google Sheets API...');
  const spreadsheetId = (process.env.GOOGLE_SPREADSHEET_ID || '').trim().replace(/^["']|["']$/g, '');
  console.log(`   Spreadsheet ID: ${spreadsheetId}`);
  const sheetsClient = getSheetsClient();
  const info = await getSpreadsheetInfo();
  console.log(`   Spreadsheet Title: "${info.properties?.title}"`);

  // Target marks sheets
  const markSheetNames = VALID_SUBJECTS.map((sub) => getSubjectWorksheetName('MARK', sub));
  console.log(`   Target Marks Sheets (${markSheetNames.length}):`, markSheetNames);

  // 4. Process each marks worksheet
  for (const sub of VALID_SUBJECTS) {
    const sheetName = getSubjectWorksheetName('MARK', sub);
    console.log(`\n------------------------------------------------------------`);
    console.log(`Formatting worksheet: ${sheetName} (Subject: ${sub})`);
    console.log(`------------------------------------------------------------`);

    // Ensure worksheet exists with the exact headers
    await ensureWorksheet(sheetName, SUBJECT_MARKS_HEADERS);

    // Fetch existing marks for this subject from MongoDB
    const marksList = await Marks.find({ subjectCode: sub }).lean();
    const marksMap = new Map();
    for (const m of marksList) {
      if (m.rollNo) marksMap.set(String(m.rollNo).trim(), m);
      if (m.studentId) marksMap.set(String(m.studentId), m);
    }

    // Build exact 5-column rows
    const rows = [
      SUBJECT_MARKS_HEADERS, // ['Roll No.', 'Name', 'PA1', 'PA2', 'Avg']
    ];

    for (const s of students) {
      const roll = String(s.rollNumber).trim();
      const existing = marksMap.get(roll) || marksMap.get(String(s._id));

      let pa1Str = '';
      let pa2Str = '';
      let avgStr = '';

      if (existing) {
        if (existing.pa1 !== null && existing.pa1 !== undefined && existing.pa1 !== '') {
          pa1Str = Number(existing.pa1);
        }
        if (existing.pa2 !== null && existing.pa2 !== undefined && existing.pa2 !== '') {
          pa2Str = Number(existing.pa2);
        }
        if (existing.average !== null && existing.average !== undefined && existing.average !== '') {
          avgStr = Number(existing.average);
        } else if (pa1Str !== '' && pa2Str !== '') {
          avgStr = Math.round(((Number(pa1Str) + Number(pa2Str)) / 2) * 100) / 100;
        }
      }

      rows.push([
        Number(s.rollNumber) || s.rollNumber,
        s.fullName,
        pa1Str,
        pa2Str,
        avgStr,
      ]);
    }

    // Clear entire sheet to eliminate any stale data or extra columns
    await clearSheet(sheetName);

    // Write all rows starting at A1:E{rows.length}
    await updateRange(`${sheetName}!A1:E${rows.length}`, rows);
    console.log(`   Updated ${sheetName}!A1:E${rows.length} with ${rows.length - 1} student rows.`);

    // Apply clean styling via batchUpdate:
    // Header bold, frozen row 1, column alignments
    const currentInfo = await getSpreadsheetInfo();
    const sheetObj = currentInfo.sheets.find(
      (s) => s.properties.title.toLowerCase() === sheetName.toLowerCase()
    );

    if (sheetObj) {
      const sheetId = sheetObj.properties.sheetId;
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            // 1. Freeze first row
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            // 2. Style Header Row (bold, light background, centered)
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 5,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.93, green: 0.95, blue: 0.98 },
                    textFormat: { bold: true, fontSize: 10 },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
            // 3. Align Name column (Col B / Col Index 1) Left in Header
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 1,
                  endColumnIndex: 2,
                },
                cell: {
                  userEnteredFormat: {
                    horizontalAlignment: 'LEFT',
                  },
                },
                fields: 'userEnteredFormat.horizontalAlignment',
              },
            },
            // 4. Align Student Data rows:
            // Col A (Roll No.): Center
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: rows.length,
                  startColumnIndex: 0,
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat.horizontalAlignment',
              },
            },
            // Col B (Name): Left
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: rows.length,
                  startColumnIndex: 1,
                  endColumnIndex: 2,
                },
                cell: {
                  userEnteredFormat: {
                    horizontalAlignment: 'LEFT',
                  },
                },
                fields: 'userEnteredFormat.horizontalAlignment',
              },
            },
            // Col C (PA1): Right
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: rows.length,
                  startColumnIndex: 2,
                  endColumnIndex: 3,
                },
                cell: {
                  userEnteredFormat: {
                    horizontalAlignment: 'RIGHT',
                  },
                },
                fields: 'userEnteredFormat.horizontalAlignment',
              },
            },
            // Col D (PA2): Right
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: rows.length,
                  startColumnIndex: 3,
                  endColumnIndex: 4,
                },
                cell: {
                  userEnteredFormat: {
                    horizontalAlignment: 'RIGHT',
                  },
                },
                fields: 'userEnteredFormat.horizontalAlignment',
              },
            },
            // Col E (Avg): Right
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: rows.length,
                  startColumnIndex: 4,
                  endColumnIndex: 5,
                },
                cell: {
                  userEnteredFormat: {
                    horizontalAlignment: 'RIGHT',
                  },
                },
                fields: 'userEnteredFormat.horizontalAlignment',
              },
            },
            // Set clean column widths
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 1,
                },
                properties: { pixelSize: 90 },
                fields: 'pixelSize',
              },
            },
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 1,
                  endIndex: 2,
                },
                properties: { pixelSize: 280 },
                fields: 'pixelSize',
              },
            },
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 2,
                  endIndex: 5,
                },
                properties: { pixelSize: 90 },
                fields: 'pixelSize',
              },
            },
          ],
        },
      });
      console.log(`   Applied formatting to ${sheetName} (frozen row, alignments, column widths).`);
    }
  }

  // 5. Verification: Read back and print summary
  console.log('\n============================================================');
  console.log('VERIFICATION: READING BACK ALL PA MARKS SHEETS');
  console.log('============================================================');

  for (const sub of VALID_SUBJECTS) {
    const sheetName = getSubjectWorksheetName('MARK', sub);
    const readBack = await readRange(`${sheetName}!A1:E6`);
    console.log(`\nSheet: ${sheetName}`);
    console.log('Headers (Row 1):', readBack[0]);
    console.log('First 5 Student Rows:');
    for (let r = 1; r < readBack.length; r++) {
      console.log(`  Row ${r + 1}: ${JSON.stringify(readBack[r])}`);
    }

    // Strict validation
    const headerValid =
      readBack[0][0] === 'Roll No.' &&
      readBack[0][1] === 'Name' &&
      readBack[0][2] === 'PA1' &&
      readBack[0][3] === 'PA2' &&
      readBack[0][4] === 'Avg';

    if (!headerValid) {
      throw new Error(`Worksheet ${sheetName} header verification failed! Got: ${JSON.stringify(readBack[0])}`);
    }
  }

  console.log('\n✅ ALL PA MARKS SHEETS SUCCESSFULLY FORMATTED TO:');
  console.log('| Roll No. | Name | PA1 | PA2 | Avg |');
  await mongoose.disconnect();
}

if (require.main === module) {
  formatAllPAMarksSheets()
    .then(() => {
      console.log('\nDone.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Error formatting PA marks sheets:', err);
      process.exit(1);
    });
}

module.exports = formatAllPAMarksSheets;
