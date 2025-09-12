/**
 * Core Audio Engine
 * Main audio processing engine with Web Audio API
 */

import { EventEmitter } from 'events';
import { AudioTrack } from './AudioTrack';
import { MasterBus } from './MasterBus';
import { EffectsRack } from './EffectsRack';
import { SpectralAnalyzer } from '../analysis/SpectralAnalyzer';
import { EVPDetector } from '../analysis/EVPDetector';
import { AudioEngineConfig, EngineState, TransportState } from '../types';
import { logger } from '../../../utils/logger';

export class AudioEngine extends EventEmitter {
  private context: AudioContext;
  private masterBus: MasterBus;
  private tracks: Map<string, AudioTrack>;
  private analyzer: SpectralAnalyzer;
  private evpDetector: EVPDetector;
  private effectsRack: EffectsRack;
  
  private state: EngineState;
  private transport: TransportState;
  private config: AudioEngineConfig;
  
  private animationFrame: number | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;

  constructor(config?: Partial<AudioEngineConfig>) {
    super();
    
    this.config = {
      sampleRate: 48000,
      bufferSize: 2048,
      maxTracks: 16,
      latencyHint: 'interactive',
      ...config
    };
    
    this.state = EngineState.STOPPED;
    this.transport = {
      playing: false,
      recording: false,
      currentTime: 0,
      duration: 0,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 }
    };
    
