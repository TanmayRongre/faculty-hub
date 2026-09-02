/**
 * Gallery.js
 *
 * Mongoose model for Student Extracurricular Activity Gallery & Submissions.
 */

const mongoose = require('mongoose');

const GalleryImageSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    caption: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const GallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Activity title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Activity description is required'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Activity category is required'],
      enum: [
        'Sports',
        'Cultural',
        'Technical',
        'Workshop',
        'Seminar',
        'Competition',
        'Club Activity',
        'Social Activity',
        'Other',
      ],
      default: 'Other',
    },
    eventName: {
      type: String,
      trim: true,
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    location: {
      type: String,
      trim: true,
    },
    // Contributor & Student identity
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    // Academic Context
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
      trim: true,
      uppercase: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    // Images array
    images: {
      type: [GalleryImageSchema],
      validate: [
        (val) => val.length >= 1 && val.length <= 10,
        'Gallery submission must include between 1 and 10 images',
      ],
    },
    // Moderation Status & Workflow
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewerName: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast filtering
GallerySchema.index({ status: 1, eventDate: -1, createdAt: -1 });
GallerySchema.index({ status: 1, category: 1 });
GallerySchema.index({ submittedBy: 1, status: 1 });

module.exports = mongoose.model('Gallery', GallerySchema);
