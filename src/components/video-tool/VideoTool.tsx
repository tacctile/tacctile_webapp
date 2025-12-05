import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Slider, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FlagIcon from '@mui/icons-material/Flag';
import VideocamIcon from '@mui/icons-material/Videocam';
import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank } from '@/components/evidence-bank';
import { MetadataPanel, PrecisionSlider, FlagsPanel, ResizablePanelSplit, type Flag } from '@/components/common';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useNavigationStore } from '@/stores/useNavigationStore';

// Styled components
const ViewerContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

const VideoWrapper = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  backgroundColor: '#000',
});

const VideoElement = styled('video')({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
});

const VideoPlaceholder = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  gap: 2,
});

const VideoControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  backgroundColor: '#161616',
  borderTop: '1px solid #252525',
});

const TimelineTrack = styled(Box)({
  height: 60,
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #252525',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
});

const AudioWaveform = styled(Box)({
  height: 32,
  flex: 1,
  backgroundColor: '#1e1e1e',
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#444',
  fontSize: '11px',
});

const FilterSection = styled(Box)({
  marginBottom: 16,
});

const FilterLabel = styled(Typography)({
  fontSize: '11px',
  color: '#808080',
  marginBottom: 4,
  display: 'flex',
  justifyContent: 'space-between',
});

const FilterSlider = styled(Slider)({
  color: '#19abb5',
  height: 4,
  padding: '8px 0',
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
    '&:hover, &.Mui-focusVisible': {
      boxShadow: '0 0 0 6px rgba(25, 171, 181, 0.15)',
    },
  },
  '& .MuiSlider-track': {
    border: 'none',
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#333',
  },
});

// Mock video evidence
const videoEvidence = [
  { id: 'v1', type: 'video' as const, fileName: 'camera_01_main_hall.mp4', duration: 3847, capturedAt: Date.now() - 7200000, user: 'Sarah', deviceInfo: 'Sony A7IV', flagCount: 3, hasFindings: true, format: 'H.265 / 4K', gps: '39.95°N, 75.16°W' },
  { id: 'v2', type: 'video' as const, fileName: 'camera_02_basement.mp4', duration: 3902, capturedAt: Date.now() - 7000000, user: 'Mike', deviceInfo: 'GoPro Hero 11', flagCount: 1, hasFindings: false, format: 'H.264 / 4K', gps: '39.95°N, 75.16°W' },
  { id: 'v3', type: 'video' as const, fileName: 'static_cam_attic.mp4', duration: 7200, capturedAt: Date.now() - 4800000, user: 'Jen', deviceInfo: 'Wyze Cam v3', flagCount: 0, hasFindings: false, format: 'H.264 / 1080p', gps: null },
  { id: 'v4', type: 'video' as const, fileName: 'handheld_investigation.mp4', duration: 2400, capturedAt: Date.now() - 6000000, user: 'Sarah', deviceInfo: 'iPhone 15 Pro', flagCount: 5, hasFindings: true, format: 'H.265 / 4K', gps: '39.95°N, 75.16°W' },
];

// Mock flags data
const mockFlags: Flag[] = [
  { id: 'f1', timestamp: 873000, label: 'Shadow movement', note: 'Dark figure moves across doorway, left to right. Approximately 2 seconds duration.', createdBy: 'Sarah', createdAt: Date.now() - 3600000 },
  { id: 'f2', timestamp: 1337000, label: 'Audio anomaly', note: 'Possible voice, sounds like whisper.', createdBy: 'Mike', createdAt: Date.now() - 3000000 },
  { id: 'f3', timestamp: 2244000, label: 'Light flicker', createdBy: 'Sarah', createdAt: Date.now() - 1800000 },
];

// Filter defaults
const defaultFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  gamma: 100,
  nightVision: 0,
  sharpen: 0,
};

// Helper function to format duration in HH:MM:SS
const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface VideoToolProps {
  investigationId?: string;
}

