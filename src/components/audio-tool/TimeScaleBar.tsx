/**
 * TimeScaleBar Component
 * Shared time scale bar between spectral and waveform sections
 */

import React, { useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

interface TimeScaleBarProps {
  duration: number;
  zoom: number;
  scrollOffset: number;
}

export const TimeScaleBar: React.FC<TimeScaleBarProps> = ({
  duration,
  zoom,
  scrollOffset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timestamp = usePlayheadStore((state) => state.timestamp);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || duration <= 0) return;

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

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    // Calculate visible time range
    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;

    // Determine interval based on visible duration
    let interval: number;
    if (visibleDuration <= 15) interval = 1;
    else if (visibleDuration <= 30) interval = 2;
    else if (visibleDuration <= 60) interval = 5;
    else if (visibleDuration <= 120) interval = 10;
    else if (visibleDuration <= 300) interval = 15;
    else if (visibleDuration <= 600) interval = 30;
    else interval = 60;

    // Draw time markers
    ctx.fillStyle = '#888';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    const firstMarker = Math.ceil(startTime / interval) * interval;
    const lastMarker = Math.floor((startTime + visibleDuration) / interval) * interval;

    for (let time = firstMarker; time <= lastMarker; time += interval) {
      const x = ((time - startTime) / visibleDuration) * width;

      if (x < 25 || x > width - 25) continue;

      // Tick
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 6);
      ctx.stroke();

      // Label
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      ctx.fillText(label, x, 18);
    }

    // Draw playhead position indicator
    const playheadTime = timestamp / 1000;
    if (playheadTime >= startTime && playheadTime <= startTime + visibleDuration) {
      const playheadX = ((playheadTime - startTime) / visibleDuration) * width;
      ctx.fillStyle = '#19abb5';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }

  }, [duration, zoom, scrollOffset, timestamp]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </Box>
  );
};

export default TimeScaleBar;
