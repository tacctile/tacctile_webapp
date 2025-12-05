/**
 * VideoTool Component
 * DaVinci Resolve-inspired video viewer/analyzer (NOT an editor)
 * Focus on scrubbing, analyzing, and marking evidence
 */

import React, { useCallback, useEffect, useRef, useState, memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { styled } from '@mui/material/styles';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import RepeatIcon from '@mui/icons-material/Repeat';
import SpeedIcon from '@mui/icons-material/Speed';
import FlagIcon from '@mui/icons-material/Flag';
import GridViewIcon from '@mui/icons-material/GridView';
import TuneIcon from '@mui/icons-material/Tune';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import VideocamIcon from '@mui/icons-material/Videocam';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FullscreenIcon from '@mui/icons-material/Fullscreen';

// Components
import VideoPlayer from './VideoPlayer';
import VideoTimeline from './VideoTimeline';
import VideoAdjustments from './VideoAdjustments';
import CameraGrid from './CameraGrid';

// Store
import {
  useVideoToolStore,
  selectActiveSource,
  selectPlayback,
  selectAdjustments,
  selectVisibleMarkers,
  selectGridLayout,
  selectZoom,
  selectWaveformData,
} from '../../stores/useVideoToolStore';
import type { VideoSource, PlaybackSpeed, VideoMarker } from '../../types/video';
import { formatTimecode, VIDEO_SHORTCUTS } from '../../types/video';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const ToolContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#121212',
  color: '#e1e1e1',
  overflow: 'hidden',
});

const MainContent = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const MediaPool = styled(Box)<{ visible: boolean }>(({ visible }) => ({
  width: visible ? 220 : 0,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#141414',
  borderRight: '1px solid #2b2b2b',
  overflow: 'hidden',
  transition: 'width 0.2s ease',
}));

const MediaPoolHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
});

const MediaPoolContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
});

const CenterArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const ViewerArea = styled(Box)({
  flex: 1,
  display: 'flex',
  overflow: 'hidden',
  backgroundColor: '#000',
});

const TimelineArea = styled(Box)({
  height: 150,
  flexShrink: 0,
});

const AdjustmentsPanel = styled(Box)<{ visible: boolean }>(({ visible }) => ({
  width: visible ? 280 : 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'width 0.2s ease',
}));

const TransportBar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 12px',
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #2b2b2b',
  gap: 8,
});

const TransportGroup = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const TransportButton = styled(IconButton)({
  backgroundColor: '#252525',
  color: '#e1e1e1',
  padding: 6,
  '&:hover': {
    backgroundColor: '#333333',
  },
  '&.Mui-disabled': {
    color: '#555555',
  },
});

const PlayButton = styled(IconButton)({
  backgroundColor: '#19abb5',
  color: '#ffffff',
  width: 44,
  height: 44,
  '&:hover': {
    backgroundColor: '#36d1da',
  },
});

const TimeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 13,
  color: '#19abb5',
  minWidth: 90,
  textAlign: 'center',
});

const SpeedDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#888',
  minWidth: 40,
  textAlign: 'center',
});

const VolumeSlider = styled(Slider)({
  width: 80,
  '& .MuiSlider-thumb': {
    backgroundColor: '#19abb5',
    width: 12,
    height: 12,
  },
  '& .MuiSlider-track': {
    backgroundColor: '#19abb5',
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#404040',
  },
});

const ToolbarDivider = styled(Divider)({
  height: 24,
  borderColor: '#2b2b2b',
  margin: '0 8px',
});

