/**
 * Resource.js
 *
 * Mongoose Schema for Academic Resources and Notes Repository (Phase 7).
 */

const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'Syllabus',
          'Notes',
          'Reference PDF',
          'Lab Manual',
          'Question Paper',
          'Practical Material',
          'Other',
        ],
        message: '{VALUE} is not a valid resource category',
      },
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
    },
    subjectCode: {
      type: String,
      required: [true, 'Subject code is required'],
      uppercase: true,
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference is required'],
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8,
    },
    division: {
      type: String,
      default: 'ALL',
      uppercase: true,
      trim: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader user reference is required'],
    },
    uploaderName: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    storageKey: {
      type: String,
      required: [true, 'Storage key is required'],
      unique: true,
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    visibility: {
      type: String,
      enum: ['department', 'course', 'semester', 'division', 'public'],
      default: 'semester',
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high-performance filtered retrieval & search
resourceSchema.index({ subject: 1, category: 1, semester: 1 });
resourceSchema.index({ department: 1, course: 1, semester: 1, status: 1 });
resourceSchema.index({ uploadedBy: 1, status: 1 });
resourceSchema.index({ subjectCode: 1, status: 1 });
resourceSchema.index({ title: 'text', description: 'text', subjectCode: 'text' });

module.exports = mongoose.model('Resource', resourceSchema);
