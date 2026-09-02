/**
 * resourceRoutes.js
 *
 * Express routes for /api/resources with multer upload and RBAC protection.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getResources,
  getResourceById,
  createResource,
  updateResource,
  archiveResource,
  deleteResource,
  downloadResource,
} = require('../controllers/resourceController');

// Multer memory storage (buffer is passed to storage abstraction)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

// All authenticated roles (student, faculty, admin) can list resources (filtered by role)
router.get('/', protect, getResources);

// All authenticated roles can download if authorized
router.get('/:id/download', protect, downloadResource);

// All authenticated roles can view resource details
router.get('/:id', protect, getResourceById);

// Faculty & Admin can upload resources
router.post('/', protect, authorize('admin', 'faculty'), upload.single('file'), createResource);

// Faculty & Admin can update metadata
router.put('/:id', protect, authorize('admin', 'faculty'), updateResource);

// Faculty & Admin can archive/restore
router.patch('/:id/archive', protect, authorize('admin', 'faculty'), archiveResource);

// Faculty & Admin can delete
router.delete('/:id', protect, authorize('admin', 'faculty'), deleteResource);

module.exports = router;
