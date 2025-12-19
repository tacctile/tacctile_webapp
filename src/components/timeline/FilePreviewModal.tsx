/**
 * FilePreviewModal Component
 * Modal for previewing timeline files with metadata, flags, and analyzer navigation
 */

import React, { useRef, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import VideocamIcon from "@mui/icons-material/Videocam";
import MicIcon from "@mui/icons-material/Mic";
import ImageIcon from "@mui/icons-material/Image";
import FlagIcon from "@mui/icons-material/Flag";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonIcon from "@mui/icons-material/Person";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DevicesIcon from "@mui/icons-material/Devices";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

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
}

interface FilePreviewModalProps {
  open: boolean;
  item: TimelineMediaItem | null;
  onClose: () => void;
  onOpenInAnalyzer: (item: TimelineMediaItem) => void;
}

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const StyledDialog = styled(Dialog)(() => ({
  "& .MuiDialog-paper": {
    backgroundColor: "#1a1a1a",
    backgroundImage: "none",
    border: "1px solid #2b2b2b",
    borderRadius: 12,
    maxWidth: 560,
    width: "100%",
    maxHeight: "85vh",
  },
}));

const StyledDialogTitle = styled(DialogTitle)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 24px",
  backgroundColor: "#151515",
  borderBottom: "1px solid #2b2b2b",
});

const HeaderIcon = styled(Box)<{ iconColor: string }>(({ iconColor }) => ({
  width: 48,
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: `${iconColor}22`,
  borderRadius: "50%",
  marginRight: 16,
  "& svg": {
    fontSize: 24,
    color: iconColor,
  },
}));

const PreviewArea = styled(Box)({
  width: "100%",
  height: 200,
  backgroundColor: "#0d0d0d",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  marginBottom: 16,
  border: "1px solid #252525",
});

const WaveformContainer = styled(Box)({
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px 16px",
  gap: 2,
});

const WaveformBar = styled(Box)<{ height: number }>(({ height }) => ({
  width: 3,
  height: `${height}%`,
  backgroundColor: "#4ecdc4",
  borderRadius: 1.5,
  transition: "height 0.2s ease",
}));

const MetadataSection = styled(Box)({
  padding: 16,
  backgroundColor: "#151515",
  borderRadius: 8,
  marginBottom: 16,
});

const MetadataRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
  "&:last-child": {
    marginBottom: 0,
  },
});

const MetadataLabel = styled(Typography)({
  fontSize: 11,
  color: "#666",
  minWidth: 80,
  textTransform: "uppercase",
  fontWeight: 500,
});

const MetadataValue = styled(Typography)({
  fontSize: 13,
  color: "#e1e1e1",
  flex: 1,
});

const FlagsSection = styled(Box)({
  marginBottom: 16,
});

const FlagsList = styled(List)({
  maxHeight: 160,
  overflow: "auto",
  backgroundColor: "#151515",
  borderRadius: 8,
  padding: 0,
  "&::-webkit-scrollbar": {
    width: 6,
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "#333",
    borderRadius: 3,
  },
});

const FlagItem = styled(ListItem)({
  borderBottom: "1px solid #252525",
  padding: "10px 12px",
  "&:last-child": {
    borderBottom: "none",
  },
});

const ConfidenceChip = styled(Chip)<{ confidence: "low" | "medium" | "high" }>(
  ({ confidence }) => {
    const colors = {
      low: { bg: "rgba(234, 179, 8, 0.2)", text: "#eab308" },
      medium: { bg: "rgba(59, 130, 246, 0.2)", text: "#3b82f6" },
      high: { bg: "rgba(34, 197, 94, 0.2)", text: "#22c55e" },
    };
    return {
      height: 20,
      fontSize: 10,
      backgroundColor: colors[confidence].bg,
      color: colors[confidence].text,
      fontWeight: 600,
    };
  },
);

