/**
 * Audio Tool Store
 * Zustand store for managing audio tool state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  AudioToolState,
  TimeSelection,
  LoopRegion,
  FilterSettings,
  FilterRecipe,
  AudioIteration,
  AudioFinding,
  WaveformSettings,
  AudioViewMode,
  AudioAnalysisData,
} from '../types/audio';
import {
  DEFAULT_FILTER_SETTINGS,
  DEFAULT_WAVEFORM_SETTINGS,
  DEFAULT_PLAYBACK_STATE,
  PRESET_RECIPES,
} from '../types/audio';

// ============================================================================
// STORE ACTIONS INTERFACE
// ============================================================================

interface AudioToolActions {
  // Audio loading
  loadAudio: (evidenceId: string, investigationId: string, audioUrl: string) => void;
  setAudioBuffer: (buffer: AudioBuffer) => void;
  clearAudio: () => void;

  // View mode
  setViewMode: (mode: AudioViewMode) => void;

  // Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleLooping: () => void;
  updatePlaybackTime: (time: number) => void;
  setDuration: (duration: number) => void;

  // Time selections
  startSelection: (startTime: number) => void;
  updateSelection: (endTime: number) => void;
  finishSelection: () => void;
  cancelSelection: () => void;
  setCurrentSelection: (selection: TimeSelection | null) => void;
  addSelection: (selection: TimeSelection) => void;
  removeSelection: (id: string) => void;
  updateSelectionVisibility: (id: string, visible: boolean) => void;
  clearSelections: () => void;

  // Loop regions
  addLoopRegion: (region: Omit<LoopRegion, 'id'>) => void;
  removeLoopRegion: (id: string) => void;
  setActiveLoop: (id: string | null) => void;
  updateLoopRegion: (id: string, updates: Partial<LoopRegion>) => void;
  createLoopFromSelection: () => void;

  // Filters
  setFilterSettings: (settings: Partial<FilterSettings>) => void;
  setEQBand: (bandId: string, updates: Partial<FilterSettings['eq'][0]>) => void;
  setNoiseReduction: (settings: Partial<FilterSettings['noiseReduction']>) => void;
  setGain: (settings: Partial<FilterSettings['gain']>) => void;
  resetFilters: () => void;
  toggleFiltersBypass: () => void;
  applyRecipe: (recipeId: string) => void;

  // Recipes
  saveRecipe: (name: string, description?: string, tags?: string[]) => void;
  deleteRecipe: (id: string) => void;
  updateRecipe: (id: string, updates: Partial<FilterRecipe>) => void;

  // Iterations
  createIteration: (name: string, description?: string) => void;
  deleteIteration: (id: string) => void;
  setActiveIteration: (id: string | null) => void;
  updateIteration: (id: string, updates: Partial<AudioIteration>) => void;

  // Findings
  createFindingFromSelection: (title: string, notes?: string, confidence?: AudioFinding['confidence']) => void;
  addFinding: (finding: AudioFinding) => void;
  updateFinding: (id: string, updates: Partial<AudioFinding>) => void;
  deleteFinding: (id: string) => void;
  setFindingVisibility: (id: string, visible: boolean) => void;

  // Settings
  setWaveformSettings: (settings: Partial<WaveformSettings>) => void;

  // Analysis
  setAnalysisData: (data: AudioAnalysisData | null) => void;

  // UI State
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  setZoom: (zoom: number) => void;
  setScrollPosition: (position: number) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const initialState: AudioToolState = {
  evidenceId: null,
  investigationId: null,
  audioBuffer: null,
  audioUrl: null,
  viewMode: 'waveform',
  playback: DEFAULT_PLAYBACK_STATE,
  currentSelection: null,
  selections: [],
  loopRegions: [],
  activeLoopId: null,
  filterSettings: DEFAULT_FILTER_SETTINGS,
  recipes: PRESET_RECIPES.map((recipe) => ({
    ...recipe,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  iterations: [],
  activeIterationId: null,
  findings: [],
  waveformSettings: DEFAULT_WAVEFORM_SETTINGS,
  analysisData: null,
  isLoading: false,
  isProcessing: false,
  error: null,
  filtersBypassed: false,
  zoom: 100,
  scrollPosition: 0,
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useAudioToolStore = create<AudioToolState & AudioToolActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Audio loading
      loadAudio: (evidenceId, investigationId, audioUrl) => {
        set((state) => {
          state.evidenceId = evidenceId;
          state.investigationId = investigationId;
          state.audioUrl = audioUrl;
          state.isLoading = true;
          state.error = null;
          // Reset playback state
          state.playback = DEFAULT_PLAYBACK_STATE;
          // Clear selections for new audio
          state.currentSelection = null;
          state.selections = [];
        });
      },

      setAudioBuffer: (buffer) => {
        set((state) => {
          state.audioBuffer = buffer;
          state.playback.duration = buffer.duration;
          state.isLoading = false;
        });
      },

      clearAudio: () => {
        set((state) => {
          state.evidenceId = null;
          state.investigationId = null;
          state.audioBuffer = null;
          state.audioUrl = null;
          state.playback = DEFAULT_PLAYBACK_STATE;
          state.currentSelection = null;
          state.selections = [];
          state.loopRegions = [];
          state.activeLoopId = null;
          state.findings = [];
          state.iterations = [];
          state.activeIterationId = null;
          state.analysisData = null;
          state.error = null;
        });
      },

      // View mode
      setViewMode: (mode) => {
        set((state) => {
          state.viewMode = mode;
        });
      },

      // Playback
      play: () => {
        set((state) => {
          state.playback.isPlaying = true;
        });
      },

      pause: () => {
        set((state) => {
          state.playback.isPlaying = false;
        });
      },

      stop: () => {
        set((state) => {
          state.playback.isPlaying = false;
          state.playback.currentTime = 0;
        });
      },

      seek: (time) => {
        set((state) => {
          state.playback.currentTime = Math.max(0, Math.min(time, state.playback.duration));
        });
      },

      setPlaybackRate: (rate) => {
        set((state) => {
          state.playback.playbackRate = Math.max(0.25, Math.min(rate, 4));
        });
      },

      setVolume: (volume) => {
        set((state) => {
          state.playback.volume = Math.max(0, Math.min(volume, 1));
        });
      },

      toggleMute: () => {
        set((state) => {
          state.playback.muted = !state.playback.muted;
        });
      },

      toggleLooping: () => {
        set((state) => {
          state.playback.looping = !state.playback.looping;
        });
      },

      updatePlaybackTime: (time) => {
        set((state) => {
          state.playback.currentTime = time;
        });
      },

      setDuration: (duration) => {
        set((state) => {
          state.playback.duration = duration;
        });
      },

      // Time selections
      startSelection: (startTime) => {
        const userId = 'current-user'; // Will be replaced with actual user ID
        set((state) => {
          state.currentSelection = {
            id: generateId(),
            startTime,
            endTime: startTime,
            color: '#19abb5',
            userId,
            visible: true,
            createdAt: new Date(),
          };
        });
      },

      updateSelection: (endTime) => {
        set((state) => {
          if (state.currentSelection) {
            state.currentSelection.endTime = endTime;
          }
        });
      },

      finishSelection: () => {
        const { currentSelection } = get();
        if (currentSelection) {
          // Normalize selection (ensure start < end)
          const normalizedSelection: TimeSelection = {
            ...currentSelection,
            startTime: Math.min(currentSelection.startTime, currentSelection.endTime),
            endTime: Math.max(currentSelection.startTime, currentSelection.endTime),
          };
          set((state) => {
            state.selections.push(normalizedSelection);
            state.currentSelection = null;
          });
        }
      },

      cancelSelection: () => {
        set((state) => {
          state.currentSelection = null;
        });
      },

      setCurrentSelection: (selection) => {
        set((state) => {
          state.currentSelection = selection;
        });
      },

      addSelection: (selection) => {
        set((state) => {
          state.selections.push(selection);
        });
      },

      removeSelection: (id) => {
        set((state) => {
          state.selections = state.selections.filter((s) => s.id !== id);
        });
      },

      updateSelectionVisibility: (id, visible) => {
        set((state) => {
          const selection = state.selections.find((s) => s.id === id);
          if (selection) {
            selection.visible = visible;
          }
        });
      },

      clearSelections: () => {
        set((state) => {
          state.selections = [];
          state.currentSelection = null;
        });
      },

      // Loop regions
      addLoopRegion: (region) => {
        const id = generateId();
        set((state) => {
          state.loopRegions.push({ ...region, id });
        });
      },

      removeLoopRegion: (id) => {
        set((state) => {
          state.loopRegions = state.loopRegions.filter((r) => r.id !== id);
          if (state.activeLoopId === id) {
            state.activeLoopId = null;
          }
        });
      },

      setActiveLoop: (id) => {
        set((state) => {
          state.activeLoopId = id;
          // Deactivate all loops first
          state.loopRegions.forEach((r) => (r.active = false));
          // Activate the selected one
          if (id) {
            const loop = state.loopRegions.find((r) => r.id === id);
            if (loop) {
              loop.active = true;
              state.playback.looping = true;
            }
          }
        });
      },

      updateLoopRegion: (id, updates) => {
        set((state) => {
          const region = state.loopRegions.find((r) => r.id === id);
          if (region) {
            Object.assign(region, updates);
          }
        });
      },

      createLoopFromSelection: () => {
        const { currentSelection, selections } = get();
        const selection = currentSelection || selections[selections.length - 1];
        if (selection) {
          const id = generateId();
          set((state) => {
            state.loopRegions.push({
              id,
              startTime: selection.startTime,
              endTime: selection.endTime,
              label: `Loop ${state.loopRegions.length + 1}`,
              color: '#ffc107',
              active: true,
            });
            state.activeLoopId = id;
            state.playback.looping = true;
          });
        }
      },

      // Filters
      setFilterSettings: (settings) => {
        set((state) => {
          Object.assign(state.filterSettings, settings);
        });
      },

      setEQBand: (bandId, updates) => {
        set((state) => {
          const band = state.filterSettings.eq.find((b) => b.id === bandId);
          if (band) {
            Object.assign(band, updates);
          }
        });
      },

      setNoiseReduction: (settings) => {
        set((state) => {
          Object.assign(state.filterSettings.noiseReduction, settings);
        });
      },

      setGain: (settings) => {
        set((state) => {
          Object.assign(state.filterSettings.gain, settings);
        });
      },

      resetFilters: () => {
        set((state) => {
          state.filterSettings = DEFAULT_FILTER_SETTINGS;
        });
      },

      toggleFiltersBypass: () => {
        set((state) => {
          state.filtersBypassed = !state.filtersBypassed;
        });
      },

      applyRecipe: (recipeId) => {
        const { recipes } = get();
        const recipe = recipes.find((r) => r.id === recipeId);
        if (recipe) {
          set((state) => {
            state.filterSettings = { ...recipe.settings };
          });
        }
      },

      // Recipes
      saveRecipe: (name, description, tags = []) => {
        const { filterSettings } = get();
        const userId = 'current-user'; // Will be replaced with actual user ID
        set((state) => {
          state.recipes.push({
            id: generateId(),
            name,
            description,
            settings: { ...filterSettings },
            userId,
            tags,
            isPreset: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        });
      },

      deleteRecipe: (id) => {
        set((state) => {
          // Don't allow deleting presets
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

      // Iterations
      createIteration: (name, description) => {
        const { evidenceId, filterSettings } = get();
        if (!evidenceId) return;

        const userId = 'current-user'; // Will be replaced with actual user ID
        const id = generateId();
        set((state) => {
          // Deactivate all other iterations
          state.iterations.forEach((i) => (i.active = false));
          state.iterations.push({
            id,
            evidenceId: evidenceId,
            name,
            description,
            settings: { ...filterSettings },
            userId,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          state.activeIterationId = id;
        });
      },

      deleteIteration: (id) => {
        set((state) => {
          state.iterations = state.iterations.filter((i) => i.id !== id);
          if (state.activeIterationId === id) {
            // Activate the latest remaining iteration
            const latest = state.iterations[state.iterations.length - 1];
            if (latest) {
              latest.active = true;
              state.activeIterationId = latest.id;
            } else {
              state.activeIterationId = null;
            }
          }
        });
      },

      setActiveIteration: (id) => {
        set((state) => {
          state.iterations.forEach((i) => (i.active = false));
          if (id) {
            const iteration = state.iterations.find((i) => i.id === id);
            if (iteration) {
              iteration.active = true;
              // Apply the iteration's filter settings
              state.filterSettings = { ...iteration.settings };
            }
          }
          state.activeIterationId = id;
        });
      },

      updateIteration: (id, updates) => {
        set((state) => {
          const iteration = state.iterations.find((i) => i.id === id);
          if (iteration) {
            Object.assign(iteration, updates, { updatedAt: new Date() });
          }
        });
      },

      // Findings
      createFindingFromSelection: (title, notes, confidence = 'medium') => {
        const { currentSelection, selections, evidenceId, investigationId, activeIterationId } = get();
        const selection = currentSelection || selections[selections.length - 1];
        if (!selection || !evidenceId || !investigationId) return;

        const userId = 'current-user'; // Will be replaced with actual user ID
        set((state) => {
          state.findings.push({
            id: generateId(),
            evidenceId,
            investigationId,
            selection: { ...selection },
            iterationId: activeIterationId ?? undefined,
            title,
            notes,
            confidence,
            userId,
            userDisplayName: 'Current User', // Will be replaced with actual user name
            tags: [],
            visible: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          // Clear current selection after creating finding
          state.currentSelection = null;
        });
      },

      addFinding: (finding) => {
        set((state) => {
          state.findings.push(finding);
        });
      },

      updateFinding: (id, updates) => {
        set((state) => {
          const finding = state.findings.find((f) => f.id === id);
          if (finding) {
            Object.assign(finding, updates, { updatedAt: new Date() });
          }
        });
      },

      deleteFinding: (id) => {
        set((state) => {
          state.findings = state.findings.filter((f) => f.id !== id);
        });
      },

      setFindingVisibility: (id, visible) => {
        set((state) => {
          const finding = state.findings.find((f) => f.id === id);
          if (finding) {
            finding.visible = visible;
          }
        });
      },

      // Settings
      setWaveformSettings: (settings) => {
        set((state) => {
          Object.assign(state.waveformSettings, settings);
        });
      },

      // Analysis
      setAnalysisData: (data) => {
        set((state) => {
          state.analysisData = data;
        });
      },

      // UI State
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

      setZoom: (zoom) => {
        set((state) => {
          state.zoom = Math.max(10, Math.min(zoom, 1000));
        });
      },

      setScrollPosition: (position) => {
        set((state) => {
          state.scrollPosition = Math.max(0, position);
        });
      },

      // Reset
      reset: () => {
        set((state) => {
          Object.assign(state, {
            ...initialState,
            // Keep recipes (user-created ones)
            recipes: state.recipes,
          });
        });
      },
    })),
    {
      name: 'tacctile-audio-tool',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist settings, recipes, and preferences - never persist dynamic data
        waveformSettings: state.waveformSettings,
        recipes: state.recipes.filter((r) => !r.isPreset), // Only user recipes
        viewMode: state.viewMode,
        zoom: state.zoom,
      }),
      // Merge function to safely handle hydration without overwriting runtime state
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AudioToolState> | undefined;
        if (!persisted) return currentState;

        return {
          ...currentState,
          // Only restore preferences, not data
          waveformSettings: persisted.waveformSettings ?? currentState.waveformSettings,
          viewMode: persisted.viewMode ?? currentState.viewMode,
          zoom: persisted.zoom ?? currentState.zoom,
          // Merge user recipes with preset recipes
          recipes: [
            ...currentState.recipes.filter((r) => r.isPreset),
            ...(persisted.recipes ?? []).filter((r) => !r.isPreset),
          ],
        };
      },
    }
  )
);

// ============================================================================
// SELECTOR FUNCTIONS
// ============================================================================

export const selectAudioUrl = (state: AudioToolState) => state.audioUrl;
export const selectPlayback = (state: AudioToolState) => state.playback;
export const selectViewMode = (state: AudioToolState) => state.viewMode;
export const selectSelections = (state: AudioToolState) => state.selections;
export const selectCurrentSelection = (state: AudioToolState) => state.currentSelection;
export const selectLoopRegions = (state: AudioToolState) => state.loopRegions;
export const selectFilterSettings = (state: AudioToolState) => state.filterSettings;
export const selectRecipes = (state: AudioToolState) => state.recipes;
export const selectIterations = (state: AudioToolState) => state.iterations;
export const selectFindings = (state: AudioToolState) => state.findings;
export const selectWaveformSettings = (state: AudioToolState) => state.waveformSettings;
export const selectIsLoading = (state: AudioToolState) => state.isLoading;
export const selectIsProcessing = (state: AudioToolState) => state.isProcessing;
export const selectAudioError = (state: AudioToolState) => state.error;
export const selectFiltersBypassed = (state: AudioToolState) => state.filtersBypassed;

export default useAudioToolStore;
