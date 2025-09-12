/**
 * Camera Monitoring Dashboard
 * Central control system for multi-camera monitoring
 */

import { EventEmitter } from 'events';
import { 
  CameraDevice,
  CameraStatus,
  CameraGrid,
  GridLayout,
  GridCamera,
  StreamConfig,
  RecordingConfig,
  CameraAlert,
  CameraEvent,
  StreamQuality,
  StorageConfig
} from './types';
import { CameraDiscovery } from './discovery/CameraDiscovery';
import { MultiStreamRecorder } from './recording/MultiStreamRecorder';
import { StreamManager } from './recording/StreamManager';
import { logger } from '../../utils/logger';

export class CameraMonitoringDashboard extends EventEmitter {
  private discovery: CameraDiscovery;
  private recorder: MultiStreamRecorder;
  private streamManager: StreamManager;
  private cameras: Map<string, CameraDevice> = new Map();
  private grid: CameraGrid;
  private alerts: CameraAlert[] = [];
  private eventHistory: CameraEvent[] = [];
  private maxEventHistory = 1000;

  constructor(storageConfig: StorageConfig) {
    super();
    
    this.discovery = new CameraDiscovery();
    this.recorder = new MultiStreamRecorder(storageConfig);
    this.streamManager = new StreamManager();
    
    this.grid = {
      layout: { type: '2x2', rows: 2, columns: 2 },
      cameras: []
    };

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Discovery events
    this.discovery.on('camera-added', (camera) => {
      this.onCameraAdded(camera);
    });

    this.discovery.on('camera-removed', (camera) => {
      this.onCameraRemoved(camera);
    });

    this.discovery.on('camera-status-changed', (event) => {
      this.onCameraStatusChanged(event);
    });

    // Recorder events
    this.recorder.on('recording-started', (session) => {
      this.addEvent({
        type: 'recording_start',
        cameraId: session.cameraId,
        timestamp: new Date(),
        data: session
      });
    });

    this.recorder.on('recording-stopped', (session) => {
      this.addEvent({
        type: 'recording_stop',
        cameraId: session.cameraId,
        timestamp: new Date(),
        data: session
      });
    });

    this.recorder.on('recording-error', (error) => {
      this.addAlert({
        id: `alert_${Date.now()}`,
        cameraId: error.session.cameraId,
        type: 'storage',
        severity: 'error',
        message: `Recording error: ${error.error.message}`,
        timestamp: new Date(),
        resolved: false
      });
    });

    // Stream events
    this.streamManager.on('stream-error', (error) => {
      this.addAlert({
        id: `alert_${Date.now()}`,
        cameraId: error.cameraId,
        type: 'connection',
        severity: 'warning',
        message: `Stream error: ${error.error.message}`,
        timestamp: new Date(),
        resolved: false
      });
    });
  }

  /**
   * Initialize dashboard
   */
  async initialize(): Promise<void> {
    logger.info('Initializing camera monitoring dashboard');

    // Start camera discovery
    await this.discovery.startDiscovery({
      continuous: true,
      interval: 30000,
      network: {
        scanIPRange: '192.168.1.0/24',
        scanPorts: [554, 8554, 80, 8080],
        protocols: ['rtsp', 'onvif', 'http']
      }
    });

    // Initialize grid with discovered cameras
    const cameras = this.discovery.getCameras();
    for (const camera of cameras) {
      this.cameras.set(camera.id, camera);
    }

    this.updateGrid();
    
    this.emit('initialized', { cameras: cameras.length });
    logger.info(`Dashboard initialized with ${cameras.length} cameras`);
  }

  /**
   * Handle camera added
   */
  private onCameraAdded(camera: CameraDevice): void {
    this.cameras.set(camera.id, camera);
    
    this.addEvent({
      type: 'connected',
      cameraId: camera.id,
      timestamp: new Date(),
      data: camera
    });

    // Auto-add to grid if space available
    if (this.grid.cameras.length < this.grid.layout.rows * this.grid.layout.columns) {
      this.addCameraToGrid(camera.id);
    }

    this.emit('camera-added', camera);
  }