    this.tracks = new Map();
    this.initialize();
  }

  /**
   * Initialize audio engine
   */
  private async initialize(): Promise<void> {
    try {
      // Create audio context
      this.context = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latencyHint
      });
      
      // Initialize master bus
      this.masterBus = new MasterBus(this.context);
      
      // Initialize analyzers
      this.analyzer = new SpectralAnalyzer(this.context, {
        fftSize: this.config.bufferSize,
        smoothingTimeConstant: 0.8
      });
      
      this.evpDetector = new EVPDetector(this.context);
      
      // Initialize effects rack
      this.effectsRack = new EffectsRack(this.context);
      
      // Connect analyzer to master output
      this.masterBus.connect(this.analyzer.getInput());
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.state = EngineState.READY;
      this.emit('engineReady');
      
      logger.info('Audio engine initialized', {
        sampleRate: this.context.sampleRate,
        state: this.context.state
      });
    } catch (error) {
      logger.error('Failed to initialize audio engine', error);
      this.state = EngineState.ERROR;
      this.emit('engineError', error);
      throw error;
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Handle context state changes
    this.context.addEventListener('statechange', () => {
      logger.info('Audio context state changed', { state: this.context.state });
      this.emit('contextStateChange', this.context.state);
    });
  }

  /**
   * Create a new audio track
   */
  async createTrack(id: string, name: string, type: 'audio' | 'aux' = 'audio'): Promise<AudioTrack> {
    if (this.tracks.size >= this.config.maxTracks) {
      throw new Error(`Maximum track limit (${this.config.maxTracks}) reached`);
    }
    
    const track = new AudioTrack(this.context, {
      id,
      name,
      type,
      channelCount: 2
    });
    
    // Connect track to master bus
    track.connect(this.masterBus.getInput());
    
    // Store track
    this.tracks.set(id, track);
    
    this.emit('trackCreated', { id, name, type });
    logger.info('Track created', { id, name, type });
    
    return track;
  }

  /**
   * Remove a track
   */
  removeTrack(id: string): void {
    const track = this.tracks.get(id);
    if (!track) return;
    
    track.disconnect();
    track.dispose();
    this.tracks.delete(id);
    
    this.emit('trackRemoved', { id });
    logger.info('Track removed', { id });
  }

  /**
   * Get track by ID
   */
  getTrack(id: string): AudioTrack | undefined {
    return this.tracks.get(id);
  }

  /**
   * Get all tracks
   */
  getTracks(): AudioTrack[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Load audio file into track
   */
  async loadAudioFile(trackId: string, file: File | ArrayBuffer): Promise<AudioBuffer> {
    const track = this.tracks.get(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }
    
    let arrayBuffer: ArrayBuffer;
    
    if (file instanceof File) {
      arrayBuffer = await file.arrayBuffer();
    } else {
      arrayBuffer = file;
    }
    
    // Decode audio data
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    
    // Load into track
    await track.loadBuffer(audioBuffer);
    
    // Update transport duration
    this.updateTransportDuration();
    
    this.emit('audioLoaded', { trackId, duration: audioBuffer.duration });
    logger.info('Audio loaded', { 
      trackId, 
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate 
    });
    
    return audioBuffer;
  }

  /**
   * Start playback
   */
  play(): void {
    if (this.transport.playing) return;
    
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
    
    this.startTime = this.context.currentTime - this.pauseTime;
    this.transport.playing = true;
    
    // Start all tracks
    this.tracks.forEach(track => {
      track.play(this.pauseTime);
    });
    
    // Start animation loop
    this.startAnimationLoop();
    
    this.state = EngineState.PLAYING;
    this.emit('transportPlay');
    logger.info('Playback started');
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.transport.playing) return;
    
    this.pauseTime = this.context.currentTime - this.startTime;
    this.transport.playing = false;
    
    // Stop all tracks
    this.tracks.forEach(track => {
      track.stop();
    });
    
    // Stop animation loop
    this.stopAnimationLoop();
    
    this.state = EngineState.PAUSED;
    this.emit('transportPause');
    logger.info('Playback paused');
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.pauseTime = 0;
    this.transport.playing = false;
    this.transport.currentTime = 0;
    
    // Stop all tracks
    this.tracks.forEach(track => {
      track.stop();
      track.seek(0);
    });
    
    // Stop animation loop
    this.stopAnimationLoop();
    
    this.state = EngineState.STOPPED;
    this.emit('transportStop');
    logger.info('Playback stopped');
  }

  /**
   * Seek to position
   */
  seek(time: number): void {
    const wasPlaying = this.transport.playing;
    
    if (wasPlaying) {
      this.stop();
    }
    
    this.pauseTime = Math.max(0, Math.min(time, this.transport.duration));
    this.transport.currentTime = this.pauseTime;
    
    // Seek all tracks
    this.tracks.forEach(track => {
      track.seek(this.pauseTime);
    });
    
    if (wasPlaying) {
      this.play();
    }
    
    this.emit('transportSeek', this.pauseTime);
  }

  /**
   * Start recording
   */
  async startRecording(trackId?: string): Promise<MediaStream> {
    if (this.transport.recording) {
      throw new Error('Already recording');
    }
    
    // Get media stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: this.config.sampleRate
      }
    });
    
    // Create or get track
    const track = trackId ? this.tracks.get(trackId) : null;
    if (track) {
      await track.startRecording(stream);
    }
    
    this.transport.recording = true;
    this.state = EngineState.RECORDING;
    this.emit('recordingStarted', { trackId });
    logger.info('Recording started', { trackId });
    
    return stream;
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.transport.recording) return null;
    
    let recordedBlob: Blob | null = null;
    
    // Stop recording on all tracks
    for (const track of this.tracks.values()) {
      if (track.isRecording()) {
        const blob = await track.stopRecording();
        if (blob) recordedBlob = blob;
      }
    }
    
    this.transport.recording = false;
    this.state = EngineState.READY;
    this.emit('recordingStopped');
    logger.info('Recording stopped');
    
    return recordedBlob;
  }

  /**
   * Apply effect to track
   */
  applyEffect(trackId: string, effectType: string, params?: any): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    
    const effect = this.effectsRack.createEffect(effectType, params);
    track.addEffect(effect);
    
    this.emit('effectApplied', { trackId, effectType });
    logger.info('Effect applied', { trackId, effectType });
  }

  /**
   * Remove effect from track
   */
  removeEffect(trackId: string, effectId: string): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    
    track.removeEffect(effectId);
    this.emit('effectRemoved', { trackId, effectId });
  }

  /**
   * Get spectral data
   */
  getSpectralData(): {
    frequencies: Float32Array;
    timeDomain: Float32Array;
    spectrum: number[][];
  } {
    return this.analyzer.getData();
  }

  /**
   * Start EVP detection
   */
  startEVPDetection(sensitivity: number = 0.7): void {
    this.evpDetector.start(sensitivity);
    
    this.evpDetector.on('evpDetected', (data) => {
      this.emit('evpDetected', data);
    });
    
    logger.info('EVP detection started', { sensitivity });
  }

  /**
   * Stop EVP detection
   */
  stopEVPDetection(): void {
    this.evpDetector.stop();
    logger.info('EVP detection stopped');
  }

  /**
   * Export audio
   */
  async exportAudio(format: 'wav' | 'mp3' = 'wav'): Promise<Blob> {
    const wasPlaying = this.transport.playing;
    if (wasPlaying) {
      this.stop();
    }
    
    // Render offline
    const offlineContext = new OfflineAudioContext({
      numberOfChannels: 2,
      length: this.transport.duration * this.config.sampleRate,
      sampleRate: this.config.sampleRate
    });
    
    // Recreate track graph in offline context
    const renderedBuffers: AudioBuffer[] = [];
    
    for (const track of this.tracks.values()) {
      const buffer = await track.renderOffline(offlineContext);
      if (buffer) renderedBuffers.push(buffer);
    }
    
    // Mix down to stereo
    const mixedBuffer = await this.mixBuffers(offlineContext, renderedBuffers);
    
    // Encode to format
    let blob: Blob;
    if (format === 'wav') {
      blob = await this.encodeWAV(mixedBuffer);
    } else {
      blob = await this.encodeMP3(mixedBuffer);
    }
    
    if (wasPlaying) {
      this.play();
    }
    
    logger.info('Audio exported', { format, size: blob.size });
    return blob;
  }

  /**
   * Animation loop for UI updates
   */
  private startAnimationLoop(): void {
    const update = () => {
      if (!this.transport.playing) return;
      
      // Update current time
      this.transport.currentTime = this.context.currentTime - this.startTime;
      
      // Check for loop
      if (this.transport.loop && this.transport.currentTime >= this.transport.loopEnd) {
        this.seek(this.transport.loopStart);
      }
      
      // Emit time update
      this.emit('timeUpdate', this.transport.currentTime);
      
      // Get and emit analyzer data
      const spectralData = this.getSpectralData();
      this.emit('spectralData', spectralData);
      
      // Continue loop
      this.animationFrame = requestAnimationFrame(update);
    };
    
    update();
  }

  /**
   * Stop animation loop
   */
  private stopAnimationLoop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Update transport duration
   */
  private updateTransportDuration(): void {
    let maxDuration = 0;
    
    this.tracks.forEach(track => {
      const duration = track.getDuration();
      if (duration > maxDuration) {
        maxDuration = duration;
      }
    });
    
    this.transport.duration = maxDuration;
    this.emit('durationUpdate', maxDuration);
  }

  /**
   * Mix multiple buffers
   */
  private async mixBuffers(
    context: OfflineAudioContext,
    buffers: AudioBuffer[]
  ): Promise<AudioBuffer> {
    const length = Math.max(...buffers.map(b => b.length));
    const mixedBuffer = context.createBuffer(2, length, context.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = mixedBuffer.getChannelData(channel);
      
      for (const buffer of buffers) {
        if (channel < buffer.numberOfChannels) {
          const sourceData = buffer.getChannelData(channel);
          for (let i = 0; i < sourceData.length; i++) {
            channelData[i] += sourceData[i] / buffers.length;
          }
        }
      }
    }
    
    return mixedBuffer;
  }

  /**
   * Encode buffer to WAV
   */
  private async encodeWAV(buffer: AudioBuffer): Promise<Blob> {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const value = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, value * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Encode buffer to MP3
   */
  private async encodeMP3(buffer: AudioBuffer): Promise<Blob> {
    // Import lamejs dynamically
    const lamejs = await import('lamejs');
    const encoder = new lamejs.Mp3Encoder(buffer.numberOfChannels, buffer.sampleRate, 128);
    
    const samples = buffer.length;
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.numberOfChannels > 1 ? 
      buffer.getChannelData(1) : leftChannel;
    
    const sampleBlockSize = 1152;
    const mp3Data: Uint8Array[] = [];
    
    for (let i = 0; i < samples; i += sampleBlockSize) {
      const leftChunk = leftChannel.subarray(i, i + sampleBlockSize);
      const rightChunk = rightChannel.subarray(i, i + sampleBlockSize);
      
      const mp3buf = encoder.encodeBuffer(
        new Int16Array(leftChunk.buffer),
        new Int16Array(rightChunk.buffer)
      );
      
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }
    
    const mp3buf = encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
    
    return new Blob(mp3Data, { type: 'audio/mp3' });
  }

  /**
   * Get engine state
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Get transport state
   */
  getTransport(): TransportState {
    return { ...this.transport };
  }

  /**
   * Set loop points
   */
  setLoop(enabled: boolean, start?: number, end?: number): void {
    this.transport.loop = enabled;
    if (start !== undefined) this.transport.loopStart = start;
    if (end !== undefined) this.transport.loopEnd = end;
    
    this.emit('loopChanged', {
      enabled,
      start: this.transport.loopStart,
      end: this.transport.loopEnd
    });
  }

  /**
   * Set tempo
   */
  setTempo(bpm: number): void {
    this.transport.tempo = Math.max(20, Math.min(300, bpm));
    this.emit('tempoChanged', this.transport.tempo);
  }

  /**
   * Dispose engine
   */
  dispose(): void {
    this.stop();
    
    // Dispose all tracks
    this.tracks.forEach(track => {
      track.dispose();
    });
    this.tracks.clear();
    
    // Dispose components
    this.masterBus.dispose();
    this.analyzer.dispose();
    this.evpDetector.dispose();
    this.effectsRack.dispose();
    
    // Close context
    this.context.close();
    
    this.removeAllListeners();
    logger.info('Audio engine disposed');
  }
}

// Export singleton instance
export const audioEngine = new AudioEngine();