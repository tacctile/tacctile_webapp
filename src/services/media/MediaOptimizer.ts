import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { createWriteStream, existsSync, mkdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { app } from 'electron';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Configure ffmpeg path
const ffmpegPath = ffmpegInstaller.path;
ffmpeg.setFfmpegPath(ffmpegPath);

export interface PlatformPreset {
  width: number;
  height: number;
  quality?: number;
  format?: 'jpg' | 'png' | 'webp' | 'mp4' | 'mov';
  maxDuration?: number; // seconds
  maxFileSize?: number; // bytes
  aspectRatio: string;
  framerate?: number;
  bitrate?: string;
}

export interface MediaOptimizationOptions {
  platform: string;
  inputPath: string;
  outputDir?: string;
  customPreset?: Partial<PlatformPreset>;
  watermark?: {
    text?: string;
    imagePath?: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity?: number;
  };
}

export interface OptimizationResult {
  success: boolean;
  outputPath?: string;
  originalSize: number;
  optimizedSize?: number;
  compressionRatio?: number;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    duration?: number;
  };
}

export class MediaOptimizer {
  private static instance: MediaOptimizer;
  private outputDir: string;

  // Platform-specific presets
  private presets: Record<string, PlatformPreset> = {
    // Instagram presets
    'instagram-square': {
      width: 1080,
      height: 1080,
      quality: 85,
      format: 'jpg',
      aspectRatio: '1:1',
      maxFileSize: 30 * 1024 * 1024 // 30MB
    },
    'instagram-portrait': {
      width: 1080,
      height: 1350,
      quality: 85,
      format: 'jpg',
      aspectRatio: '4:5',
      maxFileSize: 30 * 1024 * 1024
    },
    'instagram-story': {
      width: 1080,
      height: 1920,
      quality: 85,
      format: 'jpg',
      aspectRatio: '9:16',
      maxFileSize: 30 * 1024 * 1024
    },
    'instagram-reel': {
      width: 1080,
      height: 1920,
      format: 'mp4',
      aspectRatio: '9:16',
      maxDuration: 90,
      framerate: 30,
      bitrate: '3000k',
      maxFileSize: 4 * 1024 * 1024 * 1024 // 4GB
    },

    // TikTok presets
    'tiktok-vertical': {
      width: 1080,
      height: 1920,
      format: 'mp4',
      aspectRatio: '9:16',
      maxDuration: 180,
      framerate: 30,
      bitrate: '2000k',
      maxFileSize: 287 * 1024 * 1024 // 287MB
    },
    'tiktok-square': {
      width: 1080,
      height: 1080,
      format: 'mp4',
      aspectRatio: '1:1',
      maxDuration: 180,
      framerate: 30,
      bitrate: '2000k',
      maxFileSize: 287 * 1024 * 1024
    },

    // YouTube presets
    'youtube-16x9': {
      width: 1920,
      height: 1080,
      format: 'mp4',
      aspectRatio: '16:9',
      framerate: 30,
      bitrate: '8000k',
      maxFileSize: 256 * 1024 * 1024 * 1024 // 256GB
    },
    'youtube-short': {
      width: 1080,
      height: 1920,
      format: 'mp4',
      aspectRatio: '9:16',
      maxDuration: 60,
      framerate: 30,
      bitrate: '5000k',
      maxFileSize: 256 * 1024 * 1024 * 1024
    },
    'youtube-thumbnail': {
      width: 1280,
      height: 720,
      quality: 95,
      format: 'jpg',
      aspectRatio: '16:9',
      maxFileSize: 2 * 1024 * 1024 // 2MB
    },

    // Twitter presets
    'twitter-16x9': {
      width: 1200,
      height: 675,
      quality: 85,
      format: 'jpg',
      aspectRatio: '16:9',
      maxFileSize: 5 * 1024 * 1024 // 5MB
    },
    'twitter-video': {
      width: 1280,
      height: 720,
      format: 'mp4',
      aspectRatio: '16:9',
      maxDuration: 140,
      framerate: 30,
      bitrate: '6000k',
      maxFileSize: 512 * 1024 * 1024 // 512MB
    },

    // Facebook presets
    'facebook-landscape': {
      width: 1200,
      height: 630,
      quality: 85,
      format: 'jpg',
      aspectRatio: '1.91:1',
      maxFileSize: 8 * 1024 * 1024 // 8MB
    },
    'facebook-video': {
      width: 1280,
      height: 720,
      format: 'mp4',
      aspectRatio: '16:9',
      maxDuration: 240,
      framerate: 30,
      bitrate: '4000k',
      maxFileSize: 4 * 1024 * 1024 * 1024 // 4GB
    },

    // Reddit presets
    'reddit-standard': {
      width: 1200,
      height: 800,
      quality: 90,
      format: 'jpg',
      aspectRatio: '3:2',
      maxFileSize: 20 * 1024 * 1024 // 20MB
    }
  };

