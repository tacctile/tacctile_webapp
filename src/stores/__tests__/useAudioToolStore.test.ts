/**
 * Audio Tool Store Tests
 *
 * Tests for the useAudioToolStore Zustand store.
 * Demonstrates patterns for:
 * - Testing initial state
 * - Testing state updates via actions
 * - Testing complex interactions
 * - Testing edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useAudioToolStore } from '../useAudioToolStore';
import type { TimeSelection, LoopRegion } from '../../types/audio';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('useAudioToolStore', () => {
  // Store the initial state before each test for reset
  const getInitialState = () => ({
    fileId: null,
    investigationId: null,
    audioBuffer: null,
    audioUrl: null,
    loadedAudioFile: null,
    waveformData: null,
    viewMode: 'waveform' as const,
    isLoading: false,
    isProcessing: false,
    error: null,
  });

  // Reset store state before each test
  beforeEach(() => {
    act(() => {
      useAudioToolStore.getState().reset();
    });
  });

  // Clean up after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // INITIAL STATE TESTS
  // ============================================================================

  describe('Initial State', () => {
    it('should have correct initial state values', () => {
      const state = useAudioToolStore.getState();

      // Verify audio data is initially null
      expect(state.fileId).toBeNull();
      expect(state.investigationId).toBeNull();
      expect(state.audioBuffer).toBeNull();
      expect(state.audioUrl).toBeNull();

      // Verify UI state defaults
      expect(state.isLoading).toBe(false);
      expect(state.isProcessing).toBe(false);
      expect(state.error).toBeNull();

      // Verify view mode
      expect(state.viewMode).toBe('waveform');

      // Verify collections are empty
      expect(state.selections).toEqual([]);
      expect(state.loopRegions).toEqual([]);
      expect(state.findings).toEqual([]);
      expect(state.iterations).toEqual([]);
    });

    it('should have default playback state', () => {
      const state = useAudioToolStore.getState();

      expect(state.playback.isPlaying).toBe(false);
      expect(state.playback.currentTime).toBe(0);
      expect(state.playback.duration).toBe(0);
      expect(state.playback.volume).toBe(1);
      expect(state.playback.muted).toBe(false);
      expect(state.playback.looping).toBe(false);
      expect(state.playback.playbackRate).toBe(1);
    });

    it('should have preset recipes loaded', () => {
      const state = useAudioToolStore.getState();

      // Should have preset recipes from PRESET_RECIPES
      expect(state.recipes.length).toBeGreaterThan(0);
      expect(state.recipes.some((r) => r.isPreset)).toBe(true);
    });
  });

  // ============================================================================
  // AUDIO LOADING TESTS
  // ============================================================================

  describe('Audio Loading', () => {
    it('should load audio file with correct state updates', () => {
      const { loadAudio } = useAudioToolStore.getState();

      act(() => {
        loadAudio('file-123', 'investigation-456', 'blob:audio-url');
      });

      const state = useAudioToolStore.getState();
      expect(state.fileId).toBe('file-123');
      expect(state.investigationId).toBe('investigation-456');
      expect(state.audioUrl).toBe('blob:audio-url');
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should clear previous selections when loading new audio', () => {
      const store = useAudioToolStore.getState();

      // Add a selection first
      act(() => {
        store.addSelection({
          id: 'selection-1',
          startTime: 0,
          endTime: 10,
          color: '#19abb5',
          userId: 'user-1',
          visible: true,
          createdAt: new Date(),
        });
      });

      expect(useAudioToolStore.getState().selections).toHaveLength(1);

      // Load new audio
      act(() => {
        useAudioToolStore.getState().loadAudio('new-file', 'investigation', 'new-url');
      });

      // Selections should be cleared
      expect(useAudioToolStore.getState().selections).toHaveLength(0);
    });

    it('should set audio buffer and update duration', () => {
      const mockBuffer = {
        duration: 120.5,
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 5318205,
        getChannelData: vi.fn(),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn(),
      } as unknown as AudioBuffer;

      act(() => {
        useAudioToolStore.getState().setAudioBuffer(mockBuffer);
      });

      const state = useAudioToolStore.getState();
      expect(state.audioBuffer).toBe(mockBuffer);
      expect(state.playback.duration).toBe(120.5);
      expect(state.isLoading).toBe(false);
    });

    it('should clear audio state correctly', () => {
      // First, set up some state
      act(() => {
        const store = useAudioToolStore.getState();
        store.loadAudio('file-1', 'investigation-1', 'url-1');
        store.setLoading(false);
        store.addSelection({
          id: 'sel-1',
          startTime: 0,
          endTime: 5,
          color: '#19abb5',
          userId: 'user-1',
          visible: true,
          createdAt: new Date(),
        });
      });

      // Now clear
      act(() => {
        useAudioToolStore.getState().clearAudio();
      });

      const state = useAudioToolStore.getState();
      expect(state.fileId).toBeNull();
      expect(state.audioUrl).toBeNull();
      expect(state.selections).toHaveLength(0);
    });
  });

  // ============================================================================
  // PLAYBACK TESTS
  // ============================================================================

  describe('Playback Controls', () => {
    it('should toggle play state', () => {
      const store = useAudioToolStore.getState();

      expect(store.playback.isPlaying).toBe(false);

      act(() => {
        store.play();
      });
      expect(useAudioToolStore.getState().playback.isPlaying).toBe(true);

      act(() => {
        useAudioToolStore.getState().pause();
      });
      expect(useAudioToolStore.getState().playback.isPlaying).toBe(false);
    });

    it('should stop and reset current time', () => {
      act(() => {
        const store = useAudioToolStore.getState();
        store.play();
        store.updatePlaybackTime(45.5);
      });

      expect(useAudioToolStore.getState().playback.currentTime).toBe(45.5);
      expect(useAudioToolStore.getState().playback.isPlaying).toBe(true);

      act(() => {
        useAudioToolStore.getState().stop();
      });

      const state = useAudioToolStore.getState();
      expect(state.playback.isPlaying).toBe(false);
      expect(state.playback.currentTime).toBe(0);
    });

    it('should seek to specific time within bounds', () => {
      // Set duration first
      act(() => {
        useAudioToolStore.getState().setDuration(100);
      });

      act(() => {
        useAudioToolStore.getState().seek(50);
      });
      expect(useAudioToolStore.getState().playback.currentTime).toBe(50);

      // Test seeking beyond duration (should clamp)
      act(() => {
        useAudioToolStore.getState().seek(150);
      });
      expect(useAudioToolStore.getState().playback.currentTime).toBe(100);

      // Test seeking before 0 (should clamp)
      act(() => {
        useAudioToolStore.getState().seek(-10);
      });
      expect(useAudioToolStore.getState().playback.currentTime).toBe(0);
    });

    it('should set playback rate within valid range', () => {
      act(() => {
        useAudioToolStore.getState().setPlaybackRate(2);
      });
      expect(useAudioToolStore.getState().playback.playbackRate).toBe(2);

      // Test clamping to max (4)
      act(() => {
        useAudioToolStore.getState().setPlaybackRate(10);
      });
      expect(useAudioToolStore.getState().playback.playbackRate).toBe(4);

      // Test clamping to min (0.25)
      act(() => {
        useAudioToolStore.getState().setPlaybackRate(0.1);
      });
      expect(useAudioToolStore.getState().playback.playbackRate).toBe(0.25);
    });

    it('should set volume within valid range', () => {
      act(() => {
        useAudioToolStore.getState().setVolume(0.5);
      });
      expect(useAudioToolStore.getState().playback.volume).toBe(0.5);

      // Test clamping to max (1)
      act(() => {
        useAudioToolStore.getState().setVolume(1.5);
      });
      expect(useAudioToolStore.getState().playback.volume).toBe(1);

      // Test clamping to min (0)
      act(() => {
        useAudioToolStore.getState().setVolume(-0.5);
      });
      expect(useAudioToolStore.getState().playback.volume).toBe(0);
    });

    it('should toggle mute state', () => {
      expect(useAudioToolStore.getState().playback.muted).toBe(false);

      act(() => {
        useAudioToolStore.getState().toggleMute();
      });
      expect(useAudioToolStore.getState().playback.muted).toBe(true);

      act(() => {
        useAudioToolStore.getState().toggleMute();
      });
      expect(useAudioToolStore.getState().playback.muted).toBe(false);
    });

    it('should toggle looping state', () => {
      expect(useAudioToolStore.getState().playback.looping).toBe(false);

      act(() => {
        useAudioToolStore.getState().toggleLooping();
      });
      expect(useAudioToolStore.getState().playback.looping).toBe(true);
    });
  });

  // ============================================================================
  // TIME SELECTION TESTS
  // ============================================================================

  describe('Time Selections', () => {
    it('should start a new selection', () => {
      act(() => {
        useAudioToolStore.getState().startSelection(10.5);
      });

      const state = useAudioToolStore.getState();
      expect(state.currentSelection).not.toBeNull();
      expect(state.currentSelection?.startTime).toBe(10.5);
      expect(state.currentSelection?.endTime).toBe(10.5);
    });

    it('should update selection end time', () => {
      act(() => {
        useAudioToolStore.getState().startSelection(10);
        useAudioToolStore.getState().updateSelection(25);
      });

      const state = useAudioToolStore.getState();
      expect(state.currentSelection?.startTime).toBe(10);
      expect(state.currentSelection?.endTime).toBe(25);
    });

    it('should finish selection and add to selections array', () => {
      act(() => {
        useAudioToolStore.getState().startSelection(10);
        useAudioToolStore.getState().updateSelection(25);
        useAudioToolStore.getState().finishSelection();
      });

      const state = useAudioToolStore.getState();
      expect(state.currentSelection).toBeNull();
      expect(state.selections).toHaveLength(1);
      expect(state.selections[0]?.startTime).toBe(10);
      expect(state.selections[0]?.endTime).toBe(25);
    });

    it('should normalize selection when end < start', () => {
      act(() => {
        useAudioToolStore.getState().startSelection(30);
        useAudioToolStore.getState().updateSelection(10);
        useAudioToolStore.getState().finishSelection();
      });

      const state = useAudioToolStore.getState();
      // Should be normalized so start < end
      expect(state.selections[0]?.startTime).toBe(10);
      expect(state.selections[0]?.endTime).toBe(30);
    });

    it('should cancel selection without saving', () => {
      act(() => {
        useAudioToolStore.getState().startSelection(10);
        useAudioToolStore.getState().updateSelection(25);
        useAudioToolStore.getState().cancelSelection();
      });

      const state = useAudioToolStore.getState();
      expect(state.currentSelection).toBeNull();
      expect(state.selections).toHaveLength(0);
    });

    it('should remove selection by id', () => {
      const mockSelection: TimeSelection = {
        id: 'selection-to-remove',
        startTime: 0,
        endTime: 10,
        color: '#19abb5',
        userId: 'user-1',
        visible: true,
        createdAt: new Date(),
      };

      act(() => {
        useAudioToolStore.getState().addSelection(mockSelection);
      });

      expect(useAudioToolStore.getState().selections).toHaveLength(1);

      act(() => {
        useAudioToolStore.getState().removeSelection('selection-to-remove');
      });

      expect(useAudioToolStore.getState().selections).toHaveLength(0);
    });

    it('should clear all selections', () => {
      act(() => {
        useAudioToolStore.getState().addSelection({
          id: 'sel-1',
          startTime: 0,
          endTime: 5,
          color: '#19abb5',
          userId: 'user-1',
          visible: true,
          createdAt: new Date(),
        });
        useAudioToolStore.getState().addSelection({
          id: 'sel-2',
          startTime: 10,
          endTime: 15,
          color: '#19abb5',
          userId: 'user-1',
          visible: true,
          createdAt: new Date(),
        });
      });

      expect(useAudioToolStore.getState().selections).toHaveLength(2);

      act(() => {
        useAudioToolStore.getState().clearSelections();
      });

      expect(useAudioToolStore.getState().selections).toHaveLength(0);
    });
  });

  // ============================================================================
  // LOOP REGION TESTS
  // ============================================================================

  describe('Loop Regions', () => {
    it('should add loop region with generated id', () => {
      act(() => {
        useAudioToolStore.getState().addLoopRegion({
          startTime: 10,
          endTime: 20,
          label: 'Test Loop',
          color: '#ffc107',
          active: false,
        });
      });

      const state = useAudioToolStore.getState();
      expect(state.loopRegions).toHaveLength(1);
      expect(state.loopRegions[0]?.id).toBeDefined();
      expect(state.loopRegions[0]?.label).toBe('Test Loop');
    });

    it('should set active loop and enable looping', () => {
      act(() => {
        useAudioToolStore.getState().addLoopRegion({
          startTime: 10,
          endTime: 20,
          label: 'Loop 1',
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
      expect(state.loopRegions[0]?.active).toBe(true);
      expect(state.playback.looping).toBe(true);
    });

    it('should create loop from current selection', () => {
      // First create a selection
      act(() => {
        useAudioToolStore.getState().startSelection(15);
        useAudioToolStore.getState().updateSelection(30);
        useAudioToolStore.getState().finishSelection();
      });

      act(() => {
        useAudioToolStore.getState().createLoopFromSelection();
      });

      const state = useAudioToolStore.getState();
      expect(state.loopRegions).toHaveLength(1);
      expect(state.loopRegions[0]?.startTime).toBe(15);
      expect(state.loopRegions[0]?.endTime).toBe(30);
      expect(state.activeLoopId).toBe(state.loopRegions[0]?.id);
    });

    it('should remove loop region and clear active if was active', () => {
      act(() => {
        useAudioToolStore.getState().addLoopRegion({
          startTime: 0,
          endTime: 10,
          label: 'Loop',
          color: '#ffc107',
          active: true,
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
  // UI STATE TESTS
  // ============================================================================

  describe('UI State', () => {
    it('should set loading state', () => {
      act(() => {
        useAudioToolStore.getState().setLoading(true);
      });
      expect(useAudioToolStore.getState().isLoading).toBe(true);

      act(() => {
        useAudioToolStore.getState().setLoading(false);
      });
      expect(useAudioToolStore.getState().isLoading).toBe(false);
    });

    it('should set processing state', () => {
      act(() => {
        useAudioToolStore.getState().setProcessing(true);
      });
      expect(useAudioToolStore.getState().isProcessing).toBe(true);
    });

    it('should set error and clear loading/processing states', () => {
      act(() => {
        useAudioToolStore.getState().setLoading(true);
        useAudioToolStore.getState().setProcessing(true);
        useAudioToolStore.getState().setError('Something went wrong');
      });

      const state = useAudioToolStore.getState();
      expect(state.error).toBe('Something went wrong');
      expect(state.isLoading).toBe(false);
      expect(state.isProcessing).toBe(false);
    });

    it('should set zoom within valid bounds', () => {
      act(() => {
        useAudioToolStore.getState().setZoom(200);
      });
      expect(useAudioToolStore.getState().zoom).toBe(200);

      // Test max bound (1000)
      act(() => {
        useAudioToolStore.getState().setZoom(2000);
      });
      expect(useAudioToolStore.getState().zoom).toBe(1000);

      // Test min bound (10)
      act(() => {
        useAudioToolStore.getState().setZoom(5);
      });
      expect(useAudioToolStore.getState().zoom).toBe(10);
    });

    it('should set view mode', () => {
      expect(useAudioToolStore.getState().viewMode).toBe('waveform');

      act(() => {
        useAudioToolStore.getState().setViewMode('spectrogram');
      });
      expect(useAudioToolStore.getState().viewMode).toBe('spectrogram');
    });
  });

  // ============================================================================
  // FILTER TESTS
  // ============================================================================

  describe('Filters', () => {
    it('should reset filters to default', () => {
      act(() => {
        useAudioToolStore.getState().setFilterSettings({
          highPassCutoff: 500,
          highPassEnabled: true,
        });
      });

      expect(useAudioToolStore.getState().filterSettings.highPassCutoff).toBe(500);

      act(() => {
        useAudioToolStore.getState().resetFilters();
      });

      const state = useAudioToolStore.getState();
      // After reset, should not be 500 anymore (back to default)
      expect(state.filterSettings.highPassCutoff).not.toBe(500);
    });

    it('should toggle filters bypass', () => {
      expect(useAudioToolStore.getState().filtersBypassed).toBe(false);

      act(() => {
        useAudioToolStore.getState().toggleFiltersBypass();
      });
      expect(useAudioToolStore.getState().filtersBypassed).toBe(true);

      act(() => {
        useAudioToolStore.getState().toggleFiltersBypass();
      });
      expect(useAudioToolStore.getState().filtersBypassed).toBe(false);
    });
  });

  // ============================================================================
  // WAVEFORM SELECTION TESTS
  // ============================================================================

  describe('Waveform Selection', () => {
    it('should set waveform selection times', () => {
      act(() => {
        useAudioToolStore.getState().setWaveformSelection(10, 30);
      });

      const state = useAudioToolStore.getState();
      expect(state.waveformSelectionStart).toBe(10);
      expect(state.waveformSelectionEnd).toBe(30);
    });

    it('should clear waveform selection', () => {
      act(() => {
        useAudioToolStore.getState().setWaveformSelection(10, 30);
        useAudioToolStore.getState().clearWaveformSelection();
      });

      const state = useAudioToolStore.getState();
      expect(state.waveformSelectionStart).toBeNull();
      expect(state.waveformSelectionEnd).toBeNull();
    });
  });

  // ============================================================================
  // RESET TESTS
  // ============================================================================

  describe('Reset', () => {
    it('should reset state but keep recipes', () => {
      // Modify state
      act(() => {
        const store = useAudioToolStore.getState();
        store.loadAudio('file-1', 'investigation-1', 'url-1');
        store.setViewMode('spectrogram');
        store.setZoom(200);
        store.saveRecipe('My Recipe', 'Test recipe');
      });

      const recipesBeforeReset = useAudioToolStore.getState().recipes.length;

      act(() => {
        useAudioToolStore.getState().reset();
      });

      const state = useAudioToolStore.getState();
      expect(state.fileId).toBeNull();
      expect(state.recipes.length).toBe(recipesBeforeReset);
    });
  });
});
