# Phase 6 — Smart Lecture Scheduler & Holiday Shift Logic

Read:

* `.agent/rules.md`
* `docs/phase-2-users.md`
* `docs/phase-3-google-sheets.md`
* `docs/phase-4-marks-engine.md`
* `docs/phase-5-attendance.md`

## Goal

Implement the complete **Smart Lecture Scheduler** for FacultyHub.

The scheduler must manage weekly faculty timetables and intelligently handle missed lectures caused by holidays.

Do NOT implement Resources, Notices, or Gallery.

---

# 1. SCHEDULER DATA MODEL

Create appropriate Mongoose models for:

### Timetable

Required fields:

* faculty
* subject
* subjectCode
* department
* course
* semester
* division
* academicYear
* dayOfWeek
* startTime
* endTime
* room
* lectureType
* status

lectureType may include:

* theory
* practical
* tutorial

### Lecture

Represent actual scheduled/conducted lecture instances where required.

Fields:

* timetableId
* date
* faculty
* subject
* class/division
* startTime
* endTime
* room
* status

Statuses may include:

* scheduled
* conducted
* holiday
* cancelled
* rescheduled
* missed

### Holiday

Required:

* date
* title/reason
* type
* affected lectures
* status

---

# 2. WEEKLY TIMETABLE

Create a professional weekly timetable.

Display:

```text
Monday
  09:00–10:00  Subject A
  10:00–11:00  Subject B

Tuesday
  09:00–10:00  Subject C
  ...
```

Provide:

* day
* time
* subject
* faculty
* class/division
* room
* lecture type

Faculty should be able to view their own timetable.

Admin should be able to manage timetable configuration.

Students should be able to view their class timetable.

---

# 3. TIMETABLE MANAGEMENT

Faculty/admin with appropriate permissions should be able to:

* create timetable slot
* edit slot
* deactivate slot
* assign subject
* assign faculty
* assign class/division
* assign room
* define day/time

Validate that:

* faculty is valid
* subject is valid
* class/division is valid
* time range is valid
* end time > start time

---

# 4. CONFLICT DETECTION

Prevent timetable conflicts.

Detect:

### Faculty conflict

Same faculty assigned to two lectures at the same time.

### Room conflict

Same room assigned to two lectures at the same time.

### Class conflict

Same class/division assigned to two lectures at the same time.

Reject conflicting schedules unless an authorized override is explicitly supported.

Show a clear conflict message.

---

# 5. HOLIDAY MANAGEMENT

Create a holiday management interface.

Admin/faculty-authorized users can:

* add holiday
* edit holiday
* remove holiday
* view affected lectures

Holiday should be date-specific.

Example:

```text
15 August
Independence Day
Holiday
3 lectures affected
```

---

# 6. HOLIDAY SHIFT LOGIC

This is the core requirement.

When a holiday affects a scheduled lecture:

1. Identify the affected lecture.
2. Mark it as missed because of holiday.
3. Do NOT count it as a conducted lecture.
4. Create a rescheduling requirement.
5. Find an appropriate future slot.
6. Avoid conflicts.
7. Preserve subject/class/faculty relationship.
8. Create a rescheduled lecture.
9. Clearly show the change to faculty and students.

Do not simply move every lecture to the next available day without checking conflicts.

---

# 7. RESCHEDULING STRATEGY

Use deterministic logic.

Suggested priority:

### Priority 1

Find a free slot for the same class/division and subject.

### Priority 2

Prefer an existing timetable slot where the same subject normally occurs.

### Priority 3

Prefer the same faculty's available slot.

### Priority 4

Use the nearest suitable future working day.

### Priority 5

Avoid:

* holidays
* cancelled dates
* existing lectures
* faculty conflicts
* room conflicts
* class conflicts

If no valid slot exists, mark the lecture:

`rescheduling_required`

and show it to faculty/admin.

Do not invent a schedule when no valid slot exists.

---

# 8. RESCHEDULED LECTURE

A rescheduled lecture must retain a reference to the original lecture.

Store:

* originalLectureId
* originalDate
* newDate
* newStartTime
* newEndTime
* reason
* rescheduledBy
* rescheduledAt

This allows the system to explain why the lecture moved.

---

# 9. SCHEDULER APIs

Create protected endpoints.

Timetable:

GET    /api/timetable
POST   /api/timetable
PUT    /api/timetable/:id
DELETE /api/timetable/:id

Lectures:

GET /api/lectures
GET /api/lectures/:id

Holidays:

