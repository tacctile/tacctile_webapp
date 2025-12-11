/**
 * WaveformCanvas Component
 * Renders waveform with shadow/outline and playhead
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

interface WaveformCanvasProps {
  isLoaded: boolean;
  duration: number;
  zoom?: number;
  scrollOffset?: number;
  waveformData?: Float32Array | null;
  onSeek?: (timeInSeconds: number) => void;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  isLoaded,
  duration,
  zoom = 1,
  scrollOffset = 0,
  waveformData,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  const [showWaveform, setShowWaveform] = useState(true);

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

    if (!isLoaded || !showWaveform) return;

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
        const dataIndex = Math.floor((time / duration) * waveformData.length);
        const amplitude = dataIndex >= 0 && dataIndex < waveformData.length ? waveformData[dataIndex] : 0;
        const y = centerY - amplitude * (height * 0.4);
        ctx.lineTo(x, y);
      }

      // Bottom half (mirror)
      for (let x = width - 1; x >= 0; x--) {
        const time = startTime + (x / width) * visibleDuration;
        const dataIndex = Math.floor((time / duration) * waveformData.length);
        const amplitude = dataIndex >= 0 && dataIndex < waveformData.length ? waveformData[dataIndex] : 0;
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
        const y = centerY - Math.abs(waveformPoints[i]) * height * 0.4;
        ctx.lineTo(i, y);
      }

      // Bottom half (mirror)
      for (let i = waveformPoints.length - 1; i >= 0; i--) {
        const y = centerY + Math.abs(waveformPoints[i]) * height * 0.4;
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
  }, [isLoaded, duration, zoom, scrollOffset, timestamp, showWaveform, waveformData]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Click to seek
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLoaded || duration <= 0) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const clickRatio = x / rect.width;

    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const clickTime = startTime + clickRatio * visibleDuration;

    setTimestamp(clickTime * 1000);
    onSeek?.(clickTime);
  }, [isLoaded, duration, zoom, scrollOffset, setTimestamp, onSeek]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: isLoaded ? 'crosshair' : 'default',
        }}
      />
      {/* Waveform toggle */}
      {isLoaded && (
        <Box sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          display: 'flex',
          gap: 0.5,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 1,
          padding: '4px',
        }}>
          <Tooltip title={showWaveform ? "Hide Waveform" : "Show Waveform"}>
            <IconButton
              size="small"
              onClick={() => setShowWaveform(!showWaveform)}
              sx={{
                color: showWaveform ? '#19abb5' : '#555',
                padding: '4px',
                '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.1)' },
              }}
            >
              <GraphicEqIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default WaveformCanvas;
