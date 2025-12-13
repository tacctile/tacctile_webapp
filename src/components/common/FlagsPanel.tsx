import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip, Button, TextField, InputAdornment } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import FlagIcon from '@mui/icons-material/Flag';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Undo';
import SearchIcon from '@mui/icons-material/Search';

const Container = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
});

const Header = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid #252525',
  backgroundColor: '#1a1a1a',
});

const FlagsList = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 3,
  },
});

const FlagItem = styled(Box)({
  borderBottom: '1px solid #1f1f1f',
  '&:hover': {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  '&:hover .flag-actions': {
    opacity: 1,
  },
});

const FlagHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  gap: 8,
});

const FlagActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  opacity: 0,
  transition: 'opacity 0.15s',
});

const NotePreview = styled(Typography)({
  fontSize: 10,
  color: '#666',
  padding: '0 12px 8px 12px',
  lineHeight: 1.4,
  cursor: 'pointer',
  '&:hover': {
    color: '#888',
  },
});

const FullNote = styled(Box)({
  padding: '8px 12px 12px 12px',
  fontSize: 11,
  color: '#888',
  lineHeight: 1.5,
  backgroundColor: 'rgba(0,0,0,0.2)',
  borderTop: '1px solid #1f1f1f',
});

const Timestamp = styled(Typography)({
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
  color: '#19abb5',
  cursor: 'pointer',
  '&:hover': {
    textDecoration: 'underline',
  },
});

const FlagLabel = styled(Typography)({
  fontSize: 11,
  color: '#ccc',
  flex: 1,
});

const EmptyState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 16,
  color: '#444',
});

