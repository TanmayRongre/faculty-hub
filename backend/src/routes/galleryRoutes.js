/**
 * galleryRoutes.js
 *
 * Express routes for /api/gallery with multi-image Multer upload and RBAC guards.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getApprovedGallery,
  getMySubmissions,
  getModerationSubmissions,
  getGalleryById,
  createSubmission,
  updateSubmission,
  approveSubmission,
  rejectSubmission,
  deleteSubmission,
  streamImage,
} = require('../controllers/galleryController');

// Multer memory storage for up to 10 images (10MB max each)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per image
    files: 10,
  },
});

// ─── Public / Student Routes ──────────────────────────────────────────────────

// GET /api/gallery (Public approved gallery feed - student, faculty, admin)
router.get('/', protect, getApprovedGallery);

// GET /api/gallery/my-submissions (Student's own submissions)
router.get('/my-submissions', protect, authorize('student', 'admin'), getMySubmissions);

// GET /api/gallery/moderation (Faculty & Admin review dashboard)
router.get('/moderation', protect, authorize('faculty', 'admin'), getModerationSubmissions);

// GET /api/gallery/:id/images/:index (Stream activity image)
router.get('/:id/images/:index', protect, streamImage);

// GET /api/gallery/:id (Activity Details)
router.get('/:id', protect, getGalleryById);

// POST /api/gallery (Student creates activity submission with up to 10 images)
router.post('/', protect, authorize('student', 'admin'), upload.array('images', 10), createSubmission);

// PUT /api/gallery/:id (Student edits own submission or Admin)
router.put('/:id', protect, upload.array('images', 10), updateSubmission);

// ─── Moderation Routes (Faculty & Admin only) ─────────────────────────────────

// PATCH /api/gallery/:id/approve (Faculty & Admin approve)
router.patch('/:id/approve', protect, authorize('faculty', 'admin'), approveSubmission);

// PATCH /api/gallery/:id/reject (Faculty & Admin reject with reason)
router.patch('/:id/reject', protect, authorize('faculty', 'admin'), rejectSubmission);

// DELETE /api/gallery/:id (Student owner or Faculty/Admin deletes)
router.delete('/:id', protect, deleteSubmission);

module.exports = router;
