/**
 * Student Routes
 * API endpoints for student management.
 */

const express = require('express');
const router = express.Router();
const { studentController } = require('../controllers');
const { 
    isAuthenticated, 
    requireAdmin,
    requireAdministrative,
    validateDepartmentAccess,
    asyncHandler 
} = require('../middleware');

// ==========================================
// STUDENT LOOKUP ROUTES
// ==========================================

/**
 * GET /api/students
 * Get all students with filtering
 * 
 * Query params:
 * - departmentId: Filter by department
 * - studentType: Filter by type (day_scholar, hosteler, bus)
 * - hostelId: Filter by hostel
 * - year: Filter by year of study
 * - search: Search by name or roll number
 * - limit: Maximum results
 */
router.get('/api/students', 
    isAuthenticated, 
    validateDepartmentAccess,
    asyncHandler(studentController.getAllStudents)
);

/**
 * GET /api/students/:rollNumber
 * Get single student by roll number
 */
router.get('/api/students/:rollNumber', 
    isAuthenticated, 
    asyncHandler(studentController.getStudentByRollNumber)
);

/**
 * GET /api/students/:rollNumber/status
 * Get student's current status (today's logs, permissions)
 */
router.get('/api/students/:rollNumber/status', 
    isAuthenticated, 
    asyncHandler(studentController.getStudentStatus)
);

/**
 * GET /api/students/:rollNumber/history
 * Get student's attendance history
 * 
 * Query params:
 * - startDate: Start of date range
 * - endDate: End of date range
 */
router.get('/api/students/:rollNumber/history', 
    requireAdministrative, 
    asyncHandler(studentController.getStudentHistory)
);

// ==========================================
// STUDENT MANAGEMENT ROUTES (Admin only)
// ==========================================

/**
 * POST /api/students
 * Create a new student
 */
router.post('/api/students', 
    requireAdmin, 
    asyncHandler(studentController.createStudent)
);

/**
 * PUT /api/students/:rollNumber
 * Update student information
 */
router.put('/api/students/:rollNumber', 
    requireAdmin, 
    asyncHandler(studentController.updateStudent)
);

/**
 * DELETE /api/students/:rollNumber
 * Deactivate a student (soft delete)
 */
router.delete('/api/students/:rollNumber', 
    requireAdmin, 
    asyncHandler(studentController.deactivateStudent)
);

module.exports = router;
