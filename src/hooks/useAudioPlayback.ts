/**
 * useAudioPlayback Hook
 * Manages Web Audio API playback with real-time playhead synchronization
 * Uses AudioBufferSourceNode for sample-accurate playback
 */

import { useRef, useEffect, useCallback } from 'react';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useAudioToolStore } from '@/stores/useAudioToolStore';

interface UseAudioPlaybackOptions {
  /** The AudioContext to use for playback */
  audioContext: AudioContext | null;
  /** The decoded AudioBuffer to play */
  audioBuffer: AudioBuffer | null;
  /** Total duration of the audio in seconds */
  duration: number;
}

interface UseAudioPlaybackReturn {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Start or resume playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Stop playback and reset to start */
  stop: () => void;
}

export function useAudioPlayback({
  audioContext,
  audioBuffer,
  duration,
}: UseAudioPlaybackOptions): UseAudioPlaybackReturn {
  // Refs for audio nodes and timing
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0); // AudioContext time when playback started
  const playbackOffsetRef = useRef<number>(0); // Offset in seconds when playback started
  const wasPlayingRef = useRef<boolean>(false); // Track previous playing state

  // Get playhead state and actions from stores
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const pause = usePlayheadStore((state) => state.pause);

  // Get loop and selection state from audio tool store
  const looping = useAudioToolStore((state) => state.playback.looping);
  const waveformSelectionStart = useAudioToolStore((state) => state.waveformSelectionStart);
  const waveformSelectionEnd = useAudioToolStore((state) => state.waveformSelectionEnd);

  // Create gain node for volume control (and future muting)
  const ensureGainNode = useCallback(() => {
    if (!audioContext) return null;
    if (!gainNodeRef.current) {
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.connect(audioContext.destination);
    }
    return gainNodeRef.current;
  }, [audioContext]);

  // Stop any currently playing audio
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore errors if already stopped
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Start playback from a specific offset
  const startPlayback = useCallback((offsetSeconds: number) => {
    if (!audioContext || !audioBuffer) return;

    // Resume context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const gainNode = ensureGainNode();
    if (!gainNode) return;

    // Stop any existing playback
    stopPlayback();

    // Create new source node
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = playbackSpeed;
    sourceNode.connect(gainNode);

    // Store refs for tracking
    sourceNodeRef.current = sourceNode;
    playbackStartTimeRef.current = audioContext.currentTime;
    playbackOffsetRef.current = offsetSeconds;

    // Calculate loop bounds if looping with selection
    let loopStart = 0;
    let loopEnd = duration;
    if (looping && waveformSelectionStart !== null && waveformSelectionEnd !== null) {
      loopStart = Math.min(waveformSelectionStart, waveformSelectionEnd);
      loopEnd = Math.max(waveformSelectionStart, waveformSelectionEnd);
    }

    // Handle end of audio
    sourceNode.onended = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // If looping, restart from loop start
      if (looping && sourceNodeRef.current === sourceNode) {
        const restartOffset = loopStart;
        setTimestamp(restartOffset * 1000);
        // Use setTimeout to avoid recursion issues
        setTimeout(() => {
          // Read isPlaying from store to get current value (avoid stale closure)
          if (usePlayheadStore.getState().isPlaying) {
            startPlayback(restartOffset);
          }
        }, 0);
      } else {
        // Not looping - pause at the end
        pause();
      }
    };

    // Start playback from offset
    sourceNode.start(0, offsetSeconds);

    // Start animation frame loop to update playhead
    const updatePlayhead = () => {
      if (!sourceNodeRef.current || !audioContext) return;

      // Calculate current position
      const elapsed = (audioContext.currentTime - playbackStartTimeRef.current) * playbackSpeed;
      const currentPosition = playbackOffsetRef.current + elapsed;

      // Check if we've reached the end or loop boundary
      if (looping && waveformSelectionStart !== null && waveformSelectionEnd !== null) {
        if (currentPosition >= loopEnd) {
          // Will be handled by onended
          setTimestamp(loopEnd * 1000);
          return;
        }
      } else if (currentPosition >= duration) {
        setTimestamp(duration * 1000);
        return;
      }

      // Update playhead store
      setTimestamp(currentPosition * 1000);

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    };

    animationFrameRef.current = requestAnimationFrame(updatePlayhead);
  }, [audioContext, audioBuffer, duration, playbackSpeed, ensureGainNode, stopPlayback, looping, waveformSelectionStart, waveformSelectionEnd, setTimestamp, pause]);

  // Handle play/pause state changes from the store
  useEffect(() => {
    if (!audioContext || !audioBuffer) return;

    // Only react to actual play/pause transitions
    if (isPlaying && !wasPlayingRef.current) {
      // Start from current timestamp (read from store directly)
      const currentTimestamp = usePlayheadStore.getState().timestamp;
      const currentOffsetSeconds = currentTimestamp / 1000;
      startPlayback(currentOffsetSeconds);
    } else if (!isPlaying && wasPlayingRef.current) {
      stopPlayback();
    }

    wasPlayingRef.current = isPlaying;
  }, [isPlaying, audioContext, audioBuffer, startPlayback, stopPlayback]);

  // Handle playback speed changes during playback
  useEffect(() => {
    if (sourceNodeRef.current && isPlaying) {
      sourceNodeRef.current.playbackRate.value = playbackSpeed;
      // Recalculate timing references for accurate playhead tracking
      if (audioContext) {
        const elapsed = (audioContext.currentTime - playbackStartTimeRef.current) * (sourceNodeRef.current.playbackRate.value / playbackSpeed);
        playbackOffsetRef.current = playbackOffsetRef.current + elapsed;
        playbackStartTimeRef.current = audioContext.currentTime;
      }
    }
  }, [playbackSpeed, isPlaying, audioContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    };
  }, [stopPlayback]);

  // Manual control functions (for external use if needed)
  const play = useCallback(() => {
    usePlayheadStore.getState().play();
  }, []);

  const stop = useCallback(() => {
    stopPlayback();
    setTimestamp(0);
    usePlayheadStore.getState().pause();
  }, [stopPlayback, setTimestamp]);

  return {
    isPlaying,
    play,
    pause,
    stop,
  };
}

export default useAudioPlayback;
