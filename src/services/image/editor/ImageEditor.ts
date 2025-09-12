/**
 * Core Image Editor
 * Non-destructive image editing with WebGL acceleration
 */

import { EventEmitter } from 'events';
import { WebGLRenderer } from './WebGLRenderer';
import { LayerStack } from './LayerStack';
import { HistogramAnalyzer } from '../analysis/HistogramAnalyzer';
import { AnomalyDetector } from '../analysis/AnomalyDetector';
import { FilterPipeline } from './FilterPipeline';
import { 
  EditorConfig, 
  EditorState, 
  ImageLayer,
  EditOperation,
  ImageAdjustments,
  ExportOptions
} from '../types';
import { logger } from '../../../utils/logger';

export class ImageEditor extends EventEmitter {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private glRenderer: WebGLRenderer;
  private layerStack: LayerStack;
  private histogramAnalyzer: HistogramAnalyzer;
  private anomalyDetector: AnomalyDetector;
  private filterPipeline: FilterPipeline;
  
  private config: EditorConfig;
  private state: EditorState;
  private history: EditOperation[] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;
  
  private originalImage: ImageData | null = null;
  private currentImage: ImageData | null = null;
  private adjustments: ImageAdjustments;

  constructor(canvas: HTMLCanvasElement, config?: Partial<EditorConfig>) {
    super();
    
    this.canvas = canvas;
    this.context = canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: true
    })!;
    
    this.config = {
      useWebGL: true,
      maxTextureSize: 4096,
      preserveOriginal: true,
      autoSave: false,
      ...config
    };
    
    this.state = {
      isLoading: false,
      hasChanges: false,
      currentTool: null,
      zoom: 1,
      panX: 0,
      panY: 0
    };
    
    this.adjustments = this.getDefaultAdjustments();
    this.initialize();
  }

  /**
   * Initialize editor components
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize WebGL renderer if enabled
      if (this.config.useWebGL) {
        this.glRenderer = new WebGLRenderer(this.canvas);
        await this.glRenderer.initialize();
      }
      
      // Initialize components
      this.layerStack = new LayerStack();
      this.histogramAnalyzer = new HistogramAnalyzer();
      this.anomalyDetector = new AnomalyDetector();
      this.filterPipeline = new FilterPipeline(this.glRenderer);
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.emit('editorReady');
      logger.info('Image editor initialized', { 
        useWebGL: this.config.useWebGL,
        canvas: { width: this.canvas.width, height: this.canvas.height }
      });
    } catch (error) {
      logger.error('Failed to initialize image editor', error);
      this.emit('editorError', error);
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Layer events
    this.layerStack.on('layerAdded', (layer) => {
      this.emit('layerAdded', layer);
      this.markAsChanged();
    });
    
    this.layerStack.on('layerRemoved', (layer) => {
      this.emit('layerRemoved', layer);
      this.markAsChanged();
    });
    
    this.layerStack.on('layerUpdated', (layer) => {
      this.emit('layerUpdated', layer);
      this.markAsChanged();
    });
  }

  /**
   * Load image from various sources
   */
  async loadImage(source: File | Blob | string | ImageData): Promise<void> {
    this.state.isLoading = true;
    this.emit('loadingStart');
    
    try {
      let imageData: ImageData;
      
      if (source instanceof ImageData) {
        imageData = source;
      } else if (source instanceof File || source instanceof Blob) {
        imageData = await this.loadFromBlob(source);
      } else if (typeof source === 'string') {
        imageData = await this.loadFromURL(source);
      } else {
        throw new Error('Invalid image source');
      }
      
      // Store original
      if (this.config.preserveOriginal) {
        this.originalImage = new ImageData(
          new Uint8ClampedArray(imageData.data),
          imageData.width,
          imageData.height
        );
      }
      
      this.currentImage = imageData;
      
      // Resize canvas to match image
      this.canvas.width = imageData.width;
      this.canvas.height = imageData.height;
      
      // Create base layer
      const baseLayer = this.layerStack.createLayer('Background', imageData);
      this.layerStack.setActiveLayer(baseLayer.id);
      
      // Render
      this.render();
      
      // Analyze
      this.analyzeImage();
      
      this.state.isLoading = false;
      this.emit('imageLoaded', {
        width: imageData.width,
        height: imageData.height
      });
      
      logger.info('Image loaded', {
        width: imageData.width,
        height: imageData.height
      });
    } catch (error) {
      this.state.isLoading = false;
      logger.error('Failed to load image', error);
      this.emit('loadingError', error);
      throw error;
    }
  }

  /**
   * Load image from Blob
   */
  private async loadFromBlob(blob: Blob): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image from blob'));
      };
      
      img.src = url;
    });
  }

  /**
   * Load image from URL
   */
  private async loadFromURL(url: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image from URL'));
      };
      
      img.src = url;
    });
  }

  /**
   * Apply adjustments to image
   */
  async applyAdjustments(adjustments: Partial<ImageAdjustments>): Promise<void> {
    this.adjustments = { ...this.adjustments, ...adjustments };
    
    // Record operation
    this.recordOperation({
      type: 'adjustment',
      data: adjustments,
      timestamp: Date.now()
    });
    
    await this.processImage();
    this.render();
    
    this.emit('adjustmentsApplied', this.adjustments);
    logger.info('Adjustments applied', adjustments);
  }

  /**
   * Process image with current settings
   */
  private async processImage(): Promise<void> {
    if (!this.currentImage) return;
    
    let processedImage = this.currentImage;
    
    if (this.config.useWebGL && this.glRenderer) {
      // Use WebGL for processing
      processedImage = await this.glRenderer.processImage(
        this.currentImage,
        this.adjustments
      );
    } else {
      // Fallback to Canvas 2D processing
      processedImage = this.processWithCanvas2D(
        this.currentImage,
        this.adjustments
      );
    }
    
    // Update active layer
    const activeLayer = this.layerStack.getActiveLayer();
    if (activeLayer) {
      activeLayer.imageData = processedImage;
      this.layerStack.updateLayer(activeLayer.id, activeLayer);
    }
    
    this.currentImage = processedImage;
  }

  /**
   * Process image with Canvas 2D (fallback)
   */
  private processWithCanvas2D(
    imageData: ImageData,
    adjustments: ImageAdjustments
  ): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const result = new ImageData(data, imageData.width, imageData.height);
    
    // Apply adjustments pixel by pixel
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      const a = data[i + 3];
      
      // Brightness
      r = Math.min(255, Math.max(0, r + adjustments.brightness * 255));
      g = Math.min(255, Math.max(0, g + adjustments.brightness * 255));
      b = Math.min(255, Math.max(0, b + adjustments.brightness * 255));
      
      // Contrast
      const factor = (259 * (adjustments.contrast * 255 + 255)) / 
                     (255 * (259 - adjustments.contrast * 255));
      r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, factor * (b - 128) + 128));
      
      // Saturation
      const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
      r = Math.min(255, Math.max(0, gray + adjustments.saturation * (r - gray)));
      g = Math.min(255, Math.max(0, gray + adjustments.saturation * (g - gray)));
      b = Math.min(255, Math.max(0, gray + adjustments.saturation * (b - gray)));
      
      // Temperature
      if (adjustments.temperature !== 0) {
        r = Math.min(255, Math.max(0, r + adjustments.temperature * 10));
        b = Math.min(255, Math.max(0, b - adjustments.temperature * 10));
      }
      
      // Tint
      if (adjustments.tint !== 0) {
        g = Math.min(255, Math.max(0, g + adjustments.tint * 10));
      }
      
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
    
    return result;
  }

  /**
   * Apply filter to image
   */
  async applyFilter(filterName: string, params?: any): Promise<void> {
    if (!this.currentImage) return;
    
    const filteredImage = await this.filterPipeline.applyFilter(
      this.currentImage,
      filterName,
      params
    );
    
    this.currentImage = filteredImage;
    
    // Update active layer
    const activeLayer = this.layerStack.getActiveLayer();
    if (activeLayer) {
      activeLayer.imageData = filteredImage;
    }
    
    // Record operation
    this.recordOperation({
      type: 'filter',
      data: { name: filterName, params },
      timestamp: Date.now()
    });
    
    this.render();
    this.emit('filterApplied', { filterName, params });
    
    logger.info('Filter applied', { filterName, params });
  }

  /**
   * Detect and enhance anomalies
   */
  async detectAnomalies(sensitivity: number = 0.7): Promise<void> {
    if (!this.currentImage) return;
    
    const anomalies = await this.anomalyDetector.detect(
      this.currentImage,
      sensitivity
    );
    
    if (anomalies.length > 0) {
      // Create anomaly overlay layer
      const overlayData = this.anomalyDetector.createOverlay(
        this.currentImage,
        anomalies
      );
      
      const overlayLayer = this.layerStack.createLayer(
        'Anomaly Overlay',
        overlayData,
        {
          blendMode: 'multiply',
          opacity: 0.5
        }
      );
      
      this.render();
      this.emit('anomaliesDetected', anomalies);
      
      logger.info('Anomalies detected', { 
        count: anomalies.length,
        sensitivity 
      });
    }
  }

  /**
   * Enhance anomalies
   */
  async enhanceAnomalies(strength: number = 1.0): Promise<void> {
    if (!this.currentImage) return;
    
    const enhanced = await this.anomalyDetector.enhance(
      this.currentImage,
      strength
    );
    
    this.currentImage = enhanced;
    
    // Update active layer
    const activeLayer = this.layerStack.getActiveLayer();
    if (activeLayer) {
      activeLayer.imageData = enhanced;
    }
    
    this.render();
    this.emit('anomaliesEnhanced', { strength });
    
    logger.info('Anomalies enhanced', { strength });
  }

  /**
   * Apply noise reduction
   */
  async reduceNoise(strength: number = 0.5, preserveDetails: boolean = true): Promise<void> {
    if (!this.currentImage) return;
    
    await this.applyFilter('noiseReduction', {
      strength,
      preserveDetails
    });
  }

  /**
   * Apply sharpening
   */
  async sharpen(amount: number = 1.0, radius: number = 1.0): Promise<void> {
    if (!this.currentImage) return;
    
    await this.applyFilter('sharpen', {
      amount,
      radius
    });
  }

  /**
   * Analyze image
   */
  private analyzeImage(): void {
    if (!this.currentImage) return;
    
    // Generate histogram
    const histogram = this.histogramAnalyzer.analyze(this.currentImage);
    this.emit('histogramUpdated', histogram);
    
    // Detect initial anomalies
    this.anomalyDetector.detect(this.currentImage, 0.5).then(anomalies => {
      if (anomalies.length > 0) {
        this.emit('anomaliesFound', anomalies);
      }
    });
  }

  /**
   * Render current state
   */
  private render(): void {
    if (!this.currentImage) return;
    
    // Clear canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply transformations
    this.context.save();
    this.context.translate(this.state.panX, this.state.panY);
    this.context.scale(this.state.zoom, this.state.zoom);
    
    // Render layers
    const layers = this.layerStack.getLayers();
    for (const layer of layers) {
      if (!layer.visible) continue;
      
      this.context.globalAlpha = layer.opacity;
      this.context.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      
      // Draw layer
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);
      
      this.context.drawImage(tempCanvas, 0, 0);
    }
    
    this.context.restore();
    this.emit('rendered');
  }

  /**
   * Record operation for history
   */
  private recordOperation(operation: EditOperation): void {
    // Remove any operations after current index
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // Add new operation
    this.history.push(operation);
    this.historyIndex++;
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
    
    this.markAsChanged();
  }

  /**
   * Undo last operation
   */
  async undo(): Promise<void> {
    if (this.historyIndex <= 0) return;
    
    this.historyIndex--;
    await this.revertToHistory(this.historyIndex);
    
    this.emit('undo');
    logger.info('Undo performed');
  }

  /**
   * Redo operation
   */
  async redo(): Promise<void> {
    if (this.historyIndex >= this.history.length - 1) return;
    
    this.historyIndex++;
    await this.applyHistoryOperation(this.history[this.historyIndex]);
    
    this.emit('redo');
    logger.info('Redo performed');
  }

  /**
   * Revert to history state
   */
  private async revertToHistory(index: number): Promise<void> {
    if (!this.originalImage) return;
    
    // Reset to original
    this.currentImage = new ImageData(
      new Uint8ClampedArray(this.originalImage.data),
      this.originalImage.width,
      this.originalImage.height
    );
    
    // Apply operations up to index
    for (let i = 0; i <= index; i++) {
      await this.applyHistoryOperation(this.history[i]);
    }
    
    this.render();
  }

  /**
   * Apply history operation
   */
  private async applyHistoryOperation(operation: EditOperation): Promise<void> {
    switch (operation.type) {
      case 'adjustment':
        await this.applyAdjustments(operation.data);
        break;
      case 'filter':
        await this.applyFilter(operation.data.name, operation.data.params);
        break;
      // Add more operation types as needed
    }
  }

  /**
   * Reset to original image
   */
  async reset(): Promise<void> {
    if (!this.originalImage) return;
    
    this.currentImage = new ImageData(
      new Uint8ClampedArray(this.originalImage.data),
      this.originalImage.width,
      this.originalImage.height
    );
    
    this.adjustments = this.getDefaultAdjustments();
    this.history = [];
    this.historyIndex = -1;
    this.state.hasChanges = false;
    
    // Reset layers
    this.layerStack.clear();
    const baseLayer = this.layerStack.createLayer('Background', this.currentImage);
    this.layerStack.setActiveLayer(baseLayer.id);
    
    this.render();
    this.emit('reset');
    
    logger.info('Editor reset to original');
  }

  /**
   * Export edited image
   */
  async export(options?: ExportOptions): Promise<Blob> {
    const exportOptions: ExportOptions = {
      format: 'png',
      quality: 0.95,
      ...options
    };
    
    // Create export canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.canvas.width;
    exportCanvas.height = this.canvas.height;
    const exportCtx = exportCanvas.getContext('2d')!;
    
    // Render all layers
    const layers = this.layerStack.getLayers();
    for (const layer of layers) {
      if (!layer.visible) continue;
      
      exportCtx.globalAlpha = layer.opacity;
      exportCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);
      
      exportCtx.drawImage(tempCanvas, 0, 0);
    }
    
    return new Promise((resolve) => {
      exportCanvas.toBlob(
        (blob) => resolve(blob!),
        `image/${exportOptions.format}`,
        exportOptions.quality
      );
    });
  }

  /**
   * Get default adjustments
   */
  private getDefaultAdjustments(): ImageAdjustments {
    return {
      brightness: 0,
      contrast: 0,
      saturation: 1,
      exposure: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      temperature: 0,
      tint: 0,
      vibrance: 0,
      clarity: 0,
      dehaze: 0,
      vignette: 0,
      grain: 0
    };
  }

  /**
   * Mark as changed
   */
  private markAsChanged(): void {
    this.state.hasChanges = true;
    this.emit('changed');
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.state.zoom = Math.max(0.1, Math.min(10, zoom));
    this.render();
    this.emit('zoomChanged', this.state.zoom);
  }

  /**
   * Set pan position
   */
  setPan(x: number, y: number): void {
    this.state.panX = x;
    this.state.panY = y;
    this.render();
  }

  /**
   * Get current state
   */
  getState(): EditorState {
    return { ...this.state };
  }

  /**
   * Get current adjustments
   */
  getAdjustments(): ImageAdjustments {
    return { ...this.adjustments };
  }

  /**
   * Get histogram data
   */
  getHistogram(): any {
    if (!this.currentImage) return null;
    return this.histogramAnalyzer.analyze(this.currentImage);
  }

  /**
   * Dispose editor
   */
  dispose(): void {
    if (this.glRenderer) {
      this.glRenderer.dispose();
    }
    
    this.layerStack.clear();
    this.removeAllListeners();
    
    logger.info('Image editor disposed');
  }
}

// Export singleton instance
export const imageEditor = (canvas: HTMLCanvasElement) => new ImageEditor(canvas);