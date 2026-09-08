/**
 * migrateAttendanceToSubjectSheets.js
 *
 * Migrates Google Sheets attendance from the legacy generic 'Attendance' sheet
 * into separate, dedicated subject worksheets:
 *   - STE
 *   - ACN
 *   - OSY
 *   - SPI
 *   - ITR
 *   - ENDS
 *
 * Each worksheet structure:
 *   | Roll No. | Name | 25-Aug-2026 | 26-Aug-2026 | ... |
 *   | 01       | Name | P           | A           | ... |
 *
 * Old 'Attendance' worksheet is preserved and renamed to 'Attendance_Legacy'.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const sheets = require('../integrations/googleSheets/googleSheetsService');
const { getSheetsClient } = require('../integrations/googleSheets/googleSheetsClient');
const {
  SUBJECT_SHEETS,
  SHEET_NAMES,
  ATTENDANCE_CELL_VALUES,
} = require('../integrations/googleSheets/spreadsheetConfig');

async function migrate() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FacultyHub — Migrate Attendance to Subject Worksheets      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  await connectDB();

  // 1. Fetch all active Semester 5 students (ordered by roll number)
  const students = await Student.find({ status: 'active', semester: 5 })
    .select('enrollmentNumber rollNumber fullName')
    .sort({ rollNumber: 1 })
    .lean();

  console.log(`[Roster] Found ${students.length} active Semester 5 students.`);

  // 2. Inspect spreadsheet to find existing Attendance sheet
  const info = await sheets.getSpreadsheetInfo();
  const existingSheetTitles = info.sheets.map((s) => s.properties.title);
  console.log(`[Spreadsheet] Existing worksheets: ${existingSheetTitles.join(', ')}`);

  const hasAttendanceSheet = existingSheetTitles.some((t) => t.toLowerCase() === 'attendance');
  const attendanceSheetObj = info.sheets.find((s) => s.properties.title.toLowerCase() === 'attendance');

  let rawAttendanceRows = [];
  if (hasAttendanceSheet) {
    const raw = await sheets.readRange('Attendance!A1:F');
    if (raw && raw.length > 1) {
      // Row 1 is header, data starts at row 2
      rawAttendanceRows = raw.slice(1);
    }
    console.log(`[Legacy] Read ${rawAttendanceRows.length} rows from "Attendance" sheet.`);
  } else {
    console.log('[Legacy] No legacy "Attendance" sheet found; initializing empty subject sheets.');
  }

  // 3. Group legacy rows by subject code
  // Row layout: [date, lectureId, subjectCode, enrollmentNumber, rollNumber, status]
  const recordsBySubject = {};
  for (const s of SUBJECT_SHEETS) {
    recordsBySubject[s] = [];
  }

  for (const row of rawAttendanceRows) {
    const subjectCode = (row[2] || '').trim().toUpperCase();
    if (SUBJECT_SHEETS.includes(subjectCode)) {
      recordsBySubject[subjectCode].push({
        date: row[0],
        lectureId: row[1] || '',
        subjectCode,
        enrollmentNumber: row[3] || '',
        rollNumber: row[4] || '',
        status: (row[5] || '').trim(),
      });
    }
  }

  // 4. Create and populate each of the 6 subject worksheets
  for (const sub of SUBJECT_SHEETS) {
    console.log(`\n[Subject: ${sub}] Ensuring worksheet & student roster...`);
    await sheets.ensureSubjectWorksheet(sub, students);

    const subRecords = recordsBySubject[sub] || [];
    console.log(`  Records to migrate for ${sub}: ${subRecords.length}`);

    if (subRecords.length > 0) {
      // Group by lecture session (date + lectureId)
      const sessionMap = new Map();
      for (const r of subRecords) {
        const key = `${r.date}__${r.lectureId}`;
        if (!sessionMap.has(key)) {
          sessionMap.set(key, { date: r.date, lectureId: r.lectureId, list: [] });
        }
        sessionMap.get(key).list.push(r);
      }

      console.log(`  Found ${sessionMap.size} unique lecture sessions for ${sub}.`);

      for (const [key, session] of sessionMap.entries()) {
        const result = await sheets.updateSubjectAttendance(
          sub,
          session.lectureId,
          session.date,
          session.list
        );
        console.log(`    ✓ Wrote session ${session.date} (Col: ${result.colLetter}, ${result.updatedCount} students)`);
      }
    }
  }

  // 5. Rename legacy 'Attendance' sheet to 'Attendance_Legacy' if it exists
  if (attendanceSheetObj) {
    try {
      const client = getSheetsClient();
      await client.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID.trim().replace(/^["']|["']$/g, ''),
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: attendanceSheetObj.properties.sheetId,
                  title: 'Attendance_Legacy',
                },
                fields: 'title',
              },
            },
          ],
        },
      });
      console.log('\n[Legacy] Preserved and renamed "Attendance" → "Attendance_Legacy".');
    } catch (renameErr) {
      console.warn('[Legacy] Could not rename Attendance sheet (already renamed or permissions):', renameErr.message);
    }
  }

  await mongoose.disconnect();
  console.log('\n======================================================');
  console.log('✅ ATTENDANCE SUBJECT-WISE MIGRATION COMPLETE');
  console.log('======================================================\n');
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrate;
