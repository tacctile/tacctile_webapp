/**
 * WaveformCanvas Component
 * Renders waveform with shadow/outline and playhead
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

interface WaveformCanvasProps {
  isLoaded: boolean;
  duration: number;
  zoom?: number;
  scrollOffset?: number;
  waveformData?: Float32Array | null;
  waveformHeight?: number;
  onSeek?: (timeInSeconds: number) => void;
  onZoomChange?: (zoom: number) => void;
  onScrollChange?: (scrollOffset: number) => void;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  isLoaded,
  duration,
  zoom = 1,
  scrollOffset = 0,
  waveformData,
  waveformHeight = 1,
  onSeek,
  onZoomChange,
  onScrollChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  // Scrubbing state (drag playhead)
  const [isDragging, setIsDragging] = useState(false);
  const [isNearPlayhead, setIsNearPlayhead] = useState(false);

  // Spacebar + drag panning state
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);

  // Use waveformHeight prop for amplitude scaling
  const amplitudeScale = waveformHeight;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (!isLoaded) return;

    // Calculate visible time range
    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;

    // Set up shadow for contrast
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Waveform fill
    ctx.fillStyle = 'rgba(25, 171, 181, 0.6)';
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    if (waveformData && waveformData.length > 0) {
      // Top half
      for (let x = 0; x < width; x++) {
        const time = startTime + (x / width) * visibleDuration;

        // Don't draw beyond actual duration
        if (time > duration) {
          ctx.lineTo(x, centerY);
          continue;
        }

        const dataIndex = Math.min(
          waveformData.length - 1,
          Math.floor((time / duration) * waveformData.length)
        );
        const amplitude = (dataIndex >= 0 ? waveformData[dataIndex] : 0) * amplitudeScale;
        const y = centerY - amplitude * (height * 0.4);
        ctx.lineTo(x, y);
      }

      // Bottom half (mirror)
      for (let x = width - 1; x >= 0; x--) {
        const time = startTime + (x / width) * visibleDuration;

        // Don't draw beyond actual duration
        if (time > duration) {
          ctx.lineTo(x, centerY);
          continue;
        }

        const dataIndex = Math.min(
          waveformData.length - 1,
          Math.floor((time / duration) * waveformData.length)
        );
        const amplitude = (dataIndex >= 0 ? waveformData[dataIndex] : 0) * amplitudeScale;
        const y = centerY + amplitude * (height * 0.4);
        ctx.lineTo(x, y);
      }
    } else {
      // Mock waveform data
      const waveformPoints: number[] = [];
      for (let i = 0; i < width; i++) {
        const t = i / width;
        const envelope = 0.3 +
          Math.sin(t * Math.PI * 2) * 0.15 +
          Math.sin(t * Math.PI * 8) * 0.1 +
          Math.cos(t * Math.PI * 4 + 1) * 0.12;
        const noise = (Math.random() - 0.5) * 0.15;
        const sample = (Math.sin(t * 150) * 0.3 + Math.sin(t * 80) * 0.2 + noise) * envelope;
        waveformPoints.push(sample);
      }

      // Top half
      for (let i = 0; i < waveformPoints.length; i++) {
        const y = centerY - Math.abs(waveformPoints[i]) * amplitudeScale * height * 0.4;
        ctx.lineTo(i, y);
      }

      // Bottom half (mirror)
      for (let i = waveformPoints.length - 1; i >= 0; i--) {
        const y = centerY + Math.abs(waveformPoints[i]) * amplitudeScale * height * 0.4;
        ctx.lineTo(i, y);
      }
    }

    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw stroke outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = 'rgba(25, 171, 181, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw playhead
    if (duration > 0) {
      const playheadTime = timestamp / 1000;
      const playheadX = ((playheadTime - startTime) / visibleDuration) * width;

      if (playheadX >= 0 && playheadX <= width) {
        ctx.shadowColor = '#19abb5';
        ctx.shadowBlur = 8;

        ctx.strokeStyle = '#19abb5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Triangle at bottom
        ctx.fillStyle = '#19abb5';
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, height);
        ctx.lineTo(playheadX + 6, height);
        ctx.lineTo(playheadX, height - 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  }, [isLoaded, duration, zoom, scrollOffset, timestamp, waveformData, waveformHeight]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ResizeObserver for container size changes (column collapse/expand)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      draw();
    });

    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [draw]);

  // Helper to check if mouse is near playhead
  const checkNearPlayhead = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || duration <= 0) return false;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const playheadX = ((timestamp / 1000 - startTime) / visibleDuration) * rect.width;

    return Math.abs(mouseX - playheadX) < 10;
  }, [duration, zoom, scrollOffset, timestamp]);

  // Seek to position helper
  const seekToPosition = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || duration <= 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, mouseX / rect.width));

    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const clickTime = startTime + (clickRatio * visibleDuration);

    setTimestamp(clickTime * 1000);
    onSeek?.(clickTime);
  }, [duration, zoom, scrollOffset, setTimestamp, onSeek]);

  // Mouse handlers for scrubbing and panning
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only respond to left mouse button
    if (e.button !== 0) return;
    if (!isLoaded || duration <= 0) return;

    // Spacebar held = start panning
    if (isSpaceHeld && zoom > 1) {
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartOffset(scrollOffset);
      return;
    }

    // Near playhead = start scrubbing
    if (checkNearPlayhead(e)) {
      setIsDragging(true);
      return;
    }

    // Otherwise click to seek
    seekToPosition(e);
  }, [isLoaded, duration, isSpaceHeld, zoom, scrollOffset, checkNearPlayhead, seekToPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Panning
    if (isPanning && canvasRef.current && onScrollChange) {
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaX = e.clientX - panStartX;
      const deltaRatio = deltaX / rect.width;
      const visibleFraction = 1 / zoom;

      const newOffset = Math.max(0, Math.min(1 - visibleFraction,
        panStartOffset - deltaRatio * visibleFraction));
      onScrollChange(newOffset);
      return;
    }

    // Update cursor based on proximity to playhead
    if (!isSpaceHeld) {
      setIsNearPlayhead(checkNearPlayhead(e));
    }

    // Scrubbing
    if (isDragging) {
      seekToPosition(e);
    }
  }, [isPanning, panStartX, panStartOffset, zoom, onScrollChange, isSpaceHeld, checkNearPlayhead, isDragging, seekToPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
    setIsNearPlayhead(false);
  }, []);

  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isLoaded || duration <= 0 || !onZoomChange || !onScrollChange) return;
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(10, zoom * zoomFactor));

    // Center zoom on playhead
    const playheadTime = timestamp / 1000;
    const newVisibleDuration = duration / newZoom;
    const newScrollOffset = Math.max(0, Math.min(1 - 1 / newZoom,
      (playheadTime - newVisibleDuration / 2) / duration));

    onZoomChange(newZoom);
    onScrollChange(newScrollOffset);
  }, [isLoaded, duration, zoom, timestamp, onZoomChange, onScrollChange]);

  // Spacebar keyboard listener for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or contentEditable element
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Determine cursor based on state
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (isSpaceHeld) return 'grab';
    if (isNearPlayhead || isDragging) return 'ew-resize';
    if (isLoaded) return 'pointer';
    return 'default';
  };

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: getCursor(),
        }}
      />
    </Box>
  );
};

export default WaveformCanvas;
