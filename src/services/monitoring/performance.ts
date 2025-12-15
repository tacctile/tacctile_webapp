/**
 * Performance Monitoring Service
 * Provides utilities for measuring and reporting custom performance metrics
 */

// Predefined performance labels for common operations
export type PerformanceLabel =
  | "audio-file-load"
  | "waveform-render"
  | "video-seek"
  | "ffmpeg-operation"
  | string;

/**
 * Marks the start of a performance measurement
 * @param label - Unique identifier for the operation being measured
 */
export function markPerformanceStart(label: PerformanceLabel): void {
  try {
    performance.mark(`${label}-start`);
  } catch (error) {
    console.warn(`[Performance] Failed to mark start for ${label}:`, error);
  }
}

/**
 * Marks the end of a performance measurement and creates a measure
 * @param label - Unique identifier for the operation (must match the start label)
 */
export function markPerformanceEnd(label: PerformanceLabel): void {
  try {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);

    // Send to Sentry if in production
    const duration = getPerformanceMeasure(label);
    if (duration !== null && import.meta.env.PROD) {
      import("@sentry/react").then((Sentry) => {
        Sentry.setMeasurement(label, duration, "millisecond");
        Sentry.addBreadcrumb({
          category: "performance",
          message: `${label}: ${duration.toFixed(2)}ms`,
          level: "info",
          data: {
            label,
            duration,
          },
        });
      });
    } else if (duration !== null) {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }
  } catch (error) {
    console.warn(`[Performance] Failed to mark end for ${label}:`, error);
  }
}

/**
 * Retrieves the duration of a performance measurement
 * @param label - Unique identifier for the operation
 * @returns Duration in milliseconds, or null if not found
 */
export function getPerformanceMeasure(label: PerformanceLabel): number | null {
  try {
    const entries = performance.getEntriesByName(label, "measure");
    if (entries.length > 0) {
      return entries[entries.length - 1].duration;
    }
    return null;
  } catch (error) {
    console.warn(`[Performance] Failed to get measure for ${label}:`, error);
    return null;
  }
}

/**
 * Clears performance marks and measures for a given label
 * @param label - Unique identifier for the operation
 */
export function clearPerformanceMarks(label: PerformanceLabel): void {
  try {
    performance.clearMarks(`${label}-start`);
    performance.clearMarks(`${label}-end`);
    performance.clearMeasures(label);
  } catch (error) {
    console.warn(`[Performance] Failed to clear marks for ${label}:`, error);
  }
}

/**
 * Utility function to measure an async operation
 * @param label - Unique identifier for the operation
 * @param operation - Async function to measure
 * @returns The result of the operation
 */
export async function measureAsync<T>(
  label: PerformanceLabel,
  operation: () => Promise<T>,
): Promise<T> {
  markPerformanceStart(label);
  try {
    const result = await operation();
    return result;
  } finally {
    markPerformanceEnd(label);
  }
}

/**
 * Utility function to measure a sync operation
 * @param label - Unique identifier for the operation
 * @param operation - Sync function to measure
 * @returns The result of the operation
 */
export function measureSync<T>(label: PerformanceLabel, operation: () => T): T {
  markPerformanceStart(label);
  try {
    const result = operation();
    return result;
  } finally {
    markPerformanceEnd(label);
  }
}

export default {
  markPerformanceStart,
  markPerformanceEnd,
  getPerformanceMeasure,
  clearPerformanceMarks,
  measureAsync,
  measureSync,
};
