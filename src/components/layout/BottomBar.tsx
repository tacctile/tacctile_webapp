import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Person from '@mui/icons-material/Person';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import LocationOn from '@mui/icons-material/LocationOn';
import AccessTime from '@mui/icons-material/AccessTime';
import Notifications from '@mui/icons-material/Notifications';
import Search from '@mui/icons-material/Search';

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
        justifyContent: 'space-between',
        zIndex: 1000,
        padding: '0 16px',
      }}
    >
      {/* Left group: Logo, Session, Users, Sync */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
      </Box>

      {/* Right group: Location, Time, Notifications, Search, Avatar */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
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

        <Divider />

        {/* Search */}
        <Tooltip title="Search" placement="top">
          <IconButton
            sx={{
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              color: '#808080',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: '#e1e1e1',
              },
            }}
          >
            <Search sx={{ fontSize: '20px' }} />
          </IconButton>
        </Tooltip>

        <Divider />

        {/* User Avatar */}
        <Tooltip title="Nina Vance" placement="top">
          <Avatar
            sx={{
              width: 32,
              height: 32,
              backgroundColor: '#19abb5',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              '&:hover': {
                transform: 'scale(1.05)',
              },
            }}
          >
            NV
          </Avatar>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default BottomBar;
