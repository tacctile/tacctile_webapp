/**
 * SpectrogramService - Web Audio API-based spectrogram generation and rendering
 * Generates spectrogram data using AnalyserNode and renders to Canvas
 */

import type { SpectrogramSettings } from '../../types/audio';
import { COLOR_MAPS, DEFAULT_SPECTROGRAM_SETTINGS } from '../../types/audio';

// ============================================================================
// TYPES
// ============================================================================

export interface SpectrogramData {
  /** 2D array of magnitude values [time][frequency] */
  magnitudes: Float32Array[];
  /** Time stamps for each column */
  times: number[];
  /** Frequency bins */
  frequencies: number[];
  /** Sample rate */
  sampleRate: number;
  /** Duration in seconds */
  duration: number;
  /** FFT size used */
  fftSize: number;
}

export interface SpectrogramRenderOptions {
  canvas: HTMLCanvasElement;
  data: SpectrogramData;
  settings: SpectrogramSettings;
  startTime?: number;
  endTime?: number;
  width?: number;
  height?: number;
}

// ============================================================================
// WINDOW FUNCTIONS
// ============================================================================

const windowFunctions = {
  rectangular: (_n: number, _N: number) => 1,
  hann: (n: number, N: number) => 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1))),
  hamming: (n: number, N: number) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1)),
  blackman: (n: number, N: number) =>
    0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (N - 1)),
  bartlett: (n: number, N: number) => 1 - Math.abs((2 * n - N + 1) / (N - 1)),
};

// ============================================================================
// COLOR INTERPOLATION
// ============================================================================

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result && result[1] && result[2] && result[3]) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  }
  return [0, 0, 0];
}

function interpolateColors(colors: string[], t: number): [number, number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const idx = t * (colors.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.min(lower + 1, colors.length - 1);
  const blend = idx - lower;

  const c1 = hexToRgb(colors[lower]);
  const c2 = hexToRgb(colors[upper]);

  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * blend),
    Math.round(c1[1] + (c2[1] - c1[1]) * blend),
    Math.round(c1[2] + (c2[2] - c1[2]) * blend),
    255,
  ];
}

// ============================================================================
// FREQUENCY SCALE CONVERSIONS
// ============================================================================

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

function frequencyToY(
  freq: number,
  height: number,
  minFreq: number,
  maxFreq: number,
  scale: SpectrogramSettings['frequencyScale']
): number {
  let normalizedFreq: number;

  switch (scale) {
    case 'logarithmic':
      // Log scale (more resolution at lower frequencies)
      const logMin = Math.log10(Math.max(minFreq, 20));
      const logMax = Math.log10(maxFreq);
      const logFreq = Math.log10(Math.max(freq, 20));
      normalizedFreq = (logFreq - logMin) / (logMax - logMin);
      break;
    case 'mel':
      // Mel scale (perceptually uniform)
      const melMin = hzToMel(minFreq);
      const melMax = hzToMel(maxFreq);
      const melFreq = hzToMel(freq);
      normalizedFreq = (melFreq - melMin) / (melMax - melMin);
      break;
    case 'linear':
    default:
      normalizedFreq = (freq - minFreq) / (maxFreq - minFreq);
  }

  // Invert because canvas y=0 is at top
  return height - normalizedFreq * height;
}

function yToFrequency(
  y: number,
  height: number,
  minFreq: number,
  maxFreq: number,
  scale: SpectrogramSettings['frequencyScale']
): number {
  // Invert because canvas y=0 is at top
  const normalizedY = 1 - y / height;

  switch (scale) {
    case 'logarithmic':
      const logMin = Math.log10(Math.max(minFreq, 20));
      const logMax = Math.log10(maxFreq);
      return Math.pow(10, logMin + normalizedY * (logMax - logMin));
    case 'mel':
      const melMin = hzToMel(minFreq);
      const melMax = hzToMel(maxFreq);
      return melToHz(melMin + normalizedY * (melMax - melMin));
    case 'linear':
    default:
      return minFreq + normalizedY * (maxFreq - minFreq);
  }
}

// ============================================================================
// SPECTROGRAM SERVICE CLASS
// ============================================================================

class SpectrogramService {
  private audioContext: AudioContext | null = null;

  // Cache for computed spectrogram data
  private cache: Map<string, SpectrogramData> = new Map();

