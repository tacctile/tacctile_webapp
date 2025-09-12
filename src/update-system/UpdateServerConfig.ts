import { UpdateServerConfig, UpdateConfiguration, UpdateChannel } from './types';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export class UpdateServerConfigManager {
  private config: UpdateServerConfig | null = null;
  private readonly configPath: string;
  private readonly defaultConfig: UpdateServerConfig;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'update-server.config.json');
    
    this.defaultConfig = {
      baseUrl: process.env.UPDATE_SERVER_URL || 'https://updates.tacctile.com',
      endpoints: {
        checkUpdate: '/api/v1/updates/check',
        downloadUpdate: '/api/v1/updates/download',
        validateSubscription: '/api/v1/subscription/validate',
        reportMetrics: '/api/v1/metrics/report'
      },
      security: {
        publicKeyPath: path.join(__dirname, '../../assets/keys/update-public.pem'),
        signatureAlgorithm: 'RSA-SHA256',
        certificatePinning: true,
        tlsVersion: '1.3'
      },
      caching: {
        enabled: true,
        maxCacheSize: 1024 * 1024 * 500, // 500MB
        cacheDuration: 3600000 // 1 hour
      }
    };
  }

  public async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.validateConfig();
      await this.ensurePublicKey();
    } catch (error) {
      console.error('Failed to initialize update server config:', error);
      // Fall back to default config
      this.config = { ...this.defaultConfig };
      await this.saveConfig();
    }
  }

  public getConfig(): UpdateServerConfig {
    if (!this.config) {
      throw new Error('UpdateServerConfig not initialized');
    }
    return { ...this.config };
  }

  public async updateConfig(newConfig: Partial<UpdateServerConfig>): Promise<void> {
    this.config = {
      ...this.config!,
      ...newConfig
    };
    
    await this.validateConfig();
    await this.saveConfig();
  }

  public getUpdateUrl(channel: UpdateChannel, platform: string, currentVersion: string): string {
    const config = this.getConfig();
    const url = new URL(config.endpoints.checkUpdate, config.baseUrl);
    
    url.searchParams.set('channel', channel);
    url.searchParams.set('platform', platform);
    url.searchParams.set('version', currentVersion);
    url.searchParams.set('appId', 'com.tacctile.ghosthunter');
    
    return url.toString();
  }

  public getDownloadUrl(version: string, platform: string, fileName: string): string {
    const config = this.getConfig();
    const url = new URL(config.endpoints.downloadUpdate, config.baseUrl);
    
    url.searchParams.set('version', version);
    url.searchParams.set('platform', platform);
    url.searchParams.set('file', fileName);
    
    return url.toString();
  }

  public getSubscriptionValidationUrl(): string {
    const config = this.getConfig();
    return new URL(config.endpoints.validateSubscription, config.baseUrl).toString();
  }

  public getMetricsUrl(): string {
    const config = this.getConfig();
    return new URL(config.endpoints.reportMetrics, config.baseUrl).toString();
  }

  public async getPublicKey(): Promise<string> {
    const config = this.getConfig();
    try {
      const publicKeyData = await fs.readFile(config.security.publicKeyPath, 'utf8');
      return publicKeyData.trim();
    } catch (error) {
      throw new Error(`Failed to load public key: ${error}`);
    }
  }

  public createRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': `GhostHunterToolbox/${app.getVersion()} (${process.platform})`,
      'X-Client-Version': app.getVersion(),
      'X-Client-Platform': process.platform,
      'X-Client-Arch': process.arch,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  public async verifyServerCertificate(hostname: string, cert: any): Promise<boolean> {
    const config = this.getConfig();
    
    if (!config.security.certificatePinning) {
      return true;
    }

    try {
      // Implement certificate pinning validation
      const expectedFingerprint = await this.getExpectedCertificateFingerprint(hostname);
      const actualFingerprint = this.calculateCertificateFingerprint(cert);
      
      return expectedFingerprint === actualFingerprint;
    } catch (error) {
      console.error('Certificate pinning validation failed:', error);
      return false;
    }
  }

  public generateSignatureHeaders(payload: string): Record<string, string> {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    return {
      'X-Signature-Timestamp': timestamp,
      'X-Signature-Nonce': nonce,
      'X-Signature-Version': '1.0'
    };
  }

  private async loadConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      this.config = { ...this.defaultConfig };
    }
  }

  private async saveConfig(): Promise<void> {
    const configData = JSON.stringify(this.config, null, 2);
    await fs.writeFile(this.configPath, configData, 'utf8');
  }

  private async validateConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to validate');
    }

    const { baseUrl, endpoints, security } = this.config;

    // Validate base URL
    try {
      new URL(baseUrl);
    } catch (error) {
      throw new Error(`Invalid base URL: ${baseUrl}`);
    }

    // Validate endpoints
    const requiredEndpoints = ['checkUpdate', 'downloadUpdate', 'validateSubscription', 'reportMetrics'];
    for (const endpoint of requiredEndpoints) {
      if (!endpoints[endpoint as keyof typeof endpoints]) {
        throw new Error(`Missing required endpoint: ${endpoint}`);
      }
    }

    // Validate security settings
    if (!['RSA-SHA256', 'ECDSA-SHA256'].includes(security.signatureAlgorithm)) {
      throw new Error(`Unsupported signature algorithm: ${security.signatureAlgorithm}`);
    }

    // Validate TLS version
    const supportedTlsVersions = ['1.2', '1.3'];
    if (!supportedTlsVersions.includes(security.tlsVersion)) {
      console.warn(`TLS version ${security.tlsVersion} may not be supported`);
    }
  }

  private async ensurePublicKey(): Promise<void> {
    const config = this.getConfig();
    
    try {
      await fs.access(config.security.publicKeyPath);
      // Validate the public key format
      const publicKey = await fs.readFile(config.security.publicKeyPath, 'utf8');
      if (!publicKey.includes('-----BEGIN PUBLIC KEY-----') || 
          !publicKey.includes('-----END PUBLIC KEY-----')) {
        throw new Error('Invalid public key format');
      }
    } catch (error) {
      console.warn('Public key not found or invalid, generating placeholder');
      await this.generatePlaceholderPublicKey();
    }
  }

  private async generatePlaceholderPublicKey(): Promise<void> {
    const config = this.getConfig();
    const keyDir = path.dirname(config.security.publicKeyPath);
    
    try {
      await fs.mkdir(keyDir, { recursive: true });
      
      // Generate a placeholder public key (in production, use a real key)
      const { publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      await fs.writeFile(config.security.publicKeyPath, publicKey, 'utf8');
      console.log('Generated placeholder public key for development');
    } catch (error) {
      console.error('Failed to generate placeholder public key:', error);
    }
  }

  private async getExpectedCertificateFingerprint(hostname: string): Promise<string> {
    // In production, this would load from a secure configuration
    // For now, return a placeholder
    const knownFingerprints: Record<string, string> = {
      'updates.tacctile.com': 'SHA256:placeholder-fingerprint-for-development'
    };
    
    return knownFingerprints[hostname] || '';
  }

  private calculateCertificateFingerprint(cert: any): string {
    // Calculate SHA256 fingerprint of the certificate
    const derBuffer = cert.raw || Buffer.from(cert.toString(), 'base64');
    return 'SHA256:' + crypto.createHash('sha256').update(derBuffer).digest('hex');
  }
}

