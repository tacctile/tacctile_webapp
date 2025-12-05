/**
 * ExpandableLabelRow Component
 * Collapsible row below the header that shows text labels for navigation tools
 *
 * - Toggle via centered pill/handle below the icon row
 * - When expanded: shows text label under each icon
 * - When collapsed: hidden completely (only pill toggle visible)
 * - State saved to localStorage
 * - Default: expanded for new users
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { NAV_TOOLS } from './TopHeaderBar';

const STORAGE_KEY = 'tacctile-label-row-expanded';

// Styled components
const RowContainer = styled(Box)<{ expanded: boolean }>(({ expanded }) => ({
  height: expanded ? 24 : 0,
  minHeight: expanded ? 24 : 0,
  maxHeight: expanded ? 24 : 0,
  backgroundColor: '#161616',
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
  gap: 16,
  maxWidth: 800,
  flex: 1,
});

const LabelWrapper = styled(Box)({
  width: 44,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

const LabelText = styled(Typography)<{ active?: boolean }>(({ active }) => ({
  fontSize: 10,
  fontWeight: 500,
  color: active ? '#19abb5' : '#666',
  textTransform: 'none',
  letterSpacing: '0.2px',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  lineHeight: 1,
}));

// Centered pill toggle
const PillToggle = styled(Box)<{ expanded: boolean }>(({ expanded }) => ({
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: expanded ? -8 : 4,
  width: 40,
  height: 4,
  backgroundColor: expanded ? '#333' : '#444',
  borderRadius: 2,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  zIndex: 10,
  '&:hover': {
    backgroundColor: '#19abb5',
  },
}));

// Container that includes both row and toggle area
const WrapperContainer = styled(Box)({
  position: 'relative',
  borderBottom: '1px solid #252525',
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
    <WrapperContainer>
      <RowContainer expanded={expanded}>
        {expanded && (
          <>
            {/* Spacer to match left section of header */}
            <Box sx={{ width: 120, flexShrink: 0 }} />

            {/* Labels matching navigation icons */}
            <LabelsContainer>
              {NAV_TOOLS.map((tool) => (
                <LabelWrapper key={tool.id}>
                  <LabelText active={selectedTool === tool.id}>
                    {tool.label}
                  </LabelText>
                </LabelWrapper>
              ))}
            </LabelsContainer>

            {/* Spacer to match right section of header */}
            <Box sx={{ width: 120, flexShrink: 0 }} />
          </>
        )}
      </RowContainer>

      {/* Centered pill toggle */}
      <Tooltip title={expanded ? 'Hide labels' : 'Show labels'} placement="bottom">
        <PillToggle expanded={expanded} onClick={handleToggle} />
      </Tooltip>
    </WrapperContainer>
  );
};

export default ExpandableLabelRow;
