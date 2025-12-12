/**
 * App Persistence Store - Manages app state persistence across user sessions
 * Stores: activeProjectId, activeTool, playheadPosition, panelStates
 * Handles state restore on app load
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PanelState {
  collapsed: boolean;
  width?: number;
  height?: number;
}

export interface AppPersistenceState {
  // Project state
  activeProjectId: string | null;
  activeTool: string;
  playheadPosition: number;

  // Quick Analyze state
  quickAnalyzeFile: {
    name: string;
    type: 'video' | 'audio' | 'image';
    url: string;
  } | null;

  // Panel states per tool
  panelStates: Record<string, Record<string, PanelState>>;

  // UI state
  labelRowExpanded: boolean;

  // Last saved timestamp
  lastSavedAt: number | null;

  // Actions
  setActiveProject: (projectId: string | null) => void;
  setActiveTool: (tool: string) => void;
  setPlayheadPosition: (position: number) => void;
  setQuickAnalyzeFile: (file: { name: string; type: 'video' | 'audio' | 'image'; url: string } | null) => void;
  setPanelState: (tool: string, panelId: string, state: Partial<PanelState>) => void;
  setLabelRowExpanded: (expanded: boolean) => void;
  updateLastSaved: () => void;

  // Restore helpers
  shouldRestoreProject: () => boolean;
  shouldRestoreQuickAnalyze: () => boolean;
  getRestoreTarget: () => 'project' | 'quickAnalyze' | 'home';
  clearProject: () => void;
}

export const useAppPersistence = create<AppPersistenceState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeProjectId: null,
      activeTool: 'home',
      playheadPosition: 0,
      quickAnalyzeFile: null,
      panelStates: {},
      labelRowExpanded: true, // Default expanded for new users
      lastSavedAt: null,

      // Actions
      setActiveProject: (projectId) =>
        set({
          activeProjectId: projectId,
          lastSavedAt: Date.now(),
        }),

      setActiveTool: (tool) =>
        set({
          activeTool: tool,
          lastSavedAt: Date.now(),
        }),

      setPlayheadPosition: (position) =>
        set({
          playheadPosition: position,
          lastSavedAt: Date.now(),
        }),

      setQuickAnalyzeFile: (file) =>
        set({
          quickAnalyzeFile: file,
          lastSavedAt: Date.now(),
        }),

      setPanelState: (tool, panelId, state) =>
        set((prev) => ({
          panelStates: {
            ...prev.panelStates,
            [tool]: {
              ...(prev.panelStates[tool] || {}),
              [panelId]: {
                ...(prev.panelStates[tool]?.[panelId] || { collapsed: false }),
                ...state,
              },
            },
          },
          lastSavedAt: Date.now(),
        })),

      setLabelRowExpanded: (expanded) =>
        set({
          labelRowExpanded: expanded,
          lastSavedAt: Date.now(),
        }),

      updateLastSaved: () => set({ lastSavedAt: Date.now() }),

      // Restore helpers
      shouldRestoreProject: () => {
        const { activeProjectId } = get();
        return activeProjectId !== null;
      },

      shouldRestoreQuickAnalyze: () => {
        const { quickAnalyzeFile } = get();
        return quickAnalyzeFile !== null;
      },

      getRestoreTarget: () => {
        const { activeProjectId, quickAnalyzeFile } = get();

        // If there was a quick analyze file open, restore to that tool
        if (quickAnalyzeFile !== null) {
          return 'quickAnalyze';
        }

        // If there was an active project, restore to it
        if (activeProjectId !== null) {
          return 'project';
        }

        // Otherwise go to home
        return 'home';
      },

      clearProject: () =>
        set({
          activeProjectId: null,
          quickAnalyzeFile: null,
          playheadPosition: 0,
          activeTool: 'home',
        }),
    }),
    {
      name: 'tacctile-app-persistence',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useAppPersistence;
