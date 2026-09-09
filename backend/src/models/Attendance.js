/**
 * Attendance.js
 *
 * Mongoose model for Attendance records.
 * Supports distinct Lecture (Common for 68 students) and Practical (Batch-wise: A, B, C) attendance.
 */

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    attendanceType: {
      type: String,
      enum: ['LECTURE', 'PRACTICAL'],
      required: [true, 'Attendance type (LECTURE or PRACTICAL) is required'],
      uppercase: true,
      trim: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
      index: true,
    },
    subjectCode: {
      type: String,
      enum: ['STE', 'OSY', 'ENDS', 'ACN'],
      required: [true, 'Subject code is required (STE, OSY, ENDS, ACN)'],
      uppercase: true,
      trim: true,
      index: true,
    },
    batch: {
      type: String,
      enum: ['A', 'B', 'C', null],
      default: null,
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required (YYYY-MM-DD)'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session identifier is required'],
      trim: true,
      index: true,
    },
    slot: {
      type: String,
      trim: true,
      default: '10:30 - 11:30',
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
      index: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
    },
    enrollmentNumber: {
      type: String,
      required: [true, 'Enrollment number is required'],
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'Present', 'Absent'],
      default: 'PRESENT',
      required: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Unique student per session
attendanceSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
// Compound search index
attendanceSchema.index({ subjectCode: 1, attendanceType: 1, batch: 1, date: 1 });
attendanceSchema.index({ studentId: 1, subjectCode: 1, attendanceType: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
