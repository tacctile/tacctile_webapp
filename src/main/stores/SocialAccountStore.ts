import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { StoredAccount } from '../../services/social/AccountManager';

export class SocialAccountStore {
  private db: Database.Database;

  constructor() {
    const dbPath = join(app.getPath('userData'), 'social-accounts.db');
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create social_accounts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        platform TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        display_name TEXT NOT NULL,
        profile_image TEXT,
        encrypted_tokens TEXT NOT NULL,
        last_connected INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create social_activity table for tracking usage
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        activity_type TEXT NOT NULL, -- 'share', 'connect', 'disconnect'
        activity_data TEXT, -- JSON data
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (platform) REFERENCES social_accounts (platform)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_social_activity_platform_timestamp 
      ON social_activity (platform, timestamp);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_social_accounts_active 
      ON social_accounts (is_active);
    `);
  }

  async saveAccount(account: StoredAccount): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO social_accounts 
      (platform, username, display_name, profile_image, encrypted_tokens, last_connected, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `);

    stmt.run(
      account.platform,
      account.username,
      account.displayName,
      account.profileImage || null,
      account.encryptedTokens,
      Math.floor(account.lastConnected.getTime() / 1000),
      account.isActive ? 1 : 0
    );

    // Log the activity
    this.logActivity(account.platform, 'connect', {
      username: account.username,
      displayName: account.displayName
    });
  }

  async removeAccount(platform: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM social_accounts WHERE platform = ?');
    stmt.run(platform);

    // Log the activity
    this.logActivity(platform, 'disconnect', {});
  }

  async loadAllAccounts(): Promise<StoredAccount[]> {
    const stmt = this.db.prepare(`
      SELECT platform, username, display_name, profile_image, encrypted_tokens, 
             last_connected, is_active
      FROM social_accounts 
      WHERE is_active = 1
      ORDER BY last_connected DESC
    `);

    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      platform: row.platform,
      username: row.username,
      displayName: row.display_name,
      profileImage: row.profile_image,
      encryptedTokens: row.encrypted_tokens,
      lastConnected: new Date(row.last_connected * 1000),
      isActive: row.is_active === 1
    }));
  }

  async getAccount(platform: string): Promise<StoredAccount | null> {
    const stmt = this.db.prepare(`
      SELECT platform, username, display_name, profile_image, encrypted_tokens, 
             last_connected, is_active
      FROM social_accounts 
      WHERE platform = ? AND is_active = 1
    `);

    const row = stmt.get(platform) as any;
    
    if (!row) return null;

    return {
      platform: row.platform,
      username: row.username,
      displayName: row.display_name,
      profileImage: row.profile_image,
      encryptedTokens: row.encrypted_tokens,
      lastConnected: new Date(row.last_connected * 1000),
      isActive: row.is_active === 1
    };
  }

  async updateLastConnected(platform: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE social_accounts 
      SET last_connected = strftime('%s', 'now'), updated_at = strftime('%s', 'now')
      WHERE platform = ?
    `);
    
    stmt.run(platform);
  }

  async deactivateAccount(platform: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE social_accounts 
      SET is_active = 0, updated_at = strftime('%s', 'now')
      WHERE platform = ?
    `);
    
    stmt.run(platform);
  }

  async getAccountStats(): Promise<{ connectedAccounts: number; recentShares: number; totalActivity: number }> {
    const connectedAccounts = this.db.prepare('SELECT COUNT(*) as count FROM social_accounts WHERE is_active = 1').get() as any;
    
    const recentShares = this.db.prepare(`
      SELECT COUNT(*) as count FROM social_activity 
      WHERE activity_type = 'share' 
      AND timestamp > strftime('%s', 'now', '-7 days')
    `).get() as any;
    
    const totalActivity = this.db.prepare('SELECT COUNT(*) as count FROM social_activity').get() as any;

    return {
      connectedAccounts: connectedAccounts.count,
      recentShares: recentShares.count,
      totalActivity: totalActivity.count
    };
  }

  private logActivity(platform: string, activityType: string, data: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO social_activity (platform, activity_type, activity_data)
      VALUES (?, ?, ?)
    `);

    stmt.run(platform, activityType, JSON.stringify(data));
  }

  close(): void {
    this.db.close();
  }
}