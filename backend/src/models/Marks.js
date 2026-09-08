const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
    },
    rollNo: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required'],
    },
    subjectCode: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
    },
    semester: {
      type: Number,
      default: 5,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    pa1: {
      type: Number,
      default: null,
      min: [0, 'PA1 mark cannot be negative'],
      max: [30, 'PA1 mark cannot exceed 30'],
    },
    pa2: {
      type: Number,
      default: null,
      min: [0, 'PA2 mark cannot be negative'],
      max: [30, 'PA2 mark cannot exceed 30'],
    },
    average: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate average before saving if both pa1 and pa2 are provided
marksSchema.pre('save', function (next) {
  if (
    this.pa1 !== null &&
    this.pa1 !== undefined &&
    this.pa2 !== null &&
    this.pa2 !== undefined
  ) {
    this.average = Math.round(((Number(this.pa1) + Number(this.pa2)) / 2) * 100) / 100;
  } else {
    this.average = null;
  }
  next();
});

// Ensure uniqueness per student and subject
marksSchema.index({ studentId: 1, subjectId: 1 }, { unique: true });
marksSchema.index({ subjectCode: 1, rollNo: 1 });
marksSchema.index({ semester: 1, department: 1 });

module.exports = mongoose.model('Marks', marksSchema);
