/**
 * FilterPanel Component
 * Non-destructive audio filters: EQ, noise reduction, gain
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import { styled } from '@mui/material/styles';

// Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import TuneIcon from '@mui/icons-material/Tune';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

import type { FilterSettings, EQBand, NoiseReductionSettings, GainSettings } from '../../types/audio';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PanelContainer = styled(Box)({
  backgroundColor: '#1a1a1a',
  borderRadius: 8,
  overflow: 'hidden',
});

const SectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#242424',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#2a2a2a',
  },
});

const SectionTitle = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const SectionContent = styled(Box)({
  padding: '12px',
});

const SliderContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
});

const SliderLabel = styled(Typography)({
  width: 80,
  fontSize: 12,
  color: '#aaaaaa',
});

const SliderValue = styled(Typography)({
  width: 50,
  fontSize: 12,
  color: '#e1e1e1',
  textAlign: 'right',
  fontFamily: 'monospace',
});

const EQContainer = styled(Box)({
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
  justifyContent: 'space-around',
  padding: '8px 0',
});

const EQBandSlider = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
});

const EQSlider = styled(Slider)({
  height: 100,
  '& .MuiSlider-rail': {
    backgroundColor: '#404040',
  },
  '& .MuiSlider-track': {
    backgroundColor: '#19abb5',
  },
  '& .MuiSlider-thumb': {
    backgroundColor: '#19abb5',
    width: 14,
    height: 14,
    '&:hover': {
      boxShadow: '0 0 0 8px rgba(25, 171, 181, 0.16)',
    },
  },
});

const StyledSwitch = styled(Switch)({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: '#19abb5',
    '& + .MuiSwitch-track': {
      backgroundColor: '#19abb5',
    },
  },
});

const BypassButton = styled(IconButton)<{ active?: boolean }>(({ active }) => ({
  backgroundColor: active ? '#ff5722' : '#333333',
  color: active ? '#ffffff' : '#888888',
  '&:hover': {
    backgroundColor: active ? '#ff7043' : '#444444',
  },
}));

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface FilterPanelProps {
  /** Current filter settings */
  settings: FilterSettings;
  /** Whether filters are bypassed */
  bypassed?: boolean;
  /** Callback when filter settings change */
  onSettingsChange: (settings: Partial<FilterSettings>) => void;
  /** Callback when EQ band changes */
  onEQBandChange: (bandId: string, updates: Partial<EQBand>) => void;
  /** Callback when noise reduction changes */
  onNoiseReductionChange: (settings: Partial<NoiseReductionSettings>) => void;
  /** Callback when gain changes */
  onGainChange: (settings: Partial<GainSettings>) => void;
  /** Callback to reset filters */
  onReset: () => void;
  /** Callback to toggle bypass */
  onBypassToggle: () => void;
  /** Callback to learn noise profile from selection */
  onLearnNoiseProfile?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const FilterPanel: React.FC<FilterPanelProps> = ({
  settings,
  bypassed = false,
  onSettingsChange,
  onEQBandChange,
  onNoiseReductionChange,
  onGainChange,
  onReset,
  onBypassToggle,
  onLearnNoiseProfile,
}) => {
  const [expandedSections, setExpandedSections] = React.useState({
    eq: true,
    noiseReduction: true,
    gain: true,
    filters: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatFrequency = (freq: number): string => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(freq >= 10000 ? 0 : 1)}k`;
    }
    return `${freq}`;
  };

  const formatGain = (gain: number): string => {
    return gain >= 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1);
  };

  return (
    <PanelContainer>
      {/* Header with Bypass */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: '1px solid #2b2b2b',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneIcon sx={{ color: '#19abb5', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Filters
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Reset all filters">
            <IconButton size="small" onClick={onReset}>
              <RefreshIcon sx={{ fontSize: 18, color: '#888888' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={bypassed ? 'Enable filters' : 'Bypass all filters'}>
            <BypassButton size="small" active={bypassed} onClick={onBypassToggle}>
              <PowerSettingsNewIcon sx={{ fontSize: 18 }} />
            </BypassButton>
          </Tooltip>
        </Box>
      </Box>

      {/* EQ Section */}
      <Box>
        <SectionHeader onClick={() => toggleSection('eq')}>
          <SectionTitle>
            <GraphicEqIcon sx={{ color: '#19abb5', fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Equalizer
            </Typography>
          </SectionTitle>
          {expandedSections.eq ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </SectionHeader>
        <Collapse in={expandedSections.eq}>
          <SectionContent>
            <EQContainer>
              {settings.eq.map((band) => (
                <EQBandSlider key={band.id}>
                  <Typography
                    variant="caption"
                    sx={{ color: band.enabled ? '#e1e1e1' : '#666666', fontSize: 10 }}
                  >
                    {formatGain(band.gain)} dB
                  </Typography>
                  <EQSlider
                    orientation="vertical"
                    value={band.gain}
                    min={-24}
                    max={24}
                    step={0.5}
                    disabled={!band.enabled || bypassed}
                    onChange={(_, value) => onEQBandChange(band.id, { gain: value as number })}
                    sx={{ opacity: band.enabled ? 1 : 0.5 }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: band.enabled ? '#888888' : '#555555', fontSize: 10 }}
                  >
                    {formatFrequency(band.frequency)}
                  </Typography>
                  <StyledSwitch
                    size="small"
                    checked={band.enabled}
                    onChange={(e) => onEQBandChange(band.id, { enabled: e.target.checked })}
                  />
                </EQBandSlider>
              ))}
            </EQContainer>
          </SectionContent>
        </Collapse>
      </Box>

      <Divider sx={{ borderColor: '#2b2b2b' }} />

      {/* Noise Reduction Section */}
      <Box>
        <SectionHeader onClick={() => toggleSection('noiseReduction')}>
          <SectionTitle>
            <NoiseAwareIcon sx={{ color: '#19abb5', fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Noise Reduction
            </Typography>
          </SectionTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StyledSwitch
              size="small"
              checked={settings.noiseReduction.enabled}
              onChange={(e) => {
                e.stopPropagation();
                onNoiseReductionChange({ enabled: e.target.checked });
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {expandedSections.noiseReduction ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
        </SectionHeader>
        <Collapse in={expandedSections.noiseReduction}>
          <SectionContent>
            <SliderContainer>
              <SliderLabel>Amount</SliderLabel>
              <Slider
                value={settings.noiseReduction.amount}
                min={0}
                max={100}
                disabled={!settings.noiseReduction.enabled || bypassed}
                onChange={(_, value) => onNoiseReductionChange({ amount: value as number })}
                sx={{
                  flex: 1,
                  '& .MuiSlider-thumb': { backgroundColor: '#19abb5' },
                  '& .MuiSlider-track': { backgroundColor: '#19abb5' },
                }}
              />
              <SliderValue>{settings.noiseReduction.amount}%</SliderValue>
            </SliderContainer>

            <SliderContainer>
              <SliderLabel>Threshold</SliderLabel>
              <Slider
                value={settings.noiseReduction.threshold}
                min={-80}
                max={0}
                disabled={!settings.noiseReduction.enabled || bypassed}
                onChange={(_, value) => onNoiseReductionChange({ threshold: value as number })}
                sx={{
                  flex: 1,
                  '& .MuiSlider-thumb': { backgroundColor: '#19abb5' },
                  '& .MuiSlider-track': { backgroundColor: '#19abb5' },
                }}
              />
              <SliderValue>{settings.noiseReduction.threshold} dB</SliderValue>
            </SliderContainer>

            <SliderContainer>
              <SliderLabel>Attack</SliderLabel>
              <Slider
                value={settings.noiseReduction.attack}
                min={1}
                max={100}
                disabled={!settings.noiseReduction.enabled || bypassed}
                onChange={(_, value) => onNoiseReductionChange({ attack: value as number })}
                sx={{
                  flex: 1,
                  '& .MuiSlider-thumb': { backgroundColor: '#19abb5' },
                  '& .MuiSlider-track': { backgroundColor: '#19abb5' },
                }}
              />
              <SliderValue>{settings.noiseReduction.attack} ms</SliderValue>
            </SliderContainer>

            <SliderContainer>
              <SliderLabel>Release</SliderLabel>
              <Slider
                value={settings.noiseReduction.release}
                min={10}
                max={500}
                disabled={!settings.noiseReduction.enabled || bypassed}
                onChange={(_, value) => onNoiseReductionChange({ release: value as number })}
                sx={{
                  flex: 1,
                  '& .MuiSlider-thumb': { backgroundColor: '#19abb5' },
                  '& .MuiSlider-track': { backgroundColor: '#19abb5' },
                }}
              />
              <SliderValue>{settings.noiseReduction.release} ms</SliderValue>
            </SliderContainer>

            {onLearnNoiseProfile && (
              <Box sx={{ mt: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#888888',
                    display: 'block',
                    mb: 1,
                    fontSize: 11,
                  }}
                >
                  Select a region with noise only, then click to learn the noise profile
                </Typography>
                <IconButton
                  size="small"
                  onClick={onLearnNoiseProfile}
                  disabled={!settings.noiseReduction.enabled || bypassed}
                  sx={{
                    backgroundColor: '#333333',
                    color: '#e1e1e1',
                    fontSize: 12,
                    borderRadius: 1,
                    px: 2,
                    '&:hover': { backgroundColor: '#444444' },
                  }}
                >
                  Learn Noise Profile
                </IconButton>
              </Box>
            )}
          </SectionContent>
        </Collapse>
      </Box>

      <Divider sx={{ borderColor: '#2b2b2b' }} />

      {/* Gain Section */}
      <Box>
        <SectionHeader onClick={() => toggleSection('gain')}>
          <SectionTitle>
            <VolumeUpIcon sx={{ color: '#19abb5', fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Gain
            </Typography>
          </SectionTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StyledSwitch
              size="small"
              checked={settings.gain.enabled}
              onChange={(e) => {
                e.stopPropagation();
                onGainChange({ enabled: e.target.checked });
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {expandedSections.gain ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
        </SectionHeader>
        <Collapse in={expandedSections.gain}>
          <SectionContent>
            <SliderContainer>
              <SliderLabel>Gain</SliderLabel>
              <Slider
                value={settings.gain.value}
                min={-24}
                max={24}
                step={0.5}
                disabled={!settings.gain.enabled || bypassed}
                onChange={(_, value) => onGainChange({ value: value as number })}
                marks={[
                  { value: -24, label: '-24' },
                  { value: 0, label: '0' },
                  { value: 24, label: '+24' },
                ]}
                sx={{
                  flex: 1,
                  '& .MuiSlider-thumb': { backgroundColor: '#19abb5' },
                  '& .MuiSlider-track': { backgroundColor: '#19abb5' },
                  '& .MuiSlider-markLabel': { fontSize: 10, color: '#666666' },
                }}
              />
              <SliderValue>{formatGain(settings.gain.value)} dB</SliderValue>
            </SliderContainer>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <FormControlLabel
                control={
                  <StyledSwitch
                    size="small"
                    checked={settings.gain.normalize}
                    onChange={(e) => onGainChange({ normalize: e.target.checked })}
                    disabled={!settings.gain.enabled || bypassed}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: '#aaaaaa' }}>
                    Normalize
                  </Typography>
                }
              />
              {settings.gain.normalize && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: '#888888' }}>
                    Target:
                  </Typography>
                  <Slider
                    value={settings.gain.targetLevel}
                    min={-12}
                    max={0}
                    step={0.5}
                    disabled={!settings.gain.enabled || !settings.gain.normalize || bypassed}
                    onChange={(_, value) => onGainChange({ targetLevel: value as number })}
                    sx={{
                      width: 100,
                      '& .MuiSlider-thumb': { backgroundColor: '#19abb5', width: 12, height: 12 },
                      '& .MuiSlider-track': { backgroundColor: '#19abb5' },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#e1e1e1', fontFamily: 'monospace' }}>
                    {settings.gain.targetLevel} dB
                  </Typography>
                </Box>
              )}
            </Box>
          </SectionContent>
        </Collapse>
      </Box>

      <Divider sx={{ borderColor: '#2b2b2b' }} />

      {/* High/Low Pass Filters Section */}
      <Box>
        <SectionHeader onClick={() => toggleSection('filters')}>
          <SectionTitle>
            <TuneIcon sx={{ color: '#19abb5', fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              High/Low Pass
            </Typography>
          </SectionTitle>
          {expandedSections.filters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </SectionHeader>
        <Collapse in={expandedSections.filters}>
          <SectionContent>
            {/* High Pass Filter */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#aaaaaa' }}>
                  High Pass (removes low rumble)
                </Typography>
                <StyledSwitch
                  size="small"
                  checked={settings.highPassEnabled}
                  onChange={(e) => onSettingsChange({ highPassEnabled: e.target.checked })}
                />
              </Box>
              <SliderContainer>
                <SliderLabel>Cutoff</SliderLabel>
                <Slider
                  value={settings.highPassCutoff}
                  min={20}
                  max={500}
                  disabled={!settings.highPassEnabled || bypassed}
                  onChange={(_, value) => onSettingsChange({ highPassCutoff: value as number })}
                  sx={{
                    flex: 1,
                    '& .MuiSlider-thumb': { backgroundColor: '#19abb5' },
                    '& .MuiSlider-track': { backgroundColor: '#19abb5' },
                  }}
                />
                <SliderValue>{settings.highPassCutoff} Hz</SliderValue>
              </SliderContainer>
            </Box>

            {/* Low Pass Filter */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#aaaaaa' }}>
                  Low Pass (removes high hiss)
                </Typography>
                <StyledSwitch
                  size="small"
                  checked={settings.lowPassEnabled}
                  onChange={(e) => onSettingsChange({ lowPassEnabled: e.target.checked })}
                />
              </Box>
              <SliderContainer>
                <SliderLabel>Cutoff</SliderLabel>
                <Slider
                  value={settings.lowPassCutoff}
                  min={1000}
                  max={20000}
                  disabled={!settings.lowPassEnabled || bypassed}
                  onChange={(_, value) => onSettingsChange({ lowPassCutoff: value as number })}
                  sx={{
                    flex: 1,
                    '& .MuiSlider-thumb': { backgroundColor: '#19abb5' },
                    '& .MuiSlider-track': { backgroundColor: '#19abb5' },
                  }}
                />
                <SliderValue>{formatFrequency(settings.lowPassCutoff)} Hz</SliderValue>
              </SliderContainer>
            </Box>
          </SectionContent>
        </Collapse>
      </Box>
    </PanelContainer>
  );
};

export default FilterPanel;
