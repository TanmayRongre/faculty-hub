/**
 * resourceService.js
 *
 * Core business logic and access control for Academic Resources & Notes.
 */

const Resource = require('../models/Resource');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const storageService = require('./storage/storageService');

/**
 * Creates and uploads a new academic resource.
 */
async function createResource(metadata, file, user) {
  const {
    title,
    description,
    category,
    subject: subjectId,
    division = 'ALL',
    academicYear = '2026-2027',
    visibility = 'semester',
  } = metadata;

  if (!title || !title.trim()) {
    const err = new Error('Resource title is required');
    err.statusCode = 400;
    throw err;
  }

  if (!category) {
    const err = new Error('Resource category is required');
    err.statusCode = 400;
    throw err;
  }

  if (!subjectId) {
    const err = new Error('Subject is required');
    err.statusCode = 400;
    throw err;
  }

  // Validate subject
  const subjectDoc = await Subject.findById(subjectId).populate('department course');
  if (!subjectDoc) {
    const err = new Error('Invalid subject reference: Subject not found');
    err.statusCode = 404;
    throw err;
  }

  // Upload file to storage
  const uploaded = await storageService.uploadFile(file);

  // Create Resource document
  const resource = await Resource.create({
    title: title.trim(),
    description: description ? description.trim() : '',
    category,
    subject: subjectDoc._id,
    subjectCode: subjectDoc.subjectCode,
    department: subjectDoc.department._id || subjectDoc.department,
    course: subjectDoc.course._id || subjectDoc.course,
    semester: Number(subjectDoc.semester),
    division: (division || 'ALL').toUpperCase(),
    academicYear,
    uploadedBy: user.id || user._id,
    uploaderName: user.name || 'Faculty',
    fileName: uploaded.fileName,
    storageKey: uploaded.storageKey,
    fileType: uploaded.fileType,
    fileSize: uploaded.fileSize,
    visibility,
    status: 'active',
  });

  resource.fileUrl = `/api/resources/${resource._id}/download`;
  await resource.save();

  return resource;
}

/**
 * Retrieves a list of resources with academic context filtering, search, and pagination.
 */
async function getResources(query = {}, user) {
  const filter = {};

  // 1. Student Access Control & Visibility boundary
  if (user.role === 'student') {
    const student = await Student.findOne({ userId: user.id }).lean();
    if (!student) {
      const err = new Error('Student profile not found');
      err.statusCode = 404;
      throw err;
    }

    // Students only see active resources matching their academic context
    filter.status = 'active';
    filter.semester = student.semester;
    filter.department = student.department;
    filter.course = student.course;

    // If division is specified on the resource, it must match or be 'ALL'
    filter.$or = [
      { division: 'ALL' },
      { division: (student.division || '').toUpperCase() },
      { division: { $exists: false } },
    ];
  } else {
    // Faculty / Admin
    if (query.status) {
      filter.status = query.status;
    }
    if (query.myResources === 'true' && user.role === 'faculty') {
      filter.uploadedBy = user.id;
    }
    if (query.semester) {
      filter.semester = Number(query.semester);
    }
    if (query.department) {
      filter.department = query.department;
    }
    if (query.course) {
      filter.course = query.course;
    }
  }

  // 2. Common filters
  if (query.category) {
    filter.category = query.category;
  }
  if (query.subjectCode) {
    filter.subjectCode = query.subjectCode.toUpperCase();
  }
  if (query.subject) {
    filter.subject = query.subject;
  }
  if (query.academicYear) {
    filter.academicYear = query.academicYear;
  }

  // 3. Search query (regex on title, description, or subjectCode)
  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    const regex = new RegExp(term, 'i');
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { title: regex },
        { description: regex },
        { subjectCode: regex },
      ],
    });
  }

  // 4. Sorting
  let sortOption = { createdAt: -1 }; // default newest
  if (query.sort === 'oldest') sortOption = { createdAt: 1 };
  if (query.sort === 'alphabetical') sortOption = { title: 1 };
  if (query.sort === 'updated') sortOption = { updatedAt: -1 };

  // 5. Pagination
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;

  const [resources, totalCount] = await Promise.all([
    Resource.find(filter)
      .populate('subject', 'subjectName subjectCode')
      .populate('department', 'name code')
      .populate('course', 'name code')
      .populate('uploadedBy', 'name email role')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Resource.countDocuments(filter),
  ]);

  return {
    resources,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

/**
 * Retrieves a single resource by ID with authorization verification.
 */
async function getResourceById(id, user) {
  const resource = await Resource.findById(id)
    .populate('subject', 'subjectName subjectCode')
    .populate('department', 'name code')
    .populate('course', 'name code')
    .populate('uploadedBy', 'name email role');

  if (!resource) {
    const err = new Error('Resource not found');
    err.statusCode = 404;
    throw err;
  }

  // Student authorization check
  if (user.role === 'student') {
    if (resource.status !== 'active') {
      const err = new Error('Resource is not available');
      err.statusCode = 403;
      throw err;
    }

    const student = await Student.findOne({ userId: user.id }).lean();
    if (!student) {
      const err = new Error('Student profile not found');
      err.statusCode = 404;
      throw err;
    }

    const isSameDept = String(resource.department?._id || resource.department) === String(student.department);
    const isSameSem = Number(resource.semester) === Number(student.semester);
    const isDivAllowed = resource.division === 'ALL' || resource.division === student.division;

    if (!isSameDept || !isSameSem || !isDivAllowed) {
      const err = new Error('Access denied: You are not authorized to view resources for this class');
      err.statusCode = 403;
      throw err;
    }
  }

  return resource;
}

/**
 * Updates resource metadata. (Faculty/Admin only)
 */
async function updateResource(id, updateData, user) {
  const resource = await Resource.findById(id);
  if (!resource) {
    const err = new Error('Resource not found');
    err.statusCode = 404;
    throw err;
  }

  // Ownership check: uploader or admin
  const isOwner = String(resource.uploadedBy) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden: You can only edit resources you uploaded');
    err.statusCode = 403;
    throw err;
  }

  const allowedFields = ['title', 'description', 'category', 'division', 'academicYear', 'visibility', 'status'];
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      resource[field] = updateData[field];
    }
  }

  await resource.save();
  return resource;
}

/**
 * Archives or restores a resource.
 */
async function archiveResource(id, user) {
  const resource = await Resource.findById(id);
  if (!resource) {
    const err = new Error('Resource not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(resource.uploadedBy) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden: You can only archive resources you uploaded');
    err.statusCode = 403;
    throw err;
  }

  resource.status = resource.status === 'active' ? 'archived' : 'active';
  await resource.save();

  return resource;
}

/**
 * Deletes a resource and its physical file.
 */
async function deleteResource(id, user) {
  const resource = await Resource.findById(id);
  if (!resource) {
    const err = new Error('Resource not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(resource.uploadedBy) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden: You can only delete resources you uploaded');
    err.statusCode = 403;
    throw err;
  }

  // Delete physical file
  await storageService.deleteFile(resource.storageKey);

  // Delete database record
  await Resource.findByIdAndDelete(id);

  return { success: true, message: 'Resource deleted successfully' };
}

/**
 * Retrieves file download stream with access control.
 */
async function getDownloadStream(id, user) {
  const resource = await getResourceById(id, user);

  const stream = storageService.getFileStream(resource.storageKey);

  return {
    stream,
    fileName: resource.fileName,
    fileType: resource.fileType,
    fileSize: resource.fileSize,
  };
}

module.exports = {
  createResource,
  getResources,
  getResourceById,
  updateResource,
  archiveResource,
  deleteResource,
  getDownloadStream,
};
