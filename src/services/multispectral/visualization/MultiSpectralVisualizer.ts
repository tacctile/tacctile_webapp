import { EventEmitter } from 'events';
import {
  ComparisonVisualization,
  ComparisonMode,
  ComparisonSettings,
  SpectralFrame,
  SpectralBand,
  SPECTRAL_BAND_INFO
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('MultiSpectralVisualizer');

export class MultiSpectralVisualizer extends EventEmitter {
  private activeVisualizations: Map<string, ComparisonVisualization>;
  private canvasCache: Map<string, HTMLCanvasElement>;
  private visualizationCounter: number;
  private renderingQueue: RenderTask[];
  private isRendering: boolean;

  constructor() {
    super();
    this.activeVisualizations = new Map();
    this.canvasCache = new Map();
    this.visualizationCounter = 0;
    this.renderingQueue = [];
    this.isRendering = false;
  }

  async createComparison(frames: SpectralFrame[], mode: ComparisonMode, settings?: Partial<ComparisonSettings>): Promise<ComparisonVisualization> {
    if (frames.length < 2) {
      throw new Error('At least 2 frames required for comparison');
    }

    const visualizationId = `vis_${++this.visualizationCounter}_${Date.now()}`;
    
    const defaultSettings: ComparisonSettings = {
      opacity: 0.5,
      colorMapping: this.getDefaultColorMapping(frames),
      normalization: 'minmax',
      enhancement: {
        contrast: 1.0,
        brightness: 0.0,
        gamma: 1.0
      },
      falseColor: false,
      interpolation: 'bilinear'
    };

    const comparisonSettings = { ...defaultSettings, ...settings };
    
    // Create output canvas
    const outputCanvas = this.createCanvas(frames[0].width, frames[0].height);
    
    const visualization: ComparisonVisualization = {
      id: visualizationId,
      mode,
      frames: [...frames],
      settings: comparisonSettings,
      outputCanvas
    };

    this.activeVisualizations.set(visualizationId, visualization);
    
    // Render the comparison
    await this.renderComparison(visualization);
    
    this.emit('comparison-created', visualization);
    logger.info(`Created ${mode} comparison with ${frames.length} frames`);
    
    return visualization;
  }

  private getDefaultColorMapping(frames: SpectralFrame[]): { [key in SpectralBand]?: string } {
    const colorMap: { [key in SpectralBand]?: string } = {};
    
    for (const frame of frames) {
      switch (frame.spectralBand) {
        case SpectralBand.UV_A:
        case SpectralBand.UV_B:
        case SpectralBand.UV_C:
          colorMap[frame.spectralBand] = '#8A2BE2'; // Blue-violet for UV
          break;
        case SpectralBand.BLUE:
          colorMap[frame.spectralBand] = '#0000FF';
          break;
        case SpectralBand.GREEN:
          colorMap[frame.spectralBand] = '#00FF00';
          break;
        case SpectralBand.RED:
          colorMap[frame.spectralBand] = '#FF0000';
          break;
        case SpectralBand.NIR:
          colorMap[frame.spectralBand] = '#FF4500'; // Orange-red for NIR
          break;
        case SpectralBand.SWIR:
          colorMap[frame.spectralBand] = '#FF6347'; // Tomato for SWIR
          break;
        case SpectralBand.MWIR:
        case SpectralBand.LWIR:
          colorMap[frame.spectralBand] = '#FFD700'; // Gold for thermal
          break;
        case SpectralBand.VISIBLE:
        case SpectralBand.FULL_SPECTRUM:
        default:
          colorMap[frame.spectralBand] = '#FFFFFF'; // White for visible/full spectrum
          break;
      }
    }
    
    return colorMap;
  }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private async renderComparison(visualization: ComparisonVisualization): Promise<void> {
    const renderTask: RenderTask = {
      visualization,
      priority: 1,
      timestamp: Date.now()
    };

    this.renderingQueue.push(renderTask);
    this.processRenderQueue();
  }

  private async processRenderQueue(): Promise<void> {
    if (this.isRendering || this.renderingQueue.length === 0) {
      return;
    }

    this.isRendering = true;
    
    try {
      // Sort queue by priority
      this.renderingQueue.sort((a, b) => b.priority - a.priority);
      
      while (this.renderingQueue.length > 0) {
        const task = this.renderingQueue.shift()!;
        await this.executeRenderTask(task);
      }
    } finally {
      this.isRendering = false;
    }
  }

  private async executeRenderTask(task: RenderTask): Promise<void> {
    const { visualization } = task;
    
    try {
      this.emit('render-started', { id: visualization.id, mode: visualization.mode });
      
      switch (visualization.mode) {
        case ComparisonMode.SIDE_BY_SIDE:
          await this.renderSideBySide(visualization);
          break;
        case ComparisonMode.OVERLAY:
          await this.renderOverlay(visualization);
          break;
        case ComparisonMode.DIFFERENCE:
          await this.renderDifference(visualization);
          break;
        case ComparisonMode.RATIO:
          await this.renderRatio(visualization);
          break;
        case ComparisonMode.COMPOSITE:
          await this.renderComposite(visualization);
          break;
        case ComparisonMode.ANIMATION:
          await this.renderAnimation(visualization);
          break;
        case ComparisonMode.SPLIT_VIEW:
          await this.renderSplitView(visualization);
          break;
        default:
          throw new Error(`Unsupported comparison mode: ${visualization.mode}`);
      }
      
      this.emit('render-completed', { 
        id: visualization.id, 
        mode: visualization.mode,
        canvas: visualization.outputCanvas 
      });
      
    } catch (error) {
      this.emit('render-failed', { id: visualization.id, error });
      logger.error(`Render failed for visualization ${visualization.id}:`, error);
    }
  }

  private async renderSideBySide(visualization: ComparisonVisualization): Promise<void> {
    const canvas = visualization.outputCanvas!;
    const ctx = canvas.getContext('2d')!;
    const frames = visualization.frames;
    
    // Calculate layout
    const frameWidth = Math.floor(canvas.width / frames.length);
    const frameHeight = canvas.height;
    
    // Resize canvas to fit all frames
    canvas.width = frameWidth * frames.length;
    canvas.height = frameHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Render each frame side by side
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const x = i * frameWidth;
      
      // Create temporary canvas for this frame
      const tempCanvas = this.createCanvas(frame.width, frame.height);
      await this.renderSingleFrame(tempCanvas, frame, visualization.settings);
      
      // Draw to main canvas with scaling
      ctx.drawImage(tempCanvas, x, 0, frameWidth, frameHeight);
      
      // Add band label
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText(frame.spectralBand.toUpperCase(), x + 10, 25);
      
      // Add frame border
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, 0, frameWidth, frameHeight);
    }
  }

  private async renderOverlay(visualization: ComparisonVisualization): Promise<void> {
    const canvas = visualization.outputCanvas!;
    const ctx = canvas.getContext('2d')!;
    const frames = visualization.frames;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Render base frame first
    await this.renderSingleFrame(canvas, frames[0], visualization.settings);
    
    // Overlay additional frames with opacity blending
    for (let i = 1; i < frames.length; i++) {
      const frame = frames[i];
      const tempCanvas = this.createCanvas(frame.width, frame.height);
      
      // Render frame to temporary canvas
      await this.renderSingleFrame(tempCanvas, frame, visualization.settings);
      
      // Set blend mode and opacity
      ctx.globalAlpha = visualization.settings.opacity;
      ctx.globalCompositeOperation = 'multiply';
      
      // Draw overlay
      ctx.drawImage(tempCanvas, 0, 0);
    }
    
    // Reset context
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }

  private async renderDifference(visualization: ComparisonVisualization): Promise<void> {
    if (visualization.frames.length < 2) {
      throw new Error('Difference mode requires at least 2 frames');
    }

    const canvas = visualization.outputCanvas!;
    const ctx = canvas.getContext('2d')!;
    const frame1 = visualization.frames[0];
    const frame2 = visualization.frames[1];
    
    if (frame1.width !== frame2.width || frame1.height !== frame2.height) {
      throw new Error('Frames must have same dimensions for difference calculation');
    }

    // Calculate pixel-wise difference
    const width = frame1.width;
    const height = frame1.height;
    const imageData = ctx.createImageData(width, height);
    
    const data1 = await this.getNormalizedFrameData(frame1, visualization.settings);
    const data2 = await this.getNormalizedFrameData(frame2, visualization.settings);
    
    for (let i = 0; i < width * height; i++) {
      const diff = Math.abs(data1[i] - data2[i]);
      const pixelIndex = i * 4;
      
      // Use false color for difference visualization
      const color = this.getDifferenceColor(diff);
      imageData.data[pixelIndex] = color.r;
      imageData.data[pixelIndex + 1] = color.g;
      imageData.data[pixelIndex + 2] = color.b;
      imageData.data[pixelIndex + 3] = 255;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
    
    // Add difference scale/legend
    this.drawDifferenceScale(ctx, canvas.width, canvas.height);
  }

  private async renderRatio(visualization: ComparisonVisualization): Promise<void> {
    if (visualization.frames.length < 2) {
      throw new Error('Ratio mode requires at least 2 frames');
    }

    const canvas = visualization.outputCanvas!;
    const ctx = canvas.getContext('2d')!;
    const frame1 = visualization.frames[0]; // Numerator
    const frame2 = visualization.frames[1]; // Denominator
    
    // Calculate pixel-wise ratio
    const width = frame1.width;
    const height = frame1.height;
    const imageData = ctx.createImageData(width, height);
    
    const data1 = await this.getNormalizedFrameData(frame1, visualization.settings);
    const data2 = await this.getNormalizedFrameData(frame2, visualization.settings);
    
    let minRatio = Infinity;
    let maxRatio = -Infinity;
    const ratios: number[] = [];
    
    // Calculate ratios and find range
    for (let i = 0; i < width * height; i++) {
      const ratio = data2[i] > 0.01 ? data1[i] / data2[i] : 0;
      ratios[i] = ratio;
      minRatio = Math.min(minRatio, ratio);
      maxRatio = Math.max(maxRatio, ratio);
    }
    
    // Normalize and colorize ratios
    const ratioRange = maxRatio - minRatio;
    for (let i = 0; i < width * height; i++) {
      const normalizedRatio = (ratios[i] - minRatio) / ratioRange;
      const pixelIndex = i * 4;
      
      const color = this.getRatioColor(normalizedRatio);
      imageData.data[pixelIndex] = color.r;
      imageData.data[pixelIndex + 1] = color.g;
      imageData.data[pixelIndex + 2] = color.b;
      imageData.data[pixelIndex + 3] = 255;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
  }

  private async renderComposite(visualization: ComparisonVisualization): Promise<void> {
    const canvas = visualization.outputCanvas!;
    const ctx = canvas.getContext('2d')!;
    const frames = visualization.frames;
    
    if (frames.length < 3) {
      // For less than 3 frames, fall back to overlay mode
      await this.renderOverlay(visualization);
      return;
    }

    const width = frames[0].width;
    const height = frames[0].height;
    const imageData = ctx.createImageData(width, height);
    
    // Create RGB composite (first 3 frames map to R, G, B channels)
    const redData = await this.getNormalizedFrameData(frames[0], visualization.settings);
    const greenData = await this.getNormalizedFrameData(frames[1], visualization.settings);
    const blueData = await this.getNormalizedFrameData(frames[2], visualization.settings);
    
    for (let i = 0; i < width * height; i++) {
      const pixelIndex = i * 4;
      
      imageData.data[pixelIndex] = Math.floor(redData[i] * 255);     // R
      imageData.data[pixelIndex + 1] = Math.floor(greenData[i] * 255); // G
      imageData.data[pixelIndex + 2] = Math.floor(blueData[i] * 255);  // B
      imageData.data[pixelIndex + 3] = 255;                            // A
    }
    
    // Apply enhancement
    this.applyImageEnhancements(imageData, visualization.settings.enhancement);
    
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
  }

  private async renderAnimation(visualization: ComparisonVisualization): Promise<void> {
    // For animation, we prepare the canvas for the first frame
    // The actual animation would be controlled by external timing
    await this.renderSingleFrame(visualization.outputCanvas!, visualization.frames[0], visualization.settings);
    
    // Store animation data for external control
    (visualization as any).animationFrames = visualization.frames;
    (visualization as any).currentAnimationIndex = 0;
  }

  private async renderSplitView(visualization: ComparisonVisualization): Promise<void> {
    if (visualization.frames.length < 2) {
      throw new Error('Split view requires at least 2 frames');
    }

    const canvas = visualization.outputCanvas!;
    const ctx = canvas.getContext('2d')!;
    const frame1 = visualization.frames[0];
    const frame2 = visualization.frames[1];
    
    const width = frame1.width;
    const height = frame1.height;
    const splitPosition = width / 2;
    
    // Clear canvas
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    
    // Render left half with first frame
    const leftCanvas = this.createCanvas(width, height);
    await this.renderSingleFrame(leftCanvas, frame1, visualization.settings);
    ctx.drawImage(leftCanvas, 0, 0, splitPosition, height, 0, 0, splitPosition, height);
    
    // Render right half with second frame
    const rightCanvas = this.createCanvas(width, height);
    await this.renderSingleFrame(rightCanvas, frame2, visualization.settings);
    ctx.drawImage(rightCanvas, splitPosition, 0, width - splitPosition, height, splitPosition, 0, width - splitPosition, height);
    
    // Draw split line
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitPosition, 0);
    ctx.lineTo(splitPosition, height);
    ctx.stroke();
    
    // Add labels
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(frame1.spectralBand.toUpperCase(), 10, 25);
    ctx.fillText(frame2.spectralBand.toUpperCase(), splitPosition + 10, 25);
  }

  private async renderSingleFrame(canvas: HTMLCanvasElement, frame: SpectralFrame, settings: ComparisonSettings): Promise<void> {
    const ctx = canvas.getContext('2d')!;
    
    // Use existing ImageData if available, otherwise create from raw data
    let imageData: ImageData;
    
    if (frame.imageData && !settings.falseColor) {
      // Use provided ImageData
      imageData = new ImageData(
        new Uint8ClampedArray(frame.imageData.data),
        frame.imageData.width,
        frame.imageData.height
      );
    } else if (frame.rawData) {
      // Create ImageData from raw data
      imageData = ctx.createImageData(frame.width, frame.height);
      const normalizedData = await this.getNormalizedFrameData(frame, settings);
      
      if (settings.falseColor) {
        // Apply false color mapping
        const color = settings.colorMapping[frame.spectralBand] || '#FFFFFF';
        const rgb = this.hexToRgb(color);
        
        for (let i = 0; i < normalizedData.length; i++) {
          const pixelIndex = i * 4;
          const intensity = normalizedData[i];
          
          imageData.data[pixelIndex] = Math.floor(rgb.r * intensity);     // R
          imageData.data[pixelIndex + 1] = Math.floor(rgb.g * intensity); // G
          imageData.data[pixelIndex + 2] = Math.floor(rgb.b * intensity); // B
          imageData.data[pixelIndex + 3] = 255;                           // A
        }
      } else {
        // Grayscale mapping
        for (let i = 0; i < normalizedData.length; i++) {
          const pixelIndex = i * 4;
          const value = Math.floor(normalizedData[i] * 255);
          
          imageData.data[pixelIndex] = value;     // R
          imageData.data[pixelIndex + 1] = value; // G
          imageData.data[pixelIndex + 2] = value; // B
          imageData.data[pixelIndex + 3] = 255;   // A
        }
      }
    } else {
      throw new Error('Frame missing both imageData and rawData');
    }
    
    // Apply enhancements
    this.applyImageEnhancements(imageData, settings.enhancement);
    
    // Draw to canvas
    canvas.width = frame.width;
    canvas.height = frame.height;
    ctx.putImageData(imageData, 0, 0);
  }

  private async getNormalizedFrameData(frame: SpectralFrame, settings: ComparisonSettings): Promise<number[]> {
    if (!frame.rawData) {
      throw new Error('Frame missing raw data for normalization');
    }

    const data = Array.from(frame.rawData);
    
    switch (settings.normalization) {
      case 'minmax':
        return this.normalizeMinMax(data);
      case 'histogram':
        return this.normalizeHistogram(data);
      case 'zscore':
        return this.normalizeZScore(data);
      case 'none':
      default:
        return data.map(v => v / 4095); // Assume 12-bit data
    }
  }

  private normalizeMinMax(data: number[]): number[] {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    
    if (range === 0) return data.map(() => 0);
    
    return data.map(v => (v - min) / range);
  }

  private normalizeHistogram(data: number[]): number[] {
    // Histogram equalization
    const histogram = new Array(256).fill(0);
    const normalized = data.map(v => Math.floor(v / 4095 * 255));
    
    // Build histogram
    for (const value of normalized) {
      histogram[value]++;
    }
    
    // Calculate CDF
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }
    
    // Normalize CDF
    const totalPixels = data.length;
    return data.map(v => {
      const binIndex = Math.floor(v / 4095 * 255);
      return cdf[binIndex] / totalPixels;
    });
  }

  private normalizeZScore(data: number[]): number[] {
    const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
    const variance = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return data.map(() => 0.5);
    
    return data.map(v => Math.max(0, Math.min(1, (v - mean) / (3 * stdDev) + 0.5)));
  }

  private applyImageEnhancements(imageData: ImageData, enhancement: ComparisonSettings['enhancement']): void {
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply gamma correction
      let r = Math.pow(data[i] / 255, 1 / enhancement.gamma) * 255;
      let g = Math.pow(data[i + 1] / 255, 1 / enhancement.gamma) * 255;
      let b = Math.pow(data[i + 2] / 255, 1 / enhancement.gamma) * 255;
      
      // Apply contrast and brightness
      r = (r - 128) * enhancement.contrast + 128 + enhancement.brightness;
      g = (g - 128) * enhancement.contrast + 128 + enhancement.brightness;
      b = (b - 128) * enhancement.contrast + 128 + enhancement.brightness;
      
      // Clamp values
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
  }

  private getDifferenceColor(difference: number): { r: number; g: number; b: number } {
    // Use heat map colors for difference visualization
    const intensity = Math.min(1, difference * 2); // Scale difference
    
    if (intensity < 0.33) {
      // Blue to cyan
      const t = intensity * 3;
      return {
        r: 0,
        g: Math.floor(t * 255),
        b: 255
      };
    } else if (intensity < 0.67) {
      // Cyan to yellow
      const t = (intensity - 0.33) * 3;
      return {
        r: Math.floor(t * 255),
        g: 255,
        b: Math.floor((1 - t) * 255)
      };
    } else {
      // Yellow to red
      const t = (intensity - 0.67) * 3;
      return {
        r: 255,
        g: Math.floor((1 - t) * 255),
        b: 0
      };
    }
  }

  private getRatioColor(ratio: number): { r: number; g: number; b: number } {
    // Use diverging color map for ratio visualization
    if (ratio < 0.5) {
      // Blue for low ratios
      const intensity = ratio * 2;
      return {
        r: Math.floor((1 - intensity) * 255),
        g: Math.floor((1 - intensity) * 255),
        b: 255
      };
    } else {
      // Red for high ratios
      const intensity = (ratio - 0.5) * 2;
      return {
        r: 255,
        g: Math.floor((1 - intensity) * 255),
        b: Math.floor((1 - intensity) * 255)
      };
    }
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  private drawDifferenceScale(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    const scaleWidth = 20;
    const scaleHeight = 200;
    const x = canvasWidth - scaleWidth - 20;
    const y = 20;
    
    // Draw scale bar
    for (let i = 0; i < scaleHeight; i++) {
      const intensity = i / scaleHeight;
      const color = this.getDifferenceColor(intensity);
      
      ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      ctx.fillRect(x, y + scaleHeight - i, scaleWidth, 1);
    }
    
    // Draw scale border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, scaleWidth, scaleHeight);
    
    // Add labels
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText('High', x + scaleWidth + 5, y + 15);
    ctx.fillText('Low', x + scaleWidth + 5, y + scaleHeight);
  }

  async updateComparison(visualizationId: string, settings: Partial<ComparisonSettings>): Promise<boolean> {
    const visualization = this.activeVisualizations.get(visualizationId);
    if (!visualization) {
      return false;
    }

    // Update settings
    visualization.settings = { ...visualization.settings, ...settings };
    
    // Re-render with new settings
    await this.renderComparison(visualization);
    
    this.emit('comparison-updated', visualization);
    return true;
  }

  async changeComparisonMode(visualizationId: string, mode: ComparisonMode): Promise<boolean> {
    const visualization = this.activeVisualizations.get(visualizationId);
    if (!visualization) {
      return false;
    }

    visualization.mode = mode;
    await this.renderComparison(visualization);
    
    this.emit('comparison-mode-changed', { id: visualizationId, mode });
    return true;
  }

  getVisualization(visualizationId: string): ComparisonVisualization | null {
    return this.activeVisualizations.get(visualizationId) || null;
  }

  getActiveVisualizations(): ComparisonVisualization[] {
    return Array.from(this.activeVisualizations.values());
  }

  removeVisualization(visualizationId: string): boolean {
    const removed = this.activeVisualizations.delete(visualizationId);
    if (removed) {
      this.canvasCache.delete(visualizationId);
      this.emit('visualization-removed', visualizationId);
    }
    return removed;
  }

  getSupportedModes(): ComparisonMode[] {
    return Object.values(ComparisonMode);
  }

  async exportVisualization(visualizationId: string, format: 'png' | 'jpeg' | 'webp' = 'png'): Promise<Blob | null> {
    const visualization = this.activeVisualizations.get(visualizationId);
    if (!visualization?.outputCanvas) {
      return null;
    }

    return new Promise((resolve) => {
      visualization.outputCanvas!.toBlob((blob) => {
        resolve(blob);
      }, `image/${format}`);
    });
  }

  destroy(): void {
    this.activeVisualizations.clear();
    this.canvasCache.clear();
    this.renderingQueue = [];
    this.isRendering = false;
    this.removeAllListeners();
  }
}

// Supporting interfaces
interface RenderTask {
  visualization: ComparisonVisualization;
  priority: number;
  timestamp: number;
}