-- ============================================================================
-- USER PREFERENCES AND SETTINGS SCHEMA
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
    emergency_contact TEXT, -- JSON: {name, phone, relationship, etc}
    avatar_path TEXT,
    bio TEXT,
    preferences TEXT DEFAULT '{}', -- JSON object for complex preferences
    permissions TEXT DEFAULT '[]', -- JSON array of permission strings
    security_settings TEXT DEFAULT '{}', -- JSON: 2FA, session timeout, etc
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
    
    -- Constraints
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
    CHECK (length(password_hash) = 64), -- SHA-256 hash
    CHECK (length(salt) >= 16),
    
    -- Foreign Keys
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- User preferences table (for structured preferences)
CREATE TABLE user_preferences (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'string',
    is_encrypted BOOLEAN NOT NULL DEFAULT 0,
    description TEXT,
    default_value TEXT,
    validation_rule TEXT, -- JSON schema or regex
    ui_component TEXT, -- hint for UI rendering
    display_order INTEGER DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT 0, -- System vs user-defined
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (category IN ('ui_settings', 'notification_settings', 'sensor_settings', 'display_settings', 'export_settings', 'privacy_settings', 'workspace_settings', 'security_settings', 'integration_settings')),
    CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'encrypted', 'color', 'font', 'file_path')),
    CHECK (key != ''),
    CHECK (value != ''),
    CHECK (display_order >= 0),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(user_id, category, key)
);

-- User sessions table
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    device_fingerprint TEXT,
    device_info TEXT, -- JSON: OS, browser, screen resolution, etc
    geolocation TEXT, -- JSON: {lat, lng, city, country}
    login_time INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_activity INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    logout_time INTEGER,
    session_duration INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN logout_time IS NOT NULL THEN logout_time - login_time
            ELSE strftime('%s', 'now') - login_time
        END
    ) STORED,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    logout_reason TEXT,
    session_type TEXT NOT NULL DEFAULT 'web',
    remember_me BOOLEAN NOT NULL DEFAULT 0,
    expires_at INTEGER,
    
    -- Constraints
    CHECK (login_time > 0),
    CHECK (last_activity >= login_time),
    CHECK (logout_time IS NULL OR logout_time >= login_time),
    CHECK (logout_reason IS NULL OR logout_reason IN ('user_logout', 'timeout', 'forced_logout', 'security_breach', 'session_expired')),
    CHECK (session_type IN ('web', 'api', 'mobile', 'desktop')),
    CHECK (expires_at IS NULL OR expires_at > login_time),
    CHECK (json_valid(device_info) OR device_info IS NULL),
    CHECK (json_valid(geolocation) OR geolocation IS NULL),
    CHECK (length(session_token) >= 32),
    CHECK (refresh_token IS NULL OR length(refresh_token) >= 32),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- User notifications table
