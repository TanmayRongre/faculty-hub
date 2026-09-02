# Phase 8 — Campus Notice Board

Read:

* `.agent/rules.md`
* `docs/phase-2-users.md`
* `docs/phase-7-resources.md`

## Goal

Implement the complete **Campus Notice Board** for FacultyHub.

Faculty/admin should be able to publish and manage college/departmental notices. Students should have a clean, searchable notice board with clear priority and publication status.

Do NOT implement the Extracurricular Gallery in this phase.

---

# 1. NOTICE DATA MODEL

Create a Mongoose Notice model.

Required fields:

* title
* content
* category
* priority
* department
* course
* semester where applicable
* division where applicable
* academicYear
* attachments where applicable
* publishedBy
* publishDate
* expiryDate where applicable
* status
* createdAt
* updatedAt

Categories:

* Academic
* Examination
* Department
* General
* Event
* Urgent

Priority:

* Normal
* Important
* Urgent

Status:

* Draft
* Published
* Archived
* Expired

---

# 2. NOTICE VISIBILITY

Notices may target:

* entire college
* department
* course
* semester
* division

Students must only see notices relevant to their academic context.

Faculty/admin may see notices they are authorized to manage.

Do not rely only on frontend filtering.

Backend access rules must enforce visibility.

---

# 3. NOTICE LIFECYCLE

Support:

```text
Draft
  ↓
Published
  ↓
Expired / Archived
```

Faculty/admin should be able to:

* create draft
* edit draft
* publish
* edit published notice where authorized
* archive
* delete where appropriate

Do not expose drafts to students.

---

# 4. NOTICE APIs

Create protected endpoints.

```text
GET    /api/notices
GET    /api/notices/:id
POST   /api/notices
PUT    /api/notices/:id
PATCH  /api/notices/:id/publish
PATCH  /api/notices/:id/archive
DELETE /api/notices/:id
```

Student access:

```text
GET /api/notices
GET /api/notices/:id
```

Apply backend visibility filtering automatically based on the authenticated student's academic information.

---

# 5. STUDENT NOTICE BOARD

Create a dedicated Notice Board page.

Recommended structure:

```text
Campus Notice Board

[ Search notices... ]

[Category] [Priority] [Date]

------------------------------------------------
URGENT
Examination Schedule Released
Published: 24 Aug 2026
------------------------------------------------

ACADEMIC
Internal Assessment Notice
Published: 22 Aug 2026
------------------------------------------------
```

Each notice should show:

* title
* category
* priority
* publication date
* expiry date if applicable
* short preview
* attachment indicator where applicable

Urgent notices must be visually distinguishable.

---

# 6. NOTICE DETAILS

Create a dedicated notice-details view.

Display:

* full title
* complete content
* category
* priority
* department
* target audience
* published date
* expiry date
* attachments

Provide attachment open/download actions where applicable.

Do not expose unpublished notices.

---

# 7. SEARCH & FILTERING

Students should be able to search by:

* title
* content

Filters:

* category
* priority
* department
* semester
* date range

Sorting:

* newest first
* oldest first
* priority

Use server-side filtering and pagination.

Do not download all notices into the frontend.

---

# 8. FACULTY/ADMIN NOTICE MANAGEMENT

Create a management interface with:

* notice list
* search
* filters
* status
* create notice
* edit
* publish
* archive
* delete

Show status badges:

* Draft
* Published
* Archived
* Expired

Allow faculty/admin to clearly see which notices are currently visible to students.

---

# 9. NOTICE CREATION FORM

Required:

* title
* content
* category
* priority
* target audience
* department where applicable
* course where applicable
* semester where applicable
* division where applicable

Optional:

* publish date
* expiry date
* attachment

Validate that the selected target scope is logically consistent.

Example:

Do not allow a notice targeted to a division without a valid course/semester/division relationship.

---

# 10. ATTACHMENTS

Allow optional attachments.

Reuse the storage architecture established in Phase 7 where appropriate.

