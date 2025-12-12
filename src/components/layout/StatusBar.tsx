/**
 * StatusBar Component
 * Bottom status bar with project info, sync status, and environmental data
 *
 * Layout:
 * - Left: Project name, User name
 * - Center: Sync status
 * - Right: Environmental data (temp, EMF, GPS), time
 */

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
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

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

const Divider = styled(Box)({
  width: 1,
  height: 12,
  backgroundColor: 'rgba(255, 255, 255, 0.3)',
  margin: '0 4px',
});

interface StatusBarProps {
  investigationName?: string;
  currentTool?: string;
  syncStatus?: 'synced' | 'syncing' | 'offline';
  sessionName?: string;
  userName?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({
  investigationName = 'No Investigation',
  currentTool = 'none',
  syncStatus = 'synced',
  sessionName,
  userName = 'User',
}) => {
  const [time, setTime] = useState(new Date());
  const [temperature, setTemperature] = useState(21.5);
  const [emfReading, setEmfReading] = useState(0.3);
  const [gpsLocation, setGpsLocation] = useState('45.5231° N, 122.6765° W');

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

  const getSyncLabel = () => {
    switch (syncStatus) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'offline':
        return 'Offline';
    }
  };

  return (
    <StyledStatusBar>
      {/* Left section - Project & User */}
      <StatusSection>
        <Tooltip title="Current Project">
          <StatusItem>
            <FolderIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {sessionName || investigationName}
            </Typography>
          </StatusItem>
        </Tooltip>

        <Divider />

        <Tooltip title="Current User">
          <StatusItem>
            <PersonIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption">
              {userName}
            </Typography>
          </StatusItem>
        </Tooltip>
      </StatusSection>

      {/* Center section - Sync Status */}
      <StatusSection>
        <Tooltip title={`Cloud Status: ${getSyncLabel()}`}>
          <StatusItem>
            {getSyncIcon()}
            <Typography variant="caption">{getSyncLabel()}</Typography>
          </StatusItem>
        </Tooltip>
      </StatusSection>

      {/* Right section - Environmental Data & Time */}
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
            <Typography variant="caption">{gpsLocation}</Typography>
          </StatusItem>
        </Tooltip>

        <Divider />

        <Tooltip title="Current Time">
          <StatusItem>
            <AccessTimeIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Typography>
          </StatusItem>
        </Tooltip>
      </StatusSection>

      {/* CSS for spinning animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </StyledStatusBar>
  );
};

export default StatusBar;
