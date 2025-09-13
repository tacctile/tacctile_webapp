import { EventEmitter } from 'events';
import { RecorderAudioWorklet } from 'recorder-audio-worklet';
import { AudioSegment, AudioFeatures } from './AudioProcessor';
import { WordMatch, CommunicationEvent } from './WordDetectionEngine';

export interface SessionMetadata {
  id: string;
  name: string;
  description: string;
  location: string;
  startTime: number;
  endTime?: number;
  duration: number;
  investigatorNames: string[];
  temperature: number;
  humidity: number;
  barometricPressure: number;
  moonPhase: string;
  weatherConditions: string;
  equipmentUsed: string[];
  audioSettings: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    bufferSize: number;
  };
  tags: string[];
  notes: string;
  version: string;
}

export interface SessionEvent {
  id: string;
  timestamp: number;
  type: 'word_detected' | 'communication_event' | 'frequency_change' | 'anomaly_detected' | 
        'marker_added' | 'noise_profile_updated' | 'settings_changed' | 'user_action';
  data: any;
  confidence?: number;
  significance?: number;
  category?: string;
  description: string;
  audioPosition: number; // Position in seconds from session start
}

export interface AudioMarker {
  id: string;
  timestamp: number;
  audioPosition: number;
  type: 'manual' | 'automatic' | 'anomaly' | 'word' | 'communication';
  label: string;
  description: string;
  confidence: number;
  significance: number;
  color: string;
  duration?: number;
  relatedEvents: string[]; // Event IDs
}

export interface SessionAnalytics {
  totalEvents: number;
  wordDetections: number;
  communicationEvents: number;
  anomalyDetections: number;
  manualMarkers: number;
  averageConfidence: number;
  peakActivity: {
    timestamp: number;
    eventCount: number;
    description: string;
  };
  categoryBreakdown: { [category: string]: number };
  significanceDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  audioQualityMetrics: {
    averageSNR: number;
    silencePeriods: number;
    peakAmplitude: number;
    dynamicRange: number;
  };
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'wav' | 'txt' | 'xml';
  includeAudio: boolean;
  includeMetadata: boolean;
  includeEvents: boolean;
  includeMarkers: boolean;
  includeAnalytics: boolean;
  timeRange?: {
    start: number;
    end: number;
  };
  confidenceThreshold?: number;
  significanceThreshold?: number;
  categories?: string[];
}

export interface RecordingSettings {
  autoStart: boolean;
  maxDuration: number; // seconds
  maxFileSize: number; // MB
  compressionEnabled: boolean;
  compressionQuality: number; // 0-1
  autoSave: boolean;
  saveInterval: number; // seconds
  bufferDuration: number; // seconds for circular buffer
  enableTimestamps: boolean;
  enableWaveformGeneration: boolean;
  enableSpectrogramGeneration: boolean;
}

export class SessionRecorder extends EventEmitter {
  private currentSession: SessionMetadata | null = null;
  private isRecording = false;
  private isPaused = false;
  
  private audioRecorder: RecorderAudioWorklet | null = null;
  private audioContext: AudioContext | null = null;
  private recordedChunks: Blob[] = [];
  private audioBuffer: Float32Array[] = [];
  private maxBufferSize = 0;
  
  private sessionEvents: SessionEvent[] = [];
  private audioMarkers: AudioMarker[] = [];
  private settings: RecordingSettings;
  
  // Real-time analysis
  private sessionStartTime = 0;
  private lastSaveTime = 0;
  private waveformData: Float32Array[] = [];
  private spectrogramData: number[][] = [];
  
  // Statistics tracking
  private eventCounter = 0;
  private wordCounter = 0;
  private anomalyCounter = 0;
  private totalConfidence = 0;
  private confidenceCount = 0;

