/**
 * FlagEditModal Component
 * Centered modal for editing flags in the Timeline swimlane area
 * Features: unified color picker, unsaved changes protection, delete confirmation
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Box, Typography, Button, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";

// ============================================================================
// TYPES
// ============================================================================

export interface FlagEditModalProps {
  /** Flag data to edit */
  flag: {
    id: string;
    title: string;
    note?: string;
    color?: string;
  } | null;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when save is clicked */
  onSave: (updates: { title: string; note: string; color: string }) => void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Callback when delete is clicked */
  onDelete: () => void;
}

// ============================================================================
// COLOR CONSTANTS
// ============================================================================

// 8 preset colors (NO white)
const PRESET_COLORS = [
  { name: "Red", hex: "#ef4444", hsl: { h: 0, s: 84, l: 60 } },
  { name: "Orange", hex: "#f97316", hsl: { h: 25, s: 95, l: 53 } },
  { name: "Yellow", hex: "#eab308", hsl: { h: 48, s: 96, l: 47 } },
  { name: "Green", hex: "#22c55e", hsl: { h: 142, s: 71, l: 45 } },
  { name: "Teal", hex: "#19abb5", hsl: { h: 184, s: 77, l: 40 } },
  { name: "Blue", hex: "#3b82f6", hsl: { h: 217, s: 91, l: 60 } },
  { name: "Purple", hex: "#a855f7", hsl: { h: 271, s: 91, l: 65 } },
  { name: "Pink", hex: "#ec4899", hsl: { h: 330, s: 81, l: 60 } },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert HSL to hex color
 */
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * Parse a color string to HSL values
 */
const parseColorToHSL = (
  color: string,
): { h: number; s: number; l: number } => {
  // Default teal
  const defaultHSL = { h: 184, s: 77, l: 40 };

  if (!color) return defaultHSL;

  // Handle HSL format
  if (color.startsWith("hsl")) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
    if (match) {
      return {
        h: parseInt(match[1], 10),
        s: parseInt(match[2], 10),
        l: parseInt(match[3], 10),
      };
    }
  }

  // Handle hex format
  if (color.startsWith("#")) {
    // Check if it matches a preset
    const preset = PRESET_COLORS.find(
      (p) => p.hex.toLowerCase() === color.toLowerCase(),
    );
    if (preset) {
      return preset.hsl;
    }

    // Convert hex to HSL
    let r = 0,
      g = 0,
      b = 0;
    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else if (color.length === 7) {
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
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
  }

  return defaultHSL;
};

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Overlay = styled(Box)({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  zIndex: 100,
});

const ModalContainer = styled(Box)({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 340,
  backgroundColor: "#1a1a1a",
  borderRadius: 8,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  zIndex: 101,
  display: "flex",
  flexDirection: "column",
  padding: 20,
  maxHeight: "90%",
  overflow: "auto",
});

const ModalHeader = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
});

const FormField = styled(Box)({
  marginBottom: 16,
});

const FieldLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  color: "#888",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
});

const TextInput = styled("input")({
  width: "100%",
  padding: "10px 12px",
  fontSize: 13,
  backgroundColor: "#252525",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#e1e1e1",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
  "&:focus": {
    borderColor: "#19abb5",
  },
  "&::placeholder": {
    color: "#555",
  },
});

const TextArea = styled("textarea")({
  width: "100%",
  padding: "10px 12px",
  fontSize: 13,
  backgroundColor: "#252525",
  border: "1px solid #333",
  borderRadius: 6,
  color: "#e1e1e1",
  outline: "none",
  boxSizing: "border-box",
  resize: "none",
  fontFamily: "inherit",
  lineHeight: 1.5,
  transition: "border-color 0.15s ease",
  "&:focus": {
    borderColor: "#19abb5",
  },
  "&::placeholder": {
    color: "#555",
  },
});

const PresetColorRow = styled(Box)({
  display: "flex",
  gap: 8,
  marginBottom: 12,
});

const PresetColorDot = styled(Box)<{ color: string; isSelected: boolean }>(
  ({ color, isSelected }) => ({
    width: 28,
    height: 28,
    borderRadius: "50%",
    backgroundColor: color,
    cursor: "pointer",
    border: isSelected ? "3px solid #fff" : "3px solid transparent",
    boxShadow: isSelected ? "0 0 0 2px #19abb5" : "none",
    transition: "all 0.15s ease",
    "&:hover": {
      transform: "scale(1.1)",
    },
  }),
);

const SliderContainer = styled(Box)({
  marginBottom: 12,
});

const SliderLabel = styled(Typography)({
  fontSize: 10,
  color: "#666",
  marginBottom: 4,
});

const SliderTrack = styled(Box)({
  position: "relative",
  height: 16,
  borderRadius: 8,
  cursor: "pointer",
});

