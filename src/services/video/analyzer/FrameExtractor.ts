/**
 * Frame Extractor
 * Extract and process video frames for analysis
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  VideoFrame, 
  FrameExtractionOptions 
} from '../types';
import { FFmpegProcessor } from './FFmpegProcessor';
import { logger } from '../../../utils/logger';

export class FrameExtractor {
  private ffmpeg: FFmpegProcessor;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tempDir: string;

  constructor(ffmpegProcessor: FFmpegProcessor) {
    this.ffmpeg = ffmpegProcessor;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.tempDir = path.join(process.env.TEMP || '/tmp', 'tacctile-frames');
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', error);
    }
  }

  /**
   * Extract frames from video
   */
  async extractFrames(
    videoPath: string,
    options: FrameExtractionOptions = {}
  ): Promise<VideoFrame[]> {
    const frames: VideoFrame[] = [];
    
    try {
      // Get video metadata first
      const metadata = await this.ffmpeg.getMetadata(videoPath);
      
      // Calculate extraction parameters
      const startTime = options.startTime || 0;
      const endTime = options.endTime || metadata.duration;
      const interval = options.interval || 1 / metadata.frameRate;
      const maxFrames = options.maxFrames || Infinity;
      
      // Generate output pattern
      const sessionId = Date.now();
      const outputPattern = path.join(this.tempDir, `frame_${sessionId}_%06d.png`);
      
      // Extract frames using FFmpeg
      const extractOptions = {
        startTime,
        endTime,
        interval: options.keyFramesOnly ? undefined : interval,
        fps: options.keyFramesOnly ? undefined : 1 / interval
      };
      
      if (options.keyFramesOnly) {
        // Extract only keyframes
        await this.extractKeyFrames(videoPath, outputPattern, startTime, endTime);
      } else {
        // Extract frames at regular intervals
        await this.ffmpeg.extractFrames(videoPath, outputPattern, extractOptions);
      }
      
      // Load extracted frames
      const frameFiles = await this.getExtractedFrames(sessionId);
      const framesToLoad = Math.min(frameFiles.length, maxFrames);
      
      for (let i = 0; i < framesToLoad; i++) {
        const framePath = frameFiles[i];
        const frameIndex = this.getFrameIndex(framePath);
        const timestamp = startTime + (frameIndex * interval);
        
        const imageData = await this.loadFrameImage(framePath);
        
        frames.push({
          index: frameIndex,
          timestamp,
          data: imageData,
          keyFrame: options.keyFramesOnly || false
        });
        
        // Clean up frame file
        await fs.unlink(framePath);
      }
      
      // Clean up remaining files
      for (let i = framesToLoad; i < frameFiles.length; i++) {
        await fs.unlink(frameFiles[i]);
      }
      
      logger.info(`Extracted ${frames.length} frames from video`, { videoPath });
      return frames;
      
    } catch (error) {
      logger.error('Frame extraction failed', error);
      throw error;
    }
  }

  /**
   * Extract key frames only
   */
  private async extractKeyFrames(
    videoPath: string,
    outputPattern: string,
    startTime: number,
    endTime: number
  ): Promise<void> {
    // Use FFmpeg to extract I-frames (keyframes)
    const args = [
      '-skip_frame', 'nokey', // Only decode keyframes
      '-i', videoPath,
      '-vsync', '0',
      '-frame_pts', '1',
      '-f', 'image2',
      outputPattern
    ];
    
    // This would need custom FFmpeg command execution
    // For now, fall back to scene detection
    const sceneChanges = await this.ffmpeg.detectSceneChanges(videoPath, 0.3);
    
    for (let i = 0; i < sceneChanges.length; i++) {
      const timestamp = sceneChanges[i];
      if (timestamp >= startTime && timestamp <= endTime) {
        const framePath = outputPattern.replace('%06d', String(i).padStart(6, '0'));
        await this.ffmpeg.extractFrame(videoPath, timestamp, framePath);
      }
    }
  }

  /**
   * Extract single frame at specific time
   */
  async extractFrameAt(
    videoPath: string,
    timestamp: number,
    quality: number = 1
  ): Promise<VideoFrame> {
    const framePath = path.join(this.tempDir, `frame_${Date.now()}.png`);
    
    try {
      // Extract frame using FFmpeg
      await this.ffmpeg.extractFrame(videoPath, timestamp, framePath);
      
      // Load frame image
      const imageData = await this.loadFrameImage(framePath, quality);
      
      // Get metadata for frame rate
      const metadata = await this.ffmpeg.getMetadata(videoPath);
      const frameIndex = Math.floor(timestamp * metadata.frameRate);
      
      // Clean up
      await fs.unlink(framePath);
      
      return {
        index: frameIndex,
        timestamp,
        data: imageData,
        keyFrame: false
      };
      
    } catch (error) {
      logger.error('Failed to extract frame', { timestamp, error });
      throw error;
    }
  }

  /**
   * Extract frames in range
   */
  async extractFrameRange(
    videoPath: string,
    startFrame: number,
    endFrame: number,
    quality: number = 1
  ): Promise<VideoFrame[]> {
    const metadata = await this.ffmpeg.getMetadata(videoPath);
    const startTime = startFrame / metadata.frameRate;
    const endTime = endFrame / metadata.frameRate;
    
    return this.extractFrames(videoPath, {
      startTime,
      endTime,
      quality
    });
  }

  /**
   * Load frame image from file
   */
  private async loadFrameImage(
    framePath: string,
    quality: number = 1
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        // Resize canvas to match image
        const targetWidth = Math.floor(img.width * quality);
        const targetHeight = Math.floor(img.height * quality);
        
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
        
        // Draw and get image data
        this.ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const imageData = this.ctx.getImageData(0, 0, targetWidth, targetHeight);
        
        resolve(imageData);
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to load frame image: ${framePath}`));
      };
      
      // Load image from file path
      img.src = `file://${framePath}`;
    });
  }

  /**
   * Get list of extracted frame files
   */
  private async getExtractedFrames(sessionId: number): Promise<string[]> {
    const files = await fs.readdir(this.tempDir);
    const frameFiles = files
      .filter(f => f.startsWith(`frame_${sessionId}_`))
      .map(f => path.join(this.tempDir, f))
      .sort();
    
    return frameFiles;
  }

  /**
   * Get frame index from filename
   */
  private getFrameIndex(framePath: string): number {
    const filename = path.basename(framePath);
    const match = filename.match(/_(\d+)\.png$/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Extract thumbnails for timeline
   */
  async extractThumbnails(
    videoPath: string,
    count: number = 10,
    width: number = 160,
    height: number = 90
  ): Promise<ImageData[]> {
    const metadata = await this.ffmpeg.getMetadata(videoPath);
    const interval = metadata.duration / count;
    const thumbnails: ImageData[] = [];
    
    for (let i = 0; i < count; i++) {
      const timestamp = i * interval;
      const thumbPath = path.join(this.tempDir, `thumb_${Date.now()}_${i}.jpg`);
      
      try {
        // Generate thumbnail
        await this.ffmpeg.generateThumbnail(
          videoPath,
          timestamp,
          thumbPath,
          width,
          height
        );
        
        // Load thumbnail
        const imageData = await this.loadFrameImage(thumbPath);
        thumbnails.push(imageData);
        
        // Clean up
        await fs.unlink(thumbPath);
        
      } catch (error) {
        logger.warn(`Failed to extract thumbnail at ${timestamp}`, error);
        // Create blank thumbnail
        const blankData = new ImageData(width, height);
        thumbnails.push(blankData);
      }
    }
    
    return thumbnails;
  }

  /**
   * Extract motion vectors between frames
   */
  async extractMotionVectors(
    videoPath: string,
    startFrame: number,
    endFrame: number
  ): Promise<Array<{frame: number; vectors: Float32Array}>> {
    const metadata = await this.ffmpeg.getMetadata(videoPath);
    const results: Array<{frame: number; vectors: Float32Array}> = [];
    
    // This would require more complex FFmpeg filter for motion vector extraction
    // For now, we'll extract frames and calculate optical flow
    
    const frames = await this.extractFrameRange(videoPath, startFrame, endFrame);
    
    for (let i = 1; i < frames.length; i++) {
      const vectors = this.calculateOpticalFlow(
        frames[i - 1].data,
        frames[i].data
      );
      
      results.push({
        frame: frames[i].index,
        vectors
      });
    }
    
    return results;
  }

  /**
   * Calculate optical flow between frames
   */
  private calculateOpticalFlow(
    frame1: ImageData,
    frame2: ImageData
  ): Float32Array {
    const { width, height } = frame1;
    const blockSize = 16;
    const searchRadius = 8;
    const blocksX = Math.floor(width / blockSize);
    const blocksY = Math.floor(height / blockSize);
    const vectors = new Float32Array(blocksX * blocksY * 2);
    
    // Convert to grayscale
    const gray1 = this.toGrayscale(frame1);
    const gray2 = this.toGrayscale(frame2);
    
    // Block matching for optical flow
    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const x = bx * blockSize;
        const y = by * blockSize;
        
        // Find best match in search area
        let minDiff = Infinity;
        let bestDx = 0;
        let bestDy = 0;
        
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && ny >= 0 && 
                nx + blockSize < width && 
                ny + blockSize < height) {
              
              const diff = this.blockDifference(
                gray1, gray2,
                x, y, nx, ny,
                blockSize, width
              );
              
              if (diff < minDiff) {
                minDiff = diff;
                bestDx = dx;
                bestDy = dy;
              }
            }
          }
        }
        
        const idx = (by * blocksX + bx) * 2;
        vectors[idx] = bestDx;
        vectors[idx + 1] = bestDy;
      }
    }
    
    return vectors;
  }

  /**
   * Convert to grayscale
   */
  private toGrayscale(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    const gray = new Uint8Array(width * height);
    
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      gray[idx] = Math.round(
        0.299 * data[i] + 
        0.587 * data[i + 1] + 
        0.114 * data[i + 2]
      );
    }
    
    return gray;
  }

  /**
   * Calculate block difference
   */
  private blockDifference(
    gray1: Uint8Array,
    gray2: Uint8Array,
    x1: number, y1: number,
    x2: number, y2: number,
    blockSize: number,
    width: number
  ): number {
    let sum = 0;
    
    for (let dy = 0; dy < blockSize; dy++) {
      for (let dx = 0; dx < blockSize; dx++) {
        const idx1 = (y1 + dy) * width + (x1 + dx);
        const idx2 = (y2 + dy) * width + (x2 + dx);
        const diff = gray1[idx1] - gray2[idx2];
        sum += diff * diff;
      }
    }
    
    return sum / (blockSize * blockSize);
  }

  /**
   * Batch process frames
   */
  async batchProcessFrames(
    frames: VideoFrame[],
    processor: (frame: VideoFrame) => VideoFrame
  ): Promise<VideoFrame[]> {
    const processed: VideoFrame[] = [];
    
    for (const frame of frames) {
      try {
        const result = processor(frame);
        processed.push(result);
      } catch (error) {
        logger.error(`Failed to process frame ${frame.index}`, error);
        processed.push(frame); // Keep original on error
      }
    }
    
    return processed;
  }

  /**
   * Clean up temp files
   */
  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        await fs.unlink(path.join(this.tempDir, file));
      }
    } catch (error) {
      logger.error('Failed to cleanup temp files', error);
    }
  }
}