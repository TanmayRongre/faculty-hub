const { validationResult } = require('express-validator');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Semester = require('../models/Semester');
const Division = require('../models/Division');
const Subject = require('../models/Subject');
const Faculty = require('../models/Faculty');

// ─────────────────────── DEPARTMENTS ─────────────────────────────────────────

const getDepartments = async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    const departments = await Department.find(filter).sort({ name: 1 });
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const dept = await Department.create(req.body);
    res.status(201).json({ success: true, data: dept, message: 'Department created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Department name or code already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    res.json({ success: true, data: dept, message: 'Department updated' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Department name or code already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────── COURSES ─────────────────────────────────────────────

const getCourses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.all !== 'true') filter.isActive = true;
    const courses = await Course.find(filter).populate('department', 'name code').sort({ name: 1 });
    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const course = await Course.create(req.body);
    await course.populate('department', 'name code');
    res.status(201).json({ success: true, data: course, message: 'Course created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Course code already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    }).populate('department', 'name code');
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, data: course, message: 'Course updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────── SEMESTERS ───────────────────────────────────────────

const getSemesters = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.course) filter.course = req.query.course;
    if (req.query.all !== 'true') filter.isActive = true;
    const semesters = await Semester.find(filter)
      .populate('department', 'name code')
      .populate('course', 'name code')
      .sort({ semesterNumber: 1 });
    res.json({ success: true, data: semesters });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createSemester = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    let departmentId = req.body.department;
    if (!departmentId) {
      const dept = await Department.findOne({ code: 'CO' }) || await Department.findOne();
      departmentId = dept ? dept._id : null;
    }

    const semester = await Semester.create({
      ...req.body,
      department: departmentId,
    });
    await semester.populate('department', 'name code');
    res.status(201).json({ success: true, data: semester, message: 'Semester created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Semester already exists for this course and year' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateSemester = async (req, res) => {
  try {
    const semester = await Semester.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate('department', 'name code')
      .populate('course', 'name code');
    if (!semester) return res.status(404).json({ success: false, message: 'Semester not found' });
    res.json({ success: true, data: semester, message: 'Semester updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────── DIVISIONS ───────────────────────────────────────────

const getDivisions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.course) filter.course = req.query.course;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.all !== 'true') filter.isActive = true;
    const divisions = await Division.find(filter)
      .populate('department', 'name code')
      .populate('course', 'name code')
      .sort({ name: 1 });
    res.json({ success: true, data: divisions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createDivision = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const division = await Division.create(req.body);
    await division.populate('department', 'name code');
    res.status(201).json({ success: true, data: division, message: 'Division created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Division already exists for this semester and year' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateDivision = async (req, res) => {
  try {
    const division = await Division.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate('department', 'name code');
    if (!division) return res.status(404).json({ success: false, message: 'Division not found' });
    res.json({ success: true, data: division, message: 'Division updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────── SUBJECTS ────────────────────────────────────────────

const getSubjects = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.all !== 'true') filter.isActive = true;

    const subjects = await Subject.find(filter)
      .populate('department', 'name code')
      .populate('assignedFaculty', 'fullName designation')
      .sort({ semester: 1, subjectName: 1 });

    res.json({ success: true, data: subjects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createSubject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (req.body.assignedFaculty) {
      const fac = await Faculty.findById(req.body.assignedFaculty);
      if (!fac) {
        return res.status(400).json({ success: false, message: 'Assigned faculty not found' });
      }
    }

    let departmentId = req.body.department;
    if (!departmentId) {
      const dept = await Department.findOne({ code: 'CO' }) || await Department.findOne();
      departmentId = dept ? dept._id : null;
    }

    const subject = await Subject.create({
      ...req.body,
      department: departmentId,
      semester: req.body.semester ? Number(req.body.semester) : 5,
    });
    await subject.populate('department', 'name code');
    await subject.populate('assignedFaculty', 'fullName designation');

    res.status(201).json({ success: true, data: subject, message: 'Subject created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Subject code already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateSubject = async (req, res) => {
  try {
    if (req.body.assignedFaculty) {
      const fac = await Faculty.findById(req.body.assignedFaculty);
      if (!fac) {
        return res.status(400).json({ success: false, message: 'Assigned faculty not found' });
      }
    }

    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate('department', 'name code')
      .populate('assignedFaculty', 'fullName designation');

    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    res.json({ success: true, data: subject, message: 'Subject updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getDepartments, createDepartment, updateDepartment,
  getCourses, createCourse, updateCourse,
  getSemesters, createSemester, updateSemester,
  getDivisions, createDivision, updateDivision,
  getSubjects, createSubject, updateSubject,
};