  /**
   * Initialize Web Audio API context
   */
  async init(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    }
  }

  /**
   * Generate spectrogram data from an AudioBuffer
   */
  async generateSpectrogramData(
    audioBuffer: AudioBuffer,
    settings: SpectrogramSettings = DEFAULT_SPECTROGRAM_SETTINGS
  ): Promise<SpectrogramData> {
    await this.init();

    const { fftSize, overlap, windowFunction } = settings;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const totalSamples = channelData.length;
    const duration = totalSamples / sampleRate;

    // Calculate hop size based on overlap
    const hopSize = Math.round(fftSize * (1 - overlap));
    const numFrames = Math.floor((totalSamples - fftSize) / hopSize) + 1;

    // Prepare window function
    const window = new Float32Array(fftSize);
    const windowFunc = windowFunctions[windowFunction];
    for (let i = 0; i < fftSize; i++) {
      window[i] = windowFunc(i, fftSize);
    }

    // Create offline context for FFT processing
    const offlineContext = new OfflineAudioContext(1, fftSize, sampleRate);

    const magnitudes: Float32Array[] = [];
    const times: number[] = [];
    const frequencyBinCount = fftSize / 2;

    // Process each frame
    for (let frame = 0; frame < numFrames; frame++) {
      const startSample = frame * hopSize;
      const frameTime = startSample / sampleRate;
      times.push(frameTime);

      // Extract and window the frame
      const frameData = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        const sampleIndex = startSample + i;
        if (sampleIndex < totalSamples) {
          frameData[i] = channelData[sampleIndex] * window[i];
        }
      }

      // Compute FFT using Web Audio API
      const magnitudeData = await this.computeFFT(frameData, sampleRate);
      magnitudes.push(magnitudeData);
    }

    // Calculate frequency bins
    const frequencies: number[] = [];
    const freqStep = sampleRate / fftSize;
    for (let i = 0; i < frequencyBinCount; i++) {
      frequencies.push(i * freqStep);
    }

    return {
      magnitudes,
      times,
      frequencies,
      sampleRate,
      duration,
      fftSize,
    };
  }

  /**
   * Compute FFT magnitude spectrum for a single frame
   */
  private async computeFFT(frameData: Float32Array, sampleRate: number): Promise<Float32Array> {
    const fftSize = frameData.length;
    const frequencyBinCount = fftSize / 2;

    // Use a simple DFT implementation for accurate results
    // Web Audio API's AnalyserNode has limitations for offline processing
    const magnitudes = new Float32Array(frequencyBinCount);

    for (let k = 0; k < frequencyBinCount; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        real += frameData[n] * Math.cos(angle);
        imag -= frameData[n] * Math.sin(angle);
      }
      // Convert to magnitude in dB
      const magnitude = Math.sqrt(real * real + imag * imag) / fftSize;
      magnitudes[k] = 20 * Math.log10(Math.max(magnitude, 1e-10));
    }

    return magnitudes;
  }

  /**
   * Render spectrogram data to canvas
   */
  renderSpectrogram(options: SpectrogramRenderOptions): void {
    const {
      canvas,
      data,
      settings,
      startTime = 0,
      endTime = data.duration,
      width = canvas.width,
      height = canvas.height,
    } = options;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    const { minDecibels, maxDecibels, colorMap, contrast, brightness, minFrequency, maxFrequency, frequencyScale } = settings;
    const colors = COLOR_MAPS[colorMap];

    // Create image data for efficient rendering
    const imageData = ctx.createImageData(width, height);
    const pixels = imageData.data;

    // Calculate visible time range
    const visibleDuration = endTime - startTime;
    const pixelsPerSecond = width / visibleDuration;

    // Find frame indices for visible range
    const startFrameIdx = data.times.findIndex((t) => t >= startTime);
    const endFrameIdx = data.times.findIndex((t) => t > endTime);
    const visibleFrames = data.magnitudes.slice(
      Math.max(0, startFrameIdx),
      endFrameIdx === -1 ? data.magnitudes.length : endFrameIdx
    );
    const visibleTimes = data.times.slice(
      Math.max(0, startFrameIdx),
      endFrameIdx === -1 ? data.times.length : endFrameIdx
    );

    // Find frequency bin indices for visible range
    const minBin = data.frequencies.findIndex((f) => f >= minFrequency);
    const maxBin = data.frequencies.findIndex((f) => f > maxFrequency);
    const maxBinIdx = maxBin === -1 ? data.frequencies.length - 1 : maxBin - 1;
    const frequencyBins = maxBinIdx - minBin + 1;

    // Render each pixel
    for (let x = 0; x < width; x++) {
      // Find the corresponding time and frame
      const time = startTime + (x / width) * visibleDuration;

      // Find closest frame
      let frameIdx = 0;
      for (let i = 0; i < visibleTimes.length - 1; i++) {
        if (visibleTimes[i + 1] > time) {
          frameIdx = i;
          break;
        }
        frameIdx = i;
      }

      const frame = visibleFrames[frameIdx];
      if (!frame) continue;

      for (let y = 0; y < height; y++) {
        // Convert y to frequency
        const frequency = yToFrequency(y, height, minFrequency, maxFrequency, frequencyScale);

        // Find closest frequency bin
        let binIdx = minBin;
        for (let i = minBin; i <= maxBinIdx; i++) {
          if (data.frequencies[i] > frequency) {
            binIdx = Math.max(minBin, i - 1);
            break;
          }
          binIdx = i;
        }

        // Get magnitude value
        let magnitude = frame[binIdx] ?? minDecibels;

        // Apply contrast and brightness
        let normalizedMag = (magnitude - minDecibels) / (maxDecibels - minDecibels);
        normalizedMag = Math.pow(normalizedMag, 1 / contrast);
        normalizedMag = normalizedMag + brightness;
        normalizedMag = Math.max(0, Math.min(1, normalizedMag));

        // Map to color
        const [r, g, b, a] = interpolateColors(colors, normalizedMag);

        // Set pixel
        const pixelIdx = (y * width + x) * 4;
        pixels[pixelIdx] = r;
        pixels[pixelIdx + 1] = g;
        pixels[pixelIdx + 2] = b;
        pixels[pixelIdx + 3] = a;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Generate and cache spectrogram data with a unique key
   */
  async getOrGenerateSpectrogram(
    audioBuffer: AudioBuffer,
    settings: SpectrogramSettings,
    cacheKey?: string
  ): Promise<SpectrogramData> {
    const key = cacheKey || `${audioBuffer.length}-${audioBuffer.sampleRate}-${JSON.stringify(settings)}`;

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const data = await this.generateSpectrogramData(audioBuffer, settings);
    this.cache.set(key, data);
    return data;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Draw frequency axis labels
   */
  drawFrequencyAxis(
    canvas: HTMLCanvasElement,
    settings: SpectrogramSettings,
    textColor = '#aaaaaa'
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { minFrequency, maxFrequency, frequencyScale } = settings;
    const height = canvas.height;

    ctx.fillStyle = textColor;
    ctx.font = '11px Manrope, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Generate frequency labels
    const labels: number[] = [];
    if (frequencyScale === 'logarithmic' || frequencyScale === 'mel') {
      // Logarithmic labels
      const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      labels.push(...freqs.filter((f) => f >= minFrequency && f <= maxFrequency));
    } else {
      // Linear labels
      const step = (maxFrequency - minFrequency) / 8;
      for (let f = minFrequency; f <= maxFrequency; f += step) {
        labels.push(Math.round(f));
      }
    }

    // Draw labels
    for (const freq of labels) {
      const y = frequencyToY(freq, height, minFrequency, maxFrequency, frequencyScale);
      const label = freq >= 1000 ? `${(freq / 1000).toFixed(freq >= 10000 ? 0 : 1)}k` : `${freq}`;
      ctx.fillText(label, canvas.width - 4, y);
    }
  }

  /**
   * Draw time axis labels
   */
  drawTimeAxis(
    canvas: HTMLCanvasElement,
    duration: number,
    startTime = 0,
    textColor = '#aaaaaa'
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const visibleDuration = duration - startTime;

    ctx.fillStyle = textColor;
    ctx.font = '11px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Generate time labels
    const numLabels = Math.min(10, Math.max(4, Math.floor(visibleDuration)));
    const step = visibleDuration / numLabels;

    for (let i = 0; i <= numLabels; i++) {
      const time = startTime + i * step;
      const x = (i / numLabels) * width;
      const label = formatTime(time);
      ctx.fillText(label, x, canvas.height - 16);
    }
  }

  /**
   * Get frequency at a Y position
   */
  getFrequencyAtY(y: number, height: number, settings: SpectrogramSettings): number {
    return yToFrequency(y, height, settings.minFrequency, settings.maxFrequency, settings.frequencyScale);
  }

  /**
   * Get Y position for a frequency
   */
  getYForFrequency(frequency: number, height: number, settings: SpectrogramSettings): number {
    return frequencyToY(frequency, height, settings.minFrequency, settings.maxFrequency, settings.frequencyScale);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.cache.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${secs}.${ms.toString().padStart(2, '0')}`;
}

// Export singleton instance
export const spectrogramService = new SpectrogramService();
export default spectrogramService;
