# Phase 2 — User, Student & Faculty Management

Read:

* `.agent/rules.md`
* `docs/phase-1-auth.md`

## Goal

Build the core user-management layer required by all FacultyHub modules.

Do not implement marks, attendance, timetable, resources, notices, or gallery in this phase.

---

## 1. DATA MODELS

Create appropriate Mongoose models.

### Student

Required fields:

* userId
* enrollmentNumber
* rollNumber
* fullName
* email
* phone
* department
* course
* semester
* academicYear
* division
* admissionYear
* status

Recommended status:

* active
* inactive
* graduated

Add appropriate indexes for:

* enrollmentNumber
* rollNumber
* department
* semester
* division

Enrollment number must be unique.

### Faculty

Required fields:

* userId
* employeeId
* fullName
* email
* phone
* department
* designation
* subjects
* status

Employee ID must be unique.

### Academic Structure

Create reusable models/configuration for:

* Department
* Course
* Semester
* Division
* Subject

Subject should support:

* subjectCode
* subjectName
* semester
* department
* course
* credits where applicable
* assigned faculty

Avoid unnecessary duplication.

---

# 2. USER ↔ PROFILE RELATIONSHIP

Keep authentication data in the User model.

Keep role-specific information in Student/Faculty models.

Example:

User
↓
Student Profile

User
↓
Faculty Profile

Do not duplicate authentication fields unnecessarily.

---

# 3. FACULTY/ADMIN APIs

Implement protected APIs for authorized faculty/admin users.

Student management:

GET    /api/students
GET    /api/students/:id
POST   /api/students
PUT    /api/students/:id
PATCH  /api/students/:id/status
DELETE /api/students/:id

Faculty management:

GET    /api/faculty
GET    /api/faculty/:id
POST   /api/faculty
PUT    /api/faculty/:id
PATCH  /api/faculty/:id/status

Academic structure:

GET/POST/PUT as required for:

* departments
* courses
* semesters
* divisions
* subjects

Apply role authorization to every management endpoint.

---

# 4. STUDENT APIs

Students may access their own profile.

Implement:

GET /api/students/me

Students must NOT be able to:

* list all students
* modify another student's profile
* access another student's private information

Faculty/admin may access authorized student records.

---

# 5. SEARCH & FILTERING

Student listing should support:

* search by name
* roll number
* enrollment number
* department
* semester
* division
* status

Faculty listing should support:

* name
* employee ID
* department
* designation
* status

Use backend filtering rather than downloading every record to the frontend.

Add pagination for large datasets.

---

# 6. FRONTEND

Create faculty/admin management pages:

* Students
* Student Details
* Add Student
* Edit Student
* Faculty
* Faculty Details
* Academic Structure
* Subjects

Student-facing page:

* My Profile

Use reusable components for:

* Data tables
* Search
* Filters
* Pagination
* Forms
* Modal/dialog
* Status badges
* Confirmation dialogs

---

# 7. STUDENT DETAIL PAGE

Faculty/admin should see:

### Basic Information

* Name
* Roll number
* Enrollment number
* Email
* Phone

### Academic Information

* Course
* Department
* Semester
* Division
* Academic year

### Quick Access

Reserve sections/cards for future modules:

* Academic Performance
* Attendance
* Timetable
* Resources

Do NOT implement those modules yet.

Use appropriate empty/placeholder states.

---

# 8. VALIDATION

Student:

* enrollment number required + unique
* roll number required
* name required
* valid email
* valid semester
* valid division
* valid academic year

Faculty:

* employee ID required + unique
* name required
* valid email
* department required

Reject invalid input on the backend.

Frontend validation should improve UX but must not replace backend validation.

---

# 9. DATA INTEGRITY

Prevent:

* duplicate enrollment numbers
* duplicate employee IDs
* invalid student references
* invalid faculty references
* assigning nonexistent subjects
* deleting records that are referenced by active academic data

Prefer soft deactivation where appropriate instead of destructive deletion.

---

# 10. UI REQUIREMENTS

Faculty/admin student-management interface should provide:

* clean table
* search
* filters
* pagination
* add student
* edit student
* view details
* active/inactive status
* confirmation before destructive actions

Student profile should be clean and read-focused.

Maintain FacultyHub's existing design system.

---

# 11. TESTING

Test:

### Students

* create
* read
* update
* deactivate
* duplicate enrollment prevention
* invalid data
* search
* filtering
* pagination

### Faculty

* create
* read
* update
* deactivate
* duplicate employee prevention

### Authorization

* admin access
* faculty access
* student restrictions
* unauthorized API requests

### Relationships

* User ↔ Student
* User ↔ Faculty
* Subject ↔ Faculty
* Student academic structure

### Regression

* Phase 1 authentication must continue working.

---

# 12. COMPLETION

Before finishing:

1. Run backend tests/build.
2. Run frontend build.
3. Verify APIs.
4. Verify role restrictions.
5. Verify forms and validation.
6. Verify responsive UI.
7. Fix errors found during testing.
8. Do not implement Phase 3 functionality.

Return only:

* changes made
* tests/build performed
* remaining issues
