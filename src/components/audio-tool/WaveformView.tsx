/**
 * WaveformView Component
 * Displays audio waveform using Wavesurfer.js
 */

import React, { useRef, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import type { WaveformSettings, LoopRegion } from '../../types/audio';
import { DEFAULT_WAVEFORM_SETTINGS } from '../../types/audio';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const WaveformContainer = styled(Box)({
  width: '100%',
  height: '100%',
  position: 'relative',
  backgroundColor: '#1a1a1a',
  borderRadius: 4,
  overflow: 'hidden',
});

const WaveformWrapper = styled(Box)({
  width: '100%',
  height: 'calc(100% - 24px)',
  '& wave': {
    overflow: 'hidden !important',
  },
});

const TimelineWrapper = styled(Box)({
  width: '100%',
  height: 24,
  backgroundColor: '#141414',
  borderTop: '1px solid #2b2b2b',
});

const LoadingOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  color: '#e1e1e1',
  fontSize: 14,
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface WaveformViewProps {
  /** Audio URL to load */
  audioUrl: string | null;
  /** Audio buffer (alternative to URL) */
  audioBuffer?: AudioBuffer | null;
  /** Whether audio is playing */
  isPlaying: boolean;
  /** Current playback time */
  currentTime: number;
  /** Playback rate */
  playbackRate: number;
  /** Volume (0-1) */
  volume: number;
  /** Is muted */
  muted: boolean;
  /** Loop regions */
  loopRegions: LoopRegion[];
  /** Active loop ID */
  activeLoopId: string | null;
  /** Waveform settings */
  settings?: WaveformSettings;
  /** Zoom level (pixels per second) */
  zoom?: number;
  /** Callback when playback state changes */
  onPlayPause?: (isPlaying: boolean) => void;
  /** Callback when seeking */
  onSeek?: (time: number) => void;
  /** Callback when time updates */
  onTimeUpdate?: (time: number) => void;
  /** Callback when audio is ready */
  onReady?: (duration: number) => void;
  /** Callback when a region is created */
  onRegionCreate?: (region: Omit<LoopRegion, 'id'>) => void;
  /** Callback when a region is updated */
  onRegionUpdate?: (id: string, updates: Partial<LoopRegion>) => void;
  /** Callback when a region is removed */
  onRegionRemove?: (id: string) => void;
  /** Callback when a region is clicked */
  onRegionClick?: (id: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const WaveformView: React.FC<WaveformViewProps> = ({
  audioUrl,
  audioBuffer,
  isPlaying,
  currentTime,
  playbackRate,
  volume,
  muted,
  loopRegions,
  activeLoopId,
  settings = DEFAULT_WAVEFORM_SETTINGS,
  zoom = 100,
  onPlayPause,
  onSeek,
  onTimeUpdate,
  onReady,
  onRegionCreate,
  onRegionUpdate,
  onRegionRemove: _onRegionRemove,
  onRegionClick,
}) => {
  // Note: _onRegionRemove available for future region removal handling
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const isSeekingRef = useRef(false);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !timelineRef.current) return;

    const regionsPlugin = RegionsPlugin.create();
    regionsPluginRef.current = regionsPlugin;

    const timeline = TimelinePlugin.create({
      container: timelineRef.current,
      timeInterval: 1,
      primaryLabelInterval: 5,
    });

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: settings.waveColor,
      progressColor: settings.progressColor,
      cursorColor: settings.cursorColor,
      cursorWidth: settings.showCursor ? 2 : 0,
      barWidth: settings.barWidth || undefined,
      barGap: settings.barGap || undefined,
      barRadius: 2,
      normalize: settings.normalize,
      height: 'auto',
      fillParent: true,
      minPxPerSec: zoom,
      autoCenter: true,
      autoScroll: true,
      hideScrollbar: false,
      plugins: [regionsPlugin, timeline],
    });

    wavesurferRef.current = ws;

    // Event handlers
    ws.on('ready', () => {
      setIsLoading(false);
      setIsReady(true);
      onReady?.(ws.getDuration());
    });

    ws.on('loading', () => {
      setIsLoading(true);
    });

    ws.on('play', () => {
      onPlayPause?.(true);
    });

    ws.on('pause', () => {
      onPlayPause?.(false);
    });

    ws.on('seeking', () => {
      isSeekingRef.current = true;
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 100);
    });

    ws.on('timeupdate', (time) => {
      if (!isSeekingRef.current) {
        onTimeUpdate?.(time);
      }
    });

    ws.on('click', (relativeX) => {
      const duration = ws.getDuration();
      const clickTime = relativeX * duration;
      onSeek?.(clickTime);
    });

    ws.on('error', (error) => {
      console.error('[WaveformView] WaveSurfer error:', error);
      setIsLoading(false);
    });

    // Region events
    regionsPlugin.on('region-created', (region) => {
      if (region.id.startsWith('wavesurfer-region')) {
        // User-created region
        onRegionCreate?.({
          startTime: region.start,
          endTime: region.end,
          color: region.color || '#ffc10780',
          active: false,
        });
      }
    });

    regionsPlugin.on('region-updated', (region) => {
      onRegionUpdate?.(region.id, {
        startTime: region.start,
        endTime: region.end,
      });
    });

    regionsPlugin.on('region-clicked', (region, e) => {
      e.stopPropagation();
      onRegionClick?.(region.id);
    });

    regionsPlugin.on('region-double-clicked', (region, e) => {
      e.stopPropagation();
      // Play region on double-click
      region.play();
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      regionsPluginRef.current = null;
    };
  }, []);

  // Load audio
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return undefined;

    if (audioUrl) {
      setIsLoading(true);
      ws.load(audioUrl);
      return undefined;
    } else if (audioBuffer) {
      setIsLoading(true);
      // Convert AudioBuffer to blob URL
      const blob = audioBufferToBlob(audioBuffer);
      const url = URL.createObjectURL(blob);
      ws.load(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [audioUrl, audioBuffer]);

  // Update waveform settings
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    ws.setOptions({
      waveColor: settings.waveColor,
      progressColor: settings.progressColor,
      cursorColor: settings.cursorColor,
      cursorWidth: settings.showCursor ? 2 : 0,
      barWidth: settings.barWidth || undefined,
      barGap: settings.barGap || undefined,
      normalize: settings.normalize,
    });
  }, [settings]);

  // Sync playback state
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;

    if (isPlaying && !ws.isPlaying()) {
      ws.play();
    } else if (!isPlaying && ws.isPlaying()) {
      ws.pause();
    }
  }, [isPlaying, isReady]);

  // Sync current time (external seek)
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady || isSeekingRef.current) return;

    const wsTime = ws.getCurrentTime();
    if (Math.abs(wsTime - currentTime) > 0.1) {
      ws.seekTo(currentTime / ws.getDuration());
    }
  }, [currentTime, isReady]);

  // Sync playback rate
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;

    ws.setPlaybackRate(playbackRate);
  }, [playbackRate, isReady]);

  // Sync volume
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;

    ws.setVolume(muted ? 0 : volume);
  }, [volume, muted, isReady]);

  // Sync zoom
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;

    ws.zoom(zoom);
  }, [zoom, isReady]);

  // Sync loop regions
  useEffect(() => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin || !isReady) return;

    // Clear existing regions
    regionsPlugin.clearRegions();

    // Add regions from props
    loopRegions.forEach((region) => {
      regionsPlugin.addRegion({
        id: region.id,
        start: region.startTime,
        end: region.endTime,
        color: region.active ? 'rgba(255, 193, 7, 0.3)' : 'rgba(255, 193, 7, 0.15)',
        drag: true,
        resize: true,
        content: region.label,
      });
    });
  }, [loopRegions, isReady]);

  // Handle active loop for looping playback
  useEffect(() => {
    const ws = wavesurferRef.current;
    const regionsPlugin = regionsPluginRef.current;
    if (!ws || !regionsPlugin || !isReady) return undefined;

    if (activeLoopId) {
      const region = loopRegions.find((r) => r.id === activeLoopId);
      if (region) {
        // Set up looping for active region
        const handleTimeUpdate = (time: number) => {
          if (time >= region.endTime) {
            ws.seekTo(region.startTime / ws.getDuration());
          }
        };

        ws.on('timeupdate', handleTimeUpdate);
        return () => {
          ws.un('timeupdate', handleTimeUpdate);
        };
      }
    }
    return undefined;
  }, [activeLoopId, loopRegions, isReady]);

  return (
    <WaveformContainer ref={containerRef}>
      <WaveformWrapper ref={waveformRef} />
      <TimelineWrapper ref={timelineRef} />
      {isLoading && <LoadingOverlay>Loading waveform...</LoadingOverlay>}
    </WaveformContainer>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function audioBufferToBlob(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export default WaveformView;
