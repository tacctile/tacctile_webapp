/**
 * DataLayerToggle Component
 * Panel for toggling visibility of different data layers on the timeline
 */

import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Switch,
  Badge,
  Collapse,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { DataLayer, DataLayerType } from '../../types/session';

// ============================================================================
// MATERIAL SYMBOL COMPONENT
// ============================================================================

interface MaterialSymbolProps {
  icon: string;
  filled?: boolean;
  size?: number;
  color?: string;
}

const MaterialSymbol: React.FC<MaterialSymbolProps> = ({ icon, filled = false, size = 24, color }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      color: color,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
    }}
  >
    {icon}
  </span>
);

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const ToggleContainer = styled(Box)({
  backgroundColor: '#1a1a1a',
  borderRadius: 8,
  border: '1px solid #2b2b2b',
  overflow: 'hidden',
});

const ToggleHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#151515',
  borderBottom: '1px solid #2b2b2b',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#1e1e1e',
  },
});

const LayerList = styled(Box)({
  padding: 8,
});

const LayerItem = styled(Box)<{ visible: boolean }>(({ visible }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 4,
  opacity: visible ? 1 : 0.5,
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
}));

const LayerIconWrapper = styled(Box)<{ color: string; visible: boolean }>(({ color, visible }) => ({
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: visible ? `${color}22` : '#252525',
  borderRadius: 4,
  transition: 'all 0.15s ease',
  '& svg': {
    fontSize: 16,
    color: visible ? color : '#666',
  },
}));

const LayerInfo = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const LayerName = styled(Typography)({
  fontSize: '12px',
  fontWeight: 500,
  color: '#e1e1e1',
  lineHeight: 1.2,
});

const LayerCount = styled(Typography)({
  fontSize: '10px',
  color: '#666',
});

const QuickActions = styled(Box)({
  display: 'flex',
  gap: 4,
  padding: '4px 8px',
  borderTop: '1px solid #252525',
  backgroundColor: '#151515',
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getLayerIcon = (layerId: DataLayerType): React.ReactNode => {
  switch (layerId) {
    case 'video':
      return <MaterialSymbol icon="videocam" />;
    case 'audio':
      return <MaterialSymbol icon="mic" />;
    case 'photo':
      return <MaterialSymbol icon="photo_camera" />;
    case 'emf':
      return <MaterialSymbol icon="sensors" />;
    case 'thermal':
      return <MaterialSymbol icon="thermostat" />;
    case 'motion':
      return <MaterialSymbol icon="motion_sensor_active" />;
    case 'spirit_box':
      return <MaterialSymbol icon="radio" />;
    case 'flags':
      return <MaterialSymbol icon="flag" />;
    case 'user_markers':
      return <MaterialSymbol icon="person_pin" />;
    default:
      return <MaterialSymbol icon="layers" />;
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

interface DataLayerToggleProps {
  layers: DataLayer[];
  onToggleLayer: (layerId: DataLayerType) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export const DataLayerToggle: React.FC<DataLayerToggleProps> = ({
  layers,
  onToggleLayer,
  onShowAll,
  onHideAll,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const visibleCount = layers.filter((l) => l.visible).length;
  const totalCount = layers.length;
  const totalItems = layers.reduce((sum, l) => sum + l.itemCount, 0);

  return (
    <ToggleContainer>
      <ToggleHeader onClick={onToggleCollapsed}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MaterialSymbol icon="layers" size={18} color="#19abb5" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#e1e1e1' }}>
            Data Layers
          </Typography>
          <Badge
            badgeContent={`${visibleCount}/${totalCount}`}
            color="primary"
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '9px',
                height: 16,
                minWidth: 32,
                backgroundColor: visibleCount === totalCount ? '#19abb5' : '#666',
              },
            }}
          />
        </Box>
        <IconButton size="small" sx={{ color: '#888' }}>
          <MaterialSymbol icon={collapsed ? 'expand_more' : 'expand_less'} size={20} />
        </IconButton>
      </ToggleHeader>

      <Collapse in={!collapsed}>
        <LayerList>
          {layers.map((layer) => (
            <LayerItem
              key={layer.id}
              visible={layer.visible}
              onClick={() => onToggleLayer(layer.id)}
              sx={{ cursor: 'pointer' }}
            >
              <LayerIconWrapper color={layer.color} visible={layer.visible}>
                {getLayerIcon(layer.id)}
              </LayerIconWrapper>
              <LayerInfo>
                <LayerName>{layer.label}</LayerName>
                <LayerCount>
                  {layer.itemCount} item{layer.itemCount !== 1 ? 's' : ''}
                </LayerCount>
              </LayerInfo>
              <Switch
                size="small"
                checked={layer.visible}
                onChange={() => onToggleLayer(layer.id)}
                onClick={(e) => e.stopPropagation()}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: layer.color,
                    '& + .MuiSwitch-track': {
                      backgroundColor: layer.color,
                    },
                  },
                }}
              />
            </LayerItem>
          ))}
        </LayerList>

        <QuickActions>
          <Tooltip title="Show all layers">
            <IconButton
              size="small"
              onClick={onShowAll}
              sx={{
                color: visibleCount === totalCount ? '#19abb5' : '#888',
                '&:hover': { color: '#19abb5' },
              }}
            >
              <MaterialSymbol icon="visibility" size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Hide all layers">
            <IconButton
              size="small"
              onClick={onHideAll}
              sx={{
                color: visibleCount === 0 ? '#666' : '#888',
                '&:hover': { color: '#888' },
              }}
            >
              <MaterialSymbol icon="visibility_off" size={16} />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ color: '#666', alignSelf: 'center' }}>
            {totalItems} total items
          </Typography>
        </QuickActions>
      </Collapse>
    </ToggleContainer>
  );
};

// ============================================================================
// COMPACT LAYER PILLS (for toolbar)
// ============================================================================

interface LayerPillsProps {
  layers: DataLayer[];
  onToggleLayer: (layerId: DataLayerType) => void;
}

const PillContainer = styled(Box)({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
});

const LayerPill = styled(Box)<{ color: string; active: boolean }>(({ color, active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 12,
  backgroundColor: active ? `${color}22` : '#252525',
  border: `1px solid ${active ? color : '#333'}`,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: active ? `${color}33` : '#2a2a2a',
  },
  '& svg': {
    fontSize: 12,
    color: active ? color : '#666',
  },
}));

export const LayerPills: React.FC<LayerPillsProps> = ({ layers, onToggleLayer }) => {
  return (
    <PillContainer>
      {layers.map((layer) => (
        <Tooltip key={layer.id} title={`${layer.visible ? 'Hide' : 'Show'} ${layer.label}`}>
          <LayerPill
            color={layer.color}
            active={layer.visible}
            onClick={() => onToggleLayer(layer.id)}
          >
            {getLayerIcon(layer.id)}
            <Typography
              variant="caption"
              sx={{
                fontSize: '10px',
                fontWeight: 500,
                color: layer.visible ? '#e1e1e1' : '#666',
              }}
            >
              {layer.itemCount}
            </Typography>
          </LayerPill>
        </Tooltip>
      ))}
    </PillContainer>
  );
};

export default DataLayerToggle;
