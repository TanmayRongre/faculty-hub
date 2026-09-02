# FacultyHub Agent Rules

## Identity

project: FacultyHub
type: Diploma/Polytechnic Academic & Campus Portal
goal: Production-quality MERN application for faculty + students

## Stack

frontend: React + Vite + Tailwind CSS
backend: Node.js + Express
database: MongoDB + Mongoose
auth: JWT + bcrypt
academic_data: Google Sheets API / Apps Script
api_style: REST

## Architecture

* MongoDB = application/system data.
* Google Sheets = designated academic-record data layer.
* Backend is the only layer allowed to access Google credentials.
* Never expose Google credentials/API secrets to frontend.
* Use .env for secrets/configuration.
* Keep Google Sheets integration isolated in backend services.
* Keep business logic separate from controllers/routes.
* Reuse components and services; avoid duplicate logic.

## Roles

faculty_admin:
permissions:
- student management
- marks management
- attendance management
- timetable management
- resource management
- notice management
- gallery moderation
- academic analytics

student:
permissions:
- own marks
- own attendance
- timetable
- resources
- notices
- extracurricular submissions
- approved gallery

security:

* enforce authorization on backend
* students can only access their own academic data
* never trust frontend role checks alone
* hash passwords
* validate input
* protect API routes
* never hardcode secrets

## Core Modules

1. MSBTE Marks Engine
2. Fast Attendance
3. Smart Scheduler
4. Resources Repository
5. Notice Board
6. Extracurricular Gallery

Do not add unrelated ERP/LMS/CRM functionality unless explicitly requested.

## MSBTE Marks

PA:
inputs: [PA1, PA2]
calculation: "(PA1 + PA2) / 2"
evaluation: "convert/scale according to applicable 30-mark MSBTE structure"

Test:
inputs: [Test1, Test2]
evaluation: "apply required 30-mark scaling"

Rules:

* keep calculation logic in reusable service
* validate ranges
* distinguish raw vs calculated marks
* never silently modify values
* support student/subject analytics

## Attendance

default_state: Present
faculty_action: select absent students
defaulter_threshold: "<75%"

formula: "(classes_attended / total_classes) * 100"

required:

* lecture/date/subject selection
* roll number + name
* fast absent marking
* edit capability
* subject percentage
* overall percentage
* defaulter identification

Never require faculty to manually mark every student Present.

## Scheduler

required:

* weekly timetable
* day/time/subject/class/division/room/faculty
* holiday detection
* missed lecture identification
* rescheduling
* duplicate prevention
* academic sequence preservation

Prefer deterministic scheduling logic over unnecessary AI.

## Resources

categories:

* syllabus
* notes
* reference_pdf
* lab_manual
* question_paper
* practical_material
* other

Store metadata in MongoDB.
Use scalable external/cloud file storage architecture where appropriate.

## Notices

categories:

* academic
* examination
* department
* general
* event
* urgent

faculty_admin:

* create
* edit
* delete
* publish

students:

* view
* filter
* search

## Gallery

student_submission:
fields:
- title
- description
- date
- category
- images

moderation:
states: [pending, approved, rejected]

Only approved submissions are publicly displayed.

## UI/UX

style:

* modern
* clean
* responsive
* professional
* consistent

include:

* sidebar navigation
* dashboard
* tables
* cards
* charts where useful
* loading states
* empty states
* error states
* toast notifications
* confirmation dialogs

avoid:

* excessive gradients
* unnecessary animations
* bloated dashboards
* inconsistent spacing
* generic-looking CRUD UI

## Engineering Rules

Before modifying:

1. inspect relevant files
2. understand existing architecture
3. identify dependencies
4. preserve working functionality
5. implement only required changes

After modifying:

1. run tests/build
2. fix errors
3. verify affected feature
4. verify existing functionality
5. check authorization
6. check responsive UI

Never rewrite working code unnecessarily.

## Agent Behaviour

* Work directly on repository files.
* Do not print full code files in chat.
* Do not dump file contents during inspection.
* Do not repeatedly ask permission for normal development operations.
* Create/edit/install/run/test as required.
* Do not perform destructive or irreversible actions without confirmation.
* Do not invent requirements.
* Do not change architecture without justification.
* Prefer small, verifiable changes.

## Chat Output

After implementation, return only:

1. What changed
2. Tests/build performed
3. Any remaining issue/blocker

Keep response concise.
Never paste full implementations unless explicitly requested.

## Source Of Truth

For the current task:

* Read this file first.
* Then read ONLY the active phase/task file.
* Inspect repository files as needed.
* Do not load unrelated phase specifications.

## Completion Standard

A feature is complete only when:

* implementation exists
* frontend works
* backend works
* data flow works
* validation exists
* authorization exists
* errors are handled
* build/tests pass
* existing features remain functional
