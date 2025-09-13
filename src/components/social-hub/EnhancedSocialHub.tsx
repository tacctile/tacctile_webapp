import React, { useState, useEffect } from 'react';
import { SocialPlatformCard } from './SocialPlatformCard';
import { ConnectionStatus } from './types';
import { accountManager } from '../../services/social/AccountManager';
import { mediaOptimizer } from '../../services/media/MediaOptimizer';
import { postScheduler } from '../../services/social/PostScheduler';
import { postTemplateManager, InvestigationMetadata, EvidenceData } from '../../services/social/PostTemplates';
import { socialAnalytics } from '../../services/social/SocialAnalytics';

interface EnhancedSocialHubProps {
  className?: string;
}

interface PostCreationData {
  mediaFile?: File;
  caption: string;
  hashtags: string[];
  selectedPlatforms: string[];
  scheduledTime?: Date;
  useTemplate?: string;
  evidenceData?: EvidenceData;
  investigationMetadata?: InvestigationMetadata;
}

export const EnhancedSocialHub: React.FC<EnhancedSocialHubProps> = ({ className }) => {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({
    twitter: 'disconnected',
    reddit: 'disconnected',
    youtube: 'disconnected',
    facebook: 'disconnected',
    instagram: 'disconnected',
    tiktok: 'disconnected',
  });

  const [activeTab, setActiveTab] = useState<'platforms' | 'post' | 'schedule' | 'analytics'>('platforms');
  const [postData, setPostData] = useState<PostCreationData>({
    caption: '',
    hashtags: [],
    selectedPlatforms: []
  });

  const [scheduledPosts, setScheduledPosts] = useState<unknown[]>([]);
  const [analyticsData, setAnalyticsData] = useState<unknown>(null);
  const [templates, setTemplates] = useState<unknown[]>([]);
  // const [presets, setPresets] = useState<Record<string, unknown>>({});

  useEffect(() => {
    initializeSocialHub();
  }, []);

  const initializeSocialHub = async () => {
    // Initialize connection statuses
    const platforms = Object.keys(connections);
    const initialStatuses: Record<string, ConnectionStatus> = {};
    
    platforms.forEach(platform => {
      initialStatuses[platform] = accountManager.getConnectionStatus(platform);
    });
    
    setConnections(initialStatuses);

    // Load templates
    const allTemplates = postTemplateManager.getTemplates();
    setTemplates(allTemplates);

    // Load media presets
    const allPresets = mediaOptimizer.getAllPresets();
    setPresets(allPresets);

    // Load scheduled posts
    const scheduled = await postScheduler.getScheduledPosts();
    setScheduledPosts(scheduled);

    // Listen for connection status changes
    const handleStatusChange = (event: CustomEvent) => {
      const { platform, status } = event.detail;
      setConnections(prev => ({ ...prev, [platform]: status }));
    };
    
    window.addEventListener('socialConnectionStatusChanged', handleStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('socialConnectionStatusChanged', handleStatusChange as EventListener);
    };
  };

  const handleConnect = async (platform: string) => {
    try {
      const credentials = await getCredentialsForPlatform(platform);
      if (credentials) {
        await accountManager.connect(platform, credentials);
      }
    } catch (error) {
      console.error(`Failed to connect to ${platform}:`, error);
    }
  };

  const handleDisconnect = async (platform: string) => {
    try {
      await accountManager.disconnect(platform);
    } catch (error) {
      console.error(`Failed to disconnect from ${platform}:`, error);
    }
  };

  const getCredentialsForPlatform = async (platform: string): Promise<{ platform: string; clientId: string; clientSecret: string; accessToken: string }> => {
    return new Promise((resolve) => {
      const mock = true;
      
      if (mock) {
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
        resolve(null);
      }
    });
  };

  const handleCreatePost = async () => {
    try {
      if (postData.selectedPlatforms.length === 0) {
        alert('Please select at least one platform');
        return;
      }

      // Generate posts using templates if evidence data is provided
      if (postData.evidenceData && postData.investigationMetadata) {
        const _posts = postTemplateManager.generatePostsForAllPlatforms(
          postData.investigationMetadata,
          postData.evidenceData
        );
        // Posts would be used here for display
        console.log('Generated posts:', _posts?.length || 0);
      } else {
        // Create basic posts for selected platforms
        // posts = postData.selectedPlatforms.map(platform => ({
        //   platform,
        //   caption: postData.caption,
        //   hashtags: postData.hashtags
        // }));
      }

      // Schedule or post immediately
      const postIds = await postScheduler.scheduleBulkPosts({
        platforms: postData.selectedPlatforms,
        content: {
          caption: postData.caption,
          hashtags: postData.hashtags,
          mediaPath: postData.mediaFile ? URL.createObjectURL(postData.mediaFile) : undefined
        },
        scheduledTimes: postData.scheduledTime ? [postData.scheduledTime] : undefined,
        optimizeForEachPlatform: true
      });

      console.log('Posts scheduled:', postIds);
      
      // Refresh scheduled posts
      const updated = await postScheduler.getScheduledPosts();
      setScheduledPosts(updated);
      
      // Reset form
      setPostData({
        caption: '',
        hashtags: [],
        selectedPlatforms: []
      });

      alert('Posts scheduled successfully!');
    } catch (error) {
      console.error('Failed to create posts:', error);
      alert('Failed to create posts. Please try again.');
    }
  };

  // const handleMediaOptimization = async (_file: File, _platforms: string[]) => {
  //   try {
  //     const tempPath = URL.createObjectURL(file);
  //     const results = await mediaOptimizer.batchOptimize(
  //       [tempPath],
  //       platforms.map(p => `${p}-square`), // Use square presets
  //       {
  //         onProgress: (current, total, currentFile) => {
  //           console.log(`Optimizing ${currentFile}: ${current}/${total}`);
  //         }
  //       }
  //     );

  //     return results;
  //   } catch (error) {
  //     console.error('Media optimization failed:', error);
  //     return [];
  //   }
  // };

  const loadAnalytics = async (platform: string) => {
    try {
      const summary = await socialAnalytics.getAnalyticsSummary(platform, 'month');
      const recommendations = await socialAnalytics.generateRecommendations(platform);
      
      setAnalyticsData({
        summary,
        recommendations
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
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
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Share photos and stories with the community',
      icon: '📷',
      color: '#E4405F',
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      description: 'Create viral paranormal content',
      icon: '🎵',
      color: '#000000',
    },
  ];

  const renderPlatformsTab = () => (
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
  );

  const renderPostCreationTab = () => (
    <div className="post-creation">
      <h2>Create New Post</h2>
      
      <div className="form-group">
        <label>Select Platforms:</label>
        <div className="platform-selector">
          {platforms.map(platform => (
            <label key={platform.id} className="platform-checkbox">
              <input
                type="checkbox"
                checked={postData.selectedPlatforms.includes(platform.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setPostData(prev => ({
                      ...prev,
                      selectedPlatforms: [...prev.selectedPlatforms, platform.id]
                    }));
                  } else {
                    setPostData(prev => ({
                      ...prev,
                      selectedPlatforms: prev.selectedPlatforms.filter(p => p !== platform.id)
                    }));
                  }
                }}
              />
              {platform.name}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Media File:</label>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setPostData(prev => ({ ...prev, mediaFile: file }));
            }
          }}
        />
      </div>

      <div className="form-group">
        <label>Caption:</label>
        <textarea
          value={postData.caption}
          onChange={(e) => setPostData(prev => ({ ...prev, caption: e.target.value }))}
          placeholder="Write your post caption..."
          rows={4}
        />
      </div>

      <div className="form-group">
        <label>Hashtags:</label>
        <input
          type="text"
          value={postData.hashtags.join(' ')}
          onChange={(e) => {
            const hashtags = e.target.value.split(' ').filter(tag => tag.trim());
            setPostData(prev => ({ ...prev, hashtags }));
          }}
          placeholder="#paranormal #ghosthunting #evidence"
        />
      </div>

      <div className="form-group">
        <label>Schedule For Later:</label>
        <input
          type="datetime-local"
          onChange={(e) => {
            const date = e.target.value ? new Date(e.target.value) : undefined;
            setPostData(prev => ({ ...prev, scheduledTime: date }));
          }}
        />
      </div>

      <div className="form-group">
        <label>Use Template:</label>
        <select
          onChange={(e) => {
            const templateId = e.target.value;
            if (templateId) {
              const template = templates.find(t => t.id === templateId);
              if (template) {
                setPostData(prev => ({
                  ...prev,
                  caption: template.template,
                  hashtags: template.hashtags
                }));
              }
            }
          }}
        >
          <option value="">No template</option>
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.platform})
            </option>
          ))}
        </select>
      </div>

      <button onClick={handleCreatePost} className="create-post-btn">
        {postData.scheduledTime ? 'Schedule Post' : 'Post Now'}
      </button>
    </div>
  );

  const renderScheduleTab = () => (
    <div className="schedule-tab">
      <h2>Scheduled Posts</h2>
      
      <div className="scheduled-posts">
        {scheduledPosts.map(post => (
          <div key={post.id} className="scheduled-post-card">
            <div className="post-header">
              <span className="platform">{post.platform}</span>
              <span className={`status ${post.status}`}>{post.status}</span>
            </div>
            <div className="post-content">
              <p>{post.content.caption.substring(0, 100)}...</p>
              <div className="post-meta">
                <span>Scheduled: {new Date(post.scheduledTime).toLocaleString()}</span>
                <span>Attempts: {post.attempts}/{post.maxAttempts}</span>
              </div>
            </div>
            <div className="post-actions">
              <button onClick={() => postScheduler.cancelScheduledPost(post.id)}>
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="analytics-tab">
      <h2>Analytics Dashboard</h2>
      
      <div className="platform-analytics">
        {platforms.map(platform => (
          <button
            key={platform.id}
            className="analytics-platform-btn"
            onClick={() => loadAnalytics(platform.id)}
          >
            {platform.name}
          </button>
        ))}
      </div>

      {analyticsData && (
        <div className="analytics-data">
          <div className="summary-cards">
            <div className="summary-card">
              <h3>Total Posts</h3>
              <div className="stat-value">{analyticsData.summary.totalPosts}</div>
            </div>
            <div className="summary-card">
              <h3>Total Engagement</h3>
              <div className="stat-value">{analyticsData.summary.totalEngagement}</div>
            </div>
            <div className="summary-card">
              <h3>Avg Engagement</h3>
              <div className="stat-value">{analyticsData.summary.averageEngagement.toFixed(1)}</div>
            </div>
            <div className="summary-card">
              <h3>Follower Growth</h3>
              <div className="stat-value">{analyticsData.summary.followerGrowth}</div>
            </div>
          </div>

          <div className="recommendations">
            <h3>Recommendations</h3>
            
            <div className="rec-section">
              <h4>Best Posting Times</h4>
              <ul>
                {analyticsData.recommendations.bestPostingTimes.map((time, index) => (
                  <li key={index}>
                    {time.day} at {time.hour}:00 (confidence: {Math.round(time.confidence * 100)}%)
                  </li>
                ))}
              </ul>
            </div>

            <div className="rec-section">
              <h4>Recommended Hashtags</h4>
              <ul>
                {analyticsData.recommendations.recommendedHashtags.map((hashtag, index) => (
                  <li key={index}>
                    {hashtag.hashtag} - {hashtag.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`enhanced-social-hub ${className || ''}`}>
      <div className="social-hub-header">
        <h1>Enhanced Social Hub</h1>
        <p>Professional social media management for paranormal investigators</p>
      </div>

      <div className="hub-navigation">
        <button
          className={`nav-button ${activeTab === 'platforms' ? 'active' : ''}`}
          onClick={() => setActiveTab('platforms')}
        >
          Platforms
        </button>
        <button
          className={`nav-button ${activeTab === 'post' ? 'active' : ''}`}
          onClick={() => setActiveTab('post')}
        >
          Create Post
        </button>
        <button
          className={`nav-button ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Scheduled
        </button>
        <button
          className={`nav-button ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      <div className="hub-content">
        {activeTab === 'platforms' && renderPlatformsTab()}
        {activeTab === 'post' && renderPostCreationTab()}
        {activeTab === 'schedule' && renderScheduleTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
      </div>

      <style jsx>{`
        .enhanced-social-hub {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .hub-navigation {
          display: flex;
          gap: 8px;
          margin-bottom: 32px;
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }

        .nav-button {
          padding: 12px 24px;
          background: none;
          border: none;
          font-weight: 500;
          color: var(--text-secondary, #6b7280);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .nav-button:hover {
          color: var(--text-primary, #1f2937);
        }

        .nav-button.active {
          color: var(--primary, #3b82f6);
          border-bottom-color: var(--primary, #3b82f6);
        }

        .hub-content {
          min-height: 600px;
        }

        .post-creation {
          max-width: 800px;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: var(--text-primary, #1f2937);
        }

        .platform-selector {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-top: 8px;
        }

        .platform-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 8px;
          cursor: pointer;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 8px;
          font-family: inherit;
        }

        .create-post-btn {
          background: var(--primary, #3b82f6);
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .create-post-btn:hover {
          background: var(--primary-dark, #2563eb);
        }

        .scheduled-posts {
          display: grid;
          gap: 16px;
        }

        .scheduled-post-card {
          background: var(--surface-primary, #ffffff);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 12px;
          padding: 20px;
        }

        .post-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .platform {
          font-weight: 600;
          color: var(--text-primary, #1f2937);
        }

        .status {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .status.pending { background: #fef3c7; color: #92400e; }
        .status.processing { background: #dbeafe; color: #1e40af; }
        .status.completed { background: #d1fae5; color: #065f46; }
        .status.failed { background: #fee2e2; color: #991b1b; }

        .post-meta {
          display: flex;
          gap: 16px;
          font-size: 0.875rem;
          color: var(--text-secondary, #6b7280);
          margin-top: 8px;
        }

        .analytics-platform-btn {
          margin: 8px;
          padding: 12px 20px;
          background: var(--surface-secondary, #f3f4f6);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 8px;
          cursor: pointer;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .summary-card {
          background: var(--surface-primary, #ffffff);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        .summary-card h3 {
          margin: 0 0 8px 0;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary, #6b7280);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary, #1f2937);
        }

        .recommendations {
          background: var(--surface-primary, #ffffff);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: 12px;
          padding: 24px;
        }

        .rec-section {
          margin-bottom: 24px;
        }

        .rec-section h4 {
          margin: 0 0 12px 0;
          color: var(--text-primary, #1f2937);
        }

        .rec-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .rec-section li {
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color, #f3f4f6);
        }
      `}</style>
    </div>
  );
};