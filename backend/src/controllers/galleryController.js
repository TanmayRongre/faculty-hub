/**
 * galleryController.js
 *
 * HTTP handlers for /api/gallery endpoints.
 */

const galleryService = require('../services/galleryService');

/**
 * GET /api/gallery (Public approved gallery feed)
 */
const getApprovedGallery = async (req, res) => {
  try {
    const data = await galleryService.getApprovedGallery(req.query, req.user);
    res.json({
      success: true,
      data: data.items,
      pagination: data.pagination,
    });
  } catch (err) {
    console.error('[Gallery] GetApproved error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/gallery/my-submissions (Student's own submissions)
 */
const getMySubmissions = async (req, res) => {
  try {
    const data = await galleryService.getMySubmissions(req.query, req.user);
    res.json({
      success: true,
      data: data.items,
      pagination: data.pagination,
    });
  } catch (err) {
    console.error('[Gallery] MySubmissions error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/gallery/moderation (Faculty / Admin moderation dashboard)
 */
const getModerationSubmissions = async (req, res) => {
  try {
    const data = await galleryService.getModerationSubmissions(req.query, req.user);
    res.json({
      success: true,
      data: data.items,
      counts: data.counts,
      pagination: data.pagination,
    });
  } catch (err) {
    console.error('[Gallery] Moderation error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/gallery/:id (Activity Details)
 */
const getGalleryById = async (req, res) => {
  try {
    const item = await galleryService.getGalleryById(req.params.id, req.user);
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[Gallery] GetById error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/gallery (Student creates activity submission)
 */
const createSubmission = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    const item = await galleryService.createSubmission(req.body, files, req.user);
    res.status(201).json({
      success: true,
      message: 'Activity submitted successfully and is pending faculty review',
      data: item,
    });
  } catch (err) {
    console.error('[Gallery] Create error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/gallery/:id (Update submission)
 */
const updateSubmission = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    const updated = await galleryService.updateSubmission(req.params.id, req.body, files, req.user);
    res.json({
      success: true,
      message: 'Activity submission updated successfully',
      data: updated,
    });
  } catch (err) {
    console.error('[Gallery] Update error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/gallery/:id/approve (Faculty / Admin approves)
 */
const approveSubmission = async (req, res) => {
  try {
    const approved = await galleryService.approveSubmission(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Activity approved and published to the student gallery',
      data: approved,
    });
  } catch (err) {
    console.error('[Gallery] Approve error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/gallery/:id/reject (Faculty / Admin rejects)
 */
const rejectSubmission = async (req, res) => {
  try {
    const rejected = await galleryService.rejectSubmission(
      req.params.id,
      req.body.rejectionReason,
      req.user
    );
    res.json({
      success: true,
      message: 'Activity submission rejected',
      data: rejected,
    });
  } catch (err) {
    console.error('[Gallery] Reject error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/gallery/:id (Student owner or Faculty/Admin deletes)
 */
const deleteSubmission = async (req, res) => {
  try {
    const result = await galleryService.deleteSubmission(req.params.id, req.user);
    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[Gallery] Delete error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/gallery/:id/images/:index (Stream image blob)
 */
const streamImage = async (req, res) => {
  try {
    const { stream, fileName, fileType, fileSize } = await galleryService.getImageStream(
      req.params.id,
      req.params.index,
      req.user
    );

    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', mimeMap[fileType] || 'image/jpeg');
    if (fileSize) res.setHeader('Content-Length', fileSize);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day client cache

    stream.pipe(res);
  } catch (err) {
    console.error('[Gallery] Stream image error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
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
};
