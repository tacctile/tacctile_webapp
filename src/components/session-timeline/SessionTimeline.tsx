/**
 * SessionTimeline Component
 * Rebuilt to match the exact layout structure and styling of Video, Audio, and Image Tools
 *
 * Layout:
 * - LEFT PANEL: EvidenceBank + MetadataPanel (280px)
 * - CENTER: Video preview (top) + Timeline with swim lanes (bottom)
 * - RIGHT PANEL: Image preview (top) + FlagsPanel (bottom)
 * - BOTTOM: TransportControls (48px)
 */

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Checkbox,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import PhotoIcon from '@mui/icons-material/Photo';
import ImageIcon from '@mui/icons-material/Image';
import PersonIcon from '@mui/icons-material/Person';

import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank, type EvidenceItem } from '@/components/evidence-bank';
import { MetadataPanel, FlagsPanel, type Flag } from '@/components/common';

import {
  useSessionTimelineStore,
  selectTimelineItems,
  selectTimeRange,
  selectTimelineLoading,
  selectTimelineError,
} from '../../stores/useSessionTimelineStore';
import { usePlayheadStore } from '../../stores/usePlayheadStore';
import { useNavigationStore } from '../../stores/useNavigationStore';

import type { TimelineItem } from '../../types/session';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const MainContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0d0d0d',
});

// Video Preview Section (Top of Center)
const VideoPreviewSection = styled(Box)({
  flex: 1,
  minHeight: 200,
  backgroundColor: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  borderBottom: '1px solid #252525',
});

const VideoPlaceholder = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: '#444',
});

const VideoTrackSelector = styled(Box)({
  position: 'absolute',
  top: 8,
  left: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: 4,
  padding: '8px',
  maxHeight: 200,
  overflowY: 'auto',
});

const VideoTrackItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 10,
  color: '#ccc',
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: 2,
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

// Timeline Section (Bottom of Center)
const TimelineSection = styled(Box)({
  height: 300,
  minHeight: 200,
  backgroundColor: '#0d0d0d',
  display: 'flex',
  flexDirection: 'column',
  borderTop: '1px solid #252525',
});

const TimeRuler = styled(Box)({
  height: 24,
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  overflow: 'hidden',
});

const TimeRulerLabel = styled(Typography)({
  position: 'absolute',
  fontSize: 9,
  color: '#555',
  fontFamily: '"JetBrains Mono", monospace',
});

const SwimLanesContainer = styled(Box)({
  flex: 1,
  overflow: 'auto',
  position: 'relative',
  '&::-webkit-scrollbar': {
    width: 6,
    height: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#0d0d0d',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 3,
  },
});

const SwimLaneSection = styled(Box)({
  borderBottom: '1px solid #1f1f1f',
});

const SwimLaneSectionHeader = styled(Box)<{ color: string }>(({ color }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  backgroundColor: '#1a1a1a',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#1e1e1e',
  },
  borderLeft: `3px solid ${color}`,
}));

const SectionTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  flex: 1,
});

const SwimLane = styled(Box)({
  height: 32,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  borderBottom: '1px solid #1a1a1a',
  backgroundColor: '#0d0d0d',
});

const LaneLabel = styled(Box)({
  width: 100,
  minWidth: 100,
  padding: '0 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10,
  color: '#666',
  backgroundColor: '#141414',
  height: '100%',
  borderRight: '1px solid #1f1f1f',
});

const LaneContent = styled(Box)({
  flex: 1,
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
});

const TimelineClip = styled(Box)<{ type: 'video' | 'audio' | 'image'; highlighted?: boolean }>(({ type, highlighted }) => {
  const colors: Record<string, string> = {
    video: '#c45c5c',
    audio: '#5a9a6b',
    image: '#5a7fbf',
  };
  return {
    position: 'absolute',
    top: 4,
    height: 24,
    backgroundColor: colors[type] || '#666',
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    padding: '0 6px',
    cursor: 'pointer',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: 9,
    color: '#fff',
    border: highlighted ? '2px solid #19abb5' : '2px solid transparent',
    boxShadow: highlighted ? '0 0 8px rgba(25, 171, 181, 0.5)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    '&:hover': {
      filter: 'brightness(1.1)',
    },
  };
});

