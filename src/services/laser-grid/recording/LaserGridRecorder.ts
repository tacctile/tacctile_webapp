/**
 * Laser Grid Recorder
 * Records laser grid sessions with disturbances and exports analysis data
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {
  RecordingSession,
  DisturbanceEvent,
  ProcessedFrame,
  GridDisturbance,
  ExportFormat,
  ExportOptions,
  AnalysisResult,
  DisturbanceStatistics,
  CameraFrame,
  GridPattern
} from '../types';
import { logger } from '../../../utils/logger';

export interface SessionMetadata {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  investigationType: string;
  location: string;
  investigatorName: string;
  equipment: {
    projector: string;
    camera: string;
    pattern: string;
  };
  environmentalConditions: {
    temperature?: number;
    humidity?: number;
    lightLevel?: number;
    emfReading?: number;
  };
  notes: string;
}

export class LaserGridRecorder extends EventEmitter {
  private session: RecordingSession | null = null;
  private frameBuffer: ProcessedFrame[] = [];
  private disturbanceBuffer: DisturbanceEvent[] = [];
  private isRecording: boolean = false;
  private frameWriter: fs.WriteStream | null = null;
  private metadataWriter: fs.WriteStream | null = null;
  private videoRecorder: any | null = null; // Would be MediaRecorder or similar
  
  private bufferSize: number = 100; // Frames to buffer before writing
  private frameCounter: number = 0;
  private recordingTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Start recording session
   */
  async startRecording(
    projectorId: string, 
    pattern: GridPattern, 
    outputPath: string,
    metadata?: Partial<SessionMetadata>
  ): Promise<RecordingSession> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    const sessionId = `laser_grid_${Date.now()}`;
    
    this.session = {
      id: sessionId,
      projectorId,
      startTime: new Date(),
      pattern,
      settings: {
        sensitivity: 0.5,
        minimumDisturbanceSize: 10,
        minimumDuration: 100,
        occlusionThreshold: 0.7,
        motionThreshold: 5,
        noiseReduction: 0.3,
        temporalFiltering: true,
        spatialFiltering: true,
        autoCalibration: true
      },
      frameCount: 0,
      disturbanceCount: 0,
      outputPath,
      status: 'recording'
    };

    // Create output directory
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Initialize file streams
    await this.initializeStreams();

    // Write session metadata
    await this.writeSessionMetadata(metadata);

    this.isRecording = true;
    this.frameCounter = 0;

    // Start recording timer for duration tracking
    this.recordingTimer = setInterval(() => {
      this.emit('recording-progress', {
        sessionId: this.session!.id,
        duration: Date.now() - this.session!.startTime.getTime(),
        frameCount: this.session!.frameCount,
        disturbanceCount: this.session!.disturbanceCount
      });
    }, 1000);

    this.emit('recording-started', this.session);
    logger.info(`Started laser grid recording: ${sessionId}`);

    return this.session;
  }

  /**
   * Initialize file streams
   */
  private async initializeStreams(): Promise<void> {
    if (!this.session) return;

    const basePath = this.session.outputPath;
    
    // Frame data stream (binary)
    const frameDataPath = `${basePath}.frames`;
    this.frameWriter = fs.createWriteStream(frameDataPath);

    // Metadata stream (JSON lines)
    const metadataPath = `${basePath}.metadata.jsonl`;
    this.metadataWriter = fs.createWriteStream(metadataPath);

    // Write file headers
    await this.writeFileHeaders();
  }

  /**
   * Write file headers
   */
  private async writeFileHeaders(): Promise<void> {
    if (!this.session || !this.metadataWriter) return;

    const header = {
      type: 'session_header',
      version: '1.0',
      sessionId: this.session.id,
      startTime: this.session.startTime.toISOString(),
      pattern: this.session.pattern,
      settings: this.session.settings
    };

    await this.writeMetadataLine(header);
  }

  /**
   * Write session metadata
   */
  private async writeSessionMetadata(metadata?: Partial<SessionMetadata>): Promise<void> {
    if (!this.session) return;

    const sessionMetadata: SessionMetadata = {
      sessionId: this.session.id,
      startTime: this.session.startTime,
      investigationType: 'laser_grid_analysis',
      location: 'Unknown Location',
      investigatorName: 'Unknown Investigator',
      equipment: {
        projector: this.session.projectorId,
        camera: 'Default Camera',
        pattern: this.session.pattern.name
      },
      environmentalConditions: {},
      notes: '',
      ...metadata
    };

    await this.writeMetadataLine({
      type: 'session_metadata',
      timestamp: Date.now(),
      data: sessionMetadata
    });
  }

  /**
   * Record processed frame
   */
  async recordFrame(frame: ProcessedFrame): Promise<void> {
    if (!this.isRecording || !this.session) return;

    this.frameCounter++;
    this.session.frameCount = this.frameCounter;

    // Add frame to buffer
    this.frameBuffer.push(frame);

    // Record disturbances
    for (const disturbance of frame.disturbances) {
      await this.recordDisturbance(frame, disturbance);
      this.session.disturbanceCount++;
    }

    // Flush buffer if full
    if (this.frameBuffer.length >= this.bufferSize) {
      await this.flushFrameBuffer();
    }

    // Write frame metadata immediately
    await this.writeFrameMetadata(frame);

    this.emit('frame-recorded', {
      sessionId: this.session.id,
      frameNumber: this.frameCounter,
      disturbanceCount: frame.disturbances.length
    });
  }

  /**
   * Record disturbance event
   */
  private async recordDisturbance(frame: ProcessedFrame, disturbance: GridDisturbance): Promise<void> {
    if (!this.session) return;

    const event: DisturbanceEvent = {
      session: this.session,
      disturbance,
      context: {
        frameBefore: frame.originalFrame,
        frameAfter: frame.originalFrame, // Same frame for now
        ambientConditions: {
          lightLevel: 0, // Would be measured
          timestamp: Date.now()
        }
      }
    };

    this.disturbanceBuffer.push(event);

    // Write disturbance metadata
    await this.writeMetadataLine({
      type: 'disturbance_event',
      timestamp: Date.now(),
      frameNumber: this.frameCounter,
      data: {
        id: disturbance.id,
        type: disturbance.disturbanceType,
        position: disturbance.position,
        intensity: disturbance.intensity,
        confidence: disturbance.confidence,
        duration: disturbance.duration,
        affectedDots: disturbance.affectedDots,
        metadata: disturbance.metadata
      }
    });

    this.emit('disturbance-recorded', event);
  }

  /**
   * Write frame metadata
   */
  private async writeFrameMetadata(frame: ProcessedFrame): Promise<void> {
    const metadata = {
      type: 'frame_metadata',
      timestamp: frame.timestamp,
      frameNumber: this.frameCounter,
      data: {
        detectedDots: frame.detectedDots.length,
        disturbances: frame.disturbances.length,
        gridAlignment: frame.gridAlignment,
        processingLatency: Date.now() - frame.originalFrame.timestamp
      }
    };

    await this.writeMetadataLine(metadata);
  }

  /**
   * Write metadata line
   */
  private async writeMetadataLine(data: any): Promise<void> {
    if (!this.metadataWriter) return;

    return new Promise<void>((resolve, reject) => {
      const line = JSON.stringify(data) + '\n';
      this.metadataWriter!.write(line, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Flush frame buffer to disk
   */
  private async flushFrameBuffer(): Promise<void> {
    if (!this.frameWriter || this.frameBuffer.length === 0) return;

    try {
      // Write frames in binary format
      for (const frame of this.frameBuffer) {
        await this.writeBinaryFrame(frame);
      }

      // Clear buffer
      this.frameBuffer = [];
    } catch (error) {
      logger.error('Error flushing frame buffer', error);
    }
  }

  /**
   * Write binary frame data
   */
  private async writeBinaryFrame(frame: ProcessedFrame): Promise<void> {
    if (!this.frameWriter) return;

    return new Promise<void>((resolve, reject) => {
      // Create binary frame packet
      const frameData = {
        timestamp: frame.timestamp,
        frameNumber: this.frameCounter,
        width: frame.originalFrame.width,
        height: frame.originalFrame.height,
        imageDataSize: frame.originalFrame.imageData.length
      };

      // Write frame header
      const headerBuffer = Buffer.from(JSON.stringify(frameData));
      const headerLengthBuffer = Buffer.allocUnsafe(4);
      headerLengthBuffer.writeUInt32LE(headerBuffer.length, 0);

      this.frameWriter!.write(headerLengthBuffer);
      this.frameWriter!.write(headerBuffer);

      // Write image data
      const imageBuffer = Buffer.from(frame.originalFrame.imageData);
      this.frameWriter!.write(imageBuffer, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Stop recording session
   */
  async stopRecording(): Promise<RecordingSession | null> {
    if (!this.isRecording || !this.session) return null;

    logger.info(`Stopping laser grid recording: ${this.session.id}`);

    this.isRecording = false;

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    // Flush remaining buffers
    await this.flushFrameBuffer();

    // Write session end metadata
    this.session.endTime = new Date();
    this.session.status = 'stopped';

    await this.writeMetadataLine({
      type: 'session_end',
      timestamp: Date.now(),
      data: {
        endTime: this.session.endTime.toISOString(),
        totalFrames: this.session.frameCount,
        totalDisturbances: this.session.disturbanceCount,
        duration: this.session.endTime.getTime() - this.session.startTime.getTime()
      }
    });

    // Close streams
    await this.closeStreams();

    // Generate analysis
    const analysis = await this.generateAnalysis();

    const completedSession = { ...this.session };
    this.session = null;

    this.emit('recording-stopped', { session: completedSession, analysis });
    logger.info(`Recording stopped. Frames: ${completedSession.frameCount}, Disturbances: ${completedSession.disturbanceCount}`);

    return completedSession;
  }

  /**
   * Close file streams
   */
  private async closeStreams(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.frameWriter) {
      promises.push(new Promise<void>((resolve) => {
        this.frameWriter!.end(() => {
          resolve();
        });
      }));
      this.frameWriter = null;
    }

    if (this.metadataWriter) {
      promises.push(new Promise<void>((resolve) => {
        this.metadataWriter!.end(() => {
          resolve();
        });
      }));
      this.metadataWriter = null;
    }

    await Promise.all(promises);
  }

  /**
   * Generate session analysis
   */
  private async generateAnalysis(): Promise<AnalysisResult> {
    if (!this.session) {
      throw new Error('No session to analyze');
    }

    const disturbances = this.disturbanceBuffer.map(e => e.disturbance);
    const statistics = this.calculateStatistics(disturbances);
    const significantEvents = this.findSignificantEvents(disturbances);
    const recommendations = this.generateRecommendations(statistics);
    const confidence = this.calculateOverallConfidence(disturbances);

    return {
      sessionId: this.session.id,
      totalDisturbances: disturbances.length,
      significantEvents,
      statisticalSummary: statistics,
      recommendations,
      confidence
    };
  }

  /**
   * Calculate disturbance statistics
   */
  private calculateStatistics(disturbances: GridDisturbance[]): DisturbanceStatistics {
    if (disturbances.length === 0) {
      return {
        averageIntensity: 0,
        averageDuration: 0,
        spatialDistribution: {},
        temporalDistribution: {},
        typeDistribution: {} as any,
        peakActivity: {
          time: 0,
          intensity: 0,
          location: { x: 0, y: 0 }
        }
      };
    }

    // Calculate averages
    const avgIntensity = disturbances.reduce((sum, d) => sum + d.intensity, 0) / disturbances.length;
    const avgDuration = disturbances.reduce((sum, d) => sum + d.duration, 0) / disturbances.length;

    // Spatial distribution (grid cells)
    const spatialDistribution: { [key: string]: number } = {};
    for (const disturbance of disturbances) {
      const gridX = Math.floor(disturbance.position.x / 50);
      const gridY = Math.floor(disturbance.position.y / 50);
      const key = `${gridX},${gridY}`;
      spatialDistribution[key] = (spatialDistribution[key] || 0) + 1;
    }

    // Temporal distribution (5-minute buckets)
    const temporalDistribution: { [key: string]: number } = {};
    const startTime = disturbances[0].timestamp;
    for (const disturbance of disturbances) {
      const bucketIndex = Math.floor((disturbance.timestamp - startTime) / (5 * 60 * 1000));
      const key = `bucket_${bucketIndex}`;
      temporalDistribution[key] = (temporalDistribution[key] || 0) + 1;
    }

    // Type distribution
    const typeDistribution: { [key: string]: number } = {};
    for (const disturbance of disturbances) {
      const type = disturbance.disturbanceType;
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    }

    // Find peak activity
    const peakDisturbance = disturbances.reduce((peak, current) => 
      current.intensity > peak.intensity ? current : peak
    );

    return {
      averageIntensity: avgIntensity,
      averageDuration: avgDuration,
      spatialDistribution,
      temporalDistribution,
      typeDistribution: typeDistribution as any,
      peakActivity: {
        time: peakDisturbance.timestamp,
        intensity: peakDisturbance.intensity,
        location: peakDisturbance.position
      }
    };
  }

  /**
   * Find significant events
   */
  private findSignificantEvents(disturbances: GridDisturbance[]): GridDisturbance[] {
    const significanceThreshold = 0.7;
    const durationThreshold = 1000; // 1 second

    return disturbances.filter(disturbance => 
      disturbance.intensity > significanceThreshold || 
      disturbance.duration > durationThreshold ||
      disturbance.confidence > 0.8
    ).sort((a, b) => b.intensity - a.intensity);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(statistics: DisturbanceStatistics): string[] {
    const recommendations: string[] = [];

    if (statistics.averageIntensity < 0.3) {
      recommendations.push('Consider increasing laser intensity or camera sensitivity');
    }

    if (statistics.averageDuration < 200) {
      recommendations.push('Most disturbances are brief - consider temporal filtering adjustments');
    }

    // Analyze spatial distribution
    const spatialKeys = Object.keys(statistics.spatialDistribution);
    if (spatialKeys.length > 0) {
      const maxActivity = Math.max(...Object.values(statistics.spatialDistribution));
      if (maxActivity > spatialKeys.length * 0.3) {
        recommendations.push('High activity concentration detected - focus investigation on hot spots');
      }
    }

    // Analyze type distribution
    const typeKeys = Object.keys(statistics.typeDistribution);
    if (typeKeys.length > 0) {
      const dominantType = typeKeys.reduce((a, b) => 
        statistics.typeDistribution[a] > statistics.typeDistribution[b] ? a : b
      );
      recommendations.push(`Dominant disturbance type: ${dominantType} - adjust detection parameters accordingly`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Session completed successfully with standard parameters');
    }

    return recommendations;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(disturbances: GridDisturbance[]): number {
    if (disturbances.length === 0) return 0;

    const totalConfidence = disturbances.reduce((sum, d) => sum + d.confidence, 0);
    const avgConfidence = totalConfidence / disturbances.length;

    // Factor in number of detections and consistency
    const detectionFactor = Math.min(1, disturbances.length / 10);
    const consistencyFactor = 1 - (Math.abs(avgConfidence - 0.5) * 2); // Penalize extreme values

    return Math.min(1, avgConfidence * detectionFactor * consistencyFactor);
  }

  /**
   * Export session data
   */
  async exportSession(
    sessionPath: string, 
    format: ExportFormat, 
    options: ExportOptions = {
      includeOriginal: true,
      includeOverlays: true,
      includeAnalysis: true
    }
  ): Promise<string[]> {
    const outputFiles: string[] = [];

    switch (format.type) {
      case 'video':
        outputFiles.push(...await this.exportToVideo(sessionPath, options));
        break;
      case 'images':
        outputFiles.push(...await this.exportToImages(sessionPath, options));
        break;
      case 'csv':
        outputFiles.push(...await this.exportToCSV(sessionPath, options));
        break;
      case 'json':
        outputFiles.push(...await this.exportToJSON(sessionPath, options));
        break;
      case 'pdf_report':
        outputFiles.push(...await this.exportToPDF(sessionPath, options));
        break;
    }

    return outputFiles;
  }

  /**
   * Export to video
   */
  private async exportToVideo(sessionPath: string, options: ExportOptions): Promise<string[]> {
    // Video export would use FFmpeg or similar to create MP4 from frames
    const outputPath = `${sessionPath}_export.mp4`;
    
    logger.info(`Exporting session to video: ${outputPath}`);
    
    // Placeholder implementation
    return [outputPath];
  }

  /**
   * Export to images
   */
  private async exportToImages(sessionPath: string, options: ExportOptions): Promise<string[]> {
    const outputDir = `${sessionPath}_images`;
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    logger.info(`Exporting session to images: ${outputDir}`);

    // Would export each frame as PNG/JPEG with overlays
    return [`${outputDir}/frames_exported.txt`];
  }

  /**
   * Export to CSV
   */
  private async exportToCSV(sessionPath: string, options: ExportOptions): Promise<string[]> {
    const outputPath = `${sessionPath}_data.csv`;
    
    const csvContent = [
      'Timestamp,Frame,Type,Position_X,Position_Y,Intensity,Confidence,Duration',
      ...this.disturbanceBuffer.map(event => {
        const d = event.disturbance;
        return `${d.timestamp},${d.frameNumber},${d.disturbanceType},${d.position.x},${d.position.y},${d.intensity},${d.confidence},${d.duration}`;
      })
    ].join('\n');

    fs.writeFileSync(outputPath, csvContent);
    
    logger.info(`Exported session data to CSV: ${outputPath}`);
    return [outputPath];
  }

  /**
   * Export to JSON
   */
  private async exportToJSON(sessionPath: string, options: ExportOptions): Promise<string[]> {
    const outputPath = `${sessionPath}_data.json`;
    
    const jsonData = {
      session: this.session,
      disturbances: this.disturbanceBuffer.map(e => e.disturbance),
      analysis: await this.generateAnalysis()
    };

    fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
    
    logger.info(`Exported session data to JSON: ${outputPath}`);
    return [outputPath];
  }

  /**
   * Export to PDF report
   */
  private async exportToPDF(sessionPath: string, options: ExportOptions): Promise<string[]> {
    const outputPath = `${sessionPath}_report.pdf`;
    
    // PDF generation would use library like PDFKit or similar
    logger.info(`Generating PDF report: ${outputPath}`);
    
    // Placeholder - would create comprehensive investigation report
    return [outputPath];
  }

  /**
   * Load session from files
   */
  async loadSession(sessionPath: string): Promise<{
    session: RecordingSession;
    disturbances: GridDisturbance[];
    analysis: AnalysisResult;
  }> {
    const metadataPath = `${sessionPath}.metadata.jsonl`;
    
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Session metadata not found: ${metadataPath}`);
    }

    const lines = fs.readFileSync(metadataPath, 'utf-8').split('\n').filter(line => line.trim());
    let session: RecordingSession | null = null;
    const disturbances: GridDisturbance[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        
        switch (data.type) {
          case 'session_header':
            session = {
              id: data.sessionId,
              projectorId: 'loaded',
              startTime: new Date(data.startTime),
              pattern: data.pattern,
              settings: data.settings,
              frameCount: 0,
              disturbanceCount: 0,
              outputPath: sessionPath,
              status: 'stopped'
            };
            break;
          case 'disturbance_event':
            disturbances.push({
              id: data.data.id,
              timestamp: data.timestamp,
              frameNumber: data.frameNumber,
              affectedDots: data.data.affectedDots,
              disturbanceType: data.data.type,
              intensity: data.data.intensity,
              position: data.data.position,
              size: { x: 10, y: 10 }, // Default size
              duration: data.data.duration,
              confidence: data.data.confidence,
              metadata: data.data.metadata
            });
            break;
        }
      } catch (error) {
        logger.warn('Error parsing metadata line', error);
      }
    }

    if (!session) {
      throw new Error('Session header not found in metadata');
    }

    // Generate analysis from loaded data
    this.disturbanceBuffer = disturbances.map(d => ({
      session,
      disturbance: d,
      context: {
        frameBefore: null as any,
        frameAfter: null as any,
        ambientConditions: { lightLevel: 0, timestamp: d.timestamp }
      }
    }));

    const analysis = await this.generateAnalysis();

    return { session, disturbances, analysis };
  }

  /**
   * Get current session
   */
  getCurrentSession(): RecordingSession | null {
    return this.session;
  }

  /**
   * Check if recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get recording statistics
   */
  getRecordingStats(): {
    frameCount: number;
    disturbanceCount: number;
    duration: number;
    bufferSize: number;
  } {
    return {
      frameCount: this.frameCounter,
      disturbanceCount: this.disturbanceBuffer.length,
      duration: this.session ? Date.now() - this.session.startTime.getTime() : 0,
      bufferSize: this.frameBuffer.length
    };
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    }

    await this.closeStreams();
    
    this.frameBuffer = [];
    this.disturbanceBuffer = [];
    
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    this.removeAllListeners();
  }
}