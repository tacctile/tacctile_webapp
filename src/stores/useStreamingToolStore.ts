/**
 * Streaming Tool Store
 * Zustand store for OBS-inspired streaming functionality
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  StreamingToolState,
  StreamingToolActions,
  Scene,
  Source,
  SourceTransform,
  StreamDestination,
  StreamSettings,
  RecordingSettings,
  Recording,
  AudioSource,
  SceneTransition,
  StreamStats,
  StreamingMode,
  ViewMode,
  DEFAULT_STREAM_SETTINGS,
  DEFAULT_RECORDING_SETTINGS,
  DEFAULT_TRANSITION,
  DEFAULT_AUDIO_MIXER,
} from '../types/streaming';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Initial state
const initialState: StreamingToolState = {
  mode: 'setup',
  viewMode: 'studio',
  scenes: [],
  activeSceneId: null,
  previewSceneId: null,
  transition: DEFAULT_TRANSITION,
  selectedSourceId: null,
  availableDevices: [],
  isStreaming: false,
  streamStartTime: null,
  destinations: [],
  streamSettings: DEFAULT_STREAM_SETTINGS,
  isRecording: false,
  recordingStartTime: null,
  recordings: [],
  recordingSettings: DEFAULT_RECORDING_SETTINGS,
  audioMixer: DEFAULT_AUDIO_MIXER,
  previewEnabled: true,
  previewVolume: 0.5,
  streamStats: null,
};

// Create the store
export const useStreamingToolStore = create<StreamingToolState & StreamingToolActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // ========================================================================
      // Scene Management
      // ========================================================================

      createScene: (name: string) => {
        const id = generateId();
        const scene: Scene = {
          id,
          name,
          sources: [],
          groups: [],
          isDefault: get().scenes.length === 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => {
          state.scenes.push(scene);
          if (state.scenes.length === 1) {
            state.activeSceneId = id;
            state.previewSceneId = id;
          }
        });

        return id;
      },

      deleteScene: (sceneId: string) => {
        set((state) => {
          const index = state.scenes.findIndex((s) => s.id === sceneId);
          if (index !== -1) {
            state.scenes.splice(index, 1);
            if (state.activeSceneId === sceneId) {
              state.activeSceneId = state.scenes[0]?.id || null;
            }
            if (state.previewSceneId === sceneId) {
              state.previewSceneId = state.scenes[0]?.id || null;
            }
          }
        });
      },

      duplicateScene: (sceneId: string) => {
        const scene = get().scenes.find((s) => s.id === sceneId);
        if (!scene) return '';

        const id = generateId();
        const newScene: Scene = {
          ...JSON.parse(JSON.stringify(scene)),
          id,
          name: `${scene.name} (Copy)`,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          sources: scene.sources.map((source) => ({
            ...source,
            id: generateId(),
          })),
        };

        set((state) => {
          state.scenes.push(newScene);
        });

        return id;
      },

      renameScene: (sceneId: string, name: string) => {
        set((state) => {
          const scene = state.scenes.find((s) => s.id === sceneId);
          if (scene) {
            scene.name = name;
            scene.updatedAt = new Date();
          }
        });
      },

      setActiveScene: (sceneId: string) => {
        set((state) => {
          state.activeSceneId = sceneId;
        });
      },

      setPreviewScene: (sceneId: string) => {
        set((state) => {
          state.previewSceneId = sceneId;
        });
      },

      reorderScenes: (sceneIds: string[]) => {
        set((state) => {
          const scenesMap = new Map(state.scenes.map((s) => [s.id, s]));
          state.scenes = sceneIds.map((id) => scenesMap.get(id)).filter(Boolean) as Scene[];
        });
      },

      // ========================================================================
      // Source Management
      // ========================================================================

      addSource: (sceneId: string, source: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>) => {
        const id = generateId();
        const newSource: Source = {
          ...source,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => {
          const scene = state.scenes.find((s) => s.id === sceneId);
          if (scene) {
            newSource.zIndex = scene.sources.length;
            scene.sources.push(newSource);
            scene.updatedAt = new Date();
          }
        });

        return id;
      },

      removeSource: (sceneId: string, sourceId: string) => {
        set((state) => {
          const scene = state.scenes.find((s) => s.id === sceneId);
          if (scene) {
            const index = scene.sources.findIndex((s) => s.id === sourceId);
            if (index !== -1) {
              scene.sources.splice(index, 1);
              scene.updatedAt = new Date();
            }
            if (state.selectedSourceId === sourceId) {
              state.selectedSourceId = null;
            }
          }
        });
      },

      updateSource: (sceneId: string, sourceId: string, updates: Partial<Source>) => {
        set((state) => {
          const scene = state.scenes.find((s) => s.id === sceneId);
          if (scene) {
            const source = scene.sources.find((s) => s.id === sourceId);
            if (source) {
              Object.assign(source, updates, { updatedAt: new Date() });
              scene.updatedAt = new Date();
            }
          }
        });
      },

      updateSourceTransform: (sceneId: string, sourceId: string, transform: Partial<SourceTransform>) => {
        set((state) => {
          const scene = state.scenes.find((s) => s.id === sceneId);
          if (scene) {
            const source = scene.sources.find((s) => s.id === sourceId);
            if (source) {
              Object.assign(source.transform, transform);
              source.updatedAt = new Date();
              scene.updatedAt = new Date();
            }
          }
        });
      },

      selectSource: (sourceId: string | null) => {
        set((state) => {
          state.selectedSourceId = sourceId;
        });
      },

      reorderSources: (sceneId: string, sourceIds: string[]) => {
        set((state) => {
          const scene = state.scenes.find((s) => s.id === sceneId);
          if (scene) {
            const sourcesMap = new Map(scene.sources.map((s) => [s.id, s]));
            scene.sources = sourceIds.map((id, index) => {
              const source = sourcesMap.get(id);
              if (source) {
                source.zIndex = index;
              }
              return source;
            }).filter(Boolean) as Source[];
            scene.updatedAt = new Date();
          }
        });
      },

      // ========================================================================
      // Transition
      // ========================================================================

      setTransition: (transition: Partial<SceneTransition>) => {
        set((state) => {
          Object.assign(state.transition, transition);
        });
      },

      executeTransition: () => {
        const { previewSceneId, mode } = get();
        if (previewSceneId && mode === 'live') {
          set((state) => {
            state.activeSceneId = previewSceneId;
          });
        }
      },

      // ========================================================================
      // Streaming
      // ========================================================================

      startStreaming: async () => {
        set((state) => {
          state.isStreaming = true;
          state.streamStartTime = new Date();
          state.mode = 'live';
          state.destinations.forEach((dest) => {
            if (dest.enabled) {
              dest.status = 'connecting';
            }
          });
        });
      },

      stopStreaming: () => {
        set((state) => {
          state.isStreaming = false;
          state.streamStartTime = null;
          state.destinations.forEach((dest) => {
            dest.status = 'disconnected';
          });
        });
      },

      updateStreamSettings: (settings: Partial<StreamSettings>) => {
        set((state) => {
          Object.assign(state.streamSettings, settings);
        });
      },

      // ========================================================================
      // Destinations
      // ========================================================================

      addDestination: (destination: Omit<StreamDestination, 'id' | 'status'>) => {
        const id = generateId();
        const newDestination: StreamDestination = {
          ...destination,
          id,
          status: 'disconnected',
        };

        set((state) => {
          state.destinations.push(newDestination);
        });

        return id;
      },

      removeDestination: (destinationId: string) => {
        set((state) => {
          const index = state.destinations.findIndex((d) => d.id === destinationId);
          if (index !== -1) {
            state.destinations.splice(index, 1);
          }
        });
      },

      updateDestination: (destinationId: string, updates: Partial<StreamDestination>) => {
        set((state) => {
          const destination = state.destinations.find((d) => d.id === destinationId);
          if (destination) {
            Object.assign(destination, updates);
          }
        });
      },

      toggleDestination: (destinationId: string) => {
        set((state) => {
          const destination = state.destinations.find((d) => d.id === destinationId);
          if (destination) {
            destination.enabled = !destination.enabled;
          }
        });
      },

      testDestination: async (destinationId: string) => {
        // In a real implementation, this would test the RTMP connection
        // For now, we'll simulate a test
        const destination = get().destinations.find((d) => d.id === destinationId);
        if (!destination) return false;

        set((state) => {
          const dest = state.destinations.find((d) => d.id === destinationId);
          if (dest) dest.status = 'connecting';
        });

        // Simulate connection test
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const success = !!(destination.serverUrl && destination.streamKey);

        set((state) => {
          const dest = state.destinations.find((d) => d.id === destinationId);
          if (dest) {
            dest.status = success ? 'connected' : 'error';
            if (!success) {
              dest.error = 'Invalid server URL or stream key';
            } else {
              dest.error = undefined;
              dest.lastConnectedAt = new Date();
            }
          }
        });

        // Reset status after showing result
        setTimeout(() => {
          set((state) => {
            const dest = state.destinations.find((d) => d.id === destinationId);
            if (dest && dest.status !== 'error') {
              dest.status = 'disconnected';
            }
          });
        }, 3000);

        return success;
      },

      // ========================================================================
      // Recording
      // ========================================================================

      startRecording: async () => {
        set((state) => {
          state.isRecording = true;
          state.recordingStartTime = new Date();
        });
      },

      stopRecording: async () => {
        const { recordingStartTime, activeSceneId, recordingSettings } = get();
        if (!recordingStartTime) return null;

        const duration = (Date.now() - recordingStartTime.getTime()) / 1000;
        const recording: Recording = {
          id: generateId(),
          sceneId: activeSceneId || '',
          filename: `recording-${Date.now()}.${recordingSettings.format}`,
          format: recordingSettings.format,
          duration,
          fileSize: Math.round(duration * recordingSettings.videoBitrate / 8), // Approximate
          storageType: recordingSettings.storageType === 'cloud' ? 'cloud' : 'local',
          startedAt: recordingStartTime,
          endedAt: new Date(),
          status: 'completed',
        };

        set((state) => {
          state.isRecording = false;
          state.recordingStartTime = null;
          state.recordings.push(recording);
        });

        return recording;
      },

      pauseRecording: () => {
        // Implementation for pause would be handled by MediaRecorder
      },

      resumeRecording: () => {
        // Implementation for resume would be handled by MediaRecorder
      },

      updateRecordingSettings: (settings: Partial<RecordingSettings>) => {
        set((state) => {
          Object.assign(state.recordingSettings, settings);
        });
      },

      saveReplayBuffer: async () => {
        // In a real implementation, this would save the replay buffer
        return null;
      },

      // ========================================================================
      // Audio
      // ========================================================================

      updateAudioSource: (sourceId: string, updates: Partial<AudioSource>) => {
        set((state) => {
          const source = state.audioMixer.sources.find((s) => s.id === sourceId);
          if (source) {
            Object.assign(source, updates);
          }
        });
      },

      addAudioSource: (source: Omit<AudioSource, 'id'>) => {
        const id = generateId();
        const newSource: AudioSource = { ...source, id };

        set((state) => {
          state.audioMixer.sources.push(newSource);
        });

        return id;
      },

      removeAudioSource: (sourceId: string) => {
        set((state) => {
          const index = state.audioMixer.sources.findIndex((s) => s.id === sourceId);
          if (index !== -1) {
            state.audioMixer.sources.splice(index, 1);
          }
        });
      },

      setMasterVolume: (volume: number) => {
        set((state) => {
          state.audioMixer.masterVolume = Math.max(0, Math.min(1, volume));
        });
      },

      setMasterMuted: (muted: boolean) => {
        set((state) => {
          state.audioMixer.masterMuted = muted;
        });
      },

      // ========================================================================
      // Mode and View
      // ========================================================================

      setMode: (mode: StreamingMode) => {
        set((state) => {
          state.mode = mode;
        });
      },

      setViewMode: (viewMode: ViewMode) => {
        set((state) => {
          state.viewMode = viewMode;
        });
      },

      setPreviewEnabled: (enabled: boolean) => {
        set((state) => {
          state.previewEnabled = enabled;
        });
      },

      // ========================================================================
      // Devices
      // ========================================================================

      refreshDevices: async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          set((state) => {
            state.availableDevices = devices;
          });
        } catch (error) {
          console.error('Failed to enumerate devices:', error);
        }
      },

      // ========================================================================
      // Stats
      // ========================================================================

      updateStreamStats: (stats: Partial<StreamStats>) => {
        set((state) => {
          if (state.streamStats) {
            Object.assign(state.streamStats, stats);
          } else {
            state.streamStats = {
              fps: 0,
              droppedFrames: 0,
              totalFrames: 0,
              bitrate: 0,
              cpuUsage: 0,
              memoryUsage: 0,
              duration: 0,
              status: 'good',
              ...stats,
            };
          }
        });
      },

      // ========================================================================
      // Reset
      // ========================================================================

      resetStore: () => {
        set(initialState);
      },
    })),
    {
      name: 'streaming-tool-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist user configuration - reset connection states
        scenes: state.scenes,
        destinations: state.destinations.map((d) => ({ ...d, status: 'disconnected' as const })),
        streamSettings: state.streamSettings,
        recordingSettings: state.recordingSettings,
        transition: state.transition,
        viewMode: state.viewMode,
      }),
      // Merge function to safely handle hydration without overwriting runtime state
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<StreamingToolState> | undefined;
        if (!persisted) return currentState;

        return {
          ...currentState,
          // Only restore configuration, not runtime state
          scenes: persisted.scenes ?? currentState.scenes,
          destinations: (persisted.destinations ?? []).map((d) => ({
            ...d,
            status: 'disconnected' as const, // Always reset connection status
          })),
          streamSettings: persisted.streamSettings ?? currentState.streamSettings,
          recordingSettings: persisted.recordingSettings ?? currentState.recordingSettings,
          transition: persisted.transition ?? currentState.transition,
          viewMode: persisted.viewMode ?? currentState.viewMode,
          // Always reset streaming/recording state on load
          isStreaming: false,
          isRecording: false,
          streamStartTime: null,
          recordingStartTime: null,
        };
      },
    }
  )
);

// ============================================================================
// Selector Functions
// ============================================================================

// Scene selectors
export const selectScenes = (state: StreamingToolState) => state.scenes;
export const selectActiveSceneId = (state: StreamingToolState) => state.activeSceneId;
export const selectPreviewSceneId = (state: StreamingToolState) => state.previewSceneId;
export const selectActiveScene = (state: StreamingToolState) => {
  return state.scenes.find((s) => s.id === state.activeSceneId) || null;
};
export const selectPreviewScene = (state: StreamingToolState) => {
  return state.scenes.find((s) => s.id === state.previewSceneId) || null;
};

// Source selectors
export const selectSelectedSourceId = (state: StreamingToolState) => state.selectedSourceId;
export const selectSelectedSource = (state: StreamingToolState) => {
  const scene = state.scenes.find((s) => s.id === state.activeSceneId);
  return scene?.sources.find((s) => s.id === state.selectedSourceId) || null;
};

// Streaming selectors
export const selectIsStreaming = (state: StreamingToolState) => state.isStreaming;
export const selectStreamStartTime = (state: StreamingToolState) => state.streamStartTime;
export const selectDestinations = (state: StreamingToolState) => state.destinations;
export const selectStreamSettings = (state: StreamingToolState) => state.streamSettings;
export const selectStreamStats = (state: StreamingToolState) => state.streamStats;

// Recording selectors
export const selectIsRecording = (state: StreamingToolState) => state.isRecording;
export const selectRecordingStartTime = (state: StreamingToolState) => state.recordingStartTime;
export const selectRecordings = (state: StreamingToolState) => state.recordings;
export const selectRecordingSettings = (state: StreamingToolState) => state.recordingSettings;

// Audio selectors
export const selectAudioMixer = (state: StreamingToolState) => state.audioMixer;

// Mode selectors
export const selectStreamingMode = (state: StreamingToolState) => state.mode;
export const selectViewMode = (state: StreamingToolState) => state.viewMode;
export const selectPreviewEnabled = (state: StreamingToolState) => state.previewEnabled;

// Device selectors
export const selectAvailableDevices = (state: StreamingToolState) => state.availableDevices;

// Transition selectors
export const selectTransition = (state: StreamingToolState) => state.transition;
