/**
 * ImageTool Component
 * Main container for the Adobe Lightroom-inspired image editing tool
 */

import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';

// Icons
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import Crop169Icon from '@mui/icons-material/Crop169';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import CompareIcon from '@mui/icons-material/Compare';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ImageIcon from '@mui/icons-material/Image';
import PanToolIcon from '@mui/icons-material/PanTool';
import TuneIcon from '@mui/icons-material/Tune';
import GestureIcon from '@mui/icons-material/Gesture';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import FlipIcon from '@mui/icons-material/Flip';
import Rotate90DegreesCcwIcon from '@mui/icons-material/Rotate90DegreesCcw';
import SettingsIcon from '@mui/icons-material/Settings';

// Components
import ImageCanvasComponent from './ImageCanvas';
import AdjustmentsPanel from './AdjustmentsPanel';
import AnnotationsPanel from './AnnotationsPanel';
import RecipePanel from './RecipePanel';
import CompareView from './CompareView';

// Store
import {
  useImageToolStore,
  selectImageUrl,
  selectImageViewMode,
  selectImageAdjustments,
  selectImageCrop,
  selectImageAnnotations,
  selectImageRecipes,
  selectUserEdits,
  selectActiveUserEdit,
  selectImageZoom,
  selectImageActiveTool,
  selectSelectedAnnotation,
} from '../../stores/useImageToolStore';
import type { ImageViewMode, CompareMode, ImageToolType, ImageAnnotation } from '../../types/image';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const ToolContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#121212',
  color: '#e1e1e1',
  overflow: 'hidden',
});

const Toolbar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  gap: 8,
  flexWrap: 'wrap',
});

const ToolbarGroup = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const ToolbarDivider = styled(Divider)({
  height: 24,
  borderColor: '#2b2b2b',
  margin: '0 8px',
});

const MainContent = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const CanvasArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const SidePanel = styled(Box)({
  width: 280,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#141414',
  borderLeft: '1px solid #2b2b2b',
  overflow: 'hidden',
});

const SidePanelSection = styled(Box)({
  flex: 1,
  overflow: 'hidden',
  borderBottom: '1px solid #2b2b2b',
  '&:last-child': {
    borderBottom: 'none',
  },
});

