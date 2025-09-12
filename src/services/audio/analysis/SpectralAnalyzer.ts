/**
 * Spectral Analyzer
 * Advanced spectral analysis and visualization
 */

import { SpectralData, SpectrogramConfig, SpectralFeatures } from '../types';
import { logger } from '../../../utils/logger';

export class SpectralAnalyzer {
  private context: AudioContext;
  private analyser: AnalyserNode;
  private config: SpectrogramConfig;
  
  // Buffers for analysis
  private frequencyData: Float32Array;
  private timeDomainData: Float32Array;
  private spectrogramData: number[][] = [];
  private spectrogramMaxSize: number = 1000;
  
  // FFT windows
  private windowFunctions: { [key: string]: Float32Array };
  
  constructor(context: AudioContext, config?: Partial<SpectrogramConfig>) {
    this.context = context;
    
    this.config = {
      fftSize: 2048,
      hopSize: 512,
      windowFunction: 'hann',
      colorMap: 'viridis',
      minDecibels: -90,
      maxDecibels: -10,
      ...config
    };
    
    this.setupAnalyser();
    this.initializeWindowFunctions();
  }

  /**
   * Set up analyser node
   */
  private setupAnalyser(): void {
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = this.config.minDecibels;
    this.analyser.maxDecibels = this.config.maxDecibels;
    
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Float32Array(this.analyser.fftSize);
  }

  /**
   * Initialize window functions
   */
  private initializeWindowFunctions(): void {
    const size = this.config.fftSize;
    
    this.windowFunctions = {
      hann: this.generateHannWindow(size),
      hamming: this.generateHammingWindow(size),
      blackman: this.generateBlackmanWindow(size),
      bartlett: this.generateBartlettWindow(size)
    };
  }

