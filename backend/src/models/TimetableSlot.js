const mongoose = require('mongoose');

const timetableSlotSchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty is required'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
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
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    semester: {
      type: Number,
      default: 5,
    },
    division: {
      type: String,
      default: 'A',
      uppercase: true,
      trim: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    dayOfWeek: {
      type: String,
      required: [true, 'Day of week is required'],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (HH:mm)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide a valid time in HH:mm format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (HH:mm)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide a valid time in HH:mm format'],
    },
    room: {
      type: String,
      trim: true,
      default: 'Classroom',
    },
    lectureType: {
      type: String,
      enum: ['theory', 'practical', 'tutorial'],
      default: 'theory',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

timetableSlotSchema.index({ faculty: 1, dayOfWeek: 1, status: 1 });
timetableSlotSchema.index({ semester: 1, dayOfWeek: 1, status: 1 });
timetableSlotSchema.index({ room: 1, dayOfWeek: 1, status: 1 });

module.exports = mongoose.model('TimetableSlot', timetableSlotSchema);