GET    /api/holidays
POST   /api/holidays
PUT    /api/holidays/:id
DELETE /api/holidays/:id

Rescheduling:

POST /api/lectures/:id/reschedule
GET  /api/lectures/rescheduling-required

Support filters:

* faculty
* student class/division
* subject
* semester
* date
* academic year

---

# 10. FRONTEND PAGES

Create:

### Faculty Timetable

* weekly view
* today's lectures
* upcoming lectures
* rescheduled lectures

### Student Timetable

* class timetable
* today's lectures
* upcoming lectures
* holiday changes

### Admin/Faculty Scheduler

* timetable management
* holiday management
* conflicts
* rescheduling requirements

---

# 11. CALENDAR UX

Provide a useful timetable/calendar interface.

Views may include:

* weekly
* daily
* upcoming

Clearly distinguish:

* normal lecture
* holiday
* cancelled
* rescheduled
* missed

Use consistent status indicators.

Do not make the UI visually complicated.

---

# 12. ATTENDANCE INTEGRATION

Integrate with Phase 5 carefully.

A lecture should be eligible for attendance only when it is a valid conducted lecture.

Holiday/missed lectures must NOT incorrectly reduce attendance percentage.

When a lecture is rescheduled:

* original missed lecture remains traceable
* replacement lecture becomes the valid scheduled session
* attendance can be recorded against the replacement lecture

Do not create duplicate attendance sessions.

---

# 13. ACADEMIC SEQUENCE

When rescheduling:

* preserve subject
* preserve class/division
* preserve faculty
* preserve lecture type
* preserve lecture sequence where possible

Do not arbitrarily replace the subject or faculty.

---

# 14. EDGE CASES

Handle:

* holiday added after timetable creation
* holiday removed
* multiple holidays
* consecutive holidays
* no available rescheduling slot
* faculty unavailable
* room conflict
* class conflict
* overlapping lectures
* rescheduled lecture conflicting with another lecture
* already conducted lecture
* cancelled lecture
* duplicate rescheduling request

The rescheduling operation must be idempotent.

Running it twice must not create duplicate replacement lectures.

---

# 15. SECURITY

Verify:

* students can only view their timetable
* faculty can only modify authorized timetable data
* admin has management access
* students cannot create holidays
* students cannot reschedule lectures

Backend authorization is mandatory.

---

# 16. TESTING

Test:

### Timetable

* create
* update
* delete/deactivate
* weekly retrieval

### Conflicts

* faculty conflict
* room conflict
* class conflict
* valid non-conflicting slot

### Holidays

* create holiday
* affected lecture detection
* holiday removal

### Rescheduling

* normal holiday
* nearest available slot
* conflict avoidance
* no available slot
* multiple holidays
* duplicate prevention
* original/replacement relationship

### Attendance integration

* holiday does not count as conducted
* rescheduled lecture can receive attendance
* no duplicate attendance session

### Authorization

* faculty
* admin
* student restrictions

### Regression

Verify Phases 1–5 continue working.

---

# 17. PERFORMANCE

Avoid recalculating the entire timetable unnecessarily.

Use efficient queries and indexes for:

* date
* faculty
* subject
* division
* room
* academic year

Holiday processing should operate on affected dates/lectures rather than the entire historical dataset.

---

# 18. UI/UX

The scheduler should be:

* easy to scan
* responsive
* calendar-friendly
* visually clear
* usable on desktop/tablet/mobile

Faculty should immediately understand:

* what lecture is next
* which lectures were missed
* which lectures were rescheduled
* which lectures still require rescheduling

Students should immediately understand changes to their timetable.

---

# 19. COMPLETION CHECKLIST

Before completing Phase 6:

* [ ] Timetable model implemented
* [ ] Lecture model implemented
* [ ] Holiday model implemented
* [ ] Weekly timetable working
* [ ] Timetable management working
* [ ] Conflict detection working
* [ ] Holiday management working
* [ ] Holiday shift logic working
* [ ] Rescheduling working
* [ ] Duplicate rescheduling prevented
* [ ] No valid slot handled correctly
* [ ] Attendance integration verified
* [ ] Faculty timetable working
* [ ] Student timetable working
* [ ] Authorization verified
* [ ] Tests passing
* [ ] Backend build passing
* [ ] Frontend build passing
* [ ] Previous phases still working

Do NOT start Phase 7 automatically.

Return only:

* changes made
* scheduler status
* holiday/rescheduling status
* tests/build performed
* remaining issues/blockers
