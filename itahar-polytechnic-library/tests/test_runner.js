/**
 * Integration Test Runner for ITAHAR GOVERNMENT POLYTECHNIC Library Portal
 * Tests all key full-stack workflows end-to-end
 */

const { Socket } = require('net');
const http = require('http');
const app = require('../server');
const db = require('../config/db');

function dispatch(method, url, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method.toUpperCase();
    req.url = url;
    req.headers = {
      'host': 'localhost',
      'content-type': 'application/json'
    };
    if (token) req.headers['authorization'] = `Bearer ${token}`;

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);

    let output = '';
    res.write = function (chunk) {
      if (chunk) output += chunk.toString();
      return true;
    };
    res.end = function (chunk) {
      if (chunk) output += chunk.toString();
      let parsed = null;
      try {
        parsed = JSON.parse(output);
      } catch (e) {
        parsed = output;
      }
      resolve({ status: res.statusCode, headers: res.getHeaders(), body: parsed });
    };

    if (body) {
      const payload = Buffer.from(JSON.stringify(body));
      req.headers['content-length'] = payload.length;
      process.nextTick(() => {
        req.push(payload);
        req.push(null);
      });
    } else {
      process.nextTick(() => {
        req.push(null);
      });
    }

    app.handle(req, res);
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 ITAHAR GOVERNMENT POLYTECHNIC - AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  await db.initDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? '-> ' + JSON.stringify(details) : ''}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await dispatch('GET', '/api/health');
    assert(health.status === 200 && health.body.status === 'ONLINE', 'System Health Check responds ONLINE', health.body);

    // 2. Student Registration (Creates pending student)
    const testRoll = `CS-2026-${Math.floor(100 + Math.random() * 899)}`;
    const regRes = await dispatch('POST', '/api/auth/register', {
      student_id: testRoll,
      name: 'Subhasish Mukherjee',
      email: `subhasish.${Date.now()}@itaharpolytechnic.edu.in`,
      password: 'Password@123',
      phone: '+91 9832199999',
      department: 'Computer Science & Technology',
      semester: 'Semester 2'
    });
    assert(regRes.status === 201 && regRes.body.status === 'pending', 'Student registration requires Admin/Librarian approval (pending)', regRes.body);

    // 3. Pending student cannot log in until approved
    const pendingLogin = await dispatch('POST', '/api/auth/login', {
      login: testRoll,
      password: 'Password@123'
    });
    assert(pendingLogin.status === 403 && pendingLogin.body.status === 'pending', 'Pending student login correctly rejected with 403 until approved', pendingLogin.body);

    // 4. Admin login
    const adminLogin = await dispatch('POST', '/api/auth/login', {
      login: 'admin@itaharpolytechnic.edu.in',
      password: 'Password@123'
    });
    assert(adminLogin.status === 200 && !!adminLogin.body.token, 'Admin login succeeds with JWT token', adminLogin.body);
    const adminToken = adminLogin.body.token;

    // 5. Admin Dashboard Stats
    const statsRes = await dispatch('GET', '/api/admin/dashboard-stats', null, adminToken);
    assert(statsRes.status === 200 && statsRes.body.stats.totalBooks > 0, 'Admin fetches live database statistics', statsRes.body);

    // 6. Admin approves pending student
    const studentsRes = await dispatch('GET', '/api/students?status=pending', null, adminToken);
    const newStudent = studentsRes.body.students.find(s => s.student_id === testRoll);
    assert(!!newStudent, 'Admin locates newly registered pending student in approval queue');

    const approveRes = await dispatch('PUT', `/api/students/${newStudent.id}/status`, { status: 'active' }, adminToken);
    assert(approveRes.status === 200 && approveRes.body.success, 'Admin approves student account to active status', approveRes.body);

    // 7. Approved student can now log in
    const studentLogin = await dispatch('POST', '/api/auth/login', {
      login: testRoll,
      password: 'Password@123'
    });
    assert(studentLogin.status === 200 && !!studentLogin.body.token, 'Newly approved student logs in and receives session JWT', studentLogin.body);
    const studentToken = studentLogin.body.token;

    // 8. Student queries catalog
    const booksRes = await dispatch('GET', '/api/books?search=data', null, studentToken);
    assert(booksRes.status === 200 && booksRes.body.books.length > 0, 'Catalog search returns matching holding records', booksRes.body);

    // 9. Student reserves a book
    const reserveRes = await dispatch('POST', '/api/reservations', { book_id: 1 }, studentToken);
    assert(reserveRes.status === 201 && reserveRes.body.success, 'Student successfully reserves a book copy', reserveRes.body);

    // 10. Student checks reservations list
    const myResv = await dispatch('GET', '/api/reservations/my', null, studentToken);
    assert(myResv.status === 200 && myResv.body.reservations.length > 0, 'Student retrieves active reservations', myResv.body);

    // 11. Librarian login
    const librarianLogin = await dispatch('POST', '/api/auth/login', {
      login: 'librarian@itaharpolytechnic.edu.in',
      password: 'Password@123'
    });
    assert(librarianLogin.status === 200 && !!librarianLogin.body.token, 'Librarian login succeeds with JWT', librarianLogin.body);
    const librarianToken = librarianLogin.body.token;

    // 12. Librarian adds a new book to catalog
    const newIsbn = `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const addBookRes = await dispatch('POST', '/api/books', {
      title: 'Python for Mechanical and Electrical Simulations',
      isbn: newIsbn,
      author_name: 'Dr. Debabrata Roy',
      category_name: 'Computer Science & Technology',
      publisher_name: 'Oxford University Press',
      edition: '1st Edition',
      publication_year: 2026,
      total_copies: 3,
      shelf_location: 'Stack CS-205',
      description: 'Hands-on scientific computing and automated simulations.'
    }, librarianToken);
    assert(addBookRes.status === 201 && addBookRes.body.success, 'Librarian indexes new book with 3 auto-generated copy barcodes', addBookRes.body);
    const createdBookId = addBookRes.body.bookId;

    // 13. Librarian issues the new book to student
    const issueRes = await dispatch('POST', '/api/loans/issue', {
      book_id: createdBookId,
      student_roll: testRoll,
      due_date: '2026-12-01',
      notes: 'Issued for semester simulation project'
    }, librarianToken);
    assert(issueRes.status === 201 && issueRes.body.success, 'Librarian successfully issues book copy to student', issueRes.body);
    const loanId = issueRes.body.loan.id;

    // 14. Student checks borrowing history and active loans
    const myLoansRes = await dispatch('GET', '/api/loans/my-loans', null, studentToken);
    const activeLoan = myLoansRes.body.loans.find(l => l.id === loanId);
    assert(!!activeLoan && activeLoan.status === 'active', 'Student profile displays active checked-out loan and due date', myLoansRes.body);

    // 15. Student submits a new book purchase request
    const reqRes = await dispatch('POST', '/api/requests', {
      title: 'Quantum Computing Fundamentals',
      author: 'Nielsen & Chuang',
      reason: 'Advanced seminar research paper reference'
    }, studentToken);
    assert(reqRes.status === 201 && reqRes.body.success, 'Student submits book acquisition request to library committee', reqRes.body);

    // 16. Librarian processes return of book
    const returnRes = await dispatch('POST', '/api/loans/return', { loan_id: loanId }, librarianToken);
    assert(returnRes.status === 200 && returnRes.body.success, 'Librarian processes book check-in and restores available copies', returnRes.body);

    // 17. E-Resources List
    const eresRes = await dispatch('GET', '/api/eresources');
    assert(eresRes.status === 200 && eresRes.body.resources.length > 0, 'E-Resources catalog provides digital IEEE & ACM access', eresRes.body);

    // 18. Notices List
    const noticesRes = await dispatch('GET', '/api/notices');
    assert(noticesRes.status === 200 && noticesRes.body.notices.length > 0, 'Notices board delivers active announcements', noticesRes.body);

    // 19. Notifications for Student
    const notifsRes = await dispatch('GET', '/api/notifications', null, studentToken);
    assert(notifsRes.status === 200 && notifsRes.body.notifications.length > 0, 'Student notification center delivers real-time transaction alerts', notifsRes.body);

  } catch (err) {
    console.error('Test Execution Error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
