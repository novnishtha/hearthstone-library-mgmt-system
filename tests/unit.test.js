const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const User = require('../src/models/User');
const Book = require('../src/models/Book');
const Borrower = require('../src/models/Borrower');
const IssueRecord = require('../src/models/IssueRecord');
const { protect } = require('../src/middleware/auth');
const { AppError, errorHandler } = require('../src/middleware/errorHandler');
const { generateBookDescription } = require('../src/services/aiService');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('Unit Tests — Models, Middleware & Services', () => {
  it('UNIT-01: Book defaults availableCopies to totalCopies on new instance', () => {
    const book = new Book({
      title: 'The Pragmatic Programmer',
      author: 'David Thomas',
      isbn: '978-0135957059',
      categories: ['Software Engineering', 'Technology'],
      totalCopies: 4,
    });
    const err = book.validateSync();
    assert.equal(err, undefined);
    assert.equal(book.availableCopies, 4);
  });

  it('UNIT-02: Book rejects availableCopies greater than totalCopies', () => {
    const book = new Book({
      title: 'Invalid Copies',
      author: 'Author',
      isbn: '978-0000000001',
      categories: ['Fiction'],
      totalCopies: 2,
      availableCopies: 5,
    });
    const err = book.validateSync();
    assert.ok(err);
    assert.ok(err.errors.availableCopies);
  });

  it('UNIT-03: Book rejects empty categories array', () => {
    const book = new Book({
      title: 'No Genre',
      author: 'Author',
      isbn: '978-0000000002',
      categories: [],
      totalCopies: 1,
    });
    const err = book.validateSync();
    assert.ok(err);
    assert.ok(err.errors.categories);
  });

  it('UNIT-04: Book rejects non-integer totalCopies', () => {
    const book = new Book({
      title: 'Fractional Copies',
      author: 'Author',
      isbn: '978-0000000003',
      categories: ['Science'],
      totalCopies: 1.5,
    });
    const err = book.validateSync();
    assert.ok(err);
    assert.ok(err.errors.totalCopies);
  });

  it('UNIT-05: Borrower rejects invalid email format and short phone', () => {
    const borrower = new Borrower({
      name: 'Test User',
      email: 'not-an-email',
      phone: '123',
    });
    const err = borrower.validateSync();
    assert.ok(err);
    assert.ok(err.errors.email);
    assert.ok(err.errors.phone);
  });

  it('UNIT-06: IssueRecord rejects invalid status enum', () => {
    const record = new IssueRecord({
      book: '507f1f77bcf86cd799439011',
      borrower: '507f1f77bcf86cd799439012',
      dueDate: new Date(),
      status: 'lost',
    });
    const err = record.validateSync();
    assert.ok(err);
    assert.ok(err.errors.status);
  });

  it('UNIT-07: User rejects short password (< 6 chars) and invalid email', () => {
    const user = new User({
      name: 'Asha',
      email: 'bad-email',
      password: '123',
    });
    const err = user.validateSync();
    assert.ok(err);
    assert.ok(err.errors.email);
    assert.ok(err.errors.password);
  });

  it('UNIT-08: protect middleware returns 401 when Authorization header is missing or malformed', async () => {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;
    await protect(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  it('UNIT-09: protect middleware returns 401 for invalid JWT token', async () => {
    process.env.JWT_SECRET = 'unit_test_secret';
    const req = { headers: { authorization: 'Bearer invalid.jwt.token' } };
    const res = mockRes();
    await protect(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Invalid or expired token');
  });

  it('UNIT-10: errorHandler maps CastError (400), duplicate 11000 (409), and AppError', () => {
    const resCast = mockRes();
    errorHandler({ name: 'CastError', path: '_id', value: 'bad-id' }, {}, resCast, () => {});
    assert.equal(resCast.statusCode, 400);

    const resDup = mockRes();
    errorHandler({ code: 11000, keyValue: { isbn: '123' } }, {}, resDup, () => {});
    assert.equal(resDup.statusCode, 409);
    assert.match(resDup.body.message, /isbn/i);

    const resApp = mockRes();
    errorHandler(new AppError('Custom error', 422), {}, resApp, () => {});
    assert.equal(resApp.statusCode, 422);
    assert.equal(resApp.body.message, 'Custom error');
  });

  it('UNIT-11: aiService throws 503 AppError when GEMINI_API_KEY is missing', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await assert.rejects(
        () => generateBookDescription({ title: 'Clean Code', author: 'Robert C. Martin' }),
        (err) => err instanceof AppError && err.statusCode === 503
      );
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
