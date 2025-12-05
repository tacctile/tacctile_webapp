import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import { styled } from '@mui/material/styles';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TerminalIcon from '@mui/icons-material/Terminal';
import BugReportIcon from '@mui/icons-material/BugReport';
import TimelineIcon from '@mui/icons-material/Timeline';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';

const StyledBottomPanel = styled(Box)(({ theme }) => ({
  backgroundColor: '#252525',
  borderTop: '1px solid #2b2b2b',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
}));

const Header = styled(Box)(({ theme }) => ({
  height: 35,
  borderBottom: '1px solid #2b2b2b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 8px',
}));

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: 8,
  fontFamily: '"Manrope", sans-serif',
  fontSize: 13,
}));

const ResizeHandle = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 4,
  cursor: 'row-resize',
  '&:hover': {
    backgroundColor: 'rgba(25, 171, 181, 0.3)',
  },
}));

const LogEntry = styled(Box)<{ level: 'info' | 'warning' | 'error' | 'success' }>(({ level }) => ({
  padding: '2px 0',
  fontFamily: '"Manrope", sans-serif',
  fontSize: 12,
  fontWeight: 400,
  color: level === 'error' ? '#cf6679' : level === 'warning' ? '#ffb74d' : level === 'success' ? '#36d1da' : '#aaaaaa',
  display: 'flex',
  alignItems: 'flex-start',
  '&:hover': {
    backgroundColor: 'rgba(25, 171, 181, 0.02)',
  },
}));

interface BottomPanelProps {
  height: number;
  onResize: (height: number) => void;
  onClose: () => void;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ height, onResize, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(height);

  // Mock log data
  const [logs, setLogs] = useState([
    { time: '22:15:30', level: 'info', message: 'Investigation session started' },
    { time: '22:15:31', level: 'success', message: 'All sensors connected successfully' },
    { time: '22:15:35', level: 'info', message: 'Sensor baseline reading: 0.3 mG' },
    { time: '22:16:02', level: 'warning', message: 'Temperature drop detected: -3.2°C in 5 seconds' },
    { time: '22:16:15', level: 'info', message: 'Audio recording started' },
    { time: '22:16:45', level: 'error', message: 'Radio Sweep device connection lost - attempting reconnect...' },
    { time: '22:16:48', level: 'success', message: 'Radio Sweep device reconnected' },
  ]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeightRef.current + deltaY));
      onResize(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onResize]);

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  };

  const getLevelIcon = (level: string) => {
    const iconStyle = { fontSize: 10, mr: 1 };
    switch (level) {
      case 'error':
        return <FiberManualRecordIcon sx={{ ...iconStyle, color: '#cf6679' }} />;
      case 'warning':
        return <FiberManualRecordIcon sx={{ ...iconStyle, color: '#ffb74d' }} />;
      case 'success':
        return <FiberManualRecordIcon sx={{ ...iconStyle, color: '#36d1da' }} />;
      default:
        return <FiberManualRecordIcon sx={{ ...iconStyle, color: '#aaaaaa' }} />;
    }
  };

  const tabContent = [
    // Console tab
    <ContentArea key="console">
      {logs.map((log, index) => (
        <LogEntry key={index} level={log.level as any}>
          <Typography component="span" sx={{ color: '#858585', mr: 2, fontSize: 12 }}>
            {log.time}
          </Typography>
          {getLevelIcon(log.level)}
          <Typography component="span" sx={{ fontSize: 12 }}>
            {log.message}
          </Typography>
        </LogEntry>
      ))}
    </ContentArea>,

    // Problems tab
    <ContentArea key="problems">
      <Typography sx={{ color: '#858585', fontSize: 13 }}>
        No problems detected in current investigation
      </Typography>
    </ContentArea>,

    // Output tab
    <ContentArea key="output">
      <Box sx={{ mb: 2 }}>
        <Chip
          label={isRecording ? 'Recording...' : 'Ready'}
          color={isRecording ? 'error' : 'default'}
          size="small"
          icon={isRecording ? <FiberManualRecordIcon /> : undefined}
          sx={{ mr: 1 }}
        />
        {isRecording && (
          <LinearProgress
            variant="indeterminate"
            sx={{ mt: 1, height: 2 }}
            color="secondary"
          />
        )}
      </Box>
      <Typography sx={{ color: '#19abb5', fontSize: 12, fontFamily: '"Manrope", sans-serif', fontWeight: 500 }}>
        [SENSOR] Continuous monitoring active{'\n'}
        [THERMAL] IR camera connected - 30 FPS{'\n'}
        [AUDIO] Recording at 48kHz 24-bit{'\n'}
        [MOTION] Grid sensors online - sensitivity: HIGH{'\n'}
        [RADIO SWEEP] Sweeping 88.0-108.0 MHz @ 150ms intervals
      </Typography>
    </ContentArea>,

    // Alerts tab
    <ContentArea key="alerts">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ p: 1, backgroundColor: 'rgba(25, 171, 181, 0.1)', borderRadius: 1 }}>
          <Typography sx={{ fontSize: 12, color: '#19abb5' }}>
            ⚠ Anomaly detected at 22:16:02 - Multiple sensors triggered
          </Typography>
        </Box>
        <Box sx={{ p: 1, backgroundColor: 'rgba(255, 183, 77, 0.1)', borderRadius: 1 }}>
          <Typography sx={{ fontSize: 12, color: '#ffb74d' }}>
            📊 Sensor spike: 5.2 mG detected near location marker #3
          </Typography>
        </Box>
      </Box>
    </ContentArea>,
  ];

  return (
    <StyledBottomPanel sx={{ height }}>
      <ResizeHandle onMouseDown={handleResizeStart} />

      <Header>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{
              minHeight: 35,
              '& .MuiTab-root': {
                minHeight: 35,
                fontSize: 13,
                textTransform: 'none',
                py: 0,
              },
            }}
          >
            <Tab icon={<TerminalIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Console" />
            <Tab icon={<BugReportIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Problems" />
            <Tab icon={<TimelineIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Output" />
            <Tab icon={<NotificationsIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Alerts" />
          </Tabs>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {activeTab === 2 && (
            <IconButton
              size="small"
              onClick={() => setIsRecording(!isRecording)}
              sx={{ color: isRecording ? '#cf6679' : '#19abb5' }}
            >
              {isRecording ? <StopIcon fontSize="small" /> : <FiberManualRecordIcon fontSize="small" />}
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => setLogs([])}
            sx={{ color: '#858585', '&:hover': { color: '#e1e1e1' } }}
          >
            <ClearAllIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: '#858585', '&:hover': { color: '#e1e1e1' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Header>

      {tabContent[activeTab]}
    </StyledBottomPanel>
  );
};

export default BottomPanel;