  private constructor() {
    this.outputDir = join(app.getPath('userData'), 'optimized-media');
    this.ensureOutputDir();
  }

  public static getInstance(): MediaOptimizer {
    if (!MediaOptimizer.instance) {
      MediaOptimizer.instance = new MediaOptimizer();
    }
    return MediaOptimizer.instance;
  }

  private ensureOutputDir(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  public getPreset(platform: string): PlatformPreset | null {
    return this.presets[platform] || null;
  }

  public getAllPresets(): Record<string, PlatformPreset> {
    return { ...this.presets };
  }

  public addCustomPreset(name: string, preset: PlatformPreset): void {
    this.presets[name] = preset;
  }

  public async optimizeForPlatform(options: MediaOptimizationOptions): Promise<OptimizationResult> {
    try {
      const { inputPath, platform, outputDir, customPreset, watermark } = options;
      const preset = customPreset ? { ...this.getPreset(platform), ...customPreset } : this.getPreset(platform);
      
      if (!preset) {
        throw new Error(`No preset found for platform: ${platform}`);
      }

      if (!existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      const outputPath = this.generateOutputPath(inputPath, platform, outputDir);
      const isVideo = this.isVideoFile(inputPath);
      
      let result: OptimizationResult;
      
      if (isVideo) {
        result = await this.optimizeVideo(inputPath, outputPath, preset, watermark);
      } else {
        result = await this.optimizeImage(inputPath, outputPath, preset, watermark);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        originalSize: 0,
        error: error.message
      };
    }
  }

  private async optimizeImage(
    inputPath: string,
    outputPath: string,
    preset: PlatformPreset,
    watermark?: MediaOptimizationOptions['watermark']
  ): Promise<OptimizationResult> {
    const originalSize = statSync(inputPath).size;

    let sharpInstance = sharp(inputPath);

    // Get original metadata
    const metadata = await sharpInstance.metadata();

    // Resize with aspect ratio handling
    if (preset.width && preset.height) {
      sharpInstance = sharpInstance.resize(preset.width, preset.height, {
        fit: 'cover',
        position: 'center'
      });
    }

    // Add watermark if specified
    if (watermark) {
      if (watermark.text) {
        // Text watermark
        const textSvg = this.createTextWatermark(watermark.text, preset.width, preset.height, watermark.position);
        sharpInstance = sharpInstance.composite([{
          input: Buffer.from(textSvg),
          gravity: this.getSharpGravity(watermark.position)
        }]);
      } else if (watermark.imagePath && existsSync(watermark.imagePath)) {
        // Image watermark
        sharpInstance = sharpInstance.composite([{
          input: watermark.imagePath,
          gravity: this.getSharpGravity(watermark.position),
          blend: watermark.opacity ? 'over' : 'over'
        }]);
      }
    }

    // Set format and quality
    if (preset.format === 'jpg') {
      sharpInstance = sharpInstance.jpeg({ quality: preset.quality || 80 });
    } else if (preset.format === 'png') {
      sharpInstance = sharpInstance.png({ quality: preset.quality || 80 });
    } else if (preset.format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: preset.quality || 80 });
    }

    await sharpInstance.toFile(outputPath);

    const optimizedSize = fs.statSync(outputPath).size;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

    return {
      success: true,
      outputPath,
      originalSize,
      optimizedSize,
      compressionRatio,
      metadata: {
        width: preset.width,
        height: preset.height,
        format: preset.format || 'jpg'
      }
    };
  }

