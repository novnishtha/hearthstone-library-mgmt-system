const Borrower = require('../models/Borrower');
const IssueRecord = require('../models/IssueRecord');
const { AppError } = require('../middleware/errorHandler');

async function createBorrower(req, res, next) {
  try {
    const { name, email, phone, membershipId, address, isActive } = req.body;
    const borrower = await Borrower.create({
      name,
      email,
      phone,
      membershipId,
      address,
      isActive,
    });

    res.status(201).json({ success: true, data: borrower });
  } catch (err) {
    next(err);
  }
}

async function getBorrowers(req, res, next) {
  try {
    const { q, status } = req.query;
    const filter = {};

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { membershipId: regex },
      ];
    }

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    const borrowers = await Borrower.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: borrowers.length, data: borrowers });
  } catch (err) {
    next(err);
  }
}

async function getBorrowerById(req, res, next) {
  try {
    const borrower = await Borrower.findById(req.params.id);
    if (!borrower) {
      throw new AppError('Borrower not found', 404);
    }

    const issueHistory = await IssueRecord.find({ borrower: borrower._id })
      .populate('book', 'title author isbn')
      .sort({ issueDate: -1 });

    res.json({
      success: true,
      data: {
        ...borrower.toObject(),
        issueHistory,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateBorrower(req, res, next) {
  try {
    const borrower = await Borrower.findById(req.params.id);
    if (!borrower) {
      throw new AppError('Borrower not found', 404);
    }

    const { name, email, phone, address, isActive } = req.body;
    if (name !== undefined) borrower.name = name;
    if (email !== undefined) borrower.email = email;
    if (phone !== undefined) borrower.phone = phone;
    if (address !== undefined) borrower.address = address;
    if (isActive !== undefined) borrower.isActive = isActive;

    await borrower.save();
    res.json({ success: true, data: borrower });
  } catch (err) {
    next(err);
  }
}

async function toggleBorrowerStatus(req, res, next) {
  try {
    const borrower = await Borrower.findById(req.params.id);
    if (!borrower) {
      throw new AppError('Borrower not found', 404);
    }

    borrower.isActive =
      typeof req.body.isActive === 'boolean' ? req.body.isActive : !borrower.isActive;
    await borrower.save();

    res.json({
      success: true,
      message: `Borrower ${borrower.isActive ? 'activated' : 'deactivated'}`,
      data: borrower,
    });
  } catch (err) {
    next(err);
  }
}

async function getBorrowerHistory(req, res, next) {
  try {
    const borrower = await Borrower.findById(req.params.id);
    if (!borrower) {
      throw new AppError('Borrower not found', 404);
    }

    const history = await IssueRecord.find({ borrower: borrower._id })
      .populate('book', 'title author isbn category')
      .sort({ issueDate: -1 });

    res.json({
      success: true,
      borrower: {
        _id: borrower._id,
        name: borrower.name,
        membershipId: borrower.membershipId,
        isActive: borrower.isActive,
      },
      count: history.length,
      data: history,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteBorrower(req, res, next) {
  try {
    const activeIssues = await IssueRecord.countDocuments({
      borrower: req.params.id,
      status: 'issued',
    });

    if (activeIssues > 0) {
      throw new AppError(
        'Cannot delete borrower with unreturned books',
        400
      );
    }

    const borrower = await Borrower.findByIdAndDelete(req.params.id);
    if (!borrower) {
      throw new AppError('Borrower not found', 404);
    }

    res.json({ success: true, message: 'Borrower deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBorrower,
  getBorrowers,
  getBorrowerById,
  updateBorrower,
  toggleBorrowerStatus,
  getBorrowerHistory,
  deleteBorrower,
};
