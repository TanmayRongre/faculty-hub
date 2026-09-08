const { validationResult } = require('express-validator');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Department = require('../models/Department');

// ─── helpers ──────────────────────────────────────────────────────────────────
const buildStudentQuery = (query) => {
  const filter = {};
  const { search, status } = query;

  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { enrollmentNumber: { $regex: search, $options: 'i' } },
      { rollNumber: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) filter.status = status;

  return filter;
};

// ─── GET /api/students ────────────────────────────────────────────────────────
const getStudents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = buildStudentQuery(req.query);

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('department', 'name code')
        .populate('userId', 'name email role isActive')
        .collation({ locale: 'en', numericOrdering: true })
        .sort({ rollNumber: 1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: students,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('getStudents error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/students/me ─────────────────────────────────────────────────────
const getMyProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id })
      .populate('department', 'name code')
      .populate('userId', 'name email role isActive createdAt');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    res.json({ success: true, data: student });
  } catch (err) {
    console.error('getMyProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/students/:id ────────────────────────────────────────────────────
const getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('department', 'name code')
      .populate('userId', 'name email role isActive createdAt');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, data: student });
  } catch (err) {
    console.error('getStudent error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/students ───────────────────────────────────────────────────────
const createStudent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { enrollmentNumber, email, fullName, userId, password } = req.body;

    // Duplicate enrollment check
    const dupEnroll = await Student.findOne({
      enrollmentNumber: enrollmentNumber.toUpperCase().trim(),
    });
    if (dupEnroll) {
      return res.status(409).json({
        success: false,
        message: 'Enrollment number already exists',
      });
    }

    let linkedUserId = userId;

    if (linkedUserId) {
      const user = await User.findById(linkedUserId);
      if (!user) {
        return res.status(400).json({ success: false, message: 'Referenced user not found' });
      }
      if (user.role !== 'student') {
        return res.status(400).json({ success: false, message: 'Referenced user must have student role' });
      }
      const existingProfile = await Student.findOne({ userId: linkedUserId });
      if (existingProfile) {
        return res.status(409).json({ success: false, message: 'A student profile already exists for this user' });
      }
      const isFaculty = await Faculty.findOne({ userId: linkedUserId });
      if (isFaculty) {
        return res.status(409).json({ success: false, message: 'User is already registered as faculty' });
      }
    } else {
      // Email is optional for CE students — generate a system email if not provided
      const enrollUpper = enrollmentNumber.toUpperCase().trim();
      const cleanEmail = email
        ? email.toLowerCase().trim()
        : `sys.${enrollUpper.toLowerCase()}@ce.drpdp.local`;

      let user = await User.findOne({ email: cleanEmail });
      if (user) {
        if (user.role !== 'student') {
          return res.status(400).json({
            success: false,
            message: `User with email ${cleanEmail} already exists with role '${user.role}'`,
          });
        }
        const existingProfile = await Student.findOne({ userId: user._id });
        if (existingProfile) {
          return res.status(409).json({
            success: false,
            message: 'A student profile already exists for this user account',
          });
        }
        linkedUserId = user._id;
      } else {
        const newUser = await User.create({
          name: fullName.trim(),
          email: cleanEmail,
          password: password || 'Student@1234',
          role: 'student',
        });
        linkedUserId = newUser._id;
      }
    }

    // Default to Computer Engineering department
    let departmentId = req.body.department;
    if (!departmentId) {
      const dept = await Department.findOne({ code: 'CE' }) || await Department.findOne();
      departmentId = dept ? dept._id : null;
    }

    const studentData = {
      ...req.body,
      department: departmentId,
      semester: req.body.semester ? Number(req.body.semester) : 5,
      academicYear: req.body.academicYear || '2026-2027',
      userId: linkedUserId,
      enrollmentNumber: enrollmentNumber.toUpperCase().trim(),
      email: email ? email.toLowerCase().trim() : null,
      fullName: fullName.trim(),
      examSeatNumber: req.body.examSeatNumber || null,
      batch: req.body.batch || null,
    };

    const student = await Student.create(studentData);
    await student.populate('department', 'name code');
    await student.populate('userId', 'name email role isActive');

    res.status(201).json({ success: true, data: student, message: 'Student created successfully' });
  } catch (err) {
    console.error('createStudent error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `Duplicate value for ${field}` });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/students/:id ────────────────────────────────────────────────────
const updateStudent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (req.body.enrollmentNumber) {
      const dup = await Student.findOne({
        enrollmentNumber: req.body.enrollmentNumber.toUpperCase().trim(),
        _id: { $ne: req.params.id },
      });
      if (dup) {
        return res.status(409).json({ success: false, message: 'Enrollment number already in use' });
      }
    }

    const updates = { ...req.body };
    if (updates.enrollmentNumber) {
      updates.enrollmentNumber = updates.enrollmentNumber.toUpperCase().trim();
    }
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }

    delete updates.userId;

    const student = await Student.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('department', 'name code')
      .populate('userId', 'name email role isActive');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (updates.fullName || updates.email) {
      const userUpdates = {};
      if (updates.fullName) userUpdates.name = updates.fullName.trim();
      if (updates.email) userUpdates.email = updates.email;
      await User.findByIdAndUpdate(student.userId, userUpdates);
    }

    res.json({ success: true, data: student, message: 'Student updated successfully' });
  } catch (err) {
    console.error('updateStudent error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `Duplicate value for ${field}` });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PATCH /api/students/:id/status ───────────────────────────────────────────
const updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive', 'graduated'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'active', 'inactive', or 'graduated'",
      });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('department', 'name code');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await User.findByIdAndUpdate(student.userId, { isActive: status === 'active' });

    res.json({ success: true, data: student, message: `Student status updated to ${status}` });
  } catch (err) {
    console.error('updateStudentStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── DELETE /api/students/:id ─────────────────────────────────────────────────
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await Student.findByIdAndDelete(req.params.id);
    await User.findByIdAndDelete(student.userId);

    res.json({ success: true, message: 'Student and linked user account deleted successfully' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getStudents,
  getMyProfile,
  getStudent,
  createStudent,
  updateStudent,
  updateStudentStatus,
  deleteStudent,
};
