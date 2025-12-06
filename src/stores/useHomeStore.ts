/**
 * Home Page Store - Manages home page state including storage connections,
 * sessions, and view preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Types
export interface StorageLocation {
  id: string;
  name: string;
  type: 'local' | 'google-drive' | 'dropbox' | 'onedrive';
  connected: boolean;
  icon?: string;
}

export type StorageType = 'local' | 'google_drive' | 'dropbox' | 'onedrive';

// Evidence item stored in session - matches TimelineMediaItem structure
export interface SessionEvidence {
  id: string;
  evidenceId: string;
  type: 'video' | 'audio' | 'photo';
  fileName: string;
  thumbnailUrl?: string;
  capturedAt: number;
  duration?: number;
  endAt?: number;
  user: string;
  deviceInfo?: string;
  format?: string;
  gps?: string;
  flagCount: number;
  hasEdits: boolean;
  flags: SessionFlag[];
}

export interface SessionFlag {
  id: string;
  timestamp: number;
  absoluteTimestamp: number;
  title: string;
  note?: string;
  confidence: 'low' | 'medium' | 'high';
  userId: string;
  userDisplayName: string;
  color?: string;
}

export interface SessionNote {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

export interface Session {
  id: string;
  name: string;
  path: string;
  storageId: string;
  storageType: StorageType;
  location?: string;
  thumbnail?: string;
  evidenceCount: number;
  flagCount: number;
  createdAt: number;
  modifiedAt: number;
  evidence: SessionEvidence[];
  flags: SessionFlag[];
  notes: SessionNote[];
}

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  type: 'video' | 'audio' | 'image';
  storageId: string;
  size?: number;
  modifiedAt: number;
}

export type ViewMode = 'grid' | 'list';
export type SortBy = 'name' | 'dateModified' | 'dateCreated';
export type SortOrder = 'asc' | 'desc';

interface HomeState {
  // Storage
  storageLocations: StorageLocation[];
  activeStorageId: string | null;

  // Sessions & Files
  sessions: Session[];
  mediaFiles: MediaFile[];
  selectedItemId: string | null;

  // View state
  viewMode: ViewMode;
  sortBy: SortBy;
  sortOrder: SortOrder;
  searchQuery: string;

  // Quick Analyze
  quickAnalyzeFile: { name: string; type: 'video' | 'audio' | 'image'; url: string } | null;

  // Panel state
  storagePanelCollapsed: boolean;

  // Actions
  setStorageLocations: (locations: StorageLocation[]) => void;
  addStorageLocation: (location: StorageLocation) => void;
  updateStorageLocation: (id: string, updates: Partial<StorageLocation>) => void;
  removeStorageLocation: (id: string) => void;
  setActiveStorage: (id: string | null) => void;

  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;

  setMediaFiles: (files: MediaFile[]) => void;
  setSelectedItem: (id: string | null) => void;

  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (query: string) => void;

  setQuickAnalyzeFile: (file: { name: string; type: 'video' | 'audio' | 'image'; url: string } | null) => void;
  setStoragePanelCollapsed: (collapsed: boolean) => void;

  // Session evidence management
  addSessionEvidence: (sessionId: string, evidence: SessionEvidence[]) => void;
  updateSessionEvidence: (sessionId: string, evidence: SessionEvidence[]) => void;

  // Derived
  getSessionById: (sessionId: string) => Session | undefined;
  getFilteredSessions: () => Session[];
  getFilteredMediaFiles: () => MediaFile[];
}

// Dummy data for testing
const dummySessions: Session[] = [
  {
    id: 'session-1',
    name: 'Warehouse_Site_2024',
    path: '/local/sessions/warehouse_site_2024',
    storageId: 'local',
    storageType: 'local',
    location: 'Industrial District, Portland',
    thumbnail: undefined,
    evidenceCount: 12,
    flagCount: 8,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    evidence: [],
    flags: [],
    notes: [],
  },
  {
    id: 'session-2',
    name: 'Audio_Session_Oct',
    path: '/local/sessions/audio_session_oct',
    storageId: 'local',
    storageType: 'local',
    thumbnail: undefined,
    evidenceCount: 5,
    flagCount: 3,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    evidence: [],
    flags: [],
    notes: [],
  },
  {
    id: 'session-3',
    name: 'Shadow_Analysis_Review',
    path: '/local/sessions/shadow_analysis_review',
    storageId: 'local',
    storageType: 'local',
    location: 'Observatory Hill',
    thumbnail: undefined,
    evidenceCount: 2,
    flagCount: 1,
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    evidence: [],
    flags: [],
    notes: [],
  },
  {
    id: 'session-4',
    name: 'Historic_Site_Survey',
    path: '/dropbox/sessions/historic_site_survey',
    storageId: 'dropbox',
    storageType: 'dropbox',
    location: 'Old Town Historic District',
    thumbnail: undefined,
    evidenceCount: 8,
    flagCount: 4,
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    evidence: [],
    flags: [],
    notes: [],
  },
];

const defaultStorageLocations: StorageLocation[] = [
  { id: 'local', name: 'Local', type: 'local', connected: true },
  { id: 'google-drive', name: 'Google Drive', type: 'google-drive', connected: false },
  { id: 'dropbox', name: 'Dropbox', type: 'dropbox', connected: true },
  { id: 'onedrive', name: 'OneDrive', type: 'onedrive', connected: false },
];

export const useHomeStore = create<HomeState>()(
  persist(
    (set, get) => ({
      // Initial state
      storageLocations: defaultStorageLocations,
      activeStorageId: null,
      sessions: dummySessions,
      mediaFiles: [],
      selectedItemId: null,
      viewMode: 'grid',
      sortBy: 'dateModified',
      sortOrder: 'desc',
      searchQuery: '',
      quickAnalyzeFile: null,
      storagePanelCollapsed: false,

      // Storage actions
      setStorageLocations: (locations) => set({ storageLocations: locations }),
      addStorageLocation: (location) =>
        set((state) => ({
          storageLocations: [...state.storageLocations, location],
        })),
      updateStorageLocation: (id, updates) =>
        set((state) => ({
          storageLocations: state.storageLocations.map((loc) =>
            loc.id === id ? { ...loc, ...updates } : loc
          ),
        })),
      removeStorageLocation: (id) =>
        set((state) => ({
          storageLocations: state.storageLocations.filter((loc) => loc.id !== id),
        })),
      setActiveStorage: (id) => set({ activeStorageId: id }),

      // Session actions
      setSessions: (sessions) => set({ sessions }),
      addSession: (session) =>
        set((state) => ({ sessions: [...state.sessions, session] })),
      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
        })),

      // Media file actions
      setMediaFiles: (files) => set({ mediaFiles: files }),
      setSelectedItem: (id) => set({ selectedItemId: id }),

      // View actions
      setViewMode: (mode) => set({ viewMode: mode }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (order) => set({ sortOrder: order }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Quick Analyze
      setQuickAnalyzeFile: (file) => set({ quickAnalyzeFile: file }),
      setStoragePanelCollapsed: (collapsed) => set({ storagePanelCollapsed: collapsed }),

      // Session evidence management
      addSessionEvidence: (sessionId, evidence) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  evidence: [...(s.evidence || []), ...evidence],
                  evidenceCount: (s.evidence?.length || 0) + evidence.length,
                  modifiedAt: Date.now(),
                }
              : s
          ),
        })),

      updateSessionEvidence: (sessionId, evidence) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  evidence,
                  evidenceCount: evidence.length,
                  modifiedAt: Date.now(),
                }
              : s
          ),
        })),

      // Derived getters
      getSessionById: (sessionId) => {
        const { sessions } = get();
        return sessions.find((s) => s.id === sessionId);
      },

      getFilteredSessions: () => {
        const { sessions, activeStorageId, searchQuery, sortBy, sortOrder } = get();

        let filtered = sessions;

        // Filter by storage
        if (activeStorageId) {
          filtered = filtered.filter((s) => s.storageId === activeStorageId);
        }

        // Filter by search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter((s) =>
            s.name.toLowerCase().includes(query)
          );
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'dateModified':
              comparison = a.modifiedAt - b.modifiedAt;
              break;
            case 'dateCreated':
              comparison = a.createdAt - b.createdAt;
              break;
          }
          return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
      },

      getFilteredMediaFiles: () => {
        const { mediaFiles, activeStorageId, searchQuery, sortBy, sortOrder } = get();

        let filtered = mediaFiles;

        if (activeStorageId) {
          filtered = filtered.filter((f) => f.storageId === activeStorageId);
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter((f) =>
            f.name.toLowerCase().includes(query)
          );
        }

        filtered = [...filtered].sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'dateModified':
            case 'dateCreated':
              comparison = a.modifiedAt - b.modifiedAt;
              break;
          }
          return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
      },
    }),
    {
      name: 'tacctile-home',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        storagePanelCollapsed: state.storagePanelCollapsed,
        storageLocations: state.storageLocations,
        sessions: state.sessions,
      }),
    }
  )
);

export default useHomeStore;
