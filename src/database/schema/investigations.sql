-- ============================================================================
-- INVESTIGATIONS AND CASES SCHEMA
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
    coordinates TEXT, -- JSON: {lat, lng, accuracy}
    start_date INTEGER NOT NULL, -- Unix timestamp
    end_date INTEGER,
    estimated_duration INTEGER, -- minutes
    tags TEXT DEFAULT '[]', -- JSON array
    metadata TEXT DEFAULT '{}', -- JSON object
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT 0,
    archived_at INTEGER,
    
    -- Constraints
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
    CHECK (json_valid(coordinates) OR coordinates IS NULL)
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
    coordinates TEXT, -- JSON
    weather_conditions TEXT,
    equipment_used TEXT DEFAULT '[]', -- JSON array
    team_members TEXT DEFAULT '[]', -- JSON array
    objectives TEXT DEFAULT '[]', -- JSON array
    findings_summary TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    
    -- Constraints
    CHECK (status IN ('planned', 'in_progress', 'paused', 'completed', 'aborted')),
    CHECK (start_time > 0),
    CHECK (end_time IS NULL OR end_time > start_time),
    CHECK (session_number > 0),
    CHECK (json_valid(equipment_used)),
    CHECK (json_valid(team_members)),
    CHECK (json_valid(objectives)),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    
    -- Foreign Key
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(investigation_id, session_number)
);

