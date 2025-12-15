/**
 * Audio Service Tests
 *
 * Tests for the AudioService class.
 * Demonstrates patterns for:
 * - Testing class-based services
 * - Testing singleton instances
 * - Testing async methods
 * - Testing error handling
 *
 * Note: Some tests require browser APIs that are mocked in setup.ts.
 * These tests verify the service's interface and basic behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioService, audioService } from '../AudioService';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('AudioService', () => {
  let service: AudioService;

  beforeEach(() => {
    // Create a fresh instance for each test
    service = new AudioService();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any initialized resources
    try {
      await service.dispose();
    } catch {
      // Ignore disposal errors in tests
    }
  });

  // ============================================================================
  // SINGLETON TESTS
  // ============================================================================

  describe('Singleton Instance', () => {
    it('should export a singleton audioService instance', () => {
      expect(audioService).toBeDefined();
      expect(audioService).toBeInstanceOf(AudioService);
    });

    it('should export the AudioService class for instantiation', () => {
      expect(AudioService).toBeDefined();
      const instance = new AudioService();
      expect(instance).toBeInstanceOf(AudioService);
    });
  });

  // ============================================================================
  // INITIALIZATION TESTS
  // ============================================================================

  describe('Initialization', () => {
    it('should throw error when getContext called before init', () => {
      // Service is not initialized
      expect(() => service.getContext()).toThrow('AudioContext not initialized');
    });

    it('should initialize without error', async () => {
      // Should not throw
      await expect(service.init()).resolves.not.toThrow();
    });

    it('should allow getContext after init', async () => {
      await service.init();

      // Should not throw after initialization
      expect(() => service.getContext()).not.toThrow();
      expect(service.getContext()).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await service.init();
      const context1 = service.getContext();

      await service.init();
      const context2 = service.getContext();

      // Should return the same context
      expect(context1).toBe(context2);
    });
  });

  // ============================================================================
  // RECORDING TESTS
  // ============================================================================

  describe('Recording', () => {
    it('should reject stopRecording when no active recording', async () => {
      await expect(service.stopRecording()).rejects.toThrow('No active recording');
    });

    it('should request user media when starting recording', async () => {
      await service.startRecording();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should pass custom options to getUserMedia', async () => {
      await service.startRecording({
        sampleRate: 44100,
        channelCount: 2,
        echoCancellation: false,
      });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({
          sampleRate: 44100,
          channelCount: 2,
          echoCancellation: false,
        }),
      });
    });
  });

  // ============================================================================
  // ANALYSIS TESTS
  // ============================================================================

  describe('Audio Analysis', () => {
    it('should throw error when analyser not initialized', async () => {
      // Service not initialized
      await expect(service.analyzeAudio()).rejects.toThrow('Analyser not initialized');
    });
  });

  // ============================================================================
  // FILE LOADING TESTS
  // ============================================================================

  describe('File Loading', () => {
    it('should load audio file and return AudioBuffer', async () => {
      // Create a mock file with arrayBuffer method
      const mockArrayBuffer = new ArrayBuffer(1000);
      const mockFile = {
        name: 'test.mp3',
        type: 'audio/mpeg',
        size: 1000,
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      } as unknown as File;

      const buffer = await service.loadAudioFile(mockFile);

      expect(buffer).toBeDefined();
      expect(buffer.duration).toBe(10); // From mock
      expect(buffer.sampleRate).toBe(44100);
    });
  });

  // ============================================================================
  // PLAYBACK TESTS
  // ============================================================================

  describe('Playback', () => {
    it('should play audio buffer without error', async () => {
      const mockBuffer = {
        duration: 10,
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 441000,
        getChannelData: vi.fn(),
      } as unknown as AudioBuffer;

      // Should not throw
      await expect(service.playAudioBuffer(mockBuffer)).resolves.toBeDefined();
    });
  });

  // ============================================================================
  // EFFECT CHAIN TESTS
  // ============================================================================

  describe('Effect Chain', () => {
    it('should throw error when creating effect chain without init', () => {
      expect(() => service.createEffectChain()).toThrow('AudioContext not initialized');
    });

    it('should create effect chain after init', async () => {
      await service.init();

      const effects = service.createEffectChain();

      expect(effects).toHaveProperty('gain');
      expect(effects).toHaveProperty('filter');
      expect(effects).toHaveProperty('compressor');
    });

    it('should set default gain value', async () => {
      await service.init();

      const effects = service.createEffectChain();

      expect(effects.gain.gain.value).toBe(1.0);
    });

    it('should set default filter type', async () => {
      await service.init();

      const effects = service.createEffectChain();

      expect(effects.filter.type).toBe('lowpass');
    });
  });

  // ============================================================================
  // DEVICE ENUMERATION TESTS
  // ============================================================================

  describe('Device Enumeration', () => {
    it('should get audio input devices', async () => {
      const devices = await service.getAudioInputDevices();

      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      expect(devices.every((d) => d.kind === 'audioinput')).toBe(true);
    });

    it('should get audio output devices', async () => {
      const devices = await service.getAudioOutputDevices();

      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      expect(devices.every((d) => d.kind === 'audiooutput')).toBe(true);
    });
  });

  // ============================================================================
  // MICROPHONE ACCESS TESTS
  // ============================================================================

  describe('Microphone Access', () => {
    it('should check microphone access and return boolean', async () => {
      const hasAccess = await service.checkMicrophoneAccess();

      expect(typeof hasAccess).toBe('boolean');
    });

    it('should return false when getUserMedia fails', async () => {
      // Mock rejection
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        new Error('Permission denied')
      );

      const hasAccess = await service.checkMicrophoneAccess();

      expect(hasAccess).toBe(false);
    });

    it('should request microphone permission', async () => {
      const granted = await service.requestMicrophonePermission();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(typeof granted).toBe('boolean');
    });
  });

  // ============================================================================
  // WAV CONVERSION TESTS
  // ============================================================================

  describe('WAV Conversion', () => {
    it('should convert AudioBuffer to WAV blob', async () => {
      await service.init();

      const mockBuffer = {
        duration: 1,
        sampleRate: 44100,
        numberOfChannels: 1,
        length: 100,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100).fill(0)),
      } as unknown as AudioBuffer;

      const wavBlob = await service.audioBufferToWav(mockBuffer);

      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.type).toBe('audio/wav');
    });

    it('should create WAV with correct header size', async () => {
      await service.init();

      const mockBuffer = {
        duration: 1,
        sampleRate: 44100,
        numberOfChannels: 1,
        length: 100,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(100).fill(0)),
      } as unknown as AudioBuffer;

      const wavBlob = await service.audioBufferToWav(mockBuffer);

      // WAV header is 44 bytes + (length * channels * 2 bytes per sample)
      const expectedSize = 44 + 100 * 1 * 2;
      expect(wavBlob.size).toBe(expectedSize);
    });
  });

  // ============================================================================
  // DISPOSAL TESTS
  // ============================================================================

  describe('Disposal', () => {
    it('should dispose without error', async () => {
      await service.init();

      // Should not throw
      await expect(service.dispose()).resolves.not.toThrow();
    });

    it('should allow multiple dispose calls', async () => {
      await service.init();
      await service.dispose();

      // Second dispose should not throw
      await expect(service.dispose()).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle getUserMedia rejection gracefully', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
        new Error('Permission denied')
      );

      await expect(service.startRecording()).rejects.toThrow('Permission denied');
    });
  });
});
