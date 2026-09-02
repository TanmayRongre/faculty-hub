# Phase 4 — MSBTE Marks Engine & Student Analytics

Read:

* `.agent/rules.md`
* `docs/phase-2-users.md`
* `docs/phase-3-google-sheets.md`

## Goal

Implement the complete **Student Analytics & MSBTE Marks Engine** using the Google Sheets academic-data layer established in Phase 3.

This phase must be accurate, testable, and designed so MSBTE evaluation logic is isolated from the UI.

Do NOT implement Attendance, Scheduler, Resources, Notices, or Gallery.

---

# 1. MARKS DATA FLOW

Use:

Google Sheets
↓
Google Sheets Service
↓
Marks Service
↓
MSBTE Calculation Engine
↓
REST API
↓
React Analytics UI

Do not put calculation formulas inside React components.

The backend must be the source of truth for calculated academic values.

---

# 2. MARKS INPUTS

Support the required academic inputs:

* PA1
* PA2
* Test1
* Test2
* subject
* student
* semester
* academic year

Keep raw marks separate from calculated marks.

Example:

raw:
PA1
PA2
Test1
Test2

calculated:
average
convertedPA
summary

Do not overwrite raw marks with calculated values.

---

# 3. MSBTE CALCULATION ENGINE

Create a dedicated service/module.

Example:

backend/src/services/marks/
msbteMarksEngine
marksService
marksValidator
marksMapper

The engine must be independently testable.

## PA Calculation

Use:

PA Average = (PA1 + PA2) / 2

The result must then be converted/scaled according to the applicable **MSBTE 30-mark PA evaluation structure**.

## Test Calculation

Where Test 1 and Test 2 are used, apply the required:

(Test1 + Test2) / 30 scaled-mark logic

Do not invent alternative formulas.

Do not silently substitute generic percentage calculations.

---

# 4. IMPORTANT CALCULATION SAFETY

Before finalizing any formula implementation:

* verify the configured maximum marks
* verify the intended MSBTE scaling
* keep conversion constants configurable
* avoid hardcoded assumptions where the evaluation structure may vary
* preserve raw marks
* round only at the defined calculation stage

If the existing project specification does not provide enough information to determine a particular MSBTE conversion rule, do not invent one.

Keep that rule isolated/configurable and flag it as a project configuration item.

---

# 5. VALIDATION

Validate all marks before calculation.

Requirements:

* numeric values only
* no negative values
* maximum limits enforced
* null/undefined handled
* malformed spreadsheet values rejected
* invalid student rejected
* invalid subject rejected

Return clear validation errors.

---

# 6. MARKS APIs

Create protected APIs.

Faculty/admin:

GET /api/marks/student/
GET /api/marks
PUT /api/marks//

Student:

GET /api/marks/me

Optional subject filtering:

GET /api/marks/student/?subjectCode=...

Support filters for:

* student
* subject
* semester
* academic year
* division

Students must only access their own marks.

Faculty/admin may access authorized academic records.

---

# 7. GOOGLE SHEETS WRITES

When faculty updates marks:

1. Validate request.
2. Validate student.
3. Validate subject.
4. Calculate derived values.
5. Update the correct Google Sheets row.
6. Preserve raw inputs.
7. Return normalized calculated result.

Never:

* modify unrelated rows
* create duplicate student records
* silently fail a spreadsheet update

If synchronization fails, return a controlled error.

---

# 8. STUDENT PERFORMANCE VIEW

Create a professional student analytics page.

Include:

### Summary

* overall performance
* subject count
* strongest subject
* subjects needing attention

### Subject Table

Columns:

* Subject
* PA1
* PA2
* PA Average
* Converted PA
* Test values where applicable
* Performance status

### Charts

Use charts where they improve understanding.

Recommended:

* subject performance bar chart
* marks comparison
* performance distribution

Do not create charts that provide no useful information.

---

# 9. FACULTY MARKS MANAGEMENT

Create a faculty marks-management interface.

Faculty should be able to:

1. Select semester
2. Select division
3. Select subject
4. View students
5. Enter/update marks
6. See calculated values
7. Save changes

Provide clear distinction between:

* editable raw marks
* read-only calculated marks

Use a table optimized for quick academic data entry.

---

# 10. PERFORMANCE STATUS

Create meaningful performance indicators.

Possible statuses:

* Excellent
* Good
* Average
* Needs Attention

Keep performance-status logic separate from the core MSBTE calculation.

Do not present a status as an official MSBTE grade unless the actual grading rule has been explicitly configured.

---

# 11. DASHBOARD INTEGRATION

Enhance existing dashboards with academic information.

### Student

Show:

* performance summary
* subject performance
* recent marks
* academic trend where enough data exists

### Faculty

Show:

* class performance summary
* subject performance
* students requiring attention
* average performance

Do not overload the dashboard.

---

# 12. DATA CONSISTENCY

Ensure:

MongoDB:

* student identity
* subject metadata
* academic structure

Google Sheets:

* raw academic marks
* designated academic records

Calculated values should be reproducible from the raw inputs.

Avoid creating conflicting sources of truth.

---

# 13. EDGE CASES

Handle:

* student has no marks
* one PA value missing
* both PA values missing
* Test values missing
* invalid marks
* duplicate spreadsheet row
* student not found
* subject not found
* Google Sheets unavailable
* partially updated record

Do not display misleading zeroes when a mark is actually unavailable.

Clearly distinguish:

* 0 marks
* missing marks
* unavailable data

---

# 14. TESTING

Create unit tests for the calculation engine.

Test:

### PA

* normal values
* minimum values
* maximum values
* decimal values
* missing PA1
* missing PA2
* invalid values
* values exceeding maximum

### Test

* normal values
* minimum values
* maximum values
* decimal values
* missing values
* invalid values

### Integration

* Google Sheets → Marks Service
* Marks Service → Calculation Engine
* API → Frontend
* Faculty update → Google Sheets

### Authorization

* student sees own marks
* student cannot see another student's marks
* faculty access
* admin access

### Regression

Verify Phases 1–3 remain functional.

---

# 15. UI/UX

The marks module must be:

* fast
* readable
* responsive
* accessible
* suitable for academic data entry

Use:

* clear tables
* sticky table headers where useful
* inline validation
* loading states
* save feedback
* error states
* empty states

Avoid excessive animations.

---

# 16. COMPLETION CHECKLIST

Before completing Phase 4:

* [ ] MSBTE calculation engine implemented
* [ ] Calculation logic isolated
* [ ] Raw marks preserved
* [ ] Validation implemented
* [ ] Google Sheets integration working
* [ ] Faculty marks entry working
* [ ] Student marks view working
* [ ] Analytics working
* [ ] Role restrictions verified
* [ ] Unit tests passing
* [ ] Backend build passing
* [ ] Frontend build passing
* [ ] Previous phases still working

Do NOT start Phase 5 automatically.

Return only:

* changes made
* calculation engine status
* tests/build performed
* remaining issues/blockers
