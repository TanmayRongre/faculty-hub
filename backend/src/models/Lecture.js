const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema(
  {
    timetableSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimetableSlot',
    },
    lectureId: {
      type: String,
      required: [true, 'Lecture identifier is required'],
      trim: true,
      index: true,
    },
    date: {
      type: String,
      required: [true, 'Lecture date is required (YYYY-MM-DD)'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Please provide a valid date in YYYY-MM-DD format'],
      index: true,
    },
    dayOfWeek: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty is required'],
      index: true,
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
    },
    semester: {
      type: Number,
      default: 5,
      index: true,
    },
    division: {
      type: String,
      default: 'A',
      uppercase: true,
      trim: true,
      index: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
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
      enum: ['scheduled', 'conducted', 'holiday', 'cancelled', 'rescheduled', 'rescheduling_required', 'missed'],
      default: 'scheduled',
      index: true,
    },
    // Rescheduling & Holiday traceability
    isRescheduled: {
      type: Boolean,
      default: false,
    },
    originalLecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lecture',
    },
    replacementLecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lecture',
    },
    holiday: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Holiday',
    },
    rescheduleReason: {
      type: String,
      trim: true,
    },
    rescheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rescheduledAt: {
      type: Date,
    },
    attendanceRecorded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

lectureSchema.index({ date: 1, faculty: 1 });
lectureSchema.index({ date: 1, semester: 1, division: 1 });
lectureSchema.index({ date: 1, room: 1 });

module.exports = mongoose.model('Lecture', lectureSchema);
