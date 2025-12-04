/**
 * StreamPreview Component
 * WebRTC-based live preview canvas with source compositing
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { styled } from '@mui/material/styles';

import type { Scene, Source } from '../../types/streaming';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled(Box)({
  flex: 1,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

const Canvas = styled('canvas')({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
});

const Overlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: '#888888',
});

const WidgetOverlay = styled(Box)<{
  x: number;
  y: number;
  width: number;
  height: number;
}>(({ x, y, width, height }) => ({
  position: 'absolute',
  left: `${(x / 1920) * 100}%`,
  top: `${(y / 1080) * 100}%`,
  width: `${(width / 1920) * 100}%`,
  height: `${(height / 1080) * 100}%`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
}));

const SensorWidget = styled(Box)<{ alertActive?: boolean }>(({ alertActive }) => ({
  backgroundColor: alertActive ? 'rgba(244, 67, 54, 0.9)' : 'rgba(0, 0, 0, 0.75)',
  borderRadius: 8,
  padding: '8px 16px',
  border: `2px solid ${alertActive ? '#f44336' : '#19abb5'}`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: 80,
}));

const WidgetLabel = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: '#888888',
  textTransform: 'uppercase',
  letterSpacing: 1,
});

const WidgetValue = styled(Typography)({
  fontSize: 24,
  fontWeight: 700,
  color: '#e1e1e1',
  fontFamily: 'monospace',
});

const WidgetUnit = styled(Typography)({
  fontSize: 12,
  color: '#666666',
});

const TimestampWidget = styled(Box)({
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  borderRadius: 4,
  padding: '6px 12px',
  fontFamily: 'monospace',
  fontSize: 14,
  color: '#e1e1e1',
  fontWeight: 600,
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface StreamPreviewProps {
  scene: Scene | null;
  isLive: boolean;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  availableDevices: MediaDeviceInfo[];
}

// ============================================================================
// COMPONENT
// ============================================================================

const StreamPreview: React.FC<StreamPreviewProps> = ({
  scene,
  isLive: _isLive,
  canvasRef: externalCanvasRef,
  availableDevices: _availableDevices,
}) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const animationFrameRef = useRef<number | undefined>(undefined);
  const mediaStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sensorValues, setSensorValues] = useState<Map<string, number>>(new Map());

  // Update timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate sensor value updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorValues((prev) => {
        const next = new Map(prev);
        // Simulate EMF readings
        next.set('emf', Math.random() * 10);
        // Simulate temperature
        next.set('temperature', 68 + Math.random() * 4);
        // Simulate motion
        next.set('motion', Math.random() > 0.8 ? 1 : 0);
        return next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Initialize camera streams for sources
  const initializeSource = useCallback(
    async (source: Source) => {
      if (source.type === 'camera' && source.settings.deviceId) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: source.settings.deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });

          mediaStreamsRef.current.set(source.id, stream);

          // Create video element for this stream
          const video = document.createElement('video');
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          await video.play();
          videoElementsRef.current.set(source.id, video);
        } catch (err) {
          console.error('Failed to initialize camera:', err);
        }
      } else if (source.type === 'screen_share') {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: source.settings.displaySurface || 'monitor',
            },
            audio: false,
          });

          mediaStreamsRef.current.set(source.id, stream);

          const video = document.createElement('video');
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          await video.play();
          videoElementsRef.current.set(source.id, video);
        } catch (err) {
          console.error('Failed to initialize screen share:', err);
        }
      }
    },
    []
  );

  // Clean up streams
  const cleanupStreams = useCallback(() => {
    mediaStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    mediaStreamsRef.current.clear();
    videoElementsRef.current.clear();
  }, []);

  // Initialize sources when scene changes
  useEffect(() => {
    if (!scene) {
      cleanupStreams();
      return;
    }

    setIsLoading(true);
    setError(null);

    const initSources = async () => {
      for (const source of scene.sources) {
        if (source.transform.visible) {
          await initializeSource(source);
        }
      }
      setIsLoading(false);
    };

    initSources();

    return cleanupStreams;
  }, [scene?.id]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1920;
    canvas.height = 1080;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Sort sources by z-index
      const sortedSources = [...scene.sources]
        .filter((s) => s.transform.visible)
        .sort((a, b) => a.zIndex - b.zIndex);

      // Render each source
      for (const source of sortedSources) {
        ctx.save();
        ctx.globalAlpha = source.transform.opacity;

        const { x, y, width, height, rotation, scaleX, scaleY } = source.transform;

        // Apply transforms
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-width / 2, -height / 2);

        switch (source.type) {
          case 'camera':
          case 'screen_share': {
            const video = videoElementsRef.current.get(source.id);
            if (video && video.readyState >= 2) {
              ctx.drawImage(video, 0, 0, width, height);
            } else {
              // Placeholder
              ctx.fillStyle = '#1a1a1a';
              ctx.fillRect(0, 0, width, height);
              ctx.fillStyle = '#444444';
              ctx.font = '24px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('No Signal', width / 2, height / 2);
            }
            break;
          }

          case 'color': {
            ctx.fillStyle = source.settings.color || '#000000';
            ctx.fillRect(0, 0, width, height);
            break;
          }

          case 'image': {
            // Image sources would load and cache images
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);
            break;
          }

          case 'text': {
            const { text, fontFamily, fontSize, fontColor, backgroundColor, textAlign, fontWeight } =
              source.settings;
            if (backgroundColor) {
              ctx.fillStyle = backgroundColor;
              ctx.fillRect(0, 0, width, height);
            }
            ctx.fillStyle = fontColor || '#ffffff';
            ctx.font = `${fontWeight || 'normal'} ${fontSize || 24}px ${fontFamily || 'sans-serif'}`;
            ctx.textAlign = (textAlign as CanvasTextAlign) || 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text || '', width / 2, height / 2);
            break;
          }

          default:
            break;
        }

        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scene, canvasRef]);

  // Render widget overlays
  const renderWidgetOverlays = () => {
    if (!scene) return null;

    return scene.sources
      .filter((s) => s.transform.visible && s.type.includes('widget'))
      .map((source) => {
        const { x, y, width, height } = source.transform;
        const { labelText, unit, alertThreshold } = source.settings;

        let value: number | string = '--';
        let alertActive = false;

        switch (source.type) {
          case 'emf_widget':
            value = (sensorValues.get('emf') || 0).toFixed(1);
            alertActive = alertThreshold !== undefined && Number(value) > alertThreshold;
            break;
          case 'temperature_widget':
            value = (sensorValues.get('temperature') || 0).toFixed(1);
            alertActive = alertThreshold !== undefined && Number(value) > alertThreshold;
            break;
          case 'motion_widget':
            value = sensorValues.get('motion') ? 'ACTIVE' : 'CLEAR';
            alertActive = sensorValues.get('motion') === 1;
            break;
          case 'timestamp_widget':
            return (
              <WidgetOverlay key={source.id} x={x} y={y} width={width} height={height}>
                <TimestampWidget>
                  {currentTime.toLocaleDateString()} {currentTime.toLocaleTimeString()}
                </TimestampWidget>
              </WidgetOverlay>
            );
        }

        return (
          <WidgetOverlay key={source.id} x={x} y={y} width={width} height={height}>
            <SensorWidget alertActive={alertActive}>
              {labelText && <WidgetLabel>{labelText}</WidgetLabel>}
              <WidgetValue>{value}</WidgetValue>
              {unit && <WidgetUnit>{unit}</WidgetUnit>}
            </SensorWidget>
          </WidgetOverlay>
        );
      });
  };

  if (!scene) {
    return (
      <Container>
        <Overlay>
          <Typography variant="body2">No scene selected</Typography>
        </Overlay>
      </Container>
    );
  }

  return (
    <Container>
      <Canvas ref={canvasRef as React.RefObject<HTMLCanvasElement>} />

      {/* Widget overlays rendered on top of canvas */}
      {renderWidgetOverlays()}

      {isLoading && (
        <Overlay>
          <CircularProgress size={40} sx={{ color: '#19abb5', mb: 2 }} />
          <Typography variant="body2">Loading sources...</Typography>
        </Overlay>
      )}

      {error && (
        <Overlay>
          <Typography variant="body2" sx={{ color: '#f44336' }}>
            {error}
          </Typography>
        </Overlay>
      )}
    </Container>
  );
};

export default StreamPreview;
