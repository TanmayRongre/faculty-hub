const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    subjectCode: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
      unique: true,
    },
    subjectName: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      maxlength: [200, 'Subject name too long'],
    },
    // Official MSBTE course code (e.g. 315323 for STE)
    courseCode: {
      type: String,
      trim: true,
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
    // Faculty assigned to this subject (optional — linked when faculty records exist)
    assignedFaculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subjectSchema.index({ department: 1, semester: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
