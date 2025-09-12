-- Name: Initial Database Schema
-- Description: Creates the initial database schema with all core tables, indexes, triggers, and views
-- Dependencies: none

-- UP MIGRATION

-- Enable foreign keys and set up database
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- ============================================================================
-- USERS AND AUTHENTICATION SCHEMA
-- ============================================================================

-- Main users table
CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'investigator',
    department TEXT,
    organization TEXT,
    certification_level TEXT,
    phone_number TEXT,
    emergency_contact TEXT,
    avatar_path TEXT,
    bio TEXT,
    preferences TEXT DEFAULT '{}',
    permissions TEXT DEFAULT '[]',
    security_settings TEXT DEFAULT '{}',
    last_login INTEGER,
    login_count INTEGER NOT NULL DEFAULT 0,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    password_changed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    must_change_password BOOLEAN NOT NULL DEFAULT 0,
    account_status TEXT NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT 0,
    email_verification_token TEXT,
    password_reset_token TEXT,
    password_reset_expires INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT,
    
    CHECK (role IN ('admin', 'senior_investigator', 'investigator', 'analyst', 'technician', 'viewer')),
    CHECK (account_status IN ('active', 'inactive', 'suspended', 'locked', 'pending_verification')),
    CHECK (login_count >= 0),
    CHECK (failed_login_attempts >= 0),
    CHECK (locked_until IS NULL OR locked_until > strftime('%s', 'now')),
    CHECK (password_changed_at > 0),
    CHECK (password_reset_expires IS NULL OR password_reset_expires > strftime('%s', 'now')),
    CHECK (json_valid(emergency_contact) OR emergency_contact IS NULL),
    CHECK (json_valid(preferences)),
    CHECK (json_valid(permissions)),
    CHECK (json_valid(security_settings)),
    CHECK (length(username) >= 3 AND length(username) <= 50),
    CHECK (email LIKE '%_@_%._%'),
    CHECK (length(password_hash) = 64),
    CHECK (length(salt) >= 16),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- System settings table
CREATE TABLE system_settings (
    id TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'string',
    description TEXT NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT 0,
    requires_restart BOOLEAN NOT NULL DEFAULT 0,
    validation_rule TEXT,
    default_value TEXT,
    min_value REAL,
    max_value REAL,
    allowed_values TEXT,
    ui_component TEXT,
    display_order INTEGER DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_by TEXT NOT NULL,
    
    CHECK (category IN ('database', 'security', 'sensor', 'file_storage', 'notification', 'backup', 'integration', 'ui', 'performance', 'logging', 'email', 'api')),
    CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'password', 'path', 'url', 'email', 'color')),
    CHECK (key != ''),
    CHECK (value != ''),
    CHECK (display_order >= 0),
    CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value),
    CHECK (json_valid(allowed_values) OR allowed_values IS NULL),
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE(category, key)
);

-- ============================================================================
-- INVESTIGATIONS SCHEMA
-- ============================================================================

-- Main investigations table
CREATE TABLE investigations (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    case_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_to TEXT,
    location TEXT,
    coordinates TEXT,
    start_date INTEGER NOT NULL,
    end_date INTEGER,
    estimated_duration INTEGER,
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT 0,
    archived_at INTEGER,
    
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived')),
    CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'critical')),
    CHECK (start_date > 0),
    CHECK (end_date IS NULL OR end_date >= start_date),
    CHECK (estimated_duration IS NULL OR estimated_duration > 0),
    CHECK (created_at > 0),
    CHECK (updated_at >= created_at),
    CHECK (archived_at IS NULL OR archived_at >= created_at),
    CHECK (json_valid(tags)),
    CHECK (json_valid(metadata)),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Investigation sessions table
CREATE TABLE investigation_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT NOT NULL,
    session_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN end_time IS NOT NULL THEN CAST((end_time - start_time) / 60.0 AS INTEGER)
            ELSE NULL
        END
    ) STORED,
    status TEXT NOT NULL DEFAULT 'planned',
    location TEXT,
    coordinates TEXT,
    weather_conditions TEXT,
    equipment_used TEXT DEFAULT '[]',
    team_members TEXT DEFAULT '[]',
    objectives TEXT DEFAULT '[]',
    findings_summary TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    
    CHECK (status IN ('planned', 'in_progress', 'paused', 'completed', 'aborted')),
    CHECK (start_time > 0),
    CHECK (end_time IS NULL OR end_time > start_time),
    CHECK (session_number > 0),
    CHECK (json_valid(equipment_used)),
    CHECK (json_valid(team_members)),
    CHECK (json_valid(objectives)),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE(investigation_id, session_number)
);

