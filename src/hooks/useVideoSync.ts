/**
 * useVideoSync Hook
 * Manages video synchronization with the waveform playhead
 *
 * Key design decisions:
 * 1. Video uses click-to-seek only (no playhead dragging/scrubbing for video files)
 * 2. Video updates on: play, pause, single click seek
 * 3. Click-to-seek waits for 'seeked' event before updating UI
 * 4. Loading indicator appears only if seek takes >500ms (avoids flicker)
 * 5. Proper preloading and seek handling for fast response
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

interface UseVideoSyncOptions {
  /** Reference to the video element */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** URL to the video file */
  videoUrl: string | null | undefined;
  /** Whether the video sync is active (e.g., modal is open, panel is visible) */
  isActive: boolean;
  /** Duration of the video in seconds */
  duration: number;
  /** Whether user is actively scrubbing (dragging playhead, selection, etc.) */
  isScrubbing?: boolean;
}

interface UseVideoSyncReturn {
  /** Manually seek the video to a specific time */
  seekTo: (timeInSeconds: number) => void;
  /** Whether video is currently loading/seeking */
  isVideoLoading: boolean;
  /** Whether video is ready to play */
  isVideoReady: boolean;
}

// Threshold for detecting a "jump" (user-initiated seek) vs normal playback
const SEEK_JUMP_THRESHOLD_MS = 500; // 500ms jump indicates user seek

// Threshold for drift correction during normal playback
const DRIFT_CORRECTION_THRESHOLD = 0.3; // Only correct if video drifts > 0.3 seconds

// Minimum time between drift corrections to avoid oscillation
const DRIFT_CORRECTION_COOLDOWN_MS = 300;

// Delay before showing loading indicator (to avoid flicker on fast seeks)
const LOADING_INDICATOR_DELAY_MS = 500;

/**
 * Hook for synchronizing video playback with the waveform playhead
 */
