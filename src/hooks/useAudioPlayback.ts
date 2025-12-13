/**
 * useAudioPlayback Hook
 * Manages Web Audio API playback using AudioBufferSourceNode
 * Syncs with usePlayheadStore for play/pause state and position
 * Supports looping full track or selection regions
 */

import { useRef, useCallback, useEffect } from 'react';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useAudioToolStore } from '@/stores/useAudioToolStore';

interface UseAudioPlaybackOptions {
  /** The AudioContext to use for playback */
  audioContext: AudioContext | null;
  /** The decoded AudioBuffer to play */
  audioBuffer: AudioBuffer | null;
  /** Duration of the audio in seconds (used for bounds checking) */
  duration: number;
}

interface UseAudioPlaybackReturn {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Start playback from current position */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Seek to a specific time in seconds */
  seek: (timeInSeconds: number) => void;
}

/**
 * Hook for managing audio playback with Web Audio API
 * Uses AudioBufferSourceNode for precise playback control
 */
export function useAudioPlayback({
  audioContext,
  audioBuffer,
  duration,
}: UseAudioPlaybackOptions): UseAudioPlaybackReturn {
  // Refs for audio playback management
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0); // AudioContext time when playback started
  const startOffsetRef = useRef<number>(0); // Offset in seconds when playback started
  const animationFrameRef = useRef<number | null>(null);

  // Ref to hold the restart function for looping (avoids circular dependency)
  const restartPlaybackRef = useRef<((offset: number) => void) | null>(null);

  // Playhead store state
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const pause = usePlayheadStore((state) => state.pause);

  // Audio tool store state (looping and selection) - subscribed for reactivity
  // but we also use getState() in callbacks for current values
  useAudioToolStore((state) => state.playback.looping);
  useAudioToolStore((state) => state.waveformSelectionStart);
  useAudioToolStore((state) => state.waveformSelectionEnd);

  /**
   * Stop the current audio source node
   */
  const stopSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // Ignore errors if already stopped
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * Get current loop bounds from store
   */
  const getLoopBounds = useCallback(() => {
    const { playback, waveformSelectionStart: selStart, waveformSelectionEnd: selEnd } = useAudioToolStore.getState();
    const isLooping = playback.looping;
    const hasSelection = selStart !== null && selEnd !== null;

    const loopStart = hasSelection ? Math.min(selStart!, selEnd!) : 0;
    const loopEnd = hasSelection ? Math.max(selStart!, selEnd!) : duration;

    return { isLooping, hasSelection, loopStart, loopEnd };
  }, [duration]);

  /**
   * Start playback from the specified offset
   */
  const startPlayback = useCallback((offsetInSeconds: number) => {
    if (!audioContext || !audioBuffer) return;

    // Resume audio context if suspended (needed due to browser autoplay policies)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Stop any existing playback
    stopSource();

    // Create new source node
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = playbackSpeed;

    // Create gain node if not exists
    if (!gainNodeRef.current) {
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.connect(audioContext.destination);
    }

    // Connect source -> gain -> destination
    sourceNode.connect(gainNodeRef.current);

    // Handle playback end - this fires when the source node stops naturally
    sourceNode.onended = () => {
      // Only trigger if we actually reached the end (not stopped manually)
      if (sourceNodeRef.current === sourceNode) {
        const { isLooping, loopStart, loopEnd } = getLoopBounds();

        const currentOffset = startOffsetRef.current +
          (audioContext.currentTime - startTimeRef.current) * playbackSpeed;

        // If we reached the end of the track (past loop end)
        if (currentOffset >= loopEnd) {
          if (isLooping && restartPlaybackRef.current) {
            // Restart from loop start
            setTimestamp(loopStart * 1000);
            // Use setTimeout to avoid synchronous issues
            setTimeout(() => {
              if (usePlayheadStore.getState().isPlaying && restartPlaybackRef.current) {
                restartPlaybackRef.current(loopStart);
              }
            }, 0);
          } else {
            // Not looping - pause at end
            setTimestamp(loopEnd * 1000);
            pause();
          }
        }
      }
    };

    // Start playback
    const clampedOffset = Math.max(0, Math.min(offsetInSeconds, duration));
    startTimeRef.current = audioContext.currentTime;
    startOffsetRef.current = clampedOffset;

    sourceNode.start(0, clampedOffset);
    sourceNodeRef.current = sourceNode;

    // Start animation loop to update playhead
    const updatePlayhead = () => {
      if (!sourceNodeRef.current || !audioContext) return;

      const elapsed = (audioContext.currentTime - startTimeRef.current) * playbackSpeed;
      const currentPosition = startOffsetRef.current + elapsed;

      // Get current loop bounds from store
      const { isLooping, loopStart, loopEnd } = getLoopBounds();

      // Check if we've reached the loop end point
      if (currentPosition >= loopEnd) {
        if (isLooping && restartPlaybackRef.current) {
          // Loop back to start - stop current and restart
          setTimestamp(loopStart * 1000);
          stopSource();
          restartPlaybackRef.current(loopStart);
          return;
        } else {
          // Not looping - update to end position and stop animation
          setTimestamp(loopEnd * 1000);
          // Don't call pause here - let the source node's onended handle it
          // This prevents race conditions
          return;
        }
      }

      // Update playhead store (convert to milliseconds)
      setTimestamp(currentPosition * 1000);
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    };

    animationFrameRef.current = requestAnimationFrame(updatePlayhead);
  }, [audioContext, audioBuffer, playbackSpeed, duration, stopSource, setTimestamp, pause, getLoopBounds]);

  // Store the startPlayback function in ref for use in callbacks
  useEffect(() => {
    restartPlaybackRef.current = startPlayback;
  }, [startPlayback]);

  /**
   * Handle play state changes from the store
   */
  useEffect(() => {
    if (!audioContext || !audioBuffer) return;

    if (isPlaying) {
      // Start playback from current timestamp
      const offsetInSeconds = timestamp / 1000;
      startPlayback(offsetInSeconds);
    } else {
      // Stop playback
      stopSource();
    }
  }, [isPlaying, audioContext, audioBuffer, startPlayback, stopSource]);

  /**
   * Handle playback speed changes while playing
   */
  useEffect(() => {
    if (sourceNodeRef.current && isPlaying) {
      sourceNodeRef.current.playbackRate.value = playbackSpeed;
    }
  }, [playbackSpeed, isPlaying]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopSource();
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    };
  }, [stopSource]);

  /**
   * Play function - triggers store state change
   */
  const play = useCallback(() => {
    usePlayheadStore.getState().play();
  }, []);

  /**
   * Pause function - triggers store state change
   */
  const pausePlayback = useCallback(() => {
    usePlayheadStore.getState().pause();
  }, []);

  /**
   * Seek function - updates timestamp in store
   */
  const seek = useCallback((timeInSeconds: number) => {
    const clampedTime = Math.max(0, Math.min(timeInSeconds, duration));
    setTimestamp(clampedTime * 1000);

    // If currently playing, restart from new position
    if (isPlaying) {
      startPlayback(clampedTime);
    }
  }, [duration, setTimestamp, isPlaying, startPlayback]);

  return {
    isPlaying,
    play,
    pause: pausePlayback,
    seek,
  };
}

export default useAudioPlayback;