CREATE TABLE user_notifications (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    channel TEXT NOT NULL DEFAULT 'in_app',
    status TEXT NOT NULL DEFAULT 'unread',
    action_url TEXT,
    action_data TEXT, -- JSON
    investigation_id TEXT,
    evidence_id TEXT,
    sensor_id TEXT,
    expires_at INTEGER,
    sent_at INTEGER,
    read_at INTEGER,
    acknowledged_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (notification_type IN ('info', 'warning', 'error', 'success', 'alert', 'reminder', 'system', 'investigation', 'evidence', 'sensor')),
    CHECK (category IN ('system', 'investigation', 'evidence', 'sensor', 'user', 'security', 'maintenance')),
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CHECK (channel IN ('in_app', 'email', 'sms', 'push', 'webhook')),
    CHECK (status IN ('unread', 'read', 'acknowledged', 'dismissed', 'expired')),
    CHECK (expires_at IS NULL OR expires_at > created_at),
    CHECK (sent_at IS NULL OR sent_at >= created_at),
    CHECK (read_at IS NULL OR read_at >= created_at),
    CHECK (acknowledged_at IS NULL OR acknowledged_at >= created_at),
    CHECK (json_valid(action_data) OR action_data IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- User activity log table
CREATE TABLE user_activity_log (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT,
    activity_type TEXT NOT NULL,
    activity_category TEXT NOT NULL,
    description TEXT NOT NULL,
    details TEXT, -- JSON with activity-specific details
    entity_type TEXT,
    entity_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    duration_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT 1,
    error_message TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (activity_type IN ('login', 'logout', 'view', 'create', 'update', 'delete', 'search', 'export', 'import', 'upload', 'download', 'print', 'share', 'analyze')),
    CHECK (activity_category IN ('authentication', 'investigation', 'evidence', 'sensor', 'user_management', 'system', 'file_operation', 'data_analysis')),
    CHECK (entity_type IS NULL OR entity_type IN ('investigation', 'evidence', 'sensor', 'user', 'file', 'report', 'session')),
    CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CHECK (timestamp > 0),
    CHECK (json_valid(details) OR details IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- User workspace layouts table
CREATE TABLE user_workspace_layouts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    layout_name TEXT NOT NULL,
    layout_type TEXT NOT NULL DEFAULT 'custom',
    is_default BOOLEAN NOT NULL DEFAULT 0,
    display_count INTEGER NOT NULL DEFAULT 1,
    layout_data TEXT NOT NULL, -- JSON: complete layout configuration
    preview_image TEXT, -- Base64 or file path
    description TEXT,
    tags TEXT DEFAULT '[]', -- JSON array
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used INTEGER,
    is_shared BOOLEAN NOT NULL DEFAULT 0,
    shared_with TEXT DEFAULT '[]', -- JSON array of user IDs
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (layout_type IN ('custom', 'template', 'shared', 'system')),
    CHECK (display_count >= 1 AND display_count <= 8),
    CHECK (usage_count >= 0),
    CHECK (last_used IS NULL OR last_used >= created_at),
    CHECK (json_valid(layout_data)),
    CHECK (json_valid(tags)),
    CHECK (json_valid(shared_with)),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(user_id, layout_name)
);

-- User API keys table
CREATE TABLE user_api_keys (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    key_name TEXT NOT NULL,
    api_key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL, -- First 8 chars for identification
    permissions TEXT DEFAULT '[]', -- JSON array of allowed operations
    rate_limit_per_hour INTEGER DEFAULT 1000,
    allowed_ips TEXT DEFAULT '[]', -- JSON array of IP addresses/ranges
    is_active BOOLEAN NOT NULL DEFAULT 1,
    expires_at INTEGER,
    last_used INTEGER,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    revoked_at INTEGER,
    revoked_by TEXT,
    revoke_reason TEXT,
    
    -- Constraints
    CHECK (length(api_key_hash) = 64), -- SHA-256 hash
    CHECK (length(key_prefix) = 8),
    CHECK (rate_limit_per_hour > 0),
    CHECK (expires_at IS NULL OR expires_at > created_at),
    CHECK (last_used IS NULL OR last_used >= created_at),
    CHECK (usage_count >= 0),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at),
    CHECK (json_valid(permissions)),
    CHECK (json_valid(allowed_ips)),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(user_id, key_name)
);

-- User security events table
CREATE TABLE user_security_events (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    description TEXT NOT NULL,
    details TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    location TEXT, -- JSON: geolocation data
    session_id TEXT,
    action_taken TEXT,
    resolved BOOLEAN NOT NULL DEFAULT 0,
    resolved_at INTEGER,
    resolved_by TEXT,
    false_positive BOOLEAN NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (event_type IN ('failed_login', 'suspicious_login', 'password_change', 'email_change', 'permission_escalation', 'unusual_activity', 'account_locked', 'session_hijacked', 'api_abuse')),
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CHECK (resolved_at IS NULL OR resolved_at >= timestamp),
    CHECK (json_valid(details) OR details IS NULL),
    CHECK (json_valid(location) OR location IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- User groups/teams table
CREATE TABLE user_groups (
    id TEXT PRIMARY KEY NOT NULL,
    group_name TEXT UNIQUE NOT NULL,
    group_type TEXT NOT NULL DEFAULT 'team',
    description TEXT,
    permissions TEXT DEFAULT '[]', -- JSON array of group permissions
    max_members INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    
    -- Constraints
    CHECK (group_type IN ('team', 'department', 'project', 'role_based', 'temporary')),
    CHECK (max_members IS NULL OR max_members > 0),
    CHECK (json_valid(permissions)),
    CHECK (length(group_name) >= 2 AND length(group_name) <= 100),
    
    -- Foreign Keys
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- User group memberships table
CREATE TABLE user_group_memberships (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    permissions TEXT DEFAULT '[]', -- JSON array of user-specific permissions within group
    joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    added_by TEXT NOT NULL,
    left_at INTEGER,
    removed_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    
    -- Constraints
    CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'viewer')),
    CHECK (joined_at > 0),
    CHECK (left_at IS NULL OR left_at >= joined_at),
    CHECK (json_valid(permissions)),
    
    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (removed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(user_id, group_id, is_active) WHERE is_active = 1
);

-- System settings table (global application settings)
CREATE TABLE system_settings (
    id TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    data_type TEXT NOT NULL DEFAULT 'string',
    description TEXT NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT 0,
    requires_restart BOOLEAN NOT NULL DEFAULT 0,
    validation_rule TEXT, -- JSON schema or regex
    default_value TEXT,
    min_value REAL,
    max_value REAL,
    allowed_values TEXT, -- JSON array for enum-like settings
    ui_component TEXT,
    display_order INTEGER DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT 1, -- vs user-configurable
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_by TEXT NOT NULL,
    
    -- Constraints
    CHECK (category IN ('database', 'security', 'sensor', 'file_storage', 'notification', 'backup', 'integration', 'ui', 'performance', 'logging', 'email', 'api')),
    CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'password', 'path', 'url', 'email', 'color')),
    CHECK (key != ''),
    CHECK (value != ''),
    CHECK (display_order >= 0),
    CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value),
    CHECK (json_valid(allowed_values) OR allowed_values IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(category, key)
);

-- ============================================================================
-- INDEXES FOR USERS SCHEMA
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(account_status);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_organization ON users(organization);
CREATE INDEX idx_users_last_login ON users(last_login);
CREATE INDEX idx_users_created_by ON users(created_by);
CREATE INDEX idx_users_email_verified ON users(email_verified);

-- User preferences indexes
CREATE INDEX idx_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_preferences_category ON user_preferences(category);
CREATE INDEX idx_preferences_key ON user_preferences(key);
CREATE INDEX idx_preferences_system ON user_preferences(is_system);

-- User sessions indexes
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_active ON user_sessions(is_active);
CREATE INDEX idx_sessions_ip ON user_sessions(ip_address);
CREATE INDEX idx_sessions_login_time ON user_sessions(login_time);
CREATE INDEX idx_sessions_last_activity ON user_sessions(last_activity);

-- User notifications indexes
CREATE INDEX idx_notifications_user_id ON user_notifications(user_id);
CREATE INDEX idx_notifications_status ON user_notifications(status);
CREATE INDEX idx_notifications_type ON user_notifications(notification_type);
CREATE INDEX idx_notifications_category ON user_notifications(category);
CREATE INDEX idx_notifications_priority ON user_notifications(priority);
CREATE INDEX idx_notifications_created_at ON user_notifications(created_at);
CREATE INDEX idx_notifications_investigation ON user_notifications(investigation_id);

-- User activity log indexes
CREATE INDEX idx_activity_user_id ON user_activity_log(user_id);
CREATE INDEX idx_activity_session_id ON user_activity_log(session_id);
CREATE INDEX idx_activity_type ON user_activity_log(activity_type);
CREATE INDEX idx_activity_category ON user_activity_log(activity_category);
CREATE INDEX idx_activity_timestamp ON user_activity_log(timestamp);
CREATE INDEX idx_activity_success ON user_activity_log(success);
CREATE INDEX idx_activity_entity ON user_activity_log(entity_type, entity_id);

-- Workspace layouts indexes
CREATE INDEX idx_workspace_user_id ON user_workspace_layouts(user_id);
CREATE INDEX idx_workspace_type ON user_workspace_layouts(layout_type);
CREATE INDEX idx_workspace_default ON user_workspace_layouts(is_default);
CREATE INDEX idx_workspace_shared ON user_workspace_layouts(is_shared);
CREATE INDEX idx_workspace_usage ON user_workspace_layouts(usage_count);

-- API keys indexes
CREATE INDEX idx_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON user_api_keys(api_key_hash);
CREATE INDEX idx_api_keys_prefix ON user_api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON user_api_keys(is_active);
CREATE INDEX idx_api_keys_expires ON user_api_keys(expires_at);

-- Security events indexes
CREATE INDEX idx_security_user_id ON user_security_events(user_id);
CREATE INDEX idx_security_type ON user_security_events(event_type);
CREATE INDEX idx_security_severity ON user_security_events(severity);
CREATE INDEX idx_security_timestamp ON user_security_events(timestamp);
CREATE INDEX idx_security_resolved ON user_security_events(resolved);

-- User groups indexes
CREATE INDEX idx_groups_name ON user_groups(group_name);
CREATE INDEX idx_groups_type ON user_groups(group_type);
CREATE INDEX idx_groups_active ON user_groups(is_active);
CREATE INDEX idx_groups_created_by ON user_groups(created_by);

-- Group memberships indexes
CREATE INDEX idx_memberships_user_id ON user_group_memberships(user_id);
CREATE INDEX idx_memberships_group_id ON user_group_memberships(group_id);
CREATE INDEX idx_memberships_role ON user_group_memberships(role);
CREATE INDEX idx_memberships_active ON user_group_memberships(is_active);

-- System settings indexes
CREATE INDEX idx_settings_category ON system_settings(category);
CREATE INDEX idx_settings_key ON system_settings(key);
CREATE INDEX idx_settings_system ON system_settings(is_system);
CREATE INDEX idx_settings_updated_by ON system_settings(updated_by);

-- ============================================================================
-- TRIGGERS FOR USERS SCHEMA
-- ============================================================================

-- Update timestamp triggers
CREATE TRIGGER trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_preferences_updated_at
    AFTER UPDATE ON user_preferences
    FOR EACH ROW
BEGIN
    UPDATE user_preferences 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_workspace_updated_at
    AFTER UPDATE ON user_workspace_layouts
    FOR EACH ROW
BEGIN
    UPDATE user_workspace_layouts 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_groups_updated_at
    AFTER UPDATE ON user_groups
    FOR EACH ROW
BEGIN
    UPDATE user_groups 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER trg_settings_updated_at
    AFTER UPDATE ON system_settings
    FOR EACH ROW
BEGIN
    UPDATE system_settings 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Update last activity on session access
CREATE TRIGGER trg_session_activity
    AFTER UPDATE ON user_sessions
    FOR EACH ROW
    WHEN OLD.last_activity != NEW.last_activity
BEGIN
    UPDATE user_sessions 
    SET last_activity = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Auto-expire sessions
CREATE TRIGGER trg_session_expire
    AFTER UPDATE ON user_sessions
    FOR EACH ROW
    WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at < strftime('%s', 'now')
BEGIN
    UPDATE user_sessions 
    SET 
        is_active = 0,
        logout_time = strftime('%s', 'now'),
        logout_reason = 'session_expired'
    WHERE id = NEW.id;
END;

-- Lock user account after failed login attempts
CREATE TRIGGER trg_user_lockout
    AFTER UPDATE OF failed_login_attempts ON users
    FOR EACH ROW
    WHEN NEW.failed_login_attempts >= 5 AND OLD.failed_login_attempts < 5
BEGIN
    UPDATE users 
    SET 
        account_status = 'locked',
        locked_until = strftime('%s', 'now') + 1800 -- 30 minutes
    WHERE id = NEW.id;
    
    INSERT INTO user_security_events (
        id, user_id, event_type, severity, description
    ) VALUES (
        'lockout_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.id,
        'account_locked',
        'high',
        'Account locked due to too many failed login attempts'
    );
END;

-- Create security event for password changes
CREATE TRIGGER trg_password_change_event
    AFTER UPDATE OF password_hash ON users
    FOR EACH ROW
    WHEN OLD.password_hash != NEW.password_hash
BEGIN
    INSERT INTO user_security_events (
        id, user_id, event_type, severity, description
    ) VALUES (
        'pwd_change_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.id,
        'password_change',
        'medium',
        'User password was changed'
    );
    
    UPDATE users 
    SET password_changed_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Auto-expire notifications
CREATE TRIGGER trg_notification_expire
    AFTER UPDATE ON user_notifications
    FOR EACH ROW
    WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at < strftime('%s', 'now') AND NEW.status != 'expired'
BEGIN
    UPDATE user_notifications 
    SET status = 'expired'
    WHERE id = NEW.id;
END;

-- Ensure only one default workspace layout per user
CREATE TRIGGER trg_workspace_default_unique
    BEFORE UPDATE OF is_default ON user_workspace_layouts
    FOR EACH ROW
    WHEN NEW.is_default = 1 AND OLD.is_default = 0
BEGIN
    UPDATE user_workspace_layouts 
    SET is_default = 0 
    WHERE user_id = NEW.user_id AND id != NEW.id;
END;

-- ============================================================================
-- VIEWS FOR USERS SCHEMA
-- ============================================================================

-- Active users view
CREATE VIEW vw_active_users AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.role,
    u.department,
    u.organization,
    u.last_login,
    u.account_status,
    COUNT(DISTINCT us.id) as active_sessions,
    COUNT(DISTINCT itm.investigation_id) as active_investigations,
    MAX(us.last_activity) as last_session_activity
FROM users u
LEFT JOIN user_sessions us ON u.id = us.user_id AND us.is_active = 1
LEFT JOIN investigation_team_members itm ON u.id = itm.user_id AND itm.is_active = 1
WHERE u.account_status = 'active'
GROUP BY u.id;

-- User security summary view
CREATE VIEW vw_user_security_summary AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.full_name,
    u.failed_login_attempts,
    u.locked_until,
    u.password_changed_at,
    u.email_verified,
    COUNT(DISTINCT CASE WHEN use.severity IN ('high', 'critical') THEN use.id END) as high_risk_events,
    COUNT(DISTINCT CASE WHEN use.resolved = 0 THEN use.id END) as unresolved_events,
    MAX(use.timestamp) as last_security_event,
    COUNT(DISTINCT uak.id) as active_api_keys
FROM users u
LEFT JOIN user_security_events use ON u.id = use.user_id
LEFT JOIN user_api_keys uak ON u.id = uak.user_id AND uak.is_active = 1
GROUP BY u.id;

-- User activity summary view
CREATE VIEW vw_user_activity_summary AS
SELECT 
    u.id,
    u.username,
    u.full_name,
    COUNT(DISTINCT DATE(ual.timestamp, 'unixepoch')) as active_days_last_30,
    COUNT(DISTINCT ual.id) as total_activities_last_30,
    COUNT(DISTINCT CASE WHEN ual.activity_type = 'login' THEN ual.id END) as login_count_last_30,
    AVG(ual.duration_ms) as avg_activity_duration,
    MAX(ual.timestamp) as last_activity
FROM users u
LEFT JOIN user_activity_log ual ON u.id = ual.user_id 
    AND ual.timestamp > strftime('%s', 'now') - 2592000 -- 30 days
GROUP BY u.id;

-- Workspace layouts summary view
CREATE VIEW vw_workspace_summary AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(DISTINCT uwl.id) as total_layouts,
    COUNT(DISTINCT CASE WHEN uwl.is_default = 1 THEN uwl.id END) as default_layouts,
    COUNT(DISTINCT CASE WHEN uwl.is_shared = 1 THEN uwl.id END) as shared_layouts,
    SUM(uwl.usage_count) as total_usage_count,
    MAX(uwl.last_used) as last_layout_used
FROM users u
LEFT JOIN user_workspace_layouts uwl ON u.id = uwl.user_id
GROUP BY u.id;

-- User notifications summary view
CREATE VIEW vw_user_notifications_summary AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(DISTINCT CASE WHEN un.status = 'unread' THEN un.id END) as unread_count,
    COUNT(DISTINCT CASE WHEN un.priority IN ('high', 'urgent') THEN un.id END) as high_priority_count,
    COUNT(DISTINCT CASE WHEN un.notification_type = 'alert' THEN un.id END) as alert_count,
    MAX(un.created_at) as latest_notification
FROM users u
LEFT JOIN user_notifications un ON u.id = un.user_id 
    AND un.status != 'expired'
    AND (un.expires_at IS NULL OR un.expires_at > strftime('%s', 'now'))
GROUP BY u.id;