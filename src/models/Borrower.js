const mongoose = require('mongoose');

const borrowerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Borrower name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      minlength: [7, 'Phone number must be at least 7 characters'],
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },
    membershipId: {
      type: String,
      unique: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [250, 'Address cannot exceed 250 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

borrowerSchema.pre('save', function generateMembershipId(next) {
  if (this.isNew && !this.membershipId) {
    const suffix = Math.floor(100000 + Math.random() * 900000);
    this.membershipId = `LIB-${suffix}`;
  }
  next();
});

module.exports = mongoose.model('Borrower', borrowerSchema);