const SliderThumb = styled(Box)<{ position: number }>(({ position }) => ({
  position: "absolute",
  top: -2,
  left: `${position}%`,
  transform: "translateX(-50%)",
  width: 10,
  height: 20,
  backgroundColor: "#fff",
  borderRadius: 4,
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.4)",
  pointerEvents: "none",
}));

const PreviewContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginTop: 8,
  marginBottom: 16,
});

const PreviewDot = styled(Box)<{ color: string }>(({ color }) => ({
  width: 36,
  height: 36,
  borderRadius: "50%",
  backgroundColor: color,
  border: "2px solid #444",
  flexShrink: 0,
}));

const ButtonRow = styled(Box)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 8,
});

const DeleteButton = styled(Button)({
  fontSize: 12,
  color: "#c45c5c",
  backgroundColor: "transparent",
  padding: "8px 12px",
  minWidth: "auto",
  "&:hover": {
    backgroundColor: "rgba(196, 92, 92, 0.1)",
    color: "#ef4444",
  },
});

const CancelButton = styled(Button)({
  fontSize: 12,
  color: "#888",
  backgroundColor: "transparent",
  border: "1px solid #444",
  padding: "8px 16px",
  minWidth: 80,
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "#666",
  },
});

const SaveButton = styled(Button)({
  fontSize: 12,
  color: "#fff",
  backgroundColor: "#19abb5",
  padding: "8px 20px",
  minWidth: 80,
  "&:hover": {
    backgroundColor: "#15969f",
  },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const FlagEditModal: React.FC<FlagEditModalProps> = ({
  flag,
  isOpen,
  onSave,
  onCancel,
  onDelete,
}) => {
  // Local editing state
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [hue, setHue] = useState(184);
  const [saturation, setSaturation] = useState(77);
  const [lightness, setLightness] = useState(40);

  // Original values for comparison
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalNote, setOriginalNote] = useState("");
  const [originalColor, setOriginalColor] = useState("");

  // Drag state for sliders
  const [draggingSlider, setDraggingSlider] = useState<
    "hue" | "saturation" | "lightness" | null
  >(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Refs for focus trap
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLInputElement>(null);

  // Calculate current color
  const currentColor = useMemo(() => {
    return hslToHex(hue, saturation, lightness);
  }, [hue, saturation, lightness]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    const currentColorHex = currentColor.toLowerCase();
    const origColorHex = originalColor.toLowerCase();
    return (
      title !== originalTitle ||
      note !== originalNote ||
      currentColorHex !== origColorHex
    );
  }, [title, note, currentColor, originalTitle, originalNote, originalColor]);

  // Initialize state when flag changes or modal opens
  useEffect(() => {
    if (isOpen && flag) {
      const flagTitle = flag.title || "";
      const flagNote = flag.note || "";
      const flagColor = flag.color || "#19abb5";

      setTitle(flagTitle);
      setNote(flagNote);

      const hsl = parseColorToHSL(flagColor);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);

      // Store original values
      setOriginalTitle(flagTitle);
      setOriginalNote(flagNote);
      setOriginalColor(hslToHex(hsl.h, hsl.s, hsl.l));

      // Reset delete confirmation
      setShowDeleteConfirm(false);

      // Focus first input
      setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 50);
    }
  }, [isOpen, flag]);

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
      sliderRef.current = null;
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

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasChanges]);

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const discard = window.confirm(
        "You have unsaved changes. Discard changes?",
      );
      if (!discard) return;
    }
    setShowDeleteConfirm(false);
    onCancel();
  }, [hasChanges, onCancel]);

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  // Handle preset color click
  const handlePresetClick = useCallback((preset: (typeof PRESET_COLORS)[0]) => {
    setHue(preset.hsl.h);
    setSaturation(preset.hsl.s);
    setLightness(preset.hsl.l);
  }, []);

  // Handle slider mouse down
  const handleSliderMouseDown = useCallback(
    (
      e: React.MouseEvent<HTMLDivElement>,
      type: "hue" | "saturation" | "lightness",
    ) => {
      e.preventDefault();
      sliderRef.current = e.currentTarget;
      setDraggingSlider(type);

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));

      if (type === "hue") {
        setHue(Math.round((percentage / 100) * 360));
      } else if (type === "saturation") {
        setSaturation(Math.round(percentage));
      } else if (type === "lightness") {
        setLightness(Math.round(percentage));
      }
    },
    [],
  );

  // Handle save
  const handleSave = useCallback(() => {
    onSave({
      title,
      note,
      color: currentColor,
    });
  }, [title, note, currentColor, onSave]);

  // Handle delete click
  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  // Handle delete confirm
  const handleDeleteConfirm = useCallback(() => {
    onDelete();
  }, [onDelete]);

  // Handle delete cancel
  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  if (!isOpen || !flag) return null;

  // Check which preset is selected
  const selectedPreset = PRESET_COLORS.find(
    (p) => p.hsl.h === hue && p.hsl.s === saturation && p.hsl.l === lightness,
  );

  return (
    <>
      {/* Overlay */}
      <Overlay onClick={handleOverlayClick} />

      {/* Modal */}
      <ModalContainer ref={modalRef}>
        {/* Delete Confirmation View */}
        {showDeleteConfirm ? (
          <Box>
            <Typography
              sx={{
                fontSize: 16,
                fontWeight: 600,
                color: "#e1e1e1",
                mb: 2,
                textAlign: "center",
              }}
            >
              Delete this flag?
            </Typography>
            <Typography
              sx={{
                fontSize: 13,
                color: "#888",
                mb: 3,
                textAlign: "center",
              }}
            >
              This cannot be undone.
            </Typography>
            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <CancelButton onClick={handleDeleteCancel}>Cancel</CancelButton>
              <Button
                onClick={handleDeleteConfirm}
                sx={{
                  fontSize: 12,
                  color: "#fff",
                  backgroundColor: "#c45c5c",
                  padding: "8px 20px",
                  minWidth: 80,
                  "&:hover": {
                    backgroundColor: "#b74848",
                  },
                }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            {/* Header */}
            <ModalHeader>
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#e1e1e1",
                }}
              >
                Edit Flag
              </Typography>
              <Tooltip title="Delete flag">
                <DeleteButton
                  startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                  onClick={handleDeleteClick}
                >
                  Delete
                </DeleteButton>
              </Tooltip>
            </ModalHeader>

            {/* Title Field */}
            <FormField>
              <FieldLabel>Title</FieldLabel>
              <TextInput
                ref={firstFocusableRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter flag title"
              />
            </FormField>

            {/* Notes Field */}
            <FormField>
              <FieldLabel>Notes</FieldLabel>
              <TextArea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add notes..."
                rows={3}
              />
            </FormField>

            {/* Color Field */}
            <FormField>
              <FieldLabel>Color</FieldLabel>

              {/* Preset Colors Row */}
              <PresetColorRow>
                {PRESET_COLORS.map((preset) => (
                  <Tooltip key={preset.name} title={preset.name}>
                    <PresetColorDot
                      color={preset.hex}
                      isSelected={selectedPreset?.name === preset.name}
                      onClick={() => handlePresetClick(preset)}
                    />
                  </Tooltip>
                ))}
              </PresetColorRow>

              {/* Hue Slider */}
              <SliderContainer>
                <SliderLabel>Hue</SliderLabel>
                <SliderTrack
                  sx={{
                    background:
                      "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                  }}
                  onMouseDown={(e) => handleSliderMouseDown(e, "hue")}
                >
                  <SliderThumb position={(hue / 360) * 100} />
                </SliderTrack>
              </SliderContainer>

              {/* Saturation Slider */}
              <SliderContainer>
                <SliderLabel>Saturation</SliderLabel>
                <SliderTrack
                  sx={{
                    background: `linear-gradient(to right, hsl(${hue}, 0%, ${lightness}%), hsl(${hue}, 100%, ${lightness}%))`,
                  }}
                  onMouseDown={(e) => handleSliderMouseDown(e, "saturation")}
                >
                  <SliderThumb position={saturation} />
                </SliderTrack>
              </SliderContainer>

              {/* Lightness Slider */}
              <SliderContainer>
                <SliderLabel>Lightness</SliderLabel>
                <SliderTrack
                  sx={{
                    background: `linear-gradient(to right, hsl(${hue}, ${saturation}%, 0%), hsl(${hue}, ${saturation}%, 50%), hsl(${hue}, ${saturation}%, 100%))`,
                  }}
                  onMouseDown={(e) => handleSliderMouseDown(e, "lightness")}
                >
                  <SliderThumb position={lightness} />
                </SliderTrack>
              </SliderContainer>

              {/* Preview */}
              <PreviewContainer>
                <PreviewDot color={currentColor} />
                <Typography sx={{ fontSize: 11, color: "#666" }}>
                  Preview
                </Typography>
              </PreviewContainer>
            </FormField>

            {/* Button Row */}
            <ButtonRow>
              <Box /> {/* Spacer */}
              <Box sx={{ display: "flex", gap: 1 }}>
                <CancelButton onClick={handleClose}>Cancel</CancelButton>
                <SaveButton onClick={handleSave}>Save</SaveButton>
              </Box>
            </ButtonRow>
          </>
        )}
      </ModalContainer>
    </>
  );
};

export default FlagEditModal;
