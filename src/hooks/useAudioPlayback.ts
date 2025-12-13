/**
 * useAudioPlayback Hook
 * Manages Web Audio API playback using AudioBufferSourceNode
 * Syncs with usePlayheadStore for play/pause state and position
 * Supports looping full track or selection regions
 * Includes 10-band EQ filtering and spectrum analyzer
 */

import { useRef, useCallback, useEffect } from 'react';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useAudioToolStore } from '@/stores/useAudioToolStore';

// EQ band configuration - matches the UI frequency bands
const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

interface UseAudioPlaybackOptions {
  /** The AudioContext to use for playback */
  audioContext: AudioContext | null;
  /** The decoded AudioBuffer to play */
  audioBuffer: AudioBuffer | null;
  /** Duration of the audio in seconds (used for bounds checking) */
  duration: number;
  /** EQ values for 10 bands (-12 to +12 dB) */
  eqValues?: number[];
  /** Low cut filter frequency in Hz (20 = off, up to 300Hz) */
  lowCutFrequency?: number;
  /** High cut filter frequency in Hz (20000 = off, down to 4000Hz) */
  highCutFrequency?: number;
  /** Callback to receive the AnalyserNode for spectrum visualization */
  onAnalyserReady?: (analyser: AnalyserNode | null) => void;
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
  /** The AnalyserNode for spectrum visualization */
  analyserNode: AnalyserNode | null;
}

/**
 * Hook for managing audio playback with Web Audio API
 * Uses AudioBufferSourceNode for precise playback control
 */