  constructor(settings: Partial<RecordingSettings> = {}) {
    super();

    this.settings = {
      autoStart: false,
      maxDuration: 3600, // 1 hour
      maxFileSize: 500, // 500MB
      compressionEnabled: true,
      compressionQuality: 0.8,
      autoSave: true,
      saveInterval: 300, // 5 minutes
      bufferDuration: 30, // 30 seconds circular buffer
      enableTimestamps: true,
      enableWaveformGeneration: true,
      enableSpectrogramGeneration: false,
      ...settings
    };

    this.maxBufferSize = this.settings.bufferDuration * 44100; // Assuming 44.1kHz
  }

  public async startSession(metadata: Partial<SessionMetadata>): Promise<string> {
    if (this.isRecording) {
      throw new Error('A recording session is already in progress');
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      name: metadata.name || `Session ${new Date().toISOString()}`,
      description: metadata.description || '',
      location: metadata.location || '',
      startTime: Date.now(),
      duration: 0,
      investigatorNames: metadata.investigatorNames || [],
      temperature: metadata.temperature || 20,
      humidity: metadata.humidity || 50,
      barometricPressure: metadata.barometricPressure || 1013.25,
      moonPhase: metadata.moonPhase || 'Unknown',
      weatherConditions: metadata.weatherConditions || '',
      equipmentUsed: metadata.equipmentUsed || [],
      audioSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 1,
        bufferSize: 2048
      },
      tags: metadata.tags || [],
      notes: metadata.notes || '',
      version: '1.0',
      ...metadata
    };

    // Initialize recording state
    this.sessionStartTime = Date.now();
    this.sessionEvents = [];
    this.audioMarkers = [];
    this.recordedChunks = [];
    this.audioBuffer = [];
    this.waveformData = [];
    this.spectrogramData = [];
    
    // Reset counters
    this.eventCounter = 0;
    this.wordCounter = 0;
    this.anomalyCounter = 0;
    this.totalConfidence = 0;
    this.confidenceCount = 0;

    // Log session start
    this.addEvent({
      type: 'user_action',
      data: { action: 'session_started', metadata: this.currentSession },
      description: 'Recording session started',
      audioPosition: 0
    });

    this.emit('sessionStarted', this.currentSession);

    if (this.settings.autoStart) {
      await this.startRecording();
    }

