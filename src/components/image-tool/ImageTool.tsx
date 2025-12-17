import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  Alert,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import ImageIcon from "@mui/icons-material/Image";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import FlipIcon from "@mui/icons-material/Flip";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import RectangleOutlinedIcon from "@mui/icons-material/RectangleOutlined";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CompareIcon from "@mui/icons-material/Compare";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import AddIcon from "@mui/icons-material/Add";
import PersonIcon from "@mui/icons-material/Person";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import CropFreeIcon from "@mui/icons-material/CropFree";

import { WorkspaceLayout } from "@/components/layout";
import { FileLibrary, type FileItem } from "@/components/file-library";
import { MetadataPanel, PrecisionSlider } from "@/components/common";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useImageToolStore } from "@/stores/useImageToolStore";
import type { ImageAnnotation as StoreImageAnnotation } from "@/types/image";
import {
  isFileType,
  getFileTypeErrorMessage,
  getAcceptString,
} from "@/utils/fileTypes";
import {
  generateTestMetadataIfDev,
  formatGPSCoordinates,
} from "@/utils/testMetadataGenerator";

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const MainContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  backgroundColor: "#0d0d0d",
});

const Toolbar = styled(Box)({
  height: 40,
  backgroundColor: "#161616",
  borderBottom: "1px solid #252525",
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
  gap: 8,
});

const ToolbarDivider = styled(Box)({
  width: 1,
  height: 24,
  backgroundColor: "#2b2b2b",
  margin: "0 4px",
});

const CanvasArea = styled(Box)({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#0a0a0a",
  position: "relative",
  overflow: "hidden",
  minHeight: 0,
});

const StyledToggleButton = styled(ToggleButton)({
  border: "none",
  padding: "4px 8px",
  color: "#888",
  "&.Mui-selected": {
    backgroundColor: "rgba(25, 171, 181, 0.2)",
    color: "#19abb5",
    "&:hover": {
      backgroundColor: "rgba(25, 171, 181, 0.3)",
    },
  },
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
});

const ToolButton = styled(IconButton)<{ active?: boolean }>(({ active }) => ({
  padding: 6,
  color: active ? "#19abb5" : "#888",
  backgroundColor: active ? "rgba(25, 171, 181, 0.15)" : "transparent",
  "&:hover": {
    backgroundColor: active
      ? "rgba(25, 171, 181, 0.25)"
      : "rgba(255, 255, 255, 0.05)",
  },
}));

const ZoomDisplay = styled(Typography)({
  fontSize: 11,
  color: "#888",
  fontFamily: '"JetBrains Mono", monospace',
  minWidth: 45,
  textAlign: "center",
});

const SplitDivider = styled(Box)<{ isDragging?: boolean }>(
  ({ isDragging }) => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: isDragging ? "#4dd4df" : "#19abb5",
    cursor: isDragging ? "grabbing" : "grab",
    zIndex: 3, // Below ViewLabel (z-index: 5) so labels stay on top
    userSelect: "none",
    "&:hover": {
      backgroundColor: "#4dd4df",
    },
    // Centered drag handle pill
    "&::after": {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 8,
      height: 48,
      backgroundColor: isDragging ? "#5ee0ea" : "#2bc4cf",
      borderRadius: 4,
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
    },
    "&:hover::after": {
      backgroundColor: "#5ee0ea",
    },
  }),
);

const BottomBar = styled(Box)({
  height: 32,
  backgroundColor: "#161616",
  borderTop: "1px solid #252525",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 12px",
});

// Label for ORIGINAL/EDITED in view modes
const ViewLabel = styled(Typography)<{ position: "left" | "right" }>(
  ({ position }) => ({
    position: "absolute",
    top: 12,
    [position]: 12,
    fontSize: 10,
    fontWeight: 600,
    color: "#fff",
    textTransform: "uppercase",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: "4px 8px",
    borderRadius: 4,
    letterSpacing: "0.5px",
    zIndex: 5,
    pointerEvents: "none",
  }),
);

// File drop zone for center canvas when no file loaded
const FileDropZone = styled(Box)<{ isActive: boolean }>(({ isActive }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: isActive ? "#19abb5" : "#444",
  backgroundColor: isActive ? "rgba(25, 171, 181, 0.08)" : "transparent",
  border: isActive ? "2px dashed #19abb5" : "2px dashed transparent",
  borderRadius: 8,
  padding: 32,
  margin: 16,
  transition: "all 0.2s ease",
  cursor: "pointer",
}));

// Import button for left panel - full width
const ImportButton = styled(Button)({
  fontSize: 9,
  color: "#888",
  backgroundColor: "#252525",
  border: "1px solid #333",
  padding: "6px 8px",
  textTransform: "none",
  width: "100%",
  justifyContent: "center",
  "&:hover": {
    backgroundColor: "#333",
    borderColor: "#19abb5",
    color: "#19abb5",
  },
  "& .MuiButton-startIcon": {
    marginRight: 4,
  },
});

// Right Panel Styled Components
const InspectorSection = styled(Box)({
  borderBottom: "1px solid #252525",
});

const SectionHeader = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  cursor: "pointer",
  backgroundColor: "#1a1a1a",
  "&:hover": {
    backgroundColor: "#1e1e1e",
  },
});

const SectionTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: "#666",
  textTransform: "uppercase",
});

const SectionContent = styled(Box)({
  padding: "8px 12px",
});

const FilterGroup = styled(Box)({
  marginBottom: 12,
});

const FilterGroupTitle = styled(Typography)({
  fontSize: 9,
  fontWeight: 600,
  color: "#555",
  textTransform: "uppercase",
  marginBottom: 8,
  paddingLeft: 2,
});

