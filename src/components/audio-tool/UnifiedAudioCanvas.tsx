/**
 * UnifiedAudioCanvas Component
 * Displays spectral visualization with teal waveform overlay
 */

import React, { useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const CanvasContainer = styled(Box)({
  width: '100%',
  height: '100%',
  position: 'relative',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface UnifiedAudioCanvasProps {
  /** Whether audio is loaded */
  isLoaded: boolean;
  /** Total duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  currentTime: number;
  /** Zoom level (1 = fit to view) */
  zoom?: number;
  /** Scroll offset (0-1) */
  scrollOffset?: number;
  /** Callback when user clicks to seek */
  onSeek?: (timeInSeconds: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const UnifiedAudioCanvas: React.FC<UnifiedAudioCanvasProps> = ({
  isLoaded,
  duration,
  currentTime,
  zoom = 1,
  scrollOffset = 0,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timestamp = usePlayheadStore((state) => state.timestamp);

  // Draw function - renders spectral visualization and waveform overlay
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (!isLoaded) return;

    // ========================================================================
    // Draw Spectral Visualization (gradient bars with noise)
    // ========================================================================

    const numBars = Math.floor(width / 3);
    for (let i = 0; i < numBars; i++) {
      const x = (i / numBars) * width;
      const barWidth = width / numBars;

      // Create varying intensity based on position
      const t = i / numBars;
      const intensity = 0.3 +
        Math.sin(t * Math.PI * 4) * 0.2 +
        Math.sin(t * Math.PI * 12) * 0.1 +
        Math.cos(t * Math.PI * 7 + 0.5) * 0.15;

      // Add some randomness for organic feel
      const noise = (Math.random() - 0.5) * 0.1;
      const finalIntensity = Math.max(0.1, Math.min(1, intensity + noise));

      // Create spectral gradient (purple at top to green at bottom)
      const gradient = ctx.createLinearGradient(x, 0, x, height);
      gradient.addColorStop(0, `rgba(80, 40, 120, ${finalIntensity * 0.7})`);     // Purple
      gradient.addColorStop(0.3, `rgba(60, 80, 140, ${finalIntensity * 0.8})`);   // Blue-purple
      gradient.addColorStop(0.5, `rgba(40, 100, 80, ${finalIntensity * 0.9})`);   // Teal-green
      gradient.addColorStop(0.7, `rgba(60, 120, 60, ${finalIntensity * 0.7})`);   // Green
      gradient.addColorStop(1, `rgba(40, 60, 40, ${finalIntensity * 0.4})`);      // Dark green

      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, barWidth + 1, height);
    }

    // Add noise texture overlay for more organic spectrogram look
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const alpha = Math.random() * 0.15;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // ========================================================================
    // Draw Waveform Overlay
    // ========================================================================

    if (isLoaded) {
      const centerY = height / 2;

      // Generate mock waveform data
      const waveformPoints: number[] = [];
      for (let i = 0; i < width; i++) {
        const t = i / width;
        // Create realistic-looking audio waveform with varying amplitude
        const envelope = 0.3 +
          Math.sin(t * Math.PI * 2) * 0.15 +
          Math.sin(t * Math.PI * 8) * 0.1 +
          Math.cos(t * Math.PI * 4 + 1) * 0.12;
        const noise = (Math.random() - 0.5) * 0.15;
        const sample = (Math.sin(t * 150) * 0.3 + Math.sin(t * 80) * 0.2 + noise) * envelope;
        waveformPoints.push(sample);
      }

      // Draw filled waveform (mirrored top and bottom)
      ctx.fillStyle = 'rgba(25, 171, 181, 0.6)'; // Teal with transparency
      ctx.beginPath();
      ctx.moveTo(0, centerY);

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

      ctx.closePath();
      ctx.fill();

      // Draw center line
      ctx.strokeStyle = 'rgba(25, 171, 181, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }

    // ========================================================================
    // Draw Playhead
    // ========================================================================

    if (isLoaded && duration > 0) {
      const playheadX = (timestamp / 1000 / duration) * width;

      // Glow effect
      ctx.shadowColor = '#19abb5';
      ctx.shadowBlur = 8;

      // Playhead line
      ctx.strokeStyle = '#19abb5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Triangle at top
      ctx.fillStyle = '#19abb5';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [isLoaded, duration, timestamp]);

  // Redraw on mount and when dependencies change
  useEffect(() => {
    draw();
  }, [draw, timestamp]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Handle click to seek
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !isLoaded || duration <= 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / rect.width;

    // Account for zoom and scroll
    const visibleWidth = 1 / zoom;
    const visibleStartNormalized = scrollOffset;
    const clickNormalized = visibleStartNormalized + clickRatio * visibleWidth;

    const seekTime = Math.max(0, Math.min(duration, clickNormalized * duration));
    onSeek?.(seekTime);
  }, [isLoaded, duration, zoom, scrollOffset, onSeek]);

  return (
    <CanvasContainer ref={containerRef} onClick={handleClick}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </CanvasContainer>
  );
};

export default UnifiedAudioCanvas;
