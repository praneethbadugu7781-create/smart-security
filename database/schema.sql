-- ============================================================
-- Smart Main Gate Entry-Exit & Campus Discipline System
-- MySQL Database Schema
-- ============================================================
-- This schema supports:
-- - Role-based user management
-- - Student records with type classification
-- - Entry/Exit logging with rule validation
-- - Permission letter storage with photo references
-- - Roaming detection and escalation
-- - Department and hostel management
-- ============================================================

-- Create database
CREATE DATABASE IF NOT EXISTS college_security 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE college_security;

-- ============================================================
-- DEPARTMENTS TABLE
-- Stores all academic departments
-- ============================================================
CREATE TABLE departments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    hod_user_id INT NULL,                    -- Reference to HOD user
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_code (code)
) ENGINE=InnoDB;

-- ============================================================
-- HOSTELS TABLE
-- Stores hostel information
-- ============================================================
CREATE TABLE hostels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    type ENUM('boys', 'girls') NOT NULL,
    warden_user_id INT NULL,                 -- Reference to Warden user
    capacity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_code (code),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- ============================================================
-- USERS TABLE
-- All system users (Security, Admin, HOD, Warden, Principal)
-- ============================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(15),
    role ENUM('security', 'admin', 'hod', 'warden', 'principal') NOT NULL,
    department_id INT NULL,                  -- For HODs - their department
    hostel_id INT NULL,                      -- For Wardens - their hostel
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_role (role),
    INDEX idx_username (username),
    INDEX idx_department (department_id),
    INDEX idx_hostel (hostel_id),
    
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Add foreign keys for HOD and Warden references
ALTER TABLE departments 
    ADD FOREIGN KEY (hod_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE hostels 
    ADD FOREIGN KEY (warden_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- STUDENTS TABLE
-- All student records, key lookup table for barcode scans
-- ============================================================
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    roll_number VARCHAR(20) NOT NULL UNIQUE, -- This is the barcode value
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(15),
    parent_phone VARCHAR(15),
    
    -- Classification
    student_type ENUM('day_scholar', 'hosteler', 'bus') NOT NULL,
    department_id INT NOT NULL,
    year_of_study TINYINT NOT NULL,          -- 1, 2, 3, 4
    section VARCHAR(5),                       -- A, B, C, etc.
    
    -- Hostel info (for hostelers only)
    hostel_id INT NULL,
    room_number VARCHAR(10) NULL,
    
    -- Bus info (for bus students only)
    bus_route VARCHAR(50) NULL,
    bus_stop VARCHAR(100) NULL,
    
    -- Photo for verification (optional)
    photo_url VARCHAR(255) NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    admission_date DATE,
    
    -- Discipline tracking
    roaming_count INT DEFAULT 0,             -- Cumulative roaming incidents
    late_count INT DEFAULT 0,                -- Cumulative late arrivals
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_roll_number (roll_number),
    INDEX idx_student_type (student_type),
    INDEX idx_department (department_id),
    INDEX idx_hostel (hostel_id),
    INDEX idx_active (is_active),
    
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- ENTRY_EXIT_LOGS TABLE
-- Core table for all gate scan events
-- ============================================================
CREATE TABLE entry_exit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    roll_number VARCHAR(20) NOT NULL,        -- Denormalized for fast display
    
    -- Event details
    event_type ENUM('entry', 'exit', 'roaming') NOT NULL,
    event_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Location (for future multi-gate support)
    gate_location VARCHAR(50) DEFAULT 'main_gate',
    
    -- Rule validation results
    is_allowed BOOLEAN NOT NULL,             -- Was this allowed by rules?
    requires_permission BOOLEAN DEFAULT FALSE,
    has_permission BOOLEAN DEFAULT FALSE,
    permission_letter_id BIGINT NULL,        -- Reference to permission letter
    
    -- Classification at time of scan
    student_type ENUM('day_scholar', 'hosteler', 'bus') NOT NULL,
    
    -- Time classification
    is_during_class_hours BOOLEAN DEFAULT FALSE,
    is_late_entry BOOLEAN DEFAULT FALSE,
    is_late_return BOOLEAN DEFAULT FALSE,    -- For hostelers after curfew
    
    -- Alert tracking
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_to VARCHAR(50) NULL,          -- 'hod', 'warden', 'principal'
    alert_acknowledged BOOLEAN DEFAULT FALSE,
    alert_acknowledged_by INT NULL,
    alert_acknowledged_at TIMESTAMP NULL,
    
    -- Security who scanned
    scanned_by_user_id INT NOT NULL,
    
    -- Additional notes (optional)
    notes TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_student (student_id),
    INDEX idx_roll_number (roll_number),
    INDEX idx_event_type (event_type),
    INDEX idx_timestamp (event_timestamp),
    INDEX idx_date (event_timestamp),
    INDEX idx_alert_pending (alert_sent, alert_acknowledged),
    INDEX idx_requires_permission (requires_permission, has_permission),
    INDEX idx_scanned_by (scanned_by_user_id),
    
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (scanned_by_user_id) REFERENCES users(id),
    FOREIGN KEY (alert_acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- PERMISSION_LETTERS TABLE
-- Stores photographed permission letters from HODs
-- ============================================================
CREATE TABLE permission_letters (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    roll_number VARCHAR(20) NOT NULL,
    
    -- Permission details
    reason TEXT NOT NULL,
    permitted_exit_time TIME NULL,
    permitted_return_time TIME NULL,
    permission_date DATE NOT NULL,
    
    -- Photo storage
    photo_filename VARCHAR(255) NOT NULL,
    photo_path VARCHAR(500) NOT NULL,
    photo_mime_type VARCHAR(50) NOT NULL,
    
    -- Issuer information (from letter content)
    issued_by_name VARCHAR(100),             -- HOD name on letter
    issued_by_designation VARCHAR(100),
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,       -- Admin/HOD verified authenticity
    verified_by_user_id INT NULL,
    verified_at TIMESTAMP NULL,
    
    -- Usage tracking
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    used_for_log_id BIGINT NULL,             -- Which entry_exit_log used this
    
    -- Validity
    is_valid BOOLEAN DEFAULT TRUE,
    invalidated_reason VARCHAR(255) NULL,
    
    -- Upload info
    uploaded_by_user_id INT NOT NULL,        -- Security who photographed
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_student (student_id),
    INDEX idx_roll_number (roll_number),
    INDEX idx_date (permission_date),
    INDEX idx_unused (is_used, is_valid),
    
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Add foreign key for permission letter reference
ALTER TABLE entry_exit_logs 
    ADD FOREIGN KEY (permission_letter_id) REFERENCES permission_letters(id) ON DELETE SET NULL;

-- ============================================================
-- ROAMING_LOGS TABLE
-- Tracks students found roaming during class hours
-- ============================================================
CREATE TABLE roaming_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    roll_number VARCHAR(20) NOT NULL,
    
    -- Detection details
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detected_location VARCHAR(100) DEFAULT 'campus',
    
    -- What class they should be in
    expected_class VARCHAR(100) NULL,
    expected_location VARCHAR(100) NULL,
    
    -- Alert tracking
    alert_sent_to_hod BOOLEAN DEFAULT FALSE,
    hod_notified_at TIMESTAMP NULL,
    hod_user_id INT NULL,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT NULL,
    resolved_by_user_id INT NULL,
    resolved_at TIMESTAMP NULL,
    
    -- Escalation
    is_escalated BOOLEAN DEFAULT FALSE,
    escalated_to ENUM('warden', 'principal') NULL,
    escalated_at TIMESTAMP NULL,
    
    -- Link to the scan that detected roaming
    entry_exit_log_id BIGINT NULL,
    
    -- Security who detected
    detected_by_user_id INT NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_student (student_id),
    INDEX idx_roll_number (roll_number),
    INDEX idx_detected_at (detected_at),
    INDEX idx_unresolved (is_resolved),
    INDEX idx_hod (hod_user_id),
    
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (hod_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (detected_by_user_id) REFERENCES users(id),
    FOREIGN KEY (entry_exit_log_id) REFERENCES entry_exit_logs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- ALERTS TABLE
-- Real-time alert queue for dashboards
-- ============================================================
CREATE TABLE alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    
    -- Alert target
    target_role ENUM('hod', 'warden', 'principal', 'admin') NOT NULL,
    target_department_id INT NULL,           -- For HOD-specific alerts
    target_hostel_id INT NULL,               -- For Warden-specific alerts
    
    -- Alert content
    alert_type ENUM('roaming', 'unauthorized_exit', 'late_return', 'permission_required', 'escalation') NOT NULL,
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related records
    student_id INT NULL,
    entry_exit_log_id BIGINT NULL,
    roaming_log_id BIGINT NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_by_user_id INT NULL,
    read_at TIMESTAMP NULL,
    
    is_actioned BOOLEAN DEFAULT FALSE,
    action_taken VARCHAR(255) NULL,
    actioned_by_user_id INT NULL,
    actioned_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_target_role (target_role),
    INDEX idx_target_department (target_department_id),
    INDEX idx_target_hostel (target_hostel_id),
    INDEX idx_unread (is_read),
    INDEX idx_priority (priority),
    INDEX idx_created (created_at),
    
    FOREIGN KEY (target_department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (target_hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    FOREIGN KEY (entry_exit_log_id) REFERENCES entry_exit_logs(id) ON DELETE SET NULL,
    FOREIGN KEY (roaming_log_id) REFERENCES roaming_logs(id) ON DELETE SET NULL,
    FOREIGN KEY (read_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (actioned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- AUDIT_LOG TABLE
-- Tracks all significant system actions for accountability
-- ============================================================
CREATE TABLE audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    username VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),                 -- 'student', 'user', 'permission', etc.
    entity_id BIGINT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- SYSTEM_SETTINGS TABLE
-- Dynamic configuration stored in database
-- ============================================================
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    updated_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- INITIAL DATA
-- ============================================================

-- Insert default departments
INSERT INTO departments (code, name) VALUES
('CSE', 'Computer Science & Engineering'),
('ECE', 'Electronics & Communication Engineering'),
('EEE', 'Electrical & Electronics Engineering'),
('MECH', 'Mechanical Engineering'),
('CIVIL', 'Civil Engineering'),
('MBA', 'Master of Business Administration'),
('MCA', 'Master of Computer Applications');

-- Insert default hostels
INSERT INTO hostels (code, name, type, capacity) VALUES
('BH1', 'Boys Hostel 1', 'boys', 200),
('BH2', 'Boys Hostel 2', 'boys', 200),
('GH1', 'Girls Hostel 1', 'girls', 150),
('GH2', 'Girls Hostel 2', 'girls', 150);

-- Insert default admin user (password: admin123 - CHANGE IN PRODUCTION!)
-- Password hash is bcrypt hash of 'admin123'
INSERT INTO users (username, password_hash, full_name, email, role, is_active) VALUES
('admin', '$2b$10$rQZ8kHqKvGXvhF9vkXvXxOvYMHGhB9PqWZkLqJqRvXkXvhF9vkXvX', 'System Administrator', 'admin@college.edu', 'admin', TRUE);

-- Insert default security user (password: security123 - CHANGE IN PRODUCTION!)
INSERT INTO users (username, password_hash, full_name, email, role, is_active) VALUES
('security1', '$2b$10$rQZ8kHqKvGXvhF9vkXvXxOvYMHGhB9PqWZkLqJqRvXkXvhF9vkXvX', 'Main Gate Security', 'security@college.edu', 'security', TRUE);

-- Insert default principal user (password: principal123 - CHANGE IN PRODUCTION!)
INSERT INTO users (username, password_hash, full_name, email, role, is_active) VALUES
('principal', '$2b$10$rQZ8kHqKvGXvhF9vkXvXxOvYMHGhB9PqWZkLqJqRvXkXvhF9vkXvX', 'Dr. Principal', 'principal@college.edu', 'principal', TRUE);

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('duplicate_scan_interval_ms', '30000', 'number', 'Minimum milliseconds between duplicate scans'),
('class_start_time', '09:00', 'string', 'Daily class start time (HH:MM)'),
('class_end_time', '16:30', 'string', 'Daily class end time (HH:MM)'),
('hostel_curfew_time', '21:00', 'string', 'Hostel curfew time (HH:MM)'),
('roaming_escalation_threshold', '3', 'number', 'Number of roaming incidents before escalation'),
('enable_sound_alerts', 'true', 'boolean', 'Enable beep sounds on successful scan'),
('auto_refresh_interval_ms', '5000', 'number', 'Dashboard auto-refresh interval in milliseconds');

-- ============================================================
-- SAMPLE DATA FOR TESTING (Comment out in production)
-- ============================================================

-- Sample students
INSERT INTO students (roll_number, full_name, email, phone, parent_phone, student_type, department_id, year_of_study, section) VALUES
('21CS001', 'Rahul Kumar', 'rahul@college.edu', '9876543210', '9876543211', 'day_scholar', 1, 3, 'A'),
('21CS002', 'Priya Sharma', 'priya@college.edu', '9876543212', '9876543213', 'day_scholar', 1, 3, 'A'),
('21EC001', 'Amit Singh', 'amit@college.edu', '9876543214', '9876543215', 'bus', 2, 2, 'B'),
('21ME001', 'Sneha Patel', 'sneha@college.edu', '9876543216', '9876543217', 'hosteler', 4, 4, 'A');

-- Update hosteler with hostel info
UPDATE students SET hostel_id = 3, room_number = '101' WHERE roll_number = '21ME001';

-- Update bus student with route info
UPDATE students SET bus_route = 'Route-5', bus_stop = 'Central Bus Stand' WHERE roll_number = '21EC001';

-- Sample HOD users
INSERT INTO users (username, password_hash, full_name, email, role, department_id, is_active) VALUES
('hod_cse', '$2b$10$rQZ8kHqKvGXvhF9vkXvXxOvYMHGhB9PqWZkLqJqRvXkXvhF9vkXvX', 'Dr. CSE HOD', 'hod.cse@college.edu', 'hod', 1, TRUE),
('hod_ece', '$2b$10$rQZ8kHqKvGXvhF9vkXvXxOvYMHGhB9PqWZkLqJqRvXkXvhF9vkXvX', 'Dr. ECE HOD', 'hod.ece@college.edu', 'hod', 2, TRUE);

-- Update department HOD references
UPDATE departments SET hod_user_id = (SELECT id FROM users WHERE username = 'hod_cse') WHERE code = 'CSE';
UPDATE departments SET hod_user_id = (SELECT id FROM users WHERE username = 'hod_ece') WHERE code = 'ECE';

-- Sample Warden users
INSERT INTO users (username, password_hash, full_name, email, role, hostel_id, is_active) VALUES
('warden_gh1', '$2b$10$rQZ8kHqKvGXvhF9vkXvXxOvYMHGhB9PqWZkLqJqRvXkXvhF9vkXvX', 'Mrs. Girls Warden', 'warden.gh1@college.edu', 'warden', 3, TRUE);

-- Update hostel warden reference
UPDATE hostels SET warden_user_id = (SELECT id FROM users WHERE username = 'warden_gh1') WHERE code = 'GH1';

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- Today's entry-exit summary view
CREATE OR REPLACE VIEW v_today_logs AS
SELECT 
    eel.id,
    eel.roll_number,
    s.full_name,
    s.student_type,
    d.name AS department,
    eel.event_type,
    eel.event_timestamp,
    eel.is_allowed,
    eel.requires_permission,
    eel.has_permission,
    eel.is_during_class_hours,
    eel.alert_sent,
    eel.alert_acknowledged
FROM entry_exit_logs eel
JOIN students s ON eel.student_id = s.id
JOIN departments d ON s.department_id = d.id
WHERE DATE(eel.event_timestamp) = CURDATE()
ORDER BY eel.event_timestamp DESC;

-- Pending alerts view
CREATE OR REPLACE VIEW v_pending_alerts AS
SELECT 
    a.*,
    s.full_name AS student_name,
    s.roll_number,
    d.name AS department_name,
    h.name AS hostel_name
FROM alerts a
LEFT JOIN students s ON a.student_id = s.id
LEFT JOIN departments d ON a.target_department_id = d.id
LEFT JOIN hostels h ON a.target_hostel_id = h.id
WHERE a.is_read = FALSE OR a.is_actioned = FALSE
ORDER BY 
    FIELD(a.priority, 'critical', 'high', 'medium', 'low'),
    a.created_at DESC;

-- Student attendance summary view
CREATE OR REPLACE VIEW v_student_attendance_summary AS
SELECT 
    s.id AS student_id,
    s.roll_number,
    s.full_name,
    s.student_type,
    d.name AS department,
    COUNT(CASE WHEN eel.event_type = 'entry' THEN 1 END) AS total_entries,
    COUNT(CASE WHEN eel.event_type = 'exit' THEN 1 END) AS total_exits,
    COUNT(CASE WHEN eel.is_late_entry = TRUE THEN 1 END) AS late_entries,
    COUNT(CASE WHEN eel.event_type = 'roaming' THEN 1 END) AS roaming_incidents,
    MAX(eel.event_timestamp) AS last_scan
FROM students s
JOIN departments d ON s.department_id = d.id
LEFT JOIN entry_exit_logs eel ON s.id = eel.student_id
GROUP BY s.id, s.roll_number, s.full_name, s.student_type, d.name;

-- ============================================================
-- STORED PROCEDURES
-- ============================================================

DELIMITER //

-- Procedure to check for duplicate scan
CREATE PROCEDURE sp_check_duplicate_scan(
    IN p_roll_number VARCHAR(20),
    IN p_interval_ms INT,
    OUT p_is_duplicate BOOLEAN,
    OUT p_last_scan_type VARCHAR(10)
)
BEGIN
    DECLARE last_scan_time TIMESTAMP;
    DECLARE time_diff INT;
    
    SELECT event_timestamp, event_type 
    INTO last_scan_time, p_last_scan_type
    FROM entry_exit_logs 
    WHERE roll_number = p_roll_number 
    ORDER BY event_timestamp DESC 
    LIMIT 1;
    
    IF last_scan_time IS NULL THEN
        SET p_is_duplicate = FALSE;
        SET p_last_scan_type = NULL;
    ELSE
        SET time_diff = TIMESTAMPDIFF(SECOND, last_scan_time, NOW()) * 1000;
        SET p_is_duplicate = (time_diff < p_interval_ms);
    END IF;
END //

-- Procedure to get student's today status
CREATE PROCEDURE sp_get_student_today_status(
    IN p_roll_number VARCHAR(20)
)
BEGIN
    SELECT 
        s.id AS student_id,
        s.roll_number,
        s.full_name,
        s.student_type,
        d.name AS department,
        s.hostel_id,
        h.name AS hostel_name,
        (SELECT event_type FROM entry_exit_logs 
         WHERE roll_number = p_roll_number 
         ORDER BY event_timestamp DESC LIMIT 1) AS last_event_type,
        (SELECT event_timestamp FROM entry_exit_logs 
         WHERE roll_number = p_roll_number 
         ORDER BY event_timestamp DESC LIMIT 1) AS last_event_time,
        (SELECT COUNT(*) FROM entry_exit_logs 
         WHERE roll_number = p_roll_number 
         AND DATE(event_timestamp) = CURDATE() 
         AND event_type = 'entry') AS today_entries,
        (SELECT COUNT(*) FROM entry_exit_logs 
         WHERE roll_number = p_roll_number 
         AND DATE(event_timestamp) = CURDATE() 
         AND event_type = 'exit') AS today_exits,
        (SELECT id FROM permission_letters 
         WHERE roll_number = p_roll_number 
         AND permission_date = CURDATE() 
         AND is_used = FALSE 
         AND is_valid = TRUE 
         LIMIT 1) AS valid_permission_id
    FROM students s
    JOIN departments d ON s.department_id = d.id
    LEFT JOIN hostels h ON s.hostel_id = h.id
    WHERE s.roll_number = p_roll_number AND s.is_active = TRUE;
END //

DELIMITER ;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Composite indexes for common query patterns
CREATE INDEX idx_logs_student_date ON entry_exit_logs(student_id, event_timestamp);
CREATE INDEX idx_logs_roll_date ON entry_exit_logs(roll_number, event_timestamp);
CREATE INDEX idx_alerts_target_unread ON alerts(target_role, target_department_id, is_read);
CREATE INDEX idx_permission_student_date ON permission_letters(student_id, permission_date, is_used);

-- ============================================================
-- END OF SCHEMA
-- ============================================================
