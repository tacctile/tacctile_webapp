import { ipcRenderer } from 'electron';
import { SocialAccount, SocialApiErrorClass, ConnectionStatus } from '../../components/social-hub/types';

export interface StoredAccount {
  platform: string;
  username: string;
  displayName: string;
  profileImage?: string;
  encryptedTokens: string;
  lastConnected: Date;
  isActive: boolean;
}

export interface ConnectionCredentials {
  platform: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  username?: string;
  password?: string;
}

export class AccountManager {
  private static instance: AccountManager;
  private accounts: Map<string, StoredAccount> = new Map();
  private connectionStatuses: Map<string, ConnectionStatus> = new Map();

  private constructor() {
    this.loadStoredAccounts();
  }

  public static getInstance(): AccountManager {
    if (!AccountManager.instance) {
      AccountManager.instance = new AccountManager();
    }
    return AccountManager.instance;
  }

  async connect(platform: string, credentials: ConnectionCredentials): Promise<SocialAccount> {
    try {
      this.setConnectionStatus(platform, 'connecting');

      // Validate credentials
      if (!this.validateCredentials(platform, credentials)) {
        throw new Error(`Invalid credentials for ${platform}`);
      }

      // Encrypt and store credentials
      const encryptedTokens = await this.encryptCredentials(credentials);
      
      // Test connection with the platform
      const accountInfo = await this.testConnection(platform, credentials);
      
      // Store the account
      const storedAccount: StoredAccount = {
        platform,
        username: accountInfo.username,
        displayName: accountInfo.displayName,
        profileImage: accountInfo.profileImage,
        encryptedTokens,
        lastConnected: new Date(),
        isActive: true,
      };

      this.accounts.set(platform, storedAccount);
      await this.saveAccount(storedAccount);
      
      this.setConnectionStatus(platform, 'connected');
      
      return accountInfo;
    } catch (error) {
      this.setConnectionStatus(platform, 'error');
      throw new SocialApiErrorClass({
        platform,
        code: 'CONNECTION_FAILED',
        message: `Failed to connect to ${platform}: ${error.message}`,
        details: error,
      });
    }
  }

  async disconnect(platform: string): Promise<void> {
    try {
      // Revoke tokens if possible
      const account = this.accounts.get(platform);
      if (account) {
        await this.revokeTokens(platform, account.encryptedTokens);
      }

      // Remove from storage
      this.accounts.delete(platform);
      await this.removeAccount(platform);
      
      this.setConnectionStatus(platform, 'disconnected');
    } catch (error) {
      console.error(`Failed to disconnect from ${platform}:`, error);
      throw error;
    }
  }

  getAccount(platform: string): StoredAccount | undefined {
    return this.accounts.get(platform);
  }

  getConnectionStatus(platform: string): ConnectionStatus {
    return this.connectionStatuses.get(platform) || 'disconnected';
  }

  getAllAccounts(): StoredAccount[] {
    return Array.from(this.accounts.values());
  }

  isConnected(platform: string): boolean {
    return this.connectionStatuses.get(platform) === 'connected';
  }

  private setConnectionStatus(platform: string, status: ConnectionStatus): void {
    this.connectionStatuses.set(platform, status);
    // Notify components of status change
    window.dispatchEvent(new CustomEvent('socialConnectionStatusChanged', {
      detail: { platform, status }
    }));
  }

  private validateCredentials(platform: string, credentials: ConnectionCredentials): boolean {
    switch (platform) {
      case 'twitter':
        return !!(credentials.clientId && credentials.clientSecret);
      case 'reddit':
        return !!(credentials.clientId && credentials.clientSecret && credentials.username);
      case 'youtube':
        return !!(credentials.apiKey || (credentials.clientId && credentials.clientSecret));
      case 'facebook':
        return !!(credentials.clientId && credentials.clientSecret);
      default:
        return false;
    }
  }

  private async encryptCredentials(credentials: ConnectionCredentials): Promise<string> {
    // Use Electron's main process for encryption
    return await ipcRenderer.invoke('encrypt-data', JSON.stringify(credentials));
  }

  private async decryptCredentials(encryptedData: string): Promise<ConnectionCredentials> {
    const decryptedData = await ipcRenderer.invoke('decrypt-data', encryptedData);
    return JSON.parse(decryptedData);
  }

  private async testConnection(platform: string, credentials: ConnectionCredentials): Promise<SocialAccount> {
    // Delegate to platform-specific services
    switch (platform) {
      case 'twitter':
        return await ipcRenderer.invoke('test-twitter-connection', credentials);
      case 'reddit':
        return await ipcRenderer.invoke('test-reddit-connection', credentials);
      case 'youtube':
        return await ipcRenderer.invoke('test-youtube-connection', credentials);
      case 'facebook':
        return await ipcRenderer.invoke('test-facebook-connection', credentials);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async revokeTokens(platform: string, encryptedTokens: string): Promise<void> {
    try {
      const credentials = await this.decryptCredentials(encryptedTokens);
      await ipcRenderer.invoke('revoke-tokens', platform, credentials);
    } catch (error) {
      console.error(`Failed to revoke tokens for ${platform}:`, error);
    }
  }

  private async saveAccount(account: StoredAccount): Promise<void> {
    await ipcRenderer.invoke('save-social-account', account);
  }

  private async removeAccount(platform: string): Promise<void> {
    await ipcRenderer.invoke('remove-social-account', platform);
  }

  private async loadStoredAccounts(): Promise<void> {
    try {
      const storedAccounts: StoredAccount[] = await ipcRenderer.invoke('load-social-accounts');
      
      for (const account of storedAccounts) {
        this.accounts.set(account.platform, account);
        
        // Verify connection status
        if (account.isActive) {
          this.verifyConnection(account.platform);
        } else {
          this.setConnectionStatus(account.platform, 'disconnected');
        }
      }
    } catch (error) {
      console.error('Failed to load stored accounts:', error);
    }
  }

  private async verifyConnection(platform: string): Promise<void> {
    try {
      const account = this.accounts.get(platform);
      if (!account) {
        this.setConnectionStatus(platform, 'disconnected');
        return;
      }

      this.setConnectionStatus(platform, 'connecting');
      const credentials = await this.decryptCredentials(account.encryptedTokens);
      await this.testConnection(platform, credentials);
      this.setConnectionStatus(platform, 'connected');
    } catch (error) {
      console.error(`Failed to verify connection for ${platform}:`, error);
      this.setConnectionStatus(platform, 'error');
    }
  }
}

// Create singleton instance
export const accountManager = AccountManager.getInstance();