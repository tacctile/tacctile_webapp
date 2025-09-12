/**
 * Thermal Recorder
 * Records thermal imaging sessions with overlays and analysis data
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {
  ThermalRecording,
  ThermalFrame,
  ThermalFormat,
  CompressionSettings,
  RecordingMetadata,
  TemperatureAnomaly,
  ThermalExportOptions,
  EnvironmentalConditions
} from '../types';
import { logger } from '../../../utils/logger';

export interface RecordingSession {
  recording: ThermalRecording;
  frameBuffer: ThermalFrame[];
  anomaliesBuffer: TemperatureAnomaly[];
  visualBuffer: ImageData[];
  overlayBuffer: ImageData[];
}

export class ThermalRecorder extends EventEmitter {
  private sessions: Map<string, RecordingSession> = new Map();
  private fileStreams: Map<string, fs.WriteStream> = new Map();
  private videoEncoders: Map<string, any> = new Map(); // Would use FFmpeg or similar
  
  private bufferSize: number = 30; // Frames to buffer before writing
  private maxConcurrentRecordings: number = 3;
  private tempDirectory: string = './temp/thermal';

  constructor() {
    super();
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDirectory)) {
      fs.mkdirSync(this.tempDirectory, { recursive: true });
    }
  }

  /**
   * Start thermal recording
   */
  async startRecording(
    cameraId: string,
    outputPath: string,
    format: ThermalFormat,
    compressionSettings: CompressionSettings,
    metadata?: Partial<RecordingMetadata>
  ): Promise<ThermalRecording> {
    // Check concurrent recording limit
    if (this.sessions.size >= this.maxConcurrentRecordings) {
      throw new Error(`Maximum concurrent recordings (${this.maxConcurrentRecordings}) exceeded`);
    }

    const recordingId = `thermal_${cameraId}_${Date.now()}`;
    
    const recording: ThermalRecording = {
      id: recordingId,
      cameraId,
      startTime: new Date(),
      frameCount: 0,
      duration: 0,
      outputPath,
      format,
      compressionSettings,
      status: 'recording',
      metadata: {
        investigationType: 'thermal_analysis',
        location: 'Unknown Location',
        investigatorName: 'Unknown Investigator',
        equipment: `Thermal Camera ${cameraId}`,
        environmentalConditions: {
          ambientTemp: 22,
          humidity: 50,
          weatherConditions: 'Indoor',
          indoorOutdoor: 'indoor'
        },
        notes: '',
        anomaliesDetected: 0,
        avgTemperature: 0,
        tempVariation: 0,
        ...metadata
      }
    };

    const session: RecordingSession = {
      recording,
      frameBuffer: [],
      anomaliesBuffer: [],
      visualBuffer: [],
      overlayBuffer: []
    };

    // Create output directory
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Initialize recording streams based on format
    await this.initializeRecordingStreams(session);

    this.sessions.set(recordingId, session);

    this.emit('recording-started', recording);
    logger.info(`Started thermal recording: ${recordingId} in ${format} format`);

    return recording;
  }

  /**
   * Initialize recording streams based on format
   */
  private async initializeRecordingStreams(session: RecordingSession): Promise<void> {
    const { recording } = session;
    const basePath = recording.outputPath;

    switch (recording.format) {
      case ThermalFormat.RADIOMETRIC_MP4:
        await this.initializeRadiometricMP4(session);
        break;
      case ThermalFormat.VISUAL_MP4:
        await this.initializeVisualMP4(session);
        break;
      case ThermalFormat.SEQ_FILE:
        await this.initializeSEQFile(session);
        break;
      case ThermalFormat.TIFF_SEQUENCE:
        await this.initializeTIFFSequence(session);
        break;
      case ThermalFormat.CSV_DATA:
        await this.initializeCSVData(session);
        break;
      case ThermalFormat.HDF5:
        await this.initializeHDF5(session);
        break;
      case ThermalFormat.RAW_BINARY:
        await this.initializeRawBinary(session);
        break;
    }

    // Initialize metadata file
    await this.initializeMetadataFile(session);
  }

  /**
   * Initialize radiometric MP4 recording
   */
  private async initializeRadiometricMP4(session: RecordingSession): Promise<void> {
    const outputPath = `${session.recording.outputPath}_radiometric.mp4`;
    
    // Would initialize FFmpeg encoder for radiometric data
    // For now, create a placeholder stream
    const stream = fs.createWriteStream(`${outputPath}.temp`);
    this.fileStreams.set(session.recording.id + '_radiometric', stream);

    // Write header for radiometric data
    const header = {
      format: 'radiometric_mp4',
      version: '1.0',
      temperatureUnit: 'celsius',
      calibration: null, // Would include calibration data
      timestamp: session.recording.startTime.toISOString()
    };

    stream.write(JSON.stringify(header) + '\n');
  }

  /**
   * Initialize visual MP4 recording
   */
  private async initializeVisualMP4(session: RecordingSession): Promise<void> {
    const outputPath = `${session.recording.outputPath}_visual.mp4`;
    
    // Would initialize FFmpeg encoder for visual thermal images
    // Parameters would include palette, contrast settings, etc.
    const stream = fs.createWriteStream(`${outputPath}.temp`);
    this.fileStreams.set(session.recording.id + '_visual', stream);
  }

  /**
   * Initialize SEQ file recording (FLIR format)
   */
  private async initializeSEQFile(session: RecordingSession): Promise<void> {
    const outputPath = `${session.recording.outputPath}.seq`;
    const stream = fs.createWriteStream(outputPath);
    this.fileStreams.set(session.recording.id + '_seq', stream);

    // Write SEQ file header
    const header = Buffer.alloc(1024);
    header.write('FFF\0', 0); // SEQ file signature
    header.writeUInt32LE(1, 4); // Version
    header.writeUInt32LE(session.recording.frameCount, 8); // Frame count (will be updated)
    
    stream.write(header);
  }

  /**
   * Initialize TIFF sequence recording
   */
  private async initializeTIFFSequence(session: RecordingSession): Promise<void> {
    const outputDir = `${session.recording.outputPath}_tiff_sequence`;
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Store directory path for later use
    this.fileStreams.set(session.recording.id + '_tiff_dir', outputDir as any);
  }

  /**
   * Initialize CSV data recording
   */
  private async initializeCSVData(session: RecordingSession): Promise<void> {
    const outputPath = `${session.recording.outputPath}.csv`;
    const stream = fs.createWriteStream(outputPath);
    this.fileStreams.set(session.recording.id + '_csv', stream);

    // Write CSV header
    const header = 'Timestamp,FrameNumber,MinTemp,MaxTemp,AvgTemp,AnomalyCount,AnomalyTypes,Position_X,Position_Y,Temperature\n';
    stream.write(header);
  }

  /**
   * Initialize HDF5 recording
   */
  private async initializeHDF5(session: RecordingSession): Promise<void> {
    // HDF5 would require h5wasm or similar library
    const outputPath = `${session.recording.outputPath}.h5`;
    logger.info(`HDF5 recording initialized: ${outputPath}`);
  }

  /**
   * Initialize raw binary recording
   */
  private async initializeRawBinary(session: RecordingSession): Promise<void> {
    const dataPath = `${session.recording.outputPath}.raw`;
    const stream = fs.createWriteStream(dataPath);
    this.fileStreams.set(session.recording.id + '_raw', stream);

    // Write binary header
    const header = Buffer.alloc(256);
    header.write('THERMAL_RAW\0', 0);
    header.writeUInt32LE(1, 12); // Version
    header.writeUInt32LE(Date.now(), 16); // Start timestamp
    
    stream.write(header);
  }

  /**
   * Initialize metadata file
   */
  private async initializeMetadataFile(session: RecordingSession): Promise<void> {
    const metadataPath = `${session.recording.outputPath}_metadata.json`;
    const stream = fs.createWriteStream(metadataPath);
    this.fileStreams.set(session.recording.id + '_metadata', stream);

    const metadata = {
      recording: {
        id: session.recording.id,
        format: session.recording.format,
        startTime: session.recording.startTime.toISOString(),
        metadata: session.recording.metadata
      },
      frames: []
    };

    stream.write(JSON.stringify(metadata, null, 2));
  }

  /**
   * Record thermal frame with overlays
   */
  async recordFrame(
    recordingId: string,
    thermalFrame: ThermalFrame,
    visualData?: ImageData,
    overlayData?: ImageData,
    anomalies?: TemperatureAnomaly[]
  ): Promise<void> {
    const session = this.sessions.get(recordingId);
    if (!session || session.recording.status !== 'recording') {
      return;
    }

    // Add to buffers
    session.frameBuffer.push(thermalFrame);
    
    if (visualData) {
      session.visualBuffer.push(visualData);
    }
    
    if (overlayData) {
      session.overlayBuffer.push(overlayData);
    }
    
    if (anomalies) {
      session.anomaliesBuffer.push(...anomalies);
      session.recording.metadata.anomaliesDetected += anomalies.length;
    }

    session.recording.frameCount++;
    session.recording.duration = Date.now() - session.recording.startTime.getTime();

    // Update temperature statistics
    this.updateTemperatureStats(session.recording, thermalFrame);

    // Write buffers if full
    if (session.frameBuffer.length >= this.bufferSize) {
      await this.flushBuffers(session);
    }

    this.emit('frame-recorded', {
      recordingId,
      frameNumber: session.recording.frameCount,
      anomalyCount: anomalies?.length || 0
    });
  }

  /**
   * Update temperature statistics
   */
  private updateTemperatureStats(recording: ThermalRecording, frame: ThermalFrame): void {
    const currentAvg = recording.metadata.avgTemperature;
    const frameCount = recording.frameCount;
    
    // Running average
    recording.metadata.avgTemperature = (currentAvg * (frameCount - 1) + frame.avgTemp) / frameCount;
    
    // Update temperature variation
    const variation = Math.abs(frame.maxTemp - frame.minTemp);
    if (variation > recording.metadata.tempVariation) {
      recording.metadata.tempVariation = variation;
    }
  }

  /**
   * Flush buffers to storage
   */
  private async flushBuffers(session: RecordingSession): Promise<void> {
    const { recording, frameBuffer, visualBuffer, overlayBuffer } = session;

    try {
      switch (recording.format) {
        case ThermalFormat.RADIOMETRIC_MP4:
          await this.flushRadiometricFrames(session);
          break;
        case ThermalFormat.VISUAL_MP4:
          await this.flushVisualFrames(session);
          break;
        case ThermalFormat.SEQ_FILE:
          await this.flushSEQFrames(session);
          break;
        case ThermalFormat.TIFF_SEQUENCE:
          await this.flushTIFFFrames(session);
          break;
        case ThermalFormat.CSV_DATA:
          await this.flushCSVData(session);
          break;
        case ThermalFormat.RAW_BINARY:
          await this.flushRawBinary(session);
          break;
      }

      // Clear buffers
      session.frameBuffer = [];
      session.visualBuffer = [];
      session.overlayBuffer = [];

    } catch (error) {
      logger.error('Error flushing buffers', error);
      this.emit('recording-error', { recordingId: recording.id, error });
    }
  }

  /**
   * Flush radiometric frames
   */
  private async flushRadiometricFrames(session: RecordingSession): Promise<void> {
    const stream = this.fileStreams.get(session.recording.id + '_radiometric');
    if (!stream) return;

    for (const frame of session.frameBuffer) {
      // Write radiometric data as binary
      const frameData = {
        timestamp: frame.timestamp,
        frameNumber: frame.frameNumber,
        width: frame.width,
        height: frame.height,
        minTemp: frame.minTemp,
        maxTemp: frame.maxTemp,
        avgTemp: frame.avgTemp,
        emissivity: frame.emissivity,
        reflectedTemp: frame.reflectedTemp,
        ambientTemp: frame.ambientTemp
      };

      // Write frame metadata
      const metadataBuffer = Buffer.from(JSON.stringify(frameData));
      const lengthBuffer = Buffer.allocUnsafe(4);
      lengthBuffer.writeUInt32LE(metadataBuffer.length, 0);
      
      stream.write(lengthBuffer);
      stream.write(metadataBuffer);

      // Write temperature data
      const tempBuffer = Buffer.from(frame.temperatureData.buffer);
      const tempLengthBuffer = Buffer.allocUnsafe(4);
      tempLengthBuffer.writeUInt32LE(tempBuffer.length, 0);
      
      stream.write(tempLengthBuffer);
      stream.write(tempBuffer);
    }
  }

  /**
   * Flush visual frames
   */
  private async flushVisualFrames(session: RecordingSession): Promise<void> {
    // Would encode visual frames to MP4 using FFmpeg
    logger.info(`Flushing ${session.visualBuffer.length} visual frames`);
  }

  /**
   * Flush SEQ frames
   */
  private async flushSEQFrames(session: RecordingSession): Promise<void> {
    const stream = this.fileStreams.get(session.recording.id + '_seq');
    if (!stream) return;

    for (const frame of session.frameBuffer) {
      // Write SEQ frame format
      const frameHeader = Buffer.alloc(32);
      frameHeader.writeUInt32LE(frame.frameNumber, 0);
      frameHeader.writeUInt32LE(frame.timestamp, 4);
      frameHeader.writeUInt16LE(frame.width, 8);
      frameHeader.writeUInt16LE(frame.height, 10);
      frameHeader.writeFloatLE(frame.minTemp, 12);
      frameHeader.writeFloatLE(frame.maxTemp, 16);
      frameHeader.writeFloatLE(frame.avgTemp, 20);

      stream.write(frameHeader);
      
      // Write temperature data
      const tempBuffer = Buffer.from(frame.temperatureData.buffer);
      stream.write(tempBuffer);
    }
  }

  /**
   * Flush TIFF frames
   */
  private async flushTIFFFrames(session: RecordingSession): Promise<void> {
    const outputDir = this.fileStreams.get(session.recording.id + '_tiff_dir') as any;
    if (!outputDir) return;

    for (let i = 0; i < session.frameBuffer.length; i++) {
      const frame = session.frameBuffer[i];
      const filename = `frame_${String(frame.frameNumber).padStart(6, '0')}.tiff`;
      const filepath = path.join(outputDir, filename);

      // Would write TIFF file with temperature data
      // For now, write as raw data
      const tempBuffer = Buffer.from(frame.temperatureData.buffer);
      fs.writeFileSync(filepath + '.raw', tempBuffer);

      // Write metadata
      const metadata = {
        frameNumber: frame.frameNumber,
        timestamp: frame.timestamp,
        width: frame.width,
        height: frame.height,
        minTemp: frame.minTemp,
        maxTemp: frame.maxTemp,
        avgTemp: frame.avgTemp,
        emissivity: frame.emissivity,
        reflectedTemp: frame.reflectedTemp,
        ambientTemp: frame.ambientTemp
      };
      
      fs.writeFileSync(filepath + '.json', JSON.stringify(metadata, null, 2));
    }
  }

  /**
   * Flush CSV data
   */
  private async flushCSVData(session: RecordingSession): Promise<void> {
    const stream = this.fileStreams.get(session.recording.id + '_csv');
    if (!stream) return;

    for (let i = 0; i < session.frameBuffer.length; i++) {
      const frame = session.frameBuffer[i];
      const anomalies = session.anomaliesBuffer.filter(a => a.frameNumber === frame.frameNumber);

      if (anomalies.length > 0) {
        for (const anomaly of anomalies) {
          const line = [
            frame.timestamp,
            frame.frameNumber,
            frame.minTemp.toFixed(2),
            frame.maxTemp.toFixed(2),
            frame.avgTemp.toFixed(2),
            1,
            anomaly.type,
            anomaly.position.x.toFixed(1),
            anomaly.position.y.toFixed(1),
            anomaly.position.temperature.toFixed(2)
          ].join(',') + '\n';

          stream.write(line);
        }
      } else {
        // Write frame data without anomalies
        const line = [
          frame.timestamp,
          frame.frameNumber,
          frame.minTemp.toFixed(2),
          frame.maxTemp.toFixed(2),
          frame.avgTemp.toFixed(2),
          0,
          '',
          '',
          '',
          ''
        ].join(',') + '\n';

        stream.write(line);
      }
    }
  }

  /**
   * Flush raw binary data
   */
  private async flushRawBinary(session: RecordingSession): Promise<void> {
    const stream = this.fileStreams.get(session.recording.id + '_raw');
    if (!stream) return;

    for (const frame of session.frameBuffer) {
      // Write frame header
      const frameHeader = Buffer.alloc(64);
      frameHeader.writeUInt32LE(frame.frameNumber, 0);
      frameHeader.writeUInt32LE(frame.timestamp, 4);
      frameHeader.writeUInt16LE(frame.width, 8);
      frameHeader.writeUInt16LE(frame.height, 10);
      frameHeader.writeFloatLE(frame.minTemp, 12);
      frameHeader.writeFloatLE(frame.maxTemp, 16);
      frameHeader.writeFloatLE(frame.avgTemp, 20);
      frameHeader.writeFloatLE(frame.emissivity, 24);
      frameHeader.writeFloatLE(frame.reflectedTemp, 28);
      frameHeader.writeFloatLE(frame.ambientTemp, 32);

      stream.write(frameHeader);

      // Write temperature data
      const tempBuffer = Buffer.from(frame.temperatureData.buffer);
      stream.write(tempBuffer);
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(recordingId: string): Promise<ThermalRecording | null> {
    const session = this.sessions.get(recordingId);
    if (!session) return null;

    const { recording } = session;

    try {
      // Flush remaining buffers
      if (session.frameBuffer.length > 0) {
        await this.flushBuffers(session);
      }

      // Finalize files
      await this.finalizeRecording(session);

      // Close streams
      await this.closeStreams(recordingId);

      recording.endTime = new Date();
      recording.duration = recording.endTime.getTime() - recording.startTime.getTime();
      recording.status = 'stopped';

      this.sessions.delete(recordingId);

      this.emit('recording-stopped', recording);
      logger.info(`Stopped thermal recording: ${recordingId}. Frames: ${recording.frameCount}, Duration: ${recording.duration}ms`);

      return recording;

    } catch (error) {
      recording.status = 'error';
      this.emit('recording-error', { recordingId, error });
      logger.error('Error stopping recording', error);
      return recording;
    }
  }

  /**
   * Finalize recording files
   */
  private async finalizeRecording(session: RecordingSession): Promise<void> {
    const { recording } = session;

    switch (recording.format) {
      case ThermalFormat.RADIOMETRIC_MP4:
        await this.finalizeRadiometricMP4(session);
        break;
      case ThermalFormat.VISUAL_MP4:
        await this.finalizeVisualMP4(session);
        break;
      case ThermalFormat.SEQ_FILE:
        await this.finalizeSEQFile(session);
        break;
      // Other formats don't need special finalization
    }

    // Update metadata file
    await this.updateMetadataFile(session);
  }

  /**
   * Finalize radiometric MP4
   */
  private async finalizeRadiometricMP4(session: RecordingSession): Promise<void> {
    // Would finalize FFmpeg encoding
    logger.info(`Finalizing radiometric MP4 for ${session.recording.id}`);
  }

  /**
   * Finalize visual MP4
   */
  private async finalizeVisualMP4(session: RecordingSession): Promise<void> {
    // Would finalize FFmpeg encoding
    logger.info(`Finalizing visual MP4 for ${session.recording.id}`);
  }

  /**
   * Finalize SEQ file
   */
  private async finalizeSEQFile(session: RecordingSession): Promise<void> {
    const stream = this.fileStreams.get(session.recording.id + '_seq');
    if (!stream) return;

    // Update header with final frame count
    const tempPath = (stream as any).path + '.temp';
    const originalPath = (stream as any).path;

    // Would update the header in the SEQ file
    logger.info(`Finalizing SEQ file for ${session.recording.id}`);
  }

  /**
   * Update metadata file
   */
  private async updateMetadataFile(session: RecordingSession): Promise<void> {
    const metadataPath = `${session.recording.outputPath}_metadata.json`;
    
    const finalMetadata = {
      recording: {
        ...session.recording,
        endTime: session.recording.endTime?.toISOString(),
        anomalies: session.anomaliesBuffer.map(a => ({
          type: a.type,
          timestamp: a.timestamp,
          frameNumber: a.frameNumber,
          position: a.position,
          temperature: a.temperature,
          confidence: a.confidence
        }))
      }
    };

    fs.writeFileSync(metadataPath, JSON.stringify(finalMetadata, null, 2));
  }

  /**
   * Close all streams for recording
   */
  private async closeStreams(recordingId: string): Promise<void> {
    const streamKeys = Array.from(this.fileStreams.keys()).filter(key => 
      key.startsWith(recordingId)
    );

    const closePromises = streamKeys.map(key => {
      const stream = this.fileStreams.get(key);
      this.fileStreams.delete(key);
      
      if (stream && typeof (stream as any).end === 'function') {
        return new Promise<void>(resolve => {
          (stream as any).end(() => resolve());
        });
      }
      return Promise.resolve();
    });

    await Promise.all(closePromises);
  }

  /**
   * Export recording to different format
   */
  async exportRecording(
    recordingId: string,
    outputPath: string,
    exportOptions: ThermalExportOptions
  ): Promise<string[]> {
    const outputFiles: string[] = [];

    // Load recording data
    const recordingData = await this.loadRecordingData(recordingId);
    
    if (!recordingData) {
      throw new Error(`Recording data not found: ${recordingId}`);
    }

    try {
      if (exportOptions.includeRawData) {
        const rawPath = await this.exportRawData(recordingData, outputPath, exportOptions);
        outputFiles.push(rawPath);
      }

      if (exportOptions.includeVisualImages) {
        const imagesPath = await this.exportVisualImages(recordingData, outputPath, exportOptions);
        outputFiles.push(imagesPath);
      }

      if (exportOptions.includeAnalysis) {
        const analysisPath = await this.exportAnalysisData(recordingData, outputPath, exportOptions);
        outputFiles.push(analysisPath);
      }

      if (exportOptions.includeMetadata) {
        const metadataPath = await this.exportMetadata(recordingData, outputPath, exportOptions);
        outputFiles.push(metadataPath);
      }

      this.emit('recording-exported', { recordingId, outputFiles });
      return outputFiles;

    } catch (error) {
      logger.error('Error exporting recording', error);
      throw error;
    }
  }

  /**
   * Load recording data from files
   */
  private async loadRecordingData(recordingId: string): Promise<any> {
    // Implementation would load data based on recording format
    return null;
  }

  /**
   * Export raw thermal data
   */
  private async exportRawData(recordingData: any, outputPath: string, options: ThermalExportOptions): Promise<string> {
    const rawPath = `${outputPath}_raw.${options.dataFormat}`;
    
    switch (options.dataFormat) {
      case 'csv':
        // Export as CSV
        break;
      case 'json':
        // Export as JSON
        break;
      case 'hdf5':
        // Export as HDF5
        break;
      case 'matlab':
        // Export as MATLAB format
        break;
    }

    return rawPath;
  }

  /**
   * Export visual images
   */
  private async exportVisualImages(recordingData: any, outputPath: string, options: ThermalExportOptions): Promise<string> {
    const imagesDir = `${outputPath}_images`;
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Would export individual frames as images
    return imagesDir;
  }

  /**
   * Export analysis data
   */
  private async exportAnalysisData(recordingData: any, outputPath: string, options: ThermalExportOptions): Promise<string> {
    const analysisPath = `${outputPath}_analysis.json`;
    
    // Would export statistical analysis, anomaly data, etc.
    return analysisPath;
  }

  /**
   * Export metadata
   */
  private async exportMetadata(recordingData: any, outputPath: string, options: ThermalExportOptions): Promise<string> {
    const metadataPath = `${outputPath}_metadata.json`;
    
    // Export recording metadata
    return metadataPath;
  }

  /**
   * Get active recordings
   */
  getActiveRecordings(): ThermalRecording[] {
    return Array.from(this.sessions.values())
      .map(session => session.recording)
      .filter(recording => recording.status === 'recording');
  }

  /**
   * Get recording by ID
   */
  getRecording(recordingId: string): ThermalRecording | undefined {
    const session = this.sessions.get(recordingId);
    return session?.recording;
  }

  /**
   * Get recording statistics
   */
  getRecordingStats(recordingId: string): {
    frameCount: number;
    duration: number;
    anomalyCount: number;
    bufferSize: number;
    fileSize: number;
  } | null {
    const session = this.sessions.get(recordingId);
    if (!session) return null;

    return {
      frameCount: session.recording.frameCount,
      duration: session.recording.duration,
      anomalyCount: session.recording.metadata.anomaliesDetected,
      bufferSize: session.frameBuffer.length,
      fileSize: 0 // Would calculate actual file size
    };
  }

  /**
   * Set buffer size
   */
  setBufferSize(size: number): void {
    this.bufferSize = Math.max(1, Math.min(100, size));
    this.emit('buffer-size-changed', this.bufferSize);
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.bufferSize;
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    // Stop all active recordings
    const activeRecordings = this.getActiveRecordings();
    
    for (const recording of activeRecordings) {
      await this.stopRecording(recording.id);
    }

    // Close all streams
    for (const [key, stream] of this.fileStreams.entries()) {
      if (stream && typeof (stream as any).end === 'function') {
        (stream as any).end();
      }
    }

    this.fileStreams.clear();
    this.sessions.clear();
    this.videoEncoders.clear();

    this.removeAllListeners();
  }
}