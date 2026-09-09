const mongoose = require('mongoose');

const facultySubjectAssignmentSchema = new mongoose.Schema(
  {
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty reference is required'],
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
    },
    semester: {
      type: Number,
      default: 5,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate assignments of the same subject to the same faculty member
facultySubjectAssignmentSchema.index({ facultyId: 1, subjectId: 1 }, { unique: true });

module.exports = mongoose.model('FacultySubjectAssignment', facultySubjectAssignmentSchema);
