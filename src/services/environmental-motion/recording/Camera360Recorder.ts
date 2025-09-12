import { EventEmitter } from 'events';
import {
  RecordingMode,
  RecordingConfiguration,
  Camera360Config,
  MotionEvent,
  EMFReading,
  AudioReading
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('Camera360Recorder');

export class Camera360Recorder extends EventEmitter {
  private config: Camera360Config;
  private recordingConfig: RecordingConfiguration | null = null;
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private cameras: CameraStream[] = [];
  private stitchingWorker: Worker | null = null;
  private currentFrame: HTMLCanvasElement | null = null;
  private frameCount = 0;
  private recordingStartTime = 0;
  private outputStream: MediaStream | null = null;

  constructor(config: Camera360Config) {
    super();
    this.config = { ...config };
    this.initializeRecorder();
  }

  private async initializeRecorder(): Promise<void> {
    try {
      logger.info(`Initializing 360° camera recorder: ${this.config.type}`);
      
      // Initialize based on camera type
      await this.initializeCameraType();
      
      // Initialize stitching worker for multi-camera setups
      if (this.needsStitching()) {
        await this.initializeStitchingWorker();
      }
      
      // Setup frame processing canvas
      this.currentFrame = document.createElement('canvas');
      
      this.emit('recorder-initialized');
      logger.info('360° camera recorder initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize 360° camera recorder:', error);
      this.emit('error', { error, context: 'recorder initialization' });
      throw error;
    }
  }

  private async initializeCameraType(): Promise<void> {
    switch (this.config.type) {
      case 'fisheye':
        await this.initializeFisheyeCamera();
        break;
      case 'dual_fisheye':
        await this.initializeDualFisheyeCamera();
        break;
      case 'multi_camera':
        await this.initializeMultiCameraArray();
        break;
      case 'rotating_camera':
        await this.initializeRotatingCamera();
        break;
      default:
        throw new Error(`Unsupported 360° camera type: ${this.config.type}`);
    }
  }

  private async initializeFisheyeCamera(): Promise<void> {
    logger.debug('Initializing single fisheye camera');
    
    try {
      // Request single wide-angle camera
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 2048 },
          height: { ideal: 2048 },
          frameRate: { ideal: 30 },
          facingMode: 'environment'
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const cameraStream: CameraStream = {
        id: 'fisheye_main',
        stream,
        position: { azimuth: 0, elevation: 0 },
        fov: this.config.calibration.fov,
        calibration: this.config.calibration
      };

      this.cameras.push(cameraStream);
      this.emit('camera-connected', cameraStream);
    } catch (error) {
      logger.error('Failed to initialize fisheye camera:', error);
      throw error;
    }
  }

  private async initializeDualFisheyeCamera(): Promise<void> {
    logger.debug('Initializing dual fisheye camera system');
    
    try {
      // Get available video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length < 2) {
        throw new Error('Dual fisheye setup requires at least 2 cameras');
      }

      // Initialize front and back fisheye cameras
      for (let i = 0; i < Math.min(2, videoDevices.length); i++) {
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: videoDevices[i].deviceId,
            width: { ideal: 1920 },
            height: { ideal: 1920 },
            frameRate: { ideal: 30 }
          },
          audio: i === 0 // Only capture audio from first camera
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const cameraStream: CameraStream = {
          id: `fisheye_${i === 0 ? 'front' : 'back'}`,
          stream,
          position: { 
            azimuth: i === 0 ? 0 : 180, 
            elevation: 0 
          },
          fov: 180,
          calibration: this.config.calibration
        };

        this.cameras.push(cameraStream);
        this.emit('camera-connected', cameraStream);
      }
    } catch (error) {
      logger.error('Failed to initialize dual fisheye cameras:', error);
      throw error;
    }
  }

  private async initializeMultiCameraArray(): Promise<void> {
    logger.debug('Initializing multi-camera array');
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Calculate camera positions for 360° coverage
      const cameraPositions = this.calculateCameraPositions(videoDevices.length);
      
      for (let i = 0; i < Math.min(8, videoDevices.length); i++) {
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: videoDevices[i].deviceId,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: i === 0 // Only capture audio from first camera
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const cameraStream: CameraStream = {
          id: `camera_${i}`,
          stream,
          position: cameraPositions[i],
          fov: 90, // Assume 90° FOV per camera
          calibration: this.config.calibration
        };

        this.cameras.push(cameraStream);
        this.emit('camera-connected', cameraStream);
      }
    } catch (error) {
      logger.error('Failed to initialize multi-camera array:', error);
      throw error;
    }
  }

  private async initializeRotatingCamera(): Promise<void> {
    logger.debug('Initializing rotating camera system');
    
    try {
      // Single camera with rotation mechanism
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 } // Higher frame rate for rotation
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const cameraStream: CameraStream = {
        id: 'rotating_main',
        stream,
        position: { azimuth: 0, elevation: 0 },
        fov: 90,
        calibration: this.config.calibration,
        isRotating: true,
        rotationSpeed: 30 // 30 degrees per second
      };

      this.cameras.push(cameraStream);
      this.emit('camera-connected', cameraStream);
      
      // Start rotation sequence
      this.startRotationSequence(cameraStream);
    } catch (error) {
      logger.error('Failed to initialize rotating camera:', error);
      throw error;
    }
  }

  private calculateCameraPositions(cameraCount: number): CameraPosition[] {
    const positions: CameraPosition[] = [];
    const azimuthStep = 360 / Math.max(1, cameraCount - 1); // Reserve one camera for top-down if available
    
    for (let i = 0; i < cameraCount - 1; i++) {
      positions.push({
        azimuth: i * azimuthStep,
        elevation: 0
      });
    }
    
    // Add top-down camera if we have enough cameras
    if (cameraCount > 4) {
      positions.push({
        azimuth: 0,
        elevation: 90
      });
    }
    
    return positions;
  }

  private startRotationSequence(camera: CameraStream): void {
    if (!camera.isRotating || !camera.rotationSpeed) return;
    
    let currentAngle = 0;
    const rotationInterval = setInterval(() => {
      if (!this.isRecording || !camera.isRotating) {
        clearInterval(rotationInterval);
        return;
      }
      
      currentAngle += camera.rotationSpeed! / 10; // Update every 100ms
      if (currentAngle >= 360) {
        currentAngle = 0;
      }
      
      camera.position.azimuth = currentAngle;
      this.emit('camera-rotated', { camera, angle: currentAngle });
    }, 100);
  }

  private needsStitching(): boolean {
    return this.config.type === 'dual_fisheye' || 
           this.config.type === 'multi_camera' ||
           (this.config.type === 'rotating_camera' && this.config.stitching.blending);
  }

  private async initializeStitchingWorker(): Promise<void> {
    try {
      // Create web worker for video stitching
      const workerCode = this.generateStitchingWorkerCode();
      const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
      const workerURL = URL.createObjectURL(workerBlob);
      
      this.stitchingWorker = new Worker(workerURL);
      
      this.stitchingWorker.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'stitched_frame':
            this.handleStitchedFrame(data);
            break;
          case 'stitching_error':
            this.emit('stitching-error', data);
            break;
        }
      };
      
      // Send configuration to worker
      this.stitchingWorker.postMessage({
        type: 'configure',
        config: this.config
      });
      
      URL.revokeObjectURL(workerURL);
      logger.debug('Stitching worker initialized');
    } catch (error) {
      logger.error('Failed to initialize stitching worker:', error);
      throw error;
    }
  }

  private generateStitchingWorkerCode(): string {
    return `
      let config = null;
      
      self.onmessage = function(e) {
        const { type, data } = e.data;
        
        switch (type) {
          case 'configure':
            config = data.config;
            break;
          case 'stitch_frames':
            try {
              const stitchedFrame = stitchFrames(data.frames, config);
              self.postMessage({
                type: 'stitched_frame',
                data: stitchedFrame
              });
            } catch (error) {
              self.postMessage({
                type: 'stitching_error',
                data: error.message
              });
            }
            break;
        }
      };
      
      function stitchFrames(frames, config) {
        // Simplified stitching algorithm
        // In production, this would use advanced computer vision techniques
        
        if (!frames || frames.length === 0) return null;
        
        // For now, return the first frame
        // Real implementation would:
        // 1. Detect feature points in overlapping regions
        // 2. Calculate homography matrices
        // 3. Warp and blend images
        // 4. Apply seam blending and exposure compensation
        
        return frames[0];
      }
    `;
  }

  private handleStitchedFrame(frameData: any): void {
    if (!this.currentFrame) return;
    
    // Update current frame canvas with stitched result
    const ctx = this.currentFrame.getContext('2d');
    if (ctx && frameData) {
      // Draw stitched frame to canvas
      // This would be implemented with actual frame data
      this.frameCount++;
      this.emit('frame-processed', { frameNumber: this.frameCount });
    }
  }

  async startRecording(config: RecordingConfiguration): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    if (this.cameras.length === 0) {
      throw new Error('No cameras initialized');
    }

    try {
      this.recordingConfig = { ...config };
      this.recordedChunks = [];
      this.frameCount = 0;
      this.recordingStartTime = Date.now();
      
      // Setup output stream
      await this.setupOutputStream();
      
      // Initialize MediaRecorder
      await this.initializeMediaRecorder();
      
      // Start recording
      this.mediaRecorder!.start(1000); // 1 second chunks
      this.isRecording = true;
      
      // Start frame processing
      this.startFrameProcessing();
      
      this.emit('recording-started', {
        config: this.recordingConfig,
        timestamp: this.recordingStartTime
      });
      
      logger.info(`Started 360° recording in ${config.mode} mode`);
    } catch (error) {
      logger.error('Failed to start 360° recording:', error);
      this.emit('error', { error, context: 'recording start' });
      throw error;
    }
  }

  private async setupOutputStream(): Promise<void> {
    if (!this.recordingConfig) throw new Error('Recording config not set');
    
    const canvas = this.currentFrame!;
    canvas.width = this.recordingConfig.resolution.width;
    canvas.height = this.recordingConfig.resolution.height;
    
    // Create output stream from canvas
    this.outputStream = canvas.captureStream(this.recordingConfig.frameRate);
    
    // Add audio track if enabled
    if (this.recordingConfig.audioEnabled && this.cameras.length > 0) {
      const audioTracks = this.cameras[0].stream.getAudioTracks();
      if (audioTracks.length > 0) {
        this.outputStream.addTrack(audioTracks[0]);
      }
    }
  }

  private async initializeMediaRecorder(): Promise<void> {
    if (!this.outputStream || !this.recordingConfig) {
      throw new Error('Output stream or config not ready');
    }

    const mimeType = this.getMimeType(this.recordingConfig.format);
    
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      throw new Error(`Format ${this.recordingConfig.format} not supported`);
    }

    this.mediaRecorder = new MediaRecorder(this.outputStream, {
      mimeType,
      videoBitsPerSecond: this.getBitrate(this.recordingConfig.quality)
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
        this.emit('chunk-recorded', { size: event.data.size });
      }
    };

    this.mediaRecorder.onstop = () => {
      this.finalizeRecording();
    };

    this.mediaRecorder.onerror = (error) => {
      this.emit('recording-error', error);
    };
  }

  private getMimeType(format: RecordingConfiguration['format']): string {
    const mimeTypes = {
      mp4: 'video/mp4',
      avi: 'video/mp4', // Fallback to mp4
      mkv: 'video/webm', // Closest available
      webm: 'video/webm'
    };
    
    return mimeTypes[format] || 'video/mp4';
  }

  private getBitrate(quality: RecordingConfiguration['quality']): number {
    const bitrates = {
      low: 2500000,    // 2.5 Mbps
      medium: 5000000, // 5 Mbps  
      high: 10000000,  // 10 Mbps
      ultra: 20000000  // 20 Mbps
    };
    
    return bitrates[quality] || bitrates.medium;
  }

  private startFrameProcessing(): void {
    if (!this.isRecording) return;

    const processFrame = () => {
      if (!this.isRecording || !this.currentFrame) return;

      try {
        // Capture frames from all cameras
        const cameraFrames = this.captureCameraFrames();
        
        if (cameraFrames.length > 0) {
          // Process based on recording mode
          this.processFrames(cameraFrames);
        }
        
        // Schedule next frame
        requestAnimationFrame(processFrame);
      } catch (error) {
        logger.error('Frame processing error:', error);
        this.emit('frame-error', error);
      }
    };

    requestAnimationFrame(processFrame);
  }

  private captureCameraFrames(): CameraFrame[] {
    const frames: CameraFrame[] = [];
    
    for (const camera of this.cameras) {
      try {
        // Create video element to capture frame
        const video = document.createElement('video');
        video.srcObject = camera.stream;
        video.play();
        
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
          // Create canvas to capture frame
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            
            frames.push({
              id: camera.id,
              imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
              timestamp: Date.now(),
              position: camera.position,
              calibration: camera.calibration
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to capture frame from camera ${camera.id}:`, error);
      }
    }
    
    return frames;
  }

  private processFrames(frames: CameraFrame[]): void {
    if (!this.recordingConfig || !this.currentFrame) return;

    const ctx = this.currentFrame.getContext('2d');
    if (!ctx) return;

    switch (this.recordingConfig.mode) {
      case RecordingMode.STANDARD:
        this.processStandardMode(ctx, frames);
        break;
      case RecordingMode.PANORAMIC_180:
        this.processPanoramic180Mode(ctx, frames);
        break;
      case RecordingMode.PANORAMIC_360:
        this.processPanoramic360Mode(ctx, frames);
        break;
      case RecordingMode.STEREO:
        this.processStereoMode(ctx, frames);
        break;
      case RecordingMode.MULTI_ANGLE:
        this.processMultiAngleMode(ctx, frames);
        break;
      case RecordingMode.TRACKING:
        this.processTrackingMode(ctx, frames);
        break;
    }
  }

  private processStandardMode(ctx: CanvasRenderingContext2D, frames: CameraFrame[]): void {
    // Simple single camera view
    if (frames.length > 0) {
      const frame = frames[0];
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.putImageData(frame.imageData, 0, 0);
    }
  }

  private processPanoramic180Mode(ctx: CanvasRenderingContext2D, frames: CameraFrame[]): void {
    // Create 180° panoramic view
    if (frames.length === 0) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    if (frames.length === 1 && this.config.type === 'fisheye') {
      // Unwrap fisheye to 180° panorama
      this.unwrapFisheye(ctx, frames[0], 180);
    } else {
      // Stitch multiple camera frames
      this.stitchFrames(ctx, frames, 180);
    }
  }

  private processPanoramic360Mode(ctx: CanvasRenderingContext2D, frames: CameraFrame[]): void {
    // Create full 360° panoramic view
    if (frames.length === 0) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    if (frames.length === 1 && this.config.type === 'fisheye') {
      // Unwrap fisheye to 360° panorama
      this.unwrapFisheye(ctx, frames[0], 360);
    } else if (frames.length === 2 && this.config.type === 'dual_fisheye') {
      // Combine two fisheye cameras
      this.combineDualFisheye(ctx, frames);
    } else {
      // Stitch multiple camera frames
      this.stitchFrames(ctx, frames, 360);
    }
  }

  private processStereoMode(ctx: CanvasRenderingContext2D, frames: CameraFrame[]): void {
    // Side-by-side stereo view
    if (frames.length >= 2) {
      const leftFrame = frames[0];
      const rightFrame = frames[1];
      
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Left eye
      ctx.putImageData(leftFrame.imageData, 0, 0, 0, 0, ctx.canvas.width / 2, ctx.canvas.height);
      
      // Right eye
      ctx.putImageData(rightFrame.imageData, ctx.canvas.width / 2, 0, 0, 0, ctx.canvas.width / 2, ctx.canvas.height);
    }
  }

  private processMultiAngleMode(ctx: CanvasRenderingContext2D, frames: CameraFrame[]): void {
    // Grid view of multiple cameras
    if (frames.length === 0) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    const cols = Math.ceil(Math.sqrt(frames.length));
    const rows = Math.ceil(frames.length / cols);
    const cellWidth = ctx.canvas.width / cols;
    const cellHeight = ctx.canvas.height / rows;
    
    frames.forEach((frame, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * cellWidth;
      const y = row * cellHeight;
      
      // Scale and draw frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = frame.imageData.width;
      tempCanvas.height = frame.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(frame.imageData, 0, 0);
      
      ctx.drawImage(tempCanvas, x, y, cellWidth, cellHeight);
    });
  }

  private processTrackingMode(ctx: CanvasRenderingContext2D, frames: CameraFrame[]): void {
    // Focus on motion tracking
    // For now, use standard mode
    this.processStandardMode(ctx, frames);
  }

  private unwrapFisheye(ctx: CanvasRenderingContext2D, frame: CameraFrame, angleRange: number): void {
    // Simplified fisheye unwrapping
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = frame.imageData.width;
    sourceCanvas.height = frame.imageData.height;
    const sourceCtx = sourceCanvas.getContext('2d')!;
    sourceCtx.putImageData(frame.imageData, 0, 0);
    
    const outputWidth = ctx.canvas.width;
    const outputHeight = ctx.canvas.height;
    const centerX = frame.imageData.width / 2;
    const centerY = frame.imageData.height / 2;
    const radius = Math.min(centerX, centerY);
    
    const imageData = ctx.createImageData(outputWidth, outputHeight);
    const data = imageData.data;
    const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
    
    for (let y = 0; y < outputHeight; y++) {
      for (let x = 0; x < outputWidth; x++) {
        // Convert panoramic coordinates to fisheye coordinates
        const theta = (x / outputWidth) * (angleRange * Math.PI / 180);
        const phi = ((y / outputHeight) - 0.5) * Math.PI / 2;
        
        const fisheyeX = centerX + radius * Math.cos(phi) * Math.cos(theta);
        const fisheyeY = centerY + radius * Math.cos(phi) * Math.sin(theta);
        
        if (fisheyeX >= 0 && fisheyeX < frame.imageData.width &&
            fisheyeY >= 0 && fisheyeY < frame.imageData.height) {
          
          const sourceIndex = (Math.floor(fisheyeY) * frame.imageData.width + Math.floor(fisheyeX)) * 4;
          const targetIndex = (y * outputWidth + x) * 4;
          
          data[targetIndex] = sourceData[sourceIndex];         // R
          data[targetIndex + 1] = sourceData[sourceIndex + 1]; // G
          data[targetIndex + 2] = sourceData[sourceIndex + 2]; // B
          data[targetIndex + 3] = sourceData[sourceIndex + 3]; // A
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  private combineDualFisheye(ctx: CanvasRenderingContext2D, frames: CameraFrame[]): void {
    // Combine two fisheye cameras for full 360°
    const frontFrame = frames[0];
    const backFrame = frames[1];
    
    // Unwrap front fisheye to 0-180°
    const frontCanvas = document.createElement('canvas');
    frontCanvas.width = ctx.canvas.width;
    frontCanvas.height = ctx.canvas.height / 2;
    const frontCtx = frontCanvas.getContext('2d')!;
    this.unwrapFisheye(frontCtx, frontFrame, 180);
    
    // Unwrap back fisheye to 180-360°
    const backCanvas = document.createElement('canvas');
    backCanvas.width = ctx.canvas.width;
    backCanvas.height = ctx.canvas.height / 2;
    const backCtx = backCanvas.getContext('2d')!;
    this.unwrapFisheye(backCtx, backFrame, 180);
    
    // Combine both halves
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(frontCanvas, 0, 0);
    ctx.drawImage(backCanvas, 0, ctx.canvas.height / 2);
  }

  private stitchFrames(ctx: CanvasRenderingContext2D, frames: CameraFrame[], angleRange: number): void {
    // Send frames to stitching worker if available
    if (this.stitchingWorker && frames.length > 1) {
      this.stitchingWorker.postMessage({
        type: 'stitch_frames',
        data: { frames, angleRange }
      });
    } else if (frames.length > 0) {
      // Fallback: use first frame
      this.processStandardMode(ctx, frames);
    }
  }

  async stopRecording(): Promise<string> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.isRecording = false;
        this.emit('recording-stopped', {
          frameCount: this.frameCount,
          duration: Date.now() - this.recordingStartTime
        });
      };

      this.mediaRecorder!.onstop = () => {
        try {
          const outputPath = this.finalizeRecording();
          cleanup();
          resolve(outputPath);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  private finalizeRecording(): string {
    if (this.recordedChunks.length === 0) {
      throw new Error('No recorded data available');
    }

    // Create blob from recorded chunks
    const mimeType = this.getMimeType(this.recordingConfig!.format);
    const blob = new Blob(this.recordedChunks, { type: mimeType });
    
    // Create download URL
    const url = URL.createObjectURL(blob);
    
    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = this.recordingConfig!.outputPath || 
      `360_recording_${timestamp}.${this.recordingConfig!.format}`;
    
    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = outputPath;
    a.click();
    
    // Cleanup
    this.recordedChunks = [];
    URL.revokeObjectURL(url);
    
    logger.info(`360° recording saved: ${outputPath}`);
    this.emit('recording-saved', { path: outputPath, size: blob.size });
    
    return outputPath;
  }

  // Methods for adding sensor data overlays
  addMotionEvent(event: MotionEvent): void {
    if (!this.isRecording) return;
    
    this.emit('motion-overlay', {
      event,
      frameNumber: this.frameCount,
      timestamp: Date.now()
    });
  }

  addEMFReading(reading: EMFReading): void {
    if (!this.isRecording) return;
    
    this.emit('emf-overlay', {
      reading,
      frameNumber: this.frameCount,
      timestamp: Date.now()
    });
  }

  addAudioReading(reading: AudioReading): void {
    if (!this.isRecording) return;
    
    this.emit('audio-overlay', {
      reading,
      frameNumber: this.frameCount,
      timestamp: Date.now()
    });
  }

  updateConfig(newConfig: Partial<Camera360Config>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update stitching worker if needed
    if (this.stitchingWorker && (newConfig.stitching || newConfig.calibration)) {
      this.stitchingWorker.postMessage({
        type: 'configure',
        config: this.config
      });
    }
    
    this.emit('config-updated', this.config);
  }

  getConfig(): Camera360Config {
    return { ...this.config };
  }

  getCameras(): CameraStream[] {
    return [...this.cameras];
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  getRecordingStats(): any {
    return {
      isRecording: this.isRecording,
      frameCount: this.frameCount,
      duration: this.isRecording ? Date.now() - this.recordingStartTime : 0,
      cameraCount: this.cameras.length,
      recordedChunks: this.recordedChunks.length
    };
  }

  destroy(): void {
    if (this.isRecording) {
      try {
        this.stopRecording();
      } catch (error) {
        logger.warn('Error stopping recording during destroy:', error);
      }
    }

    // Stop all camera streams
    this.cameras.forEach(camera => {
      camera.stream.getTracks().forEach(track => track.stop());
    });

    // Terminate stitching worker
    if (this.stitchingWorker) {
      this.stitchingWorker.terminate();
    }

    this.cameras = [];
    this.recordedChunks = [];
    this.removeAllListeners();
  }
}

interface CameraStream {
  id: string;
  stream: MediaStream;
  position: CameraPosition;
  fov: number;
  calibration: Camera360Config['calibration'];
  isRotating?: boolean;
  rotationSpeed?: number;
}

interface CameraPosition {
  azimuth: number;  // 0-360 degrees
  elevation: number; // -90 to +90 degrees
}

interface CameraFrame {
  id: string;
  imageData: ImageData;
  timestamp: number;
  position: CameraPosition;
  calibration: Camera360Config['calibration'];
}