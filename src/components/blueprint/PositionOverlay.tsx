import React, { useEffect, useState, useRef } from 'react';
import { InvestigatorPosition, InvestigatorProfile, TrailPoint, getWebSocketService } from '../../services/realtime/WebSocketService';
import { getPositionTracker } from '../../services/realtime/PositionTracker';

interface PositionOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  showTrails: boolean;
  showInvestigatorNames: boolean;
  trailLength: number;
  onInvestigatorClick?: (investigator: InvestigatorProfile) => void;
}

interface AnimatedPosition extends InvestigatorPosition {
  displayX: number;
  displayY: number;
  targetX: number;
  targetY: number;
  animationProgress: number;
  pulsing: boolean;
  lastUpdate: Date;
}

export const PositionOverlay: React.FC<PositionOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  zoomLevel,
  panOffset,
  showTrails,
  showInvestigatorNames,
  trailLength,
  onInvestigatorClick
}) => {
  const [positions, setPositions] = useState<Map<string, AnimatedPosition>>(new Map());
  const [investigators, setInvestigators] = useState<Map<string, InvestigatorProfile>>(new Map());
  const [trails, setTrails] = useState<Map<string, TrailPoint[]>>(new Map());
  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<Date>(new Date());

  useEffect(() => {
    const wsService = getWebSocketService();
    const positionTracker = getPositionTracker();

    // Event handlers
    const handlePositionUpdate = (position: InvestigatorPosition) => {
      setPositions(prev => {
        const current = prev.get(position.investigatorId);
        const newAnimatedPosition: AnimatedPosition = {
          ...position,
          displayX: current?.displayX || position.x,
          displayY: current?.displayY || position.y,
          targetX: position.x,
          targetY: position.y,
          animationProgress: 0,
          pulsing: true,
          lastUpdate: new Date()
        };

        const updated = new Map(prev);
        updated.set(position.investigatorId, newAnimatedPosition);
        return updated;
      });
    };

    const handleRemotePositionUpdate = (position: InvestigatorPosition) => {
      handlePositionUpdate(position);
    };

    const handleInvestigatorJoined = (investigator: InvestigatorProfile) => {
      setInvestigators(prev => {
        const updated = new Map(prev);
        updated.set(investigator.id, investigator);
        return updated;
      });
    };

    const handleInvestigatorLeft = (investigatorId: string) => {
      setInvestigators(prev => {
        const updated = new Map(prev);
        updated.delete(investigatorId);
        return updated;
      });
      setPositions(prev => {
        const updated = new Map(prev);
        updated.delete(investigatorId);
        return updated;
      });
      setTrails(prev => {
        const updated = new Map(prev);
        updated.delete(investigatorId);
        return updated;
      });
    };

    const handleTrailUpdate = (investigatorId: string, point: TrailPoint) => {
      setTrails(prev => {
        const updated = new Map(prev);
        const currentTrail = updated.get(investigatorId) || [];
        const newTrail = [...currentTrail, point].slice(-trailLength);
        updated.set(investigatorId, newTrail);
        return updated;
      });
    };

    // Bind events
    wsService.on('position_update', handleRemotePositionUpdate);
    wsService.on('investigator_joined', handleInvestigatorJoined);
    wsService.on('investigator_left', handleInvestigatorLeft);
    wsService.on('trail_update', handleTrailUpdate);

    positionTracker.on('position_updated', handlePositionUpdate);
    positionTracker.on('remote_position_update', handleRemotePositionUpdate);
    positionTracker.on('investigator_joined', handleInvestigatorJoined);
    positionTracker.on('investigator_left', handleInvestigatorLeft);
    positionTracker.on('trail_update', handleTrailUpdate);

    // Load existing data
    const connectedInvestigators = wsService.getConnectedInvestigators();
    connectedInvestigators.forEach(inv => {
      setInvestigators(prev => {
        const updated = new Map(prev);
        updated.set(inv.id, inv);
        return updated;
      });
    });

    const allTrails = wsService.getAllTrails(trailLength);
    setTrails(allTrails);

    return () => {
      wsService.off('position_update', handleRemotePositionUpdate);
      wsService.off('investigator_joined', handleInvestigatorJoined);
      wsService.off('investigator_left', handleInvestigatorLeft);
      wsService.off('trail_update', handleTrailUpdate);

      positionTracker.off('position_updated', handlePositionUpdate);
      positionTracker.off('remote_position_update', handleRemotePositionUpdate);
      positionTracker.off('investigator_joined', handleInvestigatorJoined);
      positionTracker.off('investigator_left', handleInvestigatorLeft);
      positionTracker.off('trail_update', handleTrailUpdate);
    };
  }, [trailLength]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const now = new Date();
      const deltaTime = now.getTime() - lastUpdateRef.current.getTime();
      lastUpdateRef.current = now;

      setPositions(prev => {
        const updated = new Map();
        let hasChanges = false;

        prev.forEach((position, id) => {
          const newPosition = { ...position };
          
          // Animate position interpolation
          if (newPosition.animationProgress < 1) {
            newPosition.animationProgress = Math.min(1, newPosition.animationProgress + deltaTime / 500); // 500ms animation
            const progress = easeOutCubic(newPosition.animationProgress);
            
            newPosition.displayX = position.displayX + (position.targetX - position.displayX) * progress;
            newPosition.displayY = position.displayY + (position.targetY - position.displayY) * progress;
            
            hasChanges = true;
          }

          // Handle pulsing animation
          if (newPosition.pulsing) {
            const timeSinceUpdate = now.getTime() - newPosition.lastUpdate.getTime();
            if (timeSinceUpdate > 2000) { // Stop pulsing after 2 seconds
              newPosition.pulsing = false;
              hasChanges = true;
            }
          }

          updated.set(id, newPosition);
        });

        return hasChanges ? updated : prev;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  const transformPoint = (x: number, y: number) => {
    return {
      x: (x + panOffset.x) * zoomLevel,
      y: (y + panOffset.y) * zoomLevel
    };
  };

  const renderTrail = (investigatorId: string, trail: TrailPoint[], color: string) => {
    if (!showTrails || trail.length < 2) return null;

    const pathData = trail.map((point, index) => {
      const transformed = transformPoint(point.x, point.y);
      return `${index === 0 ? 'M' : 'L'} ${transformed.x} ${transformed.y}`;
    }).join(' ');

    const opacity = 0.6;
    const gradient = `trail-gradient-${investigatorId}`;

    return (
      <g key={`trail-${investigatorId}`}>
        <defs>
          <linearGradient id={gradient} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity={0.1} />
            <stop offset="100%" stopColor={color} stopOpacity={opacity} />
          </linearGradient>
        </defs>
        <path
          d={pathData}
          stroke={`url(#${gradient})`}
          strokeWidth={Math.max(1, 2 * zoomLevel)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Trail dots */}
        {trail.slice(-10).map((point, index) => {
          const transformed = transformPoint(point.x, point.y);
          const dotOpacity = (index + 1) / 10 * 0.4;
          const dotSize = Math.max(1, zoomLevel) * 0.5;
          
          return (
            <circle
              key={`trail-dot-${investigatorId}-${index}`}
              cx={transformed.x}
              cy={transformed.y}
              r={dotSize}
              fill={color}
              opacity={dotOpacity}
            />
          );
        })}
      </g>
    );
  };

  const renderInvestigator = (position: AnimatedPosition, investigator: InvestigatorProfile) => {
    const transformed = transformPoint(position.displayX, position.displayY);
    const baseSize = 8;
    const size = baseSize * Math.max(0.5, zoomLevel);
    const pulseSize = position.pulsing ? size * 1.3 : size;
    
    const handleClick = () => {
      if (onInvestigatorClick) {
        onInvestigatorClick(investigator);
      }
    };

    return (
      <g
        key={`investigator-${investigator.id}`}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
        className="investigator-marker"
      >
        {/* Pulse ring */}
        {position.pulsing && (
          <circle
            cx={transformed.x}
            cy={transformed.y}
            r={pulseSize * 1.5}
            fill="none"
            stroke={investigator.color}
            strokeWidth={1}
            opacity={0.3}
            className="pulse-ring"
          />
        )}
        
        {/* Accuracy circle */}
        {position.accuracy && (
          <circle
            cx={transformed.x}
            cy={transformed.y}
            r={Math.max(size, (position.accuracy || 1) * zoomLevel)}
            fill={investigator.color}
            opacity={0.1}
            stroke={investigator.color}
            strokeWidth={0.5}
            strokeDasharray="2,2"
          />
        )}

        {/* Main dot */}
        <circle
          cx={transformed.x}
          cy={transformed.y}
          r={size}
          fill={investigator.color}
          stroke="#ffffff"
          strokeWidth={Math.max(1, zoomLevel * 0.5)}
          className="investigator-dot"
        />

        {/* Status indicator */}
        <circle
          cx={transformed.x + size * 0.6}
          cy={transformed.y - size * 0.6}
          r={size * 0.3}
          fill={getStatusColor(investigator.status)}
          stroke="#ffffff"
          strokeWidth={0.5}
        />

        {/* Device type icon */}
        <text
          x={transformed.x}
          y={transformed.y + 2}
          textAnchor="middle"
          fontSize={size * 0.8}
          fill="#ffffff"
          className="device-icon"
        >
          {getDeviceIcon(investigator.deviceType)}
        </text>

        {/* Name label */}
        {showInvestigatorNames && (
          <g>
            <rect
              x={transformed.x - 30}
              y={transformed.y + size + 5}
              width={60}
              height={16}
              fill="rgba(0, 0, 0, 0.8)"
              rx={4}
            />
            <text
              x={transformed.x}
              y={transformed.y + size + 15}
              textAnchor="middle"
              fontSize={10}
              fill="#ffffff"
              className="investigator-name"
            >
              {investigator.name.split(' ')[0]}
            </text>
          </g>
        )}
      </g>
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'away': return '#FF9800';
      case 'offline': return '#9E9E9E';
      default: return '#2196F3';
    }
  };

  const getDeviceIcon = (deviceType: string): string => {
    switch (deviceType) {
      case 'mobile': return '📱';
      case 'tablet': return '💻';
      case 'desktop': return '🖥️';
      default: return '📍';
    }
  };

  return (
    <div className="position-overlay">
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'auto',
          zIndex: 10
        }}
      >
        {/* Render trails first (behind investigators) */}
        {showTrails && Array.from(trails.entries()).map(([investigatorId, trail]) => {
          const investigator = investigators.get(investigatorId);
          return investigator ? renderTrail(investigatorId, trail, investigator.color) : null;
        })}

        {/* Render investigators */}
        {Array.from(positions.entries()).map(([investigatorId, position]) => {
          const investigator = investigators.get(investigatorId);
          return investigator ? renderInvestigator(position, investigator) : null;
        })}
      </svg>

      <style jsx>{`
        .position-overlay {
          position: relative;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .investigator-marker {
          transition: all 0.2s ease;
        }

        .investigator-marker:hover .investigator-dot {
          r: ${8 * Math.max(0.5, zoomLevel) * 1.2};
        }

        .pulse-ring {
          animation: pulse 2s ease-out;
        }

        @keyframes pulse {
          0% {
            r: ${8 * Math.max(0.5, zoomLevel)};
            opacity: 0.7;
          }
          100% {
            r: ${8 * Math.max(0.5, zoomLevel) * 2};
            opacity: 0;
          }
        }

        .investigator-name {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 500;
        }

        .device-icon {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .investigator-name {
            font-size: 8px;
          }
        }
      `}</style>
    </div>
  );
};