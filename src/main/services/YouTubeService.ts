import { google, youtube_v3 } from 'googleapis';
import { SocialAccount } from '../../services/social/AccountManager';
import { OAuth2Client } from 'google-auth-library';

interface YouTubeCredentials {
  clientId: string;
  clientSecret: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
}

export class YouTubeService {
  private youtube: youtube_v3.Youtube | null = null;
  private oauth2Client: OAuth2Client | null = null;

  async testConnection(credentials: YouTubeCredentials): Promise<SocialAccount> {
    try {
      // Initialize OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        credentials.clientId,
        credentials.clientSecret,
        'http://localhost' // Redirect URI
      );

      if (credentials.accessToken) {
        this.oauth2Client.setCredentials({
          access_token: credentials.accessToken,
          refresh_token: credentials.refreshToken,
        });
      }

      // Initialize YouTube API
      this.youtube = google.youtube({
        version: 'v3',
        auth: this.oauth2Client,
      });

      // Test the connection by getting channel info
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        mine: true,
      });

      const channel = response.data.items?.[0];
      if (!channel) {
        throw new Error('No YouTube channel found for this account');
      }

      return {
        platform: 'youtube',
        username: channel.snippet?.customUrl || channel.snippet?.title || 'Unknown',
        displayName: channel.snippet?.title || 'Unknown Channel',
        profileImage: channel.snippet?.thumbnails?.high?.url,
        followerCount: parseInt(channel.statistics?.subscriberCount || '0'),
        isVerified: false, // YouTube API doesn't easily expose verification status
      };
    } catch (error) {
      throw new Error(`YouTube connection failed: ${error.message}`);
    }
  }

  async uploadVideo(video: {
    title: string;
    description: string;
    tags?: string[];
    filePath: string;
    privacy: 'private' | 'public' | 'unlisted';
    categoryId?: string;
  }): Promise<{ success: boolean; videoId?: string; error?: string }> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized');
    }

    try {
      const fs = require('fs');
      
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: video.title,
            description: video.description,
            tags: video.tags,
            categoryId: video.categoryId || '22', // People & Blogs
          },
          status: {
            privacyStatus: video.privacy,
          },
        },
        media: {
          body: fs.createReadStream(video.filePath),
        },
      });

      return {
        success: true,
        videoId: response.data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to upload video to YouTube: ${error.message}`,
      };
    }
  }

  async createPlaylist(playlist: {
    title: string;
    description: string;
    privacy: 'private' | 'public' | 'unlisted';
  }): Promise<{ success: boolean; playlistId?: string; error?: string }> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized');
    }

    try {
      const response = await this.youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: playlist.title,
            description: playlist.description,
          },
          status: {
            privacyStatus: playlist.privacy,
          },
        },
      });

      return {
        success: true,
        playlistId: response.data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create YouTube playlist: ${error.message}`,
      };
    }
  }

  async addVideoToPlaylist(videoId: string, playlistId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.youtube) {
      throw new Error('YouTube client not initialized');
    }

    try {
      await this.youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId: playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId: videoId,
            },
          },
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add video to playlist: ${error.message}`,
      };
    }
  }

  async getProfile(): Promise<SocialAccount | null> {
    if (!this.youtube) return null;

    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        mine: true,
      });

      const channel = response.data.items?.[0];
      if (!channel) return null;

      return {
        platform: 'youtube',
        username: channel.snippet?.customUrl || channel.snippet?.title || 'Unknown',
        displayName: channel.snippet?.title || 'Unknown Channel',
        profileImage: channel.snippet?.thumbnails?.high?.url,
        followerCount: parseInt(channel.statistics?.subscriberCount || '0'),
        isVerified: false,
      };
    } catch (error) {
      console.error('Failed to get YouTube profile:', error);
      return null;
    }
  }

  async getPlaylists(): Promise<Array<{ id: string; title: string; description: string; itemCount: number }>> {
    if (!this.youtube) return [];

    try {
      const response = await this.youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        mine: true,
        maxResults: 50,
      });

      return response.data.items?.map(playlist => ({
        id: playlist.id || '',
        title: playlist.snippet?.title || 'Untitled',
        description: playlist.snippet?.description || '',
        itemCount: playlist.contentDetails?.itemCount || 0,
      })) || [];
    } catch (error) {
      console.error('Failed to get YouTube playlists:', error);
      return [];
    }
  }

  async revokeTokens(credentials: YouTubeCredentials): Promise<void> {
    try {
      if (this.oauth2Client && credentials.accessToken) {
        await this.oauth2Client.revokeToken(credentials.accessToken);
      }
      this.oauth2Client = null;
      this.youtube = null;
      console.log('YouTube tokens revoked');
    } catch (error) {
      console.error('Failed to revoke YouTube tokens:', error);
      throw error;
    }
  }

  disconnect(): void {
    this.oauth2Client = null;
    this.youtube = null;
  }
}