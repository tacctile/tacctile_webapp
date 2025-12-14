import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ImageIcon from '@mui/icons-material/Image';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CropIcon from '@mui/icons-material/Crop';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import FlipIcon from '@mui/icons-material/Flip';
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GestureIcon from '@mui/icons-material/Gesture';
import CompareIcon from '@mui/icons-material/Compare';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { WorkspaceLayout } from '@/components/layout';
import { FileLibrary, type FileItem } from '@/components/file-library';
import { MetadataPanel, PrecisionSlider } from '@/components/common';
import { useNavigationStore } from '@/stores/useNavigationStore';
import {
  isFileType,
  getFileTypeErrorMessage,
  getAcceptString,
} from '@/utils/fileTypes';
import {
  generateTestMetadataIfDev,
  formatGPSCoordinates,
} from '@/utils/testMetadataGenerator';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const MainContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0d0d0d',
});

const Toolbar = styled(Box)({
  height: 40,
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
});

const ToolbarDivider = styled(Box)({
  width: 1,
  height: 24,
  backgroundColor: '#2b2b2b',
  margin: '0 4px',
});

const CanvasArea = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0a0a0a',
  position: 'relative',
  overflow: 'hidden',
  minHeight: 0,
});

const StyledToggleButton = styled(ToggleButton)({
  border: 'none',
  padding: '4px 8px',
  color: '#888',
  '&.Mui-selected': {
    backgroundColor: 'rgba(25, 171, 181, 0.2)',
    color: '#19abb5',
    '&:hover': {
      backgroundColor: 'rgba(25, 171, 181, 0.3)',
    },
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});

const ToolButton = styled(IconButton)<{ active?: boolean }>(({ active }) => ({
  padding: 6,
  color: active ? '#19abb5' : '#888',
  backgroundColor: active ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
  '&:hover': {
    backgroundColor: active ? 'rgba(25, 171, 181, 0.25)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

const ZoomDisplay = styled(Typography)({
  fontSize: 11,
  color: '#888',
  fontFamily: '"JetBrains Mono", monospace',
  minWidth: 45,
  textAlign: 'center',
});

const SplitDivider = styled(Box)<{ isDragging?: boolean }>(({ isDragging }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 4,
  backgroundColor: isDragging ? '#4dd4df' : '#19abb5',
  cursor: isDragging ? 'grabbing' : 'grab',
  zIndex: 3, // Below ViewLabel (z-index: 5) so labels stay on top
  userSelect: 'none',
  '&:hover': {
    backgroundColor: '#4dd4df',
  },
  // Centered drag handle pill
  '&::after': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 8,
    height: 48,
    backgroundColor: isDragging ? '#5ee0ea' : '#2bc4cf',
    borderRadius: 4,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
  },
  '&:hover::after': {
    backgroundColor: '#5ee0ea',
  },
}));

const BottomBar = styled(Box)({
  height: 32,
  backgroundColor: '#161616',
  borderTop: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
});

// Label for ORIGINAL/EDITED in view modes
const ViewLabel = styled(Typography)<{ position: 'left' | 'right' }>(({ position }) => ({
  position: 'absolute',
  top: 12,
  [position]: 12,
  fontSize: 10,
  fontWeight: 600,
  color: '#fff',
  textTransform: 'uppercase',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  padding: '4px 8px',
  borderRadius: 4,
  letterSpacing: '0.5px',
  zIndex: 5,
  pointerEvents: 'none',
}));

// File drop zone for center canvas when no file loaded
const FileDropZone = styled(Box)<{ isActive: boolean }>(({ isActive }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: isActive ? '#19abb5' : '#444',
  backgroundColor: isActive ? 'rgba(25, 171, 181, 0.08)' : 'transparent',
  border: isActive ? '2px dashed #19abb5' : '2px dashed transparent',
  borderRadius: 8,
  padding: 32,
  margin: 16,
  transition: 'all 0.2s ease',
  cursor: 'pointer',
}));

// Import button for left panel - full width
const ImportButton = styled(Button)({
  fontSize: 9,
  color: '#888',
  backgroundColor: '#252525',
  border: '1px solid #333',
  padding: '6px 8px',
  textTransform: 'none',
  width: '100%',
  justifyContent: 'center',
  '&:hover': {
    backgroundColor: '#333',
    borderColor: '#19abb5',
    color: '#19abb5',
  },
  '& .MuiButton-startIcon': {
    marginRight: 4,
  },
});

// Right Panel Styled Components
const InspectorSection = styled(Box)({
  borderBottom: '1px solid #252525',
});

const SectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  cursor: 'pointer',
  backgroundColor: '#1a1a1a',
  '&:hover': {
    backgroundColor: '#1e1e1e',
  },
});

const SectionTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
});

const SectionContent = styled(Box)({
  padding: '8px 12px',
});

const FilterGroup = styled(Box)({
  marginBottom: 12,
});

const FilterGroupTitle = styled(Typography)({
  fontSize: 9,
  fontWeight: 600,
  color: '#555',
  textTransform: 'uppercase',
  marginBottom: 8,
  paddingLeft: 2,
});

// Histogram styled components
const HistogramContainer = styled(Box)({
  height: 80,
  backgroundColor: '#0a0a0a',
  borderRadius: 4,
  position: 'relative',
  overflow: 'hidden',
});

const HistogramChannel = styled('div')<{ channel: 'r' | 'g' | 'b' }>(({ channel }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  opacity: 0.6,
  mixBlendMode: 'screen',
}));

const ClippingIndicator = styled(Box)<{ side: 'left' | 'right'; active: boolean }>(({ side, active }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 4,
  [side]: 0,
  backgroundColor: active ? '#c45c5c' : 'transparent',
}));

// Annotation List styled components
const AnnotationItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
});

const AnnotationIcon = styled(Box)<{ type: string }>(({ type }) => {
  const colors: Record<string, string> = {
    rectangle: '#c45c5c',
    circle: '#5a9a6b',
    arrow: '#5a7fbf',
    freehand: '#b5a319',
  };
  return {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: colors[type] || '#666',
    color: '#fff',
    fontSize: 12,
  };
});

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'single' | 'side-by-side' | 'split';
type AnnotationTool = 'rectangle' | 'circle' | 'arrow' | 'freehand' | null;

interface ImageAnnotation {
  id: string;
  type: 'rectangle' | 'circle' | 'arrow' | 'freehand';
  label: string;
  user: string;
  visible: boolean;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
}

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
  // Vignette
  vignette: number;
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
  vignette: 0,
};

// ============================================================================
// MOCK DATA
// ============================================================================

const imageFiles: (FileItem & { format?: string; gps?: string | null; dimensions?: string })[] = [
  { id: 'i1', type: 'image', fileName: 'pexels-jmark-250591.jpg', thumbnailUrl: '/images/pexels-jmark-250591.jpg', capturedAt: Date.now() - 7200000, user: 'Mike', deviceInfo: 'Canon EOS R5', flagCount: 2, hasFindings: true, format: 'JPEG / sRGB', gps: '40.71°N, 74.00°W', dimensions: '4000 x 2667' },
  { id: 'i2', type: 'image', fileName: 'pexels-mahima-518693-1250260.jpg', thumbnailUrl: '/images/pexels-mahima-518693-1250260.jpg', capturedAt: Date.now() - 6800000, user: 'Sarah', deviceInfo: 'Sony A7IV', flagCount: 0, hasFindings: false, format: 'JPEG / sRGB', gps: '34.05°N, 118.24°W', dimensions: '5472 x 3648' },
  { id: 'i3', type: 'image', fileName: 'pexels-minan1398-906150.jpg', thumbnailUrl: '/images/pexels-minan1398-906150.jpg', capturedAt: Date.now() - 6400000, user: 'Jen', deviceInfo: 'Nikon Z6', flagCount: 1, hasFindings: true, format: 'JPEG / sRGB', gps: '51.50°N, 0.12°W', dimensions: '6000 x 4000' },
  { id: 'i4', type: 'image', fileName: 'pexels-philippedonn-1133957.jpg', thumbnailUrl: '/images/pexels-philippedonn-1133957.jpg', capturedAt: Date.now() - 6000000, user: 'Mike', deviceInfo: 'iPhone 15 Pro', flagCount: 0, hasFindings: false, format: 'JPEG / P3', gps: '48.85°N, 2.35°E', dimensions: '4032 x 3024' },
  { id: 'i5', type: 'image', fileName: 'pexels-pixabay-158063.jpg', thumbnailUrl: '/images/pexels-pixabay-158063.jpg', capturedAt: Date.now() - 5600000, user: 'Sarah', deviceInfo: 'Canon EOS R5', flagCount: 3, hasFindings: true, format: 'JPEG / sRGB', gps: '35.68°N, 139.76°E', dimensions: '5184 x 3456' },
  { id: 'i6', type: 'image', fileName: 'pexels-pixabay-259915.jpg', thumbnailUrl: '/images/pexels-pixabay-259915.jpg', capturedAt: Date.now() - 5200000, user: 'Jen', deviceInfo: 'Fujifilm X-T5', flagCount: 0, hasFindings: false, format: 'JPEG / sRGB', gps: null, dimensions: '4896 x 3264' },
  { id: 'i7', type: 'image', fileName: 'pexels-pixabay-459335.jpg', thumbnailUrl: '/images/pexels-pixabay-459335.jpg', capturedAt: Date.now() - 4800000, user: 'Mike', deviceInfo: 'Sony A7IV', flagCount: 1, hasFindings: true, format: 'JPEG / sRGB', gps: '37.77°N, 122.41°W', dimensions: '5760 x 3840' },
  { id: 'i8', type: 'image', fileName: 'pexels-pixabay-68507.jpg', thumbnailUrl: '/images/pexels-pixabay-68507.jpg', capturedAt: Date.now() - 4400000, user: 'Sarah', deviceInfo: 'Nikon Z6', flagCount: 2, hasFindings: true, format: 'JPEG / sRGB', gps: '41.90°N, 12.49°E', dimensions: '4288 x 2848' },
  { id: 'i9', type: 'image', fileName: 'pexels-soldiervip-1386604.jpg', thumbnailUrl: '/images/pexels-soldiervip-1386604.jpg', capturedAt: Date.now() - 4000000, user: 'Jen', deviceInfo: 'Canon EOS R5', flagCount: 0, hasFindings: false, format: 'JPEG / sRGB', gps: '52.52°N, 13.40°E', dimensions: '6000 x 4000' },
];

