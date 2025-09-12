import { app } from 'electron';
import Database from 'better-sqlite3';
import { join } from 'path';
import cron from 'node-cron';
import { accountManager } from './AccountManager';

export interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves?: number;
  retweets?: number;
  replies?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
}

export interface PostAnalytics {
  id: string;
  platform: string;
  postId: string;
  postedAt: Date;
  content: {
    caption: string;
    hashtags: string[];
    mediaType: 'image' | 'video' | 'carousel' | 'text';
    evidenceType?: string;
  };
  metrics: EngagementMetrics;
  demographics?: {
    ageGroups: Record<string, number>;
    genders: Record<string, number>;
    topLocations: Array<{ country: string; percentage: number }>;
  };
  bestPerformingHashtags?: Array<{ hashtag: string; reach: number }>;
  peakEngagementTime?: Date;
  updatedAt: Date;
}

export interface AnalyticsSummary {
  platform: string;
  timeframe: 'day' | 'week' | 'month' | 'year';
  totalPosts: number;
  totalEngagement: number;
  averageEngagement: number;
  engagementRate: number;
  followerGrowth: number;
  topPerformingPost: {
    postId: string;
    engagement: number;
    content: string;
  };
  bestHashtags: Array<{ hashtag: string; avgEngagement: number; posts: number }>;
  optimalPostingTimes: Array<{ hour: number; dayOfWeek: number; avgEngagement: number }>;
  contentPerformance: Record<string, { posts: number; avgEngagement: number }>;
}

export interface CompetitorData {
  platform: string;
  username: string;
  followers: number;
  avgEngagement: number;
  postFrequency: number;
  topHashtags: string[];
  lastUpdated: Date;
}

export interface TrendData {
  hashtag: string;
  platform: string;
  volume: number;
  growth: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  relatedTopics: string[];
  peakTimes: number[];
  updatedAt: Date;
}

export class SocialAnalytics {
  private static instance: SocialAnalytics;
  private db: Database.Database;
  private updateJobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {
    this.initializeDatabase();
    this.scheduleDataCollection();
  }

  public static getInstance(): SocialAnalytics {
    if (!SocialAnalytics.instance) {
      SocialAnalytics.instance = new SocialAnalytics();
    }
    return SocialAnalytics.instance;
  }

