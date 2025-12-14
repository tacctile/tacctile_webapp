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

// De-Hum filter frequencies - 60Hz fundamental and harmonics (common AC hum)
const DE_HUM_FREQUENCIES = [60, 120, 180, 240];

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
  /** De-Hum filter amount (0 = off/normal audio, 100 = maximum hum removal at -30dB) */
  deHumAmount?: number;
  /** De-Noise filter amount (0 = off/20000Hz, 100 = aggressive cut at 4000Hz) */
  deNoiseAmount?: number;
  /** Clarity filter amount (0 = no boost, 12 = +12dB boost at 3kHz presence range) */
  clarityAmount?: number;
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
  /** Scrub audio at a specific time (plays short snippet for audible feedback) */
  scrub: (timeInSeconds: number) => void;
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
  deHumAmount = 0,
  deNoiseAmount = 0,
  clarityAmount = 0,
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

  // De-Hum filter nodes ref - array of peaking filters at 60Hz harmonics
  const deHumFiltersRef = useRef<BiquadFilterNode[]>([]);

  // De-Noise filter node ref (low-pass filter for high-frequency noise reduction)
  const deNoiseFilterRef = useRef<BiquadFilterNode | null>(null);

  // Clarity filter node ref (peaking filter for presence boost at 3kHz)
  const clarityFilterRef = useRef<BiquadFilterNode | null>(null);

  // Analyser node for spectrum visualization
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Ref to hold the restart function for looping (avoids circular dependency)
  const restartPlaybackRef = useRef<((offset: number) => void) | null>(null);

  // Scrub source node ref (separate from main playback source for scrubbing while paused)
  const scrubSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrubGainRef = useRef<GainNode | null>(null);
  const scrubTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      deHumFiltersRef.current = [];
      deNoiseFilterRef.current = null;
      clarityFilterRef.current = null;
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

    // Create De-Hum filter nodes (peaking filters at 60Hz harmonics) if not already created
    // Uses peaking filters with negative gain to cut hum frequencies
    if (deHumFiltersRef.current.length === 0) {
      const deHumFilters: BiquadFilterNode[] = [];

      DE_HUM_FREQUENCIES.forEach((freq) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 10; // Narrow Q for precise notch-like behavior
        // Initial gain = 0dB (no filtering when deHumAmount = 0)
        // Formula: gain = (deHumAmount / 100) * -30
        // At 0%: 0dB (normal audio), at 100%: -30dB (maximum hum removal)
        filter.gain.value = 0;
        deHumFilters.push(filter);
      });

      deHumFiltersRef.current = deHumFilters;
    }

    // Create De-Noise filter (low-pass for high-frequency noise reduction) if not already created
    // Formula: frequency = 20000 - (deNoiseAmount / 100) * 16000
    // At 0%: 20000Hz (no audible effect), at 100%: 4000Hz (significant treble cut)
    if (!deNoiseFilterRef.current) {
      const deNoiseFilter = audioContext.createBiquadFilter();
      deNoiseFilter.type = 'lowpass';
      deNoiseFilter.frequency.value = 20000; // Start at 20kHz (no effect)
      deNoiseFilter.Q.value = 0.707; // Butterworth response for clean cutoff
      deNoiseFilterRef.current = deNoiseFilter;
    }

    // Create Clarity filter (peaking filter for presence boost) if not already created
    // Boosts 2-4kHz range centered at 3kHz for vocal intelligibility and clarity
    // At 0: gain = 0dB (no effect), at 12: gain = +12dB (maximum boost)
    if (!clarityFilterRef.current) {
      const clarityFilter = audioContext.createBiquadFilter();
      clarityFilter.type = 'peaking';
      clarityFilter.frequency.value = 3000; // Center of presence range (2-4kHz)
      clarityFilter.Q.value = 1.0; // Moderate width, affects roughly 2kHz-4kHz
      clarityFilter.gain.value = 0; // Start with no boost
      clarityFilterRef.current = clarityFilter;
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
      deHumFiltersRef.current.forEach(filter => {
        try {
          filter.disconnect();
        } catch {
          // Ignore
        }
      });
      if (deNoiseFilterRef.current) {
        try {
          deNoiseFilterRef.current.disconnect();
        } catch {
          // Ignore
        }
      }
      if (clarityFilterRef.current) {
        try {
          clarityFilterRef.current.disconnect();
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
   * Update De-Hum filter gains when deHumAmount changes
   * Formula: gain = (deHumAmount / 100) * -30
   * - At 0%: gain = 0dB (no filtering, normal audio)
   * - At 100%: gain = -30dB (maximum hum removal)
   */
  useEffect(() => {
    if (deHumFiltersRef.current.length === 0) return;

    // Calculate gain: 0% = 0dB (normal), 100% = -30dB (max cut)
    const gain = (deHumAmount / 100) * -30;

    deHumFiltersRef.current.forEach((filter) => {
      // Use setValueAtTime for smooth update without clicks
      filter.gain.setValueAtTime(gain, filter.context.currentTime);
    });
  }, [deHumAmount]);

  /**
   * Update De-Noise filter frequency when deNoiseAmount changes
   * Formula: frequency = 20000 - (deNoiseAmount / 100) * 16000
   * - At 0%: frequency = 20000Hz (no audible effect)
   * - At 50%: frequency = 12000Hz (moderate treble cut)
   * - At 100%: frequency = 4000Hz (significant treble cut)
   */
  useEffect(() => {
    if (!deNoiseFilterRef.current) return;

    // Calculate frequency: 0% = 20000Hz (no effect), 100% = 4000Hz (max cut)
    const frequency = 20000 - (deNoiseAmount / 100) * 16000;

    // Use setValueAtTime for smooth update without clicks
    deNoiseFilterRef.current.frequency.setValueAtTime(
      frequency,
      deNoiseFilterRef.current.context.currentTime
    );
  }, [deNoiseAmount]);

  /**
   * Update Clarity filter gain when clarityAmount changes
   * - At 0: gain = 0dB (no boost, no effect)
   * - At 6: gain = +6dB (moderate boost)
   * - At 12: gain = +12dB (maximum boost)
   */
  useEffect(() => {
    if (!clarityFilterRef.current) return;

    // Direct mapping: clarityAmount = gain in dB (0 to +12dB)
    clarityFilterRef.current.gain.setValueAtTime(
      clarityAmount,
      clarityFilterRef.current.context.currentTime
    );
  }, [clarityAmount]);

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
    // source -> EQ filters (chained) -> low cut filter -> high cut filter -> De-Hum filters -> De-Noise filter -> Clarity filter -> analyser -> gain -> destination
    const filters = eqFiltersRef.current;
    const lowCutFilter = lowCutFilterRef.current;
    const highCutFilter = highCutFilterRef.current;
    const deHumFilters = deHumFiltersRef.current;
    const deNoiseFilter = deNoiseFilterRef.current;
    const clarityFilter = clarityFilterRef.current;
    const analyser = analyserNodeRef.current;

    // Helper function to connect from Clarity filter (or earlier) to analyser and gain
    const connectToClarityOrLater = (fromNode: AudioNode) => {
      if (clarityFilter) {
        fromNode.connect(clarityFilter);
        clarityFilter.disconnect();
        if (analyser) {
          clarityFilter.connect(analyser);
          analyser.disconnect();
          analyser.connect(gainNodeRef.current!);
        } else {
          clarityFilter.connect(gainNodeRef.current!);
        }
      } else if (analyser) {
        fromNode.connect(analyser);
        analyser.disconnect();
        analyser.connect(gainNodeRef.current!);
      } else {
        fromNode.connect(gainNodeRef.current!);
      }
    };

    // Helper function to connect from De-Noise filter (or earlier) to Clarity filter and beyond
    const connectToDeNoiseOrLater = (fromNode: AudioNode) => {
      if (deNoiseFilter) {
        fromNode.connect(deNoiseFilter);
        deNoiseFilter.disconnect();
        connectToClarityOrLater(deNoiseFilter);
      } else {
        connectToClarityOrLater(fromNode);
      }
    };

    // Helper function to connect from De-Hum filters (or earlier) to De-Noise filter and beyond
    const connectToDeHumOrLater = (fromNode: AudioNode) => {
      if (deHumFilters.length > 0) {
        // Connect to first De-Hum filter
        fromNode.connect(deHumFilters[0]);
        // Chain De-Hum filters together
        for (let i = 0; i < deHumFilters.length - 1; i++) {
          deHumFilters[i].disconnect();
          deHumFilters[i].connect(deHumFilters[i + 1]);
        }
        // Connect last De-Hum filter to De-Noise filter (or analyser or gain)
        deHumFilters[deHumFilters.length - 1].disconnect();
        connectToDeNoiseOrLater(deHumFilters[deHumFilters.length - 1]);
      } else {
        connectToDeNoiseOrLater(fromNode);
      }
    };

    // Helper function to connect to the next stage (highCut -> deHum -> analyser -> gain)
    const connectToHighCutOrLater = (fromNode: AudioNode) => {
      if (highCutFilter) {
        fromNode.connect(highCutFilter);
        highCutFilter.disconnect();
        connectToDeHumOrLater(highCutFilter);
      } else {
        connectToDeHumOrLater(fromNode);
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

  /**
   * Scrub function - plays a short audio snippet at the specified position
   * Used for audible feedback when dragging the playhead while paused
   */
  const scrub = useCallback((timeInSeconds: number) => {
    if (!audioContext || !audioBuffer) return;

    const clampedTime = Math.max(0, Math.min(timeInSeconds, duration));
    setTimestamp(clampedTime * 1000);

    // If already playing, seek handles the audio update
    if (isPlaying) {
      startPlayback(clampedTime);
      return;
    }

    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Stop any existing scrub playback
    if (scrubSourceRef.current) {
      try {
        scrubSourceRef.current.stop();
      } catch {
        // Ignore errors if already stopped
      }
      scrubSourceRef.current.disconnect();
      scrubSourceRef.current = null;
    }

    // Clear any pending scrub timeout
    if (scrubTimeoutRef.current) {
      clearTimeout(scrubTimeoutRef.current);
      scrubTimeoutRef.current = null;
    }

    // Create a new scrub source node
    const scrubSource = audioContext.createBufferSource();
    scrubSource.buffer = audioBuffer;
    scrubSource.playbackRate.value = playbackSpeed;

    // Create gain node for scrub if not exists (for fade out)
    if (!scrubGainRef.current) {
      scrubGainRef.current = audioContext.createGain();
      scrubGainRef.current.connect(audioContext.destination);
    }
    scrubGainRef.current.gain.setValueAtTime(0.8, audioContext.currentTime);

    // Connect scrub source to gain node (bypassing filters for lower latency)
    scrubSource.connect(scrubGainRef.current);

    // Start playback at the scrub position
    const scrubDuration = 0.08; // 80ms snippet
    scrubSource.start(0, clampedTime, scrubDuration);
    scrubSourceRef.current = scrubSource;

    // Auto-cleanup after snippet ends
    scrubTimeoutRef.current = setTimeout(() => {
      if (scrubSourceRef.current === scrubSource) {
        try {
          scrubSource.stop();
        } catch {
          // Ignore
        }
        scrubSource.disconnect();
        scrubSourceRef.current = null;
      }
    }, scrubDuration * 1000 + 20);
  }, [audioContext, audioBuffer, duration, isPlaying, playbackSpeed, setTimestamp, startPlayback]);

  return {
    isPlaying,
    play,
    pause: pausePlayback,
    seek,
    scrub,
    analyserNode: analyserNodeRef.current,
  };
}

export default useAudioPlayback;