const StyledToggleButton = styled(ToggleButton)({
  border: 'none',
  padding: '4px 8px',
  color: '#888888',
  '&.Mui-selected': {
    backgroundColor: 'rgba(25, 171, 181, 0.2)',
    color: '#19abb5',
    '&:hover': {
      backgroundColor: 'rgba(25, 171, 181, 0.3)',
    },
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const ToolButton = styled(IconButton)<{ active?: boolean }>(({ active }) => ({
  backgroundColor: active ? 'rgba(25, 171, 181, 0.2)' : 'transparent',
  color: active ? '#19abb5' : '#888888',
  '&:hover': {
    backgroundColor: active ? 'rgba(25, 171, 181, 0.3)' : 'rgba(255, 255, 255, 0.1)',
  },
}));

const StatusBar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 12px',
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #2b2b2b',
  fontSize: 11,
  color: '#888888',
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface ImageToolProps {
  evidenceId?: string;
  investigationId?: string;
  imageUrl?: string;
  onImageLoaded?: (dimensions: { width: number; height: number }) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ImageTool: React.FC<ImageToolProps> = ({
  evidenceId,
  investigationId,
  imageUrl,
  onImageLoaded,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  // Store state - use selectors for stable references
  const imageElement = useImageToolStore((state) => state.imageElement);
  const originalDimensions = useImageToolStore((state) => state.originalDimensions);
  const viewMode = useImageToolStore(selectImageViewMode);
  const compareMode = useImageToolStore((state) => state.compareMode);
  const compareEditIds = useImageToolStore((state) => state.compareEditIds);
  const zoom = useImageToolStore(selectImageZoom);
  const panX = useImageToolStore((state) => state.panX);
  const panY = useImageToolStore((state) => state.panY);
  const fitToView = useImageToolStore((state) => state.fitToView);
  const activeTool = useImageToolStore(selectImageActiveTool);
  const adjustments = useImageToolStore(selectImageAdjustments);
  const crop = useImageToolStore(selectImageCrop);
  const activeFilterId = useImageToolStore((state) => state.activeFilterId);
  const annotations = useImageToolStore(selectImageAnnotations);
  const selectedAnnotationId = useImageToolStore(selectSelectedAnnotation);
  const annotationDefaults = useImageToolStore((state) => state.annotationDefaults);
  const recipes = useImageToolStore(selectImageRecipes);
  const userEdits = useImageToolStore(selectUserEdits);
  const activeUserEditId = useImageToolStore(selectActiveUserEdit);
  const showAdjustmentsPanel = useImageToolStore((state) => state.showAdjustmentsPanel);
  const showAnnotationsPanel = useImageToolStore((state) => state.showAnnotationsPanel);
  const showRecipesPanel = useImageToolStore((state) => state.showRecipesPanel);
  const currentImageUrl = useImageToolStore(selectImageUrl);

  // Store actions - extract stable references
  const loadImage = useImageToolStore((state) => state.loadImage);
  const setImageElement = useImageToolStore((state) => state.setImageElement);
  const setViewMode = useImageToolStore((state) => state.setViewMode);
  const setCompareMode = useImageToolStore((state) => state.setCompareMode);
  const setCompareEdits = useImageToolStore((state) => state.setCompareEdits);
  const zoomIn = useImageToolStore((state) => state.zoomIn);
  const zoomOut = useImageToolStore((state) => state.zoomOut);
  const setPan = useImageToolStore((state) => state.setPan);
  const doFitToView = useImageToolStore((state) => state.doFitToView);
  const setActiveTool = useImageToolStore((state) => state.setActiveTool);
  const setAdjustment = useImageToolStore((state) => state.setAdjustment);
  const resetAdjustments = useImageToolStore((state) => state.resetAdjustments);
  const resetAdjustment = useImageToolStore((state) => state.resetAdjustment);
  const setCrop = useImageToolStore((state) => state.setCrop);
  const addAnnotation = useImageToolStore((state) => state.addAnnotation);
  const updateAnnotation = useImageToolStore((state) => state.updateAnnotation);
  const deleteAnnotation = useImageToolStore((state) => state.deleteAnnotation);
  const selectAnnotation = useImageToolStore((state) => state.selectAnnotation);
  const setAnnotationVisibility = useImageToolStore((state) => state.setAnnotationVisibility);
  const setAnnotationDefaults = useImageToolStore((state) => state.setAnnotationDefaults);
  const clearAnnotations = useImageToolStore((state) => state.clearAnnotations);
  const bringAnnotationToFront = useImageToolStore((state) => state.bringAnnotationToFront);
  const sendAnnotationToBack = useImageToolStore((state) => state.sendAnnotationToBack);
  const undo = useImageToolStore((state) => state.undo);
  const redo = useImageToolStore((state) => state.redo);
  const canUndo = useImageToolStore((state) => state.canUndo);
  const canRedo = useImageToolStore((state) => state.canRedo);
  const saveRecipe = useImageToolStore((state) => state.saveRecipe);
  const applyRecipe = useImageToolStore((state) => state.applyRecipe);
  const deleteRecipe = useImageToolStore((state) => state.deleteRecipe);
  const saveUserEdit = useImageToolStore((state) => state.saveUserEdit);
  const loadUserEdit = useImageToolStore((state) => state.loadUserEdit);
  const deleteUserEdit = useImageToolStore((state) => state.deleteUserEdit);
  const togglePanel = useImageToolStore((state) => state.togglePanel);

  // Load image - only if URL changed to prevent redundant calls
  useEffect(() => {
    if (imageUrl && evidenceId && investigationId && imageUrl !== currentImageUrl) {
      loadImage(evidenceId, investigationId, imageUrl);
    }
  }, [imageUrl, evidenceId, investigationId, currentImageUrl, loadImage]);

  // Notify parent when image loads
  useEffect(() => {
    if (originalDimensions && onImageLoaded) {
      onImageLoaded(originalDimensions);
    }
  }, [originalDimensions, onImageLoaded]);

  // Handlers
  const handleViewModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMode: ImageViewMode | null) => {
      if (newMode) {
        setViewMode(newMode);
      }
    },
    [setViewMode]
  );

  const handleCompareModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMode: CompareMode | null) => {
      if (newMode) {
        setCompareMode(newMode);
      }
    },
    [setCompareMode]
  );

  const handleToolChange = useCallback(
    (tool: ImageToolType) => {
      setActiveTool(tool);
    },
    [setActiveTool]
  );

  const handleImageLoad = useCallback(
    (element: HTMLImageElement) => {
      setImageElement(element);
    },
    [setImageElement]
  );

  const handleAnnotationAdd = useCallback(
    (annotation: Omit<ImageAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => {
      addAnnotation({
        ...annotation,
        color: annotationDefaults.color,
        strokeWidth: annotationDefaults.strokeWidth,
        opacity: annotationDefaults.opacity,
      });
    },
    [addAnnotation, annotationDefaults]
  );

  const handleCompareSelect = useCallback(
    (editId: string, slot: 0 | 1) => {
      const newIds: [string | null, string | null] = [...compareEditIds];
      newIds[slot] = editId;
      setCompareEdits(newIds);
      if (viewMode !== 'compare') {
        setViewMode('compare');
      }
    },
    [compareEditIds, setCompareEdits, viewMode, setViewMode]
  );

  const handleFlipHorizontal = useCallback(() => {
    setCrop({ flipHorizontal: !crop.flipHorizontal });
  }, [crop.flipHorizontal, setCrop]);

  const handleFlipVertical = useCallback(() => {
    setCrop({ flipVertical: !crop.flipVertical });
  }, [crop.flipVertical, setCrop]);

  const handleRotate = useCallback(() => {
    setCrop({ rotation: (crop.rotation + 90) % 360 });
  }, [crop.rotation, setCrop]);

  return (
    <ToolContainer>
      {/* Toolbar */}
      <Toolbar>
        {/* View Mode */}
        <ToolbarGroup>
          <Typography variant="caption" sx={{ color: '#888888', mr: 1 }}>
            View:
          </Typography>
          <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
            <StyledToggleButton value="single">
              <Tooltip title="Single View">
                <ImageIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </StyledToggleButton>
            <StyledToggleButton value="compare">
              <Tooltip title="Compare View">
                <CompareIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </StyledToggleButton>
          </ToggleButtonGroup>
        </ToolbarGroup>

        {/* Compare Mode (shown when in compare view) */}
        {viewMode === 'compare' && (
          <>
            <ToolbarDivider orientation="vertical" flexItem />
            <ToolbarGroup>
              <ToggleButtonGroup value={compareMode} exclusive onChange={handleCompareModeChange} size="small">
                <StyledToggleButton value="before-after">
                  <Tooltip title="Before/After">
                    <ViewColumnIcon sx={{ fontSize: 18 }} />
                  </Tooltip>
                </StyledToggleButton>
                <StyledToggleButton value="side-by-side">
                  <Tooltip title="Side by Side">
                    <ViewStreamIcon sx={{ fontSize: 18, transform: 'rotate(90deg)' }} />
                  </Tooltip>
                </StyledToggleButton>
                <StyledToggleButton value="split-vertical">
                  <Tooltip title="Split Vertical">
                    <ViewColumnIcon sx={{ fontSize: 18 }} />
                  </Tooltip>
                </StyledToggleButton>
                <StyledToggleButton value="split-horizontal">
                  <Tooltip title="Split Horizontal">
                    <ViewStreamIcon sx={{ fontSize: 18 }} />
                  </Tooltip>
                </StyledToggleButton>
              </ToggleButtonGroup>
            </ToolbarGroup>
          </>
        )}

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Tools */}
        <ToolbarGroup>
          <Tooltip title="Pan Tool (P)">
            <ToolButton size="small" active={activeTool === 'pan'} onClick={() => handleToolChange('pan')}>
              <PanToolIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Crop Tool (C)">
            <ToolButton size="small" active={activeTool === 'crop'} onClick={() => handleToolChange('crop')}>
              <Crop169Icon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
        </ToolbarGroup>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Zoom */}
        <ToolbarGroup>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={zoomOut}>
              <ZoomOutIcon sx={{ fontSize: 18, color: '#888888' }} />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ color: '#888888', minWidth: 45, textAlign: 'center' }}>
            {Math.round(fitToView ? zoom : zoom)}%
          </Typography>
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={zoomIn}>
              <ZoomInIcon sx={{ fontSize: 18, color: '#888888' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit to View">
            <IconButton size="small" onClick={doFitToView}>
              <FitScreenIcon sx={{ fontSize: 18, color: fitToView ? '#19abb5' : '#888888' }} />
            </IconButton>
          </Tooltip>
        </ToolbarGroup>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Transform */}
        <ToolbarGroup>
          <Tooltip title="Flip Horizontal">
            <IconButton size="small" onClick={handleFlipHorizontal}>
              <FlipIcon sx={{ fontSize: 18, color: crop.flipHorizontal ? '#19abb5' : '#888888' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Flip Vertical">
            <IconButton size="small" onClick={handleFlipVertical}>
              <FlipIcon sx={{ fontSize: 18, color: crop.flipVertical ? '#19abb5' : '#888888', transform: 'rotate(90deg)' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rotate 90">
            <IconButton size="small" onClick={handleRotate}>
              <Rotate90DegreesCcwIcon sx={{ fontSize: 18, color: crop.rotation !== 0 ? '#19abb5' : '#888888' }} />
            </IconButton>
          </Tooltip>
        </ToolbarGroup>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Undo/Redo */}
        <ToolbarGroup>
          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton size="small" onClick={undo} disabled={!canUndo()}>
                <UndoIcon sx={{ fontSize: 18, color: canUndo() ? '#888888' : '#444444' }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Shift+Z)">
            <span>
              <IconButton size="small" onClick={redo} disabled={!canRedo()}>
                <RedoIcon sx={{ fontSize: 18, color: canRedo() ? '#888888' : '#444444' }} />
              </IconButton>
            </span>
          </Tooltip>
        </ToolbarGroup>

        <Box sx={{ flex: 1 }} />

        {/* Panel Toggles */}
        <ToolbarGroup>
          <Tooltip title="Adjustments Panel">
            <ToolButton size="small" active={showAdjustmentsPanel} onClick={() => togglePanel('adjustments')}>
              <TuneIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Annotations Panel">
            <ToolButton size="small" active={showAnnotationsPanel} onClick={() => togglePanel('annotations')}>
              <GestureIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
          <Tooltip title="Recipes Panel">
            <ToolButton size="small" active={showRecipesPanel} onClick={() => togglePanel('recipes')}>
              <AutoStoriesIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </Tooltip>
        </ToolbarGroup>

        <ToolbarDivider orientation="vertical" flexItem />

        {/* Settings */}
        <Tooltip title="Settings">
          <IconButton size="small" onClick={() => setShowSettings(!showSettings)}>
            <SettingsIcon sx={{ fontSize: 18, color: showSettings ? '#19abb5' : '#888888' }} />
          </IconButton>
        </Tooltip>
      </Toolbar>

      {/* Main Content */}
      <MainContent>
        {/* Canvas Area */}
        <CanvasArea>
          {viewMode === 'compare' ? (
            <CompareView
              imageUrl={imageUrl || null}
              imageElement={imageElement}
              compareMode={compareMode}
              currentAdjustments={adjustments}
              userEdits={Array.isArray(userEdits) ? userEdits : []}
              compareEditIds={compareEditIds}
            />
          ) : (
            <ImageCanvasComponent
              imageUrl={imageUrl || null}
              imageElement={imageElement}
              adjustments={adjustments}
              crop={crop}
              annotations={Array.isArray(annotations) ? annotations : []}
              selectedAnnotationId={selectedAnnotationId}
              activeTool={activeTool}
              zoom={zoom}
              panX={panX}
              panY={panY}
              fitToView={fitToView}
              onImageLoad={handleImageLoad}
              onPan={setPan}
              onAnnotationAdd={handleAnnotationAdd}
              onAnnotationSelect={selectAnnotation}
              onCropChange={setCrop}
            />
          )}
        </CanvasArea>

        {/* Side Panel */}
        {(showAdjustmentsPanel || showAnnotationsPanel || showRecipesPanel) && (
          <SidePanel>
            {showAdjustmentsPanel && (
              <SidePanelSection sx={{ flex: '0 0 auto', maxHeight: '50%', overflow: 'auto' }}>
                <AdjustmentsPanel
                  adjustments={adjustments}
                  onAdjustmentChange={setAdjustment}
                  onReset={resetAdjustments}
                  onResetSingle={resetAdjustment}
                />
              </SidePanelSection>
            )}
            {showAnnotationsPanel && (
              <SidePanelSection sx={{ flex: '0 0 auto', maxHeight: '35%', overflow: 'hidden' }}>
                <AnnotationsPanel
                  annotations={Array.isArray(annotations) ? annotations : []}
                  selectedAnnotationId={selectedAnnotationId}
                  activeTool={activeTool}
                  annotationDefaults={annotationDefaults}
                  onToolChange={setActiveTool}
                  onAnnotationSelect={selectAnnotation}
                  onAnnotationUpdate={updateAnnotation}
                  onAnnotationDelete={deleteAnnotation}
                  onAnnotationVisibilityToggle={setAnnotationVisibility}
                  onDefaultsChange={setAnnotationDefaults}
                  onClearAll={clearAnnotations}
                  onBringToFront={bringAnnotationToFront}
                  onSendToBack={sendAnnotationToBack}
                />
              </SidePanelSection>
            )}
            {showRecipesPanel && (
              <SidePanelSection sx={{ flex: 1, overflow: 'hidden' }}>
                <RecipePanel
                  recipes={Array.isArray(recipes) ? recipes : []}
                  userEdits={Array.isArray(userEdits) ? userEdits : []}
                  activeRecipeId={activeFilterId}
                  activeUserEditId={activeUserEditId}
                  onApplyRecipe={applyRecipe}
                  onSaveRecipe={saveRecipe}
                  onDeleteRecipe={deleteRecipe}
                  onSaveUserEdit={saveUserEdit}
                  onLoadUserEdit={loadUserEdit}
                  onDeleteUserEdit={deleteUserEdit}
                  onCompareSelect={handleCompareSelect}
                />
              </SidePanelSection>
            )}
          </SidePanel>
        )}
      </MainContent>

      {/* Status Bar */}
      <StatusBar>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {originalDimensions && (
            <Typography variant="caption">
              {originalDimensions.width} x {originalDimensions.height}
            </Typography>
          )}
          {activeFilterId && (
            <Typography variant="caption" sx={{ color: '#19abb5' }}>
              Filter: {Array.isArray(recipes) ? recipes.find((r) => r.id === activeFilterId)?.name : ''}
            </Typography>
          )}
          {Array.isArray(annotations) && annotations.length > 0 && (
            <Typography variant="caption">
              {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {crop.flipHorizontal && <Typography variant="caption">Flipped H</Typography>}
          {crop.flipVertical && <Typography variant="caption">Flipped V</Typography>}
          {crop.rotation !== 0 && <Typography variant="caption">Rotated {crop.rotation}</Typography>}
        </Box>
      </StatusBar>
    </ToolContainer>
  );
};

export default ImageTool;
