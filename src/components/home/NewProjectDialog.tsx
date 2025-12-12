/**
 * NewProjectDialog Component
 * Modal dialog for creating a new project with name, location, date/time, and storage options
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderIcon from '@mui/icons-material/Folder';
import CloudIcon from '@mui/icons-material/Cloud';
import type { StorageLocation } from '@/stores/useHomeStore';

// ============================================================================
// TYPES
// ============================================================================

export type StorageType = 'local' | 'google_drive' | 'dropbox' | 'onedrive';

export interface NewProjectData {
  id: string;
  name: string;
  location: string;
  createdAt: number;
  modifiedAt: number;
  storageType: StorageType;
  files: never[];
  flags: never[];
  notes: never[];
}

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const StyledDialog = styled(Dialog)(() => ({
  '& .MuiDialog-paper': {
    backgroundColor: '#1a1a1a',
    backgroundImage: 'none',
    border: '1px solid #2b2b2b',
    borderRadius: 12,
    maxWidth: 480,
    width: '100%',
  },
}));

const StyledDialogTitle = styled(DialogTitle)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 24px',
  backgroundColor: '#151515',
  borderBottom: '1px solid #2b2b2b',
});

const HeaderIcon = styled(Box)({
  width: 48,
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(25, 171, 181, 0.15)',
  borderRadius: '50%',
  marginRight: 16,
  '& svg': {
    fontSize: 24,
    color: '#19abb5',
  },
});

const FormField = styled(Box)({
  marginBottom: 20,
});

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#252525',
    '& fieldset': {
      borderColor: '#333',
    },
    '&:hover fieldset': {
      borderColor: '#444',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#19abb5',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#888',
    '&.Mui-focused': {
      color: '#19abb5',
    },
  },
  '& .MuiOutlinedInput-input': {
    color: '#e1e1e1',
  },
});

const StyledFormControl = styled(FormControl)({
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#252525',
    '& fieldset': {
      borderColor: '#333',
    },
    '&:hover fieldset': {
      borderColor: '#444',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#19abb5',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#888',
    '&.Mui-focused': {
      color: '#19abb5',
    },
  },
  '& .MuiSelect-select': {
    color: '#e1e1e1',
  },
  '& .MuiSelect-icon': {
    color: '#888',
  },
});

const StorageMenuItem = styled(MenuItem)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  '& svg': {
    fontSize: 20,
  },
});

// ============================================================================
// HELPERS
// ============================================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getStorageIcon(type: string): React.ReactNode {
  switch (type) {
    case 'local':
      return <FolderIcon sx={{ color: '#808080' }} />;
    case 'google-drive':
    case 'google_drive':
      return <CloudIcon sx={{ color: '#4285f4' }} />;
    case 'dropbox':
      return <CloudIcon sx={{ color: '#0061ff' }} />;
    case 'onedrive':
      return <CloudIcon sx={{ color: '#0078d4' }} />;
    default:
      return <FolderIcon sx={{ color: '#808080' }} />;
  }
}

function mapStorageTypeId(storeType: string): StorageType {
  switch (storeType) {
    case 'local':
      return 'local';
    case 'google-drive':
      return 'google_drive';
    case 'dropbox':
      return 'dropbox';
    case 'onedrive':
      return 'onedrive';
    default:
      return 'local';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export interface NewProjectDialogProps {
  open: boolean;
  storageLocations: StorageLocation[];
  onClose: () => void;
  onCreate: (project: NewProjectData) => void;
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  open,
  storageLocations,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState(formatDateTimeLocal(new Date()));
  const [selectedStorageId, setSelectedStorageId] = useState('local');

  // Only show connected storage options
  const connectedStorages = useMemo(
    () => storageLocations.filter((s) => s.connected),
    [storageLocations]
  );

  const isValid = name.trim().length > 0;

  const handleCreate = () => {
    if (!isValid) return;

    const now = new Date(dateTime).getTime();
    const projectData: NewProjectData = {
      id: generateUUID(),
      name: name.trim(),
      location: location.trim(),
      createdAt: now,
      modifiedAt: now,
      storageType: mapStorageTypeId(selectedStorageId),
      files: [],
      flags: [],
      notes: [],
    };

    onCreate(projectData);
    handleClose();
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setLocation('');
    setDateTime(formatDateTimeLocal(new Date()));
    setSelectedStorageId('local');
    onClose();
  };

  return (
    <StyledDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <StyledDialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <HeaderIcon>
            <FolderOpenIcon />
          </HeaderIcon>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#e1e1e1' }}>
              New Project
            </Typography>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Create a new investigation project
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: '#888' }}>
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent sx={{ padding: 3 }}>
        {/* Project Name */}
        <FormField>
          <StyledTextField
            label="Project Name"
            placeholder="e.g., Warehouse Investigation 2024"
            fullWidth
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </FormField>

        {/* Location */}
        <FormField>
          <StyledTextField
            label="Location"
            placeholder="e.g., 123 Main St, City (optional)"
            fullWidth
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </FormField>

        {/* Date/Time */}
        <FormField>
          <StyledTextField
            label="Date & Time"
            type="datetime-local"
            fullWidth
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </FormField>

        {/* Storage Destination */}
        <FormField sx={{ marginBottom: 0 }}>
          <StyledFormControl fullWidth>
            <InputLabel>Storage Destination</InputLabel>
            <Select
              value={selectedStorageId}
              onChange={(e) => setSelectedStorageId(e.target.value)}
              label="Storage Destination"
            >
              {connectedStorages.map((storage) => (
                <StorageMenuItem key={storage.id} value={storage.id}>
                  {getStorageIcon(storage.type)}
                  <Typography sx={{ color: '#e1e1e1' }}>{storage.name}</Typography>
                </StorageMenuItem>
              ))}
            </Select>
          </StyledFormControl>
          <Typography variant="caption" sx={{ color: '#666', mt: 1, display: 'block' }}>
            {connectedStorages.length === 1
              ? 'Connect more storage providers in Settings to see more options.'
              : `${connectedStorages.length} storage locations connected.`}
          </Typography>
        </FormField>
      </DialogContent>

      <Divider sx={{ borderColor: '#2b2b2b' }} />

      <DialogActions sx={{ padding: '12px 24px', backgroundColor: '#151515' }}>
        <Button onClick={handleClose} sx={{ color: '#888' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!isValid}
          sx={{
            backgroundColor: '#19abb5',
            '&:hover': {
              backgroundColor: '#158d95',
            },
            '&.Mui-disabled': {
              backgroundColor: '#333',
              color: '#666',
            },
          }}
        >
          Create Project
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default NewProjectDialog;
