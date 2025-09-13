import { BrowserWindow, session, WebContents } from 'electron';
import { join } from 'path';
// Fallback secure storage implementation (for development)
const fallbackSecureStorage = {
  async setPassword(service: string, account: string, password: string): Promise<void> {
    console.warn('Using fallback secure storage - not secure for production');
  },
  async getPassword(service: string, account: string): Promise<string | null> {
    console.warn('Using fallback secure storage - not secure for production');
    return null;
  },
  async deletePassword(service: string, account: string): Promise<boolean> {
    console.warn('Using fallback secure storage - not secure for production');
    return true;
  }
};

export interface BrowserConfig {
  platform: 'instagram' | 'tiktok';
  url: string;
  width?: number;
  height?: number;
  userAgent?: string;
  persistCookies?: boolean;
  autoLogin?: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
  totpSecret?: string; // For 2FA
}

export interface PostData {
  mediaPath: string;
  caption?: string;
  hashtags?: string[];
  schedule?: Date;
}

export class EmbeddedBrowser {
  private window: BrowserWindow | null = null;
  private config: BrowserConfig;
  private serviceName: string;
  private sessionPartition: string;

  constructor(config: BrowserConfig) {
    this.config = config;
    this.serviceName = `ghost-hunter-${config.platform}`;
    this.sessionPartition = `persist:${config.platform}`;
  }

