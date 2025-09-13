/**
 * Subscription Manager
 * Handles subscription management, tier enforcement, enterprise multi-seat licensing,
 * and automatic renewal processes
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
  Seat,
  SeatRole,
  SeatStatus,
  SeatPermission,
  SeatManagement,
  BillingCycle,
  PaymentMethod,
  ValidationResponse,
  LicenseServerConfig,
  APIResponse,
  SubscriptionUsage,
  FeatureUsage,
  SeatUsage,
  BillingUsage,
  UsagePeriod,
  ISubscriptionManager
} from './types';

export interface SubscriptionConfiguration {
  serverConfig: LicenseServerConfig;
  autoRenewEnabled: boolean;
  renewalNoticeDays: number;
  paymentRetryDays: number;
  gracePeriodDays: number;
  seatManagementEnabled: boolean;
  usageTrackingEnabled: boolean;
  tierEnforcementStrict: boolean;
}

export class SubscriptionManager extends EventEmitter implements ISubscriptionManager {
  private config: SubscriptionConfiguration;
  private subscriptions: Map<string, Subscription> = new Map();
  private seats: Map<string, Seat> = new Map();
  private usageData: Map<string, SubscriptionUsage> = new Map();
  private renewalTimer: NodeJS.Timeout | null = null;
  private usageUpdateTimer: NodeJS.Timeout | null = null;
  private dataPath: string;
  private initialized = false;

  constructor(config: SubscriptionConfiguration) {
    super();
    
    this.config = config;
    const userDataPath = app.getPath('userData');
    this.dataPath = path.join(userDataPath, 'subscriptions');
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('SubscriptionManager already initialized');
      return;
    }

    try {
      console.log('Initializing SubscriptionManager...');
      
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.loadSubscriptions();
      await this.loadSeats();
      await this.loadUsageData();
      
      this.startRenewalMonitoring();
      if (this.config.usageTrackingEnabled) {
        this.startUsageTracking();
      }
      
      this.initialized = true;
      console.log('SubscriptionManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize SubscriptionManager:', error);
      throw error;
    }
  }

  /**
   * Get subscription by customer ID
   */
  public async getSubscription(customerId: string): Promise<Subscription | null> {
    this.ensureInitialized();
    
    // First check local cache
    for (const subscription of this.subscriptions.values()) {
      if (subscription.customerId === customerId) {
        return subscription;
      }
    }

    // Fetch from server if not found locally
    try {
      const response = await this.makeAPIRequest<Subscription>('GET', `/api/v1/subscriptions/customer/${customerId}`);
      if (response.success && response.data) {
        this.subscriptions.set(response.data.id, response.data);
        await this.saveSubscriptions();
        return response.data;
      }
    } catch (error) {
      console.error('Failed to fetch subscription from server:', error);
    }

    return null;
  }

  /**
   * Validate subscription status and features
   */
  public async validateSubscription(subscriptionId: string): Promise<ValidationResponse> {
    this.ensureInitialized();
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return {
        valid: false,
        errors: [{
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found',
          recoverable: false
        }],
        serverTime: new Date(),
        signature: ''
      };
    }

    const now = new Date();
    const errors = [];
    const warnings = [];

    // Check subscription status
    if (subscription.status === SubscriptionStatus.CANCELED) {
      errors.push({
        code: 'SUBSCRIPTION_CANCELED',
        message: 'Subscription has been canceled',
        details: { canceledAt: subscription.canceledAt },
        recoverable: true
      });
    } else if (subscription.status === SubscriptionStatus.SUSPENDED) {
      errors.push({
        code: 'SUBSCRIPTION_SUSPENDED',
        message: 'Subscription is suspended',
        recoverable: true
      });
    } else if (subscription.status === SubscriptionStatus.PAST_DUE) {
      const daysPastDue = subscription.renewalDate ? 
        Math.floor((now.getTime() - new Date(subscription.renewalDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      if (daysPastDue <= this.config.gracePeriodDays) {
        warnings.push({
          code: 'PAYMENT_PAST_DUE',
          message: `Payment is past due (${daysPastDue} days)`,
          details: { daysPastDue, gracePeriodDays: this.config.gracePeriodDays }
        });
      } else {
        errors.push({
          code: 'GRACE_PERIOD_EXPIRED',
          message: 'Grace period expired',
          details: { daysPastDue },
          recoverable: true
        });
      }
    }

    // Check expiration
    if (subscription.endDate && new Date(subscription.endDate) < now) {
      errors.push({
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Subscription has expired',
        details: { endDate: subscription.endDate },
        recoverable: true
      });
    }

    // Check trial expiration
    if (subscription.status === SubscriptionStatus.TRIAL && 
        subscription.trialEndDate && 
        new Date(subscription.trialEndDate) < now) {
      errors.push({
        code: 'TRIAL_EXPIRED',
        message: 'Trial period has expired',
        details: { trialEndDate: subscription.trialEndDate },
        recoverable: true
      });
    }

    // Check seat limits
    if (subscription.seats.usedSeats > subscription.seats.totalSeats) {
      errors.push({
        code: 'SEAT_LIMIT_EXCEEDED',
        message: `Seat limit exceeded (${subscription.seats.usedSeats}/${subscription.seats.totalSeats})`,
        details: subscription.seats,
        recoverable: true
      });
    }

    const response: ValidationResponse = {
      valid: errors.length === 0,
      subscription,
      errors,
      warnings,
      serverTime: now,
      signature: this.signResponse({ valid: errors.length === 0, serverTime: now }),
      nextValidation: new Date(now.getTime() + 24 * 60 * 60 * 1000) // Next day
    };

    this.emit('subscription-validated', { subscriptionId, response });
    return response;
  }

  /**
   * Assign a seat to a user
   */
  public async assignSeat(subscriptionId: string, userId: string, email: string, role: SeatRole = SeatRole.USER): Promise<Seat> {
    this.ensureInitialized();
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Check seat availability
    if (subscription.seats.usedSeats >= subscription.seats.totalSeats) {
      throw new Error('No available seats');
    }

    // Check if user already has a seat
    const existingSeat = subscription.seats.seats.find(seat => seat.userId === userId);
    if (existingSeat) {
      throw new Error('User already has a seat assigned');
    }

    const seat: Seat = {
      id: crypto.randomUUID(),
      userId,
      email,
      role,
      status: SeatStatus.ACTIVE,
      assignedAt: new Date(),
      permissions: this.getDefaultPermissions(role, subscription.tier)
    };

    // Update subscription
    subscription.seats.seats.push(seat);
    subscription.seats.usedSeats = subscription.seats.seats.filter(s => s.status === SeatStatus.ACTIVE).length;
    subscription.seats.availableSeats = subscription.seats.totalSeats - subscription.seats.usedSeats;

    // Save updates
    this.seats.set(seat.id, seat);
    await this.saveSubscriptions();
    await this.saveSeats();

    // Notify server
    try {
      await this.makeAPIRequest('POST', `/api/v1/subscriptions/${subscriptionId}/seats`, { seat });
    } catch (error) {
      console.error('Failed to sync seat assignment with server:', error);
    }

    console.log(`Seat assigned: ${email} (${role}) to subscription ${subscriptionId}`);
    this.emit('seat-assigned', { subscriptionId, seat });
    return seat;
  }

  /**
   * Remove a seat
   */
  public async removeSeat(subscriptionId: string, seatId: string): Promise<boolean> {
    this.ensureInitialized();
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const seatIndex = subscription.seats.seats.findIndex(seat => seat.id === seatId);
    if (seatIndex === -1) {
      return false;
    }

    const seat = subscription.seats.seats[seatIndex];
    
    // Cannot remove owner seat
    if (seat.role === SeatRole.OWNER) {
      throw new Error('Cannot remove owner seat');
    }

    // Remove seat
    subscription.seats.seats.splice(seatIndex, 1);
    subscription.seats.usedSeats = subscription.seats.seats.filter(s => s.status === SeatStatus.ACTIVE).length;
    subscription.seats.availableSeats = subscription.seats.totalSeats - subscription.seats.usedSeats;

    // Save updates
    this.seats.delete(seatId);
    await this.saveSubscriptions();
    await this.saveSeats();

    // Notify server
    try {
      await this.makeAPIRequest('DELETE', `/api/v1/subscriptions/${subscriptionId}/seats/${seatId}`);
    } catch (error) {
      console.error('Failed to sync seat removal with server:', error);
    }

    console.log(`Seat removed: ${seat.email} from subscription ${subscriptionId}`);
    this.emit('seat-removed', { subscriptionId, seat });
    return true;
  }

  /**
   * Update subscription
   */
  public async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription> {
    this.ensureInitialized();
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Apply updates
    Object.assign(subscription, updates);
    await this.saveSubscriptions();

    // Sync with server
    try {
      await this.makeAPIRequest('PUT', `/api/v1/subscriptions/${subscriptionId}`, subscription);
    } catch (error) {
      console.error('Failed to sync subscription update with server:', error);
    }

    this.emit('subscription-updated', subscription);
    return subscription;
  }

  /**
   * Cancel subscription
   */
  public async cancelSubscription(subscriptionId: string, reason?: string): Promise<boolean> {
    this.ensureInitialized();
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceledAt = new Date();
    subscription.autoRenewal = false;

    await this.saveSubscriptions();

    // Notify server
    try {
      await this.makeAPIRequest('POST', `/api/v1/subscriptions/${subscriptionId}/cancel`, { reason });
    } catch (error) {
      console.error('Failed to sync cancellation with server:', error);
    }

    console.log(`Subscription canceled: ${subscriptionId}, reason: ${reason}`);
    this.emit('subscription-canceled', { subscription, reason });
    return true;
  }

  /**
   * Renew subscription
   */
  public async renewSubscription(subscriptionId: string): Promise<Subscription> {
    this.ensureInitialized();
    
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Calculate new dates based on billing cycle
    const now = new Date();
    let newEndDate: Date;
    let newRenewalDate: Date;

    switch (subscription.billingCycle) {
      case BillingCycle.MONTHLY:
        newEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        newRenewalDate = new Date(newEndDate.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days before
        break;
      case BillingCycle.QUARTERLY:
        newEndDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        newRenewalDate = new Date(newEndDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before
        break;
      case BillingCycle.YEARLY:
        newEndDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        newRenewalDate = new Date(newEndDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days before
        break;
      case BillingCycle.LIFETIME:
        // Lifetime subscriptions don't renew
        throw new Error('Lifetime subscriptions do not require renewal');
      default:
        throw new Error('Invalid billing cycle');
    }

    // Update subscription
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.endDate = newEndDate;
    subscription.renewalDate = newRenewalDate;
    subscription.canceledAt = undefined;

    await this.saveSubscriptions();

    // Process payment
    try {
      const paymentResult = await this.processRenewalPayment(subscription);
      if (!paymentResult.success) {
        subscription.status = SubscriptionStatus.PAST_DUE;
      }
    } catch (error) {
      console.error('Payment processing failed:', error);
      subscription.status = SubscriptionStatus.PAST_DUE;
    }

    // Notify server
    try {
      await this.makeAPIRequest('POST', `/api/v1/subscriptions/${subscriptionId}/renew`);
    } catch (error) {
      console.error('Failed to sync renewal with server:', error);
    }

    console.log(`Subscription renewed: ${subscriptionId} until ${newEndDate.toISOString()}`);
    this.emit('subscription-renewed', subscription);
    return subscription;
  }

  /**
   * Get subscription usage data
   */
  public async getSubscriptionUsage(subscriptionId: string): Promise<SubscriptionUsage> {
    this.ensureInitialized();
    
    let usage = this.usageData.get(subscriptionId);
    if (!usage) {
      // Initialize usage data
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      usage = this.initializeUsageData(subscription);
      this.usageData.set(subscriptionId, usage);
    }

    return usage;
  }

  /**
   * Track feature usage
   */
  public async trackFeatureUsage(subscriptionId: string, featureName: string, amount = 1): Promise<void> {
    if (!this.config.usageTrackingEnabled) {
      return;
    }

    const usage = await this.getSubscriptionUsage(subscriptionId);
    const feature = usage.features[featureName];
    
    if (feature) {
      feature.used += amount;
      
      // Check for overage
      if (feature.used > feature.limit) {
        feature.overage = feature.used - feature.limit;
        this.emit('feature-overage', { subscriptionId, featureName, usage: feature });
      }
    }

    await this.saveUsageData();
  }

  /**
   * Check if feature is available for subscription tier
   */
  public checkFeatureAccess(subscriptionId: string, featureName: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Find matching feature
    const feature = subscription.features.find(f => f.name === featureName);
    if (!feature) {
      // If tier enforcement is strict, deny access to undefined features
      return !this.config.tierEnforcementStrict;
    }

    if (!feature.enabled) {
      return false;
    }

    // Check usage limits if tracking is enabled
    if (this.config.usageTrackingEnabled && feature.limit !== undefined) {
      const usage = this.usageData.get(subscriptionId);
      const featureUsage = usage?.features[featureName];
      
      if (featureUsage && featureUsage.used >= featureUsage.limit) {
        this.emit('feature-limit-reached', { subscriptionId, featureName, usage: featureUsage });
        return false;
      }
    }

    return true;
  }

  /**
   * Start renewal monitoring
   */
  private startRenewalMonitoring(): void {
    if (!this.config.autoRenewEnabled) {
      return;
    }

    // Check for renewals every hour
    this.renewalTimer = setInterval(async () => {
      await this.checkPendingRenewals();
    }, 60 * 60 * 1000);

    console.log('Renewal monitoring started');
  }

  /**
   * Check for subscriptions that need renewal
   */
  private async checkPendingRenewals(): Promise<void> {
    const now = new Date();
    
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.autoRenewal || subscription.status === SubscriptionStatus.CANCELED) {
        continue;
      }

      // Check if renewal is due
      if (subscription.renewalDate && new Date(subscription.renewalDate) <= now) {
        try {
          await this.renewSubscription(subscription.id);
        } catch (error) {
          console.error(`Failed to auto-renew subscription ${subscription.id}:`, error);
          
          // Notify about renewal failure
          this.emit('renewal-failed', { subscription, error });
        }
      }
      
      // Check for renewal notices
      const daysUntilRenewal = subscription.renewalDate ? 
        Math.floor((new Date(subscription.renewalDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;
      
      if (daysUntilRenewal <= this.config.renewalNoticedays && daysUntilRenewal > 0) {
        this.emit('renewal-notice', { subscription, daysUntilRenewal });
      }
    }
  }

  /**
   * Start usage tracking
   */
  private startUsageTracking(): void {
    // Update usage data every 5 minutes
    this.usageUpdateTimer = setInterval(async () => {
      await this.updateUsageData();
    }, 5 * 60 * 1000);

    console.log('Usage tracking started');
  }

  /**
   * Update usage data and reset counters if needed
   */
  private async updateUsageData(): Promise<void> {
    const now = new Date();
    
    for (const [subscriptionId, usage] of this.usageData.entries()) {
      let updated = false;
      
      for (const [featureName, feature] of Object.entries(usage.features)) {
        // Check if reset is needed
        if (this.shouldResetFeatureUsage(feature, now)) {
          feature.used = 0;
          feature.overage = 0;
          feature.resetDate = this.getNextResetDate(feature.resetDate, now);
          updated = true;
        }
      }
      
      if (updated) {
        this.emit('usage-reset', { subscriptionId, usage });
      }
    }

    if (Object.keys(this.usageData).length > 0) {
      await this.saveUsageData();
    }
  }

  /**
   * Process renewal payment
   */
  private async processRenewalPayment(subscription: Subscription): Promise<{ success: boolean; error?: string }> {
    try {
      const paymentData = {
        subscriptionId: subscription.id,
        amount: subscription.pricing.total,
        currency: subscription.pricing.currency,
        paymentMethod: subscription.paymentMethod
      };

      const response = await this.makeAPIRequest<any>('POST', '/api/v1/payments/process', paymentData);
      return { success: response.success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get default permissions for role and tier
   */
  private getDefaultPermissions(role: SeatRole, tier: SubscriptionTier): SeatPermission[] {
    const permissions: SeatPermission[] = [];
    
    // Base permissions for all roles
    permissions.push(
      { feature: 'core', access: 'full' },
      { feature: 'basic_analysis', access: 'full' }
    );

    // Role-based permissions
    switch (role) {
      case SeatRole.OWNER:
        permissions.push(
          { feature: 'user_management', access: 'full' },
          { feature: 'billing', access: 'full' },
          { feature: 'settings', access: 'full' }
        );
        break;
      
      case SeatRole.ADMIN:
        permissions.push(
          { feature: 'user_management', access: 'write' },
          { feature: 'settings', access: 'write' }
        );
        break;
      
      case SeatRole.USER:
        // Standard user permissions based on tier
        break;
      
      case SeatRole.VIEWER:
        // Override to read-only
        permissions.forEach(p => p.access = 'read');
        break;
    }

    // Tier-based permissions
    switch (tier) {
      case SubscriptionTier.ENTERPRISE:
        permissions.push(
          { feature: 'advanced_analysis', access: 'full' },
          { feature: 'reporting', access: 'full' },
          { feature: 'api_access', access: 'full' }
        );
        break;
      
      case SubscriptionTier.PRO:
        permissions.push(
          { feature: 'advanced_analysis', access: 'full' },
          { feature: 'reporting', access: 'read' }
        );
        break;
    }

    return permissions;
  }

  /**
   * Initialize usage data for subscription
   */
  private initializeUsageData(subscription: Subscription): SubscriptionUsage {
    const now = new Date();
    const features: Record<string, FeatureUsage> = {};
    
    for (const feature of subscription.features) {
      if (feature.limit !== undefined) {
        features[feature.name] = {
          name: feature.name,
          used: feature.used || 0,
          limit: feature.limit,
          resetDate: now,
          overage: feature.overage || 0
        };
      }
    }

    const seats: SeatUsage = {
      total: subscription.seats.totalSeats,
      active: subscription.seats.usedSeats,
      inactive: subscription.seats.seats.filter(s => s.status === SeatStatus.INACTIVE).length,
      lastActive: subscription.seats.seats.reduce((acc, seat) => {
        if (seat.lastActiveAt) {
          acc[seat.userId] = seat.lastActiveAt;
        }
        return acc;
      }, {} as Record<string, Date>)
    };

    const billing: BillingUsage = {
      currentPeriodStart: subscription.startDate,
      currentPeriodEnd: subscription.endDate || new Date(),
      amountDue: subscription.pricing.total,
      amountPaid: 0, // Would be fetched from payment system
      nextBillingDate: subscription.renewalDate || new Date()
    };

    const period: UsagePeriod = {
      start: subscription.startDate,
      end: subscription.endDate || new Date(),
      type: subscription.billingCycle === BillingCycle.MONTHLY ? 'monthly' :
            subscription.billingCycle === BillingCycle.QUARTERLY ? 'quarterly' : 'yearly'
    };

    return { features, seats, billing, period };
  }

  // Helper methods
  private shouldResetFeatureUsage(feature: FeatureUsage, now: Date): boolean {
    const daysSinceReset = Math.floor((now.getTime() - feature.resetDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Reset logic would depend on the reset interval
    // For now, reset monthly
    return daysSinceReset >= 30;
  }

  private getNextResetDate(currentReset: Date, now: Date): Date {
    // Add 30 days for monthly reset
    return new Date(currentReset.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  private signResponse(data: any): string {
    return crypto.createHmac('sha256', this.config.serverConfig.apiKey)
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private async makeAPIRequest<T>(method: string, endpoint: string, data?: any): Promise<APIResponse<T>> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.config.serverConfig.baseUrl);
      const requestData = data ? JSON.stringify(data) : undefined;
      
      const options: any = {
        hostname: url.hostname,
        port: url.port || (this.config.serverConfig.enableSSL ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.serverConfig.apiKey,
          'User-Agent': 'Tacctile/1.0.0'
        }
      };

      if (requestData) {
        options.headers['Content-Length'] = Buffer.byteLength(requestData);
      }

      const req = (this.config.serverConfig.enableSSL ? https : http).request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(responseData) as APIResponse<T>;
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid response format: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(this.config.serverConfig.timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (requestData) {
        req.write(requestData);
      }
      req.end();
    });
  }

  // Persistence methods
  private async loadSubscriptions(): Promise<void> {
    try {
      const subscriptionsFile = path.join(this.dataPath, 'subscriptions.json');
      const data = await fs.readFile(subscriptionsFile, 'utf8');
      const subscriptions = JSON.parse(data) as Subscription[];
      
      for (const subscription of subscriptions) {
        // Convert date strings back to Date objects
        subscription.startDate = new Date(subscription.startDate);
        if (subscription.endDate) subscription.endDate = new Date(subscription.endDate);
        if (subscription.trialEndDate) subscription.trialEndDate = new Date(subscription.trialEndDate);
        if (subscription.renewalDate) subscription.renewalDate = new Date(subscription.renewalDate);
        if (subscription.canceledAt) subscription.canceledAt = new Date(subscription.canceledAt);
        if (subscription.pausedAt) subscription.pausedAt = new Date(subscription.pausedAt);
        if (subscription.gracePeriodEndDate) subscription.gracePeriodEndDate = new Date(subscription.gracePeriodEndDate);
        
        this.subscriptions.set(subscription.id, subscription);
      }
      
      console.log(`Loaded ${subscriptions.length} subscriptions`);
    } catch (error) {
      console.log('No existing subscriptions found');
    }
  }

  private async saveSubscriptions(): Promise<void> {
    try {
      const subscriptionsFile = path.join(this.dataPath, 'subscriptions.json');
      const subscriptions = Array.from(this.subscriptions.values());
      await fs.writeFile(subscriptionsFile, JSON.stringify(subscriptions, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save subscriptions:', error);
    }
  }

  private async loadSeats(): Promise<void> {
    try {
      const seatsFile = path.join(this.dataPath, 'seats.json');
      const data = await fs.readFile(seatsFile, 'utf8');
      const seats = JSON.parse(data) as Seat[];
      
      for (const seat of seats) {
        seat.assignedAt = new Date(seat.assignedAt);
        if (seat.lastActiveAt) seat.lastActiveAt = new Date(seat.lastActiveAt);
        
        this.seats.set(seat.id, seat);
      }
      
      console.log(`Loaded ${seats.length} seats`);
    } catch (error) {
      console.log('No existing seats found');
    }
  }

  private async saveSeats(): Promise<void> {
    try {
      const seatsFile = path.join(this.dataPath, 'seats.json');
      const seats = Array.from(this.seats.values());
      await fs.writeFile(seatsFile, JSON.stringify(seats, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save seats:', error);
    }
  }

  private async loadUsageData(): Promise<void> {
    try {
      const usageFile = path.join(this.dataPath, 'usage.json');
      const data = await fs.readFile(usageFile, 'utf8');
      const usageData = JSON.parse(data);
      
      for (const [subscriptionId, usage] of Object.entries(usageData)) {
        this.usageData.set(subscriptionId, usage as SubscriptionUsage);
      }
      
      console.log(`Loaded usage data for ${Object.keys(usageData).length} subscriptions`);
    } catch (error) {
      console.log('No existing usage data found');
    }
  }

  private async saveUsageData(): Promise<void> {
    try {
      const usageFile = path.join(this.dataPath, 'usage.json');
      const usageData = Object.fromEntries(this.usageData);
      await fs.writeFile(usageFile, JSON.stringify(usageData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save usage data:', error);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SubscriptionManager not initialized. Call initialize() first.');
    }
  }

  public async destroy(): Promise<void> {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
    
    if (this.usageUpdateTimer) {
      clearInterval(this.usageUpdateTimer);
      this.usageUpdateTimer = null;
    }

    await this.saveSubscriptions();
    await this.saveSeats();
    await this.saveUsageData();
    
    this.removeAllListeners();
    this.initialized = false;
    console.log('SubscriptionManager destroyed');
  }
}