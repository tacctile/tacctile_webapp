/**
 * ImageViewer Component
 * Professional zoom and pan functionality for image viewing
 * Inspired by Adobe Lightroom and Capture One
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

// ============================================================================
// CONSTANTS
// ============================================================================

// Zoom levels in percentage - sensible increments like pro photo apps
const ZOOM_LEVELS = [10, 25, 33, 50, 67, 75, 100, 150, 200, 300, 400];
const MIN_ZOOM = 10;
const MAX_ZOOM = 400;
const ZOOM_ANIMATION_DURATION = 180; // ms - smooth but snappy

// Momentum/inertia settings
const MOMENTUM_FRICTION = 0.92; // How quickly momentum decays (0-1, higher = slower decay)
const MOMENTUM_MIN_VELOCITY = 0.5; // Minimum velocity before stopping
const MOMENTUM_MULTIPLIER = 0.3; // Scale factor for momentum

// ============================================================================
// TYPES
// ============================================================================

export interface ImageViewerProps {
  imageUrl: string;
  onImageLoad?: (dimensions: { width: number; height: number }) => void;
  onZoomChange?: (zoom: number) => void;
  zoom?: number;
  initialFitToWindow?: boolean;
}

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
  fitZoom: number; // The zoom level that fits the image to window
  isAnimating: boolean;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
}

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const ViewerContainer = styled(Box)({
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: '#0a0a0a',
  outline: 'none', // For keyboard focus
});

const ImageContainer = styled(Box)<{ $isDragging: boolean; $canPan: boolean }>(
  ({ $isDragging, $canPan }) => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    transformOrigin: 'center center',
    cursor: $isDragging ? 'grabbing' : $canPan ? 'grab' : 'default',
    userSelect: 'none',
    willChange: 'transform',
  })
);

const StyledImage = styled('img')({
  display: 'block',
  maxWidth: 'none',
  maxHeight: 'none',
  pointerEvents: 'none',
  userSelect: 'none',
  WebkitUserDrag: 'none',
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find the next zoom level in the direction specified
 */
