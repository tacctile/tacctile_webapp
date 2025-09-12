import {
  argbFromHex,
  themeFromSourceColor,
  applyTheme,
  hexFromArgb,
  TonalPalette,
  CorePalette,
  Scheme
} from '@material/material-color-utilities';

// Ghost Hunter theme colors - Dark, mysterious with purple accents
const GHOST_HUNTER_SOURCE_COLOR = '#8B5CF6'; // Purple for paranormal theme
const GHOST_HUNTER_SECONDARY = '#22D3EE'; // Cyan for tech/sensors
const GHOST_HUNTER_TERTIARY = '#F97316'; // Orange for alerts/warnings
const GHOST_HUNTER_ERROR = '#EF4444'; // Red for errors
const GHOST_HUNTER_NEUTRAL = '#1F2937'; // Dark gray

export interface Material3Theme {
  schemes: {
    light: Scheme;
    dark: Scheme;
  };
  palettes: {
    primary: TonalPalette;
    secondary: TonalPalette;
    tertiary: TonalPalette;
    neutral: TonalPalette;
    neutralVariant: TonalPalette;
    error: TonalPalette;
  };
  customColors: {
    evidence: {
      name: string;
      value: string;
      blend: boolean;
      light: ColorRoles;
      dark: ColorRoles;
    };
    anomaly: {
      name: string;
      value: string;
      blend: boolean;
      light: ColorRoles;
      dark: ColorRoles;
    };
  };
}

interface ColorRoles {
  color: string;
  onColor: string;
  colorContainer: string;
  onColorContainer: string;
}

// Generate Material 3 theme from source colors
export function generateMaterial3Theme(): Material3Theme {
  const theme = themeFromSourceColor(argbFromHex(GHOST_HUNTER_SOURCE_COLOR), [
    {
      name: 'evidence',
      value: argbFromHex('#10B981'), // Green for confirmed evidence
      blend: true
    },
    {
      name: 'anomaly',
      value: argbFromHex('#EC4899'), // Pink for anomalies
      blend: true
    }
  ]);

  // Extract palettes
  const corePalette = CorePalette.of(argbFromHex(GHOST_HUNTER_SOURCE_COLOR));
  
  return {
    schemes: theme.schemes,
    palettes: theme.palettes,
    customColors: theme.customColors as Material3Theme['customColors']
  };
}

// Apply theme to CSS custom properties
export function applyMaterial3Theme(isDark: boolean = true) {
  const theme = generateMaterial3Theme();
  const scheme = isDark ? theme.schemes.dark : theme.schemes.light;
  
  // Apply to document
  applyTheme(theme, { target: document.body, dark: isDark });
  
  // Add custom CSS properties for our app
  const root = document.documentElement;
  
  // Surface elevations for dark theme
  if (isDark) {
    root.style.setProperty('--md-sys-color-surface-dim', hexFromArgb(scheme.surfaceDim));
    root.style.setProperty('--md-sys-color-surface-bright', hexFromArgb(scheme.surfaceBright));
    root.style.setProperty('--md-sys-color-surface-container-lowest', hexFromArgb(scheme.surfaceContainerLowest));
    root.style.setProperty('--md-sys-color-surface-container-low', hexFromArgb(scheme.surfaceContainerLow));
    root.style.setProperty('--md-sys-color-surface-container', hexFromArgb(scheme.surfaceContainer));
    root.style.setProperty('--md-sys-color-surface-container-high', hexFromArgb(scheme.surfaceContainerHigh));
    root.style.setProperty('--md-sys-color-surface-container-highest', hexFromArgb(scheme.surfaceContainerHighest));
  }
  
  // Add ghost hunting specific tokens
  root.style.setProperty('--ghost-color-evidence', theme.customColors.evidence.dark.color);
  root.style.setProperty('--ghost-color-evidence-container', theme.customColors.evidence.dark.colorContainer);
  root.style.setProperty('--ghost-color-anomaly', theme.customColors.anomaly.dark.color);
  root.style.setProperty('--ghost-color-anomaly-container', theme.customColors.anomaly.dark.colorContainer);
  
  return theme;
}

// Material 3 elevation system
export const elevation = {
  level0: 'none',
  level1: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
  level2: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
  level3: '0px 4px 8px 3px rgba(0, 0, 0, 0.15), 0px 1px 3px rgba(0, 0, 0, 0.3)',
  level4: '0px 6px 10px 4px rgba(0, 0, 0, 0.15), 0px 2px 3px rgba(0, 0, 0, 0.3)',
  level5: '0px 8px 12px 6px rgba(0, 0, 0, 0.15), 0px 4px 4px rgba(0, 0, 0, 0.3)'
};

// Material 3 shape system
export const shape = {
  none: '0px',
  extraSmall: '4px',
  small: '8px',
  medium: '12px',
  large: '16px',
  extraLarge: '28px',
  full: '50%'
};

// Material 3 motion/easing
export const motion = {
  duration: {
    short1: '50ms',
    short2: '100ms',
    short3: '150ms',
    short4: '200ms',
    medium1: '250ms',
    medium2: '300ms',
    medium3: '350ms',
    medium4: '400ms',
    long1: '450ms',
    long2: '500ms',
    long3: '550ms',
    long4: '600ms',
    extraLong1: '700ms',
    extraLong2: '800ms',
    extraLong3: '900ms',
    extraLong4: '1000ms'
  },
  easing: {
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
    emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    standardDecelerate: 'cubic-bezier(0, 0, 0, 1)',
    standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)',
    legacy: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear'
  }
};

export default {
  generateMaterial3Theme,
  applyMaterial3Theme,
  elevation,
  shape,
  motion
};