const mockAnnotations: ImageAnnotation[] = [
  { id: 'a1', type: 'rectangle', label: 'Area of interest', user: 'Sarah', visible: true, x: 120, y: 80, width: 60, height: 100 },
  { id: 'a2', type: 'circle', label: 'Highlight region', user: 'Mike', visible: true, x: 300, y: 150, width: 40, height: 40 },
  { id: 'a3', type: 'arrow', label: 'Direction indicator', user: 'Jen', visible: false, x: 200, y: 200, width: 80, height: 0 },
];

// ============================================================================
// HISTOGRAM COMPONENT
// ============================================================================

interface HistogramProps {
  disabled?: boolean;
}

const Histogram: React.FC<HistogramProps> = ({ disabled }) => {
  // Generate fake histogram data
  const generateChannelData = (seed: number) => {
    const data: number[] = [];
    for (let i = 0; i < 256; i++) {
      const base = Math.sin((i + seed) * 0.02) * 30 + 40;
      const noise = Math.random() * 20;
      data.push(Math.max(0, Math.min(100, base + noise)));
    }
    return data;
  };

  const rData = generateChannelData(0);
  const gData = generateChannelData(50);
  const bData = generateChannelData(100);

  const generatePath = (data: number[]) => {
    const points = data.map((v, i) => `${(i / 255) * 100}% ${100 - v}%`);
    return `polygon(0% 100%, ${points.join(', ')}, 100% 100%)`;
  };

  const hasLeftClipping = !disabled && Math.random() > 0.7;
  const hasRightClipping = !disabled && Math.random() > 0.8;

  return (
    <HistogramContainer>
      {disabled ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography sx={{ fontSize: 10, color: '#444' }}>No image loaded</Typography>
        </Box>
      ) : (
        <>
          <HistogramChannel channel="r" sx={{ clipPath: generatePath(rData), backgroundColor: '#c45c5c' }} />
          <HistogramChannel channel="g" sx={{ clipPath: generatePath(gData), backgroundColor: '#5a9a6b' }} />
          <HistogramChannel channel="b" sx={{ clipPath: generatePath(bData), backgroundColor: '#5a7fbf' }} />
          <ClippingIndicator side="left" active={hasLeftClipping} />
          <ClippingIndicator side="right" active={hasRightClipping} />
        </>
      )}
    </HistogramContainer>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ImageToolProps {
  investigationId?: string;
}

export const ImageTool: React.FC<ImageToolProps> = ({ investigationId }) => {
  const [selectedFile, setSelectedFile] = useState<typeof imageFiles[0] | null>(null);
  const [loadedImage, setLoadedImage] = useState<typeof imageFiles[0] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [zoom, setZoom] = useState(100);
  const [activeTool, setActiveTool] = useState<AnnotationTool>(null);
  const [filters, setFilters] = useState<ImageFilters>(defaultFilters);
  const [annotations, setAnnotations] = useState<ImageAnnotation[]>(mockAnnotations);
  const [splitPosition, setSplitPosition] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false); // A/B toggle state

  // State for actual image dimensions (read from loaded image)
  const [actualDimensions, setActualDimensions] = useState<{ width: number; height: number } | null>(null);

  // Section collapse states
  const [histogramCollapsed, setHistogramCollapsed] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [annotationsCollapsed, setAnnotationsCollapsed] = useState(false);

  // Filter visibility by user
  const [userVisibility, setUserVisibility] = useState<Record<string, boolean>>({
    'Sarah': true,
    'Mike': true,
    'Jen': true,
  });

  // File drop zone state
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Toast notification state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const loadedFileId = useNavigationStore((state) => state.loadedFiles.images);
  const setLoadedFile = useNavigationStore((state) => state.setLoadedFile);

  // Load image when navigated to
  useEffect(() => {
    if (loadedFileId) {
      const file = imageFiles.find(f => f.id === loadedFileId);
      if (file) {
        setLoadedImage(file);
        setSelectedFile(file);
        setFilters(defaultFilters);
      }
    }
  }, [loadedFileId]);

  const handleDoubleClick = useCallback((item: typeof imageFiles[0]) => {
    setLoadedImage(item);
    setSelectedFile(item);
    setFilters(defaultFilters);
    setActualDimensions(null); // Reset until image loads
    // Persist loaded file ID in navigation store
    setLoadedFile('images', item.id);
  }, [setLoadedFile]);

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode) setViewMode(newMode);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(400, prev + 25));
  const handleZoomOut = () => setZoom(prev => Math.max(25, prev - 25));
  const handleFitToView = () => setZoom(100);
  const handleZoom100 = () => setZoom(100);

  const handleFilterChange = (key: keyof ImageFilters) => (value: number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  const toggleAnnotationVisibility = (id: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, visible: !a.visible } : a));
  };

  const toggleUserVisibility = (user: string) => {
    setUserVisibility(prev => ({ ...prev, [user]: !prev[user] }));
  };

  const getUniqueUsers = () => {
    const users = new Set(annotations.map(a => a.user));
    return Array.from(users);
  };

  // ============================================================================
  // FILE DROP ZONE HANDLERS
  // ============================================================================

  // Show toast notification
  const showToast = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ open: true, message, severity });
  }, []);

  // Close toast
  const handleCloseToast = useCallback(() => {
    setToast(prev => ({ ...prev, open: false }));
  }, []);

  // Process dropped/imported image file
  const processImageFile = useCallback((file: File) => {
    if (!isFileType(file, 'image')) {
      showToast(getFileTypeErrorMessage('image'), 'error');
      return;
    }

    // Try to generate test metadata in development mode
    const testMetadata = generateTestMetadataIfDev(file);

    // Create a mock image item from the imported file (Quick Analysis Mode)
    // Use test metadata if available (dev mode), otherwise use defaults
    const mockItem = {
      id: testMetadata?.id || `import-${Date.now()}`,
      type: 'image' as const,
      fileName: file.name,
      capturedAt: testMetadata?.timestamp.getTime() || Date.now(),
      user: testMetadata?.user || 'Imported',
      deviceInfo: testMetadata?.deviceId || 'Imported File',
      format: file.type || 'image/unknown',
      dimensions: '4000 x 3000',
      flagCount: 0,
      gps: testMetadata?.gpsCoordinates
        ? formatGPSCoordinates(testMetadata.gpsCoordinates)
        : null,
    };

    setLoadedImage(mockItem);
    setSelectedFile(mockItem);
    setFilters(defaultFilters);
    showToast(`Loaded: ${file.name}`, 'success');
  }, [showToast]);

  // Handle file drag enter
  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
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
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // Handle file drop
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processImageFile(files[0]);
    }
  }, [processImageFile]);

  // Handle Import button click
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processImageFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processImageFile]);

  // Handle drop zone click
  const handleDropZoneClick = useCallback((e: React.MouseEvent) => {
    // Open the file picker
    fileInputRef.current?.click();
    // Stop propagation to prevent parent handlers from triggering (e.g., fullscreen exit)
    e.stopPropagation();
  }, []);

  // Handle image load to read actual dimensions
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setActualDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  // Get the image URL - could be thumbnailUrl for mock data or direct URL for imported files
  const getImageUrl = (file: typeof imageFiles[0]) => {
    // For mock data, thumbnailUrl points to the actual image
    return file.thumbnailUrl || '';
  };

  // Handle A/B toggle
  const handleABToggle = useCallback(() => {
    setShowOriginal(prev => !prev);
  }, []);

  // Handle split divider drag start
  // Uses refs for immediate response without waiting for React state updates
  const handleSplitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent selection
    e.stopPropagation();

    // Capture initial values immediately
    const startX = e.clientX;
    const startPos = splitPosition;

    // Get container rect once at the start for performance
    const container = splitContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    // Set visual state for cursor styling
    setIsDraggingSplit(true);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (moveE: MouseEvent) => {
      moveE.preventDefault(); // Prevent selection during drag
      // Use cached rect for immediate response (no DOM query)
      const newPos = startPos + ((moveE.clientX - startX) / containerRect.width) * 100;
      // Constrain between 3% and 97% for extended comparison range
      setSplitPosition(Math.max(3, Math.min(97, newPos)));
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [splitPosition]);

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
          <ImageIcon sx={{ fontSize: 64, mb: 2, opacity: isFileDragOver ? 0.8 : 0.3 }} />
          <Typography sx={{ fontSize: 14, color: isFileDragOver ? '#19abb5' : '#555' }}>
            {isFileDragOver ? 'Drop image file here' : 'No image loaded'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#444', mt: 0.5 }}>
            {isFileDragOver ? 'Release to import' : 'Drag & drop or click to import image files'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: '#333', mt: 1 }}>
            .jpg, .jpeg, .png, .gif, .webp, .tiff, .bmp
          </Typography>
        </FileDropZone>
      );
    }

    const imageUrl = getImageUrl(loadedImage);

    // Container style for centering and fit-to-window
    const containerStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      position: 'relative' as const,
      overflow: zoom > 100 ? 'auto' : 'hidden',
    };

    // Image style - fill container while maintaining aspect ratio
    // Uses width/height 100% with object-fit: contain to maximize space usage
    // Transform scale handles zoom levels beyond 100%
    const imageStyle = {
      width: '100%',
      height: '100%',
      objectFit: 'contain' as const,
      borderRadius: 2,
      userSelect: 'none' as const,
      transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
      transformOrigin: 'center center',
    };

    // ========== SIDE-BY-SIDE VIEW ==========
    if (viewMode === 'side-by-side') {
      return (
        <Box sx={{
          display: 'flex',
          width: '100%',
          height: '100%',
          gap: 2,
          p: 2,
        }}>
          {/* Original side */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <img
              src={imageUrl}
              alt={loadedImage.fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 2,
                userSelect: 'none',
              }}
              onLoad={handleImageLoad}
              draggable={false}
            />
            <ViewLabel position="left">Original</ViewLabel>
          </Box>
          {/* Edited side */}
          <Box sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <img
              src={imageUrl}
              alt={loadedImage.fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 2,
                userSelect: 'none',
              }}
              draggable={false}
            />
            <ViewLabel position="right">Edited</ViewLabel>
          </Box>
        </Box>
      );
    }

    // ========== SPLIT VIEW ==========
    if (viewMode === 'split') {
      return (
        <Box
          ref={splitContainerRef}
          sx={{
            width: '100%',
            height: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: isDraggingSplit ? 'none' : 'auto',
            overflow: 'hidden',
          }}
        >
          {/* Image container - centered, contains both layers */}
          <Box
            sx={{
              position: 'relative',
              maxWidth: `${zoom}%`,
              maxHeight: `${zoom}%`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* EDITED image - base layer (bottom) */}
            <img
              src={imageUrl}
              alt={loadedImage.fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 2,
                userSelect: 'none',
                display: 'block',
              }}
              onLoad={handleImageLoad}
              draggable={false}
            />
            {/* ORIGINAL image - overlay layer (top) with clip-path reveal */}
            <img
              src={imageUrl}
              alt={loadedImage.fileName}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: 2,
                userSelect: 'none',
                pointerEvents: 'none',
                // Clip from the left edge to splitPosition% - reveals ORIGINAL on left side
                clipPath: `inset(0 ${100 - splitPosition}% 0 0)`,
              }}
              draggable={false}
            />
          </Box>
          {/* ORIGINAL label - top left */}
          <ViewLabel position="left">Original</ViewLabel>
          {/* EDITED label - top right */}
          <ViewLabel position="right">Edited</ViewLabel>
          {/* Full-height draggable divider - spans entire viewable area */}
          <SplitDivider
            isDragging={isDraggingSplit}
            sx={{
              left: `${splitPosition}%`,
              transform: 'translateX(-50%)',
            }}
            onMouseDown={handleSplitDragStart}
          />
        </Box>
      );
    }

    // ========== SINGLE VIEW ==========
    // Shows ORIGINAL label when A/B toggle is active
    return (
      <Box sx={containerStyle}>
        <img
          src={imageUrl}
          alt={loadedImage.fileName}
          style={imageStyle}
          onLoad={handleImageLoad}
          draggable={false}
        />
        {/* Show ORIGINAL label only when A/B toggle is on */}
        {showOriginal && (
          <ViewLabel position="left">Original</ViewLabel>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 10, color: '#666', textTransform: 'uppercase' }}>View:</Typography>
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
                <VerticalSplitIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            </StyledToggleButton>
          </ToggleButtonGroup>
          {/* A/B Toggle - always visible, but only enabled in single view */}
          <Tooltip title={
            viewMode !== 'single'
              ? 'A/B Compare (only available in single view)'
              : showOriginal
                ? 'Viewing Original (click to see Edited)'
                : 'A/B Compare (click to see Original)'
          }>
            <span>
              <ToolButton
                size="small"
                active={showOriginal && viewMode === 'single'}
                onClick={handleABToggle}
                disabled={!loadedImage || viewMode !== 'single'}
                sx={{
                  opacity: viewMode !== 'single' ? 0.4 : 1,
                  cursor: viewMode !== 'single' ? 'not-allowed' : 'pointer',
                }}
              >
                <CompareArrowsIcon sx={{ fontSize: 16 }} />
              </ToolButton>
            </span>
          </Tooltip>
        </Box>

        <ToolbarDivider />

        {/* Zoom Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={handleZoomOut} disabled={!loadedImage} sx={{ color: '#888', p: 0.5 }}>
              <ZoomOutIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <ZoomDisplay>{zoom}%</ZoomDisplay>
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={handleZoomIn} disabled={!loadedImage} sx={{ color: '#888', p: 0.5 }}>
              <ZoomInIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit to View">
            <IconButton size="small" onClick={handleFitToView} disabled={!loadedImage} sx={{ color: '#888', p: 0.5 }}>
              <FitScreenIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="100%">
            <Button
              size="small"
              onClick={handleZoom100}
              disabled={!loadedImage}
              sx={{ fontSize: 9, color: '#888', minWidth: 32, p: 0.5 }}
            >
              1:1
            </Button>
          </Tooltip>
        </Box>

        <ToolbarDivider />

        {/* Crop/Rotate Tools */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Crop">
            <ToolButton size="small" disabled={!loadedImage}>
              <CropIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Rotate 90°">
            <ToolButton size="small" disabled={!loadedImage}>
              <RotateRightIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Flip Horizontal">
            <ToolButton size="small" disabled={!loadedImage}>
              <FlipIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
        </Box>

        <ToolbarDivider />

        {/* Annotation Draw Tools */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 10, color: '#666', mr: 0.5 }}>Draw:</Typography>
          <Tooltip title="Rectangle">
            <ToolButton
              size="small"
              active={activeTool === 'rectangle'}
              onClick={() => setActiveTool(activeTool === 'rectangle' ? null : 'rectangle')}
              disabled={!loadedImage}
            >
              <RectangleOutlinedIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Circle">
            <ToolButton
              size="small"
              active={activeTool === 'circle'}
              onClick={() => setActiveTool(activeTool === 'circle' ? null : 'circle')}
              disabled={!loadedImage}
            >
              <CircleOutlinedIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Arrow">
            <ToolButton
              size="small"
              active={activeTool === 'arrow'}
              onClick={() => setActiveTool(activeTool === 'arrow' ? null : 'arrow')}
              disabled={!loadedImage}
            >
              <ArrowForwardIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Freehand">
            <ToolButton
              size="small"
              active={activeTool === 'freehand'}
              onClick={() => setActiveTool(activeTool === 'freehand' ? null : 'freehand')}
              disabled={!loadedImage}
            >
              <GestureIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
        </Box>
      </Toolbar>

      {/* Canvas Area */}
      <CanvasArea>
        {renderCanvas()}
      </CanvasArea>

      {/* Bottom Bar (minimal - no transport controls for images) */}
      <BottomBar>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {loadedImage && (
            <>
              <Typography sx={{ fontSize: 10, color: '#666' }}>
                {loadedImage.dimensions}
              </Typography>
              <Typography sx={{ fontSize: 10, color: '#666' }}>
                {loadedImage.format}
              </Typography>
            </>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {loadedImage && annotations.length > 0 && (
            <Typography sx={{ fontSize: 10, color: '#666' }}>
              {annotations.filter(a => a.visible).length} / {annotations.length} annotations visible
            </Typography>
          )}
        </Box>
      </BottomBar>
    </MainContainer>
  );

  // Inspector Panel (Right Panel)
  const inspectorContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Histogram Section */}
      <InspectorSection>
        <SectionHeader onClick={() => setHistogramCollapsed(!histogramCollapsed)}>
          <SectionTitle>Histogram</SectionTitle>
          {histogramCollapsed ? <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} /> : <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />}
        </SectionHeader>
        {!histogramCollapsed && (
          <SectionContent>
            <Histogram disabled={!loadedImage} />
          </SectionContent>
        )}
      </InspectorSection>

      {/* Filters Section */}
      <InspectorSection sx={{ flex: 1, overflow: 'auto' }}>
        <SectionHeader onClick={() => setFiltersCollapsed(!filtersCollapsed)}>
          <SectionTitle>Filters</SectionTitle>
          {filtersCollapsed ? <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} /> : <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />}
        </SectionHeader>
        {!filtersCollapsed && (
          <SectionContent sx={{ pb: 2 }}>
            {/* Basic */}
            <FilterGroup>
              <FilterGroupTitle>Basic</FilterGroupTitle>
              <PrecisionSlider label="Exposure" value={filters.exposure} min={-5} max={5} step={0.1} onChange={handleFilterChange('exposure')} disabled={!loadedImage} />
              <PrecisionSlider label="Contrast" value={filters.contrast} min={-100} max={100} onChange={handleFilterChange('contrast')} disabled={!loadedImage} />
              <PrecisionSlider label="Highlights" value={filters.highlights} min={-100} max={100} onChange={handleFilterChange('highlights')} disabled={!loadedImage} />
              <PrecisionSlider label="Shadows" value={filters.shadows} min={-100} max={100} onChange={handleFilterChange('shadows')} disabled={!loadedImage} />
              <PrecisionSlider label="Whites" value={filters.whites} min={-100} max={100} onChange={handleFilterChange('whites')} disabled={!loadedImage} />
              <PrecisionSlider label="Blacks" value={filters.blacks} min={-100} max={100} onChange={handleFilterChange('blacks')} disabled={!loadedImage} />
            </FilterGroup>

            {/* Color */}
            <FilterGroup>
              <FilterGroupTitle>Color</FilterGroupTitle>
              <PrecisionSlider label="Temperature" value={filters.temperature} min={-100} max={100} onChange={handleFilterChange('temperature')} disabled={!loadedImage} />
              <PrecisionSlider label="Tint" value={filters.tint} min={-100} max={100} onChange={handleFilterChange('tint')} disabled={!loadedImage} />
              <PrecisionSlider label="Vibrance" value={filters.vibrance} min={-100} max={100} onChange={handleFilterChange('vibrance')} disabled={!loadedImage} />
              <PrecisionSlider label="Saturation" value={filters.saturation} min={-100} max={100} onChange={handleFilterChange('saturation')} disabled={!loadedImage} />
            </FilterGroup>

            {/* Detail */}
            <FilterGroup>
              <FilterGroupTitle>Detail</FilterGroupTitle>
              <PrecisionSlider label="Clarity" value={filters.clarity} min={-100} max={100} onChange={handleFilterChange('clarity')} disabled={!loadedImage} />
              <PrecisionSlider label="Sharpness" value={filters.sharpness} min={0} max={100} onChange={handleFilterChange('sharpness')} disabled={!loadedImage} />
              <PrecisionSlider label="Noise Red." value={filters.noiseReduction} min={0} max={100} onChange={handleFilterChange('noiseReduction')} disabled={!loadedImage} />
            </FilterGroup>

            {/* Vignette */}
            <FilterGroup>
              <FilterGroupTitle>Effects</FilterGroupTitle>
              <PrecisionSlider label="Vignette" value={filters.vignette} min={-100} max={100} onChange={handleFilterChange('vignette')} disabled={!loadedImage} />
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
                color: '#666',
                borderColor: '#333',
                py: 0.5,
                '&:hover': { borderColor: '#19abb5', color: '#19abb5' },
              }}
            >
              Reset All
            </Button>
          </SectionContent>
        )}
      </InspectorSection>

      {/* Annotations Section */}
      <InspectorSection sx={{ flexShrink: 0, maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <SectionHeader onClick={() => setAnnotationsCollapsed(!annotationsCollapsed)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SectionTitle>Annotations</SectionTitle>
            <Typography sx={{ fontSize: 10, color: '#555' }}>({annotations.length})</Typography>
          </Box>
          {annotationsCollapsed ? <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} /> : <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />}
        </SectionHeader>
        {!annotationsCollapsed && (
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* User visibility toggles */}
            <Box sx={{ padding: '8px 12px', borderBottom: '1px solid #1f1f1f' }}>
              <Typography sx={{ fontSize: 9, color: '#555', mb: 0.5, textTransform: 'uppercase' }}>Show by user</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {getUniqueUsers().map(user => (
                  <Tooltip key={user} title={`Toggle ${user}'s annotations`}>
                    <IconButton
                      size="small"
                      onClick={() => toggleUserVisibility(user)}
                      sx={{
                        padding: '2px 6px',
                        borderRadius: 2,
                        backgroundColor: userVisibility[user] ? 'rgba(25, 171, 181, 0.15)' : '#252525',
                        border: '1px solid',
                        borderColor: userVisibility[user] ? '#19abb5' : '#333',
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 12, color: userVisibility[user] ? '#19abb5' : '#555', mr: 0.5 }} />
                      <Typography sx={{ fontSize: 9, color: userVisibility[user] ? '#19abb5' : '#555' }}>{user}</Typography>
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            </Box>

            {/* Annotation list */}
            <Box sx={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
              {annotations.filter(a => userVisibility[a.user]).length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography sx={{ fontSize: 10, color: '#444' }}>No annotations to display</Typography>
                </Box>
              ) : (
                annotations.filter(a => userVisibility[a.user]).map(annotation => (
                  <AnnotationItem key={annotation.id}>
                    <AnnotationIcon type={annotation.type}>
                      {annotation.type === 'rectangle' && <RectangleOutlinedIcon sx={{ fontSize: 12 }} />}
                      {annotation.type === 'circle' && <CircleOutlinedIcon sx={{ fontSize: 12 }} />}
                      {annotation.type === 'arrow' && <ArrowForwardIcon sx={{ fontSize: 12 }} />}
                      {annotation.type === 'freehand' && <GestureIcon sx={{ fontSize: 12 }} />}
                    </AnnotationIcon>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 11, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {annotation.label}
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: '#555' }}>{annotation.user}</Typography>
                    </Box>
                    <Tooltip title={annotation.visible ? 'Hide' : 'Show'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleAnnotationVisibility(annotation.id)}
                        sx={{ padding: 2, color: annotation.visible ? '#19abb5' : '#444' }}
                      >
                        {annotation.visible ? <VisibilityIcon sx={{ fontSize: 14 }} /> : <VisibilityOffIcon sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                  </AnnotationItem>
                ))
              )}
            </Box>

            {/* Add Annotation Button */}
            <Box sx={{ padding: '8px 12px', borderTop: '1px solid #252525' }}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                disabled={!loadedImage}
                sx={{
                  fontSize: 10,
                  color: '#666',
                  borderColor: '#333',
                  py: 0.5,
                  '&:hover': { borderColor: '#19abb5', color: '#19abb5' },
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
        accept={getAcceptString('image')}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <WorkspaceLayout
        filesPanel={
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Import button header - full width */}
            <Box sx={{
              display: 'flex',
              padding: '6px',
              borderBottom: '1px solid #252525',
              backgroundColor: '#1a1a1a',
            }}>
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
                onSelect={(item) => setSelectedFile(item as typeof imageFiles[0])}
                onDoubleClick={(item) => handleDoubleClick(item as typeof imageFiles[0])}
                filterByType="image"
              />
            </Box>
          </Box>
        }
        metadataPanel={
          <MetadataPanel
            data={loadedImage ? {
              fileName: loadedImage.fileName,
              capturedAt: loadedImage.capturedAt,
              resolution: actualDimensions
                ? `${actualDimensions.width} x ${actualDimensions.height}`
                : loadedImage.dimensions,
              user: loadedImage.user,
              device: loadedImage.deviceInfo,
              format: loadedImage.fileName.split('.').pop()?.toUpperCase() || 'Unknown',
              gps: loadedImage.gps || undefined,
              flagCount: loadedImage.flagCount,
            } : null}
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          sx={{
            width: '100%',
            backgroundColor: toast.severity === 'success' ? '#1e3d1e' :
                           toast.severity === 'error' ? '#3d1e1e' : '#1e2d3d',
            color: '#e1e1e1',
            border: `1px solid ${
              toast.severity === 'success' ? '#5a9a6b' :
              toast.severity === 'error' ? '#c45c5c' : '#19abb5'
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