  /**
   * Generate Hann window
   */
  private generateHannWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
    }
    return window;
  }

  /**
   * Generate Hamming window
   */
  private generateHammingWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
    }
    return window;
  }

  /**
   * Generate Blackman window
   */
  private generateBlackmanWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)) +
                  0.08 * Math.cos(4 * Math.PI * i / (size - 1));
    }
    return window;
  }

  /**
   * Generate Bartlett window
   */
  private generateBartlettWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    const halfSize = size / 2;
    for (let i = 0; i < size; i++) {
      window[i] = i < halfSize ? 2 * i / (size - 1) : 2 - 2 * i / (size - 1);
    }
    return window;
  }

  /**
   * Get input node
   */
  getInput(): AudioNode {
    return this.analyser;
  }

  /**
   * Get spectral data
   */
  getData(): SpectralData {
    // Update buffers
    this.analyser.getFloatFrequencyData(this.frequencyData);
    this.analyser.getFloatTimeDomainData(this.timeDomainData);
    
    // Update spectrogram
    this.updateSpectrogram();
    
    // Calculate metrics
    const peak = this.calculatePeak();
    const rms = this.calculateRMS();
    
    return {
      frequencies: this.frequencyData,
      timeDomain: this.timeDomainData,
      spectrum: this.spectrogramData,
      peak,
      rms
    };
  }

  /**
   * Update spectrogram data
   */
  private updateSpectrogram(): void {
    // Add current frequency data to spectrogram
    const currentSpectrum = Array.from(this.frequencyData);
    this.spectrogramData.push(currentSpectrum);
    
    // Limit spectrogram size
    if (this.spectrogramData.length > this.spectrogramMaxSize) {
      this.spectrogramData.shift();
    }
  }

  /**
   * Calculate peak amplitude
   */
  private calculatePeak(): number {
    let peak = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const abs = Math.abs(this.timeDomainData[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  /**
   * Calculate RMS
   */
  private calculateRMS(): number {
    let sum = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      sum += this.timeDomainData[i] * this.timeDomainData[i];
    }
    return Math.sqrt(sum / this.timeDomainData.length);
  }

  /**
   * Extract spectral features
   */
  extractFeatures(): SpectralFeatures {
    const centroid = this.calculateSpectralCentroid();
    const spread = this.calculateSpectralSpread(centroid);
    const flux = this.calculateSpectralFlux();
    const rolloff = this.calculateSpectralRolloff();
    const flatness = this.calculateSpectralFlatness();
    const energy = this.calculateSpectralEnergy();
    const zcr = this.calculateZeroCrossingRate();
    const mfcc = this.calculateMFCC();
    
    return {
      centroid,
      spread,
      flux,
      rolloff,
      flatness,
      energy,
      zcr,
      mfcc
    };
  }

  /**
   * Calculate spectral centroid
   */
  private calculateSpectralCentroid(): number {
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = Math.pow(10, this.frequencyData[i] / 20);
      const frequency = i * this.context.sampleRate / this.config.fftSize;
      numerator += frequency * magnitude;
      denominator += magnitude;
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate spectral spread
   */
  private calculateSpectralSpread(centroid: number): number {
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = Math.pow(10, this.frequencyData[i] / 20);
      const frequency = i * this.context.sampleRate / this.config.fftSize;
      numerator += Math.pow(frequency - centroid, 2) * magnitude;
      denominator += magnitude;
    }
    
    return denominator > 0 ? Math.sqrt(numerator / denominator) : 0;
  }

  /**
   * Calculate spectral flux
   */
  private calculateSpectralFlux(): number {
    // This would compare with previous frame
    // For now, return energy change approximation
    let flux = 0;
    for (let i = 1; i < this.frequencyData.length; i++) {
      const diff = this.frequencyData[i] - this.frequencyData[i - 1];
      flux += diff * diff;
    }
    return Math.sqrt(flux);
  }

  /**
   * Calculate spectral rolloff
   */
  private calculateSpectralRolloff(threshold: number = 0.85): number {
    let totalEnergy = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      totalEnergy += Math.pow(10, this.frequencyData[i] / 20);
    }
    
    let cumulativeEnergy = 0;
    const targetEnergy = totalEnergy * threshold;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      cumulativeEnergy += Math.pow(10, this.frequencyData[i] / 20);
      if (cumulativeEnergy >= targetEnergy) {
        return i * this.context.sampleRate / this.config.fftSize;
      }
    }
    
    return this.context.sampleRate / 2;
  }

  /**
   * Calculate spectral flatness
   */
  private calculateSpectralFlatness(): number {
    let geometricMean = 0;
    let arithmeticMean = 0;
    let count = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = Math.pow(10, this.frequencyData[i] / 20);
      if (magnitude > 0) {
        geometricMean += Math.log(magnitude);
        arithmeticMean += magnitude;
        count++;
      }
    }
    
    if (count === 0) return 0;
    
    geometricMean = Math.exp(geometricMean / count);
    arithmeticMean = arithmeticMean / count;
    
    return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  }

  /**
   * Calculate spectral energy
   */
  private calculateSpectralEnergy(): number {
    let energy = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = Math.pow(10, this.frequencyData[i] / 20);
      energy += magnitude * magnitude;
    }
    return energy;
  }

  /**
   * Calculate zero crossing rate
   */
  private calculateZeroCrossingRate(): number {
    let crossings = 0;
    for (let i = 1; i < this.timeDomainData.length; i++) {
      if ((this.timeDomainData[i] >= 0) !== (this.timeDomainData[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / this.timeDomainData.length;
  }

  /**
   * Calculate MFCC (simplified)
   */
  private calculateMFCC(numCoefficients: number = 13): number[] {
    // Simplified MFCC calculation
    // In production, use a proper MFCC library
    
    const mfcc: number[] = [];
    const melFilters = this.createMelFilterBank();
    
    // Apply mel filters
    const melSpectrum = new Float32Array(melFilters.length);
    for (let i = 0; i < melFilters.length; i++) {
      let sum = 0;
      for (let j = 0; j < this.frequencyData.length; j++) {
        sum += Math.pow(10, this.frequencyData[j] / 20) * melFilters[i][j];
      }
      melSpectrum[i] = Math.log(sum + 1e-10);
    }
    
    // DCT to get MFCCs
    for (let i = 0; i < numCoefficients; i++) {
      let sum = 0;
      for (let j = 0; j < melSpectrum.length; j++) {
        sum += melSpectrum[j] * Math.cos(Math.PI * i * (j + 0.5) / melSpectrum.length);
      }
      mfcc.push(sum);
    }
    
    return mfcc;
  }

  /**
   * Create mel filter bank
   */
  private createMelFilterBank(numFilters: number = 26): Float32Array[] {
    const filters: Float32Array[] = [];
    const nyquist = this.context.sampleRate / 2;
    const melMax = 2595 * Math.log10(1 + nyquist / 700);
    
    for (let i = 0; i < numFilters; i++) {
      const filter = new Float32Array(this.analyser.frequencyBinCount);
      
      // Simplified triangular filter
      const melCenter = (i + 1) * melMax / (numFilters + 1);
      const freqCenter = 700 * (Math.pow(10, melCenter / 2595) - 1);
      const binCenter = Math.floor(freqCenter / (nyquist / this.analyser.frequencyBinCount));
      
      const width = Math.floor(this.analyser.frequencyBinCount / numFilters);
      for (let j = Math.max(0, binCenter - width); j < Math.min(this.analyser.frequencyBinCount, binCenter + width); j++) {
        filter[j] = 1 - Math.abs(j - binCenter) / width;
      }
      
      filters.push(filter);
    }
    
    return filters;
  }

  /**
   * Get frequency at bin
   */
  getFrequencyAtBin(bin: number): number {
    return bin * this.context.sampleRate / this.config.fftSize;
  }

  /**
   * Get bin at frequency
   */
  getBinAtFrequency(frequency: number): number {
    return Math.floor(frequency * this.config.fftSize / this.context.sampleRate);
  }

  /**
   * Find peaks in spectrum
   */
  findPeaks(threshold: number = -30, minDistance: number = 10): Array<{ frequency: number; amplitude: number }> {
    const peaks: Array<{ frequency: number; amplitude: number }> = [];
    
    for (let i = minDistance; i < this.frequencyData.length - minDistance; i++) {
      if (this.frequencyData[i] > threshold) {
        let isPeak = true;
        
        // Check if it's a local maximum
        for (let j = i - minDistance; j <= i + minDistance; j++) {
          if (j !== i && this.frequencyData[j] >= this.frequencyData[i]) {
            isPeak = false;
            break;
          }
        }
        
        if (isPeak) {
          peaks.push({
            frequency: this.getFrequencyAtBin(i),
            amplitude: this.frequencyData[i]
          });
        }
      }
    }
    
    return peaks;
  }

  /**
   * Detect harmonics
   */
  detectHarmonics(fundamental: number, maxHarmonic: number = 10): number[] {
    const harmonics: number[] = [];
    const tolerance = 10; // Hz
    
    for (let n = 1; n <= maxHarmonic; n++) {
      const harmonicFreq = fundamental * n;
      const bin = this.getBinAtFrequency(harmonicFreq);
      
      // Check if there's energy at this harmonic
      if (bin < this.frequencyData.length) {
        const amplitude = this.frequencyData[bin];
        if (amplitude > this.config.minDecibels + 20) {
          harmonics.push(harmonicFreq);
        }
      }
    }
    
    return harmonics;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SpectrogramConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.fftSize) {
      this.analyser.fftSize = config.fftSize;
      this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
      this.timeDomainData = new Float32Array(this.analyser.fftSize);
      this.initializeWindowFunctions();
    }
    
    if (config.minDecibels !== undefined) {
      this.analyser.minDecibels = config.minDecibels;
    }
    
    if (config.maxDecibels !== undefined) {
      this.analyser.maxDecibels = config.maxDecibels;
    }
  }

  /**
   * Clear spectrogram data
   */
  clearSpectrogram(): void {
    this.spectrogramData = [];
  }

  /**
   * Dispose analyzer
   */
  dispose(): void {
    this.analyser.disconnect();
    this.spectrogramData = [];
    logger.info('Spectral analyzer disposed');
  }
}