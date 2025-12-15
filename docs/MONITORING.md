# Monitoring Guide

This document explains how to use the monitoring and performance tracking tools in Tacctile.

## Table of Contents

- [Accessing the Sentry Dashboard](#accessing-the-sentry-dashboard)
- [Understanding Error Reports](#understanding-error-reports)
- [Using Session Replay](#using-session-replay)
- [Tracking Performance Regressions](#tracking-performance-regressions)
- [Running Bundle Analysis](#running-bundle-analysis)
- [Web Vitals Metrics](#web-vitals-metrics)
- [Performance Measurement API](#performance-measurement-api)
- [When to Act on Alerts](#when-to-act-on-alerts)

---

## Accessing the Sentry Dashboard

Access the Sentry dashboard at your organization's Sentry URL (configured via `VITE_SENTRY_DSN` environment variable).

The dashboard provides:

- Real-time error tracking
- Performance monitoring
- Session replays
- Release health metrics

---

## Understanding Error Reports

Each error report in Sentry includes:

### User Context

When a user is authenticated, errors include:

- **User ID**: The unique identifier from Firebase Auth
- **Email**: User's email address
- **Username**: User's display name

This helps identify which users are affected by issues and enables direct communication for critical bugs.

### Breadcrumbs

Breadcrumbs show the sequence of events leading up to an error:

- **Navigation**: Page transitions and route changes
- **Console**: Console logs, warnings, and errors
- **HTTP**: API requests and responses
- **UI**: User interactions (clicks, inputs)
- **Web Vitals**: Performance metrics captured during the session

Breadcrumbs are automatically sanitized to remove sensitive data (tokens, passwords, secrets, keys).

### Tags

Custom tags are automatically added to help filter errors:

- `app_version`: Current application version (1.0.0)
- `environment`: Runtime environment (production/development)

### Stack Traces

Full stack traces with source context help pinpoint exactly where errors occur.

---

## Using Session Replay

Session Replay records user sessions to help debug issues.

### Finding Replays

1. Navigate to the **Issues** section in Sentry
2. Click on a specific error
3. Look for the **Replay** tab or link

### What Replays Show

- User interactions (clicks, scrolls, inputs)
- Console output
- Network requests
- DOM mutations
- Performance data

### Privacy

- Replays are captured at 10% of sessions normally
- Replays are captured at 100% when an error occurs
- Sensitive form inputs are automatically masked

---

## Tracking Performance Regressions

### Where to See Web Vitals

1. Go to **Performance** > **Web Vitals** in Sentry
2. Filter by time range, release, or environment
3. View trends for each metric

### Web Vitals Dashboard

The dashboard shows:

- **LCP (Largest Contentful Paint)**: Loading performance
- **FID (First Input Delay)**: Interactivity
- **CLS (Cumulative Layout Shift)**: Visual stability
- **FCP (First Contentful Paint)**: Perceived load speed
- **TTFB (Time to First Byte)**: Server response time

### Setting Up Alerts

Configure alerts in Sentry for:

- Performance metric degradation
- Error rate increases
- New unhandled exceptions

---

## Running Bundle Analysis

Analyze the bundle size to identify optimization opportunities.

### Running the Analysis

```bash
npm run analyze
```

This command:

1. Builds the production bundle
2. Generates `stats.html` in the project root
3. Opens the visualization in your browser

### Understanding the Visualization

The treemap shows:

- **Chunk sizes**: Visual representation of each chunk's size
- **Gzip size**: Compressed size (what users download)
- **Brotli size**: Better compression estimate for modern browsers
- **Module breakdown**: What's inside each chunk

### Optimization Tips

- Look for large dependencies that could be lazy-loaded
- Identify duplicate dependencies across chunks
- Check if vendor chunks can be further split

---

## Web Vitals Metrics

### What Metrics Matter

| Metric   | Good    | Needs Improvement | Poor     |
| -------- | ------- | ----------------- | -------- |
| **LCP**  | < 2.5s  | 2.5s - 4s         | > 4s     |
| **FID**  | < 100ms | 100ms - 300ms     | > 300ms  |
| **CLS**  | < 0.1   | 0.1 - 0.25        | > 0.25   |
| **FCP**  | < 1.8s  | 1.8s - 3s         | > 3s     |
| **TTFB** | < 800ms | 800ms - 1800ms    | > 1800ms |

### Targets

Aim for these targets for 75th percentile of users:

- **LCP < 2.5 seconds**: Ensure main content loads quickly
- **FID < 100 milliseconds**: Keep the main thread responsive
- **CLS < 0.1**: Avoid unexpected layout shifts

---

## Performance Measurement API

Use the performance measurement utilities for custom tracking.

### Available Functions

```typescript
import {
  markPerformanceStart,
  markPerformanceEnd,
  getPerformanceMeasure,
  measureAsync,
  measureSync,
} from "@/services/monitoring";

// Basic usage
markPerformanceStart("my-operation");
// ... perform operation ...
markPerformanceEnd("my-operation");

// Get the measurement
const duration = getPerformanceMeasure("my-operation");
console.log(`Operation took ${duration}ms`);

// Async wrapper
const result = await measureAsync("api-call", async () => {
  return fetch("/api/data");
});

// Sync wrapper
const data = measureSync("data-transform", () => {
  return transformData(rawData);
});
```

### Predefined Performance Labels

These labels are pre-configured for common operations:

- `audio-file-load`: Audio file loading time
- `waveform-render`: Waveform visualization rendering
- `video-seek`: Video seeking operation
- `ffmpeg-operation`: FFmpeg processing tasks

---

## When to Act on Alerts

### Immediate Action Required

| Condition                  | Action                                     |
| -------------------------- | ------------------------------------------ |
| Error rate > 1%            | Investigate immediately, consider rollback |
| LCP > 4s (75th percentile) | Priority performance fix                   |
| CLS > 0.25                 | Fix layout stability issues                |
| Crash-free sessions < 99%  | Critical - investigate root cause          |

### Monitor and Address

| Condition                 | Action                     |
| ------------------------- | -------------------------- |
| Error rate 0.1% - 1%      | Schedule investigation     |
| LCP 2.5s - 4s             | Add to performance backlog |
| FID > 100ms               | Optimize main thread       |
| New error types appearing | Review and categorize      |

### Acceptable Thresholds

| Condition                   | Status  |
| --------------------------- | ------- |
| Error rate < 0.1%           | Healthy |
| LCP < 2.5s                  | Good    |
| FID < 100ms                 | Good    |
| CLS < 0.1                   | Good    |
| Crash-free sessions > 99.5% | Healthy |

### Response Process

1. **Triage**: Determine severity and impact
2. **Investigate**: Use breadcrumbs and replays to understand the issue
3. **Fix**: Implement and test the fix
4. **Verify**: Monitor after deployment to confirm resolution
5. **Document**: Update runbooks if needed

---

## Configuration

### Environment Variables

| Variable          | Description                                       |
| ----------------- | ------------------------------------------------- |
| `VITE_SENTRY_DSN` | Sentry Data Source Name (required for production) |

### Sample Rates

Current configuration:

- **Traces**: 10% of transactions
- **Session Replays**: 10% of sessions
- **Error Replays**: 100% of sessions with errors

These rates balance data collection with performance impact.

---

## Troubleshooting

### Sentry Not Capturing Errors

1. Verify `VITE_SENTRY_DSN` is set correctly
2. Check browser console for initialization errors
3. Ensure you're running in production mode (`import.meta.env.PROD`)

### Web Vitals Not Appearing

1. Check browser console for initialization messages
2. Verify the `web-vitals` package is installed
3. Note: Some metrics require user interaction (FID)

### Bundle Analysis Not Opening

1. Ensure `stats.html` was generated in project root
2. Try opening the file manually in a browser
3. Check for build errors
