/**
 * Autosave Store - Manages automatic saving to IndexedDB
 *
 * Features:
 * - Local autosave every 10 seconds to IndexedDB
 * - Saves: filter/adjustment values, flags, annotations, playhead position, panel states, undo stack
 * - Cloud sync on: manual save, clean session close, every 3 minutes background
 * - Crash recovery: on load, check if local save is newer than cloud → prompt recovery
 */

import { create } from 'zustand';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Autosave DB Schema
interface AutosaveDB extends DBSchema {
  autosave: {
    key: string;
    value: {
      id: string;
      sessionId: string;
      tool: string;
      data: ToolAutosaveData;
      savedAt: number;
      cloudSyncedAt: number | null;
    };
  };
  undoStacks: {
    key: string;
    value: {
      tool: string;
      stack: UndoStackEntry[];
      currentIndex: number;
      savedAt: number;
    };
  };
}

export interface UndoStackEntry {
  id: string;
  timestamp: number;
  action: string;
  data: any;
}

export interface ToolAutosaveData {
  // Common
  playheadPosition: number;
  panelStates: Record<string, any>;

  // Tool-specific
  filters?: Record<string, any>;
  adjustments?: Record<string, any>;
  flags?: any[];
  annotations?: any[];
  selections?: any[];

  // Undo reference
  undoStackId: string;
}

interface AutosaveState {
  // State
  isInitialized: boolean;
  isSaving: boolean;
  lastLocalSave: number | null;
  lastCloudSync: number | null;
  hasUnsavedChanges: boolean;
  pendingRecovery: { sessionId: string; savedAt: number } | null;

  // Undo stacks (in-memory, 50 entries per tool)
  undoStacks: Record<string, { entries: UndoStackEntry[]; currentIndex: number }>;

  // Actions
  init: () => Promise<void>;
  saveLocal: (sessionId: string, tool: string, data: ToolAutosaveData) => Promise<void>;
  loadLocal: (sessionId: string, tool: string) => Promise<ToolAutosaveData | null>;
  syncToCloud: (sessionId: string) => Promise<void>;
  checkForRecovery: (sessionId: string) => Promise<boolean>;
  recoverSession: (sessionId: string) => Promise<ToolAutosaveData | null>;
  dismissRecovery: () => void;
  markCloudSynced: (sessionId: string) => Promise<void>;

  // Undo system
  pushUndoEntry: (tool: string, action: string, data: any) => void;
  undo: (tool: string) => UndoStackEntry | null;
  redo: (tool: string) => UndoStackEntry | null;
  getUndoStack: (tool: string) => { entries: UndoStackEntry[]; currentIndex: number };
  clearUndoStack: (tool: string) => void;
  canUndo: (tool: string) => boolean;
  canRedo: (tool: string) => boolean;
}

const DB_NAME = 'tacctile-autosave-db';
const DB_VERSION = 1;
const MAX_UNDO_ENTRIES = 50;
const LOCAL_SAVE_INTERVAL = 10000; // 10 seconds
const CLOUD_SYNC_INTERVAL = 180000; // 3 minutes

let db: IDBPDatabase<AutosaveDB> | null = null;
let localSaveTimer: ReturnType<typeof setInterval> | null = null;
let cloudSyncTimer: ReturnType<typeof setInterval> | null = null;

async function getDB(): Promise<IDBPDatabase<AutosaveDB>> {
  if (db) return db;

  db = await openDB<AutosaveDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('autosave')) {
        database.createObjectStore('autosave', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('undoStacks')) {
        database.createObjectStore('undoStacks', { keyPath: 'tool' });
      }
    },
  });

  return db;
}

