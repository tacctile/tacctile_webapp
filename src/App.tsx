import React, { useState, useCallback, Suspense, lazy, useMemo } from 'react';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import ActivityBar from '@/components/layout/ActivityBar';
import SidePanel from '@/components/layout/SidePanel';
import EditorArea from '@/components/layout/EditorArea';
import BottomPanel from '@/components/layout/BottomPanel';
import StatusBar from '@/components/layout/StatusBar';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { ErrorBoundary, LoadingSkeleton } from '@/components/common';
import { useKeyboardShortcuts, createNavigationShortcuts, createViewShortcuts, createEditingShortcuts } from '@/hooks/useKeyboardShortcuts';

// Lazy load heavy tool components - only load when user opens that tool
const StreamingTool = lazy(() => import('@/components/streaming-tool/StreamingTool'));
const SessionTimeline = lazy(() => import('@/components/session-timeline/SessionTimeline'));
const AudioTool = lazy(() => import('@/components/audio-tool/AudioTool'));
const ImageTool = lazy(() => import('@/components/image-tool/ImageTool'));

// Tool IDs for navigation
const TOOLS = ['session', 'video', 'audio', 'images', 'streaming'] as const;
type ToolId = typeof TOOLS[number];

// Material 3 Dark Theme with Tacctile Brand Colors
const createAppTheme = (isMobile: boolean) => createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    primary: {
      main: '#19abb5',     // Primary brand color
      light: '#36d1da',    // Lighter variant
      dark: '#1992a1',     // Darker variant for hover
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#75e7eb',     // Bright accent
      light: '#aef2f3',    // Secondary highlight
      dark: '#36d1da',     // Alternate primary
    },
    error: {
      main: '#cf6679',
    },
    text: {
      primary: '#e1e1e1',
      secondary: '#aaaaaa',
    },
    action: {
      active: '#19abb5',
      hover: 'rgba(25, 171, 181, 0.08)',
      selected: 'rgba(25, 171, 181, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
  },
  typography: {
    fontFamily: '"Manrope", sans-serif',
    fontSize: isMobile ? 14 : 13,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: { fontFamily: '"Manrope", sans-serif', fontWeight: 700 },
    h2: { fontFamily: '"Manrope", sans-serif', fontWeight: 700 },
    h3: { fontFamily: '"Manrope", sans-serif', fontWeight: 600 },
    h4: { fontFamily: '"Manrope", sans-serif', fontWeight: 600 },
    h5: { fontFamily: '"Manrope", sans-serif', fontWeight: 500 },
    h6: { fontFamily: '"Manrope", sans-serif', fontWeight: 500 },
    subtitle1: { fontFamily: '"Manrope", sans-serif', fontWeight: 500 },
    subtitle2: { fontFamily: '"Manrope", sans-serif', fontWeight: 500 },
    body1: { fontFamily: '"Manrope", sans-serif', fontWeight: 400 },
    body2: { fontFamily: '"Manrope", sans-serif', fontWeight: 400 },
    button: { fontFamily: '"Manrope", sans-serif', fontWeight: 500 },
    caption: { fontFamily: '"Manrope", sans-serif', fontWeight: 400 },
    overline: { fontFamily: '"Manrope", sans-serif', fontWeight: 400 },
  },
  shape: {
    borderRadius: 4,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,   // Tablet portrait
      lg: 1200,  // Tablet landscape / small desktop
      xl: 1536,  // Large desktop
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#6b6b6b #2b2b2b',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: isMobile ? 6 : 10,
            height: isMobile ? 6 : 10,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 5,
            backgroundColor: '#6b6b6b',
            minHeight: 24,
            border: `${isMobile ? 1 : 2}px solid #2b2b2b`,
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            borderRadius: 5,
            backgroundColor: '#2b2b2b',
          },
          // Touch scrolling improvements
          WebkitOverflowScrolling: 'touch',
        },
      },
    },
    // Touch-friendly button sizes for mobile
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: isMobile ? 12 : 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: isMobile ? 44 : 36,
        },
      },
    },
  },
});

const ACTIVITY_BAR_EXPANDED_KEY = 'tacctile_activity_bar_expanded';

// Loading fallback component with skeleton matching tool type
const ToolLoadingFallback: React.FC<{ tool: ToolId }> = ({ tool }) => {
  const variant = useMemo(() => {
    switch (tool) {
      case 'audio': return 'audio';
      case 'images': return 'image';
      case 'streaming': return 'streaming';
      case 'session': return 'timeline';
      default: return 'generic';
    }
  }, [tool]);

  return <LoadingSkeleton variant={variant} />;
};

