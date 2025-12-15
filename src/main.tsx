import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Lazy load MultiViewPage - only loaded when on /multiview route
const MultiViewPage = lazy(
  () => import("./components/multiview/MultiViewPage"),
);

// App version from package.json (injected at build time)
const APP_VERSION = "1.0.0";

// Sensitive keys to redact from error reports
const SENSITIVE_KEY_PATTERNS = [
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
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * Recursively sanitizes an object by removing sensitive keys
 */
function sanitizeObject(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeObject);
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (isSensitiveKey(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

// Initialize Sentry for error tracking (if configured)
if (import.meta.env.PROD) {
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      // Keep existing sample rates unchanged
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      // Sanitize sensitive data before sending
      beforeSend(event) {
        // Sanitize breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
            if (breadcrumb.data) {
              return {
                ...breadcrumb,
                data: sanitizeObject(breadcrumb.data) as Record<
                  string,
                  unknown
                >,
              };
            }
            return breadcrumb;
          });
        }

        // Sanitize extra data
        if (event.extra) {
          event.extra = sanitizeObject(event.extra) as Record<string, unknown>;
        }

        // Sanitize contexts
        if (event.contexts) {
          event.contexts = sanitizeObject(event.contexts) as Record<
            string,
            unknown
          >;
        }

        return event;
      },
      beforeBreadcrumb(breadcrumb) {
        // Sanitize breadcrumb data
        if (breadcrumb.data) {
          breadcrumb.data = sanitizeObject(breadcrumb.data) as Record<
            string,
            unknown
          >;
        }
        return breadcrumb;
      },
    });

    // Set custom tags
    Sentry.setTag("app_version", APP_VERSION);
    Sentry.setTag("environment", import.meta.env.MODE);

    // Initialize Web Vitals tracking after Sentry
    import("./services/monitoring/webVitals").then(({ initWebVitals }) => {
      initWebVitals();
    });
  });
}

// Check if we're on the multi-view route
const isMultiViewRoute = window.location.pathname.startsWith("/multiview");

// Simple loading fallback for multi-view
const MultiViewLoadingFallback = () => (
  <div
    style={{
      width: "100vw",
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0a0a0a",
      color: "#666",
      fontFamily: "Inter, sans-serif",
    }}
  >
    Loading Multi-View...
  </div>
);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

// Render MultiViewPage for /multiview route, otherwise render main App
root.render(
  <React.StrictMode>
    {isMultiViewRoute ? (
      <Suspense fallback={<MultiViewLoadingFallback />}>
        <MultiViewPage />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
