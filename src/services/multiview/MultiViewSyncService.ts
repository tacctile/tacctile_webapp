/**
 * Multi-View Sync Service
 * Handles real-time synchronization between main window and pop-out multi-view windows
 * Uses BroadcastChannel API for cross-window communication
 */

import {
  MULTIVIEW_CHANNEL_NAME,
  MultiViewSyncMessage,
  MultiViewSyncMessageType,
} from '@/types/multiview';

// Generate unique window ID
const generateWindowId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

type MessageHandler = (message: MultiViewSyncMessage) => void;

class MultiViewSyncService {
  private channel: BroadcastChannel | null = null;
  private windowId: string;
  private isMainWindow: boolean;
  private handlers: Map<MultiViewSyncMessageType, Set<MessageHandler>> = new Map();
  private isConnected: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPong: number = 0;

  constructor() {
    this.windowId = generateWindowId();
    this.isMainWindow = !window.location.pathname.includes('/multiview');
  }

  /**
   * Initialize the sync service
   */
  init(): void {
    if (this.channel) {
      console.warn('[MultiViewSync] Already initialized');
      return;
    }

    try {
      this.channel = new BroadcastChannel(MULTIVIEW_CHANNEL_NAME);
      this.channel.onmessage = this.handleMessage.bind(this);
      this.isConnected = true;

      console.log(`[MultiViewSync] Initialized as ${this.isMainWindow ? 'main' : 'popout'} window (${this.windowId})`);

      // Start ping/pong for connection monitoring
      this.startPingPong();

      // Send initial ping to detect other windows
      this.broadcast('ping', {});
    } catch (error) {
      console.error('[MultiViewSync] Failed to initialize BroadcastChannel:', error);
      this.isConnected = false;
    }
  }

  /**
   * Clean up the sync service
   */
  destroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.handlers.clear();
    this.isConnected = false;

    console.log('[MultiViewSync] Destroyed');
  }

  /**
   * Subscribe to a specific message type
   */
  on(type: MultiViewSyncMessageType, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /**
   * Subscribe to all message types
   */
  onAny(handler: MessageHandler): () => void {
    const unsubscribers: (() => void)[] = [];
    const types: MultiViewSyncMessageType[] = [
      'playhead_update',
      'play_state_change',
      'file_change',
      'flag_added',
      'flag_removed',
      'speed_change',
    ];

    types.forEach(type => {
      unsubscribers.push(this.on(type, handler));
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * Broadcast a message to all windows
   */
  broadcast(
    type: MultiViewSyncMessageType,
    payload: MultiViewSyncMessage['payload']
  ): void {
    if (!this.channel || !this.isConnected) {
      console.warn('[MultiViewSync] Cannot broadcast - not connected');
      return;
    }

    const message: MultiViewSyncMessage = {
      type,
      timestamp: Date.now(),
      source: this.isMainWindow ? 'main' : 'popout',
      windowId: this.windowId,
      payload,
    };

    try {
      this.channel.postMessage(message);
    } catch (error) {
      console.error('[MultiViewSync] Failed to broadcast:', error);
    }
  }

  /**
   * Broadcast playhead position update
   */
  broadcastPlayhead(position: number): void {
    this.broadcast('playhead_update', { playheadPosition: position });
  }

  /**
   * Broadcast play state change
   */
  broadcastPlayState(isPlaying: boolean): void {
    this.broadcast('play_state_change', { isPlaying });
  }

  /**
   * Broadcast playback speed change
   */
  broadcastSpeed(speed: number): void {
    this.broadcast('speed_change', { playbackSpeed: speed });
  }

  /**
   * Broadcast file selection change
   */
  broadcastFileChange(fileId: string, fileType: 'video' | 'audio' | 'image'): void {
    this.broadcast('file_change', {
      selectedFileId: fileId,
      selectedFileType: fileType,
    });
  }

  /**
   * Broadcast flag added
   */
  broadcastFlagAdded(flagId: string, timestamp: number, label?: string): void {
    this.broadcast('flag_added', {
      flagId,
      flagTimestamp: timestamp,
      flagLabel: label,
    });
  }

  /**
   * Broadcast flag removed
   */
  broadcastFlagRemoved(flagId: string): void {
    this.broadcast('flag_removed', { flagId });
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get time since last pong (connection health)
   */
  getTimeSinceLastPong(): number {
    if (this.lastPong === 0) return Infinity;
    return Date.now() - this.lastPong;
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent<MultiViewSyncMessage>): void {
    const message = event.data;

    // Ignore our own messages
    if (message.windowId === this.windowId) {
      return;
    }

    // Handle ping/pong
    if (message.type === 'ping') {
      this.broadcast('pong', {});
      return;
    }

    if (message.type === 'pong') {
      this.lastPong = Date.now();
      return;
    }

    // Notify handlers
    const typeHandlers = this.handlers.get(message.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('[MultiViewSync] Handler error:', error);
        }
      });
    }
  }

  /**
   * Start ping/pong for connection monitoring
   */
  private startPingPong(): void {
    // Ping every 5 seconds
    this.pingInterval = setInterval(() => {
      this.broadcast('ping', {});
    }, 5000);
  }
}

// Singleton instance
export const multiViewSyncService = new MultiViewSyncService();

export default multiViewSyncService;
