import { EventEmitter } from 'events';
import tmi from 'tmi.js';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

export interface ChatMessage {
  id: string;
  platform: 'Twitch' | 'YouTube' | 'Facebook' | 'TikTok' | 'Custom';
  username: string;
  displayName: string;
  message: string;
  timestamp: Date;
  badges: string[];
  color?: string;
  isSubscriber: boolean;
  isModerator: boolean;
  isBroadcaster: boolean;
  isVip: boolean;
  emotes?: Array<{
    name: string;
    url: string;
    start: number;
    end: number;
  }>;
}

export interface ChatUser {
  username: string;
  displayName: string;
  platform: string;
  isSubscriber: boolean;
  isModerator: boolean;
  isVip: boolean;
  firstSeen: Date;
  lastSeen: Date;
  messageCount: number;
  badges: string[];
}

export interface PlatformConfig {
  id: string;
  name: string;
  enabled: boolean;
  credentials: {
    username?: string;
    oauth?: string;
    channelId?: string;
    accessToken?: string;
    apiKey?: string;
  };
}

export interface ChatStats {
  totalMessages: number;
  messagesPerMinute: number;
  uniqueUsers: number;
  subscribers: number;
  moderators: number;
  topChatters: Array<{
    username: string;
    messageCount: number;
  }>;
  platformBreakdown: Record<string, {
    messages: number;
    users: number;
  }>;
  recentActivity: number; // Messages in last 5 minutes
}

export class ChatManager extends EventEmitter {
  private platforms: Map<string, PlatformConfig> = new Map();
  private connections: Map<string, any> = new Map(); // Platform connections
  private messages: ChatMessage[] = [];
  private users: Map<string, ChatUser> = new Map();
  private messageHistory: Array<{ timestamp: Date; count: number }> = [];
  private maxMessageHistory = 1000;
  private maxUserHistory = 10000;

  constructor() {
    super();
    this.initializeDefaultPlatforms();
    this.startMessageRateTracking();
  }

  private initializeDefaultPlatforms(): void {
    const defaultPlatforms: PlatformConfig[] = [
      {
        id: 'twitch',
        name: 'Twitch',
        enabled: false,
        credentials: {
          username: '',
          oauth: ''
        }
      },
      {
        id: 'youtube',
        name: 'YouTube',
        enabled: false,
        credentials: {
          channelId: '',
          apiKey: ''
        }
      },
      {
        id: 'facebook',
        name: 'Facebook',
        enabled: false,
        credentials: {
          accessToken: ''
        }
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        enabled: false,
        credentials: {
          accessToken: ''
        }
      }
    ];

    defaultPlatforms.forEach(platform => {
      this.platforms.set(platform.id, platform);
    });
  }

  private startMessageRateTracking(): void {
    setInterval(() => {
      const now = new Date();
      const currentMinuteMessages = this.messages.filter(m => 
        now.getTime() - m.timestamp.getTime() < 60000
      ).length;

      this.messageHistory.push({
        timestamp: now,
        count: currentMinuteMessages
      });

      // Keep only last hour of data
      const oneHourAgo = now.getTime() - (60 * 60 * 1000);
      this.messageHistory = this.messageHistory.filter(entry => 
        entry.timestamp.getTime() > oneHourAgo
      );

      this.emit('messageRateUpdate', currentMinuteMessages);
    }, 60000); // Update every minute
  }

  public async connectToPlatforms(): Promise<void> {
    const enabledPlatforms = Array.from(this.platforms.values()).filter(p => p.enabled);

    for (const platform of enabledPlatforms) {
      try {
        await this.connectToPlatform(platform);
      } catch (error) {
        console.error(`Failed to connect to ${platform.name}:`, error);
        this.emit('connectionError', { platform: platform.name, error });
      }
    }
  }

