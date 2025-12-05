import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Slider, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FlagIcon from '@mui/icons-material/Flag';
import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank } from '@/components/evidence-bank';
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
  { id: 'v1', type: 'video' as const, fileName: 'camera_01_main_hall.mp4', duration: 3847, capturedAt: Date.now() - 7200000, user: 'Sarah', deviceInfo: 'Sony A7IV', flagCount: 3, hasFindings: true },
  { id: 'v2', type: 'video' as const, fileName: 'camera_02_basement.mp4', duration: 3902, capturedAt: Date.now() - 7000000, user: 'Mike', deviceInfo: 'GoPro Hero 11', flagCount: 1, hasFindings: false },
  { id: 'v3', type: 'video' as const, fileName: 'static_cam_attic.mp4', duration: 7200, capturedAt: Date.now() - 4800000, user: 'Jen', deviceInfo: 'Wyze Cam v3', flagCount: 0, hasFindings: false },
  { id: 'v4', type: 'video' as const, fileName: 'handheld_investigation.mp4', duration: 2400, capturedAt: Date.now() - 6000000, user: 'Sarah', deviceInfo: 'iPhone 15 Pro', flagCount: 5, hasFindings: true },
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
    <ViewerContainer>
      <VideoWrapper>
        {loadedVideo ? (
          <VideoElement
            ref={videoRef}
            style={{ filter: cssFilters }}
            controls={false}
            muted={isMuted}
          >
            {/* Source would be set when actual file is loaded */}
          </VideoElement>
        ) : (
          <VideoPlaceholder>
            <Typography sx={{ fontSize: 14 }}>No video loaded</Typography>
            <Typography sx={{ fontSize: 12 }}>
              Double-click a video in the Evidence panel to load it
            </Typography>
          </VideoPlaceholder>
        )}
      </VideoWrapper>

      {/* Video-specific controls */}
      <VideoControls>
        <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
          <IconButton size="small" onClick={() => setIsMuted(!isMuted)} sx={{ color: '#888' }}>
            {isMuted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Slider
          size="small"
          value={volume}
          onChange={(_, v) => setVolume(v as number)}
          sx={{ width: 80, color: '#19abb5' }}
          disabled={isMuted}
        />

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Add flag at current position (M)">
          <IconButton size="small" onClick={handleAddFlag} sx={{ color: '#888' }}>
            <FlagIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Fullscreen">
          <IconButton size="small" sx={{ color: '#888' }}>
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </VideoControls>

      {/* Audio waveform track */}
      <TimelineTrack>
        <AudioWaveform>
          {loadedVideo ? 'Audio waveform visualization' : 'No audio track'}
        </AudioWaveform>
      </TimelineTrack>
    </ViewerContainer>
  );

  // Filter controls for inspector panel
  const inspectorContent = (
    <Box sx={{ padding: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#808080', textTransform: 'uppercase' }}>
          Video Filters
        </Typography>
        <Typography
          onClick={resetFilters}
          sx={{ fontSize: 10, color: '#19abb5', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
        >
          Reset
        </Typography>
      </Box>

      {!loadedVideo ? (
        <Typography sx={{ fontSize: 12, color: '#555' }}>
          Load a video to enable filters
        </Typography>
      ) : (
        <>
          <FilterSection>
            <FilterLabel>
              <span>Brightness</span>
              <span style={{ color: '#cccccc' }}>{filters.brightness}%</span>
            </FilterLabel>
            <FilterSlider
              value={filters.brightness}
              onChange={handleFilterChange('brightness')}
              min={0}
              max={200}
            />
          </FilterSection>

          <FilterSection>
            <FilterLabel>
              <span>Contrast</span>
              <span style={{ color: '#cccccc' }}>{filters.contrast}%</span>
            </FilterLabel>
            <FilterSlider
              value={filters.contrast}
              onChange={handleFilterChange('contrast')}
              min={0}
              max={200}
            />
          </FilterSection>

          <FilterSection>
            <FilterLabel>
              <span>Saturation</span>
              <span style={{ color: '#cccccc' }}>{filters.saturation}%</span>
            </FilterLabel>
            <FilterSlider
              value={filters.saturation}
              onChange={handleFilterChange('saturation')}
              min={0}
              max={200}
            />
          </FilterSection>

          <FilterSection>
            <FilterLabel>
              <span>Gamma</span>
              <span style={{ color: '#cccccc' }}>{filters.gamma}%</span>
            </FilterLabel>
            <FilterSlider
              value={filters.gamma}
              onChange={handleFilterChange('gamma')}
              min={50}
              max={150}
            />
          </FilterSection>

          <Box sx={{ borderTop: '1px solid #252525', mt: 2, pt: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#808080', textTransform: 'uppercase', mb: 2 }}>
              Enhancement
            </Typography>

            <FilterSection>
              <FilterLabel>
                <span>Night Vision</span>
                <span style={{ color: '#cccccc' }}>{filters.nightVision}%</span>
              </FilterLabel>
              <FilterSlider
                value={filters.nightVision}
                onChange={handleFilterChange('nightVision')}
                min={0}
                max={100}
              />
            </FilterSection>

            <FilterSection>
              <FilterLabel>
                <span>Sharpen</span>
                <span style={{ color: '#cccccc' }}>{filters.sharpen}%</span>
              </FilterLabel>
              <FilterSlider
                value={filters.sharpen}
                onChange={handleFilterChange('sharpen')}
                min={0}
                max={100}
              />
            </FilterSection>
          </Box>
        </>
      )}
    </Box>
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
      inspectorPanel={inspectorContent}
      mainContent={mainContent}
      evidenceTitle="Video Files"
      inspectorTitle="Filters"
      showTransport={true}
    />
  );
};

export default VideoTool;
