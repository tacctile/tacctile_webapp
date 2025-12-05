import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const Container = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

const TopPanel = styled(Box)({
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

const Divider = styled(Box)({
  height: 6,
  backgroundColor: '#1a1a1a',
  cursor: 'row-resize',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  '&:hover': {
    backgroundColor: '#252525',
  },
  '&::after': {
    content: '""',
    width: 40,
    height: 2,
    backgroundColor: '#333',
    borderRadius: 1,
  },
});

const BottomPanel = styled(Box)({
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

interface ResizablePanelSplitProps {
  top: ReactNode;
  bottom: ReactNode;
  defaultSplit?: number;        // 0-100, percentage for top panel
  minTopHeight?: number;        // px
  minBottomHeight?: number;     // px
  storageKey?: string;          // localStorage key for persistence
}

export const ResizablePanelSplit: React.FC<ResizablePanelSplitProps> = ({
  top,
  bottom,
  defaultSplit = 50,
  minTopHeight = 100,
  minBottomHeight = 150,
  storageKey,
}) => {
  const [splitPercent, setSplitPercent] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return parseFloat(saved);
    }
    return defaultSplit;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, String(splitPercent));
    }
  }, [splitPercent, storageKey]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRect.height;
      const relativeY = e.clientY - containerRect.top;

      let newPercent = (relativeY / containerHeight) * 100;

      // Apply min heights
      const minTopPercent = (minTopHeight / containerHeight) * 100;
      const minBottomPercent = (minBottomHeight / containerHeight) * 100;
      const maxTopPercent = 100 - minBottomPercent;

      newPercent = Math.max(minTopPercent, Math.min(maxTopPercent, newPercent));

      setSplitPercent(newPercent);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minTopHeight, minBottomHeight]);

  return (
    <Container ref={containerRef}>
      <TopPanel sx={{ height: `${splitPercent}%` }}>
        {top}
      </TopPanel>
      <Divider onMouseDown={handleMouseDown} />
      <BottomPanel sx={{ height: `${100 - splitPercent}%` }}>
        {bottom}
      </BottomPanel>
    </Container>
  );
};

export default ResizablePanelSplit;
