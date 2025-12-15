/**
 * Vitest Global Setup
 *
 * This file is loaded before each test file and sets up the testing environment.
 * It includes:
 * - @testing-library/jest-dom matchers for DOM assertions
 * - Global mocks for browser APIs not available in jsdom
 * - Cleanup after each test
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';

// Cleanup after each test to prevent memory leaks and test pollution
afterEach(() => {
  cleanup();
});

// ============================================================================
// BROWSER API MOCKS
// ============================================================================

// Mock window.matchMedia (used by MUI for responsive design)
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock ResizeObserver (used by many charting and layout libraries)
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

// Mock IntersectionObserver (used for lazy loading and viewport detection)
beforeAll(() => {
  global.IntersectionObserver = class IntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn().mockReturnValue([]);
  } as unknown as typeof IntersectionObserver;
});

// Mock URL.createObjectURL and URL.revokeObjectURL (used for blob handling)
beforeAll(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
});

// Mock AudioContext (used by audio tools)
beforeAll(() => {
  const mockAudioContext = {
    createAnalyser: vi.fn().mockReturnValue({
      fftSize: 2048,
      frequencyBinCount: 1024,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createGain: vi.fn().mockReturnValue({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createBiquadFilter: vi.fn().mockReturnValue({
      type: 'lowpass',
      frequency: { value: 350 },
      Q: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createDynamicsCompressor: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createBufferSource: vi.fn().mockReturnValue({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createMediaStreamSource: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    decodeAudioData: vi.fn().mockResolvedValue({
      duration: 10,
      sampleRate: 44100,
      numberOfChannels: 2,
      length: 441000,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(441000)),
    }),
    destination: {},
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
  (global as Record<string, unknown>).webkitAudioContext = vi.fn().mockImplementation(() => mockAudioContext);
});

// Mock MediaRecorder (used for audio/video recording)
beforeAll(() => {
  global.MediaRecorder = class MockMediaRecorder {
    static isTypeSupported = vi.fn().mockReturnValue(true);
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    state = 'inactive';

    start = vi.fn().mockImplementation(() => {
      this.state = 'recording';
    });
    stop = vi.fn().mockImplementation(() => {
      this.state = 'inactive';
      this.onstop?.();
    });
    pause = vi.fn();
    resume = vi.fn();
  } as unknown as typeof MediaRecorder;
});

// Mock navigator.mediaDevices (used for camera/microphone access)
beforeAll(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
      }),
      enumerateDevices: vi.fn().mockResolvedValue([
        { deviceId: 'mock-audio-input', kind: 'audioinput', label: 'Mock Microphone' },
        { deviceId: 'mock-audio-output', kind: 'audiooutput', label: 'Mock Speaker' },
        { deviceId: 'mock-video-input', kind: 'videoinput', label: 'Mock Camera' },
      ]),
    },
    writable: true,
  });
});

// Mock localStorage
beforeAll(() => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      get length() {
        return Object.keys(store).length;
      },
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
});

// Reset localStorage before each test
afterEach(() => {
  window.localStorage.clear();
});

// ============================================================================
// CONSOLE SUPPRESSION (optional - uncomment to suppress expected warnings)
// ============================================================================

// Suppress specific console warnings during tests
// const originalWarn = console.warn;
// beforeAll(() => {
//   console.warn = (...args: unknown[]) => {
//     // Suppress specific MUI warnings or other expected warnings
//     if (typeof args[0] === 'string' && args[0].includes('MUI')) {
//       return;
//     }
//     originalWarn.apply(console, args);
//   };
// });
// afterAll(() => {
//   console.warn = originalWarn;
// });

// ============================================================================
// GLOBAL TEST UTILITIES
// ============================================================================

// Add any global test utilities that should be available in all test files
declare global {
  // You can extend the global namespace here if needed
}
