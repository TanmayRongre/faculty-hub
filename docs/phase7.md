# Phase 7 — Resource & Notes Repository

Read:

* `.agent/rules.md`
* `docs/phase-2-users.md`
* `docs/phase-6-scheduler.md`

## Goal

Implement the complete **Resource & Notes Repository** for FacultyHub.

Faculty/admin should be able to upload and manage academic resources, while students should have a clean, searchable repository for accessing them.

Do NOT implement Notices or Extracurricular Gallery in this phase.

---

# 1. RESOURCE TYPES

Support:

* Syllabus
* Notes
* Reference PDF
* Lab Manual
* Question Paper
* Practical Material
* Other Academic Resource

Each resource must have appropriate metadata.

---

# 2. RESOURCE DATA MODEL

Create a Mongoose Resource model.

Required fields:

* title
* description
* category
* subject
* subjectCode
* department
* course
* semester
* division where applicable
* academicYear
* uploadedBy
* fileName
* fileType
* fileSize
* fileUrl/storageReference
* visibility
* status
* createdAt
* updatedAt

Suggested status:

* active
* archived

Visibility may support:

* department
* course
* semester
* division
* specific class where required

Do not duplicate unnecessary student data inside resources.

---

# 3. FILE STORAGE ARCHITECTURE

Do NOT store large files directly inside MongoDB.

Separate:

MongoDB
→ resource metadata

File storage
→ actual file

Create a storage abstraction such as:

```text
backend/src/services/storage/
    storageService
    localStorage
    cloudStorage
```

The implementation should be replaceable later with a cloud provider without rewriting the Resource module.

For local development, a safe local-storage implementation may be used if appropriate.

Do not expose internal filesystem paths to students.

---

# 4. FILE VALIDATION

Validate uploads before storing them.

Support common academic formats such as:

* PDF
* DOC/DOCX
* PPT/PPTX
* XLS/XLSX
* images where appropriate

Define reasonable file-size limits.

Reject:

* unsupported file types
* corrupted uploads
* missing files
* suspicious filenames
* invalid metadata

Never trust the MIME type supplied by the browser alone.

Sanitize filenames.

---

# 5. FACULTY RESOURCE MANAGEMENT

Faculty/admin should be able to:

* upload resource
* view uploaded resources
* edit metadata
* archive resource
* restore resource where appropriate
* delete resource when authorized

Upload form:

* title
* description
* category
* subject
* semester
* academic year
* division/class where applicable
* file

Show upload progress where practical.

---

# 6. RESOURCE APIs

Create protected endpoints.

```text
GET    /api/resources
GET    /api/resources/:id
POST   /api/resources
PUT    /api/resources/:id
PATCH  /api/resources/:id/archive
DELETE /api/resources/:id
GET    /api/resources/:id/download
```

Apply role-based authorization.

Students:

* list accessible resources
* view resource details
* download/open accessible files

Faculty/admin:

* manage authorized resources

---

# 7. ACCESS CONTROL

Students must only see resources relevant to their academic context.

Determine visibility using appropriate combinations of:

* department
* course
* semester
* division
* subject

Do not allow students to access an arbitrary resource by manually changing an ID in the URL.

Backend authorization must verify resource access.

---

# 8. SEARCH & FILTERING

The student repository must support:

### Search

* title
* description
* subject
* subject code

### Filters

* category
* subject
* semester
* academic year
* resource type

### Sorting

Useful options:

* newest
* oldest
* alphabetical
* recently updated

Use server-side filtering/pagination.

Do not load the entire repository into the browser.

---

# 9. STUDENT RESOURCE UI

Create a clean repository page.

Recommended layout:

```text
Resources

[ Search resources... ]

[Category] [Subject] [Semester] [Sort]

------------------------------------------------
| Notes       | Subject A | Updated 2 days ago |
------------------------------------------------
| Lab Manual  | Subject B | Updated 1 week ago|
------------------------------------------------
```

Each resource should show:

* title
* category
* subject
* file type
* file size
* upload/update date
* uploader where appropriate
* open/download action

---

# 10. RESOURCE DETAILS

Create a resource details view containing:

* title
* description
* subject
* category
* semester
* academic year
* file type
* file size
* upload date
* updated date
* download/open button

Do not expose sensitive uploader information unnecessarily.

---

# 11. DOWNLOAD / FILE ACCESS

Do not simply expose unrestricted storage URLs if the resource is private.

Preferred flow:

Student
↓
GET /api/resources/:id/download
↓
Backend authorization
↓
Storage service
↓
File response/secure URL

Verify that the requesting user has access before returning the file.

---

# 12. RESOURCE MANAGEMENT UI

Faculty/admin page should provide:

* resource table/grid
* search
* filters
* upload
* edit
* archive
* delete
* pagination

Show clear status:

* Active
* Archived

Use confirmation dialogs for destructive operations.

---

# 13. EMPTY / ERROR STATES

Handle:

* no resources
* no search results
* failed upload
* failed download
* missing file
* inaccessible resource
* deleted/archived resource
* storage failure
* invalid file

Show useful user-facing messages.

Do not expose server stack traces.

---

# 14. SECURITY

Implement:

* authenticated upload
* role-based management
* backend access checks
* filename sanitization
* upload validation
* file-size limits
* protected download
* no credential exposure
* no arbitrary filesystem access

Never construct filesystem paths directly from untrusted user input.

Prevent path traversal.

---

# 15. PERFORMANCE

Optimize resource browsing using:

* pagination
* database indexes
* filtered queries
* efficient metadata retrieval

Recommended indexes:

* subject
* category
* semester
* department
* academicYear
* createdAt

Do not repeatedly query MongoDB for the same resource metadata unnecessarily.

---

# 16. DASHBOARD INTEGRATION

Update dashboards with useful resource information.

### Student

Show:

* latest resources
* recently updated notes
* subject resources

### Faculty

Show:

* recently uploaded resources
* resource count
* recently updated resources

Do not overload dashboards.

---

# 17. TESTING

Test:

### Upload

* valid PDF
* valid document
* unsupported type
* oversized file
* missing file
* invalid metadata

### Resource Management

* create
* read
* update
* archive
* delete

### Access Control

* student accesses permitted resource
* student denied unauthorized resource
* faculty upload
* faculty unauthorized management denied
* admin access

### Search

* title
* subject
* category
* semester
* combined filters
* pagination

### Download

* authorized download
* unauthorized download
* missing file
* storage failure

### Regression

Verify Phases 1–6 continue working.

---

# 18. UI/UX

The repository should feel like a modern academic resource library.

Prioritize:

* clear categories
* search-first experience
* useful filters
* readable metadata
* responsive layout
* fast navigation
* obvious download/open actions

Use appropriate icons and file-type indicators.

Avoid unnecessary animations and excessive card decoration.

---

# 19. COMPLETION CHECKLIST

Before completing Phase 7:

* [ ] Resource model implemented
* [ ] Storage abstraction implemented
* [ ] File validation implemented
* [ ] Faculty upload working
* [ ] Resource metadata management working
* [ ] Student repository working
* [ ] Search working
* [ ] Filtering working
* [ ] Pagination working
* [ ] Access control working
* [ ] Protected download working
* [ ] Archive/delete working
* [ ] Dashboard integration working
* [ ] Error/empty states implemented
* [ ] Security checks implemented
* [ ] Tests passing
* [ ] Backend build passing
* [ ] Frontend build passing
* [ ] Previous phases still working

Do NOT start Phase 8 automatically.

Return only:

* changes made
* resource repository status
* storage/upload status
* tests/build performed
* remaining issues/blockers
