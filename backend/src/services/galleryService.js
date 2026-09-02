/**
 * galleryService.js
 *
 * Core business logic, multi-image upload handling, and moderation lifecycle
 * for Student Extracurricular Activity Gallery.
 */

const Gallery = require('../models/Gallery');
const Student = require('../models/Student');
const Department = require('../models/Department');
const storageService = require('./storage/storageService');

/**
 * Creates a new extracurricular activity submission by a student.
 */
async function createSubmission(data, files, user) {
  const {
    title,
    description,
    category = 'Other',
    eventName,
    eventDate,
    location,
    academicYear = '2026-2027',
  } = data;

  if (!title || !title.trim()) {
    const err = new Error('Activity title is required');
    err.statusCode = 400;
    throw err;
  }

  if (!description || !description.trim()) {
    const err = new Error('Activity description is required');
    err.statusCode = 400;
    throw err;
  }

  if (!eventDate) {
    const err = new Error('Event date is required');
    err.statusCode = 400;
    throw err;
  }

  const parsedEventDate = new Date(eventDate);
  if (isNaN(parsedEventDate.getTime())) {
    const err = new Error('Invalid event date provided');
    err.statusCode = 400;
    throw err;
  }

  if (!files || files.length === 0) {
    const err = new Error('At least one activity photo is required');
    err.statusCode = 400;
    throw err;
  }

  if (files.length > 10) {
    const err = new Error('Cannot upload more than 10 images per activity submission');
    err.statusCode = 400;
    throw err;
  }

  // Upload and validate all files with transactional rollback on failure
  const uploadedImages = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploaded = await storageService.uploadImageFile(file);
      uploadedImages.push({
        fileName: uploaded.fileName,
        storageKey: uploaded.storageKey,
        fileType: uploaded.fileType,
        fileSize: uploaded.fileSize,
        caption: data.captions && data.captions[i] ? data.captions[i].trim() : '',
        imageUrl: '',
      });
    }
  } catch (uploadErr) {
    // Rollback uploaded files if any single file fails
    for (const img of uploadedImages) {
      if (img.storageKey) {
        await storageService.deleteFile(img.storageKey).catch(() => {});
      }
    }
    throw uploadErr;
  }

  // Derive student academic context
  let studentDoc = null;
  if (user.role === 'student') {
    studentDoc = await Student.findOne({ userId: user.id || user._id }).lean();
  }

  const galleryDoc = await Gallery.create({
    title: title.trim(),
    description: description.trim(),
    category,
    eventName: eventName ? eventName.trim() : undefined,
    eventDate: parsedEventDate,
    location: location ? location.trim() : undefined,
    submittedBy: user.id || user._id,
    student: studentDoc ? studentDoc._id : undefined,
    studentName: studentDoc ? (studentDoc.fullName || user.name) : (user.name || 'Student Contributor'),
    department: studentDoc?.department || data.department || undefined,
    course: studentDoc?.course || data.course || undefined,
    semester: studentDoc?.semester ? Number(studentDoc.semester) : (data.semester ? Number(data.semester) : undefined),
    division: studentDoc?.division || data.division || undefined,
    academicYear: studentDoc?.academicYear || academicYear,
    images: uploadedImages,
    status: 'Pending',
  });

  // Assign image URLs
  galleryDoc.images.forEach((img, idx) => {
    img.imageUrl = `/api/gallery/${galleryDoc._id}/images/${idx}`;
  });
  await galleryDoc.save();

  return galleryDoc;
}

/**
 * Retrieves public approved gallery items for the student feed with multi-criteria filtering and pagination.
 */