// Navigator styled components
const NavigatorContainer = styled(Box)({
  height: 100,
  backgroundColor: "#0a0a0a",
  borderRadius: 4,
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const NavigatorThumbnail = styled("img")({
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
  display: "block",
});

const NavigatorViewportRect = styled(Box)({
  position: "absolute",
  border: "1.5px solid #19abb5",
  backgroundColor: "rgba(25, 171, 181, 0.25)",
  pointerEvents: "none",
  boxSizing: "border-box",
});

const NavigatorZoomDisplay = styled(Typography)({
  position: "absolute",
  bottom: 4,
  right: 6,
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  color: "#888",
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  padding: "1px 4px",
  borderRadius: 2,
});

// Annotation List styled components
const AnnotationItem = styled(Box)({
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

const AnnotationIcon = styled(Box)<{ type: string }>(({ type }) => {
  const colors: Record<string, string> = {
    rectangle: "#c45c5c",
    circle: "#5a9a6b",
    arrow: "#5a7fbf",
  };
  return {
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: colors[type] || "#666",
    color: "#fff",
    fontSize: 12,
  };
});

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = "single" | "side-by-side" | "split";
type AnnotationTool = "rectangle" | "circle" | "arrow" | null;

// Transform state for undo/redo history
interface TransformState {
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

const MAX_HISTORY_DEPTH = 50;

// Annotation interface with coordinates relative to image dimensions (0-1 normalized)
interface ImageAnnotation {
  id: string;
  type: "rectangle" | "circle" | "arrow";
  // All coordinates are normalized (0-1 range relative to image dimensions)
  x: number; // Left edge for rect/circle, start point for arrow
  y: number; // Top edge for rect/circle, start point for arrow
  width: number; // Width for rect/circle, end x offset for arrow
  height: number; // Height for rect/circle, end y offset for arrow
}

// Placeholder users for random assignment when creating annotations
const PLACEHOLDER_USERS = [
  { userId: "user-sarah", userDisplayName: "Sarah" },
  { userId: "user-mike", userDisplayName: "Mike" },
  { userId: "user-jen", userDisplayName: "Jen" },
];

interface ImageFilters {
  // Basic
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  // Color
  temperature: number;
  tint: number;
  vibrance: number;
  saturation: number;
  // Detail
  clarity: number;
  sharpness: number;
  noiseReduction: number;
}

const defaultFilters: ImageFilters = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  sharpness: 0,
  noiseReduction: 0,
};

// ============================================================================
// MOCK DATA
// ============================================================================

const imageFiles: (FileItem & {
  format?: string;
  gps?: string | null;
  dimensions?: string;
})[] = [
  {
    id: "i1",
    type: "image",
    fileName: "pexels-jmark-250591.jpg",
    thumbnailUrl: "/images/pexels-jmark-250591.jpg",
    capturedAt: Date.now() - 7200000,
    user: "Mike",
    deviceInfo: "Canon EOS R5",
    flagCount: 2,
    hasFindings: true,
    format: "JPEG / sRGB",
    gps: "40.71°N, 74.00°W",
    dimensions: "4000 x 2667",
  },
  {
    id: "i2",
    type: "image",
    fileName: "pexels-mahima-518693-1250260.jpg",
    thumbnailUrl: "/images/pexels-mahima-518693-1250260.jpg",
    capturedAt: Date.now() - 6800000,
    user: "Sarah",
    deviceInfo: "Sony A7IV",
    flagCount: 0,
    hasFindings: false,
    format: "JPEG / sRGB",
    gps: "34.05°N, 118.24°W",
    dimensions: "5472 x 3648",
  },
  {
    id: "i3",
    type: "image",
    fileName: "pexels-minan1398-906150.jpg",
    thumbnailUrl: "/images/pexels-minan1398-906150.jpg",
    capturedAt: Date.now() - 6400000,
    user: "Jen",
    deviceInfo: "Nikon Z6",
    flagCount: 1,
    hasFindings: true,
    format: "JPEG / sRGB",
    gps: "51.50°N, 0.12°W",
    dimensions: "6000 x 4000",
  },
  {
    id: "i4",
    type: "image",
    fileName: "pexels-philippedonn-1133957.jpg",
    thumbnailUrl: "/images/pexels-philippedonn-1133957.jpg",
    capturedAt: Date.now() - 6000000,
    user: "Mike",
    deviceInfo: "iPhone 15 Pro",
    flagCount: 0,
    hasFindings: false,
    format: "JPEG / P3",
    gps: "48.85°N, 2.35°E",
    dimensions: "4032 x 3024",
  },
  {
    id: "i5",
    type: "image",
    fileName: "pexels-pixabay-158063.jpg",
    thumbnailUrl: "/images/pexels-pixabay-158063.jpg",
    capturedAt: Date.now() - 5600000,
    user: "Sarah",
    deviceInfo: "Canon EOS R5",
    flagCount: 3,
    hasFindings: true,
    format: "JPEG / sRGB",
    gps: "35.68°N, 139.76°E",
    dimensions: "5184 x 3456",
  },
  {
    id: "i6",
    type: "image",
    fileName: "pexels-pixabay-259915.jpg",
    thumbnailUrl: "/images/pexels-pixabay-259915.jpg",
    capturedAt: Date.now() - 5200000,
    user: "Jen",
    deviceInfo: "Fujifilm X-T5",
    flagCount: 0,
    hasFindings: false,
    format: "JPEG / sRGB",
    gps: null,
    dimensions: "4896 x 3264",
  },
  {
    id: "i7",
    type: "image",
    fileName: "pexels-pixabay-459335.jpg",
    thumbnailUrl: "/images/pexels-pixabay-459335.jpg",
    capturedAt: Date.now() - 4800000,
    user: "Mike",
    deviceInfo: "Sony A7IV",
    flagCount: 1,
    hasFindings: true,
    format: "JPEG / sRGB",
    gps: "37.77°N, 122.41°W",
    dimensions: "5760 x 3840",
  },
  {
    id: "i8",
    type: "image",
    fileName: "pexels-pixabay-68507.jpg",
    thumbnailUrl: "/images/pexels-pixabay-68507.jpg",
    capturedAt: Date.now() - 4400000,
    user: "Sarah",
    deviceInfo: "Nikon Z6",
    flagCount: 2,
    hasFindings: true,
    format: "JPEG / sRGB",
    gps: "41.90°N, 12.49°E",
    dimensions: "4288 x 2848",
  },
  {
    id: "i9",
    type: "image",
    fileName: "pexels-soldiervip-1386604.jpg",
    thumbnailUrl: "/images/pexels-soldiervip-1386604.jpg",
    capturedAt: Date.now() - 4000000,
    user: "Jen",
    deviceInfo: "Canon EOS R5",
    flagCount: 0,
    hasFindings: false,
    format: "JPEG / sRGB",
    gps: "52.52°N, 13.40°E",
    dimensions: "6000 x 4000",
  },
];

// ============================================================================
// NAVIGATOR COMPONENT
// ============================================================================

interface NavigatorProps {
  imageUrl: string | null;
  zoom: number;
  panOffset: { x: number; y: number };
  containerDimensions: { width: number; height: number } | null;
  actualDimensions: { width: number; height: number } | null;
  onPanChange: (x: number, y: number) => void;
  calculateFitScale: () => number;
}

const Navigator: React.FC<NavigatorProps> = ({
  imageUrl,
  zoom,
  panOffset,
  containerDimensions,
  actualDimensions,
  onPanChange,
  calculateFitScale,
}) => {
  const navigatorRef = useRef<HTMLDivElement>(null);
  const thumbnailRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnailRect, setThumbnailRect] = useState<{
    width: number;
    height: number;
    left: number;
    top: number;
  } | null>(null);

  // Update thumbnail rect when image loads or container resizes
  useEffect(() => {
    if (thumbnailRef.current && navigatorRef.current) {
      const updateRect = () => {
        if (thumbnailRef.current && navigatorRef.current) {
          const navRect = navigatorRef.current.getBoundingClientRect();
          const thumbRect = thumbnailRef.current.getBoundingClientRect();
          setThumbnailRect({
            width: thumbRect.width,
            height: thumbRect.height,
            left: thumbRect.left - navRect.left,
            top: thumbRect.top - navRect.top,
          });
        }
      };

      // Update on load
      if (thumbnailRef.current.complete) {
        updateRect();
      } else {
        thumbnailRef.current.onload = updateRect;
      }

      // Also update on resize
      const resizeObserver = new ResizeObserver(updateRect);
      resizeObserver.observe(navigatorRef.current);

      return () => resizeObserver.disconnect();
    }
  }, [imageUrl]);

  // Calculate viewport rectangle position and size
  const getViewportRect = useCallback(() => {
    if (!thumbnailRect || !actualDimensions || !containerDimensions) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    const fitScale = calculateFitScale();
    const actualScale = fitScale * (zoom / 100);

    // Calculate image display size at current zoom
    const imageDisplayWidth = actualDimensions.width * actualScale;
    const imageDisplayHeight = actualDimensions.height * actualScale;

    // Calculate what portion of the image is visible (0-1 range)
    const visibleWidthRatio = Math.min(
      1,
      containerDimensions.width / imageDisplayWidth,
    );
    const visibleHeightRatio = Math.min(
      1,
      containerDimensions.height / imageDisplayHeight,
    );

    // Calculate the center offset as a ratio of total image size
    // panOffset is relative to centered position
    const panXRatio = -panOffset.x / imageDisplayWidth;
    const panYRatio = -panOffset.y / imageDisplayHeight;

    // Viewport rect in thumbnail coordinates
    const rectWidth = thumbnailRect.width * visibleWidthRatio;
    const rectHeight = thumbnailRect.height * visibleHeightRatio;

    // Center position plus pan offset
    const centerX = thumbnailRect.left + thumbnailRect.width / 2;
    const centerY = thumbnailRect.top + thumbnailRect.height / 2;

    const rectLeft = centerX - rectWidth / 2 + panXRatio * thumbnailRect.width;
    const rectTop = centerY - rectHeight / 2 + panYRatio * thumbnailRect.height;

    return {
      left: Math.max(
        thumbnailRect.left,
        Math.min(
          rectLeft,
          thumbnailRect.left + thumbnailRect.width - rectWidth,
        ),
      ),
      top: Math.max(
        thumbnailRect.top,
        Math.min(
          rectTop,
          thumbnailRect.top + thumbnailRect.height - rectHeight,
        ),
      ),
      width: rectWidth,
      height: rectHeight,
    };
  }, [
    thumbnailRect,
    actualDimensions,
    containerDimensions,
    zoom,
    panOffset,
    calculateFitScale,
  ]);

  // Handle click/drag on navigator
  const handleNavigatorInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (
        !navigatorRef.current ||
        !thumbnailRect ||
        !actualDimensions ||
        !containerDimensions
      )
        return;

      const navRect = navigatorRef.current.getBoundingClientRect();
      const clickX = clientX - navRect.left;
      const clickY = clientY - navRect.top;

      // Calculate where we clicked relative to thumbnail center (as ratio)
      const thumbCenterX = thumbnailRect.left + thumbnailRect.width / 2;
      const thumbCenterY = thumbnailRect.top + thumbnailRect.height / 2;

      const clickOffsetRatioX = (clickX - thumbCenterX) / thumbnailRect.width;
      const clickOffsetRatioY = (clickY - thumbCenterY) / thumbnailRect.height;

      // Calculate the actual pan offset needed
      const fitScale = calculateFitScale();
      const actualScale = fitScale * (zoom / 100);
      const imageDisplayWidth = actualDimensions.width * actualScale;
      const imageDisplayHeight = actualDimensions.height * actualScale;

      // Convert click ratio to pan offset
      const newPanX = -clickOffsetRatioX * imageDisplayWidth;
      const newPanY = -clickOffsetRatioY * imageDisplayHeight;

      // Constrain pan to valid range
      const maxPanX = Math.max(
        0,
        (imageDisplayWidth - containerDimensions.width) / 2,
      );
      const maxPanY = Math.max(
        0,
        (imageDisplayHeight - containerDimensions.height) / 2,
      );

      const constrainedPanX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
      const constrainedPanY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));

      onPanChange(constrainedPanX, constrainedPanY);
    },
    [
      thumbnailRect,
      actualDimensions,
      containerDimensions,
      zoom,
      calculateFitScale,
      onPanChange,
    ],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      handleNavigatorInteraction(e.clientX, e.clientY);
    },
    [handleNavigatorInteraction],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        handleNavigatorInteraction(e.clientX, e.clientY);
      }
    },
    [isDragging, handleNavigatorInteraction],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global mouse listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const viewportRect = getViewportRect();
  const showViewportRect =
    imageUrl &&
    thumbnailRect &&
    viewportRect.width > 0 &&
    viewportRect.height > 0;
  // Only show viewport rect if it doesn't cover the entire thumbnail (i.e., we're zoomed in)
  const isZoomedIn =
    showViewportRect &&
    (viewportRect.width < thumbnailRect!.width - 2 ||
      viewportRect.height < thumbnailRect!.height - 2);

  return (
    <NavigatorContainer
      ref={navigatorRef}
      onMouseDown={imageUrl ? handleMouseDown : undefined}
      sx={{
        cursor: imageUrl ? (isDragging ? "grabbing" : "crosshair") : "default",
      }}
    >
      {!imageUrl ? (
        <Typography sx={{ fontSize: 10, color: "#444" }}>
          No image loaded
        </Typography>
      ) : (
        <>
          <NavigatorThumbnail
            ref={thumbnailRef}
            src={imageUrl}
            alt="Navigator thumbnail"
            draggable={false}
          />
          {isZoomedIn && (
            <NavigatorViewportRect
              sx={{
                left: viewportRect.left,
                top: viewportRect.top,
                width: viewportRect.width,
                height: viewportRect.height,
              }}
            />
          )}
          <NavigatorZoomDisplay>{Math.round(zoom)}%</NavigatorZoomDisplay>
        </>
      )}
    </NavigatorContainer>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ImageToolProps {
  investigationId?: string;
}

export const ImageTool: React.FC<ImageToolProps> = ({ investigationId }) => {
  const [selectedFile, setSelectedFile] = useState<
    (typeof imageFiles)[0] | null
  >(null);
  const [loadedImage, setLoadedImage] = useState<(typeof imageFiles)[0] | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [activeTool, setActiveTool] = useState<AnnotationTool>(null);
  const [filters, setFilters] = useState<ImageFilters>(defaultFilters);

  // Use store for annotations instead of local state
  const storeAnnotations = useImageToolStore((state) => state.annotations);
  const addAnnotation = useImageToolStore((state) => state.addAnnotation);
  const selectAnnotation = useImageToolStore((state) => state.selectAnnotation);
  const setAnnotationVisibility = useImageToolStore(
    (state) => state.setAnnotationVisibility,
  );
  const selectedAnnotationId = useImageToolStore(
    (state) => state.selectedAnnotationId,
  );
  const storeUndo = useImageToolStore((state) => state.undo);
  const storeRedo = useImageToolStore((state) => state.redo);
  const storeCanUndo = useImageToolStore((state) => state.canUndo);
  const storeCanRedo = useImageToolStore((state) => state.canRedo);
  const clearAnnotations = useImageToolStore((state) => state.clearAnnotations);

  // Drawing state for annotation in progress
  const [isDrawingAnnotation, setIsDrawingAnnotation] = useState(false);
  const [drawingStartPoint, setDrawingStartPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [currentDrawingEnd, setCurrentDrawingEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false); // A/B toggle state

  // Transform state (rotation and flip) - non-destructive, CSS-based
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Undo/redo history for transforms
  const [undoStack, setUndoStack] = useState<TransformState[]>([]);
  const [redoStack, setRedoStack] = useState<TransformState[]>([]);

  // State for actual image dimensions (read from loaded image)
  const [actualDimensions, setActualDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Container dimensions for calculating fit zoom
  const [containerDimensions, setContainerDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Zoom state - stored as percentage relative to fit-to-window (100 = fit, 200 = 2x fit size)
  // 100% is the baseline where the image perfectly fits the viewable area
  const [zoom, setZoom] = useState<number>(100);

  // Pan state - offset in pixels from centered position
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Last zoom-in point (in image pixel coordinates, for Alt+double-click zoom out)
  const [lastZoomInPoint, setLastZoomInPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Marquee zoom state
  const [isMarqueeModeActive, setIsMarqueeModeActive] = useState(false);
  const [isMarqueeDrawing, setIsMarqueeDrawing] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isCtrlHeld, setIsCtrlHeld] = useState(false);

  // Press-and-hold zoom refs
  const zoomIntervalRef = useRef<number | null>(null);
  const zoomAccelerationRef = useRef<number>(1);

  // Live position refs for instant response during drag (bypass React batching)
  const panLiveRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const splitPositionLiveRef = useRef<number>(50);
  const marqueeLiveRef = useRef<{
    start: { x: number; y: number } | null;
    end: { x: number; y: number } | null;
  }>({ start: null, end: null });

  // DOM refs for direct manipulation during drag
  const imageRef = useRef<HTMLImageElement>(null);
  const splitImageRef = useRef<HTMLImageElement>(null);
  const splitOriginalImageRef = useRef<HTMLImageElement>(null);
  const splitOriginalWrapperRef = useRef<HTMLDivElement>(null);
  const splitDividerRef = useRef<HTMLDivElement>(null);
  const marqueeOverlayRef = useRef<HTMLDivElement>(null);

  // Zoom constants - 100% = fit-to-window, can only zoom IN from there
  // Industry-standard non-linear zoom steps (like Photoshop)
  const ZOOM_STEPS = [100, 110, 125, 150, 175, 200, 250, 300, 400];
  const ZOOM_MIN = ZOOM_STEPS[0]; // Minimum is fit-to-window (100%)
  const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1]; // Maximum is 400%

  // Get the next zoom step up from current zoom
  const getNextZoomStep = useCallback((currentZoom: number): number => {
    for (const step of ZOOM_STEPS) {
      if (step > currentZoom) {
        return step;
      }
    }
    return ZOOM_MAX;
  }, []);

  // Get the next zoom step down from current zoom
  const getPrevZoomStep = useCallback((currentZoom: number): number => {
    for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
      if (ZOOM_STEPS[i] < currentZoom) {
        return ZOOM_STEPS[i];
      }
    }
    return ZOOM_MIN;
  }, []);

  // Section collapse states
  const [navigatorCollapsed, setNavigatorCollapsed] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [annotationsCollapsed, setAnnotationsCollapsed] = useState(false);

  // Filter visibility by user (based on placeholder users)
  const [userVisibility, setUserVisibility] = useState<Record<string, boolean>>(
    () =>
      PLACEHOLDER_USERS.reduce(
        (acc, user) => ({ ...acc, [user.userDisplayName]: true }),
        {} as Record<string, boolean>,
      ),
  );

  // File drop zone state
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Toast notification state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  const loadedFileId = useNavigationStore((state) => state.loadedFiles.images);
  const setLoadedFile = useNavigationStore((state) => state.setLoadedFile);

  // Load image when navigated to
  useEffect(() => {
    if (loadedFileId) {
      const file = imageFiles.find((f) => f.id === loadedFileId);
      if (file) {
        setLoadedImage(file);
        setSelectedFile(file);
        setFilters(defaultFilters);
      }
    }
  }, [loadedFileId]);

  const handleDoubleClick = useCallback(
    (item: (typeof imageFiles)[0]) => {
      setLoadedImage(item);
      setSelectedFile(item);
      setFilters(defaultFilters);
      setActualDimensions(null); // Reset until image loads
      // Reset zoom and pan for new image - 100% = fit-to-window
      setZoom(100);
      setPanOffset({ x: 0, y: 0 });
      // Reset zoom tracking state
      setLastZoomInPoint(null);
      setIsMarqueeModeActive(false);
      setIsMarqueeDrawing(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      // Reset transforms for new image
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      // Clear history stacks for new image
      setUndoStack([]);
      setRedoStack([]);
      // Clear annotations from store for new image
      clearAnnotations();
      setActiveTool(null);
      // Persist loaded file ID in navigation store
      setLoadedFile("images", item.id);
    },
    [setLoadedFile, clearAnnotations],
  );

  const handleViewModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: ViewMode | null,
  ) => {
    if (newMode) {
      setViewMode(newMode);
      // Reset zoom and pan when switching view modes - 100% = fit-to-window
      setZoom(100);
      setPanOffset({ x: 0, y: 0 });
      // Reset zoom tracking state
      setLastZoomInPoint(null);
      setIsMarqueeModeActive(false);
      setIsMarqueeDrawing(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }
  };

  // Calculate the scale factor that makes the image fit in the container (0-1 range)
  // Accounts for rotation: when rotated 90° or 270°, width and height are effectively swapped
  const calculateFitScale = useCallback(() => {
    if (!actualDimensions || !containerDimensions) return 1;
    // When rotated 90° or 270°, the image's effective dimensions are swapped
    const isRotated90or270 = rotation === 90 || rotation === 270;
    const effectiveWidth = isRotated90or270
      ? actualDimensions.height
      : actualDimensions.width;
    const effectiveHeight = isRotated90or270
      ? actualDimensions.width
      : actualDimensions.height;
    const scaleX = containerDimensions.width / effectiveWidth;
    const scaleY = containerDimensions.height / effectiveHeight;
    return Math.min(scaleX, scaleY);
  }, [actualDimensions, containerDimensions, rotation]);

  // Get the actual scale to apply to the image
  // zoom = 100 means fit-to-window, zoom = 200 means 2x the fit size
  const getActualScale = useCallback(() => {
    const fitScale = calculateFitScale();
    return fitScale * (zoom / 100);
  }, [zoom, calculateFitScale]);

  // Get the display zoom percentage (same as zoom value)
  // This is what users see: 100% = fit, 150% = 1.5x fit size
  const getDisplayZoom = useCallback(() => {
    return zoom;
  }, [zoom]);

  // Zoom in to next step (up to 400%)
  const handleZoomIn = useCallback(() => {
    if (zoom >= ZOOM_MAX) return;
    const newZoom = getNextZoomStep(zoom);
    setZoom(newZoom);
    // Reset pan when zooming - will be recalculated based on constraints
    setPanOffset({ x: 0, y: 0 });
  }, [zoom, getNextZoomStep]);

  // Zoom out to previous step (stops at 100% = fit-to-window)
  const handleZoomOut = useCallback(() => {
    if (zoom <= ZOOM_MIN) return;
    const newZoom = getPrevZoomStep(zoom);
    setZoom(newZoom);
    // Reset pan when zooming
    setPanOffset({ x: 0, y: 0 });
  }, [zoom, getPrevZoomStep]);

  // Set zoom to fit image in container (100%)
  const handleFitToView = useCallback(() => {
    setZoom(100);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Stop continuous zoom (clears interval and resets acceleration)
  const stopContinuousZoom = useCallback(() => {
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
    zoomAccelerationRef.current = 1;
  }, []);

  // Start continuous zoom in (press and hold) - moves through zoom steps
  const startContinuousZoomIn = useCallback(() => {
    // Enable for single and split view, not side-by-side
    if (viewMode === "side-by-side" || !loadedImage) return;

    // Initial zoom step
    handleZoomIn();

    // Start interval for continuous zoom through steps (with slight delay between steps)
    zoomIntervalRef.current = window.setInterval(() => {
      setZoom((prevZoom) => {
        // Find next step up from current zoom
        let nextStep = ZOOM_MAX;
        for (const step of ZOOM_STEPS) {
          if (step > prevZoom) {
            nextStep = step;
            break;
          }
        }
        if (nextStep >= ZOOM_MAX) {
          stopContinuousZoom();
        }
        return nextStep;
      });
    }, 250); // 250ms delay between steps for controlled stepping
  }, [viewMode, loadedImage, handleZoomIn, stopContinuousZoom]);

  // Start continuous zoom out (press and hold) - moves through zoom steps
  const startContinuousZoomOut = useCallback(() => {
    // Enable for single and split view, not side-by-side
    if (viewMode === "side-by-side" || !loadedImage) return;

    // Initial zoom step
    handleZoomOut();

    // Start interval for continuous zoom through steps (with slight delay between steps)
    zoomIntervalRef.current = window.setInterval(() => {
      setZoom((prevZoom) => {
        // Find next step down from current zoom
        let nextStep = ZOOM_MIN;
        for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
          if (ZOOM_STEPS[i] < prevZoom) {
            nextStep = ZOOM_STEPS[i];
            break;
          }
        }
        if (nextStep <= ZOOM_MIN) {
          stopContinuousZoom();
          setPanOffset({ x: 0, y: 0 });
        }
        return nextStep;
      });
    }, 250); // 250ms delay between steps for controlled stepping
  }, [viewMode, loadedImage, handleZoomOut, stopContinuousZoom]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (zoomIntervalRef.current) {
        clearInterval(zoomIntervalRef.current);
      }
    };
  }, []);

  const handleFilterChange = (key: keyof ImageFilters) => (value: number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  // Helper to push current state to undo stack before making changes
  const pushToUndoStack = useCallback(() => {
    const currentState: TransformState = { rotation, flipH, flipV };
    setUndoStack((prev) => {
      const newStack = [...prev, currentState];
      // Limit to MAX_HISTORY_DEPTH
      if (newStack.length > MAX_HISTORY_DEPTH) {
        return newStack.slice(-MAX_HISTORY_DEPTH);
      }
      return newStack;
    });
    // Clear redo stack when making a new edit
    setRedoStack([]);
  }, [rotation, flipH, flipV]);

  // Transform handlers - instant, CSS-based transforms
  const handleRotateCW = useCallback(() => {
    pushToUndoStack();
    setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  }, [pushToUndoStack]);

  const handleRotateCCW = useCallback(() => {
    pushToUndoStack();
    setRotation((prev) => ((prev - 90 + 360) % 360) as 0 | 90 | 180 | 270);
  }, [pushToUndoStack]);

  const handleFlipH = useCallback(() => {
    pushToUndoStack();
    setFlipH((prev) => !prev);
  }, [pushToUndoStack]);

  const handleFlipV = useCallback(() => {
    pushToUndoStack();
    setFlipV((prev) => !prev);
  }, [pushToUndoStack]);

  // Undo handler - pops from undo stack, pushes current state to redo stack
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    // Push current state to redo stack
    const currentState: TransformState = { rotation, flipH, flipV };
    setRedoStack((prev) => [...prev, currentState]);

    // Pop from undo stack and apply
    const newUndoStack = [...undoStack];
    const previousState = newUndoStack.pop();
    setUndoStack(newUndoStack);

    if (previousState) {
      setRotation(previousState.rotation);
      setFlipH(previousState.flipH);
      setFlipV(previousState.flipV);
    }
  }, [undoStack, rotation, flipH, flipV]);

  // Redo handler - pops from redo stack, pushes current state to undo stack
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    // Push current state to undo stack
    const currentState: TransformState = { rotation, flipH, flipV };
    setUndoStack((prev) => [...prev, currentState]);

    // Pop from redo stack and apply
    const newRedoStack = [...redoStack];
    const nextState = newRedoStack.pop();
    setRedoStack(newRedoStack);

    if (nextState) {
      setRotation(nextState.rotation);
      setFlipH(nextState.flipH);
      setFlipV(nextState.flipV);
    }
  }, [redoStack, rotation, flipH, flipV]);

  // Check if undo/redo are available
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // Build CSS transform string for image transforms
  const getImageTransform = useCallback(
    (includeTranslate: boolean = true, x: number = 0, y: number = 0) => {
      const transforms: string[] = [];
      if (includeTranslate) {
        transforms.push(`translate(${x}px, ${y}px)`);
      }
      if (rotation !== 0) {
        transforms.push(`rotate(${rotation}deg)`);
      }
      if (flipH) {
        transforms.push("scaleX(-1)");
      }
      if (flipV) {
        transforms.push("scaleY(-1)");
      }
      return transforms.length > 0 ? transforms.join(" ") : "none";
    },
    [rotation, flipH, flipV],
  );

  // Build CSS filter string for exposure, contrast, and color adjustments
  // Exposure slider: -5 to +5 → brightness 0.5 to 1.5
  // Contrast slider: -100 to +100 → contrast 0.5 to 1.5
  // Saturation slider: -100 to +100 → saturate 0 to 2
  // Vibrance slider: -100 to +100 → saturate 0.5 to 1.5 (subtler)
  // Temperature slider: -100 to +100 → warm (sepia + hue shift) or cool (hue shift to blue)
  // Tint slider: -100 to +100 → hue-rotate -30deg to +30deg
  const getImageFilter = useCallback(() => {
    const cssFilters: string[] = [];

    // Convert exposure (-5 to +5) to brightness (0.5 to 1.5)
    // 0 → 1, -5 → 0.5, +5 → 1.5
    if (filters.exposure !== 0) {
      const brightness = 1 + filters.exposure / 10;
      cssFilters.push(`brightness(${brightness})`);
    }

    // Convert contrast (-100 to +100) to contrast (0.5 to 1.5)
    // 0 → 1, -100 → 0.5, +100 → 1.5
    if (filters.contrast !== 0) {
      const contrast = 1 + filters.contrast / 200;
      cssFilters.push(`contrast(${contrast})`);
    }

    // Convert saturation (-100 to +100) to saturate (0 to 2)
    // 0 → 1, -100 → 0 (grayscale), +100 → 2 (vivid)
    if (filters.saturation !== 0) {
      const saturate = 1 + filters.saturation / 100;
      cssFilters.push(`saturate(${saturate})`);
    }

    // Convert vibrance (-100 to +100) to saturate (0.5 to 1.5)
    // Vibrance is a subtler version of saturation
    // 0 → 1, -100 → 0.5, +100 → 1.5
    if (filters.vibrance !== 0) {
      const vibranceSaturate = 1 + filters.vibrance / 200;
      cssFilters.push(`saturate(${vibranceSaturate})`);
    }

    // Convert temperature (-100 to +100) to warm/cool color shift
    // Warm (positive): add sepia and shift hue toward orange
    // Cool (negative): shift hue toward blue
    if (filters.temperature !== 0) {
      if (filters.temperature > 0) {
        // Warm: sepia (0 to 0.3) + hue-rotate toward orange (-10deg)
        const sepia = (filters.temperature / 100) * 0.3;
        const hueShift = (filters.temperature / 100) * -10;
        cssFilters.push(`sepia(${sepia})`);
        cssFilters.push(`hue-rotate(${hueShift}deg)`);
      } else {
        // Cool: shift hue toward blue (up to 30deg)
        const hueShift = (filters.temperature / 100) * -30;
        cssFilters.push(`hue-rotate(${hueShift}deg)`);
      }
    }

    // Convert tint (-100 to +100) to hue-rotate (-30deg to +30deg)
    // Shifts the entire color spectrum
    if (filters.tint !== 0) {
      const tintHueRotate = (filters.tint / 100) * 30;
      cssFilters.push(`hue-rotate(${tintHueRotate}deg)`);
    }

    return cssFilters.length > 0 ? cssFilters.join(" ") : "none";
  }, [
    filters.exposure,
    filters.contrast,
    filters.saturation,
    filters.vibrance,
    filters.temperature,
    filters.tint,
  ]);

  // Toggle annotation visibility using store
  const toggleAnnotationVisibility = useCallback(
    (id: string) => {
      const annotation = storeAnnotations.find((a) => a.id === id);
      if (annotation) {
        setAnnotationVisibility(id, !annotation.visible);
      }
    },
    [storeAnnotations, setAnnotationVisibility],
  );

  const toggleUserVisibility = (user: string) => {
    setUserVisibility((prev) => ({ ...prev, [user]: !prev[user] }));
  };

  // Get unique users from placeholder users (not derived from annotations)
  const getUniqueUsers = () => {
    return PLACEHOLDER_USERS.map((u) => u.userDisplayName);
  };

  // Helper to get a random placeholder user
  const getRandomUser = () => {
    const randomIndex = Math.floor(Math.random() * PLACEHOLDER_USERS.length);
    return PLACEHOLDER_USERS[randomIndex];
  };

  // ============================================================================
  // FILE DROP ZONE HANDLERS
  // ============================================================================

  // Show toast notification
  const showToast = useCallback(
    (
      message: string,
      severity: "success" | "error" | "info" | "warning" = "info",
    ) => {
      setToast({ open: true, message, severity });
    },
    [],
  );

  // Close toast
  const handleCloseToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  // Process dropped/imported image file
  const processImageFile = useCallback(
    (file: File) => {
      if (!isFileType(file, "image")) {
        showToast(getFileTypeErrorMessage("image"), "error");
        return;
      }

      // Try to generate test metadata in development mode
      const testMetadata = generateTestMetadataIfDev(file);

      // Create a mock image item from the imported file (Quick Analysis Mode)
      // Use test metadata if available (dev mode), otherwise use defaults
      const mockItem = {
        id: testMetadata?.id || `import-${Date.now()}`,
        type: "image" as const,
        fileName: file.name,
        capturedAt: testMetadata?.timestamp.getTime() || Date.now(),
        user: testMetadata?.user || "Imported",
        deviceInfo: testMetadata?.deviceId || "Imported File",
        format: file.type || "image/unknown",
        dimensions: "4000 x 3000",
        flagCount: 0,
        gps: testMetadata?.gpsCoordinates
          ? formatGPSCoordinates(testMetadata.gpsCoordinates)
          : null,
      };

      setLoadedImage(mockItem);
      setSelectedFile(mockItem);
      setFilters(defaultFilters);
      // Reset transforms for new image
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      // Clear history stacks for new image
      setUndoStack([]);
      setRedoStack([]);
      // Clear annotations from store for new image
      clearAnnotations();
      setActiveTool(null);
      // Reset zoom and pan
      setZoom(100);
      setPanOffset({ x: 0, y: 0 });
      showToast(`Loaded: ${file.name}`, "success");
    },
    [showToast, clearAnnotations],
  );

  // Handle file drag enter
  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsFileDragOver(true);
    }
  }, []);

  // Handle file drag leave
  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);
  }, []);

  // Handle file drag over
  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  // Handle file drop
  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsFileDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processImageFile(files[0]);
      }
    },
    [processImageFile],
  );

  // Handle Import button click
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        processImageFile(files[0]);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processImageFile],
  );

  // Handle drop zone click
  const handleDropZoneClick = useCallback((e: React.MouseEvent) => {
    // Open the file picker
    fileInputRef.current?.click();
    // Stop propagation to prevent parent handlers from triggering (e.g., fullscreen exit)
    e.stopPropagation();
  }, []);

  // Handle image load to read actual dimensions
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setActualDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    },
    [],
  );

  // Get the image URL - could be thumbnailUrl for mock data or direct URL for imported files
  const getImageUrl = (file: (typeof imageFiles)[0]) => {
    // For mock data, thumbnailUrl points to the actual image
    return file.thumbnailUrl || "";
  };

  // Track container dimensions for fit zoom calculation
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setContainerDimensions({ width: rect.width, height: rect.height });
    };

    // Initial measurement
    updateDimensions();

    // Use ResizeObserver to track container size changes
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate image dimensions at current zoom
  const getImageDisplaySize = useCallback(() => {
    if (!actualDimensions) return { width: 0, height: 0 };
    const actualScale = getActualScale();
    return {
      width: actualDimensions.width * actualScale,
      height: actualDimensions.height * actualScale,
    };
  }, [actualDimensions, getActualScale]);

  // Check if image is larger than container (panning allowed)
  const canPan = useCallback(() => {
    if (!containerDimensions) return false;
    const imageSize = getImageDisplaySize();
    return (
      imageSize.width > containerDimensions.width ||
      imageSize.height > containerDimensions.height
    );
  }, [containerDimensions, getImageDisplaySize]);

  // Calculate pan constraints to keep image filling the viewport
  const calculatePanConstraints = useCallback(() => {
    if (!containerDimensions) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const imageSize = getImageDisplaySize();

    // Calculate how much the image exceeds the container in each direction
    const excessWidth = Math.max(
      0,
      imageSize.width - containerDimensions.width,
    );
    const excessHeight = Math.max(
      0,
      imageSize.height - containerDimensions.height,
    );

    // Pan constraints: image edges must not go past container edges
    // When centered, pan is 0. Max pan is half the excess (can pan left or right)
    return {
      minX: -excessWidth / 2,
      maxX: excessWidth / 2,
      minY: -excessHeight / 2,
      maxY: excessHeight / 2,
    };
  }, [containerDimensions, getImageDisplaySize]);

  // Constrain pan offset to valid range
  const constrainPan = useCallback(
    (x: number, y: number) => {
      const constraints = calculatePanConstraints();
      return {
        x: Math.max(constraints.minX, Math.min(constraints.maxX, x)),
        y: Math.max(constraints.minY, Math.min(constraints.maxY, y)),
      };
    },
    [calculatePanConstraints],
  );

  // Convert screen coordinates to image pixel coordinates
  const screenToImageCoords = useCallback(
    (screenX: number, screenY: number) => {
      if (
        !canvasContainerRef.current ||
        !actualDimensions ||
        !containerDimensions
      ) {
        return null;
      }

      const containerRect = canvasContainerRef.current.getBoundingClientRect();
      const imageSize = getImageDisplaySize();

      // Calculate where the image is positioned in the container (centered)
      const imageLeft =
        (containerDimensions.width - imageSize.width) / 2 + panOffset.x;
      const imageTop =
        (containerDimensions.height - imageSize.height) / 2 + panOffset.y;

      // Calculate click position relative to image
      const clickX = screenX - containerRect.left - imageLeft;
      const clickY = screenY - containerRect.top - imageTop;

      // Convert to image pixel coordinates (0-1 normalized)
      const normalizedX = clickX / imageSize.width;
      const normalizedY = clickY / imageSize.height;

      // Check if click is within image bounds
      if (
        normalizedX < 0 ||
        normalizedX > 1 ||
        normalizedY < 0 ||
        normalizedY > 1
      ) {
        return null;
      }

      // Return actual image pixel coordinates
      return {
        x: normalizedX * actualDimensions.width,
        y: normalizedY * actualDimensions.height,
        normalizedX,
        normalizedY,
      };
    },
    [actualDimensions, containerDimensions, getImageDisplaySize, panOffset],
  );

  // Calculate pan offset to center a specific image point in the viewport
  const calculatePanToCenter = useCallback(
    (imageX: number, imageY: number, newZoom: number) => {
      if (!actualDimensions || !containerDimensions) {
        return { x: 0, y: 0 };
      }

      // Calculate the new fit scale and actual scale
      const fitScale = calculateFitScale();
      const newActualScale = fitScale * (newZoom / 100);

      // New image size at new zoom level
      const newImageWidth = actualDimensions.width * newActualScale;
      const newImageHeight = actualDimensions.height * newActualScale;

      // Normalized position of the target point (0-1)
      const normalizedX = imageX / actualDimensions.width;
      const normalizedY = imageY / actualDimensions.height;

      // Position of target point in the new zoomed image (from center of image)
      const targetOffsetFromCenterX = (normalizedX - 0.5) * newImageWidth;
      const targetOffsetFromCenterY = (normalizedY - 0.5) * newImageHeight;

      // Pan to center the target point in viewport
      // We need the target point to be at viewport center, so pan is negative of target offset
      const panX = -targetOffsetFromCenterX;
      const panY = -targetOffsetFromCenterY;

      return { x: panX, y: panY };
    },
    [actualDimensions, containerDimensions, calculateFitScale],
  );

  // Handle double-click zoom in/out (centered on clicked point, using zoom steps)
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (
        viewMode !== "single" ||
        !loadedImage ||
        !actualDimensions ||
        !containerDimensions
      )
        return;

      const fitScale = calculateFitScale();

      // Helper to calculate constrained pan for a given zoom level
      const constrainPanForZoom = (
        pan: { x: number; y: number },
        targetZoom: number,
      ) => {
        const newActualScale = fitScale * (targetZoom / 100);
        const newImageWidth = actualDimensions.width * newActualScale;
        const newImageHeight = actualDimensions.height * newActualScale;
        const excessWidth = Math.max(
          0,
          newImageWidth - containerDimensions.width,
        );
        const excessHeight = Math.max(
          0,
          newImageHeight - containerDimensions.height,
        );
        return {
          x: Math.max(-excessWidth / 2, Math.min(excessWidth / 2, pan.x)),
          y: Math.max(-excessHeight / 2, Math.min(excessHeight / 2, pan.y)),
        };
      };

      // Check if Alt key is held - zoom out to previous step
      if (e.altKey) {
        // Zoom out centered on LAST zoom-in point (or image center if none)
        if (zoom <= ZOOM_MIN) return;

        const newZoom = getPrevZoomStep(zoom);

        if (lastZoomInPoint) {
          // Center on last zoom-in point
          const newPan = calculatePanToCenter(
            lastZoomInPoint.x,
            lastZoomInPoint.y,
            newZoom,
          );
          setZoom(newZoom);
          if (newZoom > ZOOM_MIN) {
            setPanOffset(constrainPanForZoom(newPan, newZoom));
          } else {
            setPanOffset({ x: 0, y: 0 });
          }
        } else {
          // No previous zoom point, zoom out from center
          setZoom(newZoom);
          if (newZoom <= ZOOM_MIN) {
            setPanOffset({ x: 0, y: 0 });
          }
        }
        return;
      }

      // Regular double-click - zoom in to next step centered on clicked point
      if (zoom >= ZOOM_MAX) return;

      const imageCoords = screenToImageCoords(e.clientX, e.clientY);
      if (!imageCoords) return;

      // Store this as the last zoom-in point
      setLastZoomInPoint({ x: imageCoords.x, y: imageCoords.y });

      // Calculate new zoom level - use next zoom step
      const newZoom = getNextZoomStep(zoom);

      // Calculate pan to center on clicked point
      const newPan = calculatePanToCenter(
        imageCoords.x,
        imageCoords.y,
        newZoom,
      );

      setZoom(newZoom);
      setPanOffset(constrainPanForZoom(newPan, newZoom));
    },
    [
      viewMode,
      loadedImage,
      zoom,
      lastZoomInPoint,
      screenToImageCoords,
      calculatePanToCenter,
      actualDimensions,
      containerDimensions,
      calculateFitScale,
      getNextZoomStep,
      getPrevZoomStep,
    ],
  );

  // Track Ctrl key state for marquee zoom and handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in an input field
      const activeElement = document.activeElement;
      const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement &&
          activeElement.isContentEditable);

      if (e.key === "Control" && viewMode === "single" && loadedImage) {
        setIsCtrlHeld(true);
      }
      // Escape key cancels marquee mode and deactivates annotation tools
      if (e.key === "Escape") {
        if (isMarqueeModeActive) {
          setIsMarqueeModeActive(false);
          setIsMarqueeDrawing(false);
          setMarqueeStart(null);
          setMarqueeEnd(null);
        }
        // Deactivate annotation tool
        if (activeTool) {
          setActiveTool(null);
          setIsDrawingAnnotation(false);
          setDrawingStartPoint(null);
          setCurrentDrawingEnd(null);
        }
      }

      // Undo/Redo keyboard shortcuts (only when not typing in text input)
      if (!isTyping && loadedImage) {
        // Ctrl+Z = Undo (both transforms and annotations via store)
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
          e.preventDefault();
          // Use store undo which handles annotation history
          storeUndo();
          handleUndo();
        }
        // Ctrl+Shift+Z = Redo (both transforms and annotations via store)
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") {
          e.preventDefault();
          // Use store redo which handles annotation history
          storeRedo();
          handleRedo();
        }
        // Ctrl+Y = Redo (alternative, common in Windows)
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "y") {
          e.preventDefault();
          storeRedo();
          handleRedo();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") {
        setIsCtrlHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    viewMode,
    loadedImage,
    isMarqueeModeActive,
    activeTool,
    handleUndo,
    handleRedo,
    storeUndo,
    storeRedo,
  ]);

  // Toggle marquee zoom mode (toolbar icon click)
  const toggleMarqueeMode = useCallback(() => {
    setIsMarqueeModeActive((prev) => !prev);
    setIsMarqueeDrawing(false);
    setMarqueeStart(null);
    setMarqueeEnd(null);
  }, []);

  // Calculate marquee rectangle in screen coordinates for display
  const getMarqueeRect = useCallback(() => {
    if (!marqueeStart || !marqueeEnd) return null;

    return {
      left: Math.min(marqueeStart.x, marqueeEnd.x),
      top: Math.min(marqueeStart.y, marqueeEnd.y),
      width: Math.abs(marqueeEnd.x - marqueeStart.x),
      height: Math.abs(marqueeEnd.y - marqueeStart.y),
    };
  }, [marqueeStart, marqueeEnd]);

  // Apply marquee zoom - zoom to fit selected area in viewport
  // Accepts optional start/end coordinates to avoid race conditions with async state updates
  const applyMarqueeZoom = useCallback(
    (
      startCoord?: { x: number; y: number } | null,
      endCoord?: { x: number; y: number } | null,
    ) => {
      // Use provided coordinates or fall back to state
      const start = startCoord ?? marqueeStart;
      const end = endCoord ?? marqueeEnd;

      if (!start || !end || !containerDimensions || !actualDimensions) {
        return;
      }

      const containerRect = canvasContainerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      // Convert screen marquee coordinates to image coordinates
      const imageSize = getImageDisplaySize();
      const imageLeft =
        (containerDimensions.width - imageSize.width) / 2 + panOffset.x;
      const imageTop =
        (containerDimensions.height - imageSize.height) / 2 + panOffset.y;

      // Marquee corners in image-relative coordinates
      const marqueeImageLeft =
        Math.min(start.x, end.x) - containerRect.left - imageLeft;
      const marqueeImageTop =
        Math.min(start.y, end.y) - containerRect.top - imageTop;
      const marqueeImageRight =
        Math.max(start.x, end.x) - containerRect.left - imageLeft;
      const marqueeImageBottom =
        Math.max(start.y, end.y) - containerRect.top - imageTop;

      // Convert to normalized image coordinates (0-1)
      const normalizedLeft = Math.max(0, marqueeImageLeft / imageSize.width);
      const normalizedTop = Math.max(0, marqueeImageTop / imageSize.height);
      const normalizedRight = Math.min(1, marqueeImageRight / imageSize.width);
      const normalizedBottom = Math.min(
        1,
        marqueeImageBottom / imageSize.height,
      );

      // Calculate selection dimensions in image pixels
      const selectionWidth =
        (normalizedRight - normalizedLeft) * actualDimensions.width;
      const selectionHeight =
        (normalizedBottom - normalizedTop) * actualDimensions.height;

      // Minimum selection size check
      if (selectionWidth < 10 || selectionHeight < 10) {
        return;
      }

      // Center of selection in image pixels
      const centerX =
        ((normalizedLeft + normalizedRight) / 2) * actualDimensions.width;
      const centerY =
        ((normalizedTop + normalizedBottom) / 2) * actualDimensions.height;

      // Store as last zoom-in point
      setLastZoomInPoint({ x: centerX, y: centerY });

      // Calculate zoom level to fit selection in viewport
      // First, calculate what zoom would fit the selection width/height
      const fitScale = calculateFitScale();
      const zoomForWidth =
        (containerDimensions.width / selectionWidth / fitScale) * 100;
      const zoomForHeight =
        (containerDimensions.height / selectionHeight / fitScale) * 100;

      // Use the smaller zoom to ensure both dimensions fit, capped at max
      const newZoom = Math.min(Math.min(zoomForWidth, zoomForHeight), ZOOM_MAX);

      // Don't zoom if result would be less than minimum
      if (newZoom < ZOOM_MIN) {
        return;
      }

      // Calculate pan to center on selection center
      const newPan = calculatePanToCenter(centerX, centerY, newZoom);

      // Calculate pan constraints based on NEW zoom level (not current zoom)
      // This is critical - we need to constrain using the new image size
      const newActualScale = fitScale * (newZoom / 100);
      const newImageWidth = actualDimensions.width * newActualScale;
      const newImageHeight = actualDimensions.height * newActualScale;
      const excessWidth = Math.max(
        0,
        newImageWidth - containerDimensions.width,
      );
      const excessHeight = Math.max(
        0,
        newImageHeight - containerDimensions.height,
      );
      const constrainedPan = {
        x: Math.max(-excessWidth / 2, Math.min(excessWidth / 2, newPan.x)),
        y: Math.max(-excessHeight / 2, Math.min(excessHeight / 2, newPan.y)),
      };

      setZoom(newZoom);
      setPanOffset(constrainedPan);

      // Deactivate marquee mode after zoom
      setIsMarqueeModeActive(false);
    },
    [
      marqueeStart,
      marqueeEnd,
      containerDimensions,
      actualDimensions,
      getImageDisplaySize,
      panOffset,
      calculateFitScale,
      calculatePanToCenter,
    ],
  );

  // Handle marquee drawing start (mousedown when Ctrl held or marquee mode active)
  // Uses refs for instant response during drawing
  const handleMarqueeStart = useCallback(
    (e: React.MouseEvent) => {
      if (viewMode !== "single" || !loadedImage) return;
      if (!isMarqueeModeActive && !isCtrlHeld) return;

      // Prevent triggering pan
      e.preventDefault();
      e.stopPropagation();

      // Initialize live ref for instant response
      const startPoint = { x: e.clientX, y: e.clientY };
      marqueeLiveRef.current = { start: startPoint, end: startPoint };

      setIsMarqueeDrawing(true);
      setMarqueeStart(startPoint);
      setMarqueeEnd(startPoint);
    },
    [viewMode, loadedImage, isMarqueeModeActive, isCtrlHeld],
  );

  // Handle marquee drawing (document level)
  // Uses refs and direct DOM manipulation for instant visual feedback
  useEffect(() => {
    if (!isMarqueeDrawing) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      // Update live ref immediately (no React re-render)
      marqueeLiveRef.current.end = { x: e.clientX, y: e.clientY };

      // Apply position directly to DOM element for instant visual feedback
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const { start, end } = marqueeLiveRef.current;
          if (!start || !end || !marqueeOverlayRef.current) return;

          const left = Math.min(start.x, end.x);
          const top = Math.min(start.y, end.y);
          const width = Math.abs(end.x - start.x);
          const height = Math.abs(end.y - start.y);

          marqueeOverlayRef.current.style.left = `${left}px`;
          marqueeOverlayRef.current.style.top = `${top}px`;
          marqueeOverlayRef.current.style.width = `${width}px`;
          marqueeOverlayRef.current.style.height = `${height}px`;
        });
      }
    };

    const handleMouseUp = () => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Get coordinates from ref and apply zoom directly (avoid state race condition)
      const { start, end } = marqueeLiveRef.current;
      if (start && end) {
        // Pass coordinates directly to avoid async state update race condition
        applyMarqueeZoom(start, end);
      }

      // Clean up state
      setIsMarqueeDrawing(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      marqueeLiveRef.current = { start: null, end: null };
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isMarqueeDrawing, applyMarqueeZoom]);

  // Handle pan start (mouse down on image)
  // Uses refs for instant response - no React state updates during drag
  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      // Check for annotation tool first - these take priority (only in single view)
      if (activeTool && viewMode === "single" && loadedImage) {
        const coords = screenToImageCoords(e.clientX, e.clientY);
        if (coords) {
          e.preventDefault();
          setIsDrawingAnnotation(true);
          setDrawingStartPoint({
            x: coords.normalizedX,
            y: coords.normalizedY,
          });
          setCurrentDrawingEnd({
            x: coords.normalizedX,
            y: coords.normalizedY,
          });
        }
        return;
      }

      // Check for marquee mode or Ctrl key first - these take priority (only in single view)
      if (
        (isMarqueeModeActive || isCtrlHeld) &&
        viewMode === "single" &&
        loadedImage
      ) {
        handleMarqueeStart(e);
        return;
      }

      // Enable pan for single and split view, not side-by-side
      if (!canPan() || viewMode === "side-by-side") return;

      e.preventDefault();

      // Initialize live ref with current pan offset
      panLiveRef.current = { x: panOffset.x, y: panOffset.y };

      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panOffset.x,
        panY: panOffset.y,
      };

      // Change cursor for entire document during drag
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    },
    [
      canPan,
      viewMode,
      panOffset,
      isMarqueeModeActive,
      isCtrlHeld,
      loadedImage,
      handleMarqueeStart,
      activeTool,
      screenToImageCoords,
    ],
  );

  // Handle pan move (document level to catch mouse leaving image)
  // Uses refs and direct DOM manipulation for 60fps responsiveness
  useEffect(() => {
    if (!isPanning) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;

      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      const newPan = constrainPan(
        panStartRef.current.panX + deltaX,
        panStartRef.current.panY + deltaY,
      );

      // Update live ref immediately (no React re-render)
      panLiveRef.current = newPan;

      // Apply transform directly to DOM elements for instant visual feedback
      // Use requestAnimationFrame for smooth 60fps updates
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const transform = `translate(${panLiveRef.current.x}px, ${panLiveRef.current.y}px)`;

          // Update single view image
          if (imageRef.current) {
            imageRef.current.style.transform = transform;
          }

          // Update split view images (both layers need same transform for alignment)
          if (splitImageRef.current) {
            splitImageRef.current.style.transform = transform;
          }
          if (splitOriginalImageRef.current) {
            splitOriginalImageRef.current.style.transform = transform;
          }
        });
      }
    };

    const handleMouseUp = () => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Commit final position to React state (single update at end)
      setPanOffset(panLiveRef.current);

      setIsPanning(false);
      panStartRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning, constrainPan]);

  // Handle annotation drawing (mouse move and mouse up)
  useEffect(() => {
    if (!isDrawingAnnotation || !activeTool || !drawingStartPoint) return;

    const handleMouseMove = (e: MouseEvent) => {
      const coords = screenToImageCoords(e.clientX, e.clientY);
      if (coords) {
        setCurrentDrawingEnd({ x: coords.normalizedX, y: coords.normalizedY });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const coords = screenToImageCoords(e.clientX, e.clientY);
      if (coords && drawingStartPoint) {
        // Create the annotation
        const startX = Math.min(drawingStartPoint.x, coords.normalizedX);
        const startY = Math.min(drawingStartPoint.y, coords.normalizedY);
        const endX = Math.max(drawingStartPoint.x, coords.normalizedX);
        const endY = Math.max(drawingStartPoint.y, coords.normalizedY);

        const width =
          activeTool === "arrow"
            ? coords.normalizedX - drawingStartPoint.x
            : endX - startX;
        const height =
          activeTool === "arrow"
            ? coords.normalizedY - drawingStartPoint.y
            : endY - startY;

        // Only add if it has some size
        if (Math.abs(width) > 0.01 || Math.abs(height) > 0.01) {
          // Get a random user for this annotation
          const randomUser = getRandomUser();

          // Create annotation data for the store
          if (activeTool === "rectangle") {
            addAnnotation({
              type: "rectangle",
              x: startX,
              y: startY,
              width: endX - startX,
              height: endY - startY,
              rotation: 0,
              cornerRadius: 0,
              filled: false,
              fillOpacity: 0,
              userId: randomUser.userId,
              userDisplayName: randomUser.userDisplayName,
              color: "#19abb5",
              strokeWidth: 2,
              opacity: 1,
              visible: true,
              locked: false,
            });
          } else if (activeTool === "circle") {
            // Circle uses centerX/centerY and radiusX/radiusY
            const centerX = startX + (endX - startX) / 2;
            const centerY = startY + (endY - startY) / 2;
            const radiusX = (endX - startX) / 2;
            const radiusY = (endY - startY) / 2;
            addAnnotation({
              type: "circle",
              centerX,
              centerY,
              radiusX,
              radiusY,
              filled: false,
              fillOpacity: 0,
              userId: randomUser.userId,
              userDisplayName: randomUser.userDisplayName,
              color: "#19abb5",
              strokeWidth: 2,
              opacity: 1,
              visible: true,
              locked: false,
            });
          } else if (activeTool === "arrow") {
            addAnnotation({
              type: "arrow",
              startX: drawingStartPoint.x,
              startY: drawingStartPoint.y,
              endX: coords.normalizedX,
              endY: coords.normalizedY,
              headSize: 12,
              doubleHeaded: false,
              userId: randomUser.userId,
              userDisplayName: randomUser.userDisplayName,
              color: "#19abb5",
              strokeWidth: 2,
              opacity: 1,
              visible: true,
              locked: false,
            });
          }

          // Deactivate tool after creating annotation (return to pan/select mode)
          setActiveTool(null);
        }
      }

      // Reset drawing state
      setIsDrawingAnnotation(false);
      setDrawingStartPoint(null);
      setCurrentDrawingEnd(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDrawingAnnotation,
    activeTool,
    drawingStartPoint,
    screenToImageCoords,
    addAnnotation,
  ]);

  // Re-constrain pan when zoom changes
  useEffect(() => {
    const constrained = constrainPan(panOffset.x, panOffset.y);
    if (constrained.x !== panOffset.x || constrained.y !== panOffset.y) {
      setPanOffset(constrained);
    }
  }, [zoom, constrainPan, panOffset]);

  // Handle A/B toggle
  const handleABToggle = useCallback(() => {
    setShowOriginal((prev) => !prev);
  }, []);

  // Handle split divider drag start
  // Uses refs and direct DOM manipulation for instant response (no React re-renders during drag)
  const handleSplitDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent selection
      e.stopPropagation();

      // Capture initial values immediately
      const startX = e.clientX;
      const startPos = splitPosition;

      // Initialize live ref
      splitPositionLiveRef.current = splitPosition;

      // Get container rect once at the start for performance
      const container = splitContainerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      // Set visual state for cursor styling
      setIsDraggingSplit(true);

      // Prevent text selection during drag
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";

      let rafId: number | null = null;

      const handleMouseMove = (moveE: MouseEvent) => {
        moveE.preventDefault(); // Prevent selection during drag
        // Use cached rect for immediate response (no DOM query)
        const newPos = Math.max(
          3,
          Math.min(
            97,
            startPos + ((moveE.clientX - startX) / containerRect.width) * 100,
          ),
        );

        // Update live ref immediately (no React re-render)
        splitPositionLiveRef.current = newPos;

        // Apply position directly to DOM elements for instant visual feedback
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            const pos = splitPositionLiveRef.current;

            // Update the divider position
            if (splitDividerRef.current) {
              splitDividerRef.current.style.left = `${pos}%`;
            }

            // Update the original image wrapper clip
            if (splitOriginalWrapperRef.current) {
              splitOriginalWrapperRef.current.style.width = `${pos}%`;
              // Also update the inner container width
              const innerContainer = splitOriginalWrapperRef.current
                .firstElementChild as HTMLElement;
              if (innerContainer) {
                innerContainer.style.width = `${(100 / pos) * 100}%`;
              }
            }
          });
        }
      };

      const handleMouseUp = () => {
        // Cancel any pending RAF
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }

        // Commit final position to React state (single update at end)
        setSplitPosition(splitPositionLiveRef.current);

        setIsDraggingSplit(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [splitPosition],
  );

  // Render placeholder or image
  const renderCanvas = () => {
    if (!loadedImage) {
      return (
        <FileDropZone
          isActive={isFileDragOver}
          onDragEnter={handleFileDragEnter}
          onDragLeave={handleFileDragLeave}
          onDragOver={handleFileDragOver}
          onDrop={handleFileDrop}
          onClick={handleDropZoneClick}
        >
          <ImageIcon
            sx={{ fontSize: 64, mb: 2, opacity: isFileDragOver ? 0.8 : 0.3 }}
          />
          <Typography
            sx={{ fontSize: 14, color: isFileDragOver ? "#19abb5" : "#555" }}
          >
            {isFileDragOver ? "Drop image file here" : "No image loaded"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#444", mt: 0.5 }}>
            {isFileDragOver
              ? "Release to import"
              : "Drag & drop or click to import image files"}
          </Typography>
          <Typography sx={{ fontSize: 10, color: "#333", mt: 1 }}>
            .jpg, .jpeg, .png, .gif, .webp, .tiff, .bmp
          </Typography>
        </FileDropZone>
      );
    }

    const imageUrl = getImageUrl(loadedImage);

    // Get image display size and check if panning is allowed
    const imageSize = getImageDisplaySize();
    const isPannable = canPan();

    // Single view uses absolute positioning with explicit pixel dimensions
    // This allows the image to overflow the container when zoomed in

    // ========== SIDE-BY-SIDE VIEW ==========
    if (viewMode === "side-by-side") {
      return (
        <Box
          sx={{
            display: "flex",
            width: "100%",
            height: "100%",
            gap: 2,
            p: 2,
          }}
        >
          {/* Original side */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <img
              src={imageUrl}
              alt={loadedImage.fileName}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: 2,
                userSelect: "none",
              }}
              onLoad={handleImageLoad}
              draggable={false}
            />
            <ViewLabel position="left">Original</ViewLabel>
          </Box>
          {/* Edited side - shows transforms */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <img
              src={imageUrl}
              alt={loadedImage.fileName}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: 2,
                userSelect: "none",
                transform: getImageTransform(false),
                filter: getImageFilter(),
              }}
              draggable={false}
            />
            <ViewLabel position="right">Edited</ViewLabel>
          </Box>
        </Box>
      );
    }

    // ========== SPLIT VIEW ==========
    // Supports zoom and pan - both layers use identical positioning so they stay aligned
    // The split slider clips the original image at the splitPosition percentage
    if (viewMode === "split") {
      // Check if panning is possible (zoomed past 100%)
      const isPannable = canPan();

      // Determine cursor based on state
      const getSplitCursor = () => {
        if (isPanning) return "grabbing";
        if (isPannable) return "grab";
        return "default";
      };

      return (
        <Box
          ref={splitContainerRef}
          sx={{
            width: "100%",
            height: "100%",
            position: "relative",
            userSelect: isDraggingSplit ? "none" : "auto",
            overflow: "hidden",
            cursor: getSplitCursor(),
          }}
          onMouseDown={handlePanStart}
        >
          {/* Image container - both layers share this transform for synchronized zoom/pan */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none", // Let container handle mouse events
            }}
          >
            {/* EDITED image - base layer (bottom) - ref for direct DOM manipulation during pan */}
            {/* Both images share transforms so they stay aligned for comparison */}
            <img
              ref={splitImageRef}
              src={imageUrl}
              alt={loadedImage.fileName}
              style={{
                width: actualDimensions ? imageSize.width : "100%",
                height: actualDimensions ? imageSize.height : "100%",
                maxWidth: actualDimensions ? "none" : "100%",
                maxHeight: actualDimensions ? "none" : "100%",
                objectFit: actualDimensions ? "fill" : "contain",
                borderRadius: 2,
                userSelect: "none",
                transform: getImageTransform(true, panOffset.x, panOffset.y),
                filter: getImageFilter(),
              }}
              onLoad={handleImageLoad}
              draggable={false}
            />
          </Box>
          {/* ORIGINAL image wrapper - clips at splitPosition% with overflow:hidden */}
          {/* Ref for direct DOM manipulation during split slider drag */}
          <Box
            ref={splitOriginalWrapperRef}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${splitPosition}%`,
              height: "100%",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            {/* Inner container maintains same centering as edited image container */}
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                // Width is scaled to match the original container width
                // e.g., if wrapper is 50% of container, image container needs to be 200% of wrapper
                width: `${(100 / splitPosition) * 100}%`,
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* ORIGINAL image - same size, position, and transform as edited for perfect alignment */}
              {/* Ref for direct DOM manipulation during pan */}
              {/* Both images share transforms so they stay aligned for comparison */}
              <img
                ref={splitOriginalImageRef}
                src={imageUrl}
                alt={loadedImage.fileName}
                style={{
                  width: actualDimensions ? imageSize.width : "100%",
                  height: actualDimensions ? imageSize.height : "100%",
                  maxWidth: actualDimensions ? "none" : "100%",
                  maxHeight: actualDimensions ? "none" : "100%",
                  objectFit: actualDimensions ? "fill" : "contain",
                  borderRadius: 2,
                  userSelect: "none",
                  transform: getImageTransform(true, panOffset.x, panOffset.y),
                }}
                draggable={false}
              />
            </Box>
          </Box>
          {/* ORIGINAL label - top left */}
          <ViewLabel position="left">Original</ViewLabel>
          {/* EDITED label - top right */}
          <ViewLabel position="right">Edited</ViewLabel>
          {/* Full-height draggable divider - ref for direct DOM manipulation during drag */}
          <SplitDivider
            ref={splitDividerRef}
            isDragging={isDraggingSplit}
            sx={{
              left: `${splitPosition}%`,
              transform: "translateX(-50%)",
            }}
            onMouseDown={handleSplitDragStart}
          />
        </Box>
      );
    }

    // ========== SINGLE VIEW ==========
    // Shows ORIGINAL label when A/B toggle is active
    // Supports zoom and pan when image is larger than container

    // Determine cursor based on state
    const getCursor = () => {
      // Annotation tool active - crosshair
      if (activeTool) return "crosshair";
      // Marquee drawing - crosshair
      if (isMarqueeDrawing) return "crosshair";
      // Panning - grabbing hand
      if (isPanning) return "grabbing";
      // Marquee mode active or Ctrl held - crosshair
      if (isMarqueeModeActive || isCtrlHeld) return "crosshair";
      // Can pan (zoomed in) - grab hand
      if (isPannable) return "grab";
      // At fit (100%) - default
      return "default";
    };

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden", // Clip zoomed image at container edges
          cursor: getCursor(),
        }}
        onMouseDown={handlePanStart}
        onDoubleClick={handleCanvasDoubleClick}
      >
        {/* In A/B comparison: showOriginal=true shows original (no transforms), showOriginal=false shows edited (with transforms) */}
        <img
          ref={imageRef}
          src={imageUrl}
          alt={loadedImage.fileName}
          style={{
            width: actualDimensions ? imageSize.width : "100%",
            height: actualDimensions ? imageSize.height : "100%",
            maxWidth: actualDimensions ? "none" : "100%",
            maxHeight: actualDimensions ? "none" : "100%",
            objectFit: actualDimensions ? "fill" : "contain",
            borderRadius: 2,
            userSelect: "none",
            // When showing original (A/B toggle), no transforms. When showing edited, apply transforms.
            transform: showOriginal
              ? `translate(${panOffset.x}px, ${panOffset.y}px)`
              : getImageTransform(true, panOffset.x, panOffset.y),
            // Only apply filters when showing edited view (not original in A/B comparison)
            filter: showOriginal ? "none" : getImageFilter(),
            pointerEvents: "none", // Let container handle mouse events
          }}
          onLoad={handleImageLoad}
          draggable={false}
        />
        {/* Show ORIGINAL label only when A/B toggle is on */}
        {showOriginal && <ViewLabel position="left">Original</ViewLabel>}
        {/* Annotation overlay - renders all store annotations and current drawing */}
        {actualDimensions && (
          <svg
            style={{
              position: "absolute",
              width: imageSize.width,
              height: imageSize.height,
              transform: showOriginal
                ? `translate(${panOffset.x}px, ${panOffset.y}px)`
                : getImageTransform(true, panOffset.x, panOffset.y),
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            {/* Completed annotations from store */}
            {storeAnnotations
              .filter((ann) => ann.visible)
              .map((ann) => {
                if (ann.type === "rectangle") {
                  const x = ann.x * imageSize.width;
                  const y = ann.y * imageSize.height;
                  const width = ann.width * imageSize.width;
                  const height = ann.height * imageSize.height;
                  return (
                    <rect
                      key={ann.id}
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="none"
                      stroke={ann.color || "#19abb5"}
                      strokeWidth={ann.strokeWidth || 2}
                      opacity={ann.opacity || 1}
                    />
                  );
                }
                if (ann.type === "circle") {
                  // Store format uses centerX/centerY and radiusX/radiusY
                  const cx = ann.centerX * imageSize.width;
                  const cy = ann.centerY * imageSize.height;
                  const rx = Math.abs(ann.radiusX * imageSize.width);
                  const ry = Math.abs(ann.radiusY * imageSize.height);
                  return (
                    <ellipse
                      key={ann.id}
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      fill="none"
                      stroke={ann.color || "#19abb5"}
                      strokeWidth={ann.strokeWidth || 2}
                      opacity={ann.opacity || 1}
                    />
                  );
                }
                if (ann.type === "arrow") {
                  // Store format uses startX/startY and endX/endY
                  const x1 = ann.startX * imageSize.width;
                  const y1 = ann.startY * imageSize.height;
                  const x2 = ann.endX * imageSize.width;
                  const y2 = ann.endY * imageSize.height;
                  // Calculate arrow head
                  const dx = x2 - x1;
                  const dy = y2 - y1;
                  const angle = Math.atan2(dy, dx);
                  const headLength = ann.headSize || 12;
                  const headAngle = Math.PI / 6; // 30 degrees
                  const headX1 = x2 - headLength * Math.cos(angle - headAngle);
                  const headY1 = y2 - headLength * Math.sin(angle - headAngle);
                  const headX2 = x2 - headLength * Math.cos(angle + headAngle);
                  const headY2 = y2 - headLength * Math.sin(angle + headAngle);
                  return (
                    <g key={ann.id}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={ann.color || "#19abb5"}
                        strokeWidth={ann.strokeWidth || 2}
                        opacity={ann.opacity || 1}
                      />
                      <line
                        x1={x2}
                        y1={y2}
                        x2={headX1}
                        y2={headY1}
                        stroke={ann.color || "#19abb5"}
                        strokeWidth={ann.strokeWidth || 2}
                        opacity={ann.opacity || 1}
                      />
                      <line
                        x1={x2}
                        y1={y2}
                        x2={headX2}
                        y2={headY2}
                        stroke={ann.color || "#19abb5"}
                        strokeWidth={ann.strokeWidth || 2}
                        opacity={ann.opacity || 1}
                      />
                    </g>
                  );
                }
                return null;
              })}
            {/* Current drawing in progress */}
            {isDrawingAnnotation &&
              drawingStartPoint &&
              currentDrawingEnd &&
              activeTool &&
              (() => {
                const startX =
                  activeTool === "arrow"
                    ? drawingStartPoint.x * imageSize.width
                    : Math.min(drawingStartPoint.x, currentDrawingEnd.x) *
                      imageSize.width;
                const startY =
                  activeTool === "arrow"
                    ? drawingStartPoint.y * imageSize.height
                    : Math.min(drawingStartPoint.y, currentDrawingEnd.y) *
                      imageSize.height;
                const width =
                  activeTool === "arrow"
                    ? (currentDrawingEnd.x - drawingStartPoint.x) *
                      imageSize.width
                    : Math.abs(currentDrawingEnd.x - drawingStartPoint.x) *
                      imageSize.width;
                const height =
                  activeTool === "arrow"
                    ? (currentDrawingEnd.y - drawingStartPoint.y) *
                      imageSize.height
                    : Math.abs(currentDrawingEnd.y - drawingStartPoint.y) *
                      imageSize.height;

                if (activeTool === "rectangle") {
                  return (
                    <rect
                      x={startX}
                      y={startY}
                      width={width}
                      height={height}
                      fill="none"
                      stroke="#19abb5"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  );
                }
                if (activeTool === "circle") {
                  const cx = startX + width / 2;
                  const cy = startY + height / 2;
                  return (
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={width / 2}
                      ry={height / 2}
                      fill="none"
                      stroke="#19abb5"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  );
                }
                if (activeTool === "arrow") {
                  const endX = startX + width;
                  const endY = startY + height;
                  const angle = Math.atan2(height, width);
                  const headLength = 12;
                  const headAngle = Math.PI / 6;
                  const headX1 =
                    endX - headLength * Math.cos(angle - headAngle);
                  const headY1 =
                    endY - headLength * Math.sin(angle - headAngle);
                  const headX2 =
                    endX - headLength * Math.cos(angle + headAngle);
                  const headY2 =
                    endY - headLength * Math.sin(angle + headAngle);
                  return (
                    <g>
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="#19abb5"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                      <line
                        x1={endX}
                        y1={endY}
                        x2={headX1}
                        y2={headY1}
                        stroke="#19abb5"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                      <line
                        x1={endX}
                        y1={endY}
                        x2={headX2}
                        y2={headY2}
                        stroke="#19abb5"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                    </g>
                  );
                }
                return null;
              })()}
          </svg>
        )}
        {/* Marquee selection overlay - uses ref for instant updates during drawing */}
        {isMarqueeDrawing && (
          <Box
            ref={marqueeOverlayRef}
            sx={{
              position: "fixed",
              left: marqueeStart?.x ?? 0,
              top: marqueeStart?.y ?? 0,
              width: 0,
              height: 0,
              border: "2px dashed #19abb5",
              backgroundColor: "rgba(25, 171, 181, 0.1)",
              pointerEvents: "none",
              zIndex: 100,
            }}
          />
        )}
      </Box>
    );
  };

  // Main content
  const mainContent = (
    <MainContainer>
      {/* Toolbar */}
      <Toolbar>
        {/* View Mode Toggle */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            sx={{ fontSize: 10, color: "#666", textTransform: "uppercase" }}
          >
            View:
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <StyledToggleButton value="single">
              <Tooltip title="Single View">
                <ImageIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </StyledToggleButton>
            <StyledToggleButton value="side-by-side">
              <Tooltip title="Side by Side">
                <CompareIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </StyledToggleButton>
            <StyledToggleButton value="split">
              <Tooltip title="Split View">
                <ViewColumnIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </StyledToggleButton>
          </ToggleButtonGroup>
          {/* A/B Toggle - always visible, but only enabled in single view */}
          <Tooltip
            title={
              viewMode !== "single"
                ? "A/B Compare (only available in single view)"
                : showOriginal
                  ? "Viewing Original (click to see Edited)"
                  : "A/B Compare (click to see Original)"
            }
          >
            <span>
              <ToolButton
                size="small"
                active={showOriginal && viewMode === "single"}
                onClick={handleABToggle}
                disabled={!loadedImage || viewMode !== "single"}
                sx={{
                  opacity: viewMode !== "single" ? 0.4 : 1,
                  cursor: viewMode !== "single" ? "not-allowed" : "pointer",
                }}
              >
                <CompareArrowsIcon sx={{ fontSize: 16 }} />
              </ToolButton>
            </span>
          </Tooltip>
        </Box>

        <ToolbarDivider />

        {/* Zoom Controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip
            title={
              viewMode === "side-by-side"
                ? "Zoom Out (not available in side-by-side view)"
                : zoom <= ZOOM_MIN
                  ? "At minimum zoom (100% = fit)"
                  : "Zoom Out (hold for continuous)"
            }
          >
            <span>
              <IconButton
                size="small"
                onMouseDown={(e) => {
                  e.preventDefault();
                  startContinuousZoomOut();
                }}
                onMouseUp={stopContinuousZoom}
                onMouseLeave={stopContinuousZoom}
                disabled={
                  !loadedImage ||
                  viewMode === "side-by-side" ||
                  zoom <= ZOOM_MIN
                }
                sx={{
                  color: zoom <= ZOOM_MIN ? "#444" : "#888",
                  p: 0.5,
                  opacity: viewMode === "side-by-side" ? 0.4 : 1,
                }}
              >
                <ZoomOutIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <ZoomDisplay sx={{ opacity: viewMode === "side-by-side" ? 0.4 : 1 }}>
            {!loadedImage || viewMode === "side-by-side"
              ? "--"
              : `${Math.round(getDisplayZoom())}%`}
          </ZoomDisplay>
          <Tooltip
            title={
              viewMode === "side-by-side"
                ? "Zoom In (not available in side-by-side view)"
                : zoom >= ZOOM_MAX
                  ? "At maximum zoom (400%)"
                  : "Zoom In (hold for continuous)"
            }
          >
            <span>
              <IconButton
                size="small"
                onMouseDown={(e) => {
                  e.preventDefault();
                  startContinuousZoomIn();
                }}
                onMouseUp={stopContinuousZoom}
                onMouseLeave={stopContinuousZoom}
                disabled={
                  !loadedImage ||
                  viewMode === "side-by-side" ||
                  zoom >= ZOOM_MAX
                }
                sx={{
                  color: zoom >= ZOOM_MAX ? "#444" : "#888",
                  p: 0.5,
                  opacity: viewMode === "side-by-side" ? 0.4 : 1,
                }}
              >
                <ZoomInIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip
            title={
              viewMode === "side-by-side"
                ? "Fit to View (not available in side-by-side view)"
                : "Fit to View (100%)"
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={handleFitToView}
                disabled={!loadedImage || viewMode === "side-by-side"}
                sx={{
                  color: "#888",
                  p: 0.5,
                  opacity: viewMode === "side-by-side" ? 0.4 : 1,
                }}
              >
                <FitScreenIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip
            title={
              viewMode !== "single"
                ? "Zoom to Selection (only available in single view)"
                : "Zoom to Selection (Ctrl+drag)"
            }
          >
            <span>
              <ToolButton
                size="small"
                active={isMarqueeModeActive}
                onClick={toggleMarqueeMode}
                disabled={!loadedImage || viewMode !== "single"}
                sx={{
                  opacity: viewMode !== "single" ? 0.4 : 1,
                }}
              >
                <CropFreeIcon sx={{ fontSize: 18 }} />
              </ToolButton>
            </span>
          </Tooltip>
        </Box>

        <ToolbarDivider />

        {/* Transform Tools - Rotate/Flip (non-destructive) */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title="Rotate 90° Counter-Clockwise">
            <ToolButton
              size="small"
              disabled={!loadedImage}
              onClick={handleRotateCCW}
            >
              <RotateLeftIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Rotate 90° Clockwise">
            <ToolButton
              size="small"
              disabled={!loadedImage}
              onClick={handleRotateCW}
            >
              <RotateRightIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Flip Horizontal">
            <ToolButton
              size="small"
              disabled={!loadedImage}
              onClick={handleFlipH}
              active={flipH}
            >
              <FlipIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Flip Vertical">
            <ToolButton
              size="small"
              disabled={!loadedImage}
              onClick={handleFlipV}
              active={flipV}
            >
              <FlipIcon sx={{ fontSize: 18, transform: "rotate(90deg)" }} />
            </ToolButton>
          </Tooltip>
        </Box>

        <ToolbarDivider />

        {/* Annotation Tools */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography sx={{ fontSize: 10, color: "#666", mr: 0.5 }}>
            Annotate:
          </Typography>
          <Tooltip title="Rectangle">
            <ToolButton
              size="small"
              active={activeTool === "rectangle"}
              onClick={() =>
                setActiveTool(activeTool === "rectangle" ? null : "rectangle")
              }
              disabled={!loadedImage}
            >
              <RectangleOutlinedIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Circle">
            <ToolButton
              size="small"
              active={activeTool === "circle"}
              onClick={() =>
                setActiveTool(activeTool === "circle" ? null : "circle")
              }
              disabled={!loadedImage}
            >
              <CircleOutlinedIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Arrow">
            <ToolButton
              size="small"
              active={activeTool === "arrow"}
              onClick={() =>
                setActiveTool(activeTool === "arrow" ? null : "arrow")
              }
              disabled={!loadedImage}
            >
              <ArrowForwardIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
        </Box>

        {/* Spacer to push undo/redo to far right */}
        <Box sx={{ flex: 1 }} />

        {/* Undo/Redo Controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <ToolButton
                size="small"
                disabled={!loadedImage || !canUndo}
                onClick={handleUndo}
                sx={{
                  color: !loadedImage || !canUndo ? "#444" : "#888",
                }}
              >
                <UndoIcon sx={{ fontSize: 18 }} />
              </ToolButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Shift+Z)">
            <span>
              <ToolButton
                size="small"
                disabled={!loadedImage || !canRedo}
                onClick={handleRedo}
                sx={{
                  color: !loadedImage || !canRedo ? "#444" : "#888",
                }}
              >
                <RedoIcon sx={{ fontSize: 18 }} />
              </ToolButton>
            </span>
          </Tooltip>
        </Box>
      </Toolbar>

      {/* Canvas Area */}
      <CanvasArea ref={canvasContainerRef}>{renderCanvas()}</CanvasArea>

      {/* Bottom Bar (minimal - no transport controls for images) */}
      <BottomBar>
        <Box sx={{ display: "flex", gap: 2 }}>
          {loadedImage && (
            <>
              <Typography sx={{ fontSize: 10, color: "#666" }}>
                {loadedImage.dimensions}
              </Typography>
              <Typography sx={{ fontSize: 10, color: "#666" }}>
                {loadedImage.format}
              </Typography>
            </>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          {loadedImage && storeAnnotations.length > 0 && (
            <Typography sx={{ fontSize: 10, color: "#666" }}>
              {storeAnnotations.filter((a) => a.visible).length} /{" "}
              {storeAnnotations.length} annotations visible
            </Typography>
          )}
        </Box>
      </BottomBar>
    </MainContainer>
  );

  // Inspector Panel (Right Panel)
  const inspectorContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Navigator Section */}
      <InspectorSection>
        <SectionHeader
          onClick={() => setNavigatorCollapsed(!navigatorCollapsed)}
        >
          <SectionTitle>Navigator</SectionTitle>
          {navigatorCollapsed ? (
            <ExpandMoreIcon sx={{ fontSize: 16, color: "#666" }} />
          ) : (
            <ExpandLessIcon sx={{ fontSize: 16, color: "#666" }} />
          )}
        </SectionHeader>
        {!navigatorCollapsed && (
          <SectionContent>
            <Navigator
              imageUrl={loadedImage?.thumbnailUrl ?? null}
              zoom={zoom}
              panOffset={panOffset}
              containerDimensions={containerDimensions}
              actualDimensions={actualDimensions}
              onPanChange={(x, y) => setPanOffset({ x, y })}
              calculateFitScale={calculateFitScale}
            />
          </SectionContent>
        )}
      </InspectorSection>

      {/* Filters Section */}
      <InspectorSection sx={{ flex: 1, overflow: "auto" }}>
        <SectionHeader onClick={() => setFiltersCollapsed(!filtersCollapsed)}>
          <SectionTitle>Filters</SectionTitle>
          {filtersCollapsed ? (
            <ExpandMoreIcon sx={{ fontSize: 16, color: "#666" }} />
          ) : (
            <ExpandLessIcon sx={{ fontSize: 16, color: "#666" }} />
          )}
        </SectionHeader>
        {!filtersCollapsed && (
          <SectionContent sx={{ pb: 2 }}>
            {/* Basic */}
            <FilterGroup>
              <FilterGroupTitle>Basic</FilterGroupTitle>
              <PrecisionSlider
                label="Exposure"
                value={filters.exposure}
                min={-5}
                max={5}
                step={0.1}
                onChange={handleFilterChange("exposure")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Contrast"
                value={filters.contrast}
                min={-100}
                max={100}
                onChange={handleFilterChange("contrast")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Highlights"
                value={filters.highlights}
                min={-100}
                max={100}
                onChange={handleFilterChange("highlights")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Shadows"
                value={filters.shadows}
                min={-100}
                max={100}
                onChange={handleFilterChange("shadows")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Whites"
                value={filters.whites}
                min={-100}
                max={100}
                onChange={handleFilterChange("whites")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Blacks"
                value={filters.blacks}
                min={-100}
                max={100}
                onChange={handleFilterChange("blacks")}
                disabled={!loadedImage}
              />
            </FilterGroup>

            {/* Color */}
            <FilterGroup>
              <FilterGroupTitle>Color</FilterGroupTitle>
              <PrecisionSlider
                label="Temperature"
                value={filters.temperature}
                min={-100}
                max={100}
                onChange={handleFilterChange("temperature")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Tint"
                value={filters.tint}
                min={-100}
                max={100}
                onChange={handleFilterChange("tint")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Vibrance"
                value={filters.vibrance}
                min={-100}
                max={100}
                onChange={handleFilterChange("vibrance")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Saturation"
                value={filters.saturation}
                min={-100}
                max={100}
                onChange={handleFilterChange("saturation")}
                disabled={!loadedImage}
              />
            </FilterGroup>

            {/* Detail */}
            <FilterGroup>
              <FilterGroupTitle>Detail</FilterGroupTitle>
              <PrecisionSlider
                label="Clarity"
                value={filters.clarity}
                min={-100}
                max={100}
                onChange={handleFilterChange("clarity")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Sharpness"
                value={filters.sharpness}
                min={0}
                max={100}
                onChange={handleFilterChange("sharpness")}
                disabled={!loadedImage}
              />
              <PrecisionSlider
                label="Noise Red."
                value={filters.noiseReduction}
                min={0}
                max={100}
                onChange={handleFilterChange("noiseReduction")}
                disabled={!loadedImage}
              />
            </FilterGroup>

            {/* Reset Button */}
            <Button
              fullWidth
              size="small"
              variant="outlined"
              onClick={handleResetFilters}
              disabled={!loadedImage}
              sx={{
                mt: 1,
                fontSize: 10,
                color: "#666",
                borderColor: "#333",
                py: 0.5,
                "&:hover": { borderColor: "#19abb5", color: "#19abb5" },
              }}
            >
              Reset All
            </Button>
          </SectionContent>
        )}
      </InspectorSection>

      {/* Annotations Section */}
      <InspectorSection
        sx={{
          flexShrink: 0,
          maxHeight: 280,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SectionHeader
          onClick={() => setAnnotationsCollapsed(!annotationsCollapsed)}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SectionTitle>Annotations</SectionTitle>
            <Typography sx={{ fontSize: 10, color: "#555" }}>
              ({storeAnnotations.length})
            </Typography>
          </Box>
          {annotationsCollapsed ? (
            <ExpandMoreIcon sx={{ fontSize: 16, color: "#666" }} />
          ) : (
            <ExpandLessIcon sx={{ fontSize: 16, color: "#666" }} />
          )}
        </SectionHeader>
        {!annotationsCollapsed && (
          <Box
            sx={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* User visibility toggles */}
            <Box
              sx={{ padding: "8px 12px", borderBottom: "1px solid #1f1f1f" }}
            >
              <Typography
                sx={{
                  fontSize: 9,
                  color: "#555",
                  mb: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Show by user
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {getUniqueUsers().map((user) => (
                  <Tooltip key={user} title={`Toggle ${user}'s annotations`}>
                    <IconButton
                      size="small"
                      onClick={() => toggleUserVisibility(user)}
                      sx={{
                        padding: "2px 6px",
                        borderRadius: 2,
                        backgroundColor: userVisibility[user]
                          ? "rgba(25, 171, 181, 0.15)"
                          : "#252525",
                        border: "1px solid",
                        borderColor: userVisibility[user] ? "#19abb5" : "#333",
                      }}
                    >
                      <PersonIcon
                        sx={{
                          fontSize: 12,
                          color: userVisibility[user] ? "#19abb5" : "#555",
                          mr: 0.5,
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: 9,
                          color: userVisibility[user] ? "#19abb5" : "#555",
                        }}
                      >
                        {user}
                      </Typography>
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            </Box>

            {/* Annotation list */}
            <Box sx={{ flex: 1, overflow: "auto", padding: "4px 8px" }}>
              {storeAnnotations.filter((a) => userVisibility[a.userDisplayName])
                .length === 0 ? (
                <Box sx={{ textAlign: "center", py: 2 }}>
                  <Typography sx={{ fontSize: 10, color: "#444" }}>
                    No annotations to display
                  </Typography>
                </Box>
              ) : (
                storeAnnotations
                  .filter((a) => userVisibility[a.userDisplayName])
                  .map((annotation) => (
                    <AnnotationItem
                      key={annotation.id}
                      onClick={() => selectAnnotation(annotation.id)}
                      sx={{
                        backgroundColor:
                          selectedAnnotationId === annotation.id
                            ? "rgba(25, 171, 181, 0.1)"
                            : "transparent",
                        border:
                          selectedAnnotationId === annotation.id
                            ? "1px solid rgba(25, 171, 181, 0.3)"
                            : "1px solid transparent",
                      }}
                    >
                      <AnnotationIcon type={annotation.type}>
                        {annotation.type === "rectangle" && (
                          <RectangleOutlinedIcon sx={{ fontSize: 12 }} />
                        )}
                        {annotation.type === "circle" && (
                          <CircleOutlinedIcon sx={{ fontSize: 12 }} />
                        )}
                        {annotation.type === "arrow" && (
                          <ArrowForwardIcon sx={{ fontSize: 12 }} />
                        )}
                      </AnnotationIcon>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 11,
                            color: "#ccc",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {annotation.label ||
                            `${annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1)}`}
                        </Typography>
                        <Typography sx={{ fontSize: 9, color: "#555" }}>
                          {annotation.userDisplayName}
                        </Typography>
                      </Box>
                      <Tooltip title={annotation.visible ? "Hide" : "Show"}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAnnotationVisibility(annotation.id);
                          }}
                          sx={{
                            padding: 2,
                            color: annotation.visible ? "#19abb5" : "#444",
                          }}
                        >
                          {annotation.visible ? (
                            <VisibilityIcon sx={{ fontSize: 14 }} />
                          ) : (
                            <VisibilityOffIcon sx={{ fontSize: 14 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    </AnnotationItem>
                  ))
              )}
            </Box>

            {/* Add Annotation Button */}
            <Box sx={{ padding: "8px 12px", borderTop: "1px solid #252525" }}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                disabled={!loadedImage}
                sx={{
                  fontSize: 10,
                  color: "#666",
                  borderColor: "#333",
                  py: 0.5,
                  "&:hover": { borderColor: "#19abb5", color: "#19abb5" },
                }}
              >
                Add Annotation
              </Button>
            </Box>
          </Box>
        )}
      </InspectorSection>
    </Box>
  );

  return (
    <>
      {/* Hidden file input for imports */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptString("image")}
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      <WorkspaceLayout
        filesPanel={
          <Box
            sx={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            {/* Import button header - full width */}
            <Box
              sx={{
                display: "flex",
                padding: "6px",
                borderBottom: "1px solid #252525",
                backgroundColor: "#1a1a1a",
              }}
            >
              <ImportButton
                startIcon={<FileUploadIcon sx={{ fontSize: 12 }} />}
                onClick={handleImportClick}
              >
                Import
              </ImportButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <FileLibrary
                items={imageFiles}
                selectedId={loadedImage?.id}
                onSelect={(item) =>
                  setSelectedFile(item as (typeof imageFiles)[0])
                }
                onDoubleClick={(item) =>
                  handleDoubleClick(item as (typeof imageFiles)[0])
                }
                filterByType="image"
              />
            </Box>
          </Box>
        }
        metadataPanel={
          <MetadataPanel
            data={
              loadedImage
                ? {
                    fileName: loadedImage.fileName,
                    capturedAt: loadedImage.capturedAt,
                    resolution: actualDimensions
                      ? `${actualDimensions.width} x ${actualDimensions.height}`
                      : loadedImage.dimensions,
                    user: loadedImage.user,
                    device: loadedImage.deviceInfo,
                    format:
                      loadedImage.fileName.split(".").pop()?.toUpperCase() ||
                      "Unknown",
                    gps: loadedImage.gps || undefined,
                    flagCount: loadedImage.flagCount,
                  }
                : null
            }
            type="image"
          />
        }
        inspectorPanel={inspectorContent}
        mainContent={mainContent}
        filesTitle="Image Files"
        inspectorTitle=""
        showTransport={false}
      />

      {/* Toast notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          sx={{
            width: "100%",
            backgroundColor:
              toast.severity === "success"
                ? "#1e3d1e"
                : toast.severity === "error"
                  ? "#3d1e1e"
                  : "#1e2d3d",
            color: "#e1e1e1",
            border: `1px solid ${
              toast.severity === "success"
                ? "#5a9a6b"
                : toast.severity === "error"
                  ? "#c45c5c"
                  : "#19abb5"
            }`,
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ImageTool;
