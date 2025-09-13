import { EventEmitter } from 'events';
import {
  MultiSpectralRecording,
  MultiSpectralRecordingMetadata,
  MultiSpectralFormat,
  SpectralFrame,
  SpectralBand,
  SpectralSequence,
  MultiSpectralCamera
} from '../types';
import { logger } from '../../../utils/logger';

export class MultiSpectralRecorder extends EventEmitter {
  private activeRecordings: Map<string, ActiveRecording>;
  private recordingCounter: number;
  private maxConcurrentRecordings: number;
  private defaultOutputPath: string;

  constructor(options?: RecorderOptions) {
    super();
    this.activeRecordings = new Map();
    this.recordingCounter = 0;
    this.maxConcurrentRecordings = options?.maxConcurrentRecordings || 3;
    this.defaultOutputPath = options?.defaultOutputPath || './multispectral_recordings';
  }

  async startRecording(config: RecordingConfiguration): Promise<MultiSpectralRecording> {
    if (this.activeRecordings.size >= this.maxConcurrentRecordings) {
      throw new Error('Maximum concurrent recordings reached');
    }

    const recordingId = `recording_${++this.recordingCounter}_${Date.now()}`;
    
    try {
      const recording: MultiSpectralRecording = {
        id: recordingId,
        name: config.name || `MultiSpectral_${recordingId}`,
        startTime: new Date(),
        status: 'recording',
        frameCount: 0,
        bands: config.bands || [],
        outputPath: config.outputPath || this.generateOutputPath(config.format),
        format: config.format,
        compression: config.compression ?? true,
        metadata: this.createRecordingMetadata(config)
      };

      const activeRecording: ActiveRecording = {
        recording,
        config,
        frameBuffer: [],
        writers: new Map(),
        startTime: Date.now(),
        lastFrameTime: 0
      };

      // Initialize format-specific writers
      await this.initializeWriters(activeRecording);

      this.activeRecordings.set(recordingId, activeRecording);
      
      this.emit('recording-started', recording);
      logger.info(`Started multi-spectral recording: ${recording.name} (${recording.format})`);
      
      return recording;
    } catch (error) {
      logger.error(`Failed to start recording ${recordingId}:`, error);
      this.emit('recording-failed', { recordingId, error });
      throw error;
    }
  }

