/**
 * AdjustmentsPanel Component
 * Lightroom-inspired adjustment controls for non-destructive image editing
 */

import React, { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';

// Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ContrastIcon from '@mui/icons-material/Contrast';
import TuneIcon from '@mui/icons-material/Tune';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import type { ImageAdjustments } from '../../types/image';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PanelContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'auto',
  backgroundColor: '#141414',
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#404040',
    borderRadius: 3,
  },
});

const SectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover': {
    backgroundColor: '#222222',
  },
});

const SectionTitle = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const SectionContent = styled(Box)({
  padding: '8px 12px 16px',
});

const SliderRow = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: 12,
});

const SliderHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 4,
});

const SliderLabel = styled(Typography)({
  fontSize: 12,
  color: '#999999',
});

const SliderValue = styled(Typography)({
  fontSize: 11,
  color: '#19abb5',
  fontFamily: 'monospace',
  minWidth: 40,
  textAlign: 'right',
});

const StyledSlider = styled(Slider)({
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
    backgroundColor: '#19abb5',
    '&:hover': {
      boxShadow: '0 0 0 4px rgba(25, 171, 181, 0.2)',
    },
  },
  '& .MuiSlider-track': {
    backgroundColor: '#19abb5',
    height: 3,
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#404040',
    height: 3,
  },
  '& .MuiSlider-mark': {
    backgroundColor: '#606060',
    width: 1,
    height: 8,
  },
});

const ResetButton = styled(IconButton)({
  padding: 4,
  color: '#666666',
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface AdjustmentsPanelProps {
  adjustments: ImageAdjustments;
  onAdjustmentChange: <K extends keyof ImageAdjustments>(key: K, value: ImageAdjustments[K]) => void;
  onReset: () => void;
  onResetSingle: (key: keyof ImageAdjustments) => void;
}

// ============================================================================
// SECTION DATA
// ============================================================================

interface SliderConfig {
  key: keyof ImageAdjustments | string;
  label: string;
  min: number;
  max: number;
  step: number;
  marks?: boolean;
  formatValue?: (value: number) => string;
}

const basicSliders: SliderConfig[] = [
  { key: 'exposure', label: 'Exposure', min: -5, max: 5, step: 0.1, marks: true, formatValue: (v) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, marks: true },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1, marks: true },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1, marks: true },
  { key: 'whites', label: 'Whites', min: -100, max: 100, step: 1, marks: true },
  { key: 'blacks', label: 'Blacks', min: -100, max: 100, step: 1, marks: true },
];

const presenceSliders: SliderConfig[] = [
  { key: 'clarity', label: 'Clarity', min: -100, max: 100, step: 1, marks: true },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, step: 1, marks: true },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, marks: true },
];

const colorSliders: SliderConfig[] = [
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, step: 1, marks: true },
  { key: 'tint', label: 'Tint', min: -100, max: 100, step: 1, marks: true },
];

const sharpeningSliders: SliderConfig[] = [
  { key: 'sharpening.amount', label: 'Amount', min: 0, max: 150, step: 1 },
  { key: 'sharpening.radius', label: 'Radius', min: 0.5, max: 3, step: 0.1, formatValue: (v) => v.toFixed(1) },
  { key: 'sharpening.detail', label: 'Detail', min: 0, max: 100, step: 1 },
  { key: 'sharpening.masking', label: 'Masking', min: 0, max: 100, step: 1 },
];

const noiseReductionSliders: SliderConfig[] = [
  { key: 'noiseReduction.luminance', label: 'Luminance', min: 0, max: 100, step: 1 },
  { key: 'noiseReduction.color', label: 'Color', min: 0, max: 100, step: 1 },
  { key: 'noiseReduction.detail', label: 'Detail', min: 0, max: 100, step: 1 },
];

const vignetteSliders: SliderConfig[] = [
  { key: 'vignette.amount', label: 'Amount', min: -100, max: 100, step: 1, marks: true },
  { key: 'vignette.midpoint', label: 'Midpoint', min: 0, max: 100, step: 1 },
  { key: 'vignette.roundness', label: 'Roundness', min: -100, max: 100, step: 1, marks: true },
  { key: 'vignette.feather', label: 'Feather', min: 0, max: 100, step: 1 },
];

const grainSliders: SliderConfig[] = [
  { key: 'grain.amount', label: 'Amount', min: 0, max: 100, step: 1 },
  { key: 'grain.size', label: 'Size', min: 1, max: 100, step: 1 },
  { key: 'grain.roughness', label: 'Roughness', min: 0, max: 100, step: 1 },
];

// ============================================================================
// COMPONENT
// ============================================================================

