const Task = require('../models/Task');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Department = require('../models/Department');

/**
 * Helper to resolve whether assignedTo is a Faculty _id or User _id.
 * Always stores the User _id in Task.assignedTo.
 */
async function resolveAssignedUser(assignedTo) {
  if (!assignedTo) return null;
  // Check if assignedTo is a User
  const user = await User.findById(assignedTo);
  if (user && user.role === 'faculty') {
    return user;
  }
  // If not, check if it's a Faculty record
  const faculty = await Faculty.findById(assignedTo).populate('userId');
  if (faculty && faculty.userId) {
    return faculty.userId;
  }
  return null;
}

// ─── POST /api/tasks (Admin only: Create Task) ────────────────────────────────
const createTask = async (req, res) => {
  try {
    const {
      title,
      description = '',
      assignedTo,
      subjectId = null,
      priority = 'Medium',
      dueDate,
      status = 'Pending',
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }
    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'Assigned faculty is required' });
    }
    if (!dueDate) {
      return res.status(400).json({ success: false, message: 'Due date is required' });
    }

    const assignedUser = await resolveAssignedUser(assignedTo);
    if (!assignedUser) {
      return res.status(400).json({ success: false, message: 'Invalid assigned faculty member' });
    }

    // Optional Subject validation
    let validSubjectId = null;
    if (subjectId) {
      let sub = null;
      if (typeof subjectId === 'string' && subjectId.length !== 24) {
        sub = await Subject.findOne({ subjectCode: subjectId.toUpperCase().trim() });
      } else {
        sub = await Subject.findById(subjectId);
      }
      if (sub) {
        validSubjectId = sub._id;
      }
    }

    // Resolve department
    const dept = await Department.findOne({ code: 'CE' }) || await Department.findOne();

    const task = await Task.create({
      title: title.trim(),
      description: description.trim(),
      assignedTo: assignedUser._id,
      assignedBy: req.user._id,
      subjectId: validSubjectId,
      departmentId: dept?._id || null,
      semester: 5,
      priority,
      dueDate: new Date(dueDate),
      status,
    });

    await task.populate('assignedTo', 'name email role');
    await task.populate('assignedBy', 'name email role');
    await task.populate('subjectId', 'subjectCode subjectName');

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created and assigned successfully',
    });
  } catch (err) {
    console.error('createTask error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error creating task' });
  }
};

// ─── GET /api/tasks (Admin: all tasks, Faculty: only their own tasks) ─────────
const getTasks = async (req, res) => {
  try {
    const filter = {};

    // RBAC: Faculty can ONLY access tasks assigned to themselves
    if (req.user.role === 'faculty') {
      filter.assignedTo = req.user._id;
    } else if (req.user.role === 'admin') {
      // Admin optional filter by faculty
      if (req.query.faculty) {
        const assignedUser = await resolveAssignedUser(req.query.faculty);
        if (assignedUser) {
          filter.assignedTo = assignedUser._id;
        }
      }
    }

    // Optional filter by subject
    if (req.query.subject) {
      const sub = await Subject.findOne({ subjectCode: req.query.subject.toUpperCase().trim() });
      if (sub) filter.subjectId = sub._id;
      else if (req.query.subject.length === 24) filter.subjectId = req.query.subject;
    }

    // Optional filter by priority
    if (req.query.priority && req.query.priority !== 'All') {
      filter.priority = req.query.priority;
    }

    // Optional filter by status
    if (req.query.status && req.query.status !== 'All') {
      if (req.query.status === 'Overdue') {
        filter.status = { $nin: ['Completed', 'Cancelled'] };
        filter.dueDate = { $lt: new Date() };
      } else {
        filter.status = req.query.status;
      }
    }

    // Search query
    if (req.query.search) {
      filter.title = { $regex: req.query.search.trim(), $options: 'i' };
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('subjectId', 'subjectCode subjectName')
      .sort({ dueDate: 1, priority: 1, createdAt: -1 });

    // Ensure virtuals are serialized
    const taskObjects = tasks.map((t) => t.toJSON());

    res.json({
      success: true,
      count: taskObjects.length,
      data: taskObjects,
    });
  } catch (err) {
    console.error('getTasks error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching tasks' });
  }
};