const UndoToast = styled(Box)({
  position: 'absolute',
  bottom: 8,
  left: 8,
  right: 8,
  backgroundColor: '#252525',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '8px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  zIndex: 10,
  animation: 'slideUp 0.2s ease-out',
  '@keyframes slideUp': {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
});

const Footer = styled(Box)({
  padding: '8px 12px',
  borderTop: '1px solid #252525',
  backgroundColor: '#1a1a1a',
});

export interface Flag {
  id: string;
  timestamp: number;
  label: string;
  note?: string;
  category?: string;
  createdBy?: string;
  createdAt?: number;
  /** User color for flag visualization (hex color) */
  userColor?: string;
}

interface FlagsPanelProps {
  flags: Flag[];
  onFlagClick?: (flag: Flag) => void;
  onFlagAdd?: () => void;
  onFlagEdit?: (flag: Flag) => void;
  onFlagDelete?: (flagId: string) => void;
  disabled?: boolean;
}

const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const truncateNote = (note: string, maxLength: number = 50): string => {
  if (note.length <= maxLength) return note;
  return note.substring(0, maxLength).trim() + '...';
};

export const FlagsPanel: React.FC<FlagsPanelProps> = ({
  flags,
  onFlagClick,
  onFlagAdd,
  onFlagEdit,
  onFlagDelete,
  disabled = false,
}) => {
  const [expandedFlags, setExpandedFlags] = useState<string[]>([]);
  const [deletedFlag, setDeletedFlag] = useState<Flag | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Clear undo toast after 5 seconds
  useEffect(() => {
    if (deletedFlag) {
      const timeout = setTimeout(() => {
        setDeletedFlag(null);
      }, 5000);
      setUndoTimeout(timeout);
      return () => clearTimeout(timeout);
    }
  }, [deletedFlag]);

  const toggleExpanded = (flagId: string) => {
    setExpandedFlags(prev =>
      prev.includes(flagId)
        ? prev.filter(id => id !== flagId)
        : [...prev, flagId]
    );
  };

  const handleDelete = (flag: Flag) => {
    setDeletedFlag(flag);
    onFlagDelete?.(flag.id);
  };

  const handleUndo = () => {
    if (deletedFlag && undoTimeout) {
      clearTimeout(undoTimeout);
      // In real implementation, this would restore the flag
      // For now, just log it
      console.log('Undo delete:', deletedFlag.id);
      setDeletedFlag(null);
    }
  };

  // Filter flags based on search query
  const filteredFlags = flags.filter(flag => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      flag.label.toLowerCase().includes(q) ||
      flag.note?.toLowerCase().includes(q) ||
      flag.createdBy?.toLowerCase().includes(q)
    );
  });

  return (
    <Container>
      <Header>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlagIcon sx={{ fontSize: 14, color: '#19abb5' }} />
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#ccc', textTransform: 'uppercase' }}>
            Flags
          </Typography>
          <Typography sx={{ fontSize: 10, color: '#666' }}>
            ({searchQuery.trim() ? `${filteredFlags.length}/${flags.length}` : flags.length})
          </Typography>
        </Box>
        <Tooltip title="Add flag (M)">
          <IconButton
            size="small"
            onClick={onFlagAdd}
            disabled={disabled}
            sx={{ padding: '4px', color: '#666', '&:hover': { color: '#19abb5' } }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Header>

      {/* Search - only show if there are flags */}
      {flags.length > 0 && (
        <Box sx={{ padding: '8px 12px', borderBottom: '1px solid #252525' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search flags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: '#555' }} />
                </InputAdornment>
              ),
              sx: {
                fontSize: 11,
                height: 28,
                backgroundColor: '#252525',
                '& fieldset': { border: 'none' },
                '& input': { padding: '4px 8px' },
                '& input::placeholder': { color: '#555', opacity: 1 },
              },
            }}
          />
        </Box>
      )}

      <FlagsList>
        {flags.length === 0 ? (
          <EmptyState>
            <FlagIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 11 }}>No flags yet</Typography>
            <Typography sx={{ fontSize: 10, mt: 0.5, textAlign: 'center', lineHeight: 1.4 }}>
              Press <span style={{ color: '#19abb5' }}>M</span> while playing<br />
              or click <span style={{ color: '#19abb5' }}>+</span> above
            </Typography>
          </EmptyState>
        ) : filteredFlags.length === 0 ? (
          <EmptyState>
            <SearchIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 11 }}>No flags match "{searchQuery}"</Typography>
          </EmptyState>
        ) : (
          filteredFlags.map((flag) => {
            const isExpanded = expandedFlags.includes(flag.id);
            const hasNote = flag.note && flag.note.length > 0;

            return (
              <FlagItem key={flag.id}>
                <FlagHeader>
                  {/* Color indicator */}
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: flag.userColor || '#19abb5',
                      flexShrink: 0,
                    }}
                  />
                  <Tooltip title="Click to jump to this time" placement="top">
                    <Timestamp onClick={() => onFlagClick?.(flag)}>
                      {formatTimestamp(flag.timestamp)}
                    </Timestamp>
                  </Tooltip>

                  <FlagLabel>{flag.label || 'Untitled'}</FlagLabel>

                  <FlagActions className="flag-actions">
                    <Tooltip title="Edit flag">
                      <IconButton
                        size="small"
                        onClick={() => onFlagEdit?.(flag)}
                        sx={{ padding: '2px', color: '#555', '&:hover': { color: '#19abb5' } }}
                      >
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Delete flag">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(flag)}
                        sx={{ padding: '2px', color: '#555', '&:hover': { color: '#c45c5c' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  </FlagActions>
                </FlagHeader>

                {/* Note preview or full note */}
                {hasNote && (
                  isExpanded ? (
                    <FullNote onClick={() => toggleExpanded(flag.id)}>
                      {flag.note}
                      {flag.createdBy && (
                        <Typography sx={{ fontSize: 9, color: '#555', mt: 1 }}>
                          — {flag.createdBy}
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: 9, color: '#444', mt: 0.5, fontStyle: 'italic' }}>
                        Click to collapse
                      </Typography>
                    </FullNote>
                  ) : (
                    <NotePreview onClick={() => toggleExpanded(flag.id)}>
                      "{truncateNote(flag.note!)}"
                    </NotePreview>
                  )
                )}
              </FlagItem>
            );
          })
        )}
      </FlagsList>

      {/* Add flag button at bottom when list has items */}
      {filteredFlags.length > 0 && (
        <Footer>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            startIcon={<FlagIcon sx={{ fontSize: 14 }} />}
            onClick={onFlagAdd}
            disabled={disabled}
            sx={{
              fontSize: 10,
              color: '#666',
              borderColor: '#333',
              py: 0.5,
              '&:hover': {
                borderColor: '#19abb5',
                color: '#19abb5',
              },
            }}
          >
            Add Flag at Current Time
          </Button>
        </Footer>
      )}

      {/* Undo toast */}
      {deletedFlag && (
        <UndoToast>
          <Typography sx={{ fontSize: 11, color: '#ccc' }}>
            Flag deleted
          </Typography>
          <Button
            size="small"
            startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
            onClick={handleUndo}
            sx={{
              fontSize: 10,
              color: '#19abb5',
              minWidth: 'auto',
              py: 0.25,
              px: 1,
            }}
          >
            Undo
          </Button>
        </UndoToast>
      )}
    </Container>
  );
};

export default FlagsPanel;
