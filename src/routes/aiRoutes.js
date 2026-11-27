const express = require('express');
const { body } = require('express-validator');
const { createBookDescription } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.post(
  '/book-description',
  [
    body('title').trim().notEmpty().withMessage('Title is required to generate a description'),
    body('author').trim().notEmpty().withMessage('Author is required to generate a description'),
    body('categories').optional().isArray(),
    body('category').optional().trim(),
    body('publishedYear').optional({ values: 'falsy' }).isInt(),
    validateRequest,
  ],
  createBookDescription
);

module.exports = router;
