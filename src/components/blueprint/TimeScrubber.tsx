import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TimeRange } from '../../services/visualization/DataVisualizationService';
import { getWebSocketService } from '../../services/realtime/WebSocketService';

interface TimeScrubberProps {
  timeRange: TimeRange;
  currentTime: Date;
  onTimeChange: (time: Date) => void;
  onTimeRangeChange: (range: TimeRange) => void;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  showHeatMapData?: boolean;
  investigationStart?: Date;
  investigationEnd?: Date;
}

interface TimelineMarker {
  time: Date;
  type: 'event' | 'evidence' | 'investigator' | 'anomaly';
  label: string;
  investigatorId?: string;
  color?: string;
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
  timeRange,
  currentTime,
  onTimeChange,
  onTimeRangeChange,
  isPlaying,
  onPlayPause,
  playbackSpeed,
  onSpeedChange,
  showHeatMapData = true,
  investigationStart,
  investigationEnd
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'currentTime' | 'rangeStart' | 'rangeEnd' | null>(null);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipContent, setTooltipContent] = useState<{ time: Date; content: string } | null>(null);
  const [heatMapIntensity, setHeatMapIntensity] = useState<Array<{ time: Date; intensity: number }>>([]);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout>();
  const lastUpdateTimeRef = useRef<Date>(new Date());

  const totalDuration = timeRange.end.getTime() - timeRange.start.getTime();
  const currentPosition = totalDuration > 0 ? 
    (currentTime.getTime() - timeRange.start.getTime()) / totalDuration : 0;

  // Playback control
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        const now = new Date();
        const deltaMs = now.getTime() - lastUpdateTimeRef.current.getTime();
        const scaledDelta = deltaMs * playbackSpeed;
        
        const newTime = new Date(currentTime.getTime() + scaledDelta);
        
        if (newTime >= timeRange.end) {
          onTimeChange(timeRange.end);
          onPlayPause(false);
        } else {
          onTimeChange(newTime);
        }
        
        lastUpdateTimeRef.current = now;
      }, 50); // 20 FPS update rate
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    }

    lastUpdateTimeRef.current = new Date();

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, currentTime, timeRange, playbackSpeed, onTimeChange, onPlayPause]);

  // Load timeline markers
  useEffect(() => {
    const loadMarkers = async () => {
      const wsService = getWebSocketService();
      const investigatorTrails = wsService.getAllTrails();
      const newMarkers: TimelineMarker[] = [];

      // Add investigator position markers
      investigatorTrails.forEach((trail, investigatorId) => {
        const investigator = wsService.getConnectedInvestigators()
          .find(inv => inv.id === investigatorId);
        
        if (!investigator) return;

        // Sample trail points for markers (every 30 seconds)
        const sampledPoints = trail.filter((point, index) => 
          index % 30 === 0 || point.activity === 'running'
        );

        sampledPoints.forEach(point => {
          newMarkers.push({
            time: point.timestamp,
            type: 'investigator',
            label: `${investigator.name} - ${point.activity || 'moving'}`,
            investigatorId: investigator.id,
            color: investigator.color
          });
        });
      });

      // Add evidence markers (if available)
      // This would come from evidence service in a real implementation
      
      // Add anomaly markers (simulated)
      const anomalyCount = Math.floor(Math.random() * 5) + 2;
      for (let i = 0; i < anomalyCount; i++) {
        const randomTime = new Date(
          timeRange.start.getTime() + 
          Math.random() * totalDuration
        );
        
        newMarkers.push({
          time: randomTime,
          type: 'anomaly',
          label: `Anomaly detected - ${['EMF spike', 'Temperature drop', 'Audio event'][Math.floor(Math.random() * 3)]}`,
          color: '#ff6b6b'
        });
      }

      // Sort markers by time
      newMarkers.sort((a, b) => a.time.getTime() - b.time.getTime());
      setMarkers(newMarkers);
    };

    loadMarkers();
  }, [timeRange, totalDuration]);

  // Generate heat map intensity data for timeline visualization
  useEffect(() => {
    if (!showHeatMapData) return;

    const generateIntensityData = () => {
      const intensityPoints: Array<{ time: Date; intensity: number }> = [];
      const stepSize = Math.max(1000, totalDuration / 200); // 200 data points max
      
      for (let t = timeRange.start.getTime(); t <= timeRange.end.getTime(); t += stepSize) {
        const time = new Date(t);
        
        // Simulate intensity based on markers and random variation
        let intensity = Math.random() * 0.3; // Base noise
        
        // Add intensity spikes near markers
        markers.forEach(marker => {
          const timeDiff = Math.abs(time.getTime() - marker.time.getTime());
          if (timeDiff < 300000) { // 5 minutes
            const proximity = 1 - (timeDiff / 300000);
            intensity += proximity * 0.7;
          }
        });
        
        intensity = Math.min(1, intensity);
        intensityPoints.push({ time, intensity });
      }
      
      setHeatMapIntensity(intensityPoints);
    };

    generateIntensityData();
  }, [markers, timeRange, totalDuration, showHeatMapData]);

  const getTimeFromPosition = useCallback((x: number, width: number): Date => {
    const position = Math.max(0, Math.min(1, x / width));
    return new Date(timeRange.start.getTime() + position * totalDuration);
  }, [timeRange, totalDuration]);

  const getPositionFromTime = useCallback((time: Date, width: number): number => {
    const position = totalDuration > 0 ? 
      (time.getTime() - timeRange.start.getTime()) / totalDuration : 0;
    return Math.max(0, Math.min(width, position * width));
  }, [timeRange, totalDuration]);

  const handleMouseDown = useCallback((event: React.MouseEvent, type: 'currentTime' | 'rangeStart' | 'rangeEnd') => {
    event.preventDefault();
    setIsDragging(true);
    setDragType(type);
    
    if (type === 'currentTime' && isPlaying) {
      onPlayPause(false); // Pause when manually scrubbing
    }
  }, [isPlaying, onPlayPause]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = getTimeFromPosition(x, rect.width);

    if (isDragging && dragType) {
      switch (dragType) {
        case 'currentTime':
          onTimeChange(time);
          break;
        case 'rangeStart':
          if (time < timeRange.end) {
            onTimeRangeChange({ start: time, end: timeRange.end });
          }
          break;
        case 'rangeEnd':
          if (time > timeRange.start) {
            onTimeRangeChange({ start: timeRange.start, end: time });
          }
          break;
      }
    } else {
      // Show tooltip for markers
      const marker = markers.find(m => 
        Math.abs(getPositionFromTime(m.time, rect.width) - x) < 10
      );
      
      if (marker) {
        setTooltipContent({
          time: marker.time,
          content: marker.label
        });
        setShowTooltip(true);
      } else {
        setShowTooltip(false);
      }
    }
  }, [isDragging, dragType, timeRange, getTimeFromPosition, getPositionFromTime, markers, onTimeChange, onTimeRangeChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!timelineRef.current || isDragging) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = getTimeFromPosition(x, rect.width);
    
    onTimeChange(time);
  }, [isDragging, getTimeFromPosition, onTimeChange]);

  const formatTime = useCallback((date: Date): string => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }, []);

  const formatDuration = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const speedOptions = [0.25, 0.5, 1, 2, 4, 8, 16];

  return (
    <div className="time-scrubber">
      <div className="scrubber-header">
        <div className="playback-controls">
          <button
            className={`play-button ${isPlaying ? 'playing' : 'paused'}`}
            onClick={() => onPlayPause(!isPlaying)}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <div className="time-display">
            <span className="current-time">{formatTime(currentTime)}</span>
            <span className="time-separator">/</span>
            <span className="total-duration">{formatDuration(totalDuration)}</span>
          </div>
          
          <div className="speed-control">
            <label>Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            >
              {speedOptions.map(speed => (
                <option key={speed} value={speed}>
                  {speed}x
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="time-range-display">
          <span>{formatTime(timeRange.start)} - {formatTime(timeRange.end)}</span>
        </div>
      </div>

      <div 
        className="timeline-container"
        ref={timelineRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleTimelineClick}
      >
        {/* Heat map intensity background */}
        {showHeatMapData && (
          <div className="intensity-background">
            {heatMapIntensity.map((point, index) => {
              const position = getPositionFromTime(point.time, 400); // Assuming 400px width
              const opacity = point.intensity * 0.3;
              return (
                <div
                  key={index}
                  className="intensity-bar"
                  style={{
                    left: `${position}px`,
                    backgroundColor: `rgba(187, 134, 252, ${opacity})`,
                    height: `${20 + point.intensity * 10}px`
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Timeline track */}
        <div className="timeline-track">
          {/* Investigation bounds */}
          {investigationStart && investigationEnd && (
            <div 
              className="investigation-bounds"
              style={{
                left: `${(investigationStart.getTime() - timeRange.start.getTime()) / totalDuration * 100}%`,
                width: `${(investigationEnd.getTime() - investigationStart.getTime()) / totalDuration * 100}%`
              }}
            />
          )}

          {/* Time range selection */}
          <div className="time-range-selection">
            <div 
              className="range-handle range-start"
              style={{ left: '0%' }}
              onMouseDown={(e) => handleMouseDown(e, 'rangeStart')}
            />
            <div 
              className="range-handle range-end"
              style={{ right: '0%' }}
              onMouseDown={(e) => handleMouseDown(e, 'rangeEnd')}
            />
          </div>

          {/* Timeline markers */}
          {markers.map((marker, index) => {
            // const markerPosition = getPositionFromTime(marker.time, 400);
            return (
              <div
                key={index}
                className={`timeline-marker ${marker.type}`}
                style={{
                  left: `${(marker.time.getTime() - timeRange.start.getTime()) / totalDuration * 100}%`,
                  borderColor: marker.color || '#bb86fc'
                }}
                title={`${formatTime(marker.time)} - ${marker.label}`}
              />
            );
          })}

          {/* Current time indicator */}
          <div 
            className="current-time-indicator"
            style={{ left: `${currentPosition * 100}%` }}
            onMouseDown={(e) => handleMouseDown(e, 'currentTime')}
          >
            <div className="time-handle" />
            <div className="time-line" />
          </div>
        </div>

        {/* Time labels */}
        <div className="time-labels">
          <span className="time-label start">{formatTime(timeRange.start)}</span>
          <span className="time-label end">{formatTime(timeRange.end)}</span>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && tooltipContent && (
        <div className="timeline-tooltip">
          <div className="tooltip-time">{formatTime(tooltipContent.time)}</div>
          <div className="tooltip-content">{tooltipContent.content}</div>
        </div>
      )}

      <style jsx>{`
        .time-scrubber {
          background: var(--surface-secondary, #1e1e1e);
          border-top: 1px solid var(--border-color, #333333);
          padding: 16px;
          user-select: none;
        }

        .scrubber-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .playback-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .play-button {
          width: 40px;
          height: 40px;
          background: var(--accent-color, #bb86fc);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .play-button:hover {
          background: var(--accent-hover, #985eff);
          transform: scale(1.05);
        }

        .play-button.playing {
          background: #ff6b6b;
        }

        .time-display {
          display: flex;
          align-items: center;
          font-family: 'Courier New', monospace;
          font-size: 1rem;
          color: var(--text-primary, #ffffff);
        }

        .current-time {
          font-weight: 600;
        }

        .time-separator {
          margin: 0 8px;
          color: var(--text-secondary, #aaaaaa);
        }

        .total-duration {
          color: var(--text-secondary, #aaaaaa);
        }

        .speed-control {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: var(--text-primary, #ffffff);
        }

        .speed-control select {
          background: var(--surface-tertiary, #2d2d2d);
          border: 1px solid var(--border-color, #444444);
          border-radius: 4px;
          color: var(--text-primary, #ffffff);
          padding: 4px 8px;
        }

        .time-range-display {
          font-size: 0.875rem;
          color: var(--text-secondary, #aaaaaa);
        }

        .timeline-container {
          position: relative;
          height: 50px;
          background: var(--surface-tertiary, #2d2d2d);
          border-radius: 8px;
          cursor: pointer;
          overflow: hidden;
        }

        .intensity-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: flex-end;
          pointer-events: none;
        }

        .intensity-bar {
          width: 2px;
          position: absolute;
          bottom: 0;
          transition: all 0.2s ease;
        }

        .timeline-track {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 20px;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(187, 134, 252, 0.1) 50%,
            transparent 100%
          );
        }

        .investigation-bounds {
          position: absolute;
          top: 0;
          bottom: 0;
          background: rgba(76, 175, 80, 0.2);
          border-left: 2px solid #4CAF50;
          border-right: 2px solid #4CAF50;
        }

        .time-range-selection {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
        }

        .range-handle {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 8px;
          background: var(--accent-color, #bb86fc);
          cursor: ew-resize;
          opacity: 0.8;
          transition: opacity 0.2s ease;
        }

        .range-handle:hover {
          opacity: 1;
        }

        .range-start {
          border-radius: 4px 0 0 4px;
        }

        .range-end {
          border-radius: 0 4px 4px 0;
        }

        .timeline-marker {
          position: absolute;
          top: 5px;
          width: 3px;
          height: 20px;
          border-radius: 1px;
          cursor: pointer;
        }

        .timeline-marker.investigator {
          background: var(--accent-color, #bb86fc);
        }

        .timeline-marker.evidence {
          background: #4CAF50;
        }

        .timeline-marker.anomaly {
          background: #ff6b6b;
        }

        .timeline-marker.event {
          background: #FF9800;
        }

        .current-time-indicator {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          cursor: ew-resize;
        }

        .time-handle {
          position: absolute;
          top: -3px;
          left: -6px;
          width: 14px;
          height: 14px;
          background: var(--accent-color, #bb86fc);
          border: 2px solid white;
          border-radius: 50%;
          cursor: ew-resize;
        }

        .time-line {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 2px;
          background: var(--accent-color, #bb86fc);
          pointer-events: none;
        }

        .time-labels {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 8px;
        }

        .time-label {
          font-size: 0.75rem;
          color: var(--text-secondary, #aaaaaa);
          pointer-events: none;
        }

        .timeline-tooltip {
          position: absolute;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.875rem;
          white-space: nowrap;
          z-index: 1000;
          pointer-events: none;
        }

        .tooltip-time {
          font-weight: 600;
          color: var(--accent-color, #bb86fc);
        }

        .tooltip-content {
          margin-top: 2px;
          font-size: 0.8rem;
          opacity: 0.9;
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
          --accent-hover: #985eff;
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .time-scrubber {
            padding: 12px;
          }
          
          .scrubber-header {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }
          
          .playback-controls {
            justify-content: center;
          }
          
          .speed-control {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};