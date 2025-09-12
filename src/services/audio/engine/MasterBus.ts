/**
 * Master Bus
 * Main output bus with mastering chain
 */

import { MeteringData } from '../types';
import { logger } from '../../../utils/logger';

export class MasterBus {
  private context: AudioContext;
  
  // Master chain nodes
  private inputGain: GainNode;
  private compressor: DynamicsCompressorNode;
  private eq: BiquadFilterNode[];
  private limiter: DynamicsCompressorNode;
  private outputGain: GainNode;
  private analyser: AnalyserNode;
  
  // Metering
  private meteringSplitter: ChannelSplitterNode;
  private leftAnalyser: AnalyserNode;
  private rightAnalyser: AnalyserNode;
  
  private volume = 1.0;
  private muted = false;

  constructor(context: AudioContext) {
    this.context = context;
    this.setupMasterChain();
  }

  /**
   * Set up master processing chain
   */
  private setupMasterChain(): void {
    // Create nodes
    this.inputGain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.limiter = this.context.createDynamicsCompressor();
    this.outputGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    
    // Create EQ bands (3-band)
    this.eq = [
      this.context.createBiquadFilter(), // Low
      this.context.createBiquadFilter(), // Mid
      this.context.createBiquadFilter()  // High
    ];
    
    // Configure compressor (gentle mastering compression)
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.1;
    
    // Configure limiter (brick wall)
    this.limiter.threshold.value = -0.1;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.01;
    
    // Configure EQ
    this.eq[0].type = 'lowshelf';
    this.eq[0].frequency.value = 200;
    this.eq[0].gain.value = 0;
    
    this.eq[1].type = 'peaking';
    this.eq[1].frequency.value = 1000;
    this.eq[1].Q.value = 0.7;
    this.eq[1].gain.value = 0;
    
    this.eq[2].type = 'highshelf';
    this.eq[2].frequency.value = 8000;
    this.eq[2].gain.value = 0;
    
    // Configure analyser
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    // Set up metering
    this.setupMetering();
    
    // Connect chain
    this.inputGain.connect(this.compressor);
    this.compressor.connect(this.eq[0]);
    this.eq[0].connect(this.eq[1]);
    this.eq[1].connect(this.eq[2]);
    this.eq[2].connect(this.limiter);
    this.limiter.connect(this.outputGain);
    this.outputGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    
    // Also connect to metering
    this.outputGain.connect(this.meteringSplitter);
    
    logger.info('Master bus initialized');
  }

  /**
   * Set up stereo metering
   */
  private setupMetering(): void {
    this.meteringSplitter = this.context.createChannelSplitter(2);
    this.leftAnalyser = this.context.createAnalyser();
    this.rightAnalyser = this.context.createAnalyser();
    
    this.leftAnalyser.fftSize = 256;
    this.rightAnalyser.fftSize = 256;
    
    this.meteringSplitter.connect(this.leftAnalyser, 0);
    this.meteringSplitter.connect(this.rightAnalyser, 1);
  }

  /**
   * Get input node
   */
  getInput(): AudioNode {
    return this.inputGain;
  }

  /**
   * Connect to destination
   */
  connect(destination: AudioNode): void {
    this.analyser.disconnect();
    this.analyser.connect(destination);
  }

  /**
   * Set master volume
   */
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(2, value));
    this.outputGain.gain.linearRampToValueAtTime(
      this.muted ? 0 : this.volume,
      this.context.currentTime + 0.05
    );
  }

  /**
   * Set master mute
   */
  setMute(muted: boolean): void {
    this.muted = muted;
    this.outputGain.gain.linearRampToValueAtTime(
      muted ? 0 : this.volume,
      this.context.currentTime + 0.05
    );
  }

  /**
   * Set compressor parameters
   */
  setCompressor(params: {
    threshold?: number;
    ratio?: number;
    attack?: number;
    release?: number;
    knee?: number;
  }): void {
    if (params.threshold !== undefined) {
      this.compressor.threshold.value = params.threshold;
    }
    if (params.ratio !== undefined) {
      this.compressor.ratio.value = params.ratio;
    }
    if (params.attack !== undefined) {
      this.compressor.attack.value = params.attack;
    }
    if (params.release !== undefined) {
      this.compressor.release.value = params.release;
    }
    if (params.knee !== undefined) {
      this.compressor.knee.value = params.knee;
    }
  }

  /**
   * Set limiter parameters
   */
  setLimiter(params: {
    threshold?: number;
    release?: number;
  }): void {
    if (params.threshold !== undefined) {
      this.limiter.threshold.value = params.threshold;
    }
    if (params.release !== undefined) {
      this.limiter.release.value = params.release;
    }
  }

  /**
   * Set EQ band
   */
  setEQBand(band: 0 | 1 | 2, gain: number): void {
    if (this.eq[band]) {
      this.eq[band].gain.linearRampToValueAtTime(
        gain,
        this.context.currentTime + 0.05
      );
    }
  }

  /**
   * Get metering data
   */
  getMetering(): MeteringData {
    const leftData = new Float32Array(this.leftAnalyser.fftSize);
    const rightData = new Float32Array(this.rightAnalyser.fftSize);
    
    this.leftAnalyser.getFloatTimeDomainData(leftData);
    this.rightAnalyser.getFloatTimeDomainData(rightData);
    
    let leftPeak = 0;
    let rightPeak = 0;
    let leftSum = 0;
    let rightSum = 0;
    
    for (let i = 0; i < leftData.length; i++) {
      const leftAbs = Math.abs(leftData[i]);
      const rightAbs = Math.abs(rightData[i]);
      
      if (leftAbs > leftPeak) leftPeak = leftAbs;
      if (rightAbs > rightPeak) rightPeak = rightAbs;
      
      leftSum += leftAbs * leftAbs;
      rightSum += rightAbs * rightAbs;
    }
    
    const leftRMS = Math.sqrt(leftSum / leftData.length);
    const rightRMS = Math.sqrt(rightSum / rightData.length);
    
    return {
      peak: [leftPeak, rightPeak],
      rms: [leftRMS, rightRMS],
      clip: leftPeak > 0.99 || rightPeak > 0.99
    };
  }

  /**
   * Get frequency spectrum
   */
  getSpectrum(): Float32Array {
    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get waveform
   */
  getWaveform(): Float32Array {
    const dataArray = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Get compressor reduction
   */
  getCompressorReduction(): number {
    return this.compressor.reduction;
  }

  /**
   * Get limiter reduction
   */
  getLimiterReduction(): number {
    return this.limiter.reduction;
  }

  /**
   * Reset master bus
   */
  reset(): void {
    // Reset compressor
    this.compressor.threshold.value = -24;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.1;
    this.compressor.knee.value = 10;
    
    // Reset limiter
    this.limiter.threshold.value = -0.1;
    this.limiter.release.value = 0.01;
    
    // Reset EQ
    this.eq.forEach(band => {
      band.gain.value = 0;
    });
    
    // Reset volume
    this.setVolume(1.0);
    this.setMute(false);
    
    logger.info('Master bus reset');
  }

  /**
   * Dispose master bus
   */
  dispose(): void {
    this.inputGain.disconnect();
    this.compressor.disconnect();
    this.eq.forEach(band => band.disconnect());
    this.limiter.disconnect();
    this.outputGain.disconnect();
    this.analyser.disconnect();
    this.meteringSplitter.disconnect();
    this.leftAnalyser.disconnect();
    this.rightAnalyser.disconnect();
    
    logger.info('Master bus disposed');
  }
}