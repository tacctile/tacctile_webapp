/**
 * Token Manager for Cloud Storage OAuth
 *
 * Handles token lifecycle management including:
 * - Storing token expiration timestamps
 * - Proactive refresh: refresh if within 5 minutes of expiring
 * - Reactive fallback: retry on 401 with fresh token
 * - Event emission when refresh fails (for UI reconnection prompts)
 */

import type { CloudStorageProvider } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  provider: CloudStorageProvider;
}

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export type TokenRefreshHandler = (refreshToken: string) => Promise<TokenRefreshResult>;

export type TokenEventType = 'token_refreshed' | 'token_expired' | 'reconnect_required';

export interface TokenEvent {
  type: TokenEventType;
  provider: CloudStorageProvider;
  error?: Error;
}

export type TokenEventListener = (event: TokenEvent) => void;

// Time buffer before expiration to trigger proactive refresh (5 minutes)
const PROACTIVE_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// TOKEN MANAGER CLASS
// ============================================================================

export class TokenManager {
  private tokens: Map<CloudStorageProvider, TokenInfo> = new Map();
  private refreshHandlers: Map<CloudStorageProvider, TokenRefreshHandler> = new Map();
  private refreshPromises: Map<CloudStorageProvider, Promise<TokenRefreshResult>> = new Map();
  private eventListeners: Set<TokenEventListener> = new Set();

  // ============================================================================
  // TOKEN STORAGE
  // ============================================================================

  /**
   * Set token info for a provider
   */
  setTokens(provider: CloudStorageProvider, tokens: TokenInfo): void {
    this.tokens.set(provider, {
      ...tokens,
      expiresAt: new Date(tokens.expiresAt), // Ensure it's a Date object
    });
  }

  /**
   * Get token info for a provider
   */
  getTokens(provider: CloudStorageProvider): TokenInfo | undefined {
    return this.tokens.get(provider);
  }

  /**
   * Get current access token for a provider
   */
  getAccessToken(provider: CloudStorageProvider): string | null {
    const tokens = this.tokens.get(provider);
    return tokens?.accessToken || null;
  }

  /**
   * Clear tokens for a provider
   */
  clearTokens(provider: CloudStorageProvider): void {
    this.tokens.delete(provider);
    this.refreshPromises.delete(provider);
  }

  /**
   * Clear all tokens
   */
  clearAllTokens(): void {
    this.tokens.clear();
    this.refreshPromises.clear();
  }

  // ============================================================================
  // REFRESH HANDLER REGISTRATION
  // ============================================================================

  /**
   * Register a token refresh handler for a provider
   */
  registerRefreshHandler(provider: CloudStorageProvider, handler: TokenRefreshHandler): void {
    this.refreshHandlers.set(provider, handler);
  }

  /**
   * Unregister a token refresh handler
   */
  unregisterRefreshHandler(provider: CloudStorageProvider): void {
    this.refreshHandlers.delete(provider);
  }

  // ============================================================================
  // TOKEN VALIDATION
  // ============================================================================

  /**
   * Check if token is valid (not expired)
   */
  isTokenValid(provider: CloudStorageProvider): boolean {
    const tokens = this.tokens.get(provider);
    if (!tokens) return false;
    return new Date() < tokens.expiresAt;
  }

  /**
   * Check if token needs refresh (within buffer time of expiring)
   */
  needsRefresh(provider: CloudStorageProvider): boolean {
    const tokens = this.tokens.get(provider);
    if (!tokens) return true;

    const now = Date.now();
    const expiresAt = tokens.expiresAt.getTime();

    // Refresh if within 5 minutes of expiring or already expired
    return now >= expiresAt - PROACTIVE_REFRESH_BUFFER_MS;
  }

  /**
   * Check if token is expired (past expiration time)
   */
  isTokenExpired(provider: CloudStorageProvider): boolean {
    const tokens = this.tokens.get(provider);
    if (!tokens) return true;
    return new Date() >= tokens.expiresAt;
  }

  // ============================================================================
  // TOKEN REFRESH
  // ============================================================================

