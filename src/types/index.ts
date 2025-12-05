/**
 * Tacctile Core Types
 * Type definitions for authentication, billing, storage, and evidence systems
 */

// ============================================================================
// USER & AUTHENTICATION TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: 'google.com' | 'password';
  createdAt: Date;
  lastLoginAt: Date;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends AuthCredentials {
  displayName?: string;
}

// ============================================================================
// SUBSCRIPTION & BILLING TYPES
// ============================================================================

export type SubscriptionTier = 'free' | 'pro';

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'trialing'
  | 'unpaid';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TierLimits {
  maxInvestigations: number;
  maxTeamMembers: number;
  maxStorageGB: number;
  maxEvidencePerInvestigation: number;
  aiSummarizationEnabled: boolean;
  realTimeCollaborationEnabled: boolean;
  exportFormats: ('pdf' | 'csv' | 'json')[];
  cloudStorageProviders: CloudStorageProvider[];
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxInvestigations: 3,
    maxTeamMembers: 1,
    maxStorageGB: 1,
    maxEvidencePerInvestigation: 50,
    aiSummarizationEnabled: false,
    realTimeCollaborationEnabled: false,
    exportFormats: ['json'],
    cloudStorageProviders: ['google_drive'],
  },
  pro: {
    maxInvestigations: Infinity,
    maxTeamMembers: 10,
    maxStorageGB: 100,
    maxEvidencePerInvestigation: Infinity,
    aiSummarizationEnabled: true,
    realTimeCollaborationEnabled: true,
    exportFormats: ['pdf', 'csv', 'json'],
    cloudStorageProviders: ['google_drive', 'dropbox', 'onedrive'],
  },
};

export interface PricingPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  features: string[];
  limits: TierLimits;
}

// ============================================================================
// CLOUD STORAGE TYPES
// ============================================================================

export type CloudStorageProvider = 'google_drive' | 'dropbox' | 'onedrive';

export interface CloudStorageConfig {
  provider: CloudStorageProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  rootFolderId?: string;
  rootFolderName?: string;
}

export interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  provider: CloudStorageProvider;
  path: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  downloadUrl?: string;
  parentId?: string;
}

