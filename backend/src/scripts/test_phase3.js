/**
 * test_phase3.js
 *
 * Automated test runner for Phase 3 — Google Sheets Integration.
 *
 * Tests:
 *   1. Configuration check (missing vs. configured)
 *   2. Authorization on each sheets endpoint
 *   3. Graceful error handling when Google Sheets is not configured
 *   4. Phase 1 + Phase 2 regression
 *
 * Usage:
 *   node src/scripts/test_phase3.js
 *
 * Requires the backend to be running on PORT (default 5000).
 * Requires the Phase 1/2 seed accounts to exist.
 */

const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
let passed = 0;
let failed = 0;

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function section(title, fn) {
  console.log(`\n━━━ ${title} ━━━`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ⚠️  Section error: ${err.message}`);
    failed++;
  }
}

async function login(email, password) {
  const res = await request('POST', '/auth/login', { email, password });
  if (res.status !== 200 || !res.body.token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('FacultyHub Phase 3 — Google Sheets Integration Tests');
  console.log('='.repeat(55));

  // ── 0. Health check ─────────────────────────────────────────────────────────
  await section('Server Health', async () => {
    const res = await request('GET', '/health');
    assert(res.status === 200, 'Server is running');
  });

  // ── 1. Login accounts ────────────────────────────────────────────────────────
  let adminToken, facultyToken, studentToken;
  await section('Login Accounts', async () => {
    adminToken = await login('admin@facultyhub.dev', 'Admin@1234');
    assert(!!adminToken, 'Admin login succeeds');

    facultyToken = await login('faculty@facultyhub.dev', 'Faculty@1234');
    assert(!!facultyToken, 'Faculty login succeeds');

    studentToken = await login('student@facultyhub.dev', 'Student@1234');
    assert(!!studentToken, 'Student login succeeds');
  });

  // ── 2. Configuration status ──────────────────────────────────────────────────
  await section('Google Sheets Configuration Status', async () => {
    const res = await request('GET', '/sheets/status', null, adminToken);
    assert(res.status === 200, `Status endpoint returns 200 (got ${res.status})`);
    assert(typeof res.body.configured === 'boolean', 'Response has "configured" boolean');

    if (!res.body.configured) {
      console.log('  ℹ️  Google Sheets is not configured — expected in dev without credentials');
      assert(Array.isArray(res.body.missing), 'Missing variables listed');
    } else {
      assert(res.body.connected !== undefined, 'Connection status present');
      console.log(`  ℹ️  Spreadsheet: ${res.body.spreadsheetTitle || 'connected'}`);
    }
  });

  // ── 3. Authorization — Sheets endpoints ──────────────────────────────────────
  await section('Authorization — Sheets Endpoints', async () => {
    // Unauthenticated request must be rejected
    let res = await request('GET', '/sheets/status');
    assert(res.status === 401, 'Unauthenticated GET /sheets/status → 401');

    // Student cannot access admin-only status
    res = await request('GET', '/sheets/status', null, studentToken);
    assert(res.status === 403, 'Student cannot access /sheets/status → 403');

    // Faculty cannot access admin-only status
    res = await request('GET', '/sheets/status', null, facultyToken);
    assert(res.status === 403, 'Faculty cannot access /sheets/status → 403');

    // Admin can access status
    res = await request('GET', '/sheets/status', null, adminToken);
    assert(res.status === 200, 'Admin can access /sheets/status → 200');

    // Student cannot access faculty marks list
    res = await request('GET', '/sheets/marks', null, studentToken);
    assert(res.status === 403, 'Student cannot access GET /sheets/marks → 403');

    // Faculty can access marks list (will be unconfigured or empty — not 403)
    res = await request('GET', '/sheets/marks', null, facultyToken);
    assert(res.status !== 403, `Faculty can access GET /sheets/marks (got ${res.status})`);

    // Student cannot POST attendance
    res = await request('POST', '/sheets/attendance', { records: [] }, studentToken);
    assert(res.status === 403, 'Student cannot POST /sheets/attendance → 403');

    // Faculty can attempt POST attendance (validation error expected, not 403)
    res = await request('POST', '/sheets/attendance', { records: [] }, facultyToken);
    assert(res.status !== 403, `Faculty can attempt POST /sheets/attendance (got ${res.status})`);

    // Student can access /marks/me route
    res = await request('GET', '/sheets/marks/me', null, studentToken);
    assert(res.status !== 403, `Student can access /sheets/marks/me (got ${res.status})`);

    // Student can access /attendance/me route
    res = await request('GET', '/sheets/attendance/me', null, studentToken);
    assert(res.status !== 403, `Student can access /sheets/attendance/me (got ${res.status})`);
  });

  // ── 4. Graceful no-configuration handling ────────────────────────────────────
  await section('Graceful Error Handling (No Credentials)', async () => {
    // These may return configured=false or actual data — must not crash
    const res = await request('GET', '/sheets/marks', null, facultyToken);
    assert(
      res.status === 200 || res.status === 503,
      `GET /marks returns 200 or 503 (got ${res.status})`
    );

    const res2 = await request('GET', '/sheets/attendance', null, facultyToken);
    assert(
      res2.status === 200 || res2.status === 503,
      `GET /attendance returns 200 or 503 (got ${res2.status})`
    );
  });

  // ── 5. Marks input validation ─────────────────────────────────────────────────
  await section('Marks Input Validation', async () => {
    // Missing required fields
    let res = await request('POST', '/sheets/marks', {}, facultyToken);
    assert(res.status === 422 || res.status === 503, `Missing fields → 422/503 (got ${res.status})`);

    // Invalid academicYear format
    res = await request('POST', '/sheets/marks', {
      enrollmentNumber: 'EN001',
      subjectCode: 'CS101',
      academicYear: '2024',
      semester: 5,
    }, facultyToken);
    assert(res.status === 422 || res.status === 503, `Bad academicYear → 422/503 (got ${res.status})`);

    // Negative mark value
    res = await request('POST', '/sheets/marks', {
      enrollmentNumber: 'EN001',
      subjectCode: 'CS101',
      academicYear: '2024-2025',
      semester: 5,
      PA1: -5,
    }, facultyToken);
    assert(res.status === 422 || res.status === 503, `Negative PA1 → 422/503 (got ${res.status})`);

    // Mark exceeding maximum
    res = await request('POST', '/sheets/marks', {
      enrollmentNumber: 'EN001',
      subjectCode: 'CS101',
      academicYear: '2024-2025',
      semester: 5,
      PA1: 999,
    }, facultyToken);
    assert(res.status === 422 || res.status === 503, `PA1 > max → 422/503 (got ${res.status})`);
  });

  // ── 6. Attendance input validation ───────────────────────────────────────────
  await section('Attendance Input Validation', async () => {
    // Empty records array
    let res = await request('POST', '/sheets/attendance', { records: [] }, facultyToken);
    assert(
      res.status === 400 || res.status === 422 || res.status === 503,
      `Empty records → 400/422/503 (got ${res.status})`
    );

    // Invalid status
    res = await request('POST', '/sheets/attendance', {
      records: [{
        date: '2024-08-01',
        subjectCode: 'CS101',
        enrollmentNumber: 'EN001',
        status: 'Maybe',
      }],
    }, facultyToken);
    assert(
      res.status === 422 || res.status === 503,
      `Invalid status "Maybe" → 422/503 (got ${res.status})`
    );
  });

  // ── 7. Sync endpoint authorization ────────────────────────────────────────────
  await section('Sync Endpoint Authorization', async () => {
    let res = await request('POST', '/sheets/sync', null, studentToken);
    assert(res.status === 403, 'Student cannot POST /sheets/sync → 403');

    res = await request('POST', '/sheets/sync', null, facultyToken);
    assert(res.status === 403, 'Faculty cannot POST /sheets/sync → 403');

    // Admin can attempt sync (may return 503 if not configured)
    res = await request('POST', '/sheets/sync', null, adminToken);
    assert(res.status === 200 || res.status === 503, `Admin POST /sheets/sync → 200/503 (got ${res.status})`);
  });

  // ── 8. Phase 1 Regression ─────────────────────────────────────────────────────
  await section('Phase 1 Regression', async () => {
    const res = await request('GET', '/auth/me', null, adminToken);
    assert(res.status === 200 && res.body.user?.role === 'admin', 'Admin /auth/me still works');

    const res2 = await request('GET', '/auth/me', null, studentToken);
    assert(res2.status === 200 && res2.body.user?.role === 'student', 'Student /auth/me still works');

    const res3 = await request('GET', '/auth/admin/dashboard', null, studentToken);
    assert(res3.status === 403, 'Student still blocked from admin dashboard');
  });

  // ── 9. Phase 2 Regression ─────────────────────────────────────────────────────
  await section('Phase 2 Regression', async () => {
    const res = await request('GET', '/students/me', null, studentToken);
    assert(res.status === 200, `Student /students/me still returns 200 (got ${res.status})`);

    const res2 = await request('GET', '/faculty/me', null, facultyToken);
    assert(res2.status === 200, `Faculty /faculty/me still returns 200 (got ${res2.status})`);
  });

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(55));
  console.log(`RESULTS: ${passed} passed | ${failed} failed | ${passed + failed} total`);
  if (failed === 0) {
    console.log('🎉 All Phase 3 tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Review the output above.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err.message);
  process.exit(1);
});
