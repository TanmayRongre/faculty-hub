/**
 * fileValidator.js
 *
 * File validation and filename sanitization for FacultyHub Resources.
 */

const path = require('path');

// Whitelisted academic file extensions
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.zip',
]);

// Explicitly blocked dangerous extensions
const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.js',
  '.mjs',
  '.cjs',
  '.php',
  '.py',
  '.html',
  '.htm',
  '.vbs',
  '.ps1',
  '.jar',
  '.apk',
  '.com',
  '.scr',
  '.msi',
  '.dll',
  '.so',
  '.elf',
]);

// Allowed MIME types map
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream', // common fallback for docs/binaries
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB per image

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Sanitizes a filename to prevent path traversal and unsafe characters.
 * @param {string} originalName
 * @returns {string} Safe filename
 */
function sanitizeFileName(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    return `resource_${Date.now()}`;
  }

  // Normalize forward and backward slashes, then extract basename
  const normalized = originalName.replace(/\\/g, '/');
  const baseName = path.posix.basename(normalized);

  // Replace any non-alphanumeric (except dot, dash, underscore) with underscore
  const sanitized = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

  // Prevent multiple consecutive dots or leading dots
  return sanitized.replace(/^\.+/, '').replace(/\.{2,}/g, '.');
}

/**
 * Validates an uploaded file object (e.g. from Multer).
 * @param {object} file
 * @returns {{ valid: boolean, error?: string, sanitizedName?: string, extension?: string }}
 */
function validateUploadFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided for upload' };
  }

  if (!file.size || file.size === 0) {
    return { valid: false, error: 'Cannot upload an empty file (0 bytes)' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds the 25MB maximum limit (${(file.size / (1024 * 1024)).toFixed(2)} MB)` };
  }

  const originalName = file.originalname || '';
  const ext = path.extname(originalName).toLowerCase();

  // Check dangerous extensions
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Executable and script file types (${ext}) are strictly forbidden` };
  }

  // Check allowed extensions
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Unsupported file format (${ext}). Allowed formats: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, PNG, JPG, ZIP` };
  }

  // Check MIME type if available
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return { valid: false, error: `Unsupported MIME type: ${file.mimetype}` };
  }

  const sanitizedName = sanitizeFileName(originalName);

  return {
    valid: true,
    sanitizedName,
    extension: ext,
  };
}

/**
 * Validates an image-specific upload file (for Gallery).
 * @param {object} file
 * @returns {{ valid: boolean, error?: string, sanitizedName?: string, extension?: string }}
 */
function validateImageUploadFile(file) {
  if (!file) {
    return { valid: false, error: 'No image file provided for upload' };
  }

  if (!file.size || file.size === 0) {
    return { valid: false, error: 'Cannot upload an empty image file (0 bytes)' };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image size exceeds 10MB maximum limit (${(file.size / (1024 * 1024)).toFixed(2)} MB)` };
  }

  const originalName = file.originalname || '';
  const ext = path.extname(originalName).toLowerCase();

  // Check dangerous extensions
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Executable and script file types (${ext}) are strictly forbidden` };
  }

  // Check allowed image extensions
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Unsupported image format (${ext}). Allowed formats: JPG, JPEG, PNG, WEBP` };
  }

  // Check MIME type if available
  if (file.mimetype && !ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    return { valid: false, error: `Unsupported image MIME type: ${file.mimetype}` };
  }

  const sanitizedName = sanitizeFileName(originalName);

  return {
    valid: true,
    sanitizedName,
    extension: ext,
  };
}

module.exports = {
  ALLOWED_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
  sanitizeFileName,
  validateUploadFile,
  validateImageUploadFile,
};

