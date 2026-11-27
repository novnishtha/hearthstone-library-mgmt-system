const express = require('express');
const { body } = require('express-validator');
const {
  issueBook,
  returnBook,
  getIssues,
  getIssueById,
} = require('../controllers/issueController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', getIssues);
router.get('/:id', getIssueById);

router.post(
  '/',
  [
    body('bookId').isMongoId().withMessage('Valid bookId is required'),
    body('borrowerId').isMongoId().withMessage('Valid borrowerId is required'),
    body('dueDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid due date'),
    validateRequest,
  ],
  issueBook
);

router.patch('/:id/return', returnBook);

module.exports = router;
