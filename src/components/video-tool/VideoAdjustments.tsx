/**
 * VideoAdjustments Component
 * Non-destructive adjustment controls panel (brightness, contrast, saturation, gamma, filters)
 */

import React, { useCallback, memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';
import RestoreIcon from '@mui/icons-material/Restore';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import ContrastIcon from '@mui/icons-material/Contrast';
import PaletteIcon from '@mui/icons-material/Palette';
import TuneIcon from '@mui/icons-material/Tune';
import FilterIcon from '@mui/icons-material/Filter';
import type { VideoAdjustments as AdjustmentsType, VideoFilterPreset } from '../../types/video';
import { DEFAULT_ADJUSTMENTS } from '../../types/video';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PanelContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#141414',
  borderLeft: '1px solid #2b2b2b',
  overflow: 'hidden',
});

const PanelHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
});

const PanelContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 12,
});

const Section = styled(Box)({
  marginBottom: 16,
});

const SectionTitle = styled(Typography)({
  fontSize: 11,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  marginBottom: 8,
  letterSpacing: 0.5,
});

const AdjustmentRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
});

const AdjustmentLabel = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minWidth: 80,
  fontSize: 12,
  color: '#aaa',
});

const AdjustmentSlider = styled(Slider)({
  flex: 1,
  '& .MuiSlider-thumb': {
    backgroundColor: '#19abb5',
    width: 14,
    height: 14,
    '&:hover, &.Mui-focusVisible': {
      boxShadow: '0 0 0 4px rgba(25, 171, 181, 0.2)',
    },
  },
  '& .MuiSlider-track': {
    backgroundColor: '#19abb5',
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#404040',
  },
  '& .MuiSlider-mark': {
    backgroundColor: '#666',
    width: 2,
    height: 8,
  },
  '& .MuiSlider-markActive': {
    backgroundColor: '#19abb5',
  },
});

const ValueDisplay = styled(Typography)({
  minWidth: 45,
  textAlign: 'right',
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#19abb5',
});

const FilterSelect = styled(Select)({
  '& .MuiSelect-select': {
    padding: '8px 12px',
    fontSize: 13,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#333',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#19abb5',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#19abb5',
  },
});

const ResetButton = styled(IconButton)({
  padding: 4,
  '&:hover': {
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
});

const PresetChip = styled(Box)<{ active?: boolean }>(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 10px',
  borderRadius: 16,
  fontSize: 11,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  backgroundColor: active ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.05)',
  color: active ? '#19abb5' : '#888',
  border: `1px solid ${active ? '#19abb5' : 'transparent'}`,
  '&:hover': {
    backgroundColor: active ? 'rgba(25, 171, 181, 0.3)' : 'rgba(255, 255, 255, 0.1)',
  },
}));

const PresetGrid = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
});

// ============================================================================
// PROPS
// ============================================================================

interface VideoAdjustmentsProps {
  /** Current adjustment values */
  adjustments: AdjustmentsType;
  /** Callback when adjustment changes */
  onAdjustmentChange: <K extends keyof AdjustmentsType>(key: K, value: AdjustmentsType[K]) => void;
  /** Callback when filter preset changes */
  onFilterChange: (filter: VideoFilterPreset) => void;
  /** Callback to reset all adjustments */
  onReset: () => void;
}

// ============================================================================
// FILTER PRESETS
// ============================================================================

const FILTER_OPTIONS: { value: VideoFilterPreset; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'No filter applied' },
  { value: 'nightVision', label: 'Night Vision', description: 'Enhanced low-light visibility (green)' },
  { value: 'thermal', label: 'Thermal', description: 'Heat map visualization' },
  { value: 'edgeDetect', label: 'Edge Detect', description: 'Highlight edges and motion' },
  { value: 'denoise', label: 'Denoise', description: 'Reduce video noise' },
  { value: 'sharpen', label: 'Sharpen', description: 'Enhance detail clarity' },
];

// ============================================================================
// COMPONENT
// ============================================================================