function getNextZoomLevel(currentZoom: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    for (const level of ZOOM_LEVELS) {
      if (level > currentZoom + 1) return level;
    }
    return MAX_ZOOM;
  } else {
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
      const level = ZOOM_LEVELS[i];
      if (level !== undefined && level < currentZoom - 1) return level;
    }
    return MIN_ZOOM;
  }
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Ease out cubic function for smooth animation
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ImageViewer: React.FC<ImageViewerProps> = ({
  imageUrl,
  onImageLoad,
  onZoomChange,
  zoom: externalZoom,
  initialFitToWindow = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const animationRef = useRef<number | null>(null);
  const momentumRef = useRef<number | null>(null);

  // Image dimensions
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // View state
  const [viewState, setViewState] = useState<ViewState>({
    zoom: 100,
    panX: 0,
    panY: 0,
    fitZoom: 100,
    isAnimating: false,
  });

  // Drag state
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
  });

  const [isDragging, setIsDragging] = useState(false);

  // Calculate fit-to-window zoom level
  const calculateFitZoom = useCallback(() => {
    if (!containerRef.current || !imageDimensions) return 100;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32; // Padding
    const containerHeight = container.clientHeight - 32;

    const scaleX = containerWidth / imageDimensions.width;
    const scaleY = containerHeight / imageDimensions.height;
    const fitScale = Math.min(scaleX, scaleY);

    // Return as percentage, but cap at 100% (don't upscale small images)
    return Math.min(fitScale * 100, 100);
  }, [imageDimensions]);

  // Update fit zoom when container or image dimensions change
  useEffect(() => {
    const fitZoom = calculateFitZoom();
    setViewState((prev) => ({ ...prev, fitZoom }));
  }, [calculateFitZoom]);

  // Handle external zoom changes
  useEffect(() => {
    if (externalZoom !== undefined && externalZoom !== viewState.zoom) {
      animateToZoom(externalZoom, 0, 0, false);
    }
  }, [externalZoom]);

  // Notify parent of zoom changes
  useEffect(() => {
    onZoomChange?.(viewState.zoom);
  }, [viewState.zoom, onZoomChange]);

  // Handle image load
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
      setImageDimensions(dimensions);
      onImageLoad?.(dimensions);

      // Calculate fit zoom after dimensions are set
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 32;
        const containerHeight = containerRef.current.clientHeight - 32;
        const scaleX = containerWidth / dimensions.width;
        const scaleY = containerHeight / dimensions.height;
        const fitZoom = Math.min(Math.min(scaleX, scaleY) * 100, 100);

        if (initialFitToWindow) {
          setViewState({
            zoom: fitZoom,
            panX: 0,
            panY: 0,
            fitZoom,
            isAnimating: false,
          });
        }
      }
    },
    [initialFitToWindow, onImageLoad]
  );

  // Calculate pan constraints
  const getPanConstraints = useCallback(
    (zoom: number) => {
      if (!containerRef.current || !imageDimensions) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
      }

      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const scaledWidth = (imageDimensions.width * zoom) / 100;
      const scaledHeight = (imageDimensions.height * zoom) / 100;

      // How much the image extends beyond the container
      const overflowX = Math.max(0, (scaledWidth - containerWidth) / 2);
      const overflowY = Math.max(0, (scaledHeight - containerHeight) / 2);

      return {
        minX: -overflowX,
        maxX: overflowX,
        minY: -overflowY,
        maxY: overflowY,
      };
    },
    [imageDimensions]
  );

  // Check if pan is possible (image larger than container)
  const canPan = useMemo(() => {
    const constraints = getPanConstraints(viewState.zoom);
    return constraints.maxX > 0 || constraints.maxY > 0;
  }, [viewState.zoom, getPanConstraints]);

  // Constrain pan within bounds
  const constrainPan = useCallback(
    (panX: number, panY: number, zoom: number) => {
      const constraints = getPanConstraints(zoom);
      return {
        panX: clamp(panX, constraints.minX, constraints.maxX),
        panY: clamp(panY, constraints.minY, constraints.maxY),
      };
    },
    [getPanConstraints]
  );

  // Animate to a new zoom level, optionally centering on a point
  const animateToZoom = useCallback(
    (
      targetZoom: number,
      centerX: number = 0, // Relative to container center (-0.5 to 0.5)
      centerY: number = 0,
      adjustPan: boolean = true
    ) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const startZoom = viewState.zoom;
      const startPanX = viewState.panX;
      const startPanY = viewState.panY;
      const startTime = performance.now();

      // Calculate target pan to keep point under cursor
      let targetPanX = startPanX;
      let targetPanY = startPanY;

      if (adjustPan && imageDimensions && containerRef.current) {
        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Point in container space (relative to center)
        const pointX = centerX * containerWidth;
        const pointY = centerY * containerHeight;

        // Point in image space at current zoom
        const imageX = (pointX - startPanX) / (startZoom / 100);
        const imageY = (pointY - startPanY) / (startZoom / 100);

        // Where that point would be at target zoom
        const newPointX = imageX * (targetZoom / 100);
        const newPointY = imageY * (targetZoom / 100);

        // Adjust pan to keep point in same screen position
        targetPanX = pointX - newPointX;
        targetPanY = pointY - newPointY;

        // Constrain to bounds
        const constrained = constrainPan(targetPanX, targetPanY, targetZoom);
        targetPanX = constrained.panX;
        targetPanY = constrained.panY;
      }

      setViewState((prev) => ({ ...prev, isAnimating: true }));

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / ZOOM_ANIMATION_DURATION, 1);
        const eased = easeOutCubic(progress);

        const newZoom = lerp(startZoom, targetZoom, eased);
        const newPanX = lerp(startPanX, targetPanX, eased);
        const newPanY = lerp(startPanY, targetPanY, eased);

        setViewState((prev) => ({
          ...prev,
          zoom: newZoom,
          panX: newPanX,
          panY: newPanY,
        }));

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setViewState((prev) => ({
            ...prev,
            zoom: targetZoom,
            panX: targetPanX,
            panY: targetPanY,
            isAnimating: false,
          }));
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    },
    [viewState.zoom, viewState.panX, viewState.panY, imageDimensions, constrainPan]
  );

  // Zoom in
  const zoomIn = useCallback(
    (centerX: number = 0, centerY: number = 0) => {
      const nextZoom = getNextZoomLevel(viewState.zoom, 'in');
      animateToZoom(nextZoom, centerX, centerY);
    },
    [viewState.zoom, animateToZoom]
  );

  // Zoom out
  const zoomOut = useCallback(
    (centerX: number = 0, centerY: number = 0) => {
      const minZoom = Math.max(MIN_ZOOM, viewState.fitZoom);
      const nextZoom = Math.max(getNextZoomLevel(viewState.zoom, 'out'), minZoom);
      animateToZoom(nextZoom, centerX, centerY);
    },
    [viewState.zoom, viewState.fitZoom, animateToZoom]
  );

  // Zoom to 100%
  const zoomTo100 = useCallback(
    (centerX: number = 0, centerY: number = 0) => {
      animateToZoom(100, centerX, centerY);
    },
    [animateToZoom]
  );

  // Fit to window
  const fitToWindow = useCallback(() => {
    animateToZoom(viewState.fitZoom, 0, 0, false);
    // Also reset pan
    setViewState((prev) => ({
      ...prev,
      panX: 0,
      panY: 0,
    }));
  }, [viewState.fitZoom, animateToZoom]);

  // Toggle between fit and 100%
  const toggleZoom = useCallback(
    (centerX: number = 0, centerY: number = 0) => {
      // If close to 100%, go to fit. If close to fit, go to 100%
      const closeToFit = Math.abs(viewState.zoom - viewState.fitZoom) < 5;
      const closeTo100 = Math.abs(viewState.zoom - 100) < 5;

      if (closeTo100 || (!closeToFit && viewState.zoom > viewState.fitZoom)) {
        fitToWindow();
      } else {
        zoomTo100(centerX, centerY);
      }
    },
    [viewState.zoom, viewState.fitZoom, fitToWindow, zoomTo100]
  );

  // Handle mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      // Calculate mouse position relative to container center (-0.5 to 0.5)
      const centerX = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const centerY = (e.clientY - rect.top - rect.height / 2) / rect.height;

      // Determine zoom direction
      const delta = e.deltaY > 0 ? 'out' : 'in';

      // For smoother wheel zoom, use a continuous scale factor
      const scaleFactor = delta === 'in' ? 1.1 : 0.9;
      const minZoom = Math.max(MIN_ZOOM, viewState.fitZoom);
      const targetZoom = clamp(viewState.zoom * scaleFactor, minZoom, MAX_ZOOM);

      animateToZoom(targetZoom, centerX, centerY);
    },
    [viewState.zoom, viewState.fitZoom, animateToZoom]
  );

  // Apply momentum after drag release
  const applyMomentum = useCallback(() => {
    const drag = dragStateRef.current;

    const animate = () => {
      // Apply friction
      drag.velocityX *= MOMENTUM_FRICTION;
      drag.velocityY *= MOMENTUM_FRICTION;

      // Stop if velocity is too low
      if (
        Math.abs(drag.velocityX) < MOMENTUM_MIN_VELOCITY &&
        Math.abs(drag.velocityY) < MOMENTUM_MIN_VELOCITY
      ) {
        momentumRef.current = null;
        return;
      }

      // Apply velocity to pan
      setViewState((prev) => {
        const newPanX = prev.panX + drag.velocityX;
        const newPanY = prev.panY + drag.velocityY;
        const constrained = constrainPan(newPanX, newPanY, prev.zoom);
        return {
          ...prev,
          panX: constrained.panX,
          panY: constrained.panY,
        };
      });

      momentumRef.current = requestAnimationFrame(animate);
    };

    momentumRef.current = requestAnimationFrame(animate);
  }, [constrainPan]);

  // Handle mouse down for pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canPan || e.button !== 0) return;

      // Cancel any ongoing momentum
      if (momentumRef.current) {
        cancelAnimationFrame(momentumRef.current);
        momentumRef.current = null;
      }

      const drag = dragStateRef.current;
      drag.isDragging = true;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.startPanX = viewState.panX;
      drag.startPanY = viewState.panY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastTime = performance.now();
      drag.velocityX = 0;
      drag.velocityY = 0;

      setIsDragging(true);
    },
    [canPan, viewState.panX, viewState.panY]
  );

  // Handle mouse move for pan
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag.isDragging) return;

      const currentTime = performance.now();
      const deltaTime = currentTime - drag.lastTime;

      const deltaX = e.clientX - drag.lastX;
      const deltaY = e.clientY - drag.lastY;

      // Calculate velocity for momentum
      if (deltaTime > 0) {
        drag.velocityX = (deltaX / deltaTime) * 16 * MOMENTUM_MULTIPLIER;
        drag.velocityY = (deltaY / deltaTime) * 16 * MOMENTUM_MULTIPLIER;
      }

      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastTime = currentTime;

      const newPanX = drag.startPanX + (e.clientX - drag.startX);
      const newPanY = drag.startPanY + (e.clientY - drag.startY);

      const constrained = constrainPan(newPanX, newPanY, viewState.zoom);

      setViewState((prev) => ({
        ...prev,
        panX: constrained.panX,
        panY: constrained.panY,
      }));
    },
    [constrainPan, viewState.zoom]
  );

  // Handle mouse up for pan
  const handleMouseUp = useCallback(() => {
    const drag = dragStateRef.current;
    if (!drag.isDragging) return;

    drag.isDragging = false;
    setIsDragging(false);

    // Apply momentum if there's velocity
    if (
      Math.abs(drag.velocityX) > MOMENTUM_MIN_VELOCITY ||
      Math.abs(drag.velocityY) > MOMENTUM_MIN_VELOCITY
    ) {
      applyMomentum();
    }
  }, [applyMomentum]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    const drag = dragStateRef.current;
    if (drag.isDragging) {
      handleMouseUp();
    }
  }, [handleMouseUp]);

  // Handle double click for zoom toggle
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();

      // Calculate click position relative to container center
      const centerX = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const centerY = (e.clientY - rect.top - rect.height / 2) / rect.height;

      toggleZoom(centerX, centerY);
    },
    [toggleZoom]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle if modifier keys are pressed (except for zoom)
      if (e.altKey || e.metaKey) return;

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          fitToWindow();
          break;
        case '1':
          e.preventDefault();
          zoomTo100();
          break;
        case 'ArrowUp':
          if (canPan) {
            e.preventDefault();
            setViewState((prev) => {
              const constrained = constrainPan(prev.panX, prev.panY + 50, prev.zoom);
              return { ...prev, panY: constrained.panY };
            });
          }
          break;
        case 'ArrowDown':
          if (canPan) {
            e.preventDefault();
            setViewState((prev) => {
              const constrained = constrainPan(prev.panX, prev.panY - 50, prev.zoom);
              return { ...prev, panY: constrained.panY };
            });
          }
          break;
        case 'ArrowLeft':
          if (canPan) {
            e.preventDefault();
            setViewState((prev) => {
              const constrained = constrainPan(prev.panX + 50, prev.panY, prev.zoom);
              return { ...prev, panX: constrained.panX };
            });
          }
          break;
        case 'ArrowRight':
          if (canPan) {
            e.preventDefault();
            setViewState((prev) => {
              const constrained = constrainPan(prev.panX - 50, prev.panY, prev.zoom);
              return { ...prev, panX: constrained.panX };
            });
          }
          break;
      }
    },
    [zoomIn, zoomOut, fitToWindow, zoomTo100, canPan, constrainPan]
  );

  // Calculate transform style
  const transformStyle = useMemo(() => {
    const scale = viewState.zoom / 100;
    return {
      transform: `translate(-50%, -50%) translate(${viewState.panX}px, ${viewState.panY}px) scale(${scale})`,
      transition: viewState.isAnimating
        ? `transform ${ZOOM_ANIMATION_DURATION}ms cubic-bezier(0.33, 1, 0.68, 1)`
        : 'none',
    };
  }, [viewState.zoom, viewState.panX, viewState.panY, viewState.isAnimating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (momentumRef.current) {
        cancelAnimationFrame(momentumRef.current);
      }
    };
  }, []);

  // Expose methods via ref
  React.useImperativeHandle(
    React.useRef(null),
    () => ({
      zoomIn,
      zoomOut,
      zoomTo100,
      fitToWindow,
      toggleZoom,
      getZoom: () => viewState.zoom,
      getFitZoom: () => viewState.fitZoom,
    }),
    [zoomIn, zoomOut, zoomTo100, fitToWindow, toggleZoom, viewState.zoom, viewState.fitZoom]
  );

  return (
    <ViewerContainer
      ref={containerRef}
      tabIndex={0}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <ImageContainer
        $isDragging={isDragging}
        $canPan={canPan}
        style={transformStyle}
      >
        <StyledImage
          ref={imageRef}
          src={imageUrl}
          alt="Image viewer"
          onLoad={handleImageLoad}
          draggable={false}
        />
      </ImageContainer>
    </ViewerContainer>
  );
};

