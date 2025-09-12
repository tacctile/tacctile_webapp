/**
 * Filter Pipeline
 * Collection of image processing filters
 */

import { FilterDefinition, FilterCategory, NoiseProfile, BlurParams, SharpnessParams } from '../types';
import { WebGLRenderer } from './WebGLRenderer';
import { logger } from '../../../utils/logger';

export class FilterPipeline {
  private filters: Map<string, FilterDefinition> = new Map();
  private glRenderer: WebGLRenderer | null;

  constructor(glRenderer?: WebGLRenderer) {
    this.glRenderer = glRenderer || null;
    this.registerDefaultFilters();
  }

  /**
   * Register default filters
   */
  private registerDefaultFilters(): void {
    // Basic filters
    this.registerFilter({
      name: 'grayscale',
      displayName: 'Grayscale',
      category: FilterCategory.BASIC,
      params: [],
      process: this.grayscaleFilter
    });

    this.registerFilter({
      name: 'sepia',
      displayName: 'Sepia',
      category: FilterCategory.BASIC,
      params: [
        { name: 'intensity', type: 'number', default: 1, min: 0, max: 1 }
      ],
      process: this.sepiaFilter
    });

    this.registerFilter({
      name: 'invert',
      displayName: 'Invert',
      category: FilterCategory.BASIC,
      params: [],
      process: this.invertFilter
    });

    // Blur filters
    this.registerFilter({
      name: 'gaussianBlur',
      displayName: 'Gaussian Blur',
      category: FilterCategory.BLUR,
      params: [
        { name: 'radius', type: 'number', default: 5, min: 1, max: 50 }
      ],
      process: this.gaussianBlurFilter
    });

    this.registerFilter({
      name: 'motionBlur',
      displayName: 'Motion Blur',
      category: FilterCategory.BLUR,
      params: [
        { name: 'angle', type: 'number', default: 0, min: 0, max: 360 },
        { name: 'distance', type: 'number', default: 10, min: 1, max: 100 }
      ],
      process: this.motionBlurFilter
    });

    // Sharpen filters
    this.registerFilter({
      name: 'sharpen',
      displayName: 'Sharpen',
      category: FilterCategory.SHARPEN,
      params: [
        { name: 'amount', type: 'number', default: 1, min: 0, max: 5 },
        { name: 'radius', type: 'number', default: 1, min: 0.5, max: 3 }
      ],
      process: this.sharpenFilter
    });

    this.registerFilter({
      name: 'unsharpMask',
      displayName: 'Unsharp Mask',
      category: FilterCategory.SHARPEN,
      params: [
        { name: 'amount', type: 'number', default: 1, min: 0, max: 5 },
        { name: 'radius', type: 'number', default: 1, min: 0.5, max: 10 },
        { name: 'threshold', type: 'number', default: 0, min: 0, max: 255 }
      ],
      process: this.unsharpMaskFilter
    });

    // Noise filters
    this.registerFilter({
      name: 'noiseReduction',
      displayName: 'Noise Reduction',
      category: FilterCategory.NOISE,
      params: [
        { name: 'strength', type: 'number', default: 0.5, min: 0, max: 1 },
        { name: 'preserveDetails', type: 'boolean', default: true }
      ],
      process: this.noiseReductionFilter
    });

    this.registerFilter({
      name: 'addNoise',
      displayName: 'Add Noise',
      category: FilterCategory.NOISE,
      params: [
        { name: 'amount', type: 'number', default: 0.1, min: 0, max: 1 },
        { name: 'type', type: 'select', default: 'gaussian', options: ['gaussian', 'uniform', 'salt_pepper'] }
      ],
      process: this.addNoiseFilter
    });

    // Paranormal filters
    this.registerFilter({
      name: 'spiritGlow',
      displayName: 'Spirit Glow',
      category: FilterCategory.PARANORMAL,
      params: [
        { name: 'intensity', type: 'number', default: 1, min: 0, max: 2 },
        { name: 'color', type: 'color', default: '#8b5cf6' }
      ],
      process: this.spiritGlowFilter
    });

    this.registerFilter({
      name: 'ectoplasm',
      displayName: 'Ectoplasm Effect',
      category: FilterCategory.PARANORMAL,
      params: [
        { name: 'density', type: 'number', default: 0.5, min: 0, max: 1 },
        { name: 'flow', type: 'number', default: 0.5, min: 0, max: 1 }
      ],
      process: this.ectoplasmFilter
    });

    this.registerFilter({
      name: 'energyField',
      displayName: 'Energy Field',
      category: FilterCategory.PARANORMAL,
      params: [
        { name: 'strength', type: 'number', default: 1, min: 0, max: 2 },
        { name: 'frequency', type: 'number', default: 10, min: 1, max: 50 }
      ],
      process: this.energyFieldFilter
    });

    this.registerFilter({
      name: 'infrared',
      displayName: 'Infrared Simulation',
      category: FilterCategory.PARANORMAL,
      params: [
        { name: 'intensity', type: 'number', default: 1, min: 0, max: 1 }
      ],
      process: this.infraredFilter
    });

    this.registerFilter({
      name: 'spectralHighlight',
      displayName: 'Spectral Highlight',
      category: FilterCategory.PARANORMAL,
      params: [
        { name: 'sensitivity', type: 'number', default: 0.7, min: 0, max: 1 },
        { name: 'threshold', type: 'number', default: 0.5, min: 0, max: 1 }
      ],
      process: this.spectralHighlightFilter
    });
  }