  private async connectToPlatform(platform: PlatformConfig): Promise<void> {
    switch (platform.id) {
      case 'twitch':
        await this.connectToTwitch(platform);
        break;
      case 'youtube':
        await this.connectToYouTube(platform);
        break;
      case 'facebook':
        await this.connectToFacebook(platform);
        break;
      case 'tiktok':
        await this.connectToTikTok(platform);
        break;
      default:
        console.warn(`Unknown platform: ${platform.id}`);
    }
  }

  private async connectToTwitch(platform: PlatformConfig): Promise<void> {
    if (!platform.credentials.username || !platform.credentials.oauth) {
      throw new Error('Twitch credentials not provided');
    }

    const client = new tmi.Client({
      options: { debug: false },
      connection: {
        reconnect: true,
        secure: true
      },
      identity: {
        username: platform.credentials.username,
        password: platform.credentials.oauth
      },
      channels: [platform.credentials.username]
    });

    client.on('message', (channel, tags, message, self) => {
      if (self) return;

      const chatMessage: ChatMessage = {
        id: `twitch_${Date.now()}_${Math.random()}`,
        platform: 'Twitch',
        username: tags.username || 'unknown',
        displayName: tags['display-name'] || tags.username || 'unknown',
        message: message,
        timestamp: new Date(),
        badges: this.parseTwitchBadges(tags.badges),
        color: tags.color,
        isSubscriber: tags.subscriber || false,
        isModerator: tags.mod || false,
        isBroadcaster: tags.username === platform.credentials.username,
        isVip: tags.vip || false,
        emotes: this.parseTwitchEmotes(tags.emotes, message)
      };

      this.handleNewMessage(chatMessage);
    });

    client.on('connected', () => {
      console.log(`Connected to Twitch chat for ${platform.credentials.username}`);
      this.emit('platformConnected', { platform: 'Twitch' });
    });

    client.on('disconnected', () => {
      console.log('Disconnected from Twitch chat');
      this.emit('platformDisconnected', { platform: 'Twitch' });
    });

    await client.connect();
    this.connections.set('twitch', client);
  }

  private parseTwitchBadges(badges: Record<string, unknown>): string[] {
    if (!badges) return [];
    return Object.keys(badges);
  }

  private parseTwitchEmotes(emotes: Record<string, unknown>, message: string): Array<{
    name: string;
    url: string;
    start: number;
    end: number;
  }> {
    if (!emotes) return [];

    const emotesArray: Array<{
      name: string;
      url: string;
      start: number;
      end: number;
    }> = [];

    Object.keys(emotes).forEach(emoteId => {
      const positions = emotes[emoteId];
      positions.forEach((position: string) => {
        const [start, end] = position.split('-').map(Number);
        const emoteName = message.slice(start, end + 1);
        emotesArray.push({
          name: emoteName,
          url: `https://static-cdn.jtvnw.net/emoticons/v1/${emoteId}/1.0`,
          start,
          end
        });
      });
    });

    return emotesArray;
  }

