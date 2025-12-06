/**
 * SessionTimeline - User-Based Lane Architecture
 * Each user gets a collapsible section with video/audio/images lanes
 * No collision detection - organized by user, not file type
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Collapse,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import PhotoIcon from '@mui/icons-material/Photo';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

import { usePlayheadStore } from '../../stores/usePlayheadStore';
import { useAppPersistence } from '../../stores/useAppPersistence';
import { useHomeStore, type SessionEvidence } from '../../stores/useHomeStore';
import {
  detectFileType,
  sortFilesByType,
  extractUserFromFile,
  generateImportId,
} from '@/utils/fileTypes';
import {
  generateTestMetadataIfDev,
  formatGPSCoordinates,
} from '@/utils/testMetadataGenerator';

// ============================================================================
// TYPES
// ============================================================================

interface TimelineMediaItem {
  id: string;
  evidenceId: string;
  type: 'video' | 'audio' | 'photo';
  fileName: string;
  thumbnailUrl?: string;
  capturedAt: number;
  duration?: number;
  endAt?: number;
  user: string;
  deviceInfo?: string;
  format?: string;
  gps?: string;
  flagCount: number;
  hasEdits: boolean;
  flags: any[];
}

interface UserSection {
  userName: string;
  videos: TimelineMediaItem[];
  audios: TimelineMediaItem[];
  images: TimelineMediaItem[];
  isExpanded: boolean;
}

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0d0d0d',
  overflow: 'hidden',
});

const PreviewArea = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  borderBottom: '1px solid #252525',
});

const PreviewRow = styled(Box)({
  display: 'flex',
  flex: 1,
  minHeight: 200,
});

const VideoPreviewPane = styled(Box)({
  flex: 1,
  backgroundColor: '#000',
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid #252525',
});

const ImagePreviewPane = styled(Box)({
  flex: 1,
  backgroundColor: '#0a0a0a',
  display: 'flex',
  flexDirection: 'column',
});

const AudioPreviewPane = styled(Box)({
  height: 80,
  backgroundColor: '#111',
  borderTop: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  gap: 12,
});

const PreviewHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
});

const PreviewContent = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
});

const PreviewDropdown = styled(FormControl)({
  minWidth: 120,
  '& .MuiSelect-select': {
    padding: '4px 8px',
    fontSize: 12,
    color: '#e1e1e1',
    backgroundColor: '#252525',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#333',
  },
});

const WaveformContainer = styled(Box)({
  flex: 1,
  height: 48,
  backgroundColor: '#1a1a1a',
  borderRadius: 4,
  position: 'relative',
  cursor: 'pointer',
});

const TimelineArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const TimelineHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
});

const TimeRuler = styled(Box)({
  height: 28,
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
  position: 'relative',
  marginLeft: 140,
});

const LanesContainer = styled(Box)({
  flex: 1,
  overflow: 'auto',
  position: 'relative',
});

const UserSectionContainer = styled(Box)({
  borderBottom: '1px solid #1f1f1f',
});

const UserSectionHeader = styled(Box)<{ userColor?: string }>(({ userColor = '#19abb5' }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  cursor: 'pointer',
  borderLeft: `3px solid ${userColor}`,
  '&:hover': {
    backgroundColor: '#1e1e1e',
  },
}));

const LaneRow = styled(Box)({
  display: 'flex',
  height: 36,
  borderBottom: '1px solid #141414',
});

const LaneLabel = styled(Box)({
  width: 140,
  minWidth: 140,
  padding: '0 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: '#666',
  backgroundColor: '#141414',
  borderRight: '1px solid #1f1f1f',
});

const LaneContent = styled(Box)({
  flex: 1,
  position: 'relative',
  backgroundColor: '#0d0d0d',
});

const Clip = styled(Box)<{ clipType: 'video' | 'audio' | 'photo'; isActive?: boolean }>(
  ({ clipType, isActive }) => {
    const colors = {
      video: '#c45c5c',
      audio: '#5a9a6b',
      photo: '#5a7fbf',
    };
    return {
      position: 'absolute',
      top: 4,
      height: 28,
      backgroundColor: colors[clipType],
      borderRadius: 3,
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      fontSize: 10,
      color: '#fff',
      cursor: 'pointer',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      border: isActive ? '2px solid #19abb5' : '2px solid transparent',
      boxShadow: isActive ? '0 0 8px rgba(25, 171, 181, 0.5)' : 'none',
      '&:hover': {
        filter: 'brightness(1.15)',
      },
    };
  }
);

const ImageMarker = styled(Box)<{ isActive?: boolean }>(({ isActive }) => ({
  position: 'absolute',
  top: 4,
  width: 3,
  height: 28,
  backgroundColor: '#5a7fbf',
  borderRadius: 1,
  cursor: 'pointer',
  border: isActive ? '1px solid #19abb5' : 'none',
  boxShadow: isActive ? '0 0 6px rgba(25, 171, 181, 0.5)' : 'none',
  '&:hover': {
    width: 5,
    backgroundColor: '#7b9fd4',
  },
}));

const Playhead = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  backgroundColor: '#19abb5',
  zIndex: 100,
  pointerEvents: 'none',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -6,
    left: -5,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '8px solid #19abb5',
  },
});

const MuteButton = styled(IconButton)({
  color: '#888',
  padding: 6,
  '&:hover': {
    color: '#e1e1e1',
  },
});

const TransportButton = styled(IconButton)({
  color: '#888',
  padding: 6,
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
});

const PlayButton = styled(IconButton)({
  color: '#fff',
  backgroundColor: '#19abb5',
  padding: 8,
  '&:hover': {
    backgroundColor: '#147a82',
  },
});

const ImportButton = styled(Button)({
  fontSize: 11,
  color: '#888',
  backgroundColor: '#252525',
  border: '1px solid #333',
  padding: '4px 12px',
  textTransform: 'none',
  '&:hover': {
    backgroundColor: '#333',
    borderColor: '#19abb5',
    color: '#19abb5',
  },
});

// ============================================================================
// COMPONENT
// ============================================================================

export const SessionTimelineNew: React.FC = () => {
  // Global state
  const globalTimestamp = usePlayheadStore((state) => state.timestamp);
  const setGlobalTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const togglePlayback = usePlayheadStore((state) => state.togglePlayback);
  const setSessionBounds = usePlayheadStore((state) => state.setSessionBounds);
  const jumpToStart = usePlayheadStore((state) => state.jumpToStart);
  const jumpToEnd = usePlayheadStore((state) => state.jumpToEnd);
  const stepForward = usePlayheadStore((state) => state.stepForward);
  const stepBackward = usePlayheadStore((state) => state.stepBackward);

  const activeSessionId = useAppPersistence((state) => state.activeSessionId);
  const sessions = useHomeStore((state) => state.sessions);
  const addSessionEvidence = useHomeStore((state) => state.addSessionEvidence);

  // Local state
  const [items, setItems] = useState<TimelineMediaItem[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [selectedVideoUser, setSelectedVideoUser] = useState<string>('');
  const [selectedAudioUser, setSelectedAudioUser] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<TimelineMediaItem | null>(null);
  const [videoMuted, setVideoMuted] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });

  const lanesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get active session
  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [activeSessionId, sessions]);

  // Load session evidence
  useEffect(() => {
    if (activeSession?.evidence) {
      const sessionItems: TimelineMediaItem[] = activeSession.evidence.map((ev: SessionEvidence) => ({
        id: ev.id,
        evidenceId: ev.evidenceId,
        type: ev.type,
        fileName: ev.fileName,
        thumbnailUrl: ev.thumbnailUrl,
        capturedAt: ev.capturedAt,
        duration: ev.duration,
        endAt: ev.endAt,
        user: ev.user || 'Unassigned',
        deviceInfo: ev.deviceInfo,
        format: ev.format,
        gps: ev.gps,
        flagCount: ev.flagCount,
        hasEdits: ev.hasEdits,
        flags: ev.flags || [],
      }));
      setItems(sessionItems);
    } else {
      setItems([]);
    }
  }, [activeSession]);

  // Calculate time range
  const timeRange = useMemo(() => {
    if (items.length === 0) return null;
    let minTime = Infinity;
    let maxTime = -Infinity;
    items.forEach((item) => {
      minTime = Math.min(minTime, item.capturedAt);
      const endTime = item.endAt || item.capturedAt + (item.duration || 0) * 1000;
      maxTime = Math.max(maxTime, endTime);
    });
    const padding = (maxTime - minTime) * 0.02 || 60000;
    return { start: minTime - padding, end: maxTime + padding };
  }, [items]);

  // Set session bounds
  useEffect(() => {
    if (timeRange) {
      setSessionBounds(timeRange.start, timeRange.end);
    }
  }, [timeRange, setSessionBounds]);

  // Group items by user
  const userSections = useMemo((): UserSection[] => {
    const userMap = new Map<string, { videos: TimelineMediaItem[]; audios: TimelineMediaItem[]; images: TimelineMediaItem[] }>();

    items.forEach((item) => {
      const userName = item.user || 'Unassigned';
      if (!userMap.has(userName)) {
        userMap.set(userName, { videos: [], audios: [], images: [] });
      }
      const userData = userMap.get(userName)!;
      if (item.type === 'video') userData.videos.push(item);
      else if (item.type === 'audio') userData.audios.push(item);
      else if (item.type === 'photo') userData.images.push(item);
    });

    // Sort each array by timestamp
    userMap.forEach((data) => {
      data.videos.sort((a, b) => a.capturedAt - b.capturedAt);
      data.audios.sort((a, b) => a.capturedAt - b.capturedAt);
      data.images.sort((a, b) => a.capturedAt - b.capturedAt);
    });

    // Convert to array and sort by username
    return Array.from(userMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([userName, data]) => ({
        userName,
        videos: data.videos,
        audios: data.audios,
        images: data.images,
        isExpanded: expandedUsers.has(userName),
      }));
  }, [items, expandedUsers]);

  // Get users with video at current playhead
  const usersWithVideoAtPlayhead = useMemo(() => {
    return userSections
      .filter((section) =>
        section.videos.some((v) => {
          const endTime = v.endAt || v.capturedAt + (v.duration || 0) * 1000;
          return globalTimestamp >= v.capturedAt && globalTimestamp <= endTime;
        })
      )
      .map((s) => s.userName);
  }, [userSections, globalTimestamp]);

  // Get users with audio at current playhead
  const usersWithAudioAtPlayhead = useMemo(() => {
    return userSections
      .filter((section) =>
        section.audios.some((a) => {
          const endTime = a.endAt || a.capturedAt + (a.duration || 0) * 1000;
          return globalTimestamp >= a.capturedAt && globalTimestamp <= endTime;
        })
      )
      .map((s) => s.userName);
  }, [userSections, globalTimestamp]);

  // All images for dropdown
  const allImages = useMemo(() => {
    return items.filter((i) => i.type === 'photo').sort((a, b) => a.capturedAt - b.capturedAt);
  }, [items]);

  // Auto-select first available user for video/audio
  useEffect(() => {
    if (usersWithVideoAtPlayhead.length > 0 && !usersWithVideoAtPlayhead.includes(selectedVideoUser)) {
      setSelectedVideoUser(usersWithVideoAtPlayhead[0]);
    }
  }, [usersWithVideoAtPlayhead, selectedVideoUser]);

  useEffect(() => {
    if (usersWithAudioAtPlayhead.length > 0 && !usersWithAudioAtPlayhead.includes(selectedAudioUser)) {
      setSelectedAudioUser(usersWithAudioAtPlayhead[0]);
    }
  }, [usersWithAudioAtPlayhead, selectedAudioUser]);

  // Toggle user section expansion
  const toggleUserExpanded = useCallback((userName: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userName)) {
        next.delete(userName);
      } else {
        next.add(userName);
      }
      return next;
    });
  }, []);

  // Expand all by default on first load
  useEffect(() => {
    if (userSections.length > 0 && expandedUsers.size === 0) {
      const allUsers = new Set(userSections.map((s) => s.userName));
      setExpandedUsers(allUsers);
    }
  }, [userSections.length]);

  // Calculate clip position as percentage
  const getClipStyle = useCallback(
    (item: TimelineMediaItem) => {
      if (!timeRange) return { left: '0%', width: '0%' };
      const totalDuration = timeRange.end - timeRange.start;
      const left = ((item.capturedAt - timeRange.start) / totalDuration) * 100;
      const duration = item.duration ? (item.duration * 1000 / totalDuration) * 100 : 1;
      return {
        left: `${Math.max(0, left)}%`,
        width: `${Math.max(0.5, Math.min(duration, 100 - left))}%`,
      };
    },
    [timeRange]
  );

  // Calculate playhead position
  const playheadPosition = useMemo(() => {
    if (!timeRange) return '0%';
    const totalDuration = timeRange.end - timeRange.start;
    const pos = ((globalTimestamp - timeRange.start) / totalDuration) * 100;
    return `${Math.max(0, Math.min(100, pos))}%`;
  }, [timeRange, globalTimestamp]);

  // Handle timeline click to set playhead
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timeRange || !lanesRef.current) return;
      const rect = lanesRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 140; // Subtract label width
      const width = rect.width - 140;
      const percent = Math.max(0, Math.min(1, x / width));
      const newTime = timeRange.start + percent * (timeRange.end - timeRange.start);
      setGlobalTimestamp(newTime);
    },
    [timeRange, setGlobalTimestamp]
  );

  // Handle clip click
  const handleClipClick = useCallback(
    (item: TimelineMediaItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setGlobalTimestamp(item.capturedAt);
      if (item.type === 'video') {
        setSelectedVideoUser(item.user);
      } else if (item.type === 'audio') {
        setSelectedAudioUser(item.user);
      } else if (item.type === 'photo') {
        setSelectedImage(item);
      }
    },
    [setGlobalTimestamp]
  );

  // Tab key to cycle images
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && allImages.length > 0) {
        e.preventDefault();
        const currentIndex = selectedImage ? allImages.findIndex((i) => i.id === selectedImage.id) : -1;
        let nextIndex: number;
        if (e.shiftKey) {
          nextIndex = currentIndex <= 0 ? allImages.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex >= allImages.length - 1 ? 0 : currentIndex + 1;
        }
        setSelectedImage(allImages[nextIndex]);
        setGlobalTimestamp(allImages[nextIndex].capturedAt);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allImages, selectedImage, setGlobalTimestamp]);

  // Format time for display
  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  // Generate user color
  const getUserColor = useCallback((userName: string) => {
    const colors = ['#c45c5c', '#5a9a6b', '#5a7fbf', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899', '#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
      hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, []);

  // File import handling
  const processImportedFiles = useCallback((files: File[]) => {
    const sortedFiles = sortFilesByType(files);
    const newItems: TimelineMediaItem[] = [];

    const sessionStart = timeRange?.start || Date.now() - 2 * 60 * 60 * 1000;
    const sessionEnd = timeRange?.end || Date.now();

    const processFile = (file: File, type: 'video' | 'audio' | 'image') => {
      const testMetadata = generateTestMetadataIfDev(file, { start: sessionStart, end: sessionEnd });

      const id = testMetadata?.id || generateImportId();
      const user = testMetadata?.user || extractUserFromFile(file) || 'Unassigned';
      const durationSeconds = testMetadata?.duration
        ? Math.floor(testMetadata.duration / 1000)
        : type !== 'image' ? 60 : undefined;

      let capturedAt = testMetadata?.timestamp?.getTime() || sessionStart;
      const durationMs = (durationSeconds || 0) * 1000;

      if (capturedAt + durationMs > sessionEnd) {
        capturedAt = Math.max(sessionStart, sessionEnd - durationMs);
      }

      const newItem: TimelineMediaItem = {
        id,
        evidenceId: `ev-${id}`,
        type: type === 'image' ? 'photo' : type,
        fileName: file.name,
        capturedAt,
        duration: durationSeconds,
        endAt: durationSeconds ? capturedAt + durationSeconds * 1000 : undefined,
        user,
        deviceInfo: testMetadata?.deviceId || 'Imported File',
        format: file.type || 'Unknown',
        gps: testMetadata?.gpsCoordinates ? formatGPSCoordinates(testMetadata.gpsCoordinates) : undefined,
        flagCount: 0,
        hasEdits: false,
        flags: [],
      };

      newItems.push(newItem);
    };

    sortedFiles.video.forEach(file => processFile(file, 'video'));
    sortedFiles.audio.forEach(file => processFile(file, 'audio'));
    sortedFiles.image.forEach(file => processFile(file, 'image'));

    if (newItems.length > 0) {
      setItems(prev => [...prev, ...newItems]);

      if (activeSessionId) {
        const sessionEvidence: SessionEvidence[] = newItems.map((item) => ({
          id: item.id,
          evidenceId: item.evidenceId,
          type: item.type,
          fileName: item.fileName,
          thumbnailUrl: item.thumbnailUrl,
          capturedAt: item.capturedAt,
          duration: item.duration,
          endAt: item.endAt,
          user: item.user,
          deviceInfo: item.deviceInfo,
          format: item.format,
          gps: item.gps,
          flagCount: item.flagCount,
          hasEdits: item.hasEdits,
          flags: item.flags,
        }));
        addSessionEvidence(activeSessionId, sessionEvidence);
      }

      setToast({ open: true, message: `Imported ${newItems.length} files`, severity: 'success' });
    }
  }, [timeRange, activeSessionId, addSessionEvidence]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      processImportedFiles(droppedFiles);
    }
  }, [processImportedFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processImportedFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processImportedFiles]);

  // Empty state
  if (items.length === 0) {
    return (
      <Container onDrop={handleFileDrop} onDragOver={handleDragOver}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          multiple
          accept="video/*,audio/*,image/*"
          onChange={handleFileInputChange}
        />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <FolderOpenIcon sx={{ fontSize: 64, color: '#333' }} />
          <Typography sx={{ color: '#555', fontSize: 16 }}>No evidence in this session</Typography>
          <Typography sx={{ color: '#444', fontSize: 13 }}>Drop files here or click Import Files to begin</Typography>
          <ImportButton onClick={handleImportClick} startIcon={<FolderOpenIcon />}>
            Import Files
          </ImportButton>
        </Box>
      </Container>
    );
  }

  return (
    <Container onDrop={handleFileDrop} onDragOver={handleDragOver}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        accept="video/*,audio/*,image/*"
        onChange={handleFileInputChange}
      />

      {/* Preview Area */}
      <PreviewArea>
        <PreviewRow>
          {/* Video Preview */}
          <VideoPreviewPane>
            <PreviewHeader>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VideocamIcon sx={{ fontSize: 16, color: '#c45c5c' }} />
                <Typography sx={{ fontSize: 12, color: '#888' }}>Video</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PreviewDropdown size="small">
                  <Select
                    value={selectedVideoUser}
                    onChange={(e) => setSelectedVideoUser(e.target.value as string)}
                    displayEmpty
                    disabled={usersWithVideoAtPlayhead.length === 0}
                  >
                    {usersWithVideoAtPlayhead.length === 0 ? (
                      <MenuItem value="">No video at playhead</MenuItem>
                    ) : (
                      usersWithVideoAtPlayhead.map((user) => (
                        <MenuItem key={user} value={user}>{user}</MenuItem>
                      ))
                    )}
                  </Select>
                </PreviewDropdown>
                <MuteButton onClick={() => setVideoMuted(!videoMuted)}>
                  {videoMuted ? <VolumeOffIcon sx={{ fontSize: 18 }} /> : <VolumeUpIcon sx={{ fontSize: 18 }} />}
                </MuteButton>
              </Box>
            </PreviewHeader>
            <PreviewContent>
              {selectedVideoUser && usersWithVideoAtPlayhead.includes(selectedVideoUser) ? (
                <Box sx={{ textAlign: 'center' }}>
                  <VideocamIcon sx={{ fontSize: 48, color: '#c45c5c', mb: 1 }} />
                  <Typography sx={{ color: '#888', fontSize: 14 }}>{selectedVideoUser}'s video</Typography>
                </Box>
              ) : (
                <Typography sx={{ color: '#444', fontSize: 12 }}>No video at current position</Typography>
              )}
            </PreviewContent>
          </VideoPreviewPane>

          {/* Image Preview */}
          <ImagePreviewPane>
            <PreviewHeader>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhotoIcon sx={{ fontSize: 16, color: '#5a7fbf' }} />
                <Typography sx={{ fontSize: 12, color: '#888' }}>Image</Typography>
              </Box>
              <PreviewDropdown size="small">
                <Select
                  value={selectedImage?.id || ''}
                  onChange={(e) => {
                    const img = allImages.find((i) => i.id === e.target.value);
                    if (img) setSelectedImage(img);
                  }}
                  displayEmpty
                >
                  {allImages.length === 0 ? (
                    <MenuItem value="">No images</MenuItem>
                  ) : (
                    allImages.map((img) => (
                      <MenuItem key={img.id} value={img.id}>
                        {img.user}: {img.fileName.length > 20 ? img.fileName.slice(0, 20) + '...' : img.fileName}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </PreviewDropdown>
            </PreviewHeader>
            <PreviewContent>
              {selectedImage ? (
                <Box sx={{ textAlign: 'center' }}>
                  <PhotoIcon sx={{ fontSize: 48, color: '#5a7fbf', mb: 1 }} />
                  <Typography sx={{ color: '#888', fontSize: 12 }}>{selectedImage.fileName}</Typography>
                  <Typography sx={{ color: '#555', fontSize: 10 }}>{selectedImage.user} • {formatTime(selectedImage.capturedAt)}</Typography>
                </Box>
              ) : (
                <Typography sx={{ color: '#444', fontSize: 12 }}>Select an image (Tab to cycle)</Typography>
              )}
            </PreviewContent>
          </ImagePreviewPane>
        </PreviewRow>

        {/* Audio Preview */}
        <AudioPreviewPane>
          <MicIcon sx={{ fontSize: 18, color: '#5a9a6b' }} />
          <PreviewDropdown size="small">
            <Select
              value={selectedAudioUser}
              onChange={(e) => setSelectedAudioUser(e.target.value as string)}
              displayEmpty
              disabled={usersWithAudioAtPlayhead.length === 0}
            >
              {usersWithAudioAtPlayhead.length === 0 ? (
                <MenuItem value="">No audio at playhead</MenuItem>
              ) : (
                usersWithAudioAtPlayhead.map((user) => (
                  <MenuItem key={user} value={user}>{user}</MenuItem>
                ))
              )}
            </Select>
          </PreviewDropdown>
          <WaveformContainer>
            <Box sx={{
              position: 'absolute',
              left: playheadPosition,
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: '#19abb5'
            }} />
          </WaveformContainer>
          <MuteButton onClick={() => setAudioMuted(!audioMuted)}>
            {audioMuted ? <VolumeOffIcon sx={{ fontSize: 18 }} /> : <VolumeUpIcon sx={{ fontSize: 18 }} />}
          </MuteButton>
          <TransportButton onClick={jumpToStart}><SkipPreviousIcon sx={{ fontSize: 18 }} /></TransportButton>
          <TransportButton onClick={stepBackward}><FastRewindIcon sx={{ fontSize: 18 }} /></TransportButton>
          <PlayButton onClick={togglePlayback}>
            {isPlaying ? <PauseIcon sx={{ fontSize: 20 }} /> : <PlayArrowIcon sx={{ fontSize: 20 }} />}
          </PlayButton>
          <TransportButton onClick={stepForward}><FastForwardIcon sx={{ fontSize: 18 }} /></TransportButton>
          <TransportButton onClick={jumpToEnd}><SkipNextIcon sx={{ fontSize: 18 }} /></TransportButton>
          <Typography sx={{ fontSize: 11, color: '#888', fontFamily: 'monospace', minWidth: 70 }}>
            {formatTime(globalTimestamp)}
          </Typography>
        </AudioPreviewPane>
      </PreviewArea>

      {/* Timeline Area */}
      <TimelineArea>
        <TimelineHeader>
          <Typography sx={{ fontSize: 12, color: '#888' }}>
            {userSections.length} users • {items.length} files
          </Typography>
          <ImportButton onClick={handleImportClick} startIcon={<FolderOpenIcon sx={{ fontSize: 14 }} />}>
            Import Files
          </ImportButton>
        </TimelineHeader>

        <TimeRuler>
          {timeRange && [0, 0.25, 0.5, 0.75, 1].map((pct) => (
            <Box
              key={pct}
              sx={{
                position: 'absolute',
                left: `${pct * 100}%`,
                top: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Box sx={{ width: 1, height: 8, backgroundColor: '#333' }} />
              <Typography sx={{ fontSize: 9, color: '#555', mt: 0.5 }}>
                {formatTime(timeRange.start + pct * (timeRange.end - timeRange.start))}
              </Typography>
            </Box>
          ))}
        </TimeRuler>

        <LanesContainer ref={lanesRef} onClick={handleTimelineClick}>
          {userSections.map((section) => (
            <UserSectionContainer key={section.userName}>
              <UserSectionHeader
                userColor={getUserColor(section.userName)}
                onClick={() => toggleUserExpanded(section.userName)}
              >
                {expandedUsers.has(section.userName) ? (
                  <ExpandMoreIcon sx={{ fontSize: 18, color: '#888' }} />
                ) : (
                  <ChevronRightIcon sx={{ fontSize: 18, color: '#888' }} />
                )}
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#e1e1e1', flex: 1 }}>
                  {section.userName}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {section.videos.length > 0 && (
                    <Typography sx={{ fontSize: 10, color: '#c45c5c' }}>
                      {section.videos.length} video{section.videos.length !== 1 ? 's' : ''}
                    </Typography>
                  )}
                  {section.audios.length > 0 && (
                    <Typography sx={{ fontSize: 10, color: '#5a9a6b' }}>
                      {section.audios.length} audio
                    </Typography>
                  )}
                  {section.images.length > 0 && (
                    <Typography sx={{ fontSize: 10, color: '#5a7fbf' }}>
                      {section.images.length} image{section.images.length !== 1 ? 's' : ''}
                    </Typography>
                  )}
                </Box>
              </UserSectionHeader>

              <Collapse in={expandedUsers.has(section.userName)}>
                {/* Video Lane */}
                {section.videos.length > 0 && (
                  <LaneRow>
                    <LaneLabel>
                      <VideocamIcon sx={{ fontSize: 14, color: '#c45c5c' }} />
                      <span>Video</span>
                    </LaneLabel>
                    <LaneContent>
                      {section.videos.map((video) => (
                        <Clip
                          key={video.id}
                          clipType="video"
                          isActive={selectedVideoUser === section.userName}
                          style={getClipStyle(video)}
                          onClick={(e) => handleClipClick(video, e)}
                        >
                          {video.fileName.length > 20 ? video.fileName.slice(0, 20) + '...' : video.fileName}
                        </Clip>
                      ))}
                    </LaneContent>
                  </LaneRow>
                )}

                {/* Audio Lane */}
                {section.audios.length > 0 && (
                  <LaneRow>
                    <LaneLabel>
                      <MicIcon sx={{ fontSize: 14, color: '#5a9a6b' }} />
                      <span>Audio</span>
                    </LaneLabel>
                    <LaneContent>
                      {section.audios.map((audio) => (
                        <Clip
                          key={audio.id}
                          clipType="audio"
                          isActive={selectedAudioUser === section.userName}
                          style={getClipStyle(audio)}
                          onClick={(e) => handleClipClick(audio, e)}
                        >
                          {audio.fileName.length > 20 ? audio.fileName.slice(0, 20) + '...' : audio.fileName}
                        </Clip>
                      ))}
                    </LaneContent>
                  </LaneRow>
                )}

                {/* Images Lane */}
                {section.images.length > 0 && (
                  <LaneRow>
                    <LaneLabel>
                      <PhotoIcon sx={{ fontSize: 14, color: '#5a7fbf' }} />
                      <span>Images ({section.images.length})</span>
                    </LaneLabel>
                    <LaneContent>
                      {section.images.map((image) => {
                        const style = getClipStyle(image);
                        return (
                          <ImageMarker
                            key={image.id}
                            isActive={selectedImage?.id === image.id}
                            style={{ left: style.left }}
                            onClick={(e) => handleClipClick(image, e)}
                          />
                        );
                      })}
                    </LaneContent>
                  </LaneRow>
                )}
              </Collapse>
            </UserSectionContainer>
          ))}

          {/* Playhead */}
          <Playhead style={{ left: `calc(140px + ${playheadPosition})` }} />
        </LanesContainer>
      </TimelineArea>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast(prev => ({ ...prev, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default SessionTimelineNew;
