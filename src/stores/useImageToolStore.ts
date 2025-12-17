/**
 * Image Tool Store
 * Zustand store for managing image tool state (Adobe Lightroom-inspired)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  ImageToolState,
  ImageViewMode,
  CompareMode,
  ImageAdjustments,
  CropSettings,
  ImageAnnotation,
  ImageEditRecipe,
  ImageHistoryEntry,
  ImageToolType,
  AnnotationDefaults,
} from "../types/image";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CROP_SETTINGS,
  DEFAULT_ANNOTATION_DEFAULTS,
  PRESET_FILTERS,
  USER_COLORS,
} from "../types/image";

// ============================================================================
// STORE ACTIONS INTERFACE
// ============================================================================

interface ImageToolActions {
  // Image loading
  loadImage: (
    fileId: string,
    investigationId: string,
    imageUrl: string,
  ) => void;
  setImageElement: (element: HTMLImageElement) => void;
  clearImage: () => void;

  // View mode
  setViewMode: (mode: ImageViewMode) => void;
  setCompareMode: (mode: CompareMode) => void;
  setCompareEdits: (editIds: [string | null, string | null]) => void;

  // Zoom & Pan
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;
  doFitToView: () => void;

  // Active tool
  setActiveTool: (tool: ImageToolType) => void;

  // Adjustments (non-destructive)
  setAdjustment: <K extends keyof ImageAdjustments>(
    key: K,
    value: ImageAdjustments[K],
  ) => void;
  setAdjustments: (adjustments: Partial<ImageAdjustments>) => void;
  resetAdjustments: () => void;
  resetAdjustment: (key: keyof ImageAdjustments) => void;

  // Crop
  setCrop: (crop: Partial<CropSettings>) => void;
  applyCrop: () => void;
  cancelCrop: () => void;
  resetCrop: () => void;

  // Filters
  applyFilter: (filterId: string) => void;
  clearFilter: () => void;

  // Annotations
  addAnnotation: (
    annotation: Omit<ImageAnnotation, "id" | "createdAt" | "updatedAt">,
  ) => void;
  updateAnnotation: (id: string, updates: Partial<ImageAnnotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  setAnnotationVisibility: (id: string, visible: boolean) => void;
  setAllAnnotationsVisibility: (visible: boolean) => void;
  setAnnotationDefaults: (defaults: Partial<AnnotationDefaults>) => void;
  setAnnotations: (annotations: ImageAnnotation[]) => void;
  clearAnnotations: () => void;
  bringAnnotationToFront: (id: string) => void;
  sendAnnotationToBack: (id: string) => void;

  // History (Undo/Redo)
  pushHistory: (action: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Recipes
  saveRecipe: (name: string, description?: string, tags?: string[]) => void;
  applyRecipe: (recipeId: string) => void;
  deleteRecipe: (id: string) => void;
  updateRecipe: (id: string, updates: Partial<ImageEditRecipe>) => void;

  // User edits (for compare)
  saveUserEdit: (name: string) => void;
  loadUserEdit: (editId: string) => void;
  deleteUserEdit: (id: string) => void;
  setActiveUserEdit: (id: string | null) => void;

  // UI state
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  togglePanel: (
    panel: "adjustments" | "annotations" | "recipes" | "histogram",
  ) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: ImageToolState = {
  // Image data
  fileId: null,
  investigationId: null,
  imageUrl: null,
  imageElement: null,
  originalDimensions: null,

  // View state
  viewMode: "single",
  compareMode: "side-by-side",
  compareEditIds: [null, null],
  zoom: 100,
  panX: 0,
  panY: 0,
  fitToView: true,

  // Active tool
  activeTool: "pan",

  // Current adjustments (non-destructive)
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  crop: { ...DEFAULT_CROP_SETTINGS },
  activeFilterId: null,

  // Annotations
  annotations: [],
  selectedAnnotationId: null,
  annotationDefaults: { ...DEFAULT_ANNOTATION_DEFAULTS },

  // Edit history
  history: [],
  historyIndex: -1,
  maxHistoryLength: 50,

  // Recipes
  recipes: PRESET_FILTERS.map((filter) => ({
    id: generateId(),
    name: filter.name,
    description: `Preset filter: ${filter.name}`,
    userId: "system",
    userDisplayName: "System",
    adjustments: { ...DEFAULT_ADJUSTMENTS, ...filter.adjustments },
    crop: { ...DEFAULT_CROP_SETTINGS },
    filterId: undefined,
    annotations: [],
    tags: [filter.category],
    isPreset: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),

  // User edits
  userEdits: [],
  activeUserEditId: null,

  // UI state
  isLoading: false,
  isProcessing: false,
  error: null,

  // Panel visibility
  showAdjustmentsPanel: true,
  showAnnotationsPanel: true,
  showRecipesPanel: true,
  showHistogramPanel: false,
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useImageToolStore = create<ImageToolState & ImageToolActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Image loading
      loadImage: (fileId, investigationId, imageUrl) => {
        set((state) => {
          state.fileId = fileId;
          state.investigationId = investigationId;
          state.imageUrl = imageUrl;
          state.isLoading = true;
          state.error = null;
          // Reset state for new image
          state.adjustments = { ...DEFAULT_ADJUSTMENTS };
          state.crop = { ...DEFAULT_CROP_SETTINGS };
          state.activeFilterId = null;
          state.annotations = [];
          state.selectedAnnotationId = null;
          state.history = [];
          state.historyIndex = -1;
          state.userEdits = [];
          state.activeUserEditId = null;
          state.zoom = 100;
          state.panX = 0;
          state.panY = 0;
          state.fitToView = true;
        });
      },

      setImageElement: (element) => {
        set((state) => {
          // Cast needed for immer compatibility with DOM elements
          state.imageElement = element as unknown as typeof state.imageElement;
          state.originalDimensions = {
            width: element.naturalWidth,
            height: element.naturalHeight,
          };
          state.isLoading = false;
        });
      },

      clearImage: () => {
        set((state) => {
          Object.assign(state, {
            ...initialState,
            recipes: state.recipes, // Keep recipes
          });
        });
      },

      // View mode
      setViewMode: (mode) => {
        set((state) => {
          state.viewMode = mode;
        });
      },

      setCompareMode: (mode) => {
        set((state) => {
          state.compareMode = mode;
        });
      },

      setCompareEdits: (editIds) => {
        set((state) => {
          state.compareEditIds = editIds;
        });
      },

      // Zoom & Pan
      setZoom: (zoom) => {
        set((state) => {
          state.zoom = Math.max(10, Math.min(zoom, 1600));
          state.fitToView = false;
        });
      },

      zoomIn: () => {
        const { zoom } = get();
        set((state) => {
          state.zoom = Math.min(zoom * 1.25, 1600);
          state.fitToView = false;
        });
      },

      zoomOut: () => {
        const { zoom } = get();
        set((state) => {
          state.zoom = Math.max(zoom / 1.25, 10);
          state.fitToView = false;
        });
      },

      setPan: (x, y) => {
        set((state) => {
          state.panX = x;
          state.panY = y;
        });
      },

      resetView: () => {
        set((state) => {
          state.zoom = 100;
          state.panX = 0;
          state.panY = 0;
          state.fitToView = false;
        });
      },

      doFitToView: () => {
        set((state) => {
          state.fitToView = true;
          state.panX = 0;
          state.panY = 0;
        });
      },

      // Active tool
      setActiveTool: (tool) => {
        set((state) => {
          state.activeTool = tool;
          // Deselect annotation when switching to non-annotation tool
          if (["pan", "zoom", "crop", "eyedropper"].includes(tool)) {
            state.selectedAnnotationId = null;
          }
        });
      },

      // Adjustments
      setAdjustment: (key, value) => {
        set((state) => {
          (state.adjustments as Record<string, unknown>)[key] = value;
        });
      },

      setAdjustments: (adjustments) => {
        set((state) => {
          Object.assign(state.adjustments, adjustments);
        });
      },

      resetAdjustments: () => {
        const { pushHistory } = get();
        pushHistory("Reset all adjustments");
        set((state) => {
          state.adjustments = { ...DEFAULT_ADJUSTMENTS };
          state.activeFilterId = null;
        });
      },

      resetAdjustment: (key) => {
        set((state) => {
          (state.adjustments as unknown as Record<string, unknown>)[key] = (
            DEFAULT_ADJUSTMENTS as unknown as Record<string, unknown>
          )[key];
        });
      },

      // Crop
      setCrop: (crop) => {
        set((state) => {
          Object.assign(state.crop, crop);
          if (
            !state.crop.enabled &&
            (crop.x !== undefined || crop.y !== undefined)
          ) {
            state.crop.enabled = true;
          }
        });
      },

      applyCrop: () => {
        const { pushHistory } = get();
        pushHistory("Apply crop");
        set((state) => {
          state.crop.enabled = false;
        });
      },

      cancelCrop: () => {
        set((state) => {
          state.crop = { ...DEFAULT_CROP_SETTINGS };
        });
      },

      resetCrop: () => {
        const { pushHistory } = get();
        pushHistory("Reset crop");
        set((state) => {
          state.crop = { ...DEFAULT_CROP_SETTINGS };
        });
      },

      // Filters
      applyFilter: (filterId) => {
        const { recipes, pushHistory } = get();
        const recipe = recipes.find((r) => r.id === filterId);
        if (recipe) {
          pushHistory(`Apply filter: ${recipe.name}`);
          set((state) => {
            state.activeFilterId = filterId;
            state.adjustments = { ...recipe.adjustments };
          });
        }
      },

      clearFilter: () => {
        set((state) => {
          state.activeFilterId = null;
        });
      },

      // Annotations
      addAnnotation: (annotation) => {
        const { pushHistory } = get();
        const id = generateId();
        const now = new Date();
        pushHistory(`Add ${annotation.type} annotation`);
        set((state) => {
          state.annotations.push({
            ...annotation,
            id,
            createdAt: now,
            updatedAt: now,
          } as ImageAnnotation);
          state.selectedAnnotationId = id;
        });
      },

      updateAnnotation: (id, updates) => {
        set((state) => {
          const annotation = state.annotations.find((a) => a.id === id);
          if (annotation) {
            Object.assign(annotation, updates, { updatedAt: new Date() });
          }
        });
      },

      deleteAnnotation: (id) => {
        const { pushHistory } = get();
        pushHistory("Delete annotation");
        set((state) => {
          state.annotations = state.annotations.filter((a) => a.id !== id);
          if (state.selectedAnnotationId === id) {
            state.selectedAnnotationId = null;
          }
        });
      },

      selectAnnotation: (id) => {
        set((state) => {
          state.selectedAnnotationId = id;
        });
      },

      setAnnotationVisibility: (id, visible) => {
        set((state) => {
          const annotation = state.annotations.find((a) => a.id === id);
          if (annotation) {
            annotation.visible = visible;
          }
        });
      },

      setAllAnnotationsVisibility: (visible) => {
        set((state) => {
          state.annotations.forEach((annotation) => {
            annotation.visible = visible;
          });
        });
      },

      setAnnotationDefaults: (defaults) => {
        set((state) => {
          Object.assign(state.annotationDefaults, defaults);
        });
      },

      setAnnotations: (annotations) => {
        set((state) => {
          state.annotations = annotations;
          state.selectedAnnotationId = null;
        });
      },

      clearAnnotations: () => {
        const { pushHistory, annotations } = get();
        if (annotations.length > 0) {
          pushHistory("Clear all annotations");
          set((state) => {
            state.annotations = [];
            state.selectedAnnotationId = null;
          });
        }
      },

      bringAnnotationToFront: (id) => {
        set((state) => {
          const index = state.annotations.findIndex((a) => a.id === id);
          if (index > -1 && index < state.annotations.length - 1) {
            const removed = state.annotations.splice(index, 1);
            const annotation = removed[0];
            if (annotation) {
              state.annotations.push(annotation);
            }
          }
        });
      },

      sendAnnotationToBack: (id) => {
        set((state) => {
          const index = state.annotations.findIndex((a) => a.id === id);
          if (index > 0) {
            const removed = state.annotations.splice(index, 1);
            const annotation = removed[0];
            if (annotation) {
              state.annotations.unshift(annotation);
            }
          }
        });
      },

      // History
      pushHistory: (action) => {
        const {
          adjustments,
          crop,
          annotations,
          activeFilterId,
          maxHistoryLength,
          historyIndex,
          history,
        } = get();
        const entry: ImageHistoryEntry = {
          id: generateId(),
          timestamp: new Date(),
          action,
          adjustments: JSON.parse(JSON.stringify(adjustments)),
          crop: JSON.parse(JSON.stringify(crop)),
          annotations: JSON.parse(JSON.stringify(annotations)),
          activeFilterId,
        };

        set((state) => {
          // Remove any future history if we're not at the end
          if (historyIndex < history.length - 1) {
            state.history = state.history.slice(0, historyIndex + 1);
          }
          // Add new entry
          state.history.push(entry);
          // Trim to max length
          if (state.history.length > maxHistoryLength) {
            state.history = state.history.slice(-maxHistoryLength);
          }
          state.historyIndex = state.history.length - 1;
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const prevEntry = history[historyIndex - 1];
          if (!prevEntry) return;
          set((state) => {
            state.historyIndex = historyIndex - 1;
            state.adjustments = JSON.parse(
              JSON.stringify(prevEntry.adjustments),
            );
            state.crop = JSON.parse(JSON.stringify(prevEntry.crop));
            state.annotations = JSON.parse(
              JSON.stringify(prevEntry.annotations),
            );
            state.activeFilterId = prevEntry.activeFilterId;
          });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const nextEntry = history[historyIndex + 1];
          if (!nextEntry) return;
          set((state) => {
            state.historyIndex = historyIndex + 1;
            state.adjustments = JSON.parse(
              JSON.stringify(nextEntry.adjustments),
            );
            state.crop = JSON.parse(JSON.stringify(nextEntry.crop));
            state.annotations = JSON.parse(
              JSON.stringify(nextEntry.annotations),
            );
            state.activeFilterId = nextEntry.activeFilterId;
          });
        }
      },

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },

      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

      // Recipes
      saveRecipe: (name, description, tags = []) => {
        const { adjustments, crop, activeFilterId, annotations } = get();
        const userId = "current-user"; // Will be replaced with actual user ID
        set((state) => {
          state.recipes.push({
            id: generateId(),
            name,
            description,
            userId,
            userDisplayName: "Current User",
            adjustments: JSON.parse(JSON.stringify(adjustments)),
            crop: JSON.parse(JSON.stringify(crop)),
            filterId: activeFilterId ?? undefined,
            annotations: JSON.parse(JSON.stringify(annotations)),
            tags,
            isPreset: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        });
      },

      applyRecipe: (recipeId) => {
        const { recipes, pushHistory } = get();
        const recipe = recipes.find((r) => r.id === recipeId);
        if (recipe) {
          pushHistory(`Apply recipe: ${recipe.name}`);
          set((state) => {
            state.adjustments = JSON.parse(JSON.stringify(recipe.adjustments));
            state.crop = JSON.parse(JSON.stringify(recipe.crop));
            state.annotations = JSON.parse(JSON.stringify(recipe.annotations));
            state.activeFilterId = recipe.filterId ?? null;
          });
        }
      },

      deleteRecipe: (id) => {
        set((state) => {
          const recipe = state.recipes.find((r) => r.id === id);
          if (recipe && !recipe.isPreset) {
            state.recipes = state.recipes.filter((r) => r.id !== id);
          }
        });
      },

      updateRecipe: (id, updates) => {
        set((state) => {
          const recipe = state.recipes.find((r) => r.id === id);
          if (recipe && !recipe.isPreset) {
            Object.assign(recipe, updates, { updatedAt: new Date() });
          }
        });
      },

      // User edits
      saveUserEdit: (name) => {
        const { adjustments, crop, activeFilterId, annotations, userEdits } =
          get();
        const userId = "current-user"; // Will be replaced with actual user ID
        const colorIndex =
          userEdits.filter((e) => e.userId === userId).length %
          USER_COLORS.length;

        set((state) => {
          state.userEdits.push({
            id: generateId(),
            userId,
            userDisplayName: "Current User",
            recipeName: name,
            adjustments: JSON.parse(JSON.stringify(adjustments)),
            crop: JSON.parse(JSON.stringify(crop)),
            filterId: activeFilterId ?? undefined,
            annotations: JSON.parse(JSON.stringify(annotations)),
            color: USER_COLORS[colorIndex] ?? "#19abb5",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        });
      },

      loadUserEdit: (editId) => {
        const { userEdits, pushHistory } = get();
        const edit = userEdits.find((e) => e.id === editId);
        if (edit) {
          pushHistory(
            `Load edit: ${edit.recipeName} by ${edit.userDisplayName}`,
          );
          set((state) => {
            state.adjustments = JSON.parse(JSON.stringify(edit.adjustments));
            state.crop = JSON.parse(JSON.stringify(edit.crop));
            state.annotations = JSON.parse(JSON.stringify(edit.annotations));
            state.activeFilterId = edit.filterId ?? null;
            state.activeUserEditId = editId;
          });
        }
      },

      deleteUserEdit: (id) => {
        set((state) => {
          state.userEdits = state.userEdits.filter((e) => e.id !== id);
          if (state.activeUserEditId === id) {
            state.activeUserEditId = null;
          }
          // Update compare edit IDs if necessary
          if (state.compareEditIds[0] === id) {
            state.compareEditIds[0] = null;
          }
          if (state.compareEditIds[1] === id) {
            state.compareEditIds[1] = null;
          }
        });
      },

      setActiveUserEdit: (id) => {
        set((state) => {
          state.activeUserEditId = id;
        });
      },

      // UI state
      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      setProcessing: (processing) => {
        set((state) => {
          state.isProcessing = processing;
        });
      },

      setError: (error) => {
        set((state) => {
          state.error = error;
          state.isLoading = false;
          state.isProcessing = false;
        });
      },

      togglePanel: (panel) => {
        set((state) => {
          switch (panel) {
            case "adjustments":
              state.showAdjustmentsPanel = !state.showAdjustmentsPanel;
              break;
            case "annotations":
              state.showAnnotationsPanel = !state.showAnnotationsPanel;
              break;
            case "recipes":
              state.showRecipesPanel = !state.showRecipesPanel;
              break;
            case "histogram":
              state.showHistogramPanel = !state.showHistogramPanel;
              break;
          }
        });
      },

      // Reset
      reset: () => {
        set((state) => {
          Object.assign(state, {
            ...initialState,
            recipes: state.recipes, // Keep recipes
          });
        });
      },
    })),
    {
      name: "tacctile-image-tool",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user preferences and custom recipes - never persist dynamic data
        recipes: state.recipes.filter((r) => !r.isPreset),
        annotationDefaults: state.annotationDefaults,
        showAdjustmentsPanel: state.showAdjustmentsPanel,
        showAnnotationsPanel: state.showAnnotationsPanel,
        showRecipesPanel: state.showRecipesPanel,
        showHistogramPanel: state.showHistogramPanel,
      }),
      // Merge function to safely handle hydration without overwriting runtime state
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ImageToolState> | undefined;
        if (!persisted) return currentState;

        return {
          ...currentState,
          // Only restore preferences, not data
          annotationDefaults:
            persisted.annotationDefaults ?? currentState.annotationDefaults,
          showAdjustmentsPanel:
            persisted.showAdjustmentsPanel ?? currentState.showAdjustmentsPanel,
          showAnnotationsPanel:
            persisted.showAnnotationsPanel ?? currentState.showAnnotationsPanel,
          showRecipesPanel:
            persisted.showRecipesPanel ?? currentState.showRecipesPanel,
          showHistogramPanel:
            persisted.showHistogramPanel ?? currentState.showHistogramPanel,
          // Merge user recipes with preset recipes
          recipes: [
            ...currentState.recipes.filter((r) => r.isPreset),
            ...(persisted.recipes ?? []).filter((r) => !r.isPreset),
          ],
        };
      },
    },
  ),
);

// ============================================================================
// SELECTOR FUNCTIONS
// ============================================================================

export const selectImageUrl = (state: ImageToolState) => state.imageUrl;
export const selectImageViewMode = (state: ImageToolState) => state.viewMode;
export const selectImageAdjustments = (state: ImageToolState) =>
  state.adjustments;
export const selectImageCrop = (state: ImageToolState) => state.crop;
export const selectImageAnnotations = (state: ImageToolState) =>
  state.annotations;
export const selectImageRecipes = (state: ImageToolState) => state.recipes;
export const selectUserEdits = (state: ImageToolState) => state.userEdits;
export const selectActiveUserEdit = (state: ImageToolState) =>
  state.activeUserEditId;
export const selectImageZoom = (state: ImageToolState) => state.zoom;
export const selectImageActiveTool = (state: ImageToolState) =>
  state.activeTool;
export const selectSelectedAnnotation = (state: ImageToolState) =>
  state.selectedAnnotationId;
export const selectImageIsLoading = (state: ImageToolState) => state.isLoading;
export const selectImageIsProcessing = (state: ImageToolState) =>
  state.isProcessing;
export const selectImageError = (state: ImageToolState) => state.error;

export default useImageToolStore;
