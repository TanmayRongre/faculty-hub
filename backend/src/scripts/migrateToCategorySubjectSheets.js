/**
 * migrateToCategorySubjectSheets.js
 *
 * Migrates FacultyHub Google Sheets data to the Category + Subject architecture:
 *   - Attendance: ATT_STE, ATT_ACN, ATT_OSY, ATT_SPI, ATT_ITR, ATT_ENDS
 *   - Marks: MARK_STE, MARK_ACN, MARK_OSY, MARK_SPI, MARK_ITR, MARK_ENDS
 *
 * Preserves all historical attendance and marks data.
 * Old sheets are safely renamed or preserved as legacy.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');

const sheetsService = require('../integrations/googleSheets/googleSheetsService');
const academicDataService = require('../integrations/googleSheets/academicDataService');
const {
  VALID_SUBJECTS,
  ATTENDANCE_WORKSHEETS,
  MARKS_WORKSHEETS,
  SHEET_NAMES,
  COLUMNS,
} = require('../integrations/googleSheets/spreadsheetConfig');
const { rowToMarksRecord } = require('../integrations/googleSheets/mappers');

async function migrate() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   FacultyHub — Migration to CATEGORY + SUBJECT Google Sheets    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  await connectDB();

  // 1. Fetch active students from MongoDB for roster synchronization
  const students = await Student.find({ status: 'active', semester: 5 })
    .select('enrollmentNumber rollNumber fullName')
    .sort({ rollNumber: 1 })
    .lean();
  console.log(`• Loaded ${students.length} active 5th Semester Computer Science students from MongoDB.`);

  // 2. Inspect existing Google Spreadsheet structure
  const info = await sheetsService.getSpreadsheetInfo();
  const existingSheetNames = info.sheets.map((s) => s.properties.title);
  console.log(`• Existing worksheets: ${existingSheetNames.join(', ')}`);

  // 3. Migrate / Rename Subject Attendance Worksheets: STE -> ATT_STE, etc.
  console.log('\n[Phase 1] Migrating Attendance Worksheets to ATT_<SUBJECT>...');
  for (const sub of VALID_SUBJECTS) {
    const targetSheet = `ATT_${sub}`;
    const legacyRawSheet = sub; // e.g. STE

    if (existingSheetNames.includes(targetSheet)) {
      console.log(`  ✓ ${targetSheet} already exists. Ensuring roster is synced.`);
      await sheetsService.ensureAttendanceWorksheet(sub, students);
    } else if (existingSheetNames.includes(legacyRawSheet)) {
      console.log(`  🔄 Renaming existing subject sheet "${legacyRawSheet}" → "${targetSheet}"...`);
      const renamed = await sheetsService.renameWorksheet(legacyRawSheet, targetSheet);
      if (renamed) {
        console.log(`  ✓ Successfully renamed "${legacyRawSheet}" to "${targetSheet}".`);
      } else {
        console.log(`  ⚠️ Rename failed, copying data to "${targetSheet}"...`);
        await sheetsService.ensureAttendanceWorksheet(sub, students);
        const rawRows = await sheetsService.readRange(`${legacyRawSheet}!A:ZZ`);
        if (rawRows && rawRows.length > 0) {
          await sheetsService.updateRange(`${targetSheet}!A1`, rawRows);
        }
      }
      await sheetsService.syncSubjectAttendance(sub, students);
    } else {
      console.log(`  ➕ Creating new attendance sheet "${targetSheet}"...`);
      await sheetsService.ensureAttendanceWorksheet(sub, students);
    }
  }

  // 4. Create / Populate Marks Worksheets: MARK_<SUBJECT>
  console.log('\n[Phase 2] Setting up Marks Worksheets MARK_<SUBJECT>...');
  for (const sub of VALID_SUBJECTS) {
    const markSheet = `MARK_${sub}`;
    console.log(`  • Ensuring ${markSheet} with student roster...`);
    await sheetsService.ensureMarksWorksheet(sub, students);
  }

  // 5. Partition legacy monolithic Marks sheet into MARK_<SUBJECT>
  if (existingSheetNames.includes(SHEET_NAMES.MARKS)) {
    console.log('\n[Phase 3] Partitioning legacy monolithic Marks sheet into MARK_<SUBJECT>...');
    const markRows = await sheetsService.readRange(`${SHEET_NAMES.MARKS}!A:G`);

    if (markRows && markRows.length > 1) {
      console.log(`  • Found ${markRows.length - 1} marks records in "${SHEET_NAMES.MARKS}". Partitioning...`);
      const bySubject = {};
      for (let i = 1; i < markRows.length; i++) {
        try {
          const rec = rowToMarksRecord(markRows[i]);
          const sub = (rec.subjectCode || '').toUpperCase().trim();
          if (VALID_SUBJECTS.includes(sub)) {
            if (!bySubject[sub]) bySubject[sub] = [];
            bySubject[sub].push({
              rollNumber: rec.rollNumber,
              enrollmentNumber: rec.enrollmentNumber,
              PA: rec.PA,
            });
          }
        } catch (err) {
          // ignore malformed rows
        }
      }

      for (const [sub, marksList] of Object.entries(bySubject)) {
        try {
          const res = await sheetsService.updateSubjectMarks(sub, marksList);
          console.log(`  ✓ Migrated ${res.updatedCount} marks into MARK_${sub}`);
        } catch (err) {
          console.warn(`  ⚠️ Failed updating MARK_${sub}:`, err.message);
        }
      }

      // Safely rename monolithic Marks to Marks_Legacy
      console.log(`  🔄 Preserving original "${SHEET_NAMES.MARKS}" as "Marks_Legacy"...`);
      const legacyTargetName = existingSheetNames.includes('Marks_Legacy') ? 'Marks_Archived' : 'Marks_Legacy';
      await sheetsService.renameWorksheet(SHEET_NAMES.MARKS, legacyTargetName);
      console.log(`  ✓ Renamed "${SHEET_NAMES.MARKS}" to "${legacyTargetName}".`);
    } else {
      console.log(`  • Legacy "${SHEET_NAMES.MARKS}" sheet was empty.`);
    }
  } else {
    console.log('\n[Phase 3] No legacy monolithic Marks sheet to partition.');
  }

  // 6. Verify all 12 Category + Subject Worksheets
  console.log('\n[Phase 4] Verifying all Category + Subject Worksheets...');
  const updatedInfo = await sheetsService.getSpreadsheetInfo();
  const currentSheets = updatedInfo.sheets.map((s) => s.properties.title);

  let allOk = true;
  console.log('\nAttendance Worksheets:');
  for (const sheet of ATTENDANCE_WORKSHEETS) {
    const present = currentSheets.includes(sheet);
    console.log(`  ${present ? '✅' : '❌'} ${sheet}`);
    if (!present) allOk = false;
  }

  console.log('\nMarks Worksheets:');
  for (const sheet of MARKS_WORKSHEETS) {
    const present = currentSheets.includes(sheet);
    console.log(`  ${present ? '✅' : '❌'} ${sheet}`);
    if (!present) allOk = false;
  }

  await mongoose.disconnect();

  console.log('\n==================================================================');
  if (allOk) {
    console.log('✅ MIGRATION TO CATEGORY + SUBJECT ARCHITECTURE COMPLETE');
  } else {
    console.log('⚠️ MIGRATION COMPLETED WITH SOME MISSING SHEETS');
  }
  console.log('==================================================================\n');
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;
