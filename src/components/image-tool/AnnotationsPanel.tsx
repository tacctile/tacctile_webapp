/**
 * AnnotationsPanel Component
 * Vector-based annotation tools and management panel
 */

import React, { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import { styled } from '@mui/material/styles';

// Icons
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import GestureIcon from '@mui/icons-material/Gesture';
import TimelineIcon from '@mui/icons-material/Timeline';
import HexagonIcon from '@mui/icons-material/Hexagon';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import ClearAllIcon from '@mui/icons-material/ClearAll';

import type { ImageAnnotation, ImageToolType, AnnotationDefaults } from '../../types/image';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PanelContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: '#141414',
});

const ToolbarSection = styled(Box)({
  padding: '8px 12px',
  borderBottom: '1px solid #2b2b2b',
});

const ToolGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 4,
  marginBottom: 12,
});

const ToolButton = styled(ToggleButton)({
  border: 'none',
  padding: 8,
  color: '#888888',
  backgroundColor: '#1a1a1a',
  '&.Mui-selected': {
    backgroundColor: 'rgba(25, 171, 181, 0.2)',
    color: '#19abb5',
    '&:hover': {
      backgroundColor: 'rgba(25, 171, 181, 0.3)',
    },
  },
  '&:hover': {
    backgroundColor: '#252525',
  },
});

const ColorPicker = styled(Box)({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  marginBottom: 12,
});

const ColorSwatch = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  cursor: 'pointer',
  border: selected ? '2px solid #fff' : '2px solid transparent',
  '&:hover': {
    opacity: 0.8,
  },
}));

const SliderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 8,
});

const SliderLabel = styled(Typography)({
  fontSize: 11,
  color: '#888888',
  minWidth: 60,
});

const StyledSlider = styled(Slider)({
  flex: 1,
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
    backgroundColor: '#19abb5',
  },
  '& .MuiSlider-track': {
    backgroundColor: '#19abb5',
    height: 2,
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#404040',
    height: 2,
  },
});

