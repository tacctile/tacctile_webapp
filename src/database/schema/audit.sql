-- ============================================================================
-- AUDIT TRAILS AND LOGGING SCHEMA
-- ============================================================================

-- Main audit log table
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    session_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values TEXT, -- JSON object with previous values
    new_values TEXT, -- JSON object with new values
    ip_address TEXT,
    user_agent TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    success BOOLEAN NOT NULL DEFAULT 1,
    error_message TEXT,
    risk_level TEXT NOT NULL DEFAULT 'low',
    investigation_id TEXT, -- Context for investigation-related actions
    session_context TEXT, -- JSON object with additional session context
    metadata TEXT DEFAULT '{}', -- JSON object for action-specific metadata
    
    -- Constraints
    CHECK (action IN ('create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'import', 'backup', 'restore', 'permission_change', 'password_change', 'data_migration', 'system_event')),
    CHECK (entity_type IN ('investigation', 'evidence', 'sensor_reading', 'user', 'user_preference', 'audit_log', 'sensor_configuration', 'system_setting', 'investigation_session', 'file')),
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CHECK (timestamp > 0),
    CHECK (json_valid(old_values) OR old_values IS NULL),
    CHECK (json_valid(new_values) OR new_values IS NULL),
    CHECK (json_valid(session_context) OR session_context IS NULL),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- System log table for application events
CREATE TABLE system_log (
    id TEXT PRIMARY KEY NOT NULL,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT, -- JSON object with detailed information
    source TEXT NOT NULL, -- Component/module that generated the log
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    investigation_id TEXT,
    session_id TEXT,
    user_id TEXT,
    error_code TEXT,
    stack_trace TEXT,
    request_id TEXT, -- For tracing requests across components
    correlation_id TEXT, -- For correlating related events
    hostname TEXT,
    process_id INTEGER,
    thread_id TEXT,
    memory_usage INTEGER, -- MB
    cpu_usage REAL, -- Percentage
    
    -- Constraints
    CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    CHECK (category IN ('application', 'database', 'sensor', 'file_system', 'network', 'security', 'performance', 'user_action', 'system', 'integration')),
    CHECK (timestamp > 0),
    CHECK (memory_usage IS NULL OR memory_usage >= 0),
    CHECK (cpu_usage IS NULL OR (cpu_usage >= 0 AND cpu_usage <= 100)),
    CHECK (json_valid(details) OR details IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Performance monitoring table
CREATE TABLE performance_log (
    id TEXT PRIMARY KEY NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    category TEXT NOT NULL,
    component TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    investigation_id TEXT,
    session_id TEXT,
    user_id TEXT,
    additional_tags TEXT DEFAULT '{}', -- JSON object for custom tags
    threshold_warning REAL,
    threshold_critical REAL,
    is_anomaly BOOLEAN NOT NULL DEFAULT 0,
    anomaly_score REAL, -- 0.0 to 1.0
    
    -- Constraints
    CHECK (category IN ('response_time', 'throughput', 'resource_usage', 'error_rate', 'database_performance', 'sensor_performance', 'user_experience')),
    CHECK (timestamp > 0),
    CHECK (anomaly_score IS NULL OR (anomaly_score >= 0.0 AND anomaly_score <= 1.0)),
    CHECK (json_valid(additional_tags)),
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Database change log for schema migrations and data changes
CREATE TABLE database_changelog (
    id TEXT PRIMARY KEY NOT NULL,
    change_type TEXT NOT NULL,
    description TEXT NOT NULL,
    sql_statement TEXT,
    affected_tables TEXT, -- JSON array of table names
    affected_records INTEGER,
    execution_time_ms INTEGER,
    performed_by TEXT,
    migration_version INTEGER,
    rollback_sql TEXT,
    checksum TEXT, -- Hash of the change for integrity
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    success BOOLEAN NOT NULL DEFAULT 1,
    error_message TEXT,
    
    -- Constraints
    CHECK (change_type IN ('schema_migration', 'data_migration', 'index_creation', 'index_removal', 'trigger_creation', 'trigger_removal', 'view_creation', 'view_update', 'bulk_update', 'bulk_delete')),
    CHECK (timestamp > 0),
    CHECK (affected_records IS NULL OR affected_records >= 0),
    CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0),
    CHECK (migration_version IS NULL OR migration_version > 0),
    CHECK (json_valid(affected_tables) OR affected_tables IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Data integrity monitoring table
CREATE TABLE data_integrity_log (
    id TEXT PRIMARY KEY NOT NULL,
    check_type TEXT NOT NULL,
    table_name TEXT NOT NULL,
    check_description TEXT NOT NULL,
    status TEXT NOT NULL,
    issues_found INTEGER NOT NULL DEFAULT 0,
    records_checked INTEGER,
    check_details TEXT, -- JSON object with detailed results
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    performed_by TEXT,
    automatic_check BOOLEAN NOT NULL DEFAULT 1,
    corrective_action TEXT,
    resolved BOOLEAN NOT NULL DEFAULT 0,
    
    -- Constraints
    CHECK (check_type IN ('foreign_key_integrity', 'constraint_validation', 'data_consistency', 'duplicate_detection', 'orphaned_records', 'checksum_validation', 'schema_compliance')),
    CHECK (status IN ('passed', 'failed', 'warning', 'in_progress', 'cancelled')),
    CHECK (issues_found >= 0),
    CHECK (records_checked IS NULL OR records_checked >= 0),
    CHECK (started_at > 0),
    CHECK (completed_at IS NULL OR completed_at >= started_at),
    CHECK (json_valid(check_details) OR check_details IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Security audit log for security-related events
CREATE TABLE security_audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    user_id TEXT,
    affected_user_id TEXT, -- User affected by the security event
    description TEXT NOT NULL,
    details TEXT, -- JSON object with event details
    ip_address TEXT,
    user_agent TEXT,
    location TEXT, -- JSON: geolocation data if available
    session_id TEXT,
    investigation_id TEXT,
    evidence_id TEXT,
    action_taken TEXT,
    threat_level TEXT,
    false_positive BOOLEAN NOT NULL DEFAULT 0,
    resolved BOOLEAN NOT NULL DEFAULT 0,
    resolved_at INTEGER,
    resolved_by TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (event_type IN ('authentication_failure', 'unauthorized_access', 'privilege_escalation', 'data_breach', 'suspicious_activity', 'malware_detected', 'intrusion_attempt', 'policy_violation', 'data_exfiltration', 'account_compromise')),
    CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    CHECK (threat_level IS NULL OR threat_level IN ('minimal', 'low', 'moderate', 'high', 'severe')),
    CHECK (timestamp > 0),
    CHECK (resolved_at IS NULL OR resolved_at >= timestamp),
    CHECK (json_valid(details) OR details IS NULL),
    CHECK (json_valid(location) OR location IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (affected_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Backup and recovery audit log
CREATE TABLE backup_audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    operation_type TEXT NOT NULL,
    backup_name TEXT,
    backup_type TEXT,
    file_path TEXT,
    file_size INTEGER,
    compression_ratio REAL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN completed_at IS NOT NULL THEN completed_at - started_at
            ELSE NULL
        END
    ) STORED,
    status TEXT NOT NULL DEFAULT 'in_progress',
    records_processed INTEGER,
    tables_included TEXT, -- JSON array
    data_range_start INTEGER, -- For incremental backups
    data_range_end INTEGER,
    performed_by TEXT NOT NULL,
    retention_date INTEGER, -- When backup should be deleted
    verified BOOLEAN NOT NULL DEFAULT 0,
    verification_date INTEGER,
    checksum TEXT,
    error_message TEXT,
    metadata TEXT DEFAULT '{}', -- JSON
    
    -- Constraints
    CHECK (operation_type IN ('full_backup', 'incremental_backup', 'differential_backup', 'restore', 'verification', 'cleanup')),
    CHECK (backup_type IS NULL OR backup_type IN ('full', 'incremental', 'investigation_specific', 'data_only', 'configuration_only')),
    CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled', 'partial')),
    CHECK (started_at > 0),
    CHECK (completed_at IS NULL OR completed_at >= started_at),
    CHECK (file_size IS NULL OR file_size >= 0),
    CHECK (compression_ratio IS NULL OR compression_ratio >= 0),
    CHECK (records_processed IS NULL OR records_processed >= 0),
    CHECK (data_range_start IS NULL OR data_range_start > 0),
    CHECK (data_range_end IS NULL OR data_range_end >= data_range_start),
    CHECK (retention_date IS NULL OR retention_date > started_at),
    CHECK (verification_date IS NULL OR verification_date >= completed_at),
    CHECK (json_valid(tables_included) OR tables_included IS NULL),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- File operations audit log
CREATE TABLE file_audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    operation TEXT NOT NULL,
    file_path TEXT NOT NULL,
    original_name TEXT,
    file_size INTEGER,
    file_hash TEXT, -- SHA-256
    mime_type TEXT,
    user_id TEXT,
    investigation_id TEXT,
    evidence_id TEXT,
    ip_address TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    success BOOLEAN NOT NULL DEFAULT 1,
    error_message TEXT,
    source_path TEXT, -- For move/copy operations
    destination_path TEXT, -- For move/copy operations
    metadata TEXT DEFAULT '{}', -- JSON
    
    -- Constraints
    CHECK (operation IN ('upload', 'download', 'delete', 'move', 'copy', 'rename', 'access', 'modify', 'create_directory', 'remove_directory')),
    CHECK (timestamp > 0),
    CHECK (file_size IS NULL OR file_size >= 0),
    CHECK (file_hash IS NULL OR length(file_hash) = 64), -- SHA-256
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- API access log for external integrations
CREATE TABLE api_audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    api_key_id TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    request_path TEXT NOT NULL,
    query_parameters TEXT, -- JSON
    request_body_size INTEGER,
    response_status INTEGER NOT NULL,
    response_size INTEGER,
    response_time_ms INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT, -- If authenticated via session
    investigation_id TEXT, -- If request relates to specific investigation
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    rate_limited BOOLEAN NOT NULL DEFAULT 0,
    error_message TEXT,
    
    -- Constraints
    CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS')),
    CHECK (response_status >= 100 AND response_status < 600),
    CHECK (request_body_size IS NULL OR request_body_size >= 0),
    CHECK (response_size IS NULL OR response_size >= 0),
    CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
    CHECK (timestamp > 0),
    CHECK (json_valid(query_parameters) OR query_parameters IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (api_key_id) REFERENCES user_api_keys(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Archive and retention log
CREATE TABLE archive_log (
    id TEXT PRIMARY KEY NOT NULL,
    operation_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    archive_reason TEXT NOT NULL,
    archive_date INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    scheduled_deletion_date INTEGER,
    performed_by TEXT NOT NULL,
    file_path TEXT, -- Path to archived data file
    file_size INTEGER,
    compression_used BOOLEAN NOT NULL DEFAULT 0,
    encryption_used BOOLEAN NOT NULL DEFAULT 0,
    metadata_preserved TEXT, -- JSON: key metadata preserved
    retention_policy TEXT,
    legal_hold BOOLEAN NOT NULL DEFAULT 0,
    legal_hold_reason TEXT,
    restoration_count INTEGER NOT NULL DEFAULT 0,
    last_restored_at INTEGER,
    last_restored_by TEXT,
    
    -- Constraints
    CHECK (operation_type IN ('archive', 'restore', 'delete', 'purge', 'legal_hold_apply', 'legal_hold_remove')),
    CHECK (entity_type IN ('investigation', 'evidence', 'sensor_data', 'user_data', 'audit_log', 'backup')),
    CHECK (archive_reason IN ('age_based', 'investigation_completed', 'user_request', 'legal_requirement', 'storage_optimization', 'compliance')),
    CHECK (archive_date > 0),
    CHECK (scheduled_deletion_date IS NULL OR scheduled_deletion_date > archive_date),
    CHECK (file_size IS NULL OR file_size >= 0),
    CHECK (restoration_count >= 0),
    CHECK (last_restored_at IS NULL OR last_restored_at >= archive_date),
    CHECK (json_valid(metadata_preserved) OR metadata_preserved IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (last_restored_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================================
-- INDEXES FOR AUDIT SCHEMA
-- ============================================================================

-- Audit log indexes
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_session_id ON audit_log(session_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_entity_id ON audit_log(entity_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_risk_level ON audit_log(risk_level);
CREATE INDEX idx_audit_success ON audit_log(success);
CREATE INDEX idx_audit_investigation_id ON audit_log(investigation_id);

-- System log indexes
CREATE INDEX idx_system_log_level ON system_log(level);
CREATE INDEX idx_system_log_category ON system_log(category);
CREATE INDEX idx_system_log_timestamp ON system_log(timestamp);
CREATE INDEX idx_system_log_source ON system_log(source);
CREATE INDEX idx_system_log_error_code ON system_log(error_code);
CREATE INDEX idx_system_log_correlation ON system_log(correlation_id);
CREATE INDEX idx_system_log_request ON system_log(request_id);

-- Performance log indexes
CREATE INDEX idx_perf_metric_name ON performance_log(metric_name);
CREATE INDEX idx_perf_category ON performance_log(category);
CREATE INDEX idx_perf_component ON performance_log(component);
CREATE INDEX idx_perf_timestamp ON performance_log(timestamp);
CREATE INDEX idx_perf_anomaly ON performance_log(is_anomaly);
CREATE INDEX idx_perf_value ON performance_log(metric_value);

-- Database changelog indexes
CREATE INDEX idx_db_change_type ON database_changelog(change_type);
CREATE INDEX idx_db_change_timestamp ON database_changelog(timestamp);
CREATE INDEX idx_db_change_performed_by ON database_changelog(performed_by);
CREATE INDEX idx_db_change_version ON database_changelog(migration_version);
CREATE INDEX idx_db_change_success ON database_changelog(success);

-- Data integrity log indexes
CREATE INDEX idx_integrity_check_type ON data_integrity_log(check_type);
CREATE INDEX idx_integrity_table ON data_integrity_log(table_name);
CREATE INDEX idx_integrity_status ON data_integrity_log(status);
CREATE INDEX idx_integrity_started ON data_integrity_log(started_at);
CREATE INDEX idx_integrity_resolved ON data_integrity_log(resolved);

-- Security audit log indexes
CREATE INDEX idx_security_event_type ON security_audit_log(event_type);
CREATE INDEX idx_security_severity ON security_audit_log(severity);
CREATE INDEX idx_security_user_id ON security_audit_log(user_id);
CREATE INDEX idx_security_timestamp ON security_audit_log(timestamp);
CREATE INDEX idx_security_resolved ON security_audit_log(resolved);
CREATE INDEX idx_security_threat_level ON security_audit_log(threat_level);

-- Backup audit log indexes
CREATE INDEX idx_backup_operation ON backup_audit_log(operation_type);
CREATE INDEX idx_backup_type ON backup_audit_log(backup_type);
CREATE INDEX idx_backup_status ON backup_audit_log(status);
CREATE INDEX idx_backup_started ON backup_audit_log(started_at);
CREATE INDEX idx_backup_performed_by ON backup_audit_log(performed_by);
CREATE INDEX idx_backup_retention ON backup_audit_log(retention_date);

-- File audit log indexes
CREATE INDEX idx_file_operation ON file_audit_log(operation);
CREATE INDEX idx_file_path ON file_audit_log(file_path);
CREATE INDEX idx_file_user_id ON file_audit_log(user_id);
CREATE INDEX idx_file_timestamp ON file_audit_log(timestamp);
CREATE INDEX idx_file_hash ON file_audit_log(file_hash);
CREATE INDEX idx_file_investigation ON file_audit_log(investigation_id);
CREATE INDEX idx_file_evidence ON file_audit_log(evidence_id);

-- API audit log indexes
CREATE INDEX idx_api_endpoint ON api_audit_log(endpoint);
CREATE INDEX idx_api_method ON api_audit_log(method);
CREATE INDEX idx_api_status ON api_audit_log(response_status);
CREATE INDEX idx_api_timestamp ON api_audit_log(timestamp);
CREATE INDEX idx_api_key_id ON api_audit_log(api_key_id);
CREATE INDEX idx_api_user_id ON api_audit_log(user_id);
CREATE INDEX idx_api_rate_limited ON api_audit_log(rate_limited);

-- Archive log indexes
CREATE INDEX idx_archive_operation ON archive_log(operation_type);
CREATE INDEX idx_archive_entity_type ON archive_log(entity_type);
CREATE INDEX idx_archive_entity_id ON archive_log(entity_id);
CREATE INDEX idx_archive_date ON archive_log(archive_date);
CREATE INDEX idx_archive_deletion_date ON archive_log(scheduled_deletion_date);
CREATE INDEX idx_archive_legal_hold ON archive_log(legal_hold);
CREATE INDEX idx_archive_performed_by ON archive_log(performed_by);

-- ============================================================================
-- TRIGGERS FOR AUDIT SCHEMA
-- ============================================================================

-- Auto-purge old audit logs (keep last 2 years by default)
CREATE TRIGGER trg_audit_log_purge
    AFTER INSERT ON audit_log
    FOR EACH ROW
    WHEN (SELECT COUNT(*) FROM audit_log) % 10000 = 0 -- Check every 10k inserts
BEGIN
    DELETE FROM audit_log 
    WHERE timestamp < strftime('%s', 'now') - 63072000 -- 2 years
    AND risk_level = 'low'
    LIMIT 1000;
END;

-- Auto-purge old system logs (keep last 6 months by default)
CREATE TRIGGER trg_system_log_purge
    AFTER INSERT ON system_log
    FOR EACH ROW
    WHEN (SELECT COUNT(*) FROM system_log) % 5000 = 0 -- Check every 5k inserts
BEGIN
    DELETE FROM system_log 
    WHERE timestamp < strftime('%s', 'now') - 15552000 -- 6 months
    AND level IN ('debug', 'info')
    LIMIT 1000;
END;

-- Auto-create security audit entry for high-risk audit events
CREATE TRIGGER trg_security_audit_from_audit
    AFTER INSERT ON audit_log
    FOR EACH ROW
    WHEN NEW.risk_level = 'critical' OR NEW.action IN ('permission_change', 'password_change')
BEGIN
    INSERT INTO security_audit_log (
        id, event_type, severity, user_id, description, session_id, 
        investigation_id, timestamp
    ) VALUES (
        'sec_audit_' || NEW.id,
        CASE 
            WHEN NEW.action = 'permission_change' THEN 'privilege_escalation'
            WHEN NEW.action = 'password_change' THEN 'authentication_failure'
            ELSE 'suspicious_activity'
        END,
        CASE NEW.risk_level
            WHEN 'critical' THEN 'critical'
            WHEN 'high' THEN 'high'
            ELSE 'medium'
        END,
        NEW.user_id,
        'High-risk action detected: ' || NEW.action || ' on ' || NEW.entity_type,
        NEW.session_id,
        NEW.investigation_id,
        NEW.timestamp
    );
END;

-- Create performance alert for slow operations
CREATE TRIGGER trg_performance_alert
    AFTER INSERT ON performance_log
    FOR EACH ROW
    WHEN NEW.category = 'response_time' 
    AND NEW.threshold_critical IS NOT NULL 
    AND NEW.metric_value > NEW.threshold_critical
BEGIN
    INSERT INTO system_log (
        id, level, category, message, details, source, user_id, investigation_id
    ) VALUES (
        'perf_alert_' || NEW.id,
        'warn',
        'performance',
        'Performance threshold exceeded: ' || NEW.metric_name,
        json_object(
            'metric_value', NEW.metric_value,
            'threshold', NEW.threshold_critical,
            'component', NEW.component
        ),
        'performance_monitor',
        NEW.user_id,
        NEW.investigation_id
    );
END;

-- Auto-create backup verification tasks
CREATE TRIGGER trg_backup_verification_schedule
    AFTER INSERT ON backup_audit_log
    FOR EACH ROW
    WHEN NEW.operation_type IN ('full_backup', 'incremental_backup') 
    AND NEW.status = 'completed'
BEGIN
    INSERT INTO backup_audit_log (
        id, operation_type, backup_name, file_path, started_at, 
        status, performed_by, metadata
    ) VALUES (
        'verify_' || NEW.id,
        'verification',
        NEW.backup_name,
        NEW.file_path,
        strftime('%s', 'now') + 86400, -- Schedule verification for tomorrow
        'in_progress',
        'system',
        json_object('parent_backup_id', NEW.id)
    );
END;

-- ============================================================================
-- VIEWS FOR AUDIT SCHEMA
-- ============================================================================

-- Recent audit activity view
CREATE VIEW vw_recent_audit_activity AS
SELECT 
    al.timestamp,
    al.action,
    al.entity_type,
    al.entity_id,
    u.username,
    al.ip_address,
    al.success,
    al.risk_level,
    i.name as investigation_name
FROM audit_log al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN investigations i ON al.investigation_id = i.id
WHERE al.timestamp > strftime('%s', 'now') - 86400 -- Last 24 hours
ORDER BY al.timestamp DESC;

-- Security events summary view
CREATE VIEW vw_security_events_summary AS
SELECT 
    sal.event_type,
    sal.severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT sal.user_id) as affected_users,
    COUNT(CASE WHEN sal.resolved = 0 THEN 1 END) as unresolved_count,
    MIN(sal.timestamp) as first_occurrence,
    MAX(sal.timestamp) as last_occurrence
FROM security_audit_log sal
WHERE sal.timestamp > strftime('%s', 'now') - 2592000 -- Last 30 days
GROUP BY sal.event_type, sal.severity
ORDER BY event_count DESC;

-- System health indicators view
CREATE VIEW vw_system_health_indicators AS
SELECT 
    'error_rate' as metric,
    COUNT(CASE WHEN sl.level = 'error' THEN 1 END) * 100.0 / COUNT(*) as current_value,
    5.0 as warning_threshold,
    10.0 as critical_threshold,
    '%' as unit
FROM system_log sl
WHERE sl.timestamp > strftime('%s', 'now') - 3600 -- Last hour

UNION ALL

SELECT 
    'avg_response_time' as metric,
    AVG(pl.metric_value) as current_value,
    1000.0 as warning_threshold,
    2000.0 as critical_threshold,
    'ms' as unit
FROM performance_log pl
WHERE pl.metric_name = 'response_time' 
AND pl.timestamp > strftime('%s', 'now') - 3600 -- Last hour

UNION ALL

SELECT 
    'failed_backups' as metric,
    COUNT(CASE WHEN bal.status = 'failed' THEN 1 END) as current_value,
    0 as warning_threshold,
    1 as critical_threshold,
    'count' as unit
FROM backup_audit_log bal
WHERE bal.started_at > strftime('%s', 'now') - 86400; -- Last 24 hours

-- User activity patterns view
CREATE VIEW vw_user_activity_patterns AS
SELECT 
    u.username,
    COUNT(DISTINCT DATE(al.timestamp, 'unixepoch')) as active_days,
    COUNT(al.id) as total_actions,
    COUNT(CASE WHEN al.action = 'create' THEN 1 END) as create_actions,
    COUNT(CASE WHEN al.action = 'update' THEN 1 END) as update_actions,
    COUNT(CASE WHEN al.action = 'delete' THEN 1 END) as delete_actions,
    COUNT(CASE WHEN al.risk_level IN ('high', 'critical') THEN 1 END) as high_risk_actions,
    MIN(al.timestamp) as first_activity,
    MAX(al.timestamp) as last_activity
FROM users u
LEFT JOIN audit_log al ON u.id = al.user_id
WHERE al.timestamp > strftime('%s', 'now') - 2592000 -- Last 30 days
GROUP BY u.id, u.username
ORDER BY total_actions DESC;

-- Investigation audit trail view
CREATE VIEW vw_investigation_audit_trail AS
SELECT 
    i.name as investigation_name,
    al.timestamp,
    al.action,
    al.entity_type,
    u.full_name as performed_by,
    al.old_values,
    al.new_values,
    al.success
FROM investigations i
INNER JOIN audit_log al ON i.id = al.investigation_id
LEFT JOIN users u ON al.user_id = u.id
ORDER BY i.name, al.timestamp DESC;