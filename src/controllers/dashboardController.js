const Book = require('../models/Book');
const Borrower = require('../models/Borrower');
const IssueRecord = require('../models/IssueRecord');

/**
 * Fetch live library dashboard statistics dynamically from MongoDB.
 */
async function getDashboardStats(_req, res, next) {
  try {
    const now = new Date();

    const [
      bookStats,
      totalBorrowers,
      activeBorrowers,
      currentlyIssued,
      overdueBooks,
      recentlyIssued,
    ] = await Promise.all([
      Book.aggregate([
        {
          $group: {
            _id: null,
            totalTitles: { $sum: 1 },
            totalCopies: { $sum: '$totalCopies' },
            availableCopies: { $sum: '$availableCopies' },
          },
        },
      ]),
      Borrower.countDocuments(),
      Borrower.countDocuments({ isActive: true }),
      IssueRecord.countDocuments({ status: 'issued' }),
      IssueRecord.countDocuments({ status: 'issued', dueDate: { $lt: now } }),
      IssueRecord.find()
        .sort({ issueDate: -1 })
        .limit(5)
        .populate('book', 'title author isbn')
        .populate('borrower', 'name membershipId'),
    ]);

    const books = bookStats[0] || {
      totalTitles: 0,
      totalCopies: 0,
      availableCopies: 0,
    };

    res.json({
      success: true,
      data: {
        totalBookTitles: books.totalTitles,
        totalPhysicalCopies: books.totalCopies,
        availableCopies: books.availableCopies,
        totalBorrowers,
        activeBorrowers,
        currentlyIssued,
        overdueBooks,
        recentlyIssued,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboardStats };
