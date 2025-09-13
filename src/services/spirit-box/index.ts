// Core Services
export { RadioScannerCore } from './RadioScannerCore';
export type { 
  RadioFrequency, 
  ScanSettings, 
  RadioConfig, 
  RadioMetrics, 
  AudioSpectrum 
} from './RadioScannerCore';

export { AudioProcessor } from './AudioProcessor';
export type { 
  AudioProcessingConfig,
  NoiseProfile,
  AudioFeatures,
  AudioSegment,
  NoiseReductionSettings,
  EqualizerBand
} from './AudioProcessor';

export { WordDetectionEngine } from './WordDetectionEngine';
export type { 
  WordMatch,
  CommunicationEvent,
  PhoneticPattern,
  DetectionSettings,
  WordDatabase as DetectionWordDatabase,
  PhoneticDictionary
} from './WordDetectionEngine';

export { SessionRecorder } from './SessionRecorder';
export type { 
  SessionMetadata,
  SessionEvent,
  AudioMarker,
  SessionAnalytics,
  ExportOptions,
  RecordingSettings
} from './SessionRecorder';

// Manager
export { SpiritBoxManager } from './SpiritBoxManager';
export type { SpiritBoxConfig, SpiritBoxStatus } from './SpiritBoxManager';

// Enhanced Intelligent System
export { EnhancedSpiritBoxSystem } from './EnhancedSpiritBoxSystem';
export type { EnhancedSpiritBoxConfig, IntelligentResponse, SystemStatus } from './EnhancedSpiritBoxSystem';

// Word Association Engine
export { WordAssociationEngine } from './WordAssociationEngine';
export type { 
  WordEntry, 
  WordAssociation, 
  SemanticCategory, 
  WordDatabase as AssociationWordDatabase 
} from './WordAssociationEngine';

// Context Trigger System
export { ContextTriggerSystem } from './ContextTriggerSystem';
export type { 
  QuestionPattern, 
  ContextTrigger, 
  ConversationContext 
} from './ContextTriggerSystem';

// Response Timing System
export { ResponseTimingSystem } from './ResponseTimingSystem';
export type { 
  EnergyLevel, 
  TimingPattern, 
  ResponseEvent, 
  EnergyInfluence 
} from './ResponseTimingSystem';

// Dual Mode System
export { DualModeSystem } from './DualModeSystem';
export type { 
  ModeConfiguration, 
  ResponseSource, 
  BlendingRules, 
  DualModeStats 
} from './DualModeSystem';

// Session Intelligence System
export { SessionIntelligenceSystem } from './SessionIntelligenceSystem';
export type { 
  ConversationContext as IntelligenceContext,
  ParticipantProfile,
  TopicSegment,
  EmotionalProfile,
  LearningRule,
  SessionMemory
} from './SessionIntelligenceSystem';

// Components
export { SpiritBoxDashboard } from '../../components/SpiritBoxDashboard';

// Utility Types
export interface SpiritBoxSystemInfo {
  version: string;
  buildDate: string;
  features: {
    radioScanning: boolean;
    audioProcessing: boolean;
    wordDetection: boolean;
    sessionRecording: boolean;
    realtimeAnalysis: boolean;
    exportSupport: boolean;
  };
  supportedFormats: {
    audio: string[];
    export: string[];
  };
  systemRequirements: {
    minSampleRate: number;
    maxSampleRate: number;
    bufferSizes: number[];
    audioAPIs: string[];
  };
}

export const SPIRIT_BOX_SYSTEM_INFO: SpiritBoxSystemInfo = {
  version: '2.0.0',
  buildDate: new Date().toISOString(),
  features: {
    radioScanning: true,
    audioProcessing: true,
    wordDetection: true,
    sessionRecording: true,
    realtimeAnalysis: true,
    exportSupport: true,
    wordAssociation: true,
    contextTriggers: true,
    intelligentTiming: true,
    dualMode: true,
    sessionLearning: true,
    adaptiveBlending: true
  },
  supportedFormats: {
    audio: ['wav', 'mp3', 'flac'],
    export: ['json', 'csv', 'xml', 'txt', 'wav']
  },
  systemRequirements: {
    minSampleRate: 8000,
    maxSampleRate: 96000,
    bufferSizes: [512, 1024, 2048, 4096, 8192],
    audioAPIs: ['WebAudio', 'MediaDevices', 'AudioWorklet']
  }
};

// Quick start function
export async function createSpiritBoxSystem(config?: SpiritBoxConfig): Promise<SpiritBoxManager> {
  const manager = new SpiritBoxManager(config);
  await manager.initialize();
  return manager;
}

