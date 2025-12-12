/**
 * HomePage Component
 * Landing screen for Tacctile - displays storage locations, projects, and quick analyze
 *
 * Layout:
 * - LEFT PANEL (280px, same as other tools): Storage locations + Quick Analyze drop zone
 * - RIGHT PANEL (fills remaining space): Project cards grid with search, sort, and view controls
 */

import React, { useCallback, useState, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  Tooltip,
  Divider,
} from '@mui/material';
import { NewProjectDialog, type NewProjectData } from './NewProjectDialog';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckIcon from '@mui/icons-material/Check';
import CloudIcon from '@mui/icons-material/Cloud';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FlagIcon from '@mui/icons-material/Flag';
import MovieIcon from '@mui/icons-material/Movie';
import MicIcon from '@mui/icons-material/Mic';
import PhotoIcon from '@mui/icons-material/Photo';

import { useHomeStore, type Project, type StorageLocation, type ViewMode, type SortBy } from '@/stores/useHomeStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useAppPersistence } from '@/stores/useAppPersistence';

// ============================================================================
// CONSTANTS - Match WorkspaceLayout panel widths
// ============================================================================

const LEFT_PANEL_WIDTH = 280;
const COLLAPSED_WIDTH = 36;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PageContainer = styled(Box)({
  display: 'flex',
  height: '100%',
  backgroundColor: '#121212',
  overflow: 'hidden',
});

// Left Panel Styles - matches WorkspaceLayout left panel
const LeftPanel = styled(Box)<{ collapsed?: boolean }>(({ collapsed }) => ({
  width: collapsed ? COLLAPSED_WIDTH : LEFT_PANEL_WIDTH,
  minWidth: collapsed ? COLLAPSED_WIDTH : LEFT_PANEL_WIDTH,
  maxWidth: collapsed ? COLLAPSED_WIDTH : LEFT_PANEL_WIDTH,
  backgroundColor: '#181818',
  borderRight: '1px solid #252525',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'width 0.15s ease, min-width 0.15s ease, max-width 0.15s ease',
}));

const PanelHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 10px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #252525',
  minHeight: 32,
});

const PanelTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: '#808080',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

const CollapseButton = styled(IconButton)({
  color: '#666',
  padding: 4,
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.08)',
  },
});

const CollapsedPanel = styled(Box)({
  width: COLLAPSED_WIDTH,
  minWidth: COLLAPSED_WIDTH,
  maxWidth: COLLAPSED_WIDTH,
  backgroundColor: '#181818',
  borderRight: '1px solid #252525',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 6,
});

const StorageList = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: '8px 0',
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

const StorageItem = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  cursor: 'pointer',
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.08)' : 'transparent',
  borderLeft: selected ? '2px solid #19abb5' : '2px solid transparent',
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.12)' : 'rgba(255, 255, 255, 0.04)',
  },
}));

const StorageIcon = styled(Box)<{ type: string }>(({ type }) => {
  const colors: Record<string, string> = {
    local: '#808080',
    'google-drive': '#4285f4',
    dropbox: '#0061ff',
    onedrive: '#0078d4',
  };
  return {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    color: colors[type] || '#808080',
  };
});

const StorageName = styled(Typography)({
  flex: 1,
  fontSize: 12,
  color: '#ccc',
});

const StorageStatus = styled(Box)<{ connected: boolean }>(({ connected }) => ({
  fontSize: 10,
  color: connected ? '#5a9a6b' : '#808080',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}));

const AddStorageButton = styled(Button)({
  margin: '8px 12px',
  color: '#808080',
  borderColor: '#333',
  fontSize: 11,
  '&:hover': {
    borderColor: '#19abb5',
    color: '#19abb5',
  },
});

const QuickAnalyzeSection = styled(Box)({
  padding: 12,
  borderTop: '1px solid #252525',
});

const DropZone = styled(Box)<{ isDragging?: boolean }>(({ isDragging }) => ({
  border: `2px dashed ${isDragging ? '#19abb5' : '#333'}`,
  borderRadius: 4,
  padding: 16,
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  backgroundColor: isDragging ? 'rgba(25, 171, 181, 0.08)' : 'transparent',
  '&:hover': {
    borderColor: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.04)',
  },
}));

// Right Panel Styles
const RightPanel = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: '#121212',
});

const RightHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '12px 20px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #252525',
});

const SearchField = styled(TextField)({
  flex: 1,
  maxWidth: 400,
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#252525',
    fontSize: 13,
    height: 32,
    '& fieldset': {
      borderColor: 'transparent',
    },
    '&:hover fieldset': {
      borderColor: '#333',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#19abb5',
    },
  },
  '& .MuiInputAdornment-root': {
    color: '#666',
  },
});

