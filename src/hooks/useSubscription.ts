/**
 * Subscription Hook
 * Provides subscription state and upgrade functionality
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { stripeService, PRICING_PLANS } from '@/services/billing/StripeService';
import type {
  SubscriptionTier,
  TierLimits,
  PricingPlan,
  CloudStorageProvider,
} from '@/types';

// ============================================================================
// HOOK
// ============================================================================

export function useSubscription() {
  const { user, subscription, refreshSubscription } = useAuth();

  // Current tier
  const tier: SubscriptionTier = subscription?.tier || 'free';

  // Current tier limits
  const limits: TierLimits = useMemo(() => {
    return stripeService.getTierLimits(tier);
  }, [tier]);

  // Pricing plans
  const plans: PricingPlan[] = PRICING_PLANS;

  // Is active subscription
  const isActive = useMemo(() => {
    if (!subscription) return false;
    return stripeService.isSubscriptionActive(subscription.status);
  }, [subscription]);

  // Is Pro tier
  const isPro = tier === 'pro';

  // Is Free tier
  const isFree = tier === 'free';

  // Needs attention (past due, etc.)
  const needsAttention = useMemo(() => {
    if (!subscription) return false;
    return stripeService.subscriptionNeedsAttention(subscription.status);
  }, [subscription]);

  // Check if feature is available
  const hasFeature = useCallback(
    (feature: keyof TierLimits): boolean => {
      return stripeService.isFeatureAvailable(tier, feature);
    },
    [tier]
  );

  // Check if limit is reached
  const hasReachedLimit = useCallback(
    (
      limit: 'maxInvestigations' | 'maxTeamMembers' | 'maxFilesPerProject',
      currentCount: number
    ): boolean => {
      return stripeService.hasReachedLimit(tier, limit, currentCount);
    },
    [tier]
  );

  // Check if storage provider is available
  const isStorageProviderAvailable = useCallback(
    (provider: CloudStorageProvider): boolean => {
      return limits.cloudStorageProviders.includes(provider);
    },
    [limits]
  );

  // Check if export format is available
  const isExportFormatAvailable = useCallback(
    (format: 'pdf' | 'csv' | 'json'): boolean => {
      return limits.exportFormats.includes(format);
    },
    [limits]
  );

  // Get upgrade prompt
  const getUpgradePrompt = useCallback((feature: string): string => {
    return stripeService.getUpgradePrompt(feature);
  }, []);

  // Upgrade to Pro
  const upgradeToPro = useCallback(
    async (interval: 'monthly' | 'yearly' = 'monthly'): Promise<void> => {
      if (!user) throw new Error('User not authenticated');

      const priceId =
        interval === 'monthly'
          ? stripeService.getPlanByTier('pro')?.stripePriceIdMonthly
          : stripeService.getPlanByTier('pro')?.stripePriceIdYearly;

      if (!priceId) {
        throw new Error('Price ID not configured');
      }

      const { sessionId } = await stripeService.createCheckoutSession({
        userId: user.id,
        email: user.email,
        priceId,
        successUrl: `${window.location.origin}/settings/billing?success=true`,
        cancelUrl: `${window.location.origin}/settings/billing?canceled=true`,
      });

      await stripeService.redirectToCheckout(sessionId);
    },
    [user]
  );

  // Manage subscription (customer portal)
  const manageSubscription = useCallback(async (): Promise<void> => {
    if (!subscription?.stripeCustomerId) {
      throw new Error('No Stripe customer ID');
    }

    await stripeService.redirectToCustomerPortal(
      subscription.stripeCustomerId,
      `${window.location.origin}/settings/billing`
    );
  }, [subscription]);

  // Get days until renewal/expiration
  const daysUntilRenewal = useMemo((): number | null => {
    if (!subscription) return null;

    const now = new Date();
    const end = new Date(subscription.currentPeriodEnd);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }, [subscription]);

  return {
    // State
    tier,
    limits,
    plans,
    subscription,
    isActive,
    isPro,
    isFree,
    needsAttention,
    daysUntilRenewal,

    // Feature checks
    hasFeature,
    hasReachedLimit,
    isStorageProviderAvailable,
    isExportFormatAvailable,
    getUpgradePrompt,

    // Actions
    upgradeToPro,
    manageSubscription,
    refreshSubscription,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook that throws if user doesn't have Pro tier
 * Use for gating features
 */
export function useRequirePro(featureName: string): void {
  const { isPro, getUpgradePrompt } = useSubscription();

  if (!isPro) {
    throw new Error(getUpgradePrompt(featureName));
  }
}

/**
 * Hook for checking remaining quota
 */
export function useQuotaStatus(
  limit: 'maxInvestigations' | 'maxTeamMembers' | 'maxFilesPerProject',
  currentCount: number
): {
  remaining: number;
  percentage: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
} {
  const { limits, hasReachedLimit } = useSubscription();

  const maxValue = limits[limit];
  const remaining = maxValue === Infinity ? Infinity : Math.max(0, maxValue - currentCount);
  const percentage = maxValue === Infinity ? 0 : (currentCount / maxValue) * 100;
  const isAtLimit = hasReachedLimit(limit, currentCount);
  const isNearLimit = !isAtLimit && percentage >= 80;

  return {
    remaining,
    percentage,
    isAtLimit,
    isNearLimit,
  };
}
