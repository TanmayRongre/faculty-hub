const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createTask,
  getTasks,
  getTaskSummary,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require('../controllers/taskController');

// All task routes require authentication (faculty or admin)
router.use(protect, authorize('faculty', 'admin'));

// Summary endpoint
router.get('/summary', getTaskSummary);

// Task CRUD
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.post('/', authorize('admin'), createTask);
router.put('/:id', authorize('admin'), updateTask);
router.patch('/:id/status', updateTaskStatus); // Faculty or admin can update status
router.delete('/:id', authorize('admin'), deleteTask);

module.exports = router;
