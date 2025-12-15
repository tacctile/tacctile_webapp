/**
 * Sentry Monitoring Utilities
 * Provides functions to set user context and sanitize sensitive data
 */

import type { User } from "@/types";

// Keys that should be sanitized from error reports
const SENSITIVE_KEYS = [
  "token",
  "password",
  "secret",
  "key",
  "authorization",
  "auth",
  "credential",
];

/**
 * Checks if a key name contains sensitive data patterns
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));
}

/**
 * Recursively sanitizes an object by removing sensitive keys
 */
export function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (isSensitiveKey(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Sanitizes breadcrumb data
 */
export function sanitizeBreadcrumb(breadcrumb: {
  data?: Record<string, unknown>;
}): { data?: Record<string, unknown> } {
  if (breadcrumb.data) {
    return {
      ...breadcrumb,
      data: sanitizeData(breadcrumb.data) as Record<string, unknown>,
    };
  }
  return breadcrumb;
}

/**
 * Sets user context in Sentry when user authenticates
 * Call this from AuthContext when user logs in
 */
export function setSentryUser(user: User | null): void {
  if (!import.meta.env.PROD) return;

  import("@sentry/react").then((Sentry) => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.displayName || undefined,
      });
    } else {
      // Clear user context on logout
      Sentry.setUser(null);
    }
  });
}

/**
 * Adds a custom tag to Sentry context
 */
export function setSentryTag(key: string, value: string): void {
  if (!import.meta.env.PROD) return;

  import("@sentry/react").then((Sentry) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Captures a custom message in Sentry
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
): void {
  if (!import.meta.env.PROD) {
    console.log(`[Sentry ${level}] ${message}`);
    return;
  }

  import("@sentry/react").then((Sentry) => {
    Sentry.captureMessage(message, level);
  });
}

export default {
  sanitizeData,
  sanitizeBreadcrumb,
  setSentryUser,
  setSentryTag,
  captureMessage,
};
