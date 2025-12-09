/**
 * RecipePanel Component
 * Manage filter recipes (presets) and iterations
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
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';

// Icons
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HistoryIcon from '@mui/icons-material/History';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import type { FilterRecipe, AudioIteration } from '../../types/audio';

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

const StyledTabs = styled(Tabs)({
  minHeight: 36,
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
});

const RecipeItem = styled(ListItemButton)<{ selected?: boolean }>(({ selected }) => ({
  borderLeft: selected ? '3px solid #19abb5' : '3px solid transparent',
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.1)' : 'transparent',
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.15)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

const TagChip = styled(Chip)({
  height: 18,
  fontSize: 10,
  backgroundColor: '#333333',
  color: '#aaaaaa',
  '& .MuiChip-label': {
    padding: '0 6px',
  },
});

const PresetBadge = styled(Box)({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  fontSize: 10,
  color: '#ffc107',
  marginLeft: 8,
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface RecipePanelProps {
  /** Available recipes */
  recipes: FilterRecipe[];
  /** Audio iterations */
  iterations: AudioIteration[];
  /** Currently active iteration ID */
  activeIterationId: string | null;
  /** Callback when a recipe is applied */
  onApplyRecipe: (recipeId: string) => void;
  /** Callback to save current settings as recipe */
  onSaveRecipe: (name: string, description?: string, tags?: string[]) => void;
  /** Callback to delete a recipe */
  onDeleteRecipe: (id: string) => void;
  /** Callback to create a new iteration */
  onCreateIteration: (name: string, description?: string) => void;
  /** Callback to delete an iteration */
  onDeleteIteration: (id: string) => void;
  /** Callback to activate an iteration */
  onActivateIteration: (id: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const RecipePanel: React.FC<RecipePanelProps> = ({
  recipes,
  iterations,
  activeIterationId,
  onApplyRecipe,
  onSaveRecipe,
  onDeleteRecipe,
  onCreateIteration,
  onDeleteIteration,
  onActivateIteration,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [iterationDialogOpen, setIterationDialogOpen] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [recipeTags, setRecipeTags] = useState('');
  const [iterationName, setIterationName] = useState('');
  const [iterationDescription, setIterationDescription] = useState('');

  // Separate presets and user recipes
  const presets = recipes.filter((r) => r.isPreset);
  const userRecipes = recipes.filter((r) => !r.isPreset);

  const handleSaveRecipe = () => {
    if (recipeName.trim()) {
      const tags = recipeTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      onSaveRecipe(recipeName.trim(), recipeDescription.trim() || undefined, tags);
      setSaveDialogOpen(false);
      setRecipeName('');
      setRecipeDescription('');
      setRecipeTags('');
    }
  };

  const handleCreateIteration = () => {
    if (iterationName.trim()) {
      onCreateIteration(iterationName.trim(), iterationDescription.trim() || undefined);
      setIterationDialogOpen(false);
      setIterationName('');
      setIterationDescription('');
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <AutoFixHighIcon sx={{ color: '#19abb5', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Recipes & Iterations
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <StyledTabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
        <StyledTab icon={<StarIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Presets" />
        <StyledTab icon={<SaveIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="My Recipes" />
        <StyledTab icon={<HistoryIcon sx={{ fontSize: 14 }} />} iconPosition="start" label="Iterations" />
      </StyledTabs>

      <Divider sx={{ borderColor: '#2b2b2b' }} />

      {/* Content */}
      {activeTab === 0 && (
        <RecipeList>
          {presets.map((recipe) => (
            <RecipeItem key={recipe.id} onClick={() => onApplyRecipe(recipe.id)}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PlayArrowIcon sx={{ color: '#19abb5', fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2">{recipe.name}</Typography>
                    <PresetBadge>
                      <StarIcon sx={{ fontSize: 12 }} />
                      Preset
                    </PresetBadge>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    {recipe.description && (
                      <Typography variant="caption" sx={{ color: '#888888', display: 'block' }}>
                        {recipe.description}
                      </Typography>
                    )}
                    {recipe.tags.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {recipe.tags.map((tag) => (
                          <TagChip key={tag} label={tag} size="small" />
                        ))}
                      </Box>
                    )}
                  </Box>
                }
              />
            </RecipeItem>
          ))}
        </RecipeList>
      )}

      {activeTab === 1 && (
        <>
          <Box sx={{ p: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setSaveDialogOpen(true)}
              sx={{
                width: '100%',
                borderColor: '#19abb5',
                color: '#19abb5',
                '&:hover': {
                  borderColor: '#36d1da',
                  backgroundColor: 'rgba(25, 171, 181, 0.1)',
                },
              }}
            >
              Save Current Settings
            </Button>
          </Box>
          <RecipeList>
            {userRecipes.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666666' }}>
                  No saved recipes yet
                </Typography>
                <Typography variant="caption" sx={{ color: '#555555' }}>
                  Save your filter settings for quick access
                </Typography>
              </Box>
            ) : (
              userRecipes.map((recipe) => (
                <RecipeItem key={recipe.id} onClick={() => onApplyRecipe(recipe.id)}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <PlayArrowIcon sx={{ color: '#19abb5', fontSize: 18 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2">{recipe.name}</Typography>}
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        {recipe.description && (
                          <Typography variant="caption" sx={{ color: '#888888', display: 'block' }}>
                            {recipe.description}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: '#555555', display: 'block' }}>
                          {formatDate(recipe.updatedAt)}
                        </Typography>
                        {recipe.tags.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            {recipe.tags.map((tag) => (
                              <TagChip key={tag} label={tag} size="small" />
                            ))}
                          </Box>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Delete recipe">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecipe(recipe.id);
                        }}
                        sx={{ color: '#666666', '&:hover': { color: '#ff5722' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </RecipeItem>
              ))
            )}
          </RecipeList>
        </>
      )}

      {activeTab === 2 && (
        <>
          <Box sx={{ p: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setIterationDialogOpen(true)}
              sx={{
                width: '100%',
                borderColor: '#19abb5',
                color: '#19abb5',
                '&:hover': {
                  borderColor: '#36d1da',
                  backgroundColor: 'rgba(25, 171, 181, 0.1)',
                },
              }}
            >
              Create New Iteration
            </Button>
          </Box>
          <RecipeList>
            {iterations.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666666' }}>
                  No iterations yet
                </Typography>
                <Typography variant="caption" sx={{ color: '#555555' }}>
                  Create iterations to save different processing versions
                </Typography>
              </Box>
            ) : (
              iterations.map((iteration) => (
                <RecipeItem
                  key={iteration.id}
                  selected={iteration.id === activeIterationId}
                  onClick={() => onActivateIteration(iteration.id)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {iteration.active ? (
                      <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 18 }} />
                    ) : (
                      <HistoryIcon sx={{ color: '#666666', fontSize: 18 }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">{iteration.name}</Typography>
                        {iteration.active && (
                          <Chip
                            label="Active"
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: 10,
                              backgroundColor: '#4caf50',
                              color: '#ffffff',
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        {iteration.description && (
                          <Typography variant="caption" sx={{ color: '#888888', display: 'block' }}>
                            {iteration.description}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: '#555555' }}>
                          {formatDate(iteration.createdAt)}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Delete iteration">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteIteration(iteration.id);
                        }}
                        sx={{ color: '#666666', '&:hover': { color: '#ff5722' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </RecipeItem>
              ))
            )}
          </RecipeList>
        </>
      )}

      {/* Save Recipe Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save Recipe</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Recipe Name"
            fullWidth
            variant="outlined"
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            variant="outlined"
            multiline
            rows={2}
            value={recipeDescription}
            onChange={(e) => setRecipeDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Tags (comma-separated)"
            fullWidth
            variant="outlined"
            placeholder="audio, voice, cleanup"
            value={recipeTags}
            onChange={(e) => setRecipeTags(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveRecipe} variant="contained" disabled={!recipeName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Iteration Dialog */}
      <Dialog open={iterationDialogOpen} onClose={() => setIterationDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Iteration</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Iteration Name"
            fullWidth
            variant="outlined"
            value={iterationName}
            onChange={(e) => setIterationName(e.target.value)}
            placeholder="e.g., Voice Enhancement v1"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            variant="outlined"
            multiline
            rows={2}
            value={iterationDescription}
            onChange={(e) => setIterationDescription(e.target.value)}
            placeholder="Notes about this processing version"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIterationDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateIteration} variant="contained" disabled={!iterationName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </PanelContainer>
  );
};

export default RecipePanel;
