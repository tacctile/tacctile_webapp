/**
 * TimelineFileDetailPanel Component
 * Right column panel for Timeline that shows file preview and flags list
 * when a file bar is clicked in the swimlanes.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Tooltip,
  Popover,
  Checkbox,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import VideocamIcon from "@mui/icons-material/Videocam";
import MicIcon from "@mui/icons-material/Mic";
import PhotoIcon from "@mui/icons-material/Photo";
import FlagIcon from "@mui/icons-material/Flag";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";

// ============================================================================
// TYPES
// ============================================================================

interface TimelineMediaItem {
  id: string;
  fileId: string;
  type: "video" | "audio" | "photo";
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
  flags: TimelineFlag[];
}

interface TimelineFlag {
  id: string;
  timestamp: number;
  absoluteTimestamp: number;
  title: string;
  note?: string;
  confidence: "low" | "medium" | "high";
  userId: string;
  userDisplayName: string;
  color?: string;
  locked?: boolean;
}

export interface Flag {
  id: string;
  timestamp: number;
  label: string;
  note?: string;
  category?: string;
  createdBy?: string;
  createdAt?: number;
  userColor?: string;
  color?: string;
  visible?: boolean;
  locked?: boolean;
}

interface TimelineFileDetailPanelProps {
  /** Currently selected file from timeline */
  selectedFile: TimelineMediaItem | null;
  /** Flags for the selected file */
  flags: Flag[];
  /** Currently selected flag ID */
  selectedFlagId: string | null;
  /** Callback when a flag is selected */
  onFlagSelect: (flag: Flag | null) => void;
  /** Callback when flag is clicked (for timeline scroll) */
  onFlagClick: (flag: Flag) => void;
  /** Callback when flag is updated */
  onFlagUpdate?: (
    flagId: string,
    updates: {
      label?: string;
      note?: string;
      color?: string;
      locked?: boolean;
      visible?: boolean;
    },
  ) => void;
  /** Callback when flag is deleted */
  onFlagDelete?: (flagId: string) => void;
  /** Callback to open file in analyzer tool */
  onOpenInAnalyzer: (file: TimelineMediaItem) => void;
  /** Callback when edit flag is requested (opens modal in parent) */
  onEditFlagRequest?: (flag: Flag) => void;
  /** Callback when delete flag is requested (opens confirmation in parent) */
  onDeleteFlagRequest?: (flag: Flag) => void;
}

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled(Box)({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  backgroundColor: "#121212",
});

const Header = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  borderBottom: "1px solid #252525",
  backgroundColor: "#1a1a1a",
});

// Preview Section - matches Navigator size from ImageTool (height: 100)
// Fixed height, no resizing
const PreviewSection = styled(Box)({
  height: 100,
  minHeight: 100,
  maxHeight: 100,
  display: "flex",
  flexDirection: "column",
  backgroundColor: "#0d0d0d",
  overflow: "hidden",
  flexShrink: 0,
});

const PreviewContent = styled(Box)({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  overflow: "hidden",
});

const EmptyPreview = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#444",
  padding: 16,
});

// Open in Analyzer Button
const AnalyzerButton = styled(Button)({
  margin: "8px 12px",
  fontSize: 11,
  textTransform: "none",
  color: "#e1e1e1",
  backgroundColor: "#19abb5",
  "&:hover": {
    backgroundColor: "#15969f",
  },
  "& .MuiButton-startIcon": {
    marginRight: 6,
  },
});

// ============================================================================
// METADATA SECTION STYLED COMPONENTS
// (Matches the lower-left MetadataPanel exactly)
// ============================================================================

const MetadataSection = styled(Box)({
  flexShrink: 0,
  borderTop: "1px solid #252525",
  backgroundColor: "#161616",
});

const MetadataSectionHeader = styled(Box)({
  display: "flex",
  alignItems: "center",
  padding: "4px 10px",
  minHeight: 28,
  borderBottom: "1px solid #252525",
  backgroundColor: "#1a1a1a",
});

const MetadataContent = styled(Box)({
  padding: "8px",
});

const MetadataRow = styled(Box)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  height: 20,
  padding: "0 4px",
});

const MetadataLabel = styled(Typography)({
  fontSize: "10px",
  color: "#666",
});

const MetadataValue = styled(Typography)({
  fontSize: "11px",
  color: "#ccc",
  textAlign: "right",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "65%",
});

