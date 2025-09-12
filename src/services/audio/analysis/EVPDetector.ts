/**
 * EVP Detector
 * Electronic Voice Phenomena detection and classification
 */

import { EventEmitter } from 'events';
import { 
  EVPDetection, 
  EVPClass, 
  EVPAnalysisConfig,
  SpectralFeatures 
} from '../types';
import { SpectralAnalyzer } from './SpectralAnalyzer';
import { logger } from '../../../utils/logger';

export class EVPDetector extends EventEmitter {
  private context: AudioContext;
  private config: EVPAnalysisConfig;
  private analyzer: SpectralAnalyzer;
  
  // Processing nodes
  private inputGain: GainNode;
  private bandpassFilter: BiquadFilterNode;
  private noiseGate: DynamicsCompressorNode;
  private analyserNode: AnalyserNode;
  
  // Detection state
  private isDetecting: boolean = false;
  private detectionBuffer: Float32Array[] = [];
  private voiceActivityHistory: boolean[] = [];
  private detectionThreshold: number = 0.7;
  
  // Voice characteristics
  private readonly VOICE_FREQ_MIN = 85; // Hz
  private readonly VOICE_FREQ_MAX = 3400; // Hz
  private readonly FORMANT_F1_RANGE = [200, 1000]; // First formant
  private readonly FORMANT_F2_RANGE = [800, 2800]; // Second formant
  
  constructor(context: AudioContext, config?: Partial<EVPAnalysisConfig>) {
    super();
    
    this.context = context;
    this.config = {
      sensitivity: 0.7,
      minFrequency: 100,
      maxFrequency: 4000,
      voiceThreshold: -40,
      noiseGateThreshold: -50,
      classificationThreshold: 0.6,
      ...config
    };
    
    this.setupProcessingChain();
    this.analyzer = new SpectralAnalyzer(context, {
      fftSize: 4096,
      minDecibels: -90,
      maxDecibels: -10
    });
  }

  /**
   * Set up audio processing chain
   */
  private setupProcessingChain(): void {
    // Create nodes
    this.inputGain = this.context.createGain();
    this.bandpassFilter = this.context.createBiquadFilter();
    this.noiseGate = this.context.createDynamicsCompressor();
    this.analyserNode = this.context.createAnalyser();
    
    // Configure bandpass filter for voice frequencies
    this.bandpassFilter.type = 'bandpass';
    this.bandpassFilter.frequency.value = (this.config.minFrequency + this.config.maxFrequency) / 2;
    this.bandpassFilter.Q.value = 1;
    
    // Configure noise gate
    this.noiseGate.threshold.value = this.config.noiseGateThreshold;
    this.noiseGate.knee.value = 0;
    this.noiseGate.ratio.value = 10;
    this.noiseGate.attack.value = 0.001;
    this.noiseGate.release.value = 0.1;
    
    // Configure analyser
    this.analyserNode.fftSize = 4096;
    this.analyserNode.smoothingTimeConstant = 0.3;
    
    // Connect chain
    this.inputGain.connect(this.bandpassFilter);
    this.bandpassFilter.connect(this.noiseGate);
    this.noiseGate.connect(this.analyserNode);
    this.analyserNode.connect(this.analyzer.getInput());
  }

  /**
   * Start EVP detection
   */
  start(sensitivity?: number): void {
    if (this.isDetecting) return;
    
    if (sensitivity !== undefined) {
      this.detectionThreshold = sensitivity;
    }
    
    this.isDetecting = true;
    this.detectionBuffer = [];
    this.voiceActivityHistory = [];
    
    this.startDetectionLoop();
    logger.info('EVP detection started', { sensitivity: this.detectionThreshold });
  }

  /**
   * Stop EVP detection
   */
  stop(): void {
    this.isDetecting = false;
    logger.info('EVP detection stopped');
  }

  /**
   * Main detection loop
   */
  private startDetectionLoop(): void {
    if (!this.isDetecting) return;
    
    const analyze = () => {
      if (!this.isDetecting) return;
      
      // Get spectral data
      const spectralData = this.analyzer.getData();
      const features = this.analyzer.extractFeatures();
      
      // Detect voice activity
      const hasVoice = this.detectVoiceActivity(spectralData.frequencies, features);
      this.voiceActivityHistory.push(hasVoice);
      
      // Keep history limited
      if (this.voiceActivityHistory.length > 100) {
        this.voiceActivityHistory.shift();
      }
      
      // Check for EVP patterns
      if (hasVoice) {
        this.detectionBuffer.push(new Float32Array(spectralData.frequencies));
        
        // Analyze buffer for EVP
        if (this.detectionBuffer.length >= 10) {
          const evp = this.analyzeEVP(this.detectionBuffer, features);
          if (evp) {
            this.emit('evpDetected', evp);
            logger.info('EVP detected', { 
              class: evp.classification,
              confidence: evp.confidence 
            });
          }
          
          // Clear buffer after analysis
          this.detectionBuffer = [];
        }
      }
      
      // Continue loop
      requestAnimationFrame(analyze);
    };
    
    analyze();
  }

