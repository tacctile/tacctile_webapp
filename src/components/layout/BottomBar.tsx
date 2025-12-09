import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import Person from '@mui/icons-material/Person';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import LocationOn from '@mui/icons-material/LocationOn';
import AccessTime from '@mui/icons-material/AccessTime';
import Notifications from '@mui/icons-material/Notifications';

// Divider component for visual separation
const Divider: React.FC = () => (
  <Box
    sx={{
      width: '1px',
      height: '24px',
      backgroundColor: '#333',
      margin: '0 16px',
    }}
  />
);

export const BottomBar: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '52px',
        backgroundColor: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        zIndex: 1000,
        padding: '0 16px',
      }}
    >
      {/* Logo */}
      <Box
        component="img"
        src="/tacctile_app_main_logo.png"
        alt="Tacctile Logo"
        sx={{
          height: '36px',
          width: 'auto',
        }}
      />

      <Divider />

      {/* Session name */}
      <Typography
        sx={{
          color: '#999',
          fontSize: '13px',
        }}
      >
        Session-3
      </Typography>

      <Divider />

      {/* Users */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Person sx={{ color: '#999', fontSize: '18px' }} />
        <Typography sx={{ color: '#999', fontSize: '13px' }}>+3</Typography>
      </Box>

      <Divider />

      {/* Sync status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FiberManualRecord sx={{ color: '#4caf50', fontSize: '8px' }} />
        <Typography sx={{ color: '#4caf50', fontSize: '13px' }}>Synced</Typography>
      </Box>

      <Divider />

      {/* Plugin slot (placeholder) */}
      <Box sx={{ width: '100px' }} />

      <Divider />

      {/* Location */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <LocationOn sx={{ color: '#999', fontSize: '18px' }} />
        <Typography sx={{ color: '#999', fontSize: '13px' }}>45.523°N, 122.676°W</Typography>
      </Box>

      <Divider />

      {/* Time */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AccessTime sx={{ color: '#999', fontSize: '18px' }} />
        <Typography sx={{ color: '#999', fontSize: '13px' }}>09:41 PM</Typography>
      </Box>

      <Divider />

      {/* Notifications */}
      <Badge
        badgeContent={2}
        sx={{
          '& .MuiBadge-badge': {
            backgroundColor: '#19abb5',
            color: '#fff',
            fontSize: '10px',
            minWidth: '16px',
            height: '16px',
          },
        }}
      >
        <Notifications sx={{ color: '#999', fontSize: '20px' }} />
      </Badge>
    </Box>
  );
};

export default BottomBar;
