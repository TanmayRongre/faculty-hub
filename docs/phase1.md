# Phase 1 — Authentication & RBAC

Read:

* `.agent/rules.md`

## Goal

Build secure authentication and role-based access control for FacultyHub.

## Roles

* faculty
* admin
* student

## Backend

Create:

* User model
* authentication controller
* auth routes
* auth middleware
* role authorization middleware
* password hashing
* JWT generation/verification

Required endpoints:

POST /api/auth/register
POST /api/auth/login
GET /api/auth/me

Implement:

* email validation
* password validation
* duplicate email prevention
* hashed passwords
* JWT authentication
* protected routes
* role-based authorization

## Frontend

Create:

* Login page
* authentication context/state
* protected route component
* role-based route handling
* logout
* session persistence

After login:

* faculty/admin → faculty dashboard
* student → student dashboard

## Security

* Never store plaintext passwords.
* Never trust frontend role checks.
* Verify JWT on protected backend routes.
* Return appropriate HTTP status codes.
* Do not expose password hashes.
* Keep JWT secret in `.env`.

## UX

Login page must include:

* email
* password
* show/hide password
* validation
* loading state
* error message
* successful redirect

## Verification

Test:

* valid login
* invalid password
* nonexistent user
* duplicate registration
* protected API
* student accessing faculty route
* faculty accessing student-only data
* logout
* expired/invalid token

Do not proceed to Phase 2 until Phase 1 builds and works.
