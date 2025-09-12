/**
 * Video Enhancer
 * Real-time video enhancement and color correction
 */

import { VideoEnhancements, ColorCorrectionParams } from '../types';
import { logger } from '../../../utils/logger';

export class VideoEnhancer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lookupTable: Uint8ClampedArray;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.lookupTable = new Uint8ClampedArray(256);
    this.initializeLUT();
  }

  /**
   * Initialize lookup table
   */
  private initializeLUT(): void {
    for (let i = 0; i < 256; i++) {
      this.lookupTable[i] = i;
    }
  }

  /**
   * Enhance video frame
   */
  enhanceFrame(
    imageData: ImageData,
    enhancements: VideoEnhancements
  ): ImageData {
    const output = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Apply enhancements in order
    if (enhancements.denoise > 0) {
      this.applyDenoise(output, enhancements.denoise);
    }

    if (enhancements.exposure !== 0) {
      this.applyExposure(output, enhancements.exposure);
    }

    if (enhancements.brightness !== 0 || enhancements.contrast !== 0) {
      this.applyBrightnessContrast(output, enhancements.brightness, enhancements.contrast);
    }

    if (enhancements.highlights !== 0 || enhancements.shadows !== 0) {
      this.applyHighlightsShadows(output, enhancements.highlights, enhancements.shadows);
    }

    if (enhancements.temperature !== 0 || enhancements.tint !== 0) {
      this.applyColorTemperature(output, enhancements.temperature, enhancements.tint);
    }

    if (enhancements.saturation !== 100) {
      this.applySaturation(output, enhancements.saturation);
    }

    if (enhancements.gamma !== 1) {
      this.applyGamma(output, enhancements.gamma);
    }

    if (enhancements.sharpness > 0) {
      this.applySharpness(output, enhancements.sharpness);
    }

    return output;
  }

  /**
   * Apply brightness and contrast
   */
  private applyBrightnessContrast(
    imageData: ImageData,
    brightness: number,
    contrast: number
  ): void {
    const { data } = imageData;
    const brightnessFactor = brightness / 100 * 255;
    const contrastFactor = (contrast + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let value = data[i + c];
        // Apply contrast
        value = ((value - 128) * contrastFactor) + 128;
        // Apply brightness
        value += brightnessFactor;
        // Clamp
        data[i + c] = Math.max(0, Math.min(255, value));
      }
    }
  }

  /**
   * Apply exposure adjustment
   */
  private applyExposure(imageData: ImageData, exposure: number): void {
    const { data } = imageData;
    const factor = Math.pow(2, exposure);

    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.max(0, Math.min(255, data[i + c] * factor));
      }
    }
  }

  /**
   * Apply highlights and shadows adjustment
   */
  private applyHighlightsShadows(
    imageData: ImageData,
    highlights: number,
    shadows: number
  ): void {
    const { data } = imageData;
    const highlightsFactor = highlights / 100;
    const shadowsFactor = shadows / 100;

    for (let i = 0; i < data.length; i += 4) {
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const normalizedLum = luminance / 255;

      for (let c = 0; c < 3; c++) {
        let value = data[i + c];
        
        // Adjust highlights (affects bright areas)
        if (normalizedLum > 0.5) {
          const highlightAmount = (normalizedLum - 0.5) * 2;
          value = value + (255 - value) * highlightsFactor * highlightAmount;
        }
        
        // Adjust shadows (affects dark areas)
        if (normalizedLum < 0.5) {
          const shadowAmount = (0.5 - normalizedLum) * 2;
          value = value + value * shadowsFactor * shadowAmount;
        }
        
        data[i + c] = Math.max(0, Math.min(255, value));
      }
    }
  }

  /**
   * Apply color temperature and tint
   */
  private applyColorTemperature(
    imageData: ImageData,
    temperature: number,
    tint: number
  ): void {
    const { data } = imageData;
    
    // Temperature: -100 (cool/blue) to +100 (warm/yellow)
    const tempR = 1 + (temperature / 100) * 0.3;
    const tempB = 1 - (temperature / 100) * 0.3;
    
    // Tint: -100 (green) to +100 (magenta)
    const tintG = 1 - Math.abs(tint / 100) * 0.2;
    const tintRM = 1 + (tint / 100) * 0.1;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * tempR * tintRM));     // Red
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * tintG));     // Green
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * tempB * tintRM)); // Blue
    }
  }

  /**
   * Apply saturation adjustment
   */
  private applySaturation(imageData: ImageData, saturation: number): void {
    const { data } = imageData;
    const factor = saturation / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Adjust saturation
      data[i] = Math.max(0, Math.min(255, luminance + (r - luminance) * factor));
      data[i + 1] = Math.max(0, Math.min(255, luminance + (g - luminance) * factor));
      data[i + 2] = Math.max(0, Math.min(255, luminance + (b - luminance) * factor));
    }
  }

  /**
   * Apply gamma correction
   */
  private applyGamma(imageData: ImageData, gamma: number): void {
    const { data } = imageData;
    const invGamma = 1 / gamma;

    // Build gamma lookup table
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.pow(i / 255, invGamma) * 255;
    }

    // Apply using lookup table
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  }

  /**
   * Apply sharpening filter
   */
  private applySharpness(imageData: ImageData, sharpness: number): void {
    const { data, width, height } = imageData;
    const amount = sharpness / 100;
    const original = new Uint8ClampedArray(data);
    
    // Unsharp mask kernel
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c;
              const kernelIdx = (ky + 1) * 3 + (kx + 1);
              sum += original[idx] * kernel[kernelIdx];
            }
          }
          
          const idx = (y * width + x) * 4 + c;
          const sharpened = original[idx] + (sum - original[idx]) * amount;
          data[idx] = Math.max(0, Math.min(255, sharpened));
        }
      }
    }
  }

  /**
   * Apply denoising filter
   */
  private applyDenoise(imageData: ImageData, strength: number): void {
    const { data, width, height } = imageData;
    const radius = Math.max(1, Math.floor(strength / 20));
    const original = new Uint8ClampedArray(data);
    
    // Simple box blur for denoising
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let count = 0;
          
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const ny = Math.max(0, Math.min(height - 1, y + dy));
              const nx = Math.max(0, Math.min(width - 1, x + dx));
              const idx = (ny * width + nx) * 4 + c;
              sum += original[idx];
              count++;
            }
          }
          
          const idx = (y * width + x) * 4 + c;
          const denoised = sum / count;
          const blend = strength / 100;
          data[idx] = original[idx] * (1 - blend) + denoised * blend;
        }
      }
    }
  }

  /**
   * Apply color grading
   */
  applyColorGrading(
    imageData: ImageData,
    params: ColorCorrectionParams
  ): ImageData {
    const output = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Apply white balance
    if (params.whiteBalance) {
      this.applyColorTemperature(
        output,
        params.whiteBalance.temperature,
        params.whiteBalance.tint
      );
    }

    // Apply lift/gamma/gain (shadows/midtones/highlights)
    if (params.colorGrading) {
      this.applyLiftGammaGain(output, params.colorGrading);
    }

    // Apply hue shift
    if (params.hueShift !== 0) {
      this.applyHueShift(output, params.hueShift);
    }

    // Apply vibrance
    if (params.vibrance !== 0) {
      this.applyVibrance(output, params.vibrance);
    }

    // Apply curves if provided
    if (params.curves) {
      this.applyCurves(output, params.curves);
    }

    return output;
  }

  /**
   * Apply lift/gamma/gain color grading
   */
  private applyLiftGammaGain(
    imageData: ImageData,
    grading: ColorCorrectionParams['colorGrading']
  ): void {
    const { data } = imageData;
    const { lift, gamma, gain } = grading;

    for (let i = 0; i < data.length; i += 4) {
      // Apply per channel
      data[i] = this.applyLGG(data[i], lift.r, gamma.r, gain.r);
      data[i + 1] = this.applyLGG(data[i + 1], lift.g, gamma.g, gain.g);
      data[i + 2] = this.applyLGG(data[i + 2], lift.b, gamma.b, gain.b);
    }
  }

  /**
   * Apply single channel lift/gamma/gain
   */
  private applyLGG(value: number, lift: number, gamma: number, gain: number): number {
    const normalized = value / 255;
    
    // Apply lift (affects shadows)
    let result = normalized * (1 - lift) + lift;
    
    // Apply gamma (affects midtones)
    result = Math.pow(result, 1 / gamma);
    
    // Apply gain (affects highlights)
    result = result * gain;
    
    return Math.max(0, Math.min(255, result * 255));
  }

  /**
   * Apply hue shift
   */
  private applyHueShift(imageData: ImageData, shift: number): void {
    const { data } = imageData;
    const shiftRad = (shift * Math.PI) / 180;

    for (let i = 0; i < data.length; i += 4) {
      const rgb = [data[i], data[i + 1], data[i + 2]];
      const hsv = this.rgbToHsv(rgb);
      
      // Shift hue
      hsv[0] = (hsv[0] + shift + 360) % 360;
      
      const newRgb = this.hsvToRgb(hsv);
      data[i] = newRgb[0];
      data[i + 1] = newRgb[1];
      data[i + 2] = newRgb[2];
    }
  }

  /**
   * Apply vibrance (selective saturation)
   */
  private applyVibrance(imageData: ImageData, vibrance: number): void {
    const { data } = imageData;
    const amount = vibrance / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const max = Math.max(r, g, b);
      const avg = (r + g + b) / 3;
      const saturation = max > 0 ? 1 - (avg / max) : 0;
      
      // Vibrance affects less saturated colors more
      const factor = 1 + amount * (1 - saturation);
      
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      
      data[i] = Math.max(0, Math.min(255, luminance + (r - luminance) * factor));
      data[i + 1] = Math.max(0, Math.min(255, luminance + (g - luminance) * factor));
      data[i + 2] = Math.max(0, Math.min(255, luminance + (b - luminance) * factor));
    }
  }

  /**
   * Apply curves adjustment
   */
  private applyCurves(
    imageData: ImageData,
    curves: ColorCorrectionParams['curves']
  ): void {
    const { data } = imageData;
    
    // Generate lookup tables from curves
    const luts = {
      r: curves?.red ? this.generateCurveLUT(curves.red) : null,
      g: curves?.green ? this.generateCurveLUT(curves.green) : null,
      b: curves?.blue ? this.generateCurveLUT(curves.blue) : null,
      rgb: curves?.rgb ? this.generateCurveLUT(curves.rgb) : null
    };

    for (let i = 0; i < data.length; i += 4) {
      if (luts.rgb) {
        data[i] = luts.rgb[data[i]];
        data[i + 1] = luts.rgb[data[i + 1]];
        data[i + 2] = luts.rgb[data[i + 2]];
      }
      
      if (luts.r) data[i] = luts.r[data[i]];
      if (luts.g) data[i + 1] = luts.g[data[i + 1]];
      if (luts.b) data[i + 2] = luts.b[data[i + 2]];
    }
  }

  /**
   * Generate curve lookup table
   */
  private generateCurveLUT(points: Array<{x: number; y: number}>): Uint8ClampedArray {
    const lut = new Uint8ClampedArray(256);
    
    // Sort points by x
    points.sort((a, b) => a.x - b.x);
    
    // Ensure start and end points
    if (points[0].x > 0) {
      points.unshift({x: 0, y: 0});
    }
    if (points[points.length - 1].x < 255) {
      points.push({x: 255, y: 255});
    }
    
    // Interpolate between points
    let pointIdx = 0;
    for (let i = 0; i < 256; i++) {
      while (pointIdx < points.length - 2 && i > points[pointIdx + 1].x) {
        pointIdx++;
      }
      
      const p1 = points[pointIdx];
      const p2 = points[pointIdx + 1];
      
      const t = (i - p1.x) / (p2.x - p1.x);
      const value = p1.y + (p2.y - p1.y) * t;
      
      lut[i] = Math.max(0, Math.min(255, value));
    }
    
    return lut;
  }

  /**
   * RGB to HSV conversion
   */
  private rgbToHsv(rgb: number[]): number[] {
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let h = 0;
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
      } else if (max === g) {
        h = ((b - r) / delta + 2) * 60;
      } else {
        h = ((r - g) / delta + 4) * 60;
      }
    }
    
    return [h, s, v];
  }

  /**
   * HSV to RGB conversion
   */
  private hsvToRgb(hsv: number[]): number[] {
    const h = hsv[0] / 60;
    const s = hsv[1];
    const v = hsv[2];
    
    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;
    
    let r = 0, g = 0, b = 0;
    
    if (h < 1) {
      r = c; g = x; b = 0;
    } else if (h < 2) {
      r = x; g = c; b = 0;
    } else if (h < 3) {
      r = 0; g = c; b = x;
    } else if (h < 4) {
      r = 0; g = x; b = c;
    } else if (h < 5) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }
    
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }

  /**
   * Apply paranormal enhancement preset
   */
  applyParanormalEnhancement(imageData: ImageData): ImageData {
    const enhanced = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Boost shadows to reveal hidden details
    this.applyHighlightsShadows(enhanced, -20, 40);
    
    // Increase contrast slightly
    this.applyBrightnessContrast(enhanced, 0, 15);
    
    // Cool temperature for ethereal look
    this.applyColorTemperature(enhanced, -20, 10);
    
    // Slight desaturation
    this.applySaturation(enhanced, 80);
    
    // Enhance edges
    this.applySharpness(enhanced, 30);
    
    return enhanced;
  }

  /**
   * Apply night vision effect
   */
  applyNightVision(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      
      // Apply green tint
      output.data[i] = gray * 0.3;      // Red
      output.data[i + 1] = gray * 1.2;  // Green
      output.data[i + 2] = gray * 0.3;  // Blue
      output.data[i + 3] = data[i + 3]; // Alpha
      
      // Clamp values
      output.data[i] = Math.min(255, output.data[i]);
      output.data[i + 1] = Math.min(255, output.data[i + 1]);
      output.data[i + 2] = Math.min(255, output.data[i + 2]);
    }
    
    // Add noise for authentic night vision look
    this.addNoise(output, 10);
    
    return output;
  }

  /**
   * Add noise to image
   */
  private addNoise(imageData: ImageData, amount: number): void {
    const { data } = imageData;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * amount;
      
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.max(0, Math.min(255, data[i + c] + noise));
      }
    }
  }

  /**
   * Apply thermal imaging effect
   */
  applyThermalImaging(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const output = new ImageData(width, height);
    
    for (let i = 0; i < data.length; i += 4) {
      // Calculate intensity based on brightness
      const intensity = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
      
      // Map to thermal color gradient
      let r, g, b;
      
      if (intensity < 0.25) {
        // Black to blue
        r = 0;
        g = 0;
        b = intensity * 4 * 255;
      } else if (intensity < 0.5) {
        // Blue to green
        const t = (intensity - 0.25) * 4;
        r = 0;
        g = t * 255;
        b = (1 - t) * 255;
      } else if (intensity < 0.75) {
        // Green to yellow
        const t = (intensity - 0.5) * 4;
        r = t * 255;
        g = 255;
        b = 0;
      } else {
        // Yellow to white
        const t = (intensity - 0.75) * 4;
        r = 255;
        g = 255;
        b = t * 255;
      }
      
      output.data[i] = r;
      output.data[i + 1] = g;
      output.data[i + 2] = b;
      output.data[i + 3] = data[i + 3];
    }
    
    return output;
  }
}