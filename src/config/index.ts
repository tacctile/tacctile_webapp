/**
 * Tacctile Configuration
 * Environment variables and configuration constants
 */

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

// ============================================================================
// STRIPE CONFIGURATION
// ============================================================================

export const stripeConfig = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  // Price IDs for subscription tiers
  prices: {
    proMonthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID || '',
    proYearly: import.meta.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID || '',
  },
  // Portal URL for managing subscriptions
  customerPortalUrl: import.meta.env.VITE_STRIPE_CUSTOMER_PORTAL_URL || '',
};

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};

// ============================================================================
// CLOUD STORAGE OAUTH CONFIGURATION
// ============================================================================

export const cloudStorageConfig = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  },
  dropbox: {
    clientId: import.meta.env.VITE_DROPBOX_CLIENT_ID || '',
    redirectUri: import.meta.env.VITE_DROPBOX_REDIRECT_URI || `${window.location.origin}/auth/dropbox/callback`,
  },
  onedrive: {
    clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '',
    redirectUri: import.meta.env.VITE_ONEDRIVE_REDIRECT_URI || `${window.location.origin}/auth/onedrive/callback`,
    scopes: ['Files.Read', 'Files.ReadWrite', 'offline_access'],
  },
};

// ============================================================================
// AI CONFIGURATION
// ============================================================================

export const aiConfig = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  geminiModel: import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash',
  maxOutputTokens: Number(import.meta.env.VITE_GEMINI_MAX_OUTPUT_TOKENS) || 8192,
  temperature: Number(import.meta.env.VITE_GEMINI_TEMPERATURE) || 0.7,
};

// ============================================================================
// APP CONFIGURATION
// ============================================================================

export const appConfig = {
  name: 'Tacctile',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  environment: import.meta.env.MODE || 'development',
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
  baseUrl: import.meta.env.VITE_BASE_URL || window.location.origin,
  apiUrl: import.meta.env.VITE_API_URL || '',
};

// ============================================================================
// SENTRY CONFIGURATION
// ============================================================================

export const sentryConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  enabled: import.meta.env.PROD,
};

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const features = {
  enableAISummarization: import.meta.env.VITE_ENABLE_AI_SUMMARIZATION !== 'false',
  enableRealTimeCollaboration: import.meta.env.VITE_ENABLE_REALTIME_COLLAB !== 'false',
  enableOfflineMode: import.meta.env.VITE_ENABLE_OFFLINE_MODE !== 'false',
  enableDebugMode: import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true',
};

// ============================================================================
// VALIDATION
// ============================================================================

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Firebase validation
  if (!firebaseConfig.apiKey) errors.push('VITE_FIREBASE_API_KEY is required');
  if (!firebaseConfig.authDomain) errors.push('VITE_FIREBASE_AUTH_DOMAIN is required');
  if (!firebaseConfig.projectId) errors.push('VITE_FIREBASE_PROJECT_ID is required');

  // Stripe validation (only if not in development)
  if (appConfig.isProduction) {
    if (!stripeConfig.publishableKey) errors.push('VITE_STRIPE_PUBLISHABLE_KEY is required in production');
    if (!stripeConfig.prices.proMonthly) errors.push('VITE_STRIPE_PRO_MONTHLY_PRICE_ID is required in production');
  }

  // Supabase validation
  if (!supabaseConfig.url) errors.push('VITE_SUPABASE_URL is required');
  if (!supabaseConfig.anonKey) errors.push('VITE_SUPABASE_ANON_KEY is required');

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export type for environment variables
export interface ImportMetaEnv {
  // Firebase
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;

  // Stripe
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_PRO_MONTHLY_PRICE_ID: string;
  readonly VITE_STRIPE_PRO_YEARLY_PRICE_ID: string;
  readonly VITE_STRIPE_CUSTOMER_PORTAL_URL: string;

  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Cloud Storage
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_GOOGLE_API_KEY: string;
  readonly VITE_DROPBOX_CLIENT_ID: string;
  readonly VITE_DROPBOX_REDIRECT_URI: string;
  readonly VITE_ONEDRIVE_CLIENT_ID: string;
  readonly VITE_ONEDRIVE_REDIRECT_URI: string;

  // AI
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_GEMINI_MODEL: string;
  readonly VITE_GEMINI_MAX_OUTPUT_TOKENS: string;
  readonly VITE_GEMINI_TEMPERATURE: string;

  // App
  readonly VITE_APP_VERSION: string;
  readonly VITE_BASE_URL: string;
  readonly VITE_API_URL: string;
  readonly VITE_SENTRY_DSN: string;

  // Feature Flags
  readonly VITE_ENABLE_AI_SUMMARIZATION: string;
  readonly VITE_ENABLE_REALTIME_COLLAB: string;
  readonly VITE_ENABLE_OFFLINE_MODE: string;
  readonly VITE_ENABLE_DEBUG: string;
}

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