const SourceListItem = styled(ListItemButton)<{ selected?: boolean }>(({ selected }) => ({
  borderRadius: 4,
  marginBottom: 2,
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

const EmptyState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#555',
  padding: 24,
  textAlign: 'center',
});

// ============================================================================
// PROPS
// ============================================================================

interface VideoToolProps {
  /** Investigation ID */
  investigationId?: string;
  /** Callback when a marker is created */
  onMarkerCreate?: (marker: VideoMarker) => void;
}

// ============================================================================
// SPEED OPTIONS
// ============================================================================

const SPEED_OPTIONS: PlaybackSpeed[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

// ============================================================================
// COMPONENT
// ============================================================================

const VideoTool: React.FC<VideoToolProps> = memo(({
  investigationId,
  onMarkerCreate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showGridView, setShowGridView] = useState(false);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null);

  // Store state using memoized selectors
  const sources = useVideoToolStore((state) => state.sources);
  const activeSource = useVideoToolStore(selectActiveSource);
  const playback = useVideoToolStore(selectPlayback);
  const adjustments = useVideoToolStore(selectAdjustments);
  const markers = useVideoToolStore((state) => state.markers);
  const visibleMarkers = useVideoToolStore(selectVisibleMarkers);
  const gridLayout = useVideoToolStore(selectGridLayout);
  const cameraSlots = useVideoToolStore((state) => state.cameraSlots);
  const tracks = useVideoToolStore((state) => state.tracks);
  const visibleTimeRange = useVideoToolStore((state) => state.visibleTimeRange);
  const zoom = useVideoToolStore(selectZoom);
  const waveformData = useVideoToolStore(selectWaveformData);
  const adjustmentsPanelVisible = useVideoToolStore((state) => state.adjustmentsPanelVisible);
  const mediaPoolVisible = useVideoToolStore((state) => state.mediaPoolVisible);

  // Store actions
  const {
    addSource,
    setActiveSource,
    togglePlayPause,
    seek,
    stepFrame,
    setSpeed,
    setVolume,
    toggleMute,
    toggleLoop,
    updatePlaybackTime,
    setDuration,
    setAdjustment,
    setFilter,
    resetAdjustments,
    addMarkerAtCurrentTime,
    setGridLayout,
    assignSourceToSlot,
    toggleSlotSync,
    toggleSlotMute,
    setVisibleTimeRange,
    setZoom,
    toggleAdjustmentsPanel,
    toggleMediaPool,
  } = useVideoToolStore(
    useShallow((state) => ({
      addSource: state.addSource,
      setActiveSource: state.setActiveSource,
      togglePlayPause: state.togglePlayPause,
      seek: state.seek,
      stepFrame: state.stepFrame,
      setSpeed: state.setSpeed,
      setVolume: state.setVolume,
      toggleMute: state.toggleMute,
      toggleLoop: state.toggleLoop,
      updatePlaybackTime: state.updatePlaybackTime,
      setDuration: state.setDuration,
      setAdjustment: state.setAdjustment,
      setFilter: state.setFilter,
      resetAdjustments: state.resetAdjustments,
      addMarkerAtCurrentTime: state.addMarkerAtCurrentTime,
      setGridLayout: state.setGridLayout,
      assignSourceToSlot: state.assignSourceToSlot,
      toggleSlotSync: state.toggleSlotSync,
      toggleSlotMute: state.toggleSlotMute,
      setVisibleTimeRange: state.setVisibleTimeRange,
      setZoom: state.setZoom,
      toggleAdjustmentsPanel: state.toggleAdjustmentsPanel,
      toggleMediaPool: state.toggleMediaPool,
    }))
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focused on input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case VIDEO_SHORTCUTS.playPause:
          e.preventDefault();
          togglePlayPause();
          break;
        case VIDEO_SHORTCUTS.frameBack:
          e.preventDefault();
          stepFrame(-1);
          break;
        case VIDEO_SHORTCUTS.frameForward:
          e.preventDefault();
          stepFrame(1);
          break;
        case VIDEO_SHORTCUTS.marker:
        case VIDEO_SHORTCUTS.marker.toUpperCase():
          e.preventDefault();
          const markerId = addMarkerAtCurrentTime();
          // Could trigger callback here
          break;
        case VIDEO_SHORTCUTS.gridToggle:
        case VIDEO_SHORTCUTS.gridToggle.toUpperCase():
          e.preventDefault();
          setShowGridView(!showGridView);
          break;
        case VIDEO_SHORTCUTS.mute:
        case VIDEO_SHORTCUTS.mute.toUpperCase():
          e.preventDefault();
          toggleMute();
          break;
        case VIDEO_SHORTCUTS.speedUp:
          e.preventDefault();
          cycleSpeed(1);
          break;
        case VIDEO_SHORTCUTS.speedDown:
          e.preventDefault();
          cycleSpeed(-1);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          resetAdjustments();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, stepFrame, addMarkerAtCurrentTime, toggleMute, showGridView, resetAdjustments]);

  // Cycle through speed options
  const cycleSpeed = useCallback(
    (direction: 1 | -1) => {
      const currentIndex = SPEED_OPTIONS.indexOf(playback.speed);
      const newIndex = Math.max(0, Math.min(SPEED_OPTIONS.length - 1, currentIndex + direction));
      setSpeed(SPEED_OPTIONS[newIndex]);
    },
    [playback.speed, setSpeed]
  );

  // Handle file input
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('video/')) continue;

        // Create video element to get metadata
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);

        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            addSource({
              name: file.name,
              url,
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
              fps: 30, // Default, could be detected with more complex logic
              fileSize: file.size,
              mimeType: file.type,
            });
            resolve();
          };
          video.onerror = () => resolve();
          video.src = url;
        });
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [addSource]
  );

  // Handle seek from timeline
  const handleSeek = useCallback(
    (time: number) => {
      seek(time);
    },
    [seek]
  );

  // Handle marker click
  const handleMarkerClick = useCallback(
    (marker: VideoMarker) => {
      seek(marker.time);
    },
    [seek]
  );

  // Speed menu handlers
  const handleSpeedMenuOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setSpeedMenuAnchor(e.currentTarget);
  }, []);

  const handleSpeedMenuClose = useCallback(() => {
    setSpeedMenuAnchor(null);
  }, []);

  const handleSpeedSelect = useCallback(
    (speed: PlaybackSpeed) => {
      setSpeed(speed);
      handleSpeedMenuClose();
    },
    [setSpeed, handleSpeedMenuClose]
  );

  return (
    <ToolContainer ref={containerRef}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Main Content */}
      <MainContent>
        {/* Media Pool (Left) */}
        <MediaPool visible={mediaPoolVisible}>
          <MediaPoolHeader>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 12 }}>
              Media Pool
            </Typography>
            <Tooltip title="Import Video">
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
              >
                <FolderOpenIcon sx={{ fontSize: 18, color: '#19abb5' }} />
              </IconButton>
            </Tooltip>
          </MediaPoolHeader>
          <MediaPoolContent>
            {sources.length === 0 ? (
              <EmptyState>
                <VideocamIcon sx={{ fontSize: 40, mb: 1, color: '#444' }} />
                <Typography variant="body2" color="textSecondary">
                  No videos loaded
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: '#19abb5', cursor: 'pointer', mt: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Click to import
                </Typography>
              </EmptyState>
            ) : (
              <List dense sx={{ p: 1 }}>
                {sources.map((source) => (
                  <SourceListItem
                    key={source.id}
                    selected={source.id === activeSource?.id}
                    onClick={() => setActiveSource(source.id)}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <VideocamIcon sx={{ fontSize: 18, color: '#19abb5' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={source.name}
                      secondary={`${source.width}x${source.height}`}
                      primaryTypographyProps={{ fontSize: 12, noWrap: true }}
                      secondaryTypographyProps={{ fontSize: 10 }}
                    />
                  </SourceListItem>
                ))}
              </List>
            )}
          </MediaPoolContent>
        </MediaPool>

        {/* Center Area */}
        <CenterArea>
          {/* Viewer Area */}
          <ViewerArea>
            {showGridView ? (
              <CameraGrid
                layout={gridLayout}
                slots={cameraSlots}
                sources={sources}
                isPlaying={playback.isPlaying}
                currentTime={playback.currentTime}
                speed={playback.speed}
                volume={playback.volume}
                adjustments={adjustments}
                onLayoutChange={setGridLayout}
                onSourceAssign={assignSourceToSlot}
                onSlotSyncToggle={toggleSlotSync}
                onSlotMuteToggle={toggleSlotMute}
                onTimeUpdate={updatePlaybackTime}
              />
            ) : (
              <VideoPlayer
                source={activeSource}
                isPlaying={playback.isPlaying}
                currentTime={playback.currentTime}
                speed={playback.speed}
                volume={playback.volume}
                muted={playback.muted}
                loop={playback.looping}
                adjustments={adjustments}
                onTimeUpdate={updatePlaybackTime}
                onDurationChange={setDuration}
                onEnded={() => {
                  if (!playback.looping) {
                    togglePlayPause();
                  }
                }}
              />
            )}
          </ViewerArea>

          {/* Timeline */}
          <TimelineArea>
            <VideoTimeline
              duration={playback.duration}
              currentTime={playback.currentTime}
              fps={activeSource?.fps || 30}
              markers={markers}
              tracks={tracks}
              visibleTimeRange={visibleTimeRange}
              waveformData={waveformData}
              zoom={zoom}
              muted={playback.muted}
              onSeek={handleSeek}
              onRangeChange={setVisibleTimeRange}
              onMarkerClick={handleMarkerClick}
              onMuteToggle={toggleMute}
              onZoomChange={setZoom}
            />
          </TimelineArea>
        </CenterArea>

        {/* Adjustments Panel (Right) */}
        <AdjustmentsPanel visible={adjustmentsPanelVisible}>
          <VideoAdjustments
            adjustments={adjustments}
            onAdjustmentChange={setAdjustment}
            onFilterChange={setFilter}
            onReset={resetAdjustments}
          />
        </AdjustmentsPanel>
      </MainContent>

      {/* Transport Bar */}
      <TransportBar>
        {/* Left controls */}
        <TransportGroup>
          <Tooltip title={mediaPoolVisible ? 'Hide Media Pool' : 'Show Media Pool'}>
            <TransportButton size="small" onClick={toggleMediaPool}>
              <FolderOpenIcon sx={{ fontSize: 18, color: mediaPoolVisible ? '#19abb5' : '#888' }} />
            </TransportButton>
          </Tooltip>
          <Tooltip title={showGridView ? 'Single View' : 'Grid View (G)'}>
            <TransportButton size="small" onClick={() => setShowGridView(!showGridView)}>
              <GridViewIcon sx={{ fontSize: 18, color: showGridView ? '#19abb5' : '#888' }} />
            </TransportButton>
          </Tooltip>
        </TransportGroup>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Time display */}
        <TimeDisplay>
          {formatTimecode(playback.currentTime, activeSource?.fps || 30)}
        </TimeDisplay>

        {/* Transport controls */}
        <TransportGroup>
          <Tooltip title="Previous Frame (←)">
            <TransportButton size="small" onClick={() => stepFrame(-1)}>
              <SkipPreviousIcon sx={{ fontSize: 18 }} />
            </TransportButton>
          </Tooltip>
          <Tooltip title={playback.isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
            <PlayButton onClick={togglePlayPause}>
              {playback.isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </PlayButton>
          </Tooltip>
          <Tooltip title="Next Frame (→)">
            <TransportButton size="small" onClick={() => stepFrame(1)}>
              <SkipNextIcon sx={{ fontSize: 18 }} />
            </TransportButton>
          </Tooltip>
        </TransportGroup>

        {/* Duration display */}
        <TimeDisplay sx={{ color: '#666' }}>
          {formatTimecode(playback.duration, activeSource?.fps || 30)}
        </TimeDisplay>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Speed */}
        <Tooltip title="Playback Speed">
          <TransportButton size="small" onClick={handleSpeedMenuOpen}>
            <SpeedIcon sx={{ fontSize: 18 }} />
          </TransportButton>
        </Tooltip>
        <SpeedDisplay>{playback.speed}x</SpeedDisplay>

        {/* Speed Menu */}
        <Menu
          anchorEl={speedMenuAnchor}
          open={Boolean(speedMenuAnchor)}
          onClose={handleSpeedMenuClose}
          PaperProps={{
            sx: { backgroundColor: '#1e1e1e', border: '1px solid #333' },
          }}
        >
          {SPEED_OPTIONS.map((speed) => (
            <MenuItem
              key={speed}
              selected={speed === playback.speed}
              onClick={() => handleSpeedSelect(speed)}
              sx={{
                fontSize: 13,
                color: speed === playback.speed ? '#19abb5' : '#e1e1e1',
              }}
            >
              {speed}x
            </MenuItem>
          ))}
        </Menu>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Loop */}
        <Tooltip title={playback.looping ? 'Disable Loop' : 'Enable Loop'}>
          <TransportButton size="small" onClick={toggleLoop}>
            <RepeatIcon sx={{ fontSize: 18, color: playback.looping ? '#19abb5' : '#888' }} />
          </TransportButton>
        </Tooltip>

        {/* Marker */}
        <Tooltip title="Add Marker (M)">
          <TransportButton size="small" onClick={() => addMarkerAtCurrentTime()}>
            <FlagIcon sx={{ fontSize: 18, color: '#ffc107' }} />
          </TransportButton>
        </Tooltip>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Volume */}
        <Tooltip title={playback.muted ? 'Unmute (K)' : 'Mute (K)'}>
          <IconButton size="small" onClick={toggleMute}>
            {playback.muted ? (
              <VolumeOffIcon sx={{ fontSize: 18, color: '#ff5722' }} />
            ) : (
              <VolumeUpIcon sx={{ fontSize: 18, color: '#19abb5' }} />
            )}
          </IconButton>
        </Tooltip>
        <VolumeSlider
          value={playback.muted ? 0 : playback.volume}
          min={0}
          max={1}
          step={0.01}
          onChange={(_, v) => setVolume(v as number)}
        />

        <Box sx={{ flex: 1 }} />

        {/* Right controls */}
        <TransportGroup>
          <Tooltip title={adjustmentsPanelVisible ? 'Hide Adjustments' : 'Show Adjustments'}>
            <TransportButton size="small" onClick={toggleAdjustmentsPanel}>
              <TuneIcon sx={{ fontSize: 18, color: adjustmentsPanelVisible ? '#19abb5' : '#888' }} />
            </TransportButton>
          </Tooltip>
        </TransportGroup>
      </TransportBar>
    </ToolContainer>
  );
});

VideoTool.displayName = 'VideoTool';

export default VideoTool;
