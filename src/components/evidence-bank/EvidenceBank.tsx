import React, { useState, useMemo, useCallback } from 'react';
import { Box, IconButton, Tooltip, Typography, TextField, InputAdornment, ToggleButtonGroup, ToggleButton, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import PhotoIcon from '@mui/icons-material/Photo';
import FlagIcon from '@mui/icons-material/Flag';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';

// Types
export interface EvidenceItem {
  id: string;
  type: 'video' | 'audio' | 'image';
  fileName: string;
  thumbnailUrl?: string;
  duration?: number; // seconds, for video/audio
  capturedAt: number; // timestamp
  user: string;
  deviceInfo?: string;
  flagCount: number;
  hasFindings: boolean;
}

type ViewMode = 'gallery' | 'list';
type MediaFilter = 'all' | 'video' | 'audio' | 'image';

// Styled components
const Container = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  gap: 6,
  padding: 6,
});

const SearchField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#1a1a1a',
    fontSize: '12px',
    '& fieldset': {
      borderColor: '#2a2a2a',
    },
    '&:hover fieldset': {
      borderColor: '#3a3a3a',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#19abb5',
      borderWidth: 1,
    },
  },
  '& .MuiInputBase-input': {
    padding: '6px 10px',
    color: '#cccccc',
  },
});

const FilterBar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

const MediaFilters = styled(Box)({
  display: 'flex',
  gap: 4,
});

const FilterChip = styled(Chip)<{ selected?: boolean }>(({ selected }) => ({
  height: 22,
  fontSize: '10px',
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.15)' : '#242424',
  color: selected ? '#19abb5' : '#808080',
  border: selected ? '1px solid rgba(25, 171, 181, 0.3)' : '1px solid transparent',
  borderRadius: 2,
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.2)' : '#2a2a2a',
  },
}));

const ViewToggle = styled(ToggleButtonGroup)({
  '& .MuiToggleButton-root': {
    padding: 4,
    border: 'none',
    color: '#666',
    '&.Mui-selected': {
      color: '#19abb5',
      backgroundColor: 'rgba(25, 171, 181, 0.1)',
    },
  },
});

const EvidenceList = styled(Box)({
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 3,
  },
});

const EvidenceGrid = styled(Box)({
  flex: 1,
  overflow: 'auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gridAutoRows: 'min-content',
  alignContent: 'start',
  gap: 8,
  padding: 4,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 3,
  },
});

const ListItem = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.1)' : 'transparent',
  borderRadius: 2,
  cursor: 'pointer',
  border: selected ? '1px solid rgba(25, 171, 181, 0.25)' : '1px solid transparent',
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.12)' : '#1e1e1e',
  },
}));

const GridItem = styled(Box)<{ selected?: boolean; hasFindings?: boolean }>(({ selected, hasFindings }) => ({
  position: 'relative',
  aspectRatio: '16/9',
  backgroundColor: '#1a1a1a',
  borderRadius: 4,
  cursor: 'pointer',
  overflow: 'hidden',
  border: selected ? '2px solid #19abb5' : hasFindings ? '2px solid rgba(25, 171, 181, 0.4)' : '2px solid transparent',
  boxShadow: hasFindings ? '0 0 8px rgba(25, 171, 181, 0.3)' : 'none',
  '&:hover': {
    borderColor: '#19abb5',
  },
}));

const Thumbnail = styled(Box)({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#252525',
});