const VideoAdjustments: React.FC<VideoAdjustmentsProps> = memo(({
  adjustments,
  onAdjustmentChange,
  onFilterChange,
  onReset,
}) => {
  // Check if any adjustment differs from default
  const hasChanges =
    adjustments.brightness !== DEFAULT_ADJUSTMENTS.brightness ||
    adjustments.contrast !== DEFAULT_ADJUSTMENTS.contrast ||
    adjustments.saturation !== DEFAULT_ADJUSTMENTS.saturation ||
    adjustments.gamma !== DEFAULT_ADJUSTMENTS.gamma ||
    adjustments.activeFilter !== DEFAULT_ADJUSTMENTS.activeFilter ||
    adjustments.filterIntensity !== DEFAULT_ADJUSTMENTS.filterIntensity;

  // Handlers
  const handleBrightnessChange = useCallback(
    (_: Event, value: number | number[]) => {
      onAdjustmentChange('brightness', value as number);
    },
    [onAdjustmentChange]
  );

  const handleContrastChange = useCallback(
    (_: Event, value: number | number[]) => {
      onAdjustmentChange('contrast', value as number);
    },
    [onAdjustmentChange]
  );

  const handleSaturationChange = useCallback(
    (_: Event, value: number | number[]) => {
      onAdjustmentChange('saturation', value as number);
    },
    [onAdjustmentChange]
  );

  const handleGammaChange = useCallback(
    (_: Event, value: number | number[]) => {
      onAdjustmentChange('gamma', value as number);
    },
    [onAdjustmentChange]
  );

  const handleIntensityChange = useCallback(
    (_: Event, value: number | number[]) => {
      onAdjustmentChange('filterIntensity', value as number);
    },
    [onAdjustmentChange]
  );

  const handleFilterSelect = useCallback(
    (filter: VideoFilterPreset) => {
      onFilterChange(filter);
    },
    [onFilterChange]
  );

  // Format value for display
  const formatValue = (value: number, type: 'brightness' | 'contrast' | 'saturation' | 'gamma' | 'intensity'): string => {
    switch (type) {
      case 'brightness':
        return value > 0 ? `+${value}` : `${value}`;
      case 'contrast':
      case 'saturation':
      case 'intensity':
        return `${value}%`;
      case 'gamma':
        return value.toFixed(2);
      default:
        return `${value}`;
    }
  };

  return (
    <PanelContainer>
      {/* Header */}
      <PanelHeader>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Adjustments
        </Typography>
        <Tooltip title="Reset to defaults">
          <span>
            <ResetButton
              size="small"
              onClick={onReset}
              disabled={!hasChanges}
              sx={{ color: hasChanges ? '#19abb5' : '#555' }}
            >
              <RestoreIcon sx={{ fontSize: 18 }} />
            </ResetButton>
          </span>
        </Tooltip>
      </PanelHeader>

      {/* Content */}
      <PanelContent>
        {/* Color Adjustments */}
        <Section>
          <SectionTitle>Color Corrections</SectionTitle>

          {/* Brightness */}
          <AdjustmentRow>
            <AdjustmentLabel>
              <BrightnessHighIcon sx={{ fontSize: 16, color: '#666' }} />
              <span>Brightness</span>
            </AdjustmentLabel>
            <AdjustmentSlider
              value={adjustments.brightness}
              min={-100}
              max={100}
              marks={[{ value: 0, label: '' }]}
              onChange={handleBrightnessChange}
            />
            <ValueDisplay>
              {formatValue(adjustments.brightness, 'brightness')}
            </ValueDisplay>
          </AdjustmentRow>

          {/* Contrast */}
          <AdjustmentRow>
            <AdjustmentLabel>
              <ContrastIcon sx={{ fontSize: 16, color: '#666' }} />
              <span>Contrast</span>
            </AdjustmentLabel>
            <AdjustmentSlider
              value={adjustments.contrast}
              min={0}
              max={200}
              marks={[{ value: 100, label: '' }]}
              onChange={handleContrastChange}
            />
            <ValueDisplay>
              {formatValue(adjustments.contrast, 'contrast')}
            </ValueDisplay>
          </AdjustmentRow>

          {/* Saturation */}
          <AdjustmentRow>
            <AdjustmentLabel>
              <PaletteIcon sx={{ fontSize: 16, color: '#666' }} />
              <span>Saturation</span>
            </AdjustmentLabel>
            <AdjustmentSlider
              value={adjustments.saturation}
              min={0}
              max={200}
              marks={[{ value: 100, label: '' }]}
              onChange={handleSaturationChange}
            />
            <ValueDisplay>
              {formatValue(adjustments.saturation, 'saturation')}
            </ValueDisplay>
          </AdjustmentRow>

          {/* Gamma */}
          <AdjustmentRow>
            <AdjustmentLabel>
              <TuneIcon sx={{ fontSize: 16, color: '#666' }} />
              <span>Gamma</span>
            </AdjustmentLabel>
            <AdjustmentSlider
              value={adjustments.gamma}
              min={0.1}
              max={3.0}
              step={0.1}
              marks={[{ value: 1.0, label: '' }]}
              onChange={handleGammaChange}
            />
            <ValueDisplay>
              {formatValue(adjustments.gamma, 'gamma')}
            </ValueDisplay>
          </AdjustmentRow>
        </Section>

        <Divider sx={{ borderColor: '#2b2b2b', my: 2 }} />

        {/* Filter Presets */}
        <Section>
          <SectionTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FilterIcon sx={{ fontSize: 14 }} />
              Filter Presets
            </Box>
          </SectionTitle>

          <PresetGrid>
            {FILTER_OPTIONS.map((option) => (
              <Tooltip key={option.value} title={option.description} arrow>
                <PresetChip
                  active={adjustments.activeFilter === option.value}
                  onClick={() => handleFilterSelect(option.value)}
                >
                  {option.label}
                </PresetChip>
              </Tooltip>
            ))}
          </PresetGrid>
        </Section>

        {/* Filter Intensity (only when filter is not normal) */}
        {adjustments.activeFilter !== 'normal' && (
          <Section>
            <SectionTitle>Filter Intensity</SectionTitle>
            <AdjustmentRow>
              <AdjustmentLabel>
                <span>Intensity</span>
              </AdjustmentLabel>
              <AdjustmentSlider
                value={adjustments.filterIntensity}
                min={0}
                max={100}
                onChange={handleIntensityChange}
              />
              <ValueDisplay>
                {formatValue(adjustments.filterIntensity, 'intensity')}
              </ValueDisplay>
            </AdjustmentRow>
          </Section>
        )}

        <Divider sx={{ borderColor: '#2b2b2b', my: 2 }} />

        {/* Info */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1 }}>
            Adjustments are non-destructive and applied in real-time using GPU acceleration.
          </Typography>
          <Typography variant="caption" sx={{ color: '#555' }}>
            Press R to reset all adjustments.
          </Typography>
        </Box>
      </PanelContent>
    </PanelContainer>
  );
});

VideoAdjustments.displayName = 'VideoAdjustments';

export default VideoAdjustments;
