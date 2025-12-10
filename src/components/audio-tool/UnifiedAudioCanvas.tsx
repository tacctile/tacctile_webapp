import React, { useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

interface UnifiedAudioCanvasProps {
  isLoaded: boolean;
  duration: number; // seconds
}

// Styled container - fills available space
const CanvasContainer = styled(Box)({
  flex: 1,
  position: 'relative',
  backgroundColor: '#0a0a0a',
  minHeight: 200,
  overflow: 'hidden',
});

export const UnifiedAudioCanvas: React.FC<UnifiedAudioCanvasProps> = ({
  isLoaded,
  duration,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw spectral visualization
  const drawSpectral = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
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

    // Generate spectral visualization (purple/teal northern lights style)
    const numBars = Math.floor(width / 3);

    for (let i = 0; i < numBars; i++) {
      const x = (i / numBars) * width;
      const barWidth = width / numBars;

      // Create varying intensities for visual interest
      const time = i / numBars;
      const intensity1 = Math.sin(time * Math.PI * 4) * 0.3 + 0.5;
      const intensity2 = Math.cos(time * Math.PI * 6 + 1) * 0.25 + 0.5;
      const intensity3 = Math.sin(time * Math.PI * 2 + 2) * 0.35 + 0.4;

      // Draw gradient bars from bottom to top
      const gradient = ctx.createLinearGradient(x, height, x, 0);

      // Purple/magenta base
      gradient.addColorStop(0, `rgba(60, 20, 80, ${intensity1})`);
      gradient.addColorStop(0.3, `rgba(100, 40, 120, ${intensity2})`);
      // Teal/cyan mid
      gradient.addColorStop(0.5, `rgba(20, 100, 120, ${intensity2})`);
      gradient.addColorStop(0.7, `rgba(40, 150, 140, ${intensity3})`);
      // Yellow/green peaks
      gradient.addColorStop(0.85, `rgba(80, 180, 100, ${intensity3 * 0.7})`);
      gradient.addColorStop(1, `rgba(200, 220, 80, ${intensity1 * 0.5})`);

      ctx.fillStyle = gradient;

      // Vary bar heights based on mock audio data
      const barHeight = height * (0.3 + intensity1 * 0.7);
      ctx.fillRect(x, height - barHeight, barWidth + 1, barHeight);
    }

    // Add some noise/grain for texture
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 15;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

  }, [isLoaded]);

  // Draw on mount and when dependencies change
  useEffect(() => {
    drawSpectral();
  }, [drawSpectral]);

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => drawSpectral();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawSpectral]);

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
      {!isLoaded && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <Typography sx={{ color: '#444', fontSize: 14 }}>
            No audio loaded
          </Typography>
        </Box>
      )}
    </CanvasContainer>
  );
};

export default UnifiedAudioCanvas;
