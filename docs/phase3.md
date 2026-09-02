# Phase 3 — Google Sheets Academic Data Integration

Read:

* `.agent/rules.md`
* `docs/phase-2-users.md`

## Goal

Build the secure Google Sheets integration layer that will power FacultyHub's academic records.

This phase establishes the data pipeline for later marks and attendance modules.

Do NOT implement the full Marks Engine or Attendance UI in this phase.

---

# 1. ARCHITECTURE

Use this flow:

Google Sheets
↓
Google Sheets API / Apps Script
↓
Backend Google Sheets Service
↓
Academic Data Services
↓
REST API
↓
React

Rules:

* React must never access Google credentials.
* All Google API calls happen server-side.
* Keep Google Sheets logic isolated from controllers.
* Do not put spreadsheet logic directly inside route handlers.
* Use environment variables for all secrets and IDs.

---

# 2. CONFIGURATION

Add environment configuration for:

GOOGLE_SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY

If using Apps Script instead of service-account authentication, configure the required Apps Script endpoint securely.

Never commit credentials.

Update `.env.example` with placeholder variable names only.

Ensure `.gitignore` excludes:

.env
credentials files
service-account JSON files
private keys

---

# 3. GOOGLE SHEETS SERVICE

Create a dedicated integration layer.

Suggested structure:

backend/src/integrations/googleSheets/

```
googleSheetsClient
googleSheetsService
spreadsheetConfig
mappers
errors
```

Implement reusable operations:

* readRange()
* appendRows()
* updateRange()
* findRow()
* findRows()
* batchUpdate() where useful

Do not duplicate Google API code across controllers.

---

# 4. SPREADSHEET STRUCTURE

Design a clear spreadsheet structure for academic records.

Recommended sheets:

Students
Marks
Attendance
AcademicSummary

### Students

Suggested columns:

* enrollmentNumber
* rollNumber
* fullName
* department
* course
* semester
* academicYear
* division
* status

### Marks

Suggested columns:

* enrollmentNumber
* rollNumber
* subjectCode
* subjectName
* PA1
* PA2
* Test1
* Test2
* calculatedPA
* academicYear
* semester

### Attendance

Suggested columns:

* date
* lectureId
* subjectCode
* enrollmentNumber
* rollNumber
* status

Status:

Present
Absent

### AcademicSummary

Use for generated/summary data where required.

Do not duplicate data unnecessarily.

---

# 5. STUDENT MAPPING

Create a reliable mapping between MongoDB students and spreadsheet records.

Primary matching identifier:

enrollmentNumber

Secondary identifiers:

rollNumber
academic context where required

Do not rely only on student names.

Handle:

* missing student
* duplicate enrollment number
* duplicate spreadsheet row
* invalid enrollment number

---

# 6. ACADEMIC DATA API

Create backend APIs that provide controlled access to spreadsheet-backed data.

Examples:

GET /api/academic/marks/:studentId
GET /api/academic/marks
GET /api/academic/attendance/:studentId
GET /api/academic/attendance

Faculty/admin:

* authorized academic access

Student:

* own academic data only

Do not expose unrestricted spreadsheet ranges through generic endpoints.

---

# 7. SYNCHRONIZATION

Implement controlled synchronization between MongoDB student profiles and Google Sheets academic records.

Required behaviour:

* identify student using enrollment number
* read academic data
* map spreadsheet columns to application objects
* validate values
* return normalized data

If writing data:

1. Validate input.
2. Find target student/row.
3. Update the correct row.
4. Verify successful write where practical.
5. Return meaningful API result.

Never silently overwrite unrelated spreadsheet rows.

---

# 8. DATA VALIDATION

Marks:

* numeric
* non-negative
* within configured maximum
* reject malformed values

Attendance:

* valid date
* valid enrollment number
* valid subject
* status must be Present or Absent

Spreadsheet records with invalid data should produce controlled errors rather than crashing the application.

---

# 9. ERROR HANDLING

Handle:

* invalid credentials
* missing spreadsheet
* missing worksheet
* Google API failure
* permission denied
* rate limit
* malformed spreadsheet data
* missing rows
* duplicate rows
* network failure

Create meaningful application-level errors.

Do not expose Google API credentials or raw internal error details to users.

---

# 10. CACHING / PERFORMANCE

Do not call Google Sheets unnecessarily on every frontend interaction.

Design the service so future caching can be added.

Avoid:

* repeated identical spreadsheet requests
* downloading entire sheets when only a small range is required
* unnecessary API calls inside loops

Prefer:

* range-based reads
* batch operations
* controlled synchronization

Do not introduce a complicated caching system unless required.

---

# 11. FRONTEND

Create only a basic integration verification interface if necessary.

It may include:

* Academic Data Sync status
* Last successful synchronization
* Google Sheets connection status
* basic academic data preview for authorized faculty/admin

Do not build the final Marks or Attendance UI yet.

---

# 12. SECURITY

Verify:

* Google credentials exist only server-side.
* Spreadsheet IDs are not treated as secrets in frontend code.
* Student authorization works.
* Faculty/admin authorization works.
* Unauthorized users cannot access academic endpoints.

Never allow a frontend request to specify arbitrary spreadsheet IDs/ranges.

The backend must control which spreadsheets and ranges are accessible.

---

# 13. LOGGING

Log useful operational information:

* synchronization started
* synchronization completed
* number of records processed
* synchronization errors

Do NOT log:

* passwords
* JWT secrets
* Google private keys
* sensitive credentials

---

# 14. TESTING

Test:

### Connection

* valid Google configuration
* invalid credentials
* missing spreadsheet
* missing worksheet

### Reading

* marks retrieval
* attendance retrieval
* missing rows
* duplicate rows

### Writing

* correct row update
* invalid data rejection
* wrong student prevention

### Authorization

* faculty access
* admin access
* student own-data access
* student other-data rejection

### Regression

* Phase 1 authentication
* Phase 2 user/student/faculty management

---

# 15. IMPORTANT

Do not implement:

* complete MSBTE calculation engine
* complete attendance marking interface
* timetable
* resources
* notices
* gallery

Those belong to later phases.

This phase should produce a reliable, reusable Google Sheets integration foundation for Phase 4 and Phase 5.

---

# 16. COMPLETION

Before finishing:

1. Verify Google Sheets connection.
2. Verify read operations.
3. Verify controlled write/update operations.
4. Verify student mapping.
5. Verify authorization.
6. Verify error handling.
7. Run backend tests/build.
8. Run frontend build.
9. Confirm Phase 1 and Phase 2 still work.

Return only:

* changes made
* tests/build performed
* Google Sheets integration status
* remaining issues/blockers
