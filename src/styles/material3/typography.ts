// Material 3 Typography System
// Based on Material Design 3 guidelines

export interface TypeScale {
  font: string;
  lineHeight: string;
  size: string;
  tracking: string;
  weight: string;
}

export interface TypographySystem {
  displayLarge: TypeScale;
  displayMedium: TypeScale;
  displaySmall: TypeScale;
  headlineLarge: TypeScale;
  headlineMedium: TypeScale;
  headlineSmall: TypeScale;
  titleLarge: TypeScale;
  titleMedium: TypeScale;
  titleSmall: TypeScale;
  bodyLarge: TypeScale;
  bodyMedium: TypeScale;
  bodySmall: TypeScale;
  labelLarge: TypeScale;
  labelMedium: TypeScale;
  labelSmall: TypeScale;
}

// Material 3 Typography with Manrope font
export const typography: TypographySystem = {
  // Display styles - Largest text on screen
  displayLarge: {
    font: 'Manrope',
    lineHeight: '64px',
    size: '57px',
    tracking: '-0.25px',
    weight: '400'
  },
  displayMedium: {
    font: 'Manrope',
    lineHeight: '52px',
    size: '45px',
    tracking: '0px',
    weight: '400'
  },
  displaySmall: {
    font: 'Manrope',
    lineHeight: '44px',
    size: '36px',
    tracking: '0px',
    weight: '400'
  },
  
  // Headline styles - Section headers
  headlineLarge: {
    font: 'Manrope',
    lineHeight: '40px',
    size: '32px',
    tracking: '0px',
    weight: '400'
  },
  headlineMedium: {
    font: 'Manrope',
    lineHeight: '36px',
    size: '28px',
    tracking: '0px',
    weight: '400'
  },
  headlineSmall: {
    font: 'Manrope',
    lineHeight: '32px',
    size: '24px',
    tracking: '0px',
    weight: '400'
  },
  
  // Title styles - Smaller headers
  titleLarge: {
    font: 'Manrope',
    lineHeight: '28px',
    size: '22px',
    tracking: '0px',
    weight: '400'
  },
  titleMedium: {
    font: 'Manrope',
    lineHeight: '24px',
    size: '16px',
    tracking: '0.15px',
    weight: '500'
  },
  titleSmall: {
    font: 'Manrope',
    lineHeight: '20px',
    size: '14px',
    tracking: '0.1px',
    weight: '500'
  },
  
  // Body styles - Main content
  bodyLarge: {
    font: 'Manrope',
    lineHeight: '24px',
    size: '16px',
    tracking: '0.5px',
    weight: '400'
  },
  bodyMedium: {
    font: 'Manrope',
    lineHeight: '20px',
    size: '14px',
    tracking: '0.25px',
    weight: '400'
  },
  bodySmall: {
    font: 'Manrope',
    lineHeight: '16px',
    size: '12px',
    tracking: '0.4px',
    weight: '400'
  },
  
  // Label styles - UI elements
  labelLarge: {
    font: 'Manrope',
    lineHeight: '20px',
    size: '14px',
    tracking: '0.1px',
    weight: '500'
  },
  labelMedium: {
    font: 'Manrope',
    lineHeight: '16px',
    size: '12px',
    tracking: '0.5px',
    weight: '500'
  },
  labelSmall: {
    font: 'Manrope',
    lineHeight: '16px',
    size: '11px',
    tracking: '0.5px',
    weight: '500'
  }
};

// Generate CSS classes for typography
export function generateTypographyClasses(): string {
  const classes: string[] = [];
  
  Object.entries(typography).forEach(([name, scale]) => {
    const className = name.replace(/([A-Z])/g, '-$1').toLowerCase();
    classes.push(`
.type-${className} {
  font-family: ${scale.font}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: ${scale.size};
  font-weight: ${scale.weight};
  line-height: ${scale.lineHeight};
  letter-spacing: ${scale.tracking};
}`);
  });
  
  return classes.join('\n');
}

// Generate CSS custom properties for typography
export function generateTypographyTokens(): string {
  const tokens: string[] = [];
  
  Object.entries(typography).forEach(([name, scale]) => {
    const tokenName = name.replace(/([A-Z])/g, '-$1').toLowerCase();
    tokens.push(`--md-sys-typescale-${tokenName}-font: ${scale.font};`);
    tokens.push(`--md-sys-typescale-${tokenName}-size: ${scale.size};`);
    tokens.push(`--md-sys-typescale-${tokenName}-weight: ${scale.weight};`);
    tokens.push(`--md-sys-typescale-${tokenName}-line-height: ${scale.lineHeight};`);
    tokens.push(`--md-sys-typescale-${tokenName}-tracking: ${scale.tracking};`);
  });
  
  return tokens.join('\n  ');
}

// Adaptive typography for different screen sizes
export const adaptiveTypography = {
  compact: {
    displayLarge: { ...typography.displayLarge, size: '45px', lineHeight: '52px' },
    displayMedium: { ...typography.displayMedium, size: '36px', lineHeight: '44px' },
    displaySmall: { ...typography.displaySmall, size: '32px', lineHeight: '40px' }
  },
  medium: typography, // Default
  expanded: {
    displayLarge: { ...typography.displayLarge, size: '64px', lineHeight: '72px' },
    displayMedium: { ...typography.displayMedium, size: '52px', lineHeight: '60px' },
    displaySmall: { ...typography.displaySmall, size: '45px', lineHeight: '52px' }
  }
};

// Typography utilities
export const typographyUtils = {
  // Apply type scale to element
  applyTypeScale(element: HTMLElement, scale: keyof TypographySystem) {
    const typeScale = typography[scale];
    element.style.fontFamily = `${typeScale.font}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    element.style.fontSize = typeScale.size;
    element.style.fontWeight = typeScale.weight;
    element.style.lineHeight = typeScale.lineHeight;
    element.style.letterSpacing = typeScale.tracking;
  },
  
  // Get CSS for type scale
  getTypeScaleCSS(scale: keyof TypographySystem): string {
    const typeScale = typography[scale];
    return `
      font-family: ${typeScale.font}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: ${typeScale.size};
      font-weight: ${typeScale.weight};
      line-height: ${typeScale.lineHeight};
      letter-spacing: ${typeScale.tracking};
    `;
  },
  
  // Get responsive type scale
  getResponsiveScale(scale: keyof TypographySystem, screenSize: 'compact' | 'medium' | 'expanded' = 'medium'): TypeScale {
    const adaptiveScale = adaptiveTypography[screenSize];
    return (adaptiveScale as any)[scale] || typography[scale];
  }
};

export default typography;