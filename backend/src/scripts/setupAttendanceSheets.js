/**
 * setupAttendanceSheets.js
 *
 * Creates and populates all 16 worksheets for the Redesigned Attendance Architecture:
 * - 4 Lecture worksheets (68 students each):
 *   ATT-LEC-STE, ATT-LEC-OSY, ATT-LEC-ENDS, ATT-LEC-ACN
 * - 12 Practical worksheets (batch-specific rosters):
 *   Batch A (Roll 1–24, 24 students): ATT-PR-STE-A, ATT-PR-OSY-A, ATT-PR-ENDS-A, ATT-PR-ACN-A
 *   Batch B (Roll 25–47, 23 students): ATT-PR-STE-B, ATT-PR-OSY-B, ATT-PR-ENDS-B, ATT-PR-ACN-B
 *   Batch C (Roll 48–68, 21 students): ATT-PR-STE-C, ATT-PR-OSY-C, ATT-PR-ENDS-C, ATT-PR-ACN-C
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const { getSheetsClient } = require('../integrations/googleSheets/googleSheetsClient');
const {
  ensureWorksheet,
  clearRange,
  updateRange,
  readRange,
  getSpreadsheetInfo,
} = require('../integrations/googleSheets/googleSheetsService');
const {
  ATTENDANCE_SUBJECTS,
  PRACTICAL_BATCHES,
  ATTENDANCE_LECTURE_WORKSHEETS,
  ATTENDANCE_PRACTICAL_WORKSHEETS,
  ALL_ATTENDANCE_WORKSHEETS,
  SUBJECT_ATTENDANCE_HEADERS,
  getAttendanceWorksheetName,
} = require('../integrations/googleSheets/spreadsheetConfig');
const Student = require('../models/Student');

async function setupAttendanceSheets() {
  console.log('============================================================');
  console.log('SETTING UP 16 ATTENDANCE WORKSHEETS IN GOOGLE SHEETS:');
  console.log('4 Lecture Worksheets + 12 Practical Worksheets');
  console.log('============================================================\n');

  // 1. Connect to MongoDB
  console.log('1. Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('   MongoDB connected.');

  // 2. Fetch all 68 active students sorted numerically
  const allStudents = await Student.find({ semester: 5, status: 'active' })
    .collation({ locale: 'en', numericOrdering: true })
    .sort({ rollNumber: 1 })
    .select('rollNumber fullName batch')
    .lean();

  console.log(`   Found ${allStudents.length} active students in MongoDB.`);
  if (allStudents.length !== 68) {
    console.warn(`   WARNING: Expected 68 students, found ${allStudents.length}!`);
  }

  // Segment rosters by batch
  const batchAStudents = allStudents.filter((s) => {
    const r = Number(s.rollNumber);
    return r >= 1 && r <= 24;
  });
  const batchBStudents = allStudents.filter((s) => {
    const r = Number(s.rollNumber);
    return r >= 25 && r <= 47;
  });
  const batchCStudents = allStudents.filter((s) => {
    const r = Number(s.rollNumber);
    return r >= 48 && r <= 68;
  });

  console.log(`   Roster breakdown:`);
  console.log(`   • Full Class (Lecture): ${allStudents.length} students (Roll 1–68)`);
  console.log(`   • Batch A (Practical): ${batchAStudents.length} students (Roll 1–24)`);
  console.log(`   • Batch B (Practical): ${batchBStudents.length} students (Roll 25–47)`);
  console.log(`   • Batch C (Practical): ${batchCStudents.length} students (Roll 48–68)`);

  // 3. Connect to Google Sheets
  console.log('\n2. Accessing Google Sheets...');
  const spreadsheetId = (process.env.GOOGLE_SPREADSHEET_ID || '').trim().replace(/^["']|["']$/g, '');
  const sheetsClient = getSheetsClient();
  const info = await getSpreadsheetInfo();
  console.log(`   Spreadsheet: "${info.properties?.title}" (${spreadsheetId})`);

  // 4. Setup all 16 worksheets
  const worksheetConfigs = [];

  // A. 4 Lecture Worksheets
  for (const sub of ATTENDANCE_SUBJECTS) {
    worksheetConfigs.push({
      sheetName: `ATT-LEC-${sub}`,
      type: 'LECTURE',
      subject: sub,
      batch: null,
      students: allStudents,
      expectedCount: 68,
    });
  }

  // B. 12 Practical Worksheets
  for (const sub of ATTENDANCE_SUBJECTS) {
    worksheetConfigs.push({
      sheetName: `ATT-PR-${sub}-A`,
      type: 'PRACTICAL',
      subject: sub,
      batch: 'A',
      students: batchAStudents,
      expectedCount: 24,
    });
    worksheetConfigs.push({
      sheetName: `ATT-PR-${sub}-B`,
      type: 'PRACTICAL',
      subject: sub,
      batch: 'B',
      students: batchBStudents,
      expectedCount: 23,
    });
    worksheetConfigs.push({
      sheetName: `ATT-PR-${sub}-C`,
      type: 'PRACTICAL',
      subject: sub,
      batch: 'C',
      students: batchCStudents,
      expectedCount: 21,
    });
  }

  console.log(`\n3. Configuring ${worksheetConfigs.length} attendance worksheets...`);

  for (const cfg of worksheetConfigs) {
    const { sheetName, students, expectedCount } = cfg;
    console.log(`\n------------------------------------------------------------`);
    console.log(`Setting up: ${sheetName} (Expected: ${expectedCount} students)`);
    console.log(`------------------------------------------------------------`);

    // Ensure worksheet exists with header row
    await ensureWorksheet(sheetName, SUBJECT_ATTENDANCE_HEADERS);

    // Read existing columns A & B
    const existing = await readRange(`${sheetName}!A:B`);
    const studentRows = students.map((s) => [
      Number(s.rollNumber) || s.rollNumber,
      String(s.fullName || ''),
    ]);

    // Check if roster already populated correctly
    const needsRosterWrite =
      !existing ||
      existing.length <= 1 ||
      existing.length - 1 !== expectedCount ||
      String(existing[1]?.[0]) !== String(studentRows[0][0]);

    if (needsRosterWrite) {
      // Write header row A1:B1
      await updateRange(`${sheetName}!A1:B1`, [SUBJECT_ATTENDANCE_HEADERS]);
      // Write student rows A2:B{1 + studentRows.length}
      await updateRange(`${sheetName}!A2:B${1 + studentRows.length}`, studentRows);
      console.log(`   Populated roster with ${studentRows.length} students.`);
    } else {
      console.log(`   Roster already present (${existing.length - 1} rows).`);
    }

    // Apply clean formatting
    const currentMeta = await getSpreadsheetInfo();
    const sheetObj = currentMeta.sheets.find(
      (s) => s.properties.title.toUpperCase() === sheetName.toUpperCase()
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
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            // 2. Format Header Row
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 2,
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
            // 3. Align Name column Left in Header
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
            // 4. Align Student Data rows: Roll No center, Name left
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1 + studentRows.length,
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
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1 + studentRows.length,
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
            // 5. Column widths
            {
              updateDimensionProperties: {
                range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
                properties: { pixelSize: 90 },
                fields: 'pixelSize',
              },
            },
            {
              updateDimensionProperties: {
                range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
                properties: { pixelSize: 280 },
                fields: 'pixelSize',
              },
            },
          ],
        },
      });
      console.log(`   Applied formatting (frozen header, alignments, widths).`);
    }
  }

  // 5. Verification: Read back all 16 worksheets and report row counts
  console.log('\n============================================================');
  console.log('VERIFICATION: READING BACK ALL 16 ATTENDANCE WORKSHEETS');
  console.log('============================================================');

  let allVerified = true;

  for (const cfg of worksheetConfigs) {
    const { sheetName, expectedCount, students } = cfg;
    const readRows = await readRange(`${sheetName}!A1:B${expectedCount + 5}`);

    if (!readRows || readRows.length < 2) {
      console.error(`❌ ${sheetName}: Empty or failed to read!`);
      allVerified = false;
      continue;
    }

    const header = readRows[0];
    const dataRows = readRows.slice(1);
    const countMatch = dataRows.length === expectedCount;
    const firstRoll = dataRows[0]?.[0];
    const lastRoll = dataRows[dataRows.length - 1]?.[0];

    const expectedFirst = students[0].rollNumber;
    const expectedLast = students[students.length - 1].rollNumber;

    const rollMatch = String(firstRoll) === String(expectedFirst) && String(lastRoll) === String(expectedLast);

    if (countMatch && rollMatch) {
      console.log(
        `✅ ${sheetName.padEnd(16)} | Students: ${String(dataRows.length).padStart(2)} | Roll: ${String(firstRoll).padStart(2)} → ${String(lastRoll).padStart(2)} | Header: [${header.join(', ')}]`
      );
    } else {
      console.error(
        `❌ ${sheetName.padEnd(16)} | Count: ${dataRows.length} (Expected: ${expectedCount}), Roll: ${firstRoll}..${lastRoll}`
      );
      allVerified = false;
    }
  }

  if (allVerified) {
    console.log('\n✅ ALL 16 ATTENDANCE WORKSHEETS VERIFIED SUCCESSFULLY IN GOOGLE SHEETS!');
  } else {
    throw new Error('Some attendance worksheets failed verification!');
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  setupAttendanceSheets()
    .then(() => {
      console.log('\nDone.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Setup failed:', err);
      process.exit(1);
    });
}

module.exports = setupAttendanceSheets;
