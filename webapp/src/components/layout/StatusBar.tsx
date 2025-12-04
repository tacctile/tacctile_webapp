import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

// Icons
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import FolderIcon from '@mui/icons-material/Folder';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import Battery30Icon from '@mui/icons-material/Battery30';
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import GitHubIcon from '@mui/icons-material/GitHub';
import NotificationsIcon from '@mui/icons-material/Notifications';

const StyledStatusBar = styled(Box)(({ theme }) => ({
  height: 22,
  backgroundColor: '#19abb5',  // Tacctile primary brand color
  borderTop: '1px solid #1b7583',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 10px',
  fontSize: 12,
  color: '#ffffff',
  userSelect: 'none',
  background: 'linear-gradient(90deg, #19abb5 0%, #1992a1 100%)',  // Subtle gradient
}));

const StatusSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

const StatusItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'pointer',
  padding: '0 4px',
  borderRadius: 2,
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

interface StatusBarProps {
  investigationName?: string;
  currentTool?: string;
  syncStatus?: 'synced' | 'syncing' | 'offline';
}

const StatusBar: React.FC<StatusBarProps> = ({
  investigationName = 'No Investigation',
  currentTool = 'none',
  syncStatus = 'synced',
}) => {
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [temperature, setTemperature] = useState(21.5);
  const [emfReading, setEmfReading] = useState(0.3);
  const [connectedDevices, setConnectedDevices] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      // Simulate readings
      setEmfReading(Math.random() * 2);
      setTemperature(20 + Math.random() * 3);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <CloudDoneIcon sx={{ fontSize: 14 }} />;
      case 'syncing':
        return <SyncIcon sx={{ fontSize: 14, animation: 'spin 2s linear infinite' }} />;
      case 'offline':
        return <CloudOffIcon sx={{ fontSize: 14 }} />;
    }
  };

  const getBatteryIcon = () => {
    if (batteryLevel > 60) return <BatteryFullIcon sx={{ fontSize: 14 }} />;
    if (batteryLevel > 30) return <Battery60Icon sx={{ fontSize: 14 }} />;
    if (batteryLevel > 10) return <Battery30Icon sx={{ fontSize: 14 }} />;
    return <BatteryAlertIcon sx={{ fontSize: 14, color: '#ff5252' }} />;
  };

  const getToolName = () => {
    const tools: { [key: string]: string } = {
      photo: 'Photo Evidence',
      video: 'Video Recording',
      audio: 'EVP Recorder',
      emf: 'EMF Detector',
      analysis: 'Data Analysis',
      thermal: 'Thermal Imaging',
      motion: 'Motion Detection',
      spiritbox: 'Spirit Box',
      settings: 'Settings',
    };
    return tools[currentTool] || 'Ready';
  };

  return (
    <StyledStatusBar>
      {/* Left section */}
      <StatusSection>
        <Tooltip title="Current Investigation">
          <StatusItem>
            <FolderIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">{investigationName}</Typography>
          </StatusItem>
        </Tooltip>

        <Tooltip title="Active Tool">
          <StatusItem>
            <Typography variant="caption">{getToolName()}</Typography>
          </StatusItem>
        </Tooltip>

        <Tooltip title="Sync Status">
          <StatusItem>
            {getSyncIcon()}
            <Typography variant="caption">{syncStatus}</Typography>
          </StatusItem>
        </Tooltip>
      </StatusSection>

      {/* Center section - Live readings */}
      <StatusSection>
        <Tooltip title="Temperature">
          <StatusItem>
            <ThermostatIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">{temperature.toFixed(1)}°C</Typography>
          </StatusItem>
        </Tooltip>

        <Tooltip title="EMF Level">
          <StatusItem>
            <WifiTetheringIcon sx={{ fontSize: 14, color: emfReading > 1.5 ? '#ff5252' : '#ffffff' }} />
            <Typography variant="caption">{emfReading.toFixed(1)} mG</Typography>
          </StatusItem>
        </Tooltip>

        <Tooltip title="GPS Location">
          <StatusItem>
            <LocationOnIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">45.5231° N, 122.6765° W</Typography>
          </StatusItem>
        </Tooltip>
      </StatusSection>

      {/* Right section */}
      <StatusSection>
        <Tooltip title="Connected Devices">
          <StatusItem>
            <WifiIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">{connectedDevices}</Typography>
          </StatusItem>
        </Tooltip>

        <Tooltip title="Battery Level">
          <StatusItem>
            {getBatteryIcon()}
            <Typography variant="caption">{batteryLevel}%</Typography>
          </StatusItem>
        </Tooltip>

        <Tooltip title="Notifications">
          <StatusItem>
            <NotificationsIcon sx={{ fontSize: 14 }} />
          </StatusItem>
        </Tooltip>

        <Tooltip title="GitHub">
          <StatusItem>
            <GitHubIcon sx={{ fontSize: 14 }} />
          </StatusItem>
        </Tooltip>

        <Typography variant="caption">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </StatusSection>
    </StyledStatusBar>
  );
};

export default StatusBar;