/**
 * SensorsDashboard - Home Assistant-inspired real-time environmental monitoring
 *
 * Features for paranormal investigation:
 * - Real-time sensor data (EMF, temperature, humidity, etc.)
 * - Historical graphs and trends
 * - Anomaly detection and alerts
 * - Sensor device management
 * - Location-based sensor grouping
 * - Customizable dashboard cards
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import { styled, alpha } from '@mui/material/styles';

// Icons
import SensorsIcon from '@mui/icons-material/Sensors';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import CompressIcon from '@mui/icons-material/Compress';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import WavesIcon from '@mui/icons-material/Waves';
import MotionPhotosOnIcon from '@mui/icons-material/MotionPhotosOn';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimelineIcon from '@mui/icons-material/Timeline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

const ToolContainer = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
});

const Sidebar = styled(Box)({
  width: 240,
  backgroundColor: '#0f0f0f',
  borderRight: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const SidebarHeader = styled(Box)({
  padding: '16px',
  borderBottom: '1px solid #1a1a1a',
});

const LocationGroup = styled(Box)({
  padding: '12px 16px',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: alpha('#ffffff', 0.04),
  },
});

const LocationItem = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  padding: '8px 16px 8px 32px',
  cursor: 'pointer',
  backgroundColor: selected ? alpha('#19abb5', 0.1) : 'transparent',
  borderLeft: selected ? '2px solid #19abb5' : '2px solid transparent',
  '&:hover': {
    backgroundColor: selected ? alpha('#19abb5', 0.15) : alpha('#ffffff', 0.04),
  },
}));

const MainArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const DashboardHeader = styled(Box)({
  padding: '12px 20px',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#0f0f0f',
});

const HeaderActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const ActionButton = styled(IconButton)({
  width: 36,
  height: 36,
  color: '#707070',
  '&:hover': {
    color: '#b0b0b0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
});

const DashboardContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 20,
});

const CardGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 16,
});

const SensorCard = styled(Paper)<{ alert?: boolean }>(({ alert }) => ({
  backgroundColor: '#141414',
  border: `1px solid ${alert ? alpha('#ef4444', 0.4) : '#1a1a1a'}`,
  borderRadius: 12,
  padding: 16,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: '#181818',
    borderColor: alert ? alpha('#ef4444', 0.6) : '#2a2a2a',
  },
}));

const CardHeader = styled(Box)({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: 12,
});

const SensorIcon = styled(Box)<{ color: string }>(({ color }) => ({
  width: 40,
  height: 40,
  borderRadius: 10,
  backgroundColor: alpha(color, 0.15),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': {
    fontSize: 22,
    color: color,
  },
}));

const SensorStatus = styled(Chip)<{ status: 'online' | 'offline' | 'alert' }>(({ status }) => ({
  height: 22,
  fontSize: 10,
  backgroundColor:
    status === 'online'
      ? alpha('#22c55e', 0.15)
      : status === 'alert'
      ? alpha('#ef4444', 0.15)
      : alpha('#6b7280', 0.15),
  color: status === 'online' ? '#22c55e' : status === 'alert' ? '#ef4444' : '#6b7280',
  '& .MuiChip-icon': {
    color: 'inherit',
    fontSize: 12,
  },
}));

const SensorValue = styled(Typography)({
  fontSize: 36,
  fontWeight: 600,
  color: '#ffffff',
  lineHeight: 1,
  marginBottom: 4,
});

const SensorUnit = styled(Typography)({
  fontSize: 14,
  color: '#606060',
  display: 'inline',
  marginLeft: 4,
});

const SensorName = styled(Typography)({
  fontSize: 13,
  color: '#909090',
  marginBottom: 8,
});

const TrendIndicator = styled(Box)<{ trend: 'up' | 'down' | 'stable' }>(({ trend }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6b7280',
  '& svg': {
    fontSize: 14,
  },
}));

const MiniGraph = styled(Box)({
  height: 40,
  marginTop: 12,
  backgroundColor: alpha('#19abb5', 0.08),
  borderRadius: 6,
  display: 'flex',
  alignItems: 'flex-end',
  padding: '0 4px',
  gap: 2,
});

const GraphBar = styled(Box)<{ height: number; highlight?: boolean }>(({ height, highlight }) => ({
  flex: 1,
  height: `${height}%`,
  backgroundColor: highlight ? '#19abb5' : alpha('#19abb5', 0.4),
  borderRadius: 2,
  minHeight: 4,
}));

const AlertsPanel = styled(Box)({
  width: 300,
  backgroundColor: '#0f0f0f',
  borderLeft: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const AlertsHeader = styled(Box)({
  padding: '16px',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const AlertsList = styled(Box)({
  flex: 1,
  overflow: 'auto',
});

const AlertItem = styled(Box)<{ severity: 'high' | 'medium' | 'low' }>(({ severity }) => ({
  padding: '12px 16px',
  borderBottom: '1px solid #1a1a1a',
  borderLeft: `3px solid ${
    severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f59e0b' : '#19abb5'
  }`,
  '&:hover': {
    backgroundColor: alpha('#ffffff', 0.02),
  },
}));

const SensorsDashboard: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const locations = [
    { id: 'all', name: 'All Locations', count: 12 },
    { id: 'main-hall', name: 'Main Hall', count: 4 },
    { id: 'basement', name: 'Basement', count: 3 },
    { id: 'attic', name: 'Attic', count: 2 },
    { id: 'bedroom', name: 'Master Bedroom', count: 3 },
  ];

  const sensors = [
    {
      id: 1,
      name: 'EMF Detector A',
      type: 'emf',
      value: 2.3,
      unit: 'mG',
      status: 'online' as const,
      trend: 'stable' as const,
      location: 'Main Hall',
      icon: <WifiTetheringIcon />,
      color: '#8b5cf6',
      alert: false,
      graphData: [30, 45, 35, 50, 40, 55, 45, 60, 50, 45, 55, 48],
    },
    {
      id: 2,
      name: 'Temperature Sensor 1',
      type: 'temperature',
      value: 62.4,
      unit: '\u00B0F',
      status: 'online' as const,
      trend: 'down' as const,
      location: 'Main Hall',
      icon: <DeviceThermostatIcon />,
      color: '#ef4444',
      alert: false,
      graphData: [70, 68, 66, 65, 64, 63, 62, 62, 62, 63, 62, 62],
    },
    {
      id: 3,
      name: 'EMF Detector B',
      type: 'emf',
      value: 8.7,
      unit: 'mG',
      status: 'alert' as const,
      trend: 'up' as const,
      location: 'Basement',
      icon: <WifiTetheringIcon />,
      color: '#8b5cf6',
      alert: true,
      graphData: [20, 25, 30, 35, 45, 55, 70, 75, 80, 85, 88, 87],
    },
    {
      id: 4,
      name: 'Humidity Sensor',
      type: 'humidity',
      value: 68,
      unit: '%',
      status: 'online' as const,
      trend: 'stable' as const,
      location: 'Basement',
      icon: <WaterDropIcon />,
      color: '#3b82f6',
      alert: false,
      graphData: [65, 66, 67, 68, 68, 67, 68, 68, 69, 68, 68, 68],
    },
    {
      id: 5,
      name: 'Barometric Pressure',
      type: 'pressure',
      value: 29.92,
      unit: 'inHg',
      status: 'online' as const,
      trend: 'down' as const,
      location: 'Main Hall',
      icon: <CompressIcon />,
      color: '#22c55e',
      alert: false,
      graphData: [30, 30, 29.98, 29.96, 29.95, 29.94, 29.93, 29.92, 29.92, 29.92, 29.92, 29.92],
    },
    {
      id: 6,
      name: 'Motion Sensor',
      type: 'motion',
      value: 0,
      unit: 'events',
      status: 'online' as const,
      trend: 'stable' as const,
      location: 'Attic',
      icon: <MotionPhotosOnIcon />,
      color: '#f59e0b',
      alert: false,
      graphData: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      id: 7,
      name: 'Audio Level Monitor',
      type: 'audio',
      value: -42,
      unit: 'dB',
      status: 'online' as const,
      trend: 'stable' as const,
      location: 'Main Hall',
      icon: <VolumeUpIcon />,
      color: '#06b6d4',
      alert: false,
      graphData: [40, 38, 42, 45, 41, 43, 40, 42, 41, 43, 42, 42],
    },
    {
      id: 8,
      name: 'Infrasound Detector',
      type: 'infrasound',
      value: 12,
      unit: 'Hz',
      status: 'online' as const,
      trend: 'up' as const,
      location: 'Basement',
      icon: <WavesIcon />,
      color: '#ec4899',
      alert: false,
      graphData: [8, 9, 10, 10, 11, 11, 12, 12, 12, 12, 12, 12],
    },
  ];

  const alerts = [
    {
      id: 1,
      sensor: 'EMF Detector B',
      message: 'High EMF reading detected: 8.7 mG',
      time: '2 min ago',
      severity: 'high' as const,
    },
    {
      id: 2,
      sensor: 'Temperature Sensor 1',
      message: 'Temperature dropped 8\u00B0F in 10 minutes',
      time: '5 min ago',
      severity: 'medium' as const,
    },
    {
      id: 3,
      sensor: 'Motion Sensor',
      message: 'Motion detected in Attic',
      time: '12 min ago',
      severity: 'low' as const,
    },
  ];

  return (
    <ToolContainer>
      {/* Sidebar */}
      <Sidebar>
        <SidebarHeader>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>
            Sensor Locations
          </Typography>
        </SidebarHeader>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {locations.map((location) => (
            <LocationItem
              key={location.id}
              selected={selectedLocation === location.id}
              onClick={() => setSelectedLocation(location.id)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationOnIcon sx={{ fontSize: 16, color: selectedLocation === location.id ? '#19abb5' : '#505050' }} />
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: selectedLocation === location.id ? '#e0e0e0' : '#909090',
                    }}
                  >
                    {location.name}
                  </Typography>
                </Box>
                <Chip
                  label={location.count}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: 11,
                    backgroundColor: alpha('#ffffff', 0.08),
                    color: '#707070',
                  }}
                />
              </Box>
            </LocationItem>
          ))}
        </Box>
      </Sidebar>

      {/* Main Dashboard Area */}
      <MainArea>
        <DashboardHeader>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#e0e0e0' }}>
              {selectedLocation === 'all' ? 'All Sensors' : locations.find(l => l.id === selectedLocation)?.name}
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#606060' }}>
              {sensors.length} active sensors • Last updated 5 seconds ago
            </Typography>
          </Box>
          <HeaderActions>
            <Tooltip title="Refresh">
              <ActionButton>
                <RefreshIcon />
              </ActionButton>
            </Tooltip>
            <Tooltip title="Grid View">
              <ActionButton onClick={() => setViewMode('grid')}>
                <GridViewIcon sx={{ color: viewMode === 'grid' ? '#19abb5' : undefined }} />
              </ActionButton>
            </Tooltip>
            <Tooltip title="List View">
              <ActionButton onClick={() => setViewMode('list')}>
                <ViewListIcon sx={{ color: viewMode === 'list' ? '#19abb5' : undefined }} />
              </ActionButton>
            </Tooltip>
            <Tooltip title="Add Sensor">
              <ActionButton>
                <AddIcon />
              </ActionButton>
            </Tooltip>
            <Tooltip title="Settings">
              <ActionButton>
                <SettingsIcon />
              </ActionButton>
            </Tooltip>
          </HeaderActions>
        </DashboardHeader>

        <DashboardContent>
          <CardGrid>
            {sensors.map((sensor) => (
              <SensorCard key={sensor.id} alert={sensor.alert}>
                <CardHeader>
                  <SensorIcon color={sensor.color}>{sensor.icon}</SensorIcon>
                  <SensorStatus
                    status={sensor.status}
                    label={sensor.status}
                    size="small"
                    icon={
                      sensor.status === 'alert' ? (
                        <WarningAmberIcon />
                      ) : (
                        <CheckCircleIcon />
                      )
                    }
                  />
                </CardHeader>

                <SensorName>{sensor.name}</SensorName>

                <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                  <SensorValue>{sensor.value}</SensorValue>
                  <SensorUnit>{sensor.unit}</SensorUnit>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                  <TrendIndicator trend={sensor.trend}>
                    {sensor.trend === 'up' ? (
                      <TrendingUpIcon />
                    ) : sensor.trend === 'down' ? (
                      <TrendingDownIcon />
                    ) : (
                      <RemoveIcon />
                    )}
                    {sensor.trend === 'up' ? 'Rising' : sensor.trend === 'down' ? 'Falling' : 'Stable'}
                  </TrendIndicator>
                  <Typography sx={{ fontSize: 11, color: '#505050' }}>
                    {sensor.location}
                  </Typography>
                </Box>

                <MiniGraph>
                  {sensor.graphData.map((value, i) => (
                    <GraphBar
                      key={i}
                      height={value}
                      highlight={i === sensor.graphData.length - 1}
                    />
                  ))}
                </MiniGraph>
              </SensorCard>
            ))}
          </CardGrid>
        </DashboardContent>
      </MainArea>

      {/* Alerts Panel */}
      <AlertsPanel>
        <AlertsHeader>
          <NotificationsActiveIcon sx={{ fontSize: 20, color: '#ef4444' }} />
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>
            Active Alerts
          </Typography>
          <Chip
            label={alerts.length}
            size="small"
            sx={{
              height: 20,
              fontSize: 11,
              backgroundColor: alpha('#ef4444', 0.15),
              color: '#ef4444',
              ml: 'auto',
            }}
          />
        </AlertsHeader>
        <AlertsList>
          {alerts.map((alert) => (
            <AlertItem key={alert.id} severity={alert.severity}>
              <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#e0e0e0', mb: 0.5 }}>
                {alert.sensor}
              </Typography>
              <Typography sx={{ fontSize: 11, color: '#909090', mb: 1 }}>
                {alert.message}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 12, color: '#505050' }} />
                <Typography sx={{ fontSize: 10, color: '#505050' }}>
                  {alert.time}
                </Typography>
              </Box>
            </AlertItem>
          ))}
        </AlertsList>

        <Box sx={{ p: 2, borderTop: '1px solid #1a1a1a' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: '#808080', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimelineIcon sx={{ fontSize: 14 }} />
            Alert Summary
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label="3 High"
              size="small"
              sx={{ height: 22, fontSize: 10, backgroundColor: alpha('#ef4444', 0.15), color: '#ef4444' }}
            />
            <Chip
              label="5 Medium"
              size="small"
              sx={{ height: 22, fontSize: 10, backgroundColor: alpha('#f59e0b', 0.15), color: '#f59e0b' }}
            />
            <Chip
              label="12 Low"
              size="small"
              sx={{ height: 22, fontSize: 10, backgroundColor: alpha('#19abb5', 0.15), color: '#19abb5' }}
            />
          </Box>
        </Box>
      </AlertsPanel>
    </ToolContainer>
  );
};

export default SensorsDashboard;