// Enhanced system creation function
export async function createEnhancedSpiritBoxSystem(config?: EnhancedSpiritBoxConfig): Promise<EnhancedSpiritBoxSystem> {
  const system = new EnhancedSpiritBoxSystem(config);
  await system.initialize();
  return system;
}

// Presets for different investigation types
export const INVESTIGATION_PRESETS = {
  // High sensitivity for quiet environments
  sensitive: {
    scanSettings: {
      sweepRate: 100,
      threshold: -60,
      pauseOnSignal: true,
      pauseDuration: 3000
    },
    detectionSettings: {
      confidenceThreshold: 0.2,
      enablePhoneticMatching: true,
      enableSoundexMatching: true,
      enableFuzzyMatching: true,
      realTimeDetection: true
    },
    recordingSettings: {
      autoStart: true,
      bufferDuration: 60,
      enableWaveformGeneration: true
    }
  },

  // Balanced settings for general use
  standard: {
    scanSettings: {
      sweepRate: 200,
      threshold: -50,
      pauseOnSignal: true,
      pauseDuration: 2000
    },
    detectionSettings: {
      confidenceThreshold: 0.4,
      enablePhoneticMatching: true,
      enableSoundexMatching: true,
      realTimeDetection: true
    },
    recordingSettings: {
      autoStart: true,
      bufferDuration: 30,
      enableWaveformGeneration: true
    }
  },

  // Fast scanning for noisy environments
  fast: {
    scanSettings: {
      sweepRate: 50,
      threshold: -30,
      pauseOnSignal: false
    },
    detectionSettings: {
      confidenceThreshold: 0.6,
      enablePhoneticMatching: true,
      realTimeDetection: true
    },
    recordingSettings: {
      autoStart: true,
      bufferDuration: 15,
      enableWaveformGeneration: false
    }
  }
} as const;

// Enhanced investigation presets with intelligent features
export const ENHANCED_INVESTIGATION_PRESETS = {
  // Intelligent child communication preset
  child_spirit: {
    enableContextualResponses: true,
    enableLearning: true,
    enableTimingIntelligence: true,
    enableDualMode: true,
    radioPercentage: 40,
    wordBankPercentage: 60,
    subtleMode: true,
    adaptiveBlending: true,
    baseEnergyLevel: 0.6,
    responsePersonality: 'eager' as const,
    intelligenceLevel: 'advanced' as const
  },

  // Professional investigation preset
  professional: {
    enableContextualResponses: true,
    enableLearning: true,
    enableTimingIntelligence: true,
    enableDualMode: true,
    radioPercentage: 70,
    wordBankPercentage: 30,
    subtleMode: true,
    adaptiveBlending: true,
    baseEnergyLevel: 0.4,
    responsePersonality: 'natural' as const,
    intelligenceLevel: 'expert' as const
  },

  // Skeptic-friendly preset with minimal word bank
  skeptic_mode: {
    enableContextualResponses: false,
    enableLearning: false,
    enableTimingIntelligence: false,
    enableDualMode: true,
    radioPercentage: 95,
    wordBankPercentage: 5,
    subtleMode: true,
    adaptiveBlending: false,
    baseEnergyLevel: 0.2,
    responsePersonality: 'reluctant' as const,
    intelligenceLevel: 'basic' as const
  },

  // High activity investigation
  intense_activity: {
    enableContextualResponses: true,
    enableLearning: true,
    enableTimingIntelligence: true,
    enableDualMode: true,
    radioPercentage: 50,
    wordBankPercentage: 50,
    subtleMode: false,
    adaptiveBlending: true,
    baseEnergyLevel: 0.8,
    responsePersonality: 'conversational' as const,
    intelligenceLevel: 'expert' as const
  },

  // Family communication preset
  family_contact: {
    enableContextualResponses: true,
    enableLearning: true,
    enableTimingIntelligence: true,
    enableDualMode: true,
    radioPercentage: 30,
    wordBankPercentage: 70,
    subtleMode: true,
    adaptiveBlending: true,
    baseEnergyLevel: 0.5,
    responsePersonality: 'natural' as const,
    intelligenceLevel: 'advanced' as const
  },

  // Research and documentation preset
  research: {
    enableContextualResponses: true,
    enableLearning: true,
    enableTimingIntelligence: true,
    enableDualMode: true,
    radioPercentage: 60,
    wordBankPercentage: 40,
    subtleMode: true,
    adaptiveBlending: true,
    baseEnergyLevel: 0.3,
    responsePersonality: 'hesitant' as const,
    intelligenceLevel: 'expert' as const
  }
} as const;