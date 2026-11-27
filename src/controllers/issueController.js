const mongoose = require('mongoose');
const Book = require('../models/Book');
const Borrower = require('../models/Borrower');
const IssueRecord = require('../models/IssueRecord');
const { AppError } = require('../middleware/errorHandler');

/**
 * Issue a book to an active borrower inside a MongoDB transaction.
 * Atomically creates the IssueRecord and decrements book.availableCopies.
 */
async function issueBook(req, res, next) {
  const session = await mongoose.startSession();
  try {
    const { bookId, borrowerId, dueDate, notes } = req.body;
    let createdRecord;

    await session.withTransaction(async () => {
      const borrower = await Borrower.findById(borrowerId).session(session);
      if (!borrower) {
        throw new AppError('Borrower not found', 404);
      }
      if (!borrower.isActive) {
        throw new AppError('Borrower account is inactive and cannot borrow books', 400);
      }

      const book = await Book.findOneAndUpdate(
        { _id: bookId, availableCopies: { $gt: 0 } },
        { $inc: { availableCopies: -1 } },
        { new: true, session }
      );

      if (!book) {
        const exists = await Book.exists({ _id: bookId }).session(session);
        if (!exists) {
          throw new AppError('Book not found', 404);
        }
        throw new AppError('No available copies of this book', 400);
      }

      const resolvedDueDate = dueDate
        ? new Date(dueDate)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const [record] = await IssueRecord.create(
        [
          {
            book: book._id,
            borrower: borrower._id,
            issuedBy: req.user?._id,
            issueDate: new Date(),
            dueDate: resolvedDueDate,
            status: 'issued',
            notes,
          },
        ],
        { session }
      );

      createdRecord = record;
    });

    const populated = await IssueRecord.findById(createdRecord._id)
      .populate('book', 'title author isbn availableCopies totalCopies')
      .populate('borrower', 'name email membershipId isActive');

    res.status(201).json({
      success: true,
      message: 'Book issued successfully',
      data: populated,
    });
  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
  }
}

/**
 * Return an issued book inside a MongoDB transaction.
 * Verifies record status, sets returnDate & returnedLate, and increments book.availableCopies.
 */
async function returnBook(req, res, next) {
  const session = await mongoose.startSession();
  try {
    let updatedRecord;

    await session.withTransaction(async () => {
      const record = await IssueRecord.findById(req.params.id).session(session);
      if (!record) {
        throw new AppError('Issue record not found', 404);
      }
      if (record.status === 'returned') {
        throw new AppError('This book has already been returned', 400);
      }

      const now = new Date();
      record.returnDate = now;
      record.status = 'returned';
      record.returnedLate = now > record.dueDate;
      await record.save({ session });

      await Book.findOneAndUpdate(
        { _id: record.book, $expr: { $lt: ['$availableCopies', '$totalCopies'] } },
        { $inc: { availableCopies: 1 } },
        { session }
      );

      updatedRecord = record;
    });

    const populated = await IssueRecord.findById(updatedRecord._id)
      .populate('book', 'title author isbn availableCopies totalCopies')
      .populate('borrower', 'name email membershipId isActive');

    res.json({
      success: true,
      message: updatedRecord.returnedLate
        ? 'Book returned (overdue)'
        : 'Book returned on time',
      data: populated,
    });
  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
  }
}

async function getIssues(req, res, next) {
  try {
    const { status, borrowerId, bookId } = req.query;
    const filter = {};

    if (status && ['issued', 'returned'].includes(status)) {
      filter.status = status;
    }
    if (borrowerId) filter.borrower = borrowerId;
    if (bookId) filter.book = bookId;

    const records = await IssueRecord.find(filter)
      .populate('book', 'title author isbn availableCopies totalCopies')
      .populate('borrower', 'name email membershipId isActive')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
}

async function getIssueById(req, res, next) {
  try {
    const record = await IssueRecord.findById(req.params.id)
      .populate('book', 'title author isbn availableCopies totalCopies')
      .populate('borrower', 'name email membershipId isActive');

    if (!record) {
      throw new AppError('Issue record not found', 404);
    }

    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  issueBook,
  returnBook,
  getIssues,
  getIssueById,
};
