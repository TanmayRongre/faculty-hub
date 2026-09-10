const mongoose = require('mongoose');

const substitutionRequestSchema = new mongoose.Schema(
  {
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Applicant faculty is required'],
      index: true,
    },
    substituteFacultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Substitute faculty is required'],
      index: true,
    },
    subjectCode: {
      type: String,
      required: [true, 'Subject code is required'],
      uppercase: true,
      trim: true,
    },
    subjectName: {
      type: String,
      trim: true,
    },
    date: {
      type: String,
      required: [true, 'Date (YYYY-MM-DD) is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
      index: true,
    },
    startTime: {
      type: String,
      required: [true, 'Start time (HH:mm) is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time (HH:mm) is required'],
      trim: true,
    },
    sessionType: {
      type: String,
      enum: ['LECTURE', 'PRACTICAL'],
      required: [true, 'Session type must be LECTURE or PRACTICAL'],
    },
    batch: {
      type: String,
      enum: ['A', 'B', 'C', null],
      default: null,
    },
    room: {
      type: String,
      required: [true, 'Room is required'],
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason for leave/absence is required'],
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    respondedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound indexes for conflict resolution, date overrides, and dashboard queries
substitutionRequestSchema.index({ date: 1, startTime: 1, subjectCode: 1, batch: 1, status: 1 });
substitutionRequestSchema.index({ substituteFacultyId: 1, date: 1, status: 1 });
substitutionRequestSchema.index({ applicantId: 1, date: 1, status: 1 });

module.exports = mongoose.model('SubstitutionRequest', substitutionRequestSchema);
