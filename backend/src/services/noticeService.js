/**
 * noticeService.js
 *
 * Core business logic, academic targeting, and lifecycle management for Notice Board.
 */

const Notice = require('../models/Notice');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Student = require('../models/Student');
const storageService = require('./storage/storageService');

/**
 * Creates a new notice with optional file attachment.
 */
async function createNotice(data, file, user) {
  const {
    title,
    content,
    category = 'General',
    priority = 'Normal',
    targetScope = 'all',
    department,
    course,
    semester,
    division = 'ALL',
    academicYear = '2026-2027',
    publishDate,
    expiryDate,
    status = 'Published',
  } = data;

  if (!title || !title.trim()) {
    const err = new Error('Notice title is required');
    err.statusCode = 400;
    throw err;
  }

  if (!content || !content.trim()) {
    const err = new Error('Notice content is required');
    err.statusCode = 400;
    throw err;
  }

  // Validate dates
  const pubDate = publishDate ? new Date(publishDate) : new Date();
  let expDate = null;
  if (expiryDate) {
    expDate = new Date(expiryDate);
    if (isNaN(expDate.getTime())) {
      const err = new Error('Invalid expiry date');
      err.statusCode = 400;
      throw err;
    }
    if (expDate <= pubDate) {
      const err = new Error('Expiry date must be strictly after the publish date');
      err.statusCode = 400;
      throw err;
    }
  }

  // Target scope validation
  if (targetScope !== 'all' && department) {
    const deptDoc = await Department.findById(department);
    if (!deptDoc) {
      const err = new Error('Invalid department reference');
      err.statusCode = 404;
      throw err;
    }
  }

  if (['course', 'semester', 'division'].includes(targetScope) && course) {
    const courseDoc = await Course.findById(course);
    if (!courseDoc) {
      const err = new Error('Invalid course reference');
      err.statusCode = 404;
      throw err;
    }
  }

  // Handle optional attachment
  const attachments = [];
  if (file) {
    const uploaded = await storageService.uploadFile(file);
    attachments.push({
      fileName: uploaded.fileName,
      storageKey: uploaded.storageKey,
      fileType: uploaded.fileType,
      fileSize: uploaded.fileSize,
      fileUrl: '', // generated on notice save
    });
  }

  const notice = await Notice.create({
    title: title.trim(),
    content: content.trim(),
    category,
    priority,
    targetScope,
    department: department || undefined,
    course: course || undefined,
    semester: semester ? Number(semester) : undefined,
    division: (division || 'ALL').toUpperCase(),
    academicYear,
    attachments,
    publishedBy: user.id || user._id,
    authorName: user.name || 'Faculty',
    authorRole: user.role || 'faculty',
    publishDate: pubDate,
    expiryDate: expDate,
    status,
  });

  if (notice.attachments && notice.attachments.length > 0) {
    notice.attachments[0].fileUrl = `/api/notices/${notice._id}/attachments/0/download`;
    await notice.save();
  }

  return notice;
}

/**
 * Retrieves notices with academic targeting, lifecycle expiration, search, and priority sorting.
 */
