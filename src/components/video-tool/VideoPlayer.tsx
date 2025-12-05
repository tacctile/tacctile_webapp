/**
 * VideoPlayer Component
 * Video player with GPU-accelerated filter canvas overlay
 */

import React, { useRef, useEffect, useCallback, useState, memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { styled } from '@mui/material/styles';
import { gpuVideoFilters } from '../../services/video/GPUVideoFilters';
import type { FilterType } from '../../services/video/GPUVideoFilters';
import type { VideoAdjustments, VideoSource, PlaybackSpeed } from '../../types/video';
import { FILTER_PRESET_MAP, adjustmentToFilterParams, formatTimecode } from '../../types/video';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PlayerContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '100%',
  backgroundColor: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
});

const VideoCanvas = styled('canvas')({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
});

const HiddenVideo = styled('video')({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
});

const TimecodeOverlay = styled(Box)({
  position: 'absolute',
  bottom: 12,
  left: 12,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  padding: '4px 8px',
  borderRadius: 4,
  fontFamily: 'monospace',
  fontSize: 14,
  color: '#19abb5',
  userSelect: 'none',
});

const LoadingOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  gap: 16,
});

const FilterBadge = styled(Box)({
  position: 'absolute',
  top: 12,
  right: 12,
  backgroundColor: 'rgba(25, 171, 181, 0.8)',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  color: '#fff',
  textTransform: 'uppercase',
});

const NoSourceMessage = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
  gap: 8,
});

// ============================================================================
// PROPS
// ============================================================================

interface VideoPlayerProps {
  /** Video source to play */
  source: VideoSource | null;
  /** Whether video is playing */
  isPlaying: boolean;
  /** Current playback time in seconds */
  currentTime: number;
  /** Playback speed */
  speed: PlaybackSpeed;
  /** Volume (0-1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Whether to loop */
  loop: boolean;
  /** Video adjustments */
  adjustments: VideoAdjustments;
  /** Show timecode overlay */
  showTimecode?: boolean;
  /** Show filter badge when non-normal filter is active */
  showFilterBadge?: boolean;
  /** Callback when time updates */
  onTimeUpdate?: (time: number) => void;
  /** Callback when duration is loaded */
  onDurationChange?: (duration: number, fps: number) => void;
  /** Callback when video ends */
  onEnded?: () => void;
  /** Callback when video is seeking */
  onSeeking?: () => void;
  /** Callback when seek completes */
  onSeeked?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const VideoPlayer: React.FC<VideoPlayerProps> = memo(({
  source,
  isPlaying,
  currentTime,
  speed,
  volume,
  muted,
  loop,
  adjustments,
  showTimecode = true,
  showFilterBadge = true,
  onTimeUpdate,
  onDurationChange,
  onEnded,
  onSeeking,
  onSeeked,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const gpuInitializedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [gpuReady, setGpuReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  // Initialize GPU filters
  useEffect(() => {
    const initGPU = async () => {
      if (gpuInitializedRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const success = await gpuVideoFilters.initialize(canvas);
      if (success) {
        gpuInitializedRef.current = true;
        setGpuReady(true);
      } else {
        onError?.('GPU acceleration not available. Using fallback rendering.');
      }
    };

    initGPU();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onError]);

  // Update GPU filter based on adjustments
  useEffect(() => {
    if (!gpuReady) return;

    const filterType: FilterType = FILTER_PRESET_MAP[adjustments.activeFilter];
    gpuVideoFilters.setFilter(filterType);
  }, [adjustments.activeFilter, gpuReady]);

  // Render loop for GPU processing
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !gpuReady || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    // Process frame through GPU
    const filterParams = adjustmentToFilterParams(adjustments);
    const result = gpuVideoFilters.processFrame(video, filterParams);

    if (!result && canvas.getContext('2d')) {
      // Fallback: draw video directly if GPU processing fails
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0);
      }
    }

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [adjustments, gpuReady]);

  // Start/stop render loop based on video state
  useEffect(() => {
    if (videoReady && source) {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [videoReady, source, renderFrame]);

  // Handle video source changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) {
      setVideoReady(false);
      return;
    }

    setIsLoading(true);
    setVideoReady(false);
    video.src = source.url;
    video.load();
  }, [source]);

  // Sync playback state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoReady) return;

    if (isPlaying && video.paused) {
      video.play().catch((err) => {
        console.error('Play failed:', err);
        onError?.('Failed to play video');
      });
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, videoReady, onError]);

  // Sync current time (seeking)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoReady) return;

    // Only seek if difference is significant (to avoid feedback loops)
    if (Math.abs(video.currentTime - currentTime) > 0.1) {
      video.currentTime = currentTime;
    }
  }, [currentTime, videoReady]);

  // Sync playback speed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = speed;
  }, [speed]);

  // Sync volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;
  }, [volume]);

  // Sync mute
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;
  }, [muted]);

  // Sync loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.loop = loop;
  }, [loop]);

  // Video event handlers
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Estimate FPS (not always available in video metadata)
    const fps = 30; // Default to 30fps, could be improved with media capabilities API
    onDurationChange?.(video.duration, fps);
  }, [onDurationChange]);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    setVideoReady(true);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    onTimeUpdate?.(video.currentTime);
  }, [onTimeUpdate]);

  const handleEnded = useCallback(() => {
    onEnded?.();
  }, [onEnded]);

  const handleSeeking = useCallback(() => {
    onSeeking?.();
  }, [onSeeking]);

  const handleSeeked = useCallback(() => {
    onSeeked?.();
  }, [onSeeked]);

  const handleError = useCallback(() => {
    const video = videoRef.current;
    const errorMessage = video?.error?.message || 'Unknown video error';
    setIsLoading(false);
    onError?.(errorMessage);
  }, [onError]);

  // Get filter display name
  const getFilterDisplayName = (filter: VideoAdjustments['activeFilter']): string => {
    const names: Record<typeof filter, string> = {
      normal: 'Normal',
      nightVision: 'Night Vision',
      thermal: 'Thermal',
      edgeDetect: 'Edge Detect',
      denoise: 'Denoise',
      sharpen: 'Sharpen',
    };
    return names[filter];
  };

  return (
    <PlayerContainer>
      {/* Hidden video element for decoding */}
      <HiddenVideo
        ref={videoRef}
        crossOrigin="anonymous"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        onError={handleError}
      />

      {/* GPU-rendered canvas */}
      <VideoCanvas ref={canvasRef} />

      {/* No source message */}
      {!source && (
        <NoSourceMessage>
          <Typography variant="h6">No Video Selected</Typography>
          <Typography variant="body2">
            Select a video from the media pool to begin viewing
          </Typography>
        </NoSourceMessage>
      )}

      {/* Loading overlay */}
      {isLoading && source && (
        <LoadingOverlay>
          <CircularProgress sx={{ color: '#19abb5' }} />
          <Typography variant="body2" color="textSecondary">
            Loading video...
          </Typography>
        </LoadingOverlay>
      )}

      {/* Timecode overlay */}
      {showTimecode && videoReady && source && (
        <TimecodeOverlay>
          {formatTimecode(currentTime, source.fps || 30)}
        </TimecodeOverlay>
      )}

      {/* Filter badge */}
      {showFilterBadge && adjustments.activeFilter !== 'normal' && (
        <FilterBadge>
          {getFilterDisplayName(adjustments.activeFilter)}
        </FilterBadge>
      )}
    </PlayerContainer>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
