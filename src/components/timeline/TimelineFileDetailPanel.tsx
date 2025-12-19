/**
 * TimelineFileDetailPanel Component
 * Right column panel for Timeline that shows file preview, flags list, and flag notes
 * when a file bar is clicked in the swimlanes.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Tooltip,
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
    }
  ) => void;
  /** Callback when flag is deleted */
  onFlagDelete?: (flagId: string) => void;
  /** Callback to open file in analyzer tool */
  onOpenInAnalyzer: (file: TimelineMediaItem) => void;
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

// Preview Section (approximately 40% of height)
const PreviewSection = styled(Box)({
  flex: "0 0 40%",
  display: "flex",
  flexDirection: "column",
  backgroundColor: "#0d0d0d",
  borderBottom: "1px solid #252525",
  overflow: "hidden",
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

// Flags List Section (approximately 35% of height)
const FlagsSection = styled(Box)({
  flex: "0 0 35%",
  display: "flex",
  flexDirection: "column",
  borderBottom: "1px solid #252525",
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
  border: isSelected ? "1px solid rgba(25, 171, 181, 0.3)" : "1px solid transparent",
  "&:hover": {
    backgroundColor: isSelected ? "rgba(25, 171, 181, 0.15)" : "rgba(255, 255, 255, 0.03)",
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
  flexShrink: 0,
});

// Notes Section (approximately 25% of height)
const NotesSection = styled(Box)({
  flex: "0 0 25%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
});

const NotesSectionHeader = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  backgroundColor: "#1a1a1a",
  borderBottom: "1px solid #252525",
});

const NotesContent = styled(Box)({
  flex: 1,
  padding: "8px 12px",
  overflowY: "auto",
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

const EmptyNotes = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#444",
  padding: 16,
});

// Input field styling
const StyledInput = styled("input")({
  width: "100%",
  padding: "6px 8px",
  fontSize: 11,
  backgroundColor: "#252525",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#ccc",
  outline: "none",
  boxSizing: "border-box",
  "&:focus": {
    borderColor: "#19abb5",
  },
});

const StyledTextarea = styled("textarea")({
  width: "100%",
  padding: "6px 8px",
  fontSize: 11,
  backgroundColor: "#252525",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#ccc",
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
  boxSizing: "border-box",
  minHeight: 60,
  "&:focus": {
    borderColor: "#19abb5",
  },
});

// Color picker dots
const FLAG_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Cyan", value: "#19abb5" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "White", value: "#ffffff" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
        {isPlaying ? <PauseIcon sx={{ fontSize: 18 }} /> : <PlayArrowIcon sx={{ fontSize: 18 }} />}
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
            background: "linear-gradient(90deg, #1a1a1a 0%, #252525 25%, #1a1a1a 50%, #252525 75%, #1a1a1a 100%)",
            transform: `translateX(-${(frameIndex % 50) * 2}%)`,
            transition: "transform 0.1s linear",
          }}
        />
        <VideocamIcon sx={{ fontSize: 48, color: "#c45c5c", position: "relative", zIndex: 1 }} />
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

