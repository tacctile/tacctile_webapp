import React, { useState, useEffect } from 'react';
import { InvestigatorProfile, getWebSocketService } from '../../services/realtime/WebSocketService';
import { getPositionTracker, PositionOptions } from '../../services/realtime/PositionTracker';

interface TeamPanelProps {
  currentInvestigator: InvestigatorProfile | null;
  onInvestigatorChange: (investigator: InvestigatorProfile) => void;
  onTrackingToggle: (enabled: boolean) => void;
  onTrackingOptionsChange: (options: Partial<PositionOptions>) => void;
  isTrackingEnabled: boolean;
}

interface TrackingSettings extends PositionOptions {
  showTrails: boolean;
  showNames: boolean;
  trailLength: number;
  autoCenter: boolean;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({
  currentInvestigator,
  onInvestigatorChange,
  onTrackingToggle,
  onTrackingOptionsChange,
  isTrackingEnabled
}) => {
  const [connectedInvestigators, setConnectedInvestigators] = useState<InvestigatorProfile[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddInvestigator, setShowAddInvestigator] = useState(false);
  const [trackingSettings, setTrackingSettings] = useState<TrackingSettings>({
    enableGPS: false,
    enableManualTracking: true,
    updateInterval: 1000,
    accuracy: 'medium',
    smoothing: true,
    showTrails: true,
    showNames: true,
    trailLength: 50,
    autoCenter: false
  });

  const [newInvestigator, setNewInvestigator] = useState({
    name: '',
    role: '',
    color: '#2196F3',
    deviceType: 'desktop' as 'mobile' | 'tablet' | 'desktop'
  });

  useEffect(() => {
    const wsService = getWebSocketService();
    const positionTracker = getPositionTracker();

    const handleInvestigatorJoined = (investigator: InvestigatorProfile) => {
      setConnectedInvestigators(prev => {
        const filtered = prev.filter(inv => inv.id !== investigator.id);
        return [...filtered, investigator];
      });
    };

    const handleInvestigatorLeft = (investigatorId: string) => {
      setConnectedInvestigators(prev => prev.filter(inv => inv.id !== investigatorId));
    };

    const handleStatusUpdate = (investigator: InvestigatorProfile) => {
      setConnectedInvestigators(prev => 
        prev.map(inv => inv.id === investigator.id ? investigator : inv)
      );
    };

    const handleWebSocketConnected = () => {
      setConnectionStatus('connected');
      // Load existing investigators
      const existing = wsService.getConnectedInvestigators();
      setConnectedInvestigators(existing);
    };

    const handleWebSocketDisconnected = () => {
      setConnectionStatus('disconnected');
    };

    const handleWebSocketError = (error: Error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    // Bind events
    wsService.on('investigator_joined', handleInvestigatorJoined);
    wsService.on('investigator_left', handleInvestigatorLeft);
    wsService.on('status_update', handleStatusUpdate);
    wsService.on('connected', handleWebSocketConnected);
    wsService.on('disconnected', handleWebSocketDisconnected);
    wsService.on('error', handleWebSocketError);

    positionTracker.on('websocket_connected', handleWebSocketConnected);
    positionTracker.on('websocket_disconnected', handleWebSocketDisconnected);
    positionTracker.on('websocket_error', handleWebSocketError);

    return () => {
      wsService.off('investigator_joined', handleInvestigatorJoined);
      wsService.off('investigator_left', handleInvestigatorLeft);
      wsService.off('status_update', handleStatusUpdate);
      wsService.off('connected', handleWebSocketConnected);
      wsService.off('disconnected', handleWebSocketDisconnected);
      wsService.off('error', handleWebSocketError);

      positionTracker.off('websocket_connected', handleWebSocketConnected);
      positionTracker.off('websocket_disconnected', handleWebSocketDisconnected);
      positionTracker.off('websocket_error', handleWebSocketError);
    };
  }, []);

  const handleStartTracking = async () => {
    if (!currentInvestigator) {
      // Create a default investigator if none exists
      const defaultInvestigator: InvestigatorProfile = {
        id: `investigator-${Date.now()}`,
        name: 'Current User',
        role: 'Investigator',
        color: '#2196F3',
        deviceType: 'desktop',
        status: 'online',
        lastSeen: new Date()
      };
      onInvestigatorChange(defaultInvestigator);
    }

    try {
      setConnectionStatus('connecting');
      const positionTracker = getPositionTracker();
      if (currentInvestigator) {
        await positionTracker.startTracking(currentInvestigator, trackingSettings);
      }
      onTrackingToggle(true);
    } catch (error) {
      console.error('Failed to start tracking:', error);
      setConnectionStatus('disconnected');
    }
  };

  const handleStopTracking = () => {
    const positionTracker = getPositionTracker();
    positionTracker.stopTracking();
    onTrackingToggle(false);
    setConnectionStatus('disconnected');
  };

  const handleAddInvestigator = () => {
    if (!newInvestigator.name.trim()) return;

    const investigator: InvestigatorProfile = {
      id: `investigator-${Date.now()}`,
      name: newInvestigator.name,
      role: newInvestigator.role || 'Investigator',
      color: newInvestigator.color,
      deviceType: newInvestigator.deviceType,
      status: 'online',
      lastSeen: new Date()
    };

    onInvestigatorChange(investigator);
    setNewInvestigator({ name: '', role: '', color: '#2196F3', deviceType: 'desktop' });
    setShowAddInvestigator(false);
  };

  const handleSettingsChange = (setting: keyof TrackingSettings, value: boolean | number | string) => {
    const newSettings = { ...trackingSettings, [setting]: value };
    setTrackingSettings(newSettings);
    onTrackingOptionsChange(newSettings);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'away': return '🟡';
      case 'offline': return '🔴';
      default: return '⚪';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'disconnected': return '🔴';
      default: return '⚪';
    }
  };

  const presetColors = [
    '#2196F3', '#4CAF50', '#FF9800', '#F44336',
    '#9C27B0', '#00BCD4', '#795548', '#607D8B'
  ];

  return (
    <div className="team-panel">
      <div className="panel-header">
        <h3>Team Tracking</h3>
        <div className="connection-status">
          <span className="status-icon">{getConnectionStatusIcon()}</span>
          <span className="status-text">
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </span>
        </div>
      </div>

      {/* Current Investigator Section */}
      <div className="current-investigator-section">
        <h4>Your Profile</h4>
        {currentInvestigator ? (
          <div className="investigator-card current">
            <div className="investigator-info">
              <div 
                className="investigator-color" 
                style={{ backgroundColor: currentInvestigator.color }}
              />
              <div className="investigator-details">
                <span className="investigator-name">{currentInvestigator.name}</span>
                <span className="investigator-role">{currentInvestigator.role}</span>
              </div>
              <div className="investigator-status">
                {getStatusIcon(currentInvestigator.status)}
              </div>
            </div>
            <div className="investigator-actions">
              <button
                className="edit-btn"
                onClick={() => setShowAddInvestigator(true)}
                title="Edit Profile"
              >
                ✏️
              </button>
            </div>
          </div>
        ) : (
          <button
            className="add-investigator-btn"
            onClick={() => setShowAddInvestigator(true)}
          >
            ➕ Set Up Profile
          </button>
        )}
      </div>

      {/* Tracking Controls */}
      <div className="tracking-controls">
        <div className="control-row">
          {!isTrackingEnabled ? (
            <button
              className="start-tracking-btn"
              onClick={handleStartTracking}
              disabled={!currentInvestigator || connectionStatus === 'connecting'}
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : '📍 Start Tracking'}
            </button>
          ) : (
            <button
              className="stop-tracking-btn"
              onClick={handleStopTracking}
            >
              ⏹️ Stop Tracking
            </button>
          )}
          
          <button
            className="settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Tracking Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Team Members List */}
      <div className="team-members">
        <div className="team-header">
          <h4>Team Members ({connectedInvestigators.length})</h4>
        </div>
        
        <div className="investigators-list">
          {connectedInvestigators.length === 0 ? (
            <div className="empty-state">
              <span>No team members connected</span>
              <p>Start tracking to see other investigators</p>
            </div>
          ) : (
            connectedInvestigators.map(investigator => (
              <div key={investigator.id} className="investigator-card">
                <div className="investigator-info">
                  <div 
                    className="investigator-color" 
                    style={{ backgroundColor: investigator.color }}
                  />
                  <div className="investigator-details">
                    <span className="investigator-name">{investigator.name}</span>
                    <span className="investigator-role">{investigator.role}</span>
                    <span className="device-type">{investigator.deviceType}</span>
                  </div>
                  <div className="investigator-status">
                    {getStatusIcon(investigator.status)}
                  </div>
                </div>
                <div className="investigator-actions">
                  <button
                    className="locate-btn"
                    title="Locate on Blueprint"
                  >
                    🎯
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h4>Tracking Settings</h4>
            <button onClick={() => setShowSettings(false)}>✕</button>
          </div>
          
          <div className="settings-content">
            <div className="setting-group">
              <h5>Position Tracking</h5>
              <label className="setting-row">
                <input
                  type="checkbox"
                  checked={trackingSettings.enableGPS}
                  onChange={(e) => handleSettingsChange('enableGPS', e.target.checked)}
                />
                Enable GPS Tracking
              </label>
              <label className="setting-row">
                <input
                  type="checkbox"
                  checked={trackingSettings.enableManualTracking}
                  onChange={(e) => handleSettingsChange('enableManualTracking', e.target.checked)}
                />
                Enable Manual Tracking
              </label>
              <label className="setting-row">
                <input
                  type="checkbox"
                  checked={trackingSettings.smoothing}
                  onChange={(e) => handleSettingsChange('smoothing', e.target.checked)}
                />
                Position Smoothing
              </label>
            </div>

            <div className="setting-group">
              <h5>Visualization</h5>
              <label className="setting-row">
                <input
                  type="checkbox"
                  checked={trackingSettings.showTrails}
                  onChange={(e) => handleSettingsChange('showTrails', e.target.checked)}
                />
                Show Movement Trails
              </label>
              <label className="setting-row">
                <input
                  type="checkbox"
                  checked={trackingSettings.showNames}
                  onChange={(e) => handleSettingsChange('showNames', e.target.checked)}
                />
                Show Investigator Names
              </label>
              <label className="setting-row">
                Trail Length:
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={trackingSettings.trailLength}
                  onChange={(e) => handleSettingsChange('trailLength', parseInt(e.target.value))}
                />
                <span>{trackingSettings.trailLength}</span>
              </label>
            </div>

            <div className="setting-group">
              <h5>Update Frequency</h5>
              <label className="setting-row">
                <select
                  value={trackingSettings.updateInterval}
                  onChange={(e) => handleSettingsChange('updateInterval', parseInt(e.target.value))}
                >
                  <option value={500}>High (0.5s)</option>
                  <option value={1000}>Medium (1s)</option>
                  <option value={2000}>Low (2s)</option>
                  <option value={5000}>Very Low (5s)</option>
                </select>
                Update Interval
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Add Investigator Modal */}
      {showAddInvestigator && (
        <div className="modal-overlay" onClick={() => setShowAddInvestigator(false)}>
          <div className="add-investigator-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{currentInvestigator ? 'Edit Profile' : 'Add Investigator'}</h3>
              <button onClick={() => setShowAddInvestigator(false)}>✕</button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newInvestigator.name}
                  onChange={(e) => setNewInvestigator(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter investigator name"
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <input
                  type="text"
                  value={newInvestigator.role}
                  onChange={(e) => setNewInvestigator(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g., Lead Investigator, EMF Specialist"
                />
              </div>

              <div className="form-group">
                <label>Color</label>
                <div className="color-picker">
                  {presetColors.map(color => (
                    <button
                      key={color}
                      className={`color-option ${newInvestigator.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewInvestigator(prev => ({ ...prev, color }))}
                    />
                  ))}
                  <input
                    type="color"
                    value={newInvestigator.color}
                    onChange={(e) => setNewInvestigator(prev => ({ ...prev, color: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Device Type</label>
                <select
                  value={newInvestigator.deviceType}
                  onChange={(e) => setNewInvestigator(prev => ({ 
                    ...prev, 
                    deviceType: e.target.value as 'mobile' | 'tablet' | 'desktop'
                  }))}
                >
                  <option value="desktop">Desktop</option>
                  <option value="tablet">Tablet</option>
                  <option value="mobile">Mobile</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowAddInvestigator(false)}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleAddInvestigator}
                disabled={!newInvestigator.name.trim()}
              >
                {currentInvestigator ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .team-panel {
          padding: 16px;
          background: var(--surface-secondary, #1e1e1e);
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
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

        .connection-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-secondary, #aaaaaa);
        }

        .status-icon {
          font-size: 0.7rem;
        }

        .current-investigator-section {
          margin-bottom: 20px;
        }

        .current-investigator-section h4 {
          margin: 0 0 12px 0;
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
          font-weight: 600;
        }

        .investigator-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .investigator-card.current {
          border-color: var(--accent-color, #bb86fc);
          background: rgba(187, 134, 252, 0.05);
        }

        .investigator-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }

        .investigator-color {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .investigator-details {
          flex: 1;
          min-width: 0;
        }

        .investigator-name {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary, #ffffff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .investigator-role,
        .device-type {
          display: block;
          font-size: 0.75rem;
          color: var(--text-secondary, #aaaaaa);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .investigator-status {
          font-size: 0.8rem;
        }

        .investigator-actions {
          display: flex;
          gap: 4px;
        }

        .edit-btn,
        .locate-btn {
          width: 24px;
          height: 24px;
          background: transparent;
          border: 1px solid var(--border-color, #444444);
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.75rem;
          transition: all 0.2s ease;
        }

        .edit-btn:hover,
        .locate-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .add-investigator-btn {
          width: 100%;
          padding: 12px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 2px dashed var(--border-color, #444444);
          border-radius: 8px;
          color: var(--text-secondary, #aaaaaa);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .add-investigator-btn:hover {
          border-color: var(--accent-color, #bb86fc);
          color: var(--accent-color, #bb86fc);
        }

        .tracking-controls {
          margin-bottom: 20px;
        }

        .control-row {
          display: flex;
          gap: 8px;
        }

        .start-tracking-btn,
        .stop-tracking-btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .start-tracking-btn {
          background: var(--accent-color, #bb86fc);
          color: var(--surface-primary, #121212);
        }

        .start-tracking-btn:hover:not(:disabled) {
          background: var(--accent-hover, #985eff);
        }

        .start-tracking-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .stop-tracking-btn {
          background: #ff6b6b;
          color: white;
        }

        .stop-tracking-btn:hover {
          background: #ff5252;
        }

        .settings-btn {
          width: 40px;
          padding: 10px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .settings-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .team-members {
          flex: 1;
        }

        .team-header {
          margin-bottom: 12px;
        }

        .team-header h4 {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
          font-weight: 600;
        }

        .investigators-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .empty-state {
          text-align: center;
          padding: 20px;
          color: var(--text-secondary, #aaaaaa);
        }

        .empty-state span {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .empty-state p {
          margin: 8px 0 0 0;
          font-size: 0.75rem;
        }

        .settings-panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--surface-primary, #121212);
          border: 1px solid var(--border-color, #333333);
          border-radius: 12px;
          width: 400px;
          max-width: 90vw;
          max-height: 80vh;
          overflow-y: auto;
          z-index: 1000;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .settings-header h4 {
          margin: 0;
          font-size: 1rem;
          color: var(--text-primary, #ffffff);
        }

        .settings-content {
          padding: 16px;
        }

        .setting-group {
          margin-bottom: 20px;
        }

        .setting-group h5 {
          margin: 0 0 12px 0;
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
          font-weight: 600;
        }

        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
          cursor: pointer;
        }

        .setting-row input[type="checkbox"] {
          margin-right: 8px;
          accent-color: var(--accent-color, #bb86fc);
        }

        .setting-row input[type="range"] {
          flex: 1;
          margin: 0 8px;
          accent-color: var(--accent-color, #bb86fc);
        }

        .setting-row select {
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 4px;
          color: var(--text-primary, #ffffff);
          padding: 4px 8px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .add-investigator-modal {
          background: var(--surface-primary, #121212);
          border: 1px solid var(--border-color, #333333);
          border-radius: 12px;
          width: 400px;
          max-width: 90vw;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--border-color, #333333);
        }

        .modal-header h3 {
          margin: 0;
          font-size: 1rem;
          color: var(--text-primary, #ffffff);
        }

        .modal-content {
          padding: 16px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-primary, #ffffff);
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 8px 12px;
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 6px;
          color: var(--text-primary, #ffffff);
          font-size: 0.875rem;
        }

        .color-picker {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .color-option {
          width: 24px;
          height: 24px;
          border: 2px solid transparent;
          border-radius: 4px;
          cursor: pointer;
          transition: border-color 0.2s ease;
        }

        .color-option.selected {
          border-color: #ffffff;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-top: 1px solid var(--border-color, #333333);
        }

        .cancel-btn,
        .save-btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-btn {
          background: var(--surface-tertiary, #2d2d2d);
          color: var(--text-primary, #ffffff);
          border: 1px solid var(--border-color, #444444);
        }

        .cancel-btn:hover {
          background: var(--surface-hover, #3d3d3d);
        }

        .save-btn {
          background: var(--accent-color, #bb86fc);
          color: var(--surface-primary, #121212);
        }

        .save-btn:hover:not(:disabled) {
          background: var(--accent-hover, #985eff);
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
          --accent-hover: #985eff;
        }

        /* Scrollbar styling */
        .team-panel::-webkit-scrollbar,
        .investigators-list::-webkit-scrollbar,
        .settings-panel::-webkit-scrollbar {
          width: 6px;
        }

        .team-panel::-webkit-scrollbar-track,
        .investigators-list::-webkit-scrollbar-track,
        .settings-panel::-webkit-scrollbar-track {
          background: var(--surface-primary, #121212);
        }

        .team-panel::-webkit-scrollbar-thumb,
        .investigators-list::-webkit-scrollbar-thumb,
        .settings-panel::-webkit-scrollbar-thumb {
          background: var(--border-color, #333333);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};