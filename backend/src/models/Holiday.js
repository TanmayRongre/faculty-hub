const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: [true, 'Holiday date is required (YYYY-MM-DD)'],
      unique: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Please provide a valid date in YYYY-MM-DD format'],
    },
    title: {
      type: String,
      required: [true, 'Holiday title/reason is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['national', 'state', 'institutional', 'emergency'],
      default: 'national',
    },
    affectedLecturesCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled'],
      default: 'active',
    },
    academicYear: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Holiday', holidaySchema);
