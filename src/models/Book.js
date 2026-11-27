const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
      maxlength: [100, 'Author cannot exceed 100 characters'],
    },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
    },
    categories: {
      type: [String],
      required: [true, 'At least one category is required'],
      default: ['General'],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) && arr.length > 0 && arr.every((c) => typeof c === 'string' && c.trim().length > 0),
        message: 'At least one valid category is required',
      },
    },
    publishedYear: {
      type: Number,
      min: [1000, 'Published year must be valid'],
      max: [new Date().getFullYear() + 1, 'Published year cannot be in the far future'],
    },
    totalCopies: {
      type: Number,
      required: [true, 'Total copies is required'],
      min: [1, 'Total copies must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Total copies must be a whole number',
      },
    },
    availableCopies: {
      type: Number,
      min: [0, 'Available copies cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Available copies must be a whole number',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
  },
  { timestamps: true }
);

bookSchema.pre('validate', function syncAvailableCopies(next) {
  if (this.isNew && (this.availableCopies === undefined || this.availableCopies === null)) {
    this.availableCopies = this.totalCopies;
  }
  if (this.availableCopies > this.totalCopies) {
    this.invalidate('availableCopies', 'Available copies cannot exceed total copies');
  }
  next();
});

bookSchema.index({ title: 'text', author: 'text', isbn: 'text' });

module.exports = mongoose.model('Book', bookSchema);