const AdjustmentsPanel: React.FC<AdjustmentsPanelProps> = ({
  adjustments,
  onAdjustmentChange,
  onReset,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onResetSingle: _onResetSingle,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    presence: true,
    color: true,
    detail: false,
    effects: false,
  });

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const getValue = useCallback((key: string): number => {
    if (key.includes('.')) {
      const parts = key.split('.');
      const parent = parts[0];
      const child = parts[1];
      if (!parent || !child) return 0;
      const parentObj = adjustments[parent as keyof ImageAdjustments];
      if (typeof parentObj === 'object' && parentObj !== null && !Array.isArray(parentObj)) {
        const obj = parentObj as unknown as Record<string, number>;
        return obj[child] ?? 0;
      }
      return 0;
    }
    const value = adjustments[key as keyof ImageAdjustments];
    return typeof value === 'number' ? value : 0;
  }, [adjustments]);

  const handleChange = useCallback((key: string, value: number) => {
    if (key.includes('.')) {
      const parts = key.split('.');
      const parent = parts[0];
      const child = parts[1];
      if (!parent || !child) return;
      const parentObj = adjustments[parent as keyof ImageAdjustments];
      if (typeof parentObj === 'object' && parentObj !== null && !Array.isArray(parentObj)) {
        const updatedObj = {
          ...(parentObj as unknown as Record<string, number>),
          [child]: value,
        };
        onAdjustmentChange(parent as keyof ImageAdjustments, updatedObj as unknown as ImageAdjustments[keyof ImageAdjustments]);
      }
    } else {
      onAdjustmentChange(key as keyof ImageAdjustments, value as unknown as ImageAdjustments[keyof ImageAdjustments]);
    }
  }, [adjustments, onAdjustmentChange]);

  const renderSlider = (config: SliderConfig) => {
    const value = getValue(config.key);
    const displayValue = config.formatValue ? config.formatValue(value) : Math.round(value).toString();
    const isNonZero = value !== 0;

    return (
      <SliderRow key={config.key}>
        <SliderHeader>
          <SliderLabel>{config.label}</SliderLabel>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SliderValue>{displayValue}</SliderValue>
            {isNonZero && (
              <Tooltip title={`Reset ${config.label}`}>
                <ResetButton size="small" onClick={() => handleChange(config.key, config.key === 'sharpening.radius' ? 1 : 0)}>
                  <RefreshIcon sx={{ fontSize: 14 }} />
                </ResetButton>
              </Tooltip>
            )}
          </Box>
        </SliderHeader>
        <StyledSlider
          value={value}
          min={config.min}
          max={config.max}
          step={config.step}
          marks={config.marks ? [{ value: 0 }] : undefined}
          onChange={(_, v) => handleChange(config.key, v as number)}
          size="small"
        />
      </SliderRow>
    );
  };

  const renderSection = (
    id: string,
    title: string,
    icon: React.ReactNode,
    sliders: SliderConfig[]
  ) => (
    <Box key={id}>
      <SectionHeader onClick={() => toggleSection(id)}>
        <SectionTitle>
          {icon}
          <Typography variant="subtitle2" sx={{ color: '#e1e1e1', fontSize: 13 }}>
            {title}
          </Typography>
        </SectionTitle>
        {expandedSections[id] ? (
          <ExpandLessIcon sx={{ fontSize: 18, color: '#666666' }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: 18, color: '#666666' }} />
        )}
      </SectionHeader>
      <Collapse in={expandedSections[id]}>
        <SectionContent>
          {sliders.map(renderSlider)}
        </SectionContent>
      </Collapse>
      <Divider sx={{ borderColor: '#2b2b2b' }} />
    </Box>
  );

  return (
    <PanelContainer>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderBottom: '1px solid #2b2b2b' }}>
        <Typography variant="subtitle1" sx={{ color: '#e1e1e1', fontWeight: 600, fontSize: 14 }}>
          Adjustments
        </Typography>
        <Tooltip title="Reset All">
          <IconButton size="small" onClick={onReset} sx={{ color: '#666666', '&:hover': { color: '#ff5722' } }}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Sections */}
      {renderSection('basic', 'Basic', <WbSunnyIcon sx={{ fontSize: 16, color: '#19abb5' }} />, basicSliders)}
      {renderSection('presence', 'Presence', <ContrastIcon sx={{ fontSize: 16, color: '#19abb5' }} />, presenceSliders)}
      {renderSection('color', 'Color', <ColorLensIcon sx={{ fontSize: 16, color: '#19abb5' }} />, colorSliders)}
      {renderSection('detail', 'Detail', <TuneIcon sx={{ fontSize: 16, color: '#19abb5' }} />, [
        ...sharpeningSliders,
        ...noiseReductionSliders,
      ])}
      {renderSection('effects', 'Effects', <AutoFixHighIcon sx={{ fontSize: 16, color: '#19abb5' }} />, [
        ...vignetteSliders,
        ...grainSliders,
      ])}
    </PanelContainer>
  );
};

export default AdjustmentsPanel;