const TimelineImage = styled(Box)<{ highlighted?: boolean }>(({ highlighted }) => ({
  position: 'absolute',
  top: 4,
  width: 12,
  height: 24,
  backgroundColor: '#5a7fbf',
  borderRadius: 2,
  cursor: 'pointer',
  border: highlighted ? '2px solid #19abb5' : '2px solid transparent',
  boxShadow: highlighted ? '0 0 8px rgba(25, 171, 181, 0.5)' : 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': {
    filter: 'brightness(1.1)',
  },
}));

const FlagMarker = styled(Box)<{ color?: string }>(({ color }) => ({
  position: 'absolute',
  top: 8,
  width: 8,
  height: 8,
  backgroundColor: color || '#19abb5',
  borderRadius: '50%',
  cursor: 'pointer',
  zIndex: 5,
  '&:hover': {
    transform: 'scale(1.3)',
  },
}));

const GlobalPlayhead = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  backgroundColor: '#19abb5',
  boxShadow: '0 0 8px rgba(25, 171, 181, 0.5)',
  zIndex: 100,
  pointerEvents: 'none',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: -4,
    width: 10,
    height: 10,
    backgroundColor: '#19abb5',
    borderRadius: '50% 50% 50% 0',
    transform: 'rotate(-45deg)',
  },
});

// Right Panel Components
const ImagePreviewSection = styled(Box)({
  height: 200,
  minHeight: 150,
  backgroundColor: '#0a0a0a',
  borderBottom: '1px solid #252525',
  display: 'flex',
  flexDirection: 'column',
});

const ImagePreviewHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #252525',
});

const ImagePreviewContent = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#000',
});

const EmptyState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 32,
  textAlign: 'center',
});

// ============================================================================
// TYPES
// ============================================================================

interface VideoTrack {
  id: string;
  fileName: string;
  userName: string;
  visible: boolean;
  muted: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface SessionTimelineProps {
  investigationId?: string;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  investigationId = 'demo-investigation',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lanesContainerRef = useRef<HTMLDivElement>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);
  const [currentImage, setCurrentImage] = useState<TimelineItem | null>(null);

  // Section collapse state
  const [videoSectionCollapsed, setVideoSectionCollapsed] = useState(false);
  const [audioSectionCollapsed, setAudioSectionCollapsed] = useState(false);
  const [imagesSectionCollapsed, setImagesSectionCollapsed] = useState(false);

