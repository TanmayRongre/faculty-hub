/**
 * test_sheets_attendance_integration.js
 *
 * Verifies live Google Sheets Attendance reading & analytics integration
 * using the real Phase 3 Google Sheets service (without requiring MongoDB).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const academicDataService = require('../integrations/googleSheets/academicDataService');
const { computeAttendanceStats, groupByLecture } = require('../services/attendance/attendanceCalculator');

async function run() {
  console.log('=== Verifying Google Sheets -> Attendance Engine Integration ===\n');

  // 1. Connection
  const status = await academicDataService.getConnectionStatus();
  console.log('1. Google Sheets Connection:', status.connected ? 'SUCCESS' : 'FAILED');
  if (!status.connected) {
    console.error('Connection failed:', status.error);
    process.exit(1);
  }

  // 2. Read all attendance rows from the real Google Sheet
  console.log('2. Reading all attendance records from "Attendance" worksheet...');
  const allRecords = await academicDataService.getAllAttendance();
  console.log(`   Found ${allRecords.length} attendance rows in Google Sheets.`);

  if (allRecords.length > 0) {
    const sample = allRecords[0];
    console.log('   Sample attendance row:', {
      date: sample.date,
      lectureId: sample.lectureId,
      subjectCode: sample.subjectCode,
      enrollmentNumber: sample.enrollmentNumber,
      rollNumber: sample.rollNumber,
      status: sample.status,
    });

    // 3. Compute stats for sample student
    console.log(`3. Computing attendance analytics for student ${sample.enrollmentNumber}...`);
    const studentRecords = allRecords.filter(r => r.enrollmentNumber === sample.enrollmentNumber);
    const stats = computeAttendanceStats(studentRecords);
    console.log(`   Student ${sample.enrollmentNumber} summary:`, {
      totalClasses: stats.overall.total,
      classesAttended: stats.overall.present,
      classesMissed: stats.overall.absent,
      attendancePercent: `${stats.overall.percentage}%`,
      isDefaulter: stats.overall.isDefaulter,
      subjectCount: stats.subjects.length,
    });

    // 4. Lecture grouping
    const lectureGroups = groupByLecture(allRecords);
    const lectureCount = Object.keys(lectureGroups).length;
    console.log(`4. Grouped into ${lectureCount} unique lecture sessions.`);
  }

  console.log('\n✅ Live Google Sheets ↔ Attendance Engine integration VERIFIED.');
}

run().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