export const useAutosave = create<AutosaveState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isSaving: false,
  lastLocalSave: null,
  lastCloudSync: null,
  hasUnsavedChanges: false,
  pendingRecovery: null,
  undoStacks: {},

  // Initialize
  init: async () => {
    await getDB();
    set({ isInitialized: true });
  },

  // Save to local IndexedDB
  saveLocal: async (sessionId, tool, data) => {
    set({ isSaving: true });

    try {
      const database = await getDB();
      const id = `${sessionId}-${tool}`;

      // Save the undo stack separately
      const undoStack = get().undoStacks[tool];
      if (undoStack) {
        await database.put('undoStacks', {
          tool,
          stack: undoStack.entries,
          currentIndex: undoStack.currentIndex,
          savedAt: Date.now(),
        });
      }

      await database.put('autosave', {
        id,
        sessionId,
        tool,
        data: {
          ...data,
          undoStackId: tool,
        },
        savedAt: Date.now(),
        cloudSyncedAt: null,
      });

      set({
        isSaving: false,
        lastLocalSave: Date.now(),
        hasUnsavedChanges: false,
      });
    } catch (error) {
      console.error('Autosave failed:', error);
      set({ isSaving: false });
    }
  },

  // Load from local IndexedDB
  loadLocal: async (sessionId, tool) => {
    try {
      const database = await getDB();
      const id = `${sessionId}-${tool}`;
      const saved = await database.get('autosave', id);

      if (saved) {
        // Also load the undo stack
        const undoData = await database.get('undoStacks', tool);
        if (undoData) {
          set((state) => ({
            undoStacks: {
              ...state.undoStacks,
              [tool]: {
                entries: undoData.stack,
                currentIndex: undoData.currentIndex,
              },
            },
          }));
        }

        return saved.data;
      }

      return null;
    } catch (error) {
      console.error('Load autosave failed:', error);
      return null;
    }
  },

  // Sync to cloud (placeholder - actual implementation depends on backend)
  syncToCloud: async (sessionId) => {
    try {
      const database = await getDB();
      const allSaves = await database.getAll('autosave');
      const sessionSaves = allSaves.filter((s) => s.sessionId === sessionId);

      // TODO: Implement actual cloud sync via API
      console.log('Cloud sync for session:', sessionId, sessionSaves.length, 'saves');

      // Mark all as synced
      for (const save of sessionSaves) {
        await database.put('autosave', {
          ...save,
          cloudSyncedAt: Date.now(),
        });
      }

      set({ lastCloudSync: Date.now() });
    } catch (error) {
      console.error('Cloud sync failed:', error);
    }
  },

  // Check if recovery is needed
  checkForRecovery: async (sessionId) => {
    try {
      const database = await getDB();
      const allSaves = await database.getAll('autosave');
      const sessionSaves = allSaves.filter((s) => s.sessionId === sessionId);

      // Check if any local save is newer than its cloud sync
      const needsRecovery = sessionSaves.some(
        (s) => s.cloudSyncedAt === null || s.savedAt > s.cloudSyncedAt
      );

      if (needsRecovery && sessionSaves.length > 0) {
        const mostRecent = sessionSaves.reduce((a, b) =>
          a.savedAt > b.savedAt ? a : b
        );
        set({ pendingRecovery: { sessionId, savedAt: mostRecent.savedAt } });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Check recovery failed:', error);
      return false;
    }
  },

  // Recover session data
  recoverSession: async (sessionId) => {
    try {
      const database = await getDB();
      const allSaves = await database.getAll('autosave');
      const sessionSaves = allSaves.filter((s) => s.sessionId === sessionId);

      if (sessionSaves.length === 0) return null;

      // Get most recent save
      const mostRecent = sessionSaves.reduce((a, b) =>
        a.savedAt > b.savedAt ? a : b
      );

      set({ pendingRecovery: null });
      return mostRecent.data;
    } catch (error) {
      console.error('Recovery failed:', error);
      return null;
    }
  },

  // Dismiss recovery prompt
  dismissRecovery: () => set({ pendingRecovery: null }),

  // Mark session as cloud synced
  markCloudSynced: async (sessionId) => {
    try {
      const database = await getDB();
      const allSaves = await database.getAll('autosave');
      const sessionSaves = allSaves.filter((s) => s.sessionId === sessionId);

      for (const save of sessionSaves) {
        await database.put('autosave', {
          ...save,
          cloudSyncedAt: Date.now(),
        });
      }
    } catch (error) {
      console.error('Mark synced failed:', error);
    }
  },

  // Undo system - push entry
  pushUndoEntry: (tool, action, data) => {
    set((state) => {
      const current = state.undoStacks[tool] || { entries: [], currentIndex: -1 };

      // Remove any entries after current index (for redo that wasn't used)
      const entries = current.entries.slice(0, current.currentIndex + 1);

      // Add new entry
      entries.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        action,
        data,
      });

      // Limit to MAX_UNDO_ENTRIES
      while (entries.length > MAX_UNDO_ENTRIES) {
        entries.shift();
      }

      return {
        undoStacks: {
          ...state.undoStacks,
          [tool]: {
            entries,
            currentIndex: entries.length - 1,
          },
        },
        hasUnsavedChanges: true,
      };
    });
  },

  // Undo
  undo: (tool) => {
    const state = get();
    const stack = state.undoStacks[tool];

    if (!stack || stack.currentIndex < 0) return null;

    const entry = stack.entries[stack.currentIndex];

    set((prev) => ({
      undoStacks: {
        ...prev.undoStacks,
        [tool]: {
          ...stack,
          currentIndex: stack.currentIndex - 1,
        },
      },
      hasUnsavedChanges: true,
    }));

    return entry;
  },

  // Redo
  redo: (tool) => {
    const state = get();
    const stack = state.undoStacks[tool];

    if (!stack || stack.currentIndex >= stack.entries.length - 1) return null;

    const nextIndex = stack.currentIndex + 1;
    const entry = stack.entries[nextIndex];

    set((prev) => ({
      undoStacks: {
        ...prev.undoStacks,
        [tool]: {
          ...stack,
          currentIndex: nextIndex,
        },
      },
      hasUnsavedChanges: true,
    }));

    return entry;
  },

  // Get undo stack for tool
  getUndoStack: (tool) => {
    const stack = get().undoStacks[tool];
    return stack || { entries: [], currentIndex: -1 };
  },

  // Clear undo stack
  clearUndoStack: (tool) => {
    set((state) => ({
      undoStacks: {
        ...state.undoStacks,
        [tool]: { entries: [], currentIndex: -1 },
      },
    }));
  },

  // Can undo?
  canUndo: (tool) => {
    const stack = get().undoStacks[tool];
    return stack ? stack.currentIndex >= 0 : false;
  },

  // Can redo?
  canRedo: (tool) => {
    const stack = get().undoStacks[tool];
    return stack ? stack.currentIndex < stack.entries.length - 1 : false;
  },
}));

// Hook to start autosave timers
export function startAutosaveTimers(
  sessionId: string,
  getCurrentToolData: () => { tool: string; data: ToolAutosaveData }
) {
  const { saveLocal, syncToCloud } = useAutosave.getState();

  // Local save every 10 seconds
  if (localSaveTimer) clearInterval(localSaveTimer);
  localSaveTimer = setInterval(() => {
    const { tool, data } = getCurrentToolData();
    saveLocal(sessionId, tool, data);
  }, LOCAL_SAVE_INTERVAL);

  // Cloud sync every 3 minutes
  if (cloudSyncTimer) clearInterval(cloudSyncTimer);
  cloudSyncTimer = setInterval(() => {
    syncToCloud(sessionId);
  }, CLOUD_SYNC_INTERVAL);
}

export function stopAutosaveTimers() {
  if (localSaveTimer) {
    clearInterval(localSaveTimer);
    localSaveTimer = null;
  }
  if (cloudSyncTimer) {
    clearInterval(cloudSyncTimer);
    cloudSyncTimer = null;
  }
}

export default useAutosave;
