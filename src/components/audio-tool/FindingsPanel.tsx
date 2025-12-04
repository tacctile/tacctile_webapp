/**
 * FindingsPanel Component
 * Displays and manages spectral findings/annotations
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Avatar from '@mui/material/Avatar';
import Collapse from '@mui/material/Collapse';
import { styled } from '@mui/material/styles';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FlagIcon from '@mui/icons-material/Flag';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SyncIcon from '@mui/icons-material/Sync';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

import type { AudioFinding, SpectralSelection } from '../../types/audio';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PanelContainer = styled(Box)({
  backgroundColor: '#1a1a1a',
  borderRadius: 8,
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

const FindingsList = styled(List)({
  flex: 1,
  overflow: 'auto',
  padding: 0,
});

const FindingItem = styled(ListItemButton)<{ selected?: boolean }>(({ selected }) => ({
  borderLeft: selected ? '3px solid #ff9800' : '3px solid transparent',
  backgroundColor: selected ? 'rgba(255, 152, 0, 0.1)' : 'transparent',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  padding: '12px',
  '&:hover': {
    backgroundColor: selected ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

const ConfidenceChip = styled(Chip)<{ confidence: 'low' | 'medium' | 'high' }>(({ confidence }) => ({
  height: 18,
  fontSize: 10,
  backgroundColor:
    confidence === 'high' ? '#4caf50' : confidence === 'medium' ? '#ff9800' : '#f44336',
  color: '#ffffff',
  '& .MuiChip-label': {
    padding: '0 6px',
  },
}));

const TimeRange = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: '#888888',
  fontFamily: 'monospace',
});

const FrequencyRange = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: '#888888',
  fontFamily: 'monospace',
});

const EmptyState = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  textAlign: 'center',
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface FindingsPanelProps {
  /** List of findings */
  findings: AudioFinding[];
  /** Current spectral selection (for creating new finding) */
  currentSelection: SpectralSelection | null;
  /** Currently selected finding ID */
  selectedFindingId?: string | null;
  /** Callback to create a finding from selection */
  onCreateFinding: (title: string, notes?: string, confidence?: AudioFinding['confidence']) => void;
  /** Callback to update a finding */
  onUpdateFinding: (id: string, updates: Partial<AudioFinding>) => void;
  /** Callback to delete a finding */
  onDeleteFinding: (id: string) => void;
  /** Callback to toggle finding visibility */
  onToggleVisibility: (id: string, visible: boolean) => void;
  /** Callback when a finding is selected/clicked */
  onFindingSelect: (id: string) => void;
  /** Callback to seek to finding time */
  onSeekToFinding: (finding: AudioFinding) => void;
  /** Callback to sync finding to EvidenceFlag */
  onSyncToFlag?: (findingId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings,
  currentSelection,
  selectedFindingId,
  onCreateFinding,
  onUpdateFinding,
  onDeleteFinding,
  onToggleVisibility,
  onFindingSelect,
  onSeekToFinding,
  onSyncToFlag,
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<AudioFinding | null>(null);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [confidence, setConfidence] = useState<AudioFinding['confidence']>('medium');

  const handleCreateFinding = () => {
    if (title.trim()) {
      onCreateFinding(title.trim(), notes.trim() || undefined, confidence);
      setCreateDialogOpen(false);
      resetForm();
    }
  };

  const handleEditFinding = () => {
    if (editingFinding && title.trim()) {
      onUpdateFinding(editingFinding.id, {
        title: title.trim(),
        notes: notes.trim() || undefined,
        confidence,
      });
      setEditDialogOpen(false);
      setEditingFinding(null);
      resetForm();
    }
  };

  const openEditDialog = (finding: AudioFinding) => {
    setEditingFinding(finding);
    setTitle(finding.title);
    setNotes(finding.notes || '');
    setConfidence(finding.confidence);
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setConfidence('medium');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    return `${secs}.${ms.toString().padStart(2, '0')}s`;
  };

  const formatFrequency = (hz: number): string => {
    if (hz >= 1000) {
      return `${(hz / 1000).toFixed(1)}k`;
    }
    return `${Math.round(hz)}`;
  };

  const toggleExpanded = (id: string) => {
    setExpandedFindingId(expandedFindingId === id ? null : id);
  };

  return (
    <PanelContainer>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: '1px solid #2b2b2b',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlagIcon sx={{ color: '#ff9800', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Findings
          </Typography>
          <Chip
            label={findings.length}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              backgroundColor: '#333333',
              color: '#aaaaaa',
            }}
          />
        </Box>
        <Tooltip title={currentSelection ? 'Create finding from selection' : 'Select a region first'}>
          <span>
            <IconButton
              size="small"
              onClick={() => setCreateDialogOpen(true)}
              disabled={!currentSelection}
              sx={{
                color: currentSelection ? '#19abb5' : '#555555',
                '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.1)' },
              }}
            >
              <AddIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Findings List */}
      {findings.length === 0 ? (
        <EmptyState>
          <RecordVoiceOverIcon sx={{ fontSize: 48, color: '#333333', mb: 2 }} />
          <Typography variant="body2" sx={{ color: '#666666', mb: 1 }}>
            No findings yet
          </Typography>
          <Typography variant="caption" sx={{ color: '#555555', mb: 2 }}>
            Draw a selection on the spectrogram and save it as a finding
          </Typography>
          {currentSelection && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{
                borderColor: '#19abb5',
                color: '#19abb5',
                '&:hover': { borderColor: '#36d1da' },
              }}
            >
              Create Finding
            </Button>
          )}
        </EmptyState>
      ) : (
        <FindingsList>
          {findings.map((finding) => (
            <Box key={finding.id}>
              <FindingItem
                selected={finding.id === selectedFindingId}
                onClick={() => onFindingSelect(finding.id)}
              >
                {/* Header row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {finding.title}
                    </Typography>
                    <ConfidenceChip label={finding.confidence} confidence={finding.confidence} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(finding.id);
                      }}
                      sx={{ color: '#666666', p: 0.5 }}
                    >
                      {expandedFindingId === finding.id ? (
                        <ExpandLessIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </Box>
                </Box>

                {/* Time and frequency info */}
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <TimeRange>
                    <AccessTimeIcon sx={{ fontSize: 12 }} />
                    {formatTime(finding.selection.startTime)} - {formatTime(finding.selection.endTime)}
                  </TimeRange>
                  <FrequencyRange>
                    {formatFrequency(finding.selection.lowFrequency)} - {formatFrequency(finding.selection.highFrequency)} Hz
                  </FrequencyRange>
                </Box>

                {/* Expanded content */}
                <Collapse in={expandedFindingId === finding.id}>
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #2b2b2b' }}>
                    {finding.notes && (
                      <Typography variant="caption" sx={{ color: '#888888', display: 'block', mb: 1.5 }}>
                        {finding.notes}
                      </Typography>
                    )}

                    {/* User info */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      {finding.userPhotoURL ? (
                        <Avatar src={finding.userPhotoURL} sx={{ width: 20, height: 20 }} />
                      ) : (
                        <Avatar sx={{ width: 20, height: 20, fontSize: 10 }}>
                          {finding.userDisplayName?.[0] || '?'}
                        </Avatar>
                      )}
                      <Typography variant="caption" sx={{ color: '#666666' }}>
                        {finding.userDisplayName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#555555' }}>
                        {new Date(finding.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>

                    {/* Action buttons */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Play from this time">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSeekToFinding(finding);
                          }}
                          sx={{ color: '#19abb5' }}
                        >
                          <PlayArrowIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={finding.visible ? 'Hide on spectrogram' : 'Show on spectrogram'}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleVisibility(finding.id, !finding.visible);
                          }}
                          sx={{ color: finding.visible ? '#4caf50' : '#666666' }}
                        >
                          {finding.visible ? (
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <VisibilityOffIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit finding">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(finding);
                          }}
                          sx={{ color: '#666666' }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      {onSyncToFlag && !finding.flagId && (
                        <Tooltip title="Sync to Evidence Flag">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSyncToFlag(finding.id);
                            }}
                            sx={{ color: '#2196f3' }}
                          >
                            <SyncIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete finding">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFinding(finding.id);
                          }}
                          sx={{ color: '#666666', '&:hover': { color: '#ff5722' } }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Collapse>
              </FindingItem>
            </Box>
          ))}
        </FindingsList>
      )}

      {/* Create Finding Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Finding</DialogTitle>
        <DialogContent>
          {currentSelection && (
            <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#1a1a1a', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: '#888888' }}>
                Selection: {formatTime(currentSelection.startTime)} - {formatTime(currentSelection.endTime)}
                {' | '}
                {formatFrequency(currentSelection.lowFrequency)} - {formatFrequency(currentSelection.highFrequency)} Hz
              </Typography>
            </Box>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="outlined"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Possible EVP - whisper"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Notes (optional)"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what you heard or observed..."
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Confidence</InputLabel>
            <Select
              value={confidence}
              label="Confidence"
              onChange={(e) => setConfidence(e.target.value as AudioFinding['confidence'])}
            >
              <MenuItem value="low">Low - Uncertain, needs review</MenuItem>
              <MenuItem value="medium">Medium - Possible anomaly</MenuItem>
              <MenuItem value="high">High - Clear evidence</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateFinding} variant="contained" disabled={!title.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Finding Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Finding</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="outlined"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Notes (optional)"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Confidence</InputLabel>
            <Select
              value={confidence}
              label="Confidence"
              onChange={(e) => setConfidence(e.target.value as AudioFinding['confidence'])}
            >
              <MenuItem value="low">Low - Uncertain, needs review</MenuItem>
              <MenuItem value="medium">Medium - Possible anomaly</MenuItem>
              <MenuItem value="high">High - Clear evidence</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditFinding} variant="contained" disabled={!title.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PanelContainer>
  );
};

export default FindingsPanel;