export function useVideoSync({
  videoRef,
  videoUrl,
  isActive,
  duration,
  isScrubbing = false,
}: UseVideoSyncOptions): UseVideoSyncReturn {
  // Loading state for UI feedback
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Track the last known playhead timestamp for jump detection
  const lastTimestampRef = useRef<number>(0);

  // Track if we're in the middle of a seek operation
  const isSeekingRef = useRef<boolean>(false);

  // Track if video was playing before a seek (to resume after)
  const wasPlayingBeforeSeekRef = useRef<boolean>(false);

  // Cooldown tracking for drift correction
  const lastDriftCorrectionRef = useRef<number>(0);

  // Animation frame ref for cleanup
  const animationFrameRef = useRef<number | null>(null);

  // Track if we've initialized sync for this video
  const initializedRef = useRef<boolean>(false);

  // Track previous scrubbing state to detect scrub end
  const wasScrubbing = useRef<boolean>(false);

  // Track the timestamp when scrubbing started (to update on release)
  const scrubStartTimestamp = useRef<number>(0);

  // Timer for delayed loading indicator
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get playhead state
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);

  /**
   * Seek the video to a specific time, waiting for the seeked event
   * Shows loading indicator only after LOADING_INDICATOR_DELAY_MS to avoid flicker on fast seeks
   */
  const seekTo = useCallback((timeInSeconds: number) => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    // Clamp time to valid range
    const clampedTime = Math.max(0, Math.min(timeInSeconds, duration || video.duration || Infinity));

    // Clear any existing loading timer
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }

    // Mark that we're seeking
    isSeekingRef.current = true;
    wasPlayingBeforeSeekRef.current = isPlaying;

    // Start a delayed loading indicator - only show if seek takes longer than threshold
    loadingTimerRef.current = setTimeout(() => {
      if (isSeekingRef.current) {
        setIsVideoLoading(true);
      }
    }, LOADING_INDICATOR_DELAY_MS);

    // Set up one-time seeked handler
    const handleSeeked = () => {
      // Clear loading timer if seek completed before delay
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }

      isSeekingRef.current = false;
      setIsVideoLoading(false);
      video.removeEventListener('seeked', handleSeeked);

      // Resume playback if needed
      if (wasPlayingBeforeSeekRef.current && isPlaying) {
        video.play().catch(() => {
          // Ignore autoplay errors
        });
      }
    };

    video.addEventListener('seeked', handleSeeked);

    // Pause during seek for smooth experience
    video.pause();
    video.currentTime = clampedTime;
  }, [videoRef, videoUrl, duration, isPlaying]);

  /**
   * Detect if a timestamp change is a "jump" (user seek) or normal playback advancement
   */
  const detectJump = useCallback((newTimestamp: number, oldTimestamp: number): boolean => {
    const diff = Math.abs(newTimestamp - oldTimestamp);
    return diff > SEEK_JUMP_THRESHOLD_MS;
  }, []);

  /**
   * Handle timestamp changes from the playhead store
   * This is the main sync logic that runs on every timestamp update
   *
   * KEY BEHAVIOR: Video freezes during scrubbing (isScrubbing=true)
   * Video only updates on: play, pause, single click seek, scrub release
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isActive) {
      lastTimestampRef.current = timestamp;
      wasScrubbing.current = isScrubbing;
      return;
    }

    // Skip if we're in the middle of a seek operation
    if (isSeekingRef.current) {
      lastTimestampRef.current = timestamp;
      wasScrubbing.current = isScrubbing;
      return;
    }

    const currentTimeSec = timestamp / 1000;
    const lastTimestampMs = lastTimestampRef.current;

    // SCRUBBING FREEZE LOGIC:
    // When scrubbing starts, record the timestamp and freeze video
    // When scrubbing ends, seek to the final position
    if (isScrubbing) {
      // Currently scrubbing - do NOT update video
      // Just track that we were scrubbing
      if (!wasScrubbing.current) {
        // Just started scrubbing - record start position
        scrubStartTimestamp.current = timestamp;
        // Pause video during scrub
        video.pause();
      }
      // Video stays frozen on its current frame
      lastTimestampRef.current = timestamp;
      wasScrubbing.current = true;
      return;
    }

    // Check if we just finished scrubbing
    if (wasScrubbing.current && !isScrubbing) {
      // Scrub ended - seek video to final position
      wasScrubbing.current = false;
      seekTo(currentTimeSec);
      lastTimestampRef.current = timestamp;
      return;
    }

    // Not scrubbing - normal sync logic
    wasScrubbing.current = false;

    // Detect if this is a jump (user-initiated seek via click)
    const isJump = detectJump(timestamp, lastTimestampMs);

    if (isJump) {
      // User initiated a seek - hard seek the video
      seekTo(currentTimeSec);
    } else if (isPlaying) {
      // Normal playback - only correct significant drift
      const videoDrift = Math.abs(video.currentTime - currentTimeSec);
      const now = Date.now();

      if (videoDrift > DRIFT_CORRECTION_THRESHOLD &&
          now - lastDriftCorrectionRef.current > DRIFT_CORRECTION_COOLDOWN_MS) {
        // Video has drifted too far - correct it
        video.currentTime = currentTimeSec;
        lastDriftCorrectionRef.current = now;
      }
    } else {
      // Paused - sync video position (but more gently to avoid flicker)
      // Only sync if difference is noticeable
      if (Math.abs(video.currentTime - currentTimeSec) > 0.1) {
        video.currentTime = currentTimeSec;
      }
    }

    // Update last known timestamp
    lastTimestampRef.current = timestamp;
  }, [timestamp, videoRef, videoUrl, isActive, isPlaying, isScrubbing, detectJump, seekTo]);

  /**
   * Handle play/pause state changes
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isActive) return;

    // Skip if we're in the middle of a seek operation or scrubbing
    if (isSeekingRef.current || isScrubbing) return;

    if (isPlaying) {
      // Start video playback (muted since audio comes from waveform)
      video.muted = true;
      video.playbackRate = playbackSpeed;
      video.play().catch(() => {
        // Ignore autoplay errors - user interaction may be required
      });
    } else {
      video.pause();
    }
  }, [isPlaying, videoRef, videoUrl, isActive, playbackSpeed, isScrubbing]);

  /**
   * Handle playback speed changes
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isActive) return;

    video.playbackRate = playbackSpeed;
  }, [playbackSpeed, videoRef, videoUrl, isActive]);

  /**
   * Initialize video when URL changes or becomes active
   * Sets up preload and handles initial seek
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isActive) {
      initializedRef.current = false;
      setIsVideoReady(false);
      return;
    }

    if (!initializedRef.current) {
      // Set up preload for fast seeking
      video.preload = 'auto';
      video.muted = true;

      setIsVideoLoading(true);
      setIsVideoReady(false);

      // Handler for when video can play through without buffering
      const handleCanPlayThrough = () => {
        setIsVideoReady(true);
        setIsVideoLoading(false);
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
      };

      // Handler for when video has loaded metadata
      const handleLoadedMetadata = () => {
        // Seek to current timestamp position
        const currentTimeSec = timestamp / 1000;
        video.currentTime = currentTimeSec;
        video.playbackRate = playbackSpeed;
      };

      // Handler for errors
      const handleError = () => {
        setIsVideoLoading(false);
        setIsVideoReady(false);
      };

      video.addEventListener('canplaythrough', handleCanPlayThrough);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);

      // Trigger load if needed
      if (video.readyState < 3) {
        video.load();
      } else {
        // Already loaded
        setIsVideoReady(true);
        setIsVideoLoading(false);
        const currentTimeSec = timestamp / 1000;
        video.currentTime = currentTimeSec;
        video.playbackRate = playbackSpeed;
      }

      if (isPlaying && !isScrubbing) {
        video.play().catch(() => {
          // Ignore autoplay errors
        });
      }

      initializedRef.current = true;
      lastTimestampRef.current = timestamp;

      return () => {
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
      };
    }
  }, [videoUrl, isActive, videoRef, timestamp, isPlaying, playbackSpeed, isScrubbing]);

  /**
   * Cleanup on unmount or when video becomes inactive
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (loadingTimerRef.current !== null) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setIsVideoReady(false);
      setIsVideoLoading(false);
    };
  }, []);

  return {
    seekTo,
    isVideoLoading,
    isVideoReady,
  };
}

export default useVideoSync;
