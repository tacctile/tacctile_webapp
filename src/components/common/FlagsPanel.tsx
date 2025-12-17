import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  TextField,
  InputAdornment,
  Popover,
  Checkbox,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import FlagIcon from "@mui/icons-material/Flag";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import UndoIcon from "@mui/icons-material/Undo";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled(Box)({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  position: "relative",
});

const Header = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  borderBottom: "1px solid #252525",
  backgroundColor: "#1a1a1a",
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

// Flag row item - matches annotation row layout
const FlagItem = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  borderRadius: 4,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
});

// Color dot for flag
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
  padding: 16,
  color: "#444",
});

const UndoToast = styled(Box)({
  position: "absolute",
  bottom: 8,
  left: 8,
  right: 8,
  backgroundColor: "#252525",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  zIndex: 10,
  animation: "slideUp 0.2s ease-out",
  "@keyframes slideUp": {
    from: { opacity: 0, transform: "translateY(10px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
});

const Footer = styled(Box)({
  padding: "8px 12px",
  borderTop: "1px solid #252525",
  backgroundColor: "#1a1a1a",
});

// ============================================================================
// FLAG COLORS (same as Image Tool annotations)
// ============================================================================

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
// INTERFACES
// ============================================================================

export interface Flag {
  id: string;
  timestamp: number;
  label: string;
  note?: string;
  category?: string;
  createdBy?: string;
  createdAt?: number;
  /** User color for flag visualization (hex color) */
  userColor?: string;
  /** Flag color (defaults to userColor if not set) */
  color?: string;
  /** Whether flag is visible on waveform */
  visible?: boolean;
  /** Whether flag is locked (cannot be edited or deleted) */
  locked?: boolean;
}

/** User info for filter display */
export interface FlagUser {
  id: string;
  name: string;
  color: string;
}

interface FlagsPanelProps {
  flags: Flag[];
  /** Available users for filtering */
  users?: FlagUser[];
  /** Currently enabled user IDs for filtering */
  enabledUserIds?: string[];
  /** Callback when user filter changes */
  onFilterChange?: (enabledUserIds: string[]) => void;
  /** Currently selected flag ID */
  selectedFlagId?: string;
  /** Ref for the flags list container (for scrolling to selected flag) */
  flagsListRef?: React.RefObject<HTMLDivElement>;
  onFlagClick?: (flag: Flag) => void;
  onFlagAdd?: () => void;
  onFlagEdit?: (flag: Flag) => void;
  onFlagUpdate?: (
    flagId: string,
    updates: {
      label?: string;
      note?: string;
      color?: string;
      visible?: boolean;
      locked?: boolean;
    },
  ) => void;
  onFlagDelete?: (flagId: string) => void;
  disabled?: boolean;
  /** Whether flags are visible on the waveform (for toggle icon) */
  flagsVisibleOnWaveform?: boolean;
  /** Callback when waveform visibility is toggled */
  onWaveformVisibilityToggle?: () => void;
}

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

// ============================================================================
// COMPONENT
// ============================================================================

export const FlagsPanel: React.FC<FlagsPanelProps> = ({
  flags,
  users = [],
  enabledUserIds,
  onFilterChange,
  selectedFlagId,
  flagsListRef,
  onFlagClick,
  onFlagAdd,
  onFlagUpdate,
  onFlagDelete,
  disabled = false,
  flagsVisibleOnWaveform = true,
  onWaveformVisibilityToggle,
}) => {
  const [deletedFlag, setDeletedFlag] = useState<Flag | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit popover state
  const [editPopoverAnchorEl, setEditPopoverAnchorEl] =
    useState<HTMLElement | null>(null);
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editColor, setEditColor] = useState<string>("#19abb5");

  // Color picker popover state
  const [colorPickerAnchorEl, setColorPickerAnchorEl] =
    useState<HTMLElement | null>(null);
  const [customColorHue, setCustomColorHue] = useState(180);
  const [customColorSaturation, setCustomColorSaturation] = useState(70);
  const [customColorLightness, setCustomColorLightness] = useState(50);
  const [draggingColorSlider, setDraggingColorSlider] = useState<
    "hue" | "saturation" | "lightness" | null
  >(null);
  const colorSliderRef = useRef<HTMLDivElement | null>(null);
  const [userCustomColor, setUserCustomColor] = useState<string | null>(null);

  // Filter popover state
  const [filterAnchorEl, setFilterAnchorEl] =
    useState<HTMLButtonElement | null>(null);
  const filterOpen = Boolean(filterAnchorEl);

  // Internal ref for the flags list
  const internalFlagsListRef = useRef<HTMLDivElement>(null);
  const actualFlagsListRef = flagsListRef || internalFlagsListRef;

  // Derive unique users from flags if not provided
  const derivedUsers: FlagUser[] =
    users.length > 0
      ? users
      : (() => {
          const userMap = new Map<string, FlagUser>();
          flags.forEach((flag) => {
            if (flag.createdBy && !userMap.has(flag.createdBy)) {
              userMap.set(flag.createdBy, {
                id: flag.createdBy.toLowerCase(),
                name: flag.createdBy,
                color: flag.userColor || "#19abb5",
              });
            }
          });
          return Array.from(userMap.values());
        })();

  // If enabledUserIds is not provided, all users are enabled by default
  const effectiveEnabledUserIds =
    enabledUserIds ?? derivedUsers.map((u) => u.id);

  // Check if filter is active (not all users are enabled)
  const isFilterActive = effectiveEnabledUserIds.length < derivedUsers.length;

  // Clear undo toast after 5 seconds
  useEffect(() => {
    if (deletedFlag) {
      const timeout = setTimeout(() => {
        setDeletedFlag(null);
      }, 5000);
      setUndoTimeout(timeout);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [deletedFlag]);

  // Color slider drag handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingColorSlider || !colorSliderRef.current) return;
      const rect = colorSliderRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

      if (draggingColorSlider === "hue") {
        setCustomColorHue(Math.round((percentage / 100) * 360));
      } else if (draggingColorSlider === "saturation") {
        setCustomColorSaturation(Math.round(percentage));
      } else if (draggingColorSlider === "lightness") {
        setCustomColorLightness(Math.round(percentage));
      }
    };

    const handleMouseUp = () => {
      if (draggingColorSlider) {
        // Apply the custom color
        const newColor = `hsl(${customColorHue}, ${customColorSaturation}%, ${customColorLightness}%)`;
        setEditColor(newColor);
        setUserCustomColor(newColor);
        setDraggingColorSlider(null);
      }
    };

    if (draggingColorSlider) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
    return undefined;
  }, [
    draggingColorSlider,
    customColorHue,
    customColorSaturation,
    customColorLightness,
  ]);

  // Handle filter toggle
  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  // Handle user checkbox change
  const handleUserToggle = (userId: string) => {
    if (!onFilterChange) return;
    const newEnabledIds = effectiveEnabledUserIds.includes(userId)
      ? effectiveEnabledUserIds.filter((id) => id !== userId)
      : [...effectiveEnabledUserIds, userId];
    onFilterChange(newEnabledIds);
  };

  // Handle Select All
  const handleSelectAll = () => {
    if (!onFilterChange) return;
    onFilterChange(derivedUsers.map((u) => u.id));
  };

  // Handle Clear All
  const handleClearAll = () => {
    if (!onFilterChange) return;
    onFilterChange([]);
  };

  // Handle delete
  const handleDelete = (flag: Flag) => {
    if (flag.locked) return;
    setDeletedFlag(flag);
    onFlagDelete?.(flag.id);
  };

  // Handle undo
  const handleUndo = () => {
    if (deletedFlag && undoTimeout) {
      clearTimeout(undoTimeout);
      console.log("Undo delete:", deletedFlag.id);
      setDeletedFlag(null);
    }
  };

  // Start editing a flag (open popover)
  const handleStartEdit = useCallback((flag: Flag, anchorEl: HTMLElement) => {
    if (flag.locked) return;
    setEditingFlagId(flag.id);
    setEditLabel(flag.label || "");
    setEditNote(flag.note || "");
    setEditColor(flag.color || flag.userColor || "#19abb5");
    setEditPopoverAnchorEl(anchorEl);
  }, []);

  // Cancel edit (close popover)
  const handleCancelEdit = useCallback(() => {
    setEditingFlagId(null);
    setEditLabel("");
    setEditNote("");
    setEditColor("#19abb5");
    setEditPopoverAnchorEl(null);
    setColorPickerAnchorEl(null);
  }, []);

  // Save edit
  const handleSaveEdit = useCallback(() => {
    if (editingFlagId && onFlagUpdate) {
      onFlagUpdate(editingFlagId, {
        label: editLabel,
        note: editNote,
        color: editColor,
      });
    }
    handleCancelEdit();
  }, [
    editingFlagId,
    editLabel,
    editNote,
    editColor,
    onFlagUpdate,
    handleCancelEdit,
  ]);

  // Toggle flag visibility
  const handleToggleVisibility = useCallback(
    (flag: Flag) => {
      if (onFlagUpdate) {
        onFlagUpdate(flag.id, { visible: !(flag.visible ?? true) });
      }
    },
    [onFlagUpdate],
  );

  // Toggle flag lock
  const handleToggleLock = useCallback(
    (flag: Flag) => {
      if (onFlagUpdate) {
        onFlagUpdate(flag.id, { locked: !flag.locked });
      }
    },
    [onFlagUpdate],
  );

  // Handle flag click - jump to timestamp
  const handleFlagClick = (flag: Flag) => {
    onFlagClick?.(flag);
  };

  // Open color picker popover
  const handleOpenColorPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setColorPickerAnchorEl(e.currentTarget as HTMLElement);
  };

  // Close color picker popover
  const handleCloseColorPicker = () => {
    setColorPickerAnchorEl(null);
  };

  // Filter flags based on search query and user filter
  const userFilteredFlags = flags.filter((flag) => {
    if (!onFilterChange) return true;
    const flagUserId = flag.createdBy?.toLowerCase() || "";
    return effectiveEnabledUserIds.includes(flagUserId);
  });

  const filteredFlags = userFilteredFlags.filter((flag) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      flag.label.toLowerCase().includes(q) ||
      flag.note?.toLowerCase().includes(q) ||
      flag.createdBy?.toLowerCase().includes(q)
    );
  });

  // Total count and filtered count for display
  const totalFlagCount = flags.length;
  const visibleFlagCount = userFilteredFlags.length;

  return (
    <Container>
      <Header>
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
              ? `${visibleFlagCount} of ${totalFlagCount}`
              : totalFlagCount}
            )
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {/* Master visibility toggle */}
          {onWaveformVisibilityToggle && (
            <Tooltip title={flagsVisibleOnWaveform ? "Hide all" : "Show all"}>
              <IconButton
                size="small"
                onClick={onWaveformVisibilityToggle}
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
          )}
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
      </Header>

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
                checked={effectiveEnabledUserIds.includes(user.id)}
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

      {/* Search - only show if there are flags */}
      {flags.length > 0 && (
        <Box sx={{ padding: "8px 12px", borderBottom: "1px solid #252525" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search flags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: "#555" }} />
                </InputAdornment>
              ),
              sx: {
                fontSize: 11,
                height: 28,
                backgroundColor: "#252525",
                "& fieldset": { border: "none" },
                "& input": { padding: "4px 8px" },
                "& input::placeholder": { color: "#555", opacity: 1 },
              },
            }}
          />
        </Box>
      )}

      <FlagsList ref={actualFlagsListRef as React.RefObject<HTMLDivElement>}>
        {flags.length === 0 ? (
          <EmptyState>
            <FlagIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 11 }}>No flags yet</Typography>
            <Typography
              sx={{
                fontSize: 10,
                mt: 0.5,
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              Press <span style={{ color: "#19abb5" }}>M</span> while playing
              <br />
              or use the button below
            </Typography>
          </EmptyState>
        ) : filteredFlags.length === 0 ? (
          <EmptyState>
            <SearchIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 11 }}>
              {searchQuery.trim()
                ? `No flags match "${searchQuery}"`
                : "No flags match filter"}
            </Typography>
          </EmptyState>
        ) : (
          filteredFlags.map((flag) => {
            const isSelected = selectedFlagId === flag.id;
            const isEditing = editingFlagId === flag.id;
            const flagColor = flag.color || flag.userColor || "#19abb5";
            const isFlagVisible = flag.visible !== false;
            const hasNote = flag.note && flag.note.length > 0;

            return (
              <Tooltip
                key={flag.id}
                title={flag.note || ""}
                placement="left"
                arrow
                disableHoverListener={!hasNote}
                enterDelay={300}
                slotProps={{
                  tooltip: {
                    sx: {
                      backgroundColor: "#1a1a1a",
                      color: "#ccc",
                      fontSize: 11,
                      maxWidth: 250,
                      border: "1px solid #333",
                      whiteSpace: "pre-wrap",
                    },
                  },
                }}
              >
                <FlagItem
                  data-flag-id={flag.id}
                  onClick={() => handleFlagClick(flag)}
                  sx={{
                    backgroundColor: isSelected
                      ? "rgba(25, 171, 181, 0.1)"
                      : "transparent",
                    border: isSelected
                      ? "1px solid rgba(25, 171, 181, 0.3)"
                      : "1px solid transparent",
                  }}
                >
                  {/* Color dot */}
                  <FlagColorDot
                    color={isEditing && editColor ? editColor : flagColor}
                  />

                  {/* Timestamp */}
                  <Timestamp
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlagClick(flag);
                    }}
                  >
                    {formatTimestamp(flag.timestamp)}
                  </Timestamp>

                  {/* User name */}
                  {flag.createdBy && (
                    <Typography
                      sx={{
                        fontSize: 9,
                        color: "#666",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 50,
                        flexShrink: 0,
                      }}
                    >
                      {flag.createdBy}
                    </Typography>
                  )}

                  {/* Title/Label */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
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
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 0.25 }}
                  >
                    {/* Notes indicator icon */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVisibility(flag);
                        }}
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

                    {/* Edit button */}
                    <Tooltip
                      title={flag.locked ? "Locked - unlock to edit" : "Edit"}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(flag, e.currentTarget);
                        }}
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
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>

                    {/* Lock toggle */}
                    <Tooltip title={flag.locked ? "Unlock" : "Lock"}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLock(flag);
                        }}
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

                    {/* Delete button */}
                    <Tooltip
                      title={
                        flag.locked ? "Locked - unlock to delete" : "Delete"
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(flag);
                          }}
                          disabled={flag.locked}
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
              </Tooltip>
            );
          })
        )}
      </FlagsList>

      {/* Add flag button at bottom */}
      {filteredFlags.length > 0 && (
        <Footer>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<FlagIcon sx={{ fontSize: 14 }} />}
            onClick={onFlagAdd}
            disabled={disabled}
            sx={{
              fontSize: 10,
              color: "#666",
              borderColor: "#333",
              py: 0.5,
              "&:hover": {
                borderColor: "#19abb5",
                color: "#19abb5",
              },
            }}
          >
            Add Flag at Current Time
          </Button>
        </Footer>
      )}

      {/* Edit Popover - positioned to the LEFT of the panel */}
      <Popover
        open={Boolean(editPopoverAnchorEl)}
        anchorEl={editPopoverAnchorEl}
        onClose={handleCancelEdit}
        anchorOrigin={{
          vertical: "center",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "center",
          horizontal: "right",
        }}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 1,
              p: 1.5,
              width: 220,
            },
          },
        }}
      >
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
            Title
          </Typography>
          <input
            type="text"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="Flag title"
            style={{
              width: "100%",
              padding: "6px 8px",
              fontSize: 11,
              backgroundColor: "#252525",
              border: "1px solid #333",
              borderRadius: 4,
              color: "#ccc",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </Box>
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
            Notes
          </Typography>
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="Add notes..."
            rows={3}
            style={{
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
            }}
          />
        </Box>
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
            Color
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 0.5,
              alignItems: "center",
            }}
          >
            {FLAG_COLORS.map((colorOption) => (
              <Tooltip
                key={colorOption.value}
                title={colorOption.name}
                placement="top"
              >
                <Box
                  onClick={() => setEditColor(colorOption.value)}
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: colorOption.value,
                    cursor: "pointer",
                    border:
                      editColor === colorOption.value
                        ? "2px solid #fff"
                        : "2px solid transparent",
                    boxShadow:
                      editColor === colorOption.value
                        ? "0 0 0 1px #19abb5"
                        : "none",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      transform: "scale(1.1)",
                    },
                  }}
                />
              </Tooltip>
            ))}
            {/* Custom color picker button (rainbow) */}
            <Tooltip title="Custom color" placement="top">
              <Box
                onClick={handleOpenColorPicker}
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background:
                    "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                  cursor: "pointer",
                  border:
                    userCustomColor && editColor === userCustomColor
                      ? "2px solid #fff"
                      : "2px solid transparent",
                  boxShadow:
                    userCustomColor && editColor === userCustomColor
                      ? "0 0 0 1px #19abb5"
                      : "none",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    transform: "scale(1.1)",
                  },
                }}
              />
            </Tooltip>
          </Box>
        </Box>

        {/* Color Picker Popover */}
        <Popover
          open={Boolean(colorPickerAnchorEl)}
          anchorEl={colorPickerAnchorEl}
          onClose={handleCloseColorPicker}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
          slotProps={{
            paper: {
              sx: {
                backgroundColor: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 1,
                p: 1.5,
                width: 180,
              },
            },
          }}
        >
          {/* Hue slider */}
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
              Hue
            </Typography>
            <Box
              sx={{
                position: "relative",
                height: 16,
                borderRadius: 1,
                background:
                  "linear-gradient(to right, red, yellow, lime, aqua, blue, magenta, red)",
                cursor: "pointer",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                colorSliderRef.current = e.currentTarget as HTMLDivElement;
                setDraggingColorSlider("hue");
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const hue = Math.round((x / rect.width) * 360);
                setCustomColorHue(Math.max(0, Math.min(360, hue)));
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: -2,
                  left: `${(customColorHue / 360) * 100}%`,
                  transform: "translateX(-50%)",
                  width: 6,
                  height: 20,
                  backgroundColor: "#fff",
                  borderRadius: 0.5,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
              />
            </Box>
          </Box>

          {/* Saturation slider */}
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
              Saturation
            </Typography>
            <Box
              sx={{
                position: "relative",
                height: 16,
                borderRadius: 1,
                background: `linear-gradient(to right, hsl(${customColorHue}, 0%, ${customColorLightness}%), hsl(${customColorHue}, 100%, ${customColorLightness}%))`,
                cursor: "pointer",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                colorSliderRef.current = e.currentTarget as HTMLDivElement;
                setDraggingColorSlider("saturation");
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const sat = Math.round((x / rect.width) * 100);
                setCustomColorSaturation(Math.max(0, Math.min(100, sat)));
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: -2,
                  left: `${customColorSaturation}%`,
                  transform: "translateX(-50%)",
                  width: 6,
                  height: 20,
                  backgroundColor: "#fff",
                  borderRadius: 0.5,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
              />
            </Box>
          </Box>

          {/* Lightness slider */}
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 9, color: "#666", mb: 0.5 }}>
              Lightness
            </Typography>
            <Box
              sx={{
                position: "relative",
                height: 16,
                borderRadius: 1,
                background: `linear-gradient(to right, hsl(${customColorHue}, ${customColorSaturation}%, 0%), hsl(${customColorHue}, ${customColorSaturation}%, 50%), hsl(${customColorHue}, ${customColorSaturation}%, 100%))`,
                cursor: "pointer",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                colorSliderRef.current = e.currentTarget as HTMLDivElement;
                setDraggingColorSlider("lightness");
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const light = Math.round((x / rect.width) * 100);
                setCustomColorLightness(Math.max(0, Math.min(100, light)));
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: -2,
                  left: `${customColorLightness}%`,
                  transform: "translateX(-50%)",
                  width: 6,
                  height: 20,
                  backgroundColor: "#fff",
                  borderRadius: 0.5,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
              />
            </Box>
          </Box>

          {/* Preview */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                backgroundColor: `hsl(${customColorHue}, ${customColorSaturation}%, ${customColorLightness}%)`,
                border: "2px solid #333",
              }}
            />
            <Typography sx={{ fontSize: 10, color: "#888" }}>
              Preview
            </Typography>
          </Box>
        </Popover>

        {/* Cancel/Save buttons */}
        <Box
          sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 1.5 }}
        >
          <Button
            size="small"
            onClick={handleCancelEdit}
            sx={{
              fontSize: 10,
              color: "#888",
              backgroundColor: "transparent",
              border: "1px solid #444",
              px: 1.5,
              py: 0.5,
              minWidth: "auto",
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.05)",
                borderColor: "#666",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            onClick={handleSaveEdit}
            sx={{
              fontSize: 10,
              color: "#fff",
              backgroundColor: "#19abb5",
              px: 1.5,
              py: 0.5,
              minWidth: "auto",
              "&:hover": {
                backgroundColor: "#15969f",
              },
            }}
          >
            Save
          </Button>
        </Box>
      </Popover>

      {/* Undo toast */}
      {deletedFlag && (
        <UndoToast>
          <Typography sx={{ fontSize: 11, color: "#ccc" }}>
            Flag deleted
          </Typography>
          <Button
            size="small"
            startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
            onClick={handleUndo}
            sx={{
              fontSize: 10,
              color: "#19abb5",
              minWidth: "auto",
              py: 0.25,
              px: 1,
            }}
          >
            Undo
          </Button>
        </UndoToast>
      )}
    </Container>
  );
};

export default FlagsPanel;
