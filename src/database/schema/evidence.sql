-- ============================================================================
-- EVIDENCE FILES AND ATTACHMENTS SCHEMA
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
    file_hash TEXT, -- SHA-256 hash
    mime_type TEXT,
    thumbnail_path TEXT,
    location_found TEXT,
    coordinates TEXT, -- JSON: {lat, lng, accuracy, elevation}
    collection_time INTEGER NOT NULL,
    collected_by TEXT NOT NULL,
    chain_of_custody TEXT DEFAULT '[]', -- JSON array of custody transfers
    tags TEXT DEFAULT '[]', -- JSON array
    metadata TEXT DEFAULT '{}', -- JSON object - sensor data, EXIF, etc.
    integrity_verified BOOLEAN NOT NULL DEFAULT 0,
    integrity_check_time INTEGER,
    integrity_check_by TEXT,
    analysis_status TEXT NOT NULL DEFAULT 'pending',
    analysis_notes TEXT,
    significance TEXT NOT NULL DEFAULT 'low',
    is_primary_evidence BOOLEAN NOT NULL DEFAULT 0,
    related_evidence TEXT DEFAULT '[]', -- JSON array of evidence IDs
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    archived BOOLEAN NOT NULL DEFAULT 0,
    archived_at INTEGER,
    
    -- Constraints
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
    CHECK (file_hash IS NULL OR length(file_hash) = 64), -- SHA-256 is 64 hex chars
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES investigation_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (integrity_check_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Evidence files table - for multiple files per evidence
CREATE TABLE evidence_files (
    id TEXT PRIMARY KEY NOT NULL,
    evidence_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash TEXT NOT NULL, -- SHA-256
    mime_type TEXT NOT NULL,
    encoding TEXT,
    thumbnail_path TEXT,
    preview_path TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT 0,
    upload_time INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    uploaded_by TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'uploaded',
    processing_error TEXT,
    metadata TEXT DEFAULT '{}', -- JSON - EXIF, codec info, etc.
    
    -- Constraints
    CHECK (processing_status IN ('uploaded', 'processing', 'processed', 'error', 'corrupted')),
    CHECK (file_size > 0),
    CHECK (length(file_hash) = 64), -- SHA-256
    CHECK (upload_time > 0),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(evidence_id, file_hash) -- Prevent duplicate files for same evidence
);

-- Evidence annotations table
CREATE TABLE evidence_annotations (
    id TEXT PRIMARY KEY NOT NULL,
    evidence_id TEXT NOT NULL,
    annotator_id TEXT NOT NULL,
    annotation_type TEXT NOT NULL DEFAULT 'text_note',
    content TEXT NOT NULL,
    position_data TEXT, -- JSON - coordinates for visual annotations
    timestamp_start INTEGER, -- for time-based media (milliseconds)
    timestamp_end INTEGER, -- for time-based media (milliseconds)
    confidence_score REAL, -- 0.0 to 1.0
    verified_by TEXT,
    verified_at INTEGER,
    tags TEXT DEFAULT '[]', -- JSON array
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (annotation_type IN ('text_note', 'highlight', 'shape_overlay', 'timestamp_marker', 'measurement', 'identification', 'anomaly_detection')),
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
    CHECK (timestamp_start IS NULL OR timestamp_start >= 0),
    CHECK (timestamp_end IS NULL OR timestamp_end >= timestamp_start),
    CHECK (verified_at IS NULL OR verified_at >= created_at),
    CHECK (json_valid(position_data) OR position_data IS NULL),
    CHECK (json_valid(tags)),
    
    -- Foreign Keys
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (annotator_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Evidence analysis results table
CREATE TABLE evidence_analysis_results (
    id TEXT PRIMARY KEY NOT NULL,
    evidence_id TEXT NOT NULL,
    analysis_type TEXT NOT NULL,
    analyzer_id TEXT, -- user who performed analysis
    analysis_tool TEXT, -- software/hardware used
    analysis_version TEXT, -- tool version
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0, -- 0-100
    results TEXT DEFAULT '{}', -- JSON object with analysis results
    confidence_score REAL, -- 0.0 to 1.0
    findings_summary TEXT,
    detailed_findings TEXT,
    recommendations TEXT,
    false_positive_probability REAL, -- 0.0 to 1.0
    metadata TEXT DEFAULT '{}', -- JSON - analysis parameters, etc.
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (analysis_type IN ('audio_analysis', 'image_analysis', 'video_analysis', 'spectral_analysis', 'pattern_recognition', 'statistical_analysis', 'correlation_analysis', 'anomaly_detection', 'metadata_extraction', 'verification')),
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CHECK (progress >= 0 AND progress <= 100),
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
    CHECK (false_positive_probability IS NULL OR (false_positive_probability >= 0.0 AND false_positive_probability <= 1.0)),
    CHECK (started_at > 0),
    CHECK (completed_at IS NULL OR completed_at >= started_at),
    CHECK (json_valid(results)),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (analyzer_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Evidence relationships table
CREATE TABLE evidence_relationships (
    id TEXT PRIMARY KEY NOT NULL,
    source_evidence_id TEXT NOT NULL,
    target_evidence_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    strength REAL NOT NULL DEFAULT 0.5, -- 0.0 to 1.0
    description TEXT,
    established_by TEXT NOT NULL,
    established_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    verified_by TEXT,
    verified_at INTEGER,
    metadata TEXT DEFAULT '{}', -- JSON
    
    -- Constraints
    CHECK (relationship_type IN ('duplicate', 'similar', 'contradicts', 'supports', 'derived_from', 'part_of', 'sequence', 'correlation', 'causation')),
    CHECK (strength >= 0.0 AND strength <= 1.0),
    CHECK (source_evidence_id != target_evidence_id),
    CHECK (established_at > 0),
    CHECK (verified_at IS NULL OR verified_at >= established_at),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (source_evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (target_evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (established_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Unique constraint to prevent duplicate relationships
    UNIQUE(source_evidence_id, target_evidence_id, relationship_type)
);

-- Evidence chain of custody details
CREATE TABLE evidence_custody_log (
    id TEXT PRIMARY KEY NOT NULL,
    evidence_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_user TEXT,
    to_user TEXT,
    location TEXT,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    reason TEXT,
    notes TEXT,
    witness_id TEXT,
    signature_hash TEXT, -- Digital signature if available
    metadata TEXT DEFAULT '{}', -- JSON
    
    -- Constraints
    CHECK (action IN ('collected', 'transferred', 'analyzed', 'stored', 'retrieved', 'copied', 'sealed', 'unsealed', 'returned', 'destroyed')),
    CHECK (timestamp > 0),
    CHECK (json_valid(metadata)),
    CHECK (from_user IS NOT NULL OR action = 'collected'), -- from_user can be null only for initial collection
    
    -- Foreign Keys
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (to_user) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (witness_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Evidence quality metrics table
CREATE TABLE evidence_quality_metrics (
    id TEXT PRIMARY KEY NOT NULL,
    evidence_id TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    measurement_method TEXT,
    measured_by TEXT,
    measured_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    equipment_used TEXT,
    environmental_conditions TEXT, -- JSON
    confidence_level REAL, -- 0.0 to 1.0
    notes TEXT,
    
    -- Constraints
    CHECK (metric_type IN ('resolution', 'clarity', 'noise_level', 'signal_strength', 'frequency_response', 'dynamic_range', 'color_accuracy', 'temporal_accuracy', 'spatial_accuracy', 'completeness', 'authenticity')),
    CHECK (confidence_level IS NULL OR (confidence_level >= 0.0 AND confidence_level <= 1.0)),
    CHECK (measured_at > 0),
    CHECK (json_valid(environmental_conditions) OR environmental_conditions IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (measured_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(evidence_id, metric_type, measured_at)
);

-- Evidence backup and versioning table
CREATE TABLE evidence_versions (
    id TEXT PRIMARY KEY NOT NULL,
    evidence_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    change_type TEXT NOT NULL,
    changed_fields TEXT NOT NULL, -- JSON array
    old_values TEXT, -- JSON object
    new_values TEXT, -- JSON object
    change_reason TEXT,
    changed_by TEXT NOT NULL,
    changed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    approved_by TEXT,
    approved_at INTEGER,
    
    -- Constraints
    CHECK (change_type IN ('created', 'modified', 'analyzed', 'annotated', 'verified', 'archived', 'restored')),
    CHECK (version_number > 0),
    CHECK (changed_at > 0),
    CHECK (approved_at IS NULL OR approved_at >= changed_at),
    CHECK (json_valid(changed_fields)),
    CHECK (json_valid(old_values) OR old_values IS NULL),
    CHECK (json_valid(new_values) OR new_values IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(evidence_id, version_number)
);

-- ============================================================================
-- INDEXES FOR EVIDENCE SCHEMA
-- ============================================================================

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
CREATE INDEX idx_evidence_primary ON evidence(is_primary_evidence);
CREATE INDEX idx_evidence_archived ON evidence(archived, archived_at);
CREATE INDEX idx_evidence_hash ON evidence(file_hash);
CREATE INDEX idx_evidence_integrity ON evidence(integrity_verified, integrity_check_time);

-- Evidence files indexes
CREATE INDEX idx_evidence_files_evidence_id ON evidence_files(evidence_id);
CREATE INDEX idx_evidence_files_hash ON evidence_files(file_hash);
CREATE INDEX idx_evidence_files_mime_type ON evidence_files(mime_type);
CREATE INDEX idx_evidence_files_status ON evidence_files(processing_status);
CREATE INDEX idx_evidence_files_primary ON evidence_files(is_primary);
CREATE INDEX idx_evidence_files_uploaded ON evidence_files(uploaded_by, upload_time);

-- Evidence annotations indexes
CREATE INDEX idx_annotations_evidence_id ON evidence_annotations(evidence_id);
CREATE INDEX idx_annotations_annotator_id ON evidence_annotations(annotator_id);
CREATE INDEX idx_annotations_type ON evidence_annotations(annotation_type);
CREATE INDEX idx_annotations_timestamp ON evidence_annotations(timestamp_start, timestamp_end);
CREATE INDEX idx_annotations_verified ON evidence_annotations(verified_by, verified_at);

-- Analysis results indexes
CREATE INDEX idx_analysis_evidence_id ON evidence_analysis_results(evidence_id);
CREATE INDEX idx_analysis_type ON evidence_analysis_results(analysis_type);
CREATE INDEX idx_analysis_status ON evidence_analysis_results(status);
CREATE INDEX idx_analysis_analyzer ON evidence_analysis_results(analyzer_id);
CREATE INDEX idx_analysis_dates ON evidence_analysis_results(started_at, completed_at);
CREATE INDEX idx_analysis_confidence ON evidence_analysis_results(confidence_score);

-- Evidence relationships indexes
CREATE INDEX idx_relationships_source ON evidence_relationships(source_evidence_id);
CREATE INDEX idx_relationships_target ON evidence_relationships(target_evidence_id);
CREATE INDEX idx_relationships_type ON evidence_relationships(relationship_type);
CREATE INDEX idx_relationships_strength ON evidence_relationships(strength);
CREATE INDEX idx_relationships_established ON evidence_relationships(established_by, established_at);

-- Custody log indexes
CREATE INDEX idx_custody_evidence_id ON evidence_custody_log(evidence_id);
CREATE INDEX idx_custody_action ON evidence_custody_log(action);
CREATE INDEX idx_custody_timestamp ON evidence_custody_log(timestamp);
CREATE INDEX idx_custody_from_user ON evidence_custody_log(from_user);
CREATE INDEX idx_custody_to_user ON evidence_custody_log(to_user);

-- Quality metrics indexes
CREATE INDEX idx_quality_evidence_id ON evidence_quality_metrics(evidence_id);
CREATE INDEX idx_quality_type ON evidence_quality_metrics(metric_type);
CREATE INDEX idx_quality_measured ON evidence_quality_metrics(measured_by, measured_at);
CREATE INDEX idx_quality_confidence ON evidence_quality_metrics(confidence_level);

-- Versions indexes
CREATE INDEX idx_versions_evidence_id ON evidence_versions(evidence_id);
CREATE INDEX idx_versions_number ON evidence_versions(evidence_id, version_number);
CREATE INDEX idx_versions_change_type ON evidence_versions(change_type);
CREATE INDEX idx_versions_changed ON evidence_versions(changed_by, changed_at);

-- ============================================================================
-- TRIGGERS FOR EVIDENCE SCHEMA
-- ============================================================================

-- Update timestamp trigger for evidence
CREATE TRIGGER trg_evidence_updated_at
    AFTER UPDATE ON evidence
    FOR EACH ROW
BEGIN
    UPDATE evidence 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Update timestamp trigger for evidence_annotations
CREATE TRIGGER trg_annotations_updated_at
    AFTER UPDATE ON evidence_annotations
    FOR EACH ROW
BEGIN
    UPDATE evidence_annotations 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Update timestamp trigger for evidence_analysis_results
CREATE TRIGGER trg_analysis_updated_at
    AFTER UPDATE ON evidence_analysis_results
    FOR EACH ROW
BEGIN
    UPDATE evidence_analysis_results 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Auto-create initial custody log entry when evidence is created
CREATE TRIGGER trg_evidence_initial_custody
    AFTER INSERT ON evidence
    FOR EACH ROW
BEGIN
    INSERT INTO evidence_custody_log (
        id, evidence_id, action, to_user, timestamp, reason, notes
    ) VALUES (
        'custody_' || NEW.id || '_' || NEW.collection_time,
        NEW.id,
        'collected',
        NEW.collected_by,
        NEW.collection_time,
        'Initial evidence collection',
        'Evidence collected and entered into system'
    );
END;

-- Create version record on evidence updates
CREATE TRIGGER trg_evidence_versioning
    AFTER UPDATE ON evidence
    FOR EACH ROW
BEGIN
    INSERT INTO evidence_versions (
        id, evidence_id, version_number, change_type, changed_fields,
        old_values, new_values, change_reason, changed_by
    ) VALUES (
        'version_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.id,
        COALESCE((SELECT MAX(version_number) FROM evidence_versions WHERE evidence_id = NEW.id), 0) + 1,
        'modified',
        '[]', -- This would need to be populated by application logic
        '{}', -- This would need to be populated by application logic  
        '{}', -- This would need to be populated by application logic
        'Evidence updated',
        NEW.updated_by
    );
END;

-- Validate file hash uniqueness within investigation (prevent accidental duplicates)
CREATE TRIGGER trg_evidence_duplicate_check
    BEFORE INSERT ON evidence
    FOR EACH ROW
    WHEN NEW.file_hash IS NOT NULL
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM evidence 
            WHERE investigation_id = NEW.investigation_id 
            AND file_hash = NEW.file_hash 
            AND id != NEW.id
        )
        THEN RAISE(ABORT, 'Duplicate file hash detected in same investigation')
    END;
END;

-- Update evidence analysis status when analysis is completed
CREATE TRIGGER trg_analysis_completion
    AFTER UPDATE OF status ON evidence_analysis_results
    FOR EACH ROW
    WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    UPDATE evidence 
    SET 
        analysis_status = 'completed',
        analysis_notes = COALESCE(analysis_notes || '; ', '') || NEW.findings_summary
    WHERE id = NEW.evidence_id;
END;

-- Ensure only one primary file per evidence
CREATE TRIGGER trg_evidence_files_primary_unique
    BEFORE UPDATE OF is_primary ON evidence_files
    FOR EACH ROW
    WHEN NEW.is_primary = 1 AND OLD.is_primary = 0
BEGIN
    UPDATE evidence_files 
    SET is_primary = 0 
    WHERE evidence_id = NEW.evidence_id AND id != NEW.id;
END;

-- ============================================================================
-- VIEWS FOR EVIDENCE SCHEMA
-- ============================================================================

-- Evidence summary view
CREATE VIEW vw_evidence_summary AS
SELECT 
    e.*,
    COUNT(DISTINCT ef.id) as file_count,
    COUNT(DISTINCT ea.id) as annotation_count,
    COUNT(DISTINCT ear.id) as analysis_count,
    COUNT(DISTINCT CASE WHEN ear.status = 'completed' THEN ear.id END) as completed_analyses,
    MAX(ecl.timestamp) as last_custody_change,
    u1.full_name as collected_by_name,
    u2.full_name as verified_by_name
FROM evidence e
LEFT JOIN evidence_files ef ON e.id = ef.evidence_id
LEFT JOIN evidence_annotations ea ON e.id = ea.evidence_id
LEFT JOIN evidence_analysis_results ear ON e.id = ear.evidence_id
LEFT JOIN evidence_custody_log ecl ON e.id = ecl.evidence_id
LEFT JOIN users u1 ON e.collected_by = u1.id
LEFT JOIN users u2 ON e.integrity_check_by = u2.id
GROUP BY e.id;

-- Evidence with file details view
CREATE VIEW vw_evidence_with_files AS
SELECT 
    e.id,
    e.evidence_number,
    e.name,
    e.type,
    e.category,
    e.analysis_status,
    e.significance,
    ef.id as file_id,
    ef.file_name,
    ef.file_size,
    ef.mime_type,
    ef.is_primary as is_primary_file,
    ef.processing_status,
    ef.metadata as file_metadata
FROM evidence e
LEFT JOIN evidence_files ef ON e.id = ef.evidence_id
WHERE e.archived = 0;

-- Chain of custody view
CREATE VIEW vw_evidence_custody_chain AS
SELECT 
    e.id as evidence_id,
    e.evidence_number,
    e.name,
    ecl.action,
    ecl.timestamp,
    ecl.from_user,
    u1.full_name as from_user_name,
    ecl.to_user,
    u2.full_name as to_user_name,
    ecl.location,
    ecl.reason,
    ecl.notes,
    u3.full_name as witness_name
FROM evidence e
LEFT JOIN evidence_custody_log ecl ON e.id = ecl.evidence_id
LEFT JOIN users u1 ON ecl.from_user = u1.id
LEFT JOIN users u2 ON ecl.to_user = u2.id
LEFT JOIN users u3 ON ecl.witness_id = u3.id
ORDER BY e.evidence_number, ecl.timestamp;

-- Evidence analysis status view
CREATE VIEW vw_evidence_analysis_status AS
SELECT 
    e.id as evidence_id,
    e.evidence_number,
    e.name,
    e.analysis_status,
    COUNT(ear.id) as total_analyses,
    COUNT(CASE WHEN ear.status = 'completed' THEN 1 END) as completed_analyses,
    COUNT(CASE WHEN ear.status = 'failed' THEN 1 END) as failed_analyses,
    AVG(ear.confidence_score) as avg_confidence,
    MIN(ear.started_at) as first_analysis_start,
    MAX(ear.completed_at) as last_analysis_completion
FROM evidence e
LEFT JOIN evidence_analysis_results ear ON e.id = ear.evidence_id
GROUP BY e.id;

-- High-priority evidence view
CREATE VIEW vw_high_priority_evidence AS
SELECT 
    e.*,
    i.name as investigation_name,
    i.priority as investigation_priority,
    COUNT(DISTINCT er.target_evidence_id) as related_evidence_count
FROM evidence e
INNER JOIN investigations i ON e.investigation_id = i.id
LEFT JOIN evidence_relationships er ON e.id = er.source_evidence_id
WHERE e.significance IN ('high', 'critical')
AND e.archived = 0
AND i.status IN ('active', 'planning')
GROUP BY e.id
ORDER BY 
    CASE e.significance 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        ELSE 3 
    END,
    e.collection_time DESC;