import React from 'react';
import { SocialPlatform, ConnectionStatus } from './types';

interface SocialPlatformCardProps {
  platform: SocialPlatform;
  status: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const SocialPlatformCard: React.FC<SocialPlatformCardProps> = ({
  platform,
  status,
  onConnect,
  onDisconnect,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#22c55e';
      case 'connecting': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Failed';
      default: return 'Not Connected';
    }
  };

  const getActionButton = () => {
    if (status === 'connected') {
      return (
        <button 
          className="disconnect-btn"
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      );
    }
    
    if (status === 'connecting') {
      return (
        <button className="connecting-btn" disabled>
          <span className="spinner"></span>
          Connecting...
        </button>
      );
    }

    return (
      <button 
        className="connect-btn"
        onClick={onConnect}
        disabled={status === 'error'}
      >
        {status === 'error' ? 'Retry Connection' : 'Connect'}
      </button>
    );
  };

  return (
    <div className={`platform-card ${status}`}>
      <div className="platform-header">
        <div className="platform-icon" style={{ color: platform.color }}>
          {platform.icon}
        </div>
        <div className="platform-info">
          <h3>{platform.name}</h3>
          <div 
            className="status-indicator"
            style={{ color: getStatusColor() }}
          >
            {getStatusText()}
          </div>
        </div>
      </div>
      
      <p className="platform-description">{platform.description}</p>
      
      <div className="platform-actions">
        {getActionButton()}
        
        {status === 'connected' && (
          <button className="settings-btn">
            Settings
          </button>
        )}
      </div>

      {status === 'error' && (
        <div className="error-message">
          Failed to connect. Please check your credentials and try again.
        </div>
      )}
    </div>
  );
};