-- ============================================================================
-- EVIDENCE SCHEMA
-- ============================================================================

-- Main evidence table
CREATE TABLE evidence (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT NOT NULL,
    session_id TEXT,
    evidence_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'digital',
    category TEXT NOT NULL,
    subcategory TEXT,
    file_path TEXT,
    file_size INTEGER,
    file_hash TEXT,
    mime_type TEXT,
    thumbnail_path TEXT,
    location_found TEXT,
    coordinates TEXT,
    collection_time INTEGER NOT NULL,
    collected_by TEXT NOT NULL,
    chain_of_custody TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    integrity_verified BOOLEAN NOT NULL DEFAULT 0,
    integrity_check_time INTEGER,
    integrity_check_by TEXT,
    analysis_status TEXT NOT NULL DEFAULT 'pending',
    analysis_notes TEXT,
    significance TEXT NOT NULL DEFAULT 'low',
    is_primary_evidence BOOLEAN NOT NULL DEFAULT 0,
    related_evidence TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    archived BOOLEAN NOT NULL DEFAULT 0,
    archived_at INTEGER,
    
    CHECK (type IN ('physical', 'digital', 'photographic', 'video', 'audio', 'document', 'sensor_data', 'measurement', 'testimony', 'other')),
    CHECK (category IN ('emf_reading', 'audio_recording', 'visual_evidence', 'motion_detection', 'environmental_data', 'equipment_malfunction', 'personal_experience', 'historical_research', 'witness_account', 'correlation_analysis')),
    CHECK (analysis_status IN ('pending', 'in_progress', 'completed', 'requires_expert_review', 'inconclusive', 'debunked')),
    CHECK (significance IN ('low', 'medium', 'high', 'critical')),
    CHECK (collection_time > 0),
    CHECK (file_size IS NULL OR file_size > 0),
    CHECK (integrity_check_time IS NULL OR integrity_check_time >= collection_time),
    CHECK (archived_at IS NULL OR archived_at >= created_at),
    CHECK (json_valid(chain_of_custody)),
    CHECK (json_valid(tags)),
    CHECK (json_valid(metadata)),
    CHECK (json_valid(related_evidence)),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    CHECK (file_hash IS NULL OR length(file_hash) = 64),
    
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES investigation_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (integrity_check_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================================
-- SENSOR CONFIGURATION SCHEMA
-- ============================================================================

-- Sensor configurations table
CREATE TABLE sensor_configurations (
    id TEXT PRIMARY KEY NOT NULL,
    sensor_id TEXT UNIQUE NOT NULL,
    sensor_name TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    firmware_version TEXT,
    calibration_date INTEGER,
    calibration_due_date INTEGER,
    sampling_rate REAL NOT NULL DEFAULT 1.0,
    resolution REAL NOT NULL DEFAULT 1.0,
    accuracy TEXT,
    measurement_range TEXT DEFAULT '{}',
    configuration_data TEXT DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    last_maintenance INTEGER,
    maintenance_notes TEXT,
    installation_date INTEGER,
    installation_location TEXT,
    coordinates TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    
    CHECK (sensor_type IN ('emf', 'temperature', 'humidity', 'pressure', 'motion', 'audio', 'light', 'magnetic', 'radiation', 'vibration', 'gps', 'accelerometer', 'gyroscope')),
    CHECK (sampling_rate > 0),
    CHECK (resolution > 0),
    CHECK (calibration_date IS NULL OR calibration_date > 0),
    CHECK (calibration_due_date IS NULL OR calibration_due_date > calibration_date),
    CHECK (installation_date IS NULL OR installation_date > 0),
    CHECK (last_maintenance IS NULL OR last_maintenance >= installation_date),
    CHECK (json_valid(measurement_range)),
    CHECK (json_valid(configuration_data)),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Main sensor readings table
CREATE TABLE sensor_readings (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT,
    session_id TEXT,
    sensor_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    reading_time INTEGER NOT NULL,
    location TEXT,
    coordinates TEXT,
    raw_value REAL NOT NULL,
    processed_value REAL,
    unit TEXT NOT NULL,
    quality_score REAL DEFAULT 1.0,
    calibration_offset REAL DEFAULT 0.0,
    environmental_factors TEXT,
    anomaly_detected BOOLEAN NOT NULL DEFAULT 0,
    anomaly_confidence REAL,
    anomaly_type TEXT,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    CHECK (sensor_type IN ('emf', 'temperature', 'humidity', 'pressure', 'motion', 'audio', 'light', 'magnetic', 'radiation', 'vibration', 'gps', 'accelerometer', 'gyroscope')),
    CHECK (reading_time > 0),
    CHECK (quality_score IS NULL OR (quality_score >= 0.0 AND quality_score <= 1.0)),
    CHECK (anomaly_confidence IS NULL OR (anomaly_confidence >= 0.0 AND anomaly_confidence <= 1.0)),
    CHECK (anomaly_type IS NULL OR anomaly_type IN ('spike', 'drop', 'drift', 'noise', 'pattern', 'correlation', 'threshold')),
    CHECK (json_valid(environmental_factors) OR environmental_factors IS NULL),
    CHECK (json_valid(metadata)),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES investigation_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================================
-- AUDIT AND LOGGING SCHEMA
-- ============================================================================

-- Main audit log table
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    session_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    success BOOLEAN NOT NULL DEFAULT 1,
    error_message TEXT,
    risk_level TEXT NOT NULL DEFAULT 'low',
    investigation_id TEXT,
    session_context TEXT,
    metadata TEXT DEFAULT '{}',
    
    CHECK (action IN ('create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'import', 'backup', 'restore', 'permission_change', 'password_change', 'data_migration', 'system_event')),
    CHECK (entity_type IN ('investigation', 'evidence', 'sensor_reading', 'user', 'user_preference', 'audit_log', 'sensor_configuration', 'system_setting', 'investigation_session', 'file')),
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CHECK (timestamp > 0),
    CHECK (json_valid(old_values) OR old_values IS NULL),
    CHECK (json_valid(new_values) OR new_values IS NULL),
    CHECK (json_valid(session_context) OR session_context IS NULL),
    CHECK (json_valid(metadata)),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- System log table
CREATE TABLE system_log (
    id TEXT PRIMARY KEY NOT NULL,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    source TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    investigation_id TEXT,
    session_id TEXT,
    user_id TEXT,
    error_code TEXT,
    stack_trace TEXT,
    request_id TEXT,
    correlation_id TEXT,
    hostname TEXT,
    process_id INTEGER,
    thread_id TEXT,
    memory_usage INTEGER,
    cpu_usage REAL,
    
    CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    CHECK (category IN ('application', 'database', 'sensor', 'file_system', 'network', 'security', 'performance', 'user_action', 'system', 'integration')),
    CHECK (timestamp > 0),
    CHECK (memory_usage IS NULL OR memory_usage >= 0),
    CHECK (cpu_usage IS NULL OR (cpu_usage >= 0 AND cpu_usage <= 100)),
    CHECK (json_valid(details) OR details IS NULL),
    
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(account_status);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_last_login ON users(last_login);

-- System settings indexes
CREATE INDEX idx_settings_category ON system_settings(category);
CREATE INDEX idx_settings_key ON system_settings(key);
CREATE INDEX idx_settings_system ON system_settings(is_system);

-- Investigations indexes
CREATE INDEX idx_investigations_status ON investigations(status);
CREATE INDEX idx_investigations_priority ON investigations(priority);
CREATE INDEX idx_investigations_assigned_to ON investigations(assigned_to);
CREATE INDEX idx_investigations_case_number ON investigations(case_number);
CREATE INDEX idx_investigations_created_by ON investigations(created_by);
CREATE INDEX idx_investigations_dates ON investigations(start_date, end_date);
CREATE INDEX idx_investigations_archived ON investigations(archived, archived_at);

-- Investigation sessions indexes
CREATE INDEX idx_sessions_investigation_id ON investigation_sessions(investigation_id);
CREATE INDEX idx_sessions_status ON investigation_sessions(status);
CREATE INDEX idx_sessions_dates ON investigation_sessions(start_time, end_time);

-- Evidence indexes
CREATE INDEX idx_evidence_investigation_id ON evidence(investigation_id);
CREATE INDEX idx_evidence_session_id ON evidence(session_id);
CREATE INDEX idx_evidence_number ON evidence(evidence_number);
CREATE INDEX idx_evidence_type ON evidence(type);
CREATE INDEX idx_evidence_category ON evidence(category);
CREATE INDEX idx_evidence_status ON evidence(analysis_status);
CREATE INDEX idx_evidence_significance ON evidence(significance);
CREATE INDEX idx_evidence_collected_by ON evidence(collected_by);
CREATE INDEX idx_evidence_collection_time ON evidence(collection_time);
CREATE INDEX idx_evidence_archived ON evidence(archived, archived_at);

-- Sensor configurations indexes
CREATE INDEX idx_sensor_config_type ON sensor_configurations(sensor_type);
CREATE INDEX idx_sensor_config_active ON sensor_configurations(is_active);
CREATE INDEX idx_sensor_config_calibration_due ON sensor_configurations(calibration_due_date);

-- Sensor readings indexes (critical for performance)
CREATE INDEX idx_sensor_readings_sensor_id ON sensor_readings(sensor_id);
CREATE INDEX idx_sensor_readings_time ON sensor_readings(reading_time);
CREATE INDEX idx_sensor_readings_investigation ON sensor_readings(investigation_id);
CREATE INDEX idx_sensor_readings_session ON sensor_readings(session_id);
CREATE INDEX idx_sensor_readings_type ON sensor_readings(sensor_type);
CREATE INDEX idx_sensor_readings_anomaly ON sensor_readings(anomaly_detected);
CREATE INDEX idx_sensor_readings_composite ON sensor_readings(sensor_id, reading_time, investigation_id);

-- Audit log indexes
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_entity_id ON audit_log(entity_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_risk_level ON audit_log(risk_level);
CREATE INDEX idx_audit_investigation_id ON audit_log(investigation_id);

-- System log indexes
CREATE INDEX idx_system_log_level ON system_log(level);
CREATE INDEX idx_system_log_category ON system_log(category);
CREATE INDEX idx_system_log_timestamp ON system_log(timestamp);
CREATE INDEX idx_system_log_source ON system_log(source);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp triggers
CREATE TRIGGER trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_system_settings_updated_at
    AFTER UPDATE ON system_settings
    FOR EACH ROW
BEGIN
    UPDATE system_settings SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_investigations_updated_at
    AFTER UPDATE ON investigations
    FOR EACH ROW
BEGIN
    UPDATE investigations SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_sessions_updated_at
    AFTER UPDATE ON investigation_sessions
    FOR EACH ROW
BEGIN
    UPDATE investigation_sessions SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_evidence_updated_at
    AFTER UPDATE ON evidence
    FOR EACH ROW
BEGIN
    UPDATE evidence SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_sensor_config_updated_at
    AFTER UPDATE ON sensor_configurations
    FOR EACH ROW
BEGIN
    UPDATE sensor_configurations SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Auto-archive investigations when completed
CREATE TRIGGER trg_investigations_auto_archive
    AFTER UPDATE OF status ON investigations
    FOR EACH ROW
    WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    UPDATE investigations 
    SET end_date = COALESCE(end_date, strftime('%s', 'now'))
    WHERE id = NEW.id;
END;

-- Create audit log entries for high-level operations
CREATE TRIGGER trg_audit_investigations
    AFTER INSERT ON investigations
    FOR EACH ROW
BEGIN
    INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, new_values, investigation_id)
    VALUES (
        'audit_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.created_by,
        'create',
        'investigation',
        NEW.id,
        json_object('name', NEW.name, 'status', NEW.status, 'priority', NEW.priority),
        NEW.id
    );
END;

CREATE TRIGGER trg_audit_evidence
    AFTER INSERT ON evidence
    FOR EACH ROW
BEGIN
    INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, new_values, investigation_id)
    VALUES (
        'audit_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.collected_by,
        'create',
        'evidence',
        NEW.id,
        json_object('name', NEW.name, 'type', NEW.type, 'category', NEW.category),
        NEW.investigation_id
    );
END;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Create system admin user (password should be changed on first login)
INSERT INTO users (
    id, username, email, password_hash, salt, full_name, role, 
    account_status, must_change_password, created_by
) VALUES (
    'admin-001',
    'admin',
    'admin@tacctile.local',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', -- Empty string hash (must change)
    'defaultsalt1234',
    'System Administrator',
    'admin',
    'active',
    1,
    'system'
);

-- Insert essential system settings
INSERT INTO system_settings (id, category, key, value, data_type, description, updated_by) VALUES
('db-001', 'database', 'max_connections', '100', 'number', 'Maximum database connections', 'admin-001'),
('sec-001', 'security', 'session_timeout', '3600', 'number', 'Session timeout in seconds', 'admin-001'),
('sec-002', 'security', 'max_login_attempts', '5', 'number', 'Maximum failed login attempts before lockout', 'admin-001'),
('sen-001', 'sensor', 'default_sampling_rate', '1.0', 'number', 'Default sensor sampling rate (Hz)', 'admin-001'),
('log-001', 'logging', 'log_level', 'info', 'string', 'System logging level', 'admin-001'),
('log-002', 'logging', 'log_retention_days', '90', 'number', 'Days to retain log entries', 'admin-001'),
('ui-001', 'ui', 'default_theme', 'dark', 'string', 'Default UI theme', 'admin-001'),
('backup-001', 'backup', 'auto_backup_enabled', 'true', 'boolean', 'Enable automatic backups', 'admin-001'),
('backup-002', 'backup', 'backup_interval_hours', '24', 'number', 'Hours between automatic backups', 'admin-001');

-- DOWN MIGRATION

-- Drop all tables in reverse dependency order
DROP TRIGGER IF EXISTS trg_audit_evidence;
DROP TRIGGER IF EXISTS trg_audit_investigations;
DROP TRIGGER IF EXISTS trg_investigations_auto_archive;
DROP TRIGGER IF EXISTS trg_sensor_config_updated_at;
DROP TRIGGER IF EXISTS trg_evidence_updated_at;
DROP TRIGGER IF EXISTS trg_sessions_updated_at;
DROP TRIGGER IF EXISTS trg_investigations_updated_at;
DROP TRIGGER IF EXISTS trg_system_settings_updated_at;
DROP TRIGGER IF EXISTS trg_users_updated_at;

DROP INDEX IF EXISTS idx_system_log_source;
DROP INDEX IF EXISTS idx_system_log_timestamp;
DROP INDEX IF EXISTS idx_system_log_category;
DROP INDEX IF EXISTS idx_system_log_level;
DROP INDEX IF EXISTS idx_audit_investigation_id;
DROP INDEX IF EXISTS idx_audit_risk_level;
DROP INDEX IF EXISTS idx_audit_timestamp;
DROP INDEX IF EXISTS idx_audit_entity_id;
DROP INDEX IF EXISTS idx_audit_entity_type;
DROP INDEX IF EXISTS idx_audit_action;
DROP INDEX IF EXISTS idx_audit_user_id;
DROP INDEX IF EXISTS idx_sensor_readings_composite;
DROP INDEX IF EXISTS idx_sensor_readings_anomaly;
DROP INDEX IF EXISTS idx_sensor_readings_type;
DROP INDEX IF EXISTS idx_sensor_readings_session;
DROP INDEX IF EXISTS idx_sensor_readings_investigation;
DROP INDEX IF EXISTS idx_sensor_readings_time;
DROP INDEX IF EXISTS idx_sensor_readings_sensor_id;
DROP INDEX IF EXISTS idx_sensor_config_calibration_due;
DROP INDEX IF EXISTS idx_sensor_config_active;
DROP INDEX IF EXISTS idx_sensor_config_type;
DROP INDEX IF EXISTS idx_evidence_archived;
DROP INDEX IF EXISTS idx_evidence_collection_time;
DROP INDEX IF EXISTS idx_evidence_collected_by;
DROP INDEX IF EXISTS idx_evidence_significance;
DROP INDEX IF EXISTS idx_evidence_status;
DROP INDEX IF EXISTS idx_evidence_category;
DROP INDEX IF EXISTS idx_evidence_type;
DROP INDEX IF EXISTS idx_evidence_number;
DROP INDEX IF EXISTS idx_evidence_session_id;
DROP INDEX IF EXISTS idx_evidence_investigation_id;
DROP INDEX IF EXISTS idx_sessions_dates;
DROP INDEX IF EXISTS idx_sessions_status;
DROP INDEX IF EXISTS idx_sessions_investigation_id;
DROP INDEX IF EXISTS idx_investigations_archived;
DROP INDEX IF EXISTS idx_investigations_dates;
DROP INDEX IF EXISTS idx_investigations_created_by;
DROP INDEX IF EXISTS idx_investigations_case_number;
DROP INDEX IF EXISTS idx_investigations_assigned_to;
DROP INDEX IF EXISTS idx_investigations_priority;
DROP INDEX IF EXISTS idx_investigations_status;
DROP INDEX IF EXISTS idx_settings_system;
DROP INDEX IF EXISTS idx_settings_key;
DROP INDEX IF EXISTS idx_settings_category;
DROP INDEX IF EXISTS idx_users_last_login;
DROP INDEX IF EXISTS idx_users_department;
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;

DROP TABLE IF EXISTS system_log;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS sensor_readings;
DROP TABLE IF EXISTS sensor_configurations;
DROP TABLE IF EXISTS evidence;
DROP TABLE IF EXISTS investigation_sessions;
DROP TABLE IF EXISTS investigations;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS users;