/**
 * CompareView Component
 * Side-by-side and before/after comparison of image edits
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { styled } from '@mui/material/styles';

import type { ImageAdjustments, UserEditSnapshot, CompareMode } from '../../types/image';
import { DEFAULT_ADJUSTMENTS } from '../../types/image';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const CompareContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
  display: 'flex',
});

const ImagePanel = styled(Box)({
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const ImageLabel = styled(Chip)({
  position: 'absolute',
  top: 8,
  zIndex: 10,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: '#ffffff',
  fontSize: 11,
  height: 24,
});

const SplitHandle = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 4,
  backgroundColor: '#19abb5',
  cursor: 'ew-resize',
  zIndex: 20,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: '#19abb5',
    border: '3px solid #ffffff',
  },
  '&::after': {
    content: '"⟨⟩"',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

const HorizontalSplitHandle = styled(Box)({
  position: 'absolute',
  left: 0,
  right: 0,
  height: 4,
  backgroundColor: '#19abb5',
  cursor: 'ns-resize',
  zIndex: 20,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: '#19abb5',
    border: '3px solid #ffffff',
  },
});

const CompareCanvas = styled('canvas')({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const adjustmentsToFilter = (adj: ImageAdjustments): string => {
  const filters: string[] = [];
  const brightness = 1 + adj.exposure * 0.2;
  filters.push(`brightness(${brightness})`);
  const contrast = 1 + adj.contrast / 100;
  filters.push(`contrast(${contrast})`);
  const saturation = 1 + adj.saturation / 100;
  filters.push(`saturate(${saturation})`);
  if (adj.temperature !== 0) {
    const hueRotate = adj.temperature * 0.3;
    filters.push(`hue-rotate(${hueRotate}deg)`);
  }
  return filters.join(' ');
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface CompareViewProps {
  imageUrl: string | null;
  imageElement: HTMLImageElement | null;
  compareMode: CompareMode;
  currentAdjustments: ImageAdjustments;
  userEdits: UserEditSnapshot[];
  compareEditIds: [string | null, string | null];
  onSplitPositionChange?: (position: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const CompareView: React.FC<CompareViewProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  imageUrl: _imageUrl,
  imageElement,
  compareMode,
  currentAdjustments,
  userEdits,
  compareEditIds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  // Get edits for comparison
  const leftEdit = compareEditIds[0]
    ? userEdits.find((e) => e.id === compareEditIds[0])
    : null;
  const rightEdit = compareEditIds[1]
    ? userEdits.find((e) => e.id === compareEditIds[1])
    : null;

  // Determine adjustments for each side
  const leftAdjustments = useMemo(() => {
    if (compareMode === 'before-after') {
      return DEFAULT_ADJUSTMENTS; // Original
    }
    return leftEdit?.adjustments || DEFAULT_ADJUSTMENTS;
  }, [compareMode, leftEdit]);

  const rightAdjustments = useMemo(() => {
    if (compareMode === 'before-after') {
      return currentAdjustments; // Current edit
    }
    return rightEdit?.adjustments || currentAdjustments;
  }, [compareMode, rightEdit, currentAdjustments]);

  // Labels for display
  const leftLabel = useMemo(() => {
    if (compareMode === 'before-after') return 'Original';
    return leftEdit?.recipeName || 'A';
  }, [compareMode, leftEdit]);

  const rightLabel = useMemo(() => {
    if (compareMode === 'before-after') return 'Edited';
    return rightEdit?.recipeName || 'B';
  }, [compareMode, rightEdit]);

  // Draw image with adjustments on canvas
  const drawImageWithAdjustments = useCallback(
    (canvas: HTMLCanvasElement, adjustments: ImageAdjustments) => {
      if (!imageElement || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { naturalWidth, naturalHeight } = imageElement;
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;

      ctx.clearRect(0, 0, naturalWidth, naturalHeight);
      ctx.filter = adjustmentsToFilter(adjustments);
      ctx.drawImage(imageElement, 0, 0);
    },
    [imageElement]
  );

  // Render canvases
  useEffect(() => {
    if (!imageElement) return;

    if (leftCanvasRef.current) {
      drawImageWithAdjustments(leftCanvasRef.current, leftAdjustments);
    }
    if (rightCanvasRef.current) {
      drawImageWithAdjustments(rightCanvasRef.current, rightAdjustments);
    }
  }, [imageElement, leftAdjustments, rightAdjustments, drawImageWithAdjustments]);

  // Handle split drag
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const isHorizontal = compareMode === 'split-horizontal';

      if (isHorizontal) {
        const y = e.clientY - rect.top;
        const percentage = (y / rect.height) * 100;
        setSplitPosition(Math.max(10, Math.min(90, percentage)));
      } else {
        const x = e.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        setSplitPosition(Math.max(10, Math.min(90, percentage)));
      }
    },
    [isDragging, compareMode]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
    return undefined;
  }, [isDragging, handleMouseUp]);

  // Render based on compare mode
  if (compareMode === 'side-by-side') {
    return (
      <CompareContainer ref={containerRef}>
        <ImagePanel sx={{ flex: 1, borderRight: '2px solid #2b2b2b' }}>
          <ImageLabel label={leftLabel} sx={{ left: 8 }} />
          <CompareCanvas ref={leftCanvasRef} />
        </ImagePanel>
        <ImagePanel sx={{ flex: 1 }}>
          <ImageLabel label={rightLabel} sx={{ right: 8 }} />
          <CompareCanvas ref={rightCanvasRef} />
        </ImagePanel>
      </CompareContainer>
    );
  }

  if (compareMode === 'split-vertical') {
    return (
      <CompareContainer
        ref={containerRef}
        onMouseMove={handleMouseMove}
        sx={{ cursor: isDragging ? 'ew-resize' : 'default' }}
      >
        {/* Left side - clipped */}
        <ImagePanel
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${splitPosition}%`,
            height: '100%',
            clipPath: 'inset(0)',
          }}
        >
          <ImageLabel label={leftLabel} sx={{ left: 8 }} />
          <CompareCanvas ref={leftCanvasRef} />
        </ImagePanel>

        {/* Right side - full width, clipped from left */}
        <ImagePanel
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            clipPath: `inset(0 0 0 ${splitPosition}%)`,
          }}
        >
          <ImageLabel label={rightLabel} sx={{ right: 8 }} />
          <CompareCanvas ref={rightCanvasRef} />
        </ImagePanel>

        {/* Split handle */}
        <SplitHandle
          sx={{ left: `${splitPosition}%`, transform: 'translateX(-50%)' }}
          onMouseDown={handleMouseDown}
        />
      </CompareContainer>
    );
  }

  if (compareMode === 'split-horizontal') {
    return (
      <CompareContainer
        ref={containerRef}
        onMouseMove={handleMouseMove}
        sx={{ cursor: isDragging ? 'ns-resize' : 'default', flexDirection: 'column' }}
      >
        {/* Top side - clipped */}
        <ImagePanel
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${splitPosition}%`,
            clipPath: 'inset(0)',
          }}
        >
          <ImageLabel label={leftLabel} sx={{ left: 8 }} />
          <CompareCanvas ref={leftCanvasRef} />
        </ImagePanel>

        {/* Bottom side - full height, clipped from top */}
        <ImagePanel
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            clipPath: `inset(${splitPosition}% 0 0 0)`,
          }}
        >
          <ImageLabel label={rightLabel} sx={{ left: 8, top: 'auto', bottom: 8 }} />
          <CompareCanvas ref={rightCanvasRef} />
        </ImagePanel>

        {/* Split handle */}
        <HorizontalSplitHandle
          sx={{ top: `${splitPosition}%`, transform: 'translateY(-50%)' }}
          onMouseDown={handleMouseDown}
        />
      </CompareContainer>
    );
  }

  // before-after mode (same as split-vertical by default)
  return (
    <CompareContainer
      ref={containerRef}
      onMouseMove={handleMouseMove}
      sx={{ cursor: isDragging ? 'ew-resize' : 'default' }}
    >
      {/* Original - clipped */}
      <ImagePanel
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${splitPosition}%`,
          height: '100%',
          clipPath: 'inset(0)',
        }}
      >
        <ImageLabel
          label="Original"
          sx={{ left: 8, backgroundColor: 'rgba(100, 100, 100, 0.8)' }}
        />
        <CompareCanvas ref={leftCanvasRef} />
      </ImagePanel>

      {/* Edited - full width, clipped from left */}
      <ImagePanel
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          clipPath: `inset(0 0 0 ${splitPosition}%)`,
        }}
      >
        <ImageLabel
          label="Edited"
          sx={{ right: 8, backgroundColor: 'rgba(25, 171, 181, 0.8)' }}
        />
        <CompareCanvas ref={rightCanvasRef} />
      </ImagePanel>

      {/* Split handle */}
      <SplitHandle
        sx={{ left: `${splitPosition}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
      />

      {/* Instructions */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          px: 2,
          py: 0.5,
          borderRadius: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: '#888888' }}>
          Drag the slider to compare
        </Typography>
      </Box>
    </CompareContainer>
  );
};

export default CompareView;
