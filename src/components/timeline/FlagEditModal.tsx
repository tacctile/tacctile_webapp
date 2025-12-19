/**
 * FlagEditModal Component
 * Centered modal for editing flags with unified color picker and unsaved changes protection.
 *
 * Features:
 * - Centered in swimlane area with semi-transparent overlay
 * - Unified color picker (presets + HSL sliders on one screen)
 * - Unsaved changes protection on close attempts
 * - Delete confirmation dialog
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Typography, Button, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import { type Flag } from "@/components/common";

// ============================================================================
// TYPES
// ============================================================================

interface FlagEditModalProps {
  /** The flag being edited */
  flag: Flag;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed (without saving) */
  onClose: () => void;
  /** Callback when flag is saved */
  onSave: (updates: { label: string; note: string; color: string }) => void;
  /** Optional: Reference to the swimlane container for positioning */
  swimlaneContainerRef?: React.RefObject<HTMLElement>;
}

interface UnsavedChangesDialogProps {
  open: boolean;
  onDontSave: () => void;
  onCancel: () => void;
  onSave: () => void;
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onDelete: () => void;
}

// ============================================================================
// PRESET COLORS (8 colors - no white)
// ============================================================================

const PRESET_COLORS = [
  { name: "Red", value: "#ef4444", hsl: { h: 0, s: 84, l: 60 } },
  { name: "Orange", value: "#f97316", hsl: { h: 25, s: 95, l: 53 } },
  { name: "Yellow", value: "#eab308", hsl: { h: 48, s: 89, l: 47 } },
  { name: "Green", value: "#22c55e", hsl: { h: 142, s: 71, l: 45 } },
  { name: "Cyan", value: "#19abb5", hsl: { h: 184, s: 77, l: 40 } },
  { name: "Blue", value: "#3b82f6", hsl: { h: 217, s: 91, l: 60 } },
  { name: "Purple", value: "#a855f7", hsl: { h: 271, s: 91, l: 65 } },
  { name: "Pink", value: "#ec4899", hsl: { h: 330, s: 81, l: 60 } },
];

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Overlay = styled(Box)({
  position: "absolute",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
});

const ModalContainer = styled(Box)({
  width: 320,
  height: 440,
  backgroundColor: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: 8,
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
});

const ModalContent = styled(Box)({
  flex: 1,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
});

const FieldLabel = styled(Typography)({
  fontSize: 10,
  color: "#666",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
});

const TextField = styled("input")({
  width: "100%",
  padding: "8px 10px",
  fontSize: 12,
  backgroundColor: "#252525",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#e1e1e1",
  outline: "none",
  boxSizing: "border-box",
  "&:focus": {
    borderColor: "#19abb5",
  },
  "&::placeholder": {
    color: "#555",
  },
});

const TextAreaField = styled("textarea")({
  width: "100%",
  padding: "8px 10px",
  fontSize: 12,
  backgroundColor: "#252525",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#e1e1e1",
  outline: "none",
  resize: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  "&:focus": {
    borderColor: "#19abb5",
  },
  "&::placeholder": {
    color: "#555",
  },
});

const ColorDot = styled(Box)<{ color: string; isSelected: boolean }>(
  ({ color, isSelected }) => ({
    width: 24,
    height: 24,
    borderRadius: "50%",
    backgroundColor: color,
    cursor: "pointer",
    border: isSelected ? "2px solid #fff" : "2px solid transparent",
    boxShadow: isSelected ? "0 0 0 2px #19abb5" : "none",
    transition: "all 0.15s ease",
    flexShrink: 0,
    "&:hover": {
      transform: "scale(1.1)",
    },
  })
);

const SliderContainer = styled(Box)({
  marginBottom: 12,
});

const SliderTrack = styled(Box)<{ background: string }>(({ background }) => ({
  position: "relative",
  height: 14,
  borderRadius: 7,
  background,
  cursor: "pointer",
}));

