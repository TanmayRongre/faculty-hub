const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
    },
    enrollmentNumber: {
      type: String,
      required: [true, 'Enrollment number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [150, 'Name too long'],
    },
    // Email is optional — real student emails not provided
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    // Exam Seat No — provided by institution; null until assigned
    examSeatNumber: {
      type: String,
      trim: true,
      default: null,
    },
    // Practical batch (A, B, C) — null until batch list is provided
    batch: {
      type: String,
      enum: ['A', 'B', 'C', null],
      default: null,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    semester: {
      type: Number,
      default: 5,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'graduated'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Indexes for search and filtering
studentSchema.index({ rollNumber: 1 });
studentSchema.index({ department: 1 });
studentSchema.index({ semester: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ batch: 1 });
studentSchema.index({ fullName: 'text', enrollmentNumber: 'text', rollNumber: 'text' });

module.exports = mongoose.model('Student', studentSchema);
