# Phase 9 — Extracurricular Gallery & Activity Submissions

Read:

* `.agent/rules.md`
* `docs/phase-2-users.md`
* `docs/phase-7-resources.md`
* `docs/phase-8-notices.md`

## Goal

Implement the complete **Student Extracurricular Activity Gallery** for FacultyHub.

Students can submit campus activity/event photos and information. Faculty/admin can review submissions and approve or reject them. Only approved content appears in the public student gallery.

Do NOT implement new major modules in this phase.

---

# 1. ACTIVITY DATA MODEL

Create a Mongoose Activity/Gallery model.

Required fields:

* title
* description
* category
* eventDate
* submittedBy
* department
* course
* semester
* division
* academicYear
* images
* status
* reviewedBy
* reviewedAt
* rejectionReason where applicable
* createdAt
* updatedAt

Categories may include:

* Sports
* Cultural
* Technical
* Workshop
* Seminar
* Competition
* Club Activity
* Social Activity
* Other

Status:

* Pending
* Approved
* Rejected

---

# 2. SUBMISSION FLOW

Use:

Student
↓
Create Activity Submission
↓
Pending
↓
Faculty/Admin Review
↓
Approved / Rejected
↓
Approved → Gallery

Rejected submissions must NOT appear in the student-facing public gallery.

---

# 3. STUDENT SUBMISSION

Create a submission page.

Required:

* activity title
* description
* category
* event date
* images

Academic context should be derived from the authenticated student where possible:

* submittedBy
* department
* course
* semester
* division
* academicYear

Do not allow students to freely submit another student's identity.

---

# 4. IMAGE UPLOAD

Reuse the storage architecture from Phase 7.

Do not create a separate unrelated storage system.

Support common image formats:

* JPG/JPEG
* PNG
* WEBP

Validate:

* file type
* file size
* file count
* image metadata

Set reasonable limits to prevent abuse.

Sanitize filenames.

Do not trust client-provided MIME types alone.

---

# 5. IMAGE STORAGE

MongoDB should store:

* image metadata
* storage reference
* URL/reference where appropriate

Actual image files should be stored through the storage abstraction.

Do not store large image binaries directly in MongoDB.

---

# 6. STUDENT APIs

Create protected endpoints.

```text id="w8p1cj"
POST /api/gallery
GET  /api/gallery
GET  /api/gallery/:id
GET  /api/gallery/my-submissions
```

Student GET requests must respect publication/moderation rules.

`my-submissions` may show the student's:

* Pending
* Approved
* Rejected

submissions.

Do not expose internal moderation information unnecessarily.

---

# 7. FACULTY/ADMIN MODERATION APIs

Create protected endpoints.

```text id="u1v7pq"
GET   /api/gallery/moderation
GET   /api/gallery/:id
PATCH /api/gallery/:id/approve
PATCH /api/gallery/:id/reject
DELETE /api/gallery/:id
```

Faculty/admin should be able to:

* view pending submissions
* inspect images
* review details
* approve
* reject
* delete where authorized

Where possible, faculty should only moderate submissions within their authorized academic scope unless they are admin.

---

# 8. MODERATION WORKFLOW

### Pending

Submission is awaiting review.

### Approved

Submission is visible in the student gallery.

### Rejected

Submission is hidden from the public gallery.

When rejecting:

* require/select a rejection reason where appropriate
* store reviewer
* store review timestamp

Students should be able to see that their submission was rejected and the reason, but do not expose internal reviewer information unnecessarily.

---

# 9. PUBLIC STUDENT GALLERY

Create a modern gallery page.

Recommended:

```text id="r5l7wo"
Extracurricular Gallery

[ Search... ]
[Category] [Year] [Department]

┌────────────┐ ┌────────────┐ ┌────────────┐
│   Image    │ │   Image    │ │   Image    │
│ Activity A │ │ Activity B │ │ Activity C │
└────────────┘ └────────────┘ └────────────┘
```

Show only:

`status = Approved`

Each gallery item should show:

* image
* title
* category
* event date
* short description
* academic context where appropriate

---

# 10. GALLERY DETAILS

Create an activity-details view.

Show:

* title
* images
* description
* category
* event date
* department/course context
* submission information where appropriate

Provide an image viewer/lightbox where useful.

Do not make the page unnecessarily heavy.

---

# 11. SEARCH & FILTERING

Support:

### Search

