/**
 * UnifiedSpectrumEQ Component
 * Combined spectrum analyzer and EQ in one seamless visual tool
 * Professional metering colors with pixel-perfect alignment
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';

// EQ frequency bands
const EQ_BANDS = [
  { freq: 60, label: '60' },
  { freq: 125, label: '125' },
  { freq: 250, label: '250' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1k' },
  { freq: 2000, label: '2k' },
  { freq: 4000, label: '4k' },
  { freq: 6000, label: '6k' },
  { freq: 8000, label: '8k' },
  { freq: 16000, label: '16k' },
];

interface UnifiedSpectrumEQProps {
  isLoaded: boolean;
  eqValues: number[];
  onEQChange: (index: number, value: number) => void;
  disabled?: boolean;
}

export const UnifiedSpectrumEQ: React.FC<UnifiedSpectrumEQProps> = ({
  isLoaded,
  eqValues,
  onEQChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  // Dragging state for EQ nodes
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Smoothed spectrum values
  const smoothedLevelsRef = useRef<number[]>(new Array(10).fill(0));
  const smoothedStereoRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const peakLevelsRef = useRef<number[]>(new Array(10).fill(0));
  const peakDecayRef = useRef<number[]>(new Array(10).fill(0));
  const peakHoldRef = useRef<number[]>(new Array(10).fill(0));

  // Overall peak hold
  const overallPeakRef = useRef(0);
  const overallPeakHoldRef = useRef(0);
  const overallPeakDecayRef = useRef(0);

  // Simulated data phase
  const phaseRef = useRef(0);

  // Professional meter color gradient (green -> yellow -> orange -> red)
  const getMeterColor = (level: number): string => {
    if (level < 0.5) {
      // Green to yellow
      const t = level / 0.5;
      const r = Math.round(34 + (255 - 34) * t);
      const g = Math.round(197 + (200 - 197) * t);
      const b = Math.round(94 - 94 * t);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (level < 0.75) {
      // Yellow to orange
      const t = (level - 0.5) / 0.25;
      const r = 255;
      const g = Math.round(200 - 70 * t);
      const b = 0;
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Orange to red
      const t = (level - 0.75) / 0.25;
      const r = 255;
      const g = Math.round(130 - 130 * t);
      const b = Math.round(0 + 50 * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Create professional meter gradient
  const createMeterGradient = (ctx: CanvasRenderingContext2D, x: number, yBottom: number, yTop: number): CanvasGradient => {
    const gradient = ctx.createLinearGradient(x, yBottom, x, yTop);
    gradient.addColorStop(0, '#22c55e');     // Green at bottom
    gradient.addColorStop(0.5, '#eab308');   // Yellow at middle
    gradient.addColorStop(0.75, '#f97316');  // Orange
    gradient.addColorStop(0.9, '#ef4444');   // Red near top
    gradient.addColorStop(1, '#dc2626');     // Darker red at top
    return gradient;
  };

  // Generate smooth simulated frequency data
  const generateSimulatedData = useCallback((): number[] => {
    if (!isLoaded) return new Array(10).fill(0);

    phaseRef.current += 0.025;
    const phase = phaseRef.current;

    return EQ_BANDS.map((band, i) => {
      const normalizedFreq = Math.log10(band.freq) / Math.log10(20000);
      const baseCurve = Math.exp(-normalizedFreq * 1.5) * 0.55 + 0.15;

      const wave1 = Math.sin(phase * 0.7 + i * 0.5) * 0.1;
      const wave2 = Math.sin(phase * 1.1 + i * 0.8) * 0.08;
      const wave3 = Math.sin(phase * 0.35 + i * 0.3) * 0.12;

      let level = baseCurve + wave1 + wave2 + wave3;

      if (i < 3 && Math.sin(phase * 1.2) > 0.5) {
        level += 0.12 * (1 - i / 3);
      }

      return Math.max(0.03, Math.min(0.92, level));
    });
  }, [isLoaded]);

  // Generate simulated stereo levels
  const generateStereoLevels = useCallback((): { left: number; right: number } => {
    if (!isLoaded) return { left: 0, right: 0 };

    const phase = phaseRef.current;
    const baseLevel = 0.45 + Math.sin(phase * 0.6) * 0.18;

    return {
      left: Math.max(0.08, Math.min(0.88, baseLevel + Math.sin(phase * 0.9) * 0.12)),
      right: Math.max(0.08, Math.min(0.88, baseLevel + Math.sin(phase * 1.1 + 0.4) * 0.12)),
    };
  }, [isLoaded]);

  // Convert dB value (-12 to +12) to Y position in EQ area
  const dbToY = useCallback((db: number, eqTop: number, eqHeight: number): number => {
    return eqTop + eqHeight / 2 - (db / 12) * (eqHeight / 2 - 8);
  }, []);

  // Convert Y position to dB value
  const yToDb = useCallback((y: number, eqTop: number, eqHeight: number): number => {
    const centerY = eqTop + eqHeight / 2;
    const db = ((centerY - y) / (eqHeight / 2 - 8)) * 12;
    return Math.max(-12, Math.min(12, Math.round(db)));
  }, []);

  // Main drawing function
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

    // Layout constants
    const meterWidth = 20;
    const meterGap = 8;
    const leftMeterArea = meterWidth * 2 + meterGap + 16; // L/R meters + padding
    const rightMeterArea = meterWidth + 24; // Peak meter + dB label
    const graphStartX = leftMeterArea;
    const graphEndX = width - rightMeterArea;
    const graphWidth = graphEndX - graphStartX;

    // Vertical layout: spectrum on top, EQ below
    const spectrumHeight = height * 0.45;
    const eqHeight = height * 0.55;
    const spectrumTop = 0;
    const eqTop = spectrumHeight;

    // Clear canvas with unified dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (!isLoaded) {
      ctx.fillStyle = '#333';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Load audio to view spectrum', width / 2, height / 2);
      return;
    }

    // Get data
    const rawLevels = generateSimulatedData();
    const stereoLevels = generateStereoLevels();

    // Smooth interpolation
    const smoothingFactor = 0.12;
    rawLevels.forEach((level, i) => {
      smoothedLevelsRef.current[i] += (level - smoothedLevelsRef.current[i]) * smoothingFactor;
    });
    smoothedStereoRef.current.left += (stereoLevels.left - smoothedStereoRef.current.left) * smoothingFactor;
    smoothedStereoRef.current.right += (stereoLevels.right - smoothedStereoRef.current.right) * smoothingFactor;

    const levels = smoothedLevelsRef.current;

    // ========== DRAW GRID LINES ==========
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;

    // Horizontal line separating spectrum and EQ
    ctx.beginPath();
    ctx.moveTo(graphStartX, eqTop);
    ctx.lineTo(graphEndX, eqTop);
    ctx.stroke();

    // EQ center line (0dB)
    ctx.strokeStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.moveTo(graphStartX, eqTop + eqHeight / 2);
    ctx.lineTo(graphEndX, eqTop + eqHeight / 2);
    ctx.stroke();

    // Vertical grid lines at each frequency
    ctx.strokeStyle = '#151515';
    for (let i = 0; i < 10; i++) {
      const x = graphStartX + (i / 9) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, spectrumTop + 4);
      ctx.lineTo(x, height - 20);
      ctx.stroke();
    }

    // ========== DRAW SPECTRUM BARS ==========
    const barWidth = graphWidth / 10 * 0.7;

    for (let i = 0; i < 10; i++) {
      const level = levels[i];
      const centerX = graphStartX + (i / 9) * graphWidth;
      const barHeight = Math.max(2, level * (spectrumHeight - 8));
      const x = centerX - barWidth / 2;
      const y = spectrumHeight - barHeight - 2;

      // Create gradient for bar using professional colors
      const gradient = createMeterGradient(ctx, centerX, spectrumHeight - 2, y);
      ctx.fillStyle = gradient;

      // Draw bar with rounded top
      const radius = Math.min(barWidth / 2, 3);
      ctx.beginPath();
      ctx.moveTo(x, spectrumHeight - 2);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, spectrumHeight - 2);
      ctx.closePath();
      ctx.fill();

      // Update and draw peak indicators
      if (level > peakLevelsRef.current[i]) {
        peakLevelsRef.current[i] = level;
        peakHoldRef.current[i] = 25;
        peakDecayRef.current[i] = 0;
      } else if (peakHoldRef.current[i] > 0) {
        peakHoldRef.current[i]--;
      } else {
        peakDecayRef.current[i] += 0.004;
        peakLevelsRef.current[i] = Math.max(0, peakLevelsRef.current[i] - peakDecayRef.current[i]);
      }

      // Peak line
      const peakY = spectrumHeight - peakLevelsRef.current[i] * (spectrumHeight - 8) - 2;
      ctx.fillStyle = getMeterColor(peakLevelsRef.current[i]);
      ctx.fillRect(x - 2, peakY - 1, barWidth + 4, 2);
    }

    // ========== DRAW EQ CURVE ==========
    // Generate smooth bezier path
    const eqCenterY = eqTop + eqHeight / 2;
    const points: { x: number; y: number }[] = eqValues.map((db, i) => ({
      x: graphStartX + (i / 9) * graphWidth,
      y: dbToY(db, eqTop, eqHeight),
    }));

    // Draw filled area under curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, eqCenterY);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cp = (points[i - 1].x + points[i].x) / 2;
      ctx.bezierCurveTo(cp, points[i - 1].y, cp, points[i].y, points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, eqCenterY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(25, 171, 181, 0.08)';
    ctx.fill();

    // Draw EQ curve line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cp = (points[i - 1].x + points[i].x) / 2;
      ctx.bezierCurveTo(cp, points[i - 1].y, cp, points[i].y, points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#19abb5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw EQ nodes
    points.forEach((point, i) => {
      const isActive = draggingIndex === i;
      const nodeRadius = isActive ? 7 : 6;

      // Node glow
      if (isActive) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(25, 171, 181, 0.2)';
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(point.x, point.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = disabled ? '#333' : '#19abb5';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // ========== DRAW FREQUENCY LABELS ==========
    ctx.fillStyle = '#555';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    EQ_BANDS.forEach((band, i) => {
      const x = graphStartX + (i / 9) * graphWidth;
      ctx.fillText(band.label, x, height - 6);
    });

    // ========== DRAW dB LABELS ==========
    ctx.fillStyle = '#444';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('+12', graphStartX + 4, eqTop + 12);
    ctx.fillStyle = '#555';
    ctx.fillText('0dB', graphStartX + 4, eqCenterY + 3);
    ctx.fillStyle = '#444';
    ctx.fillText('-12', graphStartX + 4, eqTop + eqHeight - 24);

    // ========== DRAW L/R METERS (LEFT SIDE) ==========
    const meterX = 8;
    const meterTop = 16;
    const meterH = height - 36;
    const singleMeterW = 8;

    // Left meter
    ctx.fillStyle = '#111';
    ctx.fillRect(meterX, meterTop, singleMeterW, meterH);
    const leftLevel = smoothedStereoRef.current.left;
    const leftFillH = leftLevel * meterH;
    const leftGrad = createMeterGradient(ctx, meterX, meterTop + meterH, meterTop + meterH - leftFillH);
    ctx.fillStyle = leftGrad;
    ctx.fillRect(meterX, meterTop + meterH - leftFillH, singleMeterW, leftFillH);

    // Right meter
    const rightMeterX = meterX + singleMeterW + 4;
    ctx.fillStyle = '#111';
    ctx.fillRect(rightMeterX, meterTop, singleMeterW, meterH);
    const rightLevel = smoothedStereoRef.current.right;
    const rightFillH = rightLevel * meterH;
    const rightGrad = createMeterGradient(ctx, rightMeterX, meterTop + meterH, meterTop + meterH - rightFillH);
    ctx.fillStyle = rightGrad;
    ctx.fillRect(rightMeterX, meterTop + meterH - rightFillH, singleMeterW, rightFillH);

    // L/R labels
    ctx.fillStyle = '#555';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('L', meterX + singleMeterW / 2, height - 6);
    ctx.fillText('R', rightMeterX + singleMeterW / 2, height - 6);

    // Meter scale markers
    ctx.fillStyle = '#333';
    [0, 0.25, 0.5, 0.75, 1].forEach(level => {
      const y = meterTop + meterH * (1 - level);
      ctx.fillRect(meterX + singleMeterW + 1, y, 2, 1);
    });

    // ========== DRAW PEAK METER (RIGHT SIDE) ==========
    const peakMeterX = width - meterWidth - 8;
    const peakMeterW = 10;

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(peakMeterX, meterTop, peakMeterW, meterH);

    // Overall peak calculation
    const currentPeak = Math.max(...levels);
    if (currentPeak > overallPeakRef.current) {
      overallPeakRef.current = currentPeak;
      overallPeakHoldRef.current = 30;
      overallPeakDecayRef.current = 0;
    } else if (overallPeakHoldRef.current > 0) {
      overallPeakHoldRef.current--;
    } else {
      overallPeakDecayRef.current += 0.003;
      overallPeakRef.current = Math.max(0, overallPeakRef.current - overallPeakDecayRef.current);
    }

    // Fill
    const peakFillH = overallPeakRef.current * meterH;
    const peakGrad = createMeterGradient(ctx, peakMeterX, meterTop + meterH, meterTop + meterH - peakFillH);
    ctx.fillStyle = peakGrad;
    ctx.fillRect(peakMeterX, meterTop + meterH - peakFillH, peakMeterW, peakFillH);

    // Peak hold line
    const peakHoldY = meterTop + meterH * (1 - overallPeakRef.current);
    ctx.fillStyle = getMeterColor(overallPeakRef.current);
    ctx.fillRect(peakMeterX - 2, peakHoldY - 1, peakMeterW + 4, 2);

    // dB readout
    const peakDb = overallPeakRef.current > 0 ? Math.round(20 * Math.log10(overallPeakRef.current)) : -60;
    ctx.fillStyle = overallPeakRef.current > 0.85 ? '#ef4444' : '#666';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(peakDb > -60 ? `${peakDb}` : '-∞', peakMeterX + peakMeterW / 2, 12);
    ctx.fillStyle = '#444';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillText('dB', peakMeterX + peakMeterW / 2, height - 6);

  }, [isLoaded, eqValues, disabled, draggingIndex, generateSimulatedData, generateStereoLevels, dbToY]);

  // Animation loop
  useEffect(() => {
    let running = true;

    const animate = () => {
      if (!running) return;
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      draw();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [draw]);

  // Mouse handlers for EQ dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Layout constants (must match draw function)
    const meterWidth = 20;
    const meterGap = 8;
    const leftMeterArea = meterWidth * 2 + meterGap + 16;
    const rightMeterArea = meterWidth + 24;
    const graphStartX = leftMeterArea;
    const graphEndX = rect.width - rightMeterArea;
    const graphWidth = graphEndX - graphStartX;
    const eqTop = rect.height * 0.45;
    const eqHeight = rect.height * 0.55;

    // Check if click is in EQ area
    if (y < eqTop || y > rect.height - 20) return;

    // Find closest node
    for (let i = 0; i < 10; i++) {
      const nodeX = graphStartX + (i / 9) * graphWidth;
      const nodeY = eqTop + eqHeight / 2 - (eqValues[i] / 12) * (eqHeight / 2 - 8);

      const dist = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      if (dist < 15) {
        setDraggingIndex(i);
        e.preventDefault();
        return;
      }
    }
  }, [disabled, eqValues]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingIndex === null || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const eqTop = rect.height * 0.45;
    const eqHeight = rect.height * 0.55;

    const newDb = Math.round(((eqTop + eqHeight / 2 - y) / (eqHeight / 2 - 8)) * 12);
    const clampedDb = Math.max(-12, Math.min(12, newDb));

    onEQChange(draggingIndex, clampedDb);
  }, [draggingIndex, onEQChange]);

  const handleMouseUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (disabled || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const meterWidth = 20;
    const meterGap = 8;
    const leftMeterArea = meterWidth * 2 + meterGap + 16;
    const rightMeterArea = meterWidth + 24;
    const graphStartX = leftMeterArea;
    const graphEndX = rect.width - rightMeterArea;
    const graphWidth = graphEndX - graphStartX;
    const eqTop = rect.height * 0.45;
    const eqHeight = rect.height * 0.55;

    if (y < eqTop || y > rect.height - 20) return;

    // Find closest node and reset it
    for (let i = 0; i < 10; i++) {
      const nodeX = graphStartX + (i / 9) * graphWidth;
      const nodeY = eqTop + eqHeight / 2 - (eqValues[i] / 12) * (eqHeight / 2 - 8);

      const dist = Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2);
      if (dist < 15) {
        onEQChange(i, 0);
        return;
      }
    }
  }, [disabled, eqValues, onEQChange]);

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#0a0a0a',
        cursor: disabled ? 'default' : (draggingIndex !== null ? 'grabbing' : 'default'),
      }}
    >
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
    </Box>
  );
};

export default UnifiedSpectrumEQ;