-- Investigation team members table
CREATE TABLE investigation_team_members (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'investigator',
    permissions TEXT DEFAULT '[]', -- JSON array
    assigned_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    assigned_by TEXT NOT NULL,
    removed_at INTEGER,
    removed_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    
    -- Constraints
    CHECK (role IN ('lead_investigator', 'investigator', 'technical_specialist', 'observer', 'consultant')),
    CHECK (assigned_at > 0),
    CHECK (removed_at IS NULL OR removed_at >= assigned_at),
    CHECK (json_valid(permissions)),
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (removed_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    
    -- Unique constraint - one active role per user per investigation
    UNIQUE(investigation_id, user_id, is_active) WHERE is_active = 1
);

-- Investigation milestones/checkpoints
CREATE TABLE investigation_milestones (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_date INTEGER,
    completed_date INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    completion_percentage INTEGER NOT NULL DEFAULT 0,
    assigned_to TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    
    -- Constraints
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'on_hold')),
    CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    CHECK (target_date IS NULL OR target_date > 0),
    CHECK (completed_date IS NULL OR completed_date > 0),
    CHECK (completed_date IS NULL OR target_date IS NULL OR completed_date >= target_date - 86400), -- Allow 1 day tolerance
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Investigation locations (for multi-location investigations)
CREATE TABLE investigation_locations (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    coordinates TEXT, -- JSON: {lat, lng, accuracy, elevation}
    location_type TEXT NOT NULL DEFAULT 'primary',
    access_notes TEXT,
    contact_info TEXT, -- JSON: {name, phone, email, etc}
    visit_count INTEGER NOT NULL DEFAULT 0,
    last_visit INTEGER,
    risk_level TEXT NOT NULL DEFAULT 'low',
    equipment_requirements TEXT DEFAULT '[]', -- JSON array
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    
    -- Constraints
    CHECK (location_type IN ('primary', 'secondary', 'reference', 'control', 'staging')),
    CHECK (visit_count >= 0),
    CHECK (last_visit IS NULL OR last_visit > 0),
    CHECK (risk_level IN ('low', 'medium', 'high', 'extreme')),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    CHECK (json_valid(contact_info) OR contact_info IS NULL),
    CHECK (json_valid(equipment_requirements)),
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Investigation hypotheses and theories
CREATE TABLE investigation_hypotheses (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    hypothesis_type TEXT NOT NULL DEFAULT 'working',
    confidence_level INTEGER NOT NULL DEFAULT 50,
    supporting_evidence TEXT DEFAULT '[]', -- JSON array of evidence IDs
    contradicting_evidence TEXT DEFAULT '[]', -- JSON array of evidence IDs
    status TEXT NOT NULL DEFAULT 'active',
    proposed_by TEXT NOT NULL,
    proposed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_reviewed INTEGER,
    reviewed_by TEXT,
    notes TEXT,
    tags TEXT DEFAULT '[]', -- JSON array
    
    -- Constraints
    CHECK (hypothesis_type IN ('working', 'alternative', 'null', 'backup')),
    CHECK (confidence_level >= 0 AND confidence_level <= 100),
    CHECK (status IN ('active', 'testing', 'supported', 'refuted', 'archived')),
    CHECK (proposed_at > 0),
    CHECK (last_reviewed IS NULL OR last_reviewed >= proposed_at),
    CHECK (json_valid(supporting_evidence)),
    CHECK (json_valid(contradicting_evidence)),
    CHECK (json_valid(tags)),
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (proposed_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Investigation reports and findings
CREATE TABLE investigation_reports (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'progress',
    title TEXT NOT NULL,
    summary TEXT,
    detailed_findings TEXT,
    conclusions TEXT,
    recommendations TEXT,
    methodology TEXT,
    limitations TEXT,
    confidence_assessment TEXT,
    report_status TEXT NOT NULL DEFAULT 'draft',
    version_number INTEGER NOT NULL DEFAULT 1,
    authored_by TEXT NOT NULL,
    reviewed_by TEXT,
    approved_by TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    reviewed_at INTEGER,
    approved_at INTEGER,
    published_at INTEGER,
    file_path TEXT,
    file_size INTEGER,
    page_count INTEGER,
    metadata TEXT DEFAULT '{}', -- JSON
    
    -- Constraints
    CHECK (report_type IN ('progress', 'interim', 'final', 'summary', 'technical', 'peer_review')),
    CHECK (report_status IN ('draft', 'review', 'approved', 'published', 'archived')),
    CHECK (version_number > 0),
    CHECK (created_at > 0),
    CHECK (reviewed_at IS NULL OR reviewed_at >= created_at),
    CHECK (approved_at IS NULL OR approved_at >= created_at),
    CHECK (published_at IS NULL OR published_at >= created_at),
    CHECK (file_size IS NULL OR file_size > 0),
    CHECK (page_count IS NULL OR page_count > 0),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (authored_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================================
-- INDEXES FOR INVESTIGATIONS SCHEMA
-- ============================================================================

-- Investigations indexes
CREATE INDEX idx_investigations_status ON investigations(status);
CREATE INDEX idx_investigations_priority ON investigations(priority);
CREATE INDEX idx_investigations_assigned_to ON investigations(assigned_to);
CREATE INDEX idx_investigations_case_number ON investigations(case_number);
CREATE INDEX idx_investigations_created_by ON investigations(created_by);
CREATE INDEX idx_investigations_dates ON investigations(start_date, end_date);
CREATE INDEX idx_investigations_archived ON investigations(archived, archived_at);
CREATE INDEX idx_investigations_updated ON investigations(updated_at);

-- Investigation sessions indexes
CREATE INDEX idx_sessions_investigation_id ON investigation_sessions(investigation_id);
CREATE INDEX idx_sessions_status ON investigation_sessions(status);
CREATE INDEX idx_sessions_dates ON investigation_sessions(start_time, end_time);
CREATE INDEX idx_sessions_session_number ON investigation_sessions(investigation_id, session_number);

-- Team members indexes
CREATE INDEX idx_team_investigation_id ON investigation_team_members(investigation_id);
CREATE INDEX idx_team_user_id ON investigation_team_members(user_id);
CREATE INDEX idx_team_role ON investigation_team_members(role);
CREATE INDEX idx_team_active ON investigation_team_members(is_active);
CREATE INDEX idx_team_assigned ON investigation_team_members(assigned_at);

-- Milestones indexes
CREATE INDEX idx_milestones_investigation_id ON investigation_milestones(investigation_id);
CREATE INDEX idx_milestones_status ON investigation_milestones(status);
CREATE INDEX idx_milestones_target_date ON investigation_milestones(target_date);
CREATE INDEX idx_milestones_assigned_to ON investigation_milestones(assigned_to);

-- Locations indexes
CREATE INDEX idx_locations_investigation_id ON investigation_locations(investigation_id);
CREATE INDEX idx_locations_type ON investigation_locations(location_type);
CREATE INDEX idx_locations_risk_level ON investigation_locations(risk_level);
CREATE INDEX idx_locations_last_visit ON investigation_locations(last_visit);

-- Hypotheses indexes
CREATE INDEX idx_hypotheses_investigation_id ON investigation_hypotheses(investigation_id);
CREATE INDEX idx_hypotheses_status ON investigation_hypotheses(status);
CREATE INDEX idx_hypotheses_type ON investigation_hypotheses(hypothesis_type);
CREATE INDEX idx_hypotheses_confidence ON investigation_hypotheses(confidence_level);
CREATE INDEX idx_hypotheses_proposed_by ON investigation_hypotheses(proposed_by);

-- Reports indexes
CREATE INDEX idx_reports_investigation_id ON investigation_reports(investigation_id);
CREATE INDEX idx_reports_type ON investigation_reports(report_type);
CREATE INDEX idx_reports_status ON investigation_reports(report_status);
CREATE INDEX idx_reports_authored_by ON investigation_reports(authored_by);
CREATE INDEX idx_reports_version ON investigation_reports(investigation_id, version_number);

-- ============================================================================
-- TRIGGERS FOR INVESTIGATIONS SCHEMA
-- ============================================================================

-- Update timestamp trigger for investigations
CREATE TRIGGER trg_investigations_updated_at
    AFTER UPDATE ON investigations
    FOR EACH ROW
BEGIN
    UPDATE investigations 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Update timestamp trigger for investigation_sessions
CREATE TRIGGER trg_sessions_updated_at
    AFTER UPDATE ON investigation_sessions
    FOR EACH ROW
BEGIN
    UPDATE investigation_sessions 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Update timestamp trigger for investigation_milestones
CREATE TRIGGER trg_milestones_updated_at
    AFTER UPDATE ON investigation_milestones
    FOR EACH ROW
BEGIN
    UPDATE investigation_milestones 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Update timestamp trigger for investigation_locations
CREATE TRIGGER trg_locations_updated_at
    AFTER UPDATE ON investigation_locations
    FOR EACH ROW
BEGIN
    UPDATE investigation_locations 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Auto-archive investigations when marked as completed
CREATE TRIGGER trg_investigations_auto_archive
    AFTER UPDATE OF status ON investigations
    FOR EACH ROW
    WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    UPDATE investigations 
    SET end_date = COALESCE(end_date, strftime('%s', 'now'))
    WHERE id = NEW.id;
END;

-- Update visit count for locations
CREATE TRIGGER trg_locations_visit_count
    AFTER INSERT ON investigation_sessions
    FOR EACH ROW
    WHEN NEW.location IS NOT NULL
BEGIN
    UPDATE investigation_locations 
    SET 
        visit_count = visit_count + 1,
        last_visit = NEW.start_time
    WHERE investigation_id = NEW.investigation_id 
    AND name = NEW.location;
END;

-- Prevent deletion of active team members
CREATE TRIGGER trg_team_prevent_delete_active
    BEFORE DELETE ON investigation_team_members
    FOR EACH ROW
    WHEN OLD.is_active = 1
BEGIN
    SELECT RAISE(ABORT, 'Cannot delete active team member. Set is_active to 0 first.');
END;

-- ============================================================================
-- VIEWS FOR INVESTIGATIONS SCHEMA
-- ============================================================================

-- Active investigations view
CREATE VIEW vw_active_investigations AS
SELECT 
    i.*,
    COUNT(DISTINCT itm.user_id) as team_size,
    COUNT(DISTINCT s.id) as session_count,
    MAX(s.start_time) as last_session_time,
    COUNT(DISTINCT e.id) as evidence_count
FROM investigations i
LEFT JOIN investigation_team_members itm ON i.id = itm.investigation_id AND itm.is_active = 1
LEFT JOIN investigation_sessions s ON i.id = s.investigation_id
LEFT JOIN evidence e ON i.id = e.investigation_id AND e.archived = 0
WHERE i.status IN ('planning', 'active', 'on_hold')
AND i.archived = 0
GROUP BY i.id;

-- Investigation progress view
CREATE VIEW vw_investigation_progress AS
SELECT 
    i.id,
    i.name,
    i.status,
    i.priority,
    COUNT(DISTINCT im.id) as total_milestones,
    COUNT(DISTINCT CASE WHEN im.status = 'completed' THEN im.id END) as completed_milestones,
    CASE 
        WHEN COUNT(DISTINCT im.id) = 0 THEN 0
        ELSE ROUND(COUNT(DISTINCT CASE WHEN im.status = 'completed' THEN im.id END) * 100.0 / COUNT(DISTINCT im.id), 1)
    END as progress_percentage,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sessions,
    COUNT(DISTINCT e.id) as evidence_count,
    MAX(s.end_time) as last_activity
FROM investigations i
LEFT JOIN investigation_milestones im ON i.id = im.investigation_id
LEFT JOIN investigation_sessions s ON i.id = s.investigation_id
LEFT JOIN evidence e ON i.id = e.investigation_id AND e.archived = 0
GROUP BY i.id;

-- Team workload view
CREATE VIEW vw_team_workload AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.role as user_role,
    COUNT(DISTINCT itm.investigation_id) as active_investigations,
    COUNT(DISTINCT CASE WHEN i.priority = 'critical' THEN i.id END) as critical_cases,
    COUNT(DISTINCT CASE WHEN i.priority = 'urgent' THEN i.id END) as urgent_cases,
    COUNT(DISTINCT CASE WHEN itm.role = 'lead_investigator' THEN i.id END) as leading_cases,
    MAX(i.updated_at) as last_activity
FROM users u
LEFT JOIN investigation_team_members itm ON u.id = itm.user_id AND itm.is_active = 1
LEFT JOIN investigations i ON itm.investigation_id = i.id AND i.status IN ('planning', 'active', 'on_hold')
WHERE u.account_status = 'active'
GROUP BY u.id;

-- Session statistics view
CREATE VIEW vw_session_statistics AS
SELECT 
    i.id as investigation_id,
    i.name as investigation_name,
    COUNT(s.id) as total_sessions,
    AVG(s.duration) as avg_session_duration,
    SUM(s.duration) as total_duration,
    MIN(s.start_time) as first_session,
    MAX(s.end_time) as last_session,
    COUNT(DISTINCT DATE(s.start_time, 'unixepoch')) as investigation_days
FROM investigations i
LEFT JOIN investigation_sessions s ON i.id = s.investigation_id
GROUP BY i.id;