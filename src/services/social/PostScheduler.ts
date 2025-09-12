import cron from 'node-cron';
import Queue from 'bull';
import Redis from 'ioredis';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { join } from 'path';
import { accountManager } from './AccountManager';
import { EmbeddedBrowser } from './EmbeddedBrowser';
import { mediaOptimizer } from '../media/MediaOptimizer';

export interface ScheduledPost {
  id: string;
  platform: string;
  content: PostContent;
  scheduledTime: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  postId?: string; // Platform-specific post ID after successful upload
}

export interface PostContent {
  mediaPath?: string;
  caption: string;
  hashtags?: string[];
  optimizedForPlatform?: boolean;
  watermark?: {
    text?: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  };
}

export interface BulkPostOptions {
  platforms: string[];
  content: PostContent;
  scheduledTimes?: Date[];
  staggerDelay?: number; // minutes between posts to different platforms
  optimizeForEachPlatform?: boolean;
}

export interface OptimalPostingTime {
  platform: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  engagement: number; // estimated engagement percentage
  timezone: string;
}

export class PostScheduler {
  private static instance: PostScheduler;
  private db: Database.Database;
  private redis: Redis;
  private queue: Queue.Queue;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private browsers: Map<string, EmbeddedBrowser> = new Map();

  private constructor() {
    this.initializeDatabase();
    this.initializeRedis();
    this.initializeQueue();
    this.scheduleCleanupJob();
  }

  public static getInstance(): PostScheduler {
    if (!PostScheduler.instance) {
      PostScheduler.instance = new PostScheduler();
    }
    return PostScheduler.instance;
  }

  private initializeDatabase(): void {
    const dbPath = join(app.getPath('userData'), 'scheduled-posts.db');
    this.db = new Database(dbPath);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_posts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        content TEXT NOT NULL, -- JSON
        scheduled_time INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        error TEXT,
        post_id TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS optimal_times (
        platform TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        hour INTEGER NOT NULL,
        engagement REAL NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (platform, day_of_week, hour)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        post_id TEXT NOT NULL,
        posted_at INTEGER NOT NULL,
        engagement_data TEXT, -- JSON
        updated_at INTEGER NOT NULL
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time 
      ON scheduled_posts (status, scheduled_time);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_analytics_platform_date 
      ON analytics (platform, posted_at);
    `);
  }

  private initializeRedis(): void {
    try {
      this.redis = new Redis({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true
      });
    } catch (error) {
      console.warn('Redis not available, using in-memory queue fallback');
      this.redis = null as any;
    }
  }

  private initializeQueue(): void {
    if (this.redis) {
      this.queue = new Queue('social-media-posts', {
        redis: { host: 'localhost', port: 6379 }
      });
    } else {
      // Fallback to in-memory processing
      this.queue = null as any;
    }

    if (this.queue) {
      this.queue.process('post-upload', this.processPostUpload.bind(this));
      this.queue.on('completed', this.handleJobCompleted.bind(this));
      this.queue.on('failed', this.handleJobFailed.bind(this));
    }
  }

  public async schedulePost(post: Omit<ScheduledPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateId();
    const now = Date.now();
    
    const scheduledPost: ScheduledPost = {
      id,
      ...post,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    // Save to database
    const stmt = this.db.prepare(`
      INSERT INTO scheduled_posts 
      (id, platform, content, scheduled_time, status, attempts, max_attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      scheduledPost.platform,
      JSON.stringify(scheduledPost.content),
      scheduledPost.scheduledTime.getTime(),
      scheduledPost.status,
      scheduledPost.attempts,
      scheduledPost.maxAttempts,
      now,
      now
    );

    // Schedule the job
    if (this.queue) {
      const delay = scheduledPost.scheduledTime.getTime() - Date.now();
      await this.queue.add('post-upload', { postId: id }, { delay: Math.max(0, delay) });
    } else {
      // Fallback to cron job
      this.scheduleCronJob(scheduledPost);
    }

    return id;
  }

  public async scheduleBulkPosts(options: BulkPostOptions): Promise<string[]> {
    const postIds: string[] = [];
    const { platforms, content, scheduledTimes, staggerDelay = 5, optimizeForEachPlatform = true } = options;

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      const postContent = { ...content };

      // Optimize content for each platform
      if (optimizeForEachPlatform && content.mediaPath) {
        try {
          const optimizationResult = await mediaOptimizer.optimizeForPlatform({
            inputPath: content.mediaPath,
            platform: `${platform}-square`, // Default preset
            watermark: content.watermark
          });

          if (optimizationResult.success && optimizationResult.outputPath) {
            postContent.mediaPath = optimizationResult.outputPath;
            postContent.optimizedForPlatform = true;
          }
        } catch (error) {
          console.warn(`Failed to optimize content for ${platform}:`, error);
        }
      }

      // Calculate scheduled time
      let scheduledTime: Date;
      if (scheduledTimes && scheduledTimes[i]) {
        scheduledTime = scheduledTimes[i];
      } else {
        // Use optimal time or current time + stagger delay
        const optimalTime = await this.getOptimalPostingTime(platform);
        scheduledTime = optimalTime ? 
          this.getNextOptimalTime(optimalTime) : 
          new Date(Date.now() + (i * staggerDelay * 60 * 1000));
      }

      const postId = await this.schedulePost({
        platform,
        content: postContent,
        scheduledTime,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3
      });

      postIds.push(postId);
    }

    return postIds;
  }

