# Phase 5 — Fast Attendance System & Analytics

Read:

* `.agent/rules.md`
* `docs/phase-2-users.md`
* `docs/phase-3-google-sheets.md`
* `docs/phase-4-marks-engine.md`

## Goal

Implement the complete **Fast Attendance System & Attendance Analytics** for FacultyHub.

The primary UX requirement is:

> Faculty marks attendance by selecting only absent students. Every student is Present by default.

Do NOT implement Scheduler, Resources, Notices, or Gallery.

---

# 1. ATTENDANCE DATA FLOW

Use:

Google Sheets
↓
Google Sheets Service
↓
Attendance Service
↓
Attendance Calculator
↓
REST API
↓
React Attendance UI

Keep attendance business logic in backend services.

Do not calculate official attendance percentages only in React.

---

# 2. ATTENDANCE RECORD

Each attendance record must be associated with:

* date
* lectureId
* subject
* subjectCode
* faculty
* department
* course
* semester
* academicYear
* division
* student
* enrollmentNumber
* rollNumber
* status

Allowed status:

* Present
* Absent

Use consistent identifiers.

Do not rely only on student names.

---

# 3. FAST ATTENDANCE UX

Create a dedicated attendance marking page.

Faculty selects:

1. Date
2. Subject
3. Class/course
4. Semester
5. Division
6. Lecture/time slot

Then load the student list.

### REQUIRED DEFAULT

Every loaded student must initially be:

**Present**

Faculty only clicks students who are absent.

Example:

```text
01  Student A     PRESENT
02  Student B     PRESENT
03  Student C     PRESENT
04  Student D     PRESENT
```

After clicking Student C:

```text
01  Student A     PRESENT
02  Student B     PRESENT
03  Student C     ABSENT
04  Student D     PRESENT
```

Do NOT require faculty to manually mark Present for every student.

---

# 4. ATTENDANCE UI

Optimize the page for very fast classroom usage.

Display:

* Roll number
* Student name
* Attendance status

Make the entire student row or a clear status control clickable.

Provide:

* clear Present/Absent visual state
* search by roll number/name
* quick absent selection
* count of present students
* count of absent students
* total students
* save attendance button

Example summary:

```text
Total: 60
Present: 56
Absent: 4
```

Do not hide important information behind unnecessary dialogs.

---

# 5. SAVE WORKFLOW

When faculty clicks Save:

1. Validate lecture.
2. Validate subject.
3. Validate student list.
4. Validate attendance states.
5. Save/update attendance records.
6. Synchronize with Google Sheets.
7. Confirm successful save.
8. Prevent accidental duplicate attendance.

If synchronization fails, show a clear failure state.

Do not falsely display "Attendance Saved" if the required academic-data write failed.

---

# 6. DUPLICATE PREVENTION

An attendance record should be uniquely identifiable using the appropriate combination of:

* date
* lecture
* subject
* division
* student

Prevent duplicate attendance records for the same lecture.

If attendance already exists:

* load existing attendance
* allow authorized faculty to edit it
* update instead of creating duplicates

---

# 7. BACKEND APIs

Create protected endpoints.

Suggested:

GET /api/attendance/lecture/:lectureId

POST /api/attendance/lecture/:lectureId

PUT /api/attendance/lecture/:lectureId

GET /api/attendance/student/:studentId

GET /api/attendance/me

GET /api/attendance/summary

GET /api/attendance/defaulters

Support filters:

* student
* subject
* semester
* division
* academic year
* date range

Students:

* own attendance only

Faculty/admin:

* authorized class/subject attendance

---

# 8. ATTENDANCE CALCULATION

Use:

```text
Attendance % =
(Classes Attended / Total Classes Conducted) × 100
```

Calculate:

* subject-wise attendance
* overall attendance
* attended lectures
* absent lectures
* total conducted lectures

Do not count future or unconducted lectures.

---

# 9. DEFAULTER LOGIC

Default threshold:

```text
< 75%
```

Students below 75% must be flagged as defaulters.

Example:

```text
Student A — 82% — Safe
Student B — 74% — Defaulter
Student C — 61% — Defaulter
```

Keep the threshold configurable.

Do not hardcode the threshold in multiple components.

---

# 10. ATTENDANCE ANALYTICS

Create a student attendance page.

Show:

### Overall

* attendance percentage
* total lectures
* attended
* absent
* defaulter status

### Subject-wise

Table:

```text
Subject | Total | Present | Absent | Percentage | Status
```

### Visual analytics

Use useful charts such as:

