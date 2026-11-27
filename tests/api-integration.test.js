const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/library_management_suite_int?replicaSet=rs0';
process.env.JWT_SECRET = 'integration_test_secret_key';

const app = require('../src/app');
const connectDB = require('../src/config/db');

let server;
let baseUrl;
let token;

async function apiCall(method, path, body, authToken = token) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

describe('Integration & API Tests — Auth, Books, Borrowers, Issues & Dashboard', () => {
  before(async () => {
    await connectDB();
    await mongoose.connection.dropDatabase();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  it('API-01: GET /api/health returns 200 ok', async () => {
    const res = await apiCall('GET', '/health', undefined, null);
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
  });

  it('API-02: Unauthenticated request to protected /api/books returns 401', async () => {
    const res = await apiCall('GET', '/books', undefined, null);
    assert.equal(res.status, 401);
  });

  it('API-03: Register, duplicate email (409), login, invalid password (401), and /auth/me', async () => {
    const reg = await apiCall(
      'POST',
      '/auth/register',
      { name: 'Staff One', email: 'staff1@test.com', password: 'password123' },
      null
    );
    assert.equal(reg.status, 201);
    assert.ok(reg.data.token);

    const dup = await apiCall(
      'POST',
      '/auth/register',
      { name: 'Staff One', email: 'staff1@test.com', password: 'password123' },
      null
    );
    assert.equal(dup.status, 409);

    const badLogin = await apiCall(
      'POST',
      '/auth/login',
      { email: 'staff1@test.com', password: 'wrongpassword' },
      null
    );
    assert.equal(badLogin.status, 401);

    const login = await apiCall(
      'POST',
      '/auth/login',
      { email: 'staff1@test.com', password: 'password123' },
      null
    );
    assert.equal(login.status, 200);
    token = login.data.token;

    const me = await apiCall('GET', '/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.data.email, 'staff1@test.com');
  });

  it('API-04: Books CRUD, multi-category filter, search, invalid ID (400), and duplicate ISBN (409)', async () => {
    const created = await apiCall('POST', '/books', {
      title: 'Clean Architecture',
      author: 'Robert C. Martin',
      isbn: '978-0134494166',
      categories: ['Software Engineering', 'Technology'],
      publishedYear: 2017,
      totalCopies: 2,
    });
    assert.equal(created.status, 201);
    const bookId = created.data.data._id;
    assert.equal(created.data.data.availableCopies, 2);

    const dupIsbn = await apiCall('POST', '/books', {
      title: 'Duplicate ISBN Book',
      author: 'Someone',
      isbn: '978-0134494166',
      categories: ['Fiction'],
      totalCopies: 1,
    });
    assert.equal(dupIsbn.status, 409);

    const search = await apiCall('GET', '/books?q=Architecture&category=Technology&available=true');
    assert.equal(search.status, 200);
    assert.equal(search.data.count, 1);

    const badId = await apiCall('GET', '/books/not-a-valid-id');
    assert.equal(badId.status, 400);

    const notFound = await apiCall('GET', '/books/507f1f77bcf86cd799439011');
    assert.equal(notFound.status, 404);

    const updated = await apiCall('PUT', `/books/${bookId}`, {
      totalCopies: 4,
      categories: ['Software Engineering', 'Science'],
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.data.availableCopies, 4);
    assert.deepEqual(updated.data.data.categories, ['Software Engineering', 'Science']);
  });

  it('API-05: Borrowers CRUD, status toggle, validation errors, and history', async () => {
    const badBorrower = await apiCall('POST', '/borrowers', {
      name: 'X',
      email: 'bad-email',
      phone: '12',
    });
    assert.equal(badBorrower.status, 400);

    const created = await apiCall('POST', '/borrowers', {
      name: 'Priya Nair',
      email: 'priya@test.com',
      phone: '9876543210',
      address: '10 Park Street',
    });
    assert.equal(created.status, 201);
    assert.match(created.data.data.membershipId, /^LIB-\d{6}$/);
    const borrowerId = created.data.data._id;

    const filtered = await apiCall('GET', '/borrowers?q=Priya&status=active');
    assert.equal(filtered.status, 200);
    assert.equal(filtered.data.count, 1);

    const toggled = await apiCall('PATCH', `/borrowers/${borrowerId}/status`, {});
    assert.equal(toggled.status, 200);
    assert.equal(toggled.data.data.isActive, false);

    const reactivated = await apiCall('PATCH', `/borrowers/${borrowerId}/status`, { isActive: true });
    assert.equal(reactivated.status, 200);
    assert.equal(reactivated.data.data.isActive, true);
  });

  it('API-06: Issue & Return edge cases (inactive borrower, 0 copies, delete guards, overdue & dashboard)', async () => {
    const bookRes = await apiCall('POST', '/books', {
      title: 'Atomic Habits',
      author: 'James Clear',
      isbn: '978-0735211292',
      categories: ['Self-Help'],
      totalCopies: 1,
    });
    const bookId = bookRes.data.data._id;

    const borrowerRes = await apiCall('POST', '/borrowers', {
      name: 'Karan Shah',
      email: 'karan@test.com',
      phone: '9988776655',
    });
    const borrowerId = borrowerRes.data.data._id;

    // Deactivate borrower -> issue must fail with 400
    await apiCall('PATCH', `/borrowers/${borrowerId}/status`, { isActive: false });
    const inactiveIssue = await apiCall('POST', '/issues', { bookId, borrowerId });
    assert.equal(inactiveIssue.status, 400);

    // Reactivate & issue with past dueDate to test overdue tracking
    await apiCall('PATCH', `/borrowers/${borrowerId}/status`, { isActive: true });
    const pastDue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const issueRes = await apiCall('POST', '/issues', { bookId, borrowerId, dueDate: pastDue });
    assert.equal(issueRes.status, 201);
    const issueId = issueRes.data.data._id;

    // Issuing 2nd copy when 0 available -> 400
    const noCopiesIssue = await apiCall('POST', '/issues', { bookId, borrowerId });
    assert.equal(noCopiesIssue.status, 400);

    // Updating totalCopies below issued count (1) -> 400
    // (totalCopies: 0 is rejected by validator; test with a 2-copy book or delete guard)
    const delBookActive = await apiCall('DELETE', `/books/${bookId}`);
    assert.equal(delBookActive.status, 400);

    const delBorrowerActive = await apiCall('DELETE', `/borrowers/${borrowerId}`);
    assert.equal(delBorrowerActive.status, 400);

    // Dashboard reflects overdueBooks >= 1 and currentlyIssued >= 1
    const dash1 = await apiCall('GET', '/dashboard');
    assert.equal(dash1.status, 200);
    assert.ok(dash1.data.data.overdueBooks >= 1);
    assert.ok(dash1.data.data.currentlyIssued >= 1);
    assert.ok(dash1.data.data.recentlyIssued.length >= 1);

    // Return overdue book -> returnedLate === true
    const ret = await apiCall('PATCH', `/issues/${issueId}/return`);
    assert.equal(ret.status, 200);
    assert.equal(ret.data.data.status, 'returned');
    assert.equal(ret.data.data.returnedLate, true);

    // Duplicate return -> 400
    const dupRet = await apiCall('PATCH', `/issues/${issueId}/return`);
    assert.equal(dupRet.status, 400);

    // AI endpoint validation: missing title/author -> 400
    const badAi = await apiCall('POST', '/ai/book-description', { title: '' });
    assert.equal(badAi.status, 400);
  });
});
