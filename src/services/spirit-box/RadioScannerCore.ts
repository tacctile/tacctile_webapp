import { EventEmitter } from 'events';
import { standardize } from 'standardized-audio-context';
import Meyda from 'meyda';

export interface RadioFrequency {
  frequency: number;
  modulation: 'AM' | 'FM';
  power: number;
  signalStrength: number;
  active: boolean;
}

export interface ScanSettings {
  startFrequency: number;
  endFrequency: number;
  stepSize: number;
  sweepRate: number; // milliseconds per station
  direction: 'up' | 'down' | 'random';
  modulation: 'AM' | 'FM' | 'both';
  threshold: number; // signal strength threshold for pausing
  pauseOnSignal: boolean;
  pauseDuration: number; // milliseconds to pause on strong signal
}

export interface RadioConfig {
  sampleRate: number;
  bufferSize: number;
  enableNoiseReduction: boolean;
  enableAutoGainControl: boolean;
  enableEchoCancellation: boolean;
}

export interface RadioMetrics {
  currentFrequency: number;
  signalStrength: number;
  noiseFloor: number;
  modulationIndex: number;
  frequencyStability: number;
  scanSpeed: number;
  totalStations: number;
  activeStations: number;
}

export interface AudioSpectrum {
  frequency: number;
  magnitude: number;
  phase: number;
  timestamp: number;
}

