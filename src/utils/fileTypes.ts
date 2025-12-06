/**
 * File Type Detection Utility
 * Provides comprehensive file type detection using both extension and MIME type
 */

export type MediaFileType = 'video' | 'audio' | 'image';

// Supported file extensions by type
export const FILE_EXTENSIONS: Record<MediaFileType, string[]> = {
  video: ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v', '.wmv', '.flv', '.3gp'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma', '.aiff', '.aif'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp', '.heic', '.heif', '.raw', '.cr2', '.nef', '.arw'],
};

// MIME type mappings
export const MIME_TYPES: Record<MediaFileType, string[]> = {
  video: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
    'video/x-m4v',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/3gpp',
  ],
  audio: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/flac',
    'audio/aac',
    'audio/x-ms-wma',
    'audio/aiff',
    'audio/x-aiff',
  ],
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/bmp',
    'image/heic',
    'image/heif',
    'image/x-canon-cr2',
    'image/x-nikon-nef',
    'image/x-sony-arw',
    'image/raw',
  ],
};

// Type colors for consistent UI
export const TYPE_COLORS: Record<MediaFileType, string> = {
  video: '#c45c5c',
  audio: '#5a9a6b',
  image: '#5a7fbf',
};

// Type labels for display
export const TYPE_LABELS: Record<MediaFileType, string> = {
  video: 'VIDEO',
  audio: 'AUDIO',
  image: 'IMAGE',
};

/**
 * Detect file type from file name extension
 */
export function getFileTypeFromExtension(fileName: string): MediaFileType | null {
  const ext = '.' + fileName.toLowerCase().split('.').pop();

  for (const [type, extensions] of Object.entries(FILE_EXTENSIONS) as [MediaFileType, string[]][]) {
    if (extensions.includes(ext)) {
      return type;
    }
  }

  return null;
}

/**
 * Detect file type from MIME type
 */
export function getFileTypeFromMime(mimeType: string): MediaFileType | null {
  const normalizedMime = mimeType.toLowerCase();

  for (const [type, mimes] of Object.entries(MIME_TYPES) as [MediaFileType, string[]][]) {
    if (mimes.includes(normalizedMime)) {
      return type;
    }
  }

  // Fallback: check if MIME starts with type prefix
  if (normalizedMime.startsWith('video/')) return 'video';
  if (normalizedMime.startsWith('audio/')) return 'audio';
  if (normalizedMime.startsWith('image/')) return 'image';

  return null;
}

/**
 * Detect file type using both extension and MIME type
 * MIME type takes precedence when available
 */
export function detectFileType(file: File): MediaFileType | null {
  // Try MIME type first (more reliable)
  const mimeType = getFileTypeFromMime(file.type);
  if (mimeType) return mimeType;

  // Fall back to extension
  return getFileTypeFromExtension(file.name);
}

/**
 * Check if a file is of a specific type
 */
export function isFileType(file: File, type: MediaFileType): boolean {
  return detectFileType(file) === type;
}

/**
 * Check if a file is a supported media type
 */
export function isSupportedMediaFile(file: File): boolean {
  return detectFileType(file) !== null;
}

/**
 * Get accepted file types string for input element
 */
export function getAcceptString(type: MediaFileType | 'all'): string {
  if (type === 'all') {
    return [
      ...MIME_TYPES.video,
      ...MIME_TYPES.audio,
      ...MIME_TYPES.image,
      ...FILE_EXTENSIONS.video,
      ...FILE_EXTENSIONS.audio,
      ...FILE_EXTENSIONS.image,
    ].join(',');
  }

  return [...MIME_TYPES[type], ...FILE_EXTENSIONS[type]].join(',');
}

/**
 * Sort files into categories by type
 */
export function sortFilesByType(files: File[]): Record<MediaFileType, File[]> {
  const result: Record<MediaFileType, File[]> = {
    video: [],
    audio: [],
    image: [],
  };

  for (const file of files) {
    const type = detectFileType(file);
    if (type) {
      result[type].push(file);
    }
  }

  return result;
}

/**
 * Get user-friendly error message for invalid file type
 */
export function getFileTypeErrorMessage(expectedType: MediaFileType): string {
  switch (expectedType) {
    case 'audio':
      return 'This tool only accepts audio files (.mp3, .wav, .ogg, .m4a, .flac, .aac)';
    case 'video':
      return 'This tool only accepts video files (.mp4, .mov, .avi, .webm, .mkv)';
    case 'image':
      return 'This tool only accepts image files (.jpg, .jpeg, .png, .gif, .webp, .tiff, .bmp)';
  }
}

/**
 * Extract potential user metadata from file
 * Returns null if no user info can be determined
 */
export function extractUserFromFile(file: File): string | null {
  // Try to extract from file name patterns
  const fileName = file.name.toLowerCase();

  // Common patterns: user_name_..., username_..., name_...
  const patterns = [
    /^([a-z]+)_/i, // starts with name_
    /^([a-z]+)-/i, // starts with name-
  ];

  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) {
      const potentialName = match[1];
      // Capitalize first letter
      return potentialName.charAt(0).toUpperCase() + potentialName.slice(1);
    }
  }

  return null;
}

/**
 * Generate a unique ID for imported files
 */
export function generateImportId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
