/**
 * noticeController.js
 *
 * HTTP handlers for /api/notices endpoints.
 */

const noticeService = require('../services/noticeService');

/**
 * GET /api/notices
 */
const getNotices = async (req, res) => {
  try {
    const data = await noticeService.getNotices(req.query, req.user);
    res.json({
      success: true,
      data: data.notices,
      pagination: data.pagination,
    });
  } catch (err) {
    console.error('[Notices] Get error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/notices/:id
 */
const getNoticeById = async (req, res) => {
  try {
    const notice = await noticeService.getNoticeById(req.params.id, req.user);
    res.json({ success: true, data: notice });
  } catch (err) {
    console.error('[Notices] GetById error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/notices
 */
const createNotice = async (req, res) => {
  try {
    const notice = await noticeService.createNotice(req.body, req.file, req.user);
    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: notice,
    });
  } catch (err) {
    console.error('[Notices] Create error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/notices/:id
 */
const updateNotice = async (req, res) => {
  try {
    const updated = await noticeService.updateNotice(req.params.id, req.body, req.file, req.user);
    res.json({
      success: true,
      message: 'Notice updated successfully',
      data: updated,
    });
  } catch (err) {
    console.error('[Notices] Update error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/notices/:id/publish
 */
const publishNotice = async (req, res) => {
  try {
    const notice = await noticeService.publishNotice(req.params.id, req.user);
    res.json({
      success: true,
      message: 'Notice published successfully',
      data: notice,
    });
  } catch (err) {
    console.error('[Notices] Publish error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/notices/:id/archive
 */
const archiveNotice = async (req, res) => {
  try {
    const notice = await noticeService.archiveNotice(req.params.id, req.user);
    res.json({
      success: true,
      message: `Notice ${notice.status === 'Archived' ? 'archived' : 'restored'} successfully`,
      data: notice,
    });
  } catch (err) {
    console.error('[Notices] Archive error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/notices/:id
 */
const deleteNotice = async (req, res) => {
  try {
    const result = await noticeService.deleteNotice(req.params.id, req.user);
    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[Notices] Delete error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/notices/:id/attachments/:index/download
 */
const downloadAttachment = async (req, res) => {
  try {
    const { stream, fileName, fileSize } = await noticeService.getAttachmentStream(
      req.params.id,
      req.params.index,
      req.user
    );

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    if (fileSize) {
      res.setHeader('Content-Length', fileSize);
    }

    stream.pipe(res);
  } catch (err) {
    console.error('[Notices] Download attachment error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  publishNotice,
  archiveNotice,
  deleteNotice,
  downloadAttachment,
};