  async createWindow(): Promise<BrowserWindow> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
      return this.window;
    }

    // Create session with partition for cookie persistence
    const ses = session.fromPartition(this.sessionPartition);
    
    // Configure session security
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'microphone', 'camera'];
      callback(allowedPermissions.includes(permission));
    });

    this.window = new BrowserWindow({
      width: this.config.width || 1200,
      height: this.config.height || 800,
      title: `${this.config.platform.charAt(0).toUpperCase() + this.config.platform.slice(1)} - Ghost Hunter Toolbox`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        session: ses,
        preload: join(__dirname, 'embedded-browser-preload.js')
      },
      icon: this.getPlatformIcon(),
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      fullscreenable: false
    });

    // Set custom user agent if provided
    if (this.config.userAgent) {
      this.window.webContents.setUserAgent(this.config.userAgent);
    } else {
      // Use mobile user agents for better compatibility
      const mobileUA = this.getMobileUserAgent();
      this.window.webContents.setUserAgent(mobileUA);
    }

    // Handle window events
    this.setupWindowEvents();

    // Setup content security
    this.setupContentSecurity();

    // Load the platform URL
    await this.window.loadURL(this.config.url);

    // Auto-login if enabled
    if (this.config.autoLogin) {
      await this.attemptAutoLogin();
    }

    this.window.show();
    return this.window;
  }

  private setupWindowEvents(): void {
    if (!this.window) return;

    this.window.on('closed', () => {
      this.window = null;
    });

    // Handle navigation
    this.window.webContents.on('will-navigate', (event, url) => {
      // Allow navigation within the same domain
      const platformDomain = new URL(this.config.url).hostname;
      const targetDomain = new URL(url).hostname;
      
      if (!targetDomain.includes(platformDomain.replace('www.', ''))) {
        event.preventDefault();
        console.log(`Blocked navigation to external domain: ${targetDomain}`);
      }
    });

    // Handle new window requests
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      // Block popups but allow OAuth redirects
      if (url.includes('oauth') || url.includes('auth')) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 600,
            height: 700,
            resizable: false,
            maximizable: false,
            minimizable: false
          }
        };
      }
      return { action: 'deny' };
    });

    // Monitor page loading
    this.window.webContents.on('did-finish-load', () => {
      this.injectHelperScripts();
    });
  }

  private setupContentSecurity(): void {
    if (!this.window) return;

    // Block ads and tracking
    this.window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      const blockedDomains = [
        'googleadservices.com',
        'doubleclick.net',
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.com/tr',
        'connect.facebook.net'
      ];

      const shouldBlock = blockedDomains.some(domain => details.url.includes(domain));
      callback({ cancel: shouldBlock });
    });
  }

  private async injectHelperScripts(): Promise<void> {
    if (!this.window) return;

    try {
      // Inject platform-specific helper scripts
      if (this.config.platform === 'instagram') {
        await this.injectInstagramHelpers();
      } else if (this.config.platform === 'tiktok') {
        await this.injectTikTokHelpers();
      }
    } catch (error) {
      console.error('Failed to inject helper scripts:', error);
    }
  }

  private async injectInstagramHelpers(): Promise<void> {
    if (!this.window) return;

    const helperScript = `
      // Instagram helper functions
      window.ghostHunter = {
        isLoginPage: () => document.querySelector('[data-testid="royal_login_form"]') !== null,
        isHomePage: () => document.querySelector('[data-testid="new-post-button"]') !== null,
        
        findUploadButton: () => document.querySelector('[data-testid="new-post-button"]'),
        findFileInput: () => document.querySelector('input[accept*="image"],input[accept*="video"]'),
        findCaptionTextarea: () => document.querySelector('textarea[aria-label*="caption"]'),
        findShareButton: () => document.querySelector('[data-testid="share-button"]'),
        
        simulateFileUpload: (filePath) => {
          const input = window.ghostHunter.findFileInput();
          if (input) {
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
            return true;
          }
          return false;
        },
        
        fillCaption: (text) => {
          const textarea = window.ghostHunter.findCaptionTextarea();
          if (textarea) {
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        }
      };
    `;

    await this.window.webContents.executeJavaScript(helperScript);
  }

  private async injectTikTokHelpers(): Promise<void> {
    if (!this.window) return;

    const helperScript = `
      // TikTok helper functions
      window.ghostHunter = {
        isLoginPage: () => document.querySelector('[data-e2e="login-form"]') !== null,
        isUploadPage: () => document.querySelector('[data-e2e="upload-btn"]') !== null,
        
        findUploadButton: () => document.querySelector('[data-e2e="upload-btn"]'),
        findFileInput: () => document.querySelector('input[type="file"]'),
        findCaptionInput: () => document.querySelector('[data-text="true"]'),
        findPostButton: () => document.querySelector('[data-e2e="post-btn"]'),
        
        simulateFileUpload: (filePath) => {
          const input = window.ghostHunter.findFileInput();
          if (input) {
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
            return true;
          }
          return false;
        },
        
        fillCaption: (text) => {
          const input = window.ghostHunter.findCaptionInput();
          if (input) {
            input.innerHTML = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
          return false;
        }
      };
    `;

    await this.window.webContents.executeJavaScript(helperScript);
  }

  async saveCredentials(credentials: LoginCredentials): Promise<void> {
    try {
      await fallbackSecureStorage.setPassword(this.serviceName, 'username', credentials.username);
      await fallbackSecureStorage.setPassword(this.serviceName, 'password', credentials.password);
      
      if (credentials.totpSecret) {
        await fallbackSecureStorage.setPassword(this.serviceName, 'totp', credentials.totpSecret);
      }
    } catch (error) {
      console.error('Failed to save credentials:', error);
      throw error;
    }
  }

  async getCredentials(): Promise<LoginCredentials | null> {
    try {
      const username = await fallbackSecureStorage.getPassword(this.serviceName, 'username');
      const password = await fallbackSecureStorage.getPassword(this.serviceName, 'password');
      const totpSecret = await fallbackSecureStorage.getPassword(this.serviceName, 'totp');

      if (username && password) {
        return {
          username,
          password,
          totpSecret: totpSecret || undefined
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get credentials:', error);
      return null;
    }
  }

  async clearCredentials(): Promise<void> {
    try {
      await fallbackSecureStorage.deletePassword(this.serviceName, 'username');
      await fallbackSecureStorage.deletePassword(this.serviceName, 'password');
      await fallbackSecureStorage.deletePassword(this.serviceName, 'totp');
    } catch (error) {
      console.error('Failed to clear credentials:', error);
    }
  }

  private async attemptAutoLogin(): Promise<void> {
    if (!this.window) return;

    const credentials = await this.getCredentials();
    if (!credentials) return;

    try {
      await this.window.webContents.executeJavaScript(`
        (async () => {
          // Wait for login form to load
          let retries = 0;
          while (retries < 10 && !window.ghostHunter.isLoginPage()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries++;
          }

          if (window.ghostHunter.isLoginPage()) {
            const usernameInput = document.querySelector('input[name="username"]');
            const passwordInput = document.querySelector('input[name="password"]');
            const loginButton = document.querySelector('[type="submit"]');

            if (usernameInput && passwordInput && loginButton) {
              usernameInput.value = '${credentials.username}';
              passwordInput.value = '${credentials.password}';
              
              usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
              passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
              
              setTimeout(() => loginButton.click(), 500);
              return true;
            }
          }
          return false;
        })()
      `);
    } catch (error) {
      console.error('Auto-login failed:', error);
    }
  }

  async uploadPost(data: PostData): Promise<boolean> {
    if (!this.window) {
      throw new Error('Browser window not available');
    }

    try {
      // Navigate to upload page if needed
      if (this.config.platform === 'instagram') {
        await this.navigateToInstagramUpload();
      } else if (this.config.platform === 'tiktok') {
        await this.navigateToTikTokUpload();
      }

      // Wait for upload interface
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate file upload
      const uploadSuccess = await this.window.webContents.executeJavaScript(`
        window.ghostHunter.simulateFileUpload('${data.mediaPath}')
      `);

      if (!uploadSuccess) {
        throw new Error('Failed to trigger file upload');
      }

      // Wait for file processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Add caption if provided
      if (data.caption) {
        let fullCaption = data.caption;
        if (data.hashtags && data.hashtags.length > 0) {
          fullCaption += '\n\n' + data.hashtags.map(tag => `#${tag}`).join(' ');
        }

        await this.window.webContents.executeJavaScript(`
          window.ghostHunter.fillCaption('${fullCaption.replace(/'/g, "\\'")}')
        `);
      }

      // Submit post
      await this.window.webContents.executeJavaScript(`
        const shareBtn = window.ghostHunter.findShareButton() || window.ghostHunter.findPostButton();
        if (shareBtn) {
          shareBtn.click();
          return true;
        }
        return false;
      `);

      return true;
    } catch (error) {
      console.error('Upload failed:', error);
      return false;
    }
  }

  private async navigateToInstagramUpload(): Promise<void> {
    if (!this.window) return;
    await this.window.loadURL('https://www.instagram.com/create/select/');
  }

  private async navigateToTikTokUpload(): Promise<void> {
    if (!this.window) return;
    await this.window.loadURL('https://www.tiktok.com/upload');
  }

  private getMobileUserAgent(): string {
    if (this.config.platform === 'instagram') {
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    } else if (this.config.platform === 'tiktok') {
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    }
    return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
  }

  private getPlatformIcon(): string {
    // Return platform-specific icon paths
    return join(__dirname, `../../assets/${this.config.platform}-icon.png`);
  }

  async close(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
      this.window = null;
    }
  }

  isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }

  focus(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
    }
  }
}