/**
 * SourcePanel Component
 * Add and manage sources (cameras, overlays, widgets) for the active scene
 */

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Slider from '@mui/material/Slider';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import { styled } from '@mui/material/styles';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

import type { Scene, Source, SourceType, SourceTransform } from '../../types/streaming';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

const Header = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  borderBottom: '1px solid #2b2b2b',
});

const Title = styled(Typography)({
  fontSize: 12,
  fontWeight: 600,
  color: '#888888',
  textTransform: 'uppercase',
  letterSpacing: 1,
});

const SourceList = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 8,
});

const SourceItem = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 10px',
  marginBottom: 4,
  borderRadius: 6,
  cursor: 'pointer',
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
  border: `1px solid ${selected ? '#19abb5' : 'transparent'}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

const SourceIcon = styled(Box)({
  width: 32,
  height: 32,
  borderRadius: 6,
  backgroundColor: '#252525',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 10,
});

const SourceInfo = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const SourceName = styled(Typography)({
  fontSize: 13,
  fontWeight: 500,
  color: '#e1e1e1',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const SourceType = styled(Typography)({
  fontSize: 11,
  color: '#666666',
  textTransform: 'capitalize',
});

const SourceActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

const PropertiesSection = styled(Box)({
  padding: 12,
  borderTop: '1px solid #2b2b2b',
  backgroundColor: '#0f0f0f',
});

const PropertyRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginBottom: 12,
  gap: 8,
});

const PropertyLabel = styled(Typography)({
  fontSize: 12,
  color: '#888888',
  width: 80,
  flexShrink: 0,
});

const AddButton = styled(IconButton)({
  backgroundColor: '#252525',
  '&:hover': {
    backgroundColor: '#333333',
  },
});

// ============================================================================
// SOURCE TYPE CONFIG
// ============================================================================

const SOURCE_TYPES: { type: SourceType; label: string; icon: React.ReactNode }[] = [
  { type: 'camera', label: 'Camera', icon: <VideocamIcon sx={{ fontSize: 18 }} /> },
  { type: 'screen_share', label: 'Screen Share', icon: <ScreenShareIcon sx={{ fontSize: 18 }} /> },
  { type: 'image', label: 'Image', icon: <ImageIcon sx={{ fontSize: 18 }} /> },
  { type: 'text', label: 'Text', icon: <TextFieldsIcon sx={{ fontSize: 18 }} /> },
  { type: 'color', label: 'Color', icon: <FormatColorFillIcon sx={{ fontSize: 18 }} /> },
  { type: 'emf_widget', label: 'EMF Widget', icon: <ElectricBoltIcon sx={{ fontSize: 18 }} /> },
  { type: 'temperature_widget', label: 'Temperature Widget', icon: <ThermostatIcon sx={{ fontSize: 18 }} /> },
  { type: 'motion_widget', label: 'Motion Widget', icon: <DirectionsRunIcon sx={{ fontSize: 18 }} /> },
  { type: 'timestamp_widget', label: 'Timestamp', icon: <AccessTimeIcon sx={{ fontSize: 18 }} /> },
  { type: 'audio_meter', label: 'Audio Meter', icon: <GraphicEqIcon sx={{ fontSize: 18 }} /> },
];

const getSourceIcon = (type: SourceType) => {
  const config = SOURCE_TYPES.find((t) => t.type === type);
  return config?.icon || <VideocamIcon sx={{ fontSize: 18 }} />;
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface SourcePanelProps {
  scene: Scene | null;
  availableDevices: MediaDeviceInfo[];
  onAddSource: (source: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>) => string | void;
  onRemoveSource: (sourceId: string) => void;
  onUpdateSource: (sourceId: string, updates: Partial<Source>) => void;
  onUpdateTransform: (sourceId: string, transform: Partial<SourceTransform>) => void;
  onSelectSource: (sourceId: string | null) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const SourcePanel: React.FC<SourcePanelProps> = ({
  scene,
  availableDevices,
  onAddSource,
  onRemoveSource,
  onUpdateSource,
  onUpdateTransform,
  onSelectSource,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [showProperties, setShowProperties] = useState(true);

  const selectedSource = scene?.sources.find((s) => s.id === selectedSourceId);

  const handleOpenMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(e.currentTarget);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleAddSource = useCallback(
    (type: SourceType) => {
      const config = SOURCE_TYPES.find((t) => t.type === type);
      const defaultTransform: SourceTransform = {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        visible: true,
        locked: false,
      };

      // Adjust defaults for widgets
      if (type.includes('widget')) {
        defaultTransform.width = 150;
        defaultTransform.height = 80;
        defaultTransform.x = 50;
        defaultTransform.y = 50;
      }

      const newSource: Omit<Source, 'id' | 'createdAt' | 'updatedAt'> = {
        name: config?.label || 'New Source',
        type,
        transform: defaultTransform,
        settings: {},
        zIndex: scene?.sources.length || 0,
      };

      // Set default settings based on type
      if (type === 'emf_widget') {
        newSource.settings = { labelText: 'EMF', unit: 'mG', alertThreshold: 5 };
      } else if (type === 'temperature_widget') {
        newSource.settings = { labelText: 'TEMP', unit: '°F', alertThreshold: 75 };
      } else if (type === 'motion_widget') {
        newSource.settings = { labelText: 'MOTION' };
      } else if (type === 'text') {
        newSource.settings = {
          text: 'Text',
          fontSize: 48,
          fontColor: '#ffffff',
          fontFamily: 'sans-serif',
        };
        newSource.transform.width = 400;
        newSource.transform.height = 80;
      } else if (type === 'color') {
        newSource.settings = { color: '#000000' };
      }

      const sourceId = onAddSource(newSource);
      if (sourceId) {
        setSelectedSourceId(sourceId);
        onSelectSource(sourceId);
      }
      handleCloseMenu();
    },
    [scene, onAddSource, onSelectSource, handleCloseMenu]
  );

  const handleSelectSource = useCallback(
    (sourceId: string) => {
      setSelectedSourceId(sourceId);
      onSelectSource(sourceId);
    },
    [onSelectSource]
  );

  const handleToggleVisibility = useCallback(
    (e: React.MouseEvent, source: Source) => {
      e.stopPropagation();
      onUpdateTransform(source.id, { visible: !source.transform.visible });
    },
    [onUpdateTransform]
  );

  const handleToggleLock = useCallback(
    (e: React.MouseEvent, source: Source) => {
      e.stopPropagation();
      onUpdateTransform(source.id, { locked: !source.transform.locked });
    },
    [onUpdateTransform]
  );

  const handleDeleteSource = useCallback(
    (e: React.MouseEvent, sourceId: string) => {
      e.stopPropagation();
      onRemoveSource(sourceId);
      if (selectedSourceId === sourceId) {
        setSelectedSourceId(null);
        onSelectSource(null);
      }
    },
    [selectedSourceId, onRemoveSource, onSelectSource]
  );

  const videoDevices = availableDevices.filter((d) => d.kind === 'videoinput');

  return (
    <Container>
      {/* Source List Header */}
      <Header>
        <Title>Sources</Title>
        <Tooltip title="Add Source">
          <AddButton size="small" onClick={handleOpenMenu}>
            <AddIcon sx={{ fontSize: 18 }} />
          </AddButton>
        </Tooltip>
      </Header>

      {/* Add Source Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            border: '1px solid #333333',
            maxHeight: 400,
          },
        }}
      >
        {SOURCE_TYPES.map((sourceType) => (
          <MenuItem key={sourceType.type} onClick={() => handleAddSource(sourceType.type)}>
            <ListItemIcon sx={{ color: '#19abb5' }}>{sourceType.icon}</ListItemIcon>
            <ListItemText>{sourceType.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Source List */}
      <SourceList>
        {!scene || scene.sources.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              color: '#666666',
            }}
          >
            <Typography variant="body2" sx={{ mb: 1 }}>
              No sources added
            </Typography>
            <Typography variant="caption">Click + to add a source</Typography>
          </Box>
        ) : (
          [...scene.sources]
            .sort((a, b) => b.zIndex - a.zIndex)
            .map((source) => (
              <SourceItem
                key={source.id}
                selected={selectedSourceId === source.id}
                onClick={() => handleSelectSource(source.id)}
              >
                <DragIndicatorIcon sx={{ fontSize: 16, color: '#444444', mr: 1, cursor: 'grab' }} />

                <SourceIcon>{getSourceIcon(source.type)}</SourceIcon>

                <SourceInfo>
                  <SourceName>{source.name}</SourceName>
                  <SourceType>{source.type.replace(/_/g, ' ')}</SourceType>
                </SourceInfo>

                <SourceActions>
                  <Tooltip title={source.transform.visible ? 'Hide' : 'Show'}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleToggleVisibility(e, source)}
                      sx={{ color: source.transform.visible ? '#19abb5' : '#444444' }}
                    >
                      {source.transform.visible ? (
                        <VisibilityIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <VisibilityOffIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </Tooltip>

                  <Tooltip title={source.transform.locked ? 'Unlock' : 'Lock'}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleToggleLock(e, source)}
                      sx={{ color: source.transform.locked ? '#ff9800' : '#444444' }}
                    >
                      {source.transform.locked ? (
                        <LockIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <LockOpenIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteSource(e, source.id)}
                      sx={{ color: '#666666', '&:hover': { color: '#f44336' } }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </SourceActions>
              </SourceItem>
            ))
        )}
      </SourceList>

      {/* Properties Panel */}
      {selectedSource && (
        <PropertiesSection>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
              cursor: 'pointer',
            }}
            onClick={() => setShowProperties(!showProperties)}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#888888' }}>
              PROPERTIES
            </Typography>
            {showProperties ? (
              <ExpandLessIcon sx={{ fontSize: 18, color: '#888888' }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 18, color: '#888888' }} />
            )}
          </Box>

          <Collapse in={showProperties}>
            {/* Camera source settings */}
            {selectedSource.type === 'camera' && (
              <PropertyRow>
                <PropertyLabel>Camera</PropertyLabel>
                <FormControl size="small" fullWidth>
                  <Select
                    value={selectedSource.settings.deviceId || ''}
                    onChange={(e) =>
                      onUpdateSource(selectedSource.id, {
                        settings: { ...selectedSource.settings, deviceId: e.target.value },
                      })
                    }
                    sx={{ fontSize: 12 }}
                  >
                    {videoDevices.map((device) => (
                      <MenuItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </PropertyRow>
            )}

            {/* Text source settings */}
            {selectedSource.type === 'text' && (
              <>
                <PropertyRow>
                  <PropertyLabel>Text</PropertyLabel>
                  <TextField
                    size="small"
                    fullWidth
                    value={selectedSource.settings.text || ''}
                    onChange={(e) =>
                      onUpdateSource(selectedSource.id, {
                        settings: { ...selectedSource.settings, text: e.target.value },
                      })
                    }
                  />
                </PropertyRow>
                <PropertyRow>
                  <PropertyLabel>Font Size</PropertyLabel>
                  <Slider
                    value={selectedSource.settings.fontSize || 24}
                    min={12}
                    max={120}
                    onChange={(_, v) =>
                      onUpdateSource(selectedSource.id, {
                        settings: { ...selectedSource.settings, fontSize: v as number },
                      })
                    }
                    sx={{ flex: 1 }}
                  />
                </PropertyRow>
                <PropertyRow>
                  <PropertyLabel>Color</PropertyLabel>
                  <input
                    type="color"
                    value={selectedSource.settings.fontColor || '#ffffff'}
                    onChange={(e) =>
                      onUpdateSource(selectedSource.id, {
                        settings: { ...selectedSource.settings, fontColor: e.target.value },
                      })
                    }
                    style={{ width: 40, height: 30, border: 'none', cursor: 'pointer' }}
                  />
                </PropertyRow>
              </>
            )}

            {/* Widget settings */}
            {selectedSource.type.includes('widget') && (
              <>
                <PropertyRow>
                  <PropertyLabel>Label</PropertyLabel>
                  <TextField
                    size="small"
                    fullWidth
                    value={selectedSource.settings.labelText || ''}
                    onChange={(e) =>
                      onUpdateSource(selectedSource.id, {
                        settings: { ...selectedSource.settings, labelText: e.target.value },
                      })
                    }
                  />
                </PropertyRow>
                {selectedSource.settings.unit !== undefined && (
                  <PropertyRow>
                    <PropertyLabel>Unit</PropertyLabel>
                    <TextField
                      size="small"
                      fullWidth
                      value={selectedSource.settings.unit || ''}
                      onChange={(e) =>
                        onUpdateSource(selectedSource.id, {
                          settings: { ...selectedSource.settings, unit: e.target.value },
                        })
                      }
                    />
                  </PropertyRow>
                )}
                {selectedSource.settings.alertThreshold !== undefined && (
                  <PropertyRow>
                    <PropertyLabel>Alert At</PropertyLabel>
                    <TextField
                      size="small"
                      type="number"
                      fullWidth
                      value={selectedSource.settings.alertThreshold || 0}
                      onChange={(e) =>
                        onUpdateSource(selectedSource.id, {
                          settings: {
                            ...selectedSource.settings,
                            alertThreshold: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </PropertyRow>
                )}
              </>
            )}

            {/* Color source settings */}
            {selectedSource.type === 'color' && (
              <PropertyRow>
                <PropertyLabel>Color</PropertyLabel>
                <input
                  type="color"
                  value={selectedSource.settings.color || '#000000'}
                  onChange={(e) =>
                    onUpdateSource(selectedSource.id, {
                      settings: { ...selectedSource.settings, color: e.target.value },
                    })
                  }
                  style={{ width: 60, height: 30, border: 'none', cursor: 'pointer' }}
                />
              </PropertyRow>
            )}

            {/* Transform controls */}
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #2b2b2b' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#666666', mb: 1 }}>
                TRANSFORM
              </Typography>

              <PropertyRow>
                <PropertyLabel>Position</PropertyLabel>
                <TextField
                  size="small"
                  type="number"
                  label="X"
                  value={selectedSource.transform.x}
                  onChange={(e) =>
                    onUpdateTransform(selectedSource.id, { x: Number(e.target.value) })
                  }
                  sx={{ width: 80, mr: 1 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Y"
                  value={selectedSource.transform.y}
                  onChange={(e) =>
                    onUpdateTransform(selectedSource.id, { y: Number(e.target.value) })
                  }
                  sx={{ width: 80 }}
                />
              </PropertyRow>

              <PropertyRow>
                <PropertyLabel>Size</PropertyLabel>
                <TextField
                  size="small"
                  type="number"
                  label="W"
                  value={selectedSource.transform.width}
                  onChange={(e) =>
                    onUpdateTransform(selectedSource.id, { width: Number(e.target.value) })
                  }
                  sx={{ width: 80, mr: 1 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="H"
                  value={selectedSource.transform.height}
                  onChange={(e) =>
                    onUpdateTransform(selectedSource.id, { height: Number(e.target.value) })
                  }
                  sx={{ width: 80 }}
                />
              </PropertyRow>

              <PropertyRow>
                <PropertyLabel>Opacity</PropertyLabel>
                <Slider
                  value={selectedSource.transform.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(_, v) =>
                    onUpdateTransform(selectedSource.id, { opacity: v as number })
                  }
                  sx={{ flex: 1 }}
                />
              </PropertyRow>
            </Box>
          </Collapse>
        </PropertiesSection>
      )}
    </Container>
  );
};

export default SourcePanel;
