/**
 * useMultiViewSync Hook
 * React hook for integrating with the Multi-View sync service
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { multiViewSyncService } from '@/services/multiview/MultiViewSyncService';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { MultiViewSyncMessage } from '@/types/multiview';

interface UseMultiViewSyncOptions {
  /** Whether to sync playhead position */
  syncPlayhead?: boolean;
  /** Whether to sync play state */
  syncPlayState?: boolean;
  /** Whether to sync playback speed */
  syncSpeed?: boolean;
  /** Throttle interval for playhead updates (ms) */
  throttleInterval?: number;
}

interface UseMultiViewSyncResult {
  /** Whether the sync service is connected */
  isConnected: boolean;
  /** Manually broadcast current playhead */
  broadcastPlayhead: () => void;
  /** Manually broadcast play state */
  broadcastPlayState: () => void;
  /** Manually broadcast speed */
  broadcastSpeed: () => void;
}

export const useMultiViewSync = (
  options: UseMultiViewSyncOptions = {}
): UseMultiViewSyncResult => {
  const {
    syncPlayhead = true,
    syncPlayState = true,
    syncSpeed = true,
    throttleInterval = 50,
  } = options;

  const [isConnected, setIsConnected] = useState(false);

  // Playhead store
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const play = usePlayheadStore((state) => state.play);
  const pause = usePlayheadStore((state) => state.pause);
  const setPlaybackSpeed = usePlayheadStore((state) => state.setPlaybackSpeed);

  // Track last broadcast time for throttling
  const lastBroadcastRef = useRef<number>(0);

  // Track if we're updating from sync (to avoid echo)
  const isExternalUpdateRef = useRef<boolean>(false);

  // Initialize sync service
  useEffect(() => {
    multiViewSyncService.init();
    setIsConnected(multiViewSyncService.getIsConnected());

    return () => {
      // Don't destroy on unmount - other components might be using it
      // The service will be destroyed when the window closes
    };
  }, []);

  // Listen for sync messages
  useEffect(() => {
    const handleMessage = (message: MultiViewSyncMessage) => {
      isExternalUpdateRef.current = true;

      try {
        switch (message.type) {
          case 'playhead_update':
            if (syncPlayhead && message.payload.playheadPosition !== undefined) {
              setTimestamp(message.payload.playheadPosition);
            }
            break;

          case 'play_state_change':
            if (syncPlayState && message.payload.isPlaying !== undefined) {
              if (message.payload.isPlaying) {
                play();
              } else {
                pause();
              }
            }
            break;

          case 'speed_change':
            if (syncSpeed && message.payload.playbackSpeed !== undefined) {
              setPlaybackSpeed(message.payload.playbackSpeed);
            }
            break;
        }
      } finally {
        // Reset after a short delay to allow store updates to propagate
        setTimeout(() => {
          isExternalUpdateRef.current = false;
        }, 16);
      }
    };

    const unsubscribe = multiViewSyncService.onAny(handleMessage);
    return unsubscribe;
  }, [syncPlayhead, syncPlayState, syncSpeed, setTimestamp, play, pause, setPlaybackSpeed]);

  // Broadcast playhead changes (throttled)
  useEffect(() => {
    if (!syncPlayhead || isExternalUpdateRef.current) return;

    const now = Date.now();
    if (now - lastBroadcastRef.current < throttleInterval) return;

    lastBroadcastRef.current = now;
    multiViewSyncService.broadcastPlayhead(timestamp);
  }, [timestamp, syncPlayhead, throttleInterval]);

  // Broadcast play state changes
  useEffect(() => {
    if (!syncPlayState || isExternalUpdateRef.current) return;
    multiViewSyncService.broadcastPlayState(isPlaying);
  }, [isPlaying, syncPlayState]);

  // Broadcast speed changes
  useEffect(() => {
    if (!syncSpeed || isExternalUpdateRef.current) return;
    multiViewSyncService.broadcastSpeed(playbackSpeed);
  }, [playbackSpeed, syncSpeed]);

  // Manual broadcast functions
  const broadcastPlayhead = useCallback(() => {
    multiViewSyncService.broadcastPlayhead(timestamp);
  }, [timestamp]);

  const broadcastPlayState = useCallback(() => {
    multiViewSyncService.broadcastPlayState(isPlaying);
  }, [isPlaying]);

  const broadcastSpeed = useCallback(() => {
    multiViewSyncService.broadcastSpeed(playbackSpeed);
  }, [playbackSpeed]);

  return {
    isConnected,
    broadcastPlayhead,
    broadcastPlayState,
    broadcastSpeed,
  };
};

export default useMultiViewSync;