// Flags List Section (expands to fill remaining space)
const FlagsSection = styled(Box)({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
});

const FlagsSectionHeader = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  backgroundColor: "#1a1a1a",
  borderBottom: "1px solid #252525",
});

const FlagsList = styled(Box)({
  flex: 1,
  overflowY: "auto",
  padding: "4px 8px",
  "&::-webkit-scrollbar": {
    width: 6,
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "#1a1a1a",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "#333",
    borderRadius: 3,
  },
});

const FlagItem = styled(Box)<{ isSelected?: boolean }>(({ isSelected }) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  borderRadius: 4,
  cursor: "pointer",
  backgroundColor: isSelected ? "rgba(25, 171, 181, 0.1)" : "transparent",
  border: isSelected
    ? "1px solid rgba(25, 171, 181, 0.3)"
    : "1px solid transparent",
  "&:hover": {
    backgroundColor: isSelected
      ? "rgba(25, 171, 181, 0.15)"
      : "rgba(255, 255, 255, 0.03)",
  },
}));

const FlagColorDot = styled(Box)<{ color: string }>(({ color }) => ({
  width: 10,
  height: 10,
  borderRadius: "50%",
  backgroundColor: color,
  flexShrink: 0,
}));

const Timestamp = styled(Typography)({
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  color: "#19abb5",
  cursor: "pointer",
  flexShrink: 0,
  "&:hover": {
    textDecoration: "underline",
  },
});

const EmptyState = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#444",
  padding: 16,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats an absolute timestamp to 12-hour format (e.g., "8:02 AM", "3:45 PM")
 * Used for showing when the file was captured
 */
const formatCaptureTime = (absoluteTimestamp: number): string => {
  const date = new Date(absoluteTimestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
};

/**
 * Formats a duration timestamp (relative to file start) as MM:SS or H:MM:SS
 */
const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const getAnalyzerLabel = (type: "video" | "audio" | "photo"): string => {
  switch (type) {
    case "video":
      return "Open in Video Analyzer";
    case "audio":
      return "Open in Audio Analyzer";
    case "photo":
      return "Open in Image Analyzer";
    default:
      return "Open in Analyzer";
  }
};

const getTypeIcon = (type: "video" | "audio" | "photo"): React.ReactNode => {
  switch (type) {
    case "video":
      return <VideocamIcon sx={{ fontSize: 14, color: "#c45c5c" }} />;
    case "audio":
      return <MicIcon sx={{ fontSize: 14, color: "#5a9a6b" }} />;
    case "photo":
      return <PhotoIcon sx={{ fontSize: 14, color: "#5a7fbf" }} />;
    default:
      return null;
  }
};

// ============================================================================
// AUDIO PREVIEW COMPONENT
// ============================================================================

interface AudioPreviewProps {
  file: TimelineMediaItem;
}

const AudioPreview: React.FC<AudioPreviewProps> = ({ file }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Draw a simple waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "#1e1e1e";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Generate mock waveform for first 15 seconds
    const maxDuration = Math.min(15, file.duration || 15);
    const samples = Math.min(200, Math.floor(width / 2));

    // Draw shadow (outer glow)
    ctx.strokeStyle = "rgba(25, 171, 181, 0.2)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < samples; i++) {
      const x = (i / samples) * width;
      // Generate random amplitude for mock waveform
      const seed = ((file.id.charCodeAt(0) || 0) + i * 17) % 100;
      const amplitude = (seed / 100) * 0.7 + 0.2;
      const y = centerY + Math.sin(i * 0.3) * amplitude * (height / 3);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw main waveform line
    ctx.strokeStyle = "#19abb5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples; i++) {
      const x = (i / samples) * width;
      const seed = ((file.id.charCodeAt(0) || 0) + i * 17) % 100;
      const amplitude = (seed / 100) * 0.7 + 0.2;
      const y = centerY + Math.sin(i * 0.3) * amplitude * (height / 3);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw playhead position
    if (isPlaying || currentTime > 0) {
      const playheadX = (currentTime / maxDuration) * width;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    // Draw 15 second indicator text
    ctx.fillStyle = "#666";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText("15s preview", width - 8, height - 8);
  }, [file.id, file.duration, isPlaying, currentTime]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    } else {
      setIsPlaying(true);
      setCurrentTime(0);
      const startTime = performance.now();
      const maxDuration = Math.min(15, file.duration || 15) * 1000;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        if (elapsed >= maxDuration) {
          setIsPlaying(false);
          setCurrentTime(maxDuration / 1000);
          return;
        }
        setCurrentTime(elapsed / 1000);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [isPlaying, file.duration]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
      <IconButton
        onClick={togglePlay}
        sx={{
          position: "absolute",
          bottom: 8,
          left: 8,
          backgroundColor: "rgba(25, 171, 181, 0.9)",
          color: "#fff",
          width: 32,
          height: 32,
          "&:hover": {
            backgroundColor: "#19abb5",
          },
        }}
      >
        {isPlaying ? (
          <PauseIcon sx={{ fontSize: 18 }} />
        ) : (
          <PlayArrowIcon sx={{ fontSize: 18 }} />
        )}
      </IconButton>
    </Box>
  );
};

