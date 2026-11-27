const express = require('express');
const { body } = require('express-validator');
const {
  createBorrower,
  getBorrowers,
  getBorrowerById,
  updateBorrower,
  toggleBorrowerStatus,
  getBorrowerHistory,
  deleteBorrower,
} = require('../controllers/borrowerController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router.get('/', getBorrowers);
router.get('/:id', getBorrowerById);
router.get('/:id/history', getBorrowerHistory);

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').trim().isLength({ min: 7, max: 20 }).withMessage('Phone must be 7–20 characters'),
    validateRequest,
  ],
  createBorrower
);

router.put(
  '/:id',
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('phone').optional().trim().isLength({ min: 7, max: 20 }).withMessage('Phone must be 7–20 characters'),
    validateRequest,
  ],
  updateBorrower
);

router.patch('/:id/status', toggleBorrowerStatus);
router.delete('/:id', deleteBorrower);

module.exports = router;