export class RadioScannerCore extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  
  private scanSettings: ScanSettings;
  private radioConfig: RadioConfig;
  private isScanning: boolean = false;
  private isPaused: boolean = false;
  private currentFrequency: number = 88.1;
  
  private frequencies: Map<number, RadioFrequency> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private pauseTimeout: NodeJS.Timeout | null = null;
  
  private frequencyData: Float32Array = new Float32Array();
  private timeData: Float32Array = new Float32Array();
  private spectrumHistory: AudioSpectrum[][] = [];
  private maxHistoryLength: number = 100;

  constructor(
    scanSettings: Partial<ScanSettings> = {},
    radioConfig: Partial<RadioConfig> = {}
  ) {
    super();

    this.scanSettings = {
      startFrequency: 88.1,
      endFrequency: 108.0,
      stepSize: 0.2,
      sweepRate: 200,
      direction: 'up',
      modulation: 'FM',
      threshold: -50,
      pauseOnSignal: true,
      pauseDuration: 2000,
      ...scanSettings
    };

    this.radioConfig = {
      sampleRate: 44100,
      bufferSize: 2048,
      enableNoiseReduction: true,
      enableAutoGainControl: true,
      enableEchoCancellation: true,
      ...radioConfig
    };

    this.generateFrequencyMap();
    this.initializeAudioProcessing();
  }

  private generateFrequencyMap(): void {
    const { startFrequency, endFrequency, stepSize } = this.scanSettings;
    this.frequencies.clear();

    for (let freq = startFrequency; freq <= endFrequency; freq += stepSize) {
      this.frequencies.set(Number(freq.toFixed(1)), {
        frequency: freq,
        modulation: this.scanSettings.modulation === 'both' ? 'FM' : this.scanSettings.modulation,
        power: 0,
        signalStrength: -Infinity,
        active: false
      });
    }

    this.emit('frequencyMapGenerated', Array.from(this.frequencies.values()));
  }

  private async initializeAudioProcessing(): Promise<void> {
    try {
      // Create standardized audio context
      this.audioContext = standardize(
        new AudioContext({
          sampleRate: this.radioConfig.sampleRate
        })
      );

      // Get user media with audio constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.radioConfig.sampleRate,
          echoCancellation: this.radioConfig.enableEchoCancellation,
          autoGainControl: this.radioConfig.enableAutoGainControl,
          noiseSuppression: this.radioConfig.enableNoiseReduction
        }
      });

      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.gainNode = this.audioContext.createGain();
      this.filterNode = this.audioContext.createBiquadFilter();

      // Configure analyser
      this.analyserNode.fftSize = this.radioConfig.bufferSize * 2;
      this.analyserNode.smoothingTimeConstant = 0.8;
      this.analyserNode.minDecibels = -100;
      this.analyserNode.maxDecibels = -10;

      // Configure filter for initial frequency
      this.updateFilterFrequency(this.currentFrequency);

      // Configure gain
      this.gainNode.gain.value = 1.0;

      // Connect audio nodes
      this.sourceNode
        .connect(this.filterNode)
        .connect(this.gainNode)
        .connect(this.analyserNode);

      // Initialize data arrays
      this.frequencyData = new Float32Array(this.analyserNode.frequencyBinCount);
      this.timeData = new Float32Array(this.analyserNode.fftSize);

      // Initialize Meyda for advanced audio analysis
      if (typeof Meyda !== 'undefined') {
        Meyda.audioContext = this.audioContext;
        Meyda.source = this.gainNode;
        Meyda.bufferSize = this.radioConfig.bufferSize;
        Meyda.windowingFunction = 'hanning';
      }

      this.emit('audioInitialized', {
        sampleRate: this.audioContext.sampleRate,
        bufferSize: this.radioConfig.bufferSize,
        frequencyBins: this.analyserNode.frequencyBinCount
      });

    } catch (error) {
      this.emit('error', `Failed to initialize audio processing: ${error}`);
      throw error;
    }
  }

  private updateFilterFrequency(frequency: number): void {
    if (!this.filterNode || !this.audioContext) return;

    // Convert MHz to Hz for Web Audio API
    const centerFrequency = frequency * 1000000;
    const bandwidth = 200000; // 200kHz bandwidth for FM

    this.filterNode.type = 'bandpass';
    this.filterNode.frequency.setValueAtTime(
      Math.min(centerFrequency, this.audioContext.sampleRate / 2), 
      this.audioContext.currentTime
    );
    this.filterNode.Q.setValueAtTime(centerFrequency / bandwidth, this.audioContext.currentTime);

    this.currentFrequency = frequency;
    this.emit('frequencyChanged', frequency);
  }

  public async startScanning(): Promise<void> {
    if (this.isScanning) {
      throw new Error('Scanner is already running');
    }

    if (!this.audioContext || !this.analyserNode) {
      await this.initializeAudioProcessing();
    }

    this.isScanning = true;
    this.isPaused = false;
    this.currentFrequency = this.scanSettings.startFrequency;
    
    this.updateFilterFrequency(this.currentFrequency);
    this.startAnalysisLoop();
    this.startScanLoop();

    this.emit('scanStarted', {
      startFrequency: this.scanSettings.startFrequency,
      endFrequency: this.scanSettings.endFrequency,
      sweepRate: this.scanSettings.sweepRate
    });
  }

  public stopScanning(): void {
    this.isScanning = false;
    this.isPaused = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }

    this.emit('scanStopped');
  }

  public pauseScanning(): void {
    if (!this.isScanning) return;
    
    this.isPaused = true;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.emit('scanPaused', this.currentFrequency);
  }

  public resumeScanning(): void {
    if (!this.isScanning || !this.isPaused) return;

    this.isPaused = false;
    this.startScanLoop();
    this.emit('scanResumed', this.currentFrequency);
  }

  private startAnalysisLoop(): void {
    if (!this.isScanning || !this.analyserNode) return;

    const analyze = () => {
      if (!this.isScanning || !this.analyserNode) return;

      // Get frequency and time domain data
      this.analyserNode.getFloatFrequencyData(this.frequencyData);
      this.analyserNode.getFloatTimeDomainData(this.timeData);

      // Calculate signal metrics
      const metrics = this.calculateMetrics();
      
      // Update frequency data
      const freqData = this.frequencies.get(this.currentFrequency);
      if (freqData) {
        freqData.signalStrength = metrics.signalStrength;
        freqData.power = metrics.signalStrength;
        freqData.active = metrics.signalStrength > this.scanSettings.threshold;
      }

      // Check for strong signal
      if (this.scanSettings.pauseOnSignal && 
          metrics.signalStrength > this.scanSettings.threshold && 
          !this.isPaused) {
        this.pauseOnStrongSignal();
      }

      // Store spectrum data
      this.storeSpectrumData(metrics);

      // Emit real-time metrics
      this.emit('metrics', metrics);
      this.emit('spectrumData', this.frequencyData);
      
      requestAnimationFrame(analyze);
    };

    analyze();
  }

  private startScanLoop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    this.scanInterval = setInterval(() => {
      if (!this.isScanning || this.isPaused) return;

      const nextFreq = this.getNextFrequency();
      this.updateFilterFrequency(nextFreq);
      
      this.emit('frequencyScanned', {
        frequency: nextFreq,
        signalStrength: this.frequencies.get(nextFreq)?.signalStrength || -Infinity
      });

    }, this.scanSettings.sweepRate);
  }

  private getNextFrequency(): number {
    const { startFrequency, endFrequency, stepSize, direction } = this.scanSettings;
    
    switch (direction) {
      case 'up':
        this.currentFrequency += stepSize;
        if (this.currentFrequency > endFrequency) {
          this.currentFrequency = startFrequency;
        }
        break;
        
      case 'down':
        this.currentFrequency -= stepSize;
        if (this.currentFrequency < startFrequency) {
          this.currentFrequency = endFrequency;
        }
        break;
        
      case 'random':
        const freqArray = Array.from(this.frequencies.keys());
        this.currentFrequency = freqArray[Math.floor(Math.random() * freqArray.length)];
        break;
    }

    return Number(this.currentFrequency.toFixed(1));
  }

  private pauseOnStrongSignal(): void {
    this.pauseScanning();
    
    this.emit('strongSignalDetected', {
      frequency: this.currentFrequency,
      signalStrength: this.frequencies.get(this.currentFrequency)?.signalStrength
    });

    this.pauseTimeout = setTimeout(() => {
      if (this.isScanning) {
        this.resumeScanning();
      }
    }, this.scanSettings.pauseDuration);
  }

  private calculateMetrics(): RadioMetrics {
    if (!this.frequencyData.length) {
      return {
        currentFrequency: this.currentFrequency,
        signalStrength: -Infinity,
        noiseFloor: -100,
        modulationIndex: 0,
        frequencyStability: 0,
        scanSpeed: this.scanSettings.sweepRate,
        totalStations: this.frequencies.size,
        activeStations: 0
      };
    }

    // Calculate RMS signal strength
    let sumSquares = 0;
    let maxMagnitude = -Infinity;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = this.frequencyData[i];
      sumSquares += magnitude * magnitude;
      maxMagnitude = Math.max(maxMagnitude, magnitude);
    }

    const rmsLevel = Math.sqrt(sumSquares / this.frequencyData.length);
    const signalStrength = 20 * Math.log10(Math.max(rmsLevel, 1e-10));

    // Calculate noise floor (bottom 10% of frequency bins)
    const sortedMagnitudes = Array.from(this.frequencyData).sort((a, b) => a - b);
    const noiseFloorIndex = Math.floor(sortedMagnitudes.length * 0.1);
    const noiseFloor = sortedMagnitudes[noiseFloorIndex];

    // Count active stations
    let activeStations = 0;
    this.frequencies.forEach(freq => {
      if (freq.signalStrength > this.scanSettings.threshold) {
        activeStations++;
      }
    });

    // Calculate modulation index (simplified)
    const modulationIndex = this.calculateModulationIndex();

    return {
      currentFrequency: this.currentFrequency,
      signalStrength,
      noiseFloor,
      modulationIndex,
      frequencyStability: this.calculateFrequencyStability(),
      scanSpeed: this.scanSettings.sweepRate,
      totalStations: this.frequencies.size,
      activeStations
    };
  }

  private calculateModulationIndex(): number {
    if (!this.timeData.length) return 0;

    let peakDeviation = 0;
    let avgAmplitude = 0;

    for (let i = 0; i < this.timeData.length; i++) {
      const amplitude = Math.abs(this.timeData[i]);
      avgAmplitude += amplitude;
      peakDeviation = Math.max(peakDeviation, amplitude);
    }

    avgAmplitude /= this.timeData.length;
    return avgAmplitude > 0 ? peakDeviation / avgAmplitude : 0;
  }

  private calculateFrequencyStability(): number {
    if (this.spectrumHistory.length < 2) return 1.0;

    const current = this.spectrumHistory[this.spectrumHistory.length - 1];
    const previous = this.spectrumHistory[this.spectrumHistory.length - 2];

    if (!current || !previous || current.length !== previous.length) return 1.0;

    let correlation = 0;
    for (let i = 0; i < Math.min(current.length, previous.length); i++) {
      const diff = Math.abs(current[i].magnitude - previous[i].magnitude);
      correlation += Math.exp(-diff);
    }

    return correlation / current.length;
  }

  private storeSpectrumData(metrics: RadioMetrics): void {
    const spectrum: AudioSpectrum[] = [];
    const nyquist = this.radioConfig.sampleRate / 2;

    for (let i = 0; i < this.frequencyData.length; i++) {
      const frequency = (i / this.frequencyData.length) * nyquist;
      spectrum.push({
        frequency,
        magnitude: this.frequencyData[i],
        phase: 0, // Phase data not available from analyser node
        timestamp: Date.now()
      });
    }

    this.spectrumHistory.push(spectrum);

    if (this.spectrumHistory.length > this.maxHistoryLength) {
      this.spectrumHistory.shift();
    }

    this.emit('spectrumStored', spectrum);
  }

  public tuneToFrequency(frequency: number): void {
    if (frequency < this.scanSettings.startFrequency || 
        frequency > this.scanSettings.endFrequency) {
      throw new Error('Frequency out of range');
    }

    this.currentFrequency = frequency;
    this.updateFilterFrequency(frequency);
    this.emit('manualTune', frequency);
  }

  public updateScanSettings(settings: Partial<ScanSettings>): void {
    this.scanSettings = { ...this.scanSettings, ...settings };
    
    if (settings.startFrequency || settings.endFrequency || settings.stepSize) {
      this.generateFrequencyMap();
    }
    
    this.emit('settingsUpdated', this.scanSettings);
  }

  public getFrequencies(): RadioFrequency[] {
    return Array.from(this.frequencies.values());
  }

  public getActiveFrequencies(): RadioFrequency[] {
    return Array.from(this.frequencies.values())
      .filter(freq => freq.signalStrength > this.scanSettings.threshold);
  }

  public getCurrentMetrics(): RadioMetrics {
    return this.calculateMetrics();
  }

  public getSpectrumHistory(): AudioSpectrum[][] {
    return [...this.spectrumHistory];
  }

  public async cleanup(): Promise<void> {
    this.stopScanning();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.sourceNode = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.filterNode = null;

    this.emit('cleanup');
  }
}