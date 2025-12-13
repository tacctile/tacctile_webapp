/**
 * Playhead Store
 * Global store for managing cursor position across all tools
 * Foundation for synchronized scrubbing across Timeline, Video Tool, Audio Tool, and Image Tool
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PlayheadState {
  // Current cursor position (absolute timestamp in milliseconds)
  timestamp: number;

  // Playback state
  isPlaying: boolean;
  isReversePlaying: boolean; // Play backwards for reverse audio analysis
  playbackSpeed: number; // 0.25, 0.5, 1, 1.5, 2

  // Project time boundaries (set when project loads)
  timelineStart: number | null;
  timelineEnd: number | null;

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
  setTimelineBounds: (start: number, end: number) => void;
}

export const usePlayheadStore = create<PlayheadState>()(
  persist(
    (set, get) => ({
      timestamp: 0,
      isPlaying: false,
      isReversePlaying: false,
      playbackSpeed: 1,
      timelineStart: null,
      timelineEnd: null,

      setTimestamp: (timestamp) => {
        const { timelineStart, timelineEnd } = get();
        // Clamp to project bounds if set
        let clamped = timestamp;
        if (timelineStart !== null && timestamp < timelineStart) clamped = timelineStart;
        if (timelineEnd !== null && timestamp > timelineEnd) clamped = timelineEnd;
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
        const { timestamp, timelineEnd } = get();
        const next = timestamp + ms;
        if (timelineEnd === null || next <= timelineEnd) {
          set({ timestamp: next, isPlaying: false });
        }
      },

      stepBackward: (ms = 33) => {
        const { timestamp, timelineStart } = get();
        const prev = timestamp - ms;
        if (timelineStart === null || prev >= timelineStart) {
          set({ timestamp: prev, isPlaying: false });
        }
      },

      jumpToStart: () => {
        const { timelineStart } = get();
        set({ timestamp: timelineStart ?? 0, isPlaying: false });
      },

      jumpToEnd: () => {
        const { timelineEnd } = get();
        if (timelineEnd !== null) set({ timestamp: timelineEnd, isPlaying: false });
      },

      setTimelineBounds: (start, end) => set({ timelineStart: start, timelineEnd: end }),
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
export const selectTimelineBounds = (state: PlayheadState) => ({
  start: state.timelineStart,
  end: state.timelineEnd,
});