    return sessionId;
  }

  public async startRecording(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.');
    }

    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    try {
      // Initialize audio context if not already done
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 44100 });
      }

      // Get media stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        }
      });

      // Initialize recorder worklet
      this.audioRecorder = new RecorderAudioWorklet(this.audioContext, mediaStream);
      
      // Set up event handlers
      this.setupRecorderEventHandlers();

      // Start recording
      await this.audioRecorder.start();
      
      this.isRecording = true;
      this.isPaused = false;
      this.lastSaveTime = Date.now();

      // Start auto-save if enabled
      if (this.settings.autoSave) {
        this.startAutoSave();
      }

      this.addEvent({
        type: 'user_action',
        data: { action: 'recording_started' },
        description: 'Audio recording started',
        audioPosition: this.getAudioPosition()
      });

      this.emit('recordingStarted');

    } catch (error) {
      this.emit('error', `Failed to start recording: ${error}`);
      throw error;
    }
  }

  private setupRecorderEventHandlers(): void {
    if (!this.audioRecorder) return;

    this.audioRecorder.addEventListener('data', (event: any) => {
      this.handleAudioData(event.data);
    });

    this.audioRecorder.addEventListener('error', (event: any) => {
      this.emit('error', `Recording error: ${event.error}`);
    });
  }

  private handleAudioData(audioData: Float32Array): void {
    // Add to recorded chunks for export
    const audioBlob = new Blob([audioData.buffer], { type: 'audio/wav' });
    this.recordedChunks.push(audioBlob);

    // Maintain circular buffer
    this.audioBuffer.push(new Float32Array(audioData));
    if (this.audioBuffer.length * audioData.length > this.maxBufferSize) {
      this.audioBuffer.shift();
    }

    // Generate waveform data if enabled
    if (this.settings.enableWaveformGeneration) {
      this.generateWaveformData(audioData);
    }

    // Generate spectrogram data if enabled
    if (this.settings.enableSpectrogramGeneration) {
      this.generateSpectrogramData(audioData);
    }

    // Check file size limits
    this.checkFileSizeLimits();
    
    // Check duration limits
    this.checkDurationLimits();
  }

  private generateWaveformData(audioData: Float32Array): void {
    // Downsample for waveform visualization
    const downsampleFactor = 100;
    const downsampledLength = Math.floor(audioData.length / downsampleFactor);
    const downsampledData = new Float32Array(downsampledLength);

    for (let i = 0; i < downsampledLength; i++) {
      let sum = 0;
      for (let j = 0; j < downsampleFactor; j++) {
        const index = i * downsampleFactor + j;
        if (index < audioData.length) {
          sum += Math.abs(audioData[index]);
        }
      }
      downsampledData[i] = sum / downsampleFactor;
    }

    this.waveformData.push(downsampledData);

    // Limit waveform data size
    const maxWaveformPoints = 100000;
    if (this.waveformData.length > maxWaveformPoints) {
      this.waveformData.shift();
    }
  }

  private generateSpectrogramData(audioData: Float32Array): void {
    // Simple FFT for spectrogram (in practice, use a proper FFT library)
    const fftSize = 1024;
    const overlap = 0.5;
    const step = Math.floor(fftSize * (1 - overlap));

    for (let i = 0; i < audioData.length - fftSize; i += step) {
      const frame = audioData.slice(i, i + fftSize);
      const spectrum = this.computeSpectrum(frame);
      this.spectrogramData.push(spectrum);
    }

    // Limit spectrogram data
    const maxSpectrogramFrames = 10000;
    if (this.spectrogramData.length > maxSpectrogramFrames) {
      this.spectrogramData.shift();
    }
  }

  private computeSpectrum(frame: Float32Array): number[] {
    // Simplified spectrum computation
    // In practice, use a proper FFT implementation
    const spectrum: number[] = [];
    const binCount = frame.length / 2;

    for (let i = 0; i < binCount; i++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < frame.length; n++) {
        const angle = -2 * Math.PI * i * n / frame.length;
        real += frame[n] * Math.cos(angle);
        imag += frame[n] * Math.sin(angle);
      }
      
      const magnitude = Math.sqrt(real * real + imag * imag);
      spectrum.push(20 * Math.log10(magnitude + 1e-10)); // Convert to dB
    }

    return spectrum;
  }

  private checkFileSizeLimits(): void {
    const totalSize = this.recordedChunks.reduce((size, chunk) => size + chunk.size, 0);
    const sizeMB = totalSize / (1024 * 1024);

    if (sizeMB > this.settings.maxFileSize) {
      this.emit('warning', `File size limit reached: ${sizeMB.toFixed(1)}MB`);
      
      if (this.settings.autoSave) {
        this.saveSessionData();
        this.recordedChunks = []; // Clear chunks after saving
      }
    }
  }

  private checkDurationLimits(): void {
    const duration = this.getCurrentSessionDuration();
    
    if (duration > this.settings.maxDuration) {
      this.emit('warning', `Duration limit reached: ${duration}s`);
      this.stopRecording();
    }
  }

  public pauseRecording(): void {
    if (!this.isRecording || this.isPaused) return;

    this.isPaused = true;
    
    this.addEvent({
      type: 'user_action',
      data: { action: 'recording_paused' },
      description: 'Recording paused',
      audioPosition: this.getAudioPosition()
    });

    this.emit('recordingPaused');
  }

  public resumeRecording(): void {
    if (!this.isRecording || !this.isPaused) return;

    this.isPaused = false;
    
    this.addEvent({
      type: 'user_action',
      data: { action: 'recording_resumed' },
      description: 'Recording resumed',
      audioPosition: this.getAudioPosition()
    });

    this.emit('recordingResumed');
  }

  public async stopRecording(): Promise<void> {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.isPaused = false;

    if (this.audioRecorder) {
      await this.audioRecorder.stop();
      this.audioRecorder = null;
    }

    this.addEvent({
      type: 'user_action',
      data: { action: 'recording_stopped' },
      description: 'Recording stopped',
      audioPosition: this.getAudioPosition()
    });

    this.emit('recordingStopped');
  }

  public async endSession(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    }

    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.currentSession.duration = this.getCurrentSessionDuration();

      this.addEvent({
        type: 'user_action',
        data: { action: 'session_ended' },
        description: 'Session ended',
        audioPosition: this.getAudioPosition()
      });

      // Final save
      if (this.settings.autoSave) {
        await this.saveSessionData();
      }

      this.emit('sessionEnded', this.currentSession);
      
      this.currentSession = null;
    }
  }

  public onWordDetected(wordMatch: WordMatch): void {
    if (!this.currentSession) return;

    this.wordCounter++;
    this.totalConfidence += wordMatch.confidence;
    this.confidenceCount++;

    const event: SessionEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'word_detected',
      data: wordMatch,
      confidence: wordMatch.confidence,
      significance: this.calculateWordSignificance(wordMatch),
      category: wordMatch.context,
      description: `Word detected: "${wordMatch.word}"`,
      audioPosition: this.getAudioPosition()
    };

    this.addEvent(event);

    // Auto-create marker for high-confidence words
    if (wordMatch.confidence > 0.7) {
      this.addAutomaticMarker({
        type: 'word',
        label: wordMatch.word,
        description: `High-confidence word: ${wordMatch.word} (${(wordMatch.confidence * 100).toFixed(1)}%)`,
        confidence: wordMatch.confidence,
        significance: event.significance || 0.5,
        relatedEvents: [event.id]
      });
    }
  }

  public onCommunicationEvent(commEvent: CommunicationEvent): void {
    if (!this.currentSession) return;

    const event: SessionEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'communication_event',
      data: commEvent,
      confidence: commEvent.confidence,
      significance: commEvent.significance,
      category: commEvent.classification,
      description: `Communication event: "${commEvent.phrase}"`,
      audioPosition: this.getAudioPosition()
    };

    this.addEvent(event);

    // Auto-create marker for significant communications
    if (commEvent.significance > 1.0) {
      this.addAutomaticMarker({
        type: 'communication',
        label: commEvent.phrase,
        description: `Communication: ${commEvent.phrase} (${commEvent.classification})`,
        confidence: commEvent.confidence,
        significance: commEvent.significance,
        duration: commEvent.duration,
        relatedEvents: [event.id]
      });
    }
  }

  public onFrequencyChange(frequency: number, signalStrength: number): void {
    if (!this.currentSession) return;

    this.addEvent({
      type: 'frequency_change',
      data: { frequency, signalStrength },
      description: `Frequency changed to ${frequency} MHz`,
      audioPosition: this.getAudioPosition()
    });
  }

  public onAnomalyDetected(anomalyData: any): void {
    if (!this.currentSession) return;

    this.anomalyCounter++;

    const event: SessionEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'anomaly_detected',
      data: anomalyData,
      significance: 0.8,
      description: 'Audio anomaly detected',
      audioPosition: this.getAudioPosition()
    };

    this.addEvent(event);

    // Auto-create marker for anomalies
    this.addAutomaticMarker({
      type: 'anomaly',
      label: 'Anomaly',
      description: 'Audio anomaly detected',
      confidence: 0.7,
      significance: 0.8,
      relatedEvents: [event.id]
    });
  }

  private addEvent(eventData: Partial<SessionEvent>): void {
    const event: SessionEvent = {
      id: eventData.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: eventData.timestamp || Date.now(),
      type: eventData.type || 'user_action',
      data: eventData.data || {},
      confidence: eventData.confidence,
      significance: eventData.significance,
      category: eventData.category,
      description: eventData.description || '',
      audioPosition: eventData.audioPosition || this.getAudioPosition()
    };

    this.sessionEvents.push(event);
    this.eventCounter++;

    // Limit event history
    if (this.sessionEvents.length > 10000) {
      this.sessionEvents.shift();
    }

    this.emit('eventAdded', event);
  }

  public addManualMarker(label: string, description = '', type = 'manual'): string {
    const marker: AudioMarker = {
      id: `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      audioPosition: this.getAudioPosition(),
      type: type as any,
      label,
      description,
      confidence: 1.0, // Manual markers have 100% confidence
      significance: 1.0,
      color: this.getMarkerColor(type as any),
      relatedEvents: []
    };

    this.audioMarkers.push(marker);

    this.addEvent({
      type: 'marker_added',
      data: { marker },
      description: `Manual marker added: ${label}`,
      audioPosition: marker.audioPosition
    });

    this.emit('markerAdded', marker);
    return marker.id;
  }

  private addAutomaticMarker(markerData: Partial<AudioMarker>): void {
    const marker: AudioMarker = {
      id: `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      audioPosition: this.getAudioPosition(),
      type: markerData.type || 'automatic',
      label: markerData.label || 'Auto Marker',
      description: markerData.description || '',
      confidence: markerData.confidence || 0.5,
      significance: markerData.significance || 0.5,
      color: this.getMarkerColor(markerData.type || 'automatic'),
      duration: markerData.duration,
      relatedEvents: markerData.relatedEvents || []
    };

    this.audioMarkers.push(marker);
    this.emit('markerAdded', marker);
  }

  private getMarkerColor(type: AudioMarker['type']): string {
    const colors = {
      manual: '#3498db',      // Blue
      automatic: '#2ecc71',   // Green  
      anomaly: '#e74c3c',     // Red
      word: '#f39c12',        // Orange
      communication: '#9b59b6' // Purple
    };
    
    return colors[type] || '#95a5a6'; // Gray default
  }

  private calculateWordSignificance(wordMatch: WordMatch): number {
    const categoryWeights = {
      spirit: 2.0,
      response: 1.8,
      emotion: 1.5,
      name: 1.3,
      command: 1.2,
      location: 1.0,
      common: 0.3
    };
    
    const categoryWeight = categoryWeights[wordMatch.context as keyof typeof categoryWeights] || 0.5;
    return Math.min(wordMatch.confidence * categoryWeight, 2.0);
  }

  private getAudioPosition(): number {
    if (!this.sessionStartTime) return 0;
    return (Date.now() - this.sessionStartTime) / 1000;
  }

  private getCurrentSessionDuration(): number {
    if (!this.currentSession) return 0;
    const endTime = this.currentSession.endTime || Date.now();
    return (endTime - this.currentSession.startTime) / 1000;
  }

  private startAutoSave(): void {
    setInterval(() => {
      if (this.isRecording && Date.now() - this.lastSaveTime > this.settings.saveInterval * 1000) {
        this.saveSessionData();
        this.lastSaveTime = Date.now();
      }
    }, 30000); // Check every 30 seconds
  }

  public async saveSessionData(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session to save');
    }

    const sessionData = {
      metadata: this.currentSession,
      events: this.sessionEvents,
      markers: this.audioMarkers,
      analytics: this.generateAnalytics(),
      waveformData: this.settings.enableWaveformGeneration ? this.waveformData : [],
      spectrogramData: this.settings.enableSpectrogramGeneration ? this.spectrogramData : []
    };

    this.emit('sessionSaving', sessionData);
    
    // In a real implementation, save to file system or database
    // For now, just emit the data for external handling
    this.emit('sessionSaved', sessionData);
  }

  public generateAnalytics(): SessionAnalytics {
    const now = Date.now();
    const sessionDuration = this.getCurrentSessionDuration();
    
    // Calculate category breakdown
    const categoryBreakdown: { [key: string]: number } = {};
    this.sessionEvents.forEach(event => {
      if (event.category) {
        categoryBreakdown[event.category] = (categoryBreakdown[event.category] || 0) + 1;
      }
    });

    // Calculate significance distribution
    const significanceDistribution = {
      low: 0,    // 0.0 - 0.5
      medium: 0, // 0.5 - 1.0
      high: 0    // > 1.0
    };

    this.sessionEvents.forEach(event => {
      const sig = event.significance || 0;
      if (sig <= 0.5) significanceDistribution.low++;
      else if (sig <= 1.0) significanceDistribution.medium++;
      else significanceDistribution.high++;
    });

    // Find peak activity period
    const windowSize = 60000; // 1 minute windows
    let maxActivity = 0;
    let peakTimestamp = this.sessionStartTime;
    
    for (let time = this.sessionStartTime; time < now; time += windowSize) {
      const windowEvents = this.sessionEvents.filter(event => 
        event.timestamp >= time && event.timestamp < time + windowSize
      ).length;
      
      if (windowEvents > maxActivity) {
        maxActivity = windowEvents;
        peakTimestamp = time;
      }
    }

    // Calculate audio quality metrics from recent audio data
    let averageSNR = 0;
    let peakAmplitude = 0;
    let silencePeriods = 0;
    
    if (this.audioBuffer.length > 0) {
      let totalSNR = 0;
      let snrCount = 0;
      
      this.audioBuffer.forEach(buffer => {
        // Calculate RMS for SNR approximation
        let rms = 0;
        let peak = 0;
        let silence = true;
        
        buffer.forEach(sample => {
          const absSample = Math.abs(sample);
          rms += sample * sample;
          peak = Math.max(peak, absSample);
          if (absSample > 0.001) silence = false;
        });
        
        rms = Math.sqrt(rms / buffer.length);
        if (rms > 0.001) {
          totalSNR += 20 * Math.log10(peak / (rms + 1e-10));
          snrCount++;
        }
        
        peakAmplitude = Math.max(peakAmplitude, peak);
        if (silence) silencePeriods++;
      });
      
      averageSNR = snrCount > 0 ? totalSNR / snrCount : 0;
    }

    return {
      totalEvents: this.eventCounter,
      wordDetections: this.wordCounter,
      communicationEvents: this.sessionEvents.filter(e => e.type === 'communication_event').length,
      anomalyDetections: this.anomalyCounter,
      manualMarkers: this.audioMarkers.filter(m => m.type === 'manual').length,
      averageConfidence: this.confidenceCount > 0 ? this.totalConfidence / this.confidenceCount : 0,
      peakActivity: {
        timestamp: peakTimestamp,
        eventCount: maxActivity,
        description: `${maxActivity} events in 1-minute period`
      },
      categoryBreakdown,
      significanceDistribution,
      audioQualityMetrics: {
        averageSNR,
        silencePeriods,
        peakAmplitude,
        dynamicRange: peakAmplitude > 0 ? 20 * Math.log10(peakAmplitude / 0.001) : 0
      }
    };
  }

  public async exportSession(options: ExportOptions): Promise<Blob | string> {
    if (!this.currentSession) {
      throw new Error('No session to export');
    }

    const sessionData: any = {};

    if (options.includeMetadata) {
      sessionData.metadata = this.currentSession;
    }

    if (options.includeEvents) {
      let events = [...this.sessionEvents];
      
      // Apply filters
      if (options.timeRange) {
        events = events.filter(e => 
          e.timestamp >= options.timeRange!.start && 
          e.timestamp <= options.timeRange!.end
        );
      }
      
      if (options.confidenceThreshold) {
        events = events.filter(e => 
          !e.confidence || e.confidence >= options.confidenceThreshold!
        );
      }
      
      if (options.significanceThreshold) {
        events = events.filter(e => 
          !e.significance || e.significance >= options.significanceThreshold!
        );
      }
      
      if (options.categories) {
        events = events.filter(e => 
          !e.category || options.categories!.includes(e.category)
        );
      }
      
      sessionData.events = events;
    }

    if (options.includeMarkers) {
      sessionData.markers = this.audioMarkers;
    }

    if (options.includeAnalytics) {
      sessionData.analytics = this.generateAnalytics();
    }

    switch (options.format) {
      case 'json':
        return new Blob([JSON.stringify(sessionData, null, 2)], { 
          type: 'application/json' 
        });
        
      case 'csv':
        return new Blob([this.convertToCSV(sessionData)], { 
          type: 'text/csv' 
        });
        
      case 'txt':
        return new Blob([this.convertToText(sessionData)], { 
          type: 'text/plain' 
        });
        
      case 'xml':
        return new Blob([this.convertToXML(sessionData)], { 
          type: 'application/xml' 
        });
        
      case 'wav':
        if (options.includeAudio && this.recordedChunks.length > 0) {
          return new Blob(this.recordedChunks, { type: 'audio/wav' });
        }
        throw new Error('No audio data available for WAV export');
        
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private convertToCSV(data: any): string {
    let csv = '';
    
    if (data.events) {
      csv += 'Timestamp,Type,Description,Confidence,Significance,Category,Audio Position\n';
      data.events.forEach((event: SessionEvent) => {
        csv += `${new Date(event.timestamp).toISOString()},`;
        csv += `${event.type},`;
        csv += `"${event.description.replace(/"/g, '""')}",`;
        csv += `${event.confidence || ''},`;
        csv += `${event.significance || ''},`;
        csv += `${event.category || ''},`;
        csv += `${event.audioPosition}\n`;
      });
    }
    
    return csv;
  }

  private convertToText(data: any): string {
    let text = '';
    
    if (data.metadata) {
      text += `Session: ${data.metadata.name}\n`;
      text += `Location: ${data.metadata.location}\n`;
      text += `Start: ${new Date(data.metadata.startTime).toISOString()}\n`;
      text += `Duration: ${data.metadata.duration}s\n\n`;
    }
    
    if (data.events) {
      text += 'EVENTS:\n';
      data.events.forEach((event: SessionEvent) => {
        text += `${new Date(event.timestamp).toISOString()} - ${event.description}\n`;
      });
    }
    
    return text;
  }

  private convertToXML(data: any): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<session>\n';
    
    if (data.metadata) {
      xml += '  <metadata>\n';
      Object.entries(data.metadata).forEach(([key, value]) => {
        xml += `    <${key}>${value}</${key}>\n`;
      });
      xml += '  </metadata>\n';
    }
    
    if (data.events) {
      xml += '  <events>\n';
      data.events.forEach((event: SessionEvent) => {
        xml += '    <event>\n';
        Object.entries(event).forEach(([key, value]) => {
          if (typeof value === 'object') {
            xml += `      <${key}>${JSON.stringify(value)}</${key}>\n`;
          } else {
            xml += `      <${key}>${value}</${key}>\n`;
          }
        });
        xml += '    </event>\n';
      });
      xml += '  </events>\n';
    }
    
    xml += '</session>';
    return xml;
  }

  // Getters
  public getCurrentSession(): SessionMetadata | null {
    return this.currentSession;
  }

  public getSessionEvents(): SessionEvent[] {
    return [...this.sessionEvents];
  }

  public getAudioMarkers(): AudioMarker[] {
    return [...this.audioMarkers];
  }

  public getWaveformData(): Float32Array[] {
    return [...this.waveformData];
  }

  public getSpectrogramData(): number[][] {
    return [...this.spectrogramData];
  }

  public isSessionActive(): boolean {
    return this.currentSession !== null;
  }

  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  public isCurrentlyPaused(): boolean {
    return this.isPaused;
  }

  public updateSettings(newSettings: Partial<RecordingSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    if (newSettings.bufferDuration) {
      this.maxBufferSize = newSettings.bufferDuration * 44100;
    }
    
    this.emit('settingsUpdated', this.settings);
  }

  public async cleanup(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    }
    
    if (this.currentSession) {
      await this.endSession();
    }

    this.recordedChunks = [];
    this.audioBuffer = [];
    this.waveformData = [];
    this.spectrogramData = [];
    
    this.emit('cleanup');
  }
}