const ViewToggle = styled(ToggleButtonGroup)({
  '& .MuiToggleButton-root': {
    padding: '4px 8px',
    color: '#666',
    border: '1px solid #333',
    '&.Mui-selected': {
      color: '#19abb5',
      backgroundColor: 'rgba(25, 171, 181, 0.08)',
    },
    '&:hover': {
      backgroundColor: 'rgba(25, 171, 181, 0.04)',
    },
  },
});

const SortSelect = styled(Select)({
  fontSize: 12,
  color: '#ccc',
  height: 32,
  minWidth: 140,
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#333',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#444',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#19abb5',
  },
  '& .MuiSelect-icon': {
    color: '#666',
  },
});

const ContentArea = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 20,
  '&::-webkit-scrollbar': {
    width: 8,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 4,
  },
});

const SessionsGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 16,
});

const SessionsList = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

const SessionCard = styled(Box)({
  backgroundColor: '#1e1e1e',
  borderRadius: 2,
  border: '1px solid #252525',
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    borderColor: '#19abb5',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
});

const SessionThumbnail = styled(Box)({
  height: 120,
  backgroundColor: '#0d0d0d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
});

const SessionInfo = styled(Box)({
  padding: 12,
});

const SessionName = styled(Typography)({
  fontSize: 13,
  fontWeight: 500,
  color: '#e1e1e1',
  marginBottom: 4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const SessionMeta = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  fontSize: 11,
  color: '#666',
});

const SessionStat = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const SessionListItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  backgroundColor: '#1e1e1e',
  borderRadius: 2,
  border: '1px solid #252525',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    borderColor: '#19abb5',
    backgroundColor: '#242424',
  },
});

const EmptyState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 40,
  textAlign: 'center',
});

const BottomBar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 12,
  padding: '12px 20px',
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #252525',
});

const PrimaryButton = styled(Button)({
  backgroundColor: '#19abb5',
  color: '#fff',
  fontSize: 12,
  padding: '6px 16px',
  '&:hover': {
    backgroundColor: '#147a82',
  },
});

const SecondaryButton = styled(Button)({
  color: '#ccc',
  borderColor: '#333',
  fontSize: 12,
  padding: '6px 16px',
  '&:hover': {
    borderColor: '#19abb5',
    color: '#19abb5',
  },
});

