/**
 * SpectrumAnalyzer Component
 * Real-time frequency spectrum visualization using Web Audio API
 * Displays animated frequency bars with peak indicators
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface SpectrumAnalyzerProps {
  /** Whether audio is loaded and ready */
  isLoaded: boolean;
  /** Audio context for Web Audio API (optional - will use simulated data if not provided) */
  audioContext?: AudioContext | null;
  /** Audio source node to analyze (optional) */
  sourceNode?: AudioNode | null;
  /** Number of frequency bars to display */
  barCount?: number;
  /** Whether to show frequency labels */
  showLabels?: boolean;
  /** Whether to show peak indicators */
  showPeaks?: boolean;
  /** Accent color for bars */
  accentColor?: string;
}

// Frequency labels for display (logarithmic distribution)
const FREQUENCY_LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  isLoaded,
  audioContext,
  sourceNode,
  barCount = 64,
  showLabels = true,
  showPeaks = true,
  accentColor = '#19abb5',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const peakLevelsRef = useRef<number[]>([]);
  const peakDecayRef = useRef<number[]>([]);

  // Simulated frequency data for when no real audio is connected
  const [simulatedData, setSimulatedData] = useState<number[]>([]);
  const simulationPhaseRef = useRef(0);

  // Initialize analyzer when audio context and source are available
  useEffect(() => {
    if (audioContext && sourceNode) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256; // Gives us 128 frequency bins
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      sourceNode.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      return () => {
        analyser.disconnect();
      };
    }
  }, [audioContext, sourceNode]);

  // Initialize peak arrays
  useEffect(() => {
    peakLevelsRef.current = new Array(barCount).fill(0);
    peakDecayRef.current = new Array(barCount).fill(0);
  }, [barCount]);

  // Generate simulated frequency data for demo/preview
  const generateSimulatedData = useCallback(() => {
    if (!isLoaded) return [];

    const data: number[] = [];
    simulationPhaseRef.current += 0.05;
    const phase = simulationPhaseRef.current;

    for (let i = 0; i < barCount; i++) {
      // Create a natural-looking frequency distribution
      // More energy in low-mids, less in highs
      const freqPosition = i / barCount;
      const baseCurve = Math.exp(-freqPosition * 2) * 0.7 + 0.1;

      // Add some movement/variation
      const wave1 = Math.sin(phase + i * 0.3) * 0.15;
      const wave2 = Math.sin(phase * 1.7 + i * 0.5) * 0.1;
      const wave3 = Math.sin(phase * 0.5 + i * 0.1) * 0.2;

      // Random variation for organic feel
      const noise = (Math.random() - 0.5) * 0.1;

      // Combine all factors
      let level = baseCurve + wave1 + wave2 + wave3 + noise;

      // Add occasional "beats" in low frequencies
      if (i < barCount * 0.3 && Math.sin(phase * 2) > 0.7) {
        level += 0.2;
      }

      // Clamp to 0-1
      level = Math.max(0, Math.min(1, level));

      data.push(level);
    }

    return data;
  }, [isLoaded, barCount]);

  // Animation loop for simulated data
  useEffect(() => {
    if (!isLoaded || (audioContext && sourceNode)) return;

    const animate = () => {
      setSimulatedData(generateSimulatedData());
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isLoaded, audioContext, sourceNode, generateSimulatedData]);

  // Main drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const labelHeight = showLabels ? 20 : 0;
    const graphHeight = height - labelHeight;

    // Clear canvas
    ctx.fillStyle = '#000004';
    ctx.fillRect(0, 0, width, height);

    if (!isLoaded) {
      // Draw placeholder state
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No audio loaded', width / 2, height / 2);
      return;
    }

    // Get frequency data
    let frequencyData: number[];

    if (analyserRef.current && dataArrayRef.current) {
      // Real audio data
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      frequencyData = Array.from(dataArrayRef.current).map(v => v / 255);
    } else {
      // Simulated data
      frequencyData = simulatedData;
    }

    if (frequencyData.length === 0) return;

    // Calculate bar dimensions
    const barWidth = (width - 40) / barCount; // 20px padding on each side
    const barGap = Math.max(1, barWidth * 0.15);
    const actualBarWidth = barWidth - barGap;
    const startX = 20;

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      // Map frequency data to bar (logarithmic mapping for better visualization)
      const dataIndex = Math.floor(Math.pow(i / barCount, 1.5) * frequencyData.length);
      const level = frequencyData[Math.min(dataIndex, frequencyData.length - 1)] || 0;

      const barHeight = level * (graphHeight - 10);
      const x = startX + i * barWidth;
      const y = graphHeight - barHeight;

      // Create gradient for bar
      const gradient = ctx.createLinearGradient(0, graphHeight, 0, y);

      // Color gradient: dark at bottom, accent color at top, with intensity based on level
      const intensity = Math.min(1, level * 1.2);
      gradient.addColorStop(0, `rgba(25, 171, 181, ${0.3 * intensity})`);
      gradient.addColorStop(0.5, `rgba(25, 171, 181, ${0.6 * intensity})`);
      gradient.addColorStop(1, `rgba(25, 171, 181, ${0.9 * intensity})`);

      // Draw bar with rounded top
      ctx.fillStyle = gradient;
      ctx.beginPath();
      const radius = Math.min(actualBarWidth / 2, 3);
      ctx.moveTo(x, graphHeight);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + actualBarWidth - radius, y);
      ctx.quadraticCurveTo(x + actualBarWidth, y, x + actualBarWidth, y + radius);
      ctx.lineTo(x + actualBarWidth, graphHeight);
      ctx.closePath();
      ctx.fill();

      // Add glow effect for high levels
      if (level > 0.6) {
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 8 * (level - 0.6) / 0.4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Update and draw peak indicators
      if (showPeaks) {
        // Update peak level
        if (level > peakLevelsRef.current[i]) {
          peakLevelsRef.current[i] = level;
          peakDecayRef.current[i] = 0;
        } else {
          peakDecayRef.current[i] += 0.02;
          peakLevelsRef.current[i] = Math.max(0, peakLevelsRef.current[i] - peakDecayRef.current[i] * 0.05);
        }

        const peakY = graphHeight - peakLevelsRef.current[i] * (graphHeight - 10);

        // Draw peak indicator
        ctx.fillStyle = peakLevelsRef.current[i] > 0.85 ? '#ff6b6b' : '#ffffff';
        ctx.fillRect(x, peakY - 2, actualBarWidth, 2);
      }
    }

    // Draw frequency labels
    if (showLabels) {
      ctx.fillStyle = '#555';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      const labelPositions = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.95];
      labelPositions.forEach((pos, i) => {
        if (FREQUENCY_LABELS[i]) {
          const x = startX + pos * (width - 40);
          ctx.fillText(FREQUENCY_LABELS[i], x, height - 4);
        }
      });
    }

    // Draw dB scale on left
    ctx.fillStyle = '#333';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('0dB', 16, 12);
    ctx.fillText('-∞', 16, graphHeight - 2);
  }, [isLoaded, simulatedData, barCount, showLabels, showPeaks, accentColor]);

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
        backgroundColor: '#000004',
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

      {/* Corner label */}
      <Typography
        sx={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontSize: 9,
          color: '#444',
          fontFamily: '"JetBrains Mono", monospace',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Spectrum
      </Typography>
    </Box>
  );
};

export default SpectrumAnalyzer;