  // Video track visibility
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);

  // Global playhead store
  const globalTimestamp = usePlayheadStore((state) => state.timestamp);
  const setGlobalTimestamp = usePlayheadStore((state) => state.setTimestamp);

  // Navigation store
  const navigateToTool = useNavigationStore((state) => state.navigateToTool);

  // Store state
  const items = useSessionTimelineStore(selectTimelineItems);
  const timeRange = useSessionTimelineStore(selectTimeRange);
  const isLoading = useSessionTimelineStore(selectTimelineLoading);
  const error = useSessionTimelineStore(selectTimelineError);

  // Store actions
  const { loadTimeline } = useSessionTimelineStore(
    useShallow((state) => ({
      loadTimeline: state.loadTimeline,
    }))
  );

  // Load ref
  const loadedInvestigationRef = useRef<string | null>(null);

  // Load timeline on mount
  useEffect(() => {
    if (loadedInvestigationRef.current === investigationId) return;
    loadedInvestigationRef.current = investigationId;
    loadTimeline(investigationId);
  }, [investigationId, loadTimeline]);

  // Generate video tracks from items
  useEffect(() => {
    const safeItems = Array.isArray(items) ? items : [];
    const videos = safeItems.filter((item) => item.type === 'video');
    setVideoTracks(
      videos.map((v) => ({
        id: v.id,
        fileName: v.fileName,
        userName: v.capturedBy || 'Unknown',
        visible: true,
        muted: false,
      }))
    );
  }, [items]);

  // Determine which image is at current playhead position
  useEffect(() => {
    const safeItems = Array.isArray(items) ? items : [];
    const images = safeItems
      .filter((item) => item.type === 'photo')
      .sort((a, b) => a.capturedAt - b.capturedAt);

    // Find the most recent image before or at the playhead
    let currentImg: TimelineItem | null = null;
    for (const img of images) {
      if (img.capturedAt <= globalTimestamp) {
        currentImg = img;
      } else {
        break;
      }
    }
    setCurrentImage(currentImg);
  }, [globalTimestamp, items]);

  // Convert timeline items to evidence items for EvidenceBank
  const evidenceItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    return safeItems
      .filter((item) => ['video', 'audio', 'photo'].includes(item.type))
      .map((item): EvidenceItem => ({
        id: item.id,
        type: item.type === 'photo' ? 'image' : (item.type as 'video' | 'audio'),
        fileName: item.fileName,
        duration: item.duration,
        capturedAt: item.capturedAt,
        user: item.capturedBy || 'Unknown',
        deviceInfo: item.deviceInfo,
        flagCount: item.flagCount,
        hasFindings: item.hasEdits || item.flagCount > 0,
      }));
  }, [items]);

  // Group items by type and user for swim lanes
  const laneData = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];

    // Get unique users
    const userSet = new Set<string>();
    safeItems.forEach((item) => {
      if (item.capturedBy) userSet.add(item.capturedBy);
    });
    const users = Array.from(userSet);

    // Group by type and user
    const videoByUser: Record<string, TimelineItem[]> = {};
    const audioByUser: Record<string, TimelineItem[]> = {};
    const imagesByUser: Record<string, TimelineItem[]> = {};
    const videoCatchAll: TimelineItem[] = [];
    const audioCatchAll: TimelineItem[] = [];
    const imagesCatchAll: TimelineItem[] = [];

    users.forEach((u) => {
      videoByUser[u] = [];
      audioByUser[u] = [];
      imagesByUser[u] = [];
    });

    safeItems.forEach((item) => {
      const user = item.capturedBy;
      if (item.type === 'video') {
        if (user && videoByUser[user]) {
          videoByUser[user].push(item);
        } else {
          videoCatchAll.push(item);
        }
      } else if (item.type === 'audio') {
        if (user && audioByUser[user]) {
          audioByUser[user].push(item);
        } else {
          audioCatchAll.push(item);
        }
      } else if (item.type === 'photo') {
        if (user && imagesByUser[user]) {
          imagesByUser[user].push(item);
        } else {
          imagesCatchAll.push(item);
        }
      }
    });

    return {
      users,
      videoByUser,
      audioByUser,
      imagesByUser,
      videoCatchAll,
      audioCatchAll,
      imagesCatchAll,
    };
  }, [items]);

  // Aggregate all flags at current playhead position
  const currentFlags = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    const flags: Flag[] = [];
    const tolerance = 2000; // 2 second tolerance

    safeItems.forEach((item) => {
      const itemFlags = Array.isArray(item.flags) ? item.flags : [];
      itemFlags.forEach((flag) => {
        // Check if flag is near current playhead position
        if (Math.abs(flag.absoluteTimestamp - globalTimestamp) < tolerance) {
          flags.push({
            id: flag.id,
            timestamp: flag.absoluteTimestamp,
            label: flag.title,
            note: undefined,
            createdBy: flag.userDisplayName,
            createdAt: flag.absoluteTimestamp,
          });
        }
      });
    });

    return flags;
  }, [items, globalTimestamp]);

  // Calculate clip position on timeline
  const getClipPosition = useCallback(
    (startTime: number, duration?: number) => {
      if (!timeRange) return { left: 0, width: 0 };
      const totalDuration = timeRange.end - timeRange.start;
      const left = ((startTime - timeRange.start) / totalDuration) * 100;
      const width = duration
        ? ((duration * 1000) / totalDuration) * 100
        : 1; // Min 1% for images
      return { left: `${Math.max(0, left)}%`, width: `${Math.max(1, width)}%` };
    },
    [timeRange]
  );

  // Calculate playhead position
  const playheadPosition = useMemo(() => {
    if (!timeRange) return 0;
    const totalDuration = timeRange.end - timeRange.start;
    return ((globalTimestamp - timeRange.start) / totalDuration) * 100;
  }, [timeRange, globalTimestamp]);

  // Handle timeline click (set playhead)
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timeRange || !lanesContainerRef.current) return;
      const rect = lanesContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 100; // 100px for lane label width
      const width = rect.width - 100;
      const percent = Math.max(0, Math.min(1, x / width));
      const newTimestamp =
        timeRange.start + percent * (timeRange.end - timeRange.start);
      setGlobalTimestamp(newTimestamp);
    },
    [timeRange, setGlobalTimestamp]
  );

  // Handle item single click (show metadata)
  const handleItemClick = useCallback(
    (item: TimelineItem) => {
      const evidenceItem: EvidenceItem = {
        id: item.id,
        type: item.type === 'photo' ? 'image' : (item.type as 'video' | 'audio'),
        fileName: item.fileName,
        duration: item.duration,
        capturedAt: item.capturedAt,
        user: item.capturedBy || 'Unknown',
        deviceInfo: item.deviceInfo,
        flagCount: item.flagCount,
        hasFindings: item.hasEdits || item.flagCount > 0,
      };
      setSelectedEvidence(evidenceItem);
    },
    []
  );

  // Handle item double click (open in tool)
  const handleItemDoubleClick = useCallback(
    (item: TimelineItem) => {
      const toolMap: Record<string, 'video' | 'audio' | 'images'> = {
        video: 'video',
        audio: 'audio',
        photo: 'images',
      };
      const tool = toolMap[item.type];
      if (tool) {
        // Navigate to appropriate tool with the file
        navigateToTool(tool, item.evidenceId);
      }
    },
    [navigateToTool]
  );

  // Handle flag click (jump to timestamp)
  const handleFlagClick = useCallback(
    (flag: Flag) => {
      setGlobalTimestamp(flag.timestamp);
    },
    [setGlobalTimestamp]
  );

  // Toggle video track visibility
  const toggleVideoTrack = useCallback((trackId: string) => {
    setVideoTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t))
    );
  }, []);

  // Render time ruler
  const renderTimeRuler = () => {
    if (!timeRange) return null;
    const duration = timeRange.end - timeRange.start;
    const intervalMs = duration > 3600000 ? 600000 : duration > 600000 ? 60000 : 10000; // 10min, 1min, or 10s intervals
    const markers: React.ReactElement[] = [];

    for (let t = timeRange.start; t <= timeRange.end; t += intervalMs) {
      const left = ((t - timeRange.start) / duration) * 100;
      const date = new Date(t);
      const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      markers.push(
        <TimeRulerLabel key={t} sx={{ left: `${left}%` }}>
          {label}
        </TimeRulerLabel>
      );
    }

    return markers;
  };

  // Render swim lane with clips
  const renderLane = (
    laneItems: TimelineItem[],
    laneType: 'video' | 'audio' | 'image'
  ) => {
    return laneItems.map((item) => {
      const pos = getClipPosition(item.capturedAt, item.duration);
      const isHighlighted =
        item.capturedAt <= globalTimestamp &&
        (item.endAt ? item.endAt >= globalTimestamp : true);

      if (laneType === 'image') {
        return (
          <TimelineImage
            key={item.id}
            highlighted={isHighlighted}
            sx={{ left: pos.left }}
            onClick={() => handleItemClick(item)}
            onDoubleClick={() => handleItemDoubleClick(item)}
          >
            <PhotoIcon sx={{ fontSize: 8, color: '#fff' }} />
          </TimelineImage>
        );
      }

      // Render flags on clip
      const clipFlags = (item.flags || []).map((flag) => {
        const flagOffset =
          ((flag.timestamp * 1000) / (item.duration ? item.duration * 1000 : 1)) * 100;
        return (
          <FlagMarker
            key={flag.id}
            sx={{ left: `${flagOffset}%` }}
            title={flag.title}
          />
        );
      });

      return (
        <TimelineClip
          key={item.id}
          type={laneType}
          highlighted={isHighlighted}
          sx={{ left: pos.left, width: pos.width }}
          onClick={() => handleItemClick(item)}
          onDoubleClick={() => handleItemDoubleClick(item)}
        >
          {item.fileName.substring(0, 20)}
          {item.fileName.length > 20 ? '...' : ''}
          {clipFlags}
        </TimelineClip>
      );
    });
  };

  // Loading state
  const safeItems = Array.isArray(items) ? items : [];
  if (isLoading && safeItems.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#121212',
        }}
      >
        <CircularProgress sx={{ color: '#19abb5' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <EmptyState sx={{ backgroundColor: '#121212' }}>
        <Alert severity="error" sx={{ maxWidth: 400 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          onClick={() => loadTimeline(investigationId)}
          sx={{ mt: 2, color: '#19abb5', borderColor: '#19abb5' }}
        >
          Retry
        </Button>
      </EmptyState>
    );
  }

  // Main content (center area)
  const mainContent = (
    <MainContainer ref={containerRef}>
      {/* Video Preview Section */}
      <VideoPreviewSection>
        {videoTracks.some((t) => t.visible) ? (
          <>
            {/* Video player placeholder */}
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              }}
            >
              <Typography sx={{ color: '#444', fontSize: 12 }}>
                Video preview at current playhead position
              </Typography>
            </Box>

            {/* Video track selector */}
            <VideoTrackSelector>
              <Typography
                sx={{
                  fontSize: 9,
                  color: '#666',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  mb: 0.5,
                }}
              >
                Video Tracks
              </Typography>
              {videoTracks.map((track) => (
                <VideoTrackItem key={track.id} onClick={() => toggleVideoTrack(track.id)}>
                  <Checkbox
                    checked={track.visible}
                    size="small"
                    sx={{
                      padding: 0,
                      '& .MuiSvgIcon-root': { fontSize: 14 },
                      color: '#555',
                      '&.Mui-checked': { color: '#19abb5' },
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: track.visible ? '#ccc' : '#555',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 120,
                    }}
                  >
                    {track.fileName}
                  </Typography>
                </VideoTrackItem>
              ))}
            </VideoTrackSelector>
          </>
        ) : (
          <VideoPlaceholder>
            <VideocamIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 12, color: '#555' }}>
              No video at current position
            </Typography>
          </VideoPlaceholder>
        )}
      </VideoPreviewSection>

      {/* Timeline Section */}
      <TimelineSection>
        {/* Time Ruler */}
        <TimeRuler>{renderTimeRuler()}</TimeRuler>

        {/* Swim Lanes */}
        <SwimLanesContainer ref={lanesContainerRef} onClick={handleTimelineClick}>
          {/* Global Playhead */}
          {timeRange && (
            <GlobalPlayhead
              sx={{
                left: `calc(100px + ${playheadPosition}% * (100% - 100px) / 100)`,
              }}
            />
          )}

          {/* VIDEO Section */}
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#c45c5c"
              onClick={() => setVideoSectionCollapsed(!videoSectionCollapsed)}
            >
              <VideocamIcon sx={{ fontSize: 14, color: '#c45c5c' }} />
              <SectionTitle>Video</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({safeItems.filter((i) => i.type === 'video').length})
              </Typography>
              {videoSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!videoSectionCollapsed && (
              <>
                {/* Per-user lanes */}
                {laneData.users.map((user) => (
                  <SwimLane key={`video-${user}`}>
                    <LaneLabel>
                      <PersonIcon sx={{ fontSize: 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.videoByUser[user] || [], 'video')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {/* Catch-all lane (only if has items) */}
                {laneData.videoCatchAll.length > 0 && (
                  <SwimLane>
                    <LaneLabel>
                      <Typography sx={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.videoCatchAll, 'video')}
                    </LaneContent>
                  </SwimLane>
                )}
              </>
            )}
          </SwimLaneSection>

          {/* AUDIO Section */}
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#5a9a6b"
              onClick={() => setAudioSectionCollapsed(!audioSectionCollapsed)}
            >
              <MicIcon sx={{ fontSize: 14, color: '#5a9a6b' }} />
              <SectionTitle>Audio</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({safeItems.filter((i) => i.type === 'audio').length})
              </Typography>
              {audioSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!audioSectionCollapsed && (
              <>
                {laneData.users.map((user) => (
                  <SwimLane key={`audio-${user}`}>
                    <LaneLabel>
                      <PersonIcon sx={{ fontSize: 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.audioByUser[user] || [], 'audio')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {laneData.audioCatchAll.length > 0 && (
                  <SwimLane>
                    <LaneLabel>
                      <Typography sx={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.audioCatchAll, 'audio')}
                    </LaneContent>
                  </SwimLane>
                )}
              </>
            )}
          </SwimLaneSection>

          {/* IMAGES Section */}
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#5a7fbf"
              onClick={() => setImagesSectionCollapsed(!imagesSectionCollapsed)}
            >
              <PhotoIcon sx={{ fontSize: 14, color: '#5a7fbf' }} />
              <SectionTitle>Images</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({safeItems.filter((i) => i.type === 'photo').length})
              </Typography>
              {imagesSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!imagesSectionCollapsed && (
              <>
                {laneData.users.map((user) => (
                  <SwimLane key={`images-${user}`}>
                    <LaneLabel>
                      <PersonIcon sx={{ fontSize: 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.imagesByUser[user] || [], 'image')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {laneData.imagesCatchAll.length > 0 && (
                  <SwimLane>
                    <LaneLabel>
                      <Typography sx={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.imagesCatchAll, 'image')}
                    </LaneContent>
                  </SwimLane>
                )}
              </>
            )}
          </SwimLaneSection>
        </SwimLanesContainer>
      </TimelineSection>
    </MainContainer>
  );

  // Right panel content (image preview + flags)
  const inspectorContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Image Preview Section */}
      <ImagePreviewSection>
        <ImagePreviewHeader>
          <Typography
            sx={{
              fontSize: 9,
              color: '#666',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Image at Playhead
          </Typography>
        </ImagePreviewHeader>
        <ImagePreviewContent>
          {currentImage ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
                cursor: 'pointer',
              }}
              onDoubleClick={() => handleItemDoubleClick(currentImage)}
            >
              <ImageIcon sx={{ fontSize: 32, color: '#5a7fbf', mb: 1 }} />
              <Typography
                sx={{
                  fontSize: 10,
                  color: '#888',
                  textAlign: 'center',
                  px: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {currentImage.fileName}
              </Typography>
              <Typography sx={{ fontSize: 9, color: '#555', mt: 0.5 }}>
                Double-click to open
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: '#444',
              }}
            >
              <ImageIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                No image at current position
              </Typography>
            </Box>
          )}
        </ImagePreviewContent>
      </ImagePreviewSection>

      {/* Flags Panel */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FlagsPanel
          flags={currentFlags}
          onFlagClick={handleFlagClick}
          onFlagAdd={() => console.log('Add flag')}
          onFlagEdit={(flag) => console.log('Edit flag:', flag.id)}
          onFlagDelete={(flagId) => console.log('Delete flag:', flagId)}
          disabled={false}
        />
      </Box>
    </Box>
  );

  return (
    <WorkspaceLayout
      evidencePanel={
        <EvidenceBank
          items={evidenceItems}
          selectedId={selectedEvidence?.id}
          onSelect={(item) => setSelectedEvidence(item)}
          onDoubleClick={(item) => {
            const toolMap: Record<string, 'video' | 'audio' | 'images'> = {
              video: 'video',
              audio: 'audio',
              image: 'images',
            };
            const tool = toolMap[item.type];
            if (tool) {
              navigateToTool(tool, item.id);
            }
          }}
        />
      }
      metadataPanel={
        <MetadataPanel
          data={
            selectedEvidence
              ? {
                  fileName: selectedEvidence.fileName,
                  capturedAt: selectedEvidence.capturedAt,
                  duration: selectedEvidence.duration,
                  user: selectedEvidence.user,
                  device: selectedEvidence.deviceInfo,
                  flagCount: selectedEvidence.flagCount,
                }
              : null
          }
          type={selectedEvidence?.type || 'video'}
        />
      }
      inspectorPanel={inspectorContent}
      mainContent={mainContent}
      evidenceTitle="Evidence"
      inspectorTitle="Flags"
      showTransport={true}
    />
  );
};

export default SessionTimeline;
