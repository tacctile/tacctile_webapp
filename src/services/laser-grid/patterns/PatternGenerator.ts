/**
 * Pattern Generator
 * Creates various laser grid patterns for paranormal detection
 */

import {
  GridPattern,
  PatternType,
  LaserDot,
  Vector2,
  LaserColor,
  PatternBounds,
  PatternParameters,
  PatternTemplate
} from '../types';
import { logger } from '../../../utils/logger';

export class PatternGenerator {
  private templates: Map<string, PatternTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize pattern templates
   */
  private initializeTemplates(): void {
    const templates: PatternTemplate[] = [
      {
        name: 'Basic Grid',
        type: PatternType.GRID,
        description: 'Standard rectangular grid pattern',
        defaultParameters: { spacing: 50, density: 100 },
        category: 'basic'
      },
      {
        name: 'Dense Grid',
        type: PatternType.GRID,
        description: 'High-density grid for detailed detection',
        defaultParameters: { spacing: 25, density: 400 },
        category: 'advanced'
      },
      {
        name: 'Random Scatter',
        type: PatternType.RANDOM_DOTS,
        description: 'Randomly distributed dots',
        defaultParameters: { density: 150 },
        category: 'basic'
      },
      {
        name: 'Paranormal Grid',
        type: PatternType.GRID,
        description: 'Optimized for paranormal activity detection',
        defaultParameters: { spacing: 40, density: 225 },
        category: 'paranormal'
      },
      {
        name: 'Spirit Circles',
        type: PatternType.CONCENTRIC_CIRCLES,
        description: 'Concentric circles for entity detection',
        defaultParameters: { radius: 120, layers: 6 },
        category: 'paranormal'
      },
      {
        name: 'Vortex Spiral',
        type: PatternType.SPIRAL,
        description: 'Spiral pattern for energy detection',
        defaultParameters: { radius: 100, density: 300 },
        category: 'paranormal'
      },
      {
        name: 'Cross Pattern',
        type: PatternType.CROSS_HATCH,
        description: 'Cross-hatch for wall and surface scanning',
        defaultParameters: { spacing: 35 },
        category: 'advanced'
      },
      {
        name: 'Constellation Map',
        type: PatternType.CONSTELLATION,
        description: 'Star pattern for atmospheric disturbances',
        defaultParameters: { density: 50 },
        category: 'advanced'
      },
      {
        name: 'Portal Detection',
        type: PatternType.CONCENTRIC_CIRCLES,
        description: 'Specialized pattern for dimensional anomalies',
        defaultParameters: { radius: 80, layers: 8, spacing: 10 },
        category: 'paranormal'
      }
    ];

    for (const template of templates) {
      this.templates.set(template.name, template);
    }
  }

