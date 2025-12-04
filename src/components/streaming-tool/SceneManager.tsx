/**
 * SceneManager Component
 * Manages scenes and their ordering
 */

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MovieIcon from '@mui/icons-material/Movie';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';

import type { Scene } from '../../types/streaming';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

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
  padding: '10px 12px',
  borderBottom: '1px solid #2b2b2b',
});

const Title = styled(Typography)({
  fontSize: 13,
  fontWeight: 600,
  color: '#e1e1e1',
  textTransform: 'uppercase',
  letterSpacing: 1,
});

const SceneList = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 8,
});

const SceneItem = styled(Box)<{ active?: boolean; preview?: boolean }>(({ active, preview }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '10px 12px',
  marginBottom: 4,
  borderRadius: 6,
  cursor: 'pointer',
  backgroundColor: active
    ? 'rgba(244, 67, 54, 0.15)'
    : preview
    ? 'rgba(25, 171, 181, 0.15)'
    : 'transparent',
  border: `1px solid ${active ? '#f44336' : preview ? '#19abb5' : 'transparent'}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: active
      ? 'rgba(244, 67, 54, 0.2)'
      : preview
      ? 'rgba(25, 171, 181, 0.2)'
      : 'rgba(255, 255, 255, 0.05)',
  },
}));

const SceneThumbnail = styled(Box)({
  width: 64,
  height: 36,
  borderRadius: 4,
  backgroundColor: '#0a0a0a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
  overflow: 'hidden',
  border: '1px solid #333333',
});

const SceneInfo = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const SceneName = styled(Typography)({
  fontSize: 14,
  fontWeight: 500,
  color: '#e1e1e1',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const SceneStatus = styled(Typography)<{ active?: boolean; preview?: boolean }>(
  ({ active, preview }) => ({
    fontSize: 11,
    color: active ? '#f44336' : preview ? '#19abb5' : '#666666',
    fontWeight: active || preview ? 600 : 400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  })
);

const SceneActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  opacity: 0,
  transition: 'opacity 0.2s ease',
  '.MuiBox-root:hover > &': {
    opacity: 1,
  },
});

const AddButton = styled(IconButton)({
  backgroundColor: '#252525',
  '&:hover': {
    backgroundColor: '#333333',
  },
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface SceneManagerProps {
  scenes: Scene[];
  activeSceneId: string | null;
  previewSceneId: string | null;
  onCreateScene: (name: string) => string;
  onDeleteScene: (sceneId: string) => void;
  onDuplicateScene: (sceneId: string) => string;
  onRenameScene: (sceneId: string, name: string) => void;
  onSelectScene: (sceneId: string) => void;
  onActivateScene: (sceneId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const SceneManager: React.FC<SceneManagerProps> = ({
  scenes,
  activeSceneId,
  previewSceneId,
  onCreateScene,
  onDeleteScene,
  onDuplicateScene,
  onRenameScene,
  onSelectScene,
  onActivateScene,
}) => {
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuSceneId, setMenuSceneId] = useState<string | null>(null);

  const handleAddScene = useCallback(() => {
    const name = `Scene ${scenes.length + 1}`;
    onCreateScene(name);
  }, [scenes.length, onCreateScene]);

  const handleStartRename = useCallback((scene: Scene) => {
    setEditingSceneId(scene.id);
    setEditName(scene.name);
    setMenuAnchor(null);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (editingSceneId && editName.trim()) {
      onRenameScene(editingSceneId, editName.trim());
    }
    setEditingSceneId(null);
    setEditName('');
  }, [editingSceneId, editName, onRenameScene]);

  const handleOpenMenu = useCallback((e: React.MouseEvent<HTMLElement>, sceneId: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuSceneId(sceneId);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
    setMenuSceneId(null);
  }, []);

  const handleDuplicate = useCallback(() => {
    if (menuSceneId) {
      onDuplicateScene(menuSceneId);
    }
    handleCloseMenu();
  }, [menuSceneId, onDuplicateScene, handleCloseMenu]);

  const handleDelete = useCallback(() => {
    if (menuSceneId && scenes.length > 1) {
      onDeleteScene(menuSceneId);
    }
    handleCloseMenu();
  }, [menuSceneId, scenes.length, onDeleteScene, handleCloseMenu]);

  const handleDoubleClick = useCallback(
    (sceneId: string) => {
      onActivateScene(sceneId);
    },
    [onActivateScene]
  );

  return (
    <Container>
      <Header>
        <Title>Scenes</Title>
        <Tooltip title="Add Scene">
          <AddButton size="small" onClick={handleAddScene}>
            <AddIcon sx={{ fontSize: 18 }} />
          </AddButton>
        </Tooltip>
      </Header>

      <SceneList>
        {scenes.map((scene) => {
          const isActive = scene.id === activeSceneId;
          const isPreview = scene.id === previewSceneId && !isActive;

          return (
            <SceneItem
              key={scene.id}
              active={isActive}
              preview={isPreview}
              onClick={() => onSelectScene(scene.id)}
              onDoubleClick={() => handleDoubleClick(scene.id)}
            >
              <SceneThumbnail>
                {scene.thumbnail ? (
                  <img
                    src={scene.thumbnail}
                    alt={scene.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <MovieIcon sx={{ fontSize: 20, color: '#444444' }} />
                )}
              </SceneThumbnail>

              <SceneInfo>
                {editingSceneId === scene.id ? (
                  <TextField
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename();
                      if (e.key === 'Escape') {
                        setEditingSceneId(null);
                        setEditName('');
                      }
                    }}
                    autoFocus
                    size="small"
                    variant="standard"
                    sx={{
                      '& input': {
                        fontSize: 14,
                        color: '#e1e1e1',
                        padding: 0,
                      },
                    }}
                  />
                ) : (
                  <SceneName>{scene.name}</SceneName>
                )}
                <SceneStatus active={isActive} preview={isPreview}>
                  {isActive ? (
                    <>
                      <PlayArrowIcon sx={{ fontSize: 12, mr: 0.5 }} />
                      Live
                    </>
                  ) : isPreview ? (
                    <>
                      <VisibilityIcon sx={{ fontSize: 12, mr: 0.5 }} />
                      Preview
                    </>
                  ) : (
                    `${scene.sources.length} sources`
                  )}
                </SceneStatus>
              </SceneInfo>

              <SceneActions>
                <IconButton
                  size="small"
                  onClick={(e) => handleOpenMenu(e, scene.id)}
                  sx={{ color: '#888888' }}
                >
                  <MoreVertIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </SceneActions>
            </SceneItem>
          );
        })}
      </SceneList>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            border: '1px solid #333333',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            const scene = scenes.find((s) => s.id === menuSceneId);
            if (scene) handleStartRename(scene);
          }}
        >
          <ListItemIcon>
            <EditIcon sx={{ fontSize: 18, color: '#888888' }} />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon>
            <ContentCopyIcon sx={{ fontSize: 18, color: '#888888' }} />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} disabled={scenes.length <= 1}>
          <ListItemIcon>
            <DeleteIcon sx={{ fontSize: 18, color: scenes.length <= 1 ? '#555555' : '#f44336' }} />
          </ListItemIcon>
          <ListItemText sx={{ color: scenes.length <= 1 ? '#555555' : '#f44336' }}>
            Delete
          </ListItemText>
        </MenuItem>
      </Menu>
    </Container>
  );
};

export default SceneManager;
