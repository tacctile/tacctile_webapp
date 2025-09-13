import React, { useState, useCallback, useRef } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import ActivityBar from './components/Layout/ActivityBar';
import SidePanel from './components/Layout/SidePanel';
import EditorArea from './components/Layout/EditorArea';
import BottomPanel from './components/Layout/BottomPanel';
import StatusBar from './components/Layout/StatusBar';
import { LayoutProvider } from './contexts/LayoutContext';

// Material 3 Dark Theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    primary: {
      main: '#bb86fc',
    },
    secondary: {
      main: '#03dac6',
    },
    error: {
      main: '#cf6679',
    },
    text: {
      primary: '#e1e1e1',
      secondary: '#aaaaaa',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 13,
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

const App: React.FC = () => {
  const [activityBarExpanded, setActivityBarExpanded] = useState(false);
  const [activityBarPinned, setActivityBarPinned] = useState(false);
  const [sidePanelVisible, setSidePanelVisible] = useState(true);
  const [sidePanelWidth, setSidePanelWidth] = useState(250);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [selectedTool, setSelectedTool] = useState('photo');
  const [openTabs, setOpenTabs] = useState<Array<{id: string, title: string, pinned: boolean}>>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const handleActivityBarHover = useCallback((hover: boolean) => {
    if (!activityBarPinned) {
      setActivityBarExpanded(hover);
    }
  }, [activityBarPinned]);

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
              pinned={activityBarPinned}
              selectedTool={selectedTool}
              onHover={handleActivityBarHover}
              onToolSelect={handleToolSelect}
              onPinToggle={() => setActivityBarPinned(!activityBarPinned)}
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