  private async optimizeVideo(
    inputPath: string,
    outputPath: string,
    preset: PlatformPreset,
    watermark?: MediaOptimizationOptions['watermark']
  ): Promise<OptimizationResult> {
    return new Promise((resolve, reject) => {
      const originalSize = statSync(inputPath).size;

      let command = ffmpeg(inputPath);

      // Set video codec and bitrate
      command = command
        .videoCodec('libx264')
        .videoBitrate(preset.bitrate || '2000k')
        .fps(preset.framerate || 30);

      // Set resolution
      if (preset.width && preset.height) {
        command = command.size(`${preset.width}x${preset.height}`);
      }

      // Set duration limit
      if (preset.maxDuration) {
        command = command.duration(preset.maxDuration);
      }

      // Add watermark if specified
      if (watermark && watermark.text) {
        const fontSize = Math.floor(preset.width / 40);
        const fontcolor = 'white';
        const position = this.getFFmpegTextPosition(watermark.position, preset.width, preset.height);
        
        command = command.videoFilters([
          `drawtext=text='${watermark.text}':fontcolor=${fontcolor}:fontsize=${fontSize}:${position}`
        ]);
      } else if (watermark && watermark.imagePath && existsSync(watermark.imagePath)) {
        const position = this.getFFmpegOverlayPosition(watermark.position);
        command = command.videoFilters([
          `movie=${watermark.imagePath}[watermark];[in][watermark]overlay=${position}[out]`
        ]);
      }

      // Set audio codec
      command = command.audioCodec('aac').audioBitrate('128k');

      // Output format
      command = command.format('mp4');

      command
        .on('end', () => {
          const optimizedSize = fs.statSync(outputPath).size;
          const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

          resolve({
            success: true,
            outputPath,
            originalSize,
            optimizedSize,
            compressionRatio,
            metadata: {
              width: preset.width,
              height: preset.height,
              format: 'mp4'
            }
          });
        })
        .on('error', (error) => {
          reject(new Error(`Video optimization failed: ${error.message}`));
        })
        .save(outputPath);
    });
  }

  private generateOutputPath(inputPath: string, platform: string, outputDir?: string): string {
    const baseDir = outputDir || this.outputDir;
    const fileName = basename(inputPath, extname(inputPath));
    const preset = this.getPreset(platform);
    const extension = preset?.format === 'mp4' ? '.mp4' : `.${preset?.format || 'jpg'}`;
    
    return join(baseDir, `${fileName}_${platform}${extension}`);
  }

  private isVideoFile(filePath: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'];
    return videoExtensions.includes(extname(filePath).toLowerCase());
  }

  private createTextWatermark(text: string, width: number, height: number, position: string): string {
    const fontSize = Math.floor(width / 40);
    const x = position.includes('right') ? width - 50 : 50;
    const y = position.includes('bottom') ? height - 50 : 50;

    return `
      <svg width="${width}" height="${height}">
        <text x="${x}" y="${y}" 
              font-family="Arial" 
              font-size="${fontSize}" 
              fill="white" 
              fill-opacity="0.8"
              stroke="black" 
              stroke-width="1">
          ${text}
        </text>
      </svg>
    `;
  }

  private getSharpGravity(position: string): string {
    switch (position) {
      case 'top-left': return 'northwest';
      case 'top-right': return 'northeast';
      case 'bottom-left': return 'southwest';
      case 'bottom-right': return 'southeast';
      case 'center': return 'center';
      default: return 'center';
    }
  }

  private getFFmpegTextPosition(position: string, width: number, height: number): string {
    switch (position) {
      case 'top-left': return 'x=10:y=10';
      case 'top-right': return `x=${width - 200}:y=10`;
      case 'bottom-left': return `x=10:y=${height - 50}`;
      case 'bottom-right': return `x=${width - 200}:y=${height - 50}`;
      case 'center': return `x=(w-text_w)/2:y=(h-text_h)/2`;
      default: return 'x=10:y=10';
    }
  }

  private getFFmpegOverlayPosition(position: string): string {
    switch (position) {
      case 'top-left': return '10:10';
      case 'top-right': return 'main_w-overlay_w-10:10';
      case 'bottom-left': return '10:main_h-overlay_h-10';
      case 'bottom-right': return 'main_w-overlay_w-10:main_h-overlay_h-10';
      case 'center': return '(main_w-overlay_w)/2:(main_h-overlay_h)/2';
      default: return '10:10';
    }
  }

  public async batchOptimize(
    inputPaths: string[],
    platforms: string[],
    options?: {
      outputDir?: string;
      watermark?: MediaOptimizationOptions['watermark'];
      onProgress?: (current: number, total: number, currentFile: string) => void;
    }
  ): Promise<Array<{ inputPath: string; platform: string; result: OptimizationResult }>> {
    const results: Array<{ inputPath: string; platform: string; result: OptimizationResult }> = [];
    const total = inputPaths.length * platforms.length;
    let current = 0;

    for (const inputPath of inputPaths) {
      for (const platform of platforms) {
        current++;
        options?.onProgress?.(current, total, `${basename(inputPath)} -> ${platform}`);

        const result = await this.optimizeForPlatform({
          inputPath,
          platform,
          outputDir: options?.outputDir,
          watermark: options?.watermark
        });

        results.push({ inputPath, platform, result });
      }
    }

    return results;
  }
}

// Export singleton instance
export const mediaOptimizer = MediaOptimizer.getInstance();