export const VideoTool: React.FC<VideoToolProps> = ({ investigationId }) => {
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null);
  const [loadedVideo, setLoadedVideo] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [filters, setFilters] = useState(defaultFilters);
  const [flags, setFlags] = useState<Flag[]>(mockFlags);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  // Watch for navigation to this tool with a file
  const loadedFileId = useNavigationStore((state) => state.loadedFiles.video);

  // Load video when navigated to from another tool
  useEffect(() => {
    if (loadedFileId) {
      // Find the file in evidence and load it
      const file = videoEvidence.find((e) => e.id === loadedFileId);
      if (file) {
        setLoadedVideo(file);
        setSelectedEvidence(file);
        // Reset filters when loading new video
        setFilters(defaultFilters);
      }
    }
  }, [loadedFileId]);

  // Sync video with global playhead
  useEffect(() => {
    if (videoRef.current && loadedVideo) {
      // Convert global timestamp to video-relative time
      // This is simplified - real implementation would use file's start timestamp
      const videoTime = timestamp / 1000;
      if (Math.abs(videoRef.current.currentTime - videoTime) > 0.5) {
        videoRef.current.currentTime = videoTime;
      }
    }
  }, [timestamp, loadedVideo]);

  const handleDoubleClick = useCallback((item: any) => {
    console.log('Load video:', item.fileName);
    setLoadedVideo(item);
    // Reset filters when loading new video
    setFilters(defaultFilters);
  }, []);

  const handleFilterChange = (filter: keyof typeof defaultFilters) => (
    _: Event,
    value: number | number[]
  ) => {
    setFilters((prev) => ({ ...prev, [filter]: value as number }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const handleAddFlag = () => {
    console.log('Add flag at timestamp:', timestamp);
    // TODO: Implement flag creation
  };

  // Build CSS filter string from filter values
  const cssFilters = `
    brightness(${filters.brightness}%)
    contrast(${filters.contrast}%)
    saturate(${filters.saturation}%)
  `.trim();

  // Main video viewer content
  const mainContent = (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#0d0d0d',
    }}>
      {/* Video Viewer - takes majority of space */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        minHeight: 0, // Important for flex shrinking
        position: 'relative',
        padding: 2,
      }}>
        {loadedVideo ? (
          <Box sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <VideoElement
              ref={videoRef}
              style={{
                filter: cssFilters,
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
              controls={false}
              muted={isMuted}
            />
          </Box>
        ) : (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: '#444',
          }}>
            <VideocamIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 14, color: '#555' }}>
              No video loaded
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#444', mt: 0.5 }}>
              Double-click a video in the Evidence panel
            </Typography>
          </Box>
        )}

        {/* Overlay controls - top right */}
        {loadedVideo && (
          <Box sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 0.5,
          }}>
            <Tooltip title="Add flag (M)">
              <IconButton size="small" onClick={handleAddFlag} sx={{ color: '#888', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <FlagIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fullscreen">
              <IconButton size="small" sx={{ color: '#888', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Timeline Section - fixed height */}
      <Box sx={{
        height: 120,
        backgroundColor: '#1a1a1a',
        borderTop: '1px solid #252525',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Timeline ruler */}
        <Box sx={{
          height: 24,
          backgroundColor: '#161616',
          borderBottom: '1px solid #252525',
          display: 'flex',
          alignItems: 'center',
          px: 1,
        }}>
          <Typography sx={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>
            {loadedVideo ? '00:00:00' : '--:--:--'}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>
            {loadedVideo ? formatDuration(loadedVideo.duration) : '--:--:--'}
          </Typography>
        </Box>

        {/* Video track */}
        <Box sx={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          px: 1,
          gap: 1,
          borderBottom: '1px solid #1f1f1f',
        }}>
          <Typography sx={{ fontSize: 10, color: '#666', width: 50 }}>VIDEO</Typography>
          <Box sx={{
            flex: 1,
            height: 24,
            backgroundColor: loadedVideo ? '#c45c5c' : '#252525',
            borderRadius: 1,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {loadedVideo && (
              <Typography sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 10,
                color: '#fff',
                whiteSpace: 'nowrap',
              }}>
                {loadedVideo.fileName}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Audio track */}
        <Box sx={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          px: 1,
          gap: 1,
        }}>
          <Typography sx={{ fontSize: 10, color: '#666', width: 50 }}>AUDIO</Typography>
          <Box sx={{
            flex: 1,
            height: 24,
            backgroundColor: loadedVideo ? '#5a9a6b' : '#252525',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {loadedVideo ? (
              // Fake waveform visualization
              <Box sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                px: 1,
                gap: '1px',
              }}>
                {Array.from({ length: 100 }).map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      flex: 1,
                      height: `${20 + Math.random() * 60}%`,
                      backgroundColor: 'rgba(255,255,255,0.4)',
                      borderRadius: 0.5,
                    }}
                  />
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: 10, color: '#444' }}>No audio</Typography>
            )}
          </Box>
        </Box>

        {/* Playhead line - would be positioned based on current time */}
        {loadedVideo && (
          <Box sx={{
            position: 'absolute',
            left: '30%', // This should be calculated from timestamp
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: '#19abb5',
            pointerEvents: 'none',
            zIndex: 10,
          }} />
        )}
      </Box>

      {/* Mini transport - integrated with timeline */}
      <Box sx={{
        height: 32,
        backgroundColor: '#161616',
        borderTop: '1px solid #252525',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        px: 2,
      }}>
        <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
          <IconButton size="small" onClick={() => setIsMuted(!isMuted)} sx={{ color: '#666' }}>
            {isMuted ? <VolumeOffIcon sx={{ fontSize: 16 }} /> : <VolumeUpIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>

        <Slider
          size="small"
          value={volume}
          onChange={(_, v) => setVolume(v as number)}
          sx={{ width: 60, color: '#19abb5' }}
          disabled={isMuted}
        />

        <Box sx={{ width: 16 }} />

        <Typography sx={{
          fontSize: 11,
          color: '#19abb5',
          fontFamily: '"JetBrains Mono", monospace',
          minWidth: 70,
        }}>
          {loadedVideo ? '00:00:00:00' : '--:--:--:--'}
        </Typography>
      </Box>
    </Box>
  );

  // Filter controls for inspector panel
  const filtersContent = (
    <Box sx={{ height: '100%', overflowY: 'auto', padding: '8px 12px' }}>
      <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#666', textTransform: 'uppercase', mb: 1 }}>
        Video Filters
      </Typography>

      <PrecisionSlider
        label="Brightness"
        value={filters.brightness}
        min={0}
        max={200}
        step={1}
        unit="%"
        onChange={(v) => setFilters(prev => ({ ...prev, brightness: v }))}
        disabled={!loadedVideo}
      />
      <PrecisionSlider
        label="Contrast"
        value={filters.contrast}
        min={0}
        max={200}
        step={1}
        unit="%"
        onChange={(v) => setFilters(prev => ({ ...prev, contrast: v }))}
        disabled={!loadedVideo}
      />
      <PrecisionSlider
        label="Saturation"
        value={filters.saturation}
        min={0}
        max={200}
        step={1}
        unit="%"
        onChange={(v) => setFilters(prev => ({ ...prev, saturation: v }))}
        disabled={!loadedVideo}
      />
      <PrecisionSlider
        label="Gamma"
        value={filters.gamma}
        min={0}
        max={200}
        step={1}
        unit="%"
        onChange={(v) => setFilters(prev => ({ ...prev, gamma: v }))}
        disabled={!loadedVideo}
      />

      <Box sx={{ height: 1, backgroundColor: '#252525', my: 2 }} />

      <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#666', textTransform: 'uppercase', mb: 1 }}>
        Enhancement
      </Typography>

      <PrecisionSlider
        label="Night Vision"
        value={filters.nightVision || 0}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v) => setFilters(prev => ({ ...prev, nightVision: v }))}
        disabled={!loadedVideo}
      />
      <PrecisionSlider
        label="Sharpen"
        value={filters.sharpen || 0}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v) => setFilters(prev => ({ ...prev, sharpen: v }))}
        disabled={!loadedVideo}
      />
    </Box>
  );

  const inspectorContent = (
    <ResizablePanelSplit
      top={filtersContent}
      bottom={
        <FlagsPanel
          flags={flags}
          onFlagClick={(flag) => {
            // Jump to timestamp
            console.log('Jump to:', flag.timestamp);
          }}
          onFlagAdd={() => {
            // Add flag at current position
            console.log('Add flag');
          }}
          onFlagEdit={(flag) => {
            console.log('Edit flag:', flag.id);
          }}
          onFlagDelete={(flagId) => {
            setFlags(prev => prev.filter(f => f.id !== flagId));
          }}
          disabled={!loadedVideo}
        />
      }
      defaultSplit={55}
      minTopHeight={150}
      minBottomHeight={150}
      storageKey="tacctile_video_inspector_split"
    />
  );

  return (
    <WorkspaceLayout
      evidencePanel={
        <EvidenceBank
          items={videoEvidence}
          selectedId={selectedEvidence?.id}
          onSelect={(item) => setSelectedEvidence(item)}
          onDoubleClick={handleDoubleClick}
          filterByType="video"
        />
      }
      metadataPanel={
        <MetadataPanel
          data={selectedEvidence ? {
            fileName: selectedEvidence.fileName,
            capturedAt: selectedEvidence.capturedAt,
            duration: selectedEvidence.duration,
            user: selectedEvidence.user,
            device: selectedEvidence.deviceInfo,
            format: selectedEvidence.format,
            gps: selectedEvidence.gps,
            flagCount: selectedEvidence.flagCount,
          } : null}
          type="video"
        />
      }
      inspectorPanel={inspectorContent}
      mainContent={mainContent}
      evidenceTitle="Video Files"
      inspectorTitle="Filters"
      showTransport={true}
    />
  );
};

export default VideoTool;
