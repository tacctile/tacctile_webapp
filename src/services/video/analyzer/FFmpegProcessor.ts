/**
 * FFmpeg Processor
 * Interface for FFmpeg command execution and video processing
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  VideoMetadata, 
  VideoEnhancements,
  VideoExportOptions,
  FFmpegCommand 
} from '../types';
import { logger } from '../../../utils/logger';

export class FFmpegProcessor {
  private ffmpegPath: string;
  private ffprobePath: string;
  private tempDir: string;

  constructor() {
    // Use system FFmpeg or bundled version
    this.ffmpegPath = process.platform === 'win32' 
      ? path.join(process.resourcesPath || '', 'ffmpeg', 'ffmpeg.exe')
      : 'ffmpeg';
    
    this.ffprobePath = process.platform === 'win32'
      ? path.join(process.resourcesPath || '', 'ffmpeg', 'ffprobe.exe')
      : 'ffprobe';
    
    this.tempDir = path.join(process.env.TEMP || '/tmp', 'tacctile-video');
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
   * Get video metadata using ffprobe
   */
  async getMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ];

      const process = spawn(this.ffprobePath, args);
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed: ${error}`));
          return;
        }

        try {
          const data = JSON.parse(output);
          const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
          const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');

          const metadata: VideoMetadata = {
            duration: parseFloat(data.format.duration),
            frameRate: eval(videoStream.r_frame_rate), // e.g., "30/1" -> 30
            width: videoStream.width,
            height: videoStream.height,
            codec: videoStream.codec_name,
            bitrate: parseInt(data.format.bit_rate),
            format: data.format.format_name,
            hasAudio: !!audioStream,
            audioCodec: audioStream?.codec_name,
            audioBitrate: audioStream ? parseInt(audioStream.bit_rate) : undefined,
            audioSampleRate: audioStream ? parseInt(audioStream.sample_rate) : undefined,
            audioChannels: audioStream?.channels
          };

          // Parse creation time if available
          if (data.format.tags?.creation_time) {
            metadata.creationTime = new Date(data.format.tags.creation_time);
          }

          // Parse GPS location if available
          if (data.format.tags?.location) {
            const match = data.format.tags.location.match(/([+-]?\d+\.\d+)([+-]\d+\.\d+)/);
            if (match) {
              metadata.location = {
                latitude: parseFloat(match[1]),
                longitude: parseFloat(match[2])
              };
            }
          }

          resolve(metadata);
        } catch (err) {
          reject(new Error(`Failed to parse metadata: ${err}`));
        }
      });
    });
  }

  /**
   * Extract single frame at timestamp
   */
  async extractFrame(
    videoPath: string,
    timestamp: number,
    outputPath?: string
  ): Promise<string> {
    const output = outputPath || path.join(this.tempDir, `frame_${Date.now()}.png`);

    return new Promise((resolve, reject) => {
      const args = [
        '-ss', timestamp.toString(),
        '-i', videoPath,
        '-frames:v', '1',
        '-f', 'image2',
        '-y',
        output
      ];

      const process = spawn(this.ffmpegPath, args);
      let error = '';

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Frame extraction failed: ${error}`));
        } else {
          resolve(output);
        }
      });
    });
  }

  /**
   * Extract multiple frames
   */
  async extractFrames(
    videoPath: string,
    outputPattern: string,
    options: {
      startTime?: number;
      endTime?: number;
      interval?: number;
      fps?: number;
    } = {}
  ): Promise<string[]> {
    const args: string[] = [];

    if (options.startTime !== undefined) {
      args.push('-ss', options.startTime.toString());
    }

    args.push('-i', videoPath);

    if (options.endTime !== undefined && options.startTime !== undefined) {
      const duration = options.endTime - options.startTime;
      args.push('-t', duration.toString());
    }

    // Frame extraction filter
    if (options.fps) {
      args.push('-vf', `fps=${options.fps}`);
    } else if (options.interval) {
      args.push('-vf', `fps=1/${options.interval}`);
    }

    args.push('-f', 'image2', '-y', outputPattern);

    return new Promise((resolve, reject) => {
      const process = spawn(this.ffmpegPath, args);
      let error = '';

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', async (code) => {
        if (code !== 0) {
          reject(new Error(`Frame extraction failed: ${error}`));
        } else {
          // Get list of extracted frames
          const dir = path.dirname(outputPattern);
          const pattern = path.basename(outputPattern).replace('%d', '\\d+');
          const files = await fs.readdir(dir);
          const frames = files
            .filter(f => new RegExp(pattern).test(f))
            .map(f => path.join(dir, f))
            .sort();
          resolve(frames);
        }
      });
    });
  }

  /**
   * Apply video enhancements and export
   */
  async exportEnhancedVideo(
    inputPath: string,
    outputPath: string,
    enhancements: VideoEnhancements,
    options?: {
      startTime?: number;
      endTime?: number;
      includeMarkers?: boolean;
    }
  ): Promise<void> {
    const filters: string[] = [];

    // Build filter chain
    if (enhancements.brightness !== 0 || enhancements.contrast !== 0 || enhancements.saturation !== 100) {
      const brightness = enhancements.brightness / 100;
      const contrast = 1 + (enhancements.contrast / 100);
      const saturation = enhancements.saturation / 100;
      filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
    }

    if (enhancements.gamma !== 1) {
      filters.push(`eq=gamma=${enhancements.gamma}`);
    }

    if (enhancements.sharpness > 0) {
      const amount = enhancements.sharpness / 100;
      filters.push(`unsharp=5:5:${amount}:5:5:0`);
    }

    if (enhancements.denoise > 0) {
      const strength = enhancements.denoise / 10;
      filters.push(`nlmeans=${strength}`);
    }

    if (enhancements.stabilization) {
      filters.push('vidstabdetect=shakiness=5:accuracy=15');
    }

    // Color correction
    if (enhancements.temperature !== 0 || enhancements.tint !== 0) {
      const temp = 6500 + (enhancements.temperature * 30);
      filters.push(`colortemperature=temperature=${temp}`);
    }

    // Build FFmpeg command
    const args: string[] = [];

    if (options?.startTime !== undefined) {
      args.push('-ss', options.startTime.toString());
    }

    args.push('-i', inputPath);

    if (options?.endTime !== undefined && options?.startTime !== undefined) {
      const duration = options.endTime - options.startTime;
      args.push('-t', duration.toString());
    }

    if (filters.length > 0) {
      args.push('-vf', filters.join(','));
    }

    // Output settings
    args.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-y',
      outputPath
    );

    return new Promise((resolve, reject) => {
      const process = spawn(this.ffmpegPath, args);
      let error = '';

      process.stderr.on('data', (data) => {
        error += data.toString();
        // Parse progress
        const match = data.toString().match(/time=(\d+:\d+:\d+\.\d+)/);
        if (match) {
          this.emit('exportProgress', this.parseTime(match[1]));
        }
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Export failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Generate video thumbnail
   */
  async generateThumbnail(
    videoPath: string,
    timestamp: number,
    outputPath: string,
    width = 320,
    height = 180
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-ss', timestamp.toString(),
        '-i', videoPath,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:-1:-1:color=black`,
        '-frames:v', '1',
        '-f', 'image2',
        '-y',
        outputPath
      ];

      const process = spawn(this.ffmpegPath, args);
      let error = '';

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Thumbnail generation failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Extract audio from video
   */
  async extractAudio(
    videoPath: string,
    outputPath: string,
    format: 'wav' | 'mp3' | 'aac' = 'wav'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-vn', // No video
        '-acodec', format === 'wav' ? 'pcm_s16le' : format,
        '-y',
        outputPath
      ];

      const process = spawn(this.ffmpegPath, args);
      let error = '';

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Audio extraction failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Apply custom filter complex
   */
  async applyFilterComplex(
    inputPath: string,
    outputPath: string,
    filterComplex: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-filter_complex', filterComplex,
        '-c:a', 'copy',
        '-y',
        outputPath
      ];

      const process = spawn(this.ffmpegPath, args);
      let error = '';

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Filter application failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Detect scene changes
   */
  async detectSceneChanges(
    videoPath: string,
    threshold = 0.4
  ): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-filter:v', `select='gt(scene,${threshold})',showinfo`,
        '-f', 'null',
        '-'
      ];

      const process = spawn(this.ffmpegPath, args);
      let output = '';

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Scene detection failed'));
        } else {
          // Parse timestamps from output
          const timestamps: number[] = [];
          const matches = output.matchAll(/pts_time:(\d+\.\d+)/g);
          for (const match of matches) {
            timestamps.push(parseFloat(match[1]));
          }
          resolve(timestamps);
        }
      });
    });
  }

  /**
   * Convert video format
   */
  async convertFormat(
    inputPath: string,
    outputPath: string,
    options: VideoExportOptions
  ): Promise<void> {
    const args: string[] = ['-i', inputPath];

    // Video codec
    switch (options.format) {
      case 'mp4':
        args.push('-c:v', options.codec || 'libx264');
        break;
      case 'webm':
        args.push('-c:v', options.codec || 'libvpx-vp9');
        break;
      case 'avi':
        args.push('-c:v', options.codec || 'mpeg4');
        break;
      case 'mov':
        args.push('-c:v', options.codec || 'libx264');
        break;
    }

    // Quality settings
    if (options.quality === 'lossless') {
      args.push('-crf', '0');
    } else if (options.quality === 'high') {
      args.push('-crf', '18');
    } else if (options.quality === 'medium') {
      args.push('-crf', '23');
    } else if (options.quality === 'low') {
      args.push('-crf', '28');
    }

    // Bitrate
    if (options.bitrate) {
      args.push('-b:v', `${options.bitrate}k`);
    }

    // Resolution
    if (options.resolution) {
      args.push('-vf', `scale=${options.resolution.width}:${options.resolution.height}`);
    }

    // Frame rate
    if (options.frameRate) {
      args.push('-r', options.frameRate.toString());
    }

    // Audio
    if (options.includeAudio) {
      args.push('-c:a', 'aac', '-b:a', '192k');
    } else {
      args.push('-an');
    }

    args.push('-y', outputPath);

    return new Promise((resolve, reject) => {
      const process = spawn(this.ffmpegPath, args);
      let error = '';

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Conversion failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Parse time string to seconds
   */
  private parseTime(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Event emitter for progress updates
   */
  private emit(event: string, data: any): void {
    // Implement event emitter if needed
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