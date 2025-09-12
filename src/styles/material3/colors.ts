import {
  argbFromHex,
  hexFromArgb,
  TonalPalette,
  MaterialDynamicColors,
  DynamicScheme,
  Hct
} from '@material/material-color-utilities';

// Dynamic color system for ghost hunting app
export class GhostHunterColors {
  // Core brand colors
  static readonly brandPrimary = '#8B5CF6'; // Purple - paranormal/mystical
  static readonly brandSecondary = '#22D3EE'; // Cyan - technology/sensors
  static readonly brandTertiary = '#F97316'; // Orange - alerts/warnings
  
  // Semantic colors for evidence types
  static readonly evidence = {
    emf: '#10B981', // Green - EMF readings
    temperature: '#3B82F6', // Blue - temperature drops
    audio: '#EC4899', // Pink - EVP/audio anomalies
    visual: '#8B5CF6', // Purple - visual apparitions
    motion: '#F59E0B', // Amber - motion detection
    environmental: '#06B6D4' // Cyan - environmental changes
  };
  
  // Alert levels
  static readonly alerts = {
    safe: '#10B981', // Green
    caution: '#F59E0B', // Yellow
    warning: '#F97316', // Orange
    danger: '#EF4444', // Red
    critical: '#991B1B' // Dark red
  };
  
  // Generate tonal palette from any color
  static generatePalette(hexColor: string): TonalPalette {
    return TonalPalette.fromInt(argbFromHex(hexColor));
  }
  
  // Get all tones for a color (0-100)
  static getTones(hexColor: string): Record<number, string> {
    const palette = this.generatePalette(hexColor);
    const tones: Record<number, string> = {};
    
    // Material 3 standard tones
    const standardTones = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
    
    standardTones.forEach(tone => {
      tones[tone] = hexFromArgb(palette.tone(tone));
    });
    
    return tones;
  }
  
  // Generate harmonized color for better visual cohesion
  static harmonize(color1: string, color2: string): string {
    const hct1 = Hct.fromInt(argbFromHex(color1));
    const hct2 = Hct.fromInt(argbFromHex(color2));
    
    // Blend hues for harmony
    const blendedHue = (hct1.hue + hct2.hue) / 2;
    const harmonized = Hct.from(blendedHue, hct1.chroma, hct1.tone);
    
    return hexFromArgb(harmonized.toInt());
  }
  
  // Get contrast color for text on background
  static getOnColor(backgroundColor: string, preferLight = false): string {
    const bgPalette = this.generatePalette(backgroundColor);
    const bgTone = Hct.fromInt(argbFromHex(backgroundColor)).tone;
    
    // Material 3 contrast rules
    if (bgTone < 50) {
      // Dark background - use light text
      return hexFromArgb(bgPalette.tone(preferLight ? 100 : 90));
    } else {
      // Light background - use dark text
      return hexFromArgb(bgPalette.tone(preferLight ? 0 : 10));
    }
  }
  
  // Generate surface colors with elevation
  static getSurfaceElevation(baseColor: string, elevation: number): string {
    const palette = this.generatePalette(baseColor);
    
    // Dark theme elevation tones
    const elevationTones: Record<number, number> = {
      0: 10,  // Base surface
      1: 12,  // +1dp
      2: 14,  // +3dp
      3: 17,  // +6dp
      4: 20,  // +8dp
      5: 24   // +12dp
    };
    
    const tone = elevationTones[elevation] || 10;
    return hexFromArgb(palette.tone(tone));
  }
  
  // Generate state layer colors
  static getStateLayer(baseColor: string, state: 'hover' | 'focus' | 'pressed' | 'dragged'): string {
    const hct = Hct.fromInt(argbFromHex(baseColor));
    
    const stateOpacities = {
      hover: 0.08,
      focus: 0.12,
      pressed: 0.12,
      dragged: 0.16
    };
    
    const opacity = stateOpacities[state];
    const stateColor = Hct.from(hct.hue, hct.chroma, hct.tone);
    
    // Return color with opacity (as rgba)
    const rgb = hexToRgb(hexFromArgb(stateColor.toInt()));
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// CSS custom properties generator
export function generateColorTokens(): string {
  const tokens: string[] = [];
  
  // Generate tokens for brand colors
  Object.entries({
    primary: GhostHunterColors.brandPrimary,
    secondary: GhostHunterColors.brandSecondary,
    tertiary: GhostHunterColors.brandTertiary
  }).forEach(([name, color]) => {
    const tones = GhostHunterColors.getTones(color);
    Object.entries(tones).forEach(([tone, hex]) => {
      tokens.push(`--ghost-color-${name}-${tone}: ${hex};`);
    });
  });
  
  // Generate tokens for evidence colors
  Object.entries(GhostHunterColors.evidence).forEach(([type, color]) => {
    tokens.push(`--ghost-evidence-${type}: ${color};`);
    tokens.push(`--ghost-evidence-${type}-container: ${GhostHunterColors.getTones(color)[90]};`);
    tokens.push(`--ghost-evidence-${type}-on-container: ${GhostHunterColors.getTones(color)[10]};`);
  });
  
  // Generate tokens for alert colors
  Object.entries(GhostHunterColors.alerts).forEach(([level, color]) => {
    tokens.push(`--ghost-alert-${level}: ${color};`);
    tokens.push(`--ghost-alert-${level}-container: ${GhostHunterColors.getTones(color)[90]};`);
    tokens.push(`--ghost-alert-${level}-on-container: ${GhostHunterColors.getTones(color)[10]};`);
  });
  
  return tokens.join('\n  ');
}

export default GhostHunterColors;