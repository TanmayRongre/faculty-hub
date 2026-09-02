/**
 * resourceController.js
 *
 * HTTP handlers for /api/resources endpoints.
 */

const resourceService = require('../services/resourceService');

/**
 * GET /api/resources
 */
const getResources = async (req, res) => {
  try {
    const data = await resourceService.getResources(req.query, req.user);
    res.json({
      success: true,
      data: data.resources,
      pagination: data.pagination,
    });
  } catch (err) {
    console.error('[Resources] Get error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/resources/:id
 */
const getResourceById = async (req, res) => {
  try {
    const resource = await resourceService.getResourceById(req.params.id, req.user);
    res.json({ success: true, data: resource });
  } catch (err) {
    console.error('[Resources] GetById error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/resources
 */
const createResource = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a file to upload' });
    }

    const resource = await resourceService.createResource(req.body, req.file, req.user);
    res.status(201).json({
      success: true,
      message: 'Resource uploaded successfully',
      data: resource,
    });
  } catch (err) {
    console.error('[Resources] Create error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/resources/:id
 */
const updateResource = async (req, res) => {
  try {
    const updated = await resourceService.updateResource(req.params.id, req.body, req.user);
    res.json({
      success: true,
      message: 'Resource updated successfully',
      data: updated,
    });
  } catch (err) {
    console.error('[Resources] Update error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/resources/:id/archive
 */
const archiveResource = async (req, res) => {
  try {
    const resource = await resourceService.archiveResource(req.params.id, req.user);
    res.json({
      success: true,
      message: `Resource ${resource.status === 'archived' ? 'archived' : 'restored'} successfully`,
      data: resource,
    });
  } catch (err) {
    console.error('[Resources] Archive error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/resources/:id
 */
const deleteResource = async (req, res) => {
  try {
    const result = await resourceService.deleteResource(req.params.id, req.user);
    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[Resources] Delete error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/resources/:id/download
 */
const downloadResource = async (req, res) => {
  try {
    const { stream, fileName, fileSize } = await resourceService.getDownloadStream(req.params.id, req.user);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    if (fileSize) {
      res.setHeader('Content-Length', fileSize);
    }

    stream.pipe(res);
  } catch (err) {
    console.error('[Resources] Download error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getResources,
  getResourceById,
  createResource,
  updateResource,
  archiveResource,
  deleteResource,
  downloadResource,
};
