import React, { useState, useCallback, Suspense, lazy, useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import ActivityBar from '@/components/layout/ActivityBar';
import EditorArea from '@/components/layout/EditorArea';
import BottomPanel from '@/components/layout/BottomPanel';
import StatusBar from '@/components/layout/StatusBar';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { ErrorBoundary, LoadingSkeleton } from '@/components/common';
import { useKeyboardShortcuts, createNavigationShortcuts, createViewShortcuts, createEditingShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useNavigationStore } from '@/stores/useNavigationStore';

// Lazy load heavy tool components - only load when user opens that tool
const HomePage = lazy(() => import('@/components/home/HomePage'));
const StreamingTool = lazy(() => import('@/components/streaming-tool/StreamingTool'));
const SessionTimeline = lazy(() => import('@/components/session-timeline/SessionTimeline'));
const AudioTool = lazy(() => import('@/components/audio-tool/AudioTool'));
const ImageTool = lazy(() => import('@/components/image-tool/ImageTool'));
const VideoTool = lazy(() => import('@/components/video-tool/VideoTool'));
const WorkspaceDemo = lazy(() => import('@/pages/WorkspaceDemo'));

// Tool IDs for navigation
const TOOLS = ['home', 'session', 'video', 'audio', 'images', 'streaming', 'workspace-demo'] as const;
type ToolId = typeof TOOLS[number];

// Professional DaVinci-style Dark Theme
const createAppTheme = (isMobile: boolean) => createTheme({
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 13,
    h1: { fontSize: '1.5rem', fontWeight: 600 },
    h2: { fontSize: '1.25rem', fontWeight: 600 },
    h3: { fontSize: '1.1rem', fontWeight: 600 },
    h4: { fontSize: '1rem', fontWeight: 600 },
    h5: { fontSize: '0.9rem', fontWeight: 600 },
    h6: { fontSize: '0.8rem', fontWeight: 600 },
    body1: { fontSize: '0.8125rem', lineHeight: 1.5 },
    body2: { fontSize: '0.75rem', lineHeight: 1.4 },
    caption: { fontSize: '0.6875rem' },
    button: { fontSize: '0.75rem', fontWeight: 500 },
  },
  shape: {
    borderRadius: 2,
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#19abb5',
      dark: '#147a82',
      light: '#4dc4cc',
    },
    secondary: {
      main: '#808080',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    divider: '#252525',
    text: {
      primary: '#cccccc',
      secondary: '#808080',
      disabled: '#5a5a5a',
    },
    error: { main: '#c45c5c' },
    warning: { main: '#c4995c' },
    success: { main: '#5a9a6b' },
    info: { main: '#5a7fbf' },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#121212',
          scrollbarWidth: 'thin',
          scrollbarColor: '#333 #1a1a1a',
          '&::-webkit-scrollbar': {
            width: 6,
            height: 6,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#1a1a1a',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#333',
            borderRadius: 3,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          padding: '4px 12px',
          minHeight: 28,
          borderRadius: 2,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: 6,
          borderRadius: 2,
        },
        sizeSmall: {
          padding: 4,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: 22,
          fontSize: '0.6875rem',
          borderRadius: 2,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.6875rem',
          backgroundColor: '#242424',
          border: '1px solid #303030',
          borderRadius: 2,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 2,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e1e1e',
          borderRadius: 4,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            fontSize: '0.8125rem',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 2,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          textTransform: 'none',
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
      case 'home': return 'generic';
      case 'audio': return 'audio';
      case 'video': return 'generic';
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
  const [bottomPanelVisible, setBottomPanelVisible] = useState(!isMobile && !isTablet);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [openTabs, setOpenTabs] = useState<Array<{id: string, title: string, pinned: boolean}>>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Use navigation store for tool selection
  const selectedTool = useNavigationStore((state) => state.activeTool);
  const setActiveTool = useNavigationStore((state) => state.setActiveTool);

  const handleActivityBarToggle = useCallback(() => {
    setActivityBarExpanded(prev => {
      const newValue = !prev;
      localStorage.setItem(ACTIVITY_BAR_EXPANDED_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const handleToolSelect = useCallback((toolId: string) => {
    setActiveTool(toolId as ToolId);
  }, [setActiveTool]);

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
      setActiveTool(TOOLS[index]);
    }
  }, [setActiveTool]);

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
      goToHome: () => setActiveTool('home'),
      goToSession: () => setActiveTool('session'),
      goToVideo: () => setActiveTool('video'),
      goToAudio: () => setActiveTool('audio'),
      goToImages: () => setActiveTool('images'),
      goToStreaming: () => setActiveTool('streaming'),
      prevTool,
      nextTool,
    }),
    ...createViewShortcuts({
      toggleFullscreen,
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
  ], [setActiveTool, prevTool, nextTool, toggleFullscreen]);

  useKeyboardShortcuts(shortcuts);

  // Render the currently selected tool with lazy loading
  const renderTool = useCallback(() => {
    const toolFallback = <ToolLoadingFallback tool={selectedTool} />;

    switch (selectedTool) {
      case 'home':
        return (
          <ErrorBoundary toolName="Home">
            <Suspense fallback={toolFallback}>
              <HomePage />
            </Suspense>
          </ErrorBoundary>
        );
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
      case 'video':
        return (
          <ErrorBoundary toolName="Video Tool">
            <Suspense fallback={toolFallback}>
              <VideoTool investigationId="current-investigation" />
            </Suspense>
          </ErrorBoundary>
        );
      case 'workspace-demo':
        return (
          <ErrorBoundary toolName="Workspace Demo">
            <Suspense fallback={toolFallback}>
              <WorkspaceDemo />
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