// ============================================================================
// VIDEO PREVIEW COMPONENT
// ============================================================================

interface VideoPreviewProps {
  file: TimelineMediaItem;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ file }) => {
  // For demo purposes, show a placeholder with looping animation
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    // Simulate 5-second looping video at ~10fps
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % 50);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
        position: "relative",
      }}
    >
      {/* Placeholder video frame with animation */}
      <Box
        sx={{
          width: "80%",
          height: "80%",
          backgroundColor: "#1a1a1a",
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Animated gradient to simulate video playback */}
        <Box
          sx={{
            position: "absolute",
            width: "200%",
            height: "100%",
            background:
              "linear-gradient(90deg, #1a1a1a 0%, #252525 25%, #1a1a1a 50%, #252525 75%, #1a1a1a 100%)",
            transform: `translateX(-${(frameIndex % 50) * 2}%)`,
            transition: "transform 0.1s linear",
          }}
        />
        <VideocamIcon
          sx={{
            fontSize: 48,
            color: "#c45c5c",
            position: "relative",
            zIndex: 1,
          }}
        />
      </Box>
      {/* 5s loop indicator */}
      <Typography
        sx={{
          position: "absolute",
          bottom: 8,
          right: 8,
          fontSize: 10,
          color: "#666",
          fontFamily: "monospace",
        }}
      >
        5s loop (silent)
      </Typography>
    </Box>
  );
};

// ============================================================================
// IMAGE PREVIEW COMPONENT
// ============================================================================

interface ImagePreviewProps {
  file: TimelineMediaItem;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ file }) => {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
      }}
    >
      {/* Placeholder image thumbnail */}
      <Box
        sx={{
          width: "80%",
          height: "80%",
          backgroundColor: "#1a1a1a",
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid #252525",
        }}
      >
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.fileName}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <PhotoIcon sx={{ fontSize: 48, color: "#5a7fbf" }} />
        )}
      </Box>
    </Box>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/** User info for filter display */
interface FlagUser {
  id: string;
  name: string;
  color: string;
}

export const TimelineFileDetailPanel: React.FC<
  TimelineFileDetailPanelProps
