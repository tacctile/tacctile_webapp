-- ============================================================================
-- SENSOR READINGS AND TELEMETRY SCHEMA
-- ============================================================================

-- Sensor configurations table
CREATE TABLE sensor_configurations (
    id TEXT PRIMARY KEY NOT NULL,
    sensor_id TEXT UNIQUE NOT NULL, -- Hardware/logical sensor identifier
    sensor_name TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    firmware_version TEXT,
    calibration_date INTEGER,
    calibration_due_date INTEGER,
    sampling_rate REAL NOT NULL DEFAULT 1.0, -- Hz
    resolution REAL NOT NULL DEFAULT 1.0,
    accuracy TEXT, -- e.g., "±0.1%", "±1°C"
    measurement_range TEXT DEFAULT '{}', -- JSON {min, max, unit}
    configuration_data TEXT DEFAULT '{}', -- JSON - sensor-specific settings
    is_active BOOLEAN NOT NULL DEFAULT 1,
    last_maintenance INTEGER,
    maintenance_notes TEXT,
    installation_date INTEGER,
    installation_location TEXT,
    coordinates TEXT, -- JSON: {lat, lng, elevation}
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    
    -- Constraints
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
    
    -- Foreign Keys
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Main sensor readings table (optimized for high-volume inserts)
CREATE TABLE sensor_readings (
    id TEXT PRIMARY KEY NOT NULL,
    investigation_id TEXT,
    session_id TEXT,
    sensor_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    reading_time INTEGER NOT NULL, -- Unix timestamp in milliseconds for precision
    location TEXT,
    coordinates TEXT, -- JSON: {lat, lng, accuracy, elevation}
    raw_value REAL NOT NULL,
    processed_value REAL,
    unit TEXT NOT NULL,
    quality_score REAL DEFAULT 1.0, -- 0.0 to 1.0
    calibration_offset REAL DEFAULT 0.0,
    environmental_factors TEXT, -- JSON: temperature, humidity, etc.
    anomaly_detected BOOLEAN NOT NULL DEFAULT 0,
    anomaly_confidence REAL, -- 0.0 to 1.0
    anomaly_type TEXT,
    metadata TEXT DEFAULT '{}', -- JSON - sensor-specific data
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (sensor_type IN ('emf', 'temperature', 'humidity', 'pressure', 'motion', 'audio', 'light', 'magnetic', 'radiation', 'vibration', 'gps', 'accelerometer', 'gyroscope')),
    CHECK (reading_time > 0),
    CHECK (quality_score IS NULL OR (quality_score >= 0.0 AND quality_score <= 1.0)),
    CHECK (anomaly_confidence IS NULL OR (anomaly_confidence >= 0.0 AND anomaly_confidence <= 1.0)),
    CHECK (anomaly_type IS NULL OR anomaly_type IN ('spike', 'drop', 'drift', 'noise', 'pattern', 'correlation', 'threshold')),
    CHECK (json_valid(environmental_factors) OR environmental_factors IS NULL),
    CHECK (json_valid(metadata)),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    
    -- Foreign Keys
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES investigation_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Aggregated sensor data for performance (hourly aggregates)
CREATE TABLE sensor_readings_hourly (
    id TEXT PRIMARY KEY NOT NULL,
    sensor_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    hour_timestamp INTEGER NOT NULL, -- Start of hour (Unix timestamp)
    investigation_id TEXT,
    session_id TEXT,
    sample_count INTEGER NOT NULL DEFAULT 0,
    min_value REAL,
    max_value REAL,
    avg_value REAL,
    median_value REAL,
    std_deviation REAL,
    sum_value REAL,
    first_value REAL,
    last_value REAL,
    first_reading_time INTEGER,
    last_reading_time INTEGER,
    anomaly_count INTEGER NOT NULL DEFAULT 0,
    quality_avg REAL,
    unit TEXT NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON - aggregation metadata
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (sensor_type IN ('emf', 'temperature', 'humidity', 'pressure', 'motion', 'audio', 'light', 'magnetic', 'radiation', 'vibration', 'gps', 'accelerometer', 'gyroscope')),
    CHECK (hour_timestamp > 0),
    CHECK (sample_count >= 0),
    CHECK (anomaly_count >= 0),
    CHECK (quality_avg IS NULL OR (quality_avg >= 0.0 AND quality_avg <= 1.0)),
    CHECK (first_reading_time IS NULL OR first_reading_time >= hour_timestamp),
    CHECK (last_reading_time IS NULL OR last_reading_time >= first_reading_time),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES investigation_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(sensor_id, hour_timestamp)
);

-- Sensor alerts table
CREATE TABLE sensor_alerts (
    id TEXT PRIMARY KEY NOT NULL,
    sensor_reading_id TEXT,
    sensor_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    threshold_value REAL,
    actual_value REAL,
    message TEXT NOT NULL,
    detailed_message TEXT,
    triggered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    acknowledged_at INTEGER,
    acknowledged_by TEXT,
    resolved_at INTEGER,
    resolved_by TEXT,
    resolution_notes TEXT,
    investigation_id TEXT,
    session_id TEXT,
    notification_sent BOOLEAN NOT NULL DEFAULT 0,
    escalated BOOLEAN NOT NULL DEFAULT 0,
    escalated_at INTEGER,
    metadata TEXT DEFAULT '{}', -- JSON - alert-specific data
    
    -- Constraints
    CHECK (alert_type IN ('threshold_exceeded', 'threshold_below', 'anomaly_detected', 'sensor_malfunction', 'calibration_due', 'battery_low', 'communication_lost', 'data_corruption')),
    CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
    CHECK (triggered_at > 0),
    CHECK (acknowledged_at IS NULL OR acknowledged_at >= triggered_at),
    CHECK (resolved_at IS NULL OR resolved_at >= triggered_at),
    CHECK (escalated_at IS NULL OR escalated_at >= triggered_at),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (sensor_reading_id) REFERENCES sensor_readings(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES investigation_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Sensor calibration history
CREATE TABLE sensor_calibrations (
    id TEXT PRIMARY KEY NOT NULL,
    sensor_id TEXT NOT NULL,
    calibration_type TEXT NOT NULL DEFAULT 'routine',
    calibration_date INTEGER NOT NULL,
    performed_by TEXT NOT NULL,
    reference_standard TEXT,
    reference_value REAL,
    measured_value REAL,
    offset_before REAL,
    offset_after REAL,
    scale_factor_before REAL DEFAULT 1.0,
    scale_factor_after REAL DEFAULT 1.0,
    accuracy_before TEXT,
    accuracy_after TEXT,
    pass_fail TEXT NOT NULL,
    notes TEXT,
    next_calibration_due INTEGER,
    certificate_path TEXT,
    metadata TEXT DEFAULT '{}', -- JSON
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (calibration_type IN ('routine', 'emergency', 'post_maintenance', 'installation', 'verification')),
    CHECK (calibration_date > 0),
    CHECK (pass_fail IN ('pass', 'fail', 'conditional')),
    CHECK (scale_factor_before > 0),
    CHECK (scale_factor_after > 0),
    CHECK (next_calibration_due IS NULL OR next_calibration_due > calibration_date),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Sensor maintenance records
CREATE TABLE sensor_maintenance (
    id TEXT PRIMARY KEY NOT NULL,
    sensor_id TEXT NOT NULL,
    maintenance_type TEXT NOT NULL,
    scheduled_date INTEGER,
    performed_date INTEGER NOT NULL,
    performed_by TEXT NOT NULL,
    duration_minutes INTEGER,
    description TEXT NOT NULL,
    parts_replaced TEXT, -- JSON array
    parts_cost REAL,
    labor_hours REAL,
    total_cost REAL,
    maintenance_status TEXT NOT NULL DEFAULT 'completed',
    before_condition TEXT,
    after_condition TEXT,
    issues_found TEXT,
    next_maintenance_due INTEGER,
    preventive BOOLEAN NOT NULL DEFAULT 1,
    downtime_start INTEGER,
    downtime_end INTEGER,
    notes TEXT,
    attachments TEXT DEFAULT '[]', -- JSON array of file paths
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (maintenance_type IN ('preventive', 'corrective', 'emergency', 'upgrade', 'relocation', 'decommission')),
    CHECK (maintenance_status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'deferred')),
    CHECK (performed_date > 0),
    CHECK (scheduled_date IS NULL OR scheduled_date > 0),
    CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CHECK (parts_cost IS NULL OR parts_cost >= 0),
    CHECK (labor_hours IS NULL OR labor_hours >= 0),
    CHECK (total_cost IS NULL OR total_cost >= 0),
    CHECK (downtime_start IS NULL OR downtime_start > 0),
    CHECK (downtime_end IS NULL OR downtime_end >= downtime_start),
    CHECK (next_maintenance_due IS NULL OR next_maintenance_due > performed_date),
    CHECK (json_valid(parts_replaced) OR parts_replaced IS NULL),
    CHECK (json_valid(attachments)),
    
    -- Foreign Keys
    FOREIGN KEY (sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Sensor data correlations table
CREATE TABLE sensor_correlations (
    id TEXT PRIMARY KEY NOT NULL,
    primary_sensor_id TEXT NOT NULL,
    secondary_sensor_id TEXT NOT NULL,
    correlation_type TEXT NOT NULL DEFAULT 'temporal',
    time_window_start INTEGER NOT NULL,
    time_window_end INTEGER NOT NULL,
    correlation_coefficient REAL, -- -1.0 to 1.0
    statistical_significance REAL, -- p-value
    sample_size INTEGER NOT NULL,
    lag_seconds REAL DEFAULT 0.0, -- Time lag in seconds
    confidence_interval REAL, -- 0.0 to 1.0
    correlation_strength TEXT,
    analysis_method TEXT NOT NULL,
    calculated_by TEXT,
    calculated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    investigation_id TEXT,
    session_id TEXT,
    metadata TEXT DEFAULT '{}', -- JSON
    
    -- Constraints
    CHECK (correlation_type IN ('temporal', 'spatial', 'frequency', 'phase', 'causality')),
    CHECK (time_window_start > 0),
    CHECK (time_window_end > time_window_start),
    CHECK (correlation_coefficient IS NULL OR (correlation_coefficient >= -1.0 AND correlation_coefficient <= 1.0)),
    CHECK (statistical_significance IS NULL OR (statistical_significance >= 0.0 AND statistical_significance <= 1.0)),
    CHECK (confidence_interval IS NULL OR (confidence_interval >= 0.0 AND confidence_interval <= 1.0)),
    CHECK (sample_size > 0),
    CHECK (correlation_strength IS NULL OR correlation_strength IN ('none', 'weak', 'moderate', 'strong', 'very_strong')),
    CHECK (analysis_method IN ('pearson', 'spearman', 'kendall', 'cross_correlation', 'mutual_information', 'granger_causality')),
    CHECK (primary_sensor_id != secondary_sensor_id),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (primary_sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (secondary_sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (session_id) REFERENCES investigation_sessions(id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Unique constraint to prevent duplicate correlations
    UNIQUE(primary_sensor_id, secondary_sensor_id, correlation_type, time_window_start, time_window_end)
);

-- Environmental context data
CREATE TABLE environmental_context (
    id TEXT PRIMARY KEY NOT NULL,
    timestamp INTEGER NOT NULL,
    location TEXT,
    coordinates TEXT, -- JSON
    weather_temperature REAL,
    weather_humidity REAL,
    weather_pressure REAL,
    weather_wind_speed REAL,
    weather_wind_direction REAL,
    weather_conditions TEXT,
    solar_activity_index REAL,
    geomagnetic_index REAL,
    moon_phase REAL, -- 0.0 to 1.0
    solar_elevation REAL, -- degrees
    electromagnetic_noise_level REAL,
    seismic_activity_level REAL,
    human_activity_level TEXT,
    equipment_interference TEXT DEFAULT '[]', -- JSON array
    notes TEXT,
    source TEXT NOT NULL, -- data source (api, manual, sensor)
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    
    -- Constraints
    CHECK (timestamp > 0),
    CHECK (weather_humidity IS NULL OR (weather_humidity >= 0 AND weather_humidity <= 100)),
    CHECK (weather_wind_direction IS NULL OR (weather_wind_direction >= 0 AND weather_wind_direction < 360)),
    CHECK (moon_phase IS NULL OR (moon_phase >= 0.0 AND moon_phase <= 1.0)),
    CHECK (solar_elevation IS NULL OR (solar_elevation >= -90 AND solar_elevation <= 90)),
    CHECK (human_activity_level IS NULL OR human_activity_level IN ('very_low', 'low', 'moderate', 'high', 'very_high')),
    CHECK (json_valid(coordinates) OR coordinates IS NULL),
    CHECK (json_valid(equipment_interference)),
    CHECK (source IN ('api', 'manual', 'sensor', 'calculated'))
);

-- Sensor data quality assessments
CREATE TABLE sensor_data_quality (
    id TEXT PRIMARY KEY NOT NULL,
    sensor_id TEXT NOT NULL,
    assessment_period_start INTEGER NOT NULL,
    assessment_period_end INTEGER NOT NULL,
    sample_count INTEGER NOT NULL,
    missing_data_percentage REAL NOT NULL DEFAULT 0.0,
    outlier_percentage REAL NOT NULL DEFAULT 0.0,
    noise_level REAL,
    drift_detected BOOLEAN NOT NULL DEFAULT 0,
    drift_rate REAL,
    calibration_drift REAL,
    data_gaps_count INTEGER NOT NULL DEFAULT 0,
    max_gap_duration INTEGER, -- seconds
    overall_quality_score REAL NOT NULL, -- 0.0 to 1.0
    quality_category TEXT NOT NULL,
    assessed_by TEXT,
    assessment_method TEXT NOT NULL,
    assessment_date INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    notes TEXT,
    metadata TEXT DEFAULT '{}', -- JSON
    
    -- Constraints
    CHECK (assessment_period_start > 0),
    CHECK (assessment_period_end > assessment_period_start),
    CHECK (sample_count >= 0),
    CHECK (missing_data_percentage >= 0.0 AND missing_data_percentage <= 100.0),
    CHECK (outlier_percentage >= 0.0 AND outlier_percentage <= 100.0),
    CHECK (data_gaps_count >= 0),
    CHECK (max_gap_duration IS NULL OR max_gap_duration > 0),
    CHECK (overall_quality_score >= 0.0 AND overall_quality_score <= 1.0),
    CHECK (quality_category IN ('excellent', 'good', 'fair', 'poor', 'unusable')),
    CHECK (assessment_method IN ('automatic', 'manual', 'hybrid')),
    CHECK (json_valid(metadata)),
    
    -- Foreign Keys
    FOREIGN KEY (sensor_id) REFERENCES sensor_configurations(sensor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    
    -- Unique constraint
    UNIQUE(sensor_id, assessment_period_start, assessment_period_end)
);

-- ============================================================================
-- INDEXES FOR SENSORS SCHEMA
-- ============================================================================

-- Sensor configurations indexes
CREATE INDEX idx_sensor_config_type ON sensor_configurations(sensor_type);
CREATE INDEX idx_sensor_config_active ON sensor_configurations(is_active);
CREATE INDEX idx_sensor_config_calibration_due ON sensor_configurations(calibration_due_date);
CREATE INDEX idx_sensor_config_created_by ON sensor_configurations(created_by);
CREATE INDEX idx_sensor_config_location ON sensor_configurations(installation_location);

-- Sensor readings indexes (critical for performance)
CREATE INDEX idx_sensor_readings_sensor_id ON sensor_readings(sensor_id);
CREATE INDEX idx_sensor_readings_time ON sensor_readings(reading_time);
CREATE INDEX idx_sensor_readings_investigation ON sensor_readings(investigation_id);
CREATE INDEX idx_sensor_readings_session ON sensor_readings(session_id);
CREATE INDEX idx_sensor_readings_type ON sensor_readings(sensor_type);
CREATE INDEX idx_sensor_readings_anomaly ON sensor_readings(anomaly_detected);
CREATE INDEX idx_sensor_readings_quality ON sensor_readings(quality_score);
CREATE INDEX idx_sensor_readings_composite ON sensor_readings(sensor_id, reading_time, investigation_id);

-- Hourly aggregates indexes
CREATE INDEX idx_hourly_sensor_id ON sensor_readings_hourly(sensor_id);
CREATE INDEX idx_hourly_timestamp ON sensor_readings_hourly(hour_timestamp);
CREATE INDEX idx_hourly_investigation ON sensor_readings_hourly(investigation_id);
CREATE INDEX idx_hourly_type ON sensor_readings_hourly(sensor_type);

-- Sensor alerts indexes
CREATE INDEX idx_alerts_sensor_id ON sensor_alerts(sensor_id);
CREATE INDEX idx_alerts_triggered ON sensor_alerts(triggered_at);
CREATE INDEX idx_alerts_severity ON sensor_alerts(severity);
CREATE INDEX idx_alerts_type ON sensor_alerts(alert_type);
CREATE INDEX idx_alerts_acknowledged ON sensor_alerts(acknowledged_at);
CREATE INDEX idx_alerts_resolved ON sensor_alerts(resolved_at);
CREATE INDEX idx_alerts_investigation ON sensor_alerts(investigation_id);

-- Calibrations indexes
CREATE INDEX idx_calibrations_sensor_id ON sensor_calibrations(sensor_id);
CREATE INDEX idx_calibrations_date ON sensor_calibrations(calibration_date);
CREATE INDEX idx_calibrations_due ON sensor_calibrations(next_calibration_due);
CREATE INDEX idx_calibrations_performed_by ON sensor_calibrations(performed_by);
CREATE INDEX idx_calibrations_pass_fail ON sensor_calibrations(pass_fail);

-- Maintenance indexes
CREATE INDEX idx_maintenance_sensor_id ON sensor_maintenance(sensor_id);
CREATE INDEX idx_maintenance_date ON sensor_maintenance(performed_date);
CREATE INDEX idx_maintenance_type ON sensor_maintenance(maintenance_type);
CREATE INDEX idx_maintenance_status ON sensor_maintenance(maintenance_status);
CREATE INDEX idx_maintenance_due ON sensor_maintenance(next_maintenance_due);
CREATE INDEX idx_maintenance_performed_by ON sensor_maintenance(performed_by);

-- Correlations indexes
CREATE INDEX idx_correlations_primary ON sensor_correlations(primary_sensor_id);
CREATE INDEX idx_correlations_secondary ON sensor_correlations(secondary_sensor_id);
CREATE INDEX idx_correlations_time_window ON sensor_correlations(time_window_start, time_window_end);
CREATE INDEX idx_correlations_investigation ON sensor_correlations(investigation_id);
CREATE INDEX idx_correlations_coefficient ON sensor_correlations(correlation_coefficient);

-- Environmental context indexes
CREATE INDEX idx_environmental_timestamp ON environmental_context(timestamp);
CREATE INDEX idx_environmental_location ON environmental_context(location);
CREATE INDEX idx_environmental_source ON environmental_context(source);

-- Data quality indexes
CREATE INDEX idx_quality_sensor_id ON sensor_data_quality(sensor_id);
CREATE INDEX idx_quality_period ON sensor_data_quality(assessment_period_start, assessment_period_end);
CREATE INDEX idx_quality_score ON sensor_data_quality(overall_quality_score);
CREATE INDEX idx_quality_category ON sensor_data_quality(quality_category);

-- ============================================================================
-- TRIGGERS FOR SENSORS SCHEMA
-- ============================================================================

-- Update timestamp trigger for sensor_configurations
CREATE TRIGGER trg_sensor_config_updated_at
    AFTER UPDATE ON sensor_configurations
    FOR EACH ROW
BEGIN
    UPDATE sensor_configurations 
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Auto-generate sensor alerts for anomalies
CREATE TRIGGER trg_sensor_anomaly_alert
    AFTER INSERT ON sensor_readings
    FOR EACH ROW
    WHEN NEW.anomaly_detected = 1 AND NEW.anomaly_confidence > 0.7
BEGIN
    INSERT INTO sensor_alerts (
        id, sensor_reading_id, sensor_id, alert_type, severity,
        actual_value, message, investigation_id, session_id
    ) VALUES (
        'alert_' || NEW.id,
        NEW.id,
        NEW.sensor_id,
        'anomaly_detected',
        CASE 
            WHEN NEW.anomaly_confidence > 0.9 THEN 'critical'
            WHEN NEW.anomaly_confidence > 0.8 THEN 'high'
            ELSE 'medium'
        END,
        NEW.processed_value,
        'Anomaly detected in ' || NEW.sensor_type || ' sensor: ' || NEW.anomaly_type,
        NEW.investigation_id,
        NEW.session_id
    );
END;

-- Update aggregated data when new readings are inserted
CREATE TRIGGER trg_update_hourly_aggregates
    AFTER INSERT ON sensor_readings
    FOR EACH ROW
BEGIN
    INSERT OR REPLACE INTO sensor_readings_hourly (
        id, sensor_id, sensor_type, hour_timestamp, investigation_id, session_id,
        sample_count, min_value, max_value, avg_value, sum_value,
        first_value, last_value, first_reading_time, last_reading_time,
        anomaly_count, quality_avg, unit
    )
    SELECT 
        'hourly_' || NEW.sensor_id || '_' || hour_start as id,
        NEW.sensor_id,
        NEW.sensor_type,
        hour_start,
        NEW.investigation_id,
        NEW.session_id,
        COUNT(*) as sample_count,
        MIN(processed_value) as min_value,
        MAX(processed_value) as max_value,
        AVG(processed_value) as avg_value,
        SUM(processed_value) as sum_value,
        (SELECT processed_value FROM sensor_readings WHERE sensor_id = NEW.sensor_id AND reading_time >= hour_start AND reading_time < hour_start + 3600000 ORDER BY reading_time LIMIT 1) as first_value,
        (SELECT processed_value FROM sensor_readings WHERE sensor_id = NEW.sensor_id AND reading_time >= hour_start AND reading_time < hour_start + 3600000 ORDER BY reading_time DESC LIMIT 1) as last_value,
        MIN(reading_time) as first_reading_time,
        MAX(reading_time) as last_reading_time,
        SUM(CASE WHEN anomaly_detected = 1 THEN 1 ELSE 0 END) as anomaly_count,
        AVG(quality_score) as quality_avg,
        NEW.unit
    FROM sensor_readings 
    CROSS JOIN (SELECT (NEW.reading_time / 3600000) * 3600000 as hour_start)
    WHERE sensor_id = NEW.sensor_id 
    AND reading_time >= hour_start 
    AND reading_time < hour_start + 3600000
    GROUP BY hour_start;
END;

-- Update calibration due date when calibration is performed
CREATE TRIGGER trg_update_calibration_due
    AFTER INSERT ON sensor_calibrations
    FOR EACH ROW
    WHEN NEW.pass_fail = 'pass'
BEGIN
    UPDATE sensor_configurations 
    SET 
        calibration_date = NEW.calibration_date,
        calibration_due_date = NEW.next_calibration_due
    WHERE sensor_id = NEW.sensor_id;
END;

-- Update maintenance due date
CREATE TRIGGER trg_update_maintenance_due
    AFTER INSERT ON sensor_maintenance
    FOR EACH ROW
    WHEN NEW.maintenance_status = 'completed'
BEGIN
    UPDATE sensor_configurations 
    SET last_maintenance = NEW.performed_date
    WHERE sensor_id = NEW.sensor_id;
END;

-- Auto-create maintenance alerts for overdue maintenance
CREATE TRIGGER trg_maintenance_overdue_alert
    AFTER UPDATE OF calibration_due_date ON sensor_configurations
    FOR EACH ROW
    WHEN NEW.calibration_due_date < strftime('%s', 'now') AND NEW.is_active = 1
BEGIN
    INSERT INTO sensor_alerts (
        id, sensor_id, alert_type, severity, message, threshold_value, actual_value
    ) VALUES (
        'maint_alert_' || NEW.sensor_id || '_' || strftime('%s', 'now'),
        NEW.sensor_id,
        'calibration_due',
        'high',
        'Sensor ' || NEW.sensor_name || ' calibration is overdue',
        NEW.calibration_due_date,
        strftime('%s', 'now')
    );
END;

-- ============================================================================
-- VIEWS FOR SENSORS SCHEMA
-- ============================================================================

-- Active sensors view
CREATE VIEW vw_active_sensors AS
SELECT 
    sc.*,
    COUNT(DISTINCT sr.id) as reading_count_24h,
    MAX(sr.reading_time) as last_reading_time,
    AVG(sr.quality_score) as avg_quality_24h,
    COUNT(DISTINCT CASE WHEN sa.resolved_at IS NULL THEN sa.id END) as open_alerts
FROM sensor_configurations sc
LEFT JOIN sensor_readings sr ON sc.sensor_id = sr.sensor_id 
    AND sr.reading_time > (strftime('%s', 'now') - 86400) * 1000 -- Last 24 hours
LEFT JOIN sensor_alerts sa ON sc.sensor_id = sa.sensor_id 
    AND sa.resolved_at IS NULL
WHERE sc.is_active = 1
GROUP BY sc.id;

-- Sensor health summary view
CREATE VIEW vw_sensor_health AS
SELECT 
    sc.sensor_id,
    sc.sensor_name,
    sc.sensor_type,
    sc.is_active,
    CASE 
        WHEN sc.calibration_due_date < strftime('%s', 'now') THEN 'overdue_calibration'
        WHEN sc.calibration_due_date < strftime('%s', 'now') + 604800 THEN 'calibration_due_soon'
        WHEN last_reading.reading_time < (strftime('%s', 'now') - 3600) * 1000 THEN 'no_recent_data'
        WHEN recent_quality.avg_quality < 0.7 THEN 'poor_quality'
        WHEN open_alerts.alert_count > 0 THEN 'has_alerts'
        ELSE 'healthy'
    END as health_status,
    sc.calibration_due_date,
    last_reading.reading_time as last_reading,
    recent_quality.avg_quality,
    open_alerts.alert_count
FROM sensor_configurations sc
LEFT JOIN (
    SELECT sensor_id, MAX(reading_time) as reading_time
    FROM sensor_readings 
    GROUP BY sensor_id
) last_reading ON sc.sensor_id = last_reading.sensor_id
LEFT JOIN (
    SELECT sensor_id, AVG(quality_score) as avg_quality
    FROM sensor_readings 
    WHERE reading_time > (strftime('%s', 'now') - 86400) * 1000
    GROUP BY sensor_id
) recent_quality ON sc.sensor_id = recent_quality.sensor_id
LEFT JOIN (
    SELECT sensor_id, COUNT(*) as alert_count
    FROM sensor_alerts 
    WHERE resolved_at IS NULL
    GROUP BY sensor_id
) open_alerts ON sc.sensor_id = open_alerts.sensor_id;

-- Recent sensor readings with context view
CREATE VIEW vw_recent_sensor_data AS
SELECT 
    sr.*,
    sc.sensor_name,
    sc.manufacturer,
    sc.model,
    i.name as investigation_name,
    s.name as session_name,
    ec.weather_temperature,
    ec.weather_humidity,
    ec.electromagnetic_noise_level
FROM sensor_readings sr
INNER JOIN sensor_configurations sc ON sr.sensor_id = sc.sensor_id
LEFT JOIN investigations i ON sr.investigation_id = i.id
LEFT JOIN investigation_sessions s ON sr.session_id = s.id
LEFT JOIN environmental_context ec ON ABS(sr.reading_time - ec.timestamp * 1000) < 300000 -- 5-minute window
WHERE sr.reading_time > (strftime('%s', 'now') - 3600) * 1000 -- Last hour
ORDER BY sr.reading_time DESC;

-- Sensor correlations summary view
CREATE VIEW vw_sensor_correlations_summary AS
SELECT 
    sc1.sensor_name as primary_sensor,
    sc2.sensor_name as secondary_sensor,
    scor.correlation_type,
    scor.correlation_coefficient,
    scor.correlation_strength,
    scor.statistical_significance,
    scor.sample_size,
    scor.calculated_at
FROM sensor_correlations scor
INNER JOIN sensor_configurations sc1 ON scor.primary_sensor_id = sc1.sensor_id
INNER JOIN sensor_configurations sc2 ON scor.secondary_sensor_id = sc2.sensor_id
WHERE ABS(scor.correlation_coefficient) > 0.3 -- Only show moderate+ correlations
ORDER BY ABS(scor.correlation_coefficient) DESC;

-- Alert summary view
CREATE VIEW vw_sensor_alerts_summary AS
SELECT 
    sa.*,
    sc.sensor_name,
    sc.sensor_type,
    u1.full_name as acknowledged_by_name,
    u2.full_name as resolved_by_name,
    i.name as investigation_name
FROM sensor_alerts sa
INNER JOIN sensor_configurations sc ON sa.sensor_id = sc.sensor_id
LEFT JOIN users u1 ON sa.acknowledged_by = u1.id
LEFT JOIN users u2 ON sa.resolved_by = u2.id
LEFT JOIN investigations i ON sa.investigation_id = i.id
ORDER BY sa.triggered_at DESC;