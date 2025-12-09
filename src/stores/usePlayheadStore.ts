/**
 * Playhead Store
 * Global store for managing cursor position across all tools
 * Foundation for synchronized scrubbing across Session Timeline, Video Tool, Audio Tool, and Image Tool
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PlayheadState {
  // Current cursor position (absolute timestamp in milliseconds)
  timestamp: number;

  // Playback state
  isPlaying: boolean;
  isReversePlaying: boolean; // For EVP analysis - play backwards
  playbackSpeed: number; // 0.25, 0.5, 1, 1.5, 2

  // Session time boundaries (set when session loads)
  sessionStart: number | null;
  sessionEnd: number | null;

  // Actions
  setTimestamp: (timestamp: number) => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  toggleReversePlayback: () => void; // Toggle reverse play mode
  setPlaybackSpeed: (speed: number) => void;
  stepForward: (ms?: number) => void;  // default 1 frame (~33ms)
  stepBackward: (ms?: number) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  setSessionBounds: (start: number, end: number) => void;
}

export const usePlayheadStore = create<PlayheadState>()(
  persist(
    (set, get) => ({
      timestamp: 0,
      isPlaying: false,
      isReversePlaying: false,
      playbackSpeed: 1,
      sessionStart: null,
      sessionEnd: null,

      setTimestamp: (timestamp) => {
        const { sessionStart, sessionEnd } = get();
        // Clamp to session bounds if set
        let clamped = timestamp;
        if (sessionStart !== null && timestamp < sessionStart) clamped = sessionStart;
        if (sessionEnd !== null && timestamp > sessionEnd) clamped = sessionEnd;
        set({ timestamp: clamped });
      },

      play: () => set({ isPlaying: true, isReversePlaying: false }),
      pause: () => set({ isPlaying: false, isReversePlaying: false }),
      togglePlayback: () => set((state) => ({
        isPlaying: !state.isPlaying,
        isReversePlaying: false
      })),
      toggleReversePlayback: () => set((state) => ({
        isReversePlaying: !state.isReversePlaying,
        isPlaying: !state.isReversePlaying // Start playing when reverse is activated
      })),

      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

      stepForward: (ms = 33) => {
        const { timestamp, sessionEnd } = get();
        const next = timestamp + ms;
        if (sessionEnd === null || next <= sessionEnd) {
          set({ timestamp: next, isPlaying: false });
        }
      },

      stepBackward: (ms = 33) => {
        const { timestamp, sessionStart } = get();
        const prev = timestamp - ms;
        if (sessionStart === null || prev >= sessionStart) {
          set({ timestamp: prev, isPlaying: false });
        }
      },

      jumpToStart: () => {
        const { sessionStart } = get();
        if (sessionStart !== null) set({ timestamp: sessionStart, isPlaying: false });
      },

      jumpToEnd: () => {
        const { sessionEnd } = get();
        if (sessionEnd !== null) set({ timestamp: sessionEnd, isPlaying: false });
      },

      setSessionBounds: (start, end) => set({ sessionStart: start, sessionEnd: end }),
    }),
    {
      name: 'tacctile-playhead',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist playback preferences, not position
        playbackSpeed: state.playbackSpeed,
      }),
    }
  )
);

// Selectors
export const selectTimestamp = (state: PlayheadState) => state.timestamp;
export const selectIsPlaying = (state: PlayheadState) => state.isPlaying;
export const selectIsReversePlaying = (state: PlayheadState) => state.isReversePlaying;
export const selectPlaybackSpeed = (state: PlayheadState) => state.playbackSpeed;
export const selectSessionBounds = (state: PlayheadState) => ({
  start: state.sessionStart,
  end: state.sessionEnd,
});
