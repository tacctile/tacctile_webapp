/**
 * Audio Track
 * Individual track in the multi-track timeline
 */

import { v4 as uuidv4 } from 'uuid';
import { TrackConfig, TrackState, AudioRegion, Effect } from '../types';
import { logger } from '../../../utils/logger';

export class AudioTrack {
  private context: AudioContext;
  private config: TrackConfig;
  private state: TrackState;
  
  // Audio nodes
  private gainNode: GainNode;
  private panNode: StereoPannerNode;
  private analyzerNode: AnalyserNode;
  private effectsChain: Effect[] = [];
  private outputNode: GainNode;
  
  // Audio regions
  private regions: Map<string, AudioRegion> = new Map();
  private activeSource: AudioBufferSourceNode | null = null;
  
  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;
  
  constructor(context: AudioContext, config: TrackConfig) {
    this.context = context;
    this.config = config;
    
    this.state = {
      muted: false,
      solo: false,
      armed: false,
      volume: 1.0,
      pan: 0,
      recording: false
    };
    
    this.setupAudioGraph();
  }
  
  /**
   * Set up audio processing graph
   */
  private setupAudioGraph(): void {
    // Create nodes
    this.gainNode = this.context.createGain();
    this.panNode = this.context.createStereoPanner();
    this.analyzerNode = this.context.createAnalyser();
    this.outputNode = this.context.createGain();
    
    // Configure analyzer
    this.analyzerNode.fftSize = 2048;
    this.analyzerNode.smoothingTimeConstant = 0.8;
    
    // Connect basic chain
    this.gainNode.connect(this.panNode);
    this.panNode.connect(this.analyzerNode);
    this.analyzerNode.connect(this.outputNode);
    
    // Set initial values
    this.gainNode.gain.value = this.state.volume;
    this.panNode.pan.value = this.state.pan;
  }
  
  /**
   * Load audio buffer
   */
  async loadBuffer(buffer: AudioBuffer, startTime = 0): Promise<void> {
    const region: AudioRegion = {
      id: uuidv4(),
      trackId: this.config.id,
      buffer,
      startTime,
      duration: buffer.duration,
      offset: 0,
      gain: 1.0,
      fadeIn: 0,
      fadeOut: 0,
      muted: false
    };
    
    this.regions.set(region.id, region);
    logger.info('Audio region loaded', { 
      trackId: this.config.id, 
      regionId: region.id,
      duration: buffer.duration 
    });
  }
  
  /**
   * Play track
   */
  play(when = 0): void {
    if (this.state.muted) return;
    
    // Stop any existing playback
    this.stop();
    
    // Play all regions
    this.regions.forEach(region => {
      if (!region.muted) {
        this.playRegion(region, when);
      }
    });
  }
  
  /**
   * Play a single region
   */
  private playRegion(region: AudioRegion, when: number): void {
    const source = this.context.createBufferSource();
    source.buffer = region.buffer;
    
    // Apply region gain
    const regionGain = this.context.createGain();
    regionGain.gain.value = region.gain;
    
    // Apply fades
    if (region.fadeIn > 0) {
      regionGain.gain.setValueAtTime(0, when);
      regionGain.gain.linearRampToValueAtTime(region.gain, when + region.fadeIn);
    }
    
    if (region.fadeOut > 0) {
      const fadeOutTime = when + region.duration - region.fadeOut;
      regionGain.gain.setValueAtTime(region.gain, fadeOutTime);
      regionGain.gain.linearRampToValueAtTime(0, when + region.duration);
    }
    
    // Connect and play
    source.connect(regionGain);
    regionGain.connect(this.gainNode);
    
    source.start(when + region.startTime, region.offset, region.duration);
    
    // Store reference for stopping
    this.activeSource = source;
  }
  