async function getNotices(query = {}, user) {
  const now = new Date();

  // Auto-expire past published notices in background
  await Notice.updateMany(
    { status: 'Published', expiryDate: { $lte: now } },
    { $set: { status: 'Expired' } }
  );

  const filter = {};

  // 1. Student Visibility & Academic Targeting
  if (user.role === 'student') {
    const student = await Student.findOne({ userId: user.id }).lean();
    if (!student) {
      const err = new Error('Student profile not found');
      err.statusCode = 404;
      throw err;
    }

    // Only active, published notices that have reached publishDate and not expired
    filter.status = 'Published';
    filter.publishDate = { $lte: now };
    filter.$and = [
      {
        $or: [
          { expiryDate: { $exists: false } },
          { expiryDate: null },
          { expiryDate: { $gt: now } },
        ],
      },
    ];

    // Target Scope matching
    const targetingOr = [
      { targetScope: 'all' },
      { targetScope: 'department', department: student.department },
      { targetScope: 'course', department: student.department, course: student.course },
      { targetScope: 'semester', department: student.department, course: student.course, semester: Number(student.semester) },
      {
        targetScope: 'division',
        department: student.department,
        course: student.course,
        semester: Number(student.semester),
        $or: [
          { division: 'ALL' },
          { division: (student.division || '').toUpperCase() },
          { division: { $exists: false } },
        ],
      },
    ];

    filter.$and.push({ $or: targetingOr });
  } else {
    // Faculty / Admin filters
    if (query.status) {
      filter.status = query.status;
    }
    if (query.myNotices === 'true' && user.role === 'faculty') {
      filter.publishedBy = user.id;
    }
    if (query.targetScope) {
      filter.targetScope = query.targetScope;
    }
    if (query.department) {
      filter.department = query.department;
    }
    if (query.semester) {
      filter.semester = Number(query.semester);
    }
  }

  // Common filters
  if (query.category) {
    filter.category = query.category;
  }
  if (query.priority) {
    filter.priority = query.priority;
  }
  if (query.academicYear) {
    filter.academicYear = query.academicYear;
  }

  // Search keyword (in title or content)
  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    const regex = new RegExp(term, 'i');
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [{ title: regex }, { content: regex }],
    });
  }

  // Sorting
  let sortOption = { publishDate: -1, createdAt: -1 };
  if (query.sort === 'oldest') {
    sortOption = { publishDate: 1, createdAt: 1 };
  } else if (query.sort === 'priority') {
    // Custom sort: will re-order in application or use aggregation
    sortOption = { priority: -1, publishDate: -1 };
  }

  // Pagination
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;

  const [rawNotices, totalCount] = await Promise.all([
    Notice.find(filter)
      .populate('department', 'name code')
      .populate('course', 'name code')
      .populate('publishedBy', 'name email role')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),
    Notice.countDocuments(filter),
  ]);

  // Priority weighting (Urgent > Important > Normal) if default or priority sort requested
  let notices = rawNotices;
  if (!query.sort || query.sort === 'priority' || query.sort === 'newest') {
    const priorityWeight = { Urgent: 3, Important: 2, Normal: 1 };
    notices = [...rawNotices].sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return new Date(b.publishDate || b.createdAt) - new Date(a.publishDate || a.createdAt);
    });
  }

  return {
    notices,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

/**
 * Retrieves a single notice by ID with student authorization validation.
 */
async function getNoticeById(id, user) {
  const notice = await Notice.findById(id)
    .populate('department', 'name code')
    .populate('course', 'name code')
    .populate('publishedBy', 'name email role');

  if (!notice) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();

  // Check if expired
  if (notice.status === 'Published' && notice.expiryDate && notice.expiryDate <= now) {
    notice.status = 'Expired';
    await notice.save();
  }

  // Student authorization verification
  if (user.role === 'student') {
    if (notice.status !== 'Published') {
      const err = new Error('Notice is not available');
      err.statusCode = 403;
      throw err;
    }

    if (notice.publishDate > now) {
      const err = new Error('Notice has not been published yet');
      err.statusCode = 403;
      throw err;
    }

    const student = await Student.findOne({ userId: user.id }).lean();
    if (!student) {
      const err = new Error('Student profile not found');
      err.statusCode = 404;
      throw err;
    }

    // Verify targeting
    let isTargeted = false;
    if (notice.targetScope === 'all') {
      isTargeted = true;
    } else if (notice.targetScope === 'department') {
      isTargeted = String(notice.department?._id || notice.department) === String(student.department);
    } else if (notice.targetScope === 'course') {
      isTargeted =
        String(notice.department?._id || notice.department) === String(student.department) &&
        String(notice.course?._id || notice.course) === String(student.course);
    } else if (notice.targetScope === 'semester') {
      isTargeted =
        String(notice.department?._id || notice.department) === String(student.department) &&
        String(notice.course?._id || notice.course) === String(student.course) &&
        Number(notice.semester) === Number(student.semester);
    } else if (notice.targetScope === 'division') {
      isTargeted =
        String(notice.department?._id || notice.department) === String(student.department) &&
        String(notice.course?._id || notice.course) === String(student.course) &&
        Number(notice.semester) === Number(student.semester) &&
        (notice.division === 'ALL' || notice.division === student.division);
    }

    if (!isTargeted) {
      const err = new Error('Access denied: You are not authorized to view this targeted notice');
      err.statusCode = 403;
      throw err;
    }
  }

  return notice;
}

/**
 * Updates notice metadata. (Owner or Admin)
 */
async function updateNotice(id, updateData, file, user) {
  const notice = await Notice.findById(id);
  if (!notice) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(notice.publishedBy) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden: You can only edit notices you created');
    err.statusCode = 403;
    throw err;
  }

  const allowedFields = [
    'title',
    'content',
    'category',
    'priority',
    'targetScope',
    'department',
    'course',
    'semester',
    'division',
    'academicYear',
    'publishDate',
    'expiryDate',
    'status',
  ];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      notice[field] = updateData[field];
    }
  }

  // If new file attached
  if (file) {
    const uploaded = await storageService.uploadFile(file);
    notice.attachments.push({
      fileName: uploaded.fileName,
      storageKey: uploaded.storageKey,
      fileType: uploaded.fileType,
      fileSize: uploaded.fileSize,
      fileUrl: `/api/notices/${notice._id}/attachments/${notice.attachments.length}/download`,
    });
  }

  await notice.save();
  return notice;
}