const NoFlagsMessage = styled(Box)({
  padding: 24,
  textAlign: "center",
  color: "#666",
  backgroundColor: "#151515",
  borderRadius: 8,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getTypeIcon = (type: "video" | "audio" | "photo"): React.ReactNode => {
  switch (type) {
    case "video":
      return <VideocamIcon />;
    case "audio":
      return <MicIcon />;
    case "photo":
      return <ImageIcon />;
    default:
      return <InsertDriveFileIcon />;
  }
};

const getTypeColor = (type: "video" | "audio" | "photo"): string => {
  switch (type) {
    case "video":
      return "#c45c5c";
    case "audio":
      return "#4ecdc4";
    case "photo":
      return "#5a7fbf";
    default:
      return "#888";
  }
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

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatFlagTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Generate fake waveform data for audio visualization
const generateWaveformBars = (): number[] => {
  const bars: number[] = [];
  const barCount = 60;
  for (let i = 0; i < barCount; i++) {
    // Create a more realistic waveform pattern
    const baseHeight = 20 + Math.random() * 30;
    const variation = Math.sin(i / 5) * 15 + Math.cos(i / 3) * 10;
    bars.push(Math.max(10, Math.min(90, baseHeight + variation)));
  }
  return bars;
};

// ============================================================================
// COMPONENT
// ============================================================================

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  open,
  item,
  onClose,
  onOpenInAnalyzer,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const waveformBars = React.useMemo(() => generateWaveformBars(), []);

  // Auto-play and loop video when modal opens
  useEffect(() => {
    if (open && item?.type === "video" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked by browser
      });
    }
  }, [open, item]);

  if (!item) return null;

  const typeColor = getTypeColor(item.type);

  const handleOpenInAnalyzer = () => {
    onOpenInAnalyzer(item);
    onClose();
  };

  // Render preview based on file type
  const renderPreview = () => {
    switch (item.type) {
      case "audio":
        return (
          <WaveformContainer>
            {waveformBars.map((height, index) => (
              <WaveformBar key={index} height={height} />
            ))}
          </WaveformContainer>
        );
      case "video":
        // For demo, show a placeholder since we don't have actual video URLs
        // In production, this would use item.thumbnailUrl or a video source
        return (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0d0d0d",
            }}
          >
            <VideocamIcon sx={{ fontSize: 48, color: "#c45c5c", mb: 1 }} />
            <Typography sx={{ color: "#888", fontSize: 12 }}>
              Video Preview
            </Typography>
            <Typography sx={{ color: "#666", fontSize: 11, mt: 0.5 }}>
              First 5 seconds looping silently
            </Typography>
          </Box>
        );
      case "photo":
        // For demo, show a placeholder
        return (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0d0d0d",
            }}
          >
            <ImageIcon sx={{ fontSize: 48, color: "#5a7fbf", mb: 1 }} />
            <Typography sx={{ color: "#888", fontSize: 12 }}>
              Image Thumbnail
            </Typography>
            <Typography sx={{ color: "#666", fontSize: 11, mt: 0.5 }}>
              {item.fileName}
            </Typography>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <StyledDialogTitle>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <HeaderIcon iconColor={typeColor}>
            {getTypeIcon(item.type)}
          </HeaderIcon>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#e1e1e1" }}>
              {item.fileName}
            </Typography>
            <Typography variant="body2" sx={{ color: "#888" }}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)} File
              {item.type === "photo"
                ? ""
                : ` • ${item.duration ? formatDuration(item.duration) : "Unknown duration"}`}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "#888" }}>
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent sx={{ padding: 3 }}>
        {/* Preview Area */}
        <PreviewArea>{renderPreview()}</PreviewArea>

        {/* Metadata Section */}
        <MetadataSection>
          <MetadataRow>
            <PersonIcon sx={{ fontSize: 16, color: "#666" }} />
            <MetadataLabel>User</MetadataLabel>
            <MetadataValue>{item.user || "Unassigned"}</MetadataValue>
          </MetadataRow>
          <MetadataRow>
            <InsertDriveFileIcon sx={{ fontSize: 16, color: "#666" }} />
            <MetadataLabel>Filename</MetadataLabel>
            <MetadataValue>{item.fileName}</MetadataValue>
          </MetadataRow>
          {item.duration && (
            <MetadataRow>
              <AccessTimeIcon sx={{ fontSize: 16, color: "#666" }} />
              <MetadataLabel>Duration</MetadataLabel>
              <MetadataValue>{formatDuration(item.duration)}</MetadataValue>
            </MetadataRow>
          )}
          {item.format && (
            <MetadataRow>
              <DevicesIcon sx={{ fontSize: 16, color: "#666" }} />
              <MetadataLabel>
                {item.type === "photo" ? "Dimensions" : "Format"}
              </MetadataLabel>
              <MetadataValue>{item.format}</MetadataValue>
            </MetadataRow>
          )}
          <MetadataRow>
            <AccessTimeIcon sx={{ fontSize: 16, color: "#666" }} />
            <MetadataLabel>Captured</MetadataLabel>
            <MetadataValue>{formatTimestamp(item.capturedAt)}</MetadataValue>
          </MetadataRow>
          {item.deviceInfo && (
            <MetadataRow>
              <DevicesIcon sx={{ fontSize: 16, color: "#666" }} />
              <MetadataLabel>Device</MetadataLabel>
              <MetadataValue>{item.deviceInfo}</MetadataValue>
            </MetadataRow>
          )}
          {item.gps && (
            <MetadataRow>
              <Box
                sx={{
                  fontSize: 16,
                  color: "#666",
                  width: 16,
                  textAlign: "center",
                }}
              >
                📍
              </Box>
              <MetadataLabel>Location</MetadataLabel>
              <MetadataValue>{item.gps}</MetadataValue>
            </MetadataRow>
          )}
        </MetadataSection>

        {/* Flags Section */}
        <FlagsSection>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: "#e1e1e1",
              mb: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <FlagIcon sx={{ fontSize: 18, color: "#19abb5" }} />
            Flags ({item.flags.length})
          </Typography>

          {item.flags.length > 0 ? (
            <FlagsList>
              {item.flags.map((flag) => (
                <FlagItem key={flag.id} disablePadding>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Box
                      sx={{
                        width: 4,
                        height: 24,
                        backgroundColor: flag.color || "#19abb5",
                        borderRadius: 2,
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 500, color: "#e1e1e1" }}
                        >
                          {flag.title}
                        </Typography>
                        <ConfidenceChip
                          confidence={flag.confidence}
                          label={flag.confidence}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mt: 0.5,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: "#888" }}>
                          @ {formatFlagTime(flag.timestamp)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#666" }}>
                          •
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#888" }}>
                          {flag.userDisplayName}
                        </Typography>
                        {flag.note && (
                          <>
                            <Typography
                              variant="caption"
                              sx={{ color: "#666" }}
                            >
                              •
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#666",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {flag.note}
                            </Typography>
                          </>
                        )}
                      </Box>
                    }
                  />
                </FlagItem>
              ))}
            </FlagsList>
          ) : (
            <NoFlagsMessage>
              <FlagIcon sx={{ fontSize: 32, color: "#444", mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: "#666" }}>
                No flags on this file
              </Typography>
            </NoFlagsMessage>
          )}
        </FlagsSection>
      </DialogContent>

      <Divider sx={{ borderColor: "#2b2b2b" }} />

      <DialogActions sx={{ padding: "12px 24px", backgroundColor: "#151515" }}>
        <Button onClick={onClose} sx={{ color: "#888" }}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleOpenInAnalyzer}
          startIcon={<OpenInNewIcon />}
          sx={{
            backgroundColor: "#19abb5",
            "&:hover": {
              backgroundColor: "#158d95",
            },
          }}
        >
          {getAnalyzerLabel(item.type)}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default FilePreviewModal;