const AnnotationList = styled(List)({
  flex: 1,
  overflow: 'auto',
  padding: 0,
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

const AnnotationItem = styled(ListItem)<{ selected?: boolean }>(({ selected }) => ({
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
  borderLeft: selected ? '3px solid #19abb5' : '3px solid transparent',
  paddingLeft: 8,
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

// ============================================================================
// CONSTANTS
// ============================================================================

const ANNOTATION_COLORS = [
  '#ff4444', // Red
  '#ff9800', // Orange
  '#ffeb3b', // Yellow
  '#4caf50', // Green
  '#2196f3', // Blue
  '#9c27b0', // Purple
  '#e91e63', // Pink
  '#00bcd4', // Cyan
  '#ffffff', // White
  '#19abb5', // Brand cyan
];

const TOOL_ICONS: Record<string, React.ReactNode> = {
  circle: <RadioButtonUncheckedIcon />,
  arrow: <ArrowRightAltIcon />,
  rectangle: <CropSquareIcon />,
  text: <TextFieldsIcon />,
  freehand: <GestureIcon />,
  line: <TimelineIcon />,
  polygon: <HexagonIcon />,
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface AnnotationsPanelProps {
  annotations: ImageAnnotation[];
  selectedAnnotationId: string | null;
  activeTool: ImageToolType;
  annotationDefaults: AnnotationDefaults;
  onToolChange: (tool: ImageToolType) => void;
  onAnnotationSelect: (id: string | null) => void;
  onAnnotationUpdate: (id: string, updates: Partial<ImageAnnotation>) => void;
  onAnnotationDelete: (id: string) => void;
  onAnnotationVisibilityToggle: (id: string, visible: boolean) => void;
  onDefaultsChange: (defaults: Partial<AnnotationDefaults>) => void;
  onClearAll: () => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AnnotationsPanel: React.FC<AnnotationsPanelProps> = ({
  annotations,
  selectedAnnotationId,
  activeTool,
  annotationDefaults,
  onToolChange,
  onAnnotationSelect,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationVisibilityToggle,
  onDefaultsChange,
  onClearAll,
  onBringToFront,
  onSendToBack,
}) => {
  const [showDefaults, setShowDefaults] = useState(true);

  const annotationTools: ImageToolType[] = ['circle', 'arrow', 'rectangle', 'text', 'freehand', 'line'];

  const handleToolChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newTool: ImageToolType | null) => {
      if (newTool) {
        onToolChange(newTool);
      }
    },
    [onToolChange]
  );

  const getAnnotationIcon = (type: string) => {
    return TOOL_ICONS[type] || <RadioButtonUncheckedIcon />;
  };

  const getAnnotationLabel = (annotation: ImageAnnotation) => {
    if (annotation.label) return annotation.label;
    const typeLabel = annotation.type.charAt(0).toUpperCase() + annotation.type.slice(1);
    return `${typeLabel} - ${annotation.userDisplayName}`;
  };

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId);

  return (
    <PanelContainer>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderBottom: '1px solid #2b2b2b' }}>
        <Typography variant="subtitle1" sx={{ color: '#e1e1e1', fontWeight: 600, fontSize: 14 }}>
          Annotations
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {annotations.length > 0 && (
            <Tooltip title="Clear All">
              <IconButton size="small" onClick={onClearAll} sx={{ color: '#666666', '&:hover': { color: '#ff5722' } }}>
                <ClearAllIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Tools Section */}
      <ToolbarSection>
        <Typography variant="caption" sx={{ color: '#888888', display: 'block', mb: 1 }}>
          Drawing Tools
        </Typography>
        <ToggleButtonGroup
          value={annotationTools.includes(activeTool) ? activeTool : null}
          exclusive
          onChange={handleToolChange}
          sx={{ display: 'contents' }}
        >
          <ToolGrid>
            {annotationTools.map((tool) => (
              <Tooltip key={tool} title={tool.charAt(0).toUpperCase() + tool.slice(1)}>
                <ToolButton value={tool} selected={activeTool === tool}>
                  {TOOL_ICONS[tool]}
                </ToolButton>
              </Tooltip>
            ))}
          </ToolGrid>
        </ToggleButtonGroup>

        {/* Default Settings */}
        <Box
          onClick={() => setShowDefaults(!showDefaults)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            py: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ color: '#888888' }}>
            Default Settings
          </Typography>
          {showDefaults ? (
            <ExpandLessIcon sx={{ fontSize: 16, color: '#666666' }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 16, color: '#666666' }} />
          )}
        </Box>

        <Collapse in={showDefaults}>
          <Box sx={{ mt: 1 }}>
            {/* Color Picker */}
            <Typography variant="caption" sx={{ color: '#666666', display: 'block', mb: 0.5 }}>
              Color
            </Typography>
            <ColorPicker>
              {ANNOTATION_COLORS.map((color) => (
                <Tooltip key={color} title={color}>
                  <ColorSwatch
                    sx={{ backgroundColor: color }}
                    selected={annotationDefaults.color === color}
                    onClick={() => onDefaultsChange({ color })}
                  />
                </Tooltip>
              ))}
            </ColorPicker>

            {/* Stroke Width */}
            <SliderRow>
              <SliderLabel>Stroke</SliderLabel>
              <StyledSlider
                value={annotationDefaults.strokeWidth}
                min={1}
                max={10}
                step={1}
                onChange={(_, v) => onDefaultsChange({ strokeWidth: v as number })}
                size="small"
              />
              <Typography variant="caption" sx={{ color: '#19abb5', minWidth: 20 }}>
                {annotationDefaults.strokeWidth}
              </Typography>
            </SliderRow>

            {/* Opacity */}
            <SliderRow>
              <SliderLabel>Opacity</SliderLabel>
              <StyledSlider
                value={annotationDefaults.opacity}
                min={0.1}
                max={1}
                step={0.1}
                onChange={(_, v) => onDefaultsChange({ opacity: v as number })}
                size="small"
              />
              <Typography variant="caption" sx={{ color: '#19abb5', minWidth: 20 }}>
                {Math.round(annotationDefaults.opacity * 100)}%
              </Typography>
            </SliderRow>
          </Box>
        </Collapse>
      </ToolbarSection>

      <Divider sx={{ borderColor: '#2b2b2b' }} />

      {/* Selected Annotation Properties */}
      {selectedAnnotation && (
        <>
          <Box sx={{ p: 1.5, borderBottom: '1px solid #2b2b2b' }}>
            <Typography variant="caption" sx={{ color: '#888888', display: 'block', mb: 1 }}>
              Selected: {getAnnotationLabel(selectedAnnotation)}
            </Typography>

            {/* Label Input */}
            <TextField
              size="small"
              placeholder="Label"
              value={selectedAnnotation.label || ''}
              onChange={(e) => onAnnotationUpdate(selectedAnnotation.id, { label: e.target.value })}
              fullWidth
              sx={{
                mb: 1,
                '& .MuiInputBase-root': {
                  backgroundColor: '#1a1a1a',
                  fontSize: 12,
                },
                '& .MuiInputBase-input': {
                  color: '#e1e1e1',
                  padding: '6px 10px',
                },
              }}
            />

            {/* Notes Input */}
            <TextField
              size="small"
              placeholder="Notes"
              value={selectedAnnotation.notes || ''}
              onChange={(e) => onAnnotationUpdate(selectedAnnotation.id, { notes: e.target.value })}
              fullWidth
              multiline
              rows={2}
              sx={{
                mb: 1,
                '& .MuiInputBase-root': {
                  backgroundColor: '#1a1a1a',
                  fontSize: 12,
                },
                '& .MuiInputBase-input': {
                  color: '#e1e1e1',
                },
              }}
            />

            {/* Color for selected */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ColorLensIcon sx={{ fontSize: 16, color: '#666666' }} />
              <ColorPicker sx={{ mb: 0 }}>
                {ANNOTATION_COLORS.map((color) => (
                  <ColorSwatch
                    key={color}
                    sx={{ backgroundColor: color, width: 20, height: 20 }}
                    selected={selectedAnnotation.color === color}
                    onClick={() => onAnnotationUpdate(selectedAnnotation.id, { color })}
                  />
                ))}
              </ColorPicker>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Bring to Front">
                <IconButton
                  size="small"
                  onClick={() => onBringToFront(selectedAnnotation.id)}
                  sx={{ color: '#666666', '&:hover': { color: '#19abb5' } }}
                >
                  <FlipToFrontIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Send to Back">
                <IconButton
                  size="small"
                  onClick={() => onSendToBack(selectedAnnotation.id)}
                  sx={{ color: '#666666', '&:hover': { color: '#19abb5' } }}
                >
                  <FlipToBackIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={selectedAnnotation.locked ? 'Unlock' : 'Lock'}>
                <IconButton
                  size="small"
                  onClick={() => onAnnotationUpdate(selectedAnnotation.id, { locked: !selectedAnnotation.locked })}
                  sx={{ color: selectedAnnotation.locked ? '#ffc107' : '#666666', '&:hover': { color: '#19abb5' } }}
                >
                  {selectedAnnotation.locked ? <LockIcon sx={{ fontSize: 18 }} /> : <LockOpenIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => onAnnotationDelete(selectedAnnotation.id)}
                  sx={{ color: '#666666', '&:hover': { color: '#ff5722' } }}
                >
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Divider sx={{ borderColor: '#2b2b2b' }} />
        </>
      )}

      {/* Annotations List */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="caption" sx={{ color: '#888888' }}>
            Layers ({annotations.length})
          </Typography>
        </Box>

        <AnnotationList>
          {annotations.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: '#666666' }}>
                No annotations yet. Use the tools above to add annotations.
              </Typography>
            </Box>
          ) : (
            [...annotations].reverse().map((annotation) => (
              <AnnotationItem
                key={annotation.id}
                selected={annotation.id === selectedAnnotationId}
                onClick={() => onAnnotationSelect(annotation.id)}
                dense
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Box sx={{ color: annotation.color, display: 'flex' }}>
                    {getAnnotationIcon(annotation.type)}
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={getAnnotationLabel(annotation)}
                  secondary={annotation.userDisplayName}
                  primaryTypographyProps={{
                    variant: 'body2',
                    sx: {
                      color: '#e1e1e1',
                      fontSize: 12,
                      opacity: annotation.visible ? 1 : 0.5,
                      textDecoration: annotation.visible ? 'none' : 'line-through',
                    },
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    sx: { color: '#666666', fontSize: 10 },
                  }}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnnotationVisibilityToggle(annotation.id, !annotation.visible);
                    }}
                    sx={{ color: annotation.visible ? '#666666' : '#444444' }}
                  >
                    {annotation.visible ? (
                      <VisibilityIcon sx={{ fontSize: 16 }} />
                    ) : (
                      <VisibilityOffIcon sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </ListItemSecondaryAction>
              </AnnotationItem>
            ))
          )}
        </AnnotationList>
      </Box>
    </PanelContainer>
  );
};

export default AnnotationsPanel;
