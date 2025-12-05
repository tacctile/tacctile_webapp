/**
 * Video Tool Store
 * Zustand store for managing video tool state with reselect memoization
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createSelector } from 'reselect';
import type {
  VideoToolState,
  VideoSource,
  VideoMarker,
  VideoAdjustments,
  VideoPlaybackState,
  CameraGridLayout,
  CameraSlot,
  TimelineTrack,
  TimeRange,
  WaveformData,
  PlaybackSpeed,
  VideoFilterPreset,
} from '../types/video';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_PLAYBACK_STATE,
  DEFAULT_TRACKS,
  getDefaultCameraSlots,
} from '../types/video';

// ============================================================================
// STORE ACTIONS INTERFACE
// ============================================================================

interface VideoToolActions {
  // Source management
  addSource: (source: Omit<VideoSource, 'id' | 'createdAt'>) => string;
  removeSource: (id: string) => void;
  setActiveSource: (id: string | null) => void;
  updateSource: (id: string, updates: Partial<VideoSource>) => void;

  // Playback controls
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  seekToFrame: (frame: number) => void;
  stepFrame: (direction: 1 | -1) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  updatePlaybackTime: (time: number) => void;
  setDuration: (duration: number, fps?: number) => void;

  // Adjustments
  setAdjustment: <K extends keyof VideoAdjustments>(key: K, value: VideoAdjustments[K]) => void;
  setFilter: (filter: VideoFilterPreset) => void;
  resetAdjustments: () => void;

  // Markers
  addMarker: (marker: Omit<VideoMarker, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateMarker: (id: string, updates: Partial<VideoMarker>) => void;
  removeMarker: (id: string) => void;
  addMarkerAtCurrentTime: (label?: string) => string;

  // Camera grid
  setGridLayout: (layout: CameraGridLayout) => void;
  assignSourceToSlot: (slotIndex: number, sourceId: string | null) => void;
  toggleSlotSync: (slotIndex: number) => void;
  toggleSlotMute: (slotIndex: number) => void;

  // Timeline
  setVisibleTimeRange: (range: TimeRange) => void;
  setZoom: (zoom: number) => void;
  toggleTrackVisibility: (trackId: string) => void;
  setWaveformData: (data: WaveformData | null) => void;

  // UI state
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  toggleAdjustmentsPanel: () => void;
  toggleMediaPool: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const initialState: VideoToolState = {
  sources: [],
  activeSourceId: null,
  playback: DEFAULT_PLAYBACK_STATE,
  adjustments: DEFAULT_ADJUSTMENTS,
  markers: [],
  gridLayout: '1x1',
  cameraSlots: getDefaultCameraSlots('1x1'),
  tracks: DEFAULT_TRACKS,
  visibleTimeRange: { start: 0, end: 60 },
  zoom: 50,
  waveformData: null,
  isLoading: false,
  isProcessing: false,
  error: null,
  adjustmentsPanelVisible: true,
  mediaPoolVisible: true,
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useVideoToolStore = create<VideoToolState & VideoToolActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Source management
      addSource: (source) => {
        const id = generateId();
        set((state) => {
          state.sources.push({
            ...source,
            id,
            createdAt: new Date(),
          });
          // Auto-select first source
          if (state.sources.length === 1) {
            state.activeSourceId = id;
            state.playback.duration = source.duration;
            state.visibleTimeRange = { start: 0, end: Math.min(source.duration, 60) };
          }
        });
        return id;
      },

      removeSource: (id) => {
        set((state) => {
          state.sources = state.sources.filter((s) => s.id !== id);
          if (state.activeSourceId === id) {
            state.activeSourceId = state.sources[0]?.id ?? null;
          }
          // Remove from camera slots
          state.cameraSlots = state.cameraSlots.map((slot) =>
            slot.sourceId === id ? { ...slot, sourceId: null } : slot
          );
        });
      },

      setActiveSource: (id) => {
        set((state) => {
          state.activeSourceId = id;
          const source = state.sources.find((s) => s.id === id);
          if (source) {
            state.playback.duration = source.duration;
            state.playback.totalFrames = Math.floor(source.duration * source.fps);
            state.playback.currentTime = 0;
            state.playback.currentFrame = 0;
            state.visibleTimeRange = { start: 0, end: Math.min(source.duration, 60) };
          }
        });
      },

      updateSource: (id, updates) => {
        set((state) => {
          const source = state.sources.find((s) => s.id === id);
          if (source) {
            Object.assign(source, updates);
          }
        });
      },

      // Playback controls
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

      togglePlayPause: () => {
        set((state) => {
          state.playback.isPlaying = !state.playback.isPlaying;
        });
      },

      seek: (time) => {
        set((state) => {
          const clampedTime = Math.max(0, Math.min(time, state.playback.duration));
          state.playback.currentTime = clampedTime;
          // Update frame number based on active source fps
          const source = state.sources.find((s) => s.id === state.activeSourceId);
          const fps = source?.fps ?? 30;
          state.playback.currentFrame = Math.floor(clampedTime * fps);
        });
      },

      seekToFrame: (frame) => {
        set((state) => {
          const source = state.sources.find((s) => s.id === state.activeSourceId);
          const fps = source?.fps ?? 30;
          const time = frame / fps;
          const clampedTime = Math.max(0, Math.min(time, state.playback.duration));
          state.playback.currentTime = clampedTime;
          state.playback.currentFrame = Math.floor(clampedTime * fps);
        });
      },

      stepFrame: (direction) => {
        set((state) => {
          const source = state.sources.find((s) => s.id === state.activeSourceId);
          const fps = source?.fps ?? 30;
          const frameDuration = 1 / fps;
          const newTime = state.playback.currentTime + direction * frameDuration;
          const clampedTime = Math.max(0, Math.min(newTime, state.playback.duration));
          state.playback.currentTime = clampedTime;
          state.playback.currentFrame = Math.floor(clampedTime * fps);
        });
      },

      setSpeed: (speed) => {
        set((state) => {
          state.playback.speed = speed;
        });
      },

      setVolume: (volume) => {
        set((state) => {
          state.playback.volume = Math.max(0, Math.min(1, volume));
        });
      },

      toggleMute: () => {
        set((state) => {
          state.playback.muted = !state.playback.muted;
        });
      },

      toggleLoop: () => {
        set((state) => {
          state.playback.looping = !state.playback.looping;
        });
      },

      updatePlaybackTime: (time) => {
        set((state) => {
          state.playback.currentTime = time;
          const source = state.sources.find((s) => s.id === state.activeSourceId);
          const fps = source?.fps ?? 30;
          state.playback.currentFrame = Math.floor(time * fps);
        });
      },

      setDuration: (duration, fps = 30) => {
        set((state) => {
          state.playback.duration = duration;
          state.playback.totalFrames = Math.floor(duration * fps);
        });
      },

      // Adjustments
      setAdjustment: (key, value) => {
        set((state) => {
          state.adjustments[key] = value;
        });
      },

      setFilter: (filter) => {
        set((state) => {
          state.adjustments.activeFilter = filter;
        });
      },

      resetAdjustments: () => {
        set((state) => {
          state.adjustments = { ...DEFAULT_ADJUSTMENTS };
        });
      },

      // Markers
      addMarker: (marker) => {
        const id = generateId();
        const now = new Date();
        set((state) => {
          state.markers.push({
            ...marker,
            id,
            createdAt: now,
            updatedAt: now,
          });
          // Sort markers by time
          state.markers.sort((a, b) => a.time - b.time);
        });
        return id;
      },

      updateMarker: (id, updates) => {
        set((state) => {
          const marker = state.markers.find((m) => m.id === id);
          if (marker) {
            Object.assign(marker, updates, { updatedAt: new Date() });
          }
          // Re-sort if time changed
          if (updates.time !== undefined) {
            state.markers.sort((a, b) => a.time - b.time);
          }
        });
      },

      removeMarker: (id) => {
        set((state) => {
          state.markers = state.markers.filter((m) => m.id !== id);
        });
      },

      addMarkerAtCurrentTime: (label) => {
        const { playback, markers } = get();
        const id = generateId();
        const now = new Date();
        const markerLabel = label || `Marker ${markers.length + 1}`;

        set((state) => {
          state.markers.push({
            id,
            time: playback.currentTime,
            label: markerLabel,
            color: '#ffc107',
            userId: 'current-user',
            tags: [],
            createdAt: now,
            updatedAt: now,
          });
          state.markers.sort((a, b) => a.time - b.time);
        });

        return id;
      },

      // Camera grid
      setGridLayout: (layout) => {
        set((state) => {
          state.gridLayout = layout;
          state.cameraSlots = getDefaultCameraSlots(layout);
          // Preserve source assignments where possible
          const oldSlots = state.cameraSlots;
          state.cameraSlots = state.cameraSlots.map((slot, index) => ({
            ...slot,
            sourceId: oldSlots[index]?.sourceId ?? null,
          }));
        });
      },

      assignSourceToSlot: (slotIndex, sourceId) => {
        set((state) => {
          const slot = state.cameraSlots.find((s) => s.index === slotIndex);
          if (slot) {
            slot.sourceId = sourceId;
          }
        });
      },

      toggleSlotSync: (slotIndex) => {
        set((state) => {
          const slot = state.cameraSlots.find((s) => s.index === slotIndex);
          if (slot) {
            slot.syncEnabled = !slot.syncEnabled;
          }
        });
      },

      toggleSlotMute: (slotIndex) => {
        set((state) => {
          const slot = state.cameraSlots.find((s) => s.index === slotIndex);
          if (slot) {
            slot.muted = !slot.muted;
          }
        });
      },

      // Timeline
      setVisibleTimeRange: (range) => {
        set((state) => {
          state.visibleTimeRange = range;
        });
      },

      setZoom: (zoom) => {
        set((state) => {
          state.zoom = Math.max(10, Math.min(zoom, 500));
        });
      },

      toggleTrackVisibility: (trackId) => {
        set((state) => {
          const track = state.tracks.find((t) => t.id === trackId);
          if (track) {
            track.visible = !track.visible;
          }
        });
      },

      setWaveformData: (data) => {
        set((state) => {
          state.waveformData = data;
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

      toggleAdjustmentsPanel: () => {
        set((state) => {
          state.adjustmentsPanelVisible = !state.adjustmentsPanelVisible;
        });
      },

      toggleMediaPool: () => {
        set((state) => {
          state.mediaPoolVisible = !state.mediaPoolVisible;
        });
      },

      // Reset
      reset: () => {
        set((state) => {
          Object.assign(state, initialState);
        });
      },
    })),
    {
      name: 'tacctile-video-tool',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist preferences, not data
        adjustments: state.adjustments,
        gridLayout: state.gridLayout,
        zoom: state.zoom,
        adjustmentsPanelVisible: state.adjustmentsPanelVisible,
        mediaPoolVisible: state.mediaPoolVisible,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<VideoToolState> | undefined;
        if (!persisted) return currentState;

        return {
          ...currentState,
          adjustments: persisted.adjustments ?? currentState.adjustments,
          gridLayout: persisted.gridLayout ?? currentState.gridLayout,
          zoom: persisted.zoom ?? currentState.zoom,
          adjustmentsPanelVisible: persisted.adjustmentsPanelVisible ?? currentState.adjustmentsPanelVisible,
          mediaPoolVisible: persisted.mediaPoolVisible ?? currentState.mediaPoolVisible,
          // Regenerate camera slots for persisted layout
          cameraSlots: getDefaultCameraSlots(persisted.gridLayout ?? currentState.gridLayout),
        };
      },
    }
  )
);

// ============================================================================
// MEMOIZED SELECTORS (using reselect to prevent error #185)
// ============================================================================

// Base selectors
const selectSources = (state: VideoToolState) => state.sources;
const selectMarkers = (state: VideoToolState) => state.markers;
const selectVisibleTimeRange = (state: VideoToolState) => state.visibleTimeRange;
const selectActiveSourceId = (state: VideoToolState) => state.activeSourceId;
const selectCameraSlots = (state: VideoToolState) => state.cameraSlots;
const selectTracks = (state: VideoToolState) => state.tracks;

// Memoized selectors
export const selectActiveSource = createSelector(
  [selectSources, selectActiveSourceId],
  (sources, activeId) => sources.find((s) => s.id === activeId) ?? null
);

export const selectVisibleMarkers = createSelector(
  [selectMarkers, selectVisibleTimeRange],
  (markers, range) => markers.filter((m) => m.time >= range.start && m.time <= range.end)
);

export const selectAssignedSlots = createSelector(
  [selectCameraSlots],
  (slots) => slots.filter((s) => s.sourceId !== null)
);

export const selectVisibleTracks = createSelector(
  [selectTracks],
  (tracks) => tracks.filter((t) => t.visible)
);

export const selectSourceById = createSelector(
  [selectSources, (_: VideoToolState, id: string) => id],
  (sources, id) => sources.find((s) => s.id === id) ?? null
);

export const selectMarkersByTag = createSelector(
  [selectMarkers, (_: VideoToolState, tag: string) => tag],
  (markers, tag) => markers.filter((m) => m.tags.includes(tag))
);

export const selectSortedMarkers = createSelector(
  [selectMarkers],
  (markers) => [...markers].sort((a, b) => a.time - b.time)
);

// Simple selectors (no computation, stable references)
export const selectPlayback = (state: VideoToolState) => state.playback;
export const selectAdjustments = (state: VideoToolState) => state.adjustments;
export const selectGridLayout = (state: VideoToolState) => state.gridLayout;
export const selectZoom = (state: VideoToolState) => state.zoom;
export const selectWaveformData = (state: VideoToolState) => state.waveformData;
export const selectIsLoading = (state: VideoToolState) => state.isLoading;
export const selectIsProcessing = (state: VideoToolState) => state.isProcessing;
export const selectError = (state: VideoToolState) => state.error;
export const selectAdjustmentsPanelVisible = (state: VideoToolState) => state.adjustmentsPanelVisible;
export const selectMediaPoolVisible = (state: VideoToolState) => state.mediaPoolVisible;

export default useVideoToolStore;
