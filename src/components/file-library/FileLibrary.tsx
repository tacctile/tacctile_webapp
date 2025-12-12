import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Box, Typography, TextField, InputAdornment, Chip, Select, MenuItem, FormControl, Collapse, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import PhotoIcon from '@mui/icons-material/Photo';
import FlagIcon from '@mui/icons-material/Flag';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// Types
export interface FileItem {
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

export type MediaFilter = 'all' | 'video' | 'audio' | 'image';
type SortOption = 'timestamp' | 'filename' | 'user';

// Type colors for left borders
const TYPE_COLORS = {
  video: '#c45c5c',
  audio: '#5a9a6b',
  image: '#5a7fbf',
};

// Styled components
const Container = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  gap: 6,
  padding: 6,
});

const SearchRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const SearchField = styled(TextField)({
  flex: 1,
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

const SortSelect = styled(Select)({
  height: 30,
  fontSize: '10px',
  backgroundColor: '#1a1a1a',
  color: '#999',
  minWidth: 100,
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#2a2a2a',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#3a3a3a',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#19abb5',
    borderWidth: 1,
  },
  '& .MuiSelect-select': {
    padding: '4px 8px',
    paddingRight: '24px !important',
  },
  '& .MuiSelect-icon': {
    color: '#666',
    fontSize: 18,
  },
});

const FilterBar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
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

const SectionsContainer = styled(Box)({
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 3,
  },
});

// Background tints for each section type
const SECTION_TINTS = {
  video: 'rgba(196, 92, 92, 0.08)',
  audio: 'rgba(90, 154, 107, 0.08)',
  image: 'rgba(90, 127, 191, 0.08)',
};

const SectionHeader = styled(Box)<{ borderColor: string; sectionType: 'video' | 'audio' | 'image' }>(({ borderColor, sectionType }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 10px',
  backgroundColor: SECTION_TINTS[sectionType],
  borderLeft: `3px solid ${borderColor}`,
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover': {
    backgroundColor: sectionType === 'video'
      ? 'rgba(196, 92, 92, 0.12)'
      : sectionType === 'audio'
        ? 'rgba(90, 154, 107, 0.12)'
        : 'rgba(90, 127, 191, 0.12)',
  },
}));

const SectionTitle = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const ImageGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gridAutoRows: 'min-content',
  alignContent: 'start',
  gap: 6,
  padding: '4px 0',
});

const ListItem = styled(Box)<{ selected?: boolean; borderColor: string }>(({ selected, borderColor }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.1)' : 'transparent',
  borderLeft: `3px solid ${borderColor}`,
  cursor: 'pointer',
  borderTop: '1px solid transparent',
  borderBottom: '1px solid transparent',
  borderRight: '1px solid transparent',
  ...(selected && {
    borderTop: '1px solid rgba(25, 171, 181, 0.25)',
    borderBottom: '1px solid rgba(25, 171, 181, 0.25)',
    borderRight: '1px solid rgba(25, 171, 181, 0.25)',
  }),
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.12)' : '#1e1e1e',
  },
}));

// FileList with zebra striping applied via nth-child
const FileList = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingBottom: 4,
  // Zebra striping - even rows get subtle background
  '& > *:nth-of-type(even)': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  // Ensure selected state overrides zebra striping
  '& > *[data-selected="true"]': {
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
});

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
  flexDirection: 'column',
  alignItems: 'flex-start',
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

const getTypeIcon = (type: 'video' | 'audio' | 'image', size: number = 16) => {
  const color = '#999';
  switch (type) {
    case 'video': return <VideocamIcon sx={{ fontSize: size, color }} />;
    case 'audio': return <MicIcon sx={{ fontSize: size, color }} />;
    case 'image': return <PhotoIcon sx={{ fontSize: size, color }} />;
  }
};

// Props
interface FileLibraryProps {
  items?: FileItem[];
  selectedId?: string | null;
  onSelect?: (item: FileItem) => void;
  onDoubleClick?: (item: FileItem) => void;
  filterByType?: MediaFilter; // Force filter to specific type (for tool-specific views)
  filter?: MediaFilter; // Controlled filter state (for parent control)
  onFilterChange?: (filter: MediaFilter) => void; // Called when filter changes
  onDragStart?: (itemId: string) => void; // Called when drag starts
  onDragEnd?: () => void; // Called when drag ends
}

