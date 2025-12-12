/**
 * Image Tool Types
 * Type definitions for Adobe Lightroom-inspired image editing tool
 */

// ============================================================================
// VIEW MODES
// ============================================================================

export type ImageViewMode = 'single' | 'compare' | 'split';
export type CompareMode = 'side-by-side' | 'before-after' | 'split-horizontal' | 'split-vertical';

// ============================================================================
// IMAGE ADJUSTMENTS (Non-destructive)
// ============================================================================

export interface ImageAdjustments {
  // Basic adjustments
  exposure: number;        // -5 to +5 (0 = no change)
  contrast: number;        // -100 to +100 (0 = no change)
  highlights: number;      // -100 to +100 (0 = no change)
  shadows: number;         // -100 to +100 (0 = no change)
  whites: number;          // -100 to +100 (0 = no change)
  blacks: number;          // -100 to +100 (0 = no change)

  // Presence
  clarity: number;         // -100 to +100 (0 = no change, adds local contrast)
  vibrance: number;        // -100 to +100 (0 = no change)
  saturation: number;      // -100 to +100 (0 = no change)

  // Tone curve points
  toneCurve: ToneCurvePoint[];

  // Color adjustments
  temperature: number;     // -100 to +100 (0 = neutral)
  tint: number;            // -100 to +100 (0 = neutral)

  // Detail
  sharpening: SharpeningSettings;
  noiseReduction: NoiseReductionSettings;

  // Effects
  vignette: VignetteSettings;
  grain: GrainSettings;
}

export interface ToneCurvePoint {
  x: number; // 0-255 input
  y: number; // 0-255 output
}

export interface SharpeningSettings {
  amount: number;          // 0 to 150 (0 = no sharpening)
  radius: number;          // 0.5 to 3.0
  detail: number;          // 0 to 100
  masking: number;         // 0 to 100
}

export interface NoiseReductionSettings {
  luminance: number;       // 0 to 100
  color: number;           // 0 to 100
  detail: number;          // 0 to 100
}

export interface VignetteSettings {
  amount: number;          // -100 to +100 (negative = darken edges)
  midpoint: number;        // 0 to 100
  roundness: number;       // -100 to +100
  feather: number;         // 0 to 100
}

export interface GrainSettings {
  amount: number;          // 0 to 100
  size: number;            // 1 to 100
  roughness: number;       // 0 to 100
}

// ============================================================================
// CROP & TRANSFORM
// ============================================================================

