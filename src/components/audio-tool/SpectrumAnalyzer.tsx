/**
 * SpectrumAnalyzer Component
 * Real-time frequency spectrum visualization with integrated level meters
 * Designed to align with EQ section below
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface SpectrumAnalyzerProps {
  isLoaded: boolean;
  audioContext?: AudioContext | null;
  sourceNode?: AudioNode | null;
  accentColor?: string;
}

// EQ frequency bands to match (same as EQ component)
const EQ_FREQUENCIES = [60, 125, 250, 500, 1000, 2000, 4000, 6000, 8000, 16000];

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  isLoaded,
  audioContext,
  sourceNode,
  accentColor = '#19abb5',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  // Smoothed values for interpolation
  const smoothedLevelsRef = useRef<number[]>(new Array(10).fill(0));
  const smoothedStereoRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const peakLevelsRef = useRef<number[]>(new Array(10).fill(0));
  const peakDecayRef = useRef<number[]>(new Array(10).fill(0));
  const peakHoldRef = useRef<number[]>(new Array(10).fill(0));

  // Simulated data phase
  const phaseRef = useRef(0);

  // Generate smooth simulated frequency data
  const generateSimulatedData = useCallback((): number[] => {
    if (!isLoaded) return new Array(10).fill(0);

    phaseRef.current += 0.03; // Slower phase for smoother animation
    const phase = phaseRef.current;

    return EQ_FREQUENCIES.map((freq, i) => {
      // Natural frequency distribution curve
      const normalizedFreq = Math.log10(freq) / Math.log10(20000);
      const baseCurve = Math.exp(-normalizedFreq * 1.5) * 0.6 + 0.15;

      // Smooth sine waves for movement
      const wave1 = Math.sin(phase * 0.8 + i * 0.4) * 0.12;
      const wave2 = Math.sin(phase * 1.3 + i * 0.7) * 0.08;
      const wave3 = Math.sin(phase * 0.4 + i * 0.2) * 0.15;

      // Subtle variation
      const variation = Math.sin(phase * 2 + i) * 0.05;

      let level = baseCurve + wave1 + wave2 + wave3 + variation;

      // Occasional gentle pulses in bass
      if (i < 3 && Math.sin(phase * 1.5) > 0.6) {
        level += 0.15 * (1 - i / 3);
      }

      return Math.max(0.02, Math.min(0.95, level));
    });
  }, [isLoaded]);

  // Generate simulated stereo levels
  const generateStereoLevels = useCallback((): { left: number; right: number } => {
    if (!isLoaded) return { left: 0, right: 0 };

    const phase = phaseRef.current;
    const baseLevel = 0.5 + Math.sin(phase * 0.7) * 0.2;

    return {
      left: Math.max(0.1, Math.min(0.9, baseLevel + Math.sin(phase * 1.1) * 0.15)),
      right: Math.max(0.1, Math.min(0.9, baseLevel + Math.sin(phase * 1.3 + 0.5) * 0.15)),
    };
  }, [isLoaded]);

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

    // Layout constants (matching EQ section - uses 5% to 95% positioning)
    // The EQ uses percentage-based positioning with bars at 5% to 95%
    const graphStartX = width * 0.05;  // 5% from left
    const graphEndX = width * 0.95;    // 95% from left
    const graphWidth = graphEndX - graphStartX; // 90% of width
    const graphHeight = height - 8; // Small top/bottom padding

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (!isLoaded) {
      ctx.fillStyle = '#333';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No audio loaded', width / 2, height / 2);
      return;
    }

    // Get frequency data (simulated for now)
    const rawLevels = generateSimulatedData();
    const stereoLevels = generateStereoLevels();

    // Smooth interpolation for levels (reduces jumpiness)
    const smoothingFactor = 0.15;
    rawLevels.forEach((level, i) => {
      smoothedLevelsRef.current[i] += (level - smoothedLevelsRef.current[i]) * smoothingFactor;
    });

    // Smooth stereo levels
    smoothedStereoRef.current.left += (stereoLevels.left - smoothedStereoRef.current.left) * smoothingFactor;
    smoothedStereoRef.current.right += (stereoLevels.right - smoothedStereoRef.current.right) * smoothingFactor;

    const levels = smoothedLevelsRef.current;

    // ========== DRAW LEVEL METERS (LEFT SIDE - in 0-5% area) ==========
    const meterAreaWidth = graphStartX - 4; // Available space in left margin
    const meterWidth = Math.max(4, Math.min(6, meterAreaWidth / 3));
    const meterGap = Math.max(2, meterWidth / 2);
    const meterHeight = graphHeight - 10;
    const meterY = 5;

    // Left channel meter - positioned in left margin
    const leftMeterX = (graphStartX - (meterWidth * 2 + meterGap)) / 2;
    const leftLevel = smoothedStereoRef.current.left;

    // Meter background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(leftMeterX, meterY, meterWidth, meterHeight);

    // Meter fill with gradient
    const leftFillHeight = leftLevel * meterHeight;
    const leftGradient = ctx.createLinearGradient(0, meterY + meterHeight, 0, meterY + meterHeight - leftFillHeight);
    leftGradient.addColorStop(0, 'rgba(25, 171, 181, 0.4)');
    leftGradient.addColorStop(0.7, 'rgba(25, 171, 181, 0.7)');
    leftGradient.addColorStop(1, leftLevel > 0.85 ? '#ff6b6b' : accentColor);
    ctx.fillStyle = leftGradient;
    ctx.fillRect(leftMeterX, meterY + meterHeight - leftFillHeight, meterWidth, leftFillHeight);

    // Right channel meter
    const rightMeterX = leftMeterX + meterWidth + meterGap;
    const rightLevel = smoothedStereoRef.current.right;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(rightMeterX, meterY, meterWidth, meterHeight);

    const rightFillHeight = rightLevel * meterHeight;
    const rightGradient = ctx.createLinearGradient(0, meterY + meterHeight, 0, meterY + meterHeight - rightFillHeight);
    rightGradient.addColorStop(0, 'rgba(25, 171, 181, 0.4)');
    rightGradient.addColorStop(0.7, 'rgba(25, 171, 181, 0.7)');
    rightGradient.addColorStop(1, rightLevel > 0.85 ? '#ff6b6b' : accentColor);
    ctx.fillStyle = rightGradient;
    ctx.fillRect(rightMeterX, meterY + meterHeight - rightFillHeight, meterWidth, rightFillHeight);

    // L/R labels
    ctx.fillStyle = '#444';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('L', leftMeterX + meterWidth / 2, height - 1);
    ctx.fillText('R', rightMeterX + meterWidth / 2, height - 1);

    // ========== DRAW SPECTRUM BARS ==========
    // Position bars to align with EQ nodes: bars centered at same X positions as EQ dots
    // EQ dots are at: 5 + (i / 9) * 90 percent for i = 0 to 9
    const barCount = levels.length;
    const maxBarWidth = graphWidth / barCount * 0.85; // Max width with some gap
    const actualBarWidth = Math.min(maxBarWidth, 24); // Cap at 24px for larger screens

    for (let i = 0; i < barCount; i++) {
      const level = levels[i];
      const barHeight = Math.max(2, level * (graphHeight - 4));
      // Center each bar at the same X position as the EQ dot
      const centerX = graphStartX + (i / (barCount - 1)) * graphWidth;
      const x = centerX - actualBarWidth / 2;
      const y = graphHeight - barHeight + 2;

      // Create gradient for bar
      const gradient = ctx.createLinearGradient(0, graphHeight, 0, y);
      const intensity = Math.min(1, level * 1.3);
      gradient.addColorStop(0, `rgba(25, 171, 181, ${0.2 * intensity})`);
      gradient.addColorStop(0.5, `rgba(25, 171, 181, ${0.5 * intensity})`);
      gradient.addColorStop(1, `rgba(25, 171, 181, ${0.85 * intensity})`);

      ctx.fillStyle = gradient;

      // Draw bar with subtle rounded corners
      const radius = Math.min(actualBarWidth / 2, 2);
      ctx.beginPath();
      ctx.moveTo(x, graphHeight + 2);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + actualBarWidth - radius, y);
      ctx.quadraticCurveTo(x + actualBarWidth, y, x + actualBarWidth, y + radius);
      ctx.lineTo(x + actualBarWidth, graphHeight + 2);
      ctx.closePath();
      ctx.fill();

      // Update peak levels with hold
      if (level > peakLevelsRef.current[i]) {
        peakLevelsRef.current[i] = level;
        peakHoldRef.current[i] = 30; // Hold for 30 frames
        peakDecayRef.current[i] = 0;
      } else if (peakHoldRef.current[i] > 0) {
        peakHoldRef.current[i]--;
      } else {
        peakDecayRef.current[i] += 0.003;
        peakLevelsRef.current[i] = Math.max(0, peakLevelsRef.current[i] - peakDecayRef.current[i]);
      }

      // Draw peak indicator line (slightly wider than bar for visibility)
      const peakY = graphHeight - peakLevelsRef.current[i] * (graphHeight - 4) + 2;
      const peakLineWidth = actualBarWidth + 4;
      ctx.fillStyle = peakLevelsRef.current[i] > 0.85 ? 'rgba(255, 107, 107, 0.9)' : 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(centerX - peakLineWidth / 2, peakY - 1, peakLineWidth, 2);
    }

    // ========== DRAW PEAK INDICATOR (RIGHT SIDE - in 95-100% area) ==========
    // Calculate overall peak
    const overallPeak = Math.max(...levels);
    const peakDb = overallPeak > 0 ? Math.round(20 * Math.log10(overallPeak)) : -60;

    // Right margin area
    const rightMarginStart = graphEndX + 4;
    const rightMarginWidth = width - rightMarginStart - 4;

    // Peak value display
    ctx.fillStyle = overallPeak > 0.85 ? '#ff6b6b' : '#666';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${peakDb > -60 ? peakDb : '-∞'}`, rightMarginStart + rightMarginWidth / 2, 12);
    ctx.fillStyle = '#444';
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillText('dB', rightMarginStart + rightMarginWidth / 2, 20);

    // Small peak meter
    const peakMeterWidth = Math.max(4, Math.min(6, rightMarginWidth / 2));
    const peakMeterX = rightMarginStart + (rightMarginWidth - peakMeterWidth) / 2;
    const peakMeterHeight = graphHeight - 34;
    const peakMeterY = 26;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(peakMeterX, peakMeterY, peakMeterWidth, peakMeterHeight);

    const peakFillHeight = overallPeak * peakMeterHeight;
    const peakGradient = ctx.createLinearGradient(0, peakMeterY + peakMeterHeight, 0, peakMeterY);
    peakGradient.addColorStop(0, 'rgba(25, 171, 181, 0.3)');
    peakGradient.addColorStop(0.8, accentColor);
    peakGradient.addColorStop(1, '#ff6b6b');
    ctx.fillStyle = peakGradient;
    ctx.fillRect(peakMeterX, peakMeterY + peakMeterHeight - peakFillHeight, peakMeterWidth, peakFillHeight);

  }, [isLoaded, generateSimulatedData, generateStereoLevels, accentColor]);

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

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#0a0a0a',
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

export default SpectrumAnalyzer;
