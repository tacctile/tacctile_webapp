/**
 * Audio Tool Types
 * Types for the iZotope RX 11-inspired audio analysis tool
 */

// ============================================================================
// SPECTRAL SELECTION TYPES
// ============================================================================

/**
 * Represents a rectangular selection on the spectrogram
 * Defines both time range (horizontal) and frequency range (vertical)
 */
export interface SpectralSelection {
  id: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Low frequency in Hz */
  lowFrequency: number;
  /** High frequency in Hz */
  highFrequency: number;
  /** Selection color for visualization */
  color: string;
  /** User ID who created this selection */
  userId: string;
  /** Whether this selection is visible */
  visible: boolean;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Represents a loop region for focused listening
 */
export interface LoopRegion {
  id: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Region label/name */
  label?: string;
  /** Region color */
  color: string;
  /** Whether loop is active */
  active: boolean;
}

// ============================================================================
// FILTER & EFFECT TYPES
// ============================================================================

/**
 * EQ band configuration
 */
export interface EQBand {
  id: string;
  /** Filter type */
  type: 'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch' | 'allpass';
  /** Center frequency in Hz */
  frequency: number;
  /** Gain in dB (-24 to +24) */
  gain: number;
  /** Q factor (0.1 to 18) */
  q: number;
  /** Whether this band is enabled */
  enabled: boolean;
}

/**
 * Noise reduction settings
 */
export interface NoiseReductionSettings {
  /** Whether noise reduction is enabled */
  enabled: boolean;
  /** Reduction amount (0-100%) */
  amount: number;
  /** Threshold for noise floor (-80 to 0 dB) */
  threshold: number;
  /** Attack time in ms */
  attack: number;
  /** Release time in ms */
  release: number;
  /** Noise profile learned from selection */
  noiseProfile?: Float32Array;
}

/**
 * Gain settings
 */
export interface GainSettings {
  /** Whether gain is enabled */
  enabled: boolean;
  /** Gain value in dB (-24 to +24) */
  value: number;
  /** Normalize to target level */
  normalize: boolean;
  /** Target normalization level in dB */
  targetLevel: number;
}

/**
 * Complete filter configuration
 */
export interface FilterSettings {
  /** EQ bands */
  eq: EQBand[];
  /** Noise reduction */
  noiseReduction: NoiseReductionSettings;
  /** Gain */
  gain: GainSettings;
  /** High-pass filter cutoff (Hz) - removes rumble */
  highPassCutoff: number;
  /** Low-pass filter cutoff (Hz) - removes hiss */
  lowPassCutoff: number;
  /** Enable filters */
  highPassEnabled: boolean;
  lowPassEnabled: boolean;
}

// ============================================================================
// RECIPE & ITERATION TYPES
// ============================================================================

/**
 * A saved filter combination (recipe)
 */
export interface FilterRecipe {
  id: string;
  /** Recipe name */
  name: string;
  /** Description */
  description?: string;
  /** Filter settings */
  settings: FilterSettings;
  /** User who created this recipe */
  userId: string;
  /** Tags for categorization */
  tags: string[];
  /** Whether this is a preset (not user-created) */
  isPreset: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

/**
 * An iteration of audio processing on a clip
 * Allows saving different filter combinations for comparison
 */
export interface AudioIteration {
  id: string;
  /** Parent evidence ID */
  evidenceId: string;
  /** Iteration name/label */
  name: string;
  /** Description of what this iteration represents */
  description?: string;
  /** Applied filter recipe ID */
  recipeId?: string;
  /** Filter settings (may differ from recipe) */
  settings: FilterSettings;
  /** User who created this iteration */
  userId: string;
  /** Whether this is the active iteration */
  active: boolean;
  /** Processed audio blob URL (cached) */
  processedAudioUrl?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

// ============================================================================
// FINDING TYPES
// ============================================================================

/**
 * An audio finding (spectral selection saved with notes)
 * Links to the main EvidenceFlag system
 */
export interface AudioFinding {
  id: string;
  /** Parent evidence ID */
  evidenceId: string;
  /** Investigation ID */
  investigationId: string;
  /** Linked evidence flag ID */
  flagId?: string;
  /** Spectral selection that defined this finding */
  selection: SpectralSelection;
  /** Iteration this finding was made in */
  iterationId?: string;
  /** Finding title */
  title: string;
  /** Detailed notes */
  notes?: string;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
  /** User who created this finding */
  userId: string;
  /** User display name */
  userDisplayName: string;
  /** User photo URL */
  userPhotoURL?: string;
  /** Tags */
  tags: string[];
  /** Whether this finding is visible to team */
  visible: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

// ============================================================================
// SPECTROGRAM TYPES
// ============================================================================

/**
 * Spectrogram display settings
 */
export interface SpectrogramSettings {
  /** FFT size (power of 2: 256, 512, 1024, 2048, 4096, 8192) */
  fftSize: number;
  /** Minimum frequency to display (Hz) */
  minFrequency: number;
  /** Maximum frequency to display (Hz) */
  maxFrequency: number;
  /** Frequency scale type */
  frequencyScale: 'linear' | 'logarithmic' | 'mel';
  /** Color map for intensity */
  colorMap: 'grayscale' | 'viridis' | 'plasma' | 'inferno' | 'magma' | 'thermal' | 'rainbow';
  /** Minimum dB level for color mapping */
  minDecibels: number;
  /** Maximum dB level for color mapping */
  maxDecibels: number;
  /** Window function for FFT */
  windowFunction: 'hann' | 'hamming' | 'blackman' | 'bartlett' | 'rectangular';
  /** Overlap between FFT windows (0-1) */
  overlap: number;
  /** Contrast adjustment (0-2) */
  contrast: number;
  /** Brightness adjustment (-1 to 1) */
  brightness: number;
}

/**
 * Waveform display settings
 */
export interface WaveformSettings {
  /** Waveform color */
  waveColor: string;
  /** Progress color */
  progressColor: string;
  /** Cursor color */
  cursorColor: string;
  /** Whether to show cursor */
  showCursor: boolean;
  /** Bar width (0 for line mode) */
  barWidth: number;
  /** Bar gap */
  barGap: number;
  /** Normalize waveform display */
  normalize: boolean;
  /** Waveform height (0-1) */
  height: number;
}

// ============================================================================
// AUDIO TOOL STATE TYPES
// ============================================================================

/**
 * View mode for the audio tool
 */
export type AudioViewMode = 'waveform' | 'spectrogram' | 'split';

/**
 * Playback state
 */
export interface PlaybackState {
  /** Whether audio is playing */
  isPlaying: boolean;
  /** Current playback time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Playback rate (0.25 to 4) */
  playbackRate: number;
  /** Volume (0 to 1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Whether loop is enabled */
  looping: boolean;
}

/**
 * Audio analysis data for visualization
 */
export interface AudioAnalysisData {
  /** Frequency data from analyser */
  frequencyData: Uint8Array;
  /** Time domain data from analyser */
  timeDomainData: Uint8Array;
  /** RMS level */
  rms: number;
  /** Peak level */
  peak: number;
  /** Spectral centroid */
  spectralCentroid: number;
  /** Spectral flux */
  spectralFlux: number;
}

/**
 * Full state for audio tool
 */
export interface AudioToolState {
  /** Current evidence ID */
  evidenceId: string | null;
  /** Investigation ID */
  investigationId: string | null;
  /** Audio buffer */
  audioBuffer: AudioBuffer | null;
  /** Audio URL (for wavesurfer) */
  audioUrl: string | null;
  /** View mode */
  viewMode: AudioViewMode;
  /** Playback state */
  playback: PlaybackState;
  /** Current spectral selection */
  currentSelection: SpectralSelection | null;
  /** All spectral selections */
  selections: SpectralSelection[];
  /** Loop regions */
  loopRegions: LoopRegion[];
  /** Active loop region */
  activeLoopId: string | null;
  /** Filter settings */
  filterSettings: FilterSettings;
  /** Saved recipes */
  recipes: FilterRecipe[];
  /** Audio iterations */
  iterations: AudioIteration[];
  /** Active iteration ID */
  activeIterationId: string | null;
  /** Findings */
  findings: AudioFinding[];
  /** Spectrogram settings */
  spectrogramSettings: SpectrogramSettings;
  /** Waveform settings */
  waveformSettings: WaveformSettings;
  /** Current analysis data */
  analysisData: AudioAnalysisData | null;
  /** Loading state */
  isLoading: boolean;
  /** Processing state */
  isProcessing: boolean;
  /** Error message */
  error: string | null;
  /** Whether filters are bypassed */
  filtersBypassed: boolean;
  /** Zoom level (pixels per second) */
  zoom: number;
  /** Scroll position (seconds) */
  scrollPosition: number;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  eq: [
    { id: 'eq-low', type: 'lowshelf', frequency: 100, gain: 0, q: 0.7, enabled: true },
    { id: 'eq-mid1', type: 'peaking', frequency: 500, gain: 0, q: 1, enabled: true },
    { id: 'eq-mid2', type: 'peaking', frequency: 2000, gain: 0, q: 1, enabled: true },
    { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: 0, q: 0.7, enabled: true },
  ],
  noiseReduction: {
    enabled: false,
    amount: 50,
    threshold: -40,
    attack: 10,
    release: 100,
  },
  gain: {
    enabled: true,
    value: 0,
    normalize: false,
    targetLevel: -3,
  },
  highPassCutoff: 80,
  lowPassCutoff: 12000,
  highPassEnabled: false,
  lowPassEnabled: false,
};

export const DEFAULT_SPECTROGRAM_SETTINGS: SpectrogramSettings = {
  fftSize: 2048,
  minFrequency: 0,
  maxFrequency: 22050,
  frequencyScale: 'logarithmic',
  colorMap: 'viridis',
  minDecibels: -100,
  maxDecibels: -30,
  windowFunction: 'hann',
  overlap: 0.5,
  contrast: 1,
  brightness: 0,
};

export const DEFAULT_WAVEFORM_SETTINGS: WaveformSettings = {
  waveColor: '#19abb5',
  progressColor: '#36d1da',
  cursorColor: '#ffffff',
  showCursor: true,
  barWidth: 2,
  barGap: 1,
  normalize: true,
  height: 1,
};

export const DEFAULT_PLAYBACK_STATE: PlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,
  muted: false,
  looping: false,
};

// ============================================================================
// PRESET RECIPES
// ============================================================================

export const PRESET_RECIPES: Omit<FilterRecipe, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'EVP Enhancement',
    description: 'Optimized for Electronic Voice Phenomena analysis - boosts mid frequencies and reduces background noise',
    settings: {
      ...DEFAULT_FILTER_SETTINGS,
      eq: [
        { id: 'eq-low', type: 'lowshelf', frequency: 100, gain: -6, q: 0.7, enabled: true },
        { id: 'eq-mid1', type: 'peaking', frequency: 800, gain: 4, q: 1.5, enabled: true },
        { id: 'eq-mid2', type: 'peaking', frequency: 2500, gain: 3, q: 1, enabled: true },
        { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: -3, q: 0.7, enabled: true },
      ],
      highPassEnabled: true,
      highPassCutoff: 150,
      lowPassEnabled: true,
      lowPassCutoff: 8000,
    },
    userId: 'system',
    tags: ['evp', 'voice', 'enhancement'],
    isPreset: true,
  },
  {
    name: 'Noise Reduction Heavy',
    description: 'Aggressive noise reduction for noisy recordings',
    settings: {
      ...DEFAULT_FILTER_SETTINGS,
      noiseReduction: {
        enabled: true,
        amount: 80,
        threshold: -35,
        attack: 5,
        release: 50,
      },
    },
    userId: 'system',
    tags: ['noise', 'cleanup'],
    isPreset: true,
  },
  {
    name: 'Voice Isolation',
    description: 'Isolates human voice frequency range',
    settings: {
      ...DEFAULT_FILTER_SETTINGS,
      highPassEnabled: true,
      highPassCutoff: 200,
      lowPassEnabled: true,
      lowPassCutoff: 4000,
      eq: [
        { id: 'eq-low', type: 'lowshelf', frequency: 100, gain: -12, q: 0.7, enabled: true },
        { id: 'eq-mid1', type: 'peaking', frequency: 1000, gain: 3, q: 0.8, enabled: true },
        { id: 'eq-mid2', type: 'peaking', frequency: 3000, gain: 2, q: 1, enabled: true },
        { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: -12, q: 0.7, enabled: true },
      ],
    },
    userId: 'system',
    tags: ['voice', 'isolation'],
    isPreset: true,
  },
  {
    name: 'Low Frequency Focus',
    description: 'Emphasizes low frequencies for detecting bass/rumble anomalies',
    settings: {
      ...DEFAULT_FILTER_SETTINGS,
      lowPassEnabled: true,
      lowPassCutoff: 500,
      eq: [
        { id: 'eq-low', type: 'lowshelf', frequency: 80, gain: 6, q: 0.7, enabled: true },
        { id: 'eq-mid1', type: 'peaking', frequency: 200, gain: 3, q: 1, enabled: true },
        { id: 'eq-mid2', type: 'peaking', frequency: 2000, gain: -6, q: 1, enabled: true },
        { id: 'eq-high', type: 'highshelf', frequency: 8000, gain: -12, q: 0.7, enabled: true },
      ],
    },
    userId: 'system',
    tags: ['low', 'bass', 'rumble'],
    isPreset: true,
  },
  {
    name: 'High Frequency Detail',
    description: 'Enhances high frequency detail for detecting subtle artifacts',
    settings: {
      ...DEFAULT_FILTER_SETTINGS,
      highPassEnabled: true,
      highPassCutoff: 2000,
      eq: [
        { id: 'eq-low', type: 'lowshelf', frequency: 100, gain: -12, q: 0.7, enabled: true },
        { id: 'eq-mid1', type: 'peaking', frequency: 500, gain: -6, q: 1, enabled: true },
        { id: 'eq-mid2', type: 'peaking', frequency: 4000, gain: 4, q: 1, enabled: true },
        { id: 'eq-high', type: 'highshelf', frequency: 10000, gain: 6, q: 0.7, enabled: true },
      ],
    },
    userId: 'system',
    tags: ['high', 'detail', 'treble'],
    isPreset: true,
  },
];

// ============================================================================
// COLOR MAPS FOR SPECTROGRAM
// ============================================================================

export const COLOR_MAPS: Record<SpectrogramSettings['colorMap'], string[]> = {
  grayscale: ['#000000', '#404040', '#808080', '#c0c0c0', '#ffffff'],
  viridis: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
  plasma: ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'],
  inferno: ['#000004', '#420a68', '#932667', '#dd513a', '#fca50a', '#fcffa4'],
  magma: ['#000004', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf'],
  thermal: ['#000000', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000', '#ffffff'],
  rainbow: ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'],
};
