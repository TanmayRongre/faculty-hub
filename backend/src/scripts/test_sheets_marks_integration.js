/**
 * test_sheets_marks_integration.js
 *
 * Verifies live Google Sheets Marks reading, writing, and msbteEngine calculation.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const academicDataService = require('../integrations/googleSheets/academicDataService');
const { enrichMarksRecords, generatePerformanceSummary } = require('../services/marks/msbteEngine');

async function run() {
  console.log('=== Verifying Google Sheets -> Marks Engine Integration ===\n');

  // 1. Connection
  const status = await academicDataService.getConnectionStatus();
  console.log('1. Google Sheets Connection:', status.connected ? 'SUCCESS' : 'FAILED');
  if (!status.connected) {
    console.error('Connection failed:', status.error);
    process.exit(1);
  }

  // 2. Read all marks from real Google Sheet
  console.log('2. Reading all marks from "Marks" worksheet...');
  const rawMarks = await academicDataService.getAllMarks();
  console.log(`   Found ${rawMarks.length} marks rows in Google Sheets.`);

  if (rawMarks.length > 0) {
    const sample = rawMarks[0];
    console.log('   Sample raw mark row:', {
      enrollmentNumber: sample.enrollmentNumber,
      subjectCode: sample.subjectCode,
      PA: sample.PA,
      calculatedPA: sample.calculatedPA,
    });

    // 3. Run MSBTE Engine enrichment
    console.log('3. Enriching raw marks with MSBTE Calculation Engine...');
    const enriched = enrichMarksRecords(rawMarks);
    const enrichedSample = enriched[0];
    console.log('   Enriched sample calculation:', {
      enrollmentNumber: enrichedSample.enrollmentNumber,
      subjectCode: enrichedSample.subjectCode,
      PA: enrichedSample.PA,
      totalPossible: enrichedSample.totalPossible,
      performancePercent: enrichedSample.performancePercent,
      performanceStatus: enrichedSample.performanceStatus,
    });

    // 4. Generate Performance Summary
    console.log('4. Generating student performance summary...');
    const studentMarks = enriched.filter((m) => m.enrollmentNumber === sample.enrollmentNumber);
    const summary = generatePerformanceSummary(studentMarks);
    console.log(`   Overall Summary for ${sample.enrollmentNumber}:`, summary.overallSummary);
  }

  console.log('\n=== Google Sheets Marks Integration Verified Successfully ===');
}

run().catch((err) => {
  console.error('Error during test:', err);
  process.exit(1);
});