export interface CropSettings {
  enabled: boolean;
  x: number;               // 0-1 normalized
  y: number;               // 0-1 normalized
  width: number;           // 0-1 normalized
  height: number;          // 0-1 normalized
  rotation: number;        // degrees
  aspectRatio: AspectRatio | null;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export type AspectRatio =
  | 'original'
  | 'free'
  | '1:1'
  | '4:3'
  | '3:2'
  | '16:9'
  | '5:4'
  | '7:5';

// ============================================================================
// FILTERS / PRESETS
// ============================================================================

export interface ImageFilter {
  id: string;
  name: string;
  category: FilterCategory;
  adjustments: Partial<ImageAdjustments>;
  thumbnailUrl?: string;
  isPreset: boolean;
}

export type FilterCategory =
  | 'color'
  | 'b&w'
  | 'vintage'
  | 'cinematic'
  | 'forensic'
  | 'enhancement'
  | 'custom';

// ============================================================================
// ANNOTATIONS (Vector-based)
// ============================================================================

export type AnnotationType = 'circle' | 'arrow' | 'rectangle' | 'text' | 'freehand' | 'polygon' | 'line';

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  userId: string;
  userDisplayName: string;
  color: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  label?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CircleAnnotation extends BaseAnnotation {
  type: 'circle';
  centerX: number;         // 0-1 normalized
  centerY: number;         // 0-1 normalized
  radiusX: number;         // 0-1 normalized
  radiusY: number;         // 0-1 normalized (for ellipses)
  filled: boolean;
  fillOpacity: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  startX: number;          // 0-1 normalized
  startY: number;          // 0-1 normalized
  endX: number;            // 0-1 normalized
  endY: number;            // 0-1 normalized
  headSize: number;
  doubleHeaded: boolean;
}

export interface RectangleAnnotation extends BaseAnnotation {
  type: 'rectangle';
  x: number;               // 0-1 normalized
  y: number;               // 0-1 normalized
  width: number;           // 0-1 normalized
  height: number;          // 0-1 normalized
  rotation: number;
  cornerRadius: number;
  filled: boolean;
  fillOpacity: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;               // 0-1 normalized
  y: number;               // 0-1 normalized
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  backgroundColor?: string;
  backgroundOpacity: number;
  padding: number;
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand';
  points: { x: number; y: number }[];
  smoothing: number;
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  dashPattern?: number[];
}

export interface PolygonAnnotation extends BaseAnnotation {
  type: 'polygon';
  points: { x: number; y: number }[];
  closed: boolean;
  filled: boolean;
  fillOpacity: number;
}

export type ImageAnnotation =
  | CircleAnnotation
  | ArrowAnnotation
  | RectangleAnnotation
  | TextAnnotation
  | FreehandAnnotation
  | LineAnnotation
  | PolygonAnnotation;

// ============================================================================
// EDIT RECIPES (Non-destructive edit history)
// ============================================================================

export interface ImageEditRecipe {
  id: string;
  name: string;
  description?: string;
  userId: string;
  userDisplayName: string;
  adjustments: ImageAdjustments;
  crop: CropSettings;
  filterId?: string;
  annotations: ImageAnnotation[];
  tags: string[];
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserEditSnapshot {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  recipeName: string;
  adjustments: ImageAdjustments;
  crop: CropSettings;
  filterId?: string;
  annotations: ImageAnnotation[];
  color: string;           // User color for compare view
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// EDIT METADATA (Stored with file)
// ============================================================================

export interface ImageEditMetadata {
  sourceFile: string;
  edits: UserEditSnapshot[];
  currentEditId?: string;
  originalDimensions: {
    width: number;
    height: number;
  };
  fileHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// IMAGE TOOL STATE
// ============================================================================

export interface ImageToolState {
  // Image data
  fileId: string | null;
  investigationId: string | null;
  imageUrl: string | null;
  imageElement: HTMLImageElement | null;
  originalDimensions: { width: number; height: number } | null;

  // View state
  viewMode: ImageViewMode;
  compareMode: CompareMode;
  compareEditIds: [string | null, string | null]; // [left/before, right/after]
  zoom: number;
  panX: number;
  panY: number;
  fitToView: boolean;

  // Active tool
  activeTool: ImageToolType;

  // Current adjustments (non-destructive)
  adjustments: ImageAdjustments;
  crop: CropSettings;
  activeFilterId: string | null;

  // Annotations
  annotations: ImageAnnotation[];
  selectedAnnotationId: string | null;
  annotationDefaults: AnnotationDefaults;

  // Edit history (for undo/redo)
  history: ImageHistoryEntry[];
  historyIndex: number;
  maxHistoryLength: number;

  // Recipes
  recipes: ImageEditRecipe[];

  // User edits (for compare)
  userEdits: UserEditSnapshot[];
  activeUserEditId: string | null;

  // UI state
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;

  // Panel visibility
  showAdjustmentsPanel: boolean;
  showAnnotationsPanel: boolean;
  showRecipesPanel: boolean;
  showHistogramPanel: boolean;
}

export type ImageToolType =
  | 'pan'
  | 'zoom'
  | 'crop'
  | 'circle'
  | 'arrow'
  | 'rectangle'
  | 'text'
  | 'freehand'
  | 'line'
  | 'polygon'
  | 'eyedropper';

export interface AnnotationDefaults {
  color: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
}

export interface ImageHistoryEntry {
  id: string;
  timestamp: Date;
  action: string;
  adjustments: ImageAdjustments;
  crop: CropSettings;
  annotations: ImageAnnotation[];
  activeFilterId: string | null;
}

// ============================================================================
// HISTOGRAM DATA
// ============================================================================

export interface HistogramData {
  red: number[];           // 256 values
  green: number[];         // 256 values
  blue: number[];          // 256 values
  luminance: number[];     // 256 values
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  clarity: 0,
  vibrance: 0,
  saturation: 0,
  toneCurve: [
    { x: 0, y: 0 },
    { x: 64, y: 64 },
    { x: 128, y: 128 },
    { x: 192, y: 192 },
    { x: 255, y: 255 },
  ],
  temperature: 0,
  tint: 0,
  sharpening: {
    amount: 0,
    radius: 1.0,
    detail: 25,
    masking: 0,
  },
  noiseReduction: {
    luminance: 0,
    color: 25,
    detail: 50,
  },
  vignette: {
    amount: 0,
    midpoint: 50,
    roundness: 0,
    feather: 50,
  },
  grain: {
    amount: 0,
    size: 25,
    roughness: 50,
  },
};

export const DEFAULT_CROP_SETTINGS: CropSettings = {
  enabled: false,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  rotation: 0,
  aspectRatio: null,
  flipHorizontal: false,
  flipVertical: false,
};

export const DEFAULT_ANNOTATION_DEFAULTS: AnnotationDefaults = {
  color: '#ff4444',
  strokeWidth: 2,
  opacity: 1,
  fontSize: 16,
  fontFamily: 'Arial',
};

// ============================================================================
// PRESET FILTERS
// ============================================================================

export const PRESET_FILTERS: Omit<ImageFilter, 'id'>[] = [
  {
    name: 'Original',
    category: 'color',
    adjustments: {},
    isPreset: true,
  },
  {
    name: 'Auto Enhance',
    category: 'enhancement',
    adjustments: {
      exposure: 0.3,
      contrast: 15,
      highlights: -20,
      shadows: 25,
      clarity: 20,
      vibrance: 15,
    },
    isPreset: true,
  },
  {
    name: 'High Contrast',
    category: 'enhancement',
    adjustments: {
      contrast: 40,
      highlights: -15,
      shadows: -15,
      clarity: 30,
    },
    isPreset: true,
  },
  {
    name: 'Shadow Recovery',
    category: 'forensic',
    adjustments: {
      exposure: 0.5,
      shadows: 80,
      blacks: 30,
      clarity: 25,
    },
    isPreset: true,
  },
  {
    name: 'Highlight Recovery',
    category: 'forensic',
    adjustments: {
      exposure: -0.3,
      highlights: -80,
      whites: -40,
    },
    isPreset: true,
  },
  {
    name: 'Night Vision',
    category: 'forensic',
    adjustments: {
      exposure: 1.5,
      contrast: 30,
      shadows: 100,
      clarity: 40,
      saturation: -50,
      temperature: 30,
    },
    isPreset: true,
  },
  {
    name: 'File Clarity',
    category: 'forensic',
    adjustments: {
      clarity: 60,
      sharpening: {
        amount: 80,
        radius: 1.5,
        detail: 50,
        masking: 20,
      },
      noiseReduction: {
        luminance: 30,
        color: 40,
        detail: 50,
      },
    },
    isPreset: true,
  },
  {
    name: 'Classic B&W',
    category: 'b&w',
    adjustments: {
      saturation: -100,
      contrast: 20,
    },
    isPreset: true,
  },
  {
    name: 'High Key B&W',
    category: 'b&w',
    adjustments: {
      saturation: -100,
      exposure: 0.5,
      contrast: -10,
      highlights: 30,
    },
    isPreset: true,
  },
  {
    name: 'Low Key B&W',
    category: 'b&w',
    adjustments: {
      saturation: -100,
      exposure: -0.3,
      contrast: 40,
      blacks: -20,
    },
    isPreset: true,
  },
  {
    name: 'Vintage',
    category: 'vintage',
    adjustments: {
      contrast: -15,
      saturation: -20,
      temperature: 15,
      vignette: {
        amount: -30,
        midpoint: 50,
        roundness: 0,
        feather: 50,
      },
      grain: {
        amount: 25,
        size: 30,
        roughness: 50,
      },
    },
    isPreset: true,
  },
  {
    name: 'Faded Film',
    category: 'vintage',
    adjustments: {
      contrast: -20,
      highlights: 20,
      blacks: 30,
      saturation: -15,
      grain: {
        amount: 20,
        size: 25,
        roughness: 40,
      },
    },
    isPreset: true,
  },
  {
    name: 'Cinematic',
    category: 'cinematic',
    adjustments: {
      contrast: 25,
      highlights: -20,
      shadows: 10,
      temperature: -10,
      tint: 5,
      vignette: {
        amount: -25,
        midpoint: 40,
        roundness: 0,
        feather: 60,
      },
    },
    isPreset: true,
  },
  {
    name: 'Teal & Orange',
    category: 'cinematic',
    adjustments: {
      contrast: 15,
      vibrance: 20,
      temperature: 20,
      tint: -10,
    },
    isPreset: true,
  },
];

// User-specific colors for multi-user compare
export const USER_COLORS = [
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#F44336', // Red
  '#00BCD4', // Cyan
  '#FFEB3B', // Yellow
  '#E91E63', // Pink
];
