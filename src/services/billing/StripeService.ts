/**
 * Stripe Subscription Service
 * Handles subscription management with free and pro tiers
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { stripeConfig } from '@/config';
import type {
  Subscription,
  SubscriptionTier,
  SubscriptionStatus,
  TierLimits,
  PricingPlan,
  TIER_LIMITS,
  SubscriptionError,
} from '@/types';

// ============================================================================
// PRICING PLANS CONFIGURATION
// ============================================================================

export const PRICING_PLANS: PricingPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    description: 'Perfect for getting started with evidence analysis',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    features: [
      'Up to 3 investigations',
      'Basic evidence upload (50 items per investigation)',
      'Google Drive integration',
      'JSON export',
      'Community support',
    ],
    limits: {
      maxInvestigations: 3,
      maxTeamMembers: 1,
      maxStorageGB: 1,
      maxEvidencePerInvestigation: 50,
      aiSummarizationEnabled: false,
      realTimeCollaborationEnabled: false,
      exportFormats: ['json'],
      cloudStorageProviders: ['google_drive'],
    },
  },
  {
    tier: 'pro',
    name: 'Pro',
    description: 'For serious investigators and teams',
    priceMonthly: 9.99,
    priceYearly: 99.99,
    stripePriceIdMonthly: stripeConfig.prices.proMonthly,
    stripePriceIdYearly: stripeConfig.prices.proYearly,
    features: [
      'Unlimited investigations',
      'Unlimited evidence per investigation',
      'Up to 10 team members',
      'All cloud storage providers (Google Drive, Dropbox, OneDrive)',
      'Real-time collaboration',
      'AI-powered summarization',
      'PDF & CSV export',
      'Priority support',
    ],
    limits: {
      maxInvestigations: Infinity,
      maxTeamMembers: 10,
      maxStorageGB: 100,
      maxEvidencePerInvestigation: Infinity,
      aiSummarizationEnabled: true,
      realTimeCollaborationEnabled: true,
      exportFormats: ['pdf', 'csv', 'json'],
      cloudStorageProviders: ['google_drive', 'dropbox', 'onedrive'],
    },
  },
];

// ============================================================================
// STRIPE SERVICE
// ============================================================================

class StripeService {
  private stripe: Stripe | null = null;
  private initialized = false;

  /**
   * Initialize Stripe
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!stripeConfig.publishableKey) {
        console.warn('[Stripe] No publishable key configured, running in mock mode');
        this.initialized = true;
        return;
      }

      this.stripe = await loadStripe(stripeConfig.publishableKey);
      this.initialized = true;
      console.log('[Stripe] Initialized successfully');
    } catch (error) {
      console.error('[Stripe] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get Stripe instance
   */
  getStripe(): Stripe | null {
    return this.stripe;
  }

  // ============================================================================
  // CHECKOUT & SUBSCRIPTION MANAGEMENT
  // ============================================================================

  /**
   * Create a checkout session for upgrading to Pro
   * This should be called from your backend, but we provide the redirect logic here
   */
  async createCheckoutSession(options: {
    userId: string;
    email: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }> {
    // In production, this would call your backend API
    // which would use the Stripe Server SDK to create the session
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json();
      throw this.createError(
        error.message || 'Failed to create checkout session',
        'stripe/checkout-failed'
      );
    }

    return response.json();
  }

  /**
   * Redirect to Stripe Checkout
   */
  async redirectToCheckout(sessionId: string): Promise<void> {
    if (!this.stripe) {
      throw this.createError('Stripe not initialized', 'stripe/not-initialized');
    }

    const { error } = await this.stripe.redirectToCheckout({ sessionId });
    if (error) {
      throw this.createError(error.message || 'Checkout failed', 'stripe/checkout-error');
    }
  }

  /**
   * Redirect to Customer Portal for subscription management
   */
  async redirectToCustomerPortal(customerId: string, returnUrl: string): Promise<void> {
    // In production, this would call your backend API
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerId, returnUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw this.createError(
        error.message || 'Failed to create portal session',
        'stripe/portal-failed'
      );
    }

    const { url } = await response.json();
    window.location.href = url;
  }

  /**
   * Create a payment intent for one-time payments (if needed)
   */
  async createPaymentIntent(amount: number, currency = 'usd'): Promise<string> {
    const response = await fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw this.createError(
        error.message || 'Failed to create payment intent',
        'stripe/payment-intent-failed'
      );
    }

    const { clientSecret } = await response.json();
    return clientSecret;
  }

  // ============================================================================
  // SUBSCRIPTION HELPERS
  // ============================================================================

  /**
   * Get pricing plan by tier
   */
  getPlanByTier(tier: SubscriptionTier): PricingPlan | undefined {
    return PRICING_PLANS.find((plan) => plan.tier === tier);
  }

  /**
   * Get tier limits
   */
  getTierLimits(tier: SubscriptionTier): TierLimits {
    const plan = this.getPlanByTier(tier);
    return plan?.limits || PRICING_PLANS[0].limits;
  }

  /**
   * Check if a feature is available for a tier
   */
  isFeatureAvailable(tier: SubscriptionTier, feature: keyof TierLimits): boolean {
    const limits = this.getTierLimits(tier);
    const value = limits[feature];

    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (Array.isArray(value)) return value.length > 0;

    return false;
  }

  /**
   * Check if user has reached a limit
   */
  hasReachedLimit(
    tier: SubscriptionTier,
    limit: 'maxInvestigations' | 'maxTeamMembers' | 'maxEvidencePerInvestigation',
    currentCount: number
  ): boolean {
    const limits = this.getTierLimits(tier);
    const maxValue = limits[limit];
    return currentCount >= maxValue;
  }

  /**
   * Get upgrade prompt message
   */
  getUpgradePrompt(feature: string): string {
    return `Upgrade to Pro to unlock ${feature}. Get unlimited investigations, real-time collaboration, AI summarization, and more!`;
  }

  // ============================================================================
  // SUBSCRIPTION STATUS HELPERS
  // ============================================================================

  /**
   * Parse subscription status from Stripe webhook
   */
  parseSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: 'active',
      canceled: 'canceled',
      incomplete: 'incomplete',
      incomplete_expired: 'incomplete_expired',
      past_due: 'past_due',
      trialing: 'trialing',
      unpaid: 'unpaid',
    };
    return statusMap[stripeStatus] || 'incomplete';
  }

  /**
   * Check if subscription is active
   */
  isSubscriptionActive(status: SubscriptionStatus): boolean {
    return status === 'active' || status === 'trialing';
  }

  /**
   * Check if subscription needs attention
   */
  subscriptionNeedsAttention(status: SubscriptionStatus): boolean {
    return ['past_due', 'unpaid', 'incomplete'].includes(status);
  }

  /**
   * Get subscription status display text
   */
  getStatusDisplayText(status: SubscriptionStatus): string {
    const displayMap: Record<SubscriptionStatus, string> = {
      active: 'Active',
      canceled: 'Canceled',
      incomplete: 'Incomplete',
      incomplete_expired: 'Expired',
      past_due: 'Past Due',
      trialing: 'Trial',
      unpaid: 'Unpaid',
    };
    return displayMap[status];
  }

  /**
   * Get subscription status color for UI
   */
  getStatusColor(status: SubscriptionStatus): 'success' | 'warning' | 'error' | 'info' {
    if (this.isSubscriptionActive(status)) return 'success';
    if (this.subscriptionNeedsAttention(status)) return 'warning';
    if (status === 'canceled' || status === 'incomplete_expired') return 'error';
    return 'info';
  }

  // ============================================================================
  // MOCK DATA (for development without Stripe)
  // ============================================================================

  /**
   * Create mock free subscription
   */
  createMockFreeSubscription(userId: string): Subscription {
    const now = new Date();
    return {
      id: `sub_mock_${userId}`,
      userId,
      tier: 'free',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Create mock pro subscription (for testing)
   */
  createMockProSubscription(userId: string): Subscription {
    const now = new Date();
    return {
      id: `sub_mock_pro_${userId}`,
      userId,
      tier: 'pro',
      status: 'active',
      stripeCustomerId: `cus_mock_${userId}`,
      stripeSubscriptionId: `sub_stripe_mock_${userId}`,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private createError(message: string, code: string): SubscriptionError {
    const error = new Error(message) as SubscriptionError;
    error.name = 'SubscriptionError';
    (error as unknown as { code: string }).code = code;
    return error;
  }
}

// Export singleton instance
export const stripeService = new StripeService();

// Export class for testing
export { StripeService };
