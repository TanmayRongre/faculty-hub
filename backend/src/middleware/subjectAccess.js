const Faculty = require('../models/Faculty');
const FacultySubjectAssignment = require('../models/FacultySubjectAssignment');
const Subject = require('../models/Subject');

/**
 * Middleware to enforce subject-level access control for Faculty.
 * - Admin: ALWAYS ALLOWED (full access to all subjects).
 * - Faculty: Only allowed if the requested subject is assigned to them.
 * - Returns 403 Forbidden if faculty attempts to access unassigned subject data.
 *
 * @param {string} [paramName='subjectCode'] - Key to look for in params/query/body
 */
const authorizeSubjectAccess = (paramName = 'subjectCode') => {
  return async (req, res, next) => {
    try {
      // 1. If not authenticated, let auth middleware handle or reject
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
      }

      // 2. Admin has unrestricted access to all subjects
      if (req.user.role === 'admin') {
        return next();
      }

      // 3. For students, this middleware does not apply (role authorization handles student routes)
      if (req.user.role !== 'faculty') {
        return next();
      }

      // 4. Resolve the Faculty profile for this user
      const faculty = await Faculty.findOne({ userId: req.user._id }).populate('subjects', 'subjectCode');
      if (!faculty) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No faculty profile associated with your account',
        });
      }

      // 5. Gather all assigned subject codes (from Faculty.subjects and FacultySubjectAssignment)
      const assignedCodesSet = new Set(
        (faculty.subjects || []).map((s) => (s.subjectCode || '').toUpperCase().trim())
      );

      // Also query FacultySubjectAssignment to ensure completeness
      const directAssignments = await FacultySubjectAssignment.find({
        facultyId: faculty._id,
        active: true,
      }).populate('subjectId', 'subjectCode');

      for (const a of directAssignments) {
        if (a.subjectId && a.subjectId.subjectCode) {
          assignedCodesSet.add(a.subjectId.subjectCode.toUpperCase().trim());
        }
      }

      const assignedCodes = Array.from(assignedCodesSet);
      req.assignedSubjectCodes = assignedCodes;
      req.faculty = faculty;

      // 6. Extract the requested subject code from params, query, or body
      const rawSubject =
        req.params?.[paramName] ||
        req.params?.subjectCode ||
        req.params?.subject ||
        req.query?.[paramName] ||
        req.query?.subjectCode ||
        req.query?.subject ||
        req.body?.[paramName] ||
        req.body?.subjectCode ||
        req.body?.subject;

      // If no specific subject was targeted in this request, proceed with assignedCodes attached
      if (!rawSubject) {
        return next();
      }

      const requestedSubject = String(rawSubject).toUpperCase().trim();

      // 7. Verify if the requested subject is assigned
      if (!assignedCodes.includes(requestedSubject)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: You are not assigned to subject "${requestedSubject}". Only assigned subjects: ${assignedCodes.join(', ') || 'None'}`,
        });
      }

      return next();
    } catch (err) {
      console.error('[SubjectAccessMiddleware] Error:', err);
      return res.status(500).json({ success: false, message: 'Server error verifying subject authorization' });
    }
  };
};

module.exports = { authorizeSubjectAccess };
