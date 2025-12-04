import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Shell components
import { AppShell } from './components/shell';

// Tool components
import { VideoTool } from './tools/video';
import { AudioTool } from './tools/audio';
import { ImagesTool } from './tools/images';
import { SensorsDashboard } from './tools/sensors';
import { StreamingTool } from './tools/streaming';

// Material 3 Dark Theme with Tacctile Brand Colors
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0a0a0a',
      paper: '#141414',
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
      main: '#ef4444',
    },
    warning: {
      main: '#f59e0b',
    },
    success: {
      main: '#22c55e',
    },
    text: {
      primary: '#e1e1e1',
      secondary: '#909090',
    },
    divider: '#1a1a1a',
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
    fontWeightLight: 300,
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
    button: { fontFamily: '"Manrope", sans-serif', fontWeight: 500, textTransform: 'none' },
    caption: { fontFamily: '"Manrope", sans-serif', fontWeight: 400 },
    overline: { fontFamily: '"Manrope", sans-serif', fontWeight: 400 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#4b4b4b #1a1a1a',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 4,
            backgroundColor: '#4b4b4b',
            minHeight: 24,
            border: '2px solid #1a1a1a',
          },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#5b5b5b',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: '#1a1a1a',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#252525',
          border: '1px solid #2a2a2a',
          fontSize: 12,
          padding: '6px 10px',
        },
        arrow: {
          color: '#252525',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e1e1e',
          border: '1px solid #2a2a2a',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 13,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#1a1a1a',
        },
      },
    },
  },
});

const App: React.FC = () => {
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
      <BrowserRouter>
        <Routes>
          {/* Main app shell with nested routes for each tool */}
          <Route path="/" element={<AppShell />}>
            {/* Default redirect to video tool */}
            <Route index element={<Navigate to="/video" replace />} />

            {/* Tool routes */}
            <Route path="video" element={<VideoTool />} />
            <Route path="audio" element={<AudioTool />} />
            <Route path="images" element={<ImagesTool />} />
            <Route path="sensors" element={<SensorsDashboard />} />
            <Route path="streaming" element={<StreamingTool />} />

            {/* Catch all - redirect to video */}
            <Route path="*" element={<Navigate to="/video" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
