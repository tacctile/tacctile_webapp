import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Collapse } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FlagIcon from '@mui/icons-material/Flag';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

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
});

const FlagHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '6px 12px',
  cursor: 'pointer',
  gap: 8,
});

const FlagNote = styled(Box)({
  padding: '4px 12px 8px 36px',
  fontSize: 10,
  color: '#888',
  lineHeight: 1.4,
  backgroundColor: 'rgba(0,0,0,0.2)',
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

export interface Flag {
  id: string;
  timestamp: number;       // ms offset from start
  label: string;
  note?: string;
  category?: string;
  createdBy?: string;
  createdAt?: number;
}

interface FlagsPanelProps {
  flags: Flag[];
  onFlagClick?: (flag: Flag) => void;     // Jump to timestamp
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

export const FlagsPanel: React.FC<FlagsPanelProps> = ({
  flags,
  onFlagClick,
  onFlagAdd,
  onFlagEdit,
  onFlagDelete,
  disabled = false,
}) => {
  const [expandedFlags, setExpandedFlags] = useState<string[]>([]);

  const toggleExpanded = (flagId: string) => {
    setExpandedFlags(prev =>
      prev.includes(flagId)
        ? prev.filter(id => id !== flagId)
        : [...prev, flagId]
    );
  };

  return (
    <Container>
      <Header>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlagIcon sx={{ fontSize: 14, color: '#19abb5' }} />
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#ccc', textTransform: 'uppercase' }}>
            Flags
          </Typography>
          <Typography sx={{ fontSize: 10, color: '#666' }}>
            ({flags.length})
          </Typography>
        </Box>
        <Tooltip title="Add flag">
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

      <FlagsList>
        {flags.length === 0 ? (
          <EmptyState>
            <FlagIcon sx={{ fontSize: 32, mb: 1, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 11 }}>No flags yet</Typography>
            <Typography sx={{ fontSize: 10, mt: 0.5 }}>
              Press M or click + to add
            </Typography>
          </EmptyState>
        ) : (
          flags.map((flag) => {
            const isExpanded = expandedFlags.includes(flag.id);
            const hasNote = flag.note && flag.note.length > 0;

            return (
              <FlagItem key={flag.id}>
                <FlagHeader>
                  <Timestamp onClick={() => onFlagClick?.(flag)}>
                    {formatTimestamp(flag.timestamp)}
                  </Timestamp>
                  <FlagLabel>{flag.label}</FlagLabel>

                  {hasNote && (
                    <IconButton
                      size="small"
                      onClick={() => toggleExpanded(flag.id)}
                      sx={{ padding: '2px', color: '#555' }}
                    >
                      {isExpanded ? (
                        <ExpandLessIcon sx={{ fontSize: 14 }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 14 }} />
                      )}
                    </IconButton>
                  )}

                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => onFlagEdit?.(flag)}
                      sx={{ padding: '2px', color: '#444', '&:hover': { color: '#888' } }}
                    >
                      <EditIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => onFlagDelete?.(flag.id)}
                      sx={{ padding: '2px', color: '#444', '&:hover': { color: '#c45c5c' } }}
                    >
                      <DeleteIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Tooltip>
                </FlagHeader>

                {hasNote && (
                  <Collapse in={isExpanded}>
                    <FlagNote>
                      {flag.note}
                      {flag.createdBy && (
                        <Typography sx={{ fontSize: 9, color: '#555', mt: 0.5 }}>
                          — {flag.createdBy}
                        </Typography>
                      )}
                    </FlagNote>
                  </Collapse>
                )}
              </FlagItem>
            );
          })
        )}
      </FlagsList>
    </Container>
  );
};

export default FlagsPanel;