  /**
   * Register a filter
   */
  registerFilter(filter: FilterDefinition): void {
    this.filters.set(filter.name, filter);
    logger.info('Filter registered', { name: filter.name });
  }

  /**
   * Apply filter to image
   */
  async applyFilter(
    imageData: ImageData,
    filterName: string,
    params?: any
  ): Promise<ImageData> {
    const filter = this.filters.get(filterName);
    if (!filter) {
      throw new Error(`Filter '${filterName}' not found`);
    }

    // Merge params with defaults
    const finalParams: any = {};
    filter.params.forEach(param => {
      finalParams[param.name] = params?.[param.name] ?? param.default;
    });

    // Apply filter
    let result: ImageData;
    
    if (filter.shader && this.glRenderer) {
      // Use WebGL if available
      result = await this.glRenderer.processImage(imageData, finalParams);
    } else if (filter.process) {
      // Use JavaScript processing
      result = filter.process.call(this, imageData, finalParams);
    } else {
      throw new Error(`Filter '${filterName}' has no implementation`);
    }

    logger.info('Filter applied', { filter: filterName, params: finalParams });
    return result;
  }

  /**
   * Grayscale filter
   */
  private grayscaleFilter(imageData: ImageData, params: any): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Sepia filter
   */
  private sepiaFilter(imageData: ImageData, params: any): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const intensity = params.intensity;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const tr = 0.393 * r + 0.769 * g + 0.189 * b;
      const tg = 0.349 * r + 0.686 * g + 0.168 * b;
      const tb = 0.272 * r + 0.534 * g + 0.131 * b;
      