  /**
   * Detect voice activity
   */
  private detectVoiceActivity(frequencies: Float32Array, features: SpectralFeatures): boolean {
    // Check energy in voice frequency range
    const voiceRangeEnergy = this.calculateBandEnergy(
      frequencies,
      this.VOICE_FREQ_MIN,
      this.VOICE_FREQ_MAX
    );
    
    // Check for voice characteristics
    const hasVoiceEnergy = voiceRangeEnergy > this.config.voiceThreshold;
    const hasVoicePattern = this.detectVoicePattern(frequencies);
    const hasFormants = this.detectFormants(frequencies);
    
    // Check spectral features
    const voiceFeatures = 
      features.centroid > 200 && features.centroid < 2000 &&
      features.zcr > 0.01 && features.zcr < 0.1 &&
      features.flatness < 0.5;
    
    // Combine criteria
    const voiceScore = 
      (hasVoiceEnergy ? 0.3 : 0) +
      (hasVoicePattern ? 0.3 : 0) +
      (hasFormants ? 0.2 : 0) +
      (voiceFeatures ? 0.2 : 0);
    
    return voiceScore >= this.detectionThreshold;
  }

  /**
   * Calculate energy in frequency band
   */
  private calculateBandEnergy(frequencies: Float32Array, minFreq: number, maxFreq: number): number {
    const minBin = this.analyzer.getBinAtFrequency(minFreq);
    const maxBin = this.analyzer.getBinAtFrequency(maxFreq);
    
    let energy = 0;
    for (let i = minBin; i <= maxBin && i < frequencies.length; i++) {
      energy += Math.pow(10, frequencies[i] / 20);
    }
    
    return 20 * Math.log10(energy + 1e-10);
  }

