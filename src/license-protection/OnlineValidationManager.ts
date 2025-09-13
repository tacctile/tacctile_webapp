/**
 * Online Validation Manager
 * Handles periodic license validation with server communication and offline grace periods
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import {
  ValidationRequest,
  ValidationResponse,
  LicenseServerConfig,
  APIResponse,
  APIError,
  ValidationConfiguration,
  LicenseInfo,
  ValidationError,
  ValidationWarning,
  GracePeriodInfo,
  GracePeriodReason,
  OfflineConfiguration
} from './types';

export class OnlineValidationManager extends EventEmitter {
  private serverConfig: LicenseServerConfig;
  private validationConfig: ValidationConfiguration;
  private offlineConfig: OfflineConfiguration;
  private validationTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private isOnline = true;
  private lastSuccessfulValidation: Date | null = null;
  private validationCache: Map<string, ValidationResponse> = new Map();
  private pendingRequests: Map<string, Promise<ValidationResponse>> = new Map();
  private gracePeriodActive = false;
  private gracePeriodReason: GracePeriodReason | null = null;
  private retryCount = 0;
  private initialized = false;

  constructor(
    serverConfig: LicenseServerConfig,
    validationConfig?: Partial<ValidationConfiguration>,
    offlineConfig?: Partial<OfflineConfiguration>
  ) {
    super();
    
    this.serverConfig = serverConfig;
    this.validationConfig = {
      checkInterval: 24 * 60 * 60 * 1000, // 24 hours
      retryInterval: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
      timeoutMs: 30000, // 30 seconds
      cacheValidation: true,
      cacheDurationMs: 60 * 60 * 1000, // 1 hour
      requireOnlineValidation: true,
      allowCachedValidation: true,
      ...validationConfig
    };

    this.offlineConfig = {
      maxOfflineDays: 7,
      gracePeriodDays: 3,
      requiredFeatures: ['core'],
      degradedFeatures: ['premium', 'advanced'],
      emergencyMode: false,
      lastOnlineCheck: new Date(),
      nextRequiredCheck: new Date(Date.now() + this.validationConfig.checkInterval),
      offlineLicenseData: {
        data: '',
        signature: '',
        expiresAt: new Date(),
        issuer: '',
        algorithm: 'AES-256-GCM'
      },
      ...offlineConfig
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('OnlineValidationManager already initialized');
      return;
    }

    try {
      console.log('Initializing OnlineValidationManager...');
      
      // Test server connectivity
      await this.testServerConnection();
      
      // Load offline configuration
      this.loadOfflineState();
      
      // Start validation cycle
      this.startValidationCycle();
      
      this.initialized = true;
      console.log('OnlineValidationManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize OnlineValidationManager:', error);
      // Don't throw - allow offline operation
      this.isOnline = false;
      this.startGracePeriod(GracePeriodReason.NETWORK_ISSUES);
      this.initialized = true;
    }
  }

  /**
   * Validate license with server
   */
  public async validateLicense(request: ValidationRequest): Promise<ValidationResponse> {
    this.ensureInitialized();

    const requestKey = this.createRequestKey(request);

    // Check for pending request
    if (this.pendingRequests.has(requestKey)) {
      console.log('Returning pending validation request');
      return await this.pendingRequests.get(requestKey)!;
    }

    // Check cache first if allowed
    if (this.validationConfig.allowCachedValidation && this.validationCache.has(requestKey)) {
      const cached = this.validationCache.get(requestKey)!;
      const cacheAge = Date.now() - new Date(cached.serverTime).getTime();
      
      if (cacheAge < this.validationConfig.cacheDurationMs) {
        console.log('Returning cached validation result');
        this.emit('validation-cached', { request, response: cached });
        return cached;
      }
    }

    // Create validation promise
    const validationPromise = this.performOnlineValidation(request);
    this.pendingRequests.set(requestKey, validationPromise);

    try {
      const response = await validationPromise;
      
      // Cache successful response
      if (response.valid && this.validationConfig.cacheValidation) {
        this.validationCache.set(requestKey, response);
      }

      // Update online status
      this.updateOnlineStatus(true);
      
      return response;
    } catch (error) {
      console.error('Online validation failed:', error);
      this.updateOnlineStatus(false);
      
      // Try offline validation if online fails
      return await this.handleOfflineValidation(request, error);
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * Perform actual server validation
   */
  private async performOnlineValidation(request: ValidationRequest): Promise<ValidationResponse> {
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify({
        ...request,
        timestamp: new Date().toISOString(),
        signature: this.signRequest(request)
      });

      const options = this.createRequestOptions('POST', '/api/v1/validate', requestData);
      
      const req = (this.serverConfig.enableSSL ? https : http).request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data) as APIResponse<ValidationResponse>;
            
            if (response.success && response.data) {
              // Verify response signature
              if (this.verifyResponseSignature(response.data)) {
                this.lastSuccessfulValidation = new Date();
                this.offlineConfig.lastOnlineCheck = new Date();
                this.emit('validation-success', { request, response: response.data });
                resolve(response.data);
              } else {
                reject(new Error('Response signature verification failed'));
              }
            } else {
              const error = response.error || { code: 'UNKNOWN_ERROR', message: 'Unknown validation error' };
              reject(new Error(`Validation failed: ${error.message}`));
            }
          } catch (error) {
            reject(new Error(`Invalid response format: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(this.validationConfig.timeoutMs, () => {
        req.destroy();
        reject(new Error('Validation request timeout'));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Handle offline validation when online fails
   */
  private async handleOfflineValidation(request: ValidationRequest, originalError: Error): Promise<ValidationResponse> {
    const now = new Date();
    const daysSinceLastValidation = this.lastSuccessfulValidation ?
      Math.floor((now.getTime() - this.lastSuccessfulValidation.getTime()) / (1000 * 60 * 60 * 24)) : 
      999;

    // Check if we can operate offline
    if (daysSinceLastValidation <= this.offlineConfig.maxOfflineDays) {
      // Check cache for offline validation
      const requestKey = this.createRequestKey(request);
      const cachedResponse = this.validationCache.get(requestKey);

      if (cachedResponse && this.validationConfig.allowCachedValidation) {
        const offlineResponse: ValidationResponse = {
          ...cachedResponse,
          warnings: [
            ...cachedResponse.warnings || [],
            {
              code: 'OFFLINE_MODE',
              message: `Operating in offline mode (${daysSinceLastValidation}/${this.offlineConfig.maxOfflineDays} days)`
            }
          ],
          nextValidation: new Date(Date.now() + this.validationConfig.retryInterval)
        };

        this.emit('offline-validation', { request, response: offlineResponse });
        return offlineResponse;
      }
    }

    // Start grace period if not already active
    if (!this.gracePeriodActive && daysSinceLastValidation <= this.offlineConfig.gracePeriodDays) {
      this.startGracePeriod(GracePeriodReason.NETWORK_ISSUES);
    }

    // Return error response
    const errorResponse: ValidationResponse = {
      valid: false,
      errors: [
        {
          code: 'OFFLINE_VALIDATION_FAILED',
          message: `Cannot validate license: ${originalError.message}`,
          details: {
            daysSinceLastValidation,
            maxOfflineDays: this.offlineConfig.maxOfflineDays,
            gracePeriodActive: this.gracePeriodActive
          },
          recoverable: daysSinceLastValidation <= this.offlineConfig.gracePeriodDays
        }
      ],
      serverTime: now,
      signature: '',
      nextValidation: new Date(Date.now() + this.validationConfig.retryInterval)
    };

    if (this.gracePeriodActive) {
      const remainingDays = this.offlineConfig.gracePeriodDays - daysSinceLastValidation;
      errorResponse.gracePeriod = {
        active: true,
        remainingDays: Math.max(0, remainingDays),
        reason: this.gracePeriodReason!,
        startedAt: this.lastSuccessfulValidation!,
        endsAt: new Date(this.lastSuccessfulValidation!.getTime() + (this.offlineConfig.gracePeriodDays * 24 * 60 * 60 * 1000))
      };
    }

    this.emit('validation-failed', { request, response: errorResponse, error: originalError });
    return errorResponse;
  }

  /**
   * Start periodic validation cycle
   */
  private startValidationCycle(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }

    this.validationTimer = setInterval(() => {
      this.performPeriodicValidation().catch(error => {
        console.error('Periodic validation error:', error);
      });
    }, this.validationConfig.checkInterval);

    console.log(`Validation cycle started (interval: ${this.validationConfig.checkInterval}ms)`);
  }

  /**
   * Perform periodic validation check
   */
  private async performPeriodicValidation(): Promise<void> {
    try {
      // Check if validation is due
      const now = new Date();
      if (now < this.offlineConfig.nextRequiredCheck) {
        return;
      }

      console.log('Performing periodic license validation...');
      
      // Create validation request (this would typically use stored license info)
      const request: ValidationRequest = {
        licenseKey: 'stored-license-key', // Would be retrieved from secure storage
        hardwareFingerprint: 'current-hardware-fingerprint', // Would be generated
        productId: 'tacctile-toolbox',
        version: '1.0.0',
        timestamp: now
      };

      const response = await this.validateLicense(request);
      
      if (response.valid) {
        this.endGracePeriod();
        this.offlineConfig.nextRequiredCheck = new Date(now.getTime() + this.validationConfig.checkInterval);
        this.emit('periodic-validation-success', response);
      } else {
        this.emit('periodic-validation-failed', response);
      }

    } catch (error) {
      console.error('Periodic validation failed:', error);
      this.scheduleRetry();
    }
  }

  /**
   * Schedule retry for failed validation
   */
  private scheduleRetry(): void {
    if (this.retryCount >= this.validationConfig.maxRetries) {
      console.log('Max retries reached, starting grace period');
      this.startGracePeriod(GracePeriodReason.NETWORK_ISSUES);
      return;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.retryCount++;
    const retryDelay = this.validationConfig.retryInterval * Math.pow(2, this.retryCount - 1); // Exponential backoff

    console.log(`Scheduling retry ${this.retryCount}/${this.validationConfig.maxRetries} in ${retryDelay}ms`);

    this.retryTimer = setTimeout(() => {
      this.performPeriodicValidation().catch(error => {
        console.error('Retry validation error:', error);
      });
    }, retryDelay);
  }

  /**
   * Start grace period
   */
  private startGracePeriod(reason: GracePeriodReason): void {
    if (this.gracePeriodActive) {
      return;
    }

    console.log(`Starting grace period: ${reason}`);
    
    this.gracePeriodActive = true;
    this.gracePeriodReason = reason;
    
    // Schedule grace period end
    setTimeout(() => {
      if (this.gracePeriodActive) {
        this.endGracePeriod();
        this.emit('grace-period-expired');
      }
    }, this.offlineConfig.gracePeriodDays * 24 * 60 * 60 * 1000);

    this.emit('grace-period-started', {
      reason,
      durationDays: this.offlineConfig.gracePeriodDays
    });
  }

  /**
   * End grace period
   */
  private endGracePeriod(): void {
    if (!this.gracePeriodActive) {
      return;
    }

    console.log('Ending grace period');
    
    this.gracePeriodActive = false;
    this.gracePeriodReason = null;
    this.retryCount = 0;
    
    this.emit('grace-period-ended');
  }

  /**
   * Update online status
   */
  private updateOnlineStatus(online: boolean): void {
    if (this.isOnline !== online) {
      this.isOnline = online;
      
      if (online) {
        console.log('Server connection restored');
        this.endGracePeriod();
      } else {
        console.log('Server connection lost');
      }
      
      this.emit('connectivity-changed', online);
    }
  }

  /**
   * Test server connection
   */
  private async testServerConnection(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const options = this.createRequestOptions('GET', '/api/v1/health');
      
      const req = (this.serverConfig.enableSSL ? https : http).request(options, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          reject(new Error(`Server health check failed: ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Health check timeout'));
      });

      req.end();
    });
  }

  /**
   * Create HTTP request options
   */
  private createRequestOptions(method: string, endpoint: string, data?: string): any {
    const url = new URL(endpoint, this.serverConfig.baseUrl);
    
    const options: any = {
      hostname: url.hostname,
      port: url.port || (this.serverConfig.enableSSL ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Tacctile/1.0.0',
        'X-API-Key': this.serverConfig.apiKey
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    // Add SSL options if enabled
    if (this.serverConfig.enableSSL) {
      if (this.serverConfig.caCertificate) {
        options.ca = this.serverConfig.caCertificate;
      }
      
      if (this.serverConfig.clientCertificate && this.serverConfig.clientKey) {
        options.cert = this.serverConfig.clientCertificate;
        options.key = this.serverConfig.clientKey;
      }
    }

    return options;
  }

  /**
   * Sign validation request
   */
  private signRequest(request: ValidationRequest): string {
    const data = JSON.stringify({
      licenseKey: request.licenseKey,
      hardwareFingerprint: request.hardwareFingerprint,
      productId: request.productId,
      version: request.version,
      timestamp: request.timestamp
    });

    return crypto.createHmac('sha256', this.serverConfig.apiKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify response signature
   */
  private verifyResponseSignature(response: ValidationResponse): boolean {
    if (!response.signature) {
      return false;
    }

    const data = JSON.stringify({
      valid: response.valid,
      serverTime: response.serverTime,
      nextValidation: response.nextValidation
    });

    const expectedSignature = crypto.createHmac('sha256', this.serverConfig.apiKey)
      .update(data)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(response.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Create cache key for request
   */
  private createRequestKey(request: ValidationRequest): string {
    return crypto.createHash('sha256')
      .update(`${request.licenseKey}-${request.hardwareFingerprint}-${request.productId}`)
      .digest('hex');
  }

  /**
   * Load offline state
   */
  private loadOfflineState(): void {
    // This would load offline configuration from persistent storage
    // For now, use defaults
    console.log('Offline configuration loaded');
  }

  /**
   * Save offline state
   */
  private saveOfflineState(): void {
    // This would save offline configuration to persistent storage
    console.log('Offline configuration saved');
  }

  // Public API methods
  public getValidationStatus(): {
    isOnline: boolean;
    lastValidation: Date | null;
    gracePeriodActive: boolean;
    gracePeriodReason: GracePeriodReason | null;
    nextCheck: Date;
    retryCount: number;
  } {
    return {
      isOnline: this.isOnline,
      lastValidation: this.lastSuccessfulValidation,
      gracePeriodActive: this.gracePeriodActive,
      gracePeriodReason: this.gracePeriodReason,
      nextCheck: this.offlineConfig.nextRequiredCheck,
      retryCount: this.retryCount
    };
  }

  public async forceValidation(request: ValidationRequest): Promise<ValidationResponse> {
    console.log('Forcing immediate validation');
    return await this.validateLicense(request);
  }

  public enableEmergencyMode(): void {
    console.log('Emergency mode enabled');
    this.offlineConfig.emergencyMode = true;
    this.offlineConfig.maxOfflineDays = 30; // Extended offline period
    this.emit('emergency-mode-enabled');
  }

  public disableEmergencyMode(): void {
    console.log('Emergency mode disabled');
    this.offlineConfig.emergencyMode = false;
    this.offlineConfig.maxOfflineDays = 7; // Back to normal
    this.emit('emergency-mode-disabled');
  }

  public clearValidationCache(): void {
    this.validationCache.clear();
    this.emit('cache-cleared');
  }

  public updateServerConfig(config: Partial<LicenseServerConfig>): void {
    this.serverConfig = { ...this.serverConfig, ...config };
    this.emit('server-config-updated');
  }

  public updateValidationConfig(config: Partial<ValidationConfiguration>): void {
    this.validationConfig = { ...this.validationConfig, ...config };
    
    // Restart validation cycle with new interval
    this.startValidationCycle();
    this.emit('validation-config-updated');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('OnlineValidationManager not initialized. Call initialize() first.');
    }
  }

  public async destroy(): Promise<void> {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.saveOfflineState();
    this.removeAllListeners();
    this.initialized = false;
    console.log('OnlineValidationManager destroyed');
  }
}