      data[i] = r + (tr - r) * intensity;
      data[i + 1] = g + (tg - g) * intensity;
      data[i + 2] = b + (tb - b) * intensity;
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Invert filter
   */
  private invertFilter(imageData: ImageData, params: any): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Gaussian blur filter
   */
  private gaussianBlurFilter(imageData: ImageData, params: any): ImageData {
    const radius = params.radius;
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    // Create Gaussian kernel
    const kernel = this.createGaussianKernel(radius);
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Apply convolution
    const output = new Uint8ClampedArray(data.length);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let weightSum = 0;
        
        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx));
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const idx = (py * width + px) * 4;
            const weight = kernel[ky + halfKernel][kx + halfKernel];
            
            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
            a += data[idx + 3] * weight;
            weightSum += weight;
          }
        }
        
        const idx = (y * width + x) * 4;
        output[idx] = r / weightSum;
        output[idx + 1] = g / weightSum;
        output[idx + 2] = b / weightSum;
        output[idx + 3] = a / weightSum;
      }
    }
    
    return new ImageData(output, width, height);
  }

  /**
   * Motion blur filter
   */
  private motionBlurFilter(imageData: ImageData, params: any): ImageData {
    const angle = params.angle * Math.PI / 180;
    const distance = params.distance;
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    const output = new Uint8ClampedArray(data.length);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let samples = 0;
        
        for (let d = -distance; d <= distance; d++) {
          const sx = Math.round(x + dx * d);
          const sy = Math.round(y + dy * d);
          
          if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
            const idx = (sy * width + sx) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            a += data[idx + 3];
            samples++;
          }
        }
        
        const idx = (y * width + x) * 4;
        output[idx] = r / samples;
        output[idx + 1] = g / samples;
        output[idx + 2] = b / samples;
        output[idx + 3] = a / samples;
      }
    }
    
    return new ImageData(output, width, height);
  }

  /**
   * Sharpen filter
   */
  private sharpenFilter(imageData: ImageData, params: any): ImageData {
    const amount = params.amount;
    const kernel = [
      [0, -amount, 0],
      [-amount, 1 + 4 * amount, -amount],
      [0, -amount, 0]
    ];
    
    return this.applyConvolution(imageData, kernel);
  }

  /**
   * Unsharp mask filter
   */
  private unsharpMaskFilter(imageData: ImageData, params: any): ImageData {
    const amount = params.amount;
    const radius = params.radius;
    const threshold = params.threshold;
    
    // Create blurred version
    const blurred = this.gaussianBlurFilter(imageData, { radius });
    
    const data = new Uint8ClampedArray(imageData.data);
    const blurData = blurred.data;
    
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const diff = data[i + c] - blurData[i + c];
        if (Math.abs(diff) > threshold) {
          data[i + c] = Math.min(255, Math.max(0, data[i + c] + diff * amount));
        }
      }
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Noise reduction filter
   */
  private noiseReductionFilter(imageData: ImageData, params: any): ImageData {
    const strength = params.strength;
    const preserveDetails = params.preserveDetails;
    
    // Apply bilateral filter for edge-preserving smoothing
    return this.bilateralFilter(imageData, strength, preserveDetails);
  }

  /**
   * Add noise filter
   */
  private addNoiseFilter(imageData: ImageData, params: any): ImageData {
    const amount = params.amount * 255;
    const type = params.type;
    const data = new Uint8ClampedArray(imageData.data);
    
    for (let i = 0; i < data.length; i += 4) {
      let noise: number;
      
      if (type === 'gaussian') {
        // Box-Muller transform for Gaussian noise
        const u1 = Math.random();
        const u2 = Math.random();
        noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * amount;
      } else if (type === 'uniform') {
        noise = (Math.random() - 0.5) * 2 * amount;
      } else { // salt_pepper
        if (Math.random() < amount / 255) {
          noise = Math.random() > 0.5 ? 255 : -255;
        } else {
          noise = 0;
        }
      }
      
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.min(255, Math.max(0, data[i + c] + noise));
      }
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Spirit glow filter
   */
  private spiritGlowFilter(imageData: ImageData, params: any): ImageData {
    const intensity = params.intensity;
    const color = this.hexToRgb(params.color);
    
    // Create glow effect
    const blurred = this.gaussianBlurFilter(imageData, { radius: 20 });
    const data = new Uint8ClampedArray(imageData.data);
    const blurData = blurred.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const luminance = 0.2989 * blurData[i] + 0.5870 * blurData[i + 1] + 0.1140 * blurData[i + 2];
      const glowStrength = luminance / 255 * intensity;
      
      data[i] = Math.min(255, data[i] + color.r * glowStrength);
      data[i + 1] = Math.min(255, data[i + 1] + color.g * glowStrength);
      data[i + 2] = Math.min(255, data[i + 2] + color.b * glowStrength);
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Ectoplasm filter
   */
  private ectoplasmFilter(imageData: ImageData, params: any): ImageData {
    const density = params.density;
    const flow = params.flow;
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    // Create flowing ectoplasm effect
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Create flowing pattern
        const wave = Math.sin(x * 0.02 + y * 0.01 * flow) * 0.5 + 0.5;
        const mist = Math.random() * density;
        
        // Apply greenish-white ectoplasm color
        data[idx] = Math.min(255, data[idx] + 100 * wave * mist);
        data[idx + 1] = Math.min(255, data[idx + 1] + 255 * wave * mist);
        data[idx + 2] = Math.min(255, data[idx + 2] + 150 * wave * mist);
        data[idx + 3] = Math.min(255, data[idx + 3] + 50 * mist);
      }
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Energy field filter
   */
  private energyFieldFilter(imageData: ImageData, params: any): ImageData {
    const strength = params.strength;
    const frequency = params.frequency;
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    
    // Create energy field visualization
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Create circular energy waves
        const cx = width / 2;
        const cy = height / 2;
        const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const wave = Math.sin(distance / frequency) * 0.5 + 0.5;
        
        // Apply energy coloring (purple-blue)
        const energy = wave * strength;
        data[idx] = Math.min(255, data[idx] * (1 - energy) + 139 * energy);
        data[idx + 1] = Math.min(255, data[idx + 1] * (1 - energy) + 92 * energy);
        data[idx + 2] = Math.min(255, data[idx + 2] * (1 - energy) + 246 * energy);
      }
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Infrared filter
   */
  private infraredFilter(imageData: ImageData, params: any): ImageData {
    const intensity = params.intensity;
    const data = new Uint8ClampedArray(imageData.data);
    
    for (let i = 0; i < data.length; i += 4) {
      // Convert to infrared color mapping
      const luminance = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
      
      // Map to heat colors
      let r, g, b;
      if (luminance < 64) {
        r = 0;
        g = 0;
        b = luminance * 4;
      } else if (luminance < 128) {
        r = 0;
        g = (luminance - 64) * 4;
        b = 255;
      } else if (luminance < 192) {
        r = (luminance - 128) * 4;
        g = 255;
        b = 255 - (luminance - 128) * 4;
      } else {
        r = 255;
        g = 255 - (luminance - 192) * 4;
        b = 0;
      }
      
      data[i] = data[i] * (1 - intensity) + r * intensity;
      data[i + 1] = data[i + 1] * (1 - intensity) + g * intensity;
      data[i + 2] = data[i + 2] * (1 - intensity) + b * intensity;
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Spectral highlight filter
   */
  private spectralHighlightFilter(imageData: ImageData, params: any): ImageData {
    const sensitivity = params.sensitivity;
    const threshold = params.threshold * 255;
    const data = new Uint8ClampedArray(imageData.data);
    
    // Detect and highlight spectral anomalies
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Check for unusual color combinations
      const maxChannel = Math.max(r, g, b);
      const minChannel = Math.min(r, g, b);
      const difference = maxChannel - minChannel;
      
      if (difference > threshold) {
        // Highlight potential spectral anomaly
        const highlightStrength = (difference / 255) * sensitivity;
        
        data[i] = Math.min(255, r + 100 * highlightStrength);
        data[i + 1] = Math.min(255, g + 50 * highlightStrength);
        data[i + 2] = Math.min(255, b + 200 * highlightStrength);
      }
    }
    
    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply convolution kernel
   */
  private applyConvolution(imageData: ImageData, kernel: number[][]): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data.length);
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          for (let kx = -halfKernel; kx <= halfKernel; kx++) {
            const px = Math.min(width - 1, Math.max(0, x + kx));
            const py = Math.min(height - 1, Math.max(0, y + ky));
            const idx = (py * width + px) * 4;
            const weight = kernel[ky + halfKernel][kx + halfKernel];
            
            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
          }
        }
        
        const idx = (y * width + x) * 4;
        output[idx] = Math.min(255, Math.max(0, r));
        output[idx + 1] = Math.min(255, Math.max(0, g));
        output[idx + 2] = Math.min(255, Math.max(0, b));
        output[idx + 3] = data[idx + 3];
      }
    }
    
    return new ImageData(output, width, height);
  }

  /**
   * Create Gaussian kernel
   */
  private createGaussianKernel(radius: number): number[][] {
    const size = Math.ceil(radius * 2) + 1;
    const kernel: number[][] = [];
    const sigma = radius / 3;
    let sum = 0;
    
    for (let y = 0; y < size; y++) {
      kernel[y] = [];
      for (let x = 0; x < size; x++) {
        const dx = x - Math.floor(size / 2);
        const dy = y - Math.floor(size / 2);
        const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kernel[y][x] = weight;
        sum += weight;
      }
    }
    
    // Normalize
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum;
      }
    }
    
    return kernel;
  }

  /**
   * Bilateral filter for edge-preserving smoothing
   */
  private bilateralFilter(imageData: ImageData, strength: number, preserveDetails: boolean): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data.length);
    
    const spatialSigma = 5 * strength;
    const intensitySigma = preserveDetails ? 30 : 50;
    const windowSize = Math.ceil(spatialSigma * 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const centerIdx = (y * width + x) * 4;
        let r = 0, g = 0, b = 0;
        let weightSum = 0;
        
        for (let dy = -windowSize; dy <= windowSize; dy++) {
          for (let dx = -windowSize; dx <= windowSize; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx));
            const ny = Math.min(height - 1, Math.max(0, y + dy));
            const idx = (ny * width + nx) * 4;
            
            // Spatial weight
            const spatialDist = Math.sqrt(dx * dx + dy * dy);
            const spatialWeight = Math.exp(-(spatialDist * spatialDist) / (2 * spatialSigma * spatialSigma));
            
            // Intensity weight
            const intensityDiff = Math.sqrt(
              Math.pow(data[centerIdx] - data[idx], 2) +
              Math.pow(data[centerIdx + 1] - data[idx + 1], 2) +
              Math.pow(data[centerIdx + 2] - data[idx + 2], 2)
            );
            const intensityWeight = Math.exp(-(intensityDiff * intensityDiff) / (2 * intensitySigma * intensitySigma));
            
            const weight = spatialWeight * intensityWeight;
            
            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
            weightSum += weight;
          }
        }
        
        output[centerIdx] = r / weightSum;
        output[centerIdx + 1] = g / weightSum;
        output[centerIdx + 2] = b / weightSum;
        output[centerIdx + 3] = data[centerIdx + 3];
      }
    }
    
    return new ImageData(output, width, height);
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Get available filters
   */
  getFilters(): FilterDefinition[] {
    return Array.from(this.filters.values());
  }

  /**
   * Get filters by category
   */
  getFiltersByCategory(category: FilterCategory): FilterDefinition[] {
    return Array.from(this.filters.values()).filter(f => f.category === category);
  }
}