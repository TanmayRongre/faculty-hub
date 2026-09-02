/**
 * localStorage.js
 *
 * Local filesystem storage provider with path traversal safeguards.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Resolve the root upload directory safely
const UPLOAD_ROOT = path.resolve(__dirname, '../../../uploads/resources');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

/**
 * Validates that a resolved path is strictly within the UPLOAD_ROOT.
 * Prevents directory traversal attacks.
 */
function assertSafePath(targetPath) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(UPLOAD_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    const err = new Error('Path traversal attempt detected');
    err.statusCode = 400;
    throw err;
  }
  return resolved;
}

/**
 * Saves a file buffer to local disk under a unique storageKey.
 * @param {Buffer} buffer
 * @param {string} sanitizedName
 * @returns {Promise<{ storageKey: string, filePath: string }>}
 */
async function saveFile(buffer, sanitizedName) {
  const uniquePrefix = `res_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const storageKey = `${uniquePrefix}_${sanitizedName}`;
  const targetPath = assertSafePath(path.join(UPLOAD_ROOT, storageKey));

  await fs.promises.writeFile(targetPath, buffer);

  return {
    storageKey,
    filePath: targetPath,
  };
}

/**
 * Returns a readable stream for a stored file.
 * @param {string} storageKey
 * @returns {fs.ReadStream}
 */
function getFileStream(storageKey) {
  if (!storageKey) {
    const err = new Error('Storage key required');
    err.statusCode = 400;
    throw err;
  }

  const targetPath = assertSafePath(path.join(UPLOAD_ROOT, storageKey));

  if (!fs.existsSync(targetPath)) {
    const err = new Error('Stored file not found on disk');
    err.statusCode = 404;
    throw err;
  }

  return fs.createReadStream(targetPath);
}

/**
 * Checks if a file exists on disk.
 * @param {string} storageKey
 * @returns {boolean}
 */
function fileExists(storageKey) {
  try {
    const targetPath = assertSafePath(path.join(UPLOAD_ROOT, storageKey));
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

/**
 * Deletes a file from disk.
 * @param {string} storageKey
 * @returns {Promise<boolean>}
 */
async function deleteFile(storageKey) {
  try {
    const targetPath = assertSafePath(path.join(UPLOAD_ROOT, storageKey));
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
    return true;
  } catch (err) {
    console.error(`[Storage] Failed to delete file ${storageKey}:`, err.message);
    return false;
  }
}

module.exports = {
  UPLOAD_ROOT,
  saveFile,
  getFileStream,
  fileExists,
  deleteFile,
  assertSafePath,
};
