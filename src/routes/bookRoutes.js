const express = require('express');
const { body } = require('express-validator');
const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
} = require('../controllers/bookController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', getBooks);
router.get('/:id', getBookById);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('author').trim().notEmpty().withMessage('Author is required'),
    body('isbn').trim().notEmpty().withMessage('ISBN is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('totalCopies').isInt({ min: 1 }).withMessage('Total copies must be at least 1'),
    body('publishedYear')
      .optional({ values: 'falsy' })
      .isInt({ min: 1000, max: new Date().getFullYear() + 1 })
      .withMessage('Published year must be valid'),
    validateRequest,
  ],
  createBook
);

router.put(
  '/:id',
  [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('author').optional().trim().notEmpty().withMessage('Author cannot be empty'),
    body('isbn').optional().trim().notEmpty().withMessage('ISBN cannot be empty'),
    body('category').optional().trim().notEmpty().withMessage('Category cannot be empty'),
    body('totalCopies').optional().isInt({ min: 1 }).withMessage('Total copies must be at least 1'),
    body('publishedYear')
      .optional({ values: 'falsy' })
      .isInt({ min: 1000, max: new Date().getFullYear() + 1 })
      .withMessage('Published year must be valid'),
    validateRequest,
  ],
  updateBook
);

router.delete('/:id', deleteBook);

module.exports = router;
