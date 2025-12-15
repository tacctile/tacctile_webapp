/**
 * AudioTool Component Tests
 *
 * Tests for the AudioTool component.
 * Demonstrates patterns for:
 * - Testing store integration
 * - Testing component state through store updates
 *
 * Note: The AudioTool component is complex with many dependencies.
 * These tests focus on store integration patterns that can be reused.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useAudioToolStore } from '@/stores/useAudioToolStore';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('AudioTool Store Integration', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useAudioToolStore.getState().reset();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // PLAYBACK STATE TESTS
  // ============================================================================

  describe('Playback State', () => {
    it('should start with playback stopped', () => {
      const state = useAudioToolStore.getState();
      expect(state.playback.isPlaying).toBe(false);
      expect(state.playback.currentTime).toBe(0);
    });

    it('should toggle play state', () => {
      act(() => {
        useAudioToolStore.getState().play();
      });

      expect(useAudioToolStore.getState().playback.isPlaying).toBe(true);

      act(() => {
        useAudioToolStore.getState().pause();
      });

      expect(useAudioToolStore.getState().playback.isPlaying).toBe(false);
    });

    it('should stop and reset time', () => {
      act(() => {
        const store = useAudioToolStore.getState();
        store.play();
        store.updatePlaybackTime(45);
      });

      expect(useAudioToolStore.getState().playback.currentTime).toBe(45);

      act(() => {
        useAudioToolStore.getState().stop();
      });

      const state = useAudioToolStore.getState();
      expect(state.playback.isPlaying).toBe(false);
      expect(state.playback.currentTime).toBe(0);
    });
  });

  // ============================================================================
  // VOLUME & PLAYBACK RATE TESTS
  // ============================================================================

  describe('Volume and Playback Rate', () => {
    it('should update volume', () => {
      act(() => {
        useAudioToolStore.getState().setVolume(0.5);
      });

      expect(useAudioToolStore.getState().playback.volume).toBe(0.5);
    });

    it('should clamp volume to valid range', () => {
      act(() => {
        useAudioToolStore.getState().setVolume(2);
      });
      expect(useAudioToolStore.getState().playback.volume).toBe(1);

      act(() => {
        useAudioToolStore.getState().setVolume(-1);
      });
      expect(useAudioToolStore.getState().playback.volume).toBe(0);
    });

    it('should update playback rate', () => {
      act(() => {
        useAudioToolStore.getState().setPlaybackRate(1.5);
      });

      expect(useAudioToolStore.getState().playback.playbackRate).toBe(1.5);
    });

    it('should clamp playback rate to valid range', () => {
      act(() => {
        useAudioToolStore.getState().setPlaybackRate(10);
      });
      expect(useAudioToolStore.getState().playback.playbackRate).toBe(4);

      act(() => {
        useAudioToolStore.getState().setPlaybackRate(0.1);
      });
      expect(useAudioToolStore.getState().playback.playbackRate).toBe(0.25);
    });

    it('should toggle mute state', () => {
      expect(useAudioToolStore.getState().playback.muted).toBe(false);

      act(() => {
        useAudioToolStore.getState().toggleMute();
      });

      expect(useAudioToolStore.getState().playback.muted).toBe(true);
    });
  });

  // ============================================================================
  // AUDIO LOADING TESTS
  // ============================================================================

  describe('Audio Loading', () => {
    it('should load audio and set loading state', () => {
      act(() => {
        useAudioToolStore.getState().loadAudio('file-1', 'investigation-1', 'blob:test-url');
      });

      const state = useAudioToolStore.getState();
      expect(state.fileId).toBe('file-1');
      expect(state.investigationId).toBe('investigation-1');
      expect(state.audioUrl).toBe('blob:test-url');
      expect(state.isLoading).toBe(true);
    });

    it('should clear audio state', () => {
      act(() => {
        const store = useAudioToolStore.getState();
        store.loadAudio('file-1', 'investigation-1', 'blob:test-url');
        store.setLoading(false);
      });

      act(() => {
        useAudioToolStore.getState().clearAudio();
      });

      const state = useAudioToolStore.getState();
      expect(state.fileId).toBeNull();
      expect(state.audioUrl).toBeNull();
    });
  });

  // ============================================================================
  // ERROR STATE TESTS
  // ============================================================================

  describe('Error States', () => {
    it('should set error and clear loading/processing states', () => {
      act(() => {
        const store = useAudioToolStore.getState();
        store.setLoading(true);
        store.setProcessing(true);
        store.setError('Failed to load audio');
      });

      const state = useAudioToolStore.getState();
      expect(state.error).toBe('Failed to load audio');
      expect(state.isLoading).toBe(false);
      expect(state.isProcessing).toBe(false);
    });

    it('should clear error when loading new audio', () => {
      act(() => {
        useAudioToolStore.getState().setError('Previous error');
      });

      expect(useAudioToolStore.getState().error).toBe('Previous error');

      act(() => {
        useAudioToolStore.getState().loadAudio('new-file', 'investigation', 'url');
      });

      expect(useAudioToolStore.getState().error).toBeNull();
    });
  });

  // ============================================================================
  // VIEW MODE TESTS
  // ============================================================================

  describe('View Mode', () => {
    it('should start with waveform view', () => {
      expect(useAudioToolStore.getState().viewMode).toBe('waveform');
    });

    it('should switch view mode', () => {
      act(() => {
        useAudioToolStore.getState().setViewMode('spectrogram');
      });

      expect(useAudioToolStore.getState().viewMode).toBe('spectrogram');
    });
  });

  // ============================================================================
  // SELECTION TESTS
  // ============================================================================

  describe('Selections', () => {
    it('should create and finish selection', () => {
      act(() => {
        useAudioToolStore.getState().startSelection(10);
        useAudioToolStore.getState().updateSelection(30);
        useAudioToolStore.getState().finishSelection();
      });

      const state = useAudioToolStore.getState();
      expect(state.selections).toHaveLength(1);
      expect(state.selections[0]?.startTime).toBe(10);
      expect(state.selections[0]?.endTime).toBe(30);
      expect(state.currentSelection).toBeNull();
    });

    it('should cancel selection without saving', () => {
      act(() => {
        useAudioToolStore.getState().startSelection(10);
        useAudioToolStore.getState().updateSelection(30);
        useAudioToolStore.getState().cancelSelection();
      });

      const state = useAudioToolStore.getState();
      expect(state.selections).toHaveLength(0);
      expect(state.currentSelection).toBeNull();
    });

    it('should clear all selections', () => {
      act(() => {
        const store = useAudioToolStore.getState();
        store.startSelection(0);
        store.finishSelection();
        store.startSelection(10);
        store.finishSelection();
        store.clearSelections();
      });

      expect(useAudioToolStore.getState().selections).toHaveLength(0);
    });
  });

  // ============================================================================
  // ZOOM TESTS
  // ============================================================================

  describe('Zoom', () => {
    it('should have default zoom level', () => {
      expect(useAudioToolStore.getState().zoom).toBe(100);
    });

    it('should update zoom level', () => {
      act(() => {
        useAudioToolStore.getState().setZoom(200);
      });

      expect(useAudioToolStore.getState().zoom).toBe(200);
    });

    it('should clamp zoom to valid range', () => {
      act(() => {
        useAudioToolStore.getState().setZoom(2000);
      });
      expect(useAudioToolStore.getState().zoom).toBe(1000);

      act(() => {
        useAudioToolStore.getState().setZoom(1);
      });
      expect(useAudioToolStore.getState().zoom).toBe(10);
    });
  });

  // ============================================================================
  // LOOP REGION TESTS
  // ============================================================================

  describe('Loop Regions', () => {
    it('should create loop from selection', () => {
      act(() => {
        const store = useAudioToolStore.getState();
        store.startSelection(10);
        store.updateSelection(20);
        store.finishSelection();
        store.createLoopFromSelection();
      });

      const state = useAudioToolStore.getState();
      expect(state.loopRegions).toHaveLength(1);
      expect(state.loopRegions[0]?.startTime).toBe(10);
      expect(state.loopRegions[0]?.endTime).toBe(20);
    });

    it('should activate loop and enable looping', () => {
      act(() => {
        useAudioToolStore.getState().addLoopRegion({
          startTime: 0,
          endTime: 10,
          label: 'Test Loop',
          color: '#ffc107',
          active: false,
        });
      });

      const loopId = useAudioToolStore.getState().loopRegions[0]?.id;

      act(() => {
        useAudioToolStore.getState().setActiveLoop(loopId!);
      });

      const state = useAudioToolStore.getState();
      expect(state.activeLoopId).toBe(loopId);
      expect(state.playback.looping).toBe(true);
      expect(state.loopRegions[0]?.active).toBe(true);
    });

    it('should remove loop and clear active if was active', () => {
      act(() => {
        useAudioToolStore.getState().addLoopRegion({
          startTime: 0,
          endTime: 10,
          label: 'Loop',
          color: '#ffc107',
          active: false,
        });
      });

      const loopId = useAudioToolStore.getState().loopRegions[0]?.id;

      act(() => {
        useAudioToolStore.getState().setActiveLoop(loopId!);
      });

      expect(useAudioToolStore.getState().activeLoopId).toBe(loopId);

      act(() => {
        useAudioToolStore.getState().removeLoopRegion(loopId!);
      });

      const state = useAudioToolStore.getState();
      expect(state.loopRegions).toHaveLength(0);
      expect(state.activeLoopId).toBeNull();
    });
  });

  // ============================================================================
  // WAVEFORM SELECTION TESTS
  // ============================================================================

  describe('Waveform Selection', () => {
    it('should set and clear waveform selection', () => {
      act(() => {
        useAudioToolStore.getState().setWaveformSelection(5, 15);
      });

      let state = useAudioToolStore.getState();
      expect(state.waveformSelectionStart).toBe(5);
      expect(state.waveformSelectionEnd).toBe(15);

      act(() => {
        useAudioToolStore.getState().clearWaveformSelection();
      });

      state = useAudioToolStore.getState();
      expect(state.waveformSelectionStart).toBeNull();
      expect(state.waveformSelectionEnd).toBeNull();
    });
  });

  // ============================================================================
  // FILTER TESTS
  // ============================================================================

  describe('Filters', () => {
    it('should toggle filters bypass', () => {
      expect(useAudioToolStore.getState().filtersBypassed).toBe(false);

      act(() => {
        useAudioToolStore.getState().toggleFiltersBypass();
      });

      expect(useAudioToolStore.getState().filtersBypassed).toBe(true);
    });

    it('should update filter settings', () => {
      act(() => {
        useAudioToolStore.getState().setFilterSettings({
          highPassEnabled: true,
          highPassCutoff: 200,
        });
      });

      const state = useAudioToolStore.getState();
      expect(state.filterSettings.highPassEnabled).toBe(true);
      expect(state.filterSettings.highPassCutoff).toBe(200);
    });
  });
});