* subject-wise attendance
* present vs absent
* attendance trend over time

Do not create charts if there is insufficient data.

---

# 11. FACULTY ATTENDANCE DASHBOARD

Faculty should be able to see:

* today's attendance
* attendance by subject
* class attendance percentage
* students below 75%
* recent attendance sessions

Provide a defaulter list with:

* roll number
* student name
* subject
* attendance %
* attended
* total lectures

---

# 12. GOOGLE SHEETS STRUCTURE

Use the Phase 3 Google Sheets integration.

Recommended Attendance columns:

```text
date
lectureId
subjectCode
subjectName
facultyId
department
semester
division
enrollmentNumber
rollNumber
status
```

Do not create a separate Google API implementation.

Reuse the existing Google Sheets service.

---

# 13. DATA CONSISTENCY

MongoDB:

* student identity
* faculty identity
* subject metadata
* class structure
* lecture references

Google Sheets:

* designated attendance records

Attendance percentage must be calculated from valid attendance records.

Do not manually store conflicting percentages unless there is a clear reason.

If summary values are cached, they must be reproducible.

---

# 14. EDGE CASES

Handle:

* no students found
* no attendance history
* attendance already marked
* duplicate records
* missing student
* invalid lecture
* invalid subject
* invalid date
* Google Sheets unavailable
* partial synchronization failure
* student transferred/inactive
* cancelled lecture

Important:

A cancelled/non-conducted lecture must NOT reduce attendance percentage.

---

# 15. EDIT ATTENDANCE

Authorized faculty should be able to reopen an existing attendance session.

When editing:

* load existing records
* preserve unchanged students
* allow status changes
* update Google Sheets correctly
* prevent duplicate rows

Show a confirmation before changing already submitted attendance if appropriate.

---

# 16. PERFORMANCE

Attendance may contain large student lists.

Optimize for:

* fast initial loading
* minimal API requests
* batch Google Sheets operations
* efficient database queries
* indexed attendance fields

Avoid making one Google API request per student.

Use batch operations where possible.

---

# 17. SECURITY

Verify:

* student can only access own attendance
* faculty can only modify authorized attendance
* admin has appropriate access
* unauthorized users cannot submit attendance
* frontend cannot override backend authorization

Do not trust studentId/facultyId supplied by the frontend without authorization checks.

---

# 18. VALIDATION

Validate:

* lecture exists
* subject exists
* student belongs to selected class/division
* faculty is authorized
* status is Present/Absent
* date is valid
* attendance session is valid

Reject malformed or unauthorized attendance submissions.

---

# 19. TESTING

Create tests for:

### Attendance marking

* all students default Present
* selected students become Absent
* save attendance
* edit attendance
* duplicate prevention

### Calculation

* 100%
* 75%
* below 75%
* 0%
* no attendance records
* multiple subjects

### Defaulters

* exactly 75% → not a defaulter
* 74.99% → defaulter
* below 75% → defaulter

### Authorization

* student sees own attendance
* student cannot see another student's attendance
* student cannot modify attendance
* faculty can modify authorized attendance
* unauthorized faculty rejected

### Google Sheets

* attendance write
* batch update
* synchronization failure
* duplicate prevention

### Regression

Verify Phases 1–4 continue working.

---

# 20. UI/UX QUALITY

The attendance screen is a high-frequency faculty workflow.

Prioritize:

* minimal clicks
* large clear status controls
* fast search
* keyboard-friendly interaction where practical
* clear save state
* clear error messages
* mobile/tablet responsiveness

Avoid:

* unnecessary confirmation dialogs during normal marking
* complicated multi-step forms
* excessive animations
* forcing faculty to mark every Present student individually

---

# 21. COMPLETION CHECKLIST

Before completing Phase 5:

* [ ] Attendance data model/service implemented
* [ ] Fast attendance page implemented
* [ ] All students default Present
* [ ] Faculty can mark only absentees
* [ ] Attendance saved correctly
* [ ] Existing attendance can be edited
* [ ] Duplicate attendance prevented
* [ ] Google Sheets synchronization working
* [ ] Subject-wise percentage working
* [ ] Overall percentage working
* [ ] <75% defaulter logic working
* [ ] Student attendance dashboard working
* [ ] Faculty attendance analytics working
* [ ] Authorization verified
* [ ] Validation implemented
* [ ] Tests passing
* [ ] Backend build passing
* [ ] Frontend build passing
* [ ] Previous phases still working

Do NOT start Phase 6 automatically.

Return only:

* changes made
* attendance functionality status
* tests/build performed
* remaining issues/blockers
