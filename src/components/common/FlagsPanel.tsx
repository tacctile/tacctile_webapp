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
  onFlagUpdate?: (flagId: string, updates: { label?: string; note?: string }) => void;
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
  onFlagUpdate,
  onFlagDelete,
  disabled = false,
}) => {
  const [expandedFlags, setExpandedFlags] = useState<string[]>([]);
  const [deletedFlag, setDeletedFlag] = useState<Flag | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit mode state
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');

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

  // Start editing a flag
  const startEditing = (flag: Flag) => {
    setEditingFlagId(flag.id);
    setEditLabel(flag.label || '');
    setEditNote(flag.note || '');
  };

  // Save edits
  const saveEdit = () => {
    if (editingFlagId && onFlagUpdate) {
      onFlagUpdate(editingFlagId, {
        label: editLabel,
        note: editNote,
      });
    }
    setEditingFlagId(null);
    setEditLabel('');
    setEditNote('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingFlagId(null);
    setEditLabel('');
    setEditNote('');
  };

  // Handle key events for edit inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Handle flag click - jump to timestamp and open edit mode
  const handleFlagClick = (flag: Flag) => {
    onFlagClick?.(flag);
    startEditing(flag);
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
            const isEditing = editingFlagId === flag.id;

            return (
              <FlagItem
                key={flag.id}
                sx={{
                  backgroundColor: isEditing ? 'rgba(25, 171, 181, 0.08)' : 'transparent',
                  borderLeft: isEditing ? '2px solid #19abb5' : '2px solid transparent',
                }}
              >
                <FlagHeader
                  sx={{ cursor: 'pointer' }}
                  onClick={() => !isEditing && handleFlagClick(flag)}
                >
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
                    <Timestamp onClick={(e) => { e.stopPropagation(); handleFlagClick(flag); }}>
                      {formatTimestamp(flag.timestamp)}
                    </Timestamp>
                  </Tooltip>

                  {/* User name display */}
                  {flag.createdBy && (
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: flag.userColor || '#888',
                        fontWeight: 500,
                        flexShrink: 0,
                        px: 0.5,
                      }}
                    >
                      {flag.createdBy}
                    </Typography>
                  )}

                  {!isEditing && (
                    <>
                      <FlagLabel sx={{ color: flag.label ? '#ccc' : '#666' }}>
                        {flag.label || 'Untitled'}
                      </FlagLabel>

                      <FlagActions className="flag-actions">
                        <Tooltip title="Edit flag">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); startEditing(flag); }}
                            sx={{ padding: '2px', color: '#555', '&:hover': { color: '#19abb5' } }}
                          >
                            <EditIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete flag">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleDelete(flag); }}
                            sx={{ padding: '2px', color: '#555', '&:hover': { color: '#c45c5c' } }}
                          >
                            <DeleteIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </FlagActions>
                    </>
                  )}
                </FlagHeader>

                {/* Inline edit form */}
                {isEditing && (
                  <Box sx={{ p: '8px 12px', pt: 0 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add label..."
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      sx={{
                        mb: 1,
                        '& .MuiInputBase-root': {
                          fontSize: 11,
                          backgroundColor: '#2a2a2a',
                          '& fieldset': { borderColor: '#555' },
                          '&:hover fieldset': { borderColor: '#666' },
                          '&.Mui-focused fieldset': { borderColor: '#19abb5' },
                        },
                        '& .MuiInputBase-input': {
                          color: 'white',
                          padding: '6px 10px',
                          '&::placeholder': { color: '#666', opacity: 1 },
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      placeholder="Add description..."
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      onKeyDown={(e) => {
                        // Only escape cancels in textarea, not enter (allows newlines)
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      sx={{
                        mb: 1,
                        '& .MuiInputBase-root': {
                          fontSize: 11,
                          backgroundColor: '#2a2a2a',
                          '& fieldset': { borderColor: '#555' },
                          '&:hover fieldset': { borderColor: '#666' },
                          '&.Mui-focused fieldset': { borderColor: '#19abb5' },
                        },
                        '& .MuiInputBase-input': {
                          color: 'white',
                          padding: '6px 10px',
                          '&::placeholder': { color: '#666', opacity: 1 },
                        },
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        onClick={cancelEdit}
                        sx={{
                          fontSize: 10,
                          color: 'white',
                          backgroundColor: 'transparent',
                          border: '1px solid #666',
                          px: 1.5,
                          py: 0.5,
                          minWidth: 'auto',
                          '&:hover': {
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderColor: '#888',
                          },
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        onClick={saveEdit}
                        sx={{
                          fontSize: 10,
                          color: 'white',
                          backgroundColor: '#19abb5',
                          px: 1.5,
                          py: 0.5,
                          minWidth: 'auto',
                          '&:hover': {
                            backgroundColor: '#15969f',
                          },
                        }}
                      >
                        Save
                      </Button>
                    </Box>
                  </Box>
                )}

                {/* Description preview (when not editing) */}
                {!isEditing && hasNote && (
                  <Box
                    sx={{
                      px: '12px',
                      pb: 1,
                      pt: 0,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleFlagClick(flag)}
                  >
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: '#888',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {flag.note}
                    </Typography>
                  </Box>
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