const Logo = styled('img')({
  width: 120,
  opacity: 0.3,
  marginBottom: 24,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function getStorageIcon(type: string): React.ReactNode {
  switch (type) {
    case 'local':
      return <FolderIcon sx={{ fontSize: 18 }} />;
    case 'google-drive':
    case 'dropbox':
    case 'onedrive':
      return <CloudIcon sx={{ fontSize: 18 }} />;
    default:
      return <FolderIcon sx={{ fontSize: 18 }} />;
  }
}

function getFileType(fileName: string): 'video' | 'audio' | 'image' | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'];

  if (videoExts.includes(ext || '')) return 'video';
  if (audioExts.includes(ext || '')) return 'audio';
  if (imageExts.includes(ext || '')) return 'image';
  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const HomePage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);

  // Store state
  const {
    storageLocations,
    activeStorageId,
    viewMode,
    sortBy,
    searchQuery,
    storagePanelCollapsed,
    setActiveStorage,
    setViewMode,
    setSortBy,
    setSearchQuery,
    setStoragePanelCollapsed,
    setQuickAnalyzeFile,
    getFilteredProjects,
    addProject,
  } = useHomeStore();

  const navigateToTool = useNavigationStore((state) => state.navigateToTool);
  const setActiveTool = useNavigationStore((state) => state.setActiveTool);
  const { setActiveSession } = useAppPersistence();

  // Get filtered projects
  const projects = useMemo(() => getFilteredProjects(), [getFilteredProjects, activeStorageId, searchQuery, sortBy]);

  // Handlers
  const handleStorageClick = useCallback((storageId: string) => {
    setActiveStorage(activeStorageId === storageId ? null : storageId);
  }, [activeStorageId, setActiveStorage]);

  const handleConnectStorage = useCallback((storage: StorageLocation) => {
    // TODO: Implement OAuth flow for cloud storage
    console.log('Connect storage:', storage.type);
  }, []);

  const handleProjectClick = useCallback((project: Project) => {
    setActiveSession(project.id);
    setActiveTool('session');
  }, [setActiveSession, setActiveTool]);

  const handleNewProject = useCallback(() => {
    setNewProjectDialogOpen(true);
  }, []);

  const handleCreateProject = useCallback((projectData: NewProjectData) => {
    // Map storage type to storage ID for the store
    const storageIdMap: Record<string, string> = {
      local: 'local',
      google_drive: 'google-drive',
      dropbox: 'dropbox',
      onedrive: 'onedrive',
    };

    // Create project object matching the store's Project interface
    const newProject: Project = {
      id: projectData.id,
      name: projectData.name,
      path: `/${projectData.storageType}/projects/${projectData.name.toLowerCase().replace(/\s+/g, '_')}`,
      storageId: storageIdMap[projectData.storageType] || 'local',
      storageType: projectData.storageType,
      location: projectData.location || undefined,
      thumbnail: undefined,
      evidenceCount: 0,
      flagCount: 0,
      createdAt: projectData.createdAt,
      modifiedAt: projectData.modifiedAt,
      evidence: [],
      flags: [],
      notes: [],
    };

    // Add to store
    addProject(newProject);

    // Set as active project and navigate to session timeline
    setActiveSession(newProject.id);
    setActiveTool('session');
  }, [addProject, setActiveSession, setActiveTool]);

  const handleNewFolder = useCallback(() => {
    // TODO: Implement new folder creation
    console.log('Create new folder');
  }, []);

  const handleImportProject = useCallback(() => {
    // TODO: Implement project import
    console.log('Import project');
  }, []);

  const handleQuickAnalyze = useCallback((file: File) => {
    const fileType = getFileType(file.name);
    if (!fileType) {
      alert('Unsupported file type. Please use video, audio, or image files.');
      return;
    }

    const url = URL.createObjectURL(file);
    setQuickAnalyzeFile({ name: file.name, type: fileType, url });

    // Navigate to appropriate tool
    const toolMap: Record<string, 'video' | 'audio' | 'images'> = {
      video: 'video',
      audio: 'audio',
      image: 'images',
    };
    navigateToTool(toolMap[fileType]);
  }, [setQuickAnalyzeFile, navigateToTool]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const mediaFile = files.find((f) => getFileType(f.name) !== null);

    if (mediaFile) {
      handleQuickAnalyze(mediaFile);
    }
  }, [handleQuickAnalyze]);

  const handleBrowseClick = useCallback((e?: React.MouseEvent) => {
    // Open the file picker
    fileInputRef.current?.click();
    // Stop propagation to prevent parent handlers from triggering (e.g., fullscreen exit)
    e?.stopPropagation();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleQuickAnalyze(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleQuickAnalyze]);

  // Render storage panel
  const renderStoragePanel = () => {
    if (storagePanelCollapsed) {
      return (
        <CollapsedPanel>
          <Tooltip title="Show storage panel" placement="right">
            <CollapseButton onClick={() => setStoragePanelCollapsed(false)} size="small">
              <ChevronRightIcon fontSize="small" />
            </CollapseButton>
          </Tooltip>
        </CollapsedPanel>
      );
    }

    return (
      <LeftPanel>
        {/* Storage Section */}
        <PanelHeader>
          <PanelTitle>Storage</PanelTitle>
          <Tooltip title="Hide panel">
            <CollapseButton onClick={() => setStoragePanelCollapsed(true)} size="small">
              <ChevronLeftIcon fontSize="small" />
            </CollapseButton>
          </Tooltip>
        </PanelHeader>

        <StorageList>
          {storageLocations.map((storage) => (
            <StorageItem
              key={storage.id}
              selected={activeStorageId === storage.id}
              onClick={() => storage.connected && handleStorageClick(storage.id)}
            >
              <StorageIcon type={storage.type}>
                {getStorageIcon(storage.type)}
              </StorageIcon>
              <StorageName>{storage.name}</StorageName>
              <StorageStatus connected={storage.connected}>
                {storage.connected ? (
                  <CheckIcon sx={{ fontSize: 14 }} />
                ) : (
                  <Button
                    size="small"
                    sx={{ fontSize: 10, padding: '2px 6px', minWidth: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnectStorage(storage);
                    }}
                  >
                    Connect
                  </Button>
                )}
              </StorageStatus>
            </StorageItem>
          ))}
        </StorageList>

        <AddStorageButton variant="outlined" size="small" startIcon={<AddIcon />}>
          Add Storage
        </AddStorageButton>

        <Divider sx={{ borderColor: '#252525' }} />

        {/* Quick Analyze Section */}
        <QuickAnalyzeSection>
          <PanelTitle sx={{ marginBottom: 1 }}>Quick Analyze</PanelTitle>
          <DropZone
            isDragging={isDragging}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            <CloudUploadIcon sx={{ fontSize: 32, color: isDragging ? '#19abb5' : '#444', mb: 1 }} />
            <Typography sx={{ fontSize: 11, color: '#666', mb: 1 }}>
              Drop a file to analyze
            </Typography>
            <Button
              variant="outlined"
              size="small"
              sx={{
                fontSize: 10,
                color: '#808080',
                borderColor: '#333',
                '&:hover': { borderColor: '#19abb5', color: '#19abb5' },
              }}
            >
              Browse File
            </Button>
          </DropZone>
          <Typography sx={{ fontSize: 9, color: '#555', mt: 1, textAlign: 'center' }}>
            Video, Audio, or Image files
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </QuickAnalyzeSection>
      </LeftPanel>
    );
  };

  // Render project card (grid view)
  const renderProjectCard = (project: Project) => (
    <SessionCard key={project.id} onClick={() => handleProjectClick(project)}>
      <SessionThumbnail>
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Box sx={{ display: 'flex', gap: 1, color: '#333' }}>
            <MovieIcon sx={{ fontSize: 24 }} />
            <MicIcon sx={{ fontSize: 24 }} />
            <PhotoIcon sx={{ fontSize: 24 }} />
          </Box>
        )}
      </SessionThumbnail>
      <SessionInfo>
        <SessionName>{project.name}</SessionName>
        <SessionMeta>
          <SessionStat>
            <Typography sx={{ fontSize: 11, color: '#666' }}>
              {project.evidenceCount} items
            </Typography>
          </SessionStat>
          <SessionStat>
            <FlagIcon sx={{ fontSize: 12, color: '#19abb5' }} />
            <Typography sx={{ fontSize: 11, color: '#666' }}>
              {project.flagCount}
            </Typography>
          </SessionStat>
          <Typography sx={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>
            {formatDate(project.modifiedAt)}
          </Typography>
        </SessionMeta>
      </SessionInfo>
    </SessionCard>
  );

  // Render project row (list view)
  const renderProjectListItem = (project: Project) => (
    <SessionListItem key={project.id} onClick={() => handleProjectClick(project)}>
      <Box sx={{ width: 40, height: 40, backgroundColor: '#0d0d0d', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FolderIcon sx={{ color: '#444' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <SessionName>{project.name}</SessionName>
        <Typography sx={{ fontSize: 10, color: '#555' }}>
          {project.evidenceCount} items · {project.flagCount} flags
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: '#555' }}>
        {formatDate(project.modifiedAt)}
      </Typography>
    </SessionListItem>
  );

  return (
    <PageContainer>
      {/* Left Panel - Storage & Quick Analyze */}
      {renderStoragePanel()}

      {/* Right Panel - Sessions */}
      <RightPanel>
        {/* Header */}
        <RightHeader>
          <SearchField
            placeholder="Search projects..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />

          <ViewToggle
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value as ViewMode)}
            size="small"
          >
            <ToggleButton value="grid">
              <Tooltip title="Grid view">
                <GridViewIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list">
              <Tooltip title="List view">
                <ViewListIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </ToggleButton>
          </ViewToggle>

          <SortSelect
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            size="small"
          >
            <MenuItem value="dateModified">Date Modified</MenuItem>
            <MenuItem value="dateCreated">Date Created</MenuItem>
            <MenuItem value="name">Name</MenuItem>
          </SortSelect>
        </RightHeader>

        {/* Content Area */}
        <ContentArea>
          {projects.length === 0 ? (
            <EmptyState>
              <Logo src="/tacctile_app_main_logo.png" alt="Tacctile" />
              <Typography sx={{ fontSize: 18, color: '#666', mb: 1, fontWeight: 500 }}>
                Create your first project
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#555', mb: 3, maxWidth: 300 }}>
                Projects help you organize your field investigation evidence - videos, audio recordings, and images.
              </Typography>
              <PrimaryButton onClick={handleNewProject} startIcon={<AddIcon />}>
                New Project
              </PrimaryButton>
            </EmptyState>
          ) : viewMode === 'grid' ? (
            <SessionsGrid>
              {projects.map(renderProjectCard)}
            </SessionsGrid>
          ) : (
            <SessionsList>
              {projects.map(renderProjectListItem)}
            </SessionsList>
          )}
        </ContentArea>

        {/* Bottom Bar */}
        <BottomBar>
          <SecondaryButton variant="outlined" startIcon={<FileUploadIcon />} onClick={handleImportProject}>
            Import Project
          </SecondaryButton>
          <SecondaryButton variant="outlined" startIcon={<CreateNewFolderIcon />} onClick={handleNewFolder}>
            New Folder
          </SecondaryButton>
          <PrimaryButton startIcon={<AddIcon />} onClick={handleNewProject}>
            New Project
          </PrimaryButton>
        </BottomBar>
      </RightPanel>

      {/* New Project Dialog */}
      <NewProjectDialog
        open={newProjectDialogOpen}
        storageLocations={storageLocations}
        onClose={() => setNewProjectDialogOpen(false)}
        onCreate={handleCreateProject}
      />
    </PageContainer>
  );
};

export default HomePage;
