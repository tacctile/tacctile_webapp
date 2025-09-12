import snoowrap from 'snoowrap';
import { SocialAccount } from '../../services/social/AccountManager';

interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  userAgent?: string;
}

export class RedditService {
  private client: snoowrap | null = null;

  async testConnection(credentials: RedditCredentials): Promise<SocialAccount> {
    try {
      // Initialize Reddit client
      this.client = new snoowrap({
        userAgent: credentials.userAgent || 'GhostHunterToolbox/1.0.0',
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        username: credentials.username,
        password: credentials.password,
      });

      // Test the connection by getting user info
      const user = await this.client.getUser(credentials.username).fetch();
      
      return {
        platform: 'reddit',
        username: user.name,
        displayName: user.name,
        profileImage: user.icon_img || undefined,
        followerCount: user.subreddit?.subscribers,
        isVerified: user.is_gold || user.is_mod,
      };
    } catch (error) {
      throw new Error(`Reddit connection failed: ${error.message}`);
    }
  }

  async shareContent(content: {
    subreddit: string;
    title: string;
    text?: string;
    url?: string;
    mediaUrl?: string;
    flair?: string;
  }): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!this.client) {
      throw new Error('Reddit client not initialized');
    }

    try {
      let submission;

      if (content.url || content.mediaUrl) {
        // Link/media post
        submission = await this.client.getSubreddit(content.subreddit).submitLink({
          title: content.title,
          url: content.url || content.mediaUrl!,
          flair_id: content.flair,
        });
      } else {
        // Text post
        submission = await this.client.getSubreddit(content.subreddit).submitSelfpost({
          title: content.title,
          text: content.text || '',
          flair_id: content.flair,
        });
      }

      return {
        success: true,
        postId: submission.id,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to share on Reddit: ${error.message}`,
      };
    }
  }

  async getProfile(): Promise<SocialAccount | null> {
    if (!this.client) return null;

    try {
      const me = await this.client.getMe();
      return {
        platform: 'reddit',
        username: me.name,
        displayName: me.name,
        profileImage: me.icon_img || undefined,
        followerCount: me.subreddit?.subscribers,
        isVerified: me.is_gold || me.is_mod,
      };
    } catch (error) {
      console.error('Failed to get Reddit profile:', error);
      return null;
    }
  }

  async getSubreddits(): Promise<string[]> {
    if (!this.client) return [];

    try {
      const subreddits = await this.client.getMySubreddits({ limit: 100 });
      return subreddits.map((sub: any) => sub.display_name);
    } catch (error) {
      console.error('Failed to get subreddits:', error);
      return [];
    }
  }

  async searchSubreddits(query: string): Promise<Array<{ name: string; subscribers: number; description: string }>> {
    if (!this.client) return [];

    try {
      const results = await this.client.searchSubreddits({ query, limit: 10 });
      return results.map((sub: any) => ({
        name: sub.display_name,
        subscribers: sub.subscribers,
        description: sub.public_description || sub.title,
      }));
    } catch (error) {
      console.error('Failed to search subreddits:', error);
      return [];
    }
  }

  async revokeTokens(credentials: RedditCredentials): Promise<void> {
    try {
      // Reddit uses OAuth2, but doesn't provide a direct revoke endpoint
      // We'll clear the client and the tokens would expire naturally
      this.client = null;
      console.log('Reddit tokens revoked locally');
    } catch (error) {
      console.error('Failed to revoke Reddit tokens:', error);
      throw error;
    }
  }

  disconnect(): void {
    this.client = null;
  }
}