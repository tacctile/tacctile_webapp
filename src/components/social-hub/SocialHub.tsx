import React, { useState, useEffect } from 'react';
import { SocialPlatformCard } from './SocialPlatformCard';
import { ConnectionStatus } from './types';
import { accountManager } from '../../services/social/AccountManager';

interface SocialHubProps {
  className?: string;
}

export const SocialHub: React.FC<SocialHubProps> = ({ className }) => {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({
    twitter: 'disconnected',
    reddit: 'disconnected',
    youtube: 'disconnected',
    facebook: 'disconnected',
  });
  
  useEffect(() => {
    // Initialize connection statuses from AccountManager
    const platforms = ['twitter', 'reddit', 'youtube', 'facebook'];
    const initialStatuses: Record<string, ConnectionStatus> = {};
    
    platforms.forEach(platform => {
      initialStatuses[platform] = accountManager.getConnectionStatus(platform);
    });
    
    setConnections(initialStatuses);
    
    // Listen for connection status changes
    const handleStatusChange = (event: CustomEvent) => {
      const { platform, status } = event.detail;
      setConnections(prev => ({ ...prev, [platform]: status }));
    };
    
    window.addEventListener('socialConnectionStatusChanged', handleStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('socialConnectionStatusChanged', handleStatusChange as EventListener);
    };
  }, []);

  const handleConnect = async (platform: string) => {
    try {
      // For demo purposes, show a simple connection dialog
      // In a real app, this would open a proper OAuth flow or credentials dialog
      const credentials = await getCredentialsForPlatform(platform);
      if (credentials) {
        await accountManager.connect(platform, credentials);
      }
    } catch (error) {
      console.error(`Failed to connect to ${platform}:`, error);
      // Status will be updated via the event listener
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      await accountManager.disconnect(platform);
    } catch (error) {
      console.error(`Failed to disconnect from ${platform}:`, error);
    }
  };
  
  // Demo function to get credentials - in real app this would be a proper form/OAuth flow
  const getCredentialsForPlatform = async (platform: string): Promise<Record<string, unknown>> => {
    // This is a placeholder - in a real app you'd open a proper credential input form
    return new Promise((resolve) => {
      const mock = true; // Set to false to actually prompt for credentials
      
      if (mock) {
        // Return mock credentials for demo
        setTimeout(() => {
          resolve({
            platform,
            clientId: 'demo-client-id',
            clientSecret: 'demo-client-secret',
            ...(platform === 'reddit' && { username: 'demo-user' }),
            ...(platform === 'youtube' && { apiKey: 'demo-api-key' }),
          });
        }, 1000);
      } else {
        // In a real implementation, you'd show a credential input dialog
        resolve(null);
      }
    });
  };

  const platforms = [
    {
      id: 'twitter',
      name: 'Twitter/X',
      description: 'Share evidence and connect with paranormal community',
      icon: '𝕏',
      color: '#000000',
    },
    {
      id: 'reddit',
      name: 'Reddit',
      description: 'Post to paranormal subreddits and discuss findings',
      icon: '🔴',
      color: '#FF4500',
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Upload video evidence and create playlists',
      icon: '▶️',
      color: '#FF0000',
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Share with ghost hunting groups and pages',
      icon: '📘',
      color: '#1877F2',
    },
  ];

  return (
    <div className={`social-hub ${className || ''}`}>
      <div className="social-hub-header">
        <h1>Social Hub</h1>
        <p>Connect your social media accounts to share evidence and engage with the community</p>
      </div>

      <div className="platforms-grid">
        {platforms.map(platform => (
          <SocialPlatformCard
            key={platform.id}
            platform={platform}
            status={connections[platform.id]}
            onConnect={() => handleConnect(platform.id)}
            onDisconnect={() => handleDisconnect(platform.id)}
          />
        ))}
      </div>

      <div className="social-hub-stats">
        <div className="stat-card">
          <h3>Connected Accounts</h3>
          <div className="stat-value">
            {Object.values(connections).filter(status => status === 'connected').length}
          </div>
        </div>
        <div className="stat-card">
          <h3>Recent Shares</h3>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-card">
          <h3>Community Engagement</h3>
          <div className="stat-value">--</div>
        </div>
      </div>
    </div>
  );
};