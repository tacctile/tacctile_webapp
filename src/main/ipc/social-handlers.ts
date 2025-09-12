import { ipcMain } from 'electron';
import { createHash, createCipher, createDecipher, randomBytes } from 'crypto';
import { TwitterService } from '../services/TwitterService';
import { RedditService } from '../services/RedditService';
import { YouTubeService } from '../services/YouTubeService';
import { FacebookService } from '../services/FacebookService';
import { SocialAccountStore } from '../stores/SocialAccountStore';

// Encryption key - in production, this should be stored securely
const ENCRYPTION_KEY = process.env.SOCIAL_ENCRYPTION_KEY || 'ghost-hunter-social-key-2024';

export function setupSocialHandlers(): void {
  // Encryption handlers
  ipcMain.handle('encrypt-data', async (event, data: string) => {
    try {
      const cipher = createCipher('aes-256-cbc', ENCRYPTION_KEY);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  });

  ipcMain.handle('decrypt-data', async (event, encryptedData: string) => {
    try {
      const decipher = createDecipher('aes-256-cbc', ENCRYPTION_KEY);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  });

  // Platform connection testing
  ipcMain.handle('test-twitter-connection', async (event, credentials) => {
    const twitterService = new TwitterService();
    return await twitterService.testConnection(credentials);
  });

  ipcMain.handle('test-reddit-connection', async (event, credentials) => {
    const redditService = new RedditService();
    return await redditService.testConnection(credentials);
  });

  ipcMain.handle('test-youtube-connection', async (event, credentials) => {
    const youtubeService = new YouTubeService();
    return await youtubeService.testConnection(credentials);
  });

  ipcMain.handle('test-facebook-connection', async (event, credentials) => {
    const facebookService = new FacebookService();
    return await facebookService.testConnection(credentials);
  });

  // Token revocation
  ipcMain.handle('revoke-tokens', async (event, platform: string, credentials) => {
    switch (platform) {
      case 'twitter':
        const twitterService = new TwitterService();
        return await twitterService.revokeTokens(credentials);
      case 'reddit':
        const redditService = new RedditService();
        return await redditService.revokeTokens(credentials);
      case 'youtube':
        const youtubeService = new YouTubeService();
        return await youtubeService.revokeTokens(credentials);
      case 'facebook':
        const facebookService = new FacebookService();
        return await facebookService.revokeTokens(credentials);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  });

  // Account storage
  ipcMain.handle('save-social-account', async (event, account) => {
    const store = new SocialAccountStore();
    return await store.saveAccount(account);
  });

  ipcMain.handle('remove-social-account', async (event, platform: string) => {
    const store = new SocialAccountStore();
    return await store.removeAccount(platform);
  });

  ipcMain.handle('load-social-accounts', async (event) => {
    const store = new SocialAccountStore();
    return await store.loadAllAccounts();
  });
}