/**
 * Publishes a draft notice.
 */
async function publishNotice(id, user) {
  const notice = await Notice.findById(id);
  if (!notice) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(notice.publishedBy) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden: You can only publish notices you created');
    err.statusCode = 403;
    throw err;
  }

  notice.status = 'Published';
  notice.publishDate = new Date();
  await notice.save();

  return notice;
}

/**
 * Archives a notice.
 */
async function archiveNotice(id, user) {
  const notice = await Notice.findById(id);
  if (!notice) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(notice.publishedBy) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden: You can only archive notices you created');
    err.statusCode = 403;
    throw err;
  }

  notice.status = notice.status === 'Archived' ? 'Published' : 'Archived';
  await notice.save();

  return notice;
}

/**
 * Deletes a notice and its physical attachments.
 */
async function deleteNotice(id, user) {
  const notice = await Notice.findById(id);
  if (!notice) {
    const err = new Error('Notice not found');
    err.statusCode = 404;
    throw err;
  }

  const isOwner = String(notice.publishedBy) === String(user.id);
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    const err = new Error('Forbidden: You can only delete notices you created');
    err.statusCode = 403;
    throw err;
  }

  // Delete physical attachment files
  if (notice.attachments && notice.attachments.length > 0) {
    for (const att of notice.attachments) {
      if (att.storageKey) {
        await storageService.deleteFile(att.storageKey);
      }
    }
  }

  await Notice.findByIdAndDelete(id);
  return { success: true, message: 'Notice and attachments deleted successfully' };
}

/**
 * Retrieves attachment download stream with access control.
 */
async function getAttachmentStream(noticeId, attachmentIndex, user) {
  const notice = await getNoticeById(noticeId, user);

  const idx = parseInt(attachmentIndex) || 0;
  const attachment = notice.attachments && notice.attachments[idx];

  if (!attachment) {
    const err = new Error('Attachment not found');
    err.statusCode = 404;
    throw err;
  }

  const stream = storageService.getFileStream(attachment.storageKey);

  return {
    stream,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize,
  };
}

module.exports = {
  createNotice,
  getNotices,
  getNoticeById,
  updateNotice,
  publishNotice,
  archiveNotice,
  deleteNotice,
  getAttachmentStream,
};