export const TimelineFileDetailPanel: React.FC<TimelineFileDetailPanelProps> = ({
  selectedFile,
  flags,
  selectedFlagId,
  onFlagSelect,
  onFlagClick,
  onFlagUpdate,
  onFlagDelete,
  onOpenInAnalyzer,
}) => {
  // Local state for editing flag notes
  const [editingTitle, setEditingTitle] = useState("");
  const [editingNote, setEditingNote] = useState("");
  const [editingColor, setEditingColor] = useState("#19abb5");

  // Get the selected flag
  const selectedFlag = useMemo(() => {
    if (!selectedFlagId) return null;
    return flags.find((f) => f.id === selectedFlagId) || null;
  }, [flags, selectedFlagId]);

  // Update local state when selected flag changes
  useEffect(() => {
    if (selectedFlag) {
      setEditingTitle(selectedFlag.label || "");
      setEditingNote(selectedFlag.note || "");
      setEditingColor(selectedFlag.color || selectedFlag.userColor || "#19abb5");
    } else {
      setEditingTitle("");
      setEditingNote("");
      setEditingColor("#19abb5");
    }
  }, [selectedFlag]);

  // Handle flag row click
  const handleFlagRowClick = useCallback(
    (flag: Flag) => {
      onFlagSelect(flag);
      onFlagClick(flag);
    },
    [onFlagSelect, onFlagClick]
  );

  // Handle title change
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditingTitle(e.target.value);
    },
    []
  );

  // Handle title blur (save)
  const handleTitleBlur = useCallback(() => {
    if (selectedFlag && onFlagUpdate && editingTitle !== selectedFlag.label) {
      onFlagUpdate(selectedFlag.id, { label: editingTitle });
    }
  }, [selectedFlag, editingTitle, onFlagUpdate]);

  // Handle note change
  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditingNote(e.target.value);
    },
    []
  );

  // Handle note blur (save)
  const handleNoteBlur = useCallback(() => {
    if (selectedFlag && onFlagUpdate && editingNote !== selectedFlag.note) {
      onFlagUpdate(selectedFlag.id, { note: editingNote });
    }
  }, [selectedFlag, editingNote, onFlagUpdate]);

  // Handle color selection
  const handleColorSelect = useCallback(
    (color: string) => {
      setEditingColor(color);
      if (selectedFlag && onFlagUpdate) {
        onFlagUpdate(selectedFlag.id, { color });
      }
    },
    [selectedFlag, onFlagUpdate]
  );

  // Handle lock toggle
  const handleToggleLock = useCallback(
    (flag: Flag, e: React.MouseEvent) => {
      e.stopPropagation();
      if (onFlagUpdate) {
        onFlagUpdate(flag.id, { locked: !flag.locked });
      }
    },
    [onFlagUpdate]
  );

  // Handle delete
  const handleDelete = useCallback(
    (flag: Flag, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!flag.locked && onFlagDelete) {
        onFlagDelete(flag.id);
        if (selectedFlagId === flag.id) {
          onFlagSelect(null);
        }
      }
    },
    [onFlagDelete, selectedFlagId, onFlagSelect]
  );

  // Render preview based on file type
  const renderPreview = () => {
    if (!selectedFile) {
      return (
        <EmptyPreview>
          <Typography sx={{ fontSize: 12, color: "#555" }}>
            No file selected
          </Typography>
          <Typography sx={{ fontSize: 10, color: "#444", mt: 1, textAlign: "center" }}>
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

  return (
    <Container>
      {/* Preview Section */}
      <PreviewSection>
        {selectedFile && (
          <Header>
            {getTypeIcon(selectedFile.type)}
            <Box sx={{ flex: 1, minWidth: 0, ml: 1 }}>
              <Typography
                sx={{
                  fontSize: 11,
                  color: "#e1e1e1",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedFile.fileName}
              </Typography>
              <Typography sx={{ fontSize: 9, color: "#666" }}>
                {selectedFile.user || "Unknown"}
              </Typography>
            </Box>
          </Header>
        )}
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

      {/* Flags List Section */}
      <FlagsSection>
        <FlagsSectionHeader>
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
            ({flags.length})
          </Typography>
        </FlagsSectionHeader>
        <FlagsList>
          {!selectedFile ? (
            <EmptyNotes>
              <Typography sx={{ fontSize: 11, color: "#555" }}>
                Select a file to view flags
              </Typography>
            </EmptyNotes>
          ) : flags.length === 0 ? (
            <EmptyNotes>
              <FlagIcon sx={{ fontSize: 24, mb: 1, opacity: 0.3 }} />
              <Typography sx={{ fontSize: 11, color: "#555" }}>
                No flags on this file
              </Typography>
            </EmptyNotes>
          ) : (
            flags.map((flag) => {
              const isSelected = selectedFlagId === flag.id;
              const flagColor = flag.color || flag.userColor || "#19abb5";

              return (
                <FlagItem
                  key={flag.id}
                  isSelected={isSelected}
                  onClick={() => handleFlagRowClick(flag)}
                >
                  {/* Color dot */}
                  <FlagColorDot color={flagColor} />

                  {/* Timestamp */}
                  <Timestamp>{formatTimestamp(flag.timestamp)}</Timestamp>

                  {/* Content */}
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

                  {/* Action icons */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                    {/* Edit - this is implied by selecting the flag */}
                    <Tooltip
                      title={flag.locked ? "Locked - unlock to edit" : "Edit"}
                    >
                      <IconButton
                        size="small"
                        disabled={flag.locked}
                        sx={{
                          padding: "4px",
                          color: isSelected ? "#19abb5" : flag.locked ? "#444" : "#666",
                          "&:hover": {
                            color: flag.locked ? "#444" : "#19abb5",
                          },
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlagRowClick(flag);
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
                      title={flag.locked ? "Locked - unlock to delete" : "Delete"}
                    >
                      <span>
                        <IconButton
                          size="small"
                          disabled={flag.locked}
                          onClick={(e) => handleDelete(flag, e)}
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

      {/* Flag Notes Section */}
      <NotesSection>
        <NotesSectionHeader>
          <EditIcon sx={{ fontSize: 14, color: "#666" }} />
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 600,
              color: "#666",
              textTransform: "uppercase",
            }}
          >
            Flag Details
          </Typography>
        </NotesSectionHeader>
        <NotesContent>
          {!selectedFlag ? (
            <EmptyNotes>
              <Typography sx={{ fontSize: 11, color: "#555", textAlign: "center" }}>
                Select a flag to view notes
              </Typography>
            </EmptyNotes>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {/* Title field */}
              <Box>
                <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
                  Title
                </Typography>
                <StyledInput
                  type="text"
                  value={editingTitle}
                  onChange={handleTitleChange}
                  onBlur={handleTitleBlur}
                  placeholder="Flag title"
                  disabled={selectedFlag.locked}
                />
              </Box>

              {/* Notes field */}
              <Box>
                <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
                  Notes
                </Typography>
                <StyledTextarea
                  value={editingNote}
                  onChange={handleNoteChange}
                  onBlur={handleNoteBlur}
                  placeholder="Add notes..."
                  rows={3}
                  disabled={selectedFlag.locked}
                />
              </Box>

              {/* Color picker */}
              <Box>
                <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
                  Color
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {FLAG_COLORS.map((colorOption) => (
                    <Tooltip
                      key={colorOption.value}
                      title={colorOption.name}
                      placement="top"
                    >
                      <Box
                        onClick={() => {
                          if (!selectedFlag.locked) {
                            handleColorSelect(colorOption.value);
                          }
                        }}
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          backgroundColor: colorOption.value,
                          cursor: selectedFlag.locked ? "not-allowed" : "pointer",
                          opacity: selectedFlag.locked ? 0.5 : 1,
                          border:
                            editingColor === colorOption.value
                              ? "2px solid #fff"
                              : "2px solid transparent",
                          boxShadow:
                            editingColor === colorOption.value
                              ? "0 0 0 1px #19abb5"
                              : "none",
                          transition: "all 0.15s ease",
                          "&:hover": {
                            transform: selectedFlag.locked ? "none" : "scale(1.1)",
                          },
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </NotesContent>
      </NotesSection>
    </Container>
  );
};

export default TimelineFileDetailPanel;
