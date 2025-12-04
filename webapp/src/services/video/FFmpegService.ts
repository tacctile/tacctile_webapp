/**
 * FFmpegService - Browser-based video processing using ffmpeg.wasm
 * Replaces native FFmpeg with WebAssembly version
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private isLoading = false;

  /**
   * Initialize FFmpeg.wasm
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;
    if (this.isLoading) {
      // Wait for existing load to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isLoading = true;

    try {
      this.ffmpeg = new FFmpeg();

      // Set up logging
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      // Set up progress tracking
      this.ffmpeg.on('progress', ({ progress, time }) => {
        console.log(`[FFmpeg] Progress: ${(progress * 100).toFixed(2)}% (${time}s)`);
      });

      // Load FFmpeg core
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('[FFmpeg] Loaded successfully');
    } catch (error) {
      console.error('[FFmpeg] Failed to load:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Extract frames from video
   */
  async extractFrames(
    videoFile: File,
    options: {
      fps?: number;
      startTime?: number;
      duration?: number;
      quality?: number;
    } = {}
  ): Promise<Blob[]> {
    await this.load();

    const { fps = 1, startTime = 0, duration, quality = 2 } = options;

    try {
      // Write input file
      await this.ffmpeg!.writeFile('input.mp4', await fetchFile(videoFile));

      // Build FFmpeg command
      const args = [
        '-i', 'input.mp4',
        ...(startTime > 0 ? ['-ss', startTime.toString()] : []),
        ...(duration ? ['-t', duration.toString()] : []),
        '-vf', `fps=${fps}`,
        '-q:v', quality.toString(),
        'frame-%04d.jpg'
      ];

      // Execute FFmpeg command
      await this.ffmpeg!.exec(args);

      // Read output frames
      const frames: Blob[] = [];
      let frameIndex = 1;

      while (true) {
        const filename = `frame-${frameIndex.toString().padStart(4, '0')}.jpg`;
        try {
          const data = await this.ffmpeg!.readFile(filename);
          frames.push(new Blob([data], { type: 'image/jpeg' }));
          // Clean up
          await this.ffmpeg!.deleteFile(filename);
          frameIndex++;
        } catch {
          break; // No more frames
        }
      }

      // Clean up input
      await this.ffmpeg!.deleteFile('input.mp4');

      return frames;
    } catch (error) {
      console.error('[FFmpeg] Frame extraction failed:', error);
      throw error;
    }
  }

  /**
   * Convert video format
   */
  async convertVideo(
    videoFile: File,
    outputFormat: 'mp4' | 'webm' | 'avi',
    options: {
      codec?: string;
      bitrate?: string;
      scale?: string;
      fps?: number;
    } = {}
  ): Promise<Blob> {
    await this.load();

    const { codec, bitrate = '1M', scale, fps } = options;

    try {
      // Write input file
      await this.ffmpeg!.writeFile('input', await fetchFile(videoFile));

      // Build FFmpeg command
      const args = [
        '-i', 'input',
        ...(codec ? ['-c:v', codec] : []),
        '-b:v', bitrate,
        ...(scale ? ['-vf', `scale=${scale}`] : []),
        ...(fps ? ['-r', fps.toString()] : []),
        `output.${outputFormat}`
      ];

      // Execute FFmpeg command
      await this.ffmpeg!.exec(args);

      // Read output file
      const data = await this.ffmpeg!.readFile(`output.${outputFormat}`);
      const blob = new Blob([data], {
        type: `video/${outputFormat}`
      });

      // Clean up
      await this.ffmpeg!.deleteFile('input');
      await this.ffmpeg!.deleteFile(`output.${outputFormat}`);

      return blob;
    } catch (error) {
      console.error('[FFmpeg] Video conversion failed:', error);
      throw error;
    }
  }

  /**
   * Extract audio from video
   */
  async extractAudio(
    videoFile: File,
    format: 'mp3' | 'wav' | 'aac' = 'mp3'
  ): Promise<Blob> {
    await this.load();

    try {
      await this.ffmpeg!.writeFile('input', await fetchFile(videoFile));

      await this.ffmpeg!.exec([
        '-i', 'input',
        '-vn', // No video
        '-acodec', format === 'mp3' ? 'libmp3lame' : format,
        `output.${format}`
      ]);

      const data = await this.ffmpeg!.readFile(`output.${format}`);
      const blob = new Blob([data], {
        type: `audio/${format}`
      });

      await this.ffmpeg!.deleteFile('input');
      await this.ffmpeg!.deleteFile(`output.${format}`);

      return blob;
    } catch (error) {
      console.error('[FFmpeg] Audio extraction failed:', error);
      throw error;
    }
  }

  /**
   * Get video metadata
   */
  async getMetadata(videoFile: File): Promise<{
    duration: number;
    width: number;
    height: number;
    fps: number;
    codec: string;
  }> {
    await this.load();

    try {
      await this.ffmpeg!.writeFile('input', await fetchFile(videoFile));

      // Use ffprobe-like command to get metadata
      await this.ffmpeg!.exec([
        '-i', 'input',
        '-f', 'null',
        '-'
      ]);

      // Note: ffmpeg.wasm doesn't have ffprobe, so we extract from logs
      // For now, return basic video element metadata
      const video = document.createElement('video');
      const url = URL.createObjectURL(videoFile);

      return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            fps: 30, // Default, can't easily extract from video element
            codec: 'unknown'
          });
        };
        video.onerror = reject;
        video.src = url;
      });
    } catch (error) {
      console.error('[FFmpeg] Metadata extraction failed:', error);
      throw error;
    }
  }

  /**
   * Trim video
   */
  async trimVideo(
    videoFile: File,
    startTime: number,
    endTime: number
  ): Promise<Blob> {
    await this.load();

    try {
      await this.ffmpeg!.writeFile('input', await fetchFile(videoFile));

      await this.ffmpeg!.exec([
        '-i', 'input',
        '-ss', startTime.toString(),
        '-to', endTime.toString(),
        '-c', 'copy', // Copy without re-encoding for speed
        'output.mp4'
      ]);

      const data = await this.ffmpeg!.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });

      await this.ffmpeg!.deleteFile('input');
      await this.ffmpeg!.deleteFile('output.mp4');

      return blob;
    } catch (error) {
      console.error('[FFmpeg] Video trimming failed:', error);
      throw error;
    }
  }

  /**
   * Create thumbnail from video
   */
  async createThumbnail(
    videoFile: File,
    timeInSeconds: number = 0
  ): Promise<Blob> {
    await this.load();

    try {
      await this.ffmpeg!.writeFile('input', await fetchFile(videoFile));

      await this.ffmpeg!.exec([
        '-i', 'input',
        '-ss', timeInSeconds.toString(),
        '-vframes', '1',
        '-q:v', '2',
        'thumbnail.jpg'
      ]);

      const data = await this.ffmpeg!.readFile('thumbnail.jpg');
      const blob = new Blob([data], { type: 'image/jpeg' });

      await this.ffmpeg!.deleteFile('input');
      await this.ffmpeg!.deleteFile('thumbnail.jpg');

      return blob;
    } catch (error) {
      console.error('[FFmpeg] Thumbnail creation failed:', error);
      throw error;
    }
  }

  /**
   * Concatenate multiple videos
   */
  async concatenateVideos(videoFiles: File[]): Promise<Blob> {
    await this.load();

    try {
      // Write all input files
      const fileList: string[] = [];
      for (let i = 0; i < videoFiles.length; i++) {
        const filename = `input${i}.mp4`;
        await this.ffmpeg!.writeFile(filename, await fetchFile(videoFiles[i]));
        fileList.push(`file '${filename}'`);
      }

      // Create concat list file
      const listContent = fileList.join('\n');
      await this.ffmpeg!.writeFile('list.txt', new TextEncoder().encode(listContent));

      // Concatenate
      await this.ffmpeg!.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'list.txt',
        '-c', 'copy',
        'output.mp4'
      ]);

      const data = await this.ffmpeg!.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });

      // Clean up
      for (let i = 0; i < videoFiles.length; i++) {
        await this.ffmpeg!.deleteFile(`input${i}.mp4`);
      }
      await this.ffmpeg!.deleteFile('list.txt');
      await this.ffmpeg!.deleteFile('output.mp4');

      return blob;
    } catch (error) {
      console.error('[FFmpeg] Video concatenation failed:', error);
      throw error;
    }
  }

  /**
   * Check if FFmpeg is loaded
   */
  isReady(): boolean {
    return this.isLoaded;
  }
}

// Export singleton instance
export const ffmpegService = new FFmpegService();
export default ffmpegService;
