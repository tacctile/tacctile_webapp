/**
 * Rate Limiter for Gemini API
 * Implements token bucket algorithm for API rate limiting
 */

import { logger } from '../../utils/logger';

interface RateLimiterConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
}

interface RateLimiterStats {
  minuteRequests: number;
  dayRequests: number;
  minuteResetTime: Date;
  dayResetTime: Date;
  isThrottled: boolean;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private minuteTokens: number;
  private dayTokens: number;
  private lastMinuteReset: Date;
  private lastDayReset: Date;
  private queue: Array<() => void> = [];
  private processing: boolean = false;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.minuteTokens = config.requestsPerMinute;
    this.dayTokens = config.requestsPerDay;
    this.lastMinuteReset = new Date();
    this.lastDayReset = new Date();
    
    // Start token refresh intervals
    this.startTokenRefresh();
  }

  /**
   * Start automatic token refresh
   */
  private startTokenRefresh(): void {
    // Refresh minute tokens every minute
    setInterval(() => {
      this.minuteTokens = this.config.requestsPerMinute;
      this.lastMinuteReset = new Date();
      this.processQueue();
    }, 60 * 1000);

    // Refresh day tokens every day
    setInterval(() => {
      this.dayTokens = this.config.requestsPerDay;
      this.lastDayReset = new Date();
      this.processQueue();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Wait for an available slot
   */
  async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      // Check if tokens are available
      if (this.hasAvailableTokens()) {
        const resolve = this.queue.shift();
        this.consumeToken();
        if (resolve) resolve();
      } else {
        // Calculate wait time
        const waitTime = this.getWaitTime();
        logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
        
        await this.sleep(waitTime);
        
        // Refresh tokens if time has passed
        this.refreshTokens();
      }
    }

    this.processing = false;
  }

  /**
   * Check if tokens are available
   */
  private hasAvailableTokens(): boolean {
    this.refreshTokens();
    return this.minuteTokens > 0 && this.dayTokens > 0;
  }

  /**
   * Consume a token
   */
  private consumeToken(): void {
    this.minuteTokens--;
    this.dayTokens--;
    
    logger.debug('Token consumed', {
      minuteRemaining: this.minuteTokens,
      dayRemaining: this.dayTokens
    });
  }

  /**
   * Refresh tokens if time periods have elapsed
   */
  private refreshTokens(): void {
    const now = new Date();
    
    // Refresh minute tokens
    const minuteElapsed = now.getTime() - this.lastMinuteReset.getTime();
    if (minuteElapsed >= 60 * 1000) {
      this.minuteTokens = this.config.requestsPerMinute;
      this.lastMinuteReset = now;
    }
    
    // Refresh day tokens
    const dayElapsed = now.getTime() - this.lastDayReset.getTime();
    if (dayElapsed >= 24 * 60 * 60 * 1000) {
      this.dayTokens = this.config.requestsPerDay;
      this.lastDayReset = now;
    }
  }

  /**
   * Calculate wait time until next available token
   */
  private getWaitTime(): number {
    const now = new Date();
    
    // Calculate time until next minute reset
    const minuteRemaining = 60 * 1000 - (now.getTime() - this.lastMinuteReset.getTime());
    
    // Calculate time until next day reset
    const dayRemaining = 24 * 60 * 60 * 1000 - (now.getTime() - this.lastDayReset.getTime());
    
    // Return the shorter wait time
    if (this.minuteTokens <= 0 && this.dayTokens > 0) {
      return Math.max(0, minuteRemaining);
    } else if (this.dayTokens <= 0) {
      return Math.max(0, dayRemaining);
    }
    
    return Math.min(minuteRemaining, dayRemaining);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limiter statistics
   */
  getStats(): RateLimiterStats {
    this.refreshTokens();
    
    return {
      minuteRequests: this.minuteTokens,
      dayRequests: this.dayTokens,
      minuteResetTime: new Date(this.lastMinuteReset.getTime() + 60 * 1000),
      dayResetTime: new Date(this.lastDayReset.getTime() + 24 * 60 * 60 * 1000),
      isThrottled: !this.hasAvailableTokens()
    };
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.minuteTokens = this.config.requestsPerMinute;
    this.dayTokens = this.config.requestsPerDay;
    this.lastMinuteReset = new Date();
    this.lastDayReset = new Date();
    this.queue = [];
    this.processing = false;
    
    logger.info('Rate limiter reset');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
    this.reset();
  }
}