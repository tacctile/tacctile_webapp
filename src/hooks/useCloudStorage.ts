/**
 * Cloud Storage Hook
 * Provides storage provider management and file operations
 */

import { useState, useCallback, useEffect } from 'react';
import { cloudStorageService } from '@/services/cloud-storage/CloudStorageService';
import { supabaseService } from '@/services/supabase/SupabaseService';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import type {
  CloudStorageProvider,
  CloudStorageConfig,
  CloudFile,
  CloudFolder,
  UploadProgress,
  CloudStorageQuota,
} from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface ConnectedProvider {
  provider: CloudStorageProvider;
  isConnected: boolean;
  expiresAt?: Date;
  rootFolderId?: string;
  rootFolderName?: string;
}

interface UseCloudStorageReturn {
  // State
  providers: ConnectedProvider[];
  activeProvider: CloudStorageProvider | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Provider management
  connectProvider: (provider: CloudStorageProvider) => Promise<void>;
  disconnectProvider: (provider: CloudStorageProvider) => Promise<void>;
  setActiveProvider: (provider: CloudStorageProvider) => void;
  getAvailableProviders: () => CloudStorageProvider[];

  // File operations
  listFiles: (folderId?: string) => Promise<(CloudFile | CloudFolder)[]>;
  getFile: (fileId: string) => Promise<CloudFile>;
  downloadFile: (fileId: string) => Promise<Blob>;
  uploadFile: (
    file: File,
    folderId?: string,
    onProgress?: (progress: UploadProgress) => void
  ) => Promise<CloudFile>;
  createFolder: (name: string, parentId?: string) => Promise<CloudFolder>;
  deleteFile: (fileId: string) => Promise<void>;
  getShareableLink: (fileId: string) => Promise<string>;
  getQuota: () => Promise<CloudStorageQuota>;

