import { EventEmitter } from 'events';
import { standardize } from 'standardized-audio-context';
import Meyda from 'meyda';

export interface AudioProcessingConfig {
  sampleRate: number;
  bufferSize: number;
  fftSize: number;
  windowFunction: 'blackman' | 'hamming' | 'hanning' | 'rectangular';
  enableNoiseReduction: boolean;
  enableAutoGainControl: boolean;
  enableCompression: boolean;
  enableEqualizer: boolean;
  noiseGateThreshold: number;
  compressionRatio: number;
  compressionThreshold: number;
  highPassCutoff: number;
  lowPassCutoff: number;
}

export interface NoiseProfile {
  frequencyBins: Float32Array;
  noiseFloor: number;
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlatness: number;
  timestamp: number;
}

export interface AudioFeatures {
  rms: number;
  zcr: number;
  spectralCentroid: number;
  spectralRolloff: number;
  spectralBandwidth: number;
  spectralFlatness: number;
  spectralCrest: number;
  mfcc: number[];
  chroma: number[];
  tonnetz: number[];
  energy: number;
  fundamentalFrequency: number;
  harmonics: number[];
  formants: number[];
}

export interface AudioSegment {
  startTime: number;
  endTime: number;
  duration: number;
  features: AudioFeatures;
  rawAudio: Float32Array;
  processedAudio: Float32Array;
  signalToNoiseRatio: number;
  confidence: number;
  anomalyScore: number;
}

export interface NoiseReductionSettings {
  enabled: boolean;
  aggressiveness: number; // 0-1
  preserveVoice: boolean;
  spectralSubtraction: boolean;
  spectralGating: boolean;
  adaptiveThreshold: boolean;
  learningRate: number;
}

export interface EqualizerBand {
  frequency: number;
  gain: number;
  q: number;
  type: 'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch';
}