Do not create a second unrelated file-storage implementation.

Validate:

* file type
* file size
* filename

Store attachment metadata separately from notice text.

Use protected access where the notice itself is restricted.

---

# 11. AUTOMATIC EXPIRATION

Support expiry dates.

If:

current date > expiryDate

then the notice should no longer appear as an active student notice.

Do not physically delete expired notices automatically.

Mark them as:

`Expired`

Keep historical records available to authorized faculty/admin.

---

# 12. PRIORITY HANDLING

Priority should affect ordering and presentation.

Recommended ordering:

1. Urgent
2. Important
3. Normal

Within the same priority:

Newest published notice first.

Do not allow a normal notice to visually override an urgent notice.

---

# 13. SECURITY

Verify:

* only authenticated users can access private notices
* students see only published + relevant notices
* students cannot create/edit/delete notices
* faculty can manage only authorized notices
* admin has appropriate management access
* drafts cannot be accessed by students
* expired notices are not treated as active

Backend authorization is mandatory.

---

# 14. VALIDATION

Validate:

* title required
* content required
* valid category
* valid priority
* valid target scope
* valid department
* valid semester
* valid division
* valid dates
* expiryDate must not precede publishDate
* valid attachment

Reject malformed requests.

---

# 15. DASHBOARD INTEGRATION

Update dashboards.

### Student Dashboard

Show:

* latest notices
* urgent notices
* important academic notices

### Faculty Dashboard

Show:

* recent notices
* drafts
* published notices
* notices requiring attention

Keep the dashboard concise.

---

# 16. EMPTY / ERROR STATES

Handle:

* no notices
* no search results
* notice not found
* expired notice
* unauthorized access
* attachment unavailable
* upload failure
* server failure

Use user-friendly messages.

Never expose internal server errors.

---

# 17. PERFORMANCE

Add suitable database indexes for:

* status
* category
* priority
* department
* semester
* publishDate
* expiryDate
* createdAt

Use pagination.

Avoid retrieving expired/irrelevant notices when they are not needed.

---

# 18. TESTING

Test:

### Notice lifecycle

* create draft
* edit draft
* publish
* archive
* expire
* delete

### Visibility

* college-wide notice
* department notice
* course notice
* semester notice
* division notice
* student visibility restrictions

### Search/filter

* title search
* content search
* category
* priority
* date range
* pagination

### Security

* student cannot create notice
* student cannot modify notice
* draft hidden from student
* irrelevant notice hidden
* faculty authorization
* admin authorization

### Expiration

* active notice
* expired notice
* expiry date handling

### Attachments

* valid file
* invalid file
* protected access

### Regression

Verify Phases 1–7 continue working.

---

# 19. UI/UX

The Notice Board should be highly readable.

Prioritize:

* typography
* clear hierarchy
* urgent/important indicators
* search
* filters
* readable notice content
* responsive design

Avoid:

* excessive animations
* oversized cards
* cluttered layouts
* unnecessary modal-heavy workflows

Urgent notices should be noticeable without becoming visually distracting.

---

# 20. COMPLETION CHECKLIST

Before completing Phase 8:

* [ ] Notice model implemented
* [ ] Notice CRUD implemented
* [ ] Draft/publish/archive lifecycle working
* [ ] Student visibility filtering working
* [ ] Notice search working
* [ ] Filters working
* [ ] Pagination working
* [ ] Priority handling working
* [ ] Expiration working
* [ ] Attachments working
* [ ] Faculty/admin management UI working
* [ ] Student Notice Board working
* [ ] Dashboard integration working
* [ ] Backend authorization verified
* [ ] Validation implemented
* [ ] Tests passing
* [ ] Backend build passing
* [ ] Frontend build passing
* [ ] Previous phases still working

Do NOT start Phase 9 automatically.

Return only:

* changes made
* notice board status
* visibility/lifecycle status
* tests/build performed
* remaining issues/blockers