  private initializeDatabase(): void {
    const dbPath = join(app.getPath('userData'), 'social-analytics.db');
    this.db = new Database(dbPath);

    // Post analytics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS post_analytics (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        post_id TEXT NOT NULL,
        posted_at INTEGER NOT NULL,
        content TEXT NOT NULL, -- JSON
        metrics TEXT NOT NULL, -- JSON
        demographics TEXT, -- JSON
        best_hashtags TEXT, -- JSON
        peak_engagement_time INTEGER,
        updated_at INTEGER NOT NULL
      )
    `);

    // Follower tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS follower_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        date INTEGER NOT NULL,
        followers INTEGER NOT NULL,
        following INTEGER,
        engagement_rate REAL,
        created_at INTEGER NOT NULL
      )
    `);

    // Hashtag performance
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hashtag_performance (
        hashtag TEXT NOT NULL,
        platform TEXT NOT NULL,
        total_posts INTEGER NOT NULL DEFAULT 0,
        total_engagement INTEGER NOT NULL DEFAULT 0,
        avg_engagement REAL NOT NULL DEFAULT 0,
        last_used INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (hashtag, platform)
      )
    `);

    // Competitor tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS competitors (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        username TEXT NOT NULL,
        followers INTEGER NOT NULL,
        avg_engagement REAL NOT NULL,
        post_frequency REAL NOT NULL,
        top_hashtags TEXT, -- JSON
        last_updated INTEGER NOT NULL
      )
    `);

    // Trend data
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trends (
        hashtag TEXT NOT NULL,
        platform TEXT NOT NULL,
        volume INTEGER NOT NULL,
        growth REAL NOT NULL,
        sentiment TEXT NOT NULL,
        related_topics TEXT, -- JSON
        peak_times TEXT, -- JSON
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (hashtag, platform)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_post_analytics_platform_date 
      ON post_analytics (platform, posted_at);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_follower_history_platform_date 
      ON follower_history (platform, date);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_hashtag_performance_platform 
      ON hashtag_performance (platform, avg_engagement DESC);
    `);
  }

  public async trackPost(analytics: Omit<PostAnalytics, 'id' | 'updatedAt'>): Promise<string> {
    const id = this.generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO post_analytics 
      (id, platform, post_id, posted_at, content, metrics, demographics, best_hashtags, peak_engagement_time, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      analytics.platform,
      analytics.postId,
      analytics.postedAt.getTime(),
      JSON.stringify(analytics.content),
      JSON.stringify(analytics.metrics),
      analytics.demographics ? JSON.stringify(analytics.demographics) : null,
      analytics.bestPerformingHashtags ? JSON.stringify(analytics.bestPerformingHashtags) : null,
      analytics.peakEngagementTime ? analytics.peakEngagementTime.getTime() : null,
      now
    );

    // Update hashtag performance
    await this.updateHashtagPerformance(analytics.platform, analytics.content.hashtags, analytics.metrics);

    return id;
  }

  public async updatePostMetrics(postId: string, platform: string, metrics: EngagementMetrics): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE post_analytics 
      SET metrics = ?, updated_at = ?
      WHERE post_id = ? AND platform = ?
    `);

    stmt.run(JSON.stringify(metrics), Date.now(), postId, platform);
  }

  public async getPostAnalytics(filters?: {
    platform?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<PostAnalytics[]> {
    let query = 'SELECT * FROM post_analytics WHERE 1=1';
    const params: any[] = [];

    if (filters?.platform) {
      query += ' AND platform = ?';
      params.push(filters.platform);
    }

    if (filters?.startDate) {
      query += ' AND posted_at >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters?.endDate) {
      query += ' AND posted_at <= ?';
      params.push(filters.endDate.getTime());
    }

    query += ' ORDER BY posted_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapRowToPostAnalytics(row));
  }

  public async getAnalyticsSummary(
    platform: string,
    timeframe: 'day' | 'week' | 'month' | 'year'
  ): Promise<AnalyticsSummary> {
    const timeframeDays = { day: 1, week: 7, month: 30, year: 365 }[timeframe];
    const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    // Get posts for timeframe
    const posts = await this.getPostAnalytics({
      platform,
      startDate
    });

    if (posts.length === 0) {
      return {
        platform,
        timeframe,
        totalPosts: 0,
        totalEngagement: 0,
        averageEngagement: 0,
        engagementRate: 0,
        followerGrowth: 0,
        topPerformingPost: { postId: '', engagement: 0, content: '' },
        bestHashtags: [],
        optimalPostingTimes: [],
        contentPerformance: {}
      };
    }

    // Calculate metrics
    const totalEngagement = posts.reduce((sum, post) => {
      return sum + this.calculateTotalEngagement(post.metrics);
    }, 0);

    const averageEngagement = totalEngagement / posts.length;

    // Find top performing post
    const topPost = posts.reduce((best, current) => {
      const currentEngagement = this.calculateTotalEngagement(current.metrics);
      const bestEngagement = this.calculateTotalEngagement(best.metrics);
      return currentEngagement > bestEngagement ? current : best;
    });

    // Get hashtag performance
    const bestHashtags = await this.getBestHashtags(platform, 10);

    // Calculate optimal posting times
    const optimalTimes = this.calculateOptimalPostingTimes(posts);

    // Content performance by type
    const contentPerformance = this.analyzeContentPerformance(posts);

    // Get follower growth
    const followerGrowth = await this.getFollowerGrowth(platform, timeframeDays);

    return {
      platform,
      timeframe,
      totalPosts: posts.length,
      totalEngagement,
      averageEngagement,
      engagementRate: averageEngagement * 100, // Simplified calculation
      followerGrowth,
      topPerformingPost: {
        postId: topPost.postId,
        engagement: this.calculateTotalEngagement(topPost.metrics),
        content: topPost.content.caption.substring(0, 100) + '...'
      },
      bestHashtags,
      optimalPostingTimes: optimalTimes,
      contentPerformance
    };
  }

  public async getBestHashtags(platform: string, limit = 20): Promise<Array<{ hashtag: string; avgEngagement: number; posts: number }>> {
    const stmt = this.db.prepare(`
      SELECT hashtag, avg_engagement, total_posts
      FROM hashtag_performance
      WHERE platform = ? AND total_posts > 0
      ORDER BY avg_engagement DESC
      LIMIT ?
    `);

    const rows = stmt.all(platform, limit) as any[];
    return rows.map(row => ({
      hashtag: row.hashtag,
      avgEngagement: row.avg_engagement,
      posts: row.total_posts
    }));
  }

  public async trackFollowers(platform: string): Promise<void> {
    // This would integrate with each platform's API to get current follower count
    // For now, we'll simulate the data collection
    
    try {
      const followerCount = await this.fetchCurrentFollowerCount(platform);
      const engagementRate = await this.calculateCurrentEngagementRate(platform);

      const stmt = this.db.prepare(`
        INSERT INTO follower_history (platform, date, followers, engagement_rate, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      stmt.run(platform, today.getTime(), followerCount, engagementRate, Date.now());
    } catch (error) {
      console.error(`Failed to track followers for ${platform}:`, error);
    }
  }

  public async addCompetitor(competitor: Omit<CompetitorData, 'lastUpdated'>): Promise<void> {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO competitors 
      (id, platform, username, followers, avg_engagement, post_frequency, top_hashtags, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      competitor.platform,
      competitor.username,
      competitor.followers,
      competitor.avgEngagement,
      competitor.postFrequency,
      JSON.stringify(competitor.topHashtags),
      Date.now()
    );
  }

  public async getCompetitorAnalysis(platform: string): Promise<CompetitorData[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM competitors 
      WHERE platform = ? 
      ORDER BY avg_engagement DESC
    `);

    const rows = stmt.all(platform) as any[];
    return rows.map(row => ({
      platform: row.platform,
      username: row.username,
      followers: row.followers,
      avgEngagement: row.avg_engagement,
      postFrequency: row.post_frequency,
      topHashtags: JSON.parse(row.top_hashtags || '[]'),
      lastUpdated: new Date(row.last_updated)
    }));
  }

  public async trackTrend(trend: Omit<TrendData, 'updatedAt'>): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO trends 
      (hashtag, platform, volume, growth, sentiment, related_topics, peak_times, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      trend.hashtag,
      trend.platform,
      trend.volume,
      trend.growth,
      trend.sentiment,
      JSON.stringify(trend.relatedTopics),
      JSON.stringify(trend.peakTimes),
      Date.now()
    );
  }

  public async getTrendingHashtags(platform: string, limit = 10): Promise<TrendData[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM trends 
      WHERE platform = ? AND volume > 0
      ORDER BY growth DESC, volume DESC
      LIMIT ?
    `);

    const rows = stmt.all(platform, limit) as any[];
    return rows.map(row => ({
      hashtag: row.hashtag,
      platform: row.platform,
      volume: row.volume,
      growth: row.growth,
      sentiment: row.sentiment,
      relatedTopics: JSON.parse(row.related_topics || '[]'),
      peakTimes: JSON.parse(row.peak_times || '[]'),
      updatedAt: new Date(row.updated_at)
    }));
  }

  public async generateRecommendations(platform: string): Promise<{
    bestPostingTimes: Array<{ day: string; hour: number; confidence: number }>;
    recommendedHashtags: Array<{ hashtag: string; reason: string; expectedEngagement: number }>;
    contentSuggestions: Array<{ type: string; description: string; examples: string[] }>;
    competitorInsights: Array<{ insight: string; action: string }>;
  }> {
    // Get optimal posting times
    const posts = await this.getPostAnalytics({ platform, limit: 100 });
    const optimalTimes = this.calculateOptimalPostingTimes(posts);
    
    const bestPostingTimes = optimalTimes.slice(0, 3).map(time => ({
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][time.dayOfWeek],
      hour: time.hour,
      confidence: Math.min(time.avgEngagement / 100, 1)
    }));

    // Get recommended hashtags
    const bestHashtags = await this.getBestHashtags(platform, 5);
    const trendingHashtags = await this.getTrendingHashtags(platform, 5);
    
    const recommendedHashtags = [
      ...bestHashtags.slice(0, 3).map(h => ({
        hashtag: h.hashtag,
        reason: 'High historical performance',
        expectedEngagement: h.avgEngagement
      })),
      ...trendingHashtags.slice(0, 2).map(h => ({
        hashtag: h.hashtag,
        reason: 'Currently trending',
        expectedEngagement: h.volume
      }))
    ];

    // Content suggestions based on performance
    const contentPerformance = this.analyzeContentPerformance(posts);
    const topContentType = Object.entries(contentPerformance)
      .sort(([,a], [,b]) => b.avgEngagement - a.avgEngagement)[0];

    const contentSuggestions = [
      {
        type: topContentType[0],
        description: `${topContentType[0]} content performs best with ${topContentType[1].avgEngagement.toFixed(0)} avg engagement`,
        examples: this.getContentExamples(topContentType[0])
      }
    ];

    // Competitor insights
    const competitors = await this.getCompetitorAnalysis(platform);
    const competitorInsights = competitors.slice(0, 2).map(comp => ({
      insight: `${comp.username} has ${comp.avgEngagement.toFixed(1)} avg engagement`,
      action: `Consider their top hashtags: ${comp.topHashtags.slice(0, 3).join(', ')}`
    }));

    return {
      bestPostingTimes,
      recommendedHashtags,
      contentSuggestions,
      competitorInsights
    };
  }

  private scheduleDataCollection(): void {
    // Collect follower data daily at 6 AM
    const followerJob = cron.schedule('0 6 * * *', async () => {
      const platforms = ['instagram', 'tiktok', 'twitter', 'facebook', 'reddit'];
      for (const platform of platforms) {
        if (accountManager.isConnected(platform)) {
          await this.trackFollowers(platform);
        }
      }
    }, { scheduled: false });

    followerJob.start();
    this.updateJobs.set('followers', followerJob);

    // Update trending hashtags every 4 hours
    const trendsJob = cron.schedule('0 */4 * * *', async () => {
      await this.updateTrendingHashtags();
    }, { scheduled: false });

    trendsJob.start();
    this.updateJobs.set('trends', trendsJob);
  }

  private async updateHashtagPerformance(platform: string, hashtags: string[], metrics: EngagementMetrics): Promise<void> {
    const engagement = this.calculateTotalEngagement(metrics);

    for (const hashtag of hashtags) {
      const cleanHashtag = hashtag.replace('#', '').toLowerCase();
      
      const stmt = this.db.prepare(`
        INSERT INTO hashtag_performance (hashtag, platform, total_posts, total_engagement, avg_engagement, last_used, updated_at)
        VALUES (?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(hashtag, platform) DO UPDATE SET
          total_posts = total_posts + 1,
          total_engagement = total_engagement + ?,
          avg_engagement = total_engagement / total_posts,
          last_used = ?,
          updated_at = ?
      `);

      const now = Date.now();
      stmt.run(cleanHashtag, platform, engagement, now, now, engagement, now, now);
    }
  }

  private calculateOptimalPostingTimes(posts: PostAnalytics[]): Array<{ hour: number; dayOfWeek: number; avgEngagement: number }> {
    const timeSlots: Record<string, { total: number; count: number }> = {};

    posts.forEach(post => {
      const date = new Date(post.postedAt);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const key = `${dayOfWeek}-${hour}`;
      const engagement = this.calculateTotalEngagement(post.metrics);

      if (!timeSlots[key]) {
        timeSlots[key] = { total: 0, count: 0 };
      }
      timeSlots[key].total += engagement;
      timeSlots[key].count += 1;
    });

    return Object.entries(timeSlots)
      .map(([key, data]) => {
        const [dayOfWeek, hour] = key.split('-').map(Number);
        return {
          hour,
          dayOfWeek,
          avgEngagement: data.total / data.count
        };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 10);
  }

  private analyzeContentPerformance(posts: PostAnalytics[]): Record<string, { posts: number; avgEngagement: number }> {
    const performance: Record<string, { total: number; count: number }> = {};

    posts.forEach(post => {
      const type = post.content.evidenceType || post.content.mediaType;
      const engagement = this.calculateTotalEngagement(post.metrics);

      if (!performance[type]) {
        performance[type] = { total: 0, count: 0 };
      }
      performance[type].total += engagement;
      performance[type].count += 1;
    });

    const result: Record<string, { posts: number; avgEngagement: number }> = {};
    Object.entries(performance).forEach(([type, data]) => {
      result[type] = {
        posts: data.count,
        avgEngagement: data.total / data.count
      };
    });

    return result;
  }

  private async fetchCurrentFollowerCount(platform: string): Promise<number> {
    // This would integrate with actual APIs - for now return mock data
    const mockCounts = { instagram: 1250, tiktok: 850, twitter: 2300, facebook: 750, reddit: 450 };
    return mockCounts[platform] || 0;
  }

  private async calculateCurrentEngagementRate(platform: string): Promise<number> {
    const recentPosts = await this.getPostAnalytics({ platform, limit: 10 });
    if (recentPosts.length === 0) return 0;

    const totalEngagement = recentPosts.reduce((sum, post) => 
      sum + this.calculateTotalEngagement(post.metrics), 0);
    
    return totalEngagement / recentPosts.length;
  }

  private async getFollowerGrowth(platform: string, days: number): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT followers FROM follower_history 
      WHERE platform = ? AND date >= ?
      ORDER BY date ASC
      LIMIT 2
    `);

    const startDate = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = stmt.all(platform, startDate) as any[];

    if (rows.length < 2) return 0;
    
    const growth = rows[rows.length - 1].followers - rows[0].followers;
    return growth;
  }

  private async updateTrendingHashtags(): Promise<void> {
    // This would integrate with trend APIs - for now simulate data
    const platforms = ['instagram', 'tiktok', 'twitter'];
    const mockTrends = ['#paranormal', '#ghosthunting', '#supernatural', '#evidence', '#investigation'];

    for (const platform of platforms) {
      for (const hashtag of mockTrends) {
        await this.trackTrend({
          hashtag,
          platform,
          volume: Math.floor(Math.random() * 10000) + 1000,
          growth: (Math.random() - 0.5) * 200, // -100% to +100%
          sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)] as any,
          relatedTopics: ['ghost', 'spirit', 'haunted', 'spooky'],
          peakTimes: [9, 12, 15, 18, 21] // Peak hours
        });
      }
    }
  }

  private calculateTotalEngagement(metrics: EngagementMetrics): number {
    return (metrics.likes || 0) + 
           (metrics.comments || 0) + 
           (metrics.shares || 0) + 
           (metrics.saves || 0) + 
           (metrics.retweets || 0) + 
           (metrics.replies || 0);
  }

  private getContentExamples(contentType: string): string[] {
    const examples: Record<string, string[]> = {
      evp: ['Clear voice recordings', 'Question and response sessions', 'Historical voice analysis'],
      visual: ['Apparition footage', 'Shadow figure captures', 'Unexplained movement'],
      temperature: ['Cold spot detection', 'Thermal imaging', 'Temperature fluctuations'],
      emf: ['EMF spike recordings', 'Field disturbances', 'Equipment responses'],
      image: ['Photo analysis', 'Before/after comparisons', 'Enhanced evidence'],
      video: ['Investigation footage', 'Real-time captures', 'Equipment reactions']
    };

    return examples[contentType] || ['General paranormal content', 'Investigation updates', 'Evidence analysis'];
  }

  private mapRowToPostAnalytics(row: any): PostAnalytics {
    return {
      id: row.id,
      platform: row.platform,
      postId: row.post_id,
      postedAt: new Date(row.posted_at),
      content: JSON.parse(row.content),
      metrics: JSON.parse(row.metrics),
      demographics: row.demographics ? JSON.parse(row.demographics) : undefined,
      bestPerformingHashtags: row.best_hashtags ? JSON.parse(row.best_hashtags) : undefined,
      peakEngagementTime: row.peak_engagement_time ? new Date(row.peak_engagement_time) : undefined,
      updatedAt: new Date(row.updated_at)
    };
  }

  private generateId(): string {
    return 'analytics_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  public async close(): Promise<void> {
    // Cancel all cron jobs
    for (const job of this.updateJobs.values()) {
      job.destroy();
    }

    // Close database
    this.db.close();
  }
}

// Export singleton instance
export const socialAnalytics = SocialAnalytics.getInstance();