async function getApprovedGallery(query = {}, user) {
  const filter = { status: 'Approved' };

  if (query.category && query.category !== 'All Categories') {
    filter.category = query.category;
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.semester) {
    filter.semester = Number(query.semester);
  }

  if (query.academicYear) {
    filter.academicYear = query.academicYear;
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    filter.eventDate = {};
    if (query.startDate) filter.eventDate.$gte = new Date(query.startDate);
    if (query.endDate) filter.eventDate.$lte = new Date(query.endDate);
  }

  // Search keyword across title, description, eventName, location
  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    const regex = new RegExp(term, 'i');
    filter.$or = [
      { title: regex },
      { description: regex },
      { eventName: regex },
      { location: regex },
      { studentName: regex },
    ];
  }

  // Sorting
  let sortOption = { eventDate: -1, createdAt: -1 };
  if (query.sort === 'oldest') {
    sortOption = { eventDate: 1, createdAt: 1 };
  } else if (query.sort === 'newest') {
    sortOption = { createdAt: -1 };
  }

  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 12));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Gallery.find(filter)
      .populate('department', 'name code')
      .populate('course', 'name code')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Gallery.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves a single gallery activity item by ID with strict ownership/moderation authorization.
 */
async function getGalleryById(id, user) {
  const item = await Gallery.findById(id)
    .populate('department', 'name code')
    .populate('course', 'name code')
    .populate('submittedBy', 'name email role')
    .populate('reviewedBy', 'name email role');

  if (!item) {
    const err = new Error('Gallery activity not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = user && String(item.submittedBy?._id || item.submittedBy) === String(user.id || user._id);
  const isFacultyOrAdmin = user && ['faculty', 'admin'].includes(user.role);

  // If not approved, only the author or faculty/admin can view it
  if (item.status !== 'Approved' && !isOwner && !isFacultyOrAdmin) {
    const err = new Error('Access denied: This activity submission is pending moderation or has been rejected');
    err.statusCode = 403;
    throw err;
  }

  return item;
}

/**
 * Retrieves authenticated student's own submissions (Pending, Approved, Rejected).
 */
async function getMySubmissions(query = {}, user) {
  const filter = { submittedBy: user.id || user._id };

  if (query.status && ['Pending', 'Approved', 'Rejected'].includes(query.status)) {
    filter.status = query.status;
  }

  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Gallery.find(filter)
      .populate('department', 'name code')
      .populate('course', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Gallery.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieves moderation dashboard list and statistics for Faculty / Admin.
 */
async function getModerationSubmissions(query = {}, user) {
  const filter = {};

  if (query.status && ['Pending', 'Approved', 'Rejected'].includes(query.status)) {
    filter.status = query.status;
  } else if (!query.status || query.status === 'Pending') {
    filter.status = 'Pending';
  } else if (query.status === 'all') {
    // no status filter
  }

  if (query.category && query.category !== 'All Categories') {
    filter.category = query.category;
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    const regex = new RegExp(term, 'i');
    filter.$or = [
      { title: regex },
      { description: regex },
      { eventName: regex },
      { studentName: regex },
    ];
  }

  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;

  const [items, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    Gallery.find(filter)
      .populate('department', 'name code')
      .populate('course', 'name code')
      .populate('submittedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Gallery.countDocuments(filter),
    Gallery.countDocuments({ status: 'Pending' }),
    Gallery.countDocuments({ status: 'Approved' }),
    Gallery.countDocuments({ status: 'Rejected' }),
  ]);

  return {
    items,
    counts: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      total: pendingCount + approvedCount + rejectedCount,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Approves a pending activity submission (Faculty / Admin only).
 */
async function approveSubmission(id, user) {
  const item = await Gallery.findById(id);
  if (!item) {
    const err = new Error('Gallery activity not found');
    err.statusCode = 404;
    throw err;
  }

  item.status = 'Approved';
  item.reviewedBy = user.id || user._id;
  item.reviewerName = user.name || 'Faculty Reviewer';
  item.reviewedAt = new Date();
  item.rejectionReason = undefined;

  await item.save();
  return item;
}

/**
 * Rejects an activity submission with a clear reason (Faculty / Admin only).
 */
async function rejectSubmission(id, rejectionReason, user) {
  if (!rejectionReason || !rejectionReason.trim()) {
    const err = new Error('Rejection reason is required to reject an activity submission');
    err.statusCode = 400;
    throw err;
  }

  const item = await Gallery.findById(id);
  if (!item) {
    const err = new Error('Gallery activity not found');
    err.statusCode = 404;
    throw err;
  }

  item.status = 'Rejected';
  item.rejectionReason = rejectionReason.trim();
  item.reviewedBy = user.id || user._id;
  item.reviewerName = user.name || 'Faculty Reviewer';
  item.reviewedAt = new Date();

  await item.save();
  return item;
}

/**
 * Updates a submission (Student owner if Pending/Rejected, or Admin).
 */
async function updateSubmission(id, updateData, files, user) {
  const item = await Gallery.findById(id);
  if (!item) {
    const err = new Error('Gallery activity not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(item.submittedBy) === String(user.id || user._id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden: You can only edit your own submissions');
    err.statusCode = 403;
    throw err;
  }

  // If student is editing an approved item, reset status to Pending for re-moderation
  if (isOwner && !isAdmin && item.status === 'Approved') {
    item.status = 'Pending';
    item.reviewedBy = undefined;
    item.reviewedAt = undefined;
  } else if (isOwner && !isAdmin && item.status === 'Rejected') {
    // Re-submitting rejected item moves it back to Pending
    item.status = 'Pending';
    item.rejectionReason = undefined;
  }

  const allowedFields = ['title', 'description', 'category', 'eventName', 'location'];
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      item[field] = updateData[field].trim();
    }
  }

  if (updateData.eventDate) {
    const parsedDate = new Date(updateData.eventDate);
    if (!isNaN(parsedDate.getTime())) {
      item.eventDate = parsedDate;
    }
  }

  // If new images uploaded, append to existing (max 10)
  if (files && files.length > 0) {
    if (item.images.length + files.length > 10) {
      const err = new Error(`Cannot have more than 10 images total (${item.images.length} already uploaded)`);
      err.statusCode = 400;
      throw err;
    }

    for (const file of files) {
      const uploaded = await storageService.uploadImageFile(file);
      item.images.push({
        fileName: uploaded.fileName,
        storageKey: uploaded.storageKey,
        fileType: uploaded.fileType,
        fileSize: uploaded.fileSize,
        imageUrl: `/api/gallery/${item._id}/images/${item.images.length}`,
      });
    }
  }

  await item.save();
  return item;
}

/**
 * Permanently deletes a gallery submission and cleans up stored image files.
 */
async function deleteSubmission(id, user) {
  const item = await Gallery.findById(id);
  if (!item) {
    const err = new Error('Gallery activity not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(item.submittedBy) === String(user.id || user._id);
  const isFacultyOrAdmin = ['faculty', 'admin'].includes(user.role);

  if (!isOwner && !isFacultyOrAdmin) {
    const err = new Error('Forbidden: You are not authorized to delete this submission');
    err.statusCode = 403;
    throw err;
  }

  // Clean up all physical image files from storage
  if (item.images && item.images.length > 0) {
    for (const img of item.images) {
      if (img.storageKey) {
        await storageService.deleteFile(img.storageKey).catch(() => {});
      }
    }
  }

  await Gallery.findByIdAndDelete(id);
  return { success: true, message: 'Gallery activity and associated images deleted successfully' };
}

/**
 * Retrieves a stream for a specific image in a gallery submission.
 */
async function getImageStream(galleryId, imageIndex, user) {
  const item = await getGalleryById(galleryId, user);

  const idx = parseInt(imageIndex) || 0;
  const image = item.images && item.images[idx];

  if (!image) {
    const err = new Error('Image not found in gallery entry');
    err.statusCode = 404;
    throw err;
  }

  const stream = storageService.getFileStream(image.storageKey);

  return {
    stream,
    fileName: image.fileName,
    fileType: image.fileType,
    fileSize: image.fileSize,
  };
}

module.exports = {
  createSubmission,
  getApprovedGallery,
  getGalleryById,
  getMySubmissions,
  getModerationSubmissions,
  approveSubmission,
  rejectSubmission,
  updateSubmission,
  deleteSubmission,
  getImageStream,
};
