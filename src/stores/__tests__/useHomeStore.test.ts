/**
 * Home Store Tests
 *
 * Tests for the useHomeStore Zustand store.
 * Demonstrates patterns for:
 * - Testing state with collections
 * - Testing filtering and sorting logic
 * - Testing CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useHomeStore, type Project, type StorageLocation, type MediaFile } from '../useHomeStore';

// ============================================================================
// TEST DATA
// ============================================================================

const mockStorageLocation: StorageLocation = {
  id: 'test-storage',
  name: 'Test Storage',
  type: 'local',
  connected: true,
};

const mockProject: Project = {
  id: 'test-project-1',
  name: 'Test Project',
  path: '/local/projects/test-project',
  storageId: 'local',
  storageType: 'local',
  location: 'Test Location',
  thumbnail: undefined,
  fileCount: 5,
  flagCount: 3,
  createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  modifiedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
};

const mockMediaFile: MediaFile = {
  id: 'test-file-1',
  name: 'test-audio.mp3',
  path: '/local/files/test-audio.mp3',
  type: 'audio',
  storageId: 'local',
  size: 1024000,
  modifiedAt: Date.now(),
};

// ============================================================================
// TEST SETUP
// ============================================================================

describe('useHomeStore', () => {
  // Reset store before each test
  beforeEach(() => {
    // Reset to initial state by setting known values
    act(() => {
      const store = useHomeStore.getState();
      store.setActiveStorage(null);
      store.setSearchQuery('');
      store.setViewMode('grid');
      store.setSortBy('dateModified');
      store.setSortOrder('desc');
      store.setSelectedItem(null);
      store.setQuickAnalyzeFile(null);
      store.setMediaFiles([]);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // INITIAL STATE TESTS
  // ============================================================================

  describe('Initial State', () => {
    it('should have default storage locations', () => {
      const state = useHomeStore.getState();

      expect(state.storageLocations).toBeDefined();
      expect(state.storageLocations.length).toBeGreaterThan(0);

      // Should have local storage
      const localStorage = state.storageLocations.find((s) => s.type === 'local');
      expect(localStorage).toBeDefined();
      expect(localStorage?.connected).toBe(true);
    });

    it('should have default view preferences', () => {
      const state = useHomeStore.getState();

      expect(state.viewMode).toBe('grid');
      expect(state.sortBy).toBe('dateModified');
      expect(state.sortOrder).toBe('desc');
      expect(state.searchQuery).toBe('');
    });

    it('should have null selection initially', () => {
      const state = useHomeStore.getState();

      expect(state.selectedItemId).toBeNull();
      expect(state.activeStorageId).toBeNull();
      expect(state.quickAnalyzeFile).toBeNull();
    });

    it('should have dummy projects loaded', () => {
      const state = useHomeStore.getState();

      expect(state.projects.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // STORAGE LOCATION TESTS
  // ============================================================================

  describe('Storage Locations', () => {
    it('should add storage location', () => {
      act(() => {
        useHomeStore.getState().addStorageLocation(mockStorageLocation);
      });

      const state = useHomeStore.getState();
      const added = state.storageLocations.find((s) => s.id === mockStorageLocation.id);
      expect(added).toBeDefined();
      expect(added?.name).toBe(mockStorageLocation.name);
    });

    it('should update storage location', () => {
      act(() => {
        useHomeStore.getState().addStorageLocation(mockStorageLocation);
        useHomeStore.getState().updateStorageLocation(mockStorageLocation.id, {
          connected: false,
        });
      });

      const state = useHomeStore.getState();
      const updated = state.storageLocations.find((s) => s.id === mockStorageLocation.id);
      expect(updated?.connected).toBe(false);
    });

    it('should remove storage location', () => {
      act(() => {
        useHomeStore.getState().addStorageLocation(mockStorageLocation);
      });

      // Verify it was added
      expect(useHomeStore.getState().storageLocations.find((s) => s.id === mockStorageLocation.id)).toBeDefined();

      act(() => {
        useHomeStore.getState().removeStorageLocation(mockStorageLocation.id);
      });

      const state = useHomeStore.getState();
      // Just verify the item was removed
      expect(state.storageLocations.find((s) => s.id === mockStorageLocation.id)).toBeUndefined();
    });

    it('should set all storage locations', () => {
      const newLocations: StorageLocation[] = [
        { id: 'new-1', name: 'New Storage 1', type: 'local', connected: true },
        { id: 'new-2', name: 'New Storage 2', type: 'dropbox', connected: false },
      ];

      act(() => {
        useHomeStore.getState().setStorageLocations(newLocations);
      });

      const state = useHomeStore.getState();
      expect(state.storageLocations).toEqual(newLocations);
    });

    it('should set active storage', () => {
      act(() => {
        useHomeStore.getState().setActiveStorage('local');
      });

      expect(useHomeStore.getState().activeStorageId).toBe('local');
    });
  });

  // ============================================================================
  // PROJECT TESTS
  // ============================================================================

  describe('Projects', () => {
    it('should add project', () => {
      const countBefore = useHomeStore.getState().projects.length;

      act(() => {
        useHomeStore.getState().addProject(mockProject);
      });

      const state = useHomeStore.getState();
      expect(state.projects.length).toBe(countBefore + 1);
      expect(state.projects.find((p) => p.id === mockProject.id)).toBeDefined();
    });

    it('should update project', () => {
      act(() => {
        useHomeStore.getState().addProject(mockProject);
        useHomeStore.getState().updateProject(mockProject.id, {
          name: 'Updated Project Name',
          fileCount: 10,
        });
      });

      const state = useHomeStore.getState();
      const updated = state.projects.find((p) => p.id === mockProject.id);
      expect(updated?.name).toBe('Updated Project Name');
      expect(updated?.fileCount).toBe(10);
      // Other fields should remain unchanged
      expect(updated?.storageId).toBe(mockProject.storageId);
    });

    it('should remove project', () => {
      act(() => {
        useHomeStore.getState().addProject(mockProject);
      });

      // Verify it was added
      expect(useHomeStore.getState().projects.find((p) => p.id === mockProject.id)).toBeDefined();

      act(() => {
        useHomeStore.getState().removeProject(mockProject.id);
      });

      const state = useHomeStore.getState();
      // Just verify the item was removed
      expect(state.projects.find((p) => p.id === mockProject.id)).toBeUndefined();
    });

    it('should set all projects', () => {
      const newProjects: Project[] = [
        { ...mockProject, id: 'new-1', name: 'Project 1' },
        { ...mockProject, id: 'new-2', name: 'Project 2' },
      ];

      act(() => {
        useHomeStore.getState().setProjects(newProjects);
      });

      const state = useHomeStore.getState();
      expect(state.projects).toEqual(newProjects);
    });
  });

  // ============================================================================
  // MEDIA FILE TESTS
  // ============================================================================

  describe('Media Files', () => {
    it('should set media files', () => {
      const files: MediaFile[] = [
        mockMediaFile,
        { ...mockMediaFile, id: 'file-2', name: 'video.mp4', type: 'video' },
      ];

      act(() => {
        useHomeStore.getState().setMediaFiles(files);
      });

      expect(useHomeStore.getState().mediaFiles).toEqual(files);
    });

    it('should set selected item', () => {
      act(() => {
        useHomeStore.getState().setSelectedItem('item-123');
      });

      expect(useHomeStore.getState().selectedItemId).toBe('item-123');
    });

    it('should clear selected item', () => {
      act(() => {
        useHomeStore.getState().setSelectedItem('item-123');
        useHomeStore.getState().setSelectedItem(null);
      });

      expect(useHomeStore.getState().selectedItemId).toBeNull();
    });
  });

  // ============================================================================
  // VIEW MODE TESTS
  // ============================================================================

  describe('View Mode', () => {
    it('should set view mode to grid', () => {
      act(() => {
        useHomeStore.getState().setViewMode('grid');
      });

      expect(useHomeStore.getState().viewMode).toBe('grid');
    });

    it('should set view mode to list', () => {
      act(() => {
        useHomeStore.getState().setViewMode('list');
      });

      expect(useHomeStore.getState().viewMode).toBe('list');
    });

    it('should toggle between view modes', () => {
      act(() => {
        useHomeStore.getState().setViewMode('grid');
      });
      expect(useHomeStore.getState().viewMode).toBe('grid');

      act(() => {
        useHomeStore.getState().setViewMode('list');
      });
      expect(useHomeStore.getState().viewMode).toBe('list');
    });
  });

  // ============================================================================
  // SORTING TESTS
  // ============================================================================

  describe('Sorting', () => {
    it('should set sort by name', () => {
      act(() => {
        useHomeStore.getState().setSortBy('name');
      });

      expect(useHomeStore.getState().sortBy).toBe('name');
    });

    it('should set sort by date modified', () => {
      act(() => {
        useHomeStore.getState().setSortBy('dateModified');
      });

      expect(useHomeStore.getState().sortBy).toBe('dateModified');
    });

    it('should set sort by date created', () => {
      act(() => {
        useHomeStore.getState().setSortBy('dateCreated');
      });

      expect(useHomeStore.getState().sortBy).toBe('dateCreated');
    });

    it('should set sort order ascending', () => {
      act(() => {
        useHomeStore.getState().setSortOrder('asc');
      });

      expect(useHomeStore.getState().sortOrder).toBe('asc');
    });

    it('should set sort order descending', () => {
      act(() => {
        useHomeStore.getState().setSortOrder('desc');
      });

      expect(useHomeStore.getState().sortOrder).toBe('desc');
    });
  });

  // ============================================================================
  // SEARCH TESTS
  // ============================================================================

  describe('Search', () => {
    it('should set search query', () => {
      act(() => {
        useHomeStore.getState().setSearchQuery('test query');
      });

      expect(useHomeStore.getState().searchQuery).toBe('test query');
    });

    it('should clear search query', () => {
      act(() => {
        useHomeStore.getState().setSearchQuery('some query');
        useHomeStore.getState().setSearchQuery('');
      });

      expect(useHomeStore.getState().searchQuery).toBe('');
    });
  });

  // ============================================================================
  // QUICK ANALYZE TESTS
  // ============================================================================

  describe('Quick Analyze', () => {
    it('should set quick analyze file', () => {
      const file = { name: 'test.mp3', type: 'audio' as const, url: 'blob:test-url' };

      act(() => {
        useHomeStore.getState().setQuickAnalyzeFile(file);
      });

      expect(useHomeStore.getState().quickAnalyzeFile).toEqual(file);
    });

    it('should clear quick analyze file', () => {
      const file = { name: 'test.mp3', type: 'audio' as const, url: 'blob:test-url' };

      act(() => {
        useHomeStore.getState().setQuickAnalyzeFile(file);
        useHomeStore.getState().setQuickAnalyzeFile(null);
      });

      expect(useHomeStore.getState().quickAnalyzeFile).toBeNull();
    });
  });

  // ============================================================================
  // PANEL STATE TESTS
  // ============================================================================

  describe('Panel State', () => {
    it('should set storage panel collapsed state', () => {
      act(() => {
        useHomeStore.getState().setStoragePanelCollapsed(true);
      });

      expect(useHomeStore.getState().storagePanelCollapsed).toBe(true);

      act(() => {
        useHomeStore.getState().setStoragePanelCollapsed(false);
      });

      expect(useHomeStore.getState().storagePanelCollapsed).toBe(false);
    });
  });

  // ============================================================================
  // FILTERED PROJECTS TESTS
  // ============================================================================

  describe('getFilteredProjects', () => {
    beforeEach(() => {
      // Set up test projects
      const testProjects: Project[] = [
        {
          ...mockProject,
          id: 'proj-1',
          name: 'Alpha Project',
          storageId: 'local',
          createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
          modifiedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
        },
        {
          ...mockProject,
          id: 'proj-2',
          name: 'Beta Project',
          storageId: 'local',
          createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
          modifiedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
        },
        {
          ...mockProject,
          id: 'proj-3',
          name: 'Gamma Project',
          storageId: 'dropbox',
          createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
          modifiedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        },
      ];

      act(() => {
        useHomeStore.getState().setProjects(testProjects);
      });
    });

    it('should return all projects when no filter is active', () => {
      act(() => {
        useHomeStore.getState().setActiveStorage(null);
        useHomeStore.getState().setSearchQuery('');
      });

      const filtered = useHomeStore.getState().getFilteredProjects();
      expect(filtered.length).toBe(3);
    });

    it('should filter by storage id', () => {
      act(() => {
        useHomeStore.getState().setActiveStorage('local');
      });

      const filtered = useHomeStore.getState().getFilteredProjects();
      expect(filtered.length).toBe(2);
      expect(filtered.every((p) => p.storageId === 'local')).toBe(true);
    });

    it('should filter by search query (case insensitive)', () => {
      act(() => {
        useHomeStore.getState().setSearchQuery('alpha');
      });

      const filtered = useHomeStore.getState().getFilteredProjects();
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.name).toBe('Alpha Project');
    });

    it('should combine storage and search filters', () => {
      act(() => {
        useHomeStore.getState().setActiveStorage('local');
        useHomeStore.getState().setSearchQuery('beta');
      });

      const filtered = useHomeStore.getState().getFilteredProjects();
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.name).toBe('Beta Project');
    });

    it('should sort by name ascending', () => {
      act(() => {
        useHomeStore.getState().setSortBy('name');
        useHomeStore.getState().setSortOrder('asc');
      });

      const filtered = useHomeStore.getState().getFilteredProjects();
      expect(filtered[0]?.name).toBe('Alpha Project');
      expect(filtered[1]?.name).toBe('Beta Project');
      expect(filtered[2]?.name).toBe('Gamma Project');
    });

    it('should sort by name descending', () => {
      act(() => {
        useHomeStore.getState().setSortBy('name');
        useHomeStore.getState().setSortOrder('desc');
      });

      const filtered = useHomeStore.getState().getFilteredProjects();
      expect(filtered[0]?.name).toBe('Gamma Project');
      expect(filtered[1]?.name).toBe('Beta Project');
      expect(filtered[2]?.name).toBe('Alpha Project');
    });

    it('should sort by date modified', () => {
      act(() => {
        useHomeStore.getState().setSortBy('dateModified');
        useHomeStore.getState().setSortOrder('desc');
      });

      const filtered = useHomeStore.getState().getFilteredProjects();
      // Most recently modified first
      expect(filtered[0]?.name).toBe('Alpha Project');
    });

    it('should sort by date created', () => {
      act(() => {
        useHomeStore.getState().setSortBy('dateCreated');
        useHomeStore.getState().setSortOrder('desc');
      });

      const filtered = useHomeStore.getState().getFilteredProjects();
      // Most recently created first
      expect(filtered[0]?.name).toBe('Gamma Project');
    });
  });

  // ============================================================================
  // FILTERED MEDIA FILES TESTS
  // ============================================================================

  describe('getFilteredMediaFiles', () => {
    beforeEach(() => {
      const testFiles: MediaFile[] = [
        { ...mockMediaFile, id: 'file-1', name: 'audio1.mp3', storageId: 'local', modifiedAt: Date.now() - 1000 },
        { ...mockMediaFile, id: 'file-2', name: 'audio2.mp3', storageId: 'local', modifiedAt: Date.now() - 2000 },
        { ...mockMediaFile, id: 'file-3', name: 'video1.mp4', storageId: 'dropbox', modifiedAt: Date.now() - 3000 },
      ];

      act(() => {
        useHomeStore.getState().setMediaFiles(testFiles);
      });
    });

    it('should return all files when no filter is active', () => {
      const filtered = useHomeStore.getState().getFilteredMediaFiles();
      expect(filtered.length).toBe(3);
    });

    it('should filter by storage id', () => {
      act(() => {
        useHomeStore.getState().setActiveStorage('local');
      });

      const filtered = useHomeStore.getState().getFilteredMediaFiles();
      expect(filtered.length).toBe(2);
      expect(filtered.every((f) => f.storageId === 'local')).toBe(true);
    });

    it('should filter by search query', () => {
      act(() => {
        useHomeStore.getState().setSearchQuery('video');
      });

      const filtered = useHomeStore.getState().getFilteredMediaFiles();
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.name).toBe('video1.mp4');
    });

    it('should sort by name', () => {
      act(() => {
        useHomeStore.getState().setSortBy('name');
        useHomeStore.getState().setSortOrder('asc');
      });

      const filtered = useHomeStore.getState().getFilteredMediaFiles();
      expect(filtered[0]?.name).toBe('audio1.mp3');
      expect(filtered[1]?.name).toBe('audio2.mp3');
      expect(filtered[2]?.name).toBe('video1.mp4');
    });
  });
});