const GridOverlay = styled(Box)({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '4px 6px',
  background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const TypeIcon = styled(Box)<{ type: 'video' | 'audio' | 'image' }>(({ type }) => {
  const colors = {
    video: '#c45c5c',
    audio: '#5a9a6b',
    image: '#5a7fbf',
  };
  return {
    width: 24,
    height: 24,
    borderRadius: 2,
    backgroundColor: colors[type],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
});

const FlagBadge = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  fontSize: '10px',
  color: '#19abb5',
});

const Duration = styled(Typography)({
  fontSize: '10px',
  color: '#666',
  fontFamily: '"JetBrains Mono", monospace',
});

// Helper functions
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getTypeIcon = (type: 'video' | 'audio' | 'image') => {
  switch (type) {
    case 'video': return <VideocamIcon sx={{ fontSize: 16, color: '#fff' }} />;
    case 'audio': return <MicIcon sx={{ fontSize: 16, color: '#fff' }} />;
    case 'image': return <PhotoIcon sx={{ fontSize: 16, color: '#fff' }} />;
  }
};

// Props
interface EvidenceBankProps {
  items?: EvidenceItem[];
  selectedId?: string | null;
  onSelect?: (item: EvidenceItem) => void;
  onDoubleClick?: (item: EvidenceItem) => void;
  filterByType?: MediaFilter; // Force filter to specific type (for tool-specific views)
  onDragStart?: (itemId: string) => void; // Called when drag starts
  onDragEnd?: () => void; // Called when drag ends
}

export const EvidenceBank: React.FC<EvidenceBankProps> = ({
  items = [],
  selectedId = null,
  onSelect,
  onDoubleClick,
  filterByType,
  onDragStart,
  onDragEnd,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem('tacctile-evidence-view');
    return (stored as ViewMode) || 'list';
  });

  const [mediaFilter, setMediaFilter] = useState<MediaFilter>(filterByType || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleViewChange = useCallback((_: React.MouseEvent<HTMLElement>, newView: ViewMode | null) => {
    if (newView) {
      setViewMode(newView);
      localStorage.setItem('tacctile-evidence-view', newView);
    }
  }, []);

  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by media type
    const activeFilter = filterByType || mediaFilter;
    if (activeFilter !== 'all') {
      result = result.filter(item => item.type === activeFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.fileName.toLowerCase().includes(query) ||
        item.user.toLowerCase().includes(query) ||
        item.deviceInfo?.toLowerCase().includes(query)
      );
    }

    // Sort by capture time
    return result.sort((a, b) => a.capturedAt - b.capturedAt);
  }, [items, mediaFilter, filterByType, searchQuery]);

  const handleClick = useCallback((item: EvidenceItem) => {
    onSelect?.(item);
  }, [onSelect]);

  const handleDoubleClick = useCallback((item: EvidenceItem) => {
    onDoubleClick?.(item);
  }, [onDoubleClick]);

  const handleDragStart = useCallback((e: React.DragEvent, item: EvidenceItem) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(item.id);
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  const counts = useMemo(() => ({
    all: items.length,
    video: items.filter(i => i.type === 'video').length,
    audio: items.filter(i => i.type === 'audio').length,
    image: items.filter(i => i.type === 'image').length,
  }), [items]);

  return (
    <Container>
      {/* Search */}
      <SearchField
        size="small"
        placeholder="Search evidence..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 18, color: '#666' }} />
            </InputAdornment>
          ),
        }}
        fullWidth
      />

      {/* Filters & View Toggle */}
      <FilterBar>
        {!filterByType && (
          <MediaFilters>
            <FilterChip
              label={`All ${counts.all}`}
              size="small"
              selected={mediaFilter === 'all'}
              onClick={() => setMediaFilter('all')}
            />
            <FilterChip
              icon={<VideocamIcon sx={{ fontSize: 14 }} />}
              label={counts.video}
              size="small"
              selected={mediaFilter === 'video'}
              onClick={() => setMediaFilter('video')}
            />
            <FilterChip
              icon={<MicIcon sx={{ fontSize: 14 }} />}
              label={counts.audio}
              size="small"
              selected={mediaFilter === 'audio'}
              onClick={() => setMediaFilter('audio')}
            />
            <FilterChip
              icon={<PhotoIcon sx={{ fontSize: 14 }} />}
              label={counts.image}
              size="small"
              selected={mediaFilter === 'image'}
              onClick={() => setMediaFilter('image')}
            />
          </MediaFilters>
        )}

        <ViewToggle
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          size="small"
        >
          <ToggleButton value="list">
            <ViewListIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="gallery">
            <GridViewIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ViewToggle>
      </FilterBar>

      {/* Evidence Items */}
      {filteredItems.length === 0 ? (
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '13px',
        }}>
          {items.length === 0 ? 'No evidence in session' : 'No matching evidence'}
        </Box>
      ) : viewMode === 'list' ? (
        <EvidenceList>
          {filteredItems.map((item) => (
            <ListItem
              key={item.id}
              selected={item.id === selectedId}
              onClick={() => handleClick(item)}
              onDoubleClick={() => handleDoubleClick(item)}
              draggable={!!onDragStart}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
              sx={{ cursor: onDragStart ? 'grab' : 'pointer', '&:active': { cursor: 'grabbing' } }}
            >
              <TypeIcon type={item.type}>
                {getTypeIcon(item.type)}
              </TypeIcon>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '12px',
                    color: '#e1e1e1',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.fileName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Typography sx={{ fontSize: '10px', color: '#666' }}>
                    {item.user}
                  </Typography>
                  <Typography sx={{ fontSize: '10px', color: '#555' }}>•</Typography>
                  <Typography sx={{ fontSize: '10px', color: '#666' }}>
                    {formatTime(item.capturedAt)}
                  </Typography>
                  {item.duration && (
                    <>
                      <Typography sx={{ fontSize: '10px', color: '#555' }}>•</Typography>
                      <Duration>{formatDuration(item.duration)}</Duration>
                    </>
                  )}
                </Box>
              </Box>

              {item.flagCount > 0 && (
                <FlagBadge>
                  <FlagIcon sx={{ fontSize: 12 }} />
                  {item.flagCount}
                </FlagBadge>
              )}
            </ListItem>
          ))}
        </EvidenceList>
      ) : (
        <EvidenceGrid>
          {filteredItems.map((item) => (
            <GridItem
              key={item.id}
              selected={item.id === selectedId}
              hasFindings={item.hasFindings}
              onClick={() => handleClick(item)}
              onDoubleClick={() => handleDoubleClick(item)}
              draggable={!!onDragStart}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
              sx={{ cursor: onDragStart ? 'grab' : 'pointer', '&:active': { cursor: 'grabbing' } }}
            >
              <Thumbnail>
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.fileName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  getTypeIcon(item.type)
                )}
              </Thumbnail>

              <GridOverlay>
                <Typography sx={{ fontSize: '10px', color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.fileName}
                </Typography>
                {item.duration && (
                  <Duration sx={{ color: '#fff' }}>{formatDuration(item.duration)}</Duration>
                )}
              </GridOverlay>

              {item.flagCount > 0 && (
                <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
                  <FlagBadge sx={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 4px', borderRadius: 1 }}>
                    <FlagIcon sx={{ fontSize: 10 }} />
                    {item.flagCount}
                  </FlagBadge>
                </Box>
              )}
            </GridItem>
          ))}
        </EvidenceGrid>
      )}
    </Container>
  );
};

export default EvidenceBank;