  public async getOptimalPostingTime(platform: string): Promise<OptimalPostingTime | null> {
    const stmt = this.db.prepare(`
      SELECT platform, day_of_week, hour, engagement, timezone
      FROM optimal_times
      WHERE platform = ?
      ORDER BY engagement DESC
      LIMIT 1
    `);

    const result = stmt.get(platform) as any;
    if (!result) return null;

    return {
      platform: result.platform,
      dayOfWeek: result.day_of_week,
      hour: result.hour,
      engagement: result.engagement,
      timezone: result.timezone
    };
  }

  public async updateOptimalPostingTimes(platform: string): Promise<void> {
    // This would typically analyze historical engagement data
    // For now, we'll set some sensible defaults based on platform research
    const defaultTimes = this.getDefaultOptimalTimes(platform);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO optimal_times 
      (platform, day_of_week, hour, engagement, timezone, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    for (const time of defaultTimes) {
      stmt.run(platform, time.dayOfWeek, time.hour, time.engagement, time.timezone, now);
    }
  }

  public async getScheduledPosts(filters?: {
    platform?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ScheduledPost[]> {
    let query = 'SELECT * FROM scheduled_posts WHERE 1=1';
    const params: any[] = [];

    if (filters?.platform) {
      query += ' AND platform = ?';
      params.push(filters.platform);
    }

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.startDate) {
      query += ' AND scheduled_time >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters?.endDate) {
      query += ' AND scheduled_time <= ?';
      params.push(filters.endDate.getTime());
    }

    query += ' ORDER BY scheduled_time ASC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      platform: row.platform,
      content: JSON.parse(row.content),
      scheduledTime: new Date(row.scheduled_time),
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      error: row.error,
      postId: row.post_id
    }));
  }

  public async cancelScheduledPost(id: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts 
      SET status = 'cancelled', updated_at = ?
      WHERE id = ? AND status = 'pending'
    `);

    const result = stmt.run(Date.now(), id);
    
    if (result.changes > 0) {
      // Remove from queue if it exists
      if (this.queue) {
        const jobs = await this.queue.getJobs(['delayed', 'waiting']);
        const job = jobs.find(j => j.data.postId === id);
        if (job) {
          await job.remove();
        }
      }

      // Remove cron job if it exists
      const cronJob = this.cronJobs.get(id);
      if (cronJob) {
        cronJob.destroy();
        this.cronJobs.delete(id);
      }

      return true;
    }

    return false;
  }

  private async processPostUpload(job: any): Promise<void> {
    const { postId } = job.data;
    
    // Get post from database
    const stmt = this.db.prepare('SELECT * FROM scheduled_posts WHERE id = ?');
    const postData = stmt.get(postId) as any;
    
    if (!postData || postData.status !== 'pending') {
      throw new Error(`Post ${postId} not found or not pending`);
    }

    const post: ScheduledPost = {
      id: postData.id,
      platform: postData.platform,
      content: JSON.parse(postData.content),
      scheduledTime: new Date(postData.scheduled_time),
      status: postData.status,
      attempts: postData.attempts,
      maxAttempts: postData.max_attempts,
      createdAt: new Date(postData.created_at),
      updatedAt: new Date(postData.updated_at),
      error: postData.error,
      postId: postData.post_id
    };

    // Update status to processing
    this.updatePostStatus(postId, 'processing');

    try {
      // Check if account is connected
      if (!accountManager.isConnected(post.platform)) {
        throw new Error(`${post.platform} account is not connected`);
      }

      let success = false;

      // Try API first, fallback to embedded browser
      if (['twitter', 'facebook', 'reddit', 'youtube'].includes(post.platform)) {
        success = await this.uploadViaAPI(post);
      } else {
        success = await this.uploadViaEmbeddedBrowser(post);
      }

      if (success) {
        this.updatePostStatus(postId, 'completed');
      } else {
        throw new Error('Upload failed');
      }

    } catch (error) {
      // Increment attempts
      const newAttempts = post.attempts + 1;
      
      if (newAttempts >= post.maxAttempts) {
        this.updatePostStatus(postId, 'failed', error.message);
      } else {
        // Schedule retry
        const updateStmt = this.db.prepare(`
          UPDATE scheduled_posts 
          SET attempts = ?, updated_at = ?
          WHERE id = ?
        `);
        updateStmt.run(newAttempts, Date.now(), postId);

        // Reschedule with exponential backoff
        const retryDelay = Math.pow(2, newAttempts) * 60 * 1000; // 2^n minutes
        if (this.queue) {
          await this.queue.add('post-upload', { postId }, { delay: retryDelay });
        }
      }
      
      throw error;
    }
  }

  private async uploadViaAPI(post: ScheduledPost): Promise<boolean> {
    // Implementation would depend on the specific platform's API
    // This is a placeholder for the actual API upload logic
    console.log(`Uploading post via API for ${post.platform}`);
    return false; // Fallback to embedded browser
  }

  private async uploadViaEmbeddedBrowser(post: ScheduledPost): Promise<boolean> {
    const browser = await this.getOrCreateBrowser(post.platform);
    
    if (!browser) {
      throw new Error(`Embedded browser not supported for ${post.platform}`);
    }

    const uploadData = {
      mediaPath: post.content.mediaPath || '',
      caption: post.content.caption,
      hashtags: post.content.hashtags
    };

    return await browser.uploadPost(uploadData);
  }

  private async getOrCreateBrowser(platform: string): Promise<EmbeddedBrowser | null> {
    if (!['instagram', 'tiktok'].includes(platform)) {
      return null;
    }

    let browser = this.browsers.get(platform);
    
    if (!browser) {
      const config = {
        platform: platform as 'instagram' | 'tiktok',
        url: platform === 'instagram' ? 'https://www.instagram.com' : 'https://www.tiktok.com',
        persistCookies: true,
        autoLogin: true
      };

      browser = new EmbeddedBrowser(config);
      this.browsers.set(platform, browser);
    }

    if (!browser.isOpen()) {
      await browser.createWindow();
    }

    return browser;
  }

  private updatePostStatus(id: string, status: string, error?: string): void {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts 
      SET status = ?, updated_at = ?, error = ?
      WHERE id = ?
    `);
    
    stmt.run(status, Date.now(), error || null, id);
  }

  private scheduleCronJob(post: ScheduledPost): void {
    const cronTime = this.dateToCron(post.scheduledTime);
    const job = cron.schedule(cronTime, async () => {
      await this.processPostUpload({ data: { postId: post.id } });
      job.destroy();
      this.cronJobs.delete(post.id);
    }, { scheduled: false });

    job.start();
    this.cronJobs.set(post.id, job);
  }

  private scheduleCleanupJob(): void {
    // Run cleanup daily at 2 AM
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldPosts();
    });
  }

  private cleanupOldPosts(): void {
    // Remove completed/failed posts older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const stmt = this.db.prepare(`
      DELETE FROM scheduled_posts 
      WHERE (status IN ('completed', 'failed', 'cancelled')) 
      AND updated_at < ?
    `);
    
    const result = stmt.run(thirtyDaysAgo);
    console.log(`Cleaned up ${result.changes} old posts`);
  }

  private getDefaultOptimalTimes(platform: string): OptimalPostingTime[] {
    // Research-based optimal posting times
    const defaults: Record<string, OptimalPostingTime[]> = {
      instagram: [
        { platform, dayOfWeek: 1, hour: 11, engagement: 85, timezone: 'UTC' }, // Monday 11 AM
        { platform, dayOfWeek: 2, hour: 14, engagement: 82, timezone: 'UTC' }, // Tuesday 2 PM
        { platform, dayOfWeek: 5, hour: 9, engagement: 80, timezone: 'UTC' },  // Friday 9 AM
      ],
      tiktok: [
        { platform, dayOfWeek: 2, hour: 9, engagement: 88, timezone: 'UTC' },  // Tuesday 9 AM
        { platform, dayOfWeek: 4, hour: 12, engagement: 85, timezone: 'UTC' }, // Thursday 12 PM
        { platform, dayOfWeek: 5, hour: 17, engagement: 83, timezone: 'UTC' }, // Friday 5 PM
      ],
      twitter: [
        { platform, dayOfWeek: 1, hour: 9, engagement: 78, timezone: 'UTC' },  // Monday 9 AM
        { platform, dayOfWeek: 3, hour: 15, engagement: 76, timezone: 'UTC' }, // Wednesday 3 PM
        { platform, dayOfWeek: 5, hour: 12, engagement: 75, timezone: 'UTC' }, // Friday 12 PM
      ]
    };

    return defaults[platform] || [];
  }

  private getNextOptimalTime(optimalTime: OptimalPostingTime): Date {
    const now = new Date();
    const target = new Date(now);
    
    // Set to the optimal day and hour
    const daysUntilTarget = (optimalTime.dayOfWeek + 7 - now.getDay()) % 7;
    target.setDate(now.getDate() + (daysUntilTarget || 7)); // If today, schedule for next week
    target.setHours(optimalTime.hour, 0, 0, 0);

    return target;
  }

  private handleJobCompleted(job: any): void {
    console.log(`Post upload completed: ${job.data.postId}`);
  }

  private handleJobFailed(job: any, error: Error): void {
    console.error(`Post upload failed: ${job.data.postId}`, error);
  }

  private dateToCron(date: Date): string {
    return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} *`;
  }

  private generateId(): string {
    return 'post_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  public async close(): Promise<void> {
    // Close all browsers
    for (const browser of this.browsers.values()) {
      await browser.close();
    }

    // Close database
    this.db.close();

    // Close Redis connection
    if (this.redis) {
      this.redis.disconnect();
    }

    // Close queue
    if (this.queue) {
      await this.queue.close();
    }

    // Cancel all cron jobs
    for (const job of this.cronJobs.values()) {
      job.destroy();
    }
  }
}

// Export singleton instance
export const postScheduler = PostScheduler.getInstance();