> = ({
  selectedFile,
  flags,
  selectedFlagId,
  onFlagSelect,
  onFlagClick,
  onFlagUpdate,
  onFlagDelete,
  onOpenInAnalyzer,
  onEditFlagRequest,
  onDeleteFlagRequest,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter popover state
  const [filterAnchorEl, setFilterAnchorEl] =
    useState<HTMLButtonElement | null>(null);
  const filterOpen = Boolean(filterAnchorEl);
  const [enabledUserIds, setEnabledUserIds] = useState<string[]>([]);

  // Master visibility state for all flags
  const [flagsVisibleOnWaveform, setFlagsVisibleOnWaveform] = useState(true);

  // Derive unique users from flags
  const derivedUsers: FlagUser[] = (() => {
    const userMap = new Map<string, FlagUser>();
    flags.forEach((flag) => {
      if (flag.createdBy && !userMap.has(flag.createdBy)) {
        userMap.set(flag.createdBy, {
          id: flag.createdBy.toLowerCase(),
          name: flag.createdBy,
          color: flag.userColor || flag.color || "#19abb5",
        });
      }
    });
    return Array.from(userMap.values());
  })();

  // Initialize enabledUserIds when users change
  useEffect(() => {
    if (enabledUserIds.length === 0 && derivedUsers.length > 0) {
      setEnabledUserIds(derivedUsers.map((u) => u.id));
    }
  }, [derivedUsers, enabledUserIds.length]);

  // Check if filter is active (not all users are enabled)
  const isFilterActive =
    enabledUserIds.length > 0 && enabledUserIds.length < derivedUsers.length;

  // Filter flags based on user filter
  const filteredFlags = flags.filter((flag) => {
    if (enabledUserIds.length === 0) return true;
    const flagUserId = flag.createdBy?.toLowerCase() || "";
    return enabledUserIds.includes(flagUserId);
  });

  // Handle flag row click
  const handleFlagRowClick = useCallback(
    (flag: Flag) => {
      onFlagSelect(flag);
      onFlagClick(flag);
    },
    [onFlagSelect, onFlagClick],
  );

  // Start editing a flag - request edit via parent callback
  const handleStartEdit = useCallback(
    (flag: Flag) => {
      if (flag.locked) return;
      if (onEditFlagRequest) {
        onEditFlagRequest(flag);
      }
    },
    [onEditFlagRequest]
  );

  // Toggle flag visibility
  const handleToggleVisibility = useCallback(
    (flag: Flag, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onFlagUpdate) {
        onFlagUpdate(flag.id, { visible: !(flag.visible ?? true) });
      }
    },
    [onFlagUpdate],
  );

  // Handle lock toggle
  const handleToggleLock = useCallback(
    (flag: Flag, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onFlagUpdate) {
        onFlagUpdate(flag.id, { locked: !flag.locked });
      }
    },
    [onFlagUpdate],
  );

  // Handle delete - request delete confirmation via parent callback
  const handleDeleteClick = useCallback(
    (flag: Flag, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!flag.locked && onDeleteFlagRequest) {
        onDeleteFlagRequest(flag);
      }
    },
    [onDeleteFlagRequest]
  );

  // Filter handlers
  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  // Handle user checkbox change
  const handleUserToggle = (userId: string) => {
    const newEnabledIds = enabledUserIds.includes(userId)
      ? enabledUserIds.filter((id) => id !== userId)
      : [...enabledUserIds, userId];
    setEnabledUserIds(newEnabledIds);
  };

  // Handle Select All
  const handleSelectAll = () => {
    setEnabledUserIds(derivedUsers.map((u) => u.id));
  };

  // Handle Clear All
  const handleClearAll = () => {
    setEnabledUserIds([]);
  };

  // Toggle master visibility for all flags
  const handleWaveformVisibilityToggle = () => {
    setFlagsVisibleOnWaveform(!flagsVisibleOnWaveform);
  };

  // Render preview based on file type
  const renderPreview = () => {
    if (!selectedFile) {
      return (
        <EmptyPreview>
          <Typography sx={{ fontSize: 12, color: "#555" }}>
            No file selected
          </Typography>
          <Typography
            sx={{ fontSize: 10, color: "#444", mt: 1, textAlign: "center" }}
          >
            Click a file bar in the timeline to view details
          </Typography>
        </EmptyPreview>
      );
    }

    switch (selectedFile.type) {
      case "audio":
        return <AudioPreview file={selectedFile} />;
      case "video":
        return <VideoPreview file={selectedFile} />;
      case "photo":
        return <ImagePreview file={selectedFile} />;
      default:
        return (
          <EmptyPreview>
            <Typography sx={{ fontSize: 12, color: "#555" }}>
              Preview not available
            </Typography>
          </EmptyPreview>
        );
    }
  };

  // Format timestamp for metadata display
  const formatTimestamp = (ts?: number): string => {
    if (!ts) return "—";
    return new Date(ts).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format duration for metadata display
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "—";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get row 3 label and value based on file type
  const getRow3Data = () => {
    if (!selectedFile) return { label: "Duration", value: "—" };
    if (selectedFile.type === "photo") {
      return { label: "Resolution", value: "—" };
    }
    return { label: "Duration", value: formatDuration(selectedFile.duration) };
  };

  const row3Data = getRow3Data();

  return (
    <Container ref={containerRef}>
      {/* Preview Section - fixed height matching Navigator from ImageTool (100px) */}
      <PreviewSection>
        <PreviewContent>{renderPreview()}</PreviewContent>
      </PreviewSection>

      {/* Open in Analyzer Button */}
      {selectedFile && (
        <AnalyzerButton
          variant="contained"
          startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
          onClick={() => onOpenInAnalyzer(selectedFile)}
          fullWidth
        >
          {getAnalyzerLabel(selectedFile.type)}
        </AnalyzerButton>
      )}

      {/* METADATA Section - matches lower-left MetadataPanel styling exactly */}
      <MetadataSection>
        <MetadataSectionHeader>
          <Typography
            sx={{
              fontSize: "10px",
              fontWeight: 600,
              color: "#808080",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Metadata
          </Typography>
        </MetadataSectionHeader>
        <MetadataContent>
          <MetadataRow>
            <MetadataLabel>Filename</MetadataLabel>
            <MetadataValue>{selectedFile?.fileName || "—"}</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Captured</MetadataLabel>
            <MetadataValue>
              {formatTimestamp(selectedFile?.capturedAt)}
            </MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>{row3Data.label}</MetadataLabel>
            <MetadataValue>{row3Data.value}</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>User</MetadataLabel>
            <MetadataValue>{selectedFile?.user || "—"}</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Device</MetadataLabel>
            <MetadataValue>{selectedFile?.deviceInfo || "—"}</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Format</MetadataLabel>
            <MetadataValue>{selectedFile?.format || "—"}</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>GPS</MetadataLabel>
            <MetadataValue>{selectedFile?.gps || "—"}</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <MetadataLabel>Flags</MetadataLabel>
            <MetadataValue
              sx={{ color: selectedFile?.flagCount ? "#19abb5" : "#666" }}
            >
              {selectedFile?.flagCount ?? "—"}
            </MetadataValue>
          </MetadataRow>
        </MetadataContent>
      </MetadataSection>

      {/* Flags List Section */}
      <FlagsSection>
        <FlagsSectionHeader>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FlagIcon sx={{ fontSize: 14, color: "#19abb5" }} />
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 600,
                color: "#666",
                textTransform: "uppercase",
              }}
            >
              Flags
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#555" }}>
              (
              {isFilterActive
                ? `${filteredFlags.length} of ${flags.length}`
                : flags.length}
              )
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {/* Master visibility toggle */}
            <Tooltip title={flagsVisibleOnWaveform ? "Hide all" : "Show all"}>
              <IconButton
                size="small"
                onClick={handleWaveformVisibilityToggle}
                disabled={flags.length === 0}
                sx={{
                  padding: "4px",
                  color: flagsVisibleOnWaveform ? "#19abb5" : "#444",
                }}
              >
                {flagsVisibleOnWaveform ? (
                  <VisibilityIcon sx={{ fontSize: 16 }} />
                ) : (
                  <VisibilityOffIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
            {/* Filter button */}
            {derivedUsers.length > 0 && (
              <Tooltip title="Filter by user">
                <IconButton
                  size="small"
                  onClick={handleFilterClick}
                  sx={{
                    padding: "4px",
                    color: isFilterActive ? "#19abb5" : "#666",
                    "&:hover": { color: "#19abb5" },
                  }}
                >
                  <FilterListIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </FlagsSectionHeader>
        <FlagsList>
          {!selectedFile ? (
            <EmptyState>
              <Typography sx={{ fontSize: 11, color: "#555" }}>
                Select a file to view flags
              </Typography>
            </EmptyState>
          ) : flags.length === 0 ? (
            <EmptyState>
              <FlagIcon sx={{ fontSize: 24, mb: 1, opacity: 0.3 }} />
              <Typography sx={{ fontSize: 11, color: "#555" }}>
                No flags on this file
              </Typography>
            </EmptyState>
          ) : filteredFlags.length === 0 ? (
            <EmptyState>
              <FilterListIcon sx={{ fontSize: 24, mb: 1, opacity: 0.3 }} />
              <Typography sx={{ fontSize: 11, color: "#555" }}>
                No flags match filter
              </Typography>
            </EmptyState>
          ) : (
            filteredFlags.map((flag) => {
              const isSelected = selectedFlagId === flag.id;
              const flagColor = flag.color || flag.userColor || "#19abb5";
              const isFlagVisible = flag.visible !== false;
              const hasNote = flag.note && flag.note.length > 0;
              // Calculate capture time for this flag using file's capturedAt + flag.timestamp
              const flagCaptureTime = selectedFile.capturedAt + flag.timestamp;

              return (
                <FlagItem
                  key={flag.id}
                  isSelected={isSelected}
                  onClick={() => handleFlagRowClick(flag)}
                >
                  {/* Color dot */}
                  <FlagColorDot color={flagColor} />

                  {/* Timestamp - 12-hour format of capture time */}
                  <Timestamp>{formatCaptureTime(flagCaptureTime)}</Timestamp>

                  {/* Content: Username on top, title underneath */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {flag.createdBy && (
                      <Typography
                        sx={{
                          fontSize: 9,
                          color: "#666",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {flag.createdBy}
                      </Typography>
                    )}
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: flag.label ? "#ccc" : "#666",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {flag.label || "Untitled"}
                    </Typography>
                  </Box>

                  {/* Action icons: paper (if notes), eyeball, pencil, lock, trash */}
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 0.25 }}
                  >
                    {/* Notes indicator icon - only if has notes */}
                    {hasNote && (
                      <Tooltip title="Has notes">
                        <DescriptionOutlinedIcon
                          sx={{
                            fontSize: 14,
                            color: "#888",
                            flexShrink: 0,
                          }}
                        />
                      </Tooltip>
                    )}

                    {/* Visibility toggle */}
                    <Tooltip title={isFlagVisible ? "Hide" : "Show"}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleToggleVisibility(flag, e)}
                        sx={{
                          padding: "4px",
                          color: isFlagVisible ? "#19abb5" : "#444",
                        }}
                      >
                        {isFlagVisible ? (
                          <VisibilityIcon sx={{ fontSize: 14 }} />
                        ) : (
                          <VisibilityOffIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>

                    {/* Edit button - opens flyout */}
                    <Tooltip
                      title={flag.locked ? "Locked - unlock to edit" : "Edit"}
                    >
                      <IconButton
                        size="small"
                        disabled={flag.locked}
                        sx={{
                          padding: "4px",
                          color: isEditing
                            ? "#19abb5"
                            : flag.locked
                              ? "#444"
                              : "#666",
                          "&:hover": {
                            color: flag.locked ? "#444" : "#19abb5",
                          },
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(flag);
                        }}
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>

                    {/* Lock toggle */}
                    <Tooltip title={flag.locked ? "Unlock" : "Lock"}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleToggleLock(flag, e)}
                        sx={{
                          padding: "4px",
                          color: flag.locked ? "#19abb5" : "#666",
                          "&:hover": { color: "#19abb5" },
                        }}
                      >
                        {flag.locked ? (
                          <LockIcon sx={{ fontSize: 14 }} />
                        ) : (
                          <LockOpenIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>

                    {/* Delete */}
                    <Tooltip
                      title={
                        flag.locked ? "Locked - unlock to delete" : "Delete"
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          disabled={flag.locked}
                          onClick={(e) => handleDeleteClick(flag, e)}
                          sx={{
                            padding: "4px",
                            color: flag.locked ? "#444" : "#666",
                            "&:hover": {
                              color: flag.locked ? "#444" : "#c45c5c",
                            },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </FlagItem>
              );
            })
          )}
        </FlagsList>
      </FlagsSection>

      {/* User filter popover */}
      <Popover
        open={filterOpen}
        anchorEl={filterAnchorEl}
        onClose={handleFilterClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: 1,
              minWidth: 180,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            },
          },
        }}
      >
        <Box sx={{ p: 1.5 }}>
          {/* Select All / Clear All buttons */}
          <Box
            sx={{
              display: "flex",
              gap: 1,
              mb: 1,
              borderBottom: "1px solid #333",
              pb: 1,
            }}
          >
            <Typography
              onClick={handleSelectAll}
              sx={{
                fontSize: 10,
                color: "#888",
                cursor: "pointer",
                "&:hover": { color: "#19abb5" },
              }}
            >
              Select All
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#444" }}>|</Typography>
            <Typography
              onClick={handleClearAll}
              sx={{
                fontSize: 10,
                color: "#888",
                cursor: "pointer",
                "&:hover": { color: "#19abb5" },
              }}
            >
              Clear All
            </Typography>
          </Box>

          {/* User checkboxes */}
          {derivedUsers.map((user) => (
            <Box
              key={user.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.5,
                cursor: "pointer",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.02)" },
              }}
              onClick={() => handleUserToggle(user.id)}
            >
              <Checkbox
                checked={enabledUserIds.includes(user.id)}
                size="small"
                sx={{
                  padding: 0,
                  color: "#555",
                  "&.Mui-checked": {
                    color: user.color,
                  },
                }}
              />
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: user.color,
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ fontSize: 11, color: "#ccc" }}>
                {user.name}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </Container>
  );
};

export default TimelineFileDetailPanel;
