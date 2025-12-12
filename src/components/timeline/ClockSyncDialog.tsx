/**
 * ClockSyncDialog Component
 * Prompts users to verify device clocks are synced before investigation
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  AlertTitle,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DevicesIcon from '@mui/icons-material/Devices';
import SyncIcon from '@mui/icons-material/Sync';
import type { ClockSyncPromptState, DeviceClockInfo, ClockSyncStatus } from '../../types/timeline';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: '#1a1a1a',
    backgroundImage: 'none',
    border: '1px solid #2b2b2b',
    borderRadius: 12,
    maxWidth: 520,
  },
}));

const StyledDialogTitle = styled(DialogTitle)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  backgroundColor: '#151515',
  borderBottom: '1px solid #2b2b2b',
});

const HeaderIcon = styled(Box)({
  width: 48,
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(25, 171, 181, 0.15)',
  borderRadius: '50%',
  marginRight: 16,
  '& svg': {
    fontSize: 24,
    color: '#19abb5',
  },
});

const DeviceItem = styled(ListItem)({
  backgroundColor: '#202020',
  borderRadius: 8,
  marginBottom: 8,
  '&:last-child': {
    marginBottom: 0,
  },
});

const StatusChip = styled(Chip)<{ status: ClockSyncStatus }>(({ status }) => {
  const colors: Record<ClockSyncStatus, { bg: string; color: string }> = {
    verified: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
    unverified: { bg: 'rgba(234, 179, 8, 0.2)', color: '#eab308' },
    mismatch: { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
    unknown: { bg: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' },
  };

  return {
    height: 24,
    backgroundColor: colors[status].bg,
    color: colors[status].color,
    fontWeight: 600,
    fontSize: '11px',
    '& .MuiChip-icon': {
      color: colors[status].color,
    },
  };
});

const TipBox = styled(Box)({
  display: 'flex',
  gap: 12,
  padding: 12,
  backgroundColor: 'rgba(25, 171, 181, 0.1)',
  borderRadius: 8,
  border: '1px solid rgba(25, 171, 181, 0.2)',
  marginTop: 16,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getStatusIcon = (status: ClockSyncStatus): React.ReactNode => {
  switch (status) {
    case 'verified':
      return <CheckCircleIcon sx={{ fontSize: 16 }} />;
    case 'unverified':
      return <WarningIcon sx={{ fontSize: 16 }} />;
    case 'mismatch':
      return <ErrorIcon sx={{ fontSize: 16 }} />;
    default:
      return <HelpOutlineIcon sx={{ fontSize: 16 }} />;
  }
};

const getStatusLabel = (status: ClockSyncStatus): string => {
  switch (status) {
    case 'verified':
      return 'Synced';
    case 'unverified':
      return 'Unverified';
    case 'mismatch':
      return 'Mismatch';
    default:
      return 'Unknown';
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

interface ClockSyncDialogProps {
  open: boolean;
  devices: DeviceClockInfo[];
  onClose: () => void;
  onAcknowledge: () => void;
  onVerifyDevice: (deviceId: string) => void;
}

export const ClockSyncDialog: React.FC<ClockSyncDialogProps> = ({
  open,
  devices,
  onClose,
  onAcknowledge,
  onVerifyDevice,
}) => {
  const hasUnverifiedDevices = devices.some((d) => d.syncStatus !== 'verified');
  const hasMismatchedDevices = devices.some((d) => d.syncStatus === 'mismatch');

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <StyledDialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <HeaderIcon>
            <AccessTimeIcon />
          </HeaderIcon>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#e1e1e1' }}>
              Verify Device Clock Sync
            </Typography>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Ensure accurate timeline placement
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#888' }}>
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent sx={{ padding: 3 }}>
        <Alert
          severity={hasMismatchedDevices ? 'error' : hasUnverifiedDevices ? 'warning' : 'success'}
          sx={{
            mb: 2,
            backgroundColor: hasMismatchedDevices
              ? 'rgba(239, 68, 68, 0.1)'
              : hasUnverifiedDevices
              ? 'rgba(234, 179, 8, 0.1)'
              : 'rgba(34, 197, 94, 0.1)',
            border: `1px solid ${
              hasMismatchedDevices ? '#ef4444' : hasUnverifiedDevices ? '#eab308' : '#22c55e'
            }33`,
            '& .MuiAlert-icon': {
              color: hasMismatchedDevices ? '#ef4444' : hasUnverifiedDevices ? '#eab308' : '#22c55e',
            },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>
            {hasMismatchedDevices
              ? 'Clock Mismatch Detected'
              : hasUnverifiedDevices
              ? 'Devices Need Verification'
              : 'All Devices Synced'}
          </AlertTitle>
          {hasMismatchedDevices
            ? 'Some devices have clock offsets. This may cause timeline inaccuracies.'
            : hasUnverifiedDevices
            ? 'Verify that all device clocks are synchronized for accurate timeline placement.'
            : 'All devices are verified and synchronized.'}
        </Alert>

        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, color: '#e1e1e1', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <DevicesIcon sx={{ fontSize: 18, color: '#888' }} />
          Detected Devices ({devices.length})
        </Typography>

        <List sx={{ padding: 0 }}>
          {devices.map((device) => (
            <DeviceItem key={device.deviceId} disablePadding sx={{ padding: '12px 16px' }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#2a2a2a',
                    borderRadius: 1,
                  }}
                >
                  <DevicesIcon sx={{ fontSize: 18, color: '#888' }} />
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#e1e1e1' }}>
                    {device.deviceName}
                  </Typography>
                }
                secondary={
                  device.lastVerifiedAt ? (
                    <Typography variant="caption" sx={{ color: '#666' }}>
                      Last verified: {new Date(device.lastVerifiedAt).toLocaleString()}
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#666' }}>
                      Not yet verified
                    </Typography>
                  )
                }
              />
              <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StatusChip
                  status={device.syncStatus}
                  icon={getStatusIcon(device.syncStatus)}
                  label={getStatusLabel(device.syncStatus)}
                  size="small"
                />
                {device.syncStatus !== 'verified' && (
                  <IconButton
                    size="small"
                    onClick={() => onVerifyDevice(device.deviceId)}
                    sx={{
                      color: '#19abb5',
                      '&:hover': {
                        backgroundColor: 'rgba(25, 171, 181, 0.1)',
                      },
                    }}
                  >
                    <SyncIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </ListItemSecondaryAction>
            </DeviceItem>
          ))}
        </List>

        <TipBox>
          <HelpOutlineIcon sx={{ fontSize: 20, color: '#19abb5', flexShrink: 0, mt: 0.25 }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500, color: '#e1e1e1', mb: 0.5 }}>
              Tip: Sync devices before recording
            </Typography>
            <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
              Set all device clocks to the same NTP server or manually sync them to a reference
              time before starting your investigation. This ensures all media is placed
              accurately on the timeline.
            </Typography>
          </Box>
        </TipBox>
      </DialogContent>

      <Divider sx={{ borderColor: '#2b2b2b' }} />

      <DialogActions sx={{ padding: '12px 24px', backgroundColor: '#151515' }}>
        <Button onClick={onClose} sx={{ color: '#888' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onAcknowledge}
          sx={{
            backgroundColor: '#19abb5',
            '&:hover': {
              backgroundColor: '#158d95',
            },
          }}
        >
          {hasUnverifiedDevices ? 'Continue Anyway' : 'Continue'}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

// ============================================================================
// CLOCK SYNC BANNER (inline notification)
// ============================================================================

interface ClockSyncBannerProps {
  devices: DeviceClockInfo[];
  onOpenDialog: () => void;
  onDismiss: () => void;
}

const BannerContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  backgroundColor: 'rgba(234, 179, 8, 0.1)',
  border: '1px solid rgba(234, 179, 8, 0.3)',
  borderRadius: 8,
});

export const ClockSyncBanner: React.FC<ClockSyncBannerProps> = ({
  devices,
  onOpenDialog,
  onDismiss,
}) => {
  const unverifiedCount = devices.filter((d) => d.syncStatus !== 'verified').length;

  if (unverifiedCount === 0) return null;

  return (
    <BannerContainer>
      <WarningIcon sx={{ fontSize: 20, color: '#eab308' }} />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: '#e1e1e1' }}>
          {unverifiedCount} device{unverifiedCount !== 1 ? 's' : ''} not verified
        </Typography>
        <Typography variant="caption" sx={{ color: '#888' }}>
          Verify device clocks for accurate timeline placement
        </Typography>
      </Box>
      <Button
        size="small"
        onClick={onOpenDialog}
        sx={{
          color: '#eab308',
          borderColor: '#eab308',
          '&:hover': {
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
          },
        }}
        variant="outlined"
      >
        Verify
      </Button>
      <IconButton size="small" onClick={onDismiss} sx={{ color: '#888' }}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </BannerContainer>
  );
};

export default ClockSyncDialog;
