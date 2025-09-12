/**
 * Thermal Visualizer
 * Advanced thermal imaging visualization with heat signatures and overlays
 */

import { EventEmitter } from 'events';
import {
  ThermalFrame,
  ColorPalette,
  TemperatureRange,
  ContrastSettings,
  OverlaySettings,
  MeasurementTool,
  IsothermSettings,
  TemperatureAnomaly,
  ThermalPoint,
  AlertThreshold
} from '../types';
import { logger } from '../../../utils/logger';

export interface VisualizationConfig {
  palette: ColorPalette;
  temperatureRange: TemperatureRange;
  contrastSettings: ContrastSettings;
  overlaySettings: OverlaySettings;
  measurementTools: MeasurementTool[];
  isotherms: IsothermSettings;
  alertThresholds: AlertThreshold[];
}

export interface RenderOptions {
  showTemperatureValues: boolean;
  showMeasurements: boolean;
  showIsotherms: boolean;
  showAlerts: boolean;
  showColorBar: boolean;
  overlayOpacity: number;
}

export class ThermalVisualizer extends EventEmitter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;
  
  private config: VisualizationConfig;
  private renderOptions: RenderOptions;
  private colorLUT: Uint8ClampedArray;
  private isRendering: boolean = false;
  
  private currentFrame: ThermalFrame | null = null;
  private frameHistory: ThermalFrame[] = [];
  private anomalies: TemperatureAnomaly[] = [];
  
  private animationFrame: number = 0;
  private lastRenderTime: number = 0;
  private frameRate: number = 30;

  constructor(canvas: HTMLCanvasElement, config?: Partial<VisualizationConfig>) {
    super();
    
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Create overlay canvas for annotations
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
    
    this.config = {
      palette: ColorPalette.IRON,
      temperatureRange: { min: 10, max: 40, accuracy: 0.1 },
      contrastSettings: {
        autoAdjust: true,
        gamma: 1.0,
        histogramEqualization: false,
        edgeEnhancement: 0
      },
      overlaySettings: {
        showTemperatureValues: false,
        showIsotherms: false,
        isotherms: [],
        showMeasurements: true,
        showAnomalies: true,
        showColorBar: true,
        transparency: 0.8
      },
      measurementTools: [],
      isotherms: {
        enabled: false,
        isotherms: [],
        autoGenerate: true,
        spacing: 5,
        showLabels: true
      },
      alertThresholds: [],
      ...config
    };

    this.renderOptions = {
      showTemperatureValues: this.config.overlaySettings.showTemperatureValues,
      showMeasurements: this.config.overlaySettings.showMeasurements,
      showIsotherms: this.config.overlaySettings.showIsotherms,
      showAlerts: true,
      showColorBar: this.config.overlaySettings.showColorBar,
      overlayOpacity: this.config.overlaySettings.transparency
    };

    this.setupCanvas();
    this.generateColorLUT();
  }

  /**
   * Setup canvas properties
   */
  private setupCanvas(): void {
    // Set up high DPI support
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    
    // Setup overlay canvas
    this.overlayCanvas.width = this.canvas.width;
    this.overlayCanvas.height = this.canvas.height;
    this.overlayCtx.scale(devicePixelRatio, devicePixelRatio);
    
    // Canvas properties
    this.ctx.imageSmoothingEnabled = false; // Preserve thermal data sharpness
    this.overlayCtx.imageSmoothingEnabled = true;
  }

  /**
   * Generate color lookup table for current palette
   */
  private generateColorLUT(): void {
    this.colorLUT = new Uint8ClampedArray(256 * 4); // RGBA values

    for (let i = 0; i < 256; i++) {
      const intensity = i / 255;
      const color = this.getColorForIntensity(intensity, this.config.palette);
      
      this.colorLUT[i * 4] = color.r;     // Red
      this.colorLUT[i * 4 + 1] = color.g; // Green
      this.colorLUT[i * 4 + 2] = color.b; // Blue
      this.colorLUT[i * 4 + 3] = 255;     // Alpha
    }
  }

  /**
   * Get color for intensity value based on palette
   */
  private getColorForIntensity(intensity: number, palette: ColorPalette): { r: number; g: number; b: number } {
    // Clamp intensity
    intensity = Math.max(0, Math.min(1, intensity));

    switch (palette) {
      case ColorPalette.IRON:
        return this.getIronPaletteColor(intensity);
      case ColorPalette.RAINBOW:
        return this.getRainbowPaletteColor(intensity);
      case ColorPalette.WHITE_HOT:
        return this.getWhiteHotPaletteColor(intensity);
      case ColorPalette.BLACK_HOT:
        return this.getBlackHotPaletteColor(intensity);
      case ColorPalette.RED_HOT:
        return this.getRedHotPaletteColor(intensity);
      case ColorPalette.ARCTIC:
        return this.getArcticPaletteColor(intensity);
      case ColorPalette.GLOWBOW:
        return this.getGlowbowPaletteColor(intensity);
      case ColorPalette.LAVA:
        return this.getLavaPaletteColor(intensity);
      case ColorPalette.MEDICAL:
        return this.getMedicalPaletteColor(intensity);
      default:
        return this.getIronPaletteColor(intensity);
    }
  }

  /**
   * Iron palette (classic thermal imaging colors)
   */
  private getIronPaletteColor(intensity: number): { r: number; g: number; b: number } {
    if (intensity < 0.25) {
      // Black to dark blue
      const t = intensity * 4;
      return { r: 0, g: 0, b: Math.floor(t * 128) };
    } else if (intensity < 0.5) {
      // Dark blue to purple
      const t = (intensity - 0.25) * 4;
      return { r: Math.floor(t * 128), g: 0, b: 128 + Math.floor(t * 127) };
    } else if (intensity < 0.75) {
      // Purple to red
      const t = (intensity - 0.5) * 4;
      return { r: 128 + Math.floor(t * 127), g: Math.floor(t * 128), b: 255 - Math.floor(t * 255) };
    } else {
      // Red to yellow/white
      const t = (intensity - 0.75) * 4;
      return { r: 255, g: 128 + Math.floor(t * 127), b: Math.floor(t * 255) };
    }
  }

  /**
   * Rainbow palette
   */
  private getRainbowPaletteColor(intensity: number): { r: number; g: number; b: number } {
    const hue = (1 - intensity) * 240; // 240° = blue, 0° = red
    const saturation = 1;
    const lightness = 0.5;
    
    return this.hslToRgb(hue, saturation, lightness);
  }

  /**
   * White hot palette
   */
  private getWhiteHotPaletteColor(intensity: number): { r: number; g: number; b: number } {
    const value = Math.floor(intensity * 255);
    return { r: value, g: value, b: value };
  }

  /**
   * Black hot palette
   */
  private getBlackHotPaletteColor(intensity: number): { r: number; g: number; b: number } {
    const value = Math.floor((1 - intensity) * 255);
    return { r: value, g: value, b: value };
  }

  /**
   * Red hot palette
   */
  private getRedHotPaletteColor(intensity: number): { r: number; g: number; b: number } {
    if (intensity < 0.5) {
      const t = intensity * 2;
      return { r: Math.floor(t * 128), g: 0, b: 0 };
    } else {
      const t = (intensity - 0.5) * 2;
      return { r: 128 + Math.floor(t * 127), g: Math.floor(t * 255), b: Math.floor(t * 255) };
    }
  }

  /**
   * Arctic palette (blue-based)
   */
  private getArcticPaletteColor(intensity: number): { r: number; g: number; b: number } {
    if (intensity < 0.5) {
      const t = intensity * 2;
      return { r: Math.floor(t * 128), g: Math.floor(t * 200), b: 255 };
    } else {
      const t = (intensity - 0.5) * 2;
      return { r: 128 + Math.floor(t * 127), g: 200 + Math.floor(t * 55), b: 255 };
    }
  }

  /**
   * Glowbow palette
   */
  private getGlowbowPaletteColor(intensity: number): { r: number; g: number; b: number } {
    const hue = intensity * 360;
    return this.hslToRgb(hue, 1, 0.5 + intensity * 0.5);
  }

  /**
   * Lava palette
   */
  private getLavaPaletteColor(intensity: number): { r: number; g: number; b: number } {
    if (intensity < 0.33) {
      const t = intensity * 3;
      return { r: Math.floor(t * 64), g: 0, b: 0 };
    } else if (intensity < 0.66) {
      const t = (intensity - 0.33) * 3;
      return { r: 64 + Math.floor(t * 191), g: Math.floor(t * 128), b: 0 };
    } else {
      const t = (intensity - 0.66) * 3;
      return { r: 255, g: 128 + Math.floor(t * 127), b: Math.floor(t * 255) };
    }
  }

  /**
   * Medical palette (optimized for body temperature)
   */
  private getMedicalPaletteColor(intensity: number): { r: number; g: number; b: number } {
    if (intensity < 0.2) {
      // Blue for cold
      return { r: 0, g: Math.floor(intensity * 5 * 128), b: 255 };
    } else if (intensity < 0.8) {
      // Green for normal
      const t = (intensity - 0.2) / 0.6;
      return { r: 0, g: 128 + Math.floor(t * 127), b: 255 - Math.floor(t * 255) };
    } else {
      // Red for hot
      const t = (intensity - 0.8) / 0.2;
      return { r: Math.floor(t * 255), g: 255 - Math.floor(t * 255), b: 0 };
    }
  }

  /**
   * HSL to RGB conversion
   */
  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    const a = s * Math.min(l, 1 - l);
    
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color);
    };
    
    return { r: f(0), g: f(8), b: f(4) };
  }

  /**
   * Render thermal frame
   */
  renderFrame(frame: ThermalFrame, anomalies?: TemperatureAnomaly[]): void {
    if (this.isRendering) return;

    this.isRendering = true;
    this.currentFrame = frame;
    
    if (anomalies) {
      this.anomalies = anomalies;
    }

    try {
      // Clear canvases
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

      // Render thermal data
      this.renderThermalData(frame);

      // Render overlays
      this.renderOverlays();

      // Composite overlay onto main canvas
      this.ctx.globalAlpha = this.renderOptions.overlayOpacity;
      this.ctx.drawImage(this.overlayCanvas, 0, 0);
      this.ctx.globalAlpha = 1;

      // Render color bar if enabled
      if (this.renderOptions.showColorBar) {
        this.renderColorBar();
      }

      this.emit('frame-rendered', frame);

    } catch (error) {
      logger.error('Error rendering thermal frame', error);
      this.emit('render-error', error);
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Render thermal data as colored pixels
   */
  private renderThermalData(frame: ThermalFrame): void {
    const { width, height, temperatureData } = frame;
    const { min, max } = this.config.temperatureRange;
    
    // Create image data
    const imageData = this.ctx.createImageData(width, height);
    const data = imageData.data;

    // Apply contrast settings
    let adjustedMin = min;
    let adjustedMax = max;
    
    if (this.config.contrastSettings.autoAdjust) {
      const temps = Array.from(temperatureData).filter(t => t > -100 && t < 200);
      if (temps.length > 0) {
        adjustedMin = Math.min(...temps);
        adjustedMax = Math.max(...temps);
        
        // Add margin
        const range = adjustedMax - adjustedMin;
        const margin = range * 0.1;
        adjustedMin -= margin;
        adjustedMax += margin;
      }
    } else if (this.config.contrastSettings.manualMin !== undefined && this.config.contrastSettings.manualMax !== undefined) {
      adjustedMin = this.config.contrastSettings.manualMin;
      adjustedMax = this.config.contrastSettings.manualMax;
    }

    const tempRange = adjustedMax - adjustedMin;

    for (let i = 0; i < temperatureData.length; i++) {
      const temp = temperatureData[i];
      
      // Normalize temperature to 0-1 range
      let normalizedTemp = tempRange > 0 ? (temp - adjustedMin) / tempRange : 0;
      normalizedTemp = Math.max(0, Math.min(1, normalizedTemp));
      
      // Apply gamma correction
      if (this.config.contrastSettings.gamma !== 1.0) {
        normalizedTemp = Math.pow(normalizedTemp, 1.0 / this.config.contrastSettings.gamma);
      }
      
      // Get color from LUT
      const lutIndex = Math.floor(normalizedTemp * 255);
      const pixelIndex = i * 4;
      
      data[pixelIndex] = this.colorLUT[lutIndex * 4];     // Red
      data[pixelIndex + 1] = this.colorLUT[lutIndex * 4 + 1]; // Green
      data[pixelIndex + 2] = this.colorLUT[lutIndex * 4 + 2]; // Blue
      data[pixelIndex + 3] = 255; // Alpha
    }

    // Apply histogram equalization if enabled
    if (this.config.contrastSettings.histogramEqualization) {
      this.applyHistogramEqualization(imageData);
    }

    // Scale to canvas size
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);
    
    // Render scaled image
    this.ctx.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);

    // Apply edge enhancement if enabled
    if (this.config.contrastSettings.edgeEnhancement > 0) {
      this.applyEdgeEnhancement(this.config.contrastSettings.edgeEnhancement);
    }
  }

  /**
   * Apply histogram equalization
   */
  private applyHistogramEqualization(imageData: ImageData): void {
    const data = imageData.data;
    const histogram = new Array(256).fill(0);
    
    // Calculate histogram
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      histogram[gray]++;
    }

    // Calculate cumulative distribution
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // Normalize
    const pixelCount = imageData.width * imageData.height;
    const lookupTable = cdf.map(value => Math.round((value * 255) / pixelCount));

    // Apply equalization
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      const equalizedValue = lookupTable[gray];
      
      // Scale RGB channels proportionally
      const factor = equalizedValue / Math.max(1, gray);
      data[i] = Math.min(255, data[i] * factor);
      data[i + 1] = Math.min(255, data[i + 1] * factor);
      data[i + 2] = Math.min(255, data[i + 2] * factor);
    }
  }

  /**
   * Apply edge enhancement
   */
  private applyEdgeEnhancement(strength: number): void {
    // Simple unsharp mask filter
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Create edge-detected version
    const edges = new Uint8ClampedArray(data.length);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Sobel operator
        const gx = -data[((y-1) * width + (x-1)) * 4] + data[((y-1) * width + (x+1)) * 4] +
                   -2 * data[(y * width + (x-1)) * 4] + 2 * data[(y * width + (x+1)) * 4] +
                   -data[((y+1) * width + (x-1)) * 4] + data[((y+1) * width + (x+1)) * 4];
        
        const gy = -data[((y-1) * width + (x-1)) * 4] - 2 * data[((y-1) * width + x) * 4] - data[((y-1) * width + (x+1)) * 4] +
                   data[((y+1) * width + (x-1)) * 4] + 2 * data[((y+1) * width + x) * 4] + data[((y+1) * width + (x+1)) * 4];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[idx] = edges[idx + 1] = edges[idx + 2] = Math.min(255, magnitude);
        edges[idx + 3] = 255;
      }
    }

    // Blend with original
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] + edges[i] * strength);
      data[i + 1] = Math.min(255, data[i + 1] + edges[i + 1] * strength);
      data[i + 2] = Math.min(255, data[i + 2] + edges[i + 2] * strength);
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Render overlays (isotherms, measurements, alerts, etc.)
   */
  private renderOverlays(): void {
    // Render isotherms
    if (this.renderOptions.showIsotherms && this.config.isotherms.enabled) {
      this.renderIsotherms();
    }

    // Render measurement tools
    if (this.renderOptions.showMeasurements) {
      this.renderMeasurements();
    }

    // Render temperature anomalies
    if (this.renderOptions.showAlerts && this.anomalies.length > 0) {
      this.renderAnomalies();
    }

    // Render temperature values
    if (this.renderOptions.showTemperatureValues && this.currentFrame) {
      this.renderTemperatureValues();
    }

    // Render alert thresholds visualization
    if (this.renderOptions.showAlerts && this.config.alertThresholds.length > 0) {
      this.renderAlertThresholds();
    }
  }

  /**
   * Render isotherms (temperature contour lines)
   */
  private renderIsotherms(): void {
    if (!this.currentFrame) return;

    const { width, height, temperatureData } = this.currentFrame;
    const scaleX = this.canvas.width / width;
    const scaleY = this.canvas.height / height;

    for (const isotherm of this.config.isotherms.isotherms) {
      if (!isotherm.visible) continue;

      this.overlayCtx.strokeStyle = isotherm.color;
      this.overlayCtx.lineWidth = isotherm.thickness;
      this.overlayCtx.setLineDash(isotherm.style === 'dashed' ? [5, 5] : isotherm.style === 'dotted' ? [2, 2] : []);

      // Find contour lines for this temperature
      const contours = this.findContours(temperatureData, width, height, isotherm.temperature);

      for (const contour of contours) {
        if (contour.length < 2) continue;

        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(contour[0].x * scaleX, contour[0].y * scaleY);

        for (let i = 1; i < contour.length; i++) {
          this.overlayCtx.lineTo(contour[i].x * scaleX, contour[i].y * scaleY);
        }

        this.overlayCtx.stroke();
      }

      // Render labels if enabled
      if (this.config.isotherms.showLabels && isotherm.label) {
        this.overlayCtx.fillStyle = isotherm.color;
        this.overlayCtx.font = '12px Arial';
        this.overlayCtx.fillText(isotherm.label, 10, 30 + this.config.isotherms.isotherms.indexOf(isotherm) * 20);
      }
    }

    this.overlayCtx.setLineDash([]);
  }

  /**
   * Find contour lines for a specific temperature
   */
  private findContours(temperatureData: Float32Array, width: number, height: number, targetTemp: number): ThermalPoint[][] {
    const contours: ThermalPoint[][] = [];
    const visited = new Set<string>();

    // Simplified contour detection using marching squares
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        // Get 2x2 cell values
        const tl = temperatureData[y * width + x];
        const tr = temperatureData[y * width + x + 1];
        const bl = temperatureData[(y + 1) * width + x];
        const br = temperatureData[(y + 1) * width + x + 1];

        // Check if contour passes through this cell
        const minTemp = Math.min(tl, tr, bl, br);
        const maxTemp = Math.max(tl, tr, bl, br);

        if (targetTemp >= minTemp && targetTemp <= maxTemp) {
          const contour = this.traceContour(temperatureData, width, height, x, y, targetTemp, visited);
          if (contour.length > 3) {
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  }

  /**
   * Trace contour from starting point
   */
  private traceContour(
    temperatureData: Float32Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    targetTemp: number,
    visited: Set<string>
  ): ThermalPoint[] {
    const contour: ThermalPoint[] = [];
    
    // Simplified contour tracing
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let x = startX;
    let y = startY;
    let dir = 0;
    let steps = 0;
    const maxSteps = 1000;

    do {
      const key = `${x},${y}`;
      if (visited.has(key) || steps > maxSteps) break;
      
      visited.add(key);
      
      // Interpolate position along edge
      const temp = temperatureData[y * width + x];
      contour.push({ x: x + 0.5, y: y + 0.5, temperature: temp });

      // Find next direction
      let found = false;
      for (let i = 0; i < directions.length; i++) {
        const newDir = (dir + i) % directions.length;
        const dx = directions[newDir][0];
        const dy = directions[newDir][1];
        const newX = x + dx;
        const newY = y + dy;

        if (newX >= 0 && newX < width - 1 && newY >= 0 && newY < height - 1) {
          const newTemp = temperatureData[newY * width + newX];
          if (Math.abs(newTemp - targetTemp) < Math.abs(temp - targetTemp)) {
            x = newX;
            y = newY;
            dir = newDir;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
      steps++;
    } while (true);

    return contour;
  }

  /**
   * Render measurement tools
   */
  private renderMeasurements(): void {
    const scaleX = this.canvas.width / (this.currentFrame?.width || 1);
    const scaleY = this.canvas.height / (this.currentFrame?.height || 1);

    for (const tool of this.config.measurementTools) {
      if (!tool.visible) continue;

      this.overlayCtx.strokeStyle = tool.color;
      this.overlayCtx.fillStyle = tool.color;
      this.overlayCtx.lineWidth = 2;

      switch (tool.type) {
        case 'spot':
          this.renderSpotMeasurement(tool, scaleX, scaleY);
          break;
        case 'line':
          this.renderLineMeasurement(tool, scaleX, scaleY);
          break;
        case 'area':
          this.renderAreaMeasurement(tool, scaleX, scaleY);
          break;
        case 'circle':
          this.renderCircleMeasurement(tool, scaleX, scaleY);
          break;
      }
    }
  }

  /**
   * Render spot temperature measurement
   */
  private renderSpotMeasurement(tool: MeasurementTool, scaleX: number, scaleY: number): void {
    if (tool.points.length === 0) return;

    const point = tool.points[0];
    const x = point.x * scaleX;
    const y = point.y * scaleY;

    // Draw crosshair
    this.overlayCtx.beginPath();
    this.overlayCtx.moveTo(x - 10, y);
    this.overlayCtx.lineTo(x + 10, y);
    this.overlayCtx.moveTo(x, y - 10);
    this.overlayCtx.lineTo(x, y + 10);
    this.overlayCtx.stroke();

    // Draw temperature label
    const temp = point.temperature.toFixed(1);
    this.overlayCtx.font = '12px Arial';
    this.overlayCtx.fillStyle = tool.color;
    this.overlayCtx.fillText(`${temp}°C`, x + 15, y - 5);
    this.overlayCtx.fillText(tool.label, x + 15, y + 10);
  }

  /**
   * Render line temperature measurement
   */
  private renderLineMeasurement(tool: MeasurementTool, scaleX: number, scaleY: number): void {
    if (tool.points.length < 2) return;

    const start = tool.points[0];
    const end = tool.points[1];

    this.overlayCtx.beginPath();
    this.overlayCtx.moveTo(start.x * scaleX, start.y * scaleY);
    this.overlayCtx.lineTo(end.x * scaleX, end.y * scaleY);
    this.overlayCtx.stroke();

    // Draw temperature profile
    if (tool.temperature) {
      const midX = (start.x + end.x) / 2 * scaleX;
      const midY = (start.y + end.y) / 2 * scaleY;
      
      this.overlayCtx.font = '12px Arial';
      this.overlayCtx.fillStyle = tool.color;
      this.overlayCtx.fillText(`${tool.temperature.min.toFixed(1)}°C - ${tool.temperature.max.toFixed(1)}°C`, midX, midY - 5);
      this.overlayCtx.fillText(tool.label, midX, midY + 10);
    }
  }

  /**
   * Render area temperature measurement
   */
  private renderAreaMeasurement(tool: MeasurementTool, scaleX: number, scaleY: number): void {
    if (tool.points.length < 3) return;

    // Draw polygon
    this.overlayCtx.beginPath();
    this.overlayCtx.moveTo(tool.points[0].x * scaleX, tool.points[0].y * scaleY);
    
    for (let i = 1; i < tool.points.length; i++) {
      this.overlayCtx.lineTo(tool.points[i].x * scaleX, tool.points[i].y * scaleY);
    }
    
    this.overlayCtx.closePath();
    this.overlayCtx.stroke();

    // Fill with semi-transparent color
    this.overlayCtx.fillStyle = tool.color + '30';
    this.overlayCtx.fill();

    // Draw statistics
    if (tool.temperature) {
      const centerX = tool.points.reduce((sum, p) => sum + p.x, 0) / tool.points.length * scaleX;
      const centerY = tool.points.reduce((sum, p) => sum + p.y, 0) / tool.points.length * scaleY;
      
      this.overlayCtx.font = '12px Arial';
      this.overlayCtx.fillStyle = tool.color;
      this.overlayCtx.fillText(`Avg: ${tool.temperature.mean.toFixed(1)}°C`, centerX, centerY - 15);
      this.overlayCtx.fillText(`Range: ${tool.temperature.range.toFixed(1)}°C`, centerX, centerY);
      this.overlayCtx.fillText(tool.label, centerX, centerY + 15);
    }
  }

  /**
   * Render circle temperature measurement
   */
  private renderCircleMeasurement(tool: MeasurementTool, scaleX: number, scaleY: number): void {
    if (tool.points.length < 2) return;

    const center = tool.points[0];
    const edge = tool.points[1];
    const radius = Math.sqrt(
      Math.pow((edge.x - center.x) * scaleX, 2) + 
      Math.pow((edge.y - center.y) * scaleY, 2)
    );

    this.overlayCtx.beginPath();
    this.overlayCtx.arc(center.x * scaleX, center.y * scaleY, radius, 0, 2 * Math.PI);
    this.overlayCtx.stroke();

    // Fill with semi-transparent color
    this.overlayCtx.fillStyle = tool.color + '30';
    this.overlayCtx.fill();

    // Draw statistics
    if (tool.temperature) {
      this.overlayCtx.font = '12px Arial';
      this.overlayCtx.fillStyle = tool.color;
      this.overlayCtx.fillText(`Avg: ${tool.temperature.mean.toFixed(1)}°C`, center.x * scaleX + radius + 5, center.y * scaleY - 10);
      this.overlayCtx.fillText(`Max: ${tool.temperature.max.toFixed(1)}°C`, center.x * scaleX + radius + 5, center.y * scaleY + 5);
      this.overlayCtx.fillText(tool.label, center.x * scaleX + radius + 5, center.y * scaleY + 20);
    }
  }

  /**
   * Render temperature anomalies
   */
  private renderAnomalies(): void {
    if (!this.currentFrame) return;

    const scaleX = this.canvas.width / this.currentFrame.width;
    const scaleY = this.canvas.height / this.currentFrame.height;

    for (const anomaly of this.anomalies) {
      this.overlayCtx.strokeStyle = this.getAnomalyColor(anomaly.type);
      this.overlayCtx.fillStyle = this.getAnomalyColor(anomaly.type) + '40';
      this.overlayCtx.lineWidth = 2;

      // Draw bounding box
      const bbox = anomaly.area.boundingBox;
      this.overlayCtx.strokeRect(
        bbox.x * scaleX,
        bbox.y * scaleY,
        bbox.width * scaleX,
        bbox.height * scaleY
      );

      // Draw contour
      if (anomaly.area.contour.length > 0) {
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(anomaly.area.contour[0].x * scaleX, anomaly.area.contour[0].y * scaleY);
        
        for (let i = 1; i < anomaly.area.contour.length; i++) {
          this.overlayCtx.lineTo(anomaly.area.contour[i].x * scaleX, anomaly.area.contour[i].y * scaleY);
        }
        
        this.overlayCtx.closePath();
        this.overlayCtx.fill();
        this.overlayCtx.stroke();
      }

      // Draw label
      this.overlayCtx.font = '12px Arial';
      this.overlayCtx.fillStyle = this.getAnomalyColor(anomaly.type);
      this.overlayCtx.fillText(
        `${anomaly.type}: ${anomaly.temperature.mean.toFixed(1)}°C`,
        (bbox.x + bbox.width) * scaleX + 5,
        bbox.y * scaleY + 15
      );
      this.overlayCtx.fillText(
        `Confidence: ${(anomaly.confidence * 100).toFixed(0)}%`,
        (bbox.x + bbox.width) * scaleX + 5,
        bbox.y * scaleY + 30
      );
    }
  }

  /**
   * Get color for anomaly type
   */
  private getAnomalyColor(type: string): string {
    switch (type) {
      case 'hot_spot': return '#ff4000';
      case 'cold_spot': return '#0080ff';
      case 'temperature_gradient': return '#ff8000';
      case 'sudden_change': return '#ff0080';
      case 'moving_heat_source': return '#80ff00';
      case 'phantom_signature': return '#8000ff';
      case 'thermal_shadow': return '#004080';
      case 'heat_plume': return '#ff8040';
      default: return '#ffffff';
    }
  }

  /**
   * Render temperature values at cursor position or grid
   */
  private renderTemperatureValues(): void {
    if (!this.currentFrame) return;

    // Render temperature grid (simplified)
    const { width, height, temperatureData } = this.currentFrame;
    const scaleX = this.canvas.width / width;
    const scaleY = this.canvas.height / height;
    const step = 20; // Show every 20th pixel

    this.overlayCtx.font = '10px Arial';
    this.overlayCtx.fillStyle = '#ffffff';
    this.overlayCtx.strokeStyle = '#000000';
    this.overlayCtx.lineWidth = 1;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const temp = temperatureData[y * width + x];
        const screenX = x * scaleX;
        const screenY = y * scaleY;
        const text = temp.toFixed(1);

        // Draw text with outline for visibility
        this.overlayCtx.strokeText(text, screenX, screenY);
        this.overlayCtx.fillText(text, screenX, screenY);
      }
    }
  }

  /**
   * Render alert threshold indicators
   */
  private renderAlertThresholds(): void {
    // Draw threshold indicators on color bar
    // This would typically be rendered alongside the color bar
  }

  /**
   * Render color bar/legend
   */
  private renderColorBar(): void {
    const barWidth = 20;
    const barHeight = this.canvas.height * 0.6;
    const barX = this.canvas.width - barWidth - 10;
    const barY = (this.canvas.height - barHeight) / 2;

    // Create gradient
    const gradient = this.ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
    
    for (let i = 0; i <= 10; i++) {
      const intensity = i / 10;
      const color = this.getColorForIntensity(intensity, this.config.palette);
      gradient.addColorStop(intensity, `rgb(${color.r},${color.g},${color.b})`);
    }

    // Draw color bar
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Draw temperature labels
    const { min, max } = this.config.temperatureRange;
    const steps = 5;
    
    this.ctx.font = '12px Arial';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'left';

    for (let i = 0; i <= steps; i++) {
      const temp = min + (max - min) * i / steps;
      const y = barY + barHeight * (1 - i / steps);
      
      this.ctx.fillText(temp.toFixed(1) + '°C', barX + barWidth + 5, y + 4);
    }
  }

  /**
   * Update visualization configuration
   */
  updateConfig(newConfig: Partial<VisualizationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Regenerate color LUT if palette changed
    if (newConfig.palette) {
      this.generateColorLUT();
    }

    this.emit('config-updated', this.config);
  }

  /**
   * Update render options
   */
  updateRenderOptions(options: Partial<RenderOptions>): void {
    this.renderOptions = { ...this.renderOptions, ...options };
    this.emit('render-options-updated', this.renderOptions);
  }

  /**
   * Add measurement tool
   */
  addMeasurementTool(tool: MeasurementTool): void {
    this.config.measurementTools.push(tool);
    this.emit('measurement-tool-added', tool);
  }

  /**
   * Remove measurement tool
   */
  removeMeasurementTool(id: string): boolean {
    const index = this.config.measurementTools.findIndex(t => t.id === id);
    if (index !== -1) {
      const removed = this.config.measurementTools.splice(index, 1)[0];
      this.emit('measurement-tool-removed', removed);
      return true;
    }
    return false;
  }

  /**
   * Take screenshot
   */
  takeScreenshot(): string {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Get current configuration
   */
  getConfig(): VisualizationConfig {
    return { ...this.config };
  }

  /**
   * Get render options
   */
  getRenderOptions(): RenderOptions {
    return { ...this.renderOptions };
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.overlayCanvas.width = width;
    this.overlayCanvas.height = height;
    this.setupCanvas();
  }

  /**
   * Clear visualization
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    this.currentFrame = null;
    this.anomalies = [];
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.clear();
    this.removeAllListeners();
  }
}