export const FileLibrary: React.FC<FileLibraryProps> = ({
  items = [],
  selectedId = null,
  onSelect,
  onDoubleClick,
  filterByType,
  filter,
  onFilterChange,
  onDragStart,
  onDragEnd,
}) => {
  // Use controlled filter if provided, otherwise use internal state
  const [internalFilter, setInternalFilter] = useState<MediaFilter>(filterByType || 'all');
  const mediaFilter = filter !== undefined ? filter : internalFilter;

  const handleFilterChange = useCallback((newFilter: MediaFilter) => {
    if (filter === undefined) {
      // Uncontrolled mode - update internal state
      setInternalFilter(newFilter);
    }
    // Always notify parent of filter change
    onFilterChange?.(newFilter);
  }, [filter, onFilterChange]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('timestamp');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    video: true,
    audio: true,
    image: true,
  });

  // Ref to store item element references for scroll-into-view
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view when selectedId changes
  useEffect(() => {
    if (selectedId && itemRefs.current[selectedId]) {
      const element = itemRefs.current[selectedId];
      if (element && containerRef.current) {
        // Scroll with smooth behavior
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedId]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const sortItems = useCallback((itemsToSort: FileItem[]): FileItem[] => {
    return [...itemsToSort].sort((a, b) => {
      switch (sortBy) {
        case 'timestamp':
          return a.capturedAt - b.capturedAt;
        case 'filename':
          return a.fileName.localeCompare(b.fileName);
        case 'user':
          return a.user.localeCompare(b.user);
        default:
          return 0;
      }
    });
  }, [sortBy]);

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

    return result;
  }, [items, mediaFilter, filterByType, searchQuery]);

  // Group items by type
  const groupedItems = useMemo(() => {
    const videos = sortItems(filteredItems.filter(item => item.type === 'video'));
    const audios = sortItems(filteredItems.filter(item => item.type === 'audio'));
    const images = sortItems(filteredItems.filter(item => item.type === 'image'));

    return { videos, audios, images };
  }, [filteredItems, sortItems]);

  const handleClick = useCallback((item: FileItem) => {
    onSelect?.(item);
  }, [onSelect]);

  const handleDoubleClick = useCallback((item: FileItem) => {
    onDoubleClick?.(item);
  }, [onDoubleClick]);

  const handleDragStart = useCallback((e: React.DragEvent, item: FileItem) => {
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

  const renderListItem = (item: FileItem) => (
    <ListItem
      key={item.id}
      ref={(el: HTMLDivElement | null) => { itemRefs.current[item.id] = el; }}
      selected={item.id === selectedId}
      data-selected={item.id === selectedId ? 'true' : undefined}
      borderColor={TYPE_COLORS[item.type]}
      onClick={() => handleClick(item)}
      onDoubleClick={() => handleDoubleClick(item)}
      draggable={!!onDragStart}
      onDragStart={(e) => handleDragStart(e, item)}
      onDragEnd={handleDragEnd}
      sx={{ cursor: onDragStart ? 'grab' : 'pointer', '&:active': { cursor: 'grabbing' } }}
    >
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
  );

  const renderGridItem = (item: FileItem) => (
    <GridItem
      key={item.id}
      ref={(el: HTMLDivElement | null) => { itemRefs.current[item.id] = el; }}
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
          getTypeIcon(item.type, 24)
        )}
      </Thumbnail>

      <GridOverlay>
        <Typography sx={{ fontSize: '10px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
          {item.fileName}
        </Typography>
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
  );

  const renderSection = (
    type: 'video' | 'audio' | 'image',
    items: FileItem[],
    label: string,
    isGallery: boolean = false
  ) => {
    if (items.length === 0) return null;

    const isExpanded = expandedSections[type];

    return (
      <Box key={type}>
        <SectionHeader
          borderColor={TYPE_COLORS[type]}
          sectionType={type}
          onClick={() => toggleSection(type)}
        >
          <SectionTitle>
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#e1e1e1', letterSpacing: '0.75px' }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: '#888', fontWeight: 500 }}>
              ({items.length})
            </Typography>
          </SectionTitle>
          <IconButton size="small" sx={{ padding: 0.5, color: '#888' }}>
            {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </SectionHeader>
        <Collapse in={isExpanded}>
          {isGallery ? (
            <ImageGrid>
              {items.map(renderGridItem)}
            </ImageGrid>
          ) : (
            <FileList>
              {items.map(renderListItem)}
            </FileList>
          )}
        </Collapse>
      </Box>
    );
  };

  const activeFilter = filterByType || mediaFilter;

  return (
    <Container>
      {/* Search & Sort */}
      <SearchRow>
        <SearchField
          size="small"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: '#666' }} />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small">
          <SortSelect
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            displayEmpty
          >
            <MenuItem value="timestamp" sx={{ fontSize: '11px' }}>Timestamp</MenuItem>
            <MenuItem value="filename" sx={{ fontSize: '11px' }}>Filename</MenuItem>
            <MenuItem value="user" sx={{ fontSize: '11px' }}>User</MenuItem>
          </SortSelect>
        </FormControl>
      </SearchRow>

      {/* Filters */}
      {!filterByType && (
        <FilterBar>
          <MediaFilters>
            <FilterChip
              label={`All ${counts.all}`}
              size="small"
              selected={mediaFilter === 'all'}
              onClick={() => handleFilterChange('all')}
            />
            <FilterChip
              icon={<VideocamIcon sx={{ fontSize: 14 }} />}
              label={counts.video}
              size="small"
              selected={mediaFilter === 'video'}
              onClick={() => handleFilterChange('video')}
            />
            <FilterChip
              icon={<MicIcon sx={{ fontSize: 14 }} />}
              label={counts.audio}
              size="small"
              selected={mediaFilter === 'audio'}
              onClick={() => handleFilterChange('audio')}
            />
            <FilterChip
              icon={<PhotoIcon sx={{ fontSize: 14 }} />}
              label={counts.image}
              size="small"
              selected={mediaFilter === 'image'}
              onClick={() => handleFilterChange('image')}
            />
          </MediaFilters>
        </FilterBar>
      )}

      {/* File Items - Grouped by Type */}
      {filteredItems.length === 0 ? (
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '13px',
        }}>
          {items.length === 0 ? 'No files in project' : 'No matching files'}
        </Box>
      ) : (
        <SectionsContainer ref={containerRef}>
          {(activeFilter === 'all' || activeFilter === 'video') &&
            renderSection('video', groupedItems.videos, 'VIDEO')}
          {(activeFilter === 'all' || activeFilter === 'audio') &&
            renderSection('audio', groupedItems.audios, 'AUDIO')}
          {(activeFilter === 'all' || activeFilter === 'image') &&
            renderSection('image', groupedItems.images, 'IMAGES', true)}
        </SectionsContainer>
      )}
    </Container>
  );
};

export default FileLibrary;
