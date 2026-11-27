const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/library_management_suite_e2e?replicaSet=rs0';
process.env.JWT_SECRET = 'e2e_test_secret_key';

const app = require('../src/app');
const connectDB = require('../src/config/db');

let server;
let rootUrl;
let apiUrl;

async function jsonReq(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

describe('End-to-End & Concurrency Tests', () => {
  before(async () => {
    await connectDB();
    await mongoose.connection.dropDatabase();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    rootUrl = `http://127.0.0.1:${port}`;
    apiUrl = `${rootUrl}/api`;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    server.close();
  });

  it('E2E-01: Static frontend assets (index.html, styles.css, app.js) are served cleanly', async () => {
    const [htmlRes, cssRes, jsRes] = await Promise.all([
      fetch(`${rootUrl}/`),
      fetch(`${rootUrl}/styles.css`),
      fetch(`${rootUrl}/app.js`),
    ]);
    assert.equal(htmlRes.status, 200);
    assert.equal(cssRes.status, 200);
    assert.equal(jsRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /Hearthstone Library/);
  });

  it('E2E-02: Complete user lifecycle (Auth -> Book -> Borrower -> Dashboard -> Issue -> Return -> History -> Delete)', async () => {
    const reg = await jsonReq('POST', '/auth/register', {
      name: 'E2E Librarian',
      email: 'e2e@test.com',
      password: 'password123',
    });
    assert.equal(reg.status, 201);
    const token = reg.data.token;

    const bookRes = await jsonReq(
      'POST',
      '/books',
      {
        title: 'Designing Data-Intensive Applications',
        author: 'Martin Kleppmann',
        isbn: '978-1449373320',
        categories: ['Technology', 'Software Engineering'],
        totalCopies: 2,
      },
      token
    );
    assert.equal(bookRes.status, 201);
    const bookId = bookRes.data.data._id;

    const borrowerRes = await jsonReq(
      'POST',
      '/borrowers',
      {
        name: 'Ananya Rao',
        email: 'ananya@test.com',
        phone: '9123456789',
      },
      token
    );
    assert.equal(borrowerRes.status, 201);
    const borrowerId = borrowerRes.data.data._id;

    const dashBefore = await jsonReq('GET', '/dashboard', undefined, token);
    assert.equal(dashBefore.data.data.totalBookTitles, 1);
    assert.equal(dashBefore.data.data.totalPhysicalCopies, 2);
    assert.equal(dashBefore.data.data.availableCopies, 2);
    assert.equal(dashBefore.data.data.currentlyIssued, 0);

    const issueRes = await jsonReq('POST', '/issues', { bookId, borrowerId }, token);
    assert.equal(issueRes.status, 201);
    const issueId = issueRes.data.data._id;

    const dashDuring = await jsonReq('GET', '/dashboard', undefined, token);
    assert.equal(dashDuring.data.data.availableCopies, 1);
    assert.equal(dashDuring.data.data.currentlyIssued, 1);

    const retRes = await jsonReq('PATCH', `/issues/${issueId}/return`, undefined, token);
    assert.equal(retRes.status, 200);
    assert.equal(retRes.data.data.status, 'returned');

    const histRes = await jsonReq('GET', `/borrowers/${borrowerId}/history`, undefined, token);
    assert.equal(histRes.status, 200);
    assert.equal(histRes.data.count, 1);

    const delBorrower = await jsonReq('DELETE', `/borrowers/${borrowerId}`, undefined, token);
    assert.equal(delBorrower.status, 200);
    const delBook = await jsonReq('DELETE', `/books/${bookId}`, undefined, token);
    assert.equal(delBook.status, 200);
  });

  it('CONC-01: 5 concurrent issue requests for a 1-copy book allow exactly 1 success and prevent negative inventory', async () => {
    const login = await jsonReq('POST', '/auth/login', {
      email: 'e2e@test.com',
      password: 'password123',
    });
    const token = login.data.token;

    const bookRes = await jsonReq(
      'POST',
      '/books',
      {
        title: 'Rare First Edition',
        author: 'A. Author',
        isbn: '978-9999999991',
        categories: ['Literature'],
        totalCopies: 1,
      },
      token
    );
    const bookId = bookRes.data.data._id;

    const borrowerRes = await jsonReq(
      'POST',
      '/borrowers',
      {
        name: 'Concurrent Borrower',
        email: 'conc@test.com',
        phone: '9000000001',
      },
      token
    );
    const borrowerId = borrowerRes.data.data._id;

    const results = await Promise.all(
      Array.from({ length: 5 }, () => jsonReq('POST', '/issues', { bookId, borrowerId }, token))
    );

    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status !== 201);

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 4);

    const bookCheck = await jsonReq('GET', `/books/${bookId}`, undefined, token);
    assert.equal(bookCheck.data.data.availableCopies, 0);

    // Cleanup via return
    await jsonReq('PATCH', `/issues/${successes[0].data.data._id}/return`, undefined, token);
  });

  it('CONC-02: 3 concurrent return requests for the same issue record increment availableCopies only once', async () => {
    const login = await jsonReq('POST', '/auth/login', {
      email: 'e2e@test.com',
      password: 'password123',
    });
    const token = login.data.token;

    const bookRes = await jsonReq(
      'POST',
      '/books',
      {
        title: 'Concurrency Return Book',
        author: 'B. Author',
        isbn: '978-9999999992',
        categories: ['Science'],
        totalCopies: 2,
      },
      token
    );
    const bookId = bookRes.data.data._id;

    const borrowerRes = await jsonReq(
      'POST',
      '/borrowers',
      {
        name: 'Return Race Borrower',
        email: 'retrace@test.com',
        phone: '9000000002',
      },
      token
    );
    const borrowerId = borrowerRes.data.data._id;

    const issueRes = await jsonReq('POST', '/issues', { bookId, borrowerId }, token);
    assert.equal(issueRes.status, 201);
    const issueId = issueRes.data.data._id;

    const returnResults = await Promise.all(
      Array.from({ length: 3 }, () => jsonReq('PATCH', `/issues/${issueId}/return`, undefined, token))
    );

    const successes = returnResults.filter((r) => r.status === 200);
    assert.equal(successes.length, 1);

    const bookCheck = await jsonReq('GET', `/books/${bookId}`, undefined, token);
    assert.equal(bookCheck.data.data.availableCopies, 2);
  });
});
