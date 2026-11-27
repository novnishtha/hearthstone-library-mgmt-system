const Book = require('../models/Book');
const IssueRecord = require('../models/IssueRecord');
const { AppError } = require('../middleware/errorHandler');

function normalizeCategories(categories, category) {
  const raw = categories !== undefined ? categories : category;
  if (raw === undefined) return undefined;
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  return [...new Set(list.map((c) => String(c).trim()).filter(Boolean))];
}

async function createBook(req, res, next) {
  try {
    const { title, author, isbn, categories, category, publishedYear, totalCopies, description } = req.body;
    const normalizedCategories = normalizeCategories(categories, category);
    const book = await Book.create({
      title,
      author,
      isbn,
      categories: normalizedCategories,
      publishedYear,
      totalCopies,
      availableCopies: totalCopies,
      description,
    });

    res.status(201).json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
}

async function getBooks(req, res, next) {
  try {
    const { q, category, available } = req.query;
    const filter = {};

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [{ title: regex }, { author: regex }, { isbn: regex }];
    }
    if (category && category !== 'all') {
      filter.categories = category;
    }
    if (available === 'true') {
      filter.availableCopies = { $gt: 0 };
    } else if (available === 'false') {
      filter.availableCopies = 0;
    }

    const books = await Book.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: books.length, data: books });
  } catch (err) {
    next(err);
  }
}

async function getBookById(req, res, next) {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      throw new AppError('Book not found', 404);
    }
    res.json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
}

async function updateBook(req, res, next) {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      throw new AppError('Book not found', 404);
    }

    const issuedCount = book.totalCopies - book.availableCopies;
    const { title, author, isbn, categories, category, publishedYear, totalCopies, description } = req.body;
    const normalizedCategories = normalizeCategories(categories, category);

    if (totalCopies !== undefined) {
      if (totalCopies < issuedCount) {
        throw new AppError(
          `Total copies cannot be less than currently issued copies (${issuedCount})`,
          400
        );
      }
      book.totalCopies = totalCopies;
      book.availableCopies = totalCopies - issuedCount;
    }

    if (title !== undefined) book.title = title;
    if (author !== undefined) book.author = author;
    if (isbn !== undefined) book.isbn = isbn;
    if (normalizedCategories !== undefined) book.categories = normalizedCategories;
    if (publishedYear !== undefined) book.publishedYear = publishedYear;
    if (description !== undefined) book.description = description;

    await book.save();
    res.json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
}

async function deleteBook(req, res, next) {
  try {
    const activeIssues = await IssueRecord.countDocuments({
      book: req.params.id,
      status: 'issued',
    });

    if (activeIssues > 0) {
      throw new AppError(
        'Cannot delete book while copies are currently issued to borrowers',
        400
      );
    }

    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) {
      throw new AppError('Book not found', 404);
    }

    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
};
