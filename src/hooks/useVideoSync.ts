/**
 * useVideoSync Hook
 * Manages video synchronization with the waveform playhead
 *
 * Key design decisions:
 * 1. During normal playback, let the video play naturally - only correct significant drift
 * 2. When seeking (user clicks waveform), properly seek the video and wait for 'seeked' event
 * 3. Distinguish between normal playback updates and user-initiated seeks
 * 4. Use requestAnimationFrame for smooth drift correction instead of React state updates
 */

import { useRef, useEffect, useCallback } from 'react';
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
}

interface UseVideoSyncReturn {
  /** Manually seek the video to a specific time */
  seekTo: (timeInSeconds: number) => void;
}

// Threshold for detecting a "jump" (user-initiated seek) vs normal playback
const SEEK_JUMP_THRESHOLD_MS = 500; // 500ms jump indicates user seek

// Threshold for drift correction during normal playback
const DRIFT_CORRECTION_THRESHOLD = 0.5; // Only correct if video drifts > 0.5 seconds

// Minimum time between drift corrections to avoid oscillation
const DRIFT_CORRECTION_COOLDOWN_MS = 500;

/**
 * Hook for synchronizing video playback with the waveform playhead
 */
export function useVideoSync({
  videoRef,
  videoUrl,
  isActive,
  duration,
}: UseVideoSyncOptions): UseVideoSyncReturn {
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

  // Get playhead state
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);

  /**
   * Seek the video to a specific time, waiting for the seeked event
   */
  const seekTo = useCallback((timeInSeconds: number) => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    // Clamp time to valid range
    const clampedTime = Math.max(0, Math.min(timeInSeconds, duration || video.duration || Infinity));

    // Mark that we're seeking
    isSeekingRef.current = true;
    wasPlayingBeforeSeekRef.current = isPlaying;

    // Set up one-time seeked handler
    const handleSeeked = () => {
      isSeekingRef.current = false;
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
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isActive) {
      lastTimestampRef.current = timestamp;
      return;
    }

    // Skip if we're in the middle of a seek operation
    if (isSeekingRef.current) {
      lastTimestampRef.current = timestamp;
      return;
    }

    const currentTimeSec = timestamp / 1000;
    const lastTimestampMs = lastTimestampRef.current;

    // Detect if this is a jump (user-initiated seek)
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
  }, [timestamp, videoRef, videoUrl, isActive, isPlaying, detectJump, seekTo]);

  /**
   * Handle play/pause state changes
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isActive) return;

    // Skip if we're in the middle of a seek operation
    if (isSeekingRef.current) return;

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
  }, [isPlaying, videoRef, videoUrl, isActive, playbackSpeed]);

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
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isActive) {
      initializedRef.current = false;
      return;
    }

    if (!initializedRef.current) {
      // Initialize video state
      const currentTimeSec = timestamp / 1000;
      video.muted = true;
      video.currentTime = currentTimeSec;
      video.playbackRate = playbackSpeed;

      if (isPlaying) {
        video.play().catch(() => {
          // Ignore autoplay errors
        });
      }

      initializedRef.current = true;
      lastTimestampRef.current = timestamp;
    }
  }, [videoUrl, isActive, videoRef, timestamp, isPlaying, playbackSpeed]);

  /**
   * Cleanup on unmount or when video becomes inactive
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  return {
    seekTo,
  };
}

export default useVideoSync;
