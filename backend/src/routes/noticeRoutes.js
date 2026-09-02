/**
 * noticeRoutes.js
 *
 * Express routes for /api/notices with multer attachment upload and RBAC protection.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  publishNotice,
  archiveNotice,
  deleteNotice,
  downloadAttachment,
} = require('../controllers/noticeController');

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
  },
});

// All authenticated roles (student, faculty, admin) can list notices (filtered by role)
router.get('/', protect, getNotices);

// Download attachment
router.get('/:id/attachments/:index/download', protect, downloadAttachment);

// View notice details
router.get('/:id', protect, getNoticeById);

// Faculty & Admin can create notices (with optional attachment)
router.post('/', protect, authorize('admin', 'faculty'), upload.single('file'), createNotice);

// Faculty & Admin can update
router.put('/:id', protect, authorize('admin', 'faculty'), upload.single('file'), updateNotice);

// Faculty & Admin can publish draft
router.patch('/:id/publish', protect, authorize('admin', 'faculty'), publishNotice);

// Faculty & Admin can archive/restore
router.patch('/:id/archive', protect, authorize('admin', 'faculty'), archiveNotice);

// Faculty & Admin can delete
router.delete('/:id', protect, authorize('admin', 'faculty'), deleteNotice);

module.exports = router;