export class AudioProcessor extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioNode | null = null;
  private outputNode: AudioNode | null = null;
  
  // Audio processing nodes
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private noiseGateNode: AudioNode | null = null;
  private equalizerNodes: BiquadFilterNode[] = [];
  
  // Analysis nodes
  private analyserNode: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  
  // Processing data
  private config: AudioProcessingConfig;
  private noiseProfile: NoiseProfile | null = null;
  private isLearningNoise = false;
  private noiseReductionSettings: NoiseReductionSettings;
  private equalizerBands: EqualizerBand[];
  
  // Buffers and analysis
  private frequencyData: Float32Array = new Float32Array();
  private timeData: Float32Array = new Float32Array();
  private processedBuffer: Float32Array = new Float32Array();
  private noiseBuffer: Float32Array[] = [];
  private maxNoiseBuffers = 10;
  
  // Features and segments
  private audioSegments: AudioSegment[] = [];
  private currentSegment: AudioSegment | null = null;
  private segmentStartTime = 0;
  private minSegmentDuration = 100; // ms
  private maxSegmentDuration = 5000; // ms

  constructor(config: Partial<AudioProcessingConfig> = {}) {
    super();

    this.config = {
      sampleRate: 44100,
      bufferSize: 4096,
      fftSize: 8192,
      windowFunction: 'hanning',
      enableNoiseReduction: true,
      enableAutoGainControl: true,
      enableCompression: true,
      enableEqualizer: true,
      noiseGateThreshold: -40,
      compressionRatio: 4,
      compressionThreshold: -24,
      highPassCutoff: 80,
      lowPassCutoff: 8000,
      ...config
    };

    this.noiseReductionSettings = {
      enabled: true,
      aggressiveness: 0.6,
      preserveVoice: true,
      spectralSubtraction: true,
      spectralGating: true,
      adaptiveThreshold: true,
      learningRate: 0.1
    };

    // Default 5-band EQ settings optimized for voice
    this.equalizerBands = [
      { frequency: 100, gain: 0, q: 1, type: 'highpass' },
      { frequency: 200, gain: 2, q: 1, type: 'peaking' },
      { frequency: 1000, gain: 3, q: 1, type: 'peaking' },
      { frequency: 3000, gain: 4, q: 1, type: 'peaking' },
      { frequency: 8000, gain: -2, q: 1, type: 'lowpass' }
    ];
  }

  public async initialize(sourceNode: AudioNode): Promise<void> {
    try {
      this.audioContext = sourceNode.context as AudioContext;
      this.sourceNode = sourceNode;

      await this.createProcessingChain();
      this.setupAnalysis();
      this.initializeMeyda();

      this.emit('initialized', {
        sampleRate: this.config.sampleRate,
        bufferSize: this.config.bufferSize,
        fftSize: this.config.fftSize
      });

    } catch (error) {
      this.emit('error', `Failed to initialize audio processor: ${error}`);
      throw error;
    }
  }

  private async createProcessingChain(): Promise<void> {
    if (!this.audioContext || !this.sourceNode) {
      throw new Error('Audio context or source node not available');
    }

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;

    // Create high-pass filter to remove low-frequency noise
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = this.config.highPassCutoff;
    this.highPassFilter.Q.value = 1;

    // Create low-pass filter for anti-aliasing
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = this.config.lowPassCutoff;
    this.lowPassFilter.Q.value = 1;

    // Create compressor for dynamic range control
    if (this.config.enableCompression) {
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.value = this.config.compressionThreshold;
      this.compressorNode.ratio.value = this.config.compressionRatio;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;
    }

    // Create equalizer nodes
    if (this.config.enableEqualizer) {
      this.createEqualizerNodes();
    }

    // Create analyser for frequency analysis
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.config.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.analyserNode.minDecibels = -100;
    this.analyserNode.maxDecibels = -10;

    // Create script processor for custom processing
    this.scriptProcessor = this.audioContext.createScriptProcessor(
      this.config.bufferSize, 1, 1
    );

    // Connect the processing chain
    this.connectProcessingChain();

    // Initialize data arrays
    this.frequencyData = new Float32Array(this.analyserNode.frequencyBinCount);
    this.timeData = new Float32Array(this.analyserNode.fftSize);
    this.processedBuffer = new Float32Array(this.config.bufferSize);
  }

  private createEqualizerNodes(): void {
    if (!this.audioContext) return;

    this.equalizerNodes = this.equalizerBands.map(band => {
      const filter = this.audioContext!.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = band.q;
      return filter;
    });
  }

  private connectProcessingChain(): void {
    if (!this.sourceNode) return;

    let currentNode: AudioNode = this.sourceNode;

    // Connect gain
    if (this.gainNode) {
      currentNode.connect(this.gainNode);
      currentNode = this.gainNode;
    }

    // Connect high-pass filter
    if (this.highPassFilter) {
      currentNode.connect(this.highPassFilter);
      currentNode = this.highPassFilter;
    }

    // Connect equalizer chain
    if (this.equalizerNodes.length > 0) {
      this.equalizerNodes.forEach(eqNode => {
        currentNode.connect(eqNode);
        currentNode = eqNode;
      });
    }

    // Connect compressor
    if (this.compressorNode) {
      currentNode.connect(this.compressorNode);
      currentNode = this.compressorNode;
    }

    // Connect low-pass filter
    if (this.lowPassFilter) {
      currentNode.connect(this.lowPassFilter);
      currentNode = this.lowPassFilter;
    }

    // Connect to analyser and script processor for analysis
    if (this.analyserNode) {
      currentNode.connect(this.analyserNode);
    }

    if (this.scriptProcessor) {
      currentNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext!.destination);
    }

    this.outputNode = currentNode;
  }

  private setupAnalysis(): void {
    if (!this.scriptProcessor) return;

    this.scriptProcessor.onaudioprocess = (event) => {
      this.processAudioBuffer(event);
    };
  }

  private initializeMeyda(): void {
    if (typeof Meyda !== 'undefined' && this.outputNode && this.audioContext) {
      Meyda.audioContext = this.audioContext;
      Meyda.source = this.outputNode;
      Meyda.bufferSize = this.config.bufferSize;
      Meyda.windowingFunction = this.config.windowFunction;
      
      const features = [
        'rms', 'zcr', 'spectralCentroid', 'spectralRolloff', 
        'spectralBandwidth', 'spectralFlatness', 'spectralCrest',
        'mfcc', 'chroma', 'energy'
      ];

      Meyda.start(features);
    }
  }

  private processAudioBuffer(event: AudioProcessingEvent): void {
    const inputBuffer = event.inputBuffer;
    const outputBuffer = event.outputBuffer;
    
    const inputData = inputBuffer.getChannelData(0);
    const outputData = outputBuffer.getChannelData(0);

    // Get frequency and time domain data
    if (this.analyserNode) {
      this.analyserNode.getFloatFrequencyData(this.frequencyData);
      this.analyserNode.getFloatTimeDomainData(this.timeData);
    }

    // Apply noise reduction if enabled
    if (this.noiseReductionSettings.enabled && this.noiseProfile) {
      this.applyNoiseReduction(inputData, outputData);
    } else {
      outputData.set(inputData);
    }

    // Extract audio features
    const features = this.extractFeatures(outputData);
    
    // Process audio segment
    this.processAudioSegment(outputData, features);

    // Emit real-time data
    this.emit('audioProcessed', {
      features,
      frequencyData: this.frequencyData,
      timeData: this.timeData,
      processedAudio: outputData,
      timestamp: this.audioContext?.currentTime || Date.now()
    });
  }

  private applyNoiseReduction(input: Float32Array, output: Float32Array): void {
    if (!this.noiseProfile) {
      output.set(input);
      return;
    }

    const { aggressiveness, spectralSubtraction, spectralGating } = this.noiseReductionSettings;

    if (spectralSubtraction) {
      this.applySpectralSubtraction(input, output, aggressiveness);
    } else if (spectralGating) {
      this.applySpectralGating(input, output, aggressiveness);
    } else {
      output.set(input);
    }
  }

  private applySpectralSubtraction(input: Float32Array, output: Float32Array, alpha: number): void {
    // Simplified spectral subtraction
    // In a real implementation, this would use FFT/IFFT
    
    const noiseFloor = this.noiseProfile!.noiseFloor;
    
    for (let i = 0; i < input.length; i++) {
      const signal = input[i];
      const magnitude = Math.abs(signal);
      
      if (magnitude > noiseFloor * (1 + alpha)) {
        output[i] = signal;
      } else {
        output[i] = signal * (1 - alpha);
      }
    }
  }

  private applySpectralGating(input: Float32Array, output: Float32Array, threshold: number): void {
    const noiseFloor = this.noiseProfile!.noiseFloor;
    const gate = noiseFloor * threshold;

    for (let i = 0; i < input.length; i++) {
      const magnitude = Math.abs(input[i]);
      if (magnitude > gate) {
        output[i] = input[i];
      } else {
        output[i] = 0;
      }
    }
  }

  private extractFeatures(audioData: Float32Array): AudioFeatures {
    // Calculate basic features
    let rms = 0;
    let zcr = 0;
    let energy = 0;

    // RMS and Energy
    for (let i = 0; i < audioData.length; i++) {
      const sample = audioData[i];
      rms += sample * sample;
      energy += Math.abs(sample);
    }
    
    rms = Math.sqrt(rms / audioData.length);
    energy = energy / audioData.length;

    // Zero Crossing Rate
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        zcr++;
      }
    }
    zcr = zcr / (audioData.length - 1);

    // Extract Meyda features if available
    let meydaFeatures: any = {};
    if (typeof Meyda !== 'undefined') {
      try {
        meydaFeatures = Meyda.get([
          'spectralCentroid', 'spectralRolloff', 'spectralBandwidth',
          'spectralFlatness', 'spectralCrest', 'mfcc', 'chroma'
        ]) || {};
      } catch (error) {
        // Meyda features not available, use defaults
      }
    }

    return {
      rms,
      zcr,
      energy,
      spectralCentroid: meydaFeatures.spectralCentroid || 0,
      spectralRolloff: meydaFeatures.spectralRolloff || 0,
      spectralBandwidth: meydaFeatures.spectralBandwidth || 0,
      spectralFlatness: meydaFeatures.spectralFlatness || 0,
      spectralCrest: meydaFeatures.spectralCrest || 0,
      mfcc: meydaFeatures.mfcc || new Array(13).fill(0),
      chroma: meydaFeatures.chroma || new Array(12).fill(0),
      tonnetz: new Array(6).fill(0), // Placeholder
      fundamentalFrequency: this.estimateFundamentalFrequency(audioData),
      harmonics: this.extractHarmonics(audioData),
      formants: this.extractFormants(audioData)
    };
  }

  private estimateFundamentalFrequency(audioData: Float32Array): number {
    // Simplified autocorrelation method
    let maxCorrelation = 0;
    let bestPeriod = 0;

    const minPeriod = Math.floor(this.config.sampleRate / 800); // ~800Hz max
    const maxPeriod = Math.floor(this.config.sampleRate / 80);  // ~80Hz min

    for (let period = minPeriod; period < maxPeriod && period < audioData.length / 2; period++) {
      let correlation = 0;
      for (let i = 0; i < audioData.length - period; i++) {
        correlation += audioData[i] * audioData[i + period];
      }
      
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }

    return bestPeriod > 0 ? this.config.sampleRate / bestPeriod : 0;
  }

  private extractHarmonics(audioData: Float32Array): number[] {
    const fundamental = this.estimateFundamentalFrequency(audioData);
    const harmonics: number[] = [];
    
    if (fundamental > 0 && this.frequencyData.length > 0) {
      const binWidth = this.config.sampleRate / (2 * this.frequencyData.length);
      
      // Extract first 5 harmonics
      for (let h = 1; h <= 5; h++) {
        const harmonicFreq = fundamental * h;
        const bin = Math.round(harmonicFreq / binWidth);
        
        if (bin < this.frequencyData.length) {
          harmonics.push(this.frequencyData[bin]);
        } else {
          harmonics.push(0);
        }
      }
    }
    
    return harmonics.length > 0 ? harmonics : new Array(5).fill(0);
  }

  private extractFormants(audioData: Float32Array): number[] {
    // Simplified formant extraction
    // In practice, this would use LPC analysis or peak picking
    const formants: number[] = [];
    
    if (this.frequencyData.length > 0) {
      const binWidth = this.config.sampleRate / (2 * this.frequencyData.length);
      
      // Look for peaks in typical formant ranges
      const formantRanges = [
        [200, 1000],   // F1
        [800, 3000],   // F2
        [1500, 4000]   // F3
      ];
      
      formantRanges.forEach(([min, max]) => {
        const minBin = Math.floor(min / binWidth);
        const maxBin = Math.ceil(max / binWidth);
        
        let peakMagnitude = -Infinity;
        let peakBin = minBin;
        
        for (let bin = minBin; bin <= maxBin && bin < this.frequencyData.length; bin++) {
          if (this.frequencyData[bin] > peakMagnitude) {
            peakMagnitude = this.frequencyData[bin];
            peakBin = bin;
          }
        }
        
        formants.push(peakBin * binWidth);
      });
    }
    
    return formants.length > 0 ? formants : new Array(3).fill(0);
  }

  private processAudioSegment(audioData: Float32Array, features: AudioFeatures): void {
    const currentTime = this.audioContext?.currentTime || Date.now() / 1000;
    
    // Check if we need to start a new segment
    if (!this.currentSegment) {
      this.startNewSegment(currentTime, audioData, features);
      return;
    }

    // Check if current segment should end
    const segmentDuration = (currentTime - this.segmentStartTime) * 1000;
    const shouldEndSegment = 
      segmentDuration > this.maxSegmentDuration ||
      (segmentDuration > this.minSegmentDuration && this.shouldEndSegment(features));

    if (shouldEndSegment) {
      this.endCurrentSegment(currentTime);
      this.startNewSegment(currentTime, audioData, features);
    } else {
      // Update current segment
      this.updateCurrentSegment(audioData, features);
    }
  }

  private startNewSegment(startTime: number, audioData: Float32Array, features: AudioFeatures): void {
    this.segmentStartTime = startTime;
    
    this.currentSegment = {
      startTime,
      endTime: startTime,
      duration: 0,
      features,
      rawAudio: new Float32Array(audioData),
      processedAudio: new Float32Array(audioData),
      signalToNoiseRatio: this.calculateSNR(audioData),
      confidence: this.calculateConfidence(features),
      anomalyScore: this.calculateAnomalyScore(features)
    };
  }

  private endCurrentSegment(endTime: number): void {
    if (!this.currentSegment) return;

    this.currentSegment.endTime = endTime;
    this.currentSegment.duration = (endTime - this.currentSegment.startTime) * 1000;

    // Store completed segment
    this.audioSegments.push(this.currentSegment);
    
    // Limit stored segments
    if (this.audioSegments.length > 1000) {
      this.audioSegments.shift();
    }

    this.emit('segmentComplete', this.currentSegment);
    this.currentSegment = null;
  }

  private updateCurrentSegment(audioData: Float32Array, features: AudioFeatures): void {
    if (!this.currentSegment) return;

    // Extend audio data (simplified - would need proper buffering)
    this.currentSegment.features = features;
    this.currentSegment.signalToNoiseRatio = this.calculateSNR(audioData);
    this.currentSegment.confidence = this.calculateConfidence(features);
    this.currentSegment.anomalyScore = this.calculateAnomalyScore(features);
  }

  private shouldEndSegment(features: AudioFeatures): boolean {
    // End segment on silence or significant feature change
    const energyThreshold = 0.001;
    const isQuiet = features.energy < energyThreshold;
    
    if (this.currentSegment) {
      const featureChange = Math.abs(features.spectralCentroid - this.currentSegment.features.spectralCentroid);
      const significantChange = featureChange > 1000; // Hz
      
      return isQuiet || significantChange;
    }
    
    return false;
  }

  private calculateSNR(audioData: Float32Array): number {
    if (!this.noiseProfile) return 0;

    const signalPower = audioData.reduce((sum, sample) => sum + sample * sample, 0) / audioData.length;
    const noisePower = Math.pow(10, this.noiseProfile.noiseFloor / 10);
    
    return signalPower > 0 ? 10 * Math.log10(signalPower / noisePower) : -Infinity;
  }

  private calculateConfidence(features: AudioFeatures): number {
    // Confidence based on signal strength and spectral characteristics
    const energyFactor = Math.min(features.energy / 0.1, 1);
    const spectralFactor = features.spectralCentroid > 100 ? 1 : features.spectralCentroid / 100;
    const zcr_factor = features.zcr > 0.01 && features.zcr < 0.5 ? 1 : 0.5;
    
    return (energyFactor + spectralFactor + zcr_factor) / 3;
  }

  private calculateAnomalyScore(features: AudioFeatures): number {
    // Simple anomaly detection based on feature deviation
    // In practice, this would use learned baselines
    
    const normalRanges = {
      spectralCentroid: [200, 4000],
      spectralRolloff: [500, 8000],
      zcr: [0.01, 0.3],
      energy: [0.001, 0.5]
    };

    let anomalyScore = 0;
    let featureCount = 0;

    Object.entries(normalRanges).forEach(([feature, [min, max]]) => {
      const value = features[feature as keyof AudioFeatures] as number;
      if (typeof value === 'number') {
        if (value < min || value > max) {
          anomalyScore += 1;
        }
        featureCount++;
      }
    });

    return featureCount > 0 ? anomalyScore / featureCount : 0;
  }

  public startNoiseProfileLearning(): void {
    this.isLearningNoise = true;
    this.noiseBuffer = [];
    
    this.emit('noiseProfileLearningStarted');
    
    // Stop learning after 5 seconds
    setTimeout(() => {
      if (this.isLearningNoise) {
        this.stopNoiseProfileLearning();
      }
    }, 5000);
  }

  public stopNoiseProfileLearning(): void {
    if (!this.isLearningNoise) return;
    
    this.isLearningNoise = false;
    this.calculateNoiseProfile();
    
    this.emit('noiseProfileLearningComplete', this.noiseProfile);
  }

  private calculateNoiseProfile(): void {
    if (this.noiseBuffer.length === 0) return;

    const avgSpectrum = new Float32Array(this.frequencyData.length);
    let totalEnergy = 0;
    const totalSpectralCentroid = 0;
    const totalSpectralRolloff = 0;
    const totalSpectralFlatness = 0;

    // Average all noise samples
    this.noiseBuffer.forEach(spectrum => {
      for (let i = 0; i < avgSpectrum.length; i++) {
        avgSpectrum[i] += spectrum[i];
      }
    });

    for (let i = 0; i < avgSpectrum.length; i++) {
      avgSpectrum[i] /= this.noiseBuffer.length;
      totalEnergy += Math.pow(10, avgSpectrum[i] / 10);
    }

    // Calculate noise floor
    const sortedSpectrum = Array.from(avgSpectrum).sort((a, b) => a - b);
    const noiseFloor = sortedSpectrum[Math.floor(sortedSpectrum.length * 0.1)];

    this.noiseProfile = {
      frequencyBins: avgSpectrum,
      noiseFloor,
      spectralCentroid: totalSpectralCentroid / this.noiseBuffer.length,
      spectralRolloff: totalSpectralRolloff / this.noiseBuffer.length,
      spectralFlatness: totalSpectralFlatness / this.noiseBuffer.length,
      timestamp: Date.now()
    };
  }

  public updateEqualizerBand(index: number, settings: Partial<EqualizerBand>): void {
    if (index < 0 || index >= this.equalizerBands.length) return;

    this.equalizerBands[index] = { ...this.equalizerBands[index], ...settings };
    
    if (this.equalizerNodes[index]) {
      const node = this.equalizerNodes[index];
      const band = this.equalizerBands[index];
      
      node.frequency.value = band.frequency;
      node.gain.value = band.gain;
      node.Q.value = band.q;
    }

    this.emit('equalizerUpdated', this.equalizerBands);
  }

  public updateNoiseReduction(settings: Partial<NoiseReductionSettings>): void {
    this.noiseReductionSettings = { ...this.noiseReductionSettings, ...settings };
    this.emit('noiseReductionUpdated', this.noiseReductionSettings);
  }

  public getAudioSegments(): AudioSegment[] {
    return [...this.audioSegments];
  }

  public getRecentSegments(duration: number): AudioSegment[] {
    const cutoffTime = Date.now() - duration;
    return this.audioSegments.filter(segment => 
      segment.startTime * 1000 > cutoffTime
    );
  }

  public getCurrentNoiseProfile(): NoiseProfile | null {
    return this.noiseProfile;
  }

  public getEqualizerSettings(): EqualizerBand[] {
    return [...this.equalizerBands];
  }

  public async cleanup(): Promise<void> {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (typeof Meyda !== 'undefined') {
      try {
        Meyda.stop();
      } catch (error) {
        // Ignore Meyda cleanup errors
      }
    }

    this.audioSegments = [];
    this.currentSegment = null;
    this.noiseBuffer = [];
    
    this.emit('cleanup');
  }
}