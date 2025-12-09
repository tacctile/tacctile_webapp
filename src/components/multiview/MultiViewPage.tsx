/**
 * MultiViewPage Component
 * Main page component for the multi-view pop-out window
 * Renders the selected layout with assigned tool viewers
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import { styled, ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { MultiViewHeader } from './MultiViewHeader';
import { MultiViewTileHeader } from './MultiViewTileHeader';
import {
  VideoViewer,
  AudioViewer,
  TimelineViewer,
  NotesViewer,
  ImagesViewer,
  FlagsViewer,
} from './viewers';
import { useMultiViewSync } from '@/hooks/useMultiViewSync';
import {
  MultiViewLayoutType,
  MultiViewToolType,
  TileAssignments,
  parseMultiViewParams,
} from '@/types/multiview';

// Dark theme for multi-view window
const multiViewTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#19abb5' },
    background: {
      default: '#0a0a0a',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 13,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0a0a0a',
          scrollbarWidth: 'thin',
          scrollbarColor: '#333 #1a1a1a',
        },
      },
    },
  },
});

// Styled components
const PageContainer = styled(Box)({
  width: '100vw',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

const LayoutContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  overflow: 'hidden',
});

const Tile = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#121212',
  border: '1px solid #333',
  overflow: 'hidden',
});

const TileContent = styled(Box)({
  flex: 1,
  overflow: 'hidden',
});

const EmptyTile = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#444',
  fontSize: 14,
});

// Helper to render the appropriate viewer component
const renderViewer = (tool: MultiViewToolType): React.ReactNode => {
  switch (tool) {
    case 'video-viewer':
      return <VideoViewer />;
    case 'audio-viewer':
      return <AudioViewer />;
    case 'timeline':
      return <TimelineViewer />;
    case 'notes':
      return <NotesViewer />;
    case 'images':
      return <ImagesViewer />;
    case 'flags':
      return <FlagsViewer />;
    default:
      return <EmptyTile>Select a tool</EmptyTile>;
  }
};

interface MultiViewPageProps {
  // Props can be passed if needed, but we primarily read from URL params
}

export const MultiViewPage: React.FC<MultiViewPageProps> = () => {
  // Parse URL parameters
  const initialParams = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return parseMultiViewParams(searchParams);
  }, []);

  const [layout, setLayout] = useState<MultiViewLayoutType>(initialParams.layout);
  const [tiles, setTiles] = useState<TileAssignments>(initialParams.tiles);
  const [sessionName] = useState(initialParams.sessionName || 'Multi-View Session');

  // Initialize sync
  useMultiViewSync({
    syncPlayhead: true,
    syncPlayState: true,
    syncSpeed: true,
  });

  // Update URL when tiles change
  const updateUrlParams = useCallback((newTiles: TileAssignments) => {
    const params = new URLSearchParams();
    params.set('layout', layout);
    if (newTiles.tile1) params.set('tile1', newTiles.tile1);
    if (newTiles.tile2) params.set('tile2', newTiles.tile2);
    if (newTiles.tile3) params.set('tile3', newTiles.tile3);
    if (newTiles.tile4) params.set('tile4', newTiles.tile4);
    if (initialParams.sessionId) params.set('sessionId', initialParams.sessionId);
    if (initialParams.sessionName) params.set('sessionName', initialParams.sessionName);

    const newUrl = `/multiview?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [layout, initialParams.sessionId, initialParams.sessionName]);

  // Handle tile tool change
  const handleTileChange = useCallback((tileKey: keyof TileAssignments, tool: MultiViewToolType) => {
    setTiles(prev => {
      const newTiles = { ...prev, [tileKey]: tool };
      updateUrlParams(newTiles);
      return newTiles;
    });
  }, [updateUrlParams]);

  // Render tile with header and viewer
  const renderTile = (tileKey: keyof TileAssignments, style?: React.CSSProperties) => (
    <Tile sx={style}>
      <MultiViewTileHeader
        tool={tiles[tileKey]}
        onToolChange={(tool) => handleTileChange(tileKey, tool)}
        tileIndex={parseInt(tileKey.replace('tile', '')) - 1}
      />
      <TileContent>
        {renderViewer(tiles[tileKey])}
      </TileContent>
    </Tile>
  );

  // Render layout based on type
  const renderLayout = () => {
    switch (layout) {
      case 'two-across':
        return (
          <LayoutContainer sx={{ flexDirection: 'row' }}>
            {renderTile('tile1', { flex: 1 })}
            {renderTile('tile2', { flex: 1 })}
          </LayoutContainer>
        );

      case 'two-stacked':
        return (
          <LayoutContainer sx={{ flexDirection: 'column' }}>
            {renderTile('tile1', { flex: 1 })}
            {renderTile('tile2', { flex: 1 })}
          </LayoutContainer>
        );

      case 'two-left-one-right':
        return (
          <LayoutContainer sx={{ flexDirection: 'row' }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {renderTile('tile1', { flex: 1 })}
              {renderTile('tile2', { flex: 1 })}
            </Box>
            {renderTile('tile3', { flex: 1 })}
          </LayoutContainer>
        );

      case 'one-left-two-right':
        return (
          <LayoutContainer sx={{ flexDirection: 'row' }}>
            {renderTile('tile1', { flex: 1 })}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {renderTile('tile2', { flex: 1 })}
              {renderTile('tile3', { flex: 1 })}
            </Box>
          </LayoutContainer>
        );

      case 'three-across':
        return (
          <LayoutContainer sx={{ flexDirection: 'row' }}>
            {renderTile('tile1', { flex: 1 })}
            {renderTile('tile2', { flex: 1 })}
            {renderTile('tile3', { flex: 1 })}
          </LayoutContainer>
        );

      case 'two-by-two':
        return (
          <LayoutContainer sx={{ flexDirection: 'column' }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
              {renderTile('tile1', { flex: 1 })}
              {renderTile('tile2', { flex: 1 })}
            </Box>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
              {renderTile('tile3', { flex: 1 })}
              {renderTile('tile4', { flex: 1 })}
            </Box>
          </LayoutContainer>
        );

      default:
        return (
          <LayoutContainer sx={{ flexDirection: 'row' }}>
            {renderTile('tile1', { flex: 1 })}
            {renderTile('tile2', { flex: 1 })}
          </LayoutContainer>
        );
    }
  };

  return (
    <ThemeProvider theme={multiViewTheme}>
      <CssBaseline />
      <PageContainer>
        <MultiViewHeader sessionName={sessionName} />
        {renderLayout()}
      </PageContainer>
    </ThemeProvider>
  );
};

export default MultiViewPage;
