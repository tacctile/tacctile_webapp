import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DataPoint, HeatMapOptions, getDataVisualizationService, TimeRange } from '../../services/visualization/DataVisualizationService';

interface HeatMapOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  visible: boolean;
  dataType: 'emf' | 'temperature' | 'audio' | 'motion' | 'all';
  timeRange?: TimeRange;
  opacity: number;
  options: Partial<HeatMapOptions>;
  onDataPointClick?: (point: DataPoint) => void;
}

interface HeatMapLayer {
  imageData: ImageData;
  dataType: string;
  timestamp: Date;
  pointCount: number;
}

export const HeatMapOverlay: React.FC<HeatMapOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  zoomLevel,
  panOffset,
  visible,
  dataType,
  timeRange,
  opacity,
  options,
  onDataPointClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [heatMapLayer, setHeatMapLayer] = useState<HeatMapLayer | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  const generateHeatMap = useCallback(async () => {
    if (!visible) {
      setHeatMapLayer(null);
      return;
    }

    setIsGenerating(true);

    try {
      const dataService = getDataVisualizationService();
      
      // Get data points based on filters
      const type = dataType === 'all' ? undefined : dataType;
      const points = dataService.getDataPoints(type, timeRange);
      
      setDataPoints(points);

      if (points.length === 0) {
        setHeatMapLayer(null);
        return;
      }

      // Transform points based on zoom and pan
      const transformedPoints = points.map(point => ({
        ...point,
        x: (point.x + panOffset.x) * zoomLevel,
        y: (point.y + panOffset.y) * zoomLevel
      }));

      // Generate heat map
      const imageData = dataService.generateHeatMap(
        canvasWidth,
        canvasHeight,
        transformedPoints,
        options
      );

      setHeatMapLayer({
        imageData,
        dataType: dataType,
        timestamp: new Date(),
        pointCount: points.length
      });

    } catch (error) {
      console.error('Failed to generate heat map:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [visible, dataType, timeRange, canvasWidth, canvasHeight, zoomLevel, panOffset, options]);

  // Debounced heat map generation
  useEffect(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      generateHeatMap();
    }, 300); // 300ms debounce

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [generateHeatMap]);

  // Render heat map to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heatMapLayer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set global opacity
    ctx.globalAlpha = opacity;

    // Draw heat map
    ctx.putImageData(heatMapLayer.imageData, 0, 0);

    // Reset global alpha
    ctx.globalAlpha = 1;
  }, [heatMapLayer, opacity]);

  // Handle canvas click for data point interaction
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onDataPointClick || dataPoints.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Find closest data point within a reasonable distance
    let closestPoint: DataPoint | null = null;
    let minDistance = Infinity;
    const maxClickDistance = 20; // pixels

    dataPoints.forEach(point => {
      const transformedX = (point.x + panOffset.x) * zoomLevel;
      const transformedY = (point.y + panOffset.y) * zoomLevel;
      
      const distance = Math.sqrt(
        Math.pow(clickX - transformedX, 2) + 
        Math.pow(clickY - transformedY, 2)
      );

      if (distance < maxClickDistance && distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    });

    if (closestPoint) {
      onDataPointClick(closestPoint);
    }
  }, [dataPoints, zoomLevel, panOffset, onDataPointClick]);

  if (!visible) {
    return null;
  }

  return (
    <div className="heat-map-overlay">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onClick={handleCanvasClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: visible ? 'auto' : 'none',
          cursor: onDataPointClick ? 'crosshair' : 'default',
          zIndex: 5
        }}
      />
      
      {isGenerating && (
        <div className="heat-map-loader">
          <div className="loader-spinner" />
          <span>Generating heat map...</span>
        </div>
      )}

      {heatMapLayer && (
        <div className="heat-map-info">
          <div className="info-badge">
            <span className="data-type">{dataType.toUpperCase()}</span>
            <span className="point-count">{heatMapLayer.pointCount} points</span>
            <span className="timestamp">
              {heatMapLayer.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      <style jsx>{`
        .heat-map-overlay {
          position: relative;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .heat-map-loader {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.875rem;
          z-index: 10;
        }

        .loader-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid #bb86fc;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .heat-map-info {
          position: absolute;
          bottom: 10px;
          right: 10px;
          z-index: 10;
        }

        .info-badge {
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .data-type {
          font-weight: 600;
          color: #bb86fc;
        }

        .point-count {
          font-size: 0.7rem;
          opacity: 0.8;
        }

        .timestamp {
          font-size: 0.7rem;
          opacity: 0.6;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .heat-map-loader,
          .info-badge {
            font-size: 0.75rem;
            padding: 6px 8px;
          }
          
          .loader-spinner {
            width: 14px;
            height: 14px;
          }
        }
      `}</style>
    </div>
  );
};

// Heat map preset configurations
export const HEAT_MAP_PRESETS = {
  emf: {
    gradient: {
      0.0: '#000080',  // Dark blue
      0.2: '#0080FF',  // Blue
      0.4: '#00FF80',  // Green
      0.6: '#FFFF00',  // Yellow
      0.8: '#FF8000',  // Orange
      1.0: '#FF0000'   // Red
    },
    colorScale: 'viridis' as const,
    radius: 30,
    blur: 20
  },
  temperature: {
    gradient: {
      0.0: '#0000FF',  // Cold - Blue
      0.3: '#00FFFF',  // Cool - Cyan
      0.5: '#00FF00',  // Normal - Green
      0.7: '#FFFF00',  // Warm - Yellow
      0.9: '#FF8000',  // Hot - Orange
      1.0: '#FF0000'   // Very Hot - Red
    },
    colorScale: 'turbo' as const,
    radius: 25,
    blur: 15
  },
  audio: {
    gradient: {
      0.0: '#1a1a2e',  // Dark purple
      0.2: '#16213e',  // Blue-purple
      0.4: '#0f3460',  // Deep blue
      0.6: '#533483',  // Purple
      0.8: '#e94560',  // Pink-red
      1.0: '#f5f5f5'   // White
    },
    colorScale: 'plasma' as const,
    radius: 35,
    blur: 25
  },
  motion: {
    gradient: {
      0.0: '#2d1b69',  // Dark purple
      0.3: '#11998e',  // Teal
      0.6: '#38ef7d',  // Light green
      1.0: '#ffffff'   // White
    },
    colorScale: 'inferno' as const,
    radius: 20,
    blur: 10
  }
} as const;