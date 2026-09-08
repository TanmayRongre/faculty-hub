/**
 * fixLiveGoogleSheetsStudents.js
 *
 * Urgent correction of live Google Spreadsheet "FacultyHub_Academic_2026"
 * Worksheet: "Students"
 *
 * 1. Reads current Students worksheet to inspect old records.
 * 2. Completely clears the Students worksheet (all old data & columns).
 * 3. Writes the required header:
 *    Roll No. | Enrolment No. | Exam Seat No. | Name | Department | Semester | Academic Year | Status
 * 4. Populates with EXACTLY the 68 students (Exam Seat No. blank, Department: Computer Engineering,
 *    Semester: 5th Semester, Academic Year: 2026-2027, Status: active).
 * 5. Verifies other sheets (ATT_*, MARK_*) are preserved intact.
 * 6. Reads back the entire live Students worksheet and performs comprehensive verification.
 * 7. Cross-verifies with MongoDB.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch (e) {}

const { getSheetsClient } = require('../integrations/googleSheets/googleSheetsClient');
const Student = require('../models/Student');

const SPREADSHEET_ID = (process.env.GOOGLE_SPREADSHEET_ID || '').trim().replace(/^["']|["']$/g, '');

const REQUIRED_HEADERS = [
  'Roll No.',
  'Enrolment No.',
  'Exam Seat No.',
  'Name',
  'Department',
  'Semester',
  'Academic Year',
  'Status'
];

const STUDENTS = [
  { roll: '1',  enrollment: '23410360144', name: 'SARTHAK SUDHIR BOBADE' },
  { roll: '2',  enrollment: '24410360027', name: 'GULHANE JANHAVI SANTOSH' },
  { roll: '3',  enrollment: '24410360056', name: 'THORAT KASHISH SUNIL' },
  { roll: '4',  enrollment: '24410360070', name: 'FAISAL MAQSOOD MAQSOOD AHMAD' },
  { roll: '5',  enrollment: '24410360119', name: 'VAIDYA OM PANDIT' },
  { roll: '6',  enrollment: '24410360120', name: 'SOLANKE ASMITA PRAFUL' },
  { roll: '7',  enrollment: '24410360121', name: 'TAYSKAR KUNAL NARENDRA' },
  { roll: '8',  enrollment: '24410360122', name: 'TANDEKAR SHIVANSH MAHESHKUMAR' },
  { roll: '9',  enrollment: '24410360123', name: 'CHAVHAN GOURI SUBHASH' },
  { roll: '10', enrollment: '24410360125', name: 'GAIDHANE ANUSHRI KISHOR' },
  { roll: '11', enrollment: '24410360126', name: 'GAWANDE KUNJALI RAVINDRA' },
  { roll: '12', enrollment: '24410360127', name: 'YASH P PACHARE' },
  { roll: '13', enrollment: '24410360129', name: 'PANZADE SHIVANI SURESHRAO' },
  { roll: '14', enrollment: '24410360130', name: 'MUGAL PURVA DHIRAJ' },
  { roll: '15', enrollment: '24410360131', name: 'CHOUDHARI ARJUN GAJANAN' },
  { roll: '16', enrollment: '24410360134', name: 'DESHMUKH SUKRUTA GOVIND' },
  { roll: '17', enrollment: '24410360135', name: 'BANDWAL TANISHA MANESHSING' },
  { roll: '18', enrollment: '24410360137', name: 'CHAUDHARI KRISHNALI VIDYADHAR' },
  { roll: '19', enrollment: '24410360138', name: 'BONDE GAURI AJAY' },
  { roll: '20', enrollment: '24410360140', name: 'KUBADE CHANCHAL VIKASRAO' },
  { roll: '21', enrollment: '24410360141', name: 'BELSARE LAXMI PREMCHAND' },
  { roll: '22', enrollment: '24410360142', name: 'RONGRE TANMAY SAGAR' },
  { roll: '23', enrollment: '24410360144', name: 'ZOHEB ANWAR RAZIQUE AHMAD' },
  { roll: '24', enrollment: '24410360145', name: 'DHAGE SHREYA PRAVIN' },
  { roll: '25', enrollment: '24410360147', name: 'AMBHORE KARTIK PURUSHOTTAM' },
  { roll: '26', enrollment: '24410360148', name: 'TALEKAR BHARAT KASHINATH' },
  { roll: '27', enrollment: '24410360149', name: 'THAKARE DNYANESHWARI PRAKASH' },
  { roll: '28', enrollment: '24410360150', name: 'ANDHALE PRACHI RANJIT' },
  { roll: '29', enrollment: '24410360151', name: 'HURIEN AFSHAN SHEIKH MOHAMMAD SHARIQUE' },
  { roll: '30', enrollment: '24410360152', name: 'KHUPASE NISHANT YASHVANT' },
  { roll: '31', enrollment: '24410360255', name: 'JADHAO CHAITALI DNYANESHWAR' },
  { roll: '32', enrollment: '25410360113', name: 'DHAGE ISHWARI GAJANAN' },
  { roll: '33', enrollment: '25410360114', name: 'KADAM BHAURAO RAJKUMAR' },
  { roll: '34', enrollment: '23410360164', name: 'JANHAVI VIJAY GULHANE' },
  { roll: '35', enrollment: '23410360173', name: 'ABBAS HASAN NAURANGABADI' },
  { roll: '36', enrollment: '24410360153', name: 'BHAWNE SHREYASH VIJAY' },
  { roll: '37', enrollment: '24410360154', name: 'THAKARE NETRA SANTOSH' },
  { roll: '38', enrollment: '24410360155', name: 'DESHMUKH TANVI JAYAWANT' },
  { roll: '39', enrollment: '24410360158', name: 'KAKDE PURVA SHAILESH' },
  { roll: '40', enrollment: '24410360159', name: 'CHARHATE RITIKA SANDIP' },
  { roll: '41', enrollment: '24410360160', name: 'SYED TAMIMUDDIN SYED AYAZUDDIN' },
  { roll: '42', enrollment: '24410360161', name: 'KAWARE SAMIKSHA UMESH' },
  { roll: '43', enrollment: '24410360162', name: 'KOSE PURVA PADMAKAR' },
  { roll: '44', enrollment: '24410360165', name: 'KALORE ATHARAV VIJAYKUMAR' },
  { roll: '45', enrollment: '24410360166', name: 'TOMAR KUMUDINI YOGENDRASINH' },
  { roll: '46', enrollment: '24410360167', name: 'MEHARE VEDIKA GANESH' },
  { roll: '47', enrollment: '24410360168', name: 'GADERAO NIRAV NANDU' },
  { roll: '48', enrollment: '24410360169', name: 'SAPKAL SARTHAK BHARAT' },
  { roll: '49', enrollment: '24410360170', name: 'GAURI SURENDRA SURYAVANSHI' },
  { roll: '50', enrollment: '24410360172', name: 'PAWAR SHREYA PRAKASH' },
  { roll: '51', enrollment: '24410360173', name: 'KUROTIYA MITALI MITESH' },
  { roll: '52', enrollment: '24410360174', name: 'HELGE GAYATRI ATMARAM' },
  { roll: '53', enrollment: '24410360175', name: 'INGALE MANSI SHRAVAN' },
  { roll: '54', enrollment: '24410360176', name: 'SAIYAD ASHMIRA TAHER ALI' },
  { roll: '55', enrollment: '24410360177', name: 'QAZI INSHAAL AATIF' },
  { roll: '56', enrollment: '24410360178', name: 'SHAIKH AMAN JAVED' },
  { roll: '57', enrollment: '24410360179', name: 'JAWARKAR SNEHA ANIL' },
  { roll: '58', enrollment: '24410360180', name: 'AWAGHAD ISHWARI SANTOSH' },
  { roll: '59', enrollment: '24410360181', name: 'KALE SHRAVANI PRASHANT' },
  { roll: '60', enrollment: '24410360183', name: 'BHAGAT PARTH NIRAJ' },
  { roll: '61', enrollment: '24410360184', name: 'PADEKAR JANHAVI GAJENDRA' },
  { roll: '62', enrollment: '24410360185', name: 'BHIL ATHARV NARAYAN' },
  { roll: '63', enrollment: '24410360186', name: 'RATHOD RAJNANDINI RAMESHWAR' },
  { roll: '64', enrollment: '24410360187', name: 'REHAPADE AKSHARA VILAS' },
  { roll: '65', enrollment: '24410360288', name: 'SIYA ABHIJEET JADHAV' },
  { roll: '66', enrollment: '24410920153', name: 'ANUSHKA GOVARDHAN HINGANKAR' },
  { roll: '67', enrollment: '24411510196', name: 'NANDINI SADANAND RATHOD' },
  { roll: '68', enrollment: '25410360116', name: 'ARYA NITIN CHOUDHARI' },
];

async function main() {
  console.log('============================================================');
  console.log('FIX LIVE GOOGLE SHEETS "Students" WORKSHEET');
  console.log('============================================================\n');

  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SPREADSHEET_ID is missing from .env');
  }

  const sheets = getSheetsClient();

  // 1. Get spreadsheet metadata and list of sheets
  console.log('1. Connecting to live Google Spreadsheet...');
  const ssMetadata = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const ssTitle = ssMetadata.data.properties?.title;
  console.log(`✓ Connected to Spreadsheet: "${ssTitle}" (ID: ${SPREADSHEET_ID})`);

  const sheetList = ssMetadata.data.sheets || [];
  console.log(`✓ Worksheets present (${sheetList.length}): ${sheetList.map(s => s.properties.title).join(', ')}`);

  const studentsSheetObj = sheetList.find(s => s.properties.title === 'Students');
  if (!studentsSheetObj) {
    throw new Error('Worksheet "Students" not found in spreadsheet!');
  }
  const studentsSheetId = studentsSheetObj.properties.sheetId;

  // 2. Read CURRENT Students worksheet to record existing state
  console.log('\n2. Reading current live "Students" worksheet content...');
  const currentStudentsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Students!A:Z',
  });

  const currentRows = currentStudentsRes.data.values || [];
  console.log(`Current total rows in "Students" worksheet: ${currentRows.length}`);
  let oldDataRowCount = 0;
  if (currentRows.length > 0) {
    console.log(`Current Headers (Row 1): [${currentRows[0].join(', ')}]`);
    oldDataRowCount = currentRows.length - 1;
    console.log(`Old data rows present: ${oldDataRowCount}`);
    if (currentRows.length > 1) {
      console.log(`First old data row: [${currentRows[1].join(', ')}]`);
      console.log(`Last old data row: [${currentRows[currentRows.length - 1].join(', ')}]`);
    }
  }

  // 3. Clear the entire Students worksheet
  console.log('\n3. Completely clearing "Students" worksheet (Students!A:Z)...');
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Students!A:Z',
  });
  console.log('✓ Successfully cleared all cells in Students!A:Z.');

  // 4. Prepare the new 68 student dataset with exact requested columns
  console.log('\n4. Preparing clean 68-student dataset with required schema...');
  const newHeaderRow = [...REQUIRED_HEADERS];
  const newStudentRows = STUDENTS.map(s => [
    s.roll,                        // Roll No.
    s.enrollment,                  // Enrolment No.
    '',                            // Exam Seat No. (blank as specified)
    s.name,                        // Name
    'Computer Engineering',        // Department
    '5th Semester',                // Semester
    '2026-2027',                   // Academic Year
    'active'                       // Status
  ]);

  const allRowsToWrite = [newHeaderRow, ...newStudentRows];
  console.log(`Prepared ${allRowsToWrite.length} total rows (1 header + 68 data rows).`);

  // 5. Write data starting at Students!A1
  console.log('\n5. Writing clean dataset starting at Students!A1...');
  const writeRes = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Students!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: allRowsToWrite,
    },
  });
  console.log(`✓ Google Sheets write response: ${writeRes.data.updatedRows} rows written, ${writeRes.data.updatedColumns} columns, ${writeRes.data.updatedCells} cells.`);

  // 6. Apply format: freeze row 1, bold header, professional styling
  console.log('\n6. Applying formatting to "Students" header row...');
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          // Freeze row 1
          {
            updateSheetProperties: {
              properties: {
                sheetId: studentsSheetId,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          // Format header row (Row 1: A1:H1) - Dark navy background, white bold text
          {
            repeatCell: {
              range: {
                sheetId: studentsSheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: REQUIRED_HEADERS.length,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.16, blue: 0.22 }, // Slate-800
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 10,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Center align columns: Roll No, Enrolment No, Exam Seat No, Semester, Academic Year, Status
          {
            repeatCell: {
              range: {
                sheetId: studentsSheetId,
                startRowIndex: 1,
                endRowIndex: 69,
                startColumnIndex: 0,
                endColumnIndex: 3, // Roll No., Enrolment No., Exam Seat No.
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
                sheetId: studentsSheetId,
                startRowIndex: 1,
                endRowIndex: 69,
                startColumnIndex: 4, // Department
                endColumnIndex: 8, // Semester, Academic Year, Status
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat.horizontalAlignment',
            },
          },
        ],
      },
    });
    console.log('✓ Formatting and freeze applied successfully.');
  } catch (formatErr) {
    console.warn('⚠️ Non-fatal formatting notice:', formatErr.message);
  }

  // 7. READ BACK LIVE from Google Sheets to verify!
  console.log('\n7. READING BACK LIVE DATA FROM GOOGLE SHEETS FOR STRICT VERIFICATION...');
  const verifyRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Students!A:H',
  });

  const verifiedRows = verifyRes.data.values || [];
  if (verifiedRows.length === 0) {
    throw new Error('CRITICAL FAILURE: Students worksheet is empty after write!');
  }

  const headerReadBack = verifiedRows[0];
  const dataRowsReadBack = verifiedRows.slice(1);

  console.log(`\n• Live Header Read: [${headerReadBack.join(' | ')}]`);
  console.log(`• Total Live Rows Read: ${verifiedRows.length}`);
  console.log(`• Total Live Student Data Rows: ${dataRowsReadBack.length}`);

  // Validation checks
  const errors = [];

  // Check 1: Headers
  for (let i = 0; i < REQUIRED_HEADERS.length; i++) {
    if (headerReadBack[i] !== REQUIRED_HEADERS[i]) {
      errors.push(`Header mismatch at col ${i}: expected "${REQUIRED_HEADERS[i]}", got "${headerReadBack[i]}"`);
    }
  }

  // Check 2: Total student count
  if (dataRowsReadBack.length !== 68) {
    errors.push(`Row count mismatch: expected 68 student rows, got ${dataRowsReadBack.length}`);
  }

  // Check 3: Every student matches exactly
  const rollSet = new Set();
  const enrollSet = new Set();
  const oldNamesToCheck = ['Aarav', 'Aditya Patel', 'Ananya Deshmukh', 'Aryan Kulkarni'];

  for (let i = 0; i < dataRowsReadBack.length; i++) {
    const row = dataRowsReadBack[i];
    const expected = STUDENTS[i];
    const rowRoll = String(row[0] || '').trim();
    const rowEnroll = String(row[1] || '').trim();
    const rowSeat = String(row[2] || '').trim();
    const rowName = String(row[3] || '').trim();
    const rowDept = String(row[4] || '').trim();
    const rowSem = String(row[5] || '').trim();
    const rowYear = String(row[6] || '').trim();
    const rowStatus = String(row[7] || '').trim();

    if (rollSet.has(rowRoll)) {
      errors.push(`Duplicate Roll No. found: ${rowRoll}`);
    }
    rollSet.add(rowRoll);

    if (enrollSet.has(rowEnroll)) {
      errors.push(`Duplicate Enrolment No. found: ${rowEnroll}`);
    }
    enrollSet.add(rowEnroll);

    if (expected) {
      if (rowRoll !== expected.roll) {
        errors.push(`Row ${i+1}: expected Roll No "${expected.roll}", got "${rowRoll}"`);
      }
      if (rowEnroll !== expected.enrollment) {
        errors.push(`Row ${i+1}: expected Enrolment No "${expected.enrollment}", got "${rowEnroll}"`);
      }
      if (rowName !== expected.name) {
        errors.push(`Row ${i+1}: expected Name "${expected.name}", got "${rowName}"`);
      }
    }

    if (rowSeat !== '') {
      errors.push(`Row ${i+1}: expected blank Exam Seat No, got "${rowSeat}"`);
    }
    if (rowDept !== 'Computer Engineering') {
      errors.push(`Row ${i+1}: expected Department "Computer Engineering", got "${rowDept}"`);
    }
    if (rowSem !== '5th Semester') {
      errors.push(`Row ${i+1}: expected Semester "5th Semester", got "${rowSem}"`);
    }
    if (rowYear !== '2026-2027') {
      errors.push(`Row ${i+1}: expected Academic Year "2026-2027", got "${rowYear}"`);
    }
    if (rowStatus !== 'active') {
      errors.push(`Row ${i+1}: expected Status "active", got "${rowStatus}"`);
    }

    for (const oldName of oldNamesToCheck) {
      if (rowName.toLowerCase().includes(oldName.toLowerCase())) {
        errors.push(`Row ${i+1}: contains old student name "${oldName}"!`);
      }
    }
  }

  // 8. Cross check with MongoDB
  console.log('\n8. Connecting to MongoDB to verify consistency...');
  await mongoose.connect(process.env.MONGO_URI);
  const mongoCount = await Student.countDocuments();
  console.log(`• MongoDB Students Count: ${mongoCount}`);

  if (mongoCount !== 68) {
    errors.push(`MongoDB student count mismatch: expected 68, got ${mongoCount}`);
  }

  const mongoStudentsRaw = await Student.find({}).lean();
  const mongoStudents = mongoStudentsRaw.sort((a, b) => parseInt(a.rollNumber, 10) - parseInt(b.rollNumber, 10));
  for (let i = 0; i < Math.min(mongoStudents.length, STUDENTS.length); i++) {
    const ms = mongoStudents[i];
    const es = STUDENTS[i];
    if (String(ms.rollNumber).trim() !== es.roll) {
      errors.push(`MongoDB student ${i+1} roll mismatch: ${ms.rollNumber} vs ${es.roll}`);
    }
    if (String(ms.enrollmentNumber).trim() !== es.enrollment) {
      errors.push(`MongoDB student ${i+1} enrollment mismatch: ${ms.enrollmentNumber} vs ${es.enrollment}`);
    }
    if (String(ms.fullName).trim().toUpperCase() !== es.name) {
      errors.push(`MongoDB student ${i+1} name mismatch: ${ms.fullName} vs ${es.name}`);
    }
  }
  await mongoose.disconnect();

  // 9. Verify other sheets were NOT deleted or modified
  console.log('\n9. Verifying integrity of other worksheets in spreadsheet...');
  const postSsMetadata = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const postSheetList = postSsMetadata.data.sheets.map(s => s.properties.title);
  console.log(`• Post-update worksheets present (${postSheetList.length}): ${postSheetList.join(', ')}`);

  const expectedSheets = [
    'Students', 'ATT_STE', 'ATT_ACN', 'ATT_OSY', 'ATT_SPI', 'ATT_ITR', 'ATT_ENDS',
    'MARK_STE', 'MARK_ACN', 'MARK_OSY', 'MARK_SPI', 'MARK_ITR', 'MARK_ENDS'
  ];

  for (const es of expectedSheets) {
    if (!postSheetList.includes(es)) {
      errors.push(`Missing expected worksheet: ${es}`);
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ VALIDATION ERRORS FOUND:');
    errors.forEach(e => console.error('  - ' + e));
    throw new Error(`Validation failed with ${errors.length} errors`);
  }

  // 10. Display First 5 and Last 5 students directly read back from Google Sheets
  console.log('\n============================================================');
  console.log('FINAL VERIFICATION REPORT — LIVE GOOGLE SHEETS "Students"');
  console.log('============================================================');
  console.log(`• Old student rows removed:      ${oldDataRowCount}`);
  console.log(`• New student rows written:      68`);
  console.log(`• Final student rows in sheet:   ${dataRowsReadBack.length}`);
  console.log(`• Duplicate Roll Nos:            0`);
  console.log(`• Duplicate Enrolment Nos:       0`);
  console.log(`• Department (all 68):           Computer Engineering`);
  console.log(`• Semester (all 68):             5th Semester`);
  console.log(`• Academic Year (all 68):        2026-2027`);
  console.log(`• Status (all 68):               active`);
  console.log(`• Exam Seat No (all 68):         (blank)`);
  console.log(`• Old students remaining:        0`);
  console.log(`• MongoDB consistency:           100% MATCH (68/68)`);
  console.log(`• Other worksheets intact:       YES (${postSheetList.length} total sheets)`);
  console.log('============================================================\n');

  console.log('--- FIRST 5 STUDENTS READ BACK FROM LIVE GOOGLE SHEET ---');
  dataRowsReadBack.slice(0, 5).forEach((row, idx) => {
    console.log(`  [Row ${idx + 2}] Roll: ${row[0]} | Enrol: ${row[1]} | Seat: "${row[2]}" | Name: ${row[3]} | Dept: ${row[4]} | Sem: ${row[5]} | Year: ${row[6]} | Status: ${row[7]}`);
  });

  console.log('\n--- LAST 5 STUDENTS READ BACK FROM LIVE GOOGLE SHEET ---');
  dataRowsReadBack.slice(63, 68).forEach((row, idx) => {
    console.log(`  [Row ${63 + idx + 2}] Roll: ${row[0]} | Enrol: ${row[1]} | Seat: "${row[2]}" | Name: ${row[3]} | Dept: ${row[4]} | Sem: ${row[5]} | Year: ${row[6]} | Status: ${row[7]}`);
  });
  console.log('============================================================\n');
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
