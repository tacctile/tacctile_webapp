import React, { useState, useEffect } from 'react';
import { DataPoint, HeatMapOptions, TimeRange, getDataVisualizationService } from '../../services/visualization/DataVisualizationService';
import { HEAT_MAP_PRESETS } from './HeatMapOverlay';

interface DataVisualizationPanelProps {
  onHeatMapToggle: (enabled: boolean, type: 'emf' | 'temperature' | 'audio' | 'motion' | 'all') => void;
  onActivityToggle: (enabled: boolean) => void;
  onTimeRangeChange: (range: TimeRange) => void;
  onOpacityChange: (opacity: number) => void;
  onOptionsChange: (options: Partial<HeatMapOptions>) => void;
  currentTimeRange: TimeRange;
  heatMapEnabled: boolean;
  activityEnabled: boolean;
  currentOpacity: number;
  selectedDataType: 'emf' | 'temperature' | 'audio' | 'motion' | 'all';
  onDataTypeChange: (type: 'emf' | 'temperature' | 'audio' | 'motion' | 'all') => void;
}

interface DataStatistics {
  totalPoints: number;
  timeSpan: number;
  dataTypes: string[];
  averageValue: number;
  peakValue: number;
}

export const DataVisualizationPanel: React.FC<DataVisualizationPanelProps> = ({
  onHeatMapToggle,
  onActivityToggle,
  onTimeRangeChange,
  onOpacityChange,
  onOptionsChange,
  currentTimeRange,
  heatMapEnabled,
  activityEnabled,
  currentOpacity,
  selectedDataType,
  onDataTypeChange
}) => {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [statistics, setStatistics] = useState<DataStatistics | null>(null);
  const [heatMapOptions, setHeatMapOptions] = useState<Partial<HeatMapOptions>>({
    radius: 25,
    maxOpacity: 0.8,
    minOpacity: 0.1,
    blur: 15,
    colorScale: 'viridis'
  });
  const [activityMode, setActivityMode] = useState<'intensity' | 'heatLevel' | 'eventCount' | 'combined'>('intensity');
  const [timeRangePreset, setTimeRangePreset] = useState<'all' | 'last-hour' | 'last-30min' | 'custom'>('all');
  const [showSampleData, setShowSampleData] = useState(false);

  // Load data statistics
  useEffect(() => {
    const loadStatistics = () => {
      try {
        const dataService = getDataVisualizationService();
        const dataTypes = dataService.getDataTypes();
        const stats = dataService.getDataStatistics(
          selectedDataType === 'all' ? undefined : selectedDataType,
          currentTimeRange
        );

        setStatistics({
          totalPoints: stats.count,
          timeSpan: stats.timeSpan,
          dataTypes,
          averageValue: stats.averageValue,
          peakValue: stats.maxValue
        });
      } catch (error) {
        console.error('Failed to load statistics:', error);
      }
    };

    loadStatistics();
  }, [selectedDataType, currentTimeRange]);

  const handleHeatMapOptionsChange = (key: keyof HeatMapOptions, value: string | number | Record<number, string>) => {
    const newOptions = { ...heatMapOptions, [key]: value };
    setHeatMapOptions(newOptions);
    onOptionsChange(newOptions);
  };

  const handlePresetApply = (presetType: keyof typeof HEAT_MAP_PRESETS) => {
    const preset = HEAT_MAP_PRESETS[presetType];
    const newOptions = {
      ...heatMapOptions,
      gradient: preset.gradient,
      colorScale: preset.colorScale,
      radius: preset.radius,
      blur: preset.blur
    };
    setHeatMapOptions(newOptions);
    onOptionsChange(newOptions);
    onDataTypeChange(presetType as 'emf' | 'temperature' | 'audio' | 'motion' | 'all');
  };

  const handleTimeRangePreset = (preset: string) => {
    setTimeRangePreset(preset as 'all' | 'last-hour' | 'last-30min' | 'custom');
    const now = new Date();
    
    switch (preset) {
      case 'last-hour':
        onTimeRangeChange({
          start: new Date(now.getTime() - 60 * 60 * 1000),
          end: now
        });
        break;
      case 'last-30min':
        onTimeRangeChange({
          start: new Date(now.getTime() - 30 * 60 * 1000),
          end: now
        });
        break;
      case 'all':
        // Set to full investigation range
        onTimeRangeChange({
          start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          end: now
        });
        break;
    }
  };

  const generateSampleData = () => {
    const dataService = getDataVisualizationService();
    
    // Clear existing data
    dataService.clearData();
    
    // Generate sample data for different types
    const emfData = dataService.generateSampleData(1200, 800, 'emf', 150);
    const tempData = dataService.generateSampleData(1200, 800, 'temperature', 100);
    
    dataService.addDataPoints([...emfData, ...tempData]);
    
    setShowSampleData(true);
    
    // Update time range to cover sample data
    const now = new Date();
    onTimeRangeChange({
      start: new Date(now.getTime() - 60 * 60 * 1000),
      end: now
    });
  };

  const clearAllData = () => {
    const dataService = getDataVisualizationService();
    dataService.clearData();
    setShowSampleData(false);
    setStatistics(null);
  };

  const exportVisualizationSettings = () => {
    const settings = {
      heatMapEnabled,
      activityEnabled,
      selectedDataType,
      heatMapOptions,
      activityMode,
      opacity: currentOpacity,
      timeRange: currentTimeRange,
      timestamp: new Date()
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visualization-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimeSpan = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="data-visualization-panel">
      <div className="panel-header">
        <h3>Data Visualization</h3>
        <button
          className="collapse-btn"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          title="Toggle Advanced Options"
        >
          {showAdvancedOptions ? '▼' : '▶'}
        </button>
      </div>

      {/* Main Visualization Controls */}
      <div className="visualization-controls">
        <div className="control-section">
          <h4>Heat Map Visualization</h4>
          
          <label className="control-row">
            <input
              type="checkbox"
              checked={heatMapEnabled}
              onChange={(e) => onHeatMapToggle(e.target.checked, selectedDataType)}
            />
            <span>Enable Heat Map</span>
          </label>

          <div className="data-type-selector">
            <label>Data Type:</label>
            <select
              value={selectedDataType}
              onChange={(e) => onDataTypeChange(e.target.value as 'emf' | 'temperature' | 'audio' | 'motion' | 'all')}
              disabled={!heatMapEnabled}
            >
              <option value="all">All Data</option>
              <option value="emf">EMF Readings</option>
              <option value="temperature">Temperature</option>
              <option value="audio">Audio Events</option>
              <option value="motion">Motion Detection</option>
            </select>
          </div>

          <div className="preset-buttons">
            <button
              className={`preset-btn ${selectedDataType === 'emf' ? 'active' : ''}`}
              onClick={() => handlePresetApply('emf')}
            >
              EMF
            </button>
            <button
              className={`preset-btn ${selectedDataType === 'temperature' ? 'active' : ''}`}
              onClick={() => handlePresetApply('temperature')}
            >
              Temp
            </button>
            <button
              className={`preset-btn ${selectedDataType === 'audio' ? 'active' : ''}`}
              onClick={() => handlePresetApply('audio')}
            >
              Audio
            </button>
            <button
              className={`preset-btn ${selectedDataType === 'motion' ? 'active' : ''}`}
              onClick={() => handlePresetApply('motion')}
            >
              Motion
            </button>
          </div>
        </div>

        <div className="control-section">
          <h4>Room Activity</h4>
          
          <label className="control-row">
            <input
              type="checkbox"
              checked={activityEnabled}
              onChange={(e) => onActivityToggle(e.target.checked)}
            />
            <span>Show Room Activity</span>
          </label>

          <div className="activity-mode-selector">
            <label>Activity Mode:</label>
            <select
              value={activityMode}
              onChange={(e) => setActivityMode(e.target.value as 'intensity' | 'heatLevel' | 'eventCount' | 'combined')}
              disabled={!activityEnabled}
            >
              <option value="intensity">Activity Intensity</option>
              <option value="heatLevel">Heat Level</option>
              <option value="eventCount">Event Count</option>
              <option value="combined">Combined</option>
            </select>
          </div>
        </div>

        <div className="control-section">
          <h4>Display Options</h4>
          
          <label className="control-row">
            Opacity: {Math.round(currentOpacity * 100)}%
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={currentOpacity}
              onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            />
          </label>
        </div>
      </div>

      {/* Time Range Controls */}
      <div className="time-range-section">
        <h4>Time Range</h4>
        
        <div className="time-preset-buttons">
          <button
            className={`time-preset-btn ${timeRangePreset === 'all' ? 'active' : ''}`}
            onClick={() => handleTimeRangePreset('all')}
          >
            All Time
          </button>
          <button
            className={`time-preset-btn ${timeRangePreset === 'last-hour' ? 'active' : ''}`}
            onClick={() => handleTimeRangePreset('last-hour')}
          >
            Last Hour
          </button>
          <button
            className={`time-preset-btn ${timeRangePreset === 'last-30min' ? 'active' : ''}`}
            onClick={() => handleTimeRangePreset('last-30min')}
          >
            Last 30min
          </button>
        </div>

        <div className="time-range-display">
          <span>
            {currentTimeRange.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' - '}
            {currentTimeRange.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Advanced Options */}
      {showAdvancedOptions && (
        <div className="advanced-options">
          <h4>Advanced Heat Map Options</h4>
          
          <div className="option-group">
            <label className="control-row">
              Radius: {heatMapOptions.radius}px
              <input
                type="range"
                min="5"
                max="100"
                value={heatMapOptions.radius || 25}
                onChange={(e) => handleHeatMapOptionsChange('radius', parseInt(e.target.value))}
              />
            </label>

            <label className="control-row">
              Blur: {heatMapOptions.blur}px
              <input
                type="range"
                min="0"
                max="50"
                value={heatMapOptions.blur || 15}
                onChange={(e) => handleHeatMapOptionsChange('blur', parseInt(e.target.value))}
              />
            </label>

            <label className="control-row">
              Max Opacity: {Math.round((heatMapOptions.maxOpacity || 0.8) * 100)}%
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={heatMapOptions.maxOpacity || 0.8}
                onChange={(e) => handleHeatMapOptionsChange('maxOpacity', parseFloat(e.target.value))}
              />
            </label>

            <div className="color-scale-selector">
              <label>Color Scale:</label>
              <select
                value={heatMapOptions.colorScale || 'viridis'}
                onChange={(e) => handleHeatMapOptionsChange('colorScale', e.target.value)}
              >
                <option value="viridis">Viridis</option>
                <option value="plasma">Plasma</option>
                <option value="inferno">Inferno</option>
                <option value="turbo">Turbo</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Data Statistics */}
      {statistics && (
        <div className="data-statistics">
          <h4>Data Statistics</h4>
          
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Points:</span>
              <span className="stat-value">{statistics.totalPoints.toLocaleString()}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Time Span:</span>
              <span className="stat-value">{formatTimeSpan(statistics.timeSpan)}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Data Types:</span>
              <span className="stat-value">{statistics.dataTypes.length}</span>
            </div>

            <div className="stat-item">
              <span className="stat-label">Average Value:</span>
              <span className="stat-value">{statistics.averageValue.toFixed(2)}</span>
            </div>

            <div className="stat-item">
              <span className="stat-label">Peak Value:</span>
              <span className="stat-value">{statistics.peakValue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Data Management */}
      <div className="data-management">
        <h4>Data Management</h4>
        
        <div className="management-buttons">
          <button
            className="management-btn sample"
            onClick={generateSampleData}
          >
            📊 Generate Sample Data
          </button>
          
          <button
            className="management-btn clear"
            onClick={clearAllData}
          >
            🗑️ Clear All Data
          </button>
          
          <button
            className="management-btn export"
            onClick={exportVisualizationSettings}
          >
            💾 Export Settings
          </button>
        </div>

        {showSampleData && (
          <div className="sample-data-info">
            <span>📊 Sample data active</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .data-visualization-panel {
          padding: 16px;
          background: var(--surface-secondary, #1e1e1e);
          height: 100%;
          overflow-y: auto;
          font-size: 0.875rem;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .panel-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
        }

        .collapse-btn {
          background: none;
          border: none;
          color: var(--text-secondary, #aaaaaa);
          cursor: pointer;
          font-size: 0.875rem;
          padding: 4px;
        }

        .visualization-controls,
        .time-range-section,
        .advanced-options,
        .data-statistics,
        .data-management {
          margin-bottom: 20px;
        }

        .control-section {
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .control-section:last-child {
          border-bottom: none;
        }

        .control-section h4,
        .time-range-section h4,
        .advanced-options h4,
        .data-statistics h4,
        .data-management h4 {
          margin: 0 0 12px 0;
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
          font-weight: 600;
        }

        .control-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          cursor: pointer;
          color: var(--text-primary, #ffffff);
        }

        .control-row input[type="checkbox"] {
          margin-right: 8px;
          accent-color: var(--accent-color, #bb86fc);
        }

        .control-row input[type="range"] {
          flex: 1;
          margin-left: 12px;
          accent-color: var(--accent-color, #bb86fc);
        }

        .data-type-selector,
        .activity-mode-selector,
        .color-scale-selector {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .data-type-selector select,
        .activity-mode-selector select,
        .color-scale-selector select {
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 4px;
          color: var(--text-primary, #ffffff);
          padding: 4px 8px;
          font-size: 0.8rem;
        }

        .preset-buttons,
        .time-preset-buttons {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 4px;
          margin-bottom: 12px;
        }

        .preset-btn,
        .time-preset-btn {
          padding: 6px 8px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 4px;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.75rem;
          transition: all 0.2s ease;
        }

        .preset-btn:hover,
        .time-preset-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .preset-btn.active,
        .time-preset-btn.active {
          background: var(--accent-color, #bb86fc);
          color: var(--surface-primary, #121212);
          border-color: var(--accent-color, #bb86fc);
        }

        .time-range-display {
          padding: 8px;
          background: var(--surface-tertiary, #2d2d2d);
          border-radius: 4px;
          text-align: center;
          font-family: 'Courier New', monospace;
          font-size: 0.8rem;
          color: var(--text-primary, #ffffff);
        }

        .option-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          background: var(--surface-tertiary, #2d2d2d);
          border-radius: 4px;
        }

        .stat-label {
          color: var(--text-secondary, #aaaaaa);
          font-size: 0.8rem;
        }

        .stat-value {
          color: var(--text-primary, #ffffff);
          font-weight: 500;
          font-family: 'Courier New', monospace;
          font-size: 0.8rem;
        }

        .management-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .management-btn {
          padding: 8px 12px;
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          background: var(--surface-tertiary, #2d2d2d);
          color: var(--text-primary, #ffffff);
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s ease;
          text-align: left;
        }

        .management-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .management-btn.sample {
          border-color: var(--accent-color, #bb86fc);
          color: var(--accent-color, #bb86fc);
        }

        .management-btn.clear {
          border-color: #ff6b6b;
          color: #ff6b6b;
        }

        .management-btn.export {
          border-color: #4CAF50;
          color: #4CAF50;
        }

        .sample-data-info {
          margin-top: 8px;
          padding: 6px 8px;
          background: rgba(187, 134, 252, 0.1);
          border-left: 3px solid var(--accent-color, #bb86fc);
          color: var(--accent-color, #bb86fc);
          font-size: 0.75rem;
        }

        /* Material 3 Dark Theme Variables */
        :root {
          --surface-primary: #121212;
          --surface-secondary: #1e1e1e;
          --surface-tertiary: #2d2d2d;
          --surface-hover: #3d3d3d;
          --text-primary: #ffffff;
          --text-secondary: #aaaaaa;
          --border-color: #333333;
          --accent-color: #bb86fc;
        }

        /* Scrollbar styling */
        .data-visualization-panel::-webkit-scrollbar {
          width: 6px;
        }

        .data-visualization-panel::-webkit-scrollbar-track {
          background: var(--surface-primary, #121212);
        }

        .data-visualization-panel::-webkit-scrollbar-thumb {
          background: var(--border-color, #333333);
          border-radius: 3px;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .data-visualization-panel {
            padding: 12px;
            font-size: 0.8rem;
          }
          
          .preset-buttons,
          .time-preset-buttons {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};