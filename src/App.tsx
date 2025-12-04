import React, { useState, useCallback } from 'react';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import ActivityBar from '@/components/layout/ActivityBar';
import SidePanel from '@/components/layout/SidePanel';
import EditorArea from '@/components/layout/EditorArea';
import BottomPanel from '@/components/layout/BottomPanel';
import StatusBar from '@/components/layout/StatusBar';
import { LayoutProvider } from '@/contexts/LayoutContext';

// Material 3 Dark Theme with Tacctile Brand Colors
const darkTheme = createTheme({
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
    fontSize: 13,
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
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#6b6b6b #2b2b2b',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 10,
            height: 10,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 5,
            backgroundColor: '#6b6b6b',
            minHeight: 24,
            border: '2px solid #2b2b2b',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            borderRadius: 5,
            backgroundColor: '#2b2b2b',
          },
        },
      },
    },
  },
});

const ACTIVITY_BAR_EXPANDED_KEY = 'tacctile_activity_bar_expanded';

const App: React.FC = () => {
  const [activityBarExpanded, setActivityBarExpanded] = useState(() => {
    const saved = localStorage.getItem(ACTIVITY_BAR_EXPANDED_KEY);
    return saved === 'true';
  });
  const [sidePanelVisible, setSidePanelVisible] = useState(true);
  const [sidePanelWidth, setSidePanelWidth] = useState(250);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [selectedTool, setSelectedTool] = useState('session');
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
    setSelectedTool(toolId);
    setSidePanelVisible(true);
  }, []);

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

  // Handle F11 fullscreen
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <ThemeProvider theme={darkTheme}>
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
          }}
        >
          {/* Main Layout */}
          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Activity Bar */}
            <ActivityBar
              expanded={activityBarExpanded}
              selectedTool={selectedTool}
              onToolSelect={handleToolSelect}
              onToggle={handleActivityBarToggle}
            />

            {/* Side Panel */}
            {sidePanelVisible && (
              <SidePanel
                width={sidePanelWidth}
                selectedTool={selectedTool}
                onResize={setSidePanelWidth}
                onClose={() => setSidePanelVisible(false)}
                onFileOpen={handleOpenFile}
              />
            )}

            {/* Main Content Area */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden'
            }}>
              {/* Editor Area */}
              <EditorArea
                tabs={openTabs}
                activeTab={activeTab}
                onTabSelect={setActiveTab}
                onTabClose={handleCloseTab}
                onTabPin={handlePinTab}
                onTabReorder={setOpenTabs}
              />

              {/* Bottom Panel */}
              {bottomPanelVisible && (
                <BottomPanel
                  height={bottomPanelHeight}
                  onResize={setBottomPanelHeight}
                  onClose={() => setBottomPanelVisible(false)}
                />
              )}
            </Box>
          </Box>

          {/* Status Bar */}
          <StatusBar
            investigationName="Investigation_2024_01"
            currentTool={selectedTool}
            syncStatus="synced"
          />
        </Box>
      </LayoutProvider>
    </ThemeProvider>
  );
};

export default App;
