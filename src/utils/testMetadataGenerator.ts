/**
 * Test Metadata Generator
 * Generates random metadata for imported files during testing/development.
 *
 * IMPORTANT: This utility should ONLY be used in development mode.
 * In production, real metadata extraction would replace this.
 */

import { detectFileType, type MediaFileType } from './fileTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface TestFileMetadata {
  /** Unique UUID for this import (same file imported twice = different IDs) */
  id: string;
  /** Original filename */
  filename: string;
  /** Random timestamp within a 2-hour session window */
  timestamp: Date;
  /** Random user from pool */
  user: string;
  /** Device ID matching user (e.g., "sarah-iphone-14") */
  deviceId: string;
  /** Random lat/lng within ~500 meters of a center point */
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  };
  /** Duration in milliseconds (10s-5min for audio/video, null for images) */
  duration: number | null;
  /** File type: "video" | "audio" | "image" */
  fileType: MediaFileType;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Pool of test users */
const USER_POOL = ['Sarah', 'Mike', 'Jen', 'Ben', 'Alex', 'Chris'] as const;

/** Device mappings for each user */
const USER_DEVICES: Record<string, string[]> = {
  Sarah: ['sarah-iphone-14', 'sarah-sony-a7iv', 'sarah-zoom-h6'],
  Mike: ['mike-pixel-7', 'mike-gopro-11', 'mike-tascam-dr40'],
  Jen: ['jen-iphone-15', 'jen-flir-one', 'jen-wyze-cam'],
  Ben: ['ben-galaxy-s23', 'ben-canon-r5', 'ben-rode-nt1'],
  Alex: ['alex-iphone-13', 'alex-dji-osmo', 'alex-zoom-h5'],
  Chris: ['chris-pixel-8', 'chris-blackmagic', 'chris-focusrite'],
};

/** Center point for GPS coordinates (Philadelphia, PA area) */
const GPS_CENTER = {
  latitude: 39.9526,
  longitude: -75.1652,
};

/** Approximately 500 meters in degrees (rough approximation) */
const GPS_RADIUS_DEGREES = 0.0045;

/** Duration range in milliseconds */
const MIN_DURATION_MS = 10 * 1000; // 10 seconds
const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get a random element from an array
 */
function getRandomElement<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random number within a range
 */
function getRandomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generate random GPS coordinates within ~500m of center point
 */
function generateGPSCoordinates(): { latitude: number; longitude: number } {
  // Random angle and distance
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * GPS_RADIUS_DEGREES;

  return {
    latitude: GPS_CENTER.latitude + distance * Math.cos(angle),
    longitude: GPS_CENTER.longitude + distance * Math.sin(angle),
  };
}

/**
 * Generate random duration in milliseconds (10s - 5min)
 * Returns null for images
 */
function generateDuration(fileType: MediaFileType): number | null {
  if (fileType === 'image') {
    return null;
  }
  return Math.floor(getRandomInRange(MIN_DURATION_MS, MAX_DURATION_MS));
}

/**
 * Get a random device ID for a given user
 */
function getDeviceIdForUser(user: string): string {
  const devices = USER_DEVICES[user];
  if (!devices || devices.length === 0) {
    // Fallback for unknown users
    return `${user.toLowerCase()}-unknown-device`;
  }
  return getRandomElement(devices);
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Check if we're in development mode
 * Also returns true if URL contains ?testmode=true or ?dev=true query parameter
 */
export function isDevelopmentMode(): boolean {
  // Check Vite's development mode flag
  if (import.meta.env.DEV) {
    return true;
  }

  // Check if running on localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Check for URL parameters to enable test mode in production
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('testmode') === 'true' || urlParams.get('dev') === 'true') {
      return true;
    }
  }

  return false;
}

/**
 * Generate random test metadata for an imported file
 *
 * @param file - The File object being imported
 * @param sessionBounds - Optional session bounds to constrain timestamps within
 * @returns TestFileMetadata object with randomized values
 * @throws Error if file type cannot be detected
 *
 * @example
 * ```typescript
 * const file = new File([''], 'video.mp4', { type: 'video/mp4' });
 * const metadata = generateTestMetadata(file);
 * console.log(metadata);
 * // {
 * //   id: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
 * //   filename: 'video.mp4',
 * //   timestamp: Date('2024-01-15T19:30:00'),
 * //   user: 'Sarah',
 * //   deviceId: 'sarah-iphone-14',
 * //   gpsCoordinates: { latitude: 39.9530, longitude: -75.1648 },
 * //   duration: 45000,
 * //   fileType: 'video'
 * // }
 * ```
 */
export function generateTestMetadata(file: File, sessionBounds?: { start: number; end: number }): TestFileMetadata {
  // Detect file type
  const fileType = detectFileType(file);
  if (!fileType) {
    throw new Error(`Unable to detect file type for: ${file.name}`);
  }

  // Select random user
  const user = getRandomElement(USER_POOL);

  // Generate duration first so we can ensure timestamp + duration doesn't exceed session end
  const duration = generateDuration(fileType);

  // Session window: use provided bounds or default to 2 hours before now until now
  const now = Date.now();
  const sessionStart = new Date(sessionBounds?.start ?? now - 2 * 60 * 60 * 1000);
  const sessionEnd = new Date(sessionBounds?.end ?? now);

  // Calculate the latest valid start time for this clip
  // For clips with duration, ensure timestamp + duration <= sessionEnd
  const durationMs = duration || 0;
  const latestValidStart = new Date(sessionEnd.getTime() - durationMs);

  // Generate timestamp within valid range [sessionStart, latestValidStart]
  const validRange = latestValidStart.getTime() - sessionStart.getTime();
  const randomOffset = Math.random() * Math.max(0, validRange);
  const timestamp = new Date(sessionStart.getTime() + randomOffset);

  console.log('GENERATED METADATA:', { user, timestamp, filename: file.name });

  return {
    id: generateUUID(),
    filename: file.name,
    timestamp,
    user,
    deviceId: getDeviceIdForUser(user),
    gpsCoordinates: generateGPSCoordinates(),
    duration,
    fileType,
  };
}

/**
 * Generate test metadata only in development mode
 * Returns null in production mode
 *
 * @param file - The File object being imported
 * @param sessionBounds - Optional session bounds to constrain timestamps within
 * @returns TestFileMetadata in development mode, null in production
 */
export function generateTestMetadataIfDev(file: File, sessionBounds?: { start: number; end: number }): TestFileMetadata | null {
  const isDevMode = isDevelopmentMode();

  if (!isDevMode) {
    console.log('[TestMetadata] Not in development mode, skipping metadata generation');
    return null;
  }

  try {
    const metadata = generateTestMetadata(file, sessionBounds);
    console.log('[TestMetadata] Generated metadata for', file.name, ':', {
      user: metadata.user,
      timestamp: metadata.timestamp.toISOString(),
      deviceId: metadata.deviceId,
    });
    return metadata;
  } catch (error) {
    console.error('[TestMetadata] Failed to generate metadata for', file.name, ':', error);
    return null;
  }
}

/**
 * Format GPS coordinates as a display string
 */
export function formatGPSCoordinates(coords: { latitude: number; longitude: number }): string {
  const latDir = coords.latitude >= 0 ? 'N' : 'S';
  const lonDir = coords.longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(coords.latitude).toFixed(2)}°${latDir}, ${Math.abs(coords.longitude).toFixed(2)}°${lonDir}`;
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return 'N/A';
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