  /**
   * Stop playback
   */
  stop(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch (e) {
        // Already stopped
      }
      this.activeSource = null;
    }
  }
  
  /**
   * Seek to position
   */
  seek(time: number): void {
    // Update region offsets based on seek time
    this.regions.forEach(region => {
      if (time >= region.startTime && time < region.startTime + region.duration) {
        region.offset = time - region.startTime;
      } else {
        region.offset = 0;
      }
    });
  }
  
  /**
   * Start recording
   */
  async startRecording(stream: MediaStream): Promise<void> {
    if (this.state.recording) return;
    
    this.recordingStream = stream;
    this.recordedChunks = [];
    
    // Create media recorder
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
    
    // Connect stream to track for monitoring
    const source = this.context.createMediaStreamSource(stream);
    source.connect(this.gainNode);
    
    this.mediaRecorder.start();
    this.state.recording = true;
    
    logger.info('Track recording started', { trackId: this.config.id });
  }
  
  /**
   * Stop recording
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.state.recording || !this.mediaRecorder) return null;
    
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }
      
      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        
        // Convert to audio buffer and add as region
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        await this.loadBuffer(audioBuffer);
        
        // Clean up
        this.recordedChunks = [];
        this.recordingStream?.getTracks().forEach(track => track.stop());
        this.recordingStream = null;
        
        resolve(blob);
      };
      
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
      this.state.recording = false;
      
      logger.info('Track recording stopped', { trackId: this.config.id });
    });
  }
  
  /**
   * Add effect to chain
   */
  addEffect(effect: Effect): void {
    this.effectsChain.push(effect);
    this.rebuildEffectsChain();
    logger.info('Effect added to track', { 
      trackId: this.config.id, 
      effectType: effect.type 
    });
  }
  
  /**
   * Remove effect from chain
   */
  removeEffect(effectId: string): void {
    const index = this.effectsChain.findIndex(e => e.id === effectId);
    if (index !== -1) {
      const effect = this.effectsChain[index];
      if (effect.node) {
        effect.node.disconnect();
      }
      this.effectsChain.splice(index, 1);
      this.rebuildEffectsChain();
      
      logger.info('Effect removed from track', { 
        trackId: this.config.id, 
        effectId 
      });
    }
  }
  
  /**
   * Rebuild effects chain
   */
  private rebuildEffectsChain(): void {
    // Disconnect all
    this.panNode.disconnect();
    this.effectsChain.forEach(effect => {
      if (effect.node) effect.node.disconnect();
    });
    
    // Rebuild chain
    let previousNode: AudioNode = this.panNode;
    
    for (const effect of this.effectsChain) {
      if (effect.node && effect.enabled) {
        previousNode.connect(effect.node);
        previousNode = effect.node;
      }
    }
    
    // Connect to analyzer
    previousNode.connect(this.analyzerNode);
  }
  
  /**
   * Set volume
   */
  setVolume(value: number): void {
    this.state.volume = Math.max(0, Math.min(2, value));
    this.gainNode.gain.linearRampToValueAtTime(
      this.state.volume,
      this.context.currentTime + 0.05
    );
  }
  
  /**
   * Set pan
   */
  setPan(value: number): void {
    this.state.pan = Math.max(-1, Math.min(1, value));
    this.panNode.pan.linearRampToValueAtTime(
      this.state.pan,
      this.context.currentTime + 0.05
    );
  }
  
  /**
   * Set mute
   */
  setMute(muted: boolean): void {
    this.state.muted = muted;
    this.outputNode.gain.value = muted ? 0 : 1;
  }
  
  /**
   * Set solo
   */
  setSolo(solo: boolean): void {
    this.state.solo = solo;
  }
  
  /**
   * Set armed for recording
   */
  setArmed(armed: boolean): void {
    this.state.armed = armed;
  }
  
  /**
   * Get metering data
   */
  getMetering(): { peak: number; rms: number } {
    const bufferLength = this.analyzerNode.fftSize;
    const dataArray = new Float32Array(bufferLength);
    this.analyzerNode.getFloatTimeDomainData(dataArray);
    
    let peak = 0;
    let sum = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const value = Math.abs(dataArray[i]);
      if (value > peak) peak = value;
      sum += value * value;
    }
    
    const rms = Math.sqrt(sum / bufferLength);
    
    return { peak, rms };
  }
  
  /**
   * Get frequency data
   */
  getFrequencyData(): Float32Array {
    const bufferLength = this.analyzerNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyzerNode.getFloatFrequencyData(dataArray);
    return dataArray;
  }
  
  /**
   * Connect to destination
   */
  connect(destination: AudioNode): void {
    this.outputNode.connect(destination);
  }
  
  /**
   * Disconnect from all
   */
  disconnect(): void {
    this.outputNode.disconnect();
  }
  
  /**
   * Get track duration
   */
  getDuration(): number {
    let maxEnd = 0;
    this.regions.forEach(region => {
      const end = region.startTime + region.duration;
      if (end > maxEnd) maxEnd = end;
    });
    return maxEnd;
  }
  
  /**
   * Get all regions
   */
  getRegions(): AudioRegion[] {
    return Array.from(this.regions.values());
  }
  
  /**
   * Remove region
   */
  removeRegion(regionId: string): void {
    this.regions.delete(regionId);
    logger.info('Region removed', { trackId: this.config.id, regionId });
  }
  
  /**
   * Clear all regions
   */
  clearRegions(): void {
    this.regions.clear();
    logger.info('All regions cleared', { trackId: this.config.id });
  }
  
  /**
   * Render offline
   */
  async renderOffline(offlineContext: OfflineAudioContext): Promise<AudioBuffer | null> {
    if (this.regions.size === 0) return null;
    
    const duration = this.getDuration();
    const buffer = offlineContext.createBuffer(
      2,
      duration * offlineContext.sampleRate,
      offlineContext.sampleRate
    );
    
    // Render each region to the buffer
    for (const region of this.regions.values()) {
      if (!region.muted) {
        const startSample = Math.floor(region.startTime * offlineContext.sampleRate);
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const sourceData = region.buffer.getChannelData(
            Math.min(channel, region.buffer.numberOfChannels - 1)
          );
          const targetData = buffer.getChannelData(channel);
          
          for (let i = 0; i < sourceData.length; i++) {
            const targetIndex = startSample + i;
            if (targetIndex < targetData.length) {
              targetData[targetIndex] += sourceData[i] * region.gain;
            }
          }
        }
      }
    }
    
    return buffer;
  }
  
  /**
   * Check if recording
   */
  isRecording(): boolean {
    return this.state.recording;
  }
  
  /**
   * Get track state
   */
  getState(): TrackState {
    return { ...this.state };
  }
  
  /**
   * Get track config
   */
  getConfig(): TrackConfig {
    return { ...this.config };
  }
  
  /**
   * Dispose track
   */
  dispose(): void {
    this.stop();
    this.disconnect();
    
    if (this.state.recording) {
      this.stopRecording();
    }
    
    this.regions.clear();
    this.effectsChain = [];
    
    logger.info('Track disposed', { trackId: this.config.id });
  }
}