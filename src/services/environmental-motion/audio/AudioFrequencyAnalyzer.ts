import { EventEmitter } from 'events';
import {
  AudioReading,
  AudioFrequencyBand,
  AudioVisualizationSettings,
  AudioOverlayData
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('AudioFrequencyAnalyzer');

export class AudioFrequencyAnalyzer extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private settings: AudioVisualizationSettings;
  private isActive = false;
  private animationFrame: number | null = null;
  private spectrogramHistory: number[][] = [];
  private audioReadings: AudioReading[] = [];
  private overlayCanvas: HTMLCanvasElement | null = null;
  private spatialAnalysis: SpatialAudioAnalyzer | null = null;

  constructor(settings: AudioVisualizationSettings) {
    super();
    this.settings = { ...settings };
    this.spatialAnalysis = new SpatialAudioAnalyzer();
  }

  async initialize(): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000
        }
      });

      // Create analyzer node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096; // High resolution for detailed frequency analysis
      this.analyser.smoothingTimeConstant = 0.3;
      this.analyser.minDecibels = -100;
      this.analyser.maxDecibels = -10;

      // Connect microphone to analyzer
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);

      // Initialize data arrays
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

      // Initialize spatial audio analysis if enabled
      if (this.settings.spatialAudio.enabled) {
        await this.initializeSpatialAudio(stream);
      }

      this.emit('initialized');
      logger.info('Audio frequency analyzer initialized');
    } catch (error) {
      logger.error('Failed to initialize audio analyzer:', error);
      this.emit('error', { error, context: 'initialization' });
      throw error;
    }
  }

  private async initializeSpatialAudio(stream: MediaStream): Promise<void> {
    // Initialize spatial audio analysis for directional detection
    if (this.spatialAnalysis && this.settings.spatialAudio.directionality) {
      await this.spatialAnalysis.initialize(stream);
    }
  }

  start(): void {
    if (!this.audioContext || !this.analyser) {
      throw new Error('Audio analyzer not initialized');
    }

    this.isActive = true;
    this.startAnalysis();
    this.emit('analysis-started');
    logger.info('Audio frequency analysis started');
  }

  stop(): void {
    this.isActive = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.emit('analysis-stopped');
    logger.info('Audio frequency analysis stopped');
  }

  private startAnalysis(): void {
    if (!this.isActive) return;

    const analyze = () => {
      if (!this.isActive || !this.analyser || !this.frequencyData || !this.timeData) return;

      // Get current audio data
      this.analyser.getByteFrequencyData(this.frequencyData);
      this.analyser.getByteTimeDomainData(this.timeData);

      // Analyze frequency data
      const audioReading = this.analyzeCurrentFrame();
      if (audioReading) {
        this.audioReadings.push(audioReading);
        this.emit('audio-reading', audioReading);
      }

      // Update visualizations
      this.updateVisualizations();

      // Detect audio events
      this.detectAudioEvents();

      // Maintain reading history
      if (this.audioReadings.length > 1000) {
        this.audioReadings.splice(0, 500);
      }

      this.animationFrame = requestAnimationFrame(analyze);
    };

    analyze();
  }

  private analyzeCurrentFrame(): AudioReading | null {
    if (!this.frequencyData || !this.audioContext) return null;

    const timestamp = Date.now();
    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.frequencyData.length;
    const frequencyBinWidth = sampleRate / (2 * binCount);

    // Analyze different frequency bands
    const bandAnalysis = this.analyzeBands();
    const dominantBand = this.findDominantBand(bandAnalysis);

    if (!dominantBand) return null;

    // Calculate additional metrics
    const spectralData = this.calculateSpectralFeatures();
    const spatialData = this.spatialAnalysis?.analyze(this.frequencyData);

    const audioReading: AudioReading = {
      timestamp,
      frequencyBand: dominantBand.band,
      amplitude: dominantBand.amplitude,
      frequency: dominantBand.frequency,
      waveform: new Float32Array(this.timeData),
      spectralData,
      direction: spatialData?.direction,
      classification: this.classifyAudio(dominantBand, spectralData)
    };

    return audioReading;
  }

  private analyzeBands(): BandAnalysis[] {
    if (!this.frequencyData || !this.audioContext) return [];

    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.frequencyData.length;
    const frequencyBinWidth = sampleRate / (2 * binCount);

    const bands: BandAnalysis[] = [];

    // Define frequency ranges for each band
    const bandRanges: { band: AudioFrequencyBand; minFreq: number; maxFreq: number }[] = [
      { band: AudioFrequencyBand.INFRASONIC, minFreq: 1, maxFreq: 20 },
      { band: AudioFrequencyBand.LOW_BASS, minFreq: 20, maxFreq: 60 },
      { band: AudioFrequencyBand.BASS, minFreq: 60, maxFreq: 250 },
      { band: AudioFrequencyBand.LOW_MIDRANGE, minFreq: 250, maxFreq: 500 },
      { band: AudioFrequencyBand.MIDRANGE, minFreq: 500, maxFreq: 2000 },
      { band: AudioFrequencyBand.HIGH_MIDRANGE, minFreq: 2000, maxFreq: 4000 },
      { band: AudioFrequencyBand.PRESENCE, minFreq: 4000, maxFreq: 6000 },
      { band: AudioFrequencyBand.BRILLIANCE, minFreq: 6000, maxFreq: 20000 },
      { band: AudioFrequencyBand.ULTRASONIC, minFreq: 20000, maxFreq: 24000 }
    ];

    for (const range of bandRanges) {
      const minBin = Math.floor(range.minFreq / frequencyBinWidth);
      const maxBin = Math.floor(range.maxFreq / frequencyBinWidth);
      
      let totalAmplitude = 0;
      let maxAmplitude = 0;
      let dominantFrequency = range.minFreq;
      let binCount = 0;

      for (let bin = minBin; bin <= maxBin && bin < this.frequencyData.length; bin++) {
        const amplitude = this.frequencyData[bin];
        totalAmplitude += amplitude;
        binCount++;

        if (amplitude > maxAmplitude) {
          maxAmplitude = amplitude;
          dominantFrequency = bin * frequencyBinWidth;
        }
      }

      if (binCount > 0) {
        const averageAmplitude = totalAmplitude / binCount;
        const amplitudeDb = this.amplitudeToDb(averageAmplitude);

        bands.push({
          band: range.band,
          frequency: dominantFrequency,
          amplitude: amplitudeDb,
          averageAmplitude,
          maxAmplitude,
          energy: totalAmplitude
        });
      }
    }

    return bands;
  }

  private amplitudeToDb(amplitude: number): number {
    // Convert 0-255 range to decibels
    return amplitude > 0 ? 20 * Math.log10(amplitude / 255) : -Infinity;
  }

  private findDominantBand(bandAnalysis: BandAnalysis[]): BandAnalysis | null {
    if (bandAnalysis.length === 0) return null;

    // Find band with highest energy above threshold
    let dominantBand: BandAnalysis | null = null;
    let maxEnergy = 0;

    for (const band of bandAnalysis) {
      if (band.energy > maxEnergy && band.amplitude > -60) { // -60dB threshold
        maxEnergy = band.energy;
        dominantBand = band;
      }
    }

    return dominantBand;
  }

  private calculateSpectralFeatures(): Float32Array {
    if (!this.frequencyData) return new Float32Array(0);

    const features = new Float32Array(this.frequencyData.length);
    
    // Apply windowing and calculate spectral features
    for (let i = 0; i < this.frequencyData.length; i++) {
      // Convert to logarithmic scale for better visualization
      features[i] = Math.log(this.frequencyData[i] + 1) / Math.log(256);
    }

    return features;
  }

  private classifyAudio(dominantBand: BandAnalysis, spectralData: Float32Array): string {
    // Simple audio classification based on spectral characteristics
    const band = dominantBand.band;
    const frequency = dominantBand.frequency;
    const amplitude = dominantBand.amplitude;

    // Environmental audio classification
    if (band === AudioFrequencyBand.INFRASONIC && amplitude > -40) {
      return 'environmental_low_frequency';
    }

    if (band === AudioFrequencyBand.ULTRASONIC && amplitude > -50) {
      return 'ultrasonic_activity';
    }

    // Voice/speech detection
    if (frequency >= 85 && frequency <= 255 && amplitude > -30) {
      return 'potential_voice';
    }

    // Electronic/electrical interference
    if (frequency % 60 < 5 || frequency % 50 < 5) { // 50/60Hz harmonics
      return 'electrical_interference';
    }

    // Mechanical/structural sounds
    if (band === AudioFrequencyBand.LOW_BASS && amplitude > -35) {
      return 'mechanical_vibration';
    }

    // High-frequency anomalies
    if (band === AudioFrequencyBand.BRILLIANCE && amplitude > -45) {
      return 'high_frequency_anomaly';
    }

    return 'ambient';
  }

  private updateVisualizations(): void {
    if (!this.overlayCanvas) return;

    const overlayData = this.generateOverlayData();
    this.renderAudioOverlay(overlayData);
    this.emit('visualization-updated', overlayData);
  }

  private generateOverlayData(): AudioOverlayData {
    const timestamp = Date.now();

    const overlayData: AudioOverlayData = {
      timestamp,
      frequencyPeaks: this.detectFrequencyPeaks(),
    };

    // Add spectrogram if enabled
    if (this.settings.spectrogram.enabled) {
      overlayData.spectrogram = this.generateSpectrogramData();
    }

    // Add waveform if enabled
    if (this.settings.waveform.enabled) {
      overlayData.waveform = this.timeData ? new Float32Array(this.timeData) : new Float32Array(0);
    }

    // Add spatial data if available
    if (this.settings.spatialAudio.enabled && this.spatialAnalysis) {
      overlayData.spatialData = this.spatialAnalysis.getSpatialData();
    }

    // Add classification if recent reading available
    const recentReading = this.audioReadings[this.audioReadings.length - 1];
    if (recentReading && recentReading.classification) {
      overlayData.classification = {
        type: recentReading.classification,
        confidence: 0.8, // Simplified confidence
        characteristics: this.extractAudioCharacteristics(recentReading)
      };
    }

    return overlayData;
  }

  private detectFrequencyPeaks(): { frequency: number; amplitude: number; bandwidth: number }[] {
    if (!this.frequencyData || !this.audioContext) return [];

    const peaks: { frequency: number; amplitude: number; bandwidth: number }[] = [];
    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.frequencyData.length;
    const frequencyBinWidth = sampleRate / (2 * binCount);
    const threshold = 50; // Minimum amplitude for peak detection

    // Find local maxima
    for (let i = 2; i < this.frequencyData.length - 2; i++) {
      const current = this.frequencyData[i];
      const prev1 = this.frequencyData[i - 1];
      const prev2 = this.frequencyData[i - 2];
      const next1 = this.frequencyData[i + 1];
      const next2 = this.frequencyData[i + 2];

      if (current > threshold && 
          current > prev1 && current > prev2 && 
          current > next1 && current > next2) {
        
        // Calculate peak bandwidth
        let leftBound = i;
        let rightBound = i;
        const halfMax = current / 2;

        // Find left bound
        while (leftBound > 0 && this.frequencyData[leftBound] > halfMax) {
          leftBound--;
        }

        // Find right bound
        while (rightBound < this.frequencyData.length - 1 && this.frequencyData[rightBound] > halfMax) {
          rightBound++;
        }

        const bandwidth = (rightBound - leftBound) * frequencyBinWidth;

        peaks.push({
          frequency: i * frequencyBinWidth,
          amplitude: this.amplitudeToDb(current),
          bandwidth
        });
      }
    }

    // Sort by amplitude and return top peaks
    return peaks.sort((a, b) => b.amplitude - a.amplitude).slice(0, 10);
  }

  private generateSpectrogramData(): AudioOverlayData['spectrogram'] {
    if (!this.frequencyData || !this.audioContext) return undefined;

    // Add current frequency data to spectrogram history
    this.spectrogramHistory.push([...this.frequencyData]);

    // Maintain spectrogram history size
    const maxHistory = 200; // ~10 seconds at 20 FPS
    if (this.spectrogramHistory.length > maxHistory) {
      this.spectrogramHistory.shift();
    }

    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.frequencyData.length;
    const frequencyBinWidth = sampleRate / (2 * binCount);

    // Generate frequency array
    const frequencies: number[] = [];
    for (let i = 0; i < binCount; i++) {
      frequencies.push(i * frequencyBinWidth);
    }

    // Generate time array
    const timeStep = this.settings.spectrogram.windowSize / 1000; // Convert to seconds
    const times: number[] = [];
    for (let i = 0; i < this.spectrogramHistory.length; i++) {
      times.push(i * timeStep);
    }

    return {
      frequencies,
      times,
      magnitudes: this.spectrogramHistory
    };
  }

  private extractAudioCharacteristics(reading: AudioReading): string[] {
    const characteristics: string[] = [];

    // Analyze spectral characteristics
    if (reading.amplitude > -20) {
      characteristics.push('high_amplitude');
    }

    if (reading.frequency < 100) {
      characteristics.push('low_frequency');
    } else if (reading.frequency > 8000) {
      characteristics.push('high_frequency');
    }

    // Analyze waveform if available
    if (reading.waveform) {
      const rms = this.calculateRMS(reading.waveform);
      if (rms > 0.1) {
        characteristics.push('strong_signal');
      }

      const zeroCrossings = this.countZeroCrossings(reading.waveform);
      if (zeroCrossings > reading.waveform.length / 4) {
        characteristics.push('noisy');
      } else if (zeroCrossings < reading.waveform.length / 20) {
        characteristics.push('tonal');
      }
    }

    // Directional characteristics
    if (reading.direction !== undefined) {
      characteristics.push('directional');
    }

    return characteristics;
  }

  private calculateRMS(waveform: Float32Array): number {
    let sumSquares = 0;
    for (let i = 0; i < waveform.length; i++) {
      const normalized = (waveform[i] - 128) / 128; // Convert from 0-255 to -1,1
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / waveform.length);
  }

  private countZeroCrossings(waveform: Float32Array): number {
    let crossings = 0;
    const centerValue = 128;
    
    for (let i = 1; i < waveform.length; i++) {
      if ((waveform[i - 1] < centerValue && waveform[i] >= centerValue) ||
          (waveform[i - 1] >= centerValue && waveform[i] < centerValue)) {
        crossings++;
      }
    }
    
    return crossings;
  }

  private detectAudioEvents(): void {
    if (this.audioReadings.length < 5) return;

    const recentReadings = this.audioReadings.slice(-5);
    const currentReading = recentReadings[recentReadings.length - 1];
    
    // Detect sudden amplitude changes
    const amplitudeChanges = recentReadings.map((r, i) => 
      i > 0 ? Math.abs(r.amplitude - recentReadings[i - 1].amplitude) : 0
    );
    
    const avgAmplitudeChange = amplitudeChanges.reduce((sum, change) => sum + change, 0) / amplitudeChanges.length;
    
    if (avgAmplitudeChange > 10) { // 10dB change threshold
      this.emit('audio-event', {
        type: 'amplitude_spike',
        reading: currentReading,
        severity: avgAmplitudeChange / 10
      });
    }

    // Detect frequency anomalies
    const frequencies = recentReadings.map(r => r.frequency);
    const freqVariation = this.calculateVariation(frequencies);
    
    if (freqVariation > 1000) { // 1kHz variation threshold
      this.emit('audio-event', {
        type: 'frequency_variation',
        reading: currentReading,
        severity: freqVariation / 1000
      });
    }

    // Detect ultrasonic activity
    if (currentReading.frequencyBand === AudioFrequencyBand.ULTRASONIC && currentReading.amplitude > -50) {
      this.emit('audio-event', {
        type: 'ultrasonic_detection',
        reading: currentReading,
        severity: (currentReading.amplitude + 50) / 20
      });
    }

    // Detect infrasonic activity
    if (currentReading.frequencyBand === AudioFrequencyBand.INFRASONIC && currentReading.amplitude > -40) {
      this.emit('audio-event', {
        type: 'infrasonic_detection',
        reading: currentReading,
        severity: (currentReading.amplitude + 40) / 20
      });
    }
  }

  private calculateVariation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private renderAudioOverlay(overlayData: AudioOverlayData): void {
    if (!this.overlayCanvas) return;

    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    // Render frequency bars if enabled
    if (this.settings.frequencyBars.enabled) {
      this.renderFrequencyBars(ctx, overlayData);
    }

    // Render waveform if enabled
    if (this.settings.waveform.enabled && overlayData.waveform) {
      this.renderWaveform(ctx, overlayData.waveform);
    }

    // Render spectrogram if enabled
    if (this.settings.spectrogram.enabled && overlayData.spectrogram) {
      this.renderSpectrogram(ctx, overlayData.spectrogram);
    }

    // Render frequency peaks
    this.renderFrequencyPeaks(ctx, overlayData.frequencyPeaks);

    // Render spatial audio visualization
    if (this.settings.spatialAudio.enabled && overlayData.spatialData) {
      this.renderSpatialAudio(ctx, overlayData.spatialData);
    }
  }

  private renderFrequencyBars(ctx: CanvasRenderingContext2D, overlayData: AudioOverlayData): void {
    if (!this.frequencyData) return;

    const canvas = ctx.canvas;
    const barCount = this.settings.frequencyBars.bands;
    const barWidth = canvas.width / barCount;
    const maxHeight = canvas.height / 2;

    // Group frequency data into bars
    const binsPerBar = Math.floor(this.frequencyData.length / barCount);
    
    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < binsPerBar; j++) {
        const index = i * binsPerBar + j;
        if (index < this.frequencyData.length) {
          sum += this.frequencyData[index];
        }
      }
      
      const average = sum / binsPerBar;
      const barHeight = (average / 255) * maxHeight;
      
      // Color based on frequency band
      const hue = (i / barCount) * 300; // 0-300 degrees
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.globalAlpha = 0.7;
      
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 2, barHeight);
    }
    
    ctx.globalAlpha = 1.0;
  }

  private renderWaveform(ctx: CanvasRenderingContext2D, waveform: Float32Array): void {
    const canvas = ctx.canvas;
    const centerY = canvas.height / 4; // Upper quarter of canvas
    const amplitude = 50;
    
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const step = canvas.width / waveform.length;
    
    for (let i = 0; i < waveform.length; i++) {
      const x = i * step;
      const normalized = (waveform[i] - 128) / 128; // Normalize to -1,1
      const y = centerY + normalized * amplitude;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
  }

  private renderSpectrogram(ctx: CanvasRenderingContext2D, spectrogram: NonNullable<AudioOverlayData['spectrogram']>): void {
    const canvas = ctx.canvas;
    const spectrogramHeight = canvas.height / 3;
    const spectrogramY = canvas.height - spectrogramHeight;
    
    if (spectrogram.magnitudes.length === 0) return;
    
    const timeStep = canvas.width / spectrogram.magnitudes.length;
    const freqStep = spectrogramHeight / spectrogram.frequencies.length;
    
    for (let t = 0; t < spectrogram.magnitudes.length; t++) {
      const timeData = spectrogram.magnitudes[t];
      for (let f = 0; f < timeData.length; f++) {
        const magnitude = timeData[f];
        const intensity = magnitude / 255;
        
        if (intensity > 0.1) { // Only render significant values
          const x = t * timeStep;
          const y = spectrogramY + (timeData.length - f) * freqStep;
          
          // Use jet colormap for spectrogram
          const color = this.jetColormap(intensity);
          ctx.fillStyle = color;
          ctx.fillRect(x, y, timeStep, freqStep);
        }
      }
    }
  }

  private jetColormap(intensity: number): string {
    // Jet colormap: blue -> cyan -> green -> yellow -> red
    const r = Math.max(0, Math.min(255, 255 * (1.5 * intensity - 0.5)));
    const g = Math.max(0, Math.min(255, 255 * (1.5 * intensity - Math.abs(intensity - 0.5))));
    const b = Math.max(0, Math.min(255, 255 * (1.5 * (1 - intensity) - 0.5)));
    
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
  }

  private renderFrequencyPeaks(ctx: CanvasRenderingContext2D, peaks: { frequency: number; amplitude: number; bandwidth: number }[]): void {
    ctx.fillStyle = '#ffff00';
    ctx.font = '12px Arial';
    
    peaks.slice(0, 5).forEach((peak, index) => {
      const x = 10;
      const y = 30 + index * 20;
      
      const text = `${peak.frequency.toFixed(0)}Hz: ${peak.amplitude.toFixed(1)}dB`;
      ctx.fillText(text, x, y);
    });
  }

  private renderSpatialAudio(ctx: CanvasRenderingContext2D, spatialData: any[]): void {
    // Render directional audio indicators
    const canvas = ctx.canvas;
    const centerX = canvas.width - 100;
    const centerY = 100;
    const radius = 40;
    
    // Draw compass circle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw direction indicators
    spatialData.forEach((data, index) => {
      if (data.direction !== undefined) {
        const angle = (data.direction * Math.PI) / 180;
        const x = centerX + Math.cos(angle) * radius * 0.8;
        const y = centerY + Math.sin(angle) * radius * 0.8;
        
        ctx.fillStyle = `hsl(${index * 60}, 70%, 60%)`;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }

  setOverlayCanvas(canvas: HTMLCanvasElement): void {
    this.overlayCanvas = canvas;
    this.emit('canvas-set', canvas);
  }

  updateSettings(newSettings: Partial<AudioVisualizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // Update analyzer settings if needed
    if (this.analyser && newSettings.spectrogram) {
      if (newSettings.spectrogram.windowSize) {
        // Update FFT size based on window size
        const fftSize = Math.pow(2, Math.ceil(Math.log2(newSettings.spectrogram.windowSize * 44.1)));
        this.analyser.fftSize = Math.min(32768, Math.max(256, fftSize));
      }
    }
    
    this.emit('settings-updated', this.settings);
  }

  getSettings(): AudioVisualizationSettings {
    return { ...this.settings };
  }

  getRecentReadings(count = 50): AudioReading[] {
    return this.audioReadings.slice(-count);
  }

  getCurrentAudioLevel(): number {
    if (!this.frequencyData) return 0;
    
    const sum = this.frequencyData.reduce((total, value) => total + value, 0);
    return sum / this.frequencyData.length / 255; // Normalize to 0-1
  }

  isActive(): boolean {
    return this.isActive;
  }

  destroy(): void {
    this.stop();
    
    if (this.microphone) {
      this.microphone.disconnect();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    if (this.spatialAnalysis) {
      this.spatialAnalysis.destroy();
    }
    
    this.removeAllListeners();
  }
}

class SpatialAudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private leftChannelAnalyser: AnalyserNode | null = null;
  private rightChannelAnalyser: AnalyserNode | null = null;
  private splitter: ChannelSplitterNode | null = null;

  async initialize(stream: MediaStream): Promise<void> {
    // Initialize stereo audio analysis for spatial detection
    this.audioContext = new AudioContext();
    
    const source = this.audioContext.createMediaStreamSource(stream);
    this.splitter = this.audioContext.createChannelSplitter(2);
    
    this.leftChannelAnalyser = this.audioContext.createAnalyser();
    this.rightChannelAnalyser = this.audioContext.createAnalyser();
    
    source.connect(this.splitter);
    this.splitter.connect(this.leftChannelAnalyser, 0);
    this.splitter.connect(this.rightChannelAnalyser, 1);
  }

  analyze(frequencyData: Uint8Array): { direction?: number; distance?: number; confidence: number } | undefined {
    if (!this.leftChannelAnalyser || !this.rightChannelAnalyser) return undefined;

    const leftData = new Uint8Array(this.leftChannelAnalyser.frequencyBinCount);
    const rightData = new Uint8Array(this.rightChannelAnalyser.frequencyBinCount);
    
    this.leftChannelAnalyser.getByteFrequencyData(leftData);
    this.rightChannelAnalyser.getByteFrequencyData(rightData);
    
    // Simple stereo analysis
    const leftLevel = leftData.reduce((sum, val) => sum + val, 0) / leftData.length;
    const rightLevel = rightData.reduce((sum, val) => sum + val, 0) / rightData.length;
    
    const balance = (rightLevel - leftLevel) / (rightLevel + leftLevel + 1);
    const direction = balance * 90; // -90 to +90 degrees
    const confidence = Math.min(1, Math.abs(balance) * 2);
    
    return { direction, confidence };
  }

  getSpatialData(): any[] {
    // Return current spatial analysis data
    return []; // Simplified implementation
  }

  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

interface BandAnalysis {
  band: AudioFrequencyBand;
  frequency: number;
  amplitude: number;
  averageAmplitude: number;
  maxAmplitude: number;
  energy: number;
}