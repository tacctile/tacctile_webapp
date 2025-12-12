/**
 * Home Page Store - Manages home page state including storage connections,
 * projects, and view preferences
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

export interface Project {
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
  evidence?: unknown[];
  flags?: unknown[];
  notes?: unknown[];
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

  // Projects & Files
  projects: Project[];
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

  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;

  setMediaFiles: (files: MediaFile[]) => void;
  setSelectedItem: (id: string | null) => void;

  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (query: string) => void;

  setQuickAnalyzeFile: (file: { name: string; type: 'video' | 'audio' | 'image'; url: string } | null) => void;
  setStoragePanelCollapsed: (collapsed: boolean) => void;

  // Derived
  getFilteredProjects: () => Project[];
  getFilteredMediaFiles: () => MediaFile[];
}

// Dummy data for testing
const dummyProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Warehouse_Site_2024',
    path: '/local/projects/warehouse_site_2024',
    storageId: 'local',
    storageType: 'local',
    location: 'Industrial District, Portland',
    thumbnail: undefined,
    evidenceCount: 12,
    flagCount: 8,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'project-2',
    name: 'Audio_Project_Oct',
    path: '/local/projects/audio_project_oct',
    storageId: 'local',
    storageType: 'local',
    thumbnail: undefined,
    evidenceCount: 5,
    flagCount: 3,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'project-3',
    name: 'Shadow_Analysis_Review',
    path: '/local/projects/shadow_analysis_review',
    storageId: 'local',
    storageType: 'local',
    location: 'Observatory Hill',
    thumbnail: undefined,
    evidenceCount: 2,
    flagCount: 1,
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'project-4',
    name: 'Historic_Site_Survey',
    path: '/dropbox/projects/historic_site_survey',
    storageId: 'dropbox',
    storageType: 'dropbox',
    location: 'Old Town Historic District',
    thumbnail: undefined,
    evidenceCount: 8,
    flagCount: 4,
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
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
      projects: dummyProjects,
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

      // Project actions
      setProjects: (projects) => set({ projects }),
      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
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

      // Derived getters
      getFilteredProjects: () => {
        const { projects, activeStorageId, searchQuery, sortBy, sortOrder } = get();

        let filtered = projects;

        // Filter by storage
        if (activeStorageId) {
          filtered = filtered.filter((p) => p.storageId === activeStorageId);
        }

        // Filter by search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter((p) =>
            p.name.toLowerCase().includes(query)
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
      name: 'tacctile-home-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        storagePanelCollapsed: state.storagePanelCollapsed,
        storageLocations: state.storageLocations,
      }),
    }
  )
);

export default useHomeStore;
