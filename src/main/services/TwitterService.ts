import { TwitterApi } from 'twitter-api-v2';
import { SocialAccount } from '../../services/social/AccountManager';

interface TwitterCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
}

export class TwitterService {
  private client: TwitterApi | null = null;

  async testConnection(credentials: TwitterCredentials): Promise<SocialAccount> {
    try {
      // Initialize Twitter client
      this.client = new TwitterApi({
        appKey: credentials.clientId,
        appSecret: credentials.clientSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.accessTokenSecret,
      });

      // Test the connection by getting user info
      const user = await this.client.currentUser();
      
      return {
        platform: 'twitter',
        username: user.screen_name,
        displayName: user.name,
        profileImage: user.profile_image_url_https,
        followerCount: user.followers_count,
        isVerified: user.verified,
      };
    } catch (error) {
      throw new Error(`Twitter connection failed: ${error.message}`);
    }
  }

  async shareContent(content: {
    text: string;
    mediaUrls?: string[];
    tags?: string[];
  }): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!this.client) {
      throw new Error('Twitter client not initialized');
    }

    try {
      let tweetText = content.text;
      
      // Add hashtags if provided
      if (content.tags && content.tags.length > 0) {
        const hashtags = content.tags.map(tag => `#${tag.replace('#', '')}`).join(' ');
        tweetText += ` ${hashtags}`;
      }

      const mediaIds: string[] = [];
      
      // Upload media if provided
      if (content.mediaUrls && content.mediaUrls.length > 0) {
        for (const mediaUrl of content.mediaUrls.slice(0, 4)) { // Twitter allows max 4 media
          try {
            const mediaId = await this.uploadMedia(mediaUrl);
            if (mediaId) mediaIds.push(mediaId);
          } catch (error) {
            console.warn(`Failed to upload media ${mediaUrl}:`, error);
          }
        }
      }

      // Post the tweet
      const tweet = await this.client.v2.tweet({
        text: tweetText,
        media: mediaIds.length > 0 ? { media_ids: mediaIds } : undefined,
      });

      return {
        success: true,
        postId: tweet.data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to share on Twitter: ${error.message}`,
      };
    }
  }

  async getProfile(): Promise<SocialAccount | null> {
    if (!this.client) return null;

    try {
      const user = await this.client.currentUser();
      return {
        platform: 'twitter',
        username: user.screen_name,
        displayName: user.name,
        profileImage: user.profile_image_url_https,
        followerCount: user.followers_count,
        isVerified: user.verified,
      };
    } catch (error) {
      console.error('Failed to get Twitter profile:', error);
      return null;
    }
  }

  async revokeTokens(credentials: TwitterCredentials): Promise<void> {
    try {
      // Twitter doesn't have a direct revoke endpoint for app-only tokens
      // For user tokens, we would need to redirect to Twitter's revoke URL
      // For now, we'll just clear the local client
      this.client = null;
      console.log('Twitter tokens revoked locally');
    } catch (error) {
      console.error('Failed to revoke Twitter tokens:', error);
      throw error;
    }
  }

  private async uploadMedia(mediaUrl: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      // For now, we'll assume the media is already a buffer or file path
      // In a real implementation, you'd fetch the media from the URL first
      console.warn('Media upload not fully implemented for Twitter');
      return null;
    } catch (error) {
      console.error('Failed to upload media to Twitter:', error);
      return null;
    }
  }

  disconnect(): void {
    this.client = null;
  }
}