  // Helpers
  getProviderDisplayName: (provider: CloudStorageProvider) => string;
  getProviderIcon: (provider: CloudStorageProvider) => string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCloudStorage(): UseCloudStorageReturn {
  const { user } = useAuth();
  const { isStorageProviderAvailable } = useSubscription();

  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [activeProvider, setActiveProviderState] = useState<CloudStorageProvider | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize and load connected providers
  useEffect(() => {
    const init = async () => {
      if (!user) {
        setProviders([]);
        setActiveProviderState(null);
        setIsInitialized(true);
        return;
      }

      try {
        await cloudStorageService.init();

        // Load connected providers from Supabase
        const allProviders = cloudStorageService.getAvailableProviders();
        const connectedProviders: ConnectedProvider[] = [];

        for (const provider of allProviders) {
          const connection = await supabaseService.getCloudStorageConnection(user.id, provider);

          if (connection) {
            // Check if token is expired
            const isExpired = new Date() > connection.expiresAt;

            connectedProviders.push({
              provider,
              isConnected: !isExpired,
              expiresAt: connection.expiresAt,
              rootFolderId: connection.rootFolderId,
              rootFolderName: connection.rootFolderName,
            });

            // Set credentials if not expired
            if (!isExpired) {
              cloudStorageService.setCredentials(provider, connection.accessToken);
            }
          } else {
            connectedProviders.push({
              provider,
              isConnected: false,
            });
          }
        }

        setProviders(connectedProviders);

        // Set first connected provider as active
        const firstConnected = connectedProviders.find((p) => p.isConnected);
        if (firstConnected) {
          setActiveProviderState(firstConnected.provider);
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('[useCloudStorage] Init error:', err);
        setError((err as Error).message);
        setIsInitialized(true);
      }
    };

    init();
  }, [user]);

  // Get available providers (based on subscription)
  const getAvailableProviders = useCallback((): CloudStorageProvider[] => {
    return cloudStorageService
      .getAvailableProviders()
      .filter((p) => isStorageProviderAvailable(p));
  }, [isStorageProviderAvailable]);

  // Connect to provider
  const connectProvider = useCallback(
    async (provider: CloudStorageProvider): Promise<void> => {
      if (!user) throw new Error('User not authenticated');
      if (!isStorageProviderAvailable(provider)) {
        throw new Error('This storage provider is not available on your plan');
      }

      setIsLoading(true);
      setError(null);

      try {
        const config: CloudStorageConfig = await cloudStorageService.connect(provider);

        // Save to Supabase
        await supabaseService.saveCloudStorageConnection(user.id, provider, {
          accessToken: config.accessToken,
          refreshToken: config.refreshToken,
          expiresAt: config.expiresAt,
        });

        // Update local state
        setProviders((prev) =>
          prev.map((p) =>
            p.provider === provider
              ? { ...p, isConnected: true, expiresAt: config.expiresAt }
              : p
          )
        );

        setActiveProviderState(provider);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user, isStorageProviderAvailable]
  );

  // Disconnect from provider
  const disconnectProvider = useCallback(
    async (provider: CloudStorageProvider): Promise<void> => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        await cloudStorageService.disconnect(provider);
        await supabaseService.deleteCloudStorageConnection(user.id, provider);

        // Update local state
        setProviders((prev) =>
          prev.map((p) =>
            p.provider === provider
              ? { ...p, isConnected: false, expiresAt: undefined }
              : p
          )
        );

        // Switch active provider if disconnecting current
        if (activeProvider === provider) {
          const nextConnected = providers.find(
            (p) => p.isConnected && p.provider !== provider
          );
          setActiveProviderState(nextConnected?.provider || null);
        }
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user, activeProvider, providers]
  );

  // Set active provider
  const setActiveProvider = useCallback((provider: CloudStorageProvider): void => {
    const connectedProvider = providers.find(
      (p) => p.provider === provider && p.isConnected
    );

    if (!connectedProvider) {
      throw new Error('Provider not connected');
    }

    setActiveProviderState(provider);
  }, [providers]);

  // File operations
  const listFiles = useCallback(
    async (folderId?: string): Promise<(CloudFile | CloudFolder)[]> => {
      if (!activeProvider) throw new Error('No active provider');

      setIsLoading(true);
      try {
        return await cloudStorageService.listFiles(folderId, activeProvider);
      } finally {
        setIsLoading(false);
      }
    },
    [activeProvider]
  );

  const getFile = useCallback(
    async (fileId: string): Promise<CloudFile> => {
      if (!activeProvider) throw new Error('No active provider');
      return cloudStorageService.getFile(fileId, activeProvider);
    },
    [activeProvider]
  );

  const downloadFile = useCallback(
    async (fileId: string): Promise<Blob> => {
      if (!activeProvider) throw new Error('No active provider');

      setIsLoading(true);
      try {
        return await cloudStorageService.downloadFile(fileId, activeProvider);
      } finally {
        setIsLoading(false);
      }
    },
    [activeProvider]
  );

  const uploadFile = useCallback(
    async (
      file: File,
      folderId?: string,
      onProgress?: (progress: UploadProgress) => void
    ): Promise<CloudFile> => {
      if (!activeProvider) throw new Error('No active provider');

      setIsLoading(true);
      try {
        return await cloudStorageService.uploadFile(
          file,
          folderId,
          onProgress,
          activeProvider
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeProvider]
  );

  const createFolder = useCallback(
    async (name: string, parentId?: string): Promise<CloudFolder> => {
      if (!activeProvider) throw new Error('No active provider');

      setIsLoading(true);
      try {
        return await cloudStorageService.createFolder(name, parentId, activeProvider);
      } finally {
        setIsLoading(false);
      }
    },
    [activeProvider]
  );

  const deleteFile = useCallback(
    async (fileId: string): Promise<void> => {
      if (!activeProvider) throw new Error('No active provider');

      setIsLoading(true);
      try {
        await cloudStorageService.delete(fileId, activeProvider);
      } finally {
        setIsLoading(false);
      }
    },
    [activeProvider]
  );

  const getShareableLink = useCallback(
    async (fileId: string): Promise<string> => {
      if (!activeProvider) throw new Error('No active provider');
      return cloudStorageService.getShareableLink(fileId, activeProvider);
    },
    [activeProvider]
  );

  const getQuota = useCallback(async (): Promise<CloudStorageQuota> => {
    if (!activeProvider) throw new Error('No active provider');
    return cloudStorageService.getQuota(activeProvider);
  }, [activeProvider]);

  // Helpers
  const getProviderDisplayName = useCallback(
    (provider: CloudStorageProvider): string => {
      return cloudStorageService.getProviderDisplayName(provider);
    },
    []
  );

  const getProviderIcon = useCallback(
    (provider: CloudStorageProvider): string => {
      return cloudStorageService.getProviderIcon(provider);
    },
    []
  );

  return {
    // State
    providers,
    activeProvider,
    isInitialized,
    isLoading,
    error,

    // Provider management
    connectProvider,
    disconnectProvider,
    setActiveProvider,
    getAvailableProviders,

    // File operations
    listFiles,
    getFile,
    downloadFile,
    uploadFile,
    createFolder,
    deleteFile,
    getShareableLink,
    getQuota,

    // Helpers
    getProviderDisplayName,
    getProviderIcon,
  };
}

// ============================================================================
// FILE BROWSER HOOK
// ============================================================================

interface UseFileBrowserOptions {
  rootFolderId?: string;
  onFileSelect?: (file: CloudFile) => void;
}

export function useFileBrowser(options: UseFileBrowserOptions = {}) {
  const { listFiles } = useCloudStorage();

  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    options.rootFolderId
  );
  const [items, setItems] = useState<(CloudFile | CloudFolder)[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id?: string; name: string }[]>([
    { name: 'Root' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load folder contents
  const loadFolder = useCallback(
    async (folderId?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const contents = await listFiles(folderId);
        setItems(contents);
        setCurrentFolderId(folderId);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    },
    [listFiles]
  );

  // Navigate to folder
  const navigateToFolder = useCallback(
    async (folder: CloudFolder) => {
      await loadFolder(folder.id);
      setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    },
    [loadFolder]
  );

  // Navigate back
  const navigateBack = useCallback(async () => {
    if (breadcrumbs.length <= 1) return;

    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    const parentId = newBreadcrumbs[newBreadcrumbs.length - 1]?.id;

    await loadFolder(parentId);
    setBreadcrumbs(newBreadcrumbs);
  }, [breadcrumbs, loadFolder]);

  // Navigate to breadcrumb
  const navigateToBreadcrumb = useCallback(
    async (index: number) => {
      if (index >= breadcrumbs.length - 1) return;

      const targetCrumb = breadcrumbs[index];
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);

      await loadFolder(targetCrumb.id);
      setBreadcrumbs(newBreadcrumbs);
    },
    [breadcrumbs, loadFolder]
  );

  // Handle item click
  const handleItemClick = useCallback(
    (item: CloudFile | CloudFolder) => {
      if ('children' in item || (!('mimeType' in item) && !('size' in item))) {
        // It's a folder
        navigateToFolder(item as CloudFolder);
      } else if (options.onFileSelect) {
        // It's a file
        options.onFileSelect(item as CloudFile);
      }
    },
    [navigateToFolder, options]
  );

  // Refresh current folder
  const refresh = useCallback(() => {
    loadFolder(currentFolderId);
  }, [currentFolderId, loadFolder]);

  // Initial load
  useEffect(() => {
    loadFolder(options.rootFolderId);
  }, [options.rootFolderId, loadFolder]);

  return {
    items,
    breadcrumbs,
    currentFolderId,
    isLoading,
    error,
    navigateToFolder,
    navigateBack,
    navigateToBreadcrumb,
    handleItemClick,
    refresh,
  };
}