const App: React.FC = () => {
  // Responsive breakpoints
  const isMobile = useMediaQuery('(max-width:600px)');
  const isTablet = useMediaQuery('(min-width:600px) and (max-width:1200px)');
  const isDesktop = useMediaQuery('(min-width:1200px)');

  // Create theme based on device
  const theme = useMemo(() => createAppTheme(isMobile), [isMobile]);

  const [activityBarExpanded, setActivityBarExpanded] = useState(() => {
    const saved = localStorage.getItem(ACTIVITY_BAR_EXPANDED_KEY);
    // Default to collapsed on mobile/tablet
    if (isMobile || isTablet) return false;
    return saved === 'true';
  });
  const [sidePanelVisible, setSidePanelVisible] = useState(!isMobile);
  const [sidePanelWidth, setSidePanelWidth] = useState(isTablet ? 200 : 250);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(!isMobile && !isTablet);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [selectedTool, setSelectedTool] = useState<ToolId>('session');
  const [openTabs, setOpenTabs] = useState<Array<{id: string, title: string, pinned: boolean}>>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const handleActivityBarToggle = useCallback(() => {
    setActivityBarExpanded(prev => {
      const newValue = !prev;
      localStorage.setItem(ACTIVITY_BAR_EXPANDED_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const handleToolSelect = useCallback((toolId: string) => {
    setSelectedTool(toolId as ToolId);
    // On mobile, close side panel when selecting tool
    if (isMobile) {
      setSidePanelVisible(false);
    } else {
      setSidePanelVisible(true);
    }
  }, [isMobile]);

  const handleOpenFile = useCallback((file: { id: string; name: string }) => {
    const existingTab = openTabs.find(tab => tab.id === file.id);
    if (!existingTab) {
      setOpenTabs([...openTabs, { id: file.id, title: file.name, pinned: false }]);
    }
    setActiveTab(file.id);
  }, [openTabs]);

  const handleCloseTab = useCallback((tabId: string) => {
    setOpenTabs(openTabs.filter(tab => tab.id !== tabId));
    if (activeTab === tabId) {
      setActiveTab(openTabs.length > 1 ? openTabs[0].id : null);
    }
  }, [openTabs, activeTab]);

  const handlePinTab = useCallback((tabId: string) => {
    setOpenTabs(openTabs.map(tab =>
      tab.id === tabId ? { ...tab, pinned: !tab.pinned } : tab
    ));
  }, [openTabs]);

  // Navigation shortcuts
  const navigateTool = useCallback((index: number) => {
    if (index >= 0 && index < TOOLS.length) {
      setSelectedTool(TOOLS[index]);
    }
  }, []);

  const prevTool = useCallback(() => {
    const currentIndex = TOOLS.indexOf(selectedTool);
    navigateTool(currentIndex > 0 ? currentIndex - 1 : TOOLS.length - 1);
  }, [selectedTool, navigateTool]);

  const nextTool = useCallback(() => {
    const currentIndex = TOOLS.indexOf(selectedTool);
    navigateTool(currentIndex < TOOLS.length - 1 ? currentIndex + 1 : 0);
  }, [selectedTool, navigateTool]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    ...createNavigationShortcuts({
      goToSession: () => setSelectedTool('session'),
      goToVideo: () => setSelectedTool('video'),
      goToAudio: () => setSelectedTool('audio'),
      goToImages: () => setSelectedTool('images'),
      goToStreaming: () => setSelectedTool('streaming'),
      prevTool,
      nextTool,
    }),
    ...createViewShortcuts({
      toggleFullscreen,
      toggleSidePanel: () => setSidePanelVisible(v => !v),
      toggleBottomPanel: () => setBottomPanelVisible(v => !v),
    }),
    ...createEditingShortcuts({}),
    // F11 fullscreen override
    {
      key: 'F11',
      description: 'Toggle fullscreen',
      handler: toggleFullscreen,
      category: 'view' as const,
    },
    // Escape to close panels on mobile
    {
      key: 'Escape',
      description: 'Close panels',
      handler: () => {
        if (isMobile) {
          setSidePanelVisible(false);
        }
      },
      category: 'view' as const,
      enabled: isMobile,
    },
  ], [prevTool, nextTool, toggleFullscreen, isMobile]);

  useKeyboardShortcuts(shortcuts);

  // Render the currently selected tool with lazy loading
  const renderTool = useCallback(() => {
    const toolFallback = <ToolLoadingFallback tool={selectedTool} />;

    switch (selectedTool) {
      case 'session':
        return (
          <ErrorBoundary toolName="Session Timeline">
            <Suspense fallback={toolFallback}>
              <SessionTimeline investigationId="current-investigation" />
            </Suspense>
          </ErrorBoundary>
        );
      case 'streaming':
        return (
          <ErrorBoundary toolName="Streaming Tool">
            <Suspense fallback={toolFallback}>
              <StreamingTool
                investigationId="current-investigation"
                onStreamStart={() => {}}
                onStreamStop={() => {}}
                onRecordingStart={() => {}}
                onRecordingStop={() => {}}
              />
            </Suspense>
          </ErrorBoundary>
        );
      case 'audio':
        return (
          <ErrorBoundary toolName="Audio Tool">
            <Suspense fallback={toolFallback}>
              <AudioTool investigationId="current-investigation" />
            </Suspense>
          </ErrorBoundary>
        );
      case 'images':
        return (
          <ErrorBoundary toolName="Image Tool">
            <Suspense fallback={toolFallback}>
              <ImageTool investigationId="current-investigation" />
            </Suspense>
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary toolName="Editor">
            <>
              {/* Editor Area */}
              <EditorArea
                tabs={openTabs}
                activeTab={activeTab}
                onTabSelect={setActiveTab}
                onTabClose={handleCloseTab}
                onTabPin={handlePinTab}
                onTabReorder={setOpenTabs}
              />

              {/* Bottom Panel - hidden on mobile */}
              {bottomPanelVisible && !isMobile && (
                <BottomPanel
                  height={bottomPanelHeight}
                  onResize={setBottomPanelHeight}
                  onClose={() => setBottomPanelVisible(false)}
                />
              )}
            </>
          </ErrorBoundary>
        );
    }
  }, [selectedTool, openTabs, activeTab, handleCloseTab, handlePinTab, bottomPanelVisible, bottomPanelHeight, isMobile]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LayoutProvider>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
            bgcolor: 'background.default',
            overflow: 'hidden',
            // Prevent pull-to-refresh on mobile
            overscrollBehavior: 'none',
            // Safe area insets for notched devices
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          {/* Main Layout */}
          <Box sx={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            // Stack vertically on very small screens
            flexDirection: { xs: 'column', sm: 'row' },
          }}>
            {/* Activity Bar - bottom on mobile, left on tablet/desktop */}
            <Box
              sx={{
                order: { xs: 1, sm: 0 },
                // On mobile, show as bottom nav bar
                position: { xs: 'fixed', sm: 'relative' },
                bottom: { xs: 0, sm: 'auto' },
                left: { xs: 0, sm: 'auto' },
                right: { xs: 0, sm: 'auto' },
                zIndex: { xs: 1200, sm: 'auto' },
                backgroundColor: { xs: '#1a1a1a', sm: 'transparent' },
                borderTop: { xs: '1px solid #2b2b2b', sm: 'none' },
              }}
            >
              <ActivityBar
                expanded={activityBarExpanded && isDesktop}
                selectedTool={selectedTool}
                onToolSelect={handleToolSelect}
                onToggle={handleActivityBarToggle}
                compact={isMobile || isTablet}
              />
            </Box>

            {/* Side Panel - slide over on mobile */}
            {sidePanelVisible && (
              <Box
                sx={{
                  // On mobile, overlay the content
                  position: { xs: 'fixed', sm: 'relative' },
                  top: { xs: 0, sm: 'auto' },
                  left: { xs: 0, sm: 'auto' },
                  bottom: { xs: 56, sm: 'auto' }, // Leave room for bottom nav
                  zIndex: { xs: 1100, sm: 'auto' },
                  width: { xs: '85vw', sm: 'auto' },
                  maxWidth: { xs: 320, sm: 'none' },
                  height: { xs: 'auto', sm: '100%' },
                  boxShadow: { xs: '4px 0 20px rgba(0,0,0,0.5)', sm: 'none' },
                }}
              >
                <SidePanel
                  width={isMobile ? 280 : sidePanelWidth}
                  selectedTool={selectedTool}
                  onResize={isMobile ? undefined : setSidePanelWidth}
                  onClose={() => setSidePanelVisible(false)}
                  onFileOpen={handleOpenFile}
                />
              </Box>
            )}

            {/* Backdrop for mobile side panel */}
            {sidePanelVisible && isMobile && (
              <Box
                onClick={() => setSidePanelVisible(false)}
                sx={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 56,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  zIndex: 1050,
                }}
              />
            )}

            {/* Main Content Area */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              // Add padding at bottom for mobile nav bar
              pb: { xs: '56px', sm: 0 },
            }}>
              {renderTool()}
            </Box>
          </Box>

          {/* Status Bar - hidden on mobile */}
          {!isMobile && (
            <StatusBar
              investigationName="Investigation_2024_01"
              currentTool={selectedTool}
              syncStatus="synced"
            />
          )}
        </Box>
      </LayoutProvider>
    </ThemeProvider>
  );
};

export default App;
