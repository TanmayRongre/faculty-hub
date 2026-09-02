/**
 * storageService.js
 *
 * Storage abstraction layer for FacultyHub.
 * Exposes save, retrieve, delete, and validation methods.
 * Defaults to localStorage provider, can be swapped with Cloud provider.
 */

const localStorageProvider = require('./localStorage');
const { validateUploadFile, validateImageUploadFile, sanitizeFileName, MAX_FILE_SIZE, MAX_IMAGE_SIZE } = require('./fileValidator');

class StorageService {
  constructor(provider = localStorageProvider) {
    this.provider = provider;
  }

  /**
   * Validates and saves an uploaded file.
   * @param {object} file Multer file object
   * @returns {Promise<{ storageKey: string, fileName: string, fileType: string, fileSize: number }>}
   */
  async uploadFile(file) {
    const validation = validateUploadFile(file);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.statusCode = 400;
      throw err;
    }

    const { storageKey } = await this.provider.saveFile(file.buffer, validation.sanitizedName);

    return {
      storageKey,
      fileName: validation.sanitizedName,
      fileType: validation.extension,
      fileSize: file.size,
    };
  }

  /**
   * Validates and saves an uploaded image file (for Gallery).
   * @param {object} file Multer file object
   * @returns {Promise<{ storageKey: string, fileName: string, fileType: string, fileSize: number }>}
   */
  async uploadImageFile(file) {
    const validation = validateImageUploadFile(file);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.statusCode = 400;
      throw err;
    }

    const { storageKey } = await this.provider.saveFile(file.buffer, validation.sanitizedName);

    return {
      storageKey,
      fileName: validation.sanitizedName,
      fileType: validation.extension,
      fileSize: file.size,
    };
  }

  /**
   * Retrieves a readable stream for a file.
   * @param {string} storageKey
   * @returns {ReadableStream}
   */
  getFileStream(storageKey) {
    return this.provider.getFileStream(storageKey);
  }

  /**
   * Deletes a stored file.
   * @param {string} storageKey
   * @returns {Promise<boolean>}
   */
  async deleteFile(storageKey) {
    return this.provider.deleteFile(storageKey);
  }

  /**
   * Checks if a file exists.
   * @param {string} storageKey
   * @returns {boolean}
   */
  fileExists(storageKey) {
    return this.provider.fileExists(storageKey);
  }
}

// Export singleton instance
module.exports = new StorageService();
