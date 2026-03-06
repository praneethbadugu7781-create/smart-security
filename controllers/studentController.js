/**
 * Student Controller
 * Handles student management operations.
 */

const { Student, EntryExitLog, PermissionLetter, RoamingLog } = require('../models');

/**
 * Get all students with filtering
 */
async function getAllStudents(req, res) {
    try {
        const filters = {
            departmentId: req.query.departmentId || req.departmentFilter,
            departmentCode: req.query.department,
            studentType: req.query.studentType,
            hostelId: req.query.hostelId || req.hostelFilter,
            yearOfStudy: req.query.year,
            search: req.query.search,
            limit: req.query.limit
        };
        
        const students = await Student.findAll(filters);
        
        res.json({
            success: true,
            count: students.length,
            students
        });
    } catch (error) {
        console.error('[GET STUDENTS ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch students'
        });
    }
}

/**
 * Get single student by roll number
 */
async function getStudentByRollNumber(req, res) {
    try {
        const { rollNumber } = req.params;
        const student = await Student.findByRollNumber(rollNumber.toUpperCase());
        
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        // Check role-based access
        if (req.session.user.role === 'hod' && 
            student.department_id !== req.session.user.department_id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this student'
            });
        }
        
        res.json({
            success: true,
            student
        });
    } catch (error) {
        console.error('[GET STUDENT ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch student'
        });
    }
}

/**
 * Get student's today status and history
 */
async function getStudentStatus(req, res) {
    try {
        const { rollNumber } = req.params;
        const student = await Student.findByRollNumber(rollNumber.toUpperCase());
        
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        // Get today's logs
        const todayLogs = await EntryExitLog.getStudentTodayLogs(rollNumber.toUpperCase());
        
        // Get today's status
        const status = await Student.getTodayStatus(rollNumber.toUpperCase());
        
        // Get valid permission for today
        const validPermission = await PermissionLetter.findValidForToday(rollNumber.toUpperCase());
        
        // Get recent roaming incidents
        const roamingHistory = await RoamingLog.getStudentHistory(student.id, 7);
        
        res.json({
            success: true,
            student,
            status,
            todayLogs,
            validPermission,
            roamingHistory
        });
    } catch (error) {
        console.error('[GET STUDENT STATUS ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch student status'
        });
    }
}

/**
 * Get student's attendance history
 */
async function getStudentHistory(req, res) {
    try {
        const { rollNumber } = req.params;
        const { startDate, endDate } = req.query;
        
        const student = await Student.findByRollNumber(rollNumber.toUpperCase());
        
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        // Default to last 30 days
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end - 30 * 24 * 60 * 60 * 1000);
        
        const logs = await EntryExitLog.getLogsByDateRange(start, end, { studentId: student.id });
        const permissions = await PermissionLetter.getStudentHistory(student.id, 30);
        const roamingLogs = await RoamingLog.getStudentHistory(student.id, 30);
        
        res.json({
            success: true,
            student,
            dateRange: { start, end },
            logs,
            permissions,
            roamingLogs,
            summary: {
                totalEntries: logs.filter(l => l.event_type === 'entry').length,
                totalExits: logs.filter(l => l.event_type === 'exit').length,
                lateEntries: logs.filter(l => l.is_late_entry).length,
                roamingIncidents: roamingLogs.length,
                permissionsUsed: permissions.filter(p => p.is_used).length
            }
        });
    } catch (error) {
        console.error('[GET STUDENT HISTORY ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch student history'
        });
    }
}

/**
 * Create new student (Admin only)
 */
async function createStudent(req, res) {
    try {
        const studentData = req.body;
        
        // Validate required fields
        if (!studentData.roll_number || !studentData.full_name || 
            !studentData.student_type || !studentData.department_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: roll_number, full_name, student_type, department_id'
            });
        }
        
        // Check if roll number already exists
        const existing = await Student.findByRollNumber(studentData.roll_number.toUpperCase());
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Roll number already exists'
            });
        }
        
        // Normalize roll number
        studentData.roll_number = studentData.roll_number.toUpperCase();
        
        const student = await Student.create(studentData);
        
        // Audit log
        await req.audit('CREATE_STUDENT', 'student', student.id, null, studentData);
        
        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            student
        });
    } catch (error) {
        console.error('[CREATE STUDENT ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create student'
        });
    }
}

/**
 * Update student (Admin only)
 */
async function updateStudent(req, res) {
    try {
        const { rollNumber } = req.params;
        const updateData = req.body;
        
        const student = await Student.findByRollNumber(rollNumber.toUpperCase());
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        const success = await Student.update(student.id, updateData);
        
        if (success) {
            // Audit log
            await req.audit('UPDATE_STUDENT', 'student', student.id, student, updateData);
            
            res.json({
                success: true,
                message: 'Student updated successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }
    } catch (error) {
        console.error('[UPDATE STUDENT ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update student'
        });
    }
}

/**
 * Deactivate student (Admin only)
 */
async function deactivateStudent(req, res) {
    try {
        const { rollNumber } = req.params;
        
        const student = await Student.findByRollNumber(rollNumber.toUpperCase());
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        await Student.deactivate(student.id);
        
        // Audit log
        await req.audit('DEACTIVATE_STUDENT', 'student', student.id);
        
        res.json({
            success: true,
            message: 'Student deactivated successfully'
        });
    } catch (error) {
        console.error('[DEACTIVATE STUDENT ERROR]', error);
        res.status(500).json({
            success: false,
            error: 'Failed to deactivate student'
        });
    }
}

module.exports = {
    getAllStudents,
    getStudentByRollNumber,
    getStudentStatus,
    getStudentHistory,
    createStudent,
    updateStudent,
    deactivateStudent
};
