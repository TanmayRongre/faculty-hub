/**
 * Notice.js
 *
 * Mongoose Schema for Digital Notice Board & Campus Circulars (Phase 8).
 */

const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    storageKey: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileUrl: { type: String, trim: true },
  },
  { _id: true }
);

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters'],
    },
    content: {
      type: String,
      required: [true, 'Notice content is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Notice category is required'],
      enum: {
        values: ['Academic', 'Examination', 'Department', 'General', 'Event', 'Urgent'],
        message: '{VALUE} is not a valid notice category',
      },
      default: 'General',
    },
    priority: {
      type: String,
      enum: {
        values: ['Normal', 'Important', 'Urgent'],
        message: '{VALUE} is not a valid priority level',
      },
      default: 'Normal',
    },
    targetScope: {
      type: String,
      enum: ['all', 'department', 'course', 'semester', 'division'],
      default: 'all',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
    semester: {
      type: Number,
      min: 1,
      max: 8,
    },
    division: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'ALL',
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    attachments: [attachmentSchema],
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Publisher reference is required'],
    },
    authorName: {
      type: String,
      trim: true,
    },
    authorRole: {
      type: String,
      trim: true,
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Archived', 'Expired'],
      default: 'Published',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast targeted queries and sorting
noticeSchema.index({ status: 1, publishDate: -1 });
noticeSchema.index({ targetScope: 1, department: 1, course: 1, semester: 1 });
noticeSchema.index({ priority: 1, publishDate: -1 });
noticeSchema.index({ category: 1, status: 1 });
noticeSchema.index({ publishedBy: 1, status: 1 });
noticeSchema.index({ expiryDate: 1 });
noticeSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Notice', noticeSchema);