  /**
   * Generate pattern from template
   */
  generateFromTemplate(
    templateName: string,
    bounds: PatternBounds,
    intensity = 1.0,
    color: LaserColor = { r: 255, g: 0, b: 0, wavelength: 650 },
    customParameters?: Partial<PatternParameters>
  ): GridPattern {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Pattern template not found: ${templateName}`);
    }

    const parameters = { ...template.defaultParameters, ...customParameters };

    return this.generatePattern(
      template.type,
      bounds,
      intensity,
      color,
      parameters,
      template.name
    );
  }

  /**
   * Generate pattern by type
   */
  generatePattern(
    type: PatternType,
    bounds: PatternBounds,
    intensity = 1.0,
    color: LaserColor = { r: 255, g: 0, b: 0, wavelength: 650 },
    parameters: PatternParameters = {},
    name?: string
  ): GridPattern {
    const pattern: GridPattern = {
      id: `pattern_${Date.now()}_${Math.random()}`,
      name: name || `${type} Pattern`,
      type,
      dots: [],
      bounds,
      intensity,
      color,
      parameters
    };

    switch (type) {
      case PatternType.GRID:
        pattern.dots = this.generateGridDots(bounds, parameters, intensity, color);
        break;
      case PatternType.RANDOM_DOTS:
        pattern.dots = this.generateRandomDots(bounds, parameters, intensity, color);
        break;
      case PatternType.CONCENTRIC_CIRCLES:
        pattern.dots = this.generateConcentricCircles(bounds, parameters, intensity, color);
        break;
      case PatternType.SPIRAL:
        pattern.dots = this.generateSpiral(bounds, parameters, intensity, color);
        break;
      case PatternType.CROSS_HATCH:
        pattern.dots = this.generateCrossHatch(bounds, parameters, intensity, color);
        break;
      case PatternType.CONSTELLATION:
        pattern.dots = this.generateConstellation(bounds, parameters, intensity, color);
        break;
      case PatternType.CUSTOM:
        // Custom patterns would be loaded from file or user input
        break;
    }

    logger.info(`Generated ${pattern.name} with ${pattern.dots.length} dots`);
    return pattern;
  }

  /**
   * Generate grid dots
   */
  private generateGridDots(
    bounds: PatternBounds,
    parameters: PatternParameters,
    intensity: number,
    color: LaserColor
  ): LaserDot[] {
    const dots: LaserDot[] = [];
    const spacing = parameters.spacing || 50;
    const { width, height, centerX, centerY, rotation } = bounds;

    const dotsX = Math.floor(width / spacing);
    const dotsY = Math.floor(height / spacing);

    for (let y = 0; y < dotsY; y++) {
      for (let x = 0; x < dotsX; x++) {
        const localX = (x - (dotsX - 1) / 2) * spacing;
        const localY = (y - (dotsY - 1) / 2) * spacing;

        // Apply rotation
        const rotatedPos = this.rotatePoint(localX, localY, rotation);
        
        const position: Vector2 = {
          x: rotatedPos.x + centerX,
          y: rotatedPos.y + centerY
        };

        dots.push({
          id: `grid_${x}_${y}`,
          position,
          intensity: intensity * (0.9 + Math.random() * 0.1), // Slight variation
          color,
          size: 5,
          enabled: true
        });
      }
    }

    return dots;
  }

  /**
   * Generate random dots
   */
  private generateRandomDots(
    bounds: PatternBounds,
    parameters: PatternParameters,
    intensity: number,
    color: LaserColor
  ): LaserDot[] {
    const dots: LaserDot[] = [];
    const density = parameters.density || 100;
    const { width, height, centerX, centerY } = bounds;

    for (let i = 0; i < density; i++) {
      const localX = (Math.random() - 0.5) * width;
      const localY = (Math.random() - 0.5) * height;

      const position: Vector2 = {
        x: localX + centerX,
        y: localY + centerY
      };

      dots.push({
        id: `random_${i}`,
        position,
        intensity: intensity * (0.3 + Math.random() * 0.7),
        color,
        size: 2 + Math.random() * 6,
        enabled: true
      });
    }

    return dots;
  }

  /**
   * Generate concentric circles
   */
  private generateConcentricCircles(
    bounds: PatternBounds,
    parameters: PatternParameters,
    intensity: number,
    color: LaserColor
  ): LaserDot[] {
    const dots: LaserDot[] = [];
    const radius = parameters.radius || 100;
    const layers = parameters.layers || 5;
    const { centerX, centerY, rotation } = bounds;

    for (let layer = 1; layer <= layers; layer++) {
      const currentRadius = (radius / layers) * layer;
      const circumference = 2 * Math.PI * currentRadius;
      const dotsInCircle = Math.max(8, Math.floor(circumference / 8)); // Minimum 8 dots per circle

      for (let i = 0; i < dotsInCircle; i++) {
        const angle = (2 * Math.PI * i) / dotsInCircle + rotation * (Math.PI / 180);
        const localX = Math.cos(angle) * currentRadius;
        const localY = Math.sin(angle) * currentRadius;

        const position: Vector2 = {
          x: localX + centerX,
          y: localY + centerY
        };

        // Vary intensity based on layer
        const layerIntensity = intensity * (0.5 + (layer / layers) * 0.5);

        dots.push({
          id: `circle_${layer}_${i}`,
          position,
          intensity: layerIntensity,
          color,
          size: 4 + layer,
          enabled: true
        });
      }
    }

    return dots;
  }

  /**
   * Generate spiral pattern
   */
  private generateSpiral(
    bounds: PatternBounds,
    parameters: PatternParameters,
    intensity: number,
    color: LaserColor
  ): LaserDot[] {
    const dots: LaserDot[] = [];
    const maxRadius = parameters.radius || 100;
    const density = parameters.density || 200;
    const { centerX, centerY, rotation } = bounds;

    const spiralTurns = 5; // Number of full rotations

    for (let i = 0; i < density; i++) {
      const t = i / density;
      const angle = t * spiralTurns * 2 * Math.PI + rotation * (Math.PI / 180);
      const currentRadius = t * maxRadius;

      const localX = Math.cos(angle) * currentRadius;
      const localY = Math.sin(angle) * currentRadius;

      const position: Vector2 = {
        x: localX + centerX,
        y: localY + centerY
      };

      // Intensity increases toward center
      const spiralIntensity = intensity * (0.3 + (1 - t) * 0.7);

      dots.push({
        id: `spiral_${i}`,
        position,
        intensity: spiralIntensity,
        color,
        size: 2 + t * 4,
        enabled: true
      });
    }

    return dots;
  }

  /**
   * Generate cross-hatch pattern
   */
  private generateCrossHatch(
    bounds: PatternBounds,
    parameters: PatternParameters,
    intensity: number,
    color: LaserColor
  ): LaserDot[] {
    const dots: LaserDot[] = [];
    const spacing = parameters.spacing || 30;
    const { width, height, centerX, centerY, rotation } = bounds;

    // Horizontal lines
    const linesY = Math.floor(height / spacing);
    for (let y = 0; y < linesY; y++) {
      const dotsPerLine = Math.floor(width / 8);
      for (let x = 0; x < dotsPerLine; x++) {
        const localX = (x - (dotsPerLine - 1) / 2) * 8;
        const localY = (y - (linesY - 1) / 2) * spacing;

        const rotatedPos = this.rotatePoint(localX, localY, rotation);
        
        const position: Vector2 = {
          x: rotatedPos.x + centerX,
          y: rotatedPos.y + centerY
        };

        dots.push({
          id: `hatch_h_${y}_${x}`,
          position,
          intensity: intensity * 0.8,
          color,
          size: 2,
          enabled: true
        });
      }
    }

    // Vertical lines
    const linesX = Math.floor(width / spacing);
    for (let x = 0; x < linesX; x++) {
      const dotsPerLine = Math.floor(height / 8);
      for (let y = 0; y < dotsPerLine; y++) {
        const localX = (x - (linesX - 1) / 2) * spacing;
        const localY = (y - (dotsPerLine - 1) / 2) * 8;

        const rotatedPos = this.rotatePoint(localX, localY, rotation);
        
        const position: Vector2 = {
          x: rotatedPos.x + centerX,
          y: rotatedPos.y + centerY
        };

        dots.push({
          id: `hatch_v_${x}_${y}`,
          position,
          intensity: intensity * 0.8,
          color,
          size: 2,
          enabled: true
        });
      }
    }

    return dots;
  }

  /**
   * Generate constellation pattern
   */
  private generateConstellation(
    bounds: PatternBounds,
    parameters: PatternParameters,
    intensity: number,
    color: LaserColor
  ): LaserDot[] {
    const dots: LaserDot[] = [];
    const { centerX, centerY } = bounds;

    // Predefined constellation patterns
    const constellations = {
      'big_dipper': [
        { x: -100, y: 50 }, { x: -50, y: 60 }, { x: 0, y: 55 },
        { x: 50, y: 45 }, { x: 80, y: 20 }, { x: 60, y: -10 }, { x: 90, y: -30 }
      ],
      'orion': [
        { x: -80, y: 100 }, { x: -40, y: 80 }, { x: 0, y: 60 },
        { x: 40, y: 80 }, { x: 80, y: 100 }, { x: -20, y: 20 },
        { x: 0, y: 0 }, { x: 20, y: 20 }
      ],
      'cassiopeia': [
        { x: -100, y: 0 }, { x: -50, y: 40 }, { x: 0, y: -20 },
        { x: 50, y: 30 }, { x: 100, y: -10 }
      ],
      'paranormal_detector': [
        { x: 0, y: 0 }, // Center star
        { x: -60, y: 60 }, { x: 60, y: 60 }, // Top corners
        { x: -60, y: -60 }, { x: 60, y: -60 }, // Bottom corners
        { x: 0, y: 80 }, { x: 0, y: -80 }, // Vertical
        { x: -80, y: 0 }, { x: 80, y: 0 }, // Horizontal
        { x: -40, y: 40 }, { x: 40, y: 40 }, // Inner pattern
        { x: -40, y: -40 }, { x: 40, y: -40 }
      ]
    };

    const selectedPattern = constellations['paranormal_detector'];

    for (let i = 0; i < selectedPattern.length; i++) {
      const star = selectedPattern[i];
      const position: Vector2 = {
        x: star.x + centerX,
        y: star.y + centerY
      };

      // Vary star brightness
      const starIntensity = intensity * (0.6 + Math.random() * 0.4);
      const starSize = i === 0 ? 8 : 4 + Math.random() * 3; // Center star larger

      dots.push({
        id: `star_${i}`,
        position,
        intensity: starIntensity,
        color,
        size: starSize,
        enabled: true
      });
    }

    return dots;
  }

  /**
   * Generate adaptive pattern based on room dimensions
   */
  generateAdaptivePattern(
    roomWidth: number,
    roomHeight: number,
    roomDepth: number,
    type: PatternType = PatternType.GRID
  ): GridPattern {
    // Calculate optimal bounds based on room size
    const bounds: PatternBounds = {
      width: Math.min(roomWidth * 0.8, 400),
      height: Math.min(roomHeight * 0.8, 300),
      centerX: 0,
      centerY: 0,
      rotation: 0
    };

    // Adjust parameters based on room depth
    const parameters: PatternParameters = {};
    
    if (roomDepth < 3) {
      // Small room - high density
      parameters.spacing = 25;
      parameters.density = 200;
    } else if (roomDepth < 6) {
      // Medium room - medium density
      parameters.spacing = 35;
      parameters.density = 150;
    } else {
      // Large room - lower density but wider coverage
      parameters.spacing = 50;
      parameters.density = 100;
    }

    return this.generatePattern(
      type,
      bounds,
      1.0,
      { r: 255, g: 0, b: 0, wavelength: 650 },
      parameters,
      `Adaptive ${type} Pattern`
    );
  }

  /**
   * Generate pattern for specific paranormal investigation
   */
  generateParanormalPattern(investigationType: string): GridPattern {
    const bounds: PatternBounds = {
      width: 300,
      height: 200,
      centerX: 0,
      centerY: 0,
      rotation: 0
    };

    switch (investigationType.toLowerCase()) {
      case 'shadow_figure':
        return this.generatePattern(
          PatternType.CROSS_HATCH,
          bounds,
          0.8,
          { r: 255, g: 0, b: 0, wavelength: 650 },
          { spacing: 40 },
          'Shadow Figure Detection Grid'
        );

      case 'poltergeist':
        return this.generatePattern(
          PatternType.RANDOM_DOTS,
          bounds,
          1.0,
          { r: 0, g: 255, b: 0, wavelength: 532 },
          { density: 250 },
          'Poltergeist Activity Grid'
        );

      case 'apparition':
        return this.generatePattern(
          PatternType.CONCENTRIC_CIRCLES,
          bounds,
          0.9,
          { r: 255, g: 100, b: 0, wavelength: 635 },
          { radius: 120, layers: 8 },
          'Apparition Detection Circles'
        );

      case 'portal':
        return this.generatePattern(
          PatternType.SPIRAL,
          bounds,
          1.0,
          { r: 128, g: 0, b: 255, wavelength: 405 },
          { radius: 150, density: 300 },
          'Portal Detection Spiral'
        );

      case 'entity':
        return this.generateFromTemplate('Paranormal Grid', bounds);

      default:
        return this.generateFromTemplate('Basic Grid', bounds);
    }
  }

  /**
   * Modify existing pattern
   */
  modifyPattern(
    pattern: GridPattern,
    modifications: {
      intensity?: number;
      color?: LaserColor;
      bounds?: Partial<PatternBounds>;
      enabledDots?: string[];
      disabledDots?: string[];
    }
  ): GridPattern {
    const modified = { ...pattern };

    if (modifications.intensity !== undefined) {
      modified.intensity = modifications.intensity;
      // Update all dot intensities proportionally
      for (const dot of modified.dots) {
        dot.intensity = modifications.intensity * (dot.intensity / pattern.intensity);
      }
    }

    if (modifications.color) {
      modified.color = modifications.color;
      for (const dot of modified.dots) {
        dot.color = modifications.color;
      }
    }

    if (modifications.bounds) {
      modified.bounds = { ...pattern.bounds, ...modifications.bounds };
    }

    if (modifications.enabledDots) {
      for (const dotId of modifications.enabledDots) {
        const dot = modified.dots.find(d => d.id === dotId);
        if (dot) dot.enabled = true;
      }
    }

    if (modifications.disabledDots) {
      for (const dotId of modifications.disabledDots) {
        const dot = modified.dots.find(d => d.id === dotId);
        if (dot) dot.enabled = false;
      }
    }

    return modified;
  }

  /**
   * Rotate point around origin
   */
  private rotatePoint(x: number, y: number, angle: number): Vector2 {
    const radians = angle * (Math.PI / 180);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos
    };
  }

  /**
   * Get available templates
   */
  getTemplates(): PatternTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by name
   */
  getTemplate(name: string): PatternTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Add custom template
   */
  addTemplate(template: PatternTemplate): void {
    this.templates.set(template.name, template);
    logger.info(`Added custom pattern template: ${template.name}`);
  }

  /**
   * Validate pattern
   */
  validatePattern(pattern: GridPattern): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!pattern.id || !pattern.name) {
      errors.push('Pattern must have id and name');
    }

    if (pattern.dots.length === 0) {
      errors.push('Pattern must have at least one dot');
    }

    if (pattern.intensity < 0 || pattern.intensity > 1) {
      errors.push('Pattern intensity must be between 0 and 1');
    }

    for (const dot of pattern.dots) {
      if (dot.intensity < 0 || dot.intensity > 1) {
        errors.push(`Dot ${dot.id} intensity must be between 0 and 1`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export pattern to JSON
   */
  exportPattern(pattern: GridPattern): string {
    return JSON.stringify(pattern, null, 2);
  }

  /**
   * Import pattern from JSON
   */
  importPattern(json: string): GridPattern {
    try {
      const pattern = JSON.parse(json) as GridPattern;
      const validation = this.validatePattern(pattern);
      
      if (!validation.valid) {
        throw new Error(`Invalid pattern: ${validation.errors.join(', ')}`);
      }

      return pattern;
    } catch (error) {
      throw new Error(`Failed to import pattern: ${error}`);
    }
  }
}