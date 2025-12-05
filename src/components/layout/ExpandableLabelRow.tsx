/**
 * ExpandableLabelRow Component
 * Collapsible row below the header that shows text labels for navigation tools
 *
 * - Toggle via chevron button at edge
 * - When expanded: shows text label under each icon
 * - When collapsed: hidden completely
 * - State saved to localStorage
 * - Default: expanded for new users
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { NAV_TOOLS } from './TopHeaderBar';

const STORAGE_KEY = 'tacctile-label-row-expanded';

// Styled components
const RowContainer = styled(Box)<{ expanded: boolean }>(({ expanded }) => ({
  height: expanded ? 30 : 0,
  minHeight: expanded ? 30 : 0,
  maxHeight: expanded ? 30 : 0,
  backgroundColor: '#161616',
  borderBottom: expanded ? '1px solid #252525' : 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  transition: 'all 0.2s ease',
  position: 'relative',
}));

const LabelsContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  maxWidth: 600,
  flex: 1,
});

const LabelButton = styled(Box)<{ active?: boolean }>(({ active }) => ({
  width: 40,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}));

const LabelText = styled(Typography)<{ active?: boolean }>(({ active }) => ({
  fontSize: 9,
  fontWeight: 500,
  color: active ? '#19abb5' : '#666',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  whiteSpace: 'nowrap',
  textAlign: 'center',
}));

const ToggleButton = styled(IconButton)<{ expanded: boolean }>(({ expanded }) => ({
  position: 'absolute',
  right: 8,
  top: expanded ? 2 : -24,
  padding: 4,
  color: '#555',
  backgroundColor: expanded ? 'transparent' : '#1a1a1a',
  borderRadius: expanded ? 4 : '0 0 4px 4px',
  zIndex: 10,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
    color: '#19abb5',
  },
}));

// Floating toggle for when collapsed
const CollapsedToggle = styled(IconButton)({
  position: 'absolute',
  right: 12,
  top: 2,
  padding: 4,
  color: '#555',
  borderRadius: 4,
  zIndex: 10,
  '&:hover': {
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
    color: '#19abb5',
  },
});

interface ExpandableLabelRowProps {
  selectedTool: string;
  onToggle?: (expanded: boolean) => void;
}

export const ExpandableLabelRow: React.FC<ExpandableLabelRowProps> = ({
  selectedTool,
  onToggle,
}) => {
  // Initialize from localStorage, default to true for new users
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true; // Default expanded for new users
    return stored === 'true';
  });

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(expanded));
    onToggle?.(expanded);
  }, [expanded, onToggle]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <Box sx={{ position: 'relative' }}>
      <RowContainer expanded={expanded}>
        {expanded && (
          <>
            {/* Spacer to match left section of header */}
            <Box sx={{ width: 120, flexShrink: 0 }} />

            {/* Labels matching navigation icons */}
            <LabelsContainer>
              {NAV_TOOLS.map((tool) => (
                <LabelButton key={tool.id} active={selectedTool === tool.id}>
                  <LabelText active={selectedTool === tool.id}>
                    {tool.label}
                  </LabelText>
                </LabelButton>
              ))}
            </LabelsContainer>

            {/* Spacer to match right section of header */}
            <Box sx={{ width: 120, flexShrink: 0 }} />
          </>
        )}

        {/* Toggle button inside when expanded */}
        {expanded && (
          <Tooltip title="Hide labels" placement="left">
            <ToggleButton expanded={expanded} onClick={handleToggle} size="small">
              <ExpandLessIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
          </Tooltip>
        )}
      </RowContainer>

      {/* Floating toggle when collapsed */}
      {!expanded && (
        <Box
          sx={{
            position: 'absolute',
            right: 12,
            top: -24,
            zIndex: 10,
          }}
        >
          <Tooltip title="Show labels" placement="left">
            <CollapsedToggle onClick={handleToggle} size="small">
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            </CollapsedToggle>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default ExpandableLabelRow;
