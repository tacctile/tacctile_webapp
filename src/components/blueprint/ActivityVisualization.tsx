import React, { useEffect, useState, useMemo } from 'react';
import { RoomActivity, getDataVisualizationService, TimeRange } from '../../services/visualization/DataVisualizationService';
import { DrawingElement } from '../../services/blueprint/DrawingEngine';

interface ActivityVisualizationProps {
  canvasWidth: number;
  canvasHeight: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  rooms: DrawingElement[]; // Room elements from blueprint
  visible: boolean;
  timeRange?: TimeRange;
  visualizationMode: 'intensity' | 'heatLevel' | 'eventCount' | 'combined';
  opacity: number;
  showLabels: boolean;
  onRoomClick?: (roomActivity: RoomActivity) => void;
}

interface RoomVisualization extends RoomActivity {
  displayBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color: string;
  intensity: number; // 0-1 normalized
}

export const ActivityVisualization: React.FC<ActivityVisualizationProps> = ({
  canvasWidth,
  canvasHeight,
  zoomLevel,
  panOffset,
  rooms,
  visible,
  timeRange,
  visualizationMode,
  opacity,
  showLabels,
  onRoomClick
}) => {
  const [roomActivities, setRoomActivities] = useState<RoomVisualization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [maxActivity, setMaxActivity] = useState(1);

  // Convert room elements to room definitions
  const roomDefinitions = useMemo(() => {
    return rooms
      .filter(element => element.type === 'room')
      .map(room => ({
        id: room.id,
        name: room.properties.name || `Room ${room.id.slice(-4)}`,
        bounds: {
          x: room.paperItem.bounds.x,
          y: room.paperItem.bounds.y,
          width: room.paperItem.bounds.width,
          height: room.paperItem.bounds.height
        }
      }));
  }, [rooms]);

  // Calculate room activities
  useEffect(() => {
    if (!visible || roomDefinitions.length === 0) {
      setRoomActivities([]);
      return;
    }

    setIsLoading(true);

    const calculateActivities = async () => {
      try {
        const dataService = getDataVisualizationService();
        const activities = dataService.calculateRoomActivity(roomDefinitions, timeRange);
        
        // Find maximum activity for normalization
        const maxActivityLevel = Math.max(...activities.map(a => a.activityLevel), 1);
        setMaxActivity(maxActivityLevel);

        // Transform activities for visualization
        const visualizations: RoomVisualization[] = activities.map(activity => {
          const normalizedIntensity = activity.activityLevel / maxActivityLevel;
          
          // Transform bounds based on zoom and pan
          const displayBounds = {
            x: (activity.bounds.x + panOffset.x) * zoomLevel,
            y: (activity.bounds.y + panOffset.y) * zoomLevel,
            width: activity.bounds.width * zoomLevel,
            height: activity.bounds.height * zoomLevel
          };

          // Determine color based on visualization mode and intensity
          const color = getActivityColor(normalizedIntensity, visualizationMode, activity);

          return {
            ...activity,
            displayBounds,
            color,
            intensity: normalizedIntensity
          };
        });

        setRoomActivities(visualizations);
      } catch (error) {
        console.error('Failed to calculate room activities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    calculateActivities();
  }, [visible, roomDefinitions, timeRange, zoomLevel, panOffset, visualizationMode]);

  const getActivityColor = (
    intensity: number,
    mode: string,
    activity: RoomActivity
  ): string => {
    switch (mode) {
      case 'intensity':
        // Blue to red gradient based on activity intensity
        if (intensity < 0.2) return `rgba(59, 130, 246, ${intensity + 0.1})`;
        if (intensity < 0.5) return `rgba(16, 185, 129, ${intensity + 0.1})`;
        if (intensity < 0.8) return `rgba(245, 158, 11, ${intensity + 0.1})`;
        return `rgba(239, 68, 68, ${intensity + 0.1})`;

      case 'heatLevel':
        // Heat map style coloring
        const heatValue = Math.min(1, intensity * 1.5);
        const r = Math.floor(255 * heatValue);
        const g = Math.floor(255 * (1 - heatValue) * 0.5);
        const b = Math.floor(255 * (1 - heatValue));
        return `rgba(${r}, ${g}, ${b}, ${heatValue * 0.4 + 0.1})`;

      case 'eventCount':
        // Color based on event count
        const eventIntensity = Math.min(1, activity.eventCount / 50);
        return `rgba(168, 85, 247, ${eventIntensity * 0.5 + 0.1})`;

      case 'combined':
        // Combined visualization using multiple factors
        const avgIntensity = (intensity + Math.min(1, activity.eventCount / 20)) / 2;
        if (avgIntensity < 0.3) return `rgba(59, 130, 246, ${avgIntensity + 0.1})`;
        if (avgIntensity < 0.7) return `rgba(245, 158, 11, ${avgIntensity + 0.1})`;
        return `rgba(239, 68, 68, ${avgIntensity + 0.1})`;

      default:
        return `rgba(187, 134, 252, ${intensity * 0.4 + 0.1})`;
    }
  };

  const getActivityLabel = (activity: RoomVisualization): string => {
    switch (visualizationMode) {
      case 'intensity':
        return `${Math.round(activity.activityLevel * 100)}%`;
      case 'heatLevel':
        return `${activity.averageValue.toFixed(1)}`;
      case 'eventCount':
        return `${activity.eventCount}`;
      case 'combined':
        return `${Math.round(activity.activityLevel * 100)}%`;
      default:
        return '';
    }
  };

  const handleRoomClick = (room: RoomVisualization) => {
    if (onRoomClick) {
      onRoomClick(room);
    }
  };

  if (!visible || roomActivities.length === 0) {
    return null;
  }

  return (
    <div className="activity-visualization">
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'auto',
          zIndex: 3,
          opacity
        }}
      >
        {roomActivities.map((room) => (
          <g key={room.roomId} className="room-activity">
            {/* Room activity overlay */}
            <rect
              x={room.displayBounds.x}
              y={room.displayBounds.y}
              width={room.displayBounds.width}
              height={room.displayBounds.height}
              fill={room.color}
              stroke={room.intensity > 0.7 ? '#ff4444' : room.intensity > 0.4 ? '#ffaa44' : '#44aa44'}
              strokeWidth={room.intensity > 0.5 ? 2 : 1}
              strokeOpacity={room.intensity * 0.8 + 0.2}
              className="room-overlay"
              onClick={() => handleRoomClick(room)}
              style={{ cursor: onRoomClick ? 'pointer' : 'default' }}
            />

            {/* Activity pattern overlay */}
            {room.intensity > 0.3 && (
              <pattern
                id={`activity-pattern-${room.roomId}`}
                patternUnits="userSpaceOnUse"
                width="10"
                height="10"
              >
                <circle
                  cx="5"
                  cy="5"
                  r="2"
                  fill={room.intensity > 0.7 ? '#ff6b6b' : '#bb86fc'}
                  opacity={room.intensity * 0.5}
                />
              </pattern>
            )}

            {room.intensity > 0.3 && (
              <rect
                x={room.displayBounds.x}
                y={room.displayBounds.y}
                width={room.displayBounds.width}
                height={room.displayBounds.height}
                fill={`url(#activity-pattern-${room.roomId})`}
                opacity={0.3}
                pointerEvents="none"
              />
            )}

            {/* Room labels */}
            {showLabels && room.displayBounds.width > 50 && room.displayBounds.height > 30 && (
              <g className="room-label">
                {/* Background for text */}
                <rect
                  x={room.displayBounds.x + 5}
                  y={room.displayBounds.y + 5}
                  width={Math.min(room.displayBounds.width - 10, room.roomName.length * 8 + 20)}
                  height="32"
                  fill="rgba(0, 0, 0, 0.8)"
                  rx="4"
                />
                
                {/* Room name */}
                <text
                  x={room.displayBounds.x + 15}
                  y={room.displayBounds.y + 22}
                  fontSize="12"
                  fill="#ffffff"
                  fontWeight="500"
                  className="room-name"
                >
                  {room.roomName}
                </text>
                
                {/* Activity value */}
                <text
                  x={room.displayBounds.x + 15}
                  y={room.displayBounds.y + 34}
                  fontSize="10"
                  fill={room.intensity > 0.7 ? '#ff6b6b' : room.intensity > 0.4 ? '#ffaa44' : '#44aa44'}
                  fontWeight="600"
                  className="activity-value"
                >
                  {getActivityLabel(room)}
                </text>
              </g>
            )}

            {/* Activity indicator dots for high activity rooms */}
            {room.intensity > 0.8 && (
              <g className="activity-indicators">
                {[0, 1, 2].map(i => (
                  <circle
                    key={i}
                    cx={room.displayBounds.x + room.displayBounds.width - 15}
                    cy={room.displayBounds.y + 15 + i * 8}
                    r="2"
                    fill="#ff4444"
                    className="activity-dot"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.3;1;0.3"
                      dur="1.5s"
                      repeatCount="indefinite"
                      begin={`${i * 0.3}s`}
                    />
                  </circle>
                ))}
              </g>
            )}
          </g>
        ))}
      </svg>

      {/* Activity Statistics Panel */}
      {roomActivities.length > 0 && (
        <div className="activity-stats">
          <div className="stats-header">
            <span className="stats-title">Room Activity</span>
            <span className="stats-mode">{visualizationMode}</span>
          </div>
          
          <div className="stats-summary">
            <div className="stat-item">
              <span className="stat-label">Active Rooms:</span>
              <span className="stat-value">
                {roomActivities.filter(r => r.intensity > 0.1).length}/{roomActivities.length}
              </span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Max Activity:</span>
              <span className="stat-value">{Math.round(maxActivity * 100)}%</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">Total Events:</span>
              <span className="stat-value">
                {roomActivities.reduce((sum, r) => sum + r.eventCount, 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="activity-loader">
          <div className="loader-spinner" />
          <span>Calculating room activities...</span>
        </div>
      )}

      <style jsx>{`
        .activity-visualization {
          position: relative;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .room-overlay {
          transition: all 0.3s ease;
        }

        .room-overlay:hover {
          stroke-width: 3;
          filter: brightness(1.2);
        }

        .room-label {
          pointer-events: none;
        }

        .room-name {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .activity-value {
          font-family: 'Courier New', monospace;
        }

        .activity-dot {
          filter: drop-shadow(0 0 3px currentColor);
        }

        .activity-stats {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid var(--border-color, #333333);
          border-radius: 8px;
          padding: 12px;
          min-width: 200px;
          z-index: 1000;
        }

        .stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stats-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #ffffff;
        }

        .stats-mode {
          font-size: 0.75rem;
          color: var(--accent-color, #bb86fc);
          text-transform: uppercase;
        }

        .stats-summary {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
        }

        .stat-label {
          color: var(--text-secondary, #aaaaaa);
        }

        .stat-value {
          color: #ffffff;
          font-weight: 500;
          font-family: 'Courier New', monospace;
        }

        .activity-loader {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          font-size: 0.9rem;
          z-index: 1000;
        }

        .loader-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid transparent;
          border-top: 2px solid var(--accent-color, #bb86fc);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Material 3 Dark Theme Variables */
        :root {
          --surface-primary: #121212;
          --surface-secondary: #1e1e1e;
          --surface-tertiary: #2d2d2d;
          --surface-hover: #3d3d3d;
          --text-primary: #ffffff;
          --text-secondary: #aaaaaa;
          --border-color: #333333;
          --accent-color: #bb86fc;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .activity-stats {
            top: 5px;
            left: 5px;
            padding: 8px;
            min-width: 150px;
            font-size: 0.8rem;
          }
          
          .stats-title {
            font-size: 0.8rem;
          }
          
          .activity-loader {
            padding: 12px 16px;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
};