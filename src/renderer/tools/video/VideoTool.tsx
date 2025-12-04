/**
 * VideoTool - DaVinci Resolve-inspired video viewer with timeline
 *
 * NOT an editor - this is a viewer/reviewer for paranormal investigation footage.
 * Features:
 * - Large video preview area
 * - Frame-by-frame navigation
 * - Multi-camera sync view
 * - Marker/annotation overlay
 * - Local timeline for single clip (separate from session timeline)
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { styled, alpha } from '@mui/material/styles';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import FlagIcon from '@mui/icons-material/Flag';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import LoopIcon from '@mui/icons-material/Loop';
import SpeedIcon from '@mui/icons-material/Speed';
import VideocamIcon from '@mui/icons-material/Videocam';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const ToolContainer = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
});

const MediaBrowser = styled(Box)({
  width: 240,
  backgroundColor: '#0f0f0f',
  borderRight: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const BrowserHeader = styled(Box)({
  padding: '12px 16px',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const BrowserContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 8,
});

const MediaThumbnail = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  width: '100%',
  aspectRatio: '16/9',
  backgroundColor: selected ? alpha('#19abb5', 0.2) : '#1a1a1a',
  borderRadius: 4,
  marginBottom: 8,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: selected ? '2px solid #19abb5' : '2px solid transparent',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: alpha('#ffffff', 0.08),
    borderColor: selected ? '#19abb5' : '#2a2a2a',
  },
}));

const MainArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const ViewerArea = styled(Box)({
  flex: 1,
  backgroundColor: '#000000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
});

const VideoPlaceholder = styled(Box)({
  width: '100%',
  maxWidth: 1280,
  aspectRatio: '16/9',
  backgroundColor: '#0a0a0a',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  border: '1px dashed #2a2a2a',
});

const TransportBar = styled(Box)({
  backgroundColor: '#0f0f0f',
  borderTop: '1px solid #1a1a1a',
  padding: '8px 16px',
});

const TimelineSlider = styled(Slider)({
  color: '#19abb5',
  height: 4,
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
    '&:hover, &.Mui-focusVisible': {
      boxShadow: `0 0 0 8px ${alpha('#19abb5', 0.16)}`,
    },
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#2a2a2a',
  },
});

const TransportControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  marginTop: 8,
});

const TransportButton = styled(IconButton)({
  color: '#808080',
  '&:hover': {
    color: '#c0c0c0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
});

const PlayButton = styled(IconButton)({
  width: 44,
  height: 44,
  color: '#ffffff',
  backgroundColor: '#19abb5',
  '&:hover': {
    backgroundColor: '#1992a1',
  },
  '& svg': {
    fontSize: 28,
  },
});

const Timecode = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 13,
  color: '#808080',
  minWidth: 100,
});

const InfoPanel = styled(Box)({
  width: 280,
  backgroundColor: '#0f0f0f',
  borderLeft: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const PanelHeader = styled(Box)({
  padding: '12px 16px',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const PanelContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 16,
});

const MetadataRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 12,
});

const MetadataLabel = styled(Typography)({
  fontSize: 12,
  color: '#606060',
});

const MetadataValue = styled(Typography)({
  fontSize: 12,
  color: '#c0c0c0',
  textAlign: 'right',
});

const VideoTool: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClip, setSelectedClip] = useState(0);

  const clips = [
    { id: 1, name: 'Camera_01_20240115_2230.mp4', duration: '00:15:32' },
    { id: 2, name: 'Camera_02_20240115_2230.mp4', duration: '00:15:28' },
    { id: 3, name: 'IR_Camera_20240115_2245.mp4', duration: '00:08:45' },
    { id: 4, name: 'Full_Spectrum_20240115_2300.mp4', duration: '00:12:18' },
  ];

  return (
    <ToolContainer>
      {/* Media Browser */}
      <MediaBrowser>
        <BrowserHeader>
          <FolderOpenIcon sx={{ fontSize: 18, color: '#808080' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#c0c0c0' }}>
            Investigation Media
          </Typography>
        </BrowserHeader>
        <BrowserContent>
          {clips.map((clip, index) => (
            <Box key={clip.id}>
              <MediaThumbnail
                selected={selectedClip === index}
                onClick={() => setSelectedClip(index)}
              >
                <VideocamIcon sx={{ fontSize: 32, color: '#404040' }} />
              </MediaThumbnail>
              <Typography
                sx={{
                  fontSize: 11,
                  color: selectedClip === index ? '#19abb5' : '#808080',
                  mb: 0.5,
                  px: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {clip.name}
              </Typography>
              <Typography sx={{ fontSize: 10, color: '#505050', mb: 2, px: 0.5 }}>
                {clip.duration}
              </Typography>
            </Box>
          ))}
        </BrowserContent>
      </MediaBrowser>

      {/* Main Viewer Area */}
      <MainArea>
        <ViewerArea>
          <VideoPlaceholder>
            <VideocamIcon sx={{ fontSize: 64, color: '#303030' }} />
            <Typography sx={{ color: '#505050', fontSize: 14 }}>
              Select a video to preview
            </Typography>
            <Typography sx={{ color: '#404040', fontSize: 12 }}>
              DaVinci Resolve-inspired viewer - Frame-by-frame navigation
            </Typography>
          </VideoPlaceholder>
        </ViewerArea>

        {/* Transport Bar */}
        <TransportBar>
          <TimelineSlider
            value={currentTime}
            onChange={(_, value) => setCurrentTime(value as number)}
            min={0}
            max={100}
          />
          <TransportControls>
            <Timecode>00:00:00:00</Timecode>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mx: 2 }}>
              <Tooltip title="Previous Frame">
                <TransportButton size="small">
                  <SkipPreviousIcon />
                </TransportButton>
              </Tooltip>
              <Tooltip title="Rewind">
                <TransportButton size="small">
                  <FastRewindIcon />
                </TransportButton>
              </Tooltip>
              <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                <PlayButton onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </PlayButton>
              </Tooltip>
              <Tooltip title="Fast Forward">
                <TransportButton size="small">
                  <FastForwardIcon />
                </TransportButton>
              </Tooltip>
              <Tooltip title="Next Frame">
                <TransportButton size="small">
                  <SkipNextIcon />
                </TransportButton>
              </Tooltip>
            </Box>

            <Timecode sx={{ textAlign: 'right' }}>00:15:32:00</Timecode>

            <Divider orientation="vertical" flexItem sx={{ mx: 2, borderColor: '#2a2a2a' }} />

            <Tooltip title="Add Marker">
              <TransportButton size="small">
                <FlagIcon />
              </TransportButton>
            </Tooltip>
            <Tooltip title="Add Bookmark">
              <TransportButton size="small">
                <BookmarkIcon />
              </TransportButton>
            </Tooltip>
            <Tooltip title="Loop Playback">
              <TransportButton size="small">
                <LoopIcon />
              </TransportButton>
            </Tooltip>
            <Tooltip title="Playback Speed">
              <TransportButton size="small">
                <SpeedIcon />
              </TransportButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 2, borderColor: '#2a2a2a' }} />

            <Tooltip title="Multi-Camera View">
              <TransportButton size="small">
                <GridViewIcon />
              </TransportButton>
            </Tooltip>
            <Tooltip title="Split View">
              <TransportButton size="small">
                <ViewColumnIcon />
              </TransportButton>
            </Tooltip>
            <Tooltip title="Volume">
              <TransportButton size="small">
                <VolumeUpIcon />
              </TransportButton>
            </Tooltip>
            <Tooltip title="Fullscreen">
              <TransportButton size="small">
                <FullscreenIcon />
              </TransportButton>
            </Tooltip>
          </TransportControls>
        </TransportBar>
      </MainArea>

      {/* Info Panel */}
      <InfoPanel>
        <PanelHeader>
          <InfoOutlinedIcon sx={{ fontSize: 18, color: '#808080' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#c0c0c0' }}>
            Clip Information
          </Typography>
        </PanelHeader>
        <PanelContent>
          <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#c0c0c0', mb: 2 }}>
            {clips[selectedClip]?.name || 'No clip selected'}
          </Typography>

          <MetadataRow>
            <MetadataLabel>Duration</MetadataLabel>
            <MetadataValue>{clips[selectedClip]?.duration || '--:--:--'}</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Resolution</MetadataLabel>
            <MetadataValue>1920 x 1080</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Frame Rate</MetadataLabel>
            <MetadataValue>30 fps</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Codec</MetadataLabel>
            <MetadataValue>H.264</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Bitrate</MetadataLabel>
            <MetadataValue>12 Mbps</MetadataValue>
          </MetadataRow>

          <Divider sx={{ my: 2, borderColor: '#1a1a1a' }} />

          <Typography sx={{ fontSize: 11, fontWeight: 500, color: '#808080', mb: 1 }}>
            CAPTURE INFO
          </Typography>
          <MetadataRow>
            <MetadataLabel>Camera</MetadataLabel>
            <MetadataValue>Sony A7S III</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Date</MetadataLabel>
            <MetadataValue>Jan 15, 2024</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Time</MetadataLabel>
            <MetadataValue>22:30:15</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Location</MetadataLabel>
            <MetadataValue>Main Hall</MetadataValue>
          </MetadataRow>

          <Divider sx={{ my: 2, borderColor: '#1a1a1a' }} />

          <Typography sx={{ fontSize: 11, fontWeight: 500, color: '#808080', mb: 1 }}>
            MARKERS (3)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FlagIcon sx={{ fontSize: 14, color: '#ef4444' }} />
            <Typography sx={{ fontSize: 11, color: '#a0a0a0' }}>00:05:23 - Motion anomaly</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FlagIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
            <Typography sx={{ fontSize: 11, color: '#a0a0a0' }}>00:08:45 - Light orb</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlagIcon sx={{ fontSize: 14, color: '#22c55e' }} />
            <Typography sx={{ fontSize: 11, color: '#a0a0a0' }}>00:12:11 - Shadow figure</Typography>
          </Box>
        </PanelContent>
      </InfoPanel>
    </ToolContainer>
  );
};

export default VideoTool;
