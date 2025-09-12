/**
 * Type definitions for Gemini API integration
 */

import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export interface GeminiConfig {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  safetySettings: SafetySettings[];
  requestsPerMinute: number;
  requestsPerDay: number;
  enableCache: boolean;
  cacheTTL: number;
}

export interface SafetySettings {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

export enum AnalysisType {
  GENERAL_ANOMALY = 'general_anomaly',
  EVP_ANALYSIS = 'evp_analysis',
  VISUAL_SPECTRUM = 'visual_spectrum',
  PATTERN_RECOGNITION = 'pattern_recognition',
  ENVIRONMENTAL_CONTEXT = 'environmental_context',
  COMPARATIVE_ANALYSIS = 'comparative_analysis'
}

export interface MediaFile {
  buffer: Buffer;
  mimeType: string;
  size: number;
  filename: string;
  metadata?: MediaMetadata;
}

export interface MediaMetadata {
  timestamp?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  device?: {
    name: string;
    type: string;
    settings?: Record<string, any>;
  };
  environmental?: {
    temperature?: number;
    humidity?: number;
    emf?: number;
    barometric?: number;
  };
  investigationId?: string;
  sessionId?: string;
  tags?: string[];
  notes?: string;
}

export interface GeminiResponse {
  text: string;
  analysisType: AnalysisType;
  timestamp: string;
  metadata: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    finishReason?: string;
  };
  safety?: SafetyRating[];
  error?: string;
}

export interface SafetyRating {
  category: string;
  probability: string;
}

export interface AnalysisResult {
  id: string;
  mediaFile: {
    filename: string;
    type: string;
    size: number;
  };
  analysis: GeminiResponse;
  anomalies: Anomaly[];
  confidence: ConfidenceLevel;
  recommendations: string[];
  createdAt: string;
}

export interface Anomaly {
  type: AnomalyType;
  description: string;
  location?: {
    x?: number;
    y?: number;
    timestamp?: number;
    region?: string;
  };
  confidence: ConfidenceLevel;
  evidence: string[];
  scientificExplanation?: string;
  paranormalInterpretation?: string;
}

export enum AnomalyType {
  ORB = 'orb',
  APPARITION = 'apparition',
  SHADOW_FIGURE = 'shadow_figure',
  MIST = 'mist',
  EVP_VOICE = 'evp_voice',
  EVP_WHISPER = 'evp_whisper',
  LIGHT_ANOMALY = 'light_anomaly',
  TEMPERATURE_ANOMALY = 'temperature_anomaly',
  EMF_SPIKE = 'emf_spike',
  MOTION_ANOMALY = 'motion_anomaly',
  PATTERN = 'pattern',
  UNKNOWN = 'unknown'
}

export enum ConfidenceLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export interface ProcessingOptions {
  enhanceImage?: boolean;
  denoise?: boolean;
  normalizeAudio?: boolean;
  extractFrames?: boolean;
  frameInterval?: number;
  audioSegmentLength?: number;
}

export interface BatchAnalysisRequest {
  files: MediaFile[];
  analysisTypes: AnalysisType[];
  options?: ProcessingOptions;
  customPrompt?: string;
}

export interface AnalysisSession {
  id: string;
  investigationId: string;
  startTime: string;
  endTime?: string;
  filesAnalyzed: number;
  anomaliesDetected: number;
  totalTokensUsed: number;
  results: AnalysisResult[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface RateLimitInfo {
  requestsRemaining: number;
  resetTime: Date;
  dailyLimit: number;
  dailyRemaining: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}