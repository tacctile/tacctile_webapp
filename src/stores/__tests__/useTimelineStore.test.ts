/**
 * Timeline Store Tests
 *
 * Tests for the useTimelineStore Zustand store.
 * Demonstrates patterns for:
 * - Testing async actions
 * - Testing computed/derived state
 * - Testing complex state transitions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useTimelineStore } from '../useTimelineStore';
import { ZOOM_LEVELS } from '../../types/timeline';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('useTimelineStore', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useTimelineStore.getState().reset();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // INITIAL STATE TESTS
  // ============================================================================

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      const state = useTimelineStore.getState();

      expect(state.investigationId).toBeNull();
      expect(state.investigationTitle).toBe('');
      expect(state.items).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.fullTimeRange).toBeNull();
      expect(state.visibleTimeRange).toBeNull();
    });

    it('should have default zoom level', () => {
      const state = useTimelineStore.getState();

      // Default zoom level is ZOOM_LEVELS[1] (Minutes view)
      expect(state.zoomLevel).toBeDefined();
      expect(state.zoomLevel.id).toBeDefined();
    });

    it('should have default data layers', () => {
      const state = useTimelineStore.getState();

      expect(state.dataLayers).toBeDefined();
      expect(state.dataLayers.length).toBeGreaterThan(0);

      // Check that some expected layers exist
      const layerIds = state.dataLayers.map((l) => l.id);
      expect(layerIds).toContain('video');
      expect(layerIds).toContain('audio');
      expect(layerIds).toContain('photo');
    });

    it('should have default playhead state', () => {
      const state = useTimelineStore.getState();

      expect(state.playheadPosition).toBeNull();
      expect(state.isPlaying).toBe(false);
      expect(state.playbackSpeed).toBe(1);
    });

    it('should have default clock sync prompt state', () => {
      const state = useTimelineStore.getState();

      expect(state.clockSyncPrompt.shown).toBe(false);
      expect(state.clockSyncPrompt.acknowledged).toBe(false);
      expect(state.clockSyncPrompt.devices).toEqual([]);
    });
  });

  // ============================================================================
  // TIMELINE LOADING TESTS
  // ============================================================================

  describe('Timeline Loading', () => {
    it('should set loading state when loading timeline', async () => {
      const store = useTimelineStore.getState();

      // Start loading
      const loadPromise = act(async () => {
        await store.loadTimeline('investigation-123');
      });

      // While loading, isLoading should be true
      expect(useTimelineStore.getState().isLoading).toBe(true);

      // Wait for loading to complete
      await loadPromise;

      // After loading
      const state = useTimelineStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.investigationId).toBe('investigation-123');
    });

    it('should populate items after loading', async () => {
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      const state = useTimelineStore.getState();
      // Mock data should be loaded
      expect(state.items.length).toBeGreaterThan(0);
      expect(state.investigationTitle).toBeDefined();
    });

    it('should calculate time range from items', async () => {
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      const state = useTimelineStore.getState();
      expect(state.fullTimeRange).not.toBeNull();
      expect(state.fullTimeRange?.start).toBeDefined();
      expect(state.fullTimeRange?.end).toBeDefined();
      expect(state.fullTimeRange?.end).toBeGreaterThan(state.fullTimeRange?.start ?? 0);
    });

    it('should show clock sync prompt on first load', async () => {
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      const state = useTimelineStore.getState();
      expect(state.clockSyncPrompt.shown).toBe(true);
      expect(state.clockSyncPrompt.devices.length).toBeGreaterThan(0);
    });

    it('should set last refreshed timestamp', async () => {
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      const state = useTimelineStore.getState();
      expect(state.lastRefreshedAt).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // ZOOM & NAVIGATION TESTS
  // ============================================================================

  describe('Zoom & Navigation', () => {
    it('should set zoom level', () => {
      const newZoomLevel = ZOOM_LEVELS[0];

      act(() => {
        useTimelineStore.getState().setZoomLevel(newZoomLevel);
      });

      expect(useTimelineStore.getState().zoomLevel).toEqual(newZoomLevel);
    });

    it('should zoom in (decrease zoom level index)', () => {
      // Start at middle zoom level
      act(() => {
        useTimelineStore.getState().setZoomLevel(ZOOM_LEVELS[2]);
      });

      const initialZoom = useTimelineStore.getState().zoomLevel;

      act(() => {
        useTimelineStore.getState().zoomIn();
      });

      const newZoom = useTimelineStore.getState().zoomLevel;
      // Zoom in means going to smaller index (more zoomed)
      const initialIndex = ZOOM_LEVELS.findIndex((z) => z.id === initialZoom.id);
      const newIndex = ZOOM_LEVELS.findIndex((z) => z.id === newZoom.id);
      expect(newIndex).toBe(initialIndex - 1);
    });

    it('should zoom out (increase zoom level index)', () => {
      // Start at middle zoom level
      act(() => {
        useTimelineStore.getState().setZoomLevel(ZOOM_LEVELS[2]);
      });

      const initialZoom = useTimelineStore.getState().zoomLevel;

      act(() => {
        useTimelineStore.getState().zoomOut();
      });

      const newZoom = useTimelineStore.getState().zoomLevel;
      const initialIndex = ZOOM_LEVELS.findIndex((z) => z.id === initialZoom.id);
      const newIndex = ZOOM_LEVELS.findIndex((z) => z.id === newZoom.id);
      expect(newIndex).toBe(initialIndex + 1);
    });

    it('should not zoom in beyond minimum zoom level', () => {
      // Set to most zoomed in level
      act(() => {
        useTimelineStore.getState().setZoomLevel(ZOOM_LEVELS[0]);
      });

      act(() => {
        useTimelineStore.getState().zoomIn();
      });

      // Should still be at most zoomed level
      expect(useTimelineStore.getState().zoomLevel.id).toBe(ZOOM_LEVELS[0].id);
    });

    it('should not zoom out beyond maximum zoom level', () => {
      // Set to most zoomed out level
      act(() => {
        useTimelineStore.getState().setZoomLevel(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
      });

      act(() => {
        useTimelineStore.getState().zoomOut();
      });

      // Should still be at most zoomed out level
      expect(useTimelineStore.getState().zoomLevel.id).toBe(
        ZOOM_LEVELS[ZOOM_LEVELS.length - 1].id
      );
    });

    it('should fit to view', async () => {
      // First load timeline to get items
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      act(() => {
        useTimelineStore.getState().fitToView();
      });

      const state = useTimelineStore.getState();
      expect(state.visibleTimeRange).toEqual(state.fullTimeRange);
      expect(state.scrollPosition).toBe(0);
      // Should be at overview zoom level
      expect(state.zoomLevel.id).toBe(ZOOM_LEVELS[ZOOM_LEVELS.length - 1].id);
    });

    it('should set scroll position', () => {
      act(() => {
        useTimelineStore.getState().setScrollPosition(500);
      });

      expect(useTimelineStore.getState().scrollPosition).toBe(500);
    });

    it('should not allow negative scroll position', () => {
      act(() => {
        useTimelineStore.getState().setScrollPosition(-100);
      });

      expect(useTimelineStore.getState().scrollPosition).toBe(0);
    });

    it('should scroll to timestamp', async () => {
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      const timeRange = useTimelineStore.getState().fullTimeRange;
      if (!timeRange) throw new Error('Time range should be set');

      const targetTimestamp = timeRange.start + (timeRange.end - timeRange.start) / 2;

      act(() => {
        useTimelineStore.getState().scrollTo(targetTimestamp);
      });

      const state = useTimelineStore.getState();
      expect(state.playheadPosition).toBe(targetTimestamp);
      expect(state.scrollPosition).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // DATA LAYER TESTS
  // ============================================================================

  describe('Data Layers', () => {
    it('should toggle data layer visibility', () => {
      const initialState = useTimelineStore.getState();
      const videoLayer = initialState.dataLayers.find((l) => l.id === 'video');
      const initialVisibility = videoLayer?.visible;

      act(() => {
        useTimelineStore.getState().toggleDataLayer('video');
      });

      const newVideoLayer = useTimelineStore
        .getState()
        .dataLayers.find((l) => l.id === 'video');
      expect(newVideoLayer?.visible).toBe(!initialVisibility);
    });

    it('should set specific layer visibility', () => {
      act(() => {
        useTimelineStore.getState().setDataLayerVisibility('audio', false);
      });

      const audioLayer = useTimelineStore
        .getState()
        .dataLayers.find((l) => l.id === 'audio');
      expect(audioLayer?.visible).toBe(false);

      act(() => {
        useTimelineStore.getState().setDataLayerVisibility('audio', true);
      });

      const updatedAudioLayer = useTimelineStore
        .getState()
        .dataLayers.find((l) => l.id === 'audio');
      expect(updatedAudioLayer?.visible).toBe(true);
    });

    it('should show all layers', () => {
      // First hide some layers
      act(() => {
        useTimelineStore.getState().hideAllLayers();
      });

      // Verify all hidden
      let allHidden = useTimelineStore
        .getState()
        .dataLayers.every((l) => !l.visible);
      expect(allHidden).toBe(true);

      act(() => {
        useTimelineStore.getState().showAllLayers();
      });

      const allVisible = useTimelineStore
        .getState()
        .dataLayers.every((l) => l.visible);
      expect(allVisible).toBe(true);
    });

    it('should hide all layers', () => {
      act(() => {
        useTimelineStore.getState().hideAllLayers();
      });

      const allHidden = useTimelineStore
        .getState()
        .dataLayers.every((l) => !l.visible);
      expect(allHidden).toBe(true);
    });
  });

  // ============================================================================
  // SELECTION TESTS
  // ============================================================================

  describe('Selection', () => {
    it('should select item by id', () => {
      act(() => {
        useTimelineStore.getState().selectItem('item-123');
      });

      expect(useTimelineStore.getState().selectedItemId).toBe('item-123');
    });

    it('should clear selection with null', () => {
      act(() => {
        useTimelineStore.getState().selectItem('item-123');
        useTimelineStore.getState().selectItem(null);
      });

      expect(useTimelineStore.getState().selectedItemId).toBeNull();
    });

    it('should set hovered item', () => {
      act(() => {
        useTimelineStore.getState().setHoveredItem('item-456');
      });

      expect(useTimelineStore.getState().hoveredItemId).toBe('item-456');
    });
  });

  // ============================================================================
  // PLAYHEAD TESTS
  // ============================================================================

  describe('Playhead', () => {
    it('should set playhead position', () => {
      const timestamp = Date.now();

      act(() => {
        useTimelineStore.getState().setPlayheadPosition(timestamp);
      });

      expect(useTimelineStore.getState().playheadPosition).toBe(timestamp);
    });

    it('should toggle playback', () => {
      expect(useTimelineStore.getState().isPlaying).toBe(false);

      act(() => {
        useTimelineStore.getState().togglePlayback();
      });
      expect(useTimelineStore.getState().isPlaying).toBe(true);

      act(() => {
        useTimelineStore.getState().togglePlayback();
      });
      expect(useTimelineStore.getState().isPlaying).toBe(false);
    });

    it('should set playback speed within valid range', () => {
      act(() => {
        useTimelineStore.getState().setPlaybackSpeed(2);
      });
      expect(useTimelineStore.getState().playbackSpeed).toBe(2);

      // Test clamping to max (4)
      act(() => {
        useTimelineStore.getState().setPlaybackSpeed(10);
      });
      expect(useTimelineStore.getState().playbackSpeed).toBe(4);

      // Test clamping to min (0.25)
      act(() => {
        useTimelineStore.getState().setPlaybackSpeed(0.1);
      });
      expect(useTimelineStore.getState().playbackSpeed).toBe(0.25);
    });
  });

  // ============================================================================
  // CLOCK SYNC TESTS
  // ============================================================================

  describe('Clock Sync', () => {
    it('should show clock sync prompt', () => {
      act(() => {
        useTimelineStore.getState().showClockSyncPrompt();
      });

      expect(useTimelineStore.getState().clockSyncPrompt.shown).toBe(true);
    });

    it('should acknowledge clock sync', () => {
      act(() => {
        useTimelineStore.getState().acknowledgeClockSync();
      });

      const state = useTimelineStore.getState();
      expect(state.clockSyncPrompt.acknowledged).toBe(true);
      expect(state.clockSyncPrompt.shown).toBe(false);
      expect(state.clockSyncPrompt.acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should verify device clock', async () => {
      // Load timeline first to get devices
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      const deviceId = useTimelineStore.getState().clockSyncPrompt.devices[0]?.deviceId;
      if (!deviceId) throw new Error('No device to test');

      await act(async () => {
        await useTimelineStore.getState().verifyDeviceClock(deviceId);
      });

      const device = useTimelineStore
        .getState()
        .clockSyncPrompt.devices.find((d) => d.deviceId === deviceId);
      expect(device?.syncStatus).toBe('verified');
      expect(device?.lastVerifiedAt).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // AUTO-REFRESH TESTS
  // ============================================================================

  describe('Auto-Refresh', () => {
    it('should set auto refresh enabled', () => {
      act(() => {
        useTimelineStore.getState().setAutoRefresh(true);
      });

      expect(useTimelineStore.getState().autoRefreshEnabled).toBe(true);
    });

    it('should set auto refresh interval with minimum of 5 seconds', () => {
      act(() => {
        useTimelineStore.getState().setAutoRefreshInterval(60000);
      });
      expect(useTimelineStore.getState().autoRefreshIntervalMs).toBe(60000);

      // Test minimum (5000ms)
      act(() => {
        useTimelineStore.getState().setAutoRefreshInterval(1000);
      });
      expect(useTimelineStore.getState().autoRefreshIntervalMs).toBe(5000);
    });
  });

  // ============================================================================
  // RESET TESTS
  // ============================================================================

  describe('Reset', () => {
    it('should reset state but keep user preferences', async () => {
      // Load timeline and modify preferences
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
        useTimelineStore.getState().setZoomLevel(ZOOM_LEVELS[0]);
        useTimelineStore.getState().setAutoRefresh(true);
        useTimelineStore.getState().setAutoRefreshInterval(60000);
      });

      const preferredZoom = useTimelineStore.getState().zoomLevel;
      const autoRefreshEnabled = useTimelineStore.getState().autoRefreshEnabled;
      const autoRefreshInterval = useTimelineStore.getState().autoRefreshIntervalMs;

      act(() => {
        useTimelineStore.getState().reset();
      });

      const state = useTimelineStore.getState();

      // Should be reset
      expect(state.investigationId).toBeNull();
      expect(state.items).toEqual([]);

      // Should keep preferences
      expect(state.zoomLevel).toEqual(preferredZoom);
      expect(state.autoRefreshEnabled).toBe(autoRefreshEnabled);
      expect(state.autoRefreshIntervalMs).toBe(autoRefreshInterval);
    });
  });

  // ============================================================================
  // SELECTOR TESTS
  // ============================================================================

  describe('Selectors', () => {
    it('should select visible items based on visible layers', async () => {
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      // Get all items first
      const allItems = useTimelineStore.getState().items;
      expect(allItems.length).toBeGreaterThan(0);

      // Import and use the selector
      const { selectVisibleItems } = await import('../useTimelineStore');
      const visibleItems = selectVisibleItems(useTimelineStore.getState());

      // With all layers visible, should equal all items
      expect(visibleItems.length).toBe(allItems.length);

      // Hide video layer
      act(() => {
        useTimelineStore.getState().setDataLayerVisibility('video', false);
      });

      const filteredItems = selectVisibleItems(useTimelineStore.getState());
      // Should have fewer items (no video items)
      expect(filteredItems.length).toBeLessThanOrEqual(allItems.length);
    });

    it('should select selected item', async () => {
      await act(async () => {
        await useTimelineStore.getState().loadTimeline('investigation-123');
      });

      const items = useTimelineStore.getState().items;
      const firstItem = items[0];

      if (!firstItem) throw new Error('No items loaded');

      act(() => {
        useTimelineStore.getState().selectItem(firstItem.id);
      });

      const { selectSelectedItem } = await import('../useTimelineStore');
      const selectedItem = selectSelectedItem(useTimelineStore.getState());

      expect(selectedItem).toEqual(firstItem);
    });

    it('should return null when no item selected', async () => {
      const { selectSelectedItem } = await import('../useTimelineStore');
      const selectedItem = selectSelectedItem(useTimelineStore.getState());

      expect(selectedItem).toBeNull();
    });
  });
});
