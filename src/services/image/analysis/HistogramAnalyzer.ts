/**
 * Histogram Analysis
 * Statistical analysis of image color distribution
 */

import { Histogram, ChannelStats } from '../types';
import { logger } from '../../../utils/logger';

export class HistogramAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Generate histogram from image data
   */
  generateHistogram(imageData: ImageData): Histogram {
    const { data, width, height } = imageData;
    const pixelCount = width * height;

    // Initialize histogram arrays
    const red = new Uint32Array(256);
    const green = new Uint32Array(256);
    const blue = new Uint32Array(256);
    const luminance = new Uint32Array(256);

    // Count pixel values
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      red[r]++;
      green[g]++;
      blue[b]++;
      luminance[l]++;
    }

    // Calculate statistics
    const statistics = this.calculateStatistics(red, green, blue, luminance, pixelCount);

    return {
      red,
      green,
      blue,
      luminance,
      statistics
    };
  }

  /**
   * Calculate statistical measures
   */
  private calculateStatistics(
    red: Uint32Array,
    green: Uint32Array,
    blue: Uint32Array,
    luminance: Uint32Array,
    pixelCount: number
  ): Histogram['statistics'] {
    return {
      mean: {
        r: this.calculateMean(red, pixelCount),
        g: this.calculateMean(green, pixelCount),
        b: this.calculateMean(blue, pixelCount),
        l: this.calculateMean(luminance, pixelCount)
      },
      median: {
        r: this.calculateMedian(red, pixelCount),
        g: this.calculateMedian(green, pixelCount),
        b: this.calculateMedian(blue, pixelCount),
        l: this.calculateMedian(luminance, pixelCount)
      },
      mode: {
        r: this.calculateMode(red),
        g: this.calculateMode(green),
        b: this.calculateMode(blue),
        l: this.calculateMode(luminance)
      },
      stdDev: {
        r: this.calculateStdDev(red, pixelCount),
        g: this.calculateStdDev(green, pixelCount),
        b: this.calculateStdDev(blue, pixelCount),
        l: this.calculateStdDev(luminance, pixelCount)
      },
      min: {
        r: this.findMin(red),
        g: this.findMin(green),
        b: this.findMin(blue),
        l: this.findMin(luminance)
      },
      max: {
        r: this.findMax(red),
        g: this.findMax(green),
        b: this.findMax(blue),
        l: this.findMax(luminance)
      }
    };
  }

  /**
   * Calculate mean value
   */
  private calculateMean(histogram: Uint32Array, pixelCount: number): number {
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }
    return sum / pixelCount;
  }

  /**
   * Calculate median value
   */
  private calculateMedian(histogram: Uint32Array, pixelCount: number): number {
    const halfCount = pixelCount / 2;
    let cumulative = 0;
    
    for (let i = 0; i < 256; i++) {
      cumulative += histogram[i];
      if (cumulative >= halfCount) {
        return i;
      }
    }
    return 127;
  }

  /**
   * Calculate mode value
   */
  private calculateMode(histogram: Uint32Array): number {
    let maxCount = 0;
    let mode = 0;
    
    for (let i = 0; i < 256; i++) {
      if (histogram[i] > maxCount) {
        maxCount = histogram[i];
        mode = i;
      }
    }
    return mode;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(histogram: Uint32Array, pixelCount: number): number {
    const mean = this.calculateMean(histogram, pixelCount);
    let sumSquares = 0;
    
    for (let i = 0; i < 256; i++) {
      const diff = i - mean;
      sumSquares += diff * diff * histogram[i];
    }
    
    return Math.sqrt(sumSquares / pixelCount);
  }

  /**
   * Find minimum value
   */
  private findMin(histogram: Uint32Array): number {
    for (let i = 0; i < 256; i++) {
      if (histogram[i] > 0) return i;
    }
    return 0;
  }

  /**
   * Find maximum value
   */
  private findMax(histogram: Uint32Array): number {
    for (let i = 255; i >= 0; i--) {
      if (histogram[i] > 0) return i;
    }
    return 255;
  }

  /**
   * Analyze contrast
   */
  analyzeContrast(histogram: Histogram): number {
    const { stdDev, max, min } = histogram.statistics;
    const luminanceStdDev = stdDev.l;
    const luminanceRange = max.l - min.l;
    
    // Combine standard deviation and range for contrast measure
    const normalizedStdDev = luminanceStdDev / 255;
    const normalizedRange = luminanceRange / 255;
    
    return (normalizedStdDev + normalizedRange) / 2;
  }

  /**
   * Analyze exposure
   */
  analyzeExposure(histogram: Histogram): 'underexposed' | 'normal' | 'overexposed' {
    const { mean, median } = histogram.statistics;
    const luminanceMean = mean.l;
    const luminanceMedian = median.l;
    
    // Check for clipping
    const shadowClipping = histogram.luminance[0] / histogram.luminance.reduce((a, b) => a + b, 0);
    const highlightClipping = histogram.luminance[255] / histogram.luminance.reduce((a, b) => a + b, 0);
    
    if (shadowClipping > 0.05 || luminanceMean < 64) {
      return 'underexposed';
    } else if (highlightClipping > 0.05 || luminanceMean > 192) {
      return 'overexposed';
    }
    
    return 'normal';
  }

  /**
   * Detect color cast
   */
  detectColorCast(histogram: Histogram): { channel: string; strength: number } | null {
    const { mean } = histogram.statistics;
    const avgMean = (mean.r + mean.g + mean.b) / 3;
    
    const rDiff = Math.abs(mean.r - avgMean);
    const gDiff = Math.abs(mean.g - avgMean);
    const bDiff = Math.abs(mean.b - avgMean);
    
    const threshold = 10;
    
    if (rDiff > threshold && rDiff > gDiff && rDiff > bDiff) {
      return { channel: mean.r > avgMean ? 'red' : 'cyan', strength: rDiff / 255 };
    } else if (gDiff > threshold && gDiff > rDiff && gDiff > bDiff) {
      return { channel: mean.g > avgMean ? 'green' : 'magenta', strength: gDiff / 255 };
    } else if (bDiff > threshold && bDiff > rDiff && bDiff > gDiff) {
      return { channel: mean.b > avgMean ? 'blue' : 'yellow', strength: bDiff / 255 };
    }
    
    return null;
  }

  /**
   * Calculate auto-correction values
   */
  calculateAutoCorrection(histogram: Histogram): {
    brightness: number;
    contrast: number;
    gamma: number;
    blackPoint: number;
    whitePoint: number;
  } {
    const { mean, min, max } = histogram.statistics;
    const targetMean = 128;
    
    // Calculate brightness adjustment
    const brightness = (targetMean - mean.l) / 255;
    
    // Calculate contrast adjustment
    const currentRange = max.l - min.l;
    const targetRange = 255;
    const contrast = currentRange < targetRange * 0.8 ? 0.2 : 0;
    
    // Calculate gamma correction
    const gamma = mean.l < 100 ? 0.8 : mean.l > 156 ? 1.2 : 1.0;
    
    // Calculate levels adjustment
    const blackPoint = min.l;
    const whitePoint = max.l;
    
    return {
      brightness,
      contrast,
      gamma,
      blackPoint,
      whitePoint
    };
  }

  /**
   * Generate cumulative distribution function
   */
  generateCDF(histogram: Uint32Array): Float32Array {
    const cdf = new Float32Array(256);
    const total = histogram.reduce((a, b) => a + b, 0);
    
    let cumulative = 0;
    for (let i = 0; i < 256; i++) {
      cumulative += histogram[i];
      cdf[i] = cumulative / total;
    }
    
    return cdf;
  }

  /**
   * Histogram equalization lookup table
   */
  generateEqualizationLUT(histogram: Uint32Array): Uint8Array {
    const cdf = this.generateCDF(histogram);
    const lut = new Uint8Array(256);
    
    const cdfMin = cdf.find(val => val > 0) || 0;
    
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.round(((cdf[i] - cdfMin) / (1 - cdfMin)) * 255);
    }
    
    return lut;
  }

  /**
   * Render histogram visualization
   */
  renderHistogram(
    histogram: Histogram,
    width: number = 256,
    height: number = 100,
    channel: 'rgb' | 'red' | 'green' | 'blue' | 'luminance' = 'rgb'
  ): ImageData {
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, width, height);
    
    // Find max value for scaling
    let maxValue = 0;
    const channels = channel === 'rgb' 
      ? [histogram.red, histogram.green, histogram.blue]
      : [histogram[channel]];
    
    for (const hist of channels) {
      for (let i = 0; i < 256; i++) {
        maxValue = Math.max(maxValue, hist[i]);
      }
    }
    
    // Draw histogram
    const barWidth = width / 256;
    
    if (channel === 'rgb') {
      // Draw RGB composite
      this.ctx.globalCompositeOperation = 'screen';
      
      this.drawChannel(histogram.red, maxValue, height, barWidth, 'red');
      this.drawChannel(histogram.green, maxValue, height, barWidth, 'green');
      this.drawChannel(histogram.blue, maxValue, height, barWidth, 'blue');
    } else {
      // Draw single channel
      const color = channel === 'luminance' ? 'white' : channel;
      this.drawChannel(histogram[channel], maxValue, height, barWidth, color);
    }
    
    return this.ctx.getImageData(0, 0, width, height);
  }

  /**
   * Draw single histogram channel
   */
  private drawChannel(
    data: Uint32Array,
    maxValue: number,
    height: number,
    barWidth: number,
    color: string
  ): void {
    this.ctx.fillStyle = color;
    
    for (let i = 0; i < 256; i++) {
      const barHeight = (data[i] / maxValue) * height;
      const x = i * barWidth;
      const y = height - barHeight;
      
      this.ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  /**
   * Analyze histogram for anomalies
   */
  detectHistogramAnomalies(histogram: Histogram): string[] {
    const anomalies: string[] = [];
    const { mean, stdDev, min, max } = histogram.statistics;
    
    // Check for unusual distributions
    if (stdDev.l < 20) {
      anomalies.push('Very low contrast - possible fog or mist');
    }
    
    if (stdDev.l > 80) {
      anomalies.push('Very high contrast - possible energy discharge');
    }
    
    // Check for gaps in histogram
    const gaps = this.findHistogramGaps(histogram.luminance);
    if (gaps.length > 10) {
      anomalies.push('Unusual gaps in tonal range - possible data corruption or anomaly');
    }
    
    // Check for spikes
    const spikes = this.findHistogramSpikes(histogram.luminance);
    if (spikes.length > 0 && spikes.length < 5) {
      anomalies.push('Isolated intensity spikes - possible light anomalies');
    }
    
    // Check color channel imbalance
    const colorCast = this.detectColorCast(histogram);
    if (colorCast && colorCast.strength > 0.2) {
      anomalies.push(`Strong ${colorCast.channel} color cast - possible atmospheric anomaly`);
    }
    
    return anomalies;
  }

  /**
   * Find gaps in histogram
   */
  private findHistogramGaps(histogram: Uint32Array): number[] {
    const gaps: number[] = [];
    const threshold = histogram.reduce((a, b) => a + b, 0) * 0.0001;
    
    for (let i = 1; i < 255; i++) {
      if (histogram[i] < threshold && histogram[i - 1] > threshold && histogram[i + 1] > threshold) {
        gaps.push(i);
      }
    }
    
    return gaps;
  }

  /**
   * Find spikes in histogram
   */
  private findHistogramSpikes(histogram: Uint32Array): number[] {
    const spikes: number[] = [];
    const mean = histogram.reduce((a, b) => a + b, 0) / 256;
    const threshold = mean * 5;
    
    for (let i = 1; i < 255; i++) {
      if (histogram[i] > threshold && 
          histogram[i] > histogram[i - 1] * 2 && 
          histogram[i] > histogram[i + 1] * 2) {
        spikes.push(i);
      }
    }
    
    return spikes;
  }
}