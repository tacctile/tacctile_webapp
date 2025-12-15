/**
 * Web Vitals Tracking Service
 * Captures Core Web Vitals and sends them to Sentry for performance monitoring
 */

import { onCLS, onFID, onLCP, onFCP, onTTFB, type Metric } from "web-vitals";

/**
 * Reports a web vital metric to Sentry
 */
function reportToSentry(metric: Metric): void {
  // Only report in production
  if (!import.meta.env.PROD) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value}`);
    return;
  }

  // Dynamically import Sentry to avoid loading it if not initialized
  import("@sentry/react").then((Sentry) => {
    // Send as custom measurement
    Sentry.setMeasurement(
      metric.name,
      metric.value,
      metric.name === "CLS" ? "" : "millisecond",
    );

    // Also capture as custom event for detailed tracking
    Sentry.addBreadcrumb({
      category: "web-vitals",
      message: `${metric.name}: ${metric.value}`,
      level: "info",
      data: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
      },
    });
  });
}

/**
 * Initializes Web Vitals tracking
 * Should be called after Sentry initialization
 */
export function initWebVitals(): void {
  // Cumulative Layout Shift - measures visual stability
  // Good: < 0.1, Needs Improvement: 0.1-0.25, Poor: > 0.25
  onCLS(reportToSentry);

  // First Input Delay - measures interactivity
  // Good: < 100ms, Needs Improvement: 100-300ms, Poor: > 300ms
  onFID(reportToSentry);

  // Largest Contentful Paint - measures loading performance
  // Good: < 2.5s, Needs Improvement: 2.5-4s, Poor: > 4s
  onLCP(reportToSentry);

  // First Contentful Paint - measures perceived load speed
  // Good: < 1.8s, Needs Improvement: 1.8-3s, Poor: > 3s
  onFCP(reportToSentry);

  // Time to First Byte - measures server response time
  // Good: < 800ms, Needs Improvement: 800-1800ms, Poor: > 1800ms
  onTTFB(reportToSentry);
}

export default initWebVitals;