export function useAudioPlayback({
  audioContext,
  audioBuffer,
  duration,
  eqValues = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  lowCutFrequency = 20,
  highCutFrequency = 20000,
  onAnalyserReady,
}: UseAudioPlaybackOptions): UseAudioPlaybackReturn {
  // Refs for audio playback management
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0); // AudioContext time when playback started
  const startOffsetRef = useRef<number>(0); // Offset in seconds when playback started
  const animationFrameRef = useRef<number | null>(null);

  // EQ filter nodes ref - array of 10 BiquadFilterNodes
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);

  // Low cut filter node ref (high-pass filter)
  const lowCutFilterRef = useRef<BiquadFilterNode | null>(null);

  // High cut filter node ref (low-pass filter)
  const highCutFilterRef = useRef<BiquadFilterNode | null>(null);

  // Analyser node for spectrum visualization
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

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
   * Initialize EQ filters, low cut filter, and analyser node when audio context is available
   */
  useEffect(() => {
    if (!audioContext) {
      // Clean up when context is removed
      eqFiltersRef.current = [];
      lowCutFilterRef.current = null;
      highCutFilterRef.current = null;
      analyserNodeRef.current = null;
      onAnalyserReady?.(null);
      return;
    }

    // Create analyser node for spectrum visualization
    if (!analyserNodeRef.current) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85; // Smooth the spectrum visualization
      analyserNodeRef.current = analyser;
      onAnalyserReady?.(analyser);
    }

    // Create low cut filter (high-pass) if not already created
    if (!lowCutFilterRef.current) {
      const lowCutFilter = audioContext.createBiquadFilter();
      lowCutFilter.type = 'highpass';
      lowCutFilter.frequency.value = lowCutFrequency;
      lowCutFilter.Q.value = 0.707; // Butterworth response for clean cutoff
      lowCutFilterRef.current = lowCutFilter;
    }

    // Create high cut filter (low-pass) if not already created
    if (!highCutFilterRef.current) {
      const highCutFilter = audioContext.createBiquadFilter();
      highCutFilter.type = 'lowpass';
      highCutFilter.frequency.value = highCutFrequency;
      highCutFilter.Q.value = 0.707; // Butterworth response for clean cutoff
      highCutFilterRef.current = highCutFilter;
    }

    // Create 10 EQ filter nodes if not already created
    if (eqFiltersRef.current.length === 0) {
      const filters: BiquadFilterNode[] = [];

      EQ_FREQUENCIES.forEach((freq, index) => {
        const filter = audioContext.createBiquadFilter();
        filter.frequency.value = freq;

        // First band (31Hz) = lowshelf, last band (16kHz) = highshelf, middle = peaking
        if (index === 0) {
          filter.type = 'lowshelf';
        } else if (index === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4; // Moderate Q for musical EQ
        }

        filter.gain.value = eqValues[index] || 0;
        filters.push(filter);
      });

      eqFiltersRef.current = filters;
    }

    return () => {
      // Disconnect filters when context changes
      eqFiltersRef.current.forEach(filter => {
        try {
          filter.disconnect();
        } catch {
          // Ignore
        }
      });
      if (lowCutFilterRef.current) {
        try {
          lowCutFilterRef.current.disconnect();
        } catch {
          // Ignore
        }
      }
      if (highCutFilterRef.current) {
        try {
          highCutFilterRef.current.disconnect();
        } catch {
          // Ignore
        }
      }
    };
  }, [audioContext, onAnalyserReady]);

  /**
   * Update EQ filter gains when eqValues change
   */
  useEffect(() => {
    if (eqFiltersRef.current.length === 0) return;

    eqFiltersRef.current.forEach((filter, index) => {
      const gain = eqValues[index] ?? 0;
      // Use setValueAtTime for immediate update without clicks
      filter.gain.setValueAtTime(gain, filter.context.currentTime);
    });
  }, [eqValues]);

  /**
   * Update low cut filter frequency when lowCutFrequency changes
   */
  useEffect(() => {
    if (!lowCutFilterRef.current) return;

    // Use setValueAtTime for smooth update without clicks
    lowCutFilterRef.current.frequency.setValueAtTime(
      lowCutFrequency,
      lowCutFilterRef.current.context.currentTime
    );
  }, [lowCutFrequency]);

  /**
   * Update high cut filter frequency when highCutFrequency changes
   */
  useEffect(() => {
    if (!highCutFilterRef.current) return;

    // Use setValueAtTime for smooth update without clicks
    highCutFilterRef.current.frequency.setValueAtTime(
      highCutFrequency,
      highCutFilterRef.current.context.currentTime
    );
  }, [highCutFrequency]);

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
    }

    // Build the audio processing chain:
    // source -> EQ filters (chained) -> low cut filter -> high cut filter -> analyser -> gain -> destination
    const filters = eqFiltersRef.current;
    const lowCutFilter = lowCutFilterRef.current;
    const highCutFilter = highCutFilterRef.current;
    const analyser = analyserNodeRef.current;

    // Helper function to connect to the next stage (highCut -> analyser -> gain)
    const connectToHighCutOrLater = (fromNode: AudioNode) => {
      if (highCutFilter) {
        fromNode.connect(highCutFilter);
        highCutFilter.disconnect();
        if (analyser) {
          highCutFilter.connect(analyser);
          analyser.disconnect();
          analyser.connect(gainNodeRef.current!);
        } else {
          highCutFilter.connect(gainNodeRef.current!);
        }
      } else if (analyser) {
        fromNode.connect(analyser);
        analyser.disconnect();
        analyser.connect(gainNodeRef.current!);
      } else {
        fromNode.connect(gainNodeRef.current!);
      }
    };

    if (filters.length > 0) {
      // Connect source to first EQ filter
      sourceNode.connect(filters[0]);

      // Chain EQ filters together
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].disconnect();
        filters[i].connect(filters[i + 1]);
      }

      // Connect last EQ filter to low cut filter (if exists) or high cut or analyser or gain
      filters[filters.length - 1].disconnect();
      if (lowCutFilter) {
        filters[filters.length - 1].connect(lowCutFilter);
        lowCutFilter.disconnect();
        connectToHighCutOrLater(lowCutFilter);
      } else {
        connectToHighCutOrLater(filters[filters.length - 1]);
      }
    } else if (lowCutFilter) {
      // No EQ filters, connect through low cut filter
      sourceNode.connect(lowCutFilter);
      lowCutFilter.disconnect();
      connectToHighCutOrLater(lowCutFilter);
    } else if (highCutFilter) {
      // No EQ or low cut filters, connect through high cut filter
      sourceNode.connect(highCutFilter);
      highCutFilter.disconnect();
      if (analyser) {
        highCutFilter.connect(analyser);
        analyser.disconnect();
        analyser.connect(gainNodeRef.current);
      } else {
        highCutFilter.connect(gainNodeRef.current);
      }
    } else if (analyser) {
      // No filters, connect through analyser
      sourceNode.connect(analyser);
      analyser.disconnect();
      analyser.connect(gainNodeRef.current);
    } else {
      // No filters or analyser, direct connection
      sourceNode.connect(gainNodeRef.current);
    }

    // Connect gain to destination
    gainNodeRef.current.disconnect();
    gainNodeRef.current.connect(audioContext.destination);

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
    analyserNode: analyserNodeRef.current,
  };
}

export default useAudioPlayback;
