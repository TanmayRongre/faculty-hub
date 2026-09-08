const mongoose = require('mongoose');

const timetableSlotSchema = new mongoose.Schema(
  {
    // Faculty reference — optional until real faculty records are linked
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null,
    },
    // Faculty initials as shown in official timetable (e.g. SSP, RHR, PCJ, BPW, GRG)
    // Used until actual faculty profiles are created and linked
    facultyCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    subjectCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    subjectName: {
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
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    dayOfWeek: {
      type: String,
      required: [true, 'Day of week is required'],
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
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
      default: null,
    },
    /**
     * lectureType:
     *   theory    — common theory lecture (all students)
     *   practical — batch-wise lab/practical session
     *   activity  — curriculum/sports activity (not academic)
     *   library   — library time (not academic)
     *   off       — no lecture (OFF slot)
     *   recess    — lunch/break (not academic)
     */
    lectureType: {
      type: String,
      enum: ['theory', 'practical', 'activity', 'library', 'off', 'recess'],
      default: 'theory',
    },
    /**
     * isCommon:
     *   true  — applies to ALL 68 students (theory)
     *   false — applies only to a specific batch (practical)
     */
    isCommon: {
      type: Boolean,
      default: true,
    },
    /**
     * batch:
     *   'ALL' or null — for common/theory lectures
     *   'A', 'B', 'C' — for batch-wise practicals
     */
    batch: {
      type: String,
      enum: ['A', 'B', 'C', 'ALL', null],
      default: null,
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

timetableSlotSchema.index({ semester: 1, dayOfWeek: 1, status: 1 });
timetableSlotSchema.index({ faculty: 1, dayOfWeek: 1, status: 1 });
timetableSlotSchema.index({ room: 1, dayOfWeek: 1, status: 1 });
timetableSlotSchema.index({ batch: 1, dayOfWeek: 1 });
timetableSlotSchema.index({ lectureType: 1 });

module.exports = mongoose.model('TimetableSlot', timetableSlotSchema);