  /**
   * Handle camera removed
   */
  private onCameraRemoved(camera: CameraDevice): void {
    this.cameras.delete(camera.id);
    
    // Stop any active streams/recordings
    this.streamManager.stopStream(camera.id);
    this.recorder.stopRecording(camera.id).catch(() => {});

    // Remove from grid
    this.removeCameraFromGrid(camera.id);

    this.addEvent({
      type: 'disconnected',
      cameraId: camera.id,
      timestamp: new Date()
    });

    this.emit('camera-removed', camera);
  }

  /**
   * Handle camera status change
   */
  private onCameraStatusChanged(event: { cameraId: string; status: CameraStatus }): void {
    const camera = this.cameras.get(event.cameraId);
    if (camera) {
      camera.status = event.status;
      this.emit('camera-status-changed', event);
    }
  }

  /**
   * Set grid layout
   */
  setGridLayout(layout: GridLayout): void {
    this.grid.layout = layout;
    this.updateGrid();
    this.emit('grid-layout-changed', layout);
  }

  /**
   * Add camera to grid
   */
  addCameraToGrid(cameraId: string, position?: { row: number; column: number }): void {
    const camera = this.cameras.get(cameraId);
    if (!camera) return;

    // Find available position if not specified
    if (!position) {
      position = this.findAvailableGridPosition();
      if (!position) {
        logger.warn('No available grid position');
        return;
      }
    }

    // Remove if already in grid
    this.removeCameraFromGrid(cameraId);

    const gridCamera: GridCamera = {
      cameraId,
      position,
      streamConfig: {
        cameraId,
        quality: StreamQuality.MEDIUM,
        resolution: camera.capabilities.resolutions[0],
        frameRate: 30
      }
    };

    this.grid.cameras.push(gridCamera);
    
    // Start stream for grid display
    this.startCameraStream(cameraId, gridCamera.streamConfig);

    this.emit('grid-camera-added', gridCamera);
  }

  /**
   * Remove camera from grid
   */
  removeCameraFromGrid(cameraId: string): void {
    const index = this.grid.cameras.findIndex(c => c.cameraId === cameraId);
    if (index !== -1) {
      const gridCamera = this.grid.cameras.splice(index, 1)[0];
      
      // Stop stream if no recording
      const recording = this.recorder.getRecording(cameraId);
      if (!recording) {
        this.streamManager.stopStream(cameraId);
      }

      this.emit('grid-camera-removed', gridCamera);
    }
  }

  /**
   * Find available grid position
   */
  private findAvailableGridPosition(): { row: number; column: number } | null {
    const { rows, columns } = this.grid.layout;
    
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const occupied = this.grid.cameras.some(c => 
          c.position.row === row && c.position.column === column
        );
        
        if (!occupied) {
          return { row, column };
        }
      }
    }
    
    return null;
  }

  /**
   * Update grid
   */
  private updateGrid(): void {
    const { rows, columns } = this.grid.layout;
    const maxCameras = rows * columns;
    
    // Remove excess cameras
    while (this.grid.cameras.length > maxCameras) {
      const removed = this.grid.cameras.pop();
      if (removed) {
        this.streamManager.stopStream(removed.cameraId);
      }
    }

    // Reposition cameras
    for (let i = 0; i < this.grid.cameras.length; i++) {
      const row = Math.floor(i / columns);
      const column = i % columns;
      this.grid.cameras[i].position = { row, column };
    }

    this.emit('grid-updated', this.grid);
  }

  /**
   * Start camera stream
   */
  async startCameraStream(cameraId: string, config: StreamConfig): Promise<void> {
    const camera = this.cameras.get(cameraId);
    if (!camera) return;

    try {
      await this.streamManager.startStream(camera, config);
      camera.status = CameraStatus.STREAMING;
    } catch (error) {
      logger.error(`Failed to start stream for ${cameraId}`, error);
      camera.status = CameraStatus.ERROR;
    }
  }

  /**
   * Stop camera stream
   */
  async stopCameraStream(cameraId: string): Promise<void> {
    await this.streamManager.stopStream(cameraId);
    
    const camera = this.cameras.get(cameraId);
    if (camera) {
      camera.status = CameraStatus.CONNECTED;
    }
  }

  /**
   * Start recording
   */
  async startRecording(cameraId: string, config?: Partial<RecordingConfig>): Promise<void> {
    const camera = this.cameras.get(cameraId);
    if (!camera) return;

    const recordingConfig: RecordingConfig = {
      cameraId,
      outputPath: '',
      format: 'mp4',
      quality: StreamQuality.HIGH,
      enableTimestamp: true,
      ...config
    };

    await this.recorder.startRecording(camera, recordingConfig);
    camera.status = CameraStatus.RECORDING;
  }

  /**
   * Stop recording
   */
  async stopRecording(cameraId: string): Promise<void> {
    await this.recorder.stopRecording(cameraId);
    
    const camera = this.cameras.get(cameraId);
    if (camera) {
      const gridCamera = this.grid.cameras.find(c => c.cameraId === cameraId);
      camera.status = gridCamera ? CameraStatus.STREAMING : CameraStatus.CONNECTED;
    }
  }

  /**
   * Start recording all cameras
   */
  async startRecordingAll(config?: Partial<RecordingConfig>): Promise<void> {
    const promises = Array.from(this.cameras.keys()).map(cameraId => 
      this.startRecording(cameraId, config)
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Stop recording all cameras
   */
  async stopRecordingAll(): Promise<void> {
    await this.recorder.stopAllRecordings();
    
    // Update camera statuses
    for (const camera of this.cameras.values()) {
      const gridCamera = this.grid.cameras.find(c => c.cameraId === camera.id);
      camera.status = gridCamera ? CameraStatus.STREAMING : CameraStatus.CONNECTED;
    }
  }

  /**
   * Set camera quality
   */
  async setCameraQuality(cameraId: string, quality: StreamQuality): Promise<void> {
    const gridCamera = this.grid.cameras.find(c => c.cameraId === cameraId);
    if (!gridCamera) return;

    gridCamera.streamConfig.quality = quality;
    
    // Update stream if active
    if (this.streamManager.isStreamActive(cameraId)) {
      await this.streamManager.updateStreamConfig(cameraId, { quality });
    }
  }

  /**
   * Set fullscreen camera
   */
  setFullscreenCamera(cameraId: string | null): void {
    this.grid.fullscreenCamera = cameraId || undefined;
    this.emit('fullscreen-changed', cameraId);
  }

  /**
   * Take snapshot
   */
  async takeSnapshot(cameraId: string): Promise<Blob | null> {
    const camera = this.cameras.get(cameraId);
    if (!camera) return null;

    // Implementation would capture current frame
    logger.info(`Snapshot taken for camera ${cameraId}`);
    return null;
  }

  /**
   * Add alert
   */
  private addAlert(alert: CameraAlert): void {
    this.alerts.push(alert);
    
    // Limit alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    this.emit('alert', alert);
  }

  /**
   * Add event
   */
  private addEvent(event: CameraEvent): void {
    this.eventHistory.push(event);
    
    // Limit history
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory.shift();
    }

    this.emit('event', event);
  }

  /**
   * Get cameras
   */
  getCameras(): CameraDevice[] {
    return Array.from(this.cameras.values());
  }

  /**
   * Get camera
   */
  getCamera(cameraId: string): CameraDevice | undefined {
    return this.cameras.get(cameraId);
  }

  /**
   * Get grid
   */
  getGrid(): CameraGrid {
    return this.grid;
  }

  /**
   * Get alerts
   */
  getAlerts(unresolved?: boolean): CameraAlert[] {
    if (unresolved) {
      return this.alerts.filter(a => !a.resolved);
    }
    return this.alerts;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alert-resolved', alert);
    }
  }

  /**
   * Get event history
   */
  getEventHistory(cameraId?: string): CameraEvent[] {
    if (cameraId) {
      return this.eventHistory.filter(e => e.cameraId === cameraId);
    }
    return this.eventHistory;
  }

  /**
   * Get dashboard statistics
   */
  getStatistics(): any {
    const recordings = this.recorder.getActiveRecordings();
    const streams = this.streamManager.getActiveStreams();

    return {
      totalCameras: this.cameras.size,
      connectedCameras: Array.from(this.cameras.values()).filter(
        c => c.status !== CameraStatus.DISCONNECTED
      ).length,
      activeStreams: streams.length,
      activeRecordings: recordings.length,
      alerts: this.alerts.filter(a => !a.resolved).length,
      gridCameras: this.grid.cameras.length
    };
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    await this.recorder.dispose();
    await this.streamManager.dispose();
    this.discovery.dispose();
    
    this.cameras.clear();
    this.alerts = [];
    this.eventHistory = [];
    
    this.removeAllListeners();
  }
}