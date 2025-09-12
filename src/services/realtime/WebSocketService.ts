import { EventEmitter } from 'events';

export interface InvestigatorPosition {
  investigatorId: string;
  name: string;
  x: number;
  y: number;
  timestamp: Date;
  accuracy?: number;
  floor?: string;
  blueprintId?: string;
}

export interface InvestigatorProfile {
  id: string;
  name: string;
  role: string;
  color: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
}

export interface TrailPoint extends InvestigatorPosition {
  speed?: number;
  direction?: number;
  activity?: 'stationary' | 'walking' | 'running';
}

export interface RealTimeMessage {
  type: 'position_update' | 'investigator_joined' | 'investigator_left' | 'trail_data' | 'status_update';
  data: any;
  timestamp: Date;
  senderId: string;
}

export class WebSocketService extends EventEmitter {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentInvestigator: InvestigatorProfile | null = null;
  private connectedInvestigators = new Map<string, InvestigatorProfile>();
  private positionHistory = new Map<string, TrailPoint[]>();
  
  constructor(private serverUrl: string) {
    super();
    this.setMaxListeners(50);
  }

  connect(investigator: InvestigatorProfile): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.currentInvestigator = investigator;
        this.socket = new WebSocket(this.serverUrl);

        this.socket.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.sendMessage({
            type: 'investigator_joined',
            data: investigator,
            timestamp: new Date(),
            senderId: investigator.id
          });
          this.emit('connected');
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message: RealTimeMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.socket.onclose = () => {
          console.log('WebSocket disconnected');
          this.stopHeartbeat();
          this.emit('disconnected');
          this.attemptReconnect();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.sendMessage({
        type: 'investigator_left',
        data: { investigatorId: this.currentInvestigator?.id },
        timestamp: new Date(),
        senderId: this.currentInvestigator?.id || ''
      });
      this.socket.close();
      this.socket = null;
    }
    this.stopHeartbeat();
    this.connectedInvestigators.clear();
    this.positionHistory.clear();
  }

  updatePosition(position: InvestigatorPosition): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send position update');
      return;
    }

    // Store position in local history
    this.addToTrail(position.investigatorId, {
      ...position,
      activity: this.calculateActivity(position)
    });

    this.sendMessage({
      type: 'position_update',
      data: position,
      timestamp: new Date(),
      senderId: position.investigatorId
    });
  }

  updateStatus(status: Partial<InvestigatorProfile>): void {
    if (!this.currentInvestigator) return;

    const updatedProfile = { ...this.currentInvestigator, ...status };
    this.currentInvestigator = updatedProfile;

    this.sendMessage({
      type: 'status_update',
      data: updatedProfile,
      timestamp: new Date(),
      senderId: updatedProfile.id
    });
  }

  getConnectedInvestigators(): InvestigatorProfile[] {
    return Array.from(this.connectedInvestigators.values());
  }

  getInvestigatorTrail(investigatorId: string, maxPoints = 100): TrailPoint[] {
    const trail = this.positionHistory.get(investigatorId) || [];
    return trail.slice(-maxPoints);
  }

  getAllTrails(maxPoints = 100): Map<string, TrailPoint[]> {
    const trails = new Map<string, TrailPoint[]>();
    for (const [id, trail] of this.positionHistory.entries()) {
      trails.set(id, trail.slice(-maxPoints));
    }
    return trails;
  }

  clearTrail(investigatorId?: string): void {
    if (investigatorId) {
      this.positionHistory.delete(investigatorId);
    } else {
      this.positionHistory.clear();
    }
    this.emit('trail_cleared', investigatorId);
  }

  private sendMessage(message: RealTimeMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: RealTimeMessage): void {
    switch (message.type) {
      case 'position_update':
        const position = message.data as InvestigatorPosition;
        this.addToTrail(position.investigatorId, {
          ...position,
          activity: this.calculateActivity(position)
        });
        this.emit('position_update', position);
        break;

      case 'investigator_joined':
        const joinedInvestigator = message.data as InvestigatorProfile;
        this.connectedInvestigators.set(joinedInvestigator.id, joinedInvestigator);
        this.emit('investigator_joined', joinedInvestigator);
        break;

      case 'investigator_left':
        const { investigatorId } = message.data;
        this.connectedInvestigators.delete(investigatorId);
        this.emit('investigator_left', investigatorId);
        break;

      case 'status_update':
        const updatedInvestigator = message.data as InvestigatorProfile;
        this.connectedInvestigators.set(updatedInvestigator.id, updatedInvestigator);
        this.emit('status_update', updatedInvestigator);
        break;

      case 'trail_data':
        const trailData = message.data;
        this.emit('trail_data', trailData);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private addToTrail(investigatorId: string, point: TrailPoint): void {
    if (!this.positionHistory.has(investigatorId)) {
      this.positionHistory.set(investigatorId, []);
    }

    const trail = this.positionHistory.get(investigatorId)!;
    
    // Calculate speed and direction if we have previous points
    if (trail.length > 0) {
      const lastPoint = trail[trail.length - 1];
      const distance = Math.sqrt(
        Math.pow(point.x - lastPoint.x, 2) + 
        Math.pow(point.y - lastPoint.y, 2)
      );
      const timeDelta = (point.timestamp.getTime() - lastPoint.timestamp.getTime()) / 1000; // seconds
      
      if (timeDelta > 0) {
        point.speed = distance / timeDelta; // pixels per second
        point.direction = Math.atan2(point.y - lastPoint.y, point.x - lastPoint.x);
      }
    }

    trail.push(point);

    // Keep only last 1000 points to prevent memory issues
    if (trail.length > 1000) {
      trail.splice(0, trail.length - 1000);
    }

    this.emit('trail_update', investigatorId, point);
  }

  private calculateActivity(position: InvestigatorPosition): 'stationary' | 'walking' | 'running' {
    const trail = this.positionHistory.get(position.investigatorId);
    if (!trail || trail.length < 2) return 'stationary';

    const recentPoints = trail.slice(-5); // Last 5 points
    const totalDistance = recentPoints.reduce((acc, point, i) => {
      if (i === 0) return 0;
      const prev = recentPoints[i - 1];
      return acc + Math.sqrt(
        Math.pow(point.x - prev.x, 2) + 
        Math.pow(point.y - prev.y, 2)
      );
    }, 0);

    const avgSpeed = totalDistance / recentPoints.length;

    if (avgSpeed < 2) return 'stationary';
    if (avgSpeed < 10) return 'walking';
    return 'running';
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping', timestamp: new Date() }));
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts_reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      if (this.currentInvestigator) {
        this.connect(this.currentInvestigator).catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  // Mock server simulation for development
  static createMockServer(): WebSocketService {
    const mockService = new WebSocketService('ws://localhost:8080');
    
    // Override connect method for mock behavior
    const originalConnect = mockService.connect.bind(mockService);
    mockService.connect = async (investigator: InvestigatorProfile) => {
      console.log('Mock WebSocket server - simulating connection');
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock other investigators
      const mockInvestigators: InvestigatorProfile[] = [
        {
          id: 'investigator-2',
          name: 'Sarah Chen',
          role: 'EMF Specialist',
          color: '#4CAF50',
          deviceType: 'mobile',
          status: 'online',
          lastSeen: new Date()
        },
        {
          id: 'investigator-3',
          name: 'Mike Torres',
          role: 'Audio Technician',
          color: '#FF9800',
          deviceType: 'tablet',
          status: 'online',
          lastSeen: new Date()
        }
      ];

      // Add mock investigators
      mockInvestigators.forEach(inv => {
        mockService.connectedInvestigators.set(inv.id, inv);
      });

      // Simulate random position updates
      const simulateMovement = () => {
        mockInvestigators.forEach(inv => {
          const position: InvestigatorPosition = {
            investigatorId: inv.id,
            name: inv.name,
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100,
            timestamp: new Date(),
            accuracy: Math.random() * 3 + 1,
            blueprintId: 'current-blueprint'
          };
          
          mockService.emit('position_update', position);
          mockService.addToTrail(inv.id, {
            ...position,
            activity: 'walking'
          });
        });
      };

      // Start simulation
      setInterval(simulateMovement, 2000);
      
      mockService.emit('connected');
      return Promise.resolve();
    };

    return mockService;
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const getWebSocketService = (serverUrl = 'ws://localhost:8080'): WebSocketService => {
  if (!webSocketService) {
    // Use mock server in development
    if (process.env.NODE_ENV === 'development') {
      webSocketService = WebSocketService.createMockServer();
    } else {
      webSocketService = new WebSocketService(serverUrl);
    }
  }
  return webSocketService;
};