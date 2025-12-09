/**
 * NotesViewer Component
 * Simplified notes viewer for multi-view pop-out window
 * Displays timestamped notes with ability to add new notes
 */

import React, { useState, useCallback } from 'react';
import { Box, TextField, IconButton, Typography, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

// Styled components
const ViewerContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

const NotesHeader = styled(Box)({
  height: 40,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
});

const NotesContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 12,
});

const NoteItem = styled(Box)({
  padding: 12,
  backgroundColor: '#1a1a1a',
  borderRadius: 4,
  marginBottom: 8,
  border: '1px solid #2a2a2a',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    borderColor: '#19abb5',
    backgroundColor: '#1e1e1e',
  },
});

const NoteTimestamp = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#19abb5',
  marginBottom: 4,
});

const NoteText = styled(Typography)({
  fontSize: 13,
  color: '#ccc',
  lineHeight: 1.5,
});

const AddNoteSection = styled(Box)({
  borderTop: '1px solid #333',
  padding: 12,
  backgroundColor: '#161616',
});

const PlaceholderContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  padding: 24,
  textAlign: 'center',
  flex: 1,
});

const MaterialSymbol: React.FC<{ icon: string; size?: number }> = ({ icon, size = 20 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size }}
  >
    {icon}
  </span>
);

interface Note {
  id: string;
  timestamp: number;
  text: string;
  createdAt: Date;
}

interface NotesViewerProps {
  className?: string;
}

// Helper to format time
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const NotesViewer: React.FC<NotesViewerProps> = ({ className }) => {
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  const [notes, setNotes] = useState<Note[]>([
    // Demo notes for placeholder
    {
      id: '1',
      timestamp: 5000,
      text: 'Subject enters frame from left side',
      createdAt: new Date(),
    },
    {
      id: '2',
      timestamp: 15000,
      text: 'Audio anomaly detected - possible voice modulation',
      createdAt: new Date(),
    },
  ]);
  const [newNoteText, setNewNoteText] = useState('');

  // Add note at current timestamp
  const handleAddNote = useCallback(() => {
    if (!newNoteText.trim()) return;

    const newNote: Note = {
      id: Date.now().toString(),
      timestamp,
      text: newNoteText.trim(),
      createdAt: new Date(),
    };

    setNotes(prev => [...prev, newNote].sort((a, b) => a.timestamp - b.timestamp));
    setNewNoteText('');
  }, [timestamp, newNoteText]);

  // Jump to note timestamp
  const handleNoteClick = useCallback((noteTimestamp: number) => {
    setTimestamp(noteTimestamp);
  }, [setTimestamp]);

  // Handle Enter key to submit
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  }, [handleAddNote]);

  return (
    <ViewerContainer className={className}>
      {/* Header */}
      <NotesHeader>
        <MaterialSymbol icon="sticky_note_2" size={18} />
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>
          Notes
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: '#666' }}>
          {notes.length} notes
        </Typography>
      </NotesHeader>

      {/* Notes list */}
      <NotesContent>
        {notes.length === 0 ? (
          <PlaceholderContent>
            <MaterialSymbol icon="sticky_note_2" size={48} />
            <Typography sx={{ mt: 2, color: '#666', fontSize: 14 }}>
              No notes yet
            </Typography>
            <Typography sx={{ color: '#444', fontSize: 12, mt: 1 }}>
              Add a note at the current timestamp
            </Typography>
          </PlaceholderContent>
        ) : (
          notes.map((note) => (
            <NoteItem key={note.id} onClick={() => handleNoteClick(note.timestamp)}>
              <NoteTimestamp>
                {formatTime(note.timestamp)}
              </NoteTimestamp>
              <NoteText>
                {note.text}
              </NoteText>
            </NoteItem>
          ))
        )}
      </NotesContent>

      {/* Add note section */}
      <AddNoteSection>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 11, color: '#666' }}>
            Add note at
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#19abb5', fontFamily: 'monospace' }}>
            {formatTime(timestamp)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Type note here..."
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#1a1a1a',
                fontSize: 13,
                '& fieldset': { borderColor: '#333' },
                '&:hover fieldset': { borderColor: '#444' },
                '&.Mui-focused fieldset': { borderColor: '#19abb5' },
              },
              '& .MuiInputBase-input': { color: '#ccc' },
            }}
          />
          <Button
            variant="contained"
            onClick={handleAddNote}
            disabled={!newNoteText.trim()}
            sx={{
              backgroundColor: '#19abb5',
              color: '#fff',
              minWidth: 80,
              '&:hover': { backgroundColor: '#1bc4d0' },
              '&.Mui-disabled': {
                backgroundColor: '#333',
                color: '#666',
              },
            }}
          >
            Add
          </Button>
        </Box>
      </AddNoteSection>
    </ViewerContainer>
  );
};

export default NotesViewer;