  private async connectToYouTube(platform: PlatformConfig): Promise<void> {
    if (!platform.credentials.channelId || !platform.credentials.apiKey) {
      throw new Error('YouTube credentials not provided');
    }

    // YouTube Live Chat requires polling
    const pollInterval = setInterval(async () => {
      try {
        await this.pollYouTubeLiveChat(platform);
      } catch (error) {
        console.error('YouTube chat polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    this.connections.set('youtube', { pollInterval });
    this.emit('platformConnected', { platform: 'YouTube' });
  }

  private async pollYouTubeLiveChat(platform: PlatformConfig): Promise<void> {
    // This is a simplified implementation
    // In reality, you'd need to:
    // 1. Get the live broadcast ID
    // 2. Get the live chat ID
    // 3. Poll the live chat messages endpoint
    
    try {
      const response = await axios.get(`https://www.googleapis.com/youtube/v3/liveChat/messages`, {
        params: {
          liveChatId: 'your-live-chat-id', // Would be obtained from broadcast
          part: 'snippet,authorDetails',
          key: platform.credentials.apiKey
        }
      });

      if (response.data.items) {
        response.data.items.forEach((item: Record<string, any>) => {
          const chatMessage: ChatMessage = {
            id: `youtube_${item.id}`,
            platform: 'YouTube',
            username: item.authorDetails.channelId,
            displayName: item.authorDetails.displayName,
            message: item.snippet.displayMessage,
            timestamp: new Date(item.snippet.publishedAt),
            badges: item.authorDetails.isChatModerator ? ['moderator'] : [],
            isSubscriber: item.authorDetails.isChatSponsor || false,
            isModerator: item.authorDetails.isChatModerator || false,
            isBroadcaster: item.authorDetails.isChatOwner || false,
            isVip: false
          };

          this.handleNewMessage(chatMessage);
        });
      }
    } catch (error) {
      // Handle rate limiting and other YouTube API errors
      console.error('YouTube API error:', error);
    }
  }

  private async connectToFacebook(platform: PlatformConfig): Promise<void> {
    // Facebook Live Chat API implementation would go here
    // This is a placeholder as Facebook's chat API requires special permissions
    console.log('Facebook chat connection not implemented - requires special API access');
    this.emit('platformConnected', { platform: 'Facebook' });
  }

  private async connectToTikTok(platform: PlatformConfig): Promise<void> {
    // TikTok Live Chat API implementation would go here
    // This is a placeholder as TikTok's chat API is limited
    console.log('TikTok chat connection not implemented - API limitations');
    this.emit('platformConnected', { platform: 'TikTok' });
  }

  private handleNewMessage(message: ChatMessage): void {
    // Add to message history
    this.messages.unshift(message);
    if (this.messages.length > this.maxMessageHistory) {
      this.messages = this.messages.slice(0, this.maxMessageHistory);
    }

    // Update user tracking
    this.updateUserStats(message);

    // Emit message event
    this.emit('newMessage', message);

    // Check for special commands or keywords
    this.processMessageContent(message);
  }

  private updateUserStats(message: ChatMessage): void {
    const userKey = `${message.platform}_${message.username}`;
    const existingUser = this.users.get(userKey);

    if (existingUser) {
      existingUser.lastSeen = message.timestamp;
      existingUser.messageCount++;
    } else {
      const newUser: ChatUser = {
        username: message.username,
        displayName: message.displayName,
        platform: message.platform,
        isSubscriber: message.isSubscriber,
        isModerator: message.isModerator,
        isVip: message.isVip,
        firstSeen: message.timestamp,
        lastSeen: message.timestamp,
        messageCount: 1,
        badges: message.badges
      };
      this.users.set(userKey, newUser);
    }

    // Cleanup old users periodically
    if (this.users.size > this.maxUserHistory) {
      const sortedUsers = Array.from(this.users.entries())
        .sort((a, b) => b[1].lastSeen.getTime() - a[1].lastSeen.getTime())
        .slice(0, this.maxUserHistory);
      
      this.users.clear();
      sortedUsers.forEach(([key, user]) => {
        this.users.set(key, user);
      });
    }
  }

  private processMessageContent(message: ChatMessage): void {
    const content = message.message.toLowerCase();

    // Check for paranormal investigation keywords
    const paranormalKeywords = [
      'ghost', 'spirit', 'paranormal', 'haunted', 'supernatural',
      'evp', 'emf', 'orb', 'apparition', 'poltergeist', 'investigation'
    ];

    const hasParanormalContent = paranormalKeywords.some(keyword => 
      content.includes(keyword)
    );

    if (hasParanormalContent) {
      this.emit('paranormalMention', { message, keywords: paranormalKeywords.filter(k => content.includes(k)) });
    }

    // Check for questions
    if (content.includes('?')) {
      this.emit('questionAsked', message);
    }

    // Check for commands (starting with !)
    if (content.startsWith('!')) {
      const command = content.split(' ')[0].substring(1);
      this.emit('chatCommand', { message, command });
    }
  }

  public sendMessage(platformId: string, message: string): Promise<void> {
    const connection = this.connections.get(platformId);
    if (!connection) {
      return Promise.reject(new Error(`Not connected to ${platformId}`));
    }

    switch (platformId) {
      case 'twitch': {
        const platform = this.platforms.get('twitch');
        if (platform) {
          return connection.say(`#${platform.credentials.username}`, message);
        }
        break;
      }
      // Add other platforms as needed
    }

    return Promise.reject(new Error(`Send message not implemented for ${platformId}`));
  }

  public getRecentMessages(count = 50): ChatMessage[] {
    return this.messages.slice(0, count);
  }

  public getMessagesByPlatform(platform: string, count = 50): ChatMessage[] {
    return this.messages
      .filter(m => m.platform === platform)
      .slice(0, count);
  }

  public getChatStats(): ChatStats {
    const now = new Date();
    const fiveMinutesAgo = now.getTime() - (5 * 60 * 1000);
    const oneMinuteAgo = now.getTime() - (60 * 1000);

    const recentMessages = this.messages.filter(m => m.timestamp.getTime() > fiveMinutesAgo);
    const lastMinuteMessages = this.messages.filter(m => m.timestamp.getTime() > oneMinuteAgo);

    const uniqueUsers = new Set(this.messages.map(m => `${m.platform}_${m.username}`)).size;
    const subscribers = Array.from(this.users.values()).filter(u => u.isSubscriber).length;
    const moderators = Array.from(this.users.values()).filter(u => u.isModerator).length;

    // Top chatters
    const userMessageCounts = new Map<string, number>();
    this.messages.forEach(m => {
      const key = `${m.platform}_${m.username}`;
      userMessageCounts.set(key, (userMessageCounts.get(key) || 0) + 1);
    });

    const topChatters = Array.from(userMessageCounts.entries())
      .map(([userKey, count]) => {
        const user = this.users.get(userKey);
        return {
          username: user?.displayName || userKey,
          messageCount: count
        };
      })
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);

    // Platform breakdown
    const platformBreakdown: Record<string, { messages: number; users: number }> = {};
    Array.from(this.platforms.keys()).forEach(platformId => {
      const platformMessages = this.messages.filter(m => m.platform === this.platforms.get(platformId)?.name);
      const platformUsers = new Set(platformMessages.map(m => m.username)).size;
      
      platformBreakdown[platformId] = {
        messages: platformMessages.length,
        users: platformUsers
      };
    });

    return {
      totalMessages: this.messages.length,
      messagesPerMinute: lastMinuteMessages.length,
      uniqueUsers,
      subscribers,
      moderators,
      topChatters,
      platformBreakdown,
      recentActivity: recentMessages.length
    };
  }

  public updatePlatformConfig(platformId: string, config: Partial<PlatformConfig>): void {
    const platform = this.platforms.get(platformId);
    if (platform) {
      Object.assign(platform, config);
      this.platforms.set(platformId, platform);
      this.emit('platformConfigUpdated', { platformId, config: platform });
    }
  }

  public getPlatformConfigs(): PlatformConfig[] {
    return Array.from(this.platforms.values());
  }

  public async disconnectFromPlatforms(): Promise<void> {
    for (const [platformId, connection] of this.connections) {
      try {
        switch (platformId) {
          case 'twitch':
            await connection.disconnect();
            break;
          case 'youtube':
            if (connection.pollInterval) {
              clearInterval(connection.pollInterval);
            }
            break;
          // Add other platforms as needed
        }
        this.emit('platformDisconnected', { platform: this.platforms.get(platformId)?.name });
      } catch (error) {
        console.error(`Error disconnecting from ${platformId}:`, error);
      }
    }

    this.connections.clear();
  }

  public clearMessageHistory(): void {
    this.messages = [];
    this.emit('messageHistoryCleared');
  }

  public exportChatLog(format: 'json' | 'txt' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        messages: this.messages,
        users: Array.from(this.users.values()),
        stats: this.getChatStats(),
        exportedAt: new Date().toISOString()
      }, null, 2);
    } else {
      return this.messages
        .map(m => `[${m.timestamp.toISOString()}] ${m.platform}/${m.displayName}: ${m.message}`)
        .join('\n');
    }
  }
}

export default ChatManager;