  /**
   * Refresh token for a provider
   * Returns the same promise if a refresh is already in progress (deduplication)
   */
  async refreshToken(provider: CloudStorageProvider): Promise<TokenRefreshResult> {
    // Check if a refresh is already in progress
    const existingPromise = this.refreshPromises.get(provider);
    if (existingPromise) {
      return existingPromise;
    }

    const tokens = this.tokens.get(provider);
    const handler = this.refreshHandlers.get(provider);

    if (!handler) {
      const error = new Error(`No refresh handler registered for ${provider}`);
      this.emitEvent({ type: 'reconnect_required', provider, error });
      throw error;
    }

    if (!tokens?.refreshToken) {
      const error = new Error(`No refresh token available for ${provider}`);
      this.emitEvent({ type: 'reconnect_required', provider, error });
      throw error;
    }

    // Create and store the refresh promise
    const refreshPromise = this.executeRefresh(provider, tokens.refreshToken, handler);
    this.refreshPromises.set(provider, refreshPromise);

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      // Clean up the promise after completion
      this.refreshPromises.delete(provider);
    }
  }

  /**
   * Execute the actual refresh
   */
  private async executeRefresh(
    provider: CloudStorageProvider,
    refreshToken: string,
    handler: TokenRefreshHandler
  ): Promise<TokenRefreshResult> {
    try {
      const result = await handler(refreshToken);

      // Update stored tokens
      this.tokens.set(provider, {
        provider,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || refreshToken,
        expiresAt: new Date(result.expiresAt),
      });

      this.emitEvent({ type: 'token_refreshed', provider });
      return result;
    } catch (error) {
      // Refresh failed - clear tokens and emit reconnect event
      this.clearTokens(provider);
      this.emitEvent({
        type: 'reconnect_required',
        provider,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  // ============================================================================
  // PROACTIVE REFRESH
  // ============================================================================

  /**
   * Ensure token is valid, refreshing if needed (proactive refresh)
   * Call this before every API request
   */
  async ensureValidToken(provider: CloudStorageProvider): Promise<string> {
    const tokens = this.tokens.get(provider);

    if (!tokens) {
      const error = new Error(`Not authenticated with ${provider}`);
      this.emitEvent({ type: 'reconnect_required', provider, error });
      throw error;
    }

    // Check if token needs refresh (within 5 min of expiring or expired)
    if (this.needsRefresh(provider)) {
      try {
        const result = await this.refreshToken(provider);
        return result.accessToken;
      } catch {
        // If refresh fails, try using current token if not fully expired
        if (!this.isTokenExpired(provider)) {
          return tokens.accessToken;
        }
        throw new Error(`Token expired and refresh failed for ${provider}`);
      }
    }

    return tokens.accessToken;
  }

  // ============================================================================
  // REQUEST WRAPPER WITH REACTIVE RETRY
  // ============================================================================

  /**
   * Execute a fetch request with automatic token refresh on 401
   * This wraps fetch calls to handle reactive token refresh
   */
  async fetchWithTokenRefresh<T>(
    provider: CloudStorageProvider,
    requestFn: (accessToken: string) => Promise<Response>,
    parseResponse: (response: Response) => Promise<T>
  ): Promise<T> {
    // Get valid token (proactive refresh if needed)
    let accessToken = await this.ensureValidToken(provider);

    // First attempt
    let response = await requestFn(accessToken);

    // If 401, try refreshing token and retry once
    if (response.status === 401) {
      try {
        const result = await this.refreshToken(provider);
        accessToken = result.accessToken;
        response = await requestFn(accessToken);
      } catch (refreshError) {
        // Refresh failed - the event was already emitted in refreshToken
        throw new Error(`Authentication failed for ${provider}: token refresh required`);
      }
    }

    // Check for other errors
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return parseResponse(response);
  }

  /**
   * Execute a request with token refresh support
   * Generic version for non-fetch requests (e.g., gapi calls)
   */
  async executeWithTokenRefresh<T>(
    provider: CloudStorageProvider,
    requestFn: (accessToken: string) => Promise<T>,
    isAuthError: (error: unknown) => boolean
  ): Promise<T> {
    // Get valid token (proactive refresh if needed)
    let accessToken = await this.ensureValidToken(provider);

    try {
      return await requestFn(accessToken);
    } catch (error) {
      // Check if it's an auth error
      if (isAuthError(error)) {
        try {
          const result = await this.refreshToken(provider);
          accessToken = result.accessToken;
          return await requestFn(accessToken);
        } catch {
          // Refresh failed - the event was already emitted
          throw new Error(`Authentication failed for ${provider}: token refresh required`);
        }
      }
      throw error;
    }
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  /**
   * Subscribe to token events
   */
  addEventListener(listener: TokenEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: TokenEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit a token event
   */
  private emitEvent(event: TokenEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[TokenManager] Event listener error:', err);
      }
    }
  }
}

// ============================================================================
// PKCE UTILITIES
// ============================================================================

/**
 * Generate a cryptographically random code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate the code challenge from the verifier (SHA-256)
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode (for PKCE)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const tokenManager = new TokenManager();