// ============================================================================
// HOOK FOR EXTERNAL CONTROL
// ============================================================================

export interface UseImageViewerOptions {
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export interface ImageViewerControls {
  zoom: number;
  fitZoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo100: () => void;
  fitToWindow: () => void;
  resetView: () => void;
}

export function useImageViewer(options: UseImageViewerOptions = {}): ImageViewerControls {
  const [zoom, setZoomInternal] = useState(options.initialZoom ?? 100);
  const [fitZoom, setFitZoom] = useState(100);

  const setZoom = useCallback(
    (newZoom: number) => {
      const clamped = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
      setZoomInternal(clamped);
      options.onZoomChange?.(clamped);
    },
    [options]
  );

  const zoomIn = useCallback(() => {
    setZoom(getNextZoomLevel(zoom, 'in'));
  }, [zoom, setZoom]);

  const zoomOut = useCallback(() => {
    const minZoom = Math.max(MIN_ZOOM, fitZoom);
    setZoom(Math.max(getNextZoomLevel(zoom, 'out'), minZoom));
  }, [zoom, fitZoom, setZoom]);

  const zoomTo100 = useCallback(() => {
    setZoom(100);
  }, [setZoom]);

  const fitToWindow = useCallback(() => {
    setZoom(fitZoom);
  }, [fitZoom, setZoom]);

  const resetView = useCallback(() => {
    setZoom(fitZoom);
  }, [fitZoom, setZoom]);

  return {
    zoom,
    fitZoom,
    setZoom,
    zoomIn,
    zoomOut,
    zoomTo100,
    fitToWindow,
    resetView,
  };
}

export default ImageViewer;