  /**
   * Detect voice pattern
   */
  private detectVoicePattern(frequencies: Float32Array): boolean {
    // Look for harmonic structure typical of voice
    const peaks = this.analyzer.findPeaks(-40, 5);
    
    if (peaks.length < 3) return false;
    
    // Check for harmonic relationship
    const fundamentalCandidates = peaks.filter(p => 
      p.frequency >= this.VOICE_FREQ_MIN && p.frequency <= 500
    );
    
    for (const fundamental of fundamentalCandidates) {
      const harmonics = this.analyzer.detectHarmonics(fundamental.frequency, 5);
      if (harmonics.length >= 3) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Detect formants
   */
  private detectFormants(frequencies: Float32Array): boolean {
    const peaks = this.analyzer.findPeaks(-30, 20);
    
    // Look for F1 and F2 formants
    const f1Candidates = peaks.filter(p => 
      p.frequency >= this.FORMANT_F1_RANGE[0] && 
      p.frequency <= this.FORMANT_F1_RANGE[1]
    );
    
    const f2Candidates = peaks.filter(p => 
      p.frequency >= this.FORMANT_F2_RANGE[0] && 
      p.frequency <= this.FORMANT_F2_RANGE[1]
    );
    
    return f1Candidates.length > 0 && f2Candidates.length > 0;
  }

  /**
   * Analyze EVP
   */
  private analyzeEVP(
    buffer: Float32Array[], 
    features: SpectralFeatures
  ): EVPDetection | null {
    // Calculate average spectrum
    const avgSpectrum = this.calculateAverageSpectrum(buffer);
    
    // Extract EVP characteristics
    const confidence = this.calculateEVPConfidence(avgSpectrum, features);
    const classification = this.classifyEVP(avgSpectrum, confidence);
    
    if (confidence < this.config.classificationThreshold) {
      return null;
    }
    
    // Find dominant frequency
    const peaks = this.analyzer.findPeaks(-30, 10);
    const dominantFreq = peaks.length > 0 ? peaks[0].frequency : 0;
    
    // Calculate amplitude
    let maxAmplitude = -Infinity;
    for (const spectrum of buffer) {
      for (const value of spectrum) {
        if (value > maxAmplitude) maxAmplitude = value;
      }
    }
    
    return {
      timestamp: Date.now(),
      duration: buffer.length * (this.analyserNode.fftSize / this.context.sampleRate),
      confidence,
      classification,
      frequency: dominantFreq,
      amplitude: maxAmplitude,
      spectralFeatures: features
    };
  }

  /**
   * Calculate average spectrum
   */
  private calculateAverageSpectrum(buffer: Float32Array[]): Float32Array {
    if (buffer.length === 0) return new Float32Array(0);
    
    const avgSpectrum = new Float32Array(buffer[0].length);
    
    for (const spectrum of buffer) {
      for (let i = 0; i < spectrum.length; i++) {
        avgSpectrum[i] += spectrum[i];
      }
    }
    
    for (let i = 0; i < avgSpectrum.length; i++) {
      avgSpectrum[i] /= buffer.length;
    }
    
    return avgSpectrum;
  }

  /**
   * Calculate EVP confidence
   */
  private calculateEVPConfidence(
    spectrum: Float32Array, 
    features: SpectralFeatures
  ): number {
    let confidence = 0;
    
    // Check signal-to-noise ratio
    const snr = this.calculateSNR(spectrum);
    if (snr > 10) confidence += 0.3;
    else if (snr > 5) confidence += 0.15;
    
    // Check for voice-like features
    if (features.centroid > 300 && features.centroid < 1500) confidence += 0.2;
    if (features.zcr > 0.02 && features.zcr < 0.08) confidence += 0.15;
    if (features.flatness < 0.3) confidence += 0.15;
    
    // Check for anomalous patterns
    const hasAnomaly = this.detectSpectralAnomaly(spectrum);
    if (hasAnomaly) confidence += 0.2;
    
    return Math.min(1, confidence);
  }

  /**
   * Calculate signal-to-noise ratio
   */
  private calculateSNR(spectrum: Float32Array): number {
    // Find signal peak
    let signalPeak = -Infinity;
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > signalPeak) signalPeak = spectrum[i];
    }
    
    // Estimate noise floor (median of lower values)
    const sorted = Array.from(spectrum).sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.5)];
    
    return signalPeak - noiseFloor;
  }

  /**
   * Detect spectral anomaly
   */
  private detectSpectralAnomaly(spectrum: Float32Array): boolean {
    // Look for unusual patterns
    let anomalyScore = 0;
    
    // Check for sudden spikes
    for (let i = 1; i < spectrum.length - 1; i++) {
      const diff = spectrum[i] - (spectrum[i-1] + spectrum[i+1]) / 2;
      if (diff > 20) anomalyScore++;
    }
    
    // Check for unusual energy distribution
    const lowEnergy = this.calculateBandEnergy(spectrum, 0, 500);
    const midEnergy = this.calculateBandEnergy(spectrum, 500, 2000);
    const highEnergy = this.calculateBandEnergy(spectrum, 2000, 8000);
    
    if (midEnergy > lowEnergy + 10 && midEnergy > highEnergy + 10) {
      anomalyScore += 5;
    }
    
    return anomalyScore > 5;
  }

  /**
   * Classify EVP
   */
  private classifyEVP(spectrum: Float32Array, confidence: number): EVPClass {
    const snr = this.calculateSNR(spectrum);
    
    if (confidence > 0.8 && snr > 20) {
      return EVPClass.CLASS_A; // Clear and easily understood
    } else if (confidence > 0.6 && snr > 10) {
      return EVPClass.CLASS_B; // Fairly loud, might need interpretation
    } else if (confidence > 0.4 && snr > 5) {
      return EVPClass.CLASS_C; // Faint, requires amplification
    } else {
      return EVPClass.UNKNOWN;
    }
  }

  /**
   * Get input node
   */
  getInput(): AudioNode {
    return this.inputGain;
  }

  /**
   * Connect to source
   */
  connect(source: AudioNode): void {
    source.connect(this.inputGain);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EVPAnalysisConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update filter
    if (config.minFrequency || config.maxFrequency) {
      const min = this.config.minFrequency;
      const max = this.config.maxFrequency;
      this.bandpassFilter.frequency.value = (min + max) / 2;
    }
    
    // Update noise gate
    if (config.noiseGateThreshold !== undefined) {
      this.noiseGate.threshold.value = config.noiseGateThreshold;
    }
    
    logger.info('EVP detector configuration updated', config);
  }

  /**
   * Get detection statistics
   */
  getStats(): {
    isDetecting: boolean;
    bufferSize: number;
    voiceActivityRate: number;
  } {
    const voiceCount = this.voiceActivityHistory.filter(v => v).length;
    const voiceActivityRate = this.voiceActivityHistory.length > 0 ?
      voiceCount / this.voiceActivityHistory.length : 0;
    
    return {
      isDetecting: this.isDetecting,
      bufferSize: this.detectionBuffer.length,
      voiceActivityRate
    };
  }

  /**
   * Dispose detector
   */
  dispose(): void {
    this.stop();
    this.inputGain.disconnect();
    this.bandpassFilter.disconnect();
    this.noiseGate.disconnect();
    this.analyserNode.disconnect();
    this.analyzer.dispose();
    this.removeAllListeners();
    
    logger.info('EVP detector disposed');
  }
}