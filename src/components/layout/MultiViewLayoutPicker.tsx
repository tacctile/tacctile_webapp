/**
 * MultiViewLayoutPicker Component
 * Modal for selecting multi-view layout and assigning tools to tiles
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import {
  MultiViewLayoutType,
  MultiViewToolType,
  TileAssignments,
  buildMultiViewUrl,
  getLayoutConfig,
} from '@/types/multiview';
import { useAppPersistence } from '@/stores/useAppPersistence';
import { multiViewSyncService } from '@/services/multiview/MultiViewSyncService';

// ============================================================================
// TYPES (local aliases for backwards compatibility)
// ============================================================================

type LayoutType = MultiViewLayoutType;
type ToolType = MultiViewToolType;

interface LayoutConfig {
  id: LayoutType;
  name: string;
  tiles: number;
}

// ============================================================================
// LAYOUT CONFIGURATIONS
// ============================================================================

const LAYOUTS: LayoutConfig[] = [
  { id: 'two-across', name: 'Two Across', tiles: 2 },
  { id: 'two-stacked', name: 'Two Stacked', tiles: 2 },
  { id: 'two-left-one-right', name: 'Two Left + One Right', tiles: 3 },
  { id: 'one-left-two-right', name: 'One Left + Two Right', tiles: 3 },
  { id: 'three-across', name: 'Three Across', tiles: 3 },
  { id: 'two-by-two', name: '2x2 Grid', tiles: 4 },
];

const TOOLS: { id: ToolType; name: string }[] = [
  { id: null, name: 'None' },
  { id: 'video-viewer', name: 'Video Viewer' },
  { id: 'audio-viewer', name: 'Audio Viewer' },
  { id: 'timeline', name: 'Timeline' },
  { id: 'notes', name: 'Notes' },
  { id: 'images', name: 'Images' },
  { id: 'flags', name: 'Flags' },
];

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Backdrop = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  zIndex: 1300,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const ModalContainer = styled(Box)({
  width: 700,
  height: 500,
  backgroundColor: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const ModalHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
});

const HeaderTitle = styled(Typography)({
  fontSize: 14,
  fontWeight: 600,
  color: '#e1e1e1',
});

const CloseButton = styled(IconButton)({
  padding: 4,
  color: '#666',
  '&:hover': {
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const ModalBody = styled(Box)({
  flex: 1,
  display: 'flex',
  overflow: 'hidden',
});

const LeftSidebar = styled(Box)({
  width: 100,
  backgroundColor: '#1a1a1a',
  borderRight: '1px solid #333',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflowY: 'auto',
});

const LayoutThumbnail = styled(Box)<{ $selected: boolean }>(({ $selected }) => ({
  width: 60,
  height: 45,
  backgroundColor: '#2a2a2a',
  border: `1px solid ${$selected ? '#19abb5' : '#444'}`,
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  transition: 'all 0.15s ease',
  ...(($selected) && {
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  }),
  '&:hover': {
    backgroundColor: $selected ? 'rgba(25, 171, 181, 0.15)' : '#333',
    borderColor: $selected ? '#19abb5' : '#555',
  },
}));

const ThumbnailLabel = styled(Typography)({
  fontSize: 8,
  color: '#888',
  textAlign: 'center',
  marginTop: 4,
});

const RightContent = styled(Box)({
  flex: 1,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
});

const PreviewContainer = styled(Box)({
  flex: 1,
  backgroundColor: '#161616',
  borderRadius: 6,
  border: '1px solid #333',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

const PreviewHeader = styled(Box)({
  padding: '8px 12px',
  borderBottom: '1px solid #333',
  backgroundColor: '#1a1a1a',
});

const PreviewTitle = styled(Typography)({
  fontSize: 11,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
});

const PreviewGrid = styled(Box)({
  flex: 1,
  padding: 12,
  display: 'flex',
  gap: 8,
  minHeight: 0,
});

const TileContainer = styled(Box)({
  backgroundColor: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const TileHeader = styled(Box)({
  padding: '6px 8px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
});

const TileContent = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#444',
  fontSize: 11,
});

const StyledSelect = styled(Select)({
  fontSize: 11,
  height: 24,
  minWidth: 100,
  backgroundColor: '#252525',
  color: '#ccc',
  '& .MuiSelect-select': {
    padding: '2px 8px',
    paddingRight: '24px !important',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#444',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#666',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#19abb5',
  },
  '& .MuiSvgIcon-root': {
    color: '#666',
    fontSize: 16,
  },
});

const StyledMenuItem = styled(MenuItem)({
  fontSize: 11,
  padding: '6px 12px',
  '&.Mui-selected': {
    backgroundColor: 'rgba(25, 171, 181, 0.15)',
    '&:hover': {
      backgroundColor: 'rgba(25, 171, 181, 0.2)',
    },
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const ModalFooter = styled(Box)({
  display: 'flex',
  justifyContent: 'flex-end',
  padding: '12px 16px',
  borderTop: '1px solid #333',
  backgroundColor: '#1a1a1a',
});

const OpenButton = styled(Button)<{ $disabled: boolean }>(({ $disabled }) => ({
  backgroundColor: $disabled ? '#333' : '#19abb5',
  color: $disabled ? '#666' : '#fff',
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 20px',
  textTransform: 'none',
  cursor: $disabled ? 'not-allowed' : 'pointer',
  '&:hover': {
    backgroundColor: $disabled ? '#333' : '#1bc4d0',
  },
  '&.Mui-disabled': {
    backgroundColor: '#333',
    color: '#666',
  },
}));

// ============================================================================
// LAYOUT THUMBNAIL SVG COMPONENTS
// ============================================================================

const TwoAcrossSvg = () => (
  <svg width="52" height="36" viewBox="0 0 52 36">
    <rect x="1" y="1" width="24" height="34" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="27" y="1" width="24" height="34" fill="none" stroke="#666" strokeWidth="1" rx="2" />
  </svg>
);

const TwoStackedSvg = () => (
  <svg width="52" height="36" viewBox="0 0 52 36">
    <rect x="1" y="1" width="50" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="1" y="19" width="50" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
  </svg>
);

const TwoLeftOneRightSvg = () => (
  <svg width="52" height="36" viewBox="0 0 52 36">
    <rect x="1" y="1" width="24" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="1" y="19" width="24" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="27" y="1" width="24" height="34" fill="none" stroke="#666" strokeWidth="1" rx="2" />
  </svg>
);

const OneLeftTwoRightSvg = () => (
  <svg width="52" height="36" viewBox="0 0 52 36">
    <rect x="1" y="1" width="24" height="34" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="27" y="1" width="24" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="27" y="19" width="24" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
  </svg>
);

const ThreeAcrossSvg = () => (
  <svg width="52" height="36" viewBox="0 0 52 36">
    <rect x="1" y="1" width="16" height="34" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="18" y="1" width="16" height="34" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="35" y="1" width="16" height="34" fill="none" stroke="#666" strokeWidth="1" rx="2" />
  </svg>
);

const TwoByTwoSvg = () => (
  <svg width="52" height="36" viewBox="0 0 52 36">
    <rect x="1" y="1" width="24" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="27" y="1" width="24" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="1" y="19" width="24" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
    <rect x="27" y="19" width="24" height="16" fill="none" stroke="#666" strokeWidth="1" rx="2" />
  </svg>
);

const LAYOUT_ICONS: Record<LayoutType, React.FC> = {
  'two-across': TwoAcrossSvg,
  'two-stacked': TwoStackedSvg,
  'two-left-one-right': TwoLeftOneRightSvg,
  'one-left-two-right': OneLeftTwoRightSvg,
  'three-across': ThreeAcrossSvg,
  'two-by-two': TwoByTwoSvg,
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface MultiViewLayoutPickerProps {
  open: boolean;
  onClose: () => void;
  onOpenMultiView?: (layout: LayoutType, assignments: TileAssignments) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MultiViewLayoutPicker: React.FC<MultiViewLayoutPickerProps> = ({
  open,
  onClose,
  onOpenMultiView,
}) => {
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>('two-across');
  const [tileAssignments, setTileAssignments] = useState<TileAssignments>({
    tile1: 'video-viewer',
    tile2: 'audio-viewer',
    tile3: null,
    tile4: null,
  });

  // Get active session info for naming the window
  const activeSessionId = useAppPersistence((state) => state.activeSessionId);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleLayoutSelect = useCallback((layout: LayoutType) => {
    setSelectedLayout(layout);
  }, []);

  const handleTileAssignment = useCallback((tile: keyof TileAssignments) => (event: SelectChangeEvent<string>) => {
    const value = event.target.value as ToolType | 'none';
    setTileAssignments(prev => ({
      ...prev,
      [tile]: value === 'none' ? null : value,
    }));
  }, []);

  const currentLayoutConfig = LAYOUTS.find(l => l.id === selectedLayout)!;
  const numTiles = currentLayoutConfig.tiles;

  // Check if at least one tool is selected
  const hasToolSelected = Object.values(tileAssignments)
    .slice(0, numTiles)
    .some(tool => tool !== null);

  const handleOpenMultiView = useCallback(() => {
    if (!hasToolSelected) return;

    // Initialize the sync service in the main window
    multiViewSyncService.init();

    // Get layout config for window size
    const layoutConfig = getLayoutConfig(selectedLayout);
    const windowWidth = layoutConfig?.defaultWidth || 1200;
    const windowHeight = layoutConfig?.defaultHeight || 800;

    // Build the multi-view URL
    const sessionName = activeSessionId ? `Session_${activeSessionId.slice(0, 8)}` : 'Multi-View Session';
    const url = buildMultiViewUrl(selectedLayout, tileAssignments, activeSessionId || undefined, sessionName);

    // Calculate window position (center on screen or offset from main window)
    const left = Math.max(0, (window.screen.width - windowWidth) / 2);
    const top = Math.max(0, (window.screen.height - windowHeight) / 2);

    // Open the multi-view window
    const windowFeatures = [
      `width=${windowWidth}`,
      `height=${windowHeight}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=no',
    ].join(',');

    const multiViewWindow = window.open(url, 'tacctile-multiview', windowFeatures);

    // Focus the new window if it opened successfully
    if (multiViewWindow) {
      multiViewWindow.focus();
    }

    // Call the optional callback if provided
    if (onOpenMultiView) {
      onOpenMultiView(selectedLayout, tileAssignments);
    }

    // Close the modal
    onClose();
  }, [hasToolSelected, selectedLayout, tileAssignments, activeSessionId, onOpenMultiView, onClose]);

  // Render layout preview based on selected layout
  const renderLayoutPreview = () => {
    const tiles = ['tile1', 'tile2', 'tile3', 'tile4'].slice(0, numTiles) as (keyof TileAssignments)[];

    const getTileStyle = (index: number): React.CSSProperties => {
      switch (selectedLayout) {
        case 'two-across':
          return { flex: 1 };
        case 'two-stacked':
          return { flex: 1, width: '100%' };
        case 'two-left-one-right':
          if (index < 2) return { flex: 1, width: '100%' };
          return { flex: 1 };
        case 'one-left-two-right':
          if (index === 0) return { flex: 1 };
          return { flex: 1, width: '100%' };
        case 'three-across':
          return { flex: 1 };
        case 'two-by-two':
          return { flex: 1 };
        default:
          return { flex: 1 };
      }
    };

    const getGridStyle = (): React.CSSProperties => {
      switch (selectedLayout) {
        case 'two-across':
          return { flexDirection: 'row' };
        case 'two-stacked':
          return { flexDirection: 'column' };
        case 'two-left-one-right':
          return { flexDirection: 'row' };
        case 'one-left-two-right':
          return { flexDirection: 'row' };
        case 'three-across':
          return { flexDirection: 'row' };
        case 'two-by-two':
          return { flexDirection: 'row', flexWrap: 'wrap' };
        default:
          return { flexDirection: 'row' };
      }
    };

    const renderTwoLeftOneRight = () => (
      <>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {tiles.slice(0, 2).map((tile, index) => (
            <TileContainer key={tile} sx={getTileStyle(index)}>
              <TileHeader>
                <FormControl fullWidth size="small">
                  <StyledSelect
                    value={tileAssignments[tile] || 'none'}
                    onChange={handleTileAssignment(tile)}
                    displayEmpty
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#252525',
                          border: '1px solid #333',
                        },
                      },
                    }}
                  >
                    {TOOLS.map(tool => (
                      <StyledMenuItem key={tool.id || 'none'} value={tool.id || 'none'}>
                        {tool.name}
                      </StyledMenuItem>
                    ))}
                  </StyledSelect>
                </FormControl>
              </TileHeader>
              <TileContent>
                {tileAssignments[tile]
                  ? TOOLS.find(t => t.id === tileAssignments[tile])?.name
                  : 'Empty'}
              </TileContent>
            </TileContainer>
          ))}
        </Box>
        <TileContainer sx={{ flex: 1 }}>
          <TileHeader>
            <FormControl fullWidth size="small">
              <StyledSelect
                value={tileAssignments.tile3 || 'none'}
                onChange={handleTileAssignment('tile3')}
                displayEmpty
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#252525',
                      border: '1px solid #333',
                    },
                  },
                }}
              >
                {TOOLS.map(tool => (
                  <StyledMenuItem key={tool.id || 'none'} value={tool.id || 'none'}>
                    {tool.name}
                  </StyledMenuItem>
                ))}
              </StyledSelect>
            </FormControl>
          </TileHeader>
          <TileContent>
            {tileAssignments.tile3
              ? TOOLS.find(t => t.id === tileAssignments.tile3)?.name
              : 'Empty'}
          </TileContent>
        </TileContainer>
      </>
    );

    const renderOneLeftTwoRight = () => (
      <>
        <TileContainer sx={{ flex: 1 }}>
          <TileHeader>
            <FormControl fullWidth size="small">
              <StyledSelect
                value={tileAssignments.tile1 || 'none'}
                onChange={handleTileAssignment('tile1')}
                displayEmpty
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#252525',
                      border: '1px solid #333',
                    },
                  },
                }}
              >
                {TOOLS.map(tool => (
                  <StyledMenuItem key={tool.id || 'none'} value={tool.id || 'none'}>
                    {tool.name}
                  </StyledMenuItem>
                ))}
              </StyledSelect>
            </FormControl>
          </TileHeader>
          <TileContent>
            {tileAssignments.tile1
              ? TOOLS.find(t => t.id === tileAssignments.tile1)?.name
              : 'Empty'}
          </TileContent>
        </TileContainer>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {(['tile2', 'tile3'] as (keyof TileAssignments)[]).map((tile) => (
            <TileContainer key={tile} sx={{ flex: 1 }}>
              <TileHeader>
                <FormControl fullWidth size="small">
                  <StyledSelect
                    value={tileAssignments[tile] || 'none'}
                    onChange={handleTileAssignment(tile)}
                    displayEmpty
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#252525',
                          border: '1px solid #333',
                        },
                      },
                    }}
                  >
                    {TOOLS.map(tool => (
                      <StyledMenuItem key={tool.id || 'none'} value={tool.id || 'none'}>
                        {tool.name}
                      </StyledMenuItem>
                    ))}
                  </StyledSelect>
                </FormControl>
              </TileHeader>
              <TileContent>
                {tileAssignments[tile]
                  ? TOOLS.find(t => t.id === tileAssignments[tile])?.name
                  : 'Empty'}
              </TileContent>
            </TileContainer>
          ))}
        </Box>
      </>
    );

    const renderTwoByTwo = () => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
          {(['tile1', 'tile2'] as (keyof TileAssignments)[]).map((tile) => (
            <TileContainer key={tile} sx={{ flex: 1 }}>
              <TileHeader>
                <FormControl fullWidth size="small">
                  <StyledSelect
                    value={tileAssignments[tile] || 'none'}
                    onChange={handleTileAssignment(tile)}
                    displayEmpty
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#252525',
                          border: '1px solid #333',
                        },
                      },
                    }}
                  >
                    {TOOLS.map(tool => (
                      <StyledMenuItem key={tool.id || 'none'} value={tool.id || 'none'}>
                        {tool.name}
                      </StyledMenuItem>
                    ))}
                  </StyledSelect>
                </FormControl>
              </TileHeader>
              <TileContent>
                {tileAssignments[tile]
                  ? TOOLS.find(t => t.id === tileAssignments[tile])?.name
                  : 'Empty'}
              </TileContent>
            </TileContainer>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
          {(['tile3', 'tile4'] as (keyof TileAssignments)[]).map((tile) => (
            <TileContainer key={tile} sx={{ flex: 1 }}>
              <TileHeader>
                <FormControl fullWidth size="small">
                  <StyledSelect
                    value={tileAssignments[tile] || 'none'}
                    onChange={handleTileAssignment(tile)}
                    displayEmpty
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#252525',
                          border: '1px solid #333',
                        },
                      },
                    }}
                  >
                    {TOOLS.map(tool => (
                      <StyledMenuItem key={tool.id || 'none'} value={tool.id || 'none'}>
                        {tool.name}
                      </StyledMenuItem>
                    ))}
                  </StyledSelect>
                </FormControl>
              </TileHeader>
              <TileContent>
                {tileAssignments[tile]
                  ? TOOLS.find(t => t.id === tileAssignments[tile])?.name
                  : 'Empty'}
              </TileContent>
            </TileContainer>
          ))}
        </Box>
      </Box>
    );

    const renderSimpleLayout = () => (
      <>
        {tiles.map((tile, index) => (
          <TileContainer key={tile} sx={getTileStyle(index)}>
            <TileHeader>
              <FormControl fullWidth size="small">
                <StyledSelect
                  value={tileAssignments[tile] || 'none'}
                  onChange={handleTileAssignment(tile)}
                  displayEmpty
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: '#252525',
                        border: '1px solid #333',
                      },
                    },
                  }}
                >
                  {TOOLS.map(tool => (
                    <StyledMenuItem key={tool.id || 'none'} value={tool.id || 'none'}>
                      {tool.name}
                    </StyledMenuItem>
                  ))}
                </StyledSelect>
              </FormControl>
            </TileHeader>
            <TileContent>
              {tileAssignments[tile]
                ? TOOLS.find(t => t.id === tileAssignments[tile])?.name
                : 'Empty'}
            </TileContent>
          </TileContainer>
        ))}
      </>
    );

    if (selectedLayout === 'two-left-one-right') return renderTwoLeftOneRight();
    if (selectedLayout === 'one-left-two-right') return renderOneLeftTwoRight();
    if (selectedLayout === 'two-by-two') return renderTwoByTwo();

    return (
      <PreviewGrid sx={getGridStyle()}>
        {renderSimpleLayout()}
      </PreviewGrid>
    );
  };

  if (!open) return null;

  return (
    <Backdrop onClick={handleBackdropClick}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <ModalHeader>
          <HeaderTitle>Multi-View Setup</HeaderTitle>
          <CloseButton onClick={onClose}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </CloseButton>
        </ModalHeader>

        {/* Body */}
        <ModalBody>
          {/* Left Sidebar - Layout Thumbnails */}
          <LeftSidebar>
            {LAYOUTS.map((layout) => {
              const IconComponent = LAYOUT_ICONS[layout.id];
              return (
                <Box key={layout.id} sx={{ textAlign: 'center' }}>
                  <LayoutThumbnail
                    $selected={selectedLayout === layout.id}
                    onClick={() => handleLayoutSelect(layout.id)}
                  >
                    <IconComponent />
                  </LayoutThumbnail>
                  <ThumbnailLabel>{layout.name}</ThumbnailLabel>
                </Box>
              );
            })}
          </LeftSidebar>

          {/* Right Content - Layout Preview */}
          <RightContent>
            <PreviewContainer>
              <PreviewHeader>
                <PreviewTitle>Layout Preview</PreviewTitle>
              </PreviewHeader>
              <PreviewGrid
                sx={{
                  flexDirection: selectedLayout === 'two-stacked' ? 'column' : 'row',
                }}
              >
                {renderLayoutPreview()}
              </PreviewGrid>
            </PreviewContainer>
          </RightContent>
        </ModalBody>

        {/* Footer */}
        <ModalFooter>
          <OpenButton
            $disabled={!hasToolSelected}
            disabled={!hasToolSelected}
            onClick={handleOpenMultiView}
          >
            Open Multi-View
          </OpenButton>
        </ModalFooter>
      </ModalContainer>
    </Backdrop>
  );
};

export default MultiViewLayoutPicker;
