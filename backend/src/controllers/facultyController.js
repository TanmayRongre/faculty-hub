const { validationResult } = require('express-validator');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Department = require('../models/Department');
const FacultySubjectAssignment = require('../models/FacultySubjectAssignment');

// ─── helpers ──────────────────────────────────────────────────────────────────
const buildFacultyQuery = (query) => {
  const filter = {};
  const { search, designation, status } = query;

  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (designation) filter.designation = designation;
  if (status) filter.status = status;

  return filter;
};

// ─── GET /api/faculty ─────────────────────────────────────────────────────────
const getFacultyList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = buildFacultyQuery(req.query);

    const [faculty, total] = await Promise.all([
      Faculty.find(filter)
        .populate('department', 'name code')
        .populate('subjects', 'subjectCode subjectName semester')
        .populate('userId', 'name email role isActive')
        .sort({ fullName: 1 })
        .skip(skip)
        .limit(limit),
      Faculty.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: faculty,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getFacultyList error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/faculty/me ──────────────────────────────────────────────────────
const getMyFacultyProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id })
      .populate('department', 'name code')
      .populate('subjects', 'subjectCode subjectName semester')
      .populate('userId', 'name email role isActive createdAt');

    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }
    res.json({ success: true, data: faculty });
  } catch (err) {
    console.error('getMyFacultyProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET /api/faculty/:id ─────────────────────────────────────────────────────
const getFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('department', 'name code')
      .populate('subjects', 'subjectCode subjectName semester')
      .populate('userId', 'name email role isActive createdAt');

    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }
    res.json({ success: true, data: faculty });
  } catch (err) {
    console.error('getFaculty error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/faculty ────────────────────────────────────────────────────────
const createFaculty = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, fullName, userId, designation, subjects, password } = req.body;

    // Validate subject references
    if (subjects && subjects.length > 0) {
      const count = await Subject.countDocuments({ _id: { $in: subjects } });
      if (count !== subjects.length) {
        return res.status(400).json({ success: false, message: 'One or more subject IDs are invalid' });
      }
    }

    let linkedUserId = userId;

    if (linkedUserId) {
      const user = await User.findById(linkedUserId);
      if (!user) {
        return res.status(400).json({ success: false, message: 'Referenced user not found' });
      }
      if (!['faculty', 'admin'].includes(user.role)) {
        return res.status(400).json({ success: false, message: 'Referenced user must have faculty or admin role' });
      }
      const existingProfile = await Faculty.findOne({ userId: linkedUserId });
      if (existingProfile) {
        return res.status(409).json({ success: false, message: 'A faculty profile already exists for this user' });
      }
      const isStudent = await Student.findOne({ userId: linkedUserId });
      if (isStudent) {
        return res.status(409).json({ success: false, message: 'User is already registered as student' });
      }
    } else {
      const cleanEmail = email.toLowerCase().trim();
      let user = await User.findOne({ email: cleanEmail });
      if (user) {
        if (!['faculty', 'admin'].includes(user.role)) {
          return res.status(400).json({
            success: false,
            message: `User with email ${cleanEmail} already exists with role '${user.role}'`,
          });
        }
        const existingProfile = await Faculty.findOne({ userId: user._id });
        if (existingProfile) {
          return res.status(409).json({
            success: false,
            message: 'A faculty profile already exists for this user account',
          });
        }
        linkedUserId = user._id;
      } else {
        const newUser = await User.create({
          name: fullName.trim(),
          email: cleanEmail,
          password: password || 'Faculty@1234',
          role: 'faculty',
        });
        linkedUserId = newUser._id;
      }
    }

    let departmentId = req.body.department;
    if (!departmentId) {
      const dept = await Department.findOne({ code: 'CO' }) || await Department.findOne();
      departmentId = dept ? dept._id : null;
    }

    const facultyData = {
      ...req.body,
      department: departmentId,
      designation: designation.trim(),
      userId: linkedUserId,
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
    };

    const faculty = await Faculty.create(facultyData);
    if (subjects && subjects.length > 0) {
      const assignmentDocs = subjects.map((subId) => ({
        facultyId: faculty._id,
        subjectId: subId,
        departmentId: faculty.department,
        semester: 5,
        active: true,
      }));
      await FacultySubjectAssignment.insertMany(assignmentDocs);
    }
    await faculty.populate('department', 'name code');
    await faculty.populate('subjects', 'subjectCode subjectName');
    await faculty.populate('userId', 'name email role isActive');

    res.status(201).json({ success: true, data: faculty, message: 'Faculty created successfully' });
  } catch (err) {
    console.error('createFaculty error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ success: false, message: `Duplicate value for ${field}` });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/faculty/:id ─────────────────────────────────────────────────────
const updateFaculty = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (req.body.subjects && req.body.subjects.length > 0) {
      const count = await Subject.countDocuments({ _id: { $in: req.body.subjects } });
      if (count !== req.body.subjects.length) {
        return res.status(400).json({ success: false, message: 'One or more subject IDs are invalid' });
      }
    }

    delete req.body.userId;

    const faculty = await Faculty.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate('department', 'name code')
      .populate('subjects', 'subjectCode subjectName semester')
      .populate('userId', 'name email role isActive');

    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    if (faculty.userId && (req.body.fullName || req.body.email)) {
      const userUpdates = {};
      if (req.body.fullName) userUpdates.name = req.body.fullName.trim();
      if (req.body.email) userUpdates.email = req.body.email.toLowerCase().trim();
      await User.findByIdAndUpdate(faculty.userId._id || faculty.userId, userUpdates);
    }

    res.json({ success: true, data: faculty, message: 'Faculty updated successfully' });
  } catch (err) {
    console.error('updateFaculty error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate value encountered' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PATCH /api/faculty/:id/status ───────────────────────────────────────────
const updateFacultyStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const faculty = await Faculty.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after', runValidators: true }
    ).populate('department', 'name code');

    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    if (faculty.userId) {
      await User.findByIdAndUpdate(faculty.userId, { isActive: status === 'active' });
    }

    res.json({ success: true, data: faculty, message: `Faculty status updated to ${status}` });
  } catch (err) {
    console.error('updateFacultyStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/faculty/:id/subjects (Admin: Batch assign subjects) ───────────
const assignSubjects = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectIds = [] } = req.body;

    const faculty = await Faculty.findById(id).populate('department');
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    // Validate that all subjectIds exist
    let validSubjects = [];
    if (subjectIds.length > 0) {
      validSubjects = await Subject.find({ _id: { $in: subjectIds } });
      if (validSubjects.length !== subjectIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more provided subject IDs are invalid',
        });
      }
    }

    // Update FacultySubjectAssignment collection:
    // Remove existing assignments for this faculty
    await FacultySubjectAssignment.deleteMany({ facultyId: faculty._id });

    // Insert new assignments preventing duplicates
    if (validSubjects.length > 0) {
      const assignmentDocs = validSubjects.map((sub) => ({
        facultyId: faculty._id,
        subjectId: sub._id,
        departmentId: faculty.department?._id || sub.department,
        semester: sub.semester || 5,
        active: true,
      }));
      await FacultySubjectAssignment.insertMany(assignmentDocs);
    }

    // Update the subjects array on the Faculty document for fast population
    faculty.subjects = validSubjects.map((s) => s._id);
    await faculty.save();

    await faculty.populate('department', 'name code');
    await faculty.populate('subjects', 'subjectCode subjectName semester courseCode');
    await faculty.populate('userId', 'name email role isActive');

    res.json({
      success: true,
      data: faculty,
      message: `Successfully assigned ${validSubjects.length} subject(s) to ${faculty.fullName}`,
    });
  } catch (err) {
    console.error('assignSubjects error:', err);
    res.status(500).json({ success: false, message: 'Server error assigning subjects' });
  }
};

// ─── GET /api/faculty/me/assigned-subjects (Faculty: view own assigned subjects) ──
const getMyAssignedSubjects = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id })
      .populate('subjects', 'subjectCode subjectName semester courseCode department')
      .populate('department', 'name code');

    if (!faculty) {
      // If admin, return all active subjects
      if (req.user.role === 'admin') {
        const allSubjects = await Subject.find({ semester: 5 }).sort({ subjectCode: 1 });
        return res.json({ success: true, data: allSubjects, isAdmin: true });
      }
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    res.json({
      success: true,
      data: faculty.subjects || [],
      department: faculty.department,
      facultyId: faculty._id,
      fullName: faculty.fullName,
      designation: faculty.designation,
    });
  } catch (err) {
    console.error('getMyAssignedSubjects error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching assigned subjects' });
  }
};

module.exports = {
  getFacultyList,
  getMyFacultyProfile,
  getFaculty,
  createFaculty,
  updateFaculty,
  updateFacultyStatus,
  assignSubjects,
  getMyAssignedSubjects,
};

