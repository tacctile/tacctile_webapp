/**
 * ImageCanvas Component
 * Main canvas for rendering images with non-destructive adjustments and annotations
 * Uses Canvas 2D with CSS filters for real-time preview
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import type {
  ImageAdjustments,
  CropSettings,
  ImageAnnotation,
  ImageToolType,
  CircleAnnotation,
  ArrowAnnotation,
  RectangleAnnotation,
  TextAnnotation,
  FreehandAnnotation,
  LineAnnotation,
  PolygonAnnotation,
} from '../../types/image';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const CanvasContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'grab',
  '&:active': {
    cursor: 'grabbing',
  },
});

const CanvasWrapper = styled(Box)({
  position: 'relative',
  transformOrigin: 'center center',
});

const StyledImageCanvas = styled('canvas')({
  display: 'block',
});

const AnnotationCanvas = styled('canvas')({
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
});

const CropOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface ImageCanvasProps {
  imageUrl: string | null;
  imageElement: HTMLImageElement | null;
  adjustments: ImageAdjustments;
  crop: CropSettings;
  annotations: ImageAnnotation[];
  selectedAnnotationId: string | null;
  activeTool: ImageToolType;
  zoom: number;
  panX: number;
  panY: number;
  fitToView: boolean;
  onImageLoad: (element: HTMLImageElement) => void;
  onPan: (x: number, y: number) => void;
  onAnnotationAdd: (annotation: Omit<ImageAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAnnotationSelect: (id: string | null) => void;
  onCropChange: (crop: Partial<CropSettings>) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert adjustments to CSS filter string
 */
const adjustmentsToFilter = (adj: ImageAdjustments): string => {
  const filters: string[] = [];

  // Brightness (exposure simulation) - map -5 to +5 to 0 to 2
  const brightness = 1 + adj.exposure * 0.2;
  filters.push(`brightness(${brightness})`);

  // Contrast - map -100 to +100 to 0 to 2
  const contrast = 1 + adj.contrast / 100;
  filters.push(`contrast(${contrast})`);

  // Saturation - map -100 to +100 to 0 to 2
  const saturation = 1 + adj.saturation / 100;
  filters.push(`saturate(${saturation})`);

  // Temperature (hue-rotate approximation)
  if (adj.temperature !== 0) {
    const hueRotate = adj.temperature * 0.3;
    filters.push(`hue-rotate(${hueRotate}deg)`);
  }

  // Blur for clarity (negative) - actual clarity is more complex
  if (adj.clarity < 0) {
    filters.push(`blur(${Math.abs(adj.clarity) * 0.02}px)`);
  }

  return filters.join(' ');
};

/**
 * Draw a single annotation on canvas
 */
