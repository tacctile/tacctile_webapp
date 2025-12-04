/**
 * RecipePanel Component
 * Manages edit recipes and user edit snapshots for image tool
 */

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';

// Icons
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FilterIcon from '@mui/icons-material/Filter';
import AddIcon from '@mui/icons-material/Add';

import type { ImageEditRecipe, UserEditSnapshot } from '../../types/image';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PanelContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: '#141414',
});

const StyledTabs = styled(Tabs)({
  minHeight: 36,
  borderBottom: '1px solid #2b2b2b',
  '& .MuiTabs-indicator': {
    backgroundColor: '#19abb5',
  },
});

const StyledTab = styled(Tab)({
  minHeight: 36,
  fontSize: 12,
  textTransform: 'none',
  color: '#888888',
  '&.Mui-selected': {
    color: '#19abb5',
  },
});

const RecipeList = styled(List)({
  flex: 1,
  overflow: 'auto',
  padding: 0,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#404040',
    borderRadius: 3,
  },
});

const RecipeItem = styled(ListItem)<{ active?: boolean }>(({ active }) => ({
  backgroundColor: active ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
  borderLeft: active ? '3px solid #19abb5' : '3px solid transparent',
  paddingLeft: 8,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: active ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

const CategoryChip = styled(Chip)({
  height: 18,
  fontSize: 10,
  '& .MuiChip-label': {
    padding: '0 6px',
  },
});

const UserEditItem = styled(ListItem)<{ active?: boolean; usercolor?: string }>(({ active, usercolor }) => ({
  backgroundColor: active ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
  borderLeft: `3px solid ${active ? '#19abb5' : usercolor || 'transparent'}`,
  paddingLeft: 8,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: active ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

const SaveButton = styled(Button)({
  backgroundColor: '#19abb5',
  color: '#ffffff',
  textTransform: 'none',
  fontSize: 12,
  '&:hover': {
    backgroundColor: '#36d1da',
  },
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface RecipePanelProps {
  recipes: ImageEditRecipe[];
  userEdits: UserEditSnapshot[];
  activeRecipeId: string | null;
  activeUserEditId: string | null;
  onApplyRecipe: (recipeId: string) => void;
  onSaveRecipe: (name: string, description?: string, tags?: string[]) => void;
  onDeleteRecipe: (id: string) => void;
  onSaveUserEdit: (name: string) => void;
  onLoadUserEdit: (editId: string) => void;
  onDeleteUserEdit: (id: string) => void;
  onCompareSelect: (editId: string, slot: 0 | 1) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const RecipePanel: React.FC<RecipePanelProps> = ({
  recipes,
  userEdits,
  activeRecipeId,
  activeUserEditId,
  onApplyRecipe,
  onSaveRecipe,
  onDeleteRecipe,
  onSaveUserEdit,
  onLoadUserEdit,
  onDeleteUserEdit,
  onCompareSelect,
}) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogType, setSaveDialogType] = useState<'recipe' | 'edit'>('recipe');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const presetRecipes = recipes.filter((r) => r.isPreset);
  const customRecipes = recipes.filter((r) => !r.isPreset);

  const handleTabChange = useCallback((_: React.SyntheticEvent, value: number) => {
    setTabIndex(value);
  }, []);

  const handleOpenSaveDialog = useCallback((type: 'recipe' | 'edit') => {
    setSaveDialogType(type);
    setNewName('');
    setNewDescription('');
    setSaveDialogOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!newName.trim()) return;

    if (saveDialogType === 'recipe') {
      onSaveRecipe(newName.trim(), newDescription.trim() || undefined);
    } else {
      onSaveUserEdit(newName.trim());
    }
    setSaveDialogOpen(false);
  }, [saveDialogType, newName, newDescription, onSaveRecipe, onSaveUserEdit]);

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      enhancement: '#4caf50',
      forensic: '#ff9800',
      'b&w': '#9e9e9e',
      vintage: '#795548',
      cinematic: '#673ab7',
      color: '#2196f3',
      custom: '#19abb5',
    };
    return colors[category] || '#666666';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <PanelContainer>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderBottom: '1px solid #2b2b2b' }}>
        <Typography variant="subtitle1" sx={{ color: '#e1e1e1', fontWeight: 600, fontSize: 14 }}>
          Recipes & Edits
        </Typography>
      </Box>

      {/* Tabs */}
      <StyledTabs value={tabIndex} onChange={handleTabChange}>
        <StyledTab icon={<FilterIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Presets" />
        <StyledTab icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Custom" />
        <StyledTab icon={<PersonIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="User Edits" />
      </StyledTabs>

      {/* Presets Tab */}
      {tabIndex === 0 && (
        <RecipeList>
          {presetRecipes.map((recipe) => (
            <RecipeItem
              key={recipe.id}
              active={activeRecipeId === recipe.id}
              onClick={() => onApplyRecipe(recipe.id)}
              dense
            >
              <ListItemText
                primary={recipe.name}
                secondary={
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                    {recipe.tags.map((tag) => (
                      <CategoryChip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{ backgroundColor: getCategoryColor(tag), color: '#fff' }}
                      />
                    ))}
                  </Box>
                }
                primaryTypographyProps={{
                  variant: 'body2',
                  sx: { color: '#e1e1e1', fontSize: 12 },
                }}
              />
              <ListItemSecondaryAction>
                <Tooltip title="Apply">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onApplyRecipe(recipe.id);
                    }}
                    sx={{ color: '#666666', '&:hover': { color: '#19abb5' } }}
                  >
                    <PlayArrowIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </RecipeItem>
          ))}
        </RecipeList>
      )}

      {/* Custom Recipes Tab */}
      {tabIndex === 1 && (
        <>
          <Box sx={{ p: 1 }}>
            <SaveButton
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => handleOpenSaveDialog('recipe')}
              size="small"
            >
              Save Current as Recipe
            </SaveButton>
          </Box>
          <Divider sx={{ borderColor: '#2b2b2b' }} />
          <RecipeList>
            {customRecipes.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#666666' }}>
                  No custom recipes yet. Save your current adjustments as a recipe to reuse them later.
                </Typography>
              </Box>
            ) : (
              customRecipes.map((recipe) => (
                <RecipeItem
                  key={recipe.id}
                  active={activeRecipeId === recipe.id}
                  onClick={() => onApplyRecipe(recipe.id)}
                  dense
                >
                  <ListItemText
                    primary={recipe.name}
                    secondary={recipe.description || formatDate(recipe.createdAt)}
                    primaryTypographyProps={{
                      variant: 'body2',
                      sx: { color: '#e1e1e1', fontSize: 12 },
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      sx: { color: '#666666', fontSize: 10 },
                    }}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Apply">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyRecipe(recipe.id);
                        }}
                        sx={{ color: '#666666', '&:hover': { color: '#19abb5' } }}
                      >
                        <PlayArrowIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecipe(recipe.id);
                        }}
                        sx={{ color: '#666666', '&:hover': { color: '#ff5722' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </RecipeItem>
              ))
            )}
          </RecipeList>
        </>
      )}

      {/* User Edits Tab */}
      {tabIndex === 2 && (
        <>
          <Box sx={{ p: 1 }}>
            <SaveButton
              fullWidth
              startIcon={<SaveIcon />}
              onClick={() => handleOpenSaveDialog('edit')}
              size="small"
            >
              Save Current Edit
            </SaveButton>
          </Box>
          <Divider sx={{ borderColor: '#2b2b2b' }} />
          <RecipeList>
            {userEdits.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#666666' }}>
                  No user edits saved. Save your edits to compare with others or toggle between different versions.
                </Typography>
              </Box>
            ) : (
              userEdits.map((edit) => (
                <UserEditItem
                  key={edit.id}
                  active={activeUserEditId === edit.id}
                  usercolor={edit.color}
                  onClick={() => onLoadUserEdit(edit.id)}
                  dense
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar
                      src={edit.userPhotoURL}
                      sx={{
                        width: 28,
                        height: 28,
                        backgroundColor: edit.color,
                        fontSize: 12,
                      }}
                    >
                      {edit.userDisplayName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={edit.recipeName}
                    secondary={`${edit.userDisplayName} - ${formatDate(edit.createdAt)}`}
                    primaryTypographyProps={{
                      variant: 'body2',
                      sx: { color: '#e1e1e1', fontSize: 12 },
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      sx: { color: '#666666', fontSize: 10 },
                    }}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Compare (A)">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompareSelect(edit.id, 0);
                        }}
                        sx={{ color: '#666666', '&:hover': { color: '#19abb5' } }}
                      >
                        <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 'bold' }}>A</Typography>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Compare (B)">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompareSelect(edit.id, 1);
                        }}
                        sx={{ color: '#666666', '&:hover': { color: '#19abb5' } }}
                      >
                        <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 'bold' }}>B</Typography>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteUserEdit(edit.id);
                        }}
                        sx={{ color: '#666666', '&:hover': { color: '#ff5722' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </UserEditItem>
              ))
            )}
          </RecipeList>
        </>
      )}

      {/* Save Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            color: '#e1e1e1',
            minWidth: 300,
          },
        }}
      >
        <DialogTitle sx={{ fontSize: 16 }}>
          {saveDialogType === 'recipe' ? 'Save Recipe' : 'Save Edit'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{
              '& .MuiInputBase-root': {
                backgroundColor: '#252525',
              },
              '& .MuiInputLabel-root': {
                color: '#888888',
              },
              '& .MuiInputBase-input': {
                color: '#e1e1e1',
              },
            }}
          />
          {saveDialogType === 'recipe' && (
            <TextField
              margin="dense"
              label="Description (optional)"
              fullWidth
              multiline
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              sx={{
                '& .MuiInputBase-root': {
                  backgroundColor: '#252525',
                },
                '& .MuiInputLabel-root': {
                  color: '#888888',
                },
                '& .MuiInputBase-input': {
                  color: '#e1e1e1',
                },
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)} sx={{ color: '#888888' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!newName.trim()}
            sx={{ color: '#19abb5' }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PanelContainer>
  );
};

export default RecipePanel;