const SliderThumb = styled(Box)<{ position: number }>(({ position }) => ({
  position: "absolute",
  top: -2,
  left: `${position}%`,
  transform: "translateX(-50%)",
  width: 8,
  height: 18,
  backgroundColor: "#fff",
  borderRadius: 4,
  boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
  pointerEvents: "none",
}));

const PreviewDot = styled(Box)<{ color: string }>(({ color }) => ({
  width: 28,
  height: 28,
  borderRadius: "50%",
  backgroundColor: color,
  border: "2px solid #444",
  flexShrink: 0,
}));

const ButtonRow = styled(Box)({
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  marginTop: "auto",
  paddingTop: 12,
});

const CancelButton = styled(Button)({
  fontSize: 11,
  color: "#888",
  backgroundColor: "transparent",
  border: "1px solid #444",
  padding: "6px 16px",
  minWidth: "auto",
  textTransform: "none",
  "&:hover": {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "#666",
  },
});

const SaveButton = styled(Button)({
  fontSize: 11,
  color: "#fff",
  backgroundColor: "#19abb5",
  padding: "6px 16px",
  minWidth: "auto",
  textTransform: "none",
  "&:hover": {
    backgroundColor: "#15969f",
  },
});

// Dialog styled components
const DialogOverlay = styled(Box)({
  position: "absolute",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
});

const DialogContainer = styled(Box)({
  backgroundColor: "#1e1e1e",
  border: "1px solid #333",
  borderRadius: 8,
  padding: 20,
  maxWidth: 340,
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
});

const DialogTitle = styled(Typography)({
  fontSize: 14,
  fontWeight: 600,
  color: "#e1e1e1",
  marginBottom: 8,
});

const DialogText = styled(Typography)({
  fontSize: 12,
  color: "#888",
  marginBottom: 16,
});

const DialogButtonRow = styled(Box)({
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
});

const DontSaveButton = styled(Button)({
  fontSize: 11,
  color: "#e57373",
  backgroundColor: "transparent",
  border: "1px solid #e57373",
  padding: "6px 12px",
  minWidth: "auto",
  textTransform: "none",
  "&:hover": {
    backgroundColor: "rgba(229, 115, 115, 0.1)",
  },
});

const DeleteButton = styled(Button)({
  fontSize: 11,
  color: "#fff",
  backgroundColor: "#e57373",
  padding: "6px 16px",
  minWidth: "auto",
  textTransform: "none",
  "&:hover": {
    backgroundColor: "#c45c5c",
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert hex color to HSL values
 */
const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  // Handle HSL string format
  if (hex.startsWith("hsl")) {
    const match = hex.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      return {
        h: parseInt(match[1]),
        s: parseInt(match[2]),
        l: parseInt(match[3]),
      };
    }
  }

  // Handle hex format
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

/**
 * Convert HSL values to HSL string
 */
const hslToString = (h: number, s: number, l: number): string => {
  return `hsl(${h}, ${s}%, ${l}%)`;
};

// ============================================================================
// UNSAVED CHANGES DIALOG
// ============================================================================

const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  open,
  onDontSave,
  onCancel,
  onSave,
}) => {
  if (!open) return null;

  return (
    <DialogOverlay onClick={(e) => e.stopPropagation()}>
      <DialogContainer>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogText>
          You have unsaved changes. Save before closing?
        </DialogText>
        <DialogButtonRow>
          <DontSaveButton onClick={onDontSave}>Don't Save</DontSaveButton>
          <CancelButton onClick={onCancel}>Cancel</CancelButton>
          <SaveButton onClick={onSave}>Save</SaveButton>
        </DialogButtonRow>
      </DialogContainer>
    </DialogOverlay>
  );
};