* activity title
* description

### Filters

* category
* department
* academic year
* semester
* date/year

### Sorting

* newest
* oldest
* event date

Use server-side filtering and pagination where appropriate.

---

# 12. MODERATION DASHBOARD

Create a faculty/admin moderation interface.

Show:

* pending count
* pending submissions
* approved count
* rejected count

Pending list should show:

* image thumbnail
* activity title
* category
* event date
* submitted student
* department
* submission date
* current status

Provide:

* View
* Approve
* Reject
* Delete where authorized

---

# 13. STUDENT SUBMISSION STATUS

Create a page/section for the student's own submissions.

Display:

```text id="y0q4yr"
Activity              Status
--------------------------------
Tech Fest             Approved
Sports Day            Pending
Workshop              Rejected
```

For rejected submissions:

Show the rejection reason clearly.

Do not expose unrelated moderation records.

---

# 14. SECURITY

Verify:

* only authenticated students can submit
* students can only manage/view their own submissions where applicable
* students cannot approve submissions
* students cannot change submission owner
* students cannot directly set status to Approved
* faculty/admin authorization is enforced
* only approved activities appear publicly

Do not rely on frontend controls for moderation security.

---

# 15. VALIDATION

Validate:

* title required
* description required
* category valid
* event date valid
* image required
* image count within limit
* file type valid
* file size valid
* student identity derived from authenticated user

Reject malformed requests.

---

# 16. DUPLICATE / SPAM HANDLING

Prevent obvious duplicate submissions where practical.

Do not create aggressive duplicate detection that incorrectly rejects legitimate activities.

Provide reasonable limits such as:

* maximum images per submission
* maximum upload size
* rate limiting where appropriate

Keep these values configurable.

---

# 17. DASHBOARD INTEGRATION

Update dashboards.

### Student Dashboard

Show:

* recent approved activities
* student's latest submissions
* submission statuses

### Faculty Dashboard

Show:

* pending gallery submissions
* recent approved submissions
* moderation count

Keep dashboard widgets concise.

---

# 18. PERFORMANCE

Gallery pages may contain many images.

Optimize using:

* pagination/infinite loading where appropriate
* image thumbnails
* lazy loading
* optimized image delivery
* database indexes
* server-side filtering

Do not load every original-resolution image immediately.

---

# 19. ACCESSIBILITY

Provide:

* meaningful image alt text
* keyboard-accessible controls
* accessible modal/lightbox
* clear status labels
* readable text contrast
* accessible form validation

Do not rely solely on color to communicate:

* Pending
* Approved
* Rejected

---

# 20. TESTING

Test:

### Student submission

* valid submission
* missing title
* missing image
* invalid image
* oversized image
* excessive image count

### Moderation

* pending submission
* approve
* reject
* rejection reason
* unauthorized approval attempt
* unauthorized deletion

### Visibility

* pending hidden
* rejected hidden
* approved visible

### Student ownership

* student sees own submissions
* student cannot modify another student's submission
* student cannot change owner/status

### Search/filter

* category
* department
* year
* search
* pagination

### Regression

Verify Phases 1–8 continue working.

---

# 21. UI/UX

The gallery should feel like a modern campus showcase.

Prioritize:

* attractive image presentation
* clean cards
* responsive grid
* useful filtering
* fast loading
* clear moderation states

Avoid:

* excessive animations
* oversized image files
* cluttered cards
* unnecessary social-media-style features

This is an academic/campus gallery, not a social network.

---

# 22. COMPLETION CHECKLIST

Before completing Phase 9:

* [ ] Gallery model implemented
* [ ] Student submission implemented
* [ ] Image upload implemented
* [ ] Storage abstraction reused
* [ ] Submission validation implemented
* [ ] Pending/Approved/Rejected workflow working
* [ ] Faculty moderation working
* [ ] Rejection reason working
* [ ] Student submission-status page working
* [ ] Approved gallery working
* [ ] Search working
* [ ] Filters working
* [ ] Pagination working
* [ ] Image optimization/lazy loading implemented
* [ ] Access control verified
* [ ] Dashboard integration working
* [ ] Tests passing
* [ ] Backend build passing
* [ ] Frontend build passing
* [ ] Previous phases still working

Do NOT start Phase 10 automatically.

Return only:

* changes made
* gallery/moderation status
* upload/storage status
* tests/build performed
* remaining issues/blockers