export interface CloudFolder {
  id: string;
  name: string;
  provider: CloudStorageProvider;
  path: string;
  parentId?: string;
  children?: (CloudFile | CloudFolder)[];
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface CloudStorageQuota {
  used: number;
  total: number;
  provider: CloudStorageProvider;
}

// ============================================================================
// INVESTIGATION TYPES
// ============================================================================

export interface Investigation {
  id: string;
  userId: string;
  title: string;
  description: string;
  location: InvestigationLocation;
  startDate: Date;
  endDate?: Date;
  status: 'planning' | 'active' | 'completed' | 'archived';
  teamMembers: TeamMember[];
  evidenceCount: number;
  flagCount: number;
  cloudStorageProvider?: CloudStorageProvider;
  cloudFolderId?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationLocation {
  name: string;
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timezone?: string;
}

export interface TeamMember {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
  invitedBy: string;
}

export interface InvestigationInvite {
  id: string;
  investigationId: string;
  email: string;
  role: TeamMember['role'];
  invitedBy: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// EVIDENCE TYPES
// ============================================================================

export type EvidenceType =
  | 'photo'
  | 'video'
  | 'audio'
  | 'sensor_reading'
  | 'thermal'
  | 'motion'
  | 'radio_sweep'
  | 'document'
  | 'other';

export interface Evidence {
  id: string;
  investigationId: string;
  userId: string;
  type: EvidenceType;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number; // For audio/video in seconds
  cloudFileId: string;
  cloudProvider: CloudStorageProvider;
  thumbnailUrl?: string;
  metadata: EvidenceMetadata;
  flags: EvidenceFlag[];
  flagCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidenceMetadata {
  // Common metadata
  capturedAt?: Date;
  device?: string;

  // Photo/Video metadata
  width?: number;
  height?: number;
  frameRate?: number;
  codec?: string;

  // Audio metadata
  sampleRate?: number;
  channels?: number;
  bitrate?: number;

  // Sensor metadata
  sensorReading?: number;
  sensorUnit?: 'mG' | 'μT';

  // Thermal metadata
  minTemp?: number;
  maxTemp?: number;
  avgTemp?: number;
  tempUnit?: 'C' | 'F';

  // Location metadata
  coordinates?: {
    latitude: number;
    longitude: number;
  };

  // Custom metadata
  custom?: Record<string, unknown>;
}

// ============================================================================
// EVIDENCE FLAGGING SYSTEM TYPES
// ============================================================================

export type FlagType =
  | 'anomaly'           // Unusual occurrence
  | 'audio_anomaly'     // Unexplained audio
  | 'visual_anomaly'    // Visual anomaly
  | 'sensor_spike'      // Sensor reading spike
  | 'temperature_change'// Temperature anomaly
  | 'motion_detected'   // Motion detection
  | 'audio_artifact'    // Audio artifact
  | 'light_anomaly'     // Light anomaly
  | 'shadow_figure'     // Shadow figure
  | 'equipment_malfunction' // Equipment issue
  | 'debunked'          // Explained/debunked
  | 'review_needed'     // Needs further review
  | 'highlight'         // Important/noteworthy
  | 'custom';           // Custom flag type

export interface EvidenceFlag {
  id: string;
  evidenceId: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  type: FlagType;
  customType?: string; // For 'custom' type
  timestamp: number; // Position in media (seconds) or 0 for photos/documents
  endTimestamp?: number; // For range markers (e.g., audio segment)
  title: string;
  description?: string;
  comments: FlagComment[];
  commentCount: number;
  confidence: 'low' | 'medium' | 'high';
  aiSummary?: string;
  aiAnalysis?: AIFlagAnalysis;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FlagComment {
  id: string;
  flagId: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  content: string;
  mentions: string[]; // User IDs mentioned
  reactions: FlagReaction[];
  edited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlagReaction {
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface AIFlagAnalysis {
  summary: string;
  possibleExplanations: string[];
  similarCases: string[];
  confidence: number; // 0-1
  suggestedActions: string[];
  analyzedAt: Date;
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

export interface EvidenceFlagFilter {
  types?: FlagType[];
  userIds?: string[];
  timestampRange?: {
    start: number;
    end: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  confidence?: ('low' | 'medium' | 'high')[];
  hasComments?: boolean;
  hasAiSummary?: boolean;
  searchQuery?: string;
  tags?: string[];
  sortBy?: 'timestamp' | 'createdAt' | 'updatedAt' | 'commentCount';
  sortOrder?: 'asc' | 'desc';
}

export interface InvestigationFilter {
  status?: Investigation['status'][];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  tags?: string[];
  sortBy?: 'title' | 'startDate' | 'createdAt' | 'updatedAt' | 'evidenceCount';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// REAL-TIME COLLABORATION TYPES
// ============================================================================

export interface PresenceState {
  oderId: string;
  displayName: string;
  photoURL?: string;
  currentInvestigationId?: string;
  currentEvidenceId?: string;
  currentTimestamp?: number; // For synced playback
  lastActiveAt: Date;
  status: 'online' | 'away' | 'offline';
}

export interface CollaborationCursor {
  userId: string;
  displayName: string;
  color: string;
  position: {
    x: number;
    y: number;
  };
  timestamp?: number; // Media playhead position
}

export interface SyncedPlaybackState {
  evidenceId: string;
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  controlledBy: string; // User ID
  updatedAt: Date;
}

// ============================================================================
// AI SUMMARIZATION TYPES
// ============================================================================

export interface AISummarizationRequest {
  investigationId: string;
  evidenceIds?: string[]; // If empty, summarize all evidence
  flagIds?: string[]; // If empty, summarize all flags
  options: {
    includeEvidence: boolean;
    includeFlags: boolean;
    includeComments: boolean;
    detailLevel: 'brief' | 'standard' | 'detailed';
    format: 'markdown' | 'plain' | 'html';
  };
}

export interface AISummarizationResponse {
  id: string;
  investigationId: string;
  summary: string;
  keyFindings: string[];
  anomalyCounts: Record<FlagType, number>;
  timeline: {
    timestamp: Date;
    description: string;
    evidenceIds: string[];
    flagIds: string[];
  }[];
  recommendations: string[];
  generatedAt: Date;
  model: string;
  tokensUsed: number;
}

// ============================================================================
// EXPORT & REPORT TYPES
// ============================================================================

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'json';
  includeEvidence: boolean;
  includeFlags: boolean;
  includeComments: boolean;
  includeAISummary: boolean;
  includeThumbnails: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportResult {
  id: string;
  investigationId: string;
  format: ExportOptions['format'];
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class TacctileError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TacctileError';
  }
}

export class AuthError extends TacctileError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'AuthError';
  }
}

export class StorageError extends TacctileError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'StorageError';
  }
}

export class SubscriptionError extends TacctileError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'SubscriptionError';
  }
}

export class CollaborationError extends TacctileError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'CollaborationError';
  }
}

// ============================================================================
// AI SIDEKICK TYPES
// ============================================================================

export type {
  ChatMessage,
  ChatMessageRole,
  ChatHistory,
  AISidekickContext,
  ChatSearchResult,
  ActionType,
  ActionButton,
  GeminiOptions,
  GeminiResponse,
  AISidekickState,
  AISidekickActions,
  SendToAISidekickFn,
} from './ai-sidekick';
