/**
 * test_phase2_full.js — Complete automated test suite for Phase 2 specifications.
 */
const http = require('http');

function api(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api${path}`,
        method,
        headers,
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = resBody;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('===============================================================');
  console.log('   FACULTYHUB PHASE 2 — VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${name} ${details ? '— ' + details : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details ? '— ' + details : ''}`);
      failed++;
    }
  }

  // 1. Authenticate Seeded Accounts
  const sLogin = await api('POST', '/auth/login', {
    email: 'student@facultyhub.dev',
    password: 'Student@1234',
  });
  assert('1.1 Seeded Student login', sLogin.status === 200 && sLogin.body.user.role === 'student');
  const studentToken = sLogin.body.token;
  const studentUserId = sLogin.body.user._id;

  const fLogin = await api('POST', '/auth/login', {
    email: 'faculty@facultyhub.dev',
    password: 'Faculty@1234',
  });
  assert('1.2 Seeded Faculty login', fLogin.status === 200 && fLogin.body.user.role === 'faculty');
  const facultyToken = fLogin.body.token;
  const facultyUserId = fLogin.body.user._id;

  const aLogin = await api('POST', '/auth/login', {
    email: 'admin@facultyhub.dev',
    password: 'Admin@1234',
  });
  assert('1.3 Seeded Admin login', aLogin.status === 200 && aLogin.body.user.role === 'admin');
  const adminToken = aLogin.body.token;

  // 2. User ↔ Profile Relationships & Self Profile Access
  const sMe = await api('GET', '/students/me', null, studentToken);
  assert(
    '2.1 Student GET /api/students/me returns 200 and profile data',
    sMe.status === 200 && sMe.body.data && sMe.body.data.enrollmentNumber === '26001001'
  );
  assert(
    '2.2 Student profile userId matches authenticated User',
    sMe.body.data?.userId?._id === studentUserId
  );

  const fMe = await api('GET', '/faculty/me', null, facultyToken);
  assert(
    '2.3 Faculty GET /api/faculty/me returns 200 and profile data',
    fMe.status === 200 && fMe.body.data && fMe.body.data.designation === 'Permanent Faculty'
  );
  assert(
    '2.4 Faculty profile userId matches authenticated User',
    fMe.body.data?.userId?._id === facultyUserId
  );

  // 3. Security & Access Control
  const sListAll = await api('GET', '/students', null, studentToken);
  assert('3.1 Student cannot list all students (403)', sListAll.status === 403);

  const otherId = sMe.body.data._id;
  const sGetOther = await api('GET', `/students/${otherId}`, null, studentToken);
  assert('3.2 Student cannot access student record by ID (403)', sGetOther.status === 403);

  const sFacList = await api('GET', '/faculty', null, studentToken);
  assert('3.3 Student cannot access faculty list (403)', sFacList.status === 403);

  const sFacMe = await api('GET', '/faculty/me', null, studentToken);
  assert('3.4 Student cannot access faculty profile endpoint (403)', sFacMe.status === 403);

  const unauthMe = await api('GET', '/students/me');
  assert('3.5 Unauthenticated request rejected (401)', unauthMe.status === 401);

  const sCreate = await api('POST', '/students', { fullName: 'Hacker' }, studentToken);
  assert('3.6 Student cannot create students (403)', sCreate.status === 403);

  const fCreate = await api('POST', '/students', { fullName: 'Faculty Attempt' }, facultyToken);
  assert('3.7 Faculty cannot create students (403 - admin only)', fCreate.status === 403);

  // 4. Academic Structure (Department, Subject)
  const depts = await api('GET', '/academic/departments', null, adminToken);
  assert('4.1 GET departments', depts.status === 200 && depts.body.data.length > 0);
  const deptId = depts.body.data[0]._id;

  const subjCode = `CS${Math.floor(Math.random() * 800 + 100)}`;
  const createSubj = await api(
    'POST',
    '/academic/subjects',
    {
      subjectCode: subjCode,
      subjectName: 'Test Networks',
      department: deptId,
      semester: 5,
    },
    adminToken
  );
  assert('4.2 POST subject', createSubj.status === 201);

  const dupSubj = await api(
    'POST',
    '/academic/subjects',
    {
      subjectCode: subjCode,
      subjectName: 'CN Duplicate',
      department: deptId,
      semester: 5,
    },
    adminToken
  );
  assert('4.3 Duplicate subject rejected (409)', dupSubj.status === 409);

  // 5. Admin Student Management CRUD
  const randNum = Math.floor(Math.random() * 9000 + 1000);
  const newStudentEmail = `student${randNum}@facultyhub.dev`;
  const newStudentEnroll = `2699${randNum}`;
  const newStudentRoll = `99${randNum}`;

  const createSt = await api(
    'POST',
    '/students',
    {
      fullName: `Test Student ${randNum}`,
      email: newStudentEmail,
      phone: '+91 9898989898',
      enrollmentNumber: newStudentEnroll,
      rollNumber: newStudentRoll,
      department: deptId,
      semester: 5,
      academicYear: '2026-2027',
    },
    adminToken
  );
  assert(
    '5.1 Admin create student with auto-provisioned User',
    createSt.status === 201 && createSt.body.data?.userId?._id
  );
  const newStudentId = createSt.body.data?._id;

  const newStLogin = await api('POST', '/auth/login', {
    email: newStudentEmail,
    password: 'Student@1234',
  });
  assert('5.2 Auto-provisioned student can login', newStLogin.status === 200);

  const dupEnroll = await api(
    'POST',
    '/students',
    {
      fullName: 'Dup Student',
      email: `dup${randNum}@facultyhub.dev`,
      enrollmentNumber: newStudentEnroll,
      rollNumber: `ROLL${randNum}`,
      department: deptId,
      semester: 5,
      academicYear: '2026-2027',
    },
    adminToken
  );
  assert('5.3 Duplicate enrollment rejected (409)', dupEnroll.status === 409);

  const getSt = await api('GET', `/students/${newStudentId}`, null, facultyToken);
  assert('5.4 Faculty can read student details', getSt.status === 200);

  const updSt = await api(
    'PUT',
    `/students/${newStudentId}`,
    { fullName: `Updated Student ${randNum}` },
    adminToken
  );
  assert(
    '5.5 Admin update student',
    updSt.status === 200 && updSt.body.data?.fullName === `Updated Student ${randNum}`
  );

  const searchSt = await api('GET', `/students?search=${randNum}`, null, facultyToken);
  assert('5.6 Search students by keyword', searchSt.status === 200 && searchSt.body.pagination.total >= 1);

  const filterSt = await api('GET', '/students?semester=5', null, facultyToken);
  assert('5.7 Filter students by semester', filterSt.status === 200 && filterSt.body.data.length > 0);

  const deactSt = await api('PATCH', `/students/${newStudentId}/status`, { status: 'inactive' }, adminToken);
  assert('5.8 Soft deactivate student', deactSt.status === 200 && deactSt.body.data.status === 'inactive');

  // 6. Admin Faculty Management CRUD
  const newFacEmail = `faculty${randNum}@facultyhub.dev`;

  const createFac = await api(
    'POST',
    '/faculty',
    {
      fullName: `Test Professor ${randNum}`,
      email: newFacEmail,
      phone: '+91 9777777777',
      department: deptId,
      designation: 'Normal Faculty',
    },
    adminToken
  );
  assert(
    '6.1 Admin create faculty with auto-provisioned User',
    createFac.status === 201 && createFac.body.data?.userId?._id
  );
  const newFacId = createFac.body.data?._id;

  const newFacLogin = await api('POST', '/auth/login', {
    email: newFacEmail,
    password: 'Faculty@1234',
  });
  assert('6.2 Auto-provisioned faculty can login', newFacLogin.status === 200);

  const getFac = await api('GET', `/faculty/${newFacId}`, null, facultyToken);
  assert('6.3 Faculty GET details', getFac.status === 200);

  const updFac = await api(
    'PUT',
    `/faculty/${newFacId}`,
    { designation: 'Permanent Faculty' },
    adminToken
  );
  assert('6.4 Update faculty designation', updFac.status === 200 && updFac.body.data?.designation === 'Permanent Faculty');

  const crossRole = await api(
    'POST',
    '/faculty',
    {
      fullName: 'Cross Role Attempt',
      email: 'student@facultyhub.dev',
      department: deptId,
      designation: 'Normal Faculty',
      userId: studentUserId,
    },
    adminToken
  );
  assert('6.5 Prevent cross-role conflict (Student User -> Faculty)', crossRole.status === 400 || crossRole.status === 409);

  // 7. Phase 1 RBAC Regression
  const pubReg = await api('POST', '/auth/register', {
    name: 'Public Reg',
    email: `public${randNum}@facultyhub.dev`,
    password: 'Password@123',
    role: 'admin',
  });
  assert('7.1 Public registration forced to student role', pubReg.status === 201 && pubReg.body.user.role === 'student');

  const adminDash = await api('GET', '/auth/admin/dashboard', null, adminToken);
  assert('7.2 Admin dashboard access (200)', adminDash.status === 200);

  const studentBlockAdmin = await api('GET', '/auth/admin/dashboard', null, studentToken);
  assert('7.3 Student blocked from admin dashboard (403)', studentBlockAdmin.status === 403);

  console.log('\n===============================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
