import React, { useState, useCallback, Suspense, lazy, useMemo, useEffect, useRef } from 'react';
import { ThemeProvider, createTheme, keyframes } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { TopHeaderBar } from '@/components/layout/TopHeaderBar';
import StatusBar from '@/components/layout/StatusBar';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { ErrorBoundary, LoadingSkeleton } from '@/components/common';
import { useKeyboardShortcuts, createNavigationShortcuts, createViewShortcuts, createEditingShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useAppPersistence } from '@/stores/useAppPersistence';

// Crossfade animation keyframes
const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

// Transition duration constant (in ms)
const TOOL_TRANSITION_DURATION = 175;

// Lazy load heavy tool components - only load when user opens that tool
const HomePage = lazy(() => import('@/components/home/HomePage'));
const StreamingTool = lazy(() => import('@/components/streaming-tool/StreamingTool'));
const SessionTimeline = lazy(() => import('@/components/session-timeline/SessionTimeline'));
const AudioTool = lazy(() => import('@/components/audio-tool/AudioTool'));
const ImageTool = lazy(() => import('@/components/image-tool/ImageTool'));
const VideoTool = lazy(() => import('@/components/video-tool/VideoTool'));
const WorkspaceDemo = lazy(() => import('@/pages/WorkspaceDemo'));
const AISidekickPanel = lazy(() => import('@/components/ai-sidekick/AISidekickPanel'));

// Tool IDs for navigation
const TOOLS = ['home', 'session', 'video', 'audio', 'images', 'streaming', 'export', 'notes', 'team', 'settings', 'workspace-demo'] as const;
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

  // Use navigation store for tool selection
  const selectedTool = useNavigationStore((state) => state.activeTool);
  const setActiveTool = useNavigationStore((state) => state.setActiveTool);
  const activeSessionId = useAppPersistence((state) => state.activeSessionId);

  // Track tool transitions for crossfade animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedTool, setDisplayedTool] = useState(selectedTool);
  const previousToolRef = useRef(selectedTool);

  // Handle tool change with crossfade transition
  useEffect(() => {
    if (selectedTool !== previousToolRef.current) {
      // Start fade out
      setIsTransitioning(true);

      // After fade out, switch tool and fade in
      const timer = setTimeout(() => {
        setDisplayedTool(selectedTool);
        setIsTransitioning(false);
        previousToolRef.current = selectedTool;
      }, TOOL_TRANSITION_DURATION / 2);

      return () => clearTimeout(timer);
    }
  }, [selectedTool]);

  const handleToolSelect = useCallback((toolId: string) => {
    setActiveTool(toolId as ToolId);
  }, [setActiveTool]);

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
      toggleBottomPanel: () => {}, // No bottom panel anymore
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
    const toolFallback = <ToolLoadingFallback tool={displayedTool} />;

    switch (displayedTool) {
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
      case 'export':
      case 'notes':
      case 'team':
      case 'settings':
        // Placeholder for tools not yet implemented
        return (
          <Box sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
          }}>
            <Box
              component="span"
              className="material-symbols-outlined"
              sx={{ fontSize: 64, mb: 2, opacity: 0.3 }}
            >
              {selectedTool === 'export' ? 'download' :
               selectedTool === 'notes' ? 'sticky_note_2' :
               selectedTool === 'team' ? 'group' : 'settings'}
            </Box>
            <Box sx={{ fontSize: 14, textTransform: 'capitalize' }}>
              {selectedTool} - Coming Soon
            </Box>
          </Box>
        );
      default:
        return (
          <ErrorBoundary toolName="Home">
            <Suspense fallback={toolFallback}>
              <HomePage />
            </Suspense>
          </ErrorBoundary>
        );
    }
  }, [displayedTool]);

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
          {/* Top Header Bar - Fixed, icons only with tooltips */}
          <TopHeaderBar
            selectedTool={selectedTool}
            onToolSelect={handleToolSelect}
            notificationCount={3}
            userName="Nina Vance"
          />

          {/* Main Content Area */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}>
            {/* Tool Content with crossfade transition */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}>
              <Box
                key={displayedTool}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  opacity: isTransitioning ? 0 : 1,
                  transition: `opacity ${TOOL_TRANSITION_DURATION}ms ease-in-out`,
                }}
              >
                {renderTool()}
              </Box>
            </Box>

            {/* AI Sidekick Panel - shown for all tools except 'home' */}
            {selectedTool !== 'home' && (
              <Suspense fallback={null}>
                <AISidekickPanel />
              </Suspense>
            )}
          </Box>

          {/* Status Bar */}
          {!isMobile && (
            <StatusBar
              investigationName={activeSessionId ? 'Current Session' : 'No Active Session'}
              currentTool={selectedTool}
              syncStatus="synced"
              sessionName={activeSessionId || undefined}
              userName="Nina Vance"
            />
          )}
        </Box>
      </LayoutProvider>
    </ThemeProvider>
  );
};

export default App;
