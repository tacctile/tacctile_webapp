/**
 * Media Processor for Gemini API
 * Handles media file preprocessing and optimization
 */

import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MediaFile, ProcessingOptions, MediaMetadata } from './types';
import { logger } from '../../utils/logger';

export class MediaProcessor {
  private readonly maxFileSizeMB: number;
  private readonly supportedImageFormats: Set<string>;
  private readonly supportedVideoFormats: Set<string>;
  private readonly supportedAudioFormats: Set<string>;

  constructor() {
    this.maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '100');
    
    this.supportedImageFormats = new Set(
      (process.env.SUPPORTED_IMAGE_FORMATS || 'jpg,jpeg,png,webp,heic,heif').split(',')
    );
    
    this.supportedVideoFormats = new Set(
      (process.env.SUPPORTED_VIDEO_FORMATS || 'mp4,mpeg,mov,avi,flv,mpg,webm,wmv,3gpp').split(',')
    );
    
    this.supportedAudioFormats = new Set(
      (process.env.SUPPORTED_AUDIO_FORMATS || 'wav,mp3,aiff,aac,ogg,flac').split(',')
    );
  }

  /**
   * Process media file for Gemini API
   */
  async processFile(
    filePath: string,
    options?: ProcessingOptions,
    metadata?: MediaMetadata
  ): Promise<MediaFile> {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase().substring(1);
    const filename = path.basename(filePath);
    
    // Check file size
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > this.maxFileSizeMB) {
      throw new Error(`File size ${sizeMB.toFixed(2)}MB exceeds maximum ${this.maxFileSizeMB}MB`);
    }
    
    // Determine media type and process accordingly
    let processedBuffer: Buffer;
    let mimeType: string;
    
    if (this.supportedImageFormats.has(ext)) {
      const result = await this.processImage(filePath, options);
      processedBuffer = result.buffer;
      mimeType = result.mimeType;
    } else if (this.supportedVideoFormats.has(ext)) {
      const result = await this.processVideo(filePath, options);
      processedBuffer = result.buffer;
      mimeType = result.mimeType;
    } else if (this.supportedAudioFormats.has(ext)) {
      const result = await this.processAudio(filePath, options);
      processedBuffer = result.buffer;
      mimeType = result.mimeType;
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }
    
    return {
      buffer: processedBuffer,
      mimeType,
      size: processedBuffer.length,
      filename,
      metadata
    };
  }

  /**
   * Process image file
   */
  private async processImage(
    filePath: string,
    options?: ProcessingOptions
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      let pipeline = sharp(filePath);
      
      // Get image metadata
      const metadata = await pipeline.metadata();
      logger.debug('Processing image', { 
        width: metadata.width, 
        height: metadata.height,
        format: metadata.format 
      });
      
      // Apply enhancements if requested
      if (options?.enhanceImage) {
        pipeline = pipeline
          .normalize() // Normalize image histogram
          .sharpen(); // Apply sharpening
      }
      
      // Apply denoising if requested
      if (options?.denoise) {
        pipeline = pipeline.median(3); // Apply median filter for noise reduction
      }
      
      // Resize if too large (max 4096x4096 for Gemini)
      if (metadata.width && metadata.width > 4096) {
        pipeline = pipeline.resize(4096, null, { 
          withoutEnlargement: true,
          fit: 'inside' 
        });
      }
      
      if (metadata.height && metadata.height > 4096) {
        pipeline = pipeline.resize(null, 4096, { 
          withoutEnlargement: true,
          fit: 'inside' 
        });
      }
      
      // Convert to JPEG for consistency and compression
      const buffer = await pipeline
        .jpeg({ quality: 95, progressive: true })
        .toBuffer();
      
      return {
        buffer,
        mimeType: 'image/jpeg'
      };
    } catch (error) {
      logger.error('Image processing failed', error);
      // Fallback to original file
      const buffer = await fs.readFile(filePath);
      return {
        buffer,
        mimeType: this.getImageMimeType(path.extname(filePath))
      };
    }
  }

  /**
   * Process video file
   */
  private async processVideo(
    filePath: string,
    options?: ProcessingOptions
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    // For video, we'll extract frames if requested
    if (options?.extractFrames) {
      return this.extractVideoFrames(filePath, options);
    }
    
    // Otherwise, read the video file directly
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase().substring(1);
    
    return {
      buffer,
      mimeType: this.getVideoMimeType(ext)
    };
  }

  /**
   * Extract frames from video
   */
  private async extractVideoFrames(
    filePath: string,
    options: ProcessingOptions
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    // This would require ffmpeg integration
    // For now, return a placeholder implementation
    logger.warn('Video frame extraction not yet implemented, using first frame placeholder');
    
    // In a real implementation, you would use ffmpeg to extract frames
    // Example: ffmpeg -i video.mp4 -vf fps=1/5 frame_%d.jpg
    
    const buffer = await fs.readFile(filePath);
    return {
      buffer,
      mimeType: 'video/mp4'
    };
  }

  /**
   * Process audio file
   */
  private async processAudio(
    filePath: string,
    options?: ProcessingOptions
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    // Audio processing would require additional libraries like sox or ffmpeg
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase().substring(1);
    
    return {
      buffer,
      mimeType: this.getAudioMimeType(ext)
    };
  }

  /**
   * Process buffer directly
   */
  async processBuffer(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    options?: ProcessingOptions,
    metadata?: MediaMetadata
  ): Promise<MediaFile> {
    // Check size
    const sizeMB = buffer.length / (1024 * 1024);
    if (sizeMB > this.maxFileSizeMB) {
      throw new Error(`Buffer size ${sizeMB.toFixed(2)}MB exceeds maximum ${this.maxFileSizeMB}MB`);
    }
    
    let processedBuffer = buffer;
    
    // Process based on mime type
    if (mimeType.startsWith('image/') && options?.enhanceImage) {
      try {
        let pipeline = sharp(buffer);
        
        if (options.enhanceImage) {
          pipeline = pipeline.normalize().sharpen();
        }
        
        if (options.denoise) {
          pipeline = pipeline.median(3);
        }
        
        processedBuffer = await pipeline.jpeg({ quality: 95 }).toBuffer();
        mimeType = 'image/jpeg';
      } catch (error) {
        logger.error('Buffer image processing failed', error);
      }
    }
    
    return {
      buffer: processedBuffer,
      mimeType,
      size: processedBuffer.length,
      filename,
      metadata
    };
  }

  /**
   * Validate media file
   */
  async validateFile(filePath: string): Promise<{
    valid: boolean;
    format?: string;
    size?: number;
    error?: string;
  }> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase().substring(1);
      const sizeMB = stats.size / (1024 * 1024);
      
      // Check if format is supported
      const isSupported = 
        this.supportedImageFormats.has(ext) ||
        this.supportedVideoFormats.has(ext) ||
        this.supportedAudioFormats.has(ext);
      
      if (!isSupported) {
        return {
          valid: false,
          format: ext,
          size: stats.size,
          error: `Unsupported format: ${ext}`
        };
      }
      
      // Check size
      if (sizeMB > this.maxFileSizeMB) {
        return {
          valid: false,
          format: ext,
          size: stats.size,
          error: `File too large: ${sizeMB.toFixed(2)}MB (max: ${this.maxFileSizeMB}MB)`
        };
      }
      
      return {
        valid: true,
        format: ext,
        size: stats.size
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get MIME type for image
   */
  private getImageMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.heif': 'image/heif'
    };
    return mimeTypes[ext.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Get MIME type for video
   */
  private getVideoMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'mpeg': 'video/mpeg',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'flv': 'video/x-flv',
      'mpg': 'video/mpeg',
      'webm': 'video/webm',
      'wmv': 'video/x-ms-wmv',
      '3gpp': 'video/3gpp'
    };
    return mimeTypes[ext] || 'video/mp4';
  }

  /**
   * Get MIME type for audio
   */
  private getAudioMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'aiff': 'audio/aiff',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac'
    };
    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): {
    image: string[];
    video: string[];
    audio: string[];
  } {
    return {
      image: Array.from(this.supportedImageFormats),
      video: Array.from(this.supportedVideoFormats),
      audio: Array.from(this.supportedAudioFormats)
    };
  }
}

// Export singleton instance
export const mediaProcessor = new MediaProcessor();