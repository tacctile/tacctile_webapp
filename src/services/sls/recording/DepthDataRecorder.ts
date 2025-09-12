/**
 * Depth Data Recorder
 * Records and exports depth sensor data to various formats
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {
  DepthFrame,
  PointCloud,
  Skeleton,
  RecordingConfig,
  SLSFrame,
  ColorFrame,
  InfraredFrame,
  Vector3
} from '../types';
import { logger } from '../../../utils/logger';

export interface RecordingSession {
  id: string;
  sensorId: string;
  config: RecordingConfig;
  startTime: Date;
  endTime?: Date;
  frameCount: number;
  bytesWritten: number;
  status: 'recording' | 'stopped' | 'error';
  outputFiles: string[];
}

export class DepthDataRecorder extends EventEmitter {
  private sessions: Map<string, RecordingSession> = new Map();
  private writers: Map<string, fs.WriteStream> = new Map();
  private frameBuffers: Map<string, SLSFrame[]> = new Map();
  private bufferSize = 30; // Buffer frames before writing

  constructor() {
    super();
  }

  /**
   * Start recording session
   */
  async startRecording(sensorId: string, config: RecordingConfig): Promise<RecordingSession> {
    // Stop existing session if any
    if (this.sessions.has(sensorId)) {
      await this.stopRecording(sensorId);
    }

    const sessionId = `${sensorId}_${Date.now()}`;
    const session: RecordingSession = {
      id: sessionId,
      sensorId,
      config,
      startTime: new Date(),
      frameCount: 0,
      bytesWritten: 0,
      status: 'recording',
      outputFiles: []
    };

    // Create output directory
    const outputDir = path.dirname(config.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Initialize based on format
    switch (config.format) {
      case 'ply':
        await this.initializePLYRecording(session);
        break;
      case 'pcd':
        await this.initializePCDRecording(session);
        break;
      case 'obj':
        await this.initializeOBJRecording(session);
        break;
      case 'raw':
        await this.initializeRawRecording(session);
        break;
    }

    this.sessions.set(sensorId, session);
    this.frameBuffers.set(sensorId, []);

    this.emit('recording-started', session);
    logger.info(`Started recording for sensor ${sensorId} in ${config.format} format`);

    return session;
  }

  /**
   * Record frame
   */
  async recordFrame(sensorId: string, frame: SLSFrame): Promise<void> {
    const session = this.sessions.get(sensorId);
    if (!session || session.status !== 'recording') return;

    // Add to buffer
    const buffer = this.frameBuffers.get(sensorId);
    if (buffer) {
      buffer.push(frame);

      // Write when buffer is full
      if (buffer.length >= this.bufferSize) {
        await this.flushBuffer(sensorId);
      }
    }

    session.frameCount++;
    this.emit('frame-recorded', { sensorId, frameNumber: session.frameCount });
  }

  /**
   * Flush buffer to disk
   */
  private async flushBuffer(sensorId: string): Promise<void> {
    const session = this.sessions.get(sensorId);
    const buffer = this.frameBuffers.get(sensorId);
    
    if (!session || !buffer || buffer.length === 0) return;

    for (const frame of buffer) {
      await this.writeFrame(session, frame);
    }

    // Clear buffer
    this.frameBuffers.set(sensorId, []);
  }

  /**
   * Write frame based on format
   */
  private async writeFrame(session: RecordingSession, frame: SLSFrame): Promise<void> {
    switch (session.config.format) {
      case 'ply':
        await this.writePLYFrame(session, frame);
        break;
      case 'pcd':
        await this.writePCDFrame(session, frame);
        break;
      case 'obj':
        await this.writeOBJFrame(session, frame);
        break;
      case 'raw':
        await this.writeRawFrame(session, frame);
        break;
    }
  }

  /**
   * Initialize PLY recording
   */
  private async initializePLYRecording(session: RecordingSession): Promise<void> {
    const filePath = `${session.config.outputPath}.ply`;
    session.outputFiles.push(filePath);

    const header = [
      'ply',
      'format ascii 1.0',
      'comment Recorded by Tacctile SLS System',
      `comment Sensor: ${session.sensorId}`,
      `comment Date: ${session.startTime.toISOString()}`,
      'element vertex 0', // Will be updated
      'property float x',
      'property float y',
      'property float z'
    ];

    if (session.config.includeColor) {
      header.push('property uchar red');
      header.push('property uchar green');
      header.push('property uchar blue');
    }

    if (session.config.includeNormals) {
      header.push('property float nx');
      header.push('property float ny');
      header.push('property float nz');
    }

    header.push('end_header');

    const stream = fs.createWriteStream(filePath);
    stream.write(header.join('\n') + '\n');
    this.writers.set(session.sensorId, stream);
  }

  /**
   * Write PLY frame
   */
  private async writePLYFrame(session: RecordingSession, frame: SLSFrame): Promise<void> {
    if (!frame.pointCloud) return;

    const stream = this.writers.get(session.sensorId);
    if (!stream) return;

    const { points, colors, normals } = frame.pointCloud;
    const numPoints = points.length / 3;

    for (let i = 0; i < numPoints; i++) {
      const idx = i * 3;
      let line = `${points[idx]} ${points[idx + 1]} ${points[idx + 2]}`;

      if (session.config.includeColor && colors) {
        const colorIdx = i * 3;
        line += ` ${colors[colorIdx]} ${colors[colorIdx + 1]} ${colors[colorIdx + 2]}`;
      }

      if (session.config.includeNormals && normals) {
        line += ` ${normals[idx]} ${normals[idx + 1]} ${normals[idx + 2]}`;
      }

      stream.write(line + '\n');
      session.bytesWritten += line.length + 1;
    }
  }

  /**
   * Initialize PCD recording
   */
  private async initializePCDRecording(session: RecordingSession): Promise<void> {
    const filePath = `${session.config.outputPath}.pcd`;
    session.outputFiles.push(filePath);

    const header = [
      '# .PCD v0.7 - Point Cloud Data file format',
      'VERSION 0.7',
      'FIELDS x y z',
      'SIZE 4 4 4',
      'TYPE F F F',
      'COUNT 1 1 1',
      'WIDTH 0', // Will be updated per frame
      'HEIGHT 1',
      'VIEWPOINT 0 0 0 1 0 0 0',
      'POINTS 0', // Will be updated per frame
      'DATA ascii'
    ];

    if (session.config.includeColor) {
      header[2] = 'FIELDS x y z rgb';
      header[3] = 'SIZE 4 4 4 4';
      header[4] = 'TYPE F F F F';
      header[5] = 'COUNT 1 1 1 1';
    }

    const stream = fs.createWriteStream(filePath);
    this.writers.set(session.sensorId, stream);
  }

  /**
   * Write PCD frame
   */
  private async writePCDFrame(session: RecordingSession, frame: SLSFrame): Promise<void> {
    if (!frame.pointCloud) return;

    const stream = this.writers.get(session.sensorId);
    if (!stream) return;

    const { points, colors } = frame.pointCloud;
    const numPoints = points.length / 3;

    // Write frame header
    const frameHeader = [
      `# Frame ${session.frameCount}`,
      `WIDTH ${numPoints}`,
      `POINTS ${numPoints}`,
      'DATA ascii'
    ].join('\n');

    stream.write(frameHeader + '\n');

    for (let i = 0; i < numPoints; i++) {
      const idx = i * 3;
      let line = `${points[idx]} ${points[idx + 1]} ${points[idx + 2]}`;

      if (session.config.includeColor && colors) {
        const colorIdx = i * 3;
        const rgb = (colors[colorIdx] << 16) | (colors[colorIdx + 1] << 8) | colors[colorIdx + 2];
        line += ` ${rgb}`;
      }

      stream.write(line + '\n');
      session.bytesWritten += line.length + 1;
    }
  }

  /**
   * Initialize OBJ recording
   */
  private async initializeOBJRecording(session: RecordingSession): Promise<void> {
    const objPath = `${session.config.outputPath}.obj`;
    const mtlPath = `${session.config.outputPath}.mtl`;
    
    session.outputFiles.push(objPath);
    
    if (session.config.includeColor) {
      session.outputFiles.push(mtlPath);
      
      // Create MTL file
      const mtlContent = [
        '# Material file for SLS recording',
        'newmtl depth_material',
        'Ka 1.0 1.0 1.0',
        'Kd 1.0 1.0 1.0',
        'Ks 0.0 0.0 0.0',
        'illum 1'
      ].join('\n');
      
      fs.writeFileSync(mtlPath, mtlContent);
    }

    const header = [
      '# OBJ file generated by Tacctile SLS System',
      `# Date: ${session.startTime.toISOString()}`,
      `# Sensor: ${session.sensorId}`
    ];

    if (session.config.includeColor) {
      header.push(`mtllib ${path.basename(mtlPath)}`);
      header.push('usemtl depth_material');
    }

    const stream = fs.createWriteStream(objPath);
    stream.write(header.join('\n') + '\n');
    this.writers.set(session.sensorId, stream);
  }

  /**
   * Write OBJ frame
   */
  private async writeOBJFrame(session: RecordingSession, frame: SLSFrame): Promise<void> {
    if (!frame.pointCloud) return;

    const stream = this.writers.get(session.sensorId);
    if (!stream) return;

    const { points, normals } = frame.pointCloud;
    const numPoints = points.length / 3;

    stream.write(`# Frame ${session.frameCount}\n`);

    // Write vertices
    for (let i = 0; i < numPoints; i++) {
      const idx = i * 3;
      stream.write(`v ${points[idx]} ${points[idx + 1]} ${points[idx + 2]}\n`);
    }

    // Write normals if available
    if (session.config.includeNormals && normals) {
      for (let i = 0; i < numPoints; i++) {
        const idx = i * 3;
        stream.write(`vn ${normals[idx]} ${normals[idx + 1]} ${normals[idx + 2]}\n`);
      }
    }

    session.bytesWritten += numPoints * 30; // Approximate
  }

  /**
   * Initialize raw recording
   */
  private async initializeRawRecording(session: RecordingSession): Promise<void> {
    const metaPath = `${session.config.outputPath}.meta.json`;
    const dataPath = `${session.config.outputPath}.raw`;
    
    session.outputFiles.push(metaPath);
    session.outputFiles.push(dataPath);

    // Create metadata file
    const metadata = {
      version: '1.0',
      sensorId: session.sensorId,
      startTime: session.startTime.toISOString(),
      config: session.config,
      frames: []
    };

    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

    // Create binary data stream
    const stream = fs.createWriteStream(dataPath);
    this.writers.set(session.sensorId, stream);
  }

  /**
   * Write raw frame
   */
  private async writeRawFrame(session: RecordingSession, frame: SLSFrame): Promise<void> {
    const stream = this.writers.get(session.sensorId);
    if (!stream) return;

    // Create frame packet
    const packet = {
      frameNumber: session.frameCount,
      timestamp: Date.now(),
      hasDepth: !!frame.depth,
      hasColor: !!frame.color,
      hasInfrared: !!frame.infrared,
      hasPointCloud: !!frame.pointCloud,
      hasSkeletons: !!frame.skeletons && frame.skeletons.length > 0
    };

    // Write frame header
    const headerBuffer = Buffer.from(JSON.stringify(packet));
    const headerLength = Buffer.allocUnsafe(4);
    headerLength.writeUInt32LE(headerBuffer.length, 0);
    
    stream.write(headerLength);
    stream.write(headerBuffer);

    // Write depth data
    if (frame.depth) {
      const depthBuffer = Buffer.from(frame.depth.depthData.buffer);
      const depthLength = Buffer.allocUnsafe(4);
      depthLength.writeUInt32LE(depthBuffer.length, 0);
      
      stream.write(depthLength);
      stream.write(depthBuffer);
      session.bytesWritten += depthBuffer.length + 4;
    }

    // Write color data
    if (frame.color && session.config.includeColor) {
      const colorBuffer = Buffer.from(frame.color.data.buffer);
      const colorLength = Buffer.allocUnsafe(4);
      colorLength.writeUInt32LE(colorBuffer.length, 0);
      
      stream.write(colorLength);
      stream.write(colorBuffer);
      session.bytesWritten += colorBuffer.length + 4;
    }

    // Write point cloud
    if (frame.pointCloud) {
      const pcBuffer = Buffer.from(frame.pointCloud.points.buffer);
      const pcLength = Buffer.allocUnsafe(4);
      pcLength.writeUInt32LE(pcBuffer.length, 0);
      
      stream.write(pcLength);
      stream.write(pcBuffer);
      session.bytesWritten += pcBuffer.length + 4;
    }

    // Write skeletons
    if (frame.skeletons && frame.skeletons.length > 0) {
      const skelBuffer = Buffer.from(JSON.stringify(frame.skeletons));
      const skelLength = Buffer.allocUnsafe(4);
      skelLength.writeUInt32LE(skelBuffer.length, 0);
      
      stream.write(skelLength);
      stream.write(skelBuffer);
      session.bytesWritten += skelBuffer.length + 4;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(sensorId: string): Promise<RecordingSession | null> {
    const session = this.sessions.get(sensorId);
    if (!session) return null;

    // Flush remaining buffer
    await this.flushBuffer(sensorId);

    // Close writer
    const writer = this.writers.get(sensorId);
    if (writer) {
      await new Promise<void>((resolve) => {
        writer.end(() => resolve());
      });
      this.writers.delete(sensorId);
    }

    // Update PLY header with actual vertex count if needed
    if (session.config.format === 'ply' && session.outputFiles.length > 0) {
      await this.updatePLYHeader(session);
    }

    // Update metadata for raw format
    if (session.config.format === 'raw') {
      await this.updateRawMetadata(session);
    }

    session.endTime = new Date();
    session.status = 'stopped';

    this.sessions.delete(sensorId);
    this.frameBuffers.delete(sensorId);

    this.emit('recording-stopped', session);
    logger.info(`Stopped recording for sensor ${sensorId}. Frames: ${session.frameCount}, Bytes: ${session.bytesWritten}`);

    return session;
  }

  /**
   * Update PLY header with vertex count
   */
  private async updatePLYHeader(session: RecordingSession): Promise<void> {
    const filePath = session.outputFiles[0];
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Count vertices (lines after end_header)
    const headerEnd = lines.indexOf('end_header');
    if (headerEnd === -1) return;
    
    const vertexCount = lines.length - headerEnd - 2; // -1 for end_header, -1 for empty line
    
    // Update element vertex line
    for (let i = 0; i < headerEnd; i++) {
      if (lines[i].startsWith('element vertex')) {
        lines[i] = `element vertex ${vertexCount}`;
        break;
      }
    }

    fs.writeFileSync(filePath, lines.join('\n'));
  }

  /**
   * Update raw format metadata
   */
  private async updateRawMetadata(session: RecordingSession): Promise<void> {
    const metaPath = session.outputFiles[0];
    if (!fs.existsSync(metaPath)) return;

    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    metadata.endTime = session.endTime?.toISOString();
    metadata.frameCount = session.frameCount;
    metadata.bytesWritten = session.bytesWritten;
    metadata.duration = session.endTime ? 
      (session.endTime.getTime() - session.startTime.getTime()) / 1000 : 0;

    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Export session to video
   */
  async exportToVideo(sessionId: string, outputPath: string): Promise<void> {
    // This would use FFmpeg to create a video from recorded frames
    logger.info(`Exporting session ${sessionId} to video: ${outputPath}`);
    
    // Implementation would involve:
    // 1. Reading recorded frames
    // 2. Rendering each frame to an image
    // 3. Using FFmpeg to combine images into video
  }

  /**
   * Get active recordings
   */
  getActiveRecordings(): RecordingSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'recording');
  }

  /**
   * Get recording session
   */
  getRecording(sensorId: string): RecordingSession | undefined {
    return this.sessions.get(sensorId);
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    // Stop all recordings
    for (const sensorId of this.sessions.keys()) {
      await this.stopRecording(sensorId);
    }

    this.removeAllListeners();
  }
}