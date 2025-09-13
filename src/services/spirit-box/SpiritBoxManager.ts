import { EventEmitter } from 'events';
import { RadioScannerCore, ScanSettings } from './RadioScannerCore';
import { AudioProcessor, AudioProcessingConfig } from './AudioProcessor';
import { WordDetectionEngine, DetectionSettings } from './WordDetectionEngine';
import { SessionRecorder, RecordingSettings, SessionMetadata } from './SessionRecorder';

export interface SpiritBoxConfig {
  scanSettings?: Partial<ScanSettings>;
  audioConfig?: Partial<AudioProcessingConfig>;
  detectionSettings?: Partial<DetectionSettings>;
  recordingSettings?: Partial<RecordingSettings>;
}

export interface SpiritBoxStatus {
  isInitialized: boolean;
  isScanning: boolean;
  isRecording: boolean;
  currentFrequency: number;
  currentSession: SessionMetadata | null;
  lastError: string | null;
}

export class SpiritBoxManager extends EventEmitter {
  private radioScanner: RadioScannerCore | null = null;
  private audioProcessor: AudioProcessor | null = null;
  private wordDetector: WordDetectionEngine | null = null;
  private sessionRecorder: SessionRecorder | null = null;

  private isInitialized = false;
  private lastError: string | null = null;

  constructor(private config: SpiritBoxConfig = {}) {
    super();
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize radio scanner
      this.radioScanner = new RadioScannerCore(
        this.config.scanSettings,
        { sampleRate: 44100, bufferSize: 2048, enableNoiseReduction: true, enableAutoGainControl: true, enableEchoCancellation: true }
      );

      // Initialize word detection engine
      this.wordDetector = new WordDetectionEngine(this.config.detectionSettings);

      // Initialize session recorder
      this.sessionRecorder = new SessionRecorder(this.config.recordingSettings);

      // Set up cross-service integrations
      this.setupIntegrations();

      this.isInitialized = true;
      this.lastError = null;

      this.emit('initialized');
    } catch (error) {
      this.lastError = `Initialization failed: ${error}`;
      this.emit('error', this.lastError);
      throw error;
    }
  }

  private setupIntegrations(): void {
    if (!this.radioScanner || !this.wordDetector || !this.sessionRecorder) return;

    // Radio scanner to session recorder integration
    this.radioScanner.on('frequencyChanged', (frequency, signalStrength) => {
      this.sessionRecorder?.onFrequencyChange(frequency, signalStrength || 0);
    });

    this.radioScanner.on('strongSignalDetected', (data) => {
      this.emit('strongSignal', data);
    });

    // Word detector to session recorder integration
    this.wordDetector.on('wordDetected', (word) => {
      this.sessionRecorder?.onWordDetected(word);
      this.emit('wordDetected', word);
    });

    this.wordDetector.on('communicationEvent', (event) => {
      this.sessionRecorder?.onCommunicationEvent(event);
      this.emit('communicationEvent', event);
    });

    // Audio processing integration
    this.radioScanner.on('metrics', (metrics) => {
      this.emit('radioMetrics', metrics);
    });

    // Session recorder events
    this.sessionRecorder.on('sessionStarted', (session) => {
      this.emit('sessionStarted', session);
    });

    this.sessionRecorder.on('sessionEnded', (session) => {
      this.emit('sessionEnded', session);
    });

    // Error handling
    [this.radioScanner, this.wordDetector, this.sessionRecorder].forEach(service => {
      service.on('error', (error) => {
        this.lastError = error;
        this.emit('error', error);
      });
    });
  }

  public async startInvestigation(sessionMetadata: Partial<SessionMetadata>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Spirit Box not initialized');
    }

    try {
      // Start session recording
      await this.sessionRecorder!.startSession(sessionMetadata);
      await this.sessionRecorder!.startRecording();

      // Start radio scanning
      await this.radioScanner!.startScanning();

      this.emit('investigationStarted');
    } catch (error) {
      this.lastError = `Failed to start investigation: ${error}`;
      this.emit('error', this.lastError);
      throw error;
    }
  }

  public async stopInvestigation(): Promise<void> {
    try {
      // Stop radio scanning
      this.radioScanner?.stopScanning();

      // Stop session recording
      await this.sessionRecorder?.endSession();

      this.emit('investigationStopped');
    } catch (error) {
      this.lastError = `Failed to stop investigation: ${error}`;
      this.emit('error', this.lastError);
      throw error;
    }
  }

  public getStatus(): SpiritBoxStatus {
    return {
      isInitialized: this.isInitialized,
      isScanning: this.radioScanner?.isScanning || false,
      isRecording: this.sessionRecorder?.isCurrentlyRecording() || false,
      currentFrequency: this.radioScanner?.getCurrentMetrics()?.currentFrequency || 0,
      currentSession: this.sessionRecorder?.getCurrentSession() || null,
      lastError: this.lastError
    };
  }

  public getServices() {
    return {
      radioScanner: this.radioScanner,
      audioProcessor: this.audioProcessor,
      wordDetector: this.wordDetector,
      sessionRecorder: this.sessionRecorder
    };
  }

  public async cleanup(): Promise<void> {
    try {
      await this.radioScanner?.cleanup();
      await this.audioProcessor?.cleanup();
      await this.sessionRecorder?.cleanup();

      this.isInitialized = false;
      this.emit('cleanup');
    } catch (error) {
      this.lastError = `Cleanup failed: ${error}`;
      this.emit('error', this.lastError);
    }
  }
}