const drawAnnotation = (
  ctx: CanvasRenderingContext2D,
  annotation: ImageAnnotation,
  width: number,
  height: number,
  isSelected: boolean
) => {
  ctx.save();

  // Set common styles
  ctx.globalAlpha = annotation.opacity;
  ctx.strokeStyle = annotation.color;
  ctx.lineWidth = annotation.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw selection highlight
  if (isSelected) {
    ctx.shadowColor = annotation.color;
    ctx.shadowBlur = 8;
  }

  switch (annotation.type) {
    case 'circle': {
      const circle = annotation as CircleAnnotation;
      const cx = circle.centerX * width;
      const cy = circle.centerY * height;
      const rx = circle.radiusX * width;
      const ry = circle.radiusY * height;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

      if (circle.filled) {
        ctx.globalAlpha = circle.fillOpacity * annotation.opacity;
        ctx.fillStyle = annotation.color;
        ctx.fill();
        ctx.globalAlpha = annotation.opacity;
      }
      ctx.stroke();
      break;
    }

    case 'arrow': {
      const arrow = annotation as ArrowAnnotation;
      const startX = arrow.startX * width;
      const startY = arrow.startY * height;
      const endX = arrow.endX * width;
      const endY = arrow.endY * height;
      const headSize = arrow.headSize;

      // Calculate angle
      const angle = Math.atan2(endY - startY, endX - startX);

      // Draw line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw arrowhead at end
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headSize * Math.cos(angle - Math.PI / 6),
        endY - headSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headSize * Math.cos(angle + Math.PI / 6),
        endY - headSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();

      // Draw arrowhead at start if double-headed
      if (arrow.doubleHeaded) {
        const reverseAngle = angle + Math.PI;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(
          startX - headSize * Math.cos(reverseAngle - Math.PI / 6),
          startY - headSize * Math.sin(reverseAngle - Math.PI / 6)
        );
        ctx.moveTo(startX, startY);
        ctx.lineTo(
          startX - headSize * Math.cos(reverseAngle + Math.PI / 6),
          startY - headSize * Math.sin(reverseAngle + Math.PI / 6)
        );
        ctx.stroke();
      }
      break;
    }

    case 'rectangle': {
      const rect = annotation as RectangleAnnotation;
      const x = rect.x * width;
      const y = rect.y * height;
      const w = rect.width * width;
      const h = rect.height * height;

      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((rect.rotation * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));

      if (rect.cornerRadius > 0) {
        const r = rect.cornerRadius;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
      }

      if (rect.filled) {
        ctx.globalAlpha = rect.fillOpacity * annotation.opacity;
        ctx.fillStyle = annotation.color;
        ctx.fill();
        ctx.globalAlpha = annotation.opacity;
      }
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'text': {
      const text = annotation as TextAnnotation;
      const x = text.x * width;
      const y = text.y * height;

      ctx.font = `${text.fontStyle} ${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;
      ctx.textAlign = text.textAlign;
      ctx.textBaseline = 'top';

      // Draw background if present
      if (text.backgroundColor) {
        const metrics = ctx.measureText(text.text);
        const textWidth = metrics.width + text.padding * 2;
        const textHeight = text.fontSize + text.padding * 2;
        let bgX = x - text.padding;
        if (text.textAlign === 'center') bgX = x - textWidth / 2;
        if (text.textAlign === 'right') bgX = x - textWidth + text.padding;

        ctx.globalAlpha = text.backgroundOpacity * annotation.opacity;
        ctx.fillStyle = text.backgroundColor;
        ctx.fillRect(bgX, y - text.padding, textWidth, textHeight);
        ctx.globalAlpha = annotation.opacity;
      }

      ctx.fillStyle = annotation.color;
      ctx.fillText(text.text, x, y);
      break;
    }

    case 'freehand': {
      const freehand = annotation as FreehandAnnotation;
      if (freehand.points.length < 2) break;
      const firstPoint = freehand.points[0];
      if (!firstPoint) break;

      ctx.beginPath();
      ctx.moveTo(firstPoint.x * width, firstPoint.y * height);
      for (let i = 1; i < freehand.points.length; i++) {
        const point = freehand.points[i];
        if (point) {
          ctx.lineTo(point.x * width, point.y * height);
        }
      }
      ctx.stroke();
      break;
    }

    case 'line': {
      const line = annotation as LineAnnotation;
      ctx.beginPath();
      if (line.dashPattern && line.dashPattern.length > 0) {
        ctx.setLineDash(line.dashPattern);
      }
      ctx.moveTo(line.startX * width, line.startY * height);
      ctx.lineTo(line.endX * width, line.endY * height);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }

    case 'polygon': {
      const polygon = annotation as PolygonAnnotation;
      if (polygon.points.length < 2) break;
      const firstPolyPoint = polygon.points[0];
      if (!firstPolyPoint) break;

      ctx.beginPath();
      ctx.moveTo(firstPolyPoint.x * width, firstPolyPoint.y * height);
      for (let i = 1; i < polygon.points.length; i++) {
        const point = polygon.points[i];
        if (point) {
          ctx.lineTo(point.x * width, point.y * height);
        }
      }
      if (polygon.closed) {
        ctx.closePath();
      }
      if (polygon.filled && polygon.closed) {
        ctx.globalAlpha = polygon.fillOpacity * annotation.opacity;
        ctx.fillStyle = annotation.color;
        ctx.fill();
        ctx.globalAlpha = annotation.opacity;
      }
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
};

// ============================================================================
// COMPONENT
// ============================================================================

const ImageCanvasComponent: React.FC<ImageCanvasProps> = ({
  imageUrl,
  imageElement,
  adjustments,
  crop,
  annotations,
  selectedAnnotationId,
  activeTool,
  zoom,
  panX,
  panY,
  fitToView,
  onImageLoad,
  onPan,
  onAnnotationAdd,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAnnotationSelect: _onAnnotationSelect,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCropChange: _onCropChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);

  // Calculate computed zoom based on fit-to-view
  const computedZoom = useMemo(() => {
    if (!fitToView || !imageElement || !containerSize.width || !containerSize.height) {
      return zoom;
    }
    const scaleX = containerSize.width / imageElement.naturalWidth;
    const scaleY = containerSize.height / imageElement.naturalHeight;
    return Math.min(scaleX, scaleY) * 100 * 0.9; // 90% to add some padding
  }, [fitToView, imageElement, containerSize, zoom]);

  // Calculate CSS filter string
  const filterString = useMemo(() => adjustmentsToFilter(adjustments), [adjustments]);

  // Monitor container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Load image
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      onImageLoad(img);
    };
    img.onerror = (e) => {
      console.error('Failed to load image:', e);
    };
    img.src = imageUrl;
  }, [imageUrl, onImageLoad]);

  // Draw image on canvas
  useEffect(() => {
    const canvas = imageCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageElement) return;

    const { naturalWidth, naturalHeight } = imageElement;
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;

    // Clear canvas
    ctx.clearRect(0, 0, naturalWidth, naturalHeight);

    // Apply adjustments via CSS filter (Canvas 2D filter API)
    ctx.filter = filterString;

    // Handle flip transforms
    ctx.save();
    if (crop.flipHorizontal || crop.flipVertical) {
      ctx.translate(
        crop.flipHorizontal ? naturalWidth : 0,
        crop.flipVertical ? naturalHeight : 0
      );
      ctx.scale(crop.flipHorizontal ? -1 : 1, crop.flipVertical ? -1 : 1);
    }

    // Draw the image
    ctx.drawImage(imageElement, 0, 0);
    ctx.restore();

    // Apply additional effects that CSS filters can't handle
    applyAdvancedEffects(ctx, adjustments, naturalWidth, naturalHeight);
  }, [imageElement, filterString, crop.flipHorizontal, crop.flipVertical, adjustments]);

  // Draw annotations on separate canvas
  useEffect(() => {
    const canvas = annotationCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageElement) return;

    const { naturalWidth, naturalHeight } = imageElement;
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;

    // Clear canvas
    ctx.clearRect(0, 0, naturalWidth, naturalHeight);

    // Draw all visible annotations
    annotations
      .filter((a) => a.visible)
      .forEach((annotation) => {
        drawAnnotation(ctx, annotation, naturalWidth, naturalHeight, annotation.id === selectedAnnotationId);
      });

    // Draw current drawing in progress
    if (isDrawing && drawingPoints.length > 0) {
      const firstDrawPoint = drawingPoints[0];
      if (firstDrawPoint) {
        ctx.save();
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(firstDrawPoint.x * naturalWidth, firstDrawPoint.y * naturalHeight);
        for (let i = 1; i < drawingPoints.length; i++) {
          const point = drawingPoints[i];
          if (point) {
            ctx.lineTo(point.x * naturalWidth, point.y * naturalHeight);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }, [annotations, selectedAnnotationId, imageElement, isDrawing, drawingPoints]);

  // Apply advanced effects that can't be done with CSS filters
  const applyAdvancedEffects = (
    ctx: CanvasRenderingContext2D,
    adj: ImageAdjustments,
    width: number,
    height: number
  ) => {
    // Apply vignette
    if (adj.vignette.amount !== 0) {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        Math.max(width, height) * (adj.vignette.midpoint / 100)
      );
      const darkness = adj.vignette.amount < 0 ? Math.abs(adj.vignette.amount) / 100 : 0;
      gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
      gradient.addColorStop(1 - adj.vignette.feather / 100, `rgba(0, 0, 0, 0)`);
      gradient.addColorStop(1, `rgba(0, 0, 0, ${darkness})`);

      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Apply grain
    if (adj.grain.amount > 0) {
      const grainIntensity = adj.grain.amount / 100;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * grainIntensity * 50;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r !== undefined) data[i] = Math.max(0, Math.min(255, r + noise));
        if (g !== undefined) data[i + 1] = Math.max(0, Math.min(255, g + noise));
        if (b !== undefined) data[i + 2] = Math.max(0, Math.min(255, b + noise));
      }

      ctx.putImageData(imageData, 0, 0);
    }
  };

  // Mouse handlers for pan and annotation drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!imageElement) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (activeTool === 'pan' || e.button === 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      } else if (['circle', 'arrow', 'rectangle', 'line', 'freehand'].includes(activeTool)) {
        setIsDrawing(true);
        const canvasRect = imageCanvasRef.current?.getBoundingClientRect();
        if (canvasRect) {
          const x = (e.clientX - canvasRect.left) / canvasRect.width;
          const y = (e.clientY - canvasRect.top) / canvasRect.height;
          setDrawingPoints([{ x, y }]);
        }
      }
    },
    [activeTool, panX, panY, imageElement]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        onPan(e.clientX - dragStart.x, e.clientY - dragStart.y);
      } else if (isDrawing) {
        const canvasRect = imageCanvasRef.current?.getBoundingClientRect();
        if (canvasRect) {
          const x = (e.clientX - canvasRect.left) / canvasRect.width;
          const y = (e.clientY - canvasRect.top) / canvasRect.height;
          setDrawingPoints((prev) => [...prev, { x, y }]);
        }
      }
    },
    [isDragging, isDrawing, dragStart, onPan]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing && drawingPoints.length >= 2) {
      const startPoint = drawingPoints[0];
      const endPoint = drawingPoints[drawingPoints.length - 1];

      if (!startPoint || !endPoint) {
        setIsDragging(false);
        setIsDrawing(false);
        setDrawingPoints([]);
        return;
      }

      // Create annotation based on active tool
      if (activeTool === 'circle') {
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;
        const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
        const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;
        onAnnotationAdd({
          type: 'circle',
          userId: 'current-user',
          userDisplayName: 'Current User',
          color: '#ff4444',
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          centerX,
          centerY,
          radiusX,
          radiusY,
          filled: false,
          fillOpacity: 0.3,
        } as Omit<CircleAnnotation, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (activeTool === 'arrow') {
        onAnnotationAdd({
          type: 'arrow',
          userId: 'current-user',
          userDisplayName: 'Current User',
          color: '#ff4444',
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          startX: startPoint.x,
          startY: startPoint.y,
          endX: endPoint.x,
          endY: endPoint.y,
          headSize: 15,
          doubleHeaded: false,
        } as Omit<ArrowAnnotation, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (activeTool === 'rectangle') {
        onAnnotationAdd({
          type: 'rectangle',
          userId: 'current-user',
          userDisplayName: 'Current User',
          color: '#ff4444',
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          x: Math.min(startPoint.x, endPoint.x),
          y: Math.min(startPoint.y, endPoint.y),
          width: Math.abs(endPoint.x - startPoint.x),
          height: Math.abs(endPoint.y - startPoint.y),
          rotation: 0,
          cornerRadius: 0,
          filled: false,
          fillOpacity: 0.3,
        } as Omit<RectangleAnnotation, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (activeTool === 'line') {
        onAnnotationAdd({
          type: 'line',
          userId: 'current-user',
          userDisplayName: 'Current User',
          color: '#ff4444',
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          startX: startPoint.x,
          startY: startPoint.y,
          endX: endPoint.x,
          endY: endPoint.y,
        } as Omit<LineAnnotation, 'id' | 'createdAt' | 'updatedAt'>);
      } else if (activeTool === 'freehand') {
        onAnnotationAdd({
          type: 'freehand',
          userId: 'current-user',
          userDisplayName: 'Current User',
          color: '#ff4444',
          strokeWidth: 2,
          opacity: 1,
          visible: true,
          locked: false,
          points: drawingPoints,
          smoothing: 0,
        } as Omit<FreehandAnnotation, 'id' | 'createdAt' | 'updatedAt'>);
      }
    }

    setIsDragging(false);
    setIsDrawing(false);
    setDrawingPoints([]);
  }, [isDrawing, drawingPoints, activeTool, onAnnotationAdd]);

  // Render crop overlay
  const renderCropOverlay = () => {
    if (!crop.enabled || !imageElement) return null;

    const cropX = crop.x * 100;
    const cropY = crop.y * 100;
    const cropWidth = crop.width * 100;
    const cropHeight = crop.height * 100;

    return (
      <CropOverlay>
        {/* Dark overlay for areas outside crop */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(to right,
              rgba(0,0,0,0.7) ${cropX}%,
              transparent ${cropX}%,
              transparent ${cropX + cropWidth}%,
              rgba(0,0,0,0.7) ${cropX + cropWidth}%)`,
          }}
        />
        {/* Crop border */}
        <Box
          sx={{
            position: 'absolute',
            left: `${cropX}%`,
            top: `${cropY}%`,
            width: `${cropWidth}%`,
            height: `${cropHeight}%`,
            border: '2px dashed #19abb5',
            boxSizing: 'border-box',
          }}
        >
          {/* Rule of thirds grid */}
          <Box
            sx={{
              position: 'absolute',
              top: '33.33%',
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: 'rgba(25, 171, 181, 0.5)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '66.66%',
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: 'rgba(25, 171, 181, 0.5)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '33.33%',
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: 'rgba(25, 171, 181, 0.5)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '66.66%',
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: 'rgba(25, 171, 181, 0.5)',
            }}
          />
        </Box>
      </CropOverlay>
    );
  };

  const canvasWidth = imageElement?.naturalWidth ?? 0;
  const canvasHeight = imageElement?.naturalHeight ?? 0;
  const scale = computedZoom / 100;

  return (
    <CanvasContainer
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      sx={{
        cursor: activeTool === 'pan' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair',
      }}
    >
      <CanvasWrapper
        sx={{
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        <StyledImageCanvas ref={imageCanvasRef} width={canvasWidth} height={canvasHeight} />
        <AnnotationCanvas ref={annotationCanvasRef} width={canvasWidth} height={canvasHeight} />
        {renderCropOverlay()}
      </CanvasWrapper>
    </CanvasContainer>
  );
};

export default ImageCanvasComponent;
