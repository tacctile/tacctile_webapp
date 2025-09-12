/**
 * Noise Reduction
 * Advanced noise reduction algorithms for image enhancement
 */

import { logger } from '../../../utils/logger';

export class NoiseReducer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Apply adaptive noise reduction
   */
  reduceNoise(
    imageData: ImageData,
    strength = 0.5,
    preserveDetails = true
  ): ImageData {
    const output = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Detect noise level
    const noiseLevel = this.estimateNoiseLevel(imageData);
    
    // Choose appropriate algorithm based on noise characteristics
    if (noiseLevel < 0.3) {
      return this.bilateralFilter(output, strength * 2, preserveDetails);
    } else if (noiseLevel < 0.6) {
      return this.nonLocalMeans(output, strength * 5, preserveDetails);
    } else {
      // High noise - use multi-stage approach
      let result = this.medianFilter(output, 3);
      result = this.bilateralFilter(result, strength * 3, preserveDetails);
      return this.adaptiveWiener(result, strength);
    }
  }

  /**
   * Estimate noise level in image
   */
  private estimateNoiseLevel(imageData: ImageData): number {
    const { data, width, height } = imageData;
    let variance = 0;
    let count = 0;

    // Sample patches across the image
    for (let y = 10; y < height - 10; y += 20) {
      for (let x = 10; x < width - 10; x += 20) {
        const patchVariance = this.calculatePatchVariance(data, x, y, width, 5);
        variance += patchVariance;
        count++;
      }
    }

    // Normalize variance to 0-1 range
    return Math.min(variance / (count * 1000), 1);
  }

  /**
   * Calculate variance in a patch
   */
  private calculatePatchVariance(
    data: Uint8ClampedArray,
    cx: number,
    cy: number,
    width: number,
    radius: number
  ): number {
    const values: number[] = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const idx = ((cy + dy) * width + (cx + dx)) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        values.push(gray);
      }
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return variance;
  }

  /**
   * Bilateral filter - edge-preserving smoothing
   */
  bilateralFilter(
    imageData: ImageData,
    spatialSigma = 2,
    preserveEdges = true
  ): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    const radius = Math.ceil(spatialSigma * 2);
    const intensitySigma = preserveEdges ? 30 : 60;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const centerIdx = (y * width + x) * 4;
        let sumR = 0, sumG = 0, sumB = 0;
        let weightSum = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = y + dy;
            const nx = x + dx;

            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
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
              
              sumR += data[idx] * weight;
              sumG += data[idx + 1] * weight;
              sumB += data[idx + 2] * weight;
              weightSum += weight;
            }
          }
        }

        const outIdx = (y * width + x) * 4;
        output.data[outIdx] = sumR / weightSum;
        output.data[outIdx + 1] = sumG / weightSum;
        output.data[outIdx + 2] = sumB / weightSum;
        output.data[outIdx + 3] = data[centerIdx + 3];
      }
    }

    return output;
  }

  /**
   * Non-local means denoising
   */
  nonLocalMeans(
    imageData: ImageData,
    h = 10,
    preserveDetails = true
  ): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    const patchRadius = 3;
    const searchRadius = preserveDetails ? 10 : 15;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0, sumG = 0, sumB = 0;
        let weightSum = 0;

        // Search window
        for (let sy = Math.max(0, y - searchRadius); sy <= Math.min(height - 1, y + searchRadius); sy++) {
          for (let sx = Math.max(0, x - searchRadius); sx <= Math.min(width - 1, x + searchRadius); sx++) {
            // Calculate patch distance
            const distance = this.patchDistance(data, width, x, y, sx, sy, patchRadius);
            const weight = Math.exp(-distance / (h * h));
            
            const idx = (sy * width + sx) * 4;
            sumR += data[idx] * weight;
            sumG += data[idx + 1] * weight;
            sumB += data[idx + 2] * weight;
            weightSum += weight;
          }
        }

        const outIdx = (y * width + x) * 4;
        output.data[outIdx] = sumR / weightSum;
        output.data[outIdx + 1] = sumG / weightSum;
        output.data[outIdx + 2] = sumB / weightSum;
        output.data[outIdx + 3] = data[(y * width + x) * 4 + 3];
      }
    }

    return output;
  }

  /**
   * Calculate distance between two patches
   */
  private patchDistance(
    data: Uint8ClampedArray,
    width: number,
    x1: number, y1: number,
    x2: number, y2: number,
    radius: number
  ): number {
    let distance = 0;
    let count = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const ny1 = y1 + dy;
        const nx1 = x1 + dx;
        const ny2 = y2 + dy;
        const nx2 = x2 + dx;

        if (ny1 >= 0 && ny1 < data.length / (width * 4) &&
            nx1 >= 0 && nx1 < width &&
            ny2 >= 0 && ny2 < data.length / (width * 4) &&
            nx2 >= 0 && nx2 < width) {
          
          const idx1 = (ny1 * width + nx1) * 4;
          const idx2 = (ny2 * width + nx2) * 4;
          
          distance += Math.pow(data[idx1] - data[idx2], 2);
          distance += Math.pow(data[idx1 + 1] - data[idx2 + 1], 2);
          distance += Math.pow(data[idx1 + 2] - data[idx2 + 2], 2);
          count += 3;
        }
      }
    }

    return count > 0 ? distance / count : 0;
  }

  /**
   * Median filter for impulse noise
   */
  medianFilter(imageData: ImageData, radius = 1): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rValues: number[] = [];
        const gValues: number[] = [];
        const bValues: number[] = [];

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = Math.min(Math.max(0, y + dy), height - 1);
            const nx = Math.min(Math.max(0, x + dx), width - 1);
            const idx = (ny * width + nx) * 4;
            
            rValues.push(data[idx]);
            gValues.push(data[idx + 1]);
            bValues.push(data[idx + 2]);
          }
        }

        rValues.sort((a, b) => a - b);
        gValues.sort((a, b) => a - b);
        bValues.sort((a, b) => a - b);

        const median = Math.floor(rValues.length / 2);
        const outIdx = (y * width + x) * 4;
        
        output.data[outIdx] = rValues[median];
        output.data[outIdx + 1] = gValues[median];
        output.data[outIdx + 2] = bValues[median];
        output.data[outIdx + 3] = data[outIdx + 3];
      }
    }

    return output;
  }

  /**
   * Adaptive Wiener filter
   */
  adaptiveWiener(imageData: ImageData, noiseVariance = 0.01): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 3; c++) {
          let localMean = 0;
          let localVariance = 0;
          let count = 0;

          // Calculate local statistics
          for (let dy = -halfWindow; dy <= halfWindow; dy++) {
            for (let dx = -halfWindow; dx <= halfWindow; dx++) {
              const ny = Math.min(Math.max(0, y + dy), height - 1);
              const nx = Math.min(Math.max(0, x + dx), width - 1);
              const idx = (ny * width + nx) * 4 + c;
              
              localMean += data[idx];
              count++;
            }
          }
          localMean /= count;

          // Calculate local variance
          for (let dy = -halfWindow; dy <= halfWindow; dy++) {
            for (let dx = -halfWindow; dx <= halfWindow; dx++) {
              const ny = Math.min(Math.max(0, y + dy), height - 1);
              const nx = Math.min(Math.max(0, x + dx), width - 1);
              const idx = (ny * width + nx) * 4 + c;
              
              localVariance += Math.pow(data[idx] - localMean, 2);
            }
          }
          localVariance /= count;

          // Apply Wiener filter
          const idx = (y * width + x) * 4 + c;
          const factor = Math.max(0, (localVariance - noiseVariance * 255 * 255) / Math.max(localVariance, 0.001));
          output.data[idx] = localMean + factor * (data[idx] - localMean);
        }
        
        // Copy alpha
        const idx = (y * width + x) * 4;
        output.data[idx + 3] = data[idx + 3];
      }
    }

    return output;
  }

  /**
   * Wavelet denoising
   */
  waveletDenoise(imageData: ImageData, threshold = 10): ImageData {
    const { width, height } = imageData;
    const output = new ImageData(
      new Uint8ClampedArray(imageData.data),
      width,
      height
    );

    // Process each color channel
    for (let c = 0; c < 3; c++) {
      // Extract channel
      const channel = new Float32Array(width * height);
      for (let i = 0; i < width * height; i++) {
        channel[i] = imageData.data[i * 4 + c];
      }

      // Apply wavelet transform
      const coefficients = this.waveletTransform2D(channel, width, height);
      
      // Soft thresholding
      this.softThreshold(coefficients, threshold);
      
      // Inverse transform
      const denoised = this.inverseWaveletTransform2D(coefficients, width, height);
      
      // Write back to output
      for (let i = 0; i < width * height; i++) {
        output.data[i * 4 + c] = Math.max(0, Math.min(255, denoised[i]));
      }
    }

    return output;
  }

  /**
   * 2D Wavelet transform (Haar wavelet)
   */
  private waveletTransform2D(data: Float32Array, width: number, height: number): Float32Array {
    const result = new Float32Array(data);
    const temp = new Float32Array(Math.max(width, height));

    // Transform rows
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        temp[x] = result[y * width + x];
      }
      this.waveletTransform1D(temp, width);
      for (let x = 0; x < width; x++) {
        result[y * width + x] = temp[x];
      }
    }

    // Transform columns
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        temp[y] = result[y * width + x];
      }
      this.waveletTransform1D(temp, height);
      for (let y = 0; y < height; y++) {
        result[y * width + x] = temp[y];
      }
    }

    return result;
  }

  /**
   * 1D Wavelet transform
   */
  private waveletTransform1D(data: Float32Array, length: number): void {
    const temp = new Float32Array(length);
    let h = length;

    while (h > 1) {
      h = Math.floor(h / 2);
      
      for (let i = 0; i < h; i++) {
        temp[i] = (data[2 * i] + data[2 * i + 1]) / Math.sqrt(2);
        temp[h + i] = (data[2 * i] - data[2 * i + 1]) / Math.sqrt(2);
      }
      
      for (let i = 0; i < 2 * h; i++) {
        data[i] = temp[i];
      }
    }
  }

  /**
   * Inverse 2D Wavelet transform
   */
  private inverseWaveletTransform2D(coefficients: Float32Array, width: number, height: number): Float32Array {
    const result = new Float32Array(coefficients);
    const temp = new Float32Array(Math.max(width, height));

    // Inverse transform columns
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        temp[y] = result[y * width + x];
      }
      this.inverseWaveletTransform1D(temp, height);
      for (let y = 0; y < height; y++) {
        result[y * width + x] = temp[y];
      }
    }

    // Inverse transform rows
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        temp[x] = result[y * width + x];
      }
      this.inverseWaveletTransform1D(temp, width);
      for (let x = 0; x < width; x++) {
        result[y * width + x] = temp[x];
      }
    }

    return result;
  }

  /**
   * Inverse 1D Wavelet transform
   */
  private inverseWaveletTransform1D(data: Float32Array, length: number): void {
    const temp = new Float32Array(length);
    let h = 1;

    while (h < length) {
      for (let i = 0; i < h; i++) {
        temp[2 * i] = (data[i] + data[h + i]) / Math.sqrt(2);
        temp[2 * i + 1] = (data[i] - data[h + i]) / Math.sqrt(2);
      }
      
      h *= 2;
      for (let i = 0; i < h; i++) {
        data[i] = temp[i];
      }
    }
  }

  /**
   * Soft thresholding for wavelet coefficients
   */
  private softThreshold(coefficients: Float32Array, threshold: number): void {
    for (let i = 0; i < coefficients.length; i++) {
      const val = coefficients[i];
      if (Math.abs(val) <= threshold) {
        coefficients[i] = 0;
      } else if (val > 0) {
        coefficients[i] = val - threshold;
      } else {
        coefficients[i] = val + threshold;
      }
    }
  }

  /**
   * Anisotropic diffusion filter
   */
  anisotropicDiffusion(
    imageData: ImageData,
    iterations = 10,
    lambda = 0.25,
    kappa = 10
  ): ImageData {
    const { width, height } = imageData;
    let current = new Float32Array(width * height * 3);
    
    // Initialize with input data
    for (let i = 0; i < width * height; i++) {
      current[i * 3] = imageData.data[i * 4];
      current[i * 3 + 1] = imageData.data[i * 4 + 1];
      current[i * 3 + 2] = imageData.data[i * 4 + 2];
    }

    // Iterative diffusion
    for (let iter = 0; iter < iterations; iter++) {
      const next = new Float32Array(current);
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) {
            const idx = (y * width + x) * 3 + c;
            const center = current[idx];
            
            // Calculate gradients
            const north = current[((y - 1) * width + x) * 3 + c] - center;
            const south = current[((y + 1) * width + x) * 3 + c] - center;
            const east = current[(y * width + x + 1) * 3 + c] - center;
            const west = current[(y * width + x - 1) * 3 + c] - center;
            
            // Calculate diffusion coefficients
            const cN = Math.exp(-(north * north) / (kappa * kappa));
            const cS = Math.exp(-(south * south) / (kappa * kappa));
            const cE = Math.exp(-(east * east) / (kappa * kappa));
            const cW = Math.exp(-(west * west) / (kappa * kappa));
            
            // Update pixel value
            next[idx] = center + lambda * (cN * north + cS * south + cE * east + cW * west);
          }
        }
      }
      
      current = next;
    }

    // Convert back to ImageData
    const output = new ImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      output.data[i * 4] = Math.max(0, Math.min(255, current[i * 3]));
      output.data[i * 4 + 1] = Math.max(0, Math.min(255, current[i * 3 + 1]));
      output.data[i * 4 + 2] = Math.max(0, Math.min(255, current[i * 3 + 2]));
      output.data[i * 4 + 3] = imageData.data[i * 4 + 3];
    }

    return output;
  }

  /**
   * Adaptive noise reduction for paranormal images
   */
  paranormalNoiseReduction(imageData: ImageData): ImageData {
    // First pass: preserve anomalies while reducing noise
    const preserved = this.preserveAnomalies(imageData);
    
    // Second pass: selective noise reduction
    const denoised = this.selectiveDenoise(preserved);
    
    // Third pass: enhance weak signals
    return this.enhanceWeakSignals(denoised);
  }

  /**
   * Preserve potential anomalies during noise reduction
   */
  private preserveAnomalies(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    const anomalyMask = this.detectAnomalyRegions(imageData);

    for (let i = 0; i < data.length; i += 4) {
      const pixelIdx = i / 4;
      
      if (anomalyMask[pixelIdx]) {
        // Preserve potential anomaly
        output.data[i] = data[i];
        output.data[i + 1] = data[i + 1];
        output.data[i + 2] = data[i + 2];
        output.data[i + 3] = data[i + 3];
      } else {
        // Apply gentle noise reduction
        const filtered = this.gentleFilter(data, i, width, height);
        output.data[i] = filtered[0];
        output.data[i + 1] = filtered[1];
        output.data[i + 2] = filtered[2];
        output.data[i + 3] = data[i + 3];
      }
    }

    return output;
  }

  /**
   * Detect regions that might contain anomalies
   */
  private detectAnomalyRegions(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    const mask = new Uint8Array(width * height);
    
    // Look for unusual patterns
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Check for high local variance (potential anomaly)
        const variance = this.calculateLocalVariance(data, x, y, width);
        
        // Check for unusual colors
        const colorAnomaly = this.checkColorAnomaly(data, idx);
        
        if (variance > 500 || colorAnomaly) {
          mask[y * width + x] = 1;
        }
      }
    }
    
    return mask;
  }

  /**
   * Calculate local variance
   */
  private calculateLocalVariance(data: Uint8ClampedArray, x: number, y: number, width: number): number {
    const values: number[] = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const idx = ((y + dy) * width + (x + dx)) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        values.push(gray);
      }
    }
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Check for color anomalies
   */
  private checkColorAnomaly(data: Uint8ClampedArray, idx: number): boolean {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    
    // Check for unusual color ratios
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    
    // High saturation with specific hues might indicate anomalies
    const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
    const isUnusualHue = (b > r * 1.5 && b > g * 1.2) || // Blue/violet anomaly
                         (g > r * 1.3 && g > b * 1.3);     // Green anomaly
    
    return saturation > 0.6 && isUnusualHue;
  }

  /**
   * Gentle filtering that preserves details
   */
  private gentleFilter(data: Uint8ClampedArray, idx: number, width: number, height: number): number[] {
    const x = (idx / 4) % width;
    const y = Math.floor((idx / 4) / width);
    
    let sumR = 0, sumG = 0, sumB = 0;
    let count = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ny = y + dy;
        const nx = x + dx;
        
        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
          const nIdx = (ny * width + nx) * 4;
          const weight = (dx === 0 && dy === 0) ? 2 : 1;
          
          sumR += data[nIdx] * weight;
          sumG += data[nIdx + 1] * weight;
          sumB += data[nIdx + 2] * weight;
          count += weight;
        }
      }
    }
    
    return [sumR / count, sumG / count, sumB / count];
  }

  /**
   * Selective denoising based on local characteristics
   */
  private selectiveDenoise(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const localNoise = this.estimateLocalNoise(data, x, y, width, height);
        
        if (localNoise > 0.5) {
          // High noise area - apply stronger filtering
          const filtered = this.strongFilter(data, x, y, width, height);
          output.data[idx] = filtered[0];
          output.data[idx + 1] = filtered[1];
          output.data[idx + 2] = filtered[2];
        } else {
          // Low noise - preserve original
          output.data[idx] = data[idx];
          output.data[idx + 1] = data[idx + 1];
          output.data[idx + 2] = data[idx + 2];
        }
        output.data[idx + 3] = data[idx + 3];
      }
    }
    
    return output;
  }

  /**
   * Estimate local noise level
   */
  private estimateLocalNoise(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number
  ): number {
    const variance = this.calculatePatchVariance(data, x, y, width, 2);
    return Math.min(variance / 1000, 1);
  }

  /**
   * Strong filtering for high-noise areas
   */
  private strongFilter(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number
  ): number[] {
    const values: number[][] = [[], [], []];
    
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ny = Math.min(Math.max(0, y + dy), height - 1);
        const nx = Math.min(Math.max(0, x + dx), width - 1);
        const idx = (ny * width + nx) * 4;
        
        values[0].push(data[idx]);
        values[1].push(data[idx + 1]);
        values[2].push(data[idx + 2]);
      }
    }
    
    // Use median for strong noise reduction
    return values.map(channel => {
      channel.sort((a, b) => a - b);
      return channel[Math.floor(channel.length / 2)];
    });
  }

  /**
   * Enhance weak signals that might be anomalies
   */
  private enhanceWeakSignals(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    
    // Detect weak signals
    const signals = this.detectWeakSignals(imageData);
    
    for (let i = 0; i < data.length; i += 4) {
      const pixelIdx = i / 4;
      
      if (signals[pixelIdx]) {
        // Enhance weak signal
        const enhancement = 1.2;
        output.data[i] = Math.min(255, data[i] * enhancement);
        output.data[i + 1] = Math.min(255, data[i + 1] * enhancement);
        output.data[i + 2] = Math.min(255, data[i + 2] * enhancement);
      } else {
        output.data[i] = data[i];
        output.data[i + 1] = data[i + 1];
        output.data[i + 2] = data[i + 2];
      }
      output.data[i + 3] = data[i + 3];
    }
    
    return output;
  }

  /**
   * Detect weak signals that might be paranormal
   */
  private detectWeakSignals(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    const signals = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Look for faint patterns
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const localAvg = this.calculateLocalAverage(data, x, y, width);
        
        // Weak signal: slightly brighter than surroundings but not too bright
        if (brightness > localAvg + 10 && brightness < 100) {
          signals[y * width + x] = 1;
        }
      }
    }
    
    return signals;
  }

  /**
   * Calculate local average brightness
   */
  private calculateLocalAverage(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number
  ): number {
    let sum = 0;
    let count = 0;
    
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const ny = y + dy;
        const nx = x + dx;
        
        if (ny >= 0 && ny < data.length / (width * 4) && nx >= 0 && nx < width) {
          const idx = (ny * width + nx) * 4;
          sum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          count++;
        }
      }
    }
    
    return count > 0 ? sum / count : 0;
  }
}