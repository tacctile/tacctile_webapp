// import Database from 'better-sqlite3'; // Temporarily disabled for basic startup
import { app } from 'electron';
import { join } from 'path';
import { StoredAccount } from '../../services/social/AccountManager';

export class SocialAccountStore {
  // private db: Database.Database; // Temporarily disabled
  private accounts: Map<string, StoredAccount> = new Map(); // In-memory store for now

  constructor() {
    // Temporarily disabled database initialization
    // const dbPath = join(app.getPath('userData'), 'social-accounts.db');
    // this.db = new Database(dbPath);
    // this.initializeDatabase();
    console.log('SocialAccountStore initialized with in-memory storage (database temporarily disabled)');
  }

  private initializeDatabase(): void {
    // Temporarily disabled - database functionality removed for basic startup
    console.log('Database initialization skipped (better-sqlite3 temporarily disabled)');
  }

  async saveAccount(account: StoredAccount): Promise<void> {
    // In-memory storage implementation
    this.accounts.set(account.platform, { ...account });
    console.log(`Account saved for platform: ${account.platform}`);
  }

  async removeAccount(platform: string): Promise<void> {
    // In-memory storage implementation
    this.accounts.delete(platform);
    console.log(`Account removed for platform: ${platform}`);
  }

  async loadAllAccounts(): Promise<StoredAccount[]> {
    // In-memory storage implementation
    return Array.from(this.accounts.values()).filter(account => account.isActive);
  }

  async getAccount(platform: string): Promise<StoredAccount | null> {
    // In-memory storage implementation
    const account = this.accounts.get(platform);
    return account && account.isActive ? account : null;
  }

  async updateLastConnected(platform: string): Promise<void> {
    // In-memory storage implementation
    const account = this.accounts.get(platform);
    if (account) {
      account.lastConnected = new Date();
      this.accounts.set(platform, account);
    }
  }

  async deactivateAccount(platform: string): Promise<void> {
    // In-memory storage implementation
    const account = this.accounts.get(platform);
    if (account) {
      account.isActive = false;
      this.accounts.set(platform, account);
    }
  }

  async getAccountStats(): Promise<{ connectedAccounts: number; recentShares: number; totalActivity: number }> {
    // In-memory storage implementation with placeholder values
    const connectedAccounts = Array.from(this.accounts.values()).filter(account => account.isActive).length;

    return {
      connectedAccounts,
      recentShares: 0, // Placeholder - activity tracking temporarily disabled
      totalActivity: 0 // Placeholder - activity tracking temporarily disabled
    };
  }

  private logActivity(platform: string, activityType: string, data: any): void {
    // Temporarily disabled - activity logging requires database
    console.log(`Activity logged: ${platform} - ${activityType}`, data);
  }

  close(): void {
    // Temporarily disabled - no database connection to close
    console.log('SocialAccountStore closed (no database connection to close)');
  }
}