// ============================================================================
// DELETE CONFIRMATION DIALOG
// ============================================================================

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onCancel,
  onDelete,
}) => {
  if (!open) return null;

  return (
    <DialogOverlay onClick={(e) => e.stopPropagation()}>
      <DialogContainer>
        <DialogTitle>Delete Flag</DialogTitle>
        <DialogText>
          Delete this flag? This cannot be undone.
        </DialogText>
        <DialogButtonRow>
          <CancelButton onClick={onCancel}>Cancel</CancelButton>
          <DeleteButton onClick={onDelete}>Delete</DeleteButton>
        </DialogButtonRow>
      </DialogContainer>
    </DialogOverlay>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const FlagEditModal: React.FC<FlagEditModalProps> = ({
  flag,
  open,
  onClose,
  onSave,
}) => {
  // Form state
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [hue, setHue] = useState(180);
  const [saturation, setSaturation] = useState(70);
  const [lightness, setLightness] = useState(50);

  // Original values for change detection
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalNotes, setOriginalNotes] = useState("");
  const [originalColor, setOriginalColor] = useState("");

  // Dragging state
  const [draggingSlider, setDraggingSlider] = useState<
    "hue" | "saturation" | "lightness" | null
  >(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // Dialog state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Current color string
  const currentColor = useMemo(
    () => hslToString(hue, saturation, lightness),
    [hue, saturation, lightness]
  );

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    const colorChanged = currentColor !== originalColor;
    const titleChanged = title !== originalTitle;
    const notesChanged = notes !== originalNotes;
    return colorChanged || titleChanged || notesChanged;
  }, [title, notes, currentColor, originalTitle, originalNotes, originalColor]);

  // Initialize form when flag changes or modal opens
  useEffect(() => {
    if (open && flag) {
      const flagTitle = flag.label || "";
      const flagNotes = flag.note || "";
      const flagColor = flag.color || flag.userColor || "#19abb5";

      setTitle(flagTitle);
      setNotes(flagNotes);

      const hslValues = hexToHsl(flagColor);
      setHue(hslValues.h);
      setSaturation(hslValues.s);
      setLightness(hslValues.l);

      // Store original values
      setOriginalTitle(flagTitle);
      setOriginalNotes(flagNotes);
      setOriginalColor(hslToString(hslValues.h, hslValues.s, hslValues.l));
    }
  }, [open, flag]);

  // Handle slider drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingSlider || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

      if (draggingSlider === "hue") {
        setHue(Math.round((percentage / 100) * 360));
      } else if (draggingSlider === "saturation") {
        setSaturation(Math.round(percentage));
      } else if (draggingSlider === "lightness") {
        setLightness(Math.round(percentage));
      }
    };

    const handleMouseUp = () => {
      setDraggingSlider(null);
    };

    if (draggingSlider) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
    return undefined;
  }, [draggingSlider]);

  // Handle preset color click
  const handlePresetClick = useCallback(
    (preset: (typeof PRESET_COLORS)[number]) => {
      setHue(preset.hsl.h);
      setSaturation(preset.hsl.s);
      setLightness(preset.hsl.l);
    },
    []
  );

  // Handle slider mouse down
  const handleSliderMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    slider: "hue" | "saturation" | "lightness"
  ) => {
    e.preventDefault();
    sliderRef.current = e.currentTarget;
    setDraggingSlider(slider);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

    if (slider === "hue") {
      setHue(Math.round((percentage / 100) * 360));
    } else if (slider === "saturation") {
      setSaturation(Math.round(percentage));
    } else if (slider === "lightness") {
      setLightness(Math.round(percentage));
    }
  };

  // Handle close attempts
  const handleCloseAttempt = useCallback(() => {
    if (hasChanges) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleCloseAttempt();
      }
    },
    [handleCloseAttempt]
  );

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        handleCloseAttempt();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
    return undefined;
  }, [open, handleCloseAttempt]);

  // Dialog handlers
  const handleDontSave = useCallback(() => {
    setShowUnsavedDialog(false);
    onClose();
  }, [onClose]);

  const handleCancelDialog = useCallback(() => {
    setShowUnsavedDialog(false);
  }, []);

  const handleSave = useCallback(() => {
    setShowUnsavedDialog(false);
    onSave({
      label: title,
      note: notes,
      color: currentColor,
    });
  }, [title, notes, currentColor, onSave]);

  // Handle cancel button (same as close attempt)
  const handleCancel = useCallback(() => {
    handleCloseAttempt();
  }, [handleCloseAttempt]);

  if (!open) return null;

  return (
    <Overlay onClick={handleOverlayClick}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalContent>
          {/* Title Field */}
          <Box sx={{ mb: 2 }}>
            <FieldLabel>Title</FieldLabel>
            <TextField
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Flag title"
              autoFocus
            />
          </Box>

          {/* Notes Field */}
          <Box sx={{ mb: 2, flex: "0 0 auto" }}>
            <FieldLabel>Notes</FieldLabel>
            <TextAreaField
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
            />
          </Box>

          {/* Color Section */}
          <Box sx={{ mb: 2 }}>
            <FieldLabel>Color</FieldLabel>

            {/* Preset Colors */}
            <Box
              sx={{
                display: "flex",
                gap: 1,
                mb: 2,
                flexWrap: "wrap",
              }}
            >
              {PRESET_COLORS.map((preset) => (
                <Tooltip key={preset.value} title={preset.name} placement="top">
                  <ColorDot
                    color={preset.value}
                    isSelected={
                      hue === preset.hsl.h &&
                      saturation === preset.hsl.s &&
                      lightness === preset.hsl.l
                    }
                    onClick={() => handlePresetClick(preset)}
                  />
                </Tooltip>
              ))}
            </Box>

            {/* Hue Slider */}
            <SliderContainer>
              <Typography sx={{ fontSize: 9, color: "#555", mb: 0.5 }}>
                Hue
              </Typography>
              <SliderTrack
                background="linear-gradient(to right, red, yellow, lime, aqua, blue, magenta, red)"
                onMouseDown={(e) => handleSliderMouseDown(e, "hue")}
              >
                <SliderThumb position={(hue / 360) * 100} />
              </SliderTrack>
            </SliderContainer>

            {/* Saturation Slider */}
            <SliderContainer>
              <Typography sx={{ fontSize: 9, color: "#555", mb: 0.5 }}>
                Saturation
              </Typography>
              <SliderTrack
                background={`linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`}
                onMouseDown={(e) => handleSliderMouseDown(e, "saturation")}
              >
                <SliderThumb position={saturation} />
              </SliderTrack>
            </SliderContainer>

            {/* Lightness Slider */}
            <SliderContainer>
              <Typography sx={{ fontSize: 9, color: "#555", mb: 0.5 }}>
                Lightness
              </Typography>
              <SliderTrack
                background={`linear-gradient(to right, hsl(${hue}, ${saturation}%, 0%), hsl(${hue}, ${saturation}%, 50%), hsl(${hue}, ${saturation}%, 100%))`}
                onMouseDown={(e) => handleSliderMouseDown(e, "lightness")}
              >
                <SliderThumb position={lightness} />
              </SliderTrack>
            </SliderContainer>

            {/* Preview Dot */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
              <PreviewDot color={currentColor} />
              <Typography sx={{ fontSize: 10, color: "#666" }}>
                Preview
              </Typography>
            </Box>
          </Box>

          {/* Buttons */}
          <ButtonRow>
            <CancelButton onClick={handleCancel}>Cancel</CancelButton>
            <SaveButton onClick={handleSave}>Save</SaveButton>
          </ButtonRow>
        </ModalContent>
      </ModalContainer>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onDontSave={handleDontSave}
        onCancel={handleCancelDialog}
        onSave={handleSave}
      />
    </Overlay>
  );
};

export default FlagEditModal;
