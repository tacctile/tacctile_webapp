import React, { useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const CanvasContainer = styled(Box)({
  flex: 1,
  position: 'relative',
  backgroundColor: '#0a0a0a',
  minHeight: 0,
  overflow: 'hidden',
});

const EmptyState = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedAudioCanvasProps {
  /** Whether audio is loaded */
  isLoaded: boolean;
  /** Total duration in seconds */
  duration: number;
}

// ============================================================================
// SPECTRAL DATA GENERATION
// ============================================================================

/**
 * Generates mock spectral data for visualization
 * Returns a 2D array: [timeSlice][frequencyBin] with values 0-1
 */
const generateSpectralData = (
  numTimeSlices: number,
  numFrequencyBins: number
): Float32Array[] => {
  const data: Float32Array[] = [];

  // Create some persistent patterns for realistic look
  let phase = 0;
  let envelope = 0.4;
  let envelopeTarget = 0.5;

  for (let t = 0; t < numTimeSlices; t++) {
    const slice = new Float32Array(numFrequencyBins);
    const timeRatio = t / numTimeSlices;

    // Slowly vary envelope for dynamics
    if (Math.random() < 0.02) {
      envelopeTarget = 0.2 + Math.random() * 0.6;
    }
    envelope += (envelopeTarget - envelope) * 0.05;

    // Add quiet sections
    let sectionMultiplier = 1;
    if (timeRatio > 0.15 && timeRatio < 0.18) sectionMultiplier = 0.1;
    if (timeRatio > 0.45 && timeRatio < 0.47) sectionMultiplier = 0.05;
    if (timeRatio > 0.72 && timeRatio < 0.74) sectionMultiplier = 0.15;

    for (let f = 0; f < numFrequencyBins; f++) {
      const freqRatio = f / numFrequencyBins;

      // Base frequency distribution (more energy in low-mids)
      const freqWeight = Math.exp(-freqRatio * 2) * 0.7 + 0.3;

      // Harmonic patterns
      const harmonic1 = Math.sin(phase + freqRatio * 10) * 0.3;
      const harmonic2 = Math.sin(phase * 0.7 + freqRatio * 20) * 0.2;
      const harmonic3 = Math.sin(phase * 1.3 + freqRatio * 5) * 0.15;

      // Random noise component
      const noise = (Math.random() - 0.5) * 0.4;

      // Combine all components
      let value = (harmonic1 + harmonic2 + harmonic3 + noise + 0.5) * freqWeight * envelope * sectionMultiplier;

      // Add occasional bright spots (transients)
      if (Math.random() < 0.001) {
        value += 0.5 + Math.random() * 0.5;
      }

      // Clamp to 0-1
      slice[f] = Math.max(0, Math.min(1, value));
    }

    data.push(slice);
    phase += 0.02 + Math.random() * 0.01;
  }

  return data;
};

// ============================================================================
// WAVEFORM DATA GENERATION
// ============================================================================

/**
 * Generates realistic-looking waveform data
 * Returns an array of amplitude values (-1 to 1)
 */
const generateWaveformData = (numSamples: number): Float32Array => {
  const data = new Float32Array(numSamples);

  // Create realistic audio-like patterns with varying amplitude
  let phase = 0;
  let envelope = 0.3;
  let envelopeTarget = 0.5;

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;

    // Slowly vary the envelope (creates loud/quiet sections)
    if (Math.random() < 0.001) {
      envelopeTarget = 0.1 + Math.random() * 0.8;
    }
    envelope += (envelopeTarget - envelope) * 0.0001;

    // Mix multiple frequencies for realistic audio appearance
    const f1 = Math.sin(phase * 0.1) * 0.4;
    const f2 = Math.sin(phase * 0.37) * 0.3;
    const f3 = Math.sin(phase * 1.3) * 0.2;
    const f4 = Math.sin(phase * 3.7) * 0.1;

    // Add some noise
    const noise = (Math.random() - 0.5) * 0.3;

    // Combine and apply envelope
    let sample = (f1 + f2 + f3 + f4 + noise) * envelope;

    // Add occasional transients (like drum hits)
    if (Math.random() < 0.0005) {
      sample += (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
    }

    // Add some quiet sections (matching spectral quiet sections)
    if (t > 0.15 && t < 0.18) sample *= 0.1;
    if (t > 0.45 && t < 0.47) sample *= 0.05;
    if (t > 0.72 && t < 0.74) sample *= 0.15;

    // Clamp to -1, 1
    data[i] = Math.max(-1, Math.min(1, sample));

    phase += 0.01 + Math.random() * 0.02;
  }

  return data;
};

/**
 * Converts intensity (0-1) to spectral color (dark purple -> orange -> yellow)
 */
const intensityToColor = (intensity: number): string => {
  // iZotope RX-style color gradient
  if (intensity < 0.1) {
    // Very dark - near black with slight purple
    const v = intensity * 10;
    return `rgb(${Math.floor(10 + v * 15)}, ${Math.floor(5 + v * 5)}, ${Math.floor(20 + v * 20)})`;
  } else if (intensity < 0.3) {
    // Dark purple to blue
    const v = (intensity - 0.1) / 0.2;
    return `rgb(${Math.floor(25 + v * 30)}, ${Math.floor(10 + v * 20)}, ${Math.floor(40 + v * 60)})`;
  } else if (intensity < 0.5) {
    // Blue to green
    const v = (intensity - 0.3) / 0.2;
    return `rgb(${Math.floor(55 - v * 30)}, ${Math.floor(30 + v * 80)}, ${Math.floor(100 - v * 50)})`;
  } else if (intensity < 0.7) {
    // Green to yellow
    const v = (intensity - 0.5) / 0.2;
    return `rgb(${Math.floor(25 + v * 180)}, ${Math.floor(110 + v * 100)}, ${Math.floor(50 - v * 40)})`;
  } else if (intensity < 0.85) {
    // Yellow to orange
    const v = (intensity - 0.7) / 0.15;
    return `rgb(${Math.floor(205 + v * 50)}, ${Math.floor(210 - v * 80)}, ${Math.floor(10)})`;
  } else {
    // Orange to bright yellow/white (peaks)
    const v = (intensity - 0.85) / 0.15;
    return `rgb(255, ${Math.floor(130 + v * 125)}, ${Math.floor(10 + v * 100)})`;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const UnifiedAudioCanvas: React.FC<UnifiedAudioCanvasProps> = ({
  isLoaded,
  duration,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spectralDataRef = useRef<Float32Array[] | null>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);

  // Generate spectral data when loaded
  const getSpectralData = useCallback((width: number, height: number): Float32Array[] => {
    const numTimeSlices = Math.max(width, 200);
    const numFrequencyBins = Math.max(Math.floor(height / 2), 64);

    if (
      spectralDataRef.current &&
      spectralDataRef.current.length === numTimeSlices &&
      spectralDataRef.current[0]?.length === numFrequencyBins
    ) {
      return spectralDataRef.current;
    }

    spectralDataRef.current = generateSpectralData(numTimeSlices, numFrequencyBins);
    return spectralDataRef.current;
  }, []);

  // Generate waveform data when loaded
  const getWaveformData = useCallback((width: number): Float32Array => {
    const numSamples = Math.max(width * 2, 500);

    if (waveformDataRef.current && waveformDataRef.current.length === numSamples) {
      return waveformDataRef.current;
    }

    waveformDataRef.current = generateWaveformData(numSamples);
    return waveformDataRef.current;
  }, []);

  // Draw canvas (spectral + waveform)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with device pixel ratio for sharpness
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

    if (!isLoaded) {
      return; // Empty state is handled by overlay
    }

    // ========================================
    // LAYER 1: Spectral (background)
    // ========================================
    const spectralData = getSpectralData(width, height);
    const numTimeSlices = spectralData.length;
    const numFrequencyBins = spectralData[0]?.length || 64;
    const sliceWidth = width / numTimeSlices;

    for (let t = 0; t < numTimeSlices; t++) {
      const slice = spectralData[t];
      const x = t * sliceWidth;

      for (let f = 0; f < numFrequencyBins; f++) {
        const intensity = slice[f];
        const binHeight = height / numFrequencyBins;
        const y = f * binHeight;

        ctx.fillStyle = intensityToColor(intensity);
        ctx.fillRect(x, y, sliceWidth + 0.5, binHeight + 0.5);
      }
    }

    // ========================================
    // LAYER 2: Waveform (foreground with transparency)
    // ========================================
    const waveformData = getWaveformData(width);
    const waveformColor = 'rgba(25, 171, 181, 0.6)'; // Teal with 60% opacity

    ctx.fillStyle = waveformColor;
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    // Draw top half (positive values)
    for (let i = 0; i < width; i++) {
      // Sample the waveform data for this pixel
      const sampleIndex = Math.floor((i / width) * waveformData.length);
      const nextSampleIndex = Math.floor(((i + 1) / width) * waveformData.length);

      // Get min/max for this pixel column for better rendering
      let maxVal = 0;
      for (let j = sampleIndex; j < nextSampleIndex && j < waveformData.length; j++) {
        const absVal = Math.abs(waveformData[j]);
        if (absVal > maxVal) maxVal = absVal;
      }

      // Scale amplitude to fit in canvas (use 80% of half-height for visual appeal)
      const yOffset = maxVal * (centerY - 4) * 0.8;
      const yTop = centerY - yOffset;

      ctx.lineTo(i, yTop);
    }

    // Draw bottom half (mirror)
    for (let i = width - 1; i >= 0; i--) {
      const sampleIndex = Math.floor((i / width) * waveformData.length);
      const nextSampleIndex = Math.floor(((i + 1) / width) * waveformData.length);

      let maxVal = 0;
      for (let j = sampleIndex; j < nextSampleIndex && j < waveformData.length; j++) {
        const absVal = Math.abs(waveformData[j]);
        if (absVal > maxVal) maxVal = absVal;
      }

      const yOffset = maxVal * (centerY - 4) * 0.8;
      const yBottom = centerY + yOffset;

      ctx.lineTo(i, yBottom);
    }

    ctx.closePath();
    ctx.fill();

    // Add a subtle stroke for definition
    ctx.strokeStyle = 'rgba(25, 171, 181, 0.8)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }, [isLoaded, getSpectralData, getWaveformData]);

  // Initial draw and resize handling
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    const handleResize = () => drawCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  // Redraw when isLoaded changes
  useEffect(() => {
    // Regenerate data when loading state changes
    spectralDataRef.current = null;
    waveformDataRef.current = null;
    drawCanvas();
  }, [isLoaded, drawCanvas]);

  return (
    <CanvasContainer ref={containerRef}>
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

      {/* Empty state overlay */}
      {!isLoaded && (
        <EmptyState>
          <Typography sx={{ color: '#333', fontSize: 14 }}>
            No audio loaded
          </Typography>
        </EmptyState>
      )}
    </CanvasContainer>
  );
};

export default UnifiedAudioCanvas;
