/**
 * Timeline Store
 * Zustand store for managing the chronological "truth" view of all investigation media
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createSelector } from 'reselect';
import type {
  TimelineState,
  TimelineActions,
  TimelineItem,
  DataLayer,
  DataLayerType,
  ZoomLevel,
  TimeRange,
  DeviceClockInfo,
} from '../types/timeline';
import {
  DEFAULT_DATA_LAYERS,
  ZOOM_LEVELS,
  FILE_TYPE_TO_LAYER,
  fileToTimelineItem,
} from '../types/timeline';
import type { ProjectFile, FileFlag } from '../types/index';

// ============================================================================
// MOCK DATA GENERATION (for development)
// ============================================================================

const generateMockData = (): { items: TimelineItem[]; timeRange: TimeRange } => {
  // Generate a timeline starting from 2 hours ago
  const baseTime = Date.now() - 2 * 60 * 60 * 1000;

  const mockItems: TimelineItem[] = [
    {
      id: 'timeline-video-1',
      fileId: 'video-1',
      type: 'video',
      title: 'Main Camera - Entry Hall',
      fileName: 'entry_hall_001.mp4',
      thumbnailUrl: undefined,
      capturedAt: baseTime,
      duration: 1800, // 30 minutes
      endAt: baseTime + 1800 * 1000,
      flags: [
        {
          id: 'flag-v1-1',
          type: 'shadow_figure',
          timestamp: 342,
          absoluteTimestamp: baseTime + 342 * 1000,
          title: 'Shadow movement detected',
          confidence: 'medium',
          userId: 'user-1',
          userDisplayName: 'John Doe',
        },
        {
          id: 'flag-v1-2',
          type: 'light_anomaly',
          timestamp: 1124,
          absoluteTimestamp: baseTime + 1124 * 1000,
          title: 'Orb-like light',
          confidence: 'low',
          userId: 'user-2',
          userDisplayName: 'Jane Smith',
        },
      ],
      flagCount: 2,
      hasEdits: true,
      capturedBy: 'user-1',
      deviceInfo: 'Sony A7IV',
      trackIndex: 0,
    },
    {
      id: 'timeline-audio-1',
      fileId: 'audio-1',
      type: 'audio',
      title: 'Audio Recording - Master Bedroom',
      fileName: 'master_bedroom_audio.wav',
      thumbnailUrl: undefined,
      capturedAt: baseTime + 15 * 60 * 1000, // 15 min after start
      duration: 2400, // 40 minutes
      endAt: baseTime + 15 * 60 * 1000 + 2400 * 1000,
      flags: [
        {
          id: 'flag-a1-1',
          type: 'audio_anomaly',
          timestamp: 482,
          absoluteTimestamp: baseTime + 15 * 60 * 1000 + 482 * 1000,
          title: 'Class A Audio Anomaly - Voice',
          confidence: 'high',
          userId: 'user-1',
          userDisplayName: 'John Doe',
        },
        {
          id: 'flag-a1-2',
          type: 'audio_anomaly',
          timestamp: 1256,
          absoluteTimestamp: baseTime + 15 * 60 * 1000 + 1256 * 1000,
          title: 'Whisper detected',
          confidence: 'medium',
          userId: 'user-1',
          userDisplayName: 'John Doe',
        },
        {
          id: 'flag-a1-3',
          type: 'audio_artifact',
          timestamp: 1890,
          absoluteTimestamp: baseTime + 15 * 60 * 1000 + 1890 * 1000,
          title: 'Unexplained knock',
          confidence: 'medium',
          userId: 'user-2',
          userDisplayName: 'Jane Smith',
        },
      ],
      flagCount: 3,
      hasEdits: true,
      capturedBy: 'user-1',
      deviceInfo: 'Zoom H6',
      trackIndex: 1,
    },
    {
      id: 'timeline-photo-1',
      fileId: 'photo-1',
      type: 'photo',
      title: 'Sensor Spike Location',
      fileName: 'sensor_spike_corner.jpg',
      thumbnailUrl: undefined,
      capturedAt: baseTime + 25 * 60 * 1000,
      duration: undefined,
      endAt: undefined,
      flags: [],
      flagCount: 0,
      hasEdits: false,
      capturedBy: 'user-2',
      deviceInfo: 'iPhone 15 Pro',
      trackIndex: 2,
    },
    {
      id: 'timeline-sensor-1',
      fileId: 'sensor-1',
      type: 'sensor_reading',
      title: 'Sensor Log - Full Session',
      fileName: 'sensor_log_session.csv',
      thumbnailUrl: undefined,
      capturedAt: baseTime,
      duration: 7200, // 2 hours
      endAt: baseTime + 7200 * 1000,
      flags: [
        {
          id: 'flag-sensor1-1',
          type: 'sensor_spike',
          timestamp: 1500,
          absoluteTimestamp: baseTime + 1500 * 1000,
          title: 'Spike to 8.5 mG',
          confidence: 'high',
          userId: 'user-1',
          userDisplayName: 'John Doe',
        },
      ],
      flagCount: 1,
      hasEdits: false,
      capturedBy: 'user-1',
      deviceInfo: 'K-II Meter',
      trackIndex: 3,
    },
    {
      id: 'timeline-thermal-1',
      fileId: 'thermal-1',
      type: 'thermal',
      title: 'Thermal Scan - Hallway',
      fileName: 'thermal_hallway.mp4',
      thumbnailUrl: undefined,
      capturedAt: baseTime + 45 * 60 * 1000,
      duration: 600, // 10 minutes
      endAt: baseTime + 45 * 60 * 1000 + 600 * 1000,
      flags: [
        {
          id: 'flag-th1-1',
          type: 'temperature_change',
          timestamp: 234,
          absoluteTimestamp: baseTime + 45 * 60 * 1000 + 234 * 1000,
          title: 'Cold spot - 12°F drop',
          confidence: 'high',
          userId: 'user-2',
          userDisplayName: 'Jane Smith',
        },
      ],
      flagCount: 1,
      hasEdits: false,
      capturedBy: 'user-2',
      deviceInfo: 'FLIR One Pro',
      trackIndex: 4,
    },
    {
      id: 'timeline-photo-2',
      fileId: 'photo-2',
      type: 'photo',
      title: 'Anomaly in Window',
      fileName: 'window_anomaly.jpg',
      thumbnailUrl: undefined,
      capturedAt: baseTime + 52 * 60 * 1000,
      duration: undefined,
      endAt: undefined,
      flags: [
        {
          id: 'flag-p2-1',
          type: 'visual_anomaly',
          timestamp: 0,
          absoluteTimestamp: baseTime + 52 * 60 * 1000,
          title: 'Figure in window reflection',
          confidence: 'low',
          userId: 'user-1',
          userDisplayName: 'John Doe',
        },
      ],
      flagCount: 1,
      hasEdits: true,
      capturedBy: 'user-1',
      deviceInfo: 'Canon EOS R5',
      trackIndex: 2,
    },
    {
      id: 'timeline-audio-2',
      fileId: 'audio-2',
      type: 'radio_sweep',
      title: 'Radio Sweep Session',
      fileName: 'radio_sweep_session.wav',
      thumbnailUrl: undefined,
      capturedAt: baseTime + 60 * 60 * 1000, // 1 hour in
      duration: 900, // 15 minutes
      endAt: baseTime + 60 * 60 * 1000 + 900 * 1000,
      flags: [
        {
          id: 'flag-rs1-1',
          type: 'audio_anomaly',
          timestamp: 156,
          absoluteTimestamp: baseTime + 60 * 60 * 1000 + 156 * 1000,
          title: 'Response to question',
          confidence: 'medium',
          userId: 'user-1',
          userDisplayName: 'John Doe',
        },
      ],
      flagCount: 1,
      hasEdits: false,
      capturedBy: 'user-1',
      deviceInfo: 'SB7 Radio Scanner',
      trackIndex: 5,
    },
  ];

  // Calculate time range
  let minTime = Infinity;
  let maxTime = -Infinity;

  mockItems.forEach((item) => {
    minTime = Math.min(minTime, item.capturedAt);
    const endTime = item.endAt || item.capturedAt;
    maxTime = Math.max(maxTime, endTime);
  });

  return {
    items: mockItems,
    timeRange: { start: minTime, end: maxTime },
  };
};

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: TimelineState = {
  investigationId: null,
  investigationTitle: '',
  items: [],
  isLoading: false,
  error: null,
  fullTimeRange: null,
  visibleTimeRange: null,
  zoomLevel: ZOOM_LEVELS[1], // Minutes view by default
  scrollPosition: 0,
  dataLayers: DEFAULT_DATA_LAYERS,
  selectedItemId: null,
  hoveredItemId: null,
  playheadPosition: null,
  isPlaying: false,
  playbackSpeed: 1,
  clockSyncPrompt: {
    shown: false,
    acknowledged: false,
    devices: [],
  },
  lastRefreshedAt: null,
  autoRefreshEnabled: false,
  autoRefreshIntervalMs: 30000, // 30 seconds
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const calculateTimeRange = (items: TimelineItem[]): TimeRange | null => {
  if (items.length === 0) return null;

  let minTime = Infinity;
  let maxTime = -Infinity;

  items.forEach((item) => {
    minTime = Math.min(minTime, item.capturedAt);
    const endTime = item.endAt || item.capturedAt;
    maxTime = Math.max(maxTime, endTime);
  });

  // Add 5% padding on each side
  const padding = (maxTime - minTime) * 0.05;
  return {
    start: minTime - padding,
    end: maxTime + padding,
  };
};

const updateLayerCounts = (items: TimelineItem[], layers: DataLayer[]): DataLayer[] => {
  const counts: Record<DataLayerType, number> = {
    video: 0,
    audio: 0,
    photo: 0,
    sensor: 0,
    thermal: 0,
    motion: 0,
    radio_sweep: 0,
    flags: 0,
    user_markers: 0,
  };

  items.forEach((item) => {
    const layerType = FILE_TYPE_TO_LAYER[item.type];
    if (layerType) {
      counts[layerType]++;
    }
    counts.flags += item.flagCount;
  });

  return layers.map((layer) => ({
    ...layer,
    itemCount: counts[layer.id] || 0,
  }));
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useTimelineStore = create<TimelineState & TimelineActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Data loading
      loadTimeline: async (investigationId: string) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
          state.investigationId = investigationId;
        });

        try {
          // TODO: Replace with actual API call
          // const investigation = await supabaseService.getInvestigation(investigationId);
          // const files = await supabaseService.getFilesForInvestigation(investigationId);
          // const flags = await fileFlaggingService.getFlagsForInvestigation(investigationId);

          // For now, use mock data
          await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay
          const { items, timeRange } = generateMockData();

          set((state) => {
            state.items = items;
            state.investigationTitle = 'Historic Mansion Investigation';
            state.fullTimeRange = timeRange;
            state.visibleTimeRange = timeRange;
            state.dataLayers = updateLayerCounts(items, state.dataLayers);
            state.isLoading = false;
            state.lastRefreshedAt = new Date();

            // Show clock sync prompt if not already acknowledged
            if (!state.clockSyncPrompt.acknowledged) {
              state.clockSyncPrompt.shown = true;
              state.clockSyncPrompt.devices = [
                {
                  deviceId: 'device-1',
                  deviceName: 'Sony A7IV',
                  syncStatus: 'unverified',
                },
                {
                  deviceId: 'device-2',
                  deviceName: 'Zoom H6',
                  syncStatus: 'unverified',
                },
                {
                  deviceId: 'device-3',
                  deviceName: 'FLIR One Pro',
                  syncStatus: 'unverified',
                },
              ];
            }
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load timeline';
            state.isLoading = false;
          });
        }
      },

      refreshTimeline: async () => {
        const { investigationId } = get();
        if (!investigationId) return;

        set((state) => {
          state.isLoading = true;
        });

        try {
          // TODO: Replace with actual API call
          await new Promise((resolve) => setTimeout(resolve, 300));

          set((state) => {
            state.lastRefreshedAt = new Date();
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to refresh timeline';
            state.isLoading = false;
          });
        }
      },

      importFromHub: async () => {
        set((state) => {
          state.isLoading = true;
        });

        try {
          // TODO: Implement hub import
          await new Promise((resolve) => setTimeout(resolve, 1000));

          set((state) => {
            state.isLoading = false;
            state.lastRefreshedAt = new Date();
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to import from hub';
            state.isLoading = false;
          });
        }
      },

      // Zoom & navigation
      setZoomLevel: (level: ZoomLevel) => {
        set((state) => {
          state.zoomLevel = level;
        });
      },

      zoomIn: () => {
        const { zoomLevel } = get();
        const currentIndex = ZOOM_LEVELS.findIndex((z) => z.id === zoomLevel.id);
        if (currentIndex > 0) {
          set((state) => {
            state.zoomLevel = ZOOM_LEVELS[currentIndex - 1];
          });
        }
      },

      zoomOut: () => {
        const { zoomLevel } = get();
        const currentIndex = ZOOM_LEVELS.findIndex((z) => z.id === zoomLevel.id);
        if (currentIndex < ZOOM_LEVELS.length - 1) {
          set((state) => {
            state.zoomLevel = ZOOM_LEVELS[currentIndex + 1];
          });
        }
      },

      fitToView: () => {
        const { fullTimeRange } = get();
        set((state) => {
          state.visibleTimeRange = fullTimeRange;
          state.zoomLevel = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]; // Overview
          state.scrollPosition = 0;
        });
      },

      scrollTo: (timestamp: number) => {
        const { fullTimeRange, zoomLevel } = get();
        if (!fullTimeRange) return;

        // Calculate scroll position based on timestamp
        const totalDuration = fullTimeRange.end - fullTimeRange.start;
        const offsetMs = timestamp - fullTimeRange.start;
        const totalPixels = (totalDuration / 1000) * zoomLevel.pixelsPerSecond;
        const scrollPosition = (offsetMs / 1000) * zoomLevel.pixelsPerSecond;

        set((state) => {
          state.scrollPosition = Math.max(0, scrollPosition - 200); // Center with 200px offset
          state.playheadPosition = timestamp;
        });
      },

      setScrollPosition: (position: number) => {
        set((state) => {
          state.scrollPosition = Math.max(0, position);
        });
      },

      // Data layers
      toggleDataLayer: (layerId: DataLayerType) => {
        set((state) => {
          const layer = state.dataLayers.find((l) => l.id === layerId);
          if (layer) {
            layer.visible = !layer.visible;
          }
        });
      },

      setDataLayerVisibility: (layerId: DataLayerType, visible: boolean) => {
        set((state) => {
          const layer = state.dataLayers.find((l) => l.id === layerId);
          if (layer) {
            layer.visible = visible;
          }
        });
      },

      showAllLayers: () => {
        set((state) => {
          state.dataLayers.forEach((layer) => {
            layer.visible = true;
          });
        });
      },

      hideAllLayers: () => {
        set((state) => {
          state.dataLayers.forEach((layer) => {
            layer.visible = false;
          });
        });
      },

      // Selection
      selectItem: (itemId: string | null) => {
        set((state) => {
          state.selectedItemId = itemId;
        });
      },

      setHoveredItem: (itemId: string | null) => {
        set((state) => {
          state.hoveredItemId = itemId;
        });
      },

      // Playhead
      setPlayheadPosition: (timestamp: number | null) => {
        set((state) => {
          state.playheadPosition = timestamp;
        });
      },

      togglePlayback: () => {
        set((state) => {
          state.isPlaying = !state.isPlaying;
        });
      },

      setPlaybackSpeed: (speed: number) => {
        set((state) => {
          state.playbackSpeed = Math.max(0.25, Math.min(speed, 4));
        });
      },

      // Clock sync
      showClockSyncPrompt: () => {
        set((state) => {
          state.clockSyncPrompt.shown = true;
        });
      },

      acknowledgeClockSync: () => {
        set((state) => {
          state.clockSyncPrompt.acknowledged = true;
          state.clockSyncPrompt.acknowledgedAt = new Date();
          state.clockSyncPrompt.shown = false;
        });
      },

      verifyDeviceClock: async (deviceId: string) => {
        // TODO: Implement actual clock verification
        set((state) => {
          const device = state.clockSyncPrompt.devices.find((d) => d.deviceId === deviceId);
          if (device) {
            device.syncStatus = 'verified';
            device.lastVerifiedAt = new Date();
          }
        });
      },

      // Auto-refresh
      setAutoRefresh: (enabled: boolean) => {
        set((state) => {
          state.autoRefreshEnabled = enabled;
        });
      },

      setAutoRefreshInterval: (intervalMs: number) => {
        set((state) => {
          state.autoRefreshIntervalMs = Math.max(5000, intervalMs); // Minimum 5 seconds
        });
      },

      // Reset
      reset: () => {
        set((state) => {
          Object.assign(state, {
            ...initialState,
            // Keep user preferences
            zoomLevel: state.zoomLevel,
            autoRefreshEnabled: state.autoRefreshEnabled,
            autoRefreshIntervalMs: state.autoRefreshIntervalMs,
          });
        });
      },
    })),
    {
      name: 'tacctile-timeline',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user preferences - never persist dynamic data
        zoomLevel: state.zoomLevel,
        autoRefreshEnabled: state.autoRefreshEnabled,
        autoRefreshIntervalMs: state.autoRefreshIntervalMs,
        clockSyncPrompt: {
          acknowledged: state.clockSyncPrompt.acknowledged,
          acknowledgedAt: state.clockSyncPrompt.acknowledgedAt,
        },
      }),
      // Merge function to safely handle hydration without overwriting runtime state
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TimelineState> | undefined;
        if (!persisted) return currentState;

        return {
          ...currentState,
          // Only restore preferences, not data
          zoomLevel: persisted.zoomLevel ?? currentState.zoomLevel,
          autoRefreshEnabled: persisted.autoRefreshEnabled ?? currentState.autoRefreshEnabled,
          autoRefreshIntervalMs: persisted.autoRefreshIntervalMs ?? currentState.autoRefreshIntervalMs,
          clockSyncPrompt: {
            ...currentState.clockSyncPrompt,
            acknowledged: (persisted.clockSyncPrompt as { acknowledged?: boolean } | undefined)?.acknowledged ?? currentState.clockSyncPrompt.acknowledged,
            acknowledgedAt: (persisted.clockSyncPrompt as { acknowledgedAt?: Date } | undefined)?.acknowledgedAt ?? currentState.clockSyncPrompt.acknowledgedAt,
          },
        };
      },
    }
  )
);

// ============================================================================
// SELECTOR FUNCTIONS
// ============================================================================

export const selectTimelineItems = (state: TimelineState) => state.items;
export const selectDataLayers = (state: TimelineState) => state.dataLayers;
export const selectZoomLevel = (state: TimelineState) => state.zoomLevel;
export const selectTimeRange = (state: TimelineState) => state.fullTimeRange;
export const selectVisibleTimeRange = (state: TimelineState) => state.visibleTimeRange;
export const selectPlayheadPosition = (state: TimelineState) => state.playheadPosition;
export const selectIsPlaying = (state: TimelineState) => state.isPlaying;
export const selectClockSyncPrompt = (state: TimelineState) => state.clockSyncPrompt;
export const selectTimelineLoading = (state: TimelineState) => state.isLoading;
export const selectTimelineError = (state: TimelineState) => state.error;
export const selectInvestigationTitle = (state: TimelineState) => state.investigationTitle;

// Memoized selector for visible items - prevents new array reference on every call
export const selectVisibleItems = createSelector(
  [(state: TimelineState) => state.items, (state: TimelineState) => state.dataLayers],
  (items, dataLayers) => {
    const visibleLayerIds = dataLayers.filter((l) => l.visible).map((l) => l.id);
    return items.filter((item) => {
      const layerType = FILE_TYPE_TO_LAYER[item.type];
      return visibleLayerIds.includes(layerType);
    });
  }
);

// Memoized selector for selected item - prevents unnecessary re-renders
export const selectSelectedItem = createSelector(
  [(state: TimelineState) => state.items, (state: TimelineState) => state.selectedItemId],
  (items, selectedItemId) => {
    if (!selectedItemId) return null;
    return items.find((item) => item.id === selectedItemId) || null;
  }
);

// Memoized selector for hovered item - prevents unnecessary re-renders
export const selectHoveredItem = createSelector(
  [(state: TimelineState) => state.items, (state: TimelineState) => state.hoveredItemId],
  (items, hoveredItemId) => {
    if (!hoveredItemId) return null;
    return items.find((item) => item.id === hoveredItemId) || null;
  }
);

export default useTimelineStore;
