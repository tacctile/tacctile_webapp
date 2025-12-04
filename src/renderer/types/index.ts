/**
 * Tacctile - Paranormal Investigation Tool Types
 */

// Tool identifiers for the 5 main tools
export type ToolId = 'video' | 'audio' | 'images' | 'sensors' | 'streaming';

// Navigation/Route definitions
export interface ToolRoute {
  id: ToolId;
  path: string;
  label: string;
  description: string;
}

// Investigation session
export interface Investigation {
  id: string;
  name: string;
  location: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed';
}

// User profile
export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: 'lead' | 'investigator' | 'analyst' | 'viewer';
}

// Media item on the session timeline
export interface TimelineItem {
  id: string;
  type: 'video' | 'audio' | 'image' | 'sensor_event' | 'stream_clip';
  timestamp: Date;
  duration?: number; // in seconds
  source: string;
  thumbnail?: string;
  metadata: Record<string, unknown>;
  markers?: TimelineMarker[];
}

// Markers for anomalies or points of interest
export interface TimelineMarker {
  id: string;
  timestamp: Date;
  label: string;
  type: 'anomaly' | 'note' | 'evidence' | 'sync_point';
  color?: string;
}

// Sensor reading for the sensors dashboard
export interface SensorReading {
  sensorId: string;
  sensorType: 'emf' | 'temperature' | 'humidity' | 'barometric' | 'motion' | 'audio_level' | 'infrasound';
  value: number;
  unit: string;
  timestamp: Date;
  location?: string;
  isAnomaly?: boolean;
}

// Stream source for the streaming tool
export interface StreamSource {
  id: string;
  name: string;
  type: 'camera' | 'screen' | 'audio' | 'overlay' | 'browser';
  url?: string;
  deviceId?: string;
  active: boolean;
  position: { x: number; y: number; width: number; height: number };
  volume?: number;
}

// RTMP output configuration
export interface StreamOutput {
  id: string;
  name: string;
  platform: 'youtube' | 'twitch' | 'facebook' | 'custom';
  rtmpUrl: string;
  streamKey?: string;
  status: 'idle' | 'connecting' | 'live' | 'error';
}

// Image adjustment for non-destructive editing
export interface ImageAdjustment {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  exposure: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  clarity: number;
  dehaze: number;
  noise_reduction: number;
  sharpening: number;
}

// Image annotation
export interface ImageAnnotation {
  id: string;
  type: 'circle' | 'rectangle' | 'arrow' | 'text' | 'freehand';
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
  text?: string;
  timestamp: Date;
}

// Audio analysis data for spectrogram
export interface AudioAnalysis {
  waveform: Float32Array;
  spectrogram: Float32Array[];
  frequencyBins: number[];
  timeBins: number[];
  duration: number;
  sampleRate: number;
}

// Tool routes configuration
export const TOOL_ROUTES: ToolRoute[] = [
  {
    id: 'video',
    path: '/video',
    label: 'Video',
    description: 'DaVinci Resolve-inspired video viewer with timeline'
  },
  {
    id: 'audio',
    path: '/audio',
    label: 'Audio',
    description: 'iZotope RX 11-inspired audio analysis with spectrogram'
  },
  {
    id: 'images',
    path: '/images',
    label: 'Images',
    description: 'Adobe Lightroom-inspired non-destructive image editing'
  },
  {
    id: 'sensors',
    path: '/sensors',
    label: 'Sensors',
    description: 'Home Assistant-inspired real-time environmental monitoring'
  },
  {
    id: 'streaming',
    path: '/streaming',
    label: 'Streaming',
    description: 'OBS Studio-inspired multi-source streaming'
  }
];