export class UpdateConfigurationManager {
  private config: UpdateConfiguration;
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'update.config.json');
    
    this.config = {
      updateServerUrl: process.env.UPDATE_SERVER_URL || 'https://updates.tacctile.com',
      publicKey: '',
      channel: (process.env.UPDATE_CHANNEL as UpdateChannel) || 'stable',
      checkInterval: 4 * 60 * 60 * 1000, // 4 hours
      autoDownload: true,
      autoInstall: false, // Require user confirmation for professional software
      allowPrerelease: false,
      enableRollback: true,
      maxRollbackVersions: 5,
      updateCacheDirectory: path.join(app.getPath('userData'), 'update-cache'),
      signatureVerification: true,
      subscriptionValidation: true
    };
  }

  public async initialize(): Promise<void> {
    try {
      await this.loadConfig();
    } catch (error) {
      console.warn('Failed to load update configuration, using defaults:', error);
      await this.saveConfig();
    }
  }

  public getConfiguration(): UpdateConfiguration {
    return { ...this.config };
  }

  public async updateConfiguration(newConfig: Partial<UpdateConfiguration>): Promise<void> {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    await this.validateConfiguration();
    await this.saveConfig();
  }

  public async setChannel(channel: UpdateChannel): Promise<void> {
    this.config.channel = channel;
    await this.saveConfig();
  }

  public async setAutoDownload(enabled: boolean): Promise<void> {
    this.config.autoDownload = enabled;
    await this.saveConfig();
  }

  public async setAutoInstall(enabled: boolean): Promise<void> {
    this.config.autoInstall = enabled;
    await this.saveConfig();
  }

  private async loadConfig(): Promise<void> {
    const configData = await fs.readFile(this.configPath, 'utf8');
    const loadedConfig = JSON.parse(configData);
    
    // Merge with defaults to ensure all properties exist
    this.config = {
      ...this.config,
      ...loadedConfig
    };
  }

  private async saveConfig(): Promise<void> {
    const configData = JSON.stringify(this.config, null, 2);
    await fs.writeFile(this.configPath, configData, 'utf8');
  }

  private async validateConfiguration(): Promise<void> {
    // Validate update server URL
    try {
      new URL(this.config.updateServerUrl);
    } catch (error) {
      throw new Error(`Invalid update server URL: ${this.config.updateServerUrl}`);
    }

    // Validate channel
    const validChannels: UpdateChannel[] = ['stable', 'beta', 'alpha', 'development'];
    if (!validChannels.includes(this.config.channel)) {
      throw new Error(`Invalid update channel: ${this.config.channel}`);
    }

    // Validate check interval (minimum 1 hour for professional software)
    if (this.config.checkInterval < 60 * 60 * 1000) {
      throw new Error('Check interval must be at least 1 hour');
    }

    // Validate rollback settings
    if (this.config.maxRollbackVersions < 1 || this.config.maxRollbackVersions > 10) {
      throw new Error('Max rollback versions must be between 1 and 10');
    }

    // Ensure cache directory exists
    try {
      await fs.mkdir(this.config.updateCacheDirectory, { recursive: true });
    } catch (error) {
      console.warn('Failed to create update cache directory:', error);
    }
  }
}