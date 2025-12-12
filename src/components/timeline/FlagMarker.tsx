/**
 * FlagMarker Component
 * Visual indicator for flags/findings on the timeline
 */

import React from 'react';
import { Box, Typography, Tooltip, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import FlagIcon from '@mui/icons-material/Flag';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BoltIcon from '@mui/icons-material/Bolt';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import LightModeIcon from '@mui/icons-material/LightMode';
import PersonIcon from '@mui/icons-material/Person';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpIcon from '@mui/icons-material/Help';
import StarIcon from '@mui/icons-material/Star';
import type { FlagType } from '../../types/index';
import type { TimelineItemFlag, TimeRange, ZoomLevel } from '../../types/timeline';
import { formatTimelineTimestamp } from '../../types/timeline';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const MarkerContainer = styled(Box)({
  position: 'absolute',
  top: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  transform: 'translateX(-50%)',
  zIndex: 20,
});

const MarkerIcon = styled(Box)<{ color: string; confidence: string }>(({ color, confidence }) => ({
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: color,
  borderRadius: '50%',
  border: `2px solid ${
    confidence === 'high' ? '#22c55e' : confidence === 'medium' ? '#eab308' : '#ef4444'
  }`,
  transition: 'transform 0.15s ease',
  '&:hover': {
    transform: 'scale(1.2)',
  },
  '& svg': {
    fontSize: 12,
    color: '#fff',
  },
}));

const MarkerLine = styled(Box)<{ color: string }>(({ color }) => ({
  width: 1,
  height: 32,
  backgroundColor: color,
  opacity: 0.6,
}));

const ConfidenceBadge = styled(Chip)<{ confidence: string }>(({ confidence }) => ({
  height: 16,
  fontSize: '9px',
  fontWeight: 600,
  backgroundColor:
    confidence === 'high' ? '#22c55e' : confidence === 'medium' ? '#eab308' : '#ef4444',
  color: '#000',
  '& .MuiChip-label': {
    padding: '0 4px',
  },
}));

// ============================================================================
// FLAG TYPE CONFIG
// ============================================================================

interface FlagTypeConfig {
  icon: React.ReactNode;
  color: string;
  label: string;
}

const FLAG_TYPE_CONFIG: Record<FlagType, FlagTypeConfig> = {
  anomaly: {
    icon: <HelpIcon />,
    color: '#a855f7',
    label: 'Anomaly',
  },
  evp: {
    icon: <RecordVoiceOverIcon />,
    color: '#ec4899',
    label: 'Voice',
  },
  apparition: {
    icon: <VisibilityIcon />,
    color: '#8b5cf6',
    label: 'Visual',
  },
  emf_spike: {
    icon: <BoltIcon />,
    color: '#f59e0b',
    label: 'EMF Spike',
  },
  temperature_change: {
    icon: <AcUnitIcon />,
    color: '#06b6d4',
    label: 'Temperature',
  },
  motion_detected: {
    icon: <DirectionsRunIcon />,
    color: '#10b981',
    label: 'Motion',
  },
  audio_artifact: {
    icon: <MusicNoteIcon />,
    color: '#3b82f6',
    label: 'Audio Artifact',
  },
  light_anomaly: {
    icon: <LightModeIcon />,
    color: '#fcd34d',
    label: 'Light Anomaly',
  },
  shadow_figure: {
    icon: <PersonIcon />,
    color: '#6b7280',
    label: 'Figure',
  },
  equipment_malfunction: {
    icon: <BuildIcon />,
    color: '#ef4444',
    label: 'Equipment Issue',
  },
  debunked: {
    icon: <CheckCircleIcon />,
    color: '#22c55e',
    label: 'Debunked',
  },
  review_needed: {
    icon: <HelpIcon />,
    color: '#f97316',
    label: 'Review Needed',
  },
  highlight: {
    icon: <StarIcon />,
    color: '#eab308',
    label: 'Highlight',
  },
  custom: {
    icon: <FlagIcon />,
    color: '#19abb5',
    label: 'Custom',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface FlagMarkerProps {
  flag: TimelineItemFlag;
  timeRange: TimeRange;
  zoomLevel: ZoomLevel;
  scrollPosition: number;
  onClick?: (flagId: string) => void;
}

export const FlagMarker: React.FC<FlagMarkerProps> = ({
  flag,
  timeRange,
  zoomLevel,
  scrollPosition,
  onClick,
}) => {
  const config = FLAG_TYPE_CONFIG[flag.type] || FLAG_TYPE_CONFIG.custom;
  const position =
    ((flag.absoluteTimestamp - timeRange.start) / 1000) * zoomLevel.pixelsPerSecond - scrollPosition;

  // Don't render if off screen
  if (position < -50 || position > window.innerWidth + 50) {
    return null;
  }

  return (
    <Tooltip
      title={
        <Box sx={{ minWidth: 180 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: config.color,
                borderRadius: '50%',
                '& svg': { fontSize: 10, color: '#fff' },
              }}
            >
              {config.icon}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {config.label}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            {flag.title}
          </Typography>
          <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>
            {formatTimelineTimestamp(flag.absoluteTimestamp, 'full')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <ConfidenceBadge confidence={flag.confidence} label={flag.confidence.toUpperCase()} size="small" />
            <Typography variant="caption" sx={{ color: '#888' }}>
              by {flag.userDisplayName}
            </Typography>
          </Box>
        </Box>
      }
      placement="top"
      arrow
    >
      <MarkerContainer sx={{ left: position }} onClick={() => onClick?.(flag.id)}>
        <MarkerIcon color={config.color} confidence={flag.confidence}>
          {config.icon}
        </MarkerIcon>
        <MarkerLine color={config.color} />
      </MarkerContainer>
    </Tooltip>
  );
};

// ============================================================================
// FLAGS TRACK COMPONENT
// ============================================================================

interface FlagsTrackProps {
  flags: TimelineItemFlag[];
  timeRange: TimeRange | null;
  zoomLevel: ZoomLevel;
  scrollPosition: number;
  visible: boolean;
  onFlagClick?: (flagId: string) => void;
}

const FlagsTrackContainer = styled(Box)({
  position: 'relative',
  height: 56,
  backgroundColor: '#161616',
  borderBottom: '1px solid #2b2b2b',
});

const FlagsTrackLabel = styled(Box)({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 140,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 12px',
  backgroundColor: '#151515',
  borderRight: '1px solid #2b2b2b',
  zIndex: 5,
});

const FlagsTrackContent = styled(Box)({
  position: 'absolute',
  left: 140,
  top: 0,
  right: 0,
  height: '100%',
  overflow: 'hidden',
});

export const FlagsTrack: React.FC<FlagsTrackProps> = ({
  flags,
  timeRange,
  zoomLevel,
  scrollPosition,
  visible,
  onFlagClick,
}) => {
  if (!visible || !timeRange || flags.length === 0) {
    return null;
  }

  const totalWidth = ((timeRange.end - timeRange.start) / 1000) * zoomLevel.pixelsPerSecond;

  return (
    <FlagsTrackContainer>
      <FlagsTrackLabel>
        <Box
          sx={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(25, 171, 181, 0.2)',
            borderRadius: 1,
          }}
        >
          <FlagIcon sx={{ fontSize: 16, color: '#19abb5' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontWeight: 500,
              color: '#e1e1e1',
              lineHeight: 1.2,
            }}
          >
            All Flags
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontSize: '10px',
              color: '#666',
            }}
          >
            {flags.length} finding{flags.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </FlagsTrackLabel>

      <FlagsTrackContent>
        <Box
          sx={{
            position: 'relative',
            width: totalWidth,
            height: '100%',
            transform: `translateX(-${scrollPosition}px)`,
          }}
        >
          {flags.map((flag) => (
            <FlagMarker
              key={flag.id}
              flag={flag}
              timeRange={timeRange}
              zoomLevel={zoomLevel}
              scrollPosition={0} // Already transformed by parent
              onClick={onFlagClick}
            />
          ))}
        </Box>
      </FlagsTrackContent>
    </FlagsTrackContainer>
  );
};

export default FlagMarker;