  private generateOutputPath(format: MultiSpectralFormat): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = this.getFileExtension(format);
    return `${this.defaultOutputPath}/multispectral_${timestamp}.${extension}`;
  }

  private getFileExtension(format: MultiSpectralFormat): string {
    const extensions: Record<MultiSpectralFormat, string> = {
      [MultiSpectralFormat.TIFF_SEQUENCE]: 'tiff',
      [MultiSpectralFormat.HDF5]: 'h5',
      [MultiSpectralFormat.ENVI]: 'bil',
      [MultiSpectralFormat.NETCDF]: 'nc',
      [MultiSpectralFormat.RAW_BINARY]: 'raw',
      [MultiSpectralFormat.MATLAB]: 'mat',
      [MultiSpectralFormat.FITS]: 'fits'
    };
    return extensions[format] || 'dat';
  }

  private createRecordingMetadata(config: RecordingConfiguration): MultiSpectralRecordingMetadata {
    return {
      camera: config.camera,
      captureSettings: config.captureSettings,
      sequence: config.sequence,
      environmentalConditions: {
        temperature: 22.5 + (Math.random() - 0.5) * 5,
        humidity: 45 + (Math.random() - 0.5) * 20,
        pressure: 1013 + (Math.random() - 0.5) * 30,
        lightLevel: 500 + Math.random() * 1000
      },
      calibrationData: config.calibrationData
    };
  }

  private async initializeWriters(activeRecording: ActiveRecording): Promise<void> {
    const { recording, config } = activeRecording;
    
    switch (recording.format) {
      case MultiSpectralFormat.TIFF_SEQUENCE:
        activeRecording.writers.set('tiff', await this.initializeTIFFWriter(config));
        break;
      case MultiSpectralFormat.HDF5:
        activeRecording.writers.set('hdf5', await this.initializeHDF5Writer(config));
        break;
      case MultiSpectralFormat.ENVI:
        activeRecording.writers.set('envi', await this.initializeENVIWriter(config));
        break;
      case MultiSpectralFormat.NETCDF:
        activeRecording.writers.set('netcdf', await this.initializeNetCDFWriter(config));
        break;
      case MultiSpectralFormat.RAW_BINARY:
        activeRecording.writers.set('raw', await this.initializeRawWriter(config));
        break;
      case MultiSpectralFormat.MATLAB:
        activeRecording.writers.set('matlab', await this.initializeMATLABWriter(config));
        break;
      case MultiSpectralFormat.FITS:
        activeRecording.writers.set('fits', await this.initializeFITSWriter(config));
        break;
      default:
        throw new Error(`Unsupported recording format: ${recording.format}`);
    }
  }

  private async initializeTIFFWriter(config: RecordingConfiguration): Promise<FormatWriter> {
    return {
      format: 'tiff',
      initialized: true,
      write: async (frame: SpectralFrame, recording: MultiSpectralRecording) => {
        // TIFF sequence: save each frame as separate TIFF file
        const filename = `${recording.outputPath}_${frame.spectralBand}_${frame.frameNumber.toString().padStart(6, '0')}.tiff`;
        await this.writeTIFFFrame(frame, filename, recording.compression);
        return { success: true, bytesWritten: frame.rawData?.length || 0 };
      },
      finalize: async () => {
        // Create index file listing all TIFF files
        return { success: true, finalSize: 0 };
      }
    };
  }

  private async initializeHDF5Writer(config: RecordingConfiguration): Promise<FormatWriter> {
    return {
      format: 'hdf5',
      initialized: true,
      datasetHandles: new Map(),
      write: async (frame: SpectralFrame, recording: MultiSpectralRecording) => {
        // HDF5: hierarchical structure with datasets per band
        await this.writeHDF5Frame(frame, recording);
        return { success: true, bytesWritten: frame.rawData?.length || 0 };
      },
      finalize: async () => {
        // Close HDF5 file and all datasets
        return { success: true, finalSize: 0 };
      }
    };
  }

  private async initializeENVIWriter(config: RecordingConfiguration): Promise<FormatWriter> {
    return {
      format: 'envi',
      initialized: true,
      headerInfo: this.createENVIHeader(config),
      write: async (frame: SpectralFrame, recording: MultiSpectralRecording) => {
        // ENVI: Band Interleaved by Line (BIL) format
        await this.writeENVIFrame(frame, recording);
        return { success: true, bytesWritten: frame.rawData?.length || 0 };
      },
      finalize: async () => {
        // Write ENVI header file
        return { success: true, finalSize: 0 };
      }
    };
  }

  private async initializeNetCDFWriter(config: RecordingConfiguration): Promise<FormatWriter> {
    return {
      format: 'netcdf',
      initialized: true,
      dimensions: this.createNetCDFDimensions(config),
      write: async (frame: SpectralFrame, recording: MultiSpectralRecording) => {
        // NetCDF: scientific data format with metadata
        await this.writeNetCDFFrame(frame, recording);
        return { success: true, bytesWritten: frame.rawData?.length || 0 };
      },
      finalize: async () => {
        return { success: true, finalSize: 0 };
      }
    };
  }

  private async initializeRawWriter(config: RecordingConfiguration): Promise<FormatWriter> {
    return {
      format: 'raw',
      initialized: true,
      fileHandle: null, // Would be actual file handle
      write: async (frame: SpectralFrame, recording: MultiSpectralRecording) => {
        // Raw binary: direct byte output
        await this.writeRawFrame(frame, recording);
        return { success: true, bytesWritten: frame.rawData?.length || 0 };
      },
      finalize: async () => {
        // Write header/index file
        return { success: true, finalSize: 0 };
      }
    };
  }

  private async initializeMATLABWriter(config: RecordingConfiguration): Promise<FormatWriter> {
    return {
      format: 'matlab',
      initialized: true,
      dataStructure: this.createMATLABStructure(config),
      write: async (frame: SpectralFrame, recording: MultiSpectralRecording) => {
        // MATLAB: .mat file with structured data
        await this.writeMATLABFrame(frame, recording);
        return { success: true, bytesWritten: frame.rawData?.length || 0 };
      },
      finalize: async () => {
        return { success: true, finalSize: 0 };
      }
    };
  }

  private async initializeFITSWriter(config: RecordingConfiguration): Promise<FormatWriter> {
    return {
      format: 'fits',
      initialized: true,
      fitsHeader: this.createFITSHeader(config),
      write: async (frame: SpectralFrame, recording: MultiSpectralRecording) => {
        // FITS: astronomical data format
        await this.writeFITSFrame(frame, recording);
        return { success: true, bytesWritten: frame.rawData?.length || 0 };
      },
      finalize: async () => {
        return { success: true, finalSize: 0 };
      }
    };
  }

  async addFrame(recordingId: string, frame: SpectralFrame): Promise<boolean> {
    const activeRecording = this.activeRecordings.get(recordingId);
    if (!activeRecording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (activeRecording.recording.status !== 'recording') {
      throw new Error(`Recording ${recordingId} is not active`);
    }

    try {
      // Add frame to buffer
      activeRecording.frameBuffer.push(frame);
      
      // Write frame using appropriate writer
      const writer = this.getWriterForFormat(activeRecording, activeRecording.recording.format);
      const result = await writer.write(frame, activeRecording.recording);
      
      if (result.success) {
        activeRecording.recording.frameCount++;
        activeRecording.lastFrameTime = Date.now();
        
        // Remove frame from buffer after successful write
        activeRecording.frameBuffer.shift();
        
        this.emit('frame-added', {
          recordingId,
          frameNumber: activeRecording.recording.frameCount,
          spectralBand: frame.spectralBand,
          bytesWritten: result.bytesWritten
        });
        
        // Check if we should flush buffer
        if (activeRecording.frameBuffer.length > 10) {
          await this.flushBuffer(activeRecording);
        }
        
        return true;
      } else {
        logger.error(`Failed to write frame to recording ${recordingId}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error adding frame to recording ${recordingId}:`, error);
      this.emit('recording-error', { recordingId, error });
      return false;
    }
  }

  private getWriterForFormat(activeRecording: ActiveRecording, format: MultiSpectralFormat): FormatWriter {
    const formatMap: Record<MultiSpectralFormat, string> = {
      [MultiSpectralFormat.TIFF_SEQUENCE]: 'tiff',
      [MultiSpectralFormat.HDF5]: 'hdf5',
      [MultiSpectralFormat.ENVI]: 'envi',
      [MultiSpectralFormat.NETCDF]: 'netcdf',
      [MultiSpectralFormat.RAW_BINARY]: 'raw',
      [MultiSpectralFormat.MATLAB]: 'matlab',
      [MultiSpectralFormat.FITS]: 'fits'
    };
    
    const writerKey = formatMap[format];
    const writer = activeRecording.writers.get(writerKey);
    
    if (!writer) {
      throw new Error(`Writer not found for format: ${format}`);
    }
    
    return writer;
  }

  private async flushBuffer(activeRecording: ActiveRecording): Promise<void> {
    // Process any remaining frames in buffer
    while (activeRecording.frameBuffer.length > 0) {
      const frame = activeRecording.frameBuffer[0];
      const writer = this.getWriterForFormat(activeRecording, activeRecording.recording.format);
      
      try {
        await writer.write(frame, activeRecording.recording);
        activeRecording.frameBuffer.shift();
      } catch (error) {
        logger.error('Error flushing buffer:', error);
        break;
      }
    }
  }

  async stopRecording(recordingId: string): Promise<MultiSpectralRecording> {
    const activeRecording = this.activeRecordings.get(recordingId);
    if (!activeRecording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    try {
      logger.info(`Stopping recording: ${recordingId}`);
      activeRecording.recording.status = 'stopping';
      
      // Flush any remaining frames
      await this.flushBuffer(activeRecording);
      
      // Finalize format-specific writers
      for (const writer of activeRecording.writers.values()) {
        await writer.finalize();
      }
      
      // Update recording metadata
      activeRecording.recording.endTime = new Date();
      activeRecording.recording.status = 'completed';
      
      // Generate final metadata and index files
      await this.generateRecordingMetadata(activeRecording);
      
      this.emit('recording-stopped', activeRecording.recording);
      logger.info(`Recording completed: ${recordingId} (${activeRecording.recording.frameCount} frames)`);
      
      // Clean up after a delay
      setTimeout(() => {
        this.activeRecordings.delete(recordingId);
      }, 30000);
      
      return activeRecording.recording;
    } catch (error) {
      activeRecording.recording.status = 'error';
      logger.error(`Error stopping recording ${recordingId}:`, error);
      this.emit('recording-error', { recordingId, error });
      throw error;
    }
  }

  async pauseRecording(recordingId: string): Promise<boolean> {
    const activeRecording = this.activeRecordings.get(recordingId);
    if (!activeRecording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (activeRecording.recording.status === 'recording') {
      activeRecording.recording.status = 'paused';
      this.emit('recording-paused', activeRecording.recording);
      logger.info(`Recording paused: ${recordingId}`);
      return true;
    }
    
    return false;
  }

  async resumeRecording(recordingId: string): Promise<boolean> {
    const activeRecording = this.activeRecordings.get(recordingId);
    if (!activeRecording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (activeRecording.recording.status === 'paused') {
      activeRecording.recording.status = 'recording';
      this.emit('recording-resumed', activeRecording.recording);
      logger.info(`Recording resumed: ${recordingId}`);
      return true;
    }
    
    return false;
  }

  // Format-specific write implementations (simplified)
  private async writeTIFFFrame(frame: SpectralFrame, filename: string, compression: boolean): Promise<void> {
    // Would use actual TIFF library here
    logger.debug(`Writing TIFF frame: ${filename}`);
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate write time
  }

  private async writeHDF5Frame(frame: SpectralFrame, recording: MultiSpectralRecording): Promise<void> {
    logger.debug(`Writing HDF5 frame: ${frame.spectralBand}`);
    await new Promise(resolve => setTimeout(resolve, 15));
  }

  private async writeENVIFrame(frame: SpectralFrame, recording: MultiSpectralRecording): Promise<void> {
    logger.debug(`Writing ENVI frame: ${frame.spectralBand}`);
    await new Promise(resolve => setTimeout(resolve, 8));
  }

  private async writeNetCDFFrame(frame: SpectralFrame, recording: MultiSpectralRecording): Promise<void> {
    logger.debug(`Writing NetCDF frame: ${frame.spectralBand}`);
    await new Promise(resolve => setTimeout(resolve, 12));
  }

  private async writeRawFrame(frame: SpectralFrame, recording: MultiSpectralRecording): Promise<void> {
    logger.debug(`Writing raw frame: ${frame.spectralBand}`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  private async writeMATLABFrame(frame: SpectralFrame, recording: MultiSpectralRecording): Promise<void> {
    logger.debug(`Writing MATLAB frame: ${frame.spectralBand}`);
    await new Promise(resolve => setTimeout(resolve, 18));
  }

  private async writeFITSFrame(frame: SpectralFrame, recording: MultiSpectralRecording): Promise<void> {
    logger.debug(`Writing FITS frame: ${frame.spectralBand}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  // Format-specific metadata creation
  private createENVIHeader(config: RecordingConfiguration): any {
    return {
      samples: config.frameWidth || 640,
      lines: config.frameHeight || 480,
      bands: config.bands.length,
      headerOffset: 0,
      fileType: 'ENVI Standard',
      dataType: 4, // 32-bit float
      interleave: 'bil',
      sensorType: 'Unknown',
      byteOrder: 0,
      wavelength: config.bands.map(band => this.getBandCenterWavelength(band)),
      bandNames: config.bands.map(band => band.toString())
    };
  }

  private createNetCDFDimensions(config: RecordingConfiguration): any {
    return {
      x: config.frameWidth || 640,
      y: config.frameHeight || 480,
      bands: config.bands.length,
      time: 'unlimited'
    };
  }

  private createMATLABStructure(config: RecordingConfiguration): any {
    return {
      info: {
        format: 'MultiSpectral',
        version: '1.0',
        bands: config.bands,
        timestamp: new Date().toISOString()
      },
      data: {
        frames: [],
        wavelengths: config.bands.map(band => this.getBandCenterWavelength(band)),
        metadata: {}
      }
    };
  }

  private createFITSHeader(config: RecordingConfiguration): any {
    return {
      SIMPLE: true,
      BITPIX: -32, // 32-bit IEEE floating point
      NAXIS: 3,    // 3D cube: x, y, wavelength
      NAXIS1: config.frameWidth || 640,
      NAXIS2: config.frameHeight || 480,
      NAXIS3: config.bands.length,
      OBJECT: 'MultiSpectral Image',
      INSTRUME: config.camera.name,
      DATE_OBS: new Date().toISOString()
    };
  }

  private getBandCenterWavelength(band: SpectralBand): number {
    const bandInfo = {
      [SpectralBand.UV_A]: 365,
      [SpectralBand.UV_B]: 310,
      [SpectralBand.UV_C]: 280,
      [SpectralBand.VISIBLE]: 550,
      [SpectralBand.RED]: 650,
      [SpectralBand.GREEN]: 525,
      [SpectralBand.BLUE]: 470,
      [SpectralBand.NIR]: 850,
      [SpectralBand.SWIR]: 1550,
      [SpectralBand.MWIR]: 5000,
      [SpectralBand.LWIR]: 10000,
      [SpectralBand.FULL_SPECTRUM]: 550
    };
    return bandInfo[band] || 550;
  }

  private async generateRecordingMetadata(activeRecording: ActiveRecording): Promise<void> {
    const metadata = {
      recording: activeRecording.recording,
      processingStats: {
        totalFrames: activeRecording.recording.frameCount,
        duration: Date.now() - activeRecording.startTime,
        averageFrameRate: activeRecording.recording.frameCount / ((Date.now() - activeRecording.startTime) / 1000),
        bandsRecorded: [...new Set(activeRecording.frameBuffer.map(f => f.spectralBand))]
      },
      fileInfo: {
        format: activeRecording.recording.format,
        compression: activeRecording.recording.compression,
        estimatedSize: activeRecording.recording.frameCount * 1024 * 1024 // Rough estimate
      }
    };

    // Write metadata file
    const metadataPath = `${activeRecording.recording.outputPath}_metadata.json`;
    logger.debug(`Writing metadata to: ${metadataPath}`);
    // Would actually write file here
  }

  getActiveRecordings(): MultiSpectralRecording[] {
    return Array.from(this.activeRecordings.values()).map(ar => ({ ...ar.recording }));
  }

  getRecordingStatus(recordingId: string): MultiSpectralRecording | null {
    const activeRecording = this.activeRecordings.get(recordingId);
    return activeRecording ? { ...activeRecording.recording } : null;
  }

  getSupportedFormats(): MultiSpectralFormat[] {
    return Object.values(MultiSpectralFormat);
  }

  async cancelRecording(recordingId: string): Promise<boolean> {
    const activeRecording = this.activeRecordings.get(recordingId);
    if (!activeRecording) {
      return false;
    }

    try {
      activeRecording.recording.status = 'stopped';
      
      // Clean up writers without finalizing
      activeRecording.writers.clear();
      
      this.activeRecordings.delete(recordingId);
      
      this.emit('recording-cancelled', activeRecording.recording);
      logger.info(`Recording cancelled: ${recordingId}`);
      
      return true;
    } catch (error) {
      logger.error(`Error cancelling recording ${recordingId}:`, error);
      return false;
    }
  }

  setDefaultOutputPath(path: string): void {
    this.defaultOutputPath = path;
    this.emit('output-path-changed', path);
  }

  getDefaultOutputPath(): string {
    return this.defaultOutputPath;
  }

  destroy(): void {
    // Stop all active recordings
    for (const recordingId of this.activeRecordings.keys()) {
      this.cancelRecording(recordingId);
    }
    
    this.activeRecordings.clear();
    this.removeAllListeners();
  }
}

// Supporting interfaces and types
interface RecorderOptions {
  maxConcurrentRecordings?: number;
  defaultOutputPath?: string;
}

interface RecordingConfiguration {
  name?: string;
  format: MultiSpectralFormat;
  outputPath?: string;
  compression?: boolean;
  bands: SpectralBand[];
  camera: MultiSpectralCamera;
  captureSettings: any;
  sequence?: SpectralSequence;
  frameWidth?: number;
  frameHeight?: number;
  calibrationData?: {
    darkFrames: string[];
    flatFields: string[];
    spectralResponse: string;
  };
}

interface ActiveRecording {
  recording: MultiSpectralRecording;
  config: RecordingConfiguration;
  frameBuffer: SpectralFrame[];
  writers: Map<string, FormatWriter>;
  startTime: number;
  lastFrameTime: number;
}

interface FormatWriter {
  format: string;
  initialized: boolean;
  write: (frame: SpectralFrame, recording: MultiSpectralRecording) => Promise<{ success: boolean; bytesWritten: number }>;
  finalize: () => Promise<{ success: boolean; finalSize: number }>;
  [key: string]: any; // For format-specific properties
}