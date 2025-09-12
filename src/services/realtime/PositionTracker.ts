import { EventEmitter } from 'events';
import { InvestigatorPosition, InvestigatorProfile, TrailPoint, getWebSocketService } from './WebSocketService';

export interface PositionOptions {
  enableGPS: boolean;
  enableManualTracking: boolean;
  updateInterval: number; // milliseconds
  accuracy: 'high' | 'medium' | 'low';
  smoothing: boolean;
}

export interface ManualPositionUpdate {
  x: number;
  y: number;
  blueprintId: string;
  timestamp?: Date;
}

export class PositionTracker extends EventEmitter {
  private geolocationWatchId: number | null = null;
  private manualTrackingEnabled = false;
  private updateTimer: NodeJS.Timeout | null = null;
  private lastKnownPosition: InvestigatorPosition | null = null;
  private smoothingBuffer: InvestigatorPosition[] = [];
  private currentInvestigator: InvestigatorProfile | null = null;
  private options: PositionOptions = {
    enableGPS: false,
    enableManualTracking: true,
    updateInterval: 1000,
    accuracy: 'medium',
    smoothing: true
  };

  constructor() {
    super();
    this.bindWebSocketEvents();
  }

  async startTracking(investigator: InvestigatorProfile, options: Partial<PositionOptions> = {}): Promise<void> {
    this.currentInvestigator = investigator;
    this.options = { ...this.options, ...options };

    try {
      // Connect to WebSocket service
      const wsService = getWebSocketService();
      await wsService.connect(investigator);

      // Start GPS tracking if enabled
      if (this.options.enableGPS && navigator.geolocation) {
        await this.startGPSTracking();
      }

      // Start manual tracking if enabled
      if (this.options.enableManualTracking) {
        this.manualTrackingEnabled = true;
      }

      this.emit('tracking_started', investigator);
      console.log('Position tracking started for:', investigator.name);

    } catch (error) {
      console.error('Failed to start position tracking:', error);
      throw error;
    }
  }

  stopTracking(): void {
    // Stop GPS tracking
    if (this.geolocationWatchId !== null) {
      navigator.geolocation.clearWatch(this.geolocationWatchId);
      this.geolocationWatchId = null;
    }

    // Stop manual tracking
    this.manualTrackingEnabled = false;

    // Stop update timer
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // Disconnect WebSocket
    const wsService = getWebSocketService();
    wsService.disconnect();

    this.emit('tracking_stopped');
    console.log('Position tracking stopped');
  }

  updateManualPosition(update: ManualPositionUpdate): void {
    if (!this.manualTrackingEnabled || !this.currentInvestigator) {
      console.warn('Manual tracking not enabled or no investigator set');
      return;
    }

    const position: InvestigatorPosition = {
      investigatorId: this.currentInvestigator.id,
      name: this.currentInvestigator.name,
      x: update.x,
      y: update.y,
      timestamp: update.timestamp || new Date(),
      accuracy: this.getAccuracyValue(),
      blueprintId: update.blueprintId
    };

    this.processPosition(position);
  }

  getCurrentPosition(): InvestigatorPosition | null {
    return this.lastKnownPosition;
  }

  getTrailHistory(investigatorId?: string): TrailPoint[] {
    const wsService = getWebSocketService();
    if (investigatorId) {
      return wsService.getInvestigatorTrail(investigatorId);
    }
    return this.currentInvestigator ? 
      wsService.getInvestigatorTrail(this.currentInvestigator.id) : [];
  }

  getAllTrailsHistory(): Map<string, TrailPoint[]> {
    const wsService = getWebSocketService();
    return wsService.getAllTrails();
  }

  clearTrailHistory(investigatorId?: string): void {
    const wsService = getWebSocketService();
    wsService.clearTrail(investigatorId);
  }

  private async startGPSTracking(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: this.options.accuracy === 'high',
        timeout: 10000,
        maximumAge: 60000
      };

      this.geolocationWatchId = navigator.geolocation.watchPosition(
        (gpsPosition) => {
          if (!this.currentInvestigator) return;

          // Convert GPS coordinates to blueprint coordinates
          // This would require calibration in a real implementation
          const position: InvestigatorPosition = {
            investigatorId: this.currentInvestigator.id,
            name: this.currentInvestigator.name,
            x: this.convertGPSToBlueprint(gpsPosition.coords.longitude),
            y: this.convertGPSToBlueprint(gpsPosition.coords.latitude),
            timestamp: new Date(gpsPosition.timestamp),
            accuracy: gpsPosition.coords.accuracy,
            blueprintId: 'current-blueprint'
          };

          this.processPosition(position);
        },
        (error) => {
          console.error('GPS tracking error:', error);
          this.emit('gps_error', error);
          reject(error);
        },
        options
      );

      resolve();
    });
  }

  private processPosition(position: InvestigatorPosition): void {
    // Apply smoothing if enabled
    if (this.options.smoothing) {
      position = this.applySmoothingFilter(position);
    }

    // Update last known position
    this.lastKnownPosition = position;

    // Send to WebSocket service
    const wsService = getWebSocketService();
    wsService.updatePosition(position);

    // Emit local event
    this.emit('position_updated', position);
  }

  private applySmoothingFilter(position: InvestigatorPosition): InvestigatorPosition {
    this.smoothingBuffer.push(position);

    // Keep only last 3 positions for smoothing
    if (this.smoothingBuffer.length > 3) {
      this.smoothingBuffer.shift();
    }

    // If we have less than 2 positions, return as is
    if (this.smoothingBuffer.length < 2) {
      return position;
    }

    // Calculate smoothed position using weighted average
    const weights = [0.1, 0.3, 0.6]; // More weight to recent positions
    const totalWeight = weights.slice(-this.smoothingBuffer.length).reduce((a, b) => a + b, 0);
    
    let smoothedX = 0;
    let smoothedY = 0;

    this.smoothingBuffer.forEach((pos, index) => {
      const weight = weights[weights.length - this.smoothingBuffer.length + index] / totalWeight;
      smoothedX += pos.x * weight;
      smoothedY += pos.y * weight;
    });

    return {
      ...position,
      x: smoothedX,
      y: smoothedY
    };
  }

  private convertGPSToBlueprint(coordinate: number): number {
    // This is a placeholder conversion function
    // In a real implementation, this would use calibration data
    // to convert GPS coordinates to blueprint pixel coordinates
    return coordinate * 1000000; // Mock conversion
  }

  private getAccuracyValue(): number {
    switch (this.options.accuracy) {
      case 'high': return 1;
      case 'medium': return 3;
      case 'low': return 5;
      default: return 3;
    }
  }

  private bindWebSocketEvents(): void {
    const wsService = getWebSocketService();

    wsService.on('position_update', (position: InvestigatorPosition) => {
      this.emit('remote_position_update', position);
    });

    wsService.on('investigator_joined', (investigator: InvestigatorProfile) => {
      this.emit('investigator_joined', investigator);
    });

    wsService.on('investigator_left', (investigatorId: string) => {
      this.emit('investigator_left', investigatorId);
    });

    wsService.on('trail_update', (investigatorId: string, point: TrailPoint) => {
      this.emit('trail_update', investigatorId, point);
    });

    wsService.on('connected', () => {
      this.emit('websocket_connected');
    });

    wsService.on('disconnected', () => {
      this.emit('websocket_disconnected');
    });

    wsService.on('error', (error: any) => {
      this.emit('websocket_error', error);
    });
  }

  // Utility methods for manual positioning
  enableClickToTrack(canvas: HTMLCanvasElement, blueprintId: string): void {
    if (!this.manualTrackingEnabled) return;

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.updateManualPosition({
        x,
        y,
        blueprintId,
        timestamp: new Date()
      });
    };

    canvas.addEventListener('click', handleClick);

    // Store reference to remove listener later
    (canvas as any)._positionTracker_clickHandler = handleClick;
  }

  disableClickToTrack(canvas: HTMLCanvasElement): void {
    const handler = (canvas as any)._positionTracker_clickHandler;
    if (handler) {
      canvas.removeEventListener('click', handler);
      delete (canvas as any)._positionTracker_clickHandler;
    }
  }

  // Simulation methods for testing
  startSimulation(bounds: { width: number; height: number }): void {
    if (!this.currentInvestigator) return;

    let x = bounds.width / 2;
    let y = bounds.height / 2;
    let vx = (Math.random() - 0.5) * 4;
    let vy = (Math.random() - 0.5) * 4;

    this.updateTimer = setInterval(() => {
      // Simple bouncing ball simulation
      x += vx;
      y += vy;

      // Bounce off edges
      if (x <= 0 || x >= bounds.width) vx = -vx;
      if (y <= 0 || y >= bounds.height) vy = -vy;

      // Add some randomness
      vx += (Math.random() - 0.5) * 0.5;
      vy += (Math.random() - 0.5) * 0.5;

      // Clamp velocity
      vx = Math.max(-5, Math.min(5, vx));
      vy = Math.max(-5, Math.min(5, vy));

      // Clamp position
      x = Math.max(0, Math.min(bounds.width, x));
      y = Math.max(0, Math.min(bounds.height, y));

      this.updateManualPosition({
        x,
        y,
        blueprintId: 'simulation-blueprint'
      });

    }, this.options.updateInterval);
  }

  stopSimulation(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
}

// Singleton instance
let positionTracker: PositionTracker | null = null;

export const getPositionTracker = (): PositionTracker => {
  if (!positionTracker) {
    positionTracker = new PositionTracker();
  }
  return positionTracker;
};