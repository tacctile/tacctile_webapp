/**
 * File Flags Hook
 * Provides flag management with filtering and AI summarization
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  fileFlaggingService,
  FLAG_TYPES,
  FlagTypeMetadata,
} from '@/services/file-flagging/FileFlaggingService';
import { supabaseService } from '@/services/supabase/SupabaseService';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import type {
  FileFlag,
  FlagComment,
  FlagType,
  FileFlagFilter,
  AIFlagAnalysis,
} from '@/types';

// ============================================================================
// FILE FLAGS HOOK
// ============================================================================

interface UseFileFlagsOptions {
  autoRefresh?: boolean;
  initialFilter?: FileFlagFilter;
}

export function useFileFlags(
  fileId: string | null,
  options: UseFileFlagsOptions = {}
) {
  const { user } = useAuth();
  const { isPro, hasFeature } = useSubscription();

  const [flags, setFlags] = useState<FileFlag[]>([]);
  const [filter, setFilter] = useState<FileFlagFilter>(
    options.initialFilter || {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // AI summarization enabled
  const aiEnabled = hasFeature('aiSummarizationEnabled');

  // Load flags
  const loadFlags = useCallback(async () => {
    if (!fileId) {
      setFlags([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fileFlaggingService.getFlags(fileId, filter);
      setFlags(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [fileId, filter]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!fileId || !isPro || !options.autoRefresh) return;

    // Note: We subscribe at the project level in useProject
    // This hook uses the data from there or fetches independently

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [fileId, isPro, options.autoRefresh]);

  // Initial load
  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Create flag
  const createFlag = useCallback(
    async (params: {
      type: FlagType;
      customType?: string;
      timestamp: number;
      endTimestamp?: number;
      title: string;
      description?: string;
      confidence: 'low' | 'medium' | 'high';
      tags?: string[];
      generateAISummary?: boolean;
    }): Promise<FileFlag> => {
      if (!user) throw new Error('User not authenticated');
      if (!fileId) throw new Error('No file loaded');

      const flag = await fileFlaggingService.createFlag({
        ...params,
        fileId,
        user,
        generateAISummary: params.generateAISummary && aiEnabled,
      });

      setFlags((prev) => {
        const updated = [flag, ...prev];
        // Re-sort based on current filter
        if (filter.sortBy === 'timestamp') {
          return updated.sort((a, b) =>
            filter.sortOrder === 'asc'
              ? a.timestamp - b.timestamp
              : b.timestamp - a.timestamp
          );
        }
        return updated;
      });

      return flag;
    },
    [user, fileId, aiEnabled, filter]
  );

  // Update flag
  const updateFlag = useCallback(
    async (
      flagId: string,
      updates: Partial<
        Pick<FileFlag, 'type' | 'customType' | 'title' | 'description' | 'confidence' | 'tags'>
      >
    ): Promise<FileFlag> => {
      const updated = await fileFlaggingService.updateFlag(flagId, updates);
      setFlags((prev) => prev.map((f) => (f.id === flagId ? updated : f)));
      return updated;
    },
    []
  );

  // Delete flag
  const deleteFlag = useCallback(
    async (flagId: string): Promise<void> => {
      if (!fileId) throw new Error('No file loaded');

      await fileFlaggingService.deleteFlag(flagId, fileId);
      setFlags((prev) => prev.filter((f) => f.id !== flagId));
    },
    [fileId]
  );

  // Regenerate AI summary for flag
  const regenerateAISummary = useCallback(
    async (flagId: string): Promise<FileFlag | null> => {
      if (!aiEnabled) throw new Error('AI summarization requires Pro plan');

      const updated = await fileFlaggingService.regenerateAISummary(flagId);
      if (updated) {
        setFlags((prev) => prev.map((f) => (f.id === flagId ? updated : f)));
      }
      return updated;
    },
    [aiEnabled]
  );

  // Update filter
  const updateFilter = useCallback((updates: Partial<FileFlagFilter>) => {
    setFilter((prev) => ({ ...prev, ...updates }));
  }, []);

  // Clear filter
  const clearFilter = useCallback(() => {
    setFilter({});
  }, []);

  // Get flags at specific timestamp
  const getFlagsAtTimestamp = useCallback(
    (timestamp: number, tolerance = 1): FileFlag[] => {
      return flags.filter((f) => {
        const start = f.timestamp - tolerance;
        const end = f.endTimestamp ? f.endTimestamp + tolerance : f.timestamp + tolerance;
        return timestamp >= start && timestamp <= end;
      });
    },
    [flags]
  );

  // Get statistics
  const statistics = useMemo(() => {
    return {
      total: flags.length,
      byType: FLAG_TYPES.reduce((acc, type) => {
        acc[type.type] = flags.filter((f) => f.type === type.type).length;
        return acc;
      }, {} as Record<FlagType, number>),
      byConfidence: {
        low: flags.filter((f) => f.confidence === 'low').length,
        medium: flags.filter((f) => f.confidence === 'medium').length,
        high: flags.filter((f) => f.confidence === 'high').length,
      },
      withAiSummary: flags.filter((f) => f.aiSummary).length,
      totalComments: flags.reduce((sum, f) => sum + f.commentCount, 0),
    };
  }, [flags]);

  return {
    flags,
    filter,
    isLoading,
    error,
    statistics,
    aiEnabled,
    createFlag,
    updateFlag,
    deleteFlag,
    regenerateAISummary,
    updateFilter,
    clearFilter,
    getFlagsAtTimestamp,
    refresh: loadFlags,
  };
}

// ============================================================================
// FLAG COMMENTS HOOK
// ============================================================================

export function useFlagComments(flagId: string | null) {
  const { user } = useAuth();

  const [comments, setComments] = useState<FlagComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load comments
  const loadComments = useCallback(async () => {
    if (!flagId) {
      setComments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fileFlaggingService.getComments(flagId);
      setComments(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [flagId]);

  // Initial load
  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Add comment
  const addComment = useCallback(
    async (content: string, mentions?: string[]): Promise<FlagComment> => {
      if (!user) throw new Error('User not authenticated');
      if (!flagId) throw new Error('No flag selected');

      const comment = await fileFlaggingService.addComment({
        flagId,
        user,
        content,
        mentions,
      });

      setComments((prev) => [...prev, comment]);
      return comment;
    },
    [user, flagId]
  );

  // Update comment
  const updateComment = useCallback(
    async (commentId: string, content: string): Promise<FlagComment> => {
      const updated = await fileFlaggingService.updateComment(commentId, content);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
      return updated;
    },
    []
  );

  // Delete comment
  const deleteComment = useCallback(
    async (commentId: string): Promise<void> => {
      if (!flagId) throw new Error('No flag selected');

      await fileFlaggingService.deleteComment(commentId, flagId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [flagId]
  );

  return {
    comments,
    isLoading,
    error,
    addComment,
    updateComment,
    deleteComment,
    refresh: loadComments,
  };
}

// ============================================================================
// FLAG TYPE SUGGESTION HOOK
// ============================================================================

export function useFlagTypeSuggestion() {
  const { hasFeature } = useSubscription();

  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    suggestedType: FlagType;
    confidence: number;
    reasoning: string;
  } | null>(null);

  const aiEnabled = hasFeature('aiSummarizationEnabled');

  // Get suggestion based on description
  const getSuggestion = useCallback(
    async (description: string): Promise<typeof suggestion> => {
      if (!aiEnabled) return null;
      if (!description.trim()) return null;

      setIsLoading(true);
      try {
        const result = await fileFlaggingService.suggestFlagType(description);
        setSuggestion(result);
        return result;
      } catch (err) {
        console.error('Flag type suggestion failed:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [aiEnabled]
  );

  // Clear suggestion
  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  return {
    suggestion,
    isLoading,
    aiEnabled,
    getSuggestion,
    clearSuggestion,
  };
}

// ============================================================================
// FLAG TYPES HOOK
// ============================================================================

export function useFlagTypes() {
  // All flag types
  const flagTypes = FLAG_TYPES;

  // Get by type
  const getTypeMetadata = useCallback(
    (type: FlagType): FlagTypeMetadata | undefined => {
      return fileFlaggingService.getFlagTypeMetadata(type);
    },
    []
  );

  // Get by category
  const getTypesByCategory = useCallback(
    (category: 'investigation' | 'technical' | 'review'): FlagTypeMetadata[] => {
      return fileFlaggingService.getFlagTypesByCategory(category);
    },
    []
  );

  // Investigation types
  const investigationTypes = useMemo(
    () => getTypesByCategory('investigation'),
    [getTypesByCategory]
  );

  // Technical types
  const technicalTypes = useMemo(
    () => getTypesByCategory('technical'),
    [getTypesByCategory]
  );

  // Review types
  const reviewTypes = useMemo(
    () => getTypesByCategory('review'),
    [getTypesByCategory]
  );

  return {
    flagTypes,
    investigationTypes,
    technicalTypes,
    reviewTypes,
    getTypeMetadata,
    getTypesByCategory,
  };
}

// ============================================================================
// FLAG EXPORT HOOK
// ============================================================================

export function useFlagExport(fileId: string | null) {
  const { isExportFormatAvailable } = useSubscription();

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export to JSON
  const exportToJSON = useCallback(async (): Promise<string> => {
    if (!fileId) throw new Error('No file selected');
    if (!isExportFormatAvailable('json')) {
      throw new Error('JSON export not available on your plan');
    }

    setIsExporting(true);
    setError(null);

    try {
      return await fileFlaggingService.exportFlagsToJSON(fileId);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [fileId, isExportFormatAvailable]);

  // Export to CSV
  const exportToCSV = useCallback(async (): Promise<string> => {
    if (!fileId) throw new Error('No file selected');
    if (!isExportFormatAvailable('csv')) {
      throw new Error('CSV export requires Pro plan');
    }

    setIsExporting(true);
    setError(null);

    try {
      return await fileFlaggingService.exportFlagsToCSV(fileId);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [fileId, isExportFormatAvailable]);

  // Download file
  const downloadExport = useCallback(
    async (format: 'json' | 'csv', filename?: string): Promise<void> => {
      const content = format === 'json' ? await exportToJSON() : await exportToCSV();
      const blob = new Blob([content], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `flags_${fileId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [fileId, exportToJSON, exportToCSV]
  );

  return {
    isExporting,
    error,
    exportToJSON,
    exportToCSV,
    downloadExport,
    canExportJSON: isExportFormatAvailable('json'),
    canExportCSV: isExportFormatAvailable('csv'),
  };
}