// ─── GET /api/tasks/summary (Summary metrics for Dashboard) ───────────────────
const getTaskSummary = async (req, res) => {
  try {
    const isFaculty = req.user.role === 'faculty';
    const baseFilter = isFaculty ? { assignedTo: req.user._id } : {};

    const now = new Date();

    const [totalTasks, pendingTasks, inProgressTasks, completedTasks, overdueTasks] =
      await Promise.all([
        Task.countDocuments(baseFilter),
        Task.countDocuments({ ...baseFilter, status: 'Pending' }),
        Task.countDocuments({ ...baseFilter, status: 'In Progress' }),
        Task.countDocuments({ ...baseFilter, status: 'Completed' }),
        Task.countDocuments({
          ...baseFilter,
          status: { $nin: ['Completed', 'Cancelled'] },
          dueDate: { $lt: now },
        }),
      ]);

    let assignedSubjectsCount = 0;
    if (isFaculty) {
      const faculty = await Faculty.findOne({ userId: req.user._id });
      if (faculty && faculty.subjects) {
        assignedSubjectsCount = faculty.subjects.length;
      }
    }

    res.json({
      success: true,
      data: {
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        assignedSubjectsCount,
      },
    });
  } catch (err) {
    console.error('getTaskSummary error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching task summary' });
  }
};

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email role')
      .populate('subjectId', 'subjectCode subjectName');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Faculty security check: can only view task assigned to themselves
    if (req.user.role === 'faculty' && String(task.assignedTo._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied: Unauthorized task' });
    }

    res.json({ success: true, data: task.toJSON() });
  } catch (err) {
    console.error('getTaskById error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── PUT /api/tasks/:id (Admin only: Edit task) ───────────────────────────────
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const {
      title,
      description,
      assignedTo,
      subjectId,
      priority,
      dueDate,
      status,
    } = req.body;

    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (priority) task.priority = priority;
    if (dueDate) task.dueDate = new Date(dueDate);

    if (status) {
      task.status = status;
      if (status === 'Completed' && !task.completedAt) {
        task.completedAt = new Date();
      } else if (status !== 'Completed') {
        task.completedAt = null;
      }
    }

    if (assignedTo) {
      const assignedUser = await resolveAssignedUser(assignedTo);
      if (assignedUser) {
        task.assignedTo = assignedUser._id;
      }
    }

    if (subjectId !== undefined) {
      if (!subjectId) {
        task.subjectId = null;
      } else {
        const sub = await Subject.findOne({
          $or: [
            { _id: subjectId.length === 24 ? subjectId : null },
            { subjectCode: String(subjectId).toUpperCase().trim() },
          ],
        });
        task.subjectId = sub ? sub._id : null;
      }
    }

    await task.save();

    await task.populate('assignedTo', 'name email role');
    await task.populate('assignedBy', 'name email role');
    await task.populate('subjectId', 'subjectCode subjectName');

    res.json({ success: true, data: task.toJSON(), message: 'Task updated successfully' });
  } catch (err) {
    console.error('updateTask error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// ─── PATCH /api/tasks/:id/status (Faculty can update status of own task) ──────
const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['Pending', 'In Progress', 'Completed'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Faculty security check: only the assigned faculty or admin can update status
    if (req.user.role === 'faculty' && String(task.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only update the status of your own tasks',
      });
    }

    task.status = status;
    if (status === 'Completed') {
      task.completedAt = new Date();
    } else {
      task.completedAt = null;
    }

    await task.save();

    await task.populate('assignedTo', 'name email role');
    await task.populate('assignedBy', 'name email role');
    await task.populate('subjectId', 'subjectCode subjectName');

    res.json({
      success: true,
      data: task.toJSON(),
      message: `Task status updated to ${status}`,
    });
  } catch (err) {
    console.error('updateTaskStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error updating task status' });
  }
};

// ─── DELETE /api/tasks/:id (Admin only: Delete Task) ──────────────────────────
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    console.error('deleteTask error